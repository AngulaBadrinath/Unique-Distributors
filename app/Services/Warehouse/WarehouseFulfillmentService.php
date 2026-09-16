<?php

namespace App\Services\Warehouse;

use App\Enums\AllocationStatus;
use App\Enums\DeliveryEventType;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\Permission;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\DeliveryEvent;
use App\Models\DeliveryItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Delivery\DeliveryNumberGenerator;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class WarehouseFulfillmentService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected DeliveryNumberGenerator $numberGenerator,
    ) {}

    /**
     * Retrieve paginated warehouse fulfillment queue with tab counters.
     *
     * @param  array<string, mixed>  $filters
     * @return array{
     *     orders: LengthAwarePaginator,
     *     badgeCounts: array<string, int>
     * }
     */
    public function paginateFulfillmentOrders(array $filters = [], int $perPage = 15): array
    {
        $tab = $filters['tab'] ?? 'all';
        $search = $filters['search'] ?? null;
        $fulfillmentStatus = $filters['fulfillment_status'] ?? null;

        // Base query for eligible warehouse orders
        $baseEligibility = function ($query) {
            $query->whereIn('orders.status', [
                OrderStatus::APPROVED->value,
                OrderStatus::PROCESSING->value,
            ])->whereNotIn('orders.status', [
                OrderStatus::DRAFT->value,
                OrderStatus::CANCELLED->value,
                OrderStatus::REJECTED->value,
                OrderStatus::COMPLETED->value,
            ]);
        };

        // Compute badge counts efficiently
        $badgeRow = DB::table('orders')
            ->where(function ($q) {
                $q->whereIn('status', [OrderStatus::APPROVED->value, OrderStatus::PROCESSING->value])
                    ->whereNotIn('status', [OrderStatus::DRAFT->value, OrderStatus::CANCELLED->value, OrderStatus::REJECTED->value, OrderStatus::COMPLETED->value]);
            })
            ->selectRaw("
                COUNT(*) as all_count,
                COUNT(CASE WHEN fulfillment_status = 'RESERVED' THEN 1 END) as awaiting_count,
                COUNT(CASE WHEN fulfillment_status IN ('PICKED', 'PACKED') THEN 1 END) as in_fulfillment_count,
                COUNT(CASE WHEN fulfillment_status = 'DISPATCHED' THEN 1 END) as ready_dispatch_count
            ")
            ->first();

        $badgeCounts = [
            'all' => (int) ($badgeRow->all_count ?? 0),
            'awaiting' => (int) ($badgeRow->awaiting_count ?? 0),
            'in_fulfillment' => (int) ($badgeRow->in_fulfillment_count ?? 0),
            'ready_dispatch' => (int) ($badgeRow->ready_dispatch_count ?? 0),
        ];

        $query = Order::query()
            ->where($baseEligibility)
            ->with([
                'customer:id,name,code,phone,shipping_address_line1,shipping_city,shipping_state,shipping_postal_code,billing_address_line1,billing_city,billing_state,billing_postal_code',
                'items.product:id,name,sku',
                'items.allocations',
                'latestDelivery',
                'latestDelivery.driver:id,name,email',
            ]);

        // Tab filter
        match ($tab) {
            'awaiting' => $query->where('orders.fulfillment_status', FulfillmentStatus::RESERVED->value),
            'in_fulfillment' => $query->whereIn('orders.fulfillment_status', [
                FulfillmentStatus::PICKED->value,
                FulfillmentStatus::PACKED->value,
            ]),
            'ready_dispatch' => $query->where('orders.fulfillment_status', FulfillmentStatus::DISPATCHED->value),
            default => null,
        };

        // Explicit status filter override
        if (! empty($fulfillmentStatus) && strtoupper($fulfillmentStatus) !== 'ALL') {
            $query->where('orders.fulfillment_status', $fulfillmentStatus);
        }

        // Search
        if (! empty($search)) {
            $searchTrim = trim((string) $search);
            $isPgsql = $query->getConnection()->getDriverName() === 'pgsql';
            $like = $isPgsql ? 'ilike' : 'like';

            $query->where(function ($q) use ($searchTrim, $like) {
                $q->where('orders.order_number', $like, "%{$searchTrim}%")
                    ->orWhereHas('customer', function ($cq) use ($searchTrim, $like) {
                        $cq->where('name', $like, "%{$searchTrim}%")
                            ->orWhere('code', $like, "%{$searchTrim}%");
                    });
            });
        }

        $orders = $query->orderByRaw("
            CASE 
                WHEN fulfillment_status = 'RESERVED' THEN 1
                WHEN fulfillment_status = 'PICKED' THEN 2
                WHEN fulfillment_status = 'PACKED' THEN 3
                WHEN fulfillment_status = 'DISPATCHED' THEN 4
                ELSE 5
            END
        ")
            ->orderBy('orders.id', 'desc')
            ->paginate($perPage)
            ->withQueryString();

        return [
            'orders' => $orders,
            'badgeCounts' => $badgeCounts,
        ];
    }

    /**
     * Authoritatively record picking on order items.
     *
     * @param  array<int, array{order_item_id: int, picked_quantity: int}>  $pickedItems
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    public function pickOrder(Order $order, User $actor, array $pickedItems = []): Order
    {
        if (! $actor->isActive()) {
            throw new AuthorizationException('Actor account is not active.');
        }

        return DB::transaction(function () use ($order, $actor, $pickedItems) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            if (in_array($lockedOrder->status, [OrderStatus::DRAFT, OrderStatus::CANCELLED, OrderStatus::REJECTED, OrderStatus::COMPLETED], true)) {
                $statusLabel = $lockedOrder->status instanceof OrderStatus ? $lockedOrder->status->label() : (string) $lockedOrder->status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} is in '{$statusLabel}' status and cannot be picked.");
            }

            $lockedItems = $lockedOrder->items()->lockForUpdate()->orderBy('id', 'asc')->get();

            if ($lockedItems->isEmpty()) {
                throw ValidationException::withMessages([
                    'order' => 'Order must contain items to pick.',
                ]);
            }

            $pickedMap = [];
            foreach ($pickedItems as $pi) {
                if (isset($pi['order_item_id'])) {
                    $pickedMap[(int) $pi['order_item_id']] = (int) ($pi['picked_quantity'] ?? 0);
                }
            }

            foreach ($lockedItems as $item) {
                $fulfillable = $item->fulfillableQuantity();
                $qtyToPick = isset($pickedMap[$item->id])
                    ? min($fulfillable, max(0, $pickedMap[$item->id]))
                    : $fulfillable;

                $item->picked_quantity = $qtyToPick;
                $item->save();

                // Synchronize allocations
                OrderItemAllocation::where('order_item_id', $item->id)
                    ->whereIn('status', [AllocationStatus::ALLOCATED, AllocationStatus::RESERVED, AllocationStatus::PICKED])
                    ->update([
                        'picked_quantity' => $qtyToPick,
                        'status' => AllocationStatus::PICKED,
                    ]);
            }

            $lockedOrder->fulfillment_status = FulfillmentStatus::PICKED;
            $lockedOrder->status = OrderStatus::PROCESSING;
            $lockedOrder->save();

            Log::info('commerce.fulfillment_event', [
                'action' => 'ORDER_PICKED',
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'fulfillment_status' => FulfillmentStatus::PICKED->value,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);

            return $lockedOrder->load(['items.product', 'items.allocations', 'customer']);
        }, 3);
    }

    /**
     * Authoritatively record packing on an order.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    public function packOrder(Order $order, User $actor, ?string $notes = null): Order
    {
        if (! $actor->isActive()) {
            throw new AuthorizationException('Actor account is not active.');
        }

        return DB::transaction(function () use ($order, $actor, $notes) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            if (in_array($lockedOrder->status, [OrderStatus::DRAFT, OrderStatus::CANCELLED, OrderStatus::REJECTED, OrderStatus::COMPLETED], true)) {
                $statusLabel = $lockedOrder->status instanceof OrderStatus ? $lockedOrder->status->label() : (string) $lockedOrder->status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} is in '{$statusLabel}' status and cannot be packed.");
            }

            $lockedItems = $lockedOrder->items()->lockForUpdate()->orderBy('id', 'asc')->get();

            foreach ($lockedItems as $item) {
                // Ensure picked quantity is set if not already
                if ($item->picked_quantity <= 0) {
                    $item->picked_quantity = $item->fulfillableQuantity();
                    $item->save();
                }

                OrderItemAllocation::where('order_item_id', $item->id)
                    ->whereIn('status', [AllocationStatus::ALLOCATED, AllocationStatus::RESERVED, AllocationStatus::PICKED, AllocationStatus::PACKED])
                    ->update([
                        'status' => AllocationStatus::PACKED,
                        'picked_quantity' => $item->picked_quantity,
                    ]);
            }

            $lockedOrder->fulfillment_status = FulfillmentStatus::PACKED;
            $lockedOrder->status = OrderStatus::PROCESSING;
            $lockedOrder->save();

            Log::info('commerce.fulfillment_event', [
                'action' => 'ORDER_PACKED',
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'notes' => $notes,
                'fulfillment_status' => FulfillmentStatus::PACKED->value,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);

            return $lockedOrder->load(['items.product', 'items.allocations', 'customer']);
        }, 3);
    }

    /**
     * Authoritatively mark order as dispatched and create downstream Delivery record.
     *
     * @param  array{
     *     scheduled_date?: string,
     *     delivery_window?: string|null,
     *     driver_instructions?: string|null
     * }  $options
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    public function dispatchOrder(Order $order, User $actor, array $options = []): array
    {
        if (! $actor->isActive()) {
            throw new AuthorizationException('Actor account is not active.');
        }

        return DB::transaction(function () use ($order, $actor, $options) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            if (in_array($lockedOrder->status, [OrderStatus::DRAFT, OrderStatus::CANCELLED, OrderStatus::REJECTED, OrderStatus::COMPLETED], true)) {
                $statusLabel = $lockedOrder->status instanceof OrderStatus ? $lockedOrder->status->label() : (string) $lockedOrder->status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} is in '{$statusLabel}' status and cannot be dispatched.");
            }

            /** @var Customer $lockedCustomer */
            $lockedCustomer = Customer::where('id', $lockedOrder->customer_id)->lockForUpdate()->firstOrFail();

            $lockedItems = $lockedOrder->items()->lockForUpdate()->orderBy('id', 'asc')->get();

            // Update item dispatched quantities
            foreach ($lockedItems as $item) {
                $dispatchedQty = $item->picked_quantity > 0 ? $item->picked_quantity : $item->fulfillableQuantity();
                $item->dispatched_quantity = $dispatchedQty;
                if ($item->picked_quantity <= 0) {
                    $item->picked_quantity = $dispatchedQty;
                }
                $item->save();

                OrderItemAllocation::where('order_item_id', $item->id)
                    ->whereIn('status', [AllocationStatus::ALLOCATED, AllocationStatus::RESERVED, AllocationStatus::PICKED, AllocationStatus::PACKED])
                    ->update([
                        'status' => AllocationStatus::DISPATCHED,
                        'dispatched_quantity' => $dispatchedQty,
                        'picked_quantity' => $item->picked_quantity,
                    ]);
            }

            // Update order state
            $lockedOrder->fulfillment_status = FulfillmentStatus::DISPATCHED;
            $lockedOrder->delivery_status = DeliveryStatus::PENDING_ASSIGNMENT;
            $lockedOrder->status = OrderStatus::PROCESSING;
            $lockedOrder->save();

            // Check if Delivery already exists
            /** @var Delivery|null $existingDelivery */
            $existingDelivery = Delivery::where('order_id', $lockedOrder->id)->lockForUpdate()->first();

            $scheduledDate = isset($options['scheduled_date'])
                ? Carbon::parse($options['scheduled_date'])->toDateString()
                : Carbon::today()->toDateString();

            if (! $existingDelivery) {
                // Snapshot address from customer
                $contactName = $lockedCustomer->contact_name ?? $lockedCustomer->name;
                $contactPhone = $lockedCustomer->phone;
                $address1 = $lockedCustomer->shipping_address_line1 ?: ($lockedCustomer->billing_address_line1 ?: 'Standard Shipping Address');
                $address2 = $lockedCustomer->shipping_address_line2 ?: $lockedCustomer->billing_address_line2;
                $city = $lockedCustomer->shipping_city ?: ($lockedCustomer->billing_city ?: 'City');
                $state = $lockedCustomer->shipping_state ?: ($lockedCustomer->billing_state ?: 'State');
                $postal = $lockedCustomer->shipping_postal_code ?: ($lockedCustomer->billing_postal_code ?: '00000');
                $country = $lockedCustomer->shipping_country ?: ($lockedCustomer->billing_country ?: 'USA');

                $deliveryNumber = $this->numberGenerator->generate();

                $delivery = Delivery::create([
                    'delivery_number' => $deliveryNumber,
                    'order_id' => $lockedOrder->id,
                    'customer_id' => $lockedCustomer->id,
                    'driver_id' => null,
                    'status' => DeliveryStatus::PENDING_ASSIGNMENT,
                    'delivery_contact_name' => $contactName,
                    'delivery_contact_phone' => $contactPhone,
                    'delivery_address_line1' => $address1,
                    'delivery_address_line2' => $address2,
                    'delivery_city' => $city,
                    'delivery_state' => $state,
                    'delivery_postal_code' => $postal,
                    'delivery_country_code' => $country,
                    'scheduled_date' => $scheduledDate,
                    'delivery_window' => $options['delivery_window'] ?? 'Morning (09:00 - 13:00)',
                    'driver_instructions' => $options['driver_instructions'] ?? null,
                    'created_by' => $actor->id,
                    'updated_by' => $actor->id,
                    'version' => 1,
                ]);

                // Create Delivery Items
                foreach ($lockedItems as $item) {
                    $deliverableQty = $item->dispatched_quantity > 0 ? $item->dispatched_quantity : $item->fulfillableQuantity();
                    if ($deliverableQty <= 0) {
                        continue;
                    }

                    $alloc = OrderItemAllocation::where('order_item_id', $item->id)->first();

                    DeliveryItem::create([
                        'delivery_id' => $delivery->id,
                        'order_item_id' => $item->id,
                        'order_item_allocation_id' => $alloc?->id,
                        'product_id' => $item->product_id,
                        'product_name_snapshot' => $item->product_name_snapshot,
                        'sku_snapshot' => $item->sku_snapshot,
                        'deliverable_quantity' => $deliverableQty,
                        'delivered_quantity' => 0,
                        'returned_quantity' => 0,
                    ]);
                }

                // Create initial tracking event
                DeliveryEvent::create([
                    'delivery_id' => $delivery->id,
                    'event_type' => DeliveryEventType::CREATED,
                    'from_status' => DeliveryStatus::PENDING_ASSIGNMENT->value,
                    'to_status' => DeliveryStatus::PENDING_ASSIGNMENT->value,
                    'actor_id' => $actor->id,
                    'notes' => 'Order dispatched from warehouse. Delivery mission created in pending driver assignment queue.',
                    'metadata' => [
                        'order_number' => $lockedOrder->order_number,
                        'dispatched_by' => $actor->name,
                        'scheduled_date' => $scheduledDate,
                    ],
                    'created_at' => Carbon::now(),
                ]);
            } else {
                $delivery = $existingDelivery;
            }

            Log::info('commerce.fulfillment_event', [
                'action' => 'ORDER_DISPATCHED',
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'delivery_id' => $delivery->id,
                'delivery_number' => $delivery->delivery_number,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'fulfillment_status' => FulfillmentStatus::DISPATCHED->value,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);

            return [
                'order' => $lockedOrder->load(['items.product', 'items.allocations', 'customer']),
                'delivery' => $delivery,
            ];
        }, 3);
    }
}
