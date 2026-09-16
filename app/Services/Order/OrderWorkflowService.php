<?php

namespace App\Services\Order;

use App\Enums\AllocationStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\Permission;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItemAllocation;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Invoices\InvoiceGeneratorService;
use App\Services\Inventory\InventoryService;
use App\Services\Notification\DomainNotificationDispatcher;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class OrderWorkflowService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected InventoryService $inventoryService,
        protected ?InvoiceGeneratorService $invoiceGeneratorService = null,
        protected ?DomainNotificationDispatcher $notificationDispatcher = null,
    ) {
        $this->invoiceGeneratorService ??= app(InvoiceGeneratorService::class);
        $this->notificationDispatcher ??= app(DomainNotificationDispatcher::class);
    }

    /**
     * Authoritatively approve an eligible order.
     * Executes inside a PostgreSQL transaction with deterministic pessimistic row locking:
     * Order -> Customer -> Order Items (ordered by ascending ID) -> Inventory Balances (ordered by ascending ID).
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function approveOrder(Order $order, User $actor): Order
    {
        // 1. Authorize actor permissions
        $this->permissionService->authorize($actor, Permission::ORDER_APPROVE);

        if ($actor->role === UserRole::SALESMAN) {
            throw new AuthorizationException('Salesmen are not authorized to approve orders.');
        }

        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $previousStatus = null;
        $reservedItemsCount = 0;

        // 2. Authoritative PostgreSQL Transaction
        /** @var Order $approvedOrder */
        $approvedOrder = DB::transaction(function () use ($order, $actor, &$previousStatus, &$reservedItemsCount) {
            // Lock target order
            /** @var Order|null $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            // Re-read current state: verify order is still in reviewable state
            if (! in_array($lockedOrder->status, [OrderStatus::SUBMITTED, OrderStatus::PENDING_APPROVAL], true)) {
                $currentLabel = $lockedOrder->status instanceof OrderStatus ? $lockedOrder->status->label() : (string) $lockedOrder->status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} is in '{$currentLabel}' status and cannot be approved.");
            }

            // Verify fulfillment status has not already been allocated/reserved
            if ($lockedOrder->fulfillment_status !== FulfillmentStatus::UNALLOCATED) {
                $fulfillmentLabel = $lockedOrder->fulfillment_status instanceof FulfillmentStatus ? $lockedOrder->fulfillment_status->label() : (string) $lockedOrder->fulfillment_status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} fulfillment status is already '{$fulfillmentLabel}'; cannot re-reserve.");
            }

            // Deterministically lock customer row
            /** @var Customer|null $lockedCustomer */
            $lockedCustomer = Customer::where('id', $lockedOrder->customer_id)->lockForUpdate()->firstOrFail();

            // Revalidate customer state (ACTIVE required; ON_HOLD and INACTIVE are hard blockers)
            $lockedCustomer->ensureCanPlaceOrders();

            // Deterministically lock order items ordered by ascending ID
            $lockedItems = $lockedOrder->items()->lockForUpdate()->orderBy('id', 'asc')->with('product')->get();

            if ($lockedItems->isEmpty()) {
                throw ValidationException::withMessages([
                    'order' => 'Order must contain at least one line item to be approved.',
                ]);
            }

            // Revalidate product catalog state for all lines (PRODUCT_INACTIVE is a hard blocker)
            $inactiveProducts = [];
            foreach ($lockedItems as $item) {
                if (! $item->product || $item->product->status === ProductStatus::INACTIVE) {
                    $inactiveProducts[] = $item->product_name_snapshot;
                }
            }

            if (! empty($inactiveProducts)) {
                $uniqueNames = implode(', ', array_unique($inactiveProducts));
                throw ValidationException::withMessages([
                    'order' => "Cannot approve order containing inactive products: {$uniqueNames}.",
                ]);
            }

            // Verify total fulfillable quantity > 0
            $totalFulfillable = 0;
            foreach ($lockedItems as $item) {
                $fulfillable = $item->fulfillableQuantity();
                $totalFulfillable += $fulfillable;
            }

            if ($totalFulfillable <= 0) {
                throw ValidationException::withMessages([
                    'order' => 'Order has no fulfillable quantities remaining to approve.',
                ]);
            }

            // Authoritatively reserve physical inventory across balances in deterministic lock order
            $this->inventoryService->reserveStockForOrder($lockedOrder, $actor);

            // Establish order-level reservation state across items
            foreach ($lockedItems as $item) {
                $fulfillable = $item->fulfillableQuantity();
                $item->reserved_quantity = max(0, $fulfillable);
                $item->save();
            }

            $previousStatus = $lockedOrder->status;

            // Authoritative Order State Mutation
            $lockedOrder->status = OrderStatus::APPROVED;
            $lockedOrder->fulfillment_status = FulfillmentStatus::RESERVED;
            $lockedOrder->approved_at = Carbon::now();
            $lockedOrder->approved_by = $actor->id;
            $lockedOrder->save();

            // Create baseline order item allocations atomically within the same transaction (FEAT-ALLOC-001)
            $orderNumClean = $lockedOrder->order_number ?: 'ORD-' . $lockedOrder->id;
            foreach ($lockedItems as $item) {
                $fulfillable = $item->fulfillableQuantity();
                if ($fulfillable <= 0) {
                    continue;
                }

                $allocationNumber = "ALC-{$orderNumClean}-{$item->id}-01";

                OrderItemAllocation::firstOrCreate(
                    [
                        'order_item_id' => $item->id,
                        'allocation_number' => $allocationNumber,
                    ],
                    [
                        'order_id' => $lockedOrder->id,
                        'product_id' => $item->product_id,
                        'allocated_quantity' => $fulfillable,
                        'reserved_quantity' => $fulfillable,
                        'picked_quantity' => 0,
                        'dispatched_quantity' => 0,
                        'delivered_quantity' => 0,
                        'returned_quantity' => 0,
                        'status' => AllocationStatus::ALLOCATED,
                        'warehouse_code' => 'MAIN',
                        'notes' => 'Initial baseline order allocation upon approval',
                        'allocated_by' => $actor->id,
                        'allocated_at' => Carbon::now(),
                    ]
                );
            }

            $reservedItemsCount = $lockedItems->count();

            // Synchronize and post authoritative invoice recognition upon approval
            $this->invoiceGeneratorService->syncOnOrderApproved($lockedOrder, $actor);

            // Queue domain notifications after transaction commits
            DB::afterCommit(function () use ($lockedOrder) {
                $this->notificationDispatcher->notifyOrderApproved($lockedOrder);
            });

            return $lockedOrder;
        }, 3);

        // 3. Structured Observability Event (Emitted only AFTER successful PostgreSQL commit)
        Log::info('commerce.order_event', [
            'action' => 'ORDER_APPROVED',
            'order_id' => $approvedOrder->id,
            'order_number' => $approvedOrder->order_number,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'previous_status' => $previousStatus instanceof OrderStatus ? $previousStatus->value : (string) $previousStatus,
            'new_status' => OrderStatus::APPROVED->value,
            'fulfillment_status' => FulfillmentStatus::RESERVED->value,
            'reserved_items_count' => $reservedItemsCount,
            'grand_total' => (string) $approvedOrder->grand_total,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        return $approvedOrder;
    }

    /**
     * Authoritatively reject an eligible order with mandatory documented reason.
     * Executes inside a PostgreSQL transaction with pessimistic row locking.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function rejectOrder(Order $order, User $actor, string $reason): Order
    {
        // 1. Authorize actor permissions
        $this->permissionService->authorize($actor, Permission::ORDER_REJECT);

        if ($actor->role === UserRole::SALESMAN) {
            throw new AuthorizationException('Salesmen are not authorized to reject orders.');
        }

        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $reason = trim($reason);
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 1000) {
            throw ValidationException::withMessages([
                'reason' => 'The rejection reason must be between 5 and 1000 characters.',
            ]);
        }

        $previousStatus = null;

        // 2. Authoritative PostgreSQL Transaction
        /** @var Order $rejectedOrder */
        $rejectedOrder = DB::transaction(function () use ($order, $actor, $reason, &$previousStatus) {
            // Lock target order
            /** @var Order|null $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            // Re-read current state: verify order is still in reviewable state
            if (! in_array($lockedOrder->status, [OrderStatus::SUBMITTED, OrderStatus::PENDING_APPROVAL], true)) {
                $currentLabel = $lockedOrder->status instanceof OrderStatus ? $lockedOrder->status->label() : (string) $lockedOrder->status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} is in '{$currentLabel}' status and cannot be rejected.");
            }

            $previousStatus = $lockedOrder->status;

            // Authoritative Order State Mutation (Preserve line items, quantities, and financial snapshots)
            $lockedOrder->status = OrderStatus::REJECTED;
            $lockedOrder->cancelled_at = Carbon::now();
            $lockedOrder->cancelled_by = $actor->id;
            $lockedOrder->cancellation_reason = $reason;
            $lockedOrder->save();

            // Void attached invoice if exists
            $this->invoiceGeneratorService->voidInvoiceForOrder($lockedOrder, $actor, $reason);

            // Queue domain notifications after transaction commits
            DB::afterCommit(function () use ($lockedOrder, $reason) {
                $this->notificationDispatcher->notifyOrderRejected($lockedOrder, $reason);
            });

            return $lockedOrder;
        }, 3);

        // 3. Structured Observability Event (Emitted only AFTER successful PostgreSQL commit)
        Log::info('commerce.order_event', [
            'action' => 'ORDER_REJECTED',
            'order_id' => $rejectedOrder->id,
            'order_number' => $rejectedOrder->order_number,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'previous_status' => $previousStatus instanceof OrderStatus ? $previousStatus->value : (string) $previousStatus,
            'new_status' => OrderStatus::REJECTED->value,
            'rejection_reason' => $reason,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        return $rejectedOrder;
    }

    /**
     * Authoritatively cancel an approved or pending order with mandatory documented reason.
     * If the order has physical stock reserved, releases that reservation atomically.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function cancelOrder(Order $order, User $actor, string $reason): Order
    {
        // 1. Authorize actor permissions
        $this->permissionService->authorize($actor, Permission::ORDER_CANCEL);

        if ($actor->role === UserRole::SALESMAN) {
            throw new AuthorizationException('Salesmen are not authorized to cancel orders directly.');
        }

        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $reason = trim($reason);
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 1000) {
            throw ValidationException::withMessages([
                'reason' => 'The cancellation reason must be between 5 and 1000 characters.',
            ]);
        }

        $previousStatus = null;
        $releasedStock = false;

        // 2. Authoritative PostgreSQL Transaction
        /** @var Order $cancelledOrder */
        $cancelledOrder = DB::transaction(function () use ($order, $actor, $reason, &$previousStatus, &$releasedStock) {
            /** @var Order|null $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            if (in_array($lockedOrder->status, [OrderStatus::CANCELLED, OrderStatus::REJECTED, OrderStatus::COMPLETED], true)) {
                $currentLabel = $lockedOrder->status instanceof OrderStatus ? $lockedOrder->status->label() : (string) $lockedOrder->status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} is in '{$currentLabel}' status and cannot be cancelled.");
            }

            $previousStatus = $lockedOrder->status;

            // If order was approved and holds physical reservations, release stock atomically
            if ($lockedOrder->status === OrderStatus::APPROVED || $lockedOrder->fulfillment_status === FulfillmentStatus::RESERVED) {
                $this->inventoryService->releaseStockForOrder($lockedOrder, $actor);
                $releasedStock = true;

                // Update allocation records to CANCELLED
                OrderItemAllocation::where('order_id', $lockedOrder->id)
                    ->whereIn('status', [AllocationStatus::ALLOCATED, AllocationStatus::RESERVED])
                    ->update([
                        'status' => AllocationStatus::CANCELLED,
                        'reserved_quantity' => 0,
                    ]);
            }

            // Authoritative Order State Mutation
            $lockedOrder->status = OrderStatus::CANCELLED;
            $lockedOrder->fulfillment_status = FulfillmentStatus::UNALLOCATED;
            $lockedOrder->cancelled_at = Carbon::now();
            $lockedOrder->cancelled_by = $actor->id;
            $lockedOrder->cancellation_reason = $reason;
            $lockedOrder->save();

            // Void attached invoice if exists
            $this->invoiceGeneratorService->voidInvoiceForOrder($lockedOrder, $actor, $reason);

            // Queue domain notifications after transaction commits
            DB::afterCommit(function () use ($lockedOrder, $reason) {
                $this->notificationDispatcher->notifyOrderCancelled($lockedOrder, $reason);
            });

            return $lockedOrder;
        }, 3);

        Log::info('commerce.order_event', [
            'action' => 'ORDER_CANCELLED',
            'order_id' => $cancelledOrder->id,
            'order_number' => $cancelledOrder->order_number,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'previous_status' => $previousStatus instanceof OrderStatus ? $previousStatus->value : (string) $previousStatus,
            'new_status' => OrderStatus::CANCELLED->value,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED->value,
            'released_stock' => $releasedStock,
            'cancellation_reason' => $reason,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        return $cancelledOrder;
    }
}

