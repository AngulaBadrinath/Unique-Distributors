<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AccountStatus;
use App\Enums\AdjustmentStatus;
use App\Enums\CustomerStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\Permission;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Exceptions\Inventory\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Order\AdminOrderQueueRequest;
use App\Http\Requests\Order\RejectOrderRequest;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Auth\PermissionService;
use App\Services\Order\OrderWorkflowService;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class AdminOrderController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService,
        protected OrderWorkflowService $orderWorkflowService,
    ) {}

    /**
     * Display the operational order queues workspace for administrators.
     */
    public function index(AdminOrderQueueRequest $request): Response
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::ORDER_VIEW);

        // Salesmen and delivery partners are strictly restricted from the admin operational order queues
        if (in_array($actor->role, [UserRole::SALESMAN, UserRole::DELIVERY_PARTNER], true)) {
            throw new AuthorizationException('Field and delivery roles must access orders via their dedicated portals.');
        }

        $now = Carbon::now();
        $agingCutoff = $now->copy()->subHours(24)->toDateTimeString();

        // 1. Single SQL Aggregation Query for accurate queue badge counts
        $countRow = DB::table('orders')
            ->selectRaw("
                COUNT(CASE WHEN status IN ('SUBMITTED', 'PENDING_APPROVAL') THEN 1 END) as new_count,
                COUNT(CASE WHEN status != 'DRAFT' AND (delivery_status = 'FAILED' OR adjustment_status = 'REQUESTED' OR (status = 'SUBMITTED' AND submitted_at < ?)) THEN 1 END) as attention_count,
                COUNT(CASE WHEN status = 'APPROVED' AND fulfillment_status IN ('UNALLOCATED', 'RESERVED', 'PICKED', 'PACKED') AND status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED') THEN 1 END) as processing_count,
                COUNT(CASE WHEN status NOT IN ('DRAFT', 'COMPLETED', 'CANCELLED', 'REJECTED') AND (delivery_status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY') OR fulfillment_status = 'DISPATCHED') THEN 1 END) as delivery_count,
                COUNT(CASE WHEN adjustment_status IN ('REQUESTED', 'APPLIED') AND status != 'DRAFT' THEN 1 END) as adjustments_count,
                COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status IN ('CANCELLED', 'REJECTED') THEN 1 END) as cancelled_count,
                COUNT(CASE WHEN status != 'DRAFT' THEN 1 END) as all_count
            ", [$agingCutoff])
            ->first();

        $counts = [
            'new' => (int) ($countRow->new_count ?? 0),
            'attention' => (int) ($countRow->attention_count ?? 0),
            'processing' => (int) ($countRow->processing_count ?? 0),
            'delivery' => (int) ($countRow->delivery_count ?? 0),
            'adjustments' => (int) ($countRow->adjustments_count ?? 0),
            'completed' => (int) ($countRow->completed_count ?? 0),
            'cancelled' => (int) ($countRow->cancelled_count ?? 0),
            'all' => (int) ($countRow->all_count ?? 0),
        ];

        // 2. Determine active operational queue
        $activeQueue = $request->validated('queue') ?: 'new';

        // 3. Construct base query (Drafts are strictly excluded from all admin queues)
        $query = Order::query()->where('orders.status', '!=', OrderStatus::DRAFT);

        // Apply active queue criteria
        match ($activeQueue) {
            'new' => $query->whereIn('orders.status', [OrderStatus::SUBMITTED, OrderStatus::PENDING_APPROVAL]),
            'attention' => $query->where(function (Builder $sub) use ($agingCutoff) {
                $sub->where('orders.delivery_status', DeliveryStatus::FAILED)
                    ->orWhere('orders.adjustment_status', AdjustmentStatus::REQUESTED)
                    ->orWhere(function (Builder $inner) use ($agingCutoff) {
                        $inner->where('orders.status', OrderStatus::SUBMITTED)
                            ->where('orders.submitted_at', '<', $agingCutoff);
                    });
            }),
            'processing' => $query->where('orders.status', OrderStatus::APPROVED)
                ->whereIn('orders.fulfillment_status', [
                    FulfillmentStatus::UNALLOCATED,
                    FulfillmentStatus::RESERVED,
                    FulfillmentStatus::PICKED,
                    FulfillmentStatus::PACKED,
                ]),
            'delivery' => $query->where(function (Builder $sub) {
                $sub->whereIn('orders.delivery_status', [
                    DeliveryStatus::ASSIGNED,
                    DeliveryStatus::ACCEPTED,
                    DeliveryStatus::PICKED_UP,
                    DeliveryStatus::OUT_FOR_DELIVERY,
                ])->orWhere('orders.fulfillment_status', FulfillmentStatus::DISPATCHED);
            })->whereNotIn('orders.status', [
                OrderStatus::COMPLETED,
                OrderStatus::CANCELLED,
                OrderStatus::REJECTED,
            ]),
            'adjustments' => $query->whereIn('orders.adjustment_status', [
                AdjustmentStatus::REQUESTED,
                AdjustmentStatus::APPLIED,
            ]),
            'completed' => $query->where('orders.status', OrderStatus::COMPLETED),
            'cancelled' => $query->whereIn('orders.status', [OrderStatus::CANCELLED, OrderStatus::REJECTED]),
            'all' => null, // No additional queue constraint beyond status != DRAFT
            default => $query->whereIn('orders.status', [OrderStatus::SUBMITTED, OrderStatus::PENDING_APPROVAL]),
        };

        // Multi-column search
        if ($search = $request->validated('search')) {
            $isPgsql = $query->getConnection()->getDriverName() === 'pgsql';
            $like = $isPgsql ? 'ilike' : 'like';

            $query->where(function (Builder $q) use ($search, $like) {
                $q->where('orders.order_number', $like, "%{$search}%")
                    ->orWhereHas('customer', function (Builder $custQ) use ($search, $like) {
                        $custQ->where('name', $like, "%{$search}%")
                            ->orWhere('code', $like, "%{$search}%");
                    })
                    ->orWhereHas('salesman', function (Builder $salesQ) use ($search, $like) {
                        $salesQ->where('name', $like, "%{$search}%");
                    });
            });
        }

        // Secondary filters
        if ($status = $request->validated('status')) {
            if (strtoupper($status) !== 'ALL') {
                $query->where('orders.status', $status);
            }
        }

        if ($fulfillmentStatus = $request->validated('fulfillment_status')) {
            if (strtoupper($fulfillmentStatus) !== 'ALL') {
                $query->where('orders.fulfillment_status', $fulfillmentStatus);
            }
        }

        if ($paymentStatus = $request->validated('payment_status')) {
            if (strtoupper($paymentStatus) !== 'ALL') {
                $query->where('orders.payment_status', $paymentStatus);
            }
        }

        if ($deliveryStatus = $request->validated('delivery_status')) {
            if (strtoupper($deliveryStatus) !== 'ALL') {
                $query->where('orders.delivery_status', $deliveryStatus);
            }
        }

        if ($adjustmentStatus = $request->validated('adjustment_status')) {
            if (strtoupper($adjustmentStatus) !== 'ALL') {
                $query->where('orders.adjustment_status', $adjustmentStatus);
            }
        }

        if ($salesmanId = $request->validated('salesman_id')) {
            if (strtoupper((string) $salesmanId) !== 'ALL') {
                $query->where('orders.salesman_id', (int) $salesmanId);
            }
        }

        if ($customerId = $request->validated('customer_id')) {
            if (strtoupper((string) $customerId) !== 'ALL') {
                $query->where('orders.customer_id', (int) $customerId);
            }
        }

        // Date range filters
        if ($dateFrom = $request->validated('date_from')) {
            $query->where('orders.submitted_at', '>=', Carbon::parse($dateFrom)->startOfDay());
        }

        if ($dateTo = $request->validated('date_to')) {
            $query->where('orders.submitted_at', '<=', Carbon::parse($dateTo)->endOfDay());
        }

        // Sorting
        $sortBy = $request->validated('sort_by');
        $sortDirection = strtolower($request->validated('sort_direction', '')) === 'asc' ? 'asc' : 'desc';

        if ($sortBy === 'customer_name') {
            $query->join('customers', 'customers.id', '=', 'orders.customer_id')
                ->select('orders.*')
                ->orderBy('customers.name', $sortDirection)
                ->orderBy('orders.id', $sortDirection);
        } elseif ($sortBy === 'order_number') {
            $query->orderBy('orders.order_number', $sortDirection)->orderBy('orders.id', $sortDirection);
        } elseif ($sortBy === 'grand_total') {
            $query->orderBy('orders.grand_total', $sortDirection)->orderBy('orders.id', $sortDirection);
        } elseif ($sortBy === 'status') {
            $query->orderBy('orders.status', $sortDirection)->orderBy('orders.id', $sortDirection);
        } elseif ($sortBy === 'submitted_at') {
            $query->orderBy('orders.submitted_at', $sortDirection)->orderBy('orders.id', $sortDirection);
        } else {
            // Default queue-aware ordering
            if (in_array($activeQueue, ['new', 'attention'], true)) {
                $query->orderBy('orders.submitted_at', 'asc')->orderBy('orders.id', 'asc');
            } else {
                $query->orderBy('orders.submitted_at', 'desc')->orderBy('orders.id', 'desc');
            }
        }

        // Bounded pagination with query-string preservation
        $perPage = (int) ($request->validated('per_page') ?: 25);
        $paginated = $query->with([
            'customer:id,code,name,status,phone',
            'salesman:id,name,email',
        ])
            ->withCount('items')
            ->paginate($perPage)
            ->withQueryString();

        // Transform lightweight items
        $orders = $paginated->through(function (Order $order) use ($agingCutoff) {
            $attentionFlags = [];
            if ($order->delivery_status === DeliveryStatus::FAILED) {
                $attentionFlags[] = 'delivery_exception';
            }
            if ($order->adjustment_status === AdjustmentStatus::REQUESTED) {
                $attentionFlags[] = 'adjustment_pending';
            }
            if ($order->status === OrderStatus::SUBMITTED && $order->submitted_at && $order->submitted_at->lt($agingCutoff)) {
                $attentionFlags[] = 'aging_submission';
            }

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer' => $order->customer ? [
                    'id' => $order->customer->id,
                    'code' => $order->customer->code,
                    'name' => $order->customer->name,
                    'status' => $order->customer->status?->value ?? (string) $order->customer->status,
                    'phone' => $order->customer->phone,
                ] : null,
                'salesman' => $order->salesman ? [
                    'id' => $order->salesman->id,
                    'name' => $order->salesman->name,
                    'email' => $order->salesman->email,
                ] : null,
                'status' => $order->status instanceof OrderStatus ? $order->status->value : (string) $order->status,
                'status_label' => $order->status instanceof OrderStatus ? $order->status->label() : (string) $order->status,
                'status_badge_variant' => $order->status instanceof OrderStatus ? $order->status->badgeVariant() : 'info',
                'fulfillment_status' => $order->fulfillment_status?->value,
                'fulfillment_status_label' => $order->fulfillment_status?->label(),
                'fulfillment_badge_variant' => $order->fulfillment_status?->badgeVariant(),
                'payment_status' => $order->payment_status?->value,
                'payment_status_label' => $order->payment_status?->label(),
                'payment_badge_variant' => $order->payment_status?->badgeVariant(),
                'delivery_status' => $order->delivery_status?->value,
                'delivery_status_label' => $order->delivery_status?->label(),
                'delivery_badge_variant' => $order->delivery_status?->badgeVariant(),
                'adjustment_status' => $order->adjustment_status?->value,
                'adjustment_status_label' => $order->adjustment_status?->label(),
                'adjustment_badge_variant' => $order->adjustment_status?->badgeVariant(),
                'item_count' => $order->items_count,
                'currency' => $order->currency ?? 'USD',
                'grand_total' => (string) $order->grand_total,
                'submitted_at' => $order->submitted_at?->toIso8601String(),
                'submitted_at_formatted' => $order->submitted_at ? $order->submitted_at->format('M d, Y H:i') : null,
                'submitted_at_relative' => $order->submitted_at ? $order->submitted_at->diffForHumans() : null,
                'created_at' => $order->created_at->toIso8601String(),
                'attention_flags' => $attentionFlags,
                'notes' => $order->notes,
            ];
        });

        $eligibleSalesmen = User::where('role', UserRole::SALESMAN)
            ->where('status', AccountStatus::ACTIVE)
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Orders/Index', [
            'orders' => $orders,
            'counts' => $counts,
            'filters' => [
                'queue' => $activeQueue,
                'search' => $request->validated('search', ''),
                'status' => $request->validated('status', 'ALL'),
                'fulfillment_status' => $request->validated('fulfillment_status', 'ALL'),
                'payment_status' => $request->validated('payment_status', 'ALL'),
                'delivery_status' => $request->validated('delivery_status', 'ALL'),
                'adjustment_status' => $request->validated('adjustment_status', 'ALL'),
                'salesman_id' => $request->validated('salesman_id', 'ALL'),
                'customer_id' => $request->validated('customer_id', 'ALL'),
                'date_from' => $request->validated('date_from', ''),
                'date_to' => $request->validated('date_to', ''),
                'sort_by' => $sortBy ?? '',
                'sort_direction' => $sortDirection,
                'per_page' => $perPage,
            ],
            'eligibleSalesmen' => $eligibleSalesmen,
            'orderStatuses' => array_map(fn (OrderStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ], OrderStatus::cases()),
            'fulfillmentStatuses' => array_map(fn (FulfillmentStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ], FulfillmentStatus::cases()),
            'paymentStatuses' => array_map(fn (PaymentStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ], PaymentStatus::cases()),
            'deliveryStatuses' => array_map(fn (DeliveryStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ], DeliveryStatus::cases()),
            'adjustmentStatuses' => array_map(fn (AdjustmentStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ], AdjustmentStatus::cases()),
            'can' => [
                'view' => true,
                'approve' => $this->permissionService->has($actor, Permission::ORDER_APPROVE),
                'reject' => $this->permissionService->has($actor, Permission::ORDER_REJECT),
                'cancel' => $this->permissionService->has($actor, Permission::ORDER_CANCEL),
            ],
        ]);
    }

    /**
     * Display the canonical Order Detail Master Workspace for administrative inspection.
     */
    public function show(Order $order, Request $request): Response
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::ORDER_VIEW);

        if (in_array($actor->role, [UserRole::SALESMAN, UserRole::WAREHOUSE_MANAGER, UserRole::DELIVERY_PARTNER], true)) {
            throw new AuthorizationException('Access to administrative order details is restricted to authorized administrative personnel.');
        }

        // Validate and sanitize backUrl to prevent open redirects
        $rawBackUrl = $request->query('backUrl');
        $backUrl = '/admin/orders';
        $backLabel = 'Back to Order Queue';

        if (is_string($rawBackUrl) && (str_starts_with($rawBackUrl, '/admin/orders') || str_starts_with($rawBackUrl, '/customers'))) {
            $backUrl = $rawBackUrl;
            if (str_starts_with($rawBackUrl, '/customers')) {
                $backLabel = 'Back to Customer Profile';
            }
        }

        $order->load([
            'customer',
            'salesman',
            'creator',
            'approver',
            'canceller',
            'invoice',
            'activeAdjustment.requester:id,name',
            'activeAdjustment.items' => fn ($q) => $q->orderBy('id', 'asc'),
            'items' => fn ($q) => $q->orderBy('id', 'asc'),
            'items.allocations' => fn ($q) => $q->orderBy('id', 'asc'),
            'items.product:id,sku,name,status,default_selling_price,mrp',
            'items.priceOverrideApprover:id,name',
            'payments.recordedBy:id,name',
            'payments.verifiedBy:id,name',
        ]);

        $taxBreakdown = $this->buildTaxBreakdown($order);
        $fulfillmentSummary = $this->buildFulfillmentSummary($order);
        $timeline = $this->buildOrderTimeline($order);

        $customer = $order->customer;
        $isReviewable = in_array($order->status, [OrderStatus::SUBMITTED, OrderStatus::PENDING_APPROVAL], true);

        return Inertia::render('Admin/Orders/Show', [
            'orderData' => [
                'order' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'version' => $order->version ?? 1,
                    'status' => $order->status instanceof OrderStatus ? $order->status->value : (string) $order->status,
                    'status_label' => $order->status instanceof OrderStatus ? $order->status->label() : (string) $order->status,
                    'status_badge_variant' => $order->status instanceof OrderStatus ? $order->status->badgeVariant() : 'info',
                    'fulfillment_status' => $order->fulfillment_status?->value,
                    'fulfillment_status_label' => $order->fulfillment_status?->label(),
                    'fulfillment_badge_variant' => $order->fulfillment_status?->badgeVariant(),
                    'payment_status' => $order->payment_status?->value,
                    'payment_status_label' => $order->payment_status?->label(),
                    'payment_badge_variant' => $order->payment_status?->badgeVariant(),
                    'delivery_status' => $order->delivery_status?->value,
                    'delivery_status_label' => $order->delivery_status?->label(),
                    'delivery_badge_variant' => $order->delivery_status?->badgeVariant(),
                    'adjustment_status' => $order->adjustment_status?->value,
                    'adjustment_status_label' => $order->adjustment_status?->label(),
                    'adjustment_badge_variant' => $order->adjustment_status?->badgeVariant(),
                    'currency' => $order->currency ?? 'USD',
                    'subtotal' => (string) $order->subtotal,
                    'tax_total' => (string) $order->tax_total,
                    'adjustment_total' => (string) $order->adjustment_total,
                    'grand_total' => (string) $order->grand_total,
                    'notes' => $order->notes,
                    'submitted_at' => $order->submitted_at?->toIso8601String(),
                    'submitted_at_formatted' => $order->submitted_at ? $order->submitted_at->format('M d, Y H:i') : null,
                    'approved_at' => $order->approved_at?->toIso8601String(),
                    'approver' => $order->approver ? [
                        'id' => $order->approver->id,
                        'name' => $order->approver->name,
                    ] : null,
                    'cancelled_at' => $order->cancelled_at?->toIso8601String(),
                    'canceller' => $order->canceller ? [
                        'id' => $order->canceller->id,
                        'name' => $order->canceller->name,
                    ] : null,
                    'cancellation_reason' => $order->cancellation_reason,
                    'completed_at' => $order->completed_at?->toIso8601String(),
                    'created_at' => $order->created_at->toIso8601String(),
                    'is_reviewable' => $isReviewable,
                    'invoice' => $order->invoice ? [
                        'id' => $order->invoice->id,
                        'invoice_number' => $order->invoice->invoice_number,
                        'status' => $order->invoice->status->value,
                    ] : null,
                ],
                'customer' => [
                    'id' => $customer->id,
                    'code' => $customer->code,
                    'name' => $customer->name,
                    'contact_name' => $customer->contact_name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                    'billing_address' => $customer->formatted_billing_address,
                    'shipping_address' => $customer->formatted_shipping_address,
                    'payment_terms' => $customer->payment_terms?->label(),
                    'credit_limit' => (float) $customer->credit_limit,
                    'status' => $customer->status->value,
                    'status_label' => $customer->status->label(),
                    'is_active' => $customer->status === CustomerStatus::ACTIVE,
                ],
                'salesman' => [
                    'id' => $order->salesman->id,
                    'name' => $order->salesman->name,
                    'email' => $order->salesman->email,
                ],
                'creator' => $order->creator ? [
                    'id' => $order->creator->id,
                    'name' => $order->creator->name,
                ] : null,
                'items' => $order->items->map(function (OrderItem $item) {
                    $catalogProduct = $item->product;

                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name_snapshot,
                        'sku' => $item->sku_snapshot,
                        'unit' => $item->unit_snapshot,
                        'ordered_quantity' => $item->ordered_quantity,
                        'cancelled_quantity' => $item->cancelled_quantity,
                        'reserved_quantity' => $item->reserved_quantity,
                        'fulfillable_quantity' => $item->fulfillableQuantity(),
                        'allocated_quantity' => $item->allocatedQuantity(),
                        'unallocated_quantity' => $item->unallocatedQuantity(),
                        'picked_quantity' => $item->picked_quantity,
                        'dispatched_quantity' => $item->dispatched_quantity,
                        'delivered_quantity' => $item->delivered_quantity,
                        'returned_quantity' => $item->returned_quantity,
                        'allocations' => $item->allocations->map(fn (OrderItemAllocation $alc) => [
                            'id' => $alc->id,
                            'allocation_number' => $alc->allocation_number,
                            'allocated_quantity' => $alc->allocated_quantity,
                            'reserved_quantity' => $alc->reserved_quantity,
                            'picked_quantity' => $alc->picked_quantity,
                            'dispatched_quantity' => $alc->dispatched_quantity,
                            'delivered_quantity' => $alc->delivered_quantity,
                            'returned_quantity' => $alc->returned_quantity,
                            'status' => $alc->status->value,
                            'status_label' => $alc->status->label(),
                            'status_badge_variant' => $alc->status->badgeVariant(),
                            'warehouse_code' => $alc->warehouse_code,
                            'allocated_at' => $alc->allocated_at?->toIso8601String(),
                            'notes' => $alc->notes,
                        ]),
                        'unit_price' => (string) $item->unit_price,
                        'is_price_overridden' => (bool) $item->is_price_overridden,
                        'price_override_reason' => $item->price_override_reason,
                        'price_override_approver' => $item->priceOverrideApprover ? [
                            'id' => $item->priceOverrideApprover->id,
                            'name' => $item->priceOverrideApprover->name,
                        ] : null,
                        'tax_profile_code' => $item->tax_profile_code_snapshot,
                        'tax_profile_name' => $item->tax_profile_name_snapshot,
                        'tax_rate' => number_format((float) $item->tax_rate_snapshot, 2, '.', ''),
                        'formatted_tax_rate' => rtrim(rtrim((string) $item->tax_rate_snapshot, '0'), '.') . '%',
                        'taxable_amount' => (string) $item->taxable_amount,
                        'tax_amount' => (string) $item->tax_amount,
                        'line_total' => (string) $item->line_total,
                        'catalog_product' => $catalogProduct ? [
                            'status' => $catalogProduct->status->value,
                            'is_active' => $catalogProduct->status === ProductStatus::ACTIVE,
                            'default_selling_price' => (string) $catalogProduct->default_selling_price,
                            'mrp' => (string) $catalogProduct->mrp,
                        ] : null,
                    ];
                }),
                'tax_breakdown' => $taxBreakdown,
                'fulfillment_summary' => $fulfillmentSummary,
                'allocation_summary' => [
                    'total_allocated_units' => $order->items->sum(fn ($i) => $i->allocatedQuantity()),
                    'total_fulfillable_units' => $order->items->sum(fn ($i) => $i->fulfillableQuantity()),
                    'total_unallocated_units' => $order->items->sum(fn ($i) => $i->unallocatedQuantity()),
                    'allocations_count' => $order->items->sum(fn ($i) => $i->allocations->count()),
                    'has_allocations' => $order->items->some(fn ($i) => $i->allocations->isNotEmpty()),
                ],
                'active_adjustment' => $order->hasActiveAdjustment() && $order->activeAdjustment ? [
                    'id' => $order->activeAdjustment->id,
                    'adjustment_number' => $order->activeAdjustment->adjustment_number,
                    'status' => $order->activeAdjustment->status->value,
                    'status_label' => $order->activeAdjustment->status->label(),
                    'reason_code' => $order->activeAdjustment->reason_code->value,
                    'reason_label' => $order->activeAdjustment->reason_code->label(),
                    'notes' => $order->activeAdjustment->notes,
                    'requested_by' => $order->activeAdjustment->requester?->name,
                    'requested_by_id' => $order->activeAdjustment->requested_by,
                    'requested_at' => $order->activeAdjustment->requested_at?->toIso8601String(),
                    'can_withdraw' => ($actor->id === $order->activeAdjustment->requested_by || in_array($actor->role, [UserRole::SUPER_ADMIN, UserRole::ADMIN], true)),
                    'projected_subtotal_reduction' => (string) $order->activeAdjustment->projected_subtotal_reduction,
                    'projected_tax_reduction' => (string) $order->activeAdjustment->projected_tax_reduction,
                    'projected_grand_total_reduction' => (string) $order->activeAdjustment->projected_grand_total_reduction,
                    'items' => $order->activeAdjustment->items->map(fn ($ai) => [
                        'order_item_id' => $ai->order_item_id,
                        'product_name' => $ai->product_name_snapshot,
                        'sku' => $ai->sku_snapshot,
                        'requested_quantity_reduction' => $ai->requested_quantity_reduction,
                        'affected_allocation_quantity' => $ai->affected_allocation_quantity,
                        'is_case_b' => $ai->affected_allocation_quantity > 0,
                        'projected_line_total_reduction' => (string) $ai->projected_line_total_reduction,
                    ]),
                ] : null,
                'payments' => $order->payments->map(fn (\App\Models\Payment $p) => [
                    'id' => $p->id,
                    'payment_number' => $p->payment_number,
                    'payment_method' => $p->payment_method->value,
                    'payment_method_label' => $p->payment_method->label(),
                    'status' => $p->status->value,
                    'status_label' => $p->status->label(),
                    'status_badge_variant' => $p->status->badgeVariant(),
                    'amount' => (string) $p->amount,
                    'payment_date' => $p->payment_date?->toDateString() ?: (string) $p->payment_date,
                    'bank_name' => $p->bank_name,
                    'cheque_number' => $p->cheque_number,
                    'cheque_date' => $p->cheque_date?->toDateString() ?: (string) $p->cheque_date,
                    'issuer_name' => $p->issuer_name,
                    'money_order_number' => $p->money_order_number,
                    'receipt_reference' => $p->receipt_reference,
                    'notes' => $p->notes,
                    'has_evidence' => ! empty($p->evidence_object_key),
                    'evidence_original_name' => $p->evidence_original_name,
                    'evidence_mime_type' => $p->evidence_mime_type,
                    'recorded_by' => $p->recordedBy?->name,
                    'verified_by' => $p->verifiedBy?->name,
                    'created_at' => $p->created_at->toIso8601String(),
                ]),
                'financial_summary' => [
                    'subtotal' => (string) $order->subtotal,
                    'tax_total' => (string) $order->tax_total,
                    'adjustment_total' => (string) $order->adjustment_total,
                    'grand_total' => (string) $order->grand_total,
                    'verified_payments_total' => number_format((float) $order->payments->where('status', \App\Enums\PaymentTransactionStatus::VERIFIED)->sum('amount'), 2, '.', ''),
                    'pending_payments_total' => number_format((float) $order->payments->where('status', \App\Enums\PaymentTransactionStatus::PENDING_VERIFICATION)->sum('amount'), 2, '.', ''),
                    'outstanding_balance' => number_format(max(0.0, (float) $order->grand_total - ((float) $order->payments->where('status', \App\Enums\PaymentTransactionStatus::VERIFIED)->sum('amount') + (float) $order->payments->where('status', \App\Enums\PaymentTransactionStatus::PENDING_VERIFICATION)->sum('amount'))), 2, '.', ''),
                ],
                'timeline' => $timeline,
                'can' => [
                    'review' => $isReviewable && ($this->permissionService->has($actor, Permission::ORDER_APPROVE) || $this->permissionService->has($actor, Permission::ORDER_REJECT)),
                    'print' => true,
                    'request_adjustment' => $actor->can('requestAdjustment', $order),
                ],
                'backUrl' => $backUrl,
                'backLabel' => $backLabel,
            ],
            'backUrl' => $backUrl,
            'backLabel' => $backLabel,
        ]);
    }

    /**
     * Compute aggregated multi-line tax breakdown.
     *
     * @return array<int, array<string, string>>
     */
    protected function buildTaxBreakdown(Order $order): array
    {
        $taxBreakdown = [];
        foreach ($order->items as $item) {
            $code = $item->tax_profile_code_snapshot ?: 'EXEMPT';
            if (! isset($taxBreakdown[$code])) {
                $taxBreakdown[$code] = [
                    'code' => $code,
                    'name' => $item->tax_profile_name_snapshot ?: 'Tax Exempt',
                    'rate' => number_format((float) $item->tax_rate_snapshot, 2, '.', ''),
                    'formatted_rate' => rtrim(rtrim((string) $item->tax_rate_snapshot, '0'), '.') . '%',
                    'taxable_amount' => '0.00',
                    'tax_amount' => '0.00',
                ];
            }
            $taxBreakdown[$code]['taxable_amount'] = bcadd($taxBreakdown[$code]['taxable_amount'], (string) $item->taxable_amount, 2);
            $taxBreakdown[$code]['tax_amount'] = bcadd($taxBreakdown[$code]['tax_amount'], (string) $item->tax_amount, 2);
        }

        return array_values($taxBreakdown);
    }

    /**
     * Compute aggregate fulfillment summary quantities.
     *
     * @return array<string, int>
     */
    protected function buildFulfillmentSummary(Order $order): array
    {
        $totalOrdered = 0;
        $totalReserved = 0;
        $totalFulfillable = 0;
        $totalCancelled = 0;
        $totalPicked = 0;
        $totalDispatched = 0;
        $totalDelivered = 0;
        $totalReturned = 0;

        foreach ($order->items as $item) {
            $totalOrdered += (int) $item->ordered_quantity;
            $totalReserved += (int) $item->reserved_quantity;
            $totalFulfillable += (int) $item->fulfillableQuantity();
            $totalCancelled += (int) $item->cancelled_quantity;
            $totalPicked += (int) $item->picked_quantity;
            $totalDispatched += (int) $item->dispatched_quantity;
            $totalDelivered += (int) $item->delivered_quantity;
            $totalReturned += (int) $item->returned_quantity;
        }

        return [
            'total_ordered' => $totalOrdered,
            'total_reserved' => $totalReserved,
            'total_fulfillable' => $totalFulfillable,
            'total_cancelled' => $totalCancelled,
            'total_picked' => $totalPicked,
            'total_dispatched' => $totalDispatched,
            'total_delivered' => $totalDelivered,
            'total_returned' => $totalReturned,
        ];
    }

    /**
     * Display the dedicated New Order Review Workspace for administrative evaluation.
     * Accessible only for orders in reviewable states (SUBMITTED, PENDING_APPROVAL).
     */
    public function review(Order $order, Request $request): Response|\Illuminate\Http\RedirectResponse
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::ORDER_VIEW);

        // Salesmen and delivery partners are strictly denied from the admin review workspace
        if (in_array($actor->role, [UserRole::SALESMAN, UserRole::DELIVERY_PARTNER], true)) {
            throw new AuthorizationException('Field and delivery roles are not authorized to access the admin order review workspace.');
        }

        // Draft orders are strictly excluded from admin review (fail-closed draft isolation)
        if ($order->status === OrderStatus::DRAFT) {
            abort(404, 'Draft orders cannot be reviewed in the administrative workspace.');
        }

        // Check review eligibility: only SUBMITTED or PENDING_APPROVAL orders are in the initial review stage
        $reviewableStatuses = [OrderStatus::SUBMITTED, OrderStatus::PENDING_APPROVAL];
        if (! in_array($order->status, $reviewableStatuses, true)) {
            return redirect()->route('admin.orders.show', $order)
                ->with('info', "Order {$order->order_number} has already been {$order->status->label()} and is no longer pending initial review.");
        }

        // Bounded eager loading (strictly omitting cost_price from product selection)
        $order->load([
            'customer:id,code,name,contact_name,email,phone,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_postal_code,billing_country,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country,tax_id,credit_limit,payment_terms,status',
            'salesman:id,name,email',
            'creator:id,name,email',
            'approver:id,name',
            'canceller:id,name',
            'items' => fn ($q) => $q->orderBy('id', 'asc'),
            'items.product:id,sku,name,status,minimum_allowed_price,mrp,default_selling_price',
            'items.priceOverrideApprover:id,name',
        ]);

        // Compute review warnings/blockers deterministically
        $warnings = $this->buildReviewWarnings($order);
        $hasBlockers = collect($warnings)->contains('severity', 'blocker');

        // Multi-line tax breakdown aggregation
        $taxBreakdown = [];
        foreach ($order->items as $item) {
            $code = $item->tax_profile_code_snapshot;
            if (! isset($taxBreakdown[$code])) {
                $taxBreakdown[$code] = [
                    'code' => $code,
                    'name' => $item->tax_profile_name_snapshot,
                    'rate' => number_format((float) $item->tax_rate_snapshot, 2, '.', ''),
                    'formatted_rate' => rtrim(rtrim((string) $item->tax_rate_snapshot, '0'), '.') . '%',
                    'taxable_amount' => '0.00',
                    'tax_amount' => '0.00',
                ];
            }
            $taxBreakdown[$code]['taxable_amount'] = bcadd($taxBreakdown[$code]['taxable_amount'], (string) $item->taxable_amount, 2);
            $taxBreakdown[$code]['tax_amount'] = bcadd($taxBreakdown[$code]['tax_amount'], (string) $item->tax_amount, 2);
        }

        $customer = $order->customer;
        $creditLimit = (float) $customer->credit_limit;

        return Inertia::render('Admin/Orders/Review', [
            'reviewData' => [
                'order' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'status' => $order->status->value,
                    'status_label' => $order->status->label(),
                    'status_badge_variant' => $order->status->badgeVariant(),
                    'fulfillment_status' => $order->fulfillment_status?->value,
                    'fulfillment_status_label' => $order->fulfillment_status?->label(),
                    'fulfillment_badge_variant' => $order->fulfillment_status?->badgeVariant(),
                    'payment_status' => $order->payment_status?->value,
                    'payment_status_label' => $order->payment_status?->label(),
                    'payment_badge_variant' => $order->payment_status?->badgeVariant(),
                    'delivery_status' => $order->delivery_status?->value,
                    'delivery_status_label' => $order->delivery_status?->label(),
                    'delivery_badge_variant' => $order->delivery_status?->badgeVariant(),
                    'adjustment_status' => $order->adjustment_status?->value,
                    'adjustment_status_label' => $order->adjustment_status?->label(),
                    'adjustment_badge_variant' => $order->adjustment_status?->badgeVariant(),
                    'currency' => $order->currency ?? 'USD',
                    'subtotal' => (string) $order->subtotal,
                    'tax_total' => (string) $order->tax_total,
                    'adjustment_total' => (string) $order->adjustment_total,
                    'grand_total' => (string) $order->grand_total,
                    'notes' => $order->notes,
                    'submitted_at' => $order->submitted_at?->toIso8601String(),
                    'submitted_at_formatted' => $order->submitted_at ? $order->submitted_at->format('M d, Y H:i') : null,
                    'submitted_at_relative' => $order->submitted_at ? $order->submitted_at->diffForHumans() : null,
                    'created_at' => $order->created_at->toIso8601String(),
                    'is_reviewable' => true,
                ],
                'customer' => [
                    'id' => $customer->id,
                    'code' => $customer->code,
                    'name' => $customer->name,
                    'contact_name' => $customer->contact_name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                    'billing_address' => $customer->formatted_billing_address,
                    'shipping_address' => $customer->formatted_shipping_address,
                    'tax_id' => $customer->tax_id,
                    'credit_limit' => $customer->credit_limit !== null ? number_format((float) $customer->credit_limit, 2, '.', '') : null,
                    'payment_terms' => $customer->payment_terms?->label(),
                    'status' => $customer->status->value,
                    'status_label' => $customer->status->label(),
                    'is_on_hold' => $customer->status === CustomerStatus::ON_HOLD,
                    'is_active' => $customer->status === CustomerStatus::ACTIVE,
                ],
                'salesman' => [
                    'id' => $order->salesman->id,
                    'name' => $order->salesman->name,
                    'email' => $order->salesman->email,
                ],
                'items' => $order->items->map(function (OrderItem $item) {
                    $catalogProduct = $item->product;

                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name_snapshot,
                        'sku' => $item->sku_snapshot,
                        'unit' => $item->unit_snapshot,
                        'ordered_quantity' => $item->ordered_quantity,
                        'cancelled_quantity' => $item->cancelled_quantity,
                        'unit_price' => (string) $item->unit_price,
                        'is_price_overridden' => (bool) $item->is_price_overridden,
                        'price_override_reason' => $item->price_override_reason,
                        'price_override_approver' => $item->priceOverrideApprover ? [
                            'id' => $item->priceOverrideApprover->id,
                            'name' => $item->priceOverrideApprover->name,
                        ] : null,
                        'tax_profile_code' => $item->tax_profile_code_snapshot,
                        'tax_profile_name' => $item->tax_profile_name_snapshot,
                        'tax_rate' => number_format((float) $item->tax_rate_snapshot, 2, '.', ''),
                        'formatted_tax_rate' => rtrim(rtrim((string) $item->tax_rate_snapshot, '0'), '.') . '%',
                        'taxable_amount' => (string) $item->taxable_amount,
                        'tax_amount' => (string) $item->tax_amount,
                        'line_total' => (string) $item->line_total,
                        'catalog_product' => $catalogProduct ? [
                            'name' => $catalogProduct->name,
                            'status' => $catalogProduct->status->value,
                            'is_active' => $catalogProduct->status === ProductStatus::ACTIVE,
                            'minimum_allowed_price' => (string) $catalogProduct->minimum_allowed_price,
                            'mrp' => (string) $catalogProduct->mrp,
                            'default_selling_price' => (string) $catalogProduct->default_selling_price,
                        ] : null,
                    ];
                }),
                'tax_breakdown' => array_values($taxBreakdown),
                'warnings' => $warnings,
                'has_blockers' => $hasBlockers,
                'timeline' => $this->buildOrderTimeline($order),
                'can' => [
                    'approve' => $this->permissionService->has($actor, Permission::ORDER_APPROVE),
                    'reject' => $this->permissionService->has($actor, Permission::ORDER_REJECT),
                ],
            ],
            'backUrl' => '/admin/orders?queue=new',
            'backLabel' => 'Back to New Orders Queue',
        ]);
    }

    /**
     * Authoritatively approve an eligible order.
     */
    public function approve(Order $order, Request $request): RedirectResponse
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::ORDER_APPROVE);

        if ($actor->role === UserRole::SALESMAN) {
            throw new AuthorizationException('Salesmen must access orders via their salesman portal.');
        }

        $approvedOrder = $this->orderWorkflowService->approveOrder($order, $actor);

        return redirect()->route('admin.orders.index', ['queue' => 'new'])
            ->with('success', "Order {$approvedOrder->order_number} has been authoritatively approved. Quantities are reserved for fulfillment.");
    }

    /**
     * Authoritatively reject an eligible order with documented reason.
     */
    public function reject(Order $order, RejectOrderRequest $request): RedirectResponse
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::ORDER_REJECT);

        if ($actor->role === UserRole::SALESMAN) {
            throw new AuthorizationException('Salesmen must access orders via their salesman portal.');
        }

        $rejectedOrder = $this->orderWorkflowService->rejectOrder(
            $order,
            $actor,
            $request->validated('reason')
        );

        return redirect()->route('admin.orders.index', ['queue' => 'new'])
            ->with('success', "Order {$rejectedOrder->order_number} has been rejected.");
    }

    /**
     * Compute deterministic review warnings based on authoritative domain state.
     *
     * @return array<int, array<string, string>>
     */
    protected function buildReviewWarnings(Order $order): array
    {
        $warnings = [];

        // 1. Customer on Hold (Blocker)
        if ($order->customer->status === CustomerStatus::ON_HOLD) {
            $warnings[] = [
                'code' => 'CUSTOMER_ON_HOLD',
                'severity' => 'blocker',
                'title' => 'Customer Account On Hold',
                'description' => 'The customer account has been placed on hold. Orders cannot be approved until customer account status is restored to active.',
                'action_text' => 'View Customer',
                'action_url' => "/customers/{$order->customer_id}",
            ];
        }

        // 2. Customer Inactive (Blocker)
        if ($order->customer->status === CustomerStatus::INACTIVE) {
            $warnings[] = [
                'code' => 'CUSTOMER_INACTIVE',
                'severity' => 'blocker',
                'title' => 'Customer Account Inactive',
                'description' => 'The customer account has been deactivated. New orders cannot proceed.',
                'action_text' => 'View Customer',
                'action_url' => "/customers/{$order->customer_id}",
            ];
        }

        // 3. Credit Limit Exceeded (Warning)
        $creditLimit = (float) $order->customer->credit_limit;
        if ($creditLimit > 0 && bccomp((string) $order->grand_total, (string) $creditLimit, 2) === 1) {
            $formattedLimit = '$' . number_format($creditLimit, 2);
            $formattedTotal = '$' . number_format((float) $order->grand_total, 2);
            $warnings[] = [
                'code' => 'CREDIT_LIMIT_EXCEEDED',
                'severity' => 'warning',
                'title' => 'Credit Limit Exceeded',
                'description' => "Order grand total ({$formattedTotal}) exceeds the customer's approved credit limit ({$formattedLimit}).",
            ];
        }

        // 4. Authorized Price Override Present (Notice)
        $overrideItems = $order->items->filter(fn ($item) => (bool) $item->is_price_overridden);
        if ($overrideItems->isNotEmpty()) {
            $count = $overrideItems->count();
            $warnings[] = [
                'code' => 'PRICE_OVERRIDE_PRESENT',
                'severity' => 'info',
                'title' => 'Authorized Price Overrides',
                'description' => "This order contains {$count} line item(s) sold with authorized price overrides outside standard pricing boundaries.",
            ];
        }

        // 5. Order Aging (Warning)
        if ($order->submitted_at && $order->submitted_at->lessThan(Carbon::now()->subHours(24))) {
            $ageString = $order->submitted_at->diffForHumans();
            $warnings[] = [
                'code' => 'AGING_ORDER',
                'severity' => 'warning',
                'title' => 'Aging Order (Pending > 24 Hours)',
                'description' => "This order was submitted {$ageString} and has been awaiting review for over 24 hours.",
            ];
        }

        // 6. Inactive Catalog Product (Blocker)
        $inactiveItems = $order->items->filter(fn ($item) => $item->product && $item->product->status === ProductStatus::INACTIVE);
        if ($inactiveItems->isNotEmpty()) {
            $names = $inactiveItems->pluck('product_name_snapshot')->implode(', ');
            $warnings[] = [
                'code' => 'PRODUCT_INACTIVE',
                'severity' => 'blocker',
                'title' => 'Product Deactivated in Catalog',
                'description' => "The following ordered product(s) were deactivated in the product master after submission: {$names}.",
            ];
        }

        // 7. Inventory Physical Stock Feasibility (Blocker if any item has insufficient available physical stock)
        $warehouse = Warehouse::getDefault() ?: Warehouse::first();
        if ($warehouse) {
            $productIds = $order->items->pluck('product_id')->unique()->filter()->values()->all();
            if (! empty($productIds)) {
                $balances = InventoryBalance::where('warehouse_id', $warehouse->id)
                    ->whereIn('product_id', $productIds)
                    ->get()
                    ->keyBy('product_id');

                $insufficientLines = [];
                foreach ($order->items as $item) {
                    $fulfillable = $item->fulfillableQuantity();
                    if ($fulfillable <= 0) {
                        continue;
                    }

                    $balance = $balances->get($item->product_id);
                    $available = (int) ($balance?->available_quantity ?? 0);

                    if ($available < $fulfillable) {
                        $insufficientLines[] = [
                            'sku' => $item->sku_snapshot,
                            'name' => $item->product_name_snapshot,
                            'required' => $fulfillable,
                            'available' => $available,
                        ];
                    }
                }

                if (! empty($insufficientLines)) {
                    $details = collect($insufficientLines)
                        ->map(fn ($l) => "{$l['sku']} (Required: {$l['required']}, Available: {$l['available']})")
                        ->implode(', ');

                    $warnings[] = [
                        'code' => 'INSUFFICIENT_STOCK',
                        'severity' => 'blocker',
                        'title' => 'Insufficient Warehouse Stock',
                        'description' => "Order cannot be approved due to insufficient physical stock at {$warehouse->name} ({$warehouse->code}): {$details}.",
                        'action_text' => 'View Stock Balances',
                        'action_url' => '/admin/inventory',
                    ];
                }
            }
        }

        return $warnings;
    }

    /**
     * Build an authentic, verifiable multi-state timeline based strictly on persisted order data.
     * Zero synthetic or fabricated transition timestamps are generated.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function buildOrderTimeline(Order $order): array
    {
        $timeline = [];

        // 1. Order Initialized / Created
        $timeline[] = [
            'id' => 'created',
            'title' => 'Order Created',
            'description' => 'Order was initialized and drafted in the system.',
            'timestamp' => $order->created_at->toIso8601String(),
            'actor_name' => $order->creator?->name ?? 'System',
            'status' => 'completed',
            'badge_label' => 'Created',
            'badge_variant' => 'secondary',
            'icon' => 'created',
        ];

        // 2. Order Submitted
        if ($order->submitted_at) {
            $timeline[] = [
                'id' => 'submitted',
                'title' => 'Order Submitted',
                'description' => "Order committed with idempotency token {$order->idempotency_key}.",
                'timestamp' => $order->submitted_at->toIso8601String(),
                'actor_name' => $order->salesman?->name ?? $order->creator?->name,
                'status' => 'completed',
                'badge_label' => 'Submitted',
                'badge_variant' => 'info',
                'icon' => 'submitted',
            ];
        }

        // 3. Administrative Review & Approval / Rejection
        if ($order->status === OrderStatus::CANCELLED || $order->status === OrderStatus::REJECTED) {
            $timeline[] = [
                'id' => 'cancelled',
                'title' => $order->status === OrderStatus::REJECTED ? 'Order Rejected' : 'Order Cancelled',
                'description' => $order->cancellation_reason ?: 'Order was cancelled prior to completion.',
                'timestamp' => $order->cancelled_at?->toIso8601String() ?? $order->updated_at->toIso8601String(),
                'actor_name' => $order->canceller?->name,
                'status' => 'cancelled',
                'badge_label' => $order->status->label(),
                'badge_variant' => 'destructive',
                'icon' => 'cancelled',
            ];
        } elseif ($order->approved_at) {
            $timeline[] = [
                'id' => 'approved',
                'title' => 'Order Approved',
                'description' => 'Order approved for warehouse allocation and fulfillment processing.',
                'timestamp' => $order->approved_at->toIso8601String(),
                'actor_name' => $order->approver?->name,
                'status' => 'completed',
                'badge_label' => 'Approved',
                'badge_variant' => 'primary',
                'icon' => 'approved',
            ];
        } elseif ($order->status === OrderStatus::SUBMITTED || $order->status === OrderStatus::PENDING_APPROVAL) {
            $timeline[] = [
                'id' => 'approval_pending',
                'title' => 'Administrative Review',
                'description' => 'Awaiting administrative verification and inventory allocation.',
                'timestamp' => null,
                'actor_name' => null,
                'status' => 'current',
                'badge_label' => 'Pending Review',
                'badge_variant' => 'warning',
                'icon' => 'processing',
            ];
        }

        return $timeline;
    }
}
