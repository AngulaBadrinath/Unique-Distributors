<?php

namespace App\Services\Allocation;

use App\Enums\AllocationStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class OrderAllocationValidationService
{
    /**
     * Validate an allocation quantity request against boundary limits and unallocated capacity.
     *
     * @throws ValidationException
     */
    public function validateAllocationQuantity(int $quantity, int $unallocatedQuantity): void
    {
        if ($quantity <= 0 || $quantity > 999999) {
            throw ValidationException::withMessages([
                'quantity' => 'Allocation quantity must be between 1 and 999,999.',
            ]);
        }

        if ($quantity > $unallocatedQuantity) {
            throw ValidationException::withMessages([
                'quantity' => "Cannot allocate {$quantity} units. Only {$unallocatedQuantity} fulfillable units remain unallocated.",
            ]);
        }
    }

    /**
     * Validate that an order is in an eligible lifecycle state to receive or modify allocations.
     *
     * @throws ConflictHttpException
     */
    public function validateOrderLifecycleEligibility(Order $order): void
    {
        $status = $order->status instanceof OrderStatus ? $order->status : OrderStatus::tryFrom((string) $order->status);

        if (! in_array($status, [OrderStatus::APPROVED, OrderStatus::PROCESSING], true)) {
            $statusLabel = $status ? $status->label() : (string) $order->status;
            throw new ConflictHttpException("Order {$order->order_number} is in '{$statusLabel}' status and cannot receive allocations.");
        }
    }

    /**
     * Validate the fundamental mathematical conservation laws on an order line item:
     * 1. ordered = cancelled + fulfillable
     * 2. sum(active allocated) <= fulfillable
     * 3. unallocated = fulfillable - sum(active allocated)
     *
     * @throws ValidationException
     */
    public function validateItemConservation(OrderItem $item): void
    {
        $fulfillable = $item->fulfillableQuantity();
        $expectedFulfillable = max(0, ($item->ordered_quantity + ($item->increased_quantity ?? 0)) - $item->cancelled_quantity);

        if ($fulfillable !== $expectedFulfillable) {
            throw ValidationException::withMessages([
                'order_item' => "Quantity conservation violated for line item #{$item->id}: fulfillable ({$fulfillable}) does not match ordered ({$item->ordered_quantity}) + increased (" . ($item->increased_quantity ?? 0) . ") minus cancelled ({$item->cancelled_quantity}).",
            ]);
        }

        $allocated = $item->allocatedQuantity();

        if ($allocated > $fulfillable) {
            throw ValidationException::withMessages([
                'order_item' => "Allocation sum invariant violated for line item #{$item->id}: total allocated units ({$allocated}) exceed fulfillable units ({$fulfillable}).",
            ]);
        }

        $unallocated = $item->unallocatedQuantity();
        $expectedUnallocated = max(0, $fulfillable - $allocated);

        if ($unallocated !== $expectedUnallocated) {
            throw ValidationException::withMessages([
                'order_item' => "Unallocated quantity invariant violated for line item #{$item->id}: unallocated ({$unallocated}) does not match fulfillable ({$fulfillable}) minus allocated ({$allocated}).",
            ]);
        }
    }

    /**
     * Validate strict fulfillment progression constraints across quantity buckets:
     * 0 <= returned <= delivered <= dispatched <= picked <= allocated
     * and 0 <= reserved <= allocated
     *
     * @throws ValidationException
     */
    public function validateProgression(
        int $allocated,
        int $reserved,
        int $picked,
        int $dispatched,
        int $delivered,
        int $returned
    ): void {
        if ($allocated < 1) {
            throw ValidationException::withMessages([
                'allocated_quantity' => 'Allocated quantity must be greater than zero.',
            ]);
        }

        if ($reserved < 0 || $reserved > $allocated) {
            throw ValidationException::withMessages([
                'reserved_quantity' => "Reserved quantity ({$reserved}) must be between 0 and allocated quantity ({$allocated}).",
            ]);
        }

        if ($picked < 0 || $picked > $allocated) {
            throw ValidationException::withMessages([
                'picked_quantity' => "Picked quantity ({$picked}) must be between 0 and allocated quantity ({$allocated}).",
            ]);
        }

        if ($dispatched < 0 || $dispatched > $picked) {
            throw ValidationException::withMessages([
                'dispatched_quantity' => "Dispatched quantity ({$dispatched}) cannot exceed picked quantity ({$picked}).",
            ]);
        }

        if ($delivered < 0 || $delivered > $dispatched) {
            throw ValidationException::withMessages([
                'delivered_quantity' => "Delivered quantity ({$delivered}) cannot exceed dispatched quantity ({$dispatched}).",
            ]);
        }

        if ($returned < 0 || $returned > $delivered) {
            throw ValidationException::withMessages([
                'returned_quantity' => "Returned quantity ({$returned}) cannot exceed delivered quantity ({$delivered}).",
            ]);
        }
    }

    /**
     * Check if a proposed fulfillable quantity reduction (e.g. from an order cancellation or adjustment)
     * is valid without conflicting with currently active allocation records.
     *
     * Invariant: fulfillable - reduction >= active_allocated
     * Equivalently: reduction <= unallocated
     */
    public function canReduceFulfillableQuantity(OrderItem $item, int $reductionQuantity): bool
    {
        if ($reductionQuantity <= 0) {
            return false;
        }

        return $reductionQuantity <= $item->unallocatedQuantity();
    }

    /**
     * Detect any drift between the order item's denormalized rollups and the sum of its allocation records.
     *
     * @return array{
     *     has_drift: bool,
     *     drift_details: array<string, array{rollup: int, calculated: int}>
     * }
     */
    public function detectRollupDrift(OrderItem $item): array
    {
        $allocations = $item->relationLoaded('allocations')
            ? $item->allocations
            : $item->allocations()->get();

        $activeAllocations = $allocations->filter(fn (OrderItemAllocation $a) => ! in_array($a->status, [AllocationStatus::CANCELLED, AllocationStatus::RELEASED], true));

        $expectedReserved = (int) $activeAllocations->sum('reserved_quantity');
        $expectedPicked = (int) $allocations->sum('picked_quantity');
        $expectedDispatched = (int) $allocations->sum('dispatched_quantity');
        $expectedDelivered = (int) $allocations->sum('delivered_quantity');
        $expectedReturned = (int) $allocations->sum('returned_quantity');

        $driftDetails = [];

        if ($item->reserved_quantity !== $expectedReserved) {
            $driftDetails['reserved_quantity'] = [
                'rollup' => $item->reserved_quantity,
                'calculated' => $expectedReserved,
            ];
        }

        if ($item->picked_quantity !== $expectedPicked) {
            $driftDetails['picked_quantity'] = [
                'rollup' => $item->picked_quantity,
                'calculated' => $expectedPicked,
            ];
        }

        if ($item->dispatched_quantity !== $expectedDispatched) {
            $driftDetails['dispatched_quantity'] = [
                'rollup' => $item->dispatched_quantity,
                'calculated' => $expectedDispatched,
            ];
        }

        if ($item->delivered_quantity !== $expectedDelivered) {
            $driftDetails['delivered_quantity'] = [
                'rollup' => $item->delivered_quantity,
                'calculated' => $expectedDelivered,
            ];
        }

        if ($item->returned_quantity !== $expectedReturned) {
            $driftDetails['returned_quantity'] = [
                'rollup' => $item->returned_quantity,
                'calculated' => $expectedReturned,
            ];
        }

        return [
            'has_drift' => ! empty($driftDetails),
            'drift_details' => $driftDetails,
        ];
    }
}
