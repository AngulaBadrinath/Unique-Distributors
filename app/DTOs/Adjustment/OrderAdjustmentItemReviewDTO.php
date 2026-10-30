<?php

namespace App\DTOs\Adjustment;

class OrderAdjustmentItemReviewDTO
{
    /**
     * @param array<int, array<string, mixed>> $allocations
     */
    public function __construct(
        public readonly int $adjustmentItemId,
        public readonly int $orderItemId,
        public readonly int $productId,
        public readonly string $productName,
        public readonly string $sku,
        public readonly string $unitPriceSnapshot,
        public readonly string $taxRateSnapshot,
        public readonly int $orderedQuantitySnapshot,
        public readonly int $fulfillableQuantitySnapshot,
        public readonly int $allocatedQuantitySnapshot,
        public readonly int $unallocatedQuantitySnapshot,
        public readonly int $requestedQuantityReduction,
        public readonly int $snapshotAffectedAllocationQuantity,
        public readonly int $currentOrderedQuantity,
        public readonly int $currentCancelledQuantity,
        public readonly int $currentFulfillableQuantity,
        public readonly int $currentAllocatedQuantity,
        public readonly int $currentUnallocatedQuantity,
        public readonly int $currentAffectedAllocationQuantity,
        public readonly string $snapshotCase,
        public readonly string $currentCase,
        public readonly bool $caseChanged,
        public readonly bool $isConflicted,
        public readonly ?string $conflictReason,
        public readonly int $unpickedAllocatedQuantity,
        public readonly bool $encroachesOnPicked,
        public readonly array $allocations,
        public readonly array $financialSnapshot,
        public readonly array $liveFinancialPreview,
        public readonly ?string $primaryImageUrl = null,
    ) {}

    /**
     * Convert to an array for Inertia serialization.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'adjustment_item_id' => $this->adjustmentItemId,
            'order_item_id' => $this->orderItemId,
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'sku' => $this->sku,
            'primary_image_url' => $this->primaryImageUrl,
            'unit_price_snapshot' => $this->unitPriceSnapshot,
            'tax_rate_snapshot' => $this->taxRateSnapshot,
            'ordered_quantity_snapshot' => $this->orderedQuantitySnapshot,
            'fulfillable_quantity_snapshot' => $this->fulfillableQuantitySnapshot,
            'allocated_quantity_snapshot' => $this->allocatedQuantitySnapshot,
            'unallocated_quantity_snapshot' => $this->unallocatedQuantitySnapshot,
            'requested_quantity_reduction' => $this->requestedQuantityReduction,
            'snapshot_affected_allocation_quantity' => $this->snapshotAffectedAllocationQuantity,
            'current_ordered_quantity' => $this->currentOrderedQuantity,
            'current_cancelled_quantity' => $this->currentCancelledQuantity,
            'current_fulfillable_quantity' => $this->currentFulfillableQuantity,
            'current_allocated_quantity' => $this->currentAllocatedQuantity,
            'current_unallocated_quantity' => $this->currentUnallocatedQuantity,
            'current_affected_allocation_quantity' => $this->currentAffectedAllocationQuantity,
            'snapshot_case' => $this->snapshotCase,
            'current_case' => $this->currentCase,
            'case_changed' => $this->caseChanged,
            'is_conflicted' => $this->isConflicted,
            'conflict_reason' => $this->conflictReason,
            'unpicked_allocated_quantity' => $this->unpickedAllocatedQuantity,
            'encroaches_on_picked' => $this->encroachesOnPicked,
            'allocations' => $this->allocations,
            'financial_snapshot' => $this->financialSnapshot,
            'live_financial_preview' => $this->liveFinancialPreview,
        ];
    }
}
