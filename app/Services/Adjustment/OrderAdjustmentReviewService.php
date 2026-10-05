<?php

namespace App\Services\Adjustment;

use App\DTOs\Adjustment\OrderAdjustmentItemReviewDTO;
use App\DTOs\Adjustment\OrderAdjustmentReviewDTO;
use App\Enums\AllocationStatus;
use App\Enums\OrderStatus;
use App\Models\OrderAdjustment;
use App\Models\OrderAdjustmentItem;
use App\Models\OrderItemAllocation;
use App\Services\Tax\TaxCalculationService;

class OrderAdjustmentReviewService
{
    public function __construct(
        protected TaxCalculationService $taxCalculationService,
    ) {}

    /**
     * Perform a pure, read-only evaluation of an adjustment request against current live order state.
     */
    public function evaluate(OrderAdjustment $adjustment, ?\App\Models\Order $order = null): OrderAdjustmentReviewDTO
    {
        $order = $order ?? $adjustment->order;

        $staleReasons = [];
        $isStale = false;
        $hasConflict = false;
        $hasEncroachment = false;
        $totalAffectedAllocation = 0;
        $totalUnpickedAffected = 0;

        // 1. Order Version Check
        if ((int) $order->version !== (int) $adjustment->order_version_snapshot) {
            $isStale = true;
            $staleReasons[] = "Order version changed from {$adjustment->order_version_snapshot} to {$order->version}.";
        }

        // 2. Order Lifecycle Check
        $eligibleStatuses = [
            OrderStatus::SUBMITTED,
            OrderStatus::PENDING_APPROVAL,
            OrderStatus::APPROVED,
            OrderStatus::PROCESSING,
        ];

        $orderStatusValue = $order->status instanceof OrderStatus ? $order->status->value : (string) $order->status;
        $snapshotStatusValue = is_string($adjustment->order_status_snapshot)
            ? $adjustment->order_status_snapshot
            : ($adjustment->order_status_snapshot instanceof OrderStatus ? $adjustment->order_status_snapshot->value : '');

        if (! in_array($order->status, $eligibleStatuses, true)) {
            $isStale = true;
            $staleReasons[] = "Order has transitioned to {$orderStatusValue}, which is not an active adjustment lifecycle state.";
        }

        // 3. Line-by-Line Item Evaluation
        $lineEvaluations = [];
        $liveSubtotalReduction = '0.00';
        $liveTaxReduction = '0.00';
        $liveGrandTotalReduction = '0.00';
        $liveSubtotalAddition = '0.00';
        $liveTaxAddition = '0.00';
        $liveGrandTotalAddition = '0.00';

        foreach ($adjustment->items as $adjItem) {
            $orderItem = $adjItem->orderItem;
            if (! $orderItem) {
                continue;
            }

            $currentOrdered = (int) $orderItem->ordered_quantity;
            $currentCancelled = (int) $orderItem->cancelled_quantity;
            $currentFulfillable = $orderItem->fulfillableQuantity();
            $currentAllocated = $orderItem->allocatedQuantity();
            $currentUnallocated = $orderItem->unallocatedQuantity();
            $actionType = $adjItem->action_type ?? 'DECREASE';
            $isIncrease = ($actionType === 'INCREASE') || ((int) ($adjItem->requested_quantity_increase ?? 0) > 0);

            $requestedReduction = (int) $adjItem->requested_quantity_reduction;
            $requestedIncrease = (int) ($adjItem->requested_quantity_increase ?? 0);

            $isConflicted = false;
            $conflictReason = null;
            $encroachesOnPicked = false;
            $snapshotAffected = (int) $adjItem->affected_allocation_quantity;
            $snapshotCase = $snapshotAffected > 0 ? 'CASE_B' : 'CASE_A';
            $currentAffected = 0;
            $currentCase = 'CASE_A';
            $caseChanged = false;

            // Active allocations analysis (excluding CANCELLED and RELEASED)
            $activeAllocations = $orderItem->allocations
                ->filter(fn (OrderItemAllocation $a) => ! in_array($a->status, [AllocationStatus::CANCELLED, AllocationStatus::RELEASED], true));

            $totalPickedOnActive = (int) $activeAllocations->sum('picked_quantity');
            $totalAllocatedOnActive = (int) $activeAllocations->sum('allocated_quantity');
            $unpickedAllocated = max(0, $totalAllocatedOnActive - $totalPickedOnActive);

            $lineUnitPrice = (string) $orderItem->unit_price;
            $lineTaxRate = TaxCalculationService::normalizeRate($orderItem->tax_rate_snapshot, 'tax_rate');

            if ($isIncrease) {
                $increaseQty = $requestedIncrease > 0 ? $requestedIncrease : max(0, (int) $adjItem->requested_quantity_delta);
                // Check physical stock availability
                $balance = \App\Models\InventoryBalance::where('product_id', $orderItem->product_id)->first();
                $availableStock = $balance ? (int) $balance->available_quantity : 0;
                if ($availableStock < $increaseQty) {
                    $isConflicted = true;
                    $hasConflict = true;
                    $conflictReason = "Requested increase ({$increaseQty}) exceeds available warehouse stock ({$availableStock}).";
                    $staleReasons[] = "Item {$adjItem->sku_snapshot}: {$conflictReason}";
                }

                $lineTaxableAddition = bcmul($lineUnitPrice, (string) $increaseQty, 2);
                $rawTaxAddition = bcdiv(bcmul($lineTaxableAddition, $lineTaxRate, 8), '100', 8);
                $lineTaxAmtAddition = TaxCalculationService::roundHalfUp($rawTaxAddition, 2);
                $lineTotalAddition = bcadd($lineTaxableAddition, $lineTaxAmtAddition, 2);

                $liveSubtotalAddition = bcadd($liveSubtotalAddition, $lineTaxableAddition, 2);
                $liveTaxAddition = bcadd($liveTaxAddition, $lineTaxAmtAddition, 2);
                $liveGrandTotalAddition = bcadd($liveGrandTotalAddition, $lineTotalAddition, 2);

                $lineTaxableReduction = '0.00';
                $lineTaxAmtReduction = '0.00';
                $lineTotalReduction = '0.00';
            } else {
                // Reduction logic
                $currentAffected = max(0, $requestedReduction - $currentUnallocated);
                $currentCase = $currentAffected > 0 ? 'CASE_B' : 'CASE_A';
                $caseChanged = ($snapshotCase !== $currentCase) || ($snapshotAffected !== $currentAffected);
                if ($caseChanged) {
                    $isStale = true;
                    $staleReasons[] = "Item {$adjItem->sku_snapshot}: Allocation state drifted from {$snapshotCase} ({$snapshotAffected} affected) to {$currentCase} ({$currentAffected} affected).";
                }

                if ($requestedReduction > $currentFulfillable) {
                    $isConflicted = true;
                    $hasConflict = true;
                    $conflictReason = "Requested reduction ({$requestedReduction}) exceeds current fulfillable quantity ({$currentFulfillable}).";
                    $staleReasons[] = "Item {$adjItem->sku_snapshot}: {$conflictReason}";
                }

                if ($currentAffected > $unpickedAllocated) {
                    $encroachesOnPicked = true;
                    $hasEncroachment = true;
                    $staleReasons[] = "Item {$adjItem->sku_snapshot}: Requested reduction encroaches on units that have already been picked ({$currentAffected} affected vs {$unpickedAllocated} unpicked).";
                }

                $totalAffectedAllocation += $currentAffected;
                $totalUnpickedAffected += min($currentAffected, $unpickedAllocated);

                $lineTaxableReduction = bcmul($lineUnitPrice, (string) $requestedReduction, 2);
                $rawTaxReduction = bcdiv(bcmul($lineTaxableReduction, $lineTaxRate, 8), '100', 8);
                $lineTaxAmtReduction = TaxCalculationService::roundHalfUp($rawTaxReduction, 2);
                $lineTotalReduction = bcadd($lineTaxableReduction, $lineTaxAmtReduction, 2);

                $liveSubtotalReduction = bcadd($liveSubtotalReduction, $lineTaxableReduction, 2);
                $liveTaxReduction = bcadd($liveTaxReduction, $lineTaxAmtReduction, 2);
                $liveGrandTotalReduction = bcadd($liveGrandTotalReduction, $lineTotalReduction, 2);
            }

            $allocationsData = $activeAllocations->map(fn (OrderItemAllocation $alloc) => [
                'id' => $alloc->id,
                'allocation_number' => $alloc->allocation_number,
                'warehouse_code' => $alloc->warehouse_code,
                'status' => $alloc->status->value,
                'status_label' => $alloc->status->label(),
                'badge_variant' => $alloc->status->badgeVariant(),
                'allocated_quantity' => (int) $alloc->allocated_quantity,
                'reserved_quantity' => (int) $alloc->reserved_quantity,
                'picked_quantity' => (int) $alloc->picked_quantity,
                'dispatched_quantity' => (int) $alloc->dispatched_quantity,
                'delivered_quantity' => (int) $alloc->delivered_quantity,
                'returned_quantity' => (int) $alloc->returned_quantity,
                'unpicked_quantity' => $alloc->unpickedQuantity(),
            ])->values()->all();

            $lineEvaluations[] = new OrderAdjustmentItemReviewDTO(
                adjustmentItemId: $adjItem->id,
                orderItemId: $orderItem->id,
                productId: $orderItem->product_id,
                productName: $adjItem->product_name_snapshot,
                sku: $adjItem->sku_snapshot,
                unitPriceSnapshot: (string) $adjItem->unit_price_snapshot,
                taxRateSnapshot: (string) $adjItem->tax_rate_snapshot,
                orderedQuantitySnapshot: (int) $adjItem->ordered_quantity_snapshot,
                fulfillableQuantitySnapshot: (int) $adjItem->fulfillable_quantity_snapshot,
                allocatedQuantitySnapshot: (int) $adjItem->allocated_quantity_snapshot,
                unallocatedQuantitySnapshot: (int) $adjItem->unallocated_quantity_snapshot,
                requestedQuantityReduction: $requestedReduction,
                snapshotAffectedAllocationQuantity: $snapshotAffected,
                currentOrderedQuantity: $currentOrdered,
                currentCancelledQuantity: $currentCancelled,
                currentFulfillableQuantity: $currentFulfillable,
                currentAllocatedQuantity: $currentAllocated,
                currentUnallocatedQuantity: $currentUnallocated,
                currentAffectedAllocationQuantity: $currentAffected,
                snapshotCase: $snapshotCase,
                currentCase: $currentCase,
                caseChanged: $caseChanged,
                isConflicted: $isConflicted,
                conflictReason: $conflictReason,
                unpickedAllocatedQuantity: $unpickedAllocated,
                encroachesOnPicked: $encroachesOnPicked,
                allocations: $allocationsData,
                financialSnapshot: [
                    'taxable_amount_reduction' => (string) $adjItem->projected_taxable_amount_reduction,
                    'tax_amount_reduction' => (string) $adjItem->projected_tax_amount_reduction,
                    'line_total_reduction' => (string) $adjItem->projected_line_total_reduction,
                ],
                liveFinancialPreview: [
                    'taxable_amount_reduction' => $lineTaxableReduction,
                    'tax_amount_reduction' => $lineTaxAmtReduction,
                    'line_total_reduction' => $lineTotalReduction,
                ],
            );
        }

        // 4. Financial Discrepancy Check
        $storedSubtotalReduction = (string) $adjustment->projected_subtotal_reduction;
        $storedTaxReduction = (string) $adjustment->projected_tax_reduction;
        $storedGrandTotalReduction = (string) $adjustment->projected_grand_total_reduction;
        $storedSubtotalAddition = (string) ($adjustment->projected_subtotal_addition ?? '0.00');
        $storedTaxAddition = (string) ($adjustment->projected_tax_addition ?? '0.00');
        $storedGrandTotalAddition = (string) ($adjustment->projected_grand_total_addition ?? '0.00');

        $financialDiscrepancy = (bccomp($storedGrandTotalReduction, $liveGrandTotalReduction, 2) !== 0)
            || (bccomp($storedSubtotalReduction, $liveSubtotalReduction, 2) !== 0)
            || (bccomp($storedTaxReduction, $liveTaxReduction, 2) !== 0)
            || (bccomp($storedGrandTotalAddition, $liveGrandTotalAddition, 2) !== 0)
            || (bccomp($storedSubtotalAddition, $liveSubtotalAddition, 2) !== 0)
            || (bccomp($storedTaxAddition, $liveTaxAddition, 2) !== 0);

        if ($financialDiscrepancy) {
            $isStale = true;
            $staleReasons[] = "Live financial calculation differs from stored projection.";
        }

        // 5. Synthesis of Overall Evaluation Status
        $evaluationStatus = 'READY';

        if (! in_array($order->status, $eligibleStatuses, true)) {
            $evaluationStatus = 'INELIGIBLE_LIFECYCLE';
        } elseif (! $adjustment->isSubmitted()) {
            $evaluationStatus = 'TERMINAL_REQUEST';
        } elseif ($hasConflict) {
            $evaluationStatus = 'CONFLICTED';
        } elseif ($hasEncroachment) {
            $evaluationStatus = 'WARNING_PICKED_ENCROACHMENT';
        } elseif ($totalAffectedAllocation > 0) {
            $evaluationStatus = 'WARNING_ALLOCATION';
        } elseif ($isStale) {
            $evaluationStatus = 'STALE';
        }

        return new OrderAdjustmentReviewDTO(
            adjustmentId: $adjustment->id,
            adjustmentNumber: $adjustment->adjustment_number,
            orderId: $order->id,
            orderNumber: $order->order_number,
            orderVersionSnapshot: (int) $adjustment->order_version_snapshot,
            currentOrderVersion: (int) $order->version,
            orderStatusSnapshot: $snapshotStatusValue,
            currentOrderStatus: $orderStatusValue,
            isStale: $isStale,
            staleReasons: array_values(array_unique($staleReasons)),
            evaluationStatus: $evaluationStatus,
            hasAllocationImpact: $totalAffectedAllocation > 0,
            totalAffectedAllocationQuantity: $totalAffectedAllocation,
            totalUnpickedAffectedQuantity: $totalUnpickedAffected,
            encroachesOnPicked: $hasEncroachment,
            lineEvaluations: $lineEvaluations,
            requestFinancialSnapshot: [
                'subtotal_reduction' => $storedSubtotalReduction,
                'tax_reduction' => $storedTaxReduction,
                'grand_total_reduction' => $storedGrandTotalReduction,
            ],
            liveFinancialPreview: [
                'subtotal_reduction' => $liveSubtotalReduction,
                'tax_reduction' => $liveTaxReduction,
                'grand_total_reduction' => $liveGrandTotalReduction,
            ],
            financialDiscrepancy: $financialDiscrepancy,
        );
    }
}
