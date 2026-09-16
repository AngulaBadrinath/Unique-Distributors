<?php

namespace App\Services\Order;

use App\DTOs\Order\CreateOrderDTO;
use App\DTOs\Order\CreateOrderItemDTO;
use App\Enums\AdjustmentStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Invoices\InvoiceGeneratorService;
use App\Services\Notification\DomainNotificationDispatcher;
use App\Services\Pricing\PriceBoundaryService;
use App\Services\Tax\TaxCalculationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class OrderService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected PriceBoundaryService $priceBoundaryService,
        protected TaxCalculationService $taxCalculationService,
        protected OrderNumberGenerator $orderNumberGenerator,
        protected ?InvoiceGeneratorService $invoiceGeneratorService = null,
        protected ?DomainNotificationDispatcher $notificationDispatcher = null,
    ) {
        $this->invoiceGeneratorService ??= app(InvoiceGeneratorService::class);
        $this->notificationDispatcher ??= app(DomainNotificationDispatcher::class);
    }

    /**
     * Authoritatively create and submit a new wholesale sales order.
     * Executes inside a single database transaction with pessimistic row locking,
     * exact financial calculations, immutable line snapshots, and idempotency protection.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     * @throws ConflictHttpException
     */
    public function createOrder(User $actor, CreateOrderDTO $dto, ?string $clientIp = null): Order
    {
        // 1. Authorize actor permissions
        $this->permissionService->authorize($actor, Permission::ORDER_CREATE);
        $this->permissionService->authorize($actor, Permission::ORDER_SUBMIT);

        // 2. Validate basic payload constraints
        if (empty($dto->items)) {
            throw ValidationException::withMessages([
                'items' => 'An order must contain at least one product item.',
            ]);
        }

        // 3. Advisory cache/redis lock (strictly non-authoritative optimization)
        return $this->withAdvisoryLock($actor, $dto->idempotencyKey, function () use ($actor, $dto, $clientIp) {
            try {
                return DB::transaction(function () use ($actor, $dto, $clientIp) {
                    // 4. Idempotency Check & Fast Replay
                    $existingOrder = Order::with(['items', 'customer', 'salesman'])
                        ->where('idempotency_key', $dto->idempotencyKey)
                        ->lockForUpdate()
                        ->first();

                    if ($existingOrder) {
                        return $this->resolveIdempotentReplayOrConflict($existingOrder, $actor, $dto, false);
                    }

                    // 5. Resolve & Scoped-Lock Customer
                    /** @var Customer|null $customer */
                    $customer = Customer::forUser($actor)
                        ->where('id', $dto->customerId)
                        ->lockForUpdate()
                        ->first();

                    if (! $customer) {
                        if ($actor->role === UserRole::SALESMAN) {
                            throw ValidationException::withMessages([
                                'customer_id' => 'The selected customer is not assigned to your salesman account.',
                            ]);
                        }

                        throw ValidationException::withMessages([
                            'customer_id' => 'The selected customer does not exist.',
                        ]);
                    }

                    // Verify customer lifecycle ordering eligibility (ACTIVE only)
                    $customer->ensureCanPlaceOrders();

                    // 6. Collect and sort product IDs in ascending order for deterministic deadlock-free locking
                    $productIds = array_values(array_unique(array_map(
                        fn (CreateOrderItemDTO $item) => $item->productId,
                        $dto->items
                    )));
                    sort($productIds, SORT_NUMERIC);

                    // 7. Lock all Products in deterministic order (SELECT FOR UPDATE)
                    $products = Product::with('taxProfile')
                        ->whereIn('id', $productIds)
                        ->orderBy('id', 'asc')
                        ->lockForUpdate()
                        ->get()
                        ->keyBy('id');

                    if ($products->count() !== count($productIds)) {
                        throw ValidationException::withMessages([
                            'items' => 'One or more selected products are invalid or no longer exist in the catalog.',
                        ]);
                    }

                    // 8. Validate each Product and Calculate Line-Level Taxes & Snapshots
                    $orderItemRows = [];
                    $lineTaxResults = [];

                    foreach ($dto->items as $index => $itemDto) {
                        /** @var Product $product */
                        $product = $products->get($itemDto->productId);

                        // Verify product is ACTIVE and can be ordered
                        $product->ensureCanOrder();

                        // Determine requested unit price (defaults to product default_selling_price if omitted)
                        $rawPrice = $itemDto->unitPrice !== null && $itemDto->unitPrice !== ''
                            ? $itemDto->unitPrice
                            : (string) $product->default_selling_price;

                        // Validate price boundary (min <= price <= mrp).
                        // Salesman lacks pricing.override, so out-of-bound prices throw ValidationException.
                        $validatedUnitPrice = $this->priceBoundaryService->validateOrderUnitPrice($product, $rawPrice);

                        // Calculate line tax using exact BCMath and ROUND_HALF_UP
                        $taxResult = $this->taxCalculationService->calculateLineTax(
                            productOrTaxProfile: $product->taxProfile,
                            unitPrice: $validatedUnitPrice,
                            quantity: $itemDto->quantity
                        );

                        $lineTaxResults[] = $taxResult;

                        $orderItemRows[] = [
                            'product_id' => $product->id,
                            'product_name_snapshot' => $product->name,
                            'sku_snapshot' => $product->sku,
                            'unit_snapshot' => $product->unit,
                            'ordered_quantity' => $itemDto->quantity,
                            'cancelled_quantity' => 0,
                            'reserved_quantity' => 0,
                            'picked_quantity' => 0,
                            'dispatched_quantity' => 0,
                            'delivered_quantity' => 0,
                            'returned_quantity' => 0,
                            'unit_price' => $validatedUnitPrice,
                            'is_price_overridden' => false,
                            'price_override_reason' => null,
                            'price_override_approved_by' => null,
                            'tax_profile_id' => $product->tax_profile_id,
                            'tax_profile_code_snapshot' => $product->taxProfile?->code,
                            'tax_profile_name_snapshot' => $product->taxProfile?->name,
                            'tax_rate_snapshot' => $taxResult->taxRate,
                            'taxable_amount' => $taxResult->taxableAmount,
                            'tax_amount' => $taxResult->taxAmount,
                            'line_total' => $taxResult->lineTotal,
                        ];
                    }

                    // 9. Calculate aggregate order totals
                    $totals = $this->taxCalculationService->calculateOrderTotals($lineTaxResults);

                    // 10. Generate next collision-safe sequential Order Number (ORD-YYYY-XXXXXX)
                    $orderNumber = $this->orderNumberGenerator->generate();

                    // 11. Determine authoritative salesman ID
                    $salesmanId = $actor->role === UserRole::SALESMAN
                        ? $actor->id
                        : ($customer->salesman_id ?? $actor->id);

                    // 12. Persist Order Header (PostgreSQL UNIQUE(idempotency_key) constraint guard)
                    $order = Order::create([
                        'order_number' => $orderNumber,
                        'draft_token' => (string) Str::uuid(),
                        'version' => 1,
                        'idempotency_key' => $dto->idempotencyKey,
                        'customer_id' => $customer->id,
                        'salesman_id' => $salesmanId,
                        'created_by' => $actor->id,
                        'status' => OrderStatus::SUBMITTED,
                        'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
                        'payment_status' => PaymentStatus::UNPAID,
                        'delivery_status' => DeliveryStatus::PENDING_ASSIGNMENT,
                        'adjustment_status' => AdjustmentStatus::NONE,
                        'currency' => 'USD',
                        'subtotal' => $totals['taxable_total'],
                        'tax_total' => $totals['tax_total'],
                        'adjustment_total' => '0.00',
                        'grand_total' => $totals['grand_total'],
                        'notes' => $dto->notes,
                        'submitted_at' => Carbon::now(),
                    ]);

                    // 13. Persist Order Items
                    $order->items()->createMany($orderItemRows);

                    // 14. Authoritatively Generate Order Invoice upon Submission
                    $this->invoiceGeneratorService->generateForOrder($order, $actor);

                    // 15. Queue Domain Notifications (dispatched strictly after transaction commit)
                    DB::afterCommit(function () use ($order) {
                        $this->notificationDispatcher->notifyOrderSubmitted($order);
                    });

                    // 16. Emit Structured Audit Event (Exactly once for winning transaction)
                    Log::info('commerce.order_event', [
                        'action' => 'ORDER_CREATED',
                        'order_id' => $order->id,
                        'order_number' => $order->order_number,
                        'draft_token' => $order->draft_token,
                        'customer_id' => $order->customer_id,
                        'salesman_id' => $order->salesman_id,
                        'created_by' => $order->created_by,
                        'item_count' => count($orderItemRows),
                        'subtotal' => $order->subtotal,
                        'tax_total' => $order->tax_total,
                        'grand_total' => $order->grand_total,
                        'idempotency_key' => $order->idempotency_key,
                        'was_draft' => false,
                        'ip_address' => $clientIp,
                        'timestamp' => Carbon::now()->toIso8601String(),
                    ]);

                    return $order->load(['items', 'customer', 'salesman']);
                });
            } catch (\Throwable $e) {
                // If a concurrent race bypassed the initial SELECT and collided on PostgreSQL UNIQUE(idempotency_key)
                if ($this->isUniqueKeyViolation($e)) {
                    // Transaction has fully rolled back. Query the committed winning order freshly.
                    $committedOrder = Order::with(['items', 'customer', 'salesman'])
                        ->where('idempotency_key', $dto->idempotencyKey)
                        ->first();

                    if ($committedOrder) {
                        return $this->resolveIdempotentReplayOrConflict($committedOrder, $actor, $dto, true);
                    }
                }

                throw $e;
            }
        });
    }

    /**
     * Save an order as a persistent working draft.
     * Supports creating a new draft or updating an existing draft atomically with optimistic version locking.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     * @throws ConflictHttpException
     */
    public function saveDraft(User $actor, \App\DTOs\Order\SaveOrderDraftDTO $dto, ?Order $existingDraft = null, ?string $clientIp = null): Order
    {
        $this->permissionService->authorize($actor, Permission::ORDER_CREATE);

        return DB::transaction(function () use ($actor, $dto, $existingDraft, $clientIp) {
            // 1. Resolve and Scoped-Lock Customer
            /** @var Customer|null $customer */
            $customer = Customer::forUser($actor)
                ->where('id', $dto->customerId)
                ->lockForUpdate()
                ->first();

            if (! $customer) {
                if ($actor->role === UserRole::SALESMAN) {
                    throw ValidationException::withMessages([
                        'customer_id' => 'The selected customer is not assigned to your salesman account.',
                    ]);
                }

                throw ValidationException::withMessages([
                    'customer_id' => 'The selected customer does not exist.',
                ]);
            }

            // On draft creation, customer must be ACTIVE
            if (! $existingDraft) {
                $customer->ensureCanPlaceOrders();
            }

            // 2. Handle Existing Draft Locking & Optimistic Concurrency
            if ($existingDraft) {
                /** @var Order $existingDraft */
                $existingDraft = Order::where('id', $existingDraft->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! $existingDraft->isDraft()) {
                    throw ValidationException::withMessages([
                        'status' => 'This order has already been submitted and cannot be modified as a draft.',
                    ]);
                }

                if ($actor->role === UserRole::SALESMAN && $existingDraft->salesman_id !== $actor->id) {
                    throw new AuthorizationException('You are not authorized to update drafts for other salesmen.');
                }

                if ($dto->expectedVersion !== null && $existingDraft->version !== $dto->expectedVersion) {
                    throw new ConflictHttpException('This draft has been modified in another session or window. Please reload to see latest changes.');
                }
            }

            // 3. Process Preview Products and Taxes
            $draftItemRows = [];
            $lineTaxResults = [];

            if (! empty($dto->items)) {
                $productIds = array_values(array_unique(array_map(
                    fn (\App\DTOs\Order\CreateOrderItemDTO $item) => $item->productId,
                    $dto->items
                )));
                sort($productIds, SORT_NUMERIC);

                $products = Product::with('taxProfile')
                    ->whereIn('id', $productIds)
                    ->orderBy('id', 'asc')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                if ($products->count() !== count($productIds)) {
                    throw ValidationException::withMessages([
                        'items' => 'One or more selected products in the draft no longer exist in the catalog.',
                    ]);
                }

                foreach ($dto->items as $itemDto) {
                    /** @var Product $product */
                    $product = $products->get($itemDto->productId);

                    $rawPrice = $itemDto->unitPrice !== null && $itemDto->unitPrice !== ''
                        ? $itemDto->unitPrice
                        : (string) $product->default_selling_price;

                    $validatedUnitPrice = $this->priceBoundaryService->validateOrderUnitPrice($product, $rawPrice);

                    $taxResult = $this->taxCalculationService->calculateLineTax(
                        productOrTaxProfile: $product->taxProfile,
                        unitPrice: $validatedUnitPrice,
                        quantity: $itemDto->quantity
                    );

                    $lineTaxResults[] = $taxResult;

                    $draftItemRows[] = [
                        'product_id' => $product->id,
                        'product_name_snapshot' => $product->name,
                        'sku_snapshot' => $product->sku,
                        'unit_snapshot' => $product->unit,
                        'ordered_quantity' => $itemDto->quantity,
                        'cancelled_quantity' => 0,
                        'reserved_quantity' => 0,
                        'picked_quantity' => 0,
                        'dispatched_quantity' => 0,
                        'delivered_quantity' => 0,
                        'returned_quantity' => 0,
                        'unit_price' => $validatedUnitPrice,
                        'is_price_overridden' => false,
                        'price_override_reason' => null,
                        'price_override_approved_by' => null,
                        'tax_profile_id' => $product->tax_profile_id,
                        'tax_profile_code_snapshot' => $product->taxProfile?->code,
                        'tax_profile_name_snapshot' => $product->taxProfile?->name,
                        'tax_rate_snapshot' => $taxResult->taxRate,
                        'taxable_amount' => $taxResult->taxableAmount,
                        'tax_amount' => $taxResult->taxAmount,
                        'line_total' => $taxResult->lineTotal,
                    ];
                }

                $totals = $this->taxCalculationService->calculateOrderTotals($lineTaxResults);
            } else {
                $totals = [
                    'taxable_total' => '0.00',
                    'tax_total' => '0.00',
                    'grand_total' => '0.00',
                ];
            }

            $salesmanId = $actor->role === UserRole::SALESMAN
                ? $actor->id
                : ($customer->salesman_id ?? $actor->id);

            if ($existingDraft) {
                // Synchronize existing draft items
                $existingDraft->items()->delete();
                $existingDraft->update([
                    'customer_id' => $customer->id,
                    'notes' => $dto->notes,
                    'subtotal' => $totals['taxable_total'],
                    'tax_total' => $totals['tax_total'],
                    'grand_total' => $totals['grand_total'],
                    'version' => $existingDraft->version + 1,
                ]);

                if (! empty($draftItemRows)) {
                    $existingDraft->items()->createMany($draftItemRows);
                }

                $order = $existingDraft;
            } else {
                // Create new DRAFT order
                $draftToken = (string) \Illuminate\Support\Str::uuid();
                $idempotencyKey = $dto->idempotencyKey ?: (string) \Illuminate\Support\Str::uuid();

                $order = Order::create([
                    'order_number' => null, // Formal order number only issued upon submission
                    'draft_token' => $draftToken,
                    'idempotency_key' => $idempotencyKey,
                    'version' => 1,
                    'customer_id' => $customer->id,
                    'salesman_id' => $salesmanId,
                    'created_by' => $actor->id,
                    'status' => OrderStatus::DRAFT,
                    'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
                    'payment_status' => PaymentStatus::UNPAID,
                    'delivery_status' => DeliveryStatus::PENDING_ASSIGNMENT,
                    'adjustment_status' => AdjustmentStatus::NONE,
                    'currency' => 'USD',
                    'subtotal' => $totals['taxable_total'],
                    'tax_total' => $totals['tax_total'],
                    'adjustment_total' => '0.00',
                    'grand_total' => $totals['grand_total'],
                    'notes' => $dto->notes,
                    'submitted_at' => null,
                ]);

                if (! empty($draftItemRows)) {
                    $order->items()->createMany($draftItemRows);
                }
            }

            // Emit Structured Audit Log for Draft Save
            Log::info('commerce.order_event', [
                'action' => 'ORDER_DRAFT_SAVED',
                'order_id' => $order->id,
                'draft_token' => $order->draft_token,
                'customer_id' => $order->customer_id,
                'salesman_id' => $order->salesman_id,
                'created_by' => $order->created_by,
                'item_count' => count($draftItemRows),
                'subtotal' => $order->subtotal,
                'tax_total' => $order->tax_total,
                'grand_total' => $order->grand_total,
                'version' => $order->version,
                'ip_address' => $clientIp,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);

            return $order->load(['items', 'customer', 'salesman']);
        });
    }

    /**
     * Submit an existing draft order, transitioning it to SUBMITTED.
     * Re-validates customer lifecycle, active product catalogs, price boundaries,
     * recalculates authoritative taxes, generates sequential order number, and commits atomically.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     * @throws ConflictHttpException
     */
    public function submitDraft(User $actor, Order $draft, ?string $submissionIdempotencyKey = null, ?string $clientIp = null): Order
    {
        $this->permissionService->authorize($actor, Permission::ORDER_SUBMIT);

        $targetKey = $submissionIdempotencyKey ?: $draft->idempotency_key;

        return $this->withAdvisoryLock($actor, $targetKey, function () use ($actor, $draft, $submissionIdempotencyKey, $targetKey, $clientIp) {
            try {
                return DB::transaction(function () use ($actor, $draft, $submissionIdempotencyKey, $targetKey, $clientIp) {
                    // 1. Lock Draft Order row
                    /** @var Order $lockedDraft */
                    $lockedDraft = Order::with('items')
                        ->where('id', $draft->id)
                        ->lockForUpdate()
                        ->firstOrFail();

                    // Check if already submitted (idempotent replay for double-submission of same draft)
                    if ($lockedDraft->status === OrderStatus::SUBMITTED) {
                        if ($actor->role === UserRole::SALESMAN && $lockedDraft->salesman_id !== $actor->id) {
                            throw new AuthorizationException('This order belongs to another salesman.');
                        }

                        Log::info('commerce.order_event', [
                            'action' => 'ORDER_IDEMPOTENT_REPLAY',
                            'order_id' => $lockedDraft->id,
                            'order_number' => $lockedDraft->order_number,
                            'idempotency_key' => $lockedDraft->idempotency_key,
                            'actor_id' => $actor->id,
                            'was_draft' => true,
                            'timestamp' => Carbon::now()->toIso8601String(),
                        ]);

                        return $lockedDraft->load(['items', 'customer', 'salesman']);
                    }

                    if (! $lockedDraft->isDraft()) {
                        throw new ConflictHttpException('This order is not in draft status and cannot be submitted.');
                    }

                    if ($actor->role === UserRole::SALESMAN && $lockedDraft->salesman_id !== $actor->id) {
                        throw new AuthorizationException('You are not authorized to submit drafts for other salesmen.');
                    }

                    if ($lockedDraft->items->isEmpty()) {
                        throw ValidationException::withMessages([
                            'items' => 'A draft order must contain at least one product item before submission.',
                        ]);
                    }

                    // Check if a DIFFERENT order already exists with the target idempotency key
                    if ($submissionIdempotencyKey && $submissionIdempotencyKey !== $lockedDraft->idempotency_key) {
                        $existingWithKey = Order::where('idempotency_key', $submissionIdempotencyKey)
                            ->where('id', '!=', $lockedDraft->id)
                            ->first();

                        if ($existingWithKey) {
                            if ($actor->role === UserRole::SALESMAN && $existingWithKey->salesman_id !== $actor->id) {
                                throw new AuthorizationException('This idempotency key belongs to an order submitted by another salesman.');
                            }

                            Log::warning('commerce.order_event', [
                                'action' => 'ORDER_IDEMPOTENCY_CONFLICT',
                                'order_id' => $existingWithKey->id,
                                'idempotency_key' => $submissionIdempotencyKey,
                                'actor_id' => $actor->id,
                            ]);

                            throw new ConflictHttpException('An order with this idempotency key already exists.');
                        }
                    }

                    // 2. Lock and Validate Customer
                    /** @var Customer|null $customer */
                    $customer = Customer::forUser($actor)
                        ->where('id', $lockedDraft->customer_id)
                        ->lockForUpdate()
                        ->first();

                    if (! $customer) {
                        throw ValidationException::withMessages([
                            'customer_id' => 'The selected customer does not exist or is not assigned to your account.',
                        ]);
                    }

                    $customer->ensureCanPlaceOrders();

                    // 3. Lock Products in ascending order
                    $productIds = $lockedDraft->items->pluck('product_id')->unique()->values()->all();
                    sort($productIds, SORT_NUMERIC);

                    $products = Product::with('taxProfile')
                        ->whereIn('id', $productIds)
                        ->orderBy('id', 'asc')
                        ->lockForUpdate()
                        ->get()
                        ->keyBy('id');

                    if ($products->count() !== count($productIds)) {
                        throw ValidationException::withMessages([
                            'items' => 'One or more products in this draft no longer exist in the catalog.',
                        ]);
                    }

                    // 4. Validate Each Product, Price Boundaries, and Calculate Authoritative Line Taxes
                    $finalizedItemRows = [];
                    $lineTaxResults = [];

                    foreach ($lockedDraft->items as $draftItem) {
                        /** @var Product $product */
                        $product = $products->get($draftItem->product_id);

                        // Verify product is currently ACTIVE
                        $product->ensureCanOrder();

                        // Re-validate unit price against current price boundaries
                        $validatedUnitPrice = $this->priceBoundaryService->validateOrderUnitPrice(
                            $product,
                            (string) $draftItem->unit_price
                        );

                        // Recalculate line tax authoritatively
                        $taxResult = $this->taxCalculationService->calculateLineTax(
                            productOrTaxProfile: $product->taxProfile,
                            unitPrice: $validatedUnitPrice,
                            quantity: $draftItem->ordered_quantity
                        );

                        $lineTaxResults[] = $taxResult;

                        $finalizedItemRows[] = [
                            'product_id' => $product->id,
                            'product_name_snapshot' => $product->name,
                            'sku_snapshot' => $product->sku,
                            'unit_snapshot' => $product->unit,
                            'ordered_quantity' => $draftItem->ordered_quantity,
                            'cancelled_quantity' => 0,
                            'reserved_quantity' => 0,
                            'picked_quantity' => 0,
                            'dispatched_quantity' => 0,
                            'delivered_quantity' => 0,
                            'returned_quantity' => 0,
                            'unit_price' => $validatedUnitPrice,
                            'is_price_overridden' => false,
                            'price_override_reason' => null,
                            'price_override_approved_by' => null,
                            'tax_profile_id' => $product->tax_profile_id,
                            'tax_profile_code_snapshot' => $product->taxProfile?->code,
                            'tax_profile_name_snapshot' => $product->taxProfile?->name,
                            'tax_rate_snapshot' => $taxResult->taxRate,
                            'taxable_amount' => $taxResult->taxableAmount,
                            'tax_amount' => $taxResult->taxAmount,
                            'line_total' => $taxResult->lineTotal,
                        ];
                    }

                    // 5. Authoritative Totals & Order Number
                    $totals = $this->taxCalculationService->calculateOrderTotals($lineTaxResults);
                    $orderNumber = $this->orderNumberGenerator->generate();

                    // 6. Transition Order Header to SUBMITTED
                    $lockedDraft->update([
                        'order_number' => $orderNumber,
                        'idempotency_key' => $targetKey,
                        'status' => OrderStatus::SUBMITTED,
                        'submitted_at' => Carbon::now(),
                        'subtotal' => $totals['taxable_total'],
                        'tax_total' => $totals['tax_total'],
                        'grand_total' => $totals['grand_total'],
                    ]);

                    // 7. Finalize Order Items with immutable snapshots
                    $lockedDraft->items()->delete();
                    $lockedDraft->items()->createMany($finalizedItemRows);

                    // 8. Authoritatively Generate Order Invoice upon Draft Submission
                    $this->invoiceGeneratorService->generateForOrder($lockedDraft, $actor);

                    // 9. Queue Domain Notifications (dispatched strictly after transaction commit)
                    DB::afterCommit(function () use ($lockedDraft) {
                        $this->notificationDispatcher->notifyOrderSubmitted($lockedDraft);
                    });

                    // 10. Emit ORDER_CREATED audit with was_draft = true
                    Log::info('commerce.order_event', [
                        'action' => 'ORDER_CREATED',
                        'order_id' => $lockedDraft->id,
                        'order_number' => $lockedDraft->order_number,
                        'draft_token' => $lockedDraft->draft_token,
                        'customer_id' => $lockedDraft->customer_id,
                        'salesman_id' => $lockedDraft->salesman_id,
                        'created_by' => $lockedDraft->created_by,
                        'item_count' => count($finalizedItemRows),
                        'subtotal' => $lockedDraft->subtotal,
                        'tax_total' => $lockedDraft->tax_total,
                        'grand_total' => $lockedDraft->grand_total,
                        'idempotency_key' => $lockedDraft->idempotency_key,
                        'was_draft' => true,
                        'ip_address' => $clientIp,
                        'timestamp' => Carbon::now()->toIso8601String(),
                    ]);

                    return $lockedDraft->load(['items', 'customer', 'salesman']);
                });
            } catch (\Throwable $e) {
                if ($this->isUniqueKeyViolation($e)) {
                    $committed = Order::with(['items', 'customer', 'salesman'])
                        ->where('id', $draft->id)
                        ->orWhere('idempotency_key', $targetKey)
                        ->first();

                    if ($committed && $committed->status === OrderStatus::SUBMITTED) {
                        if ($actor->role === UserRole::SALESMAN && $committed->salesman_id !== $actor->id) {
                            throw new AuthorizationException('This order was submitted by another salesman.');
                        }

                        Log::info('commerce.order_event', [
                            'action' => 'ORDER_IDEMPOTENT_REPLAY',
                            'order_id' => $committed->id,
                            'order_number' => $committed->order_number,
                            'idempotency_key' => $committed->idempotency_key,
                            'actor_id' => $actor->id,
                            'was_draft' => true,
                            'recovered_from_race' => true,
                            'timestamp' => Carbon::now()->toIso8601String(),
                        ]);

                        return $committed;
                    }
                }

                throw $e;
            }
        });
    }

    /**
     * Discard an unsubmitted draft order permanently.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function discardDraft(User $actor, Order $draft, ?string $clientIp = null): void
    {
        $this->permissionService->authorize($actor, Permission::ORDER_CREATE);

        DB::transaction(function () use ($actor, $draft, $clientIp) {
            /** @var Order $lockedDraft */
            $lockedDraft = Order::where('id', $draft->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedDraft->isDraft()) {
                throw ValidationException::withMessages([
                    'status' => 'Only draft orders can be discarded. Submitted orders cannot be deleted.',
                ]);
            }

            if ($actor->role === UserRole::SALESMAN && $lockedDraft->salesman_id !== $actor->id) {
                throw new AuthorizationException('You are not authorized to discard drafts for other salesmen.');
            }

            $orderId = $lockedDraft->id;
            $draftToken = $lockedDraft->draft_token;
            $customerId = $lockedDraft->customer_id;
            $salesmanId = $lockedDraft->salesman_id;
            $createdBy = $lockedDraft->created_by;

            $lockedDraft->items()->delete();
            $lockedDraft->delete();

            Log::info('commerce.order_event', [
                'action' => 'ORDER_DRAFT_DISCARDED',
                'order_id' => $orderId,
                'draft_token' => $draftToken,
                'customer_id' => $customerId,
                'salesman_id' => $salesmanId,
                'created_by' => $createdBy,
                'ip_address' => $clientIp,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);
        });
    }

    /**
     * Authoritatively resolve an existing order against the actor and DTO intent.
     * Enforces actor authorization (403), fingerprint verification (200/302 vs 409),
     * and structured audit logging.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    protected function resolveIdempotentReplayOrConflict(Order $order, User $actor, CreateOrderDTO $dto, bool $recoveredFromRace = false): Order
    {
        // Check actor ownership (Salesman cannot replay or observe another salesman's order)
        if ($actor->role === UserRole::SALESMAN && $order->salesman_id !== $actor->id) {
            throw new AuthorizationException('This order was submitted by another salesman.');
        }

        // Check canonical payload match
        if ($this->doesOrderMatchDto($order, $dto)) {
            Log::info('commerce.order_event', [
                'action' => 'ORDER_IDEMPOTENT_REPLAY',
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'idempotency_key' => $order->idempotency_key,
                'actor_id' => $actor->id,
                'recovered_from_race' => $recoveredFromRace,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);

            return $order;
        }

        Log::warning('commerce.order_event', [
            'action' => 'ORDER_IDEMPOTENCY_CONFLICT',
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'idempotency_key' => $order->idempotency_key,
            'actor_id' => $actor->id,
            'recovered_from_race' => $recoveredFromRace,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        throw new ConflictHttpException('An order with this idempotency key already exists with different payload details.');
    }

    /**
     * Attempt to execute a callback within an advisory cache/redis lock.
     * If cache/redis is unavailable, misconfigured, or throws, silently fall back
     * directly to PostgreSQL authoritative transaction.
     *
     * @template T
     * @param  \Closure(): T  $callback
     * @return T
     */
    protected function withAdvisoryLock(User $actor, string $idempotencyKey, \Closure $callback): mixed
    {
        $lockName = "order_submission:{$actor->id}:{$idempotencyKey}";

        try {
            $lock = Cache::lock($lockName, 10);

            return $lock->block(3, $callback);
        } catch (\Throwable $e) {
            // Advisory lock timed out, was unavailable, or cache driver doesn't support atomic locks
            Log::debug('Advisory idempotency lock bypassed or failed; falling back to PostgreSQL authority.', [
                'actor_id' => $actor->id,
                'idempotency_key' => $idempotencyKey,
                'error' => $e->getMessage(),
            ]);

            return $callback();
        }
    }

    /**
     * Check if a Throwable represents a PostgreSQL unique constraint violation on idempotency_key.
     */
    protected function isUniqueKeyViolation(\Throwable $e): bool
    {
        if ($e instanceof UniqueConstraintViolationException) {
            return true;
        }

        if ($e instanceof QueryException) {
            // SQLSTATE 23505 = unique_violation
            if ($e->getCode() === '23505' || ($e->errorInfo[0] ?? null) === '23505') {
                return true;
            }

            if (str_contains($e->getMessage(), '23505') || str_contains($e->getMessage(), 'orders_idempotency_key_unique')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determine whether an existing committed order matches the DTO's client intent.
     */
    protected function doesOrderMatchDto(Order $order, CreateOrderDTO $dto): bool
    {
        if ($order->customer_id !== $dto->customerId) {
            return false;
        }

        if (($order->notes ?? '') !== ($dto->notes ?? '')) {
            return false;
        }

        if ($order->items->count() !== count($dto->items)) {
            return false;
        }

        $existingItems = $order->items->keyBy('product_id');

        foreach ($dto->items as $itemDto) {
            $existingItem = $existingItems->get($itemDto->productId);

            if (! $existingItem) {
                return false;
            }

            if ($existingItem->ordered_quantity !== $itemDto->quantity) {
                return false;
            }

            if ($itemDto->unitPrice !== null && $itemDto->unitPrice !== '') {
                if (bccomp((string) $existingItem->unit_price, (string) $itemDto->unitPrice, 2) !== 0) {
                    return false;
                }
            }
        }

        return true;
    }
}


