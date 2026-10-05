<?php

namespace App\Services\Adjustment;

use App\DTOs\Adjustment\CreateOrderAdjustmentDTO;
use App\Enums\AdjustmentReasonCode;
use App\Enums\AdjustmentStatus;
use App\Enums\OrderAdjustmentStatus;
use App\Enums\OrderStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\OrderAdjustmentItem;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\User;
use App\Services\Allocation\OrderAllocationService;
use App\Services\Auth\PermissionService;
use App\Services\Tax\TaxCalculationService;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class OrderAdjustmentService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected OrderAllocationService $allocationService,
        protected TaxCalculationService $taxCalculationService,
    ) {}

    /**
     * Authoritatively create and submit an order adjustment request.
     * Executes inside a PostgreSQL transaction with deterministic pessimistic row locking:
     * Order -> OrderItems ASC -> OrderItemAllocations ASC -> OrderAdjustments.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     * @throws ConflictHttpException
     */
    public function createAdjustmentRequest(
        User $actor,
        Order $order,
        CreateOrderAdjustmentDTO $dto,
        ?string $clientIp = null
    ): OrderAdjustment {
        // 1. Authorize actor account state and permissions
        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_REQUEST);

        // Enforce role-based resource scoping
        if ($actor->role === UserRole::SALESMAN) {
            if ($order->salesman_id !== $actor->id) {
                throw new AuthorizationException('You are not authorized to request adjustments for orders outside your assigned customer accounts.');
            }
        } elseif ($actor->role === UserRole::WAREHOUSE_MANAGER) {
            // Warehouse managers may only request adjustments for orders in warehouse fulfillment scope
            if (! in_array($order->status, [OrderStatus::APPROVED, OrderStatus::PROCESSING], true)) {
                throw new AuthorizationException('Warehouse personnel may only request adjustments on approved or processing orders.');
            }
        }

        // Basic payload validation
        if (empty($dto->items)) {
            throw ValidationException::withMessages([
                'items' => 'An adjustment request must contain at least one line item to reduce.',
            ]);
        }

        if (AdjustmentReasonCode::tryFrom($dto->reasonCode) === null) {
            throw ValidationException::withMessages([
                'reason_code' => 'A valid adjustment reason code is required.',
            ]);
        }

        if (! empty($dto->notes) && mb_strlen($dto->notes) > 2000) {
            throw ValidationException::withMessages([
                'notes' => 'Adjustment notes may not exceed 2000 characters.',
            ]);
        }

        if ($dto->reasonCode === AdjustmentReasonCode::OTHER->value && (empty($dto->notes) || mb_strlen($dto->notes) < 5)) {
            throw ValidationException::withMessages([
                'notes' => 'Adjustment notes must be at least 5 characters when reason code is OTHER.',
            ]);
        }

        $isReplay = false;

        try {
            return DB::transaction(function () use ($actor, $order, $dto, $clientIp, &$isReplay) {
                // 2. Lock target order (Root lock in hierarchy)
                /** @var Order|null $lockedOrder */
                $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

                // 3. Idempotency Check & Fast Replay under lock
                $existingAdjustment = OrderAdjustment::with(['items', 'order'])
                    ->where('idempotency_key', $dto->idempotencyKey)
                    ->lockForUpdate()
                    ->first();

                if ($existingAdjustment) {
                    $isReplay = true;

                    return $this->resolveIdempotentReplayOrConflict($existingAdjustment, $actor, $dto, $lockedOrder);
                }

                // 4. Order Lifecycle Eligibility Check
                $this->validateOrderLifecycleEligibility($lockedOrder);

                // 5. Single Open Adjustment Request Invariant Check
                if ($lockedOrder->adjustment_status === AdjustmentStatus::REQUESTED) {
                    throw new ConflictHttpException("An adjustment request is already pending review for order {$lockedOrder->order_number}.");
                }

                $hasOpenRequest = OrderAdjustment::where('order_id', $lockedOrder->id)
                    ->where('status', OrderAdjustmentStatus::SUBMITTED)
                    ->exists();

                if ($hasOpenRequest) {
                    throw new ConflictHttpException("An adjustment request is already pending review for order {$lockedOrder->order_number}.");
                }

                // 6. Lock Order Items in ascending ID order
                $requestedItemIds = array_map(fn ($i) => $i->orderItemId, $dto->items);

                // Check for duplicate item IDs in payload
                if (count($requestedItemIds) !== count(array_unique($requestedItemIds))) {
                    throw ValidationException::withMessages([
                        'items' => 'Duplicate line items in adjustment request are not permitted.',
                    ]);
                }

                sort($requestedItemIds, SORT_NUMERIC);

                $lockedItems = $lockedOrder->items()
                    ->whereIn('id', $requestedItemIds)
                    ->lockForUpdate()
                    ->orderBy('id', 'asc')
                    ->get()
                    ->keyBy('id');

                if ($lockedItems->count() !== count($requestedItemIds)) {
                    throw ValidationException::withMessages([
                        'items' => 'One or more selected line items do not belong to this order.',
                    ]);
                }

                // 7. Lock Order Item Allocations in ascending ID order
                OrderItemAllocation::where('order_id', $lockedOrder->id)
                    ->whereIn('order_item_id', $requestedItemIds)
                    ->lockForUpdate()
                    ->orderBy('id', 'asc')
                    ->get();

                // 8. Generate sequential collision-free adjustment number under order lock
                $orderClean = preg_replace('/[^A-Za-z0-9]/', '', $lockedOrder->order_number ?: 'ORD'.$lockedOrder->id);
                $isPgsql = DB::connection()->getDriverName() === 'pgsql';
                if ($isPgsql) {
                    $maxSeq = DB::table('order_adjustments')
                        ->where('order_id', $lockedOrder->id)
                        ->selectRaw("COALESCE(MAX(SUBSTRING(adjustment_number FROM '([0-9]+)$')::integer), 0) as max_seq")
                        ->value('max_seq') ?? 0;
                } else {
                    $numbers = DB::table('order_adjustments')
                        ->where('order_id', $lockedOrder->id)
                        ->pluck('adjustment_number');
                    $maxSeq = 0;
                    foreach ($numbers as $num) {
                        if (preg_match('/(\d+)$/', (string) $num, $matches)) {
                            $maxSeq = max($maxSeq, (int) $matches[1]);
                        }
                    }
                }
                $nextSeq = ((int) $maxSeq) + 1;
                $adjustmentNumber = sprintf('ADJ-%s-%02d', $orderClean, $nextSeq);

                // 9. Mathematical Validation & Financial Projection
                $adjustmentItemRows = [];
                $totalSubtotalReduction = '0.00';
                $totalTaxReduction = '0.00';
                $totalGrandTotalReduction = '0.00';
                $totalSubtotalAddition = '0.00';
                $totalTaxAddition = '0.00';
                $totalGrandTotalAddition = '0.00';
                $totalUnitsReduced = 0;
                $totalUnitsIncreased = 0;

                foreach ($dto->items as $itemDto) {
                    /** @var OrderItem $item */
                    $item = $lockedItems->get($itemDto->orderItemId);
                    $actionType = $itemDto->actionType;

                    if ($actionType === 'INCREASE') {
                        $increase = $itemDto->increaseQuantity;

                        if ($increase <= 0 || $increase > 999999) {
                            throw ValidationException::withMessages([
                                "items.{$item->id}" => "Increase quantity for {$item->product_name_snapshot} must be between 1 and 999,999.",
                            ]);
                        }

                        // Verify available stock on inventory balance with row lock
                        $balance = InventoryBalance::where('product_id', $item->product_id)
                            ->lockForUpdate()
                            ->first();

                        $available = $balance ? (int) $balance->available_quantity : 0;
                        if ($available < $increase) {
                            throw ValidationException::withMessages([
                                "items.{$item->id}" => "Insufficient available stock for {$item->product_name_snapshot}. Available: {$available}, Requested increase: {$increase}.",
                            ]);
                        }

                        $fulfillable = $item->fulfillableQuantity();

                        // Financial additions reusing authoritative TaxCalculationService rounding
                        $taxRate = TaxCalculationService::normalizeRate($item->tax_rate_snapshot, 'tax_rate');
                        $lineTaxableAddition = bcmul((string) $item->unit_price, (string) $increase, 2);
                        $rawTaxAddition = bcdiv(bcmul($lineTaxableAddition, $taxRate, 8), '100', 8);
                        $lineTaxAddition = TaxCalculationService::roundHalfUp($rawTaxAddition, 2);
                        $lineTotalAddition = bcadd($lineTaxableAddition, $lineTaxAddition, 2);

                        $totalSubtotalAddition = bcadd($totalSubtotalAddition, $lineTaxableAddition, 2);
                        $totalTaxAddition = bcadd($totalTaxAddition, $lineTaxAddition, 2);
                        $totalGrandTotalAddition = bcadd($totalGrandTotalAddition, $lineTotalAddition, 2);
                        $totalUnitsIncreased += $increase;

                        $adjustmentItemRows[] = [
                            'order_item_id' => $item->id,
                            'product_id' => $item->product_id,
                            'product_name_snapshot' => $item->product_name_snapshot,
                            'sku_snapshot' => $item->sku_snapshot,
                            'unit_price_snapshot' => $item->unit_price,
                            'tax_rate_snapshot' => $item->tax_rate_snapshot,
                            'tax_profile_code_snapshot' => $item->tax_profile_code_snapshot,
                            'ordered_quantity_snapshot' => $item->ordered_quantity,
                            'cancelled_quantity_snapshot' => $item->cancelled_quantity,
                            'fulfillable_quantity_snapshot' => $fulfillable,
                            'allocated_quantity_snapshot' => $item->allocatedQuantity(),
                            'unallocated_quantity_snapshot' => $item->unallocatedQuantity(),
                            'action_type' => 'INCREASE',
                            'requested_quantity_reduction' => 0,
                            'requested_quantity_increase' => $increase,
                            'requested_quantity_delta' => $increase,
                            'projected_fulfillable_quantity' => $fulfillable + $increase,
                            'projected_cancelled_quantity' => $item->cancelled_quantity,
                            'affected_allocation_quantity' => 0,
                            'projected_taxable_amount_reduction' => '0.00',
                            'projected_tax_amount_reduction' => '0.00',
                            'projected_line_total_reduction' => '0.00',
                            'created_at' => Carbon::now(),
                            'updated_at' => Carbon::now(),
                        ];
                    } else {
                        $reduction = $itemDto->reductionQuantity;

                        if ($reduction <= 0 || $reduction > 999999) {
                            throw ValidationException::withMessages([
                                "items.{$item->id}" => "Reduction quantity for {$item->product_name_snapshot} must be between 1 and 999,999.",
                            ]);
                        }

                        $fulfillable = $item->fulfillableQuantity();

                        if ($fulfillable <= 0) {
                            throw ValidationException::withMessages([
                                "items.{$item->id}" => "Line item #{$item->id} ({$item->product_name_snapshot}) has no fulfillable units remaining to adjust.",
                            ]);
                        }

                        if ($reduction > $fulfillable) {
                            throw ValidationException::withMessages([
                                "items.{$item->id}" => "Cannot reduce line item #{$item->id} ({$item->product_name_snapshot}) by {$reduction} units. Only {$fulfillable} fulfillable units remain.",
                            ]);
                        }

                        // Partition into Case A (Unallocated) vs Case B (Allocation-impacting)
                        $unallocated = $item->unallocatedQuantity();
                        $affectedAllocations = max(0, $reduction - $unallocated);

                        // Financial projections reusing authoritative TaxCalculationService rounding
                        $taxRate = TaxCalculationService::normalizeRate($item->tax_rate_snapshot, 'tax_rate');
                        $lineTaxableReduction = bcmul((string) $item->unit_price, (string) $reduction, 2);
                        $rawTaxReduction = bcdiv(bcmul($lineTaxableReduction, $taxRate, 8), '100', 8);
                        $lineTaxReduction = TaxCalculationService::roundHalfUp($rawTaxReduction, 2);
                        $lineTotalReduction = bcadd($lineTaxableReduction, $lineTaxReduction, 2);

                        $totalSubtotalReduction = bcadd($totalSubtotalReduction, $lineTaxableReduction, 2);
                        $totalTaxReduction = bcadd($totalTaxReduction, $lineTaxReduction, 2);
                        $totalGrandTotalReduction = bcadd($totalGrandTotalReduction, $lineTotalReduction, 2);
                        $totalUnitsReduced += $reduction;

                        $adjustmentItemRows[] = [
                            'order_item_id' => $item->id,
                            'product_id' => $item->product_id,
                            'product_name_snapshot' => $item->product_name_snapshot,
                            'sku_snapshot' => $item->sku_snapshot,
                            'unit_price_snapshot' => $item->unit_price,
                            'tax_rate_snapshot' => $item->tax_rate_snapshot,
                            'tax_profile_code_snapshot' => $item->tax_profile_code_snapshot,
                            'ordered_quantity_snapshot' => $item->ordered_quantity,
                            'cancelled_quantity_snapshot' => $item->cancelled_quantity,
                            'fulfillable_quantity_snapshot' => $fulfillable,
                            'allocated_quantity_snapshot' => $item->allocatedQuantity(),
                            'unallocated_quantity_snapshot' => $unallocated,
                            'action_type' => 'DECREASE',
                            'requested_quantity_reduction' => $reduction,
                            'requested_quantity_increase' => 0,
                            'requested_quantity_delta' => -$reduction,
                            'projected_fulfillable_quantity' => max(0, $fulfillable - $reduction),
                            'projected_cancelled_quantity' => $item->cancelled_quantity + $reduction,
                            'affected_allocation_quantity' => $affectedAllocations,
                            'projected_taxable_amount_reduction' => $lineTaxableReduction,
                            'projected_tax_amount_reduction' => $lineTaxReduction,
                            'projected_line_total_reduction' => $lineTotalReduction,
                            'created_at' => Carbon::now(),
                            'updated_at' => Carbon::now(),
                        ];
                    }
                }

                $adjustmentType = match (true) {
                    $totalUnitsIncreased > 0 && $totalUnitsReduced === 0 => 'QUANTITY_INCREASE',
                    $totalUnitsIncreased === 0 && $totalUnitsReduced > 0 => 'QUANTITY_REDUCTION',
                    default => 'QUANTITY_ADJUSTMENT',
                };

                // 10. Persist Order Adjustment Aggregate
                /** @var OrderAdjustment $adjustment */
                $adjustment = OrderAdjustment::create([
                    'adjustment_number' => $adjustmentNumber,
                    'order_id' => $lockedOrder->id,
                    'order_number_snapshot' => $lockedOrder->order_number ?: 'ORD-'.$lockedOrder->id,
                    'order_version_snapshot' => $lockedOrder->version,
                    'order_status_snapshot' => $lockedOrder->status->value,
                    'order_subtotal_snapshot' => $lockedOrder->subtotal,
                    'order_tax_total_snapshot' => $lockedOrder->tax_total,
                    'order_grand_total_snapshot' => $lockedOrder->grand_total,
                    'type' => $adjustmentType,
                    'status' => OrderAdjustmentStatus::SUBMITTED,
                    'reason_code' => $dto->reasonCode,
                    'notes' => $dto->notes,
                    'requested_by' => $actor->id,
                    'requested_at' => Carbon::now(),
                    'projected_subtotal_reduction' => $totalSubtotalReduction,
                    'projected_tax_reduction' => $totalTaxReduction,
                    'projected_grand_total_reduction' => $totalGrandTotalReduction,
                    'projected_subtotal_addition' => $totalSubtotalAddition,
                    'projected_tax_addition' => $totalTaxAddition,
                    'projected_grand_total_addition' => $totalGrandTotalAddition,
                    'idempotency_key' => $dto->idempotencyKey,
                    'request_fingerprint' => $dto->canonicalFingerprint(),
                ]);

                // Insert child lines (RESTRICT on delete ensures non-destructive history)
                foreach ($adjustmentItemRows as &$row) {
                    $row['adjustment_id'] = $adjustment->id;
                }
                unset($row);

                OrderAdjustmentItem::insert($adjustmentItemRows);

                // 11. Transition Order Adjustment Status
                $lockedOrder->adjustment_status = AdjustmentStatus::REQUESTED;
                $lockedOrder->save();

                return $adjustment->load(['items', 'order']);
            }, 3);
        } catch (\Throwable $e) {
            if ($e instanceof UniqueConstraintViolationException) {
                // Catch concurrent idempotency or single open request collisions
                $committed = OrderAdjustment::with(['items', 'order'])
                    ->where('idempotency_key', $dto->idempotencyKey)
                    ->first();

                if ($committed) {
                    return $this->resolveIdempotentReplayOrConflict($committed, $actor, $dto, $order, true);
                }

                throw new ConflictHttpException("An adjustment request is already pending review for order {$order->order_number}.");
            }

            throw $e;
        } finally {
            if (! $isReplay && isset($adjustment) && $adjustment instanceof OrderAdjustment) {
                Log::info('commerce.order_adjustment_event', [
                    'action' => 'ADJUSTMENT_REQUEST_CREATED',
                    'adjustment_id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'actor_id' => $actor->id,
                    'actor_name' => $actor->name,
                    'actor_role' => $actor->role->value,
                    'reason_code' => $adjustment->reason_code->value,
                    'items_count' => count($dto->items),
                    'projected_grand_total_reduction' => (string) $adjustment->projected_grand_total_reduction,
                    'idempotency_key' => $adjustment->idempotency_key,
                    'ip_address' => $clientIp,
                    'timestamp' => Carbon::now()->toIso8601String(),
                ]);
            }
        }
    }

    /**
     * Authoritatively withdraw / cancel an unreviewed adjustment request.
     * Allowed only while adjustment status is SUBMITTED.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function withdrawAdjustmentRequest(
        User $actor,
        OrderAdjustment $adjustment,
        string $reason,
        ?string $clientIp = null
    ): OrderAdjustment {
        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_REQUEST);

        // Salesmen can only withdraw their own requests. Admins / Super Admins can withdraw any.
        if ($actor->role === UserRole::SALESMAN && $adjustment->requested_by !== $actor->id) {
            throw new AuthorizationException('You are not authorized to withdraw adjustment requests submitted by other users.');
        }

        $reason = trim($reason);
        if ($reason !== '' && mb_strlen($reason) > 1000) {
            throw ValidationException::withMessages([
                'reason' => 'Withdrawal reason cannot exceed 1000 characters.',
            ]);
        }

        /** @var OrderAdjustment $withdrawnAdjustment */
        $withdrawnAdjustment = DB::transaction(function () use ($actor, $adjustment, $reason) {
            // Lock Order first
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $adjustment->order_id)->lockForUpdate()->firstOrFail();

            // Lock Adjustment record
            /** @var OrderAdjustment $lockedAdjustment */
            $lockedAdjustment = OrderAdjustment::where('id', $adjustment->id)->lockForUpdate()->firstOrFail();

            if ($lockedAdjustment->status !== OrderAdjustmentStatus::SUBMITTED) {
                throw new ConflictHttpException("Cannot withdraw adjustment {$lockedAdjustment->adjustment_number}: status is '{$lockedAdjustment->status->label()}', expected 'Submitted'.");
            }

            // Set terminal cancelled state
            $lockedAdjustment->status = OrderAdjustmentStatus::CANCELLED;
            $lockedAdjustment->cancelled_by = $actor->id;
            $lockedAdjustment->cancelled_at = Carbon::now();
            $lockedAdjustment->cancellation_reason = $reason;
            $lockedAdjustment->save();

            // Reset order adjustment status to NONE (or APPLIED if a prior adjustment was applied)
            $hasPriorApplied = OrderAdjustment::where('order_id', $lockedOrder->id)
                ->where('status', OrderAdjustmentStatus::APPLIED)
                ->exists();

            $lockedOrder->adjustment_status = $hasPriorApplied ? AdjustmentStatus::APPLIED : AdjustmentStatus::NONE;
            $lockedOrder->save();

            return $lockedAdjustment->load(['items', 'order']);
        }, 3);

        Log::info('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_REQUEST_WITHDRAWN',
            'adjustment_id' => $withdrawnAdjustment->id,
            'adjustment_number' => $withdrawnAdjustment->adjustment_number,
            'order_id' => $withdrawnAdjustment->order_id,
            'order_number' => $withdrawnAdjustment->order_number_snapshot,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'reason' => $reason,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        return $withdrawnAdjustment;
    }

    /**
     * Validate that an order is in an eligible lifecycle state to receive an adjustment request.
     *
     * @throws ConflictHttpException
     */
    public function validateOrderLifecycleEligibility(Order $order): void
    {
        $status = $order->status instanceof OrderStatus ? $order->status : OrderStatus::tryFrom((string) $order->status);

        if (! in_array($status, [
            OrderStatus::SUBMITTED,
            OrderStatus::PENDING_APPROVAL,
            OrderStatus::APPROVED,
            OrderStatus::PROCESSING,
        ], true)) {
            $statusLabel = $status ? $status->label() : (string) $order->status;
            throw new ConflictHttpException("Order {$order->order_number} is in '{$statusLabel}' status and cannot receive adjustment requests.");
        }
    }

    /**
     * Authoritatively resolve an existing adjustment against the actor and DTO intent.
     * Enforces actor authorization (403), fingerprint verification (200 vs 409), and replay audit logging.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    protected function resolveIdempotentReplayOrConflict(
        OrderAdjustment $adjustment,
        User $actor,
        CreateOrderAdjustmentDTO $dto,
        Order $order,
        bool $recoveredFromRace = false
    ): OrderAdjustment {
        // Verify actor ownership
        if ($adjustment->requested_by !== $actor->id) {
            throw new ConflictHttpException('This idempotency key belongs to an adjustment request created by another user.');
        }

        // Verify order binding
        if ($adjustment->order_id !== $order->id) {
            throw new ConflictHttpException('An adjustment request with this idempotency key already exists for a different order.');
        }

        // Verify payload fingerprint
        $fingerprint = $dto->canonicalFingerprint();

        if ($adjustment->request_fingerprint !== $fingerprint) {
            throw new ConflictHttpException('An adjustment request with this idempotency key already exists with a different payload.');
        }

        Log::info('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_REQUEST_IDEMPOTENT_REPLAY',
            'adjustment_id' => $adjustment->id,
            'adjustment_number' => $adjustment->adjustment_number,
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'actor_id' => $actor->id,
            'idempotency_key' => $adjustment->idempotency_key,
            'recovered_from_race' => $recoveredFromRace,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        return $adjustment;
    }
}
