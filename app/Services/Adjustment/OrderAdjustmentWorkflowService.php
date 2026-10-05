<?php

namespace App\Services\Adjustment;

use App\Enums\AdjustmentStatus;
use App\Enums\AllocationStatus;
use App\Enums\InventoryMovementType;
use App\Enums\InventoryStockState;
use App\Enums\OrderAdjustmentStatus;
use App\Enums\OrderStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\User;
use App\Services\Allocation\OrderAllocationService;
use App\Services\Allocation\OrderAllocationValidationService;
use App\Services\Auth\PermissionService;
use App\Services\Inventory\InventoryMovementService;
use App\Services\Order\OrderWorkflowService;
use App\Services\Tax\TaxCalculationService;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class OrderAdjustmentWorkflowService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected OrderAdjustmentReviewService $reviewService,
        protected ?TaxCalculationService $taxCalculationService = null,
        protected ?OrderAllocationService $allocationService = null,
        protected ?OrderAllocationValidationService $allocationValidator = null,
        protected ?InventoryMovementService $movementService = null,
        protected ?OrderWorkflowService $orderWorkflowService = null,
    ) {
        $this->taxCalculationService ??= new TaxCalculationService();
        $this->allocationValidator ??= new OrderAllocationValidationService();
        $this->allocationService ??= new OrderAllocationService($this->allocationValidator);
        $this->movementService ??= app(InventoryMovementService::class);
        $this->orderWorkflowService ??= app(OrderWorkflowService::class);
    }

    /**
     * Authoritatively approve an order adjustment request.
     * Executes within DB::transaction(..., 3) with deterministic lock ordering:
     * 1. orders (Root lock)
     * 2. order_items ASC
     * 3. order_item_allocations ASC
     * 4. order_adjustments row
     *
     * Validates live quantity conservation, stale state, maker-checker, and Case B acknowledgments.
     * ZERO mutation of quantities, allocations, or order financials (reserved for FEAT-ADJ-004).
     *
     * @param  array<string, mixed>  $options
     *
     * @throws AuthorizationException
     * @throws ValidationException
     * @throws ConflictHttpException
     * @throws NotFoundHttpException
     */
    public function approveAdjustment(
        User $actor,
        Order $order,
        OrderAdjustment $adjustment,
        array $options = [],
        ?string $clientIp = null
    ): OrderAdjustment {
        // Pre-transaction authorization checks
        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_APPROVE);

        // Pre-transaction IDOR guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
        }

        $caseType = 'CASE_A';
        $totalAffectedAllocation = 0;
        $isEmergencyOverride = false;
        $overrideReason = null;

        /** @var OrderAdjustment $approvedAdjustment */
        $approvedAdjustment = DB::transaction(function () use (
            $actor,
            $order,
            $adjustment,
            $options,
            $clientIp,
            &$caseType,
            &$totalAffectedAllocation,
            &$isEmergencyOverride,
            &$overrideReason
        ) {
            // 1. Lock orders (Root lock)
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            // 2. Lock order_items in deterministic ASC order
            OrderItem::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            // 3. Lock order_item_allocations in deterministic ASC order
            OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            // 4. Lock order_adjustments row
            /** @var OrderAdjustment $lockedAdjustment */
            $lockedAdjustment = OrderAdjustment::where('id', $adjustment->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Re-verify IDOR under lock
            if ((int) $lockedAdjustment->order_id !== (int) $lockedOrder->id) {
                throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
            }

            // 5. State Machine Guard: Only SUBMITTED -> APPROVED is valid.
            // Duplicate/terminal decisions deterministically return 409 Conflict.
            if ($lockedAdjustment->status !== OrderAdjustmentStatus::SUBMITTED) {
                throw new ConflictHttpException(
                    "Cannot approve adjustment {$lockedAdjustment->adjustment_number}: status is '{$lockedAdjustment->status->label()}', expected 'Submitted'."
                );
            }

            // 6. Maker-Checker Segregation of Duties
            $isSelfDecision = ((int) $lockedAdjustment->requested_by === (int) $actor->id);
            if ($isSelfDecision) {
                if ($actor->role !== UserRole::SUPER_ADMIN) {
                    throw new AuthorizationException(
                        'Segregation of duties violation: You cannot approve an adjustment request that you personally submitted.'
                    );
                }

                $rawOverride = $options['emergency_override_reason'] ?? null;
                $overrideReason = is_string($rawOverride) ? trim($rawOverride) : '';

                if (mb_strlen($overrideReason) < 10 || mb_strlen($overrideReason) > 1000) {
                    throw ValidationException::withMessages([
                        'emergency_override_reason' => 'Super Admin self-approval requires an emergency override reason between 10 and 1000 characters.',
                    ]);
                }

                $isEmergencyOverride = true;
            }

            // 7. Order Lifecycle Check
            $eligibleStatuses = [
                OrderStatus::SUBMITTED,
                OrderStatus::PENDING_APPROVAL,
                OrderStatus::APPROVED,
                OrderStatus::PROCESSING,
            ];
            if (! in_array($lockedOrder->status, $eligibleStatuses, true)) {
                $blockReason = "Order {$lockedOrder->order_number} has transitioned to '{$lockedOrder->status->label()}', which is not an eligible adjustment lifecycle state.";
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            // 8. Order Version Guard
            if ((int) $lockedOrder->version !== (int) $lockedAdjustment->order_version_snapshot) {
                $blockReason = "Order version has changed from {$lockedAdjustment->order_version_snapshot} to {$lockedOrder->version}.";
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            // 9. Single-Open Request Invariant
            $openCount = OrderAdjustment::where('order_id', $lockedOrder->id)
                ->where('status', OrderAdjustmentStatus::SUBMITTED)
                ->count();
            if ($openCount !== 1) {
                $blockReason = "Found {$openCount} open adjustment requests for this order; expected exactly 1.";
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            // 10. Deep Live Review Revalidation
            $lockedAdjustment->load([
                'items' => fn ($q) => $q->orderBy('id', 'asc'),
                'items.orderItem' => fn ($q) => $q->with([
                    'allocations' => fn ($allocQ) => $allocQ->orderBy('id', 'asc'),
                ]),
                'items.product',
            ]);

            $evaluation = $this->reviewService->evaluate($lockedAdjustment, $lockedOrder);

            if ($evaluation->evaluationStatus === 'TERMINAL_REQUEST') {
                $blockReason = "Adjustment request is already in terminal state '{$lockedAdjustment->status->label()}'.";
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException($blockReason);
            }

            if ($evaluation->evaluationStatus === 'INELIGIBLE_LIFECYCLE') {
                $blockReason = "Order is in lifecycle state '{$lockedOrder->status->label()}'.";
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            if ($evaluation->evaluationStatus === 'CONFLICTED') {
                $blockReason = $evaluation->staleReasons[0] ?? 'Requested reduction conflicts with current fulfillable quantity.';
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            if ($evaluation->evaluationStatus === 'WARNING_PICKED_ENCROACHMENT') {
                $blockReason = 'Requested reduction encroaches on already picked stock.';
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            if ($evaluation->evaluationStatus === 'STALE') {
                $blockReason = $evaluation->staleReasons[0] ?? 'Adjustment request is stale due to upstream order modifications.';
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            if ($evaluation->financialDiscrepancy) {
                $blockReason = 'Live financial calculation differs from stored projection.';
                $this->logApprovalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot approve adjustment: {$blockReason}");
            }

            // 11. Case B Allocation Impact Check & Mandatory Acknowledgment
            $totalAffectedAllocation = $evaluation->totalAffectedAllocationQuantity;
            $caseType = $totalAffectedAllocation > 0 ? 'CASE_B' : 'CASE_A';

            if ($totalAffectedAllocation > 0) {
                $acknowledged = filter_var($options['acknowledge_allocation_impact'] ?? false, FILTER_VALIDATE_BOOLEAN);
                if (! $acknowledged) {
                    throw ValidationException::withMessages([
                        'acknowledge_allocation_impact' => 'Acknowledgment of allocation impact is required to approve this adjustment request.',
                    ]);
                }
            }

            // 12. Execute Authoritative Transition
            $lockedAdjustment->status = OrderAdjustmentStatus::APPROVED;
            $lockedAdjustment->reviewed_by = $actor->id;
            $lockedAdjustment->reviewed_at = Carbon::now();
            $lockedAdjustment->save();

            // Order adjustment_status remains REQUESTED awaiting FEAT-ADJ-004 application
            // Ensures orders table maintains consistent state without mutating quantities/finances
            if ($lockedOrder->adjustment_status !== AdjustmentStatus::REQUESTED) {
                $lockedOrder->adjustment_status = AdjustmentStatus::REQUESTED;
                $lockedOrder->save();
            }

            return $lockedAdjustment->load(['order', 'items', 'reviewer', 'requester']);
        }, 3);

        // 13. Post-Commit Observability Logging
        Log::info('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_APPROVED',
            'adjustment_id' => $approvedAdjustment->id,
            'adjustment_number' => $approvedAdjustment->adjustment_number,
            'order_id' => $approvedAdjustment->order_id,
            'order_number' => $approvedAdjustment->order_number_snapshot,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role->value,
            'case_type' => $caseType,
            'affected_allocation_quantity' => $totalAffectedAllocation,
            'is_emergency_override' => $isEmergencyOverride,
            'override_reason' => $overrideReason,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        if ($isEmergencyOverride) {
            Log::info('commerce.order_adjustment_event', [
                'action' => 'ADJUSTMENT_EMERGENCY_OVERRIDE',
                'adjustment_id' => $approvedAdjustment->id,
                'adjustment_number' => $approvedAdjustment->adjustment_number,
                'order_id' => $approvedAdjustment->order_id,
                'order_number' => $approvedAdjustment->order_number_snapshot,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'actor_role' => $actor->role->value,
                'override_reason' => $overrideReason,
                'decision' => 'APPROVED',
                'ip_address' => $clientIp,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);
        }

        return $approvedAdjustment;
    }

    /**
     * Authoritatively reject an order adjustment request.
     * Executes within DB::transaction(..., 3) with deterministic lock ordering:
     * 1. orders (Root lock)
     * 2. order_items ASC
     * 3. order_item_allocations ASC
     * 4. order_adjustments row
     *
     * Rejection does NOT require live quantity/allocation satisfiability.
     * ZERO mutation of quantities, allocations, or order financials.
     *
     * @param  array<string, mixed>  $options
     *
     * @throws AuthorizationException
     * @throws ValidationException
     * @throws ConflictHttpException
     * @throws NotFoundHttpException
     */
    public function rejectAdjustment(
        User $actor,
        Order $order,
        OrderAdjustment $adjustment,
        string $reason,
        array $options = [],
        ?string $clientIp = null
    ): OrderAdjustment {
        // Pre-transaction authorization checks
        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_APPROVE);

        // Pre-transaction IDOR guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
        }

        $validatedReason = trim($reason);
        if (mb_strlen($validatedReason) < 5 || mb_strlen($validatedReason) > 1000) {
            throw ValidationException::withMessages([
                'reason' => 'Rejection reason must be between 5 and 1000 characters.',
            ]);
        }

        $isEmergencyOverride = false;
        $overrideReason = null;

        /** @var OrderAdjustment $rejectedAdjustment */
        $rejectedAdjustment = DB::transaction(function () use (
            $actor,
            $order,
            $adjustment,
            $validatedReason,
            $options,
            &$isEmergencyOverride,
            &$overrideReason
        ) {
            // 1. Lock orders (Root lock)
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            // 2. Lock order_items in deterministic ASC order
            OrderItem::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            // 3. Lock order_item_allocations in deterministic ASC order
            OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            // 4. Lock order_adjustments row
            /** @var OrderAdjustment $lockedAdjustment */
            $lockedAdjustment = OrderAdjustment::where('id', $adjustment->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Re-verify IDOR under lock
            if ((int) $lockedAdjustment->order_id !== (int) $lockedOrder->id) {
                throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
            }

            // 5. State Machine Guard: Only SUBMITTED -> REJECTED is valid.
            // Duplicate/terminal decisions deterministically return 409 Conflict.
            if ($lockedAdjustment->status !== OrderAdjustmentStatus::SUBMITTED) {
                throw new ConflictHttpException(
                    "Cannot reject adjustment {$lockedAdjustment->adjustment_number}: status is '{$lockedAdjustment->status->label()}', expected 'Submitted'."
                );
            }

            // 6. Maker-Checker Segregation of Duties
            $isSelfDecision = ((int) $lockedAdjustment->requested_by === (int) $actor->id);
            if ($isSelfDecision) {
                if ($actor->role !== UserRole::SUPER_ADMIN) {
                    throw new AuthorizationException(
                        'Segregation of duties violation: You cannot reject an adjustment request that you personally submitted.'
                    );
                }

                $rawOverride = $options['emergency_override_reason'] ?? null;
                $overrideReason = is_string($rawOverride) ? trim($rawOverride) : '';

                if (mb_strlen($overrideReason) < 10 || mb_strlen($overrideReason) > 1000) {
                    throw ValidationException::withMessages([
                        'emergency_override_reason' => 'Super Admin self-rejection requires an emergency override reason between 10 and 1000 characters.',
                    ]);
                }

                $isEmergencyOverride = true;
            }

            // 7. Transition adjustment to REJECTED
            $lockedAdjustment->status = OrderAdjustmentStatus::REJECTED;
            $lockedAdjustment->reviewed_by = $actor->id;
            $lockedAdjustment->reviewed_at = Carbon::now();
            $lockedAdjustment->rejection_reason = $validatedReason;
            $lockedAdjustment->save();

            // 8. Reset orders.adjustment_status to NONE (or APPLIED if earlier adjustment remains APPLIED)
            $hasPriorApplied = OrderAdjustment::where('order_id', $lockedOrder->id)
                ->where('status', OrderAdjustmentStatus::APPLIED)
                ->exists();

            $lockedOrder->adjustment_status = $hasPriorApplied ? AdjustmentStatus::APPLIED : AdjustmentStatus::NONE;
            $lockedOrder->save();

            return $lockedAdjustment->load(['order', 'items', 'reviewer', 'requester']);
        }, 3);

        // 9. Post-Commit Observability Logging
        Log::info('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_REJECTED',
            'adjustment_id' => $rejectedAdjustment->id,
            'adjustment_number' => $rejectedAdjustment->adjustment_number,
            'order_id' => $rejectedAdjustment->order_id,
            'order_number' => $rejectedAdjustment->order_number_snapshot,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role->value,
            'rejection_reason' => $validatedReason,
            'is_emergency_override' => $isEmergencyOverride,
            'override_reason' => $overrideReason,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        if ($isEmergencyOverride) {
            Log::info('commerce.order_adjustment_event', [
                'action' => 'ADJUSTMENT_EMERGENCY_OVERRIDE',
                'adjustment_id' => $rejectedAdjustment->id,
                'adjustment_number' => $rejectedAdjustment->adjustment_number,
                'order_id' => $rejectedAdjustment->order_id,
                'order_number' => $rejectedAdjustment->order_number_snapshot,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'actor_role' => $actor->role->value,
                'override_reason' => $overrideReason,
                'decision' => 'REJECTED',
                'ip_address' => $clientIp,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);
        }

        return $rejectedAdjustment;
    }

    /**
     * Helper to log blocked approval attempts for audit/observability.
     */
    protected function logApprovalBlocked(
        OrderAdjustment $adjustment,
        Order $order,
        User $actor,
        string $reason,
        ?string $clientIp
    ): void {
        Log::warning('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_APPROVAL_BLOCKED',
            'adjustment_id' => $adjustment->id,
            'adjustment_number' => $adjustment->adjustment_number,
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role->value,
            'reason' => $reason,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * Authoritatively apply an approved order adjustment request.
     * Executes within DB::transaction(..., 3) with deterministic lock ordering:
     * 1. orders (Root lock)
     * 2. order_items ASC
     * 3. order_item_allocations ASC
     * 4. order_adjustments row
     *
     * Invariants:
     * - Only APPROVED -> APPLIED transition allowed.
     * - Live revalidation of order lifecycle, fulfillable quantities, and unpicked allocation capacity.
     * - Case A: increases cancelled_quantity, recalculates financials.
     * - Case B: releases unpicked allocation capacity (splitting allocation rows for partial releases),
     *   resyncs rollups, increases cancelled_quantity, recalculates financials.
     * - Recalculates order subtotal, tax_total, grand_total, and updates adjustment_total.
     * - Increments orders.version.
     * - Sets orders.adjustment_status = APPLIED.
     * - All-or-nothing atomicity: any line failure aborts the entire transaction.
     * - Emits structured observability events post-commit.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     * @throws NotFoundHttpException
     */
    public function applyAdjustment(
        User $actor,
        Order $order,
        OrderAdjustment $adjustment,
        ?string $clientIp = null
    ): OrderAdjustment {
        // 1. Pre-transaction authorization checks
        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_APPLY);

        // Pre-transaction IDOR guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
        }

        $releasedAllocationsLog = [];
        $totalUnitsCancelled = 0;
        $financialDeltaLog = [];

        /** @var OrderAdjustment $appliedAdjustment */
        $appliedAdjustment = DB::transaction(function () use (
            $actor,
            $order,
            $adjustment,
            $clientIp,
            &$releasedAllocationsLog,
            &$totalUnitsCancelled,
            &$financialDeltaLog
        ) {
            // 1. Lock orders (Root lock)
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            // 2. Lock order_items in deterministic ASC order
            $lockedItems = OrderItem::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->with(['product', 'allocations'])
                ->get();
            $lockedItemsById = $lockedItems->keyBy('id');

            // 3. Lock order_item_allocations in deterministic ASC order
            OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            // 4. Lock order_adjustments row
            /** @var OrderAdjustment $lockedAdjustment */
            $lockedAdjustment = OrderAdjustment::where('id', $adjustment->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Re-verify IDOR under lock
            if ((int) $lockedAdjustment->order_id !== (int) $lockedOrder->id) {
                throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
            }

            // 5. State Machine Guard: Only APPROVED -> APPLIED is valid.
            if ($lockedAdjustment->status === OrderAdjustmentStatus::APPLIED) {
                throw new ConflictHttpException(
                    "Adjustment {$lockedAdjustment->adjustment_number} has already been applied."
                );
            }

            if ($lockedAdjustment->status !== OrderAdjustmentStatus::APPROVED) {
                throw new ConflictHttpException(
                    "Cannot apply adjustment {$lockedAdjustment->adjustment_number}: status is '{$lockedAdjustment->status->label()}', expected 'Approved'."
                );
            }

            // 6. Order Lifecycle Check
            $eligibleStatuses = [
                OrderStatus::APPROVED,
                OrderStatus::PROCESSING,
                OrderStatus::SUBMITTED,
                OrderStatus::PENDING_APPROVAL,
            ];
            if (! in_array($lockedOrder->status, $eligibleStatuses, true)) {
                $blockReason = "Order {$lockedOrder->order_number} has transitioned to '{$lockedOrder->status->label()}', which is not an eligible adjustment lifecycle state.";
                $this->logApplicationBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot apply adjustment: {$blockReason}");
            }

            // 7. Load adjustment line items
            $adjItems = $lockedAdjustment->items()->orderBy('id', 'asc')->get();
            if ($adjItems->isEmpty()) {
                throw ValidationException::withMessages([
                    'adjustment' => 'Adjustment must contain at least one line item to apply.',
                ]);
            }

            // 8. AUTHORITATIVE PRE-VALIDATION: Validate ALL lines before mutating ANY record (All-or-Nothing)
            foreach ($adjItems as $adjItem) {
                /** @var OrderItem|null $item */
                $item = $lockedItemsById->get($adjItem->order_item_id);
                if (! $item) {
                    $blockReason = "Order item #{$adjItem->order_item_id} does not exist on order {$lockedOrder->order_number}.";
                    $this->logApplicationBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                    throw new ConflictHttpException("Cannot apply adjustment: {$blockReason}");
                }

                $actionType = $adjItem->action_type ?? 'DECREASE';
                $isIncrease = ($actionType === 'INCREASE') || ((int) ($adjItem->requested_quantity_increase ?? 0) > 0);

                if ($isIncrease) {
                    $increase = (int) ($adjItem->requested_quantity_increase > 0 ? $adjItem->requested_quantity_increase : $adjItem->requested_quantity_delta);
                    if ($increase <= 0) {
                        throw ValidationException::withMessages([
                            'requested_quantity_increase' => "Requested quantity increase must be positive for line item #{$item->id}.",
                        ]);
                    }

                    $balance = InventoryBalance::where('product_id', $item->product_id)->lockForUpdate()->first();
                    $available = $balance ? (int) $balance->available_quantity : 0;
                    if ($available < $increase) {
                        $blockReason = "Requested increase of {$increase} units for line item #{$item->id} ({$item->product_name_snapshot}) exceeds available stock ({$available}).";
                        $this->logApplicationBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                        throw new ConflictHttpException("Cannot apply adjustment: {$blockReason}");
                    }
                } else {
                    $reduction = (int) ($adjItem->requested_quantity_reduction > 0 ? $adjItem->requested_quantity_reduction : abs((int) $adjItem->requested_quantity_delta));
                    if ($reduction <= 0) {
                        throw ValidationException::withMessages([
                            'requested_quantity_reduction' => "Requested quantity reduction must be positive for line item #{$item->id}.",
                        ]);
                    }

                    $currentFulfillable = $item->fulfillableQuantity();
                    if ($reduction > $currentFulfillable) {
                        $blockReason = "Requested reduction of {$reduction} units for line item #{$item->id} exceeds current fulfillable quantity ({$currentFulfillable}).";
                        $this->logApplicationBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                        throw new ConflictHttpException("Cannot apply adjustment: {$blockReason}");
                    }

                    $currentUnallocated = $item->unallocatedQuantity();

                    // If Case B (reduction exceeds unallocated units), verify sufficient releasable unpicked capacity
                    if ($reduction > $currentUnallocated) {
                        $neededRelease = $reduction - $currentUnallocated;

                        // Calculate available releasable capacity across eligible allocations:
                        // Must be ALLOCATED or RESERVED, and picked == 0, dispatched == 0, delivered == 0, returned == 0
                        $releasableCapacity = (int) OrderItemAllocation::where('order_item_id', $item->id)
                            ->whereIn('status', [AllocationStatus::ALLOCATED->value, AllocationStatus::RESERVED->value])
                            ->where('picked_quantity', 0)
                            ->where('dispatched_quantity', 0)
                            ->where('delivered_quantity', 0)
                            ->where('returned_quantity', 0)
                            ->sum('allocated_quantity');

                        if ($neededRelease > $releasableCapacity) {
                            $blockReason = "Requested reduction requires releasing {$neededRelease} allocated units for line item #{$item->id}, but only {$releasableCapacity} unpicked units are available (encroaches on picked/dispatched stock).";
                            $this->logApplicationBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                            throw new ConflictHttpException("Cannot apply adjustment: {$blockReason}");
                        }
                    }
                }
            }

            // 9. EXECUTE ATOMIC MUTATIONS FOR EACH LINE
            foreach ($adjItems as $adjItem) {
                /** @var OrderItem $item */
                $item = $lockedItemsById->get($adjItem->order_item_id);
                $actionType = $adjItem->action_type ?? 'DECREASE';
                $isIncrease = ($actionType === 'INCREASE') || ((int) ($adjItem->requested_quantity_increase ?? 0) > 0);

                if ($isIncrease) {
                    $increase = (int) ($adjItem->requested_quantity_increase > 0 ? $adjItem->requested_quantity_increase : $adjItem->requested_quantity_delta);

                    // Non-destructive: update increased_quantity
                    $item->increased_quantity = ($item->increased_quantity ?? 0) + $increase;
                    $item->save();

                    // Reserve physical stock on inventory balance
                    $balance = InventoryBalance::where('product_id', $item->product_id)->lockForUpdate()->first();
                    if ($balance) {
                        $onHandBefore = (int) $balance->on_hand_quantity;
                        $reservedBefore = (int) $balance->reserved_quantity;
                        $availableBefore = (int) $balance->available_quantity;
                        $damagedBefore = (int) $balance->damaged_quantity;

                        $balance->reserved_quantity += $increase;
                        $balance->available_quantity = $balance->calculateAvailableQuantity();
                        $balance->version += 1;
                        $balance->save();

                        $this->movementService->recordMovement([
                            'warehouse_id' => $balance->warehouse_id,
                            'product_id' => $item->product_id,
                            'inventory_balance_id' => $balance->id,
                            'movement_type' => InventoryMovementType::RESERVATION,
                            'from_state' => InventoryStockState::AVAILABLE,
                            'to_state' => InventoryStockState::RESERVED,
                            'quantity' => $increase,
                            'on_hand_before' => $onHandBefore,
                            'on_hand_after' => (int) $balance->on_hand_quantity,
                            'reserved_before' => $reservedBefore,
                            'reserved_after' => (int) $balance->reserved_quantity,
                            'available_before' => $availableBefore,
                            'available_after' => (int) $balance->available_quantity,
                            'damaged_before' => $damagedBefore,
                            'damaged_after' => (int) $balance->damaged_quantity,
                            'reference_type' => 'App\\Models\\OrderAdjustment',
                            'reference_id' => $lockedAdjustment->id,
                            'reference_number' => $lockedAdjustment->adjustment_number,
                            'notes' => "Stock reserved via applied adjustment {$lockedAdjustment->adjustment_number} (+{$increase} units)",
                            'actor_id' => $actor->id,
                        ]);
                    }

                    // If order has baseline allocations, allocate the increase
                    if (in_array($lockedOrder->status, [OrderStatus::APPROVED, OrderStatus::PROCESSING], true)) {
                        $orderNumClean = $lockedOrder->order_number ?: 'ORD-' . $lockedOrder->id;
                        $maxSeq = OrderItemAllocation::where('order_item_id', $item->id)
                            ->pluck('allocation_number')
                            ->map(function ($num) {
                                if (preg_match('/-(\d+)$/', (string) $num, $matches)) {
                                    return (int) $matches[1];
                                }
                                return 0;
                            })
                            ->max() ?? 0;

                        $nextSeq = sprintf('%02d', $maxSeq + 1);
                        $allocNumber = "ALC-{$orderNumClean}-{$item->id}-{$nextSeq}";

                        OrderItemAllocation::create([
                            'allocation_number' => $allocNumber,
                            'order_id' => $lockedOrder->id,
                            'order_item_id' => $item->id,
                            'product_id' => $item->product_id,
                            'allocated_quantity' => $increase,
                            'reserved_quantity' => $increase,
                            'picked_quantity' => 0,
                            'dispatched_quantity' => 0,
                            'delivered_quantity' => 0,
                            'returned_quantity' => 0,
                            'status' => AllocationStatus::ALLOCATED,
                            'warehouse_code' => 'MAIN',
                            'notes' => "Quantity increase via applied adjustment {$lockedAdjustment->adjustment_number}",
                            'allocated_by' => $actor->id,
                            'allocated_at' => Carbon::now(),
                        ]);
                    }
                } else {
                    $reduction = (int) ($adjItem->requested_quantity_reduction > 0 ? $adjItem->requested_quantity_reduction : abs((int) $adjItem->requested_quantity_delta));
                    $currentUnallocated = $item->unallocatedQuantity();

                    // Case B Allocation Release
                    if ($reduction > $currentUnallocated) {
                        $unitsToRelease = $reduction - $currentUnallocated;

                        // Deterministic release order: ALLOCATED before RESERVED, then id DESC (LIFO)
                        $eligibleAllocations = OrderItemAllocation::where('order_item_id', $item->id)
                            ->whereIn('status', [AllocationStatus::ALLOCATED->value, AllocationStatus::RESERVED->value])
                            ->where('picked_quantity', 0)
                            ->where('dispatched_quantity', 0)
                            ->where('delivered_quantity', 0)
                            ->where('returned_quantity', 0)
                            ->orderByRaw("CASE WHEN status = 'ALLOCATED' THEN 1 ELSE 2 END")
                            ->orderBy('id', 'desc')
                            ->lockForUpdate()
                            ->get();

                        foreach ($eligibleAllocations as $alloc) {
                            if ($unitsToRelease <= 0) {
                                break;
                            }

                            $Q = (int) $alloc->allocated_quantity;
                            $R = (int) $alloc->reserved_quantity;

                            if ($unitsToRelease >= $Q) {
                                // Full release of allocation row
                                $alloc->status = AllocationStatus::RELEASED;
                                $alloc->reserved_quantity = 0;
                                $alloc->notes = trim(($alloc->notes ? $alloc->notes . ' | ' : '') . "Released via applied adjustment {$lockedAdjustment->adjustment_number}");
                                $alloc->save();

                                $releasedAllocationsLog[] = [
                                    'order_item_id' => $item->id,
                                    'allocation_id' => $alloc->id,
                                    'allocation_number' => $alloc->allocation_number,
                                    'released_quantity' => $Q,
                                    'type' => 'FULL_RELEASE',
                                ];

                                $unitsToRelease -= $Q;
                            } else {
                                // Partial release: split allocation into active remainder + released child row
                                $A = $unitsToRelease;
                                $releasedReserved = min($A, $R);
                                $remainingAllocated = $Q - $A;
                                $remainingReserved = $R - $releasedReserved;

                                // Update active remainder row
                                $alloc->allocated_quantity = $remainingAllocated;
                                $alloc->reserved_quantity = $remainingReserved;
                                $alloc->notes = trim(($alloc->notes ? $alloc->notes . ' | ' : '') . "Partially reduced by {$A} via applied adjustment {$lockedAdjustment->adjustment_number}");
                                $alloc->save();

                                // Generate next sequence under locked order item boundary
                                $orderNumClean = $lockedOrder->order_number ?: 'ORD-' . $lockedOrder->id;
                                $maxSeq = OrderItemAllocation::where('order_item_id', $item->id)
                                    ->pluck('allocation_number')
                                    ->map(function ($num) {
                                        if (preg_match('/-(\d+)$/', (string) $num, $matches)) {
                                            return (int) $matches[1];
                                        }
                                        return 0;
                                    })
                                    ->max() ?? 0;

                                $nextSeq = sprintf('%02d', $maxSeq + 1);
                                $splitAllocNumber = "ALC-{$orderNumClean}-{$item->id}-{$nextSeq}";

                                // Create released child row
                                $releasedChild = OrderItemAllocation::create([
                                    'allocation_number' => $splitAllocNumber,
                                    'order_id' => $lockedOrder->id,
                                    'order_item_id' => $item->id,
                                    'product_id' => $item->product_id,
                                    'allocated_quantity' => $A,
                                    'reserved_quantity' => 0,
                                    'picked_quantity' => 0,
                                    'dispatched_quantity' => 0,
                                    'delivered_quantity' => 0,
                                    'returned_quantity' => 0,
                                    'status' => AllocationStatus::RELEASED,
                                    'warehouse_code' => $alloc->warehouse_code ?: 'MAIN',
                                    'notes' => "Released {$A} units via applied adjustment {$lockedAdjustment->adjustment_number} (split from {$alloc->allocation_number})",
                                    'allocated_by' => $actor->id,
                                    'allocated_at' => Carbon::now(),
                                ]);

                                $releasedAllocationsLog[] = [
                                    'order_item_id' => $item->id,
                                    'allocation_id' => $releasedChild->id,
                                    'allocation_number' => $releasedChild->allocation_number,
                                    'released_quantity' => $A,
                                    'type' => 'PARTIAL_SPLIT_RELEASE',
                                ];

                                $unitsToRelease = 0;
                            }
                        }

                        if ($unitsToRelease > 0) {
                            throw new ConflictHttpException("Cannot apply adjustment: Incomplete allocation release for line item #{$item->id}.");
                        }
                    }

                    // Mutate order item quantity: non-destructive history
                    $item->cancelled_quantity += $reduction;
                    $totalUnitsCancelled += $reduction;
                    $item->save();
                }

                // Synchronize line item rollups authoritatively from child allocations
                $this->allocationService->syncOrderItemRollups($item);

                // Authoritatively recalculate line financials from remaining fulfillable quantity
                $newFulfillable = $item->fulfillableQuantity();
                if ($newFulfillable > 0) {
                    $lineTaxResult = $this->taxCalculationService->calculateLineTax(
                        $item->product,
                        $item->unit_price,
                        $newFulfillable
                    );

                    $item->taxable_amount = $lineTaxResult->taxableAmount;
                    $item->tax_amount = $lineTaxResult->taxAmount;
                    $item->line_total = $lineTaxResult->lineTotal;
                } else {
                    $item->taxable_amount = '0.00';
                    $item->tax_amount = '0.00';
                    $item->line_total = '0.00';
                }
                $item->save();

                // Validate item conservation and progression
                $this->allocationValidator->validateItemConservation($item);
            }

            // 10. AUTHORITATIVE ORDER TOTALS RECALCULATION
            $allOrderItems = OrderItem::where('order_id', $lockedOrder->id)->get();
            $orderSubtotal = '0.00';
            $orderTaxTotal = '0.00';
            $orderGrandTotal = '0.00';

            foreach ($allOrderItems as $itm) {
                $orderSubtotal = bcadd($orderSubtotal, (string) $itm->taxable_amount, 2);
                $orderTaxTotal = bcadd($orderTaxTotal, (string) $itm->tax_amount, 2);
                $orderGrandTotal = bcadd($orderGrandTotal, (string) $itm->line_total, 2);
            }

            $oldSubtotal = (string) $lockedOrder->subtotal;
            $oldTaxTotal = (string) $lockedOrder->tax_total;
            $oldGrandTotal = (string) $lockedOrder->grand_total;
            $oldAdjustmentTotal = (string) $lockedOrder->adjustment_total;

            $lockedOrder->subtotal = $orderSubtotal;
            $lockedOrder->tax_total = $orderTaxTotal;
            $lockedOrder->grand_total = $orderGrandTotal;

            // Cumulative adjustment total tracking: net reduction convention
            $addition = (string) ($lockedAdjustment->projected_grand_total_addition ?? '0.00');
            $reduction = (string) ($lockedAdjustment->projected_grand_total_reduction ?? '0.00');
            $netReduction = bcsub($reduction, $addition, 2);
            $lockedOrder->adjustment_total = bcadd($oldAdjustmentTotal, $netReduction, 2);

            // 11. UPDATE ORDER STATE & VERSION
            $lockedOrder->adjustment_status = AdjustmentStatus::APPLIED;
            $lockedOrder->version = (int) $lockedOrder->version + 1;
            $lockedOrder->save();

            // 12. UPDATE ADJUSTMENT STATE
            $lockedAdjustment->status = OrderAdjustmentStatus::APPLIED;
            $lockedAdjustment->applied_at = Carbon::now();
            $lockedAdjustment->save();

            // 13. Authoritatively evaluate whether order is now fully completed
            $this->orderWorkflowService->evaluateAndCompleteOrder($lockedOrder, $actor);

            $financialDeltaLog = [
                'old_subtotal' => $oldSubtotal,
                'new_subtotal' => $orderSubtotal,
                'old_tax_total' => $oldTaxTotal,
                'new_tax_total' => $orderTaxTotal,
                'old_grand_total' => $oldGrandTotal,
                'new_grand_total' => $orderGrandTotal,
                'old_adjustment_total' => $oldAdjustmentTotal,
                'new_adjustment_total' => (string) $lockedOrder->adjustment_total,
            ];

            return $lockedAdjustment->load(['order', 'items', 'reviewer', 'requester']);
        }, 3);

        // 13. POST-COMMIT OBSERVABILITY LOGGING
        Log::info('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_APPLIED',
            'adjustment_id' => $appliedAdjustment->id,
            'adjustment_number' => $appliedAdjustment->adjustment_number,
            'order_id' => $appliedAdjustment->order_id,
            'order_number' => $appliedAdjustment->order_number_snapshot,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role->value,
            'total_units_cancelled' => $totalUnitsCancelled,
            'financial_deltas' => $financialDeltaLog,
            'released_allocations' => $releasedAllocationsLog,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        if (! empty($releasedAllocationsLog)) {
            Log::info('commerce.order_adjustment_event', [
                'action' => 'ALLOCATION_RELEASED',
                'order_id' => $appliedAdjustment->order_id,
                'adjustment_id' => $appliedAdjustment->id,
                'released_allocations' => $releasedAllocationsLog,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);
        }

        Log::info('commerce.order_adjustment_event', [
            'action' => 'ORDER_FINANCIALS_RECALCULATED',
            'order_id' => $appliedAdjustment->order_id,
            'adjustment_id' => $appliedAdjustment->id,
            'financials' => $financialDeltaLog,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        return $appliedAdjustment;
    }

    /**
     * Helper to log blocked application attempts for audit/observability.
     */
    protected function logApplicationBlocked(
        OrderAdjustment $adjustment,
        Order $order,
        User $actor,
        string $reason,
        ?string $clientIp
    ): void {
        Log::warning('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_APPLICATION_BLOCKED',
            'adjustment_id' => $adjustment->id,
            'adjustment_number' => $adjustment->adjustment_number,
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role->value,
            'reason' => $reason,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * Authoritatively reverse an applied order adjustment request.
     * Executes within DB::transaction(..., 3) with deterministic lock ordering:
     * 1. orders (Root lock)
     * 2. order_items ASC
     * 3. order_item_allocations ASC
     * 4. order_adjustments row
     *
     * Invariants:
     * - Only APPLIED -> REVERSED transition allowed.
     * - Live revalidation of order lifecycle, fulfillable quantities, and LIFO sequential constraints.
     * - Case A: decrements cancelled_quantity, increases unallocated headroom, recalculates financials.
     * - Case B: creates new forward restoration allocation row under locked OrderItem boundary,
     *   preserves historical RELEASED rows intact, resyncs rollups, decrements cancelled_quantity, recalculates financials.
     * - Recalculates order subtotal, tax_total, grand_total, and decrements adjustment_total.
     * - Increments orders.version exactly once.
     * - Sets orders.adjustment_status = REVERSED (or APPLIED if earlier adjustment remains applied).
     * - All-or-nothing atomicity: any line failure aborts the entire transaction.
     * - Emits structured observability events post-commit.
     *
     * @param  array<string, mixed>  $options
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     * @throws NotFoundHttpException
     */
    public function reverseAdjustment(
        User $actor,
        Order $order,
        OrderAdjustment $adjustment,
        string $reason,
        array $options = [],
        ?string $clientIp = null
    ): OrderAdjustment {
        // 1. Pre-transaction authorization checks
        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_REVERSE);

        // Pre-transaction IDOR guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
        }

        $validatedReason = trim($reason);
        if (mb_strlen($validatedReason) < 10 || mb_strlen($validatedReason) > 1000) {
            throw ValidationException::withMessages([
                'reason' => 'Reversal reason must be between 10 and 1000 characters.',
            ]);
        }

        $isEmergencyOverride = false;
        $overrideReason = null;
        $restoredAllocationsLog = [];
        $totalUnitsRestored = 0;
        $financialDeltaLog = [];

        /** @var OrderAdjustment $reversedAdjustment */
        $reversedAdjustment = DB::transaction(function () use (
            $actor,
            $order,
            $adjustment,
            $validatedReason,
            $options,
            $clientIp,
            &$isEmergencyOverride,
            &$overrideReason,
            &$restoredAllocationsLog,
            &$totalUnitsRestored,
            &$financialDeltaLog
        ) {
            // 1. Lock orders (Root lock)
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            // 2. Lock order_items in deterministic ASC order
            $lockedItems = OrderItem::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->with('product')
                ->get();
            $lockedItemsById = $lockedItems->keyBy('id');

            // 3. Lock order_item_allocations in deterministic ASC order
            OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            // 4. Lock order_adjustments row
            /** @var OrderAdjustment $lockedAdjustment */
            $lockedAdjustment = OrderAdjustment::where('id', $adjustment->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Re-verify IDOR under lock
            if ((int) $lockedAdjustment->order_id !== (int) $lockedOrder->id) {
                throw new NotFoundHttpException('Adjustment request does not belong to the specified order.');
            }

            // 5. Maker-Checker Segregation of Duties
            $isSelfDecision = ((int) $lockedAdjustment->requested_by === (int) $actor->id);
            if ($isSelfDecision) {
                if ($actor->role !== UserRole::SUPER_ADMIN) {
                    throw new AuthorizationException(
                        'Segregation of duties violation: You cannot reverse an adjustment request that you personally submitted.'
                    );
                }

                $rawOverride = $options['emergency_override_reason'] ?? null;
                $overrideReason = is_string($rawOverride) ? trim($rawOverride) : '';

                if (mb_strlen($overrideReason) < 10 || mb_strlen($overrideReason) > 1000) {
                    throw ValidationException::withMessages([
                        'emergency_override_reason' => 'Super Admin self-reversal requires an emergency override reason between 10 and 1000 characters.',
                    ]);
                }

                $isEmergencyOverride = true;
            }

            // 6. State Machine Guard: Only APPLIED -> REVERSED is valid.
            if ($lockedAdjustment->status === OrderAdjustmentStatus::REVERSED) {
                throw new ConflictHttpException(
                    "Adjustment {$lockedAdjustment->adjustment_number} has already been reversed."
                );
            }

            if ($lockedAdjustment->status !== OrderAdjustmentStatus::APPLIED) {
                throw new ConflictHttpException(
                    "Cannot reverse adjustment {$lockedAdjustment->adjustment_number}: status is '{$lockedAdjustment->status->label()}', expected 'Applied'."
                );
            }

            // 7. Sequential Adjustments / Strict LIFO Guard
            // Target adjustment must be the latest still-active applied adjustment for this order.
            $hasSubsequentApplied = OrderAdjustment::where('order_id', $lockedOrder->id)
                ->where('id', '!=', $lockedAdjustment->id)
                ->where('status', OrderAdjustmentStatus::APPLIED)
                ->where(function ($q) use ($lockedAdjustment) {
                    $q->where('applied_at', '>', $lockedAdjustment->applied_at)
                        ->orWhere(function ($tieQ) use ($lockedAdjustment) {
                            $tieQ->where('applied_at', '=', $lockedAdjustment->applied_at)
                                ->where('id', '>', $lockedAdjustment->id);
                        });
                })
                ->exists();

            if ($hasSubsequentApplied) {
                $blockReason = "Cannot reverse adjustment {$lockedAdjustment->adjustment_number}: A subsequent adjustment has been applied to this order. Adjustments must be reversed in reverse chronological (LIFO) order.";
                $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException($blockReason);
            }

            // 8. Order Lifecycle Check
            $eligibleStatuses = [
                OrderStatus::APPROVED,
                OrderStatus::PROCESSING,
            ];
            if (! in_array($lockedOrder->status, $eligibleStatuses, true)) {
                $blockReason = "Order {$lockedOrder->order_number} has transitioned to '{$lockedOrder->status->label()}', which does not permit adjustment reversals.";
                $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot reverse adjustment: {$blockReason}");
            }

            // 9. Fulfillment Progression Guard
            $ineligibleFulfillment = [
                \App\Enums\FulfillmentStatus::PACKED,
                \App\Enums\FulfillmentStatus::DISPATCHED,
                \App\Enums\FulfillmentStatus::DELIVERED,
                \App\Enums\FulfillmentStatus::PARTIALLY_DELIVERED,
            ];
            if ($lockedOrder->fulfillment_status && in_array($lockedOrder->fulfillment_status, $ineligibleFulfillment, true)) {
                $blockReason = "Order {$lockedOrder->order_number} has advanced to fulfillment stage '{$lockedOrder->fulfillment_status->label()}', which prevents commercial item restoration.";
                $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                throw new ConflictHttpException("Cannot reverse adjustment: {$blockReason}");
            }

            // 10. Load adjustment line items
            $adjItems = $lockedAdjustment->items()->orderBy('id', 'asc')->get();
            if ($adjItems->isEmpty()) {
                throw ValidationException::withMessages([
                    'adjustment' => 'Adjustment must contain at least one line item to reverse.',
                ]);
            }

            // 11. AUTHORITATIVE PRE-VALIDATION: Validate ALL lines before mutating ANY record (All-or-Nothing)
            foreach ($adjItems as $adjItem) {
                /** @var OrderItem|null $item */
                $item = $lockedItemsById->get($adjItem->order_item_id);
                if (! $item) {
                    $blockReason = "Order item #{$adjItem->order_item_id} does not exist on order {$lockedOrder->order_number}.";
                    $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                    throw new ConflictHttpException("Cannot reverse adjustment: {$blockReason}");
                }

                $actionType = $adjItem->action_type ?? 'DECREASE';
                $isIncrease = ($actionType === 'INCREASE') || ((int) ($adjItem->requested_quantity_increase ?? 0) > 0);

                if ($isIncrease) {
                    $increase = (int) ($adjItem->requested_quantity_increase > 0 ? $adjItem->requested_quantity_increase : $adjItem->requested_quantity_delta);
                    if ($increase <= 0) {
                        throw ValidationException::withMessages([
                            'requested_quantity_increase' => "Requested quantity increase must be positive for line item #{$item->id}.",
                        ]);
                    }

                    if (($item->increased_quantity ?? 0) < $increase) {
                        $blockReason = "Line item #{$item->id} increased quantity ({$item->increased_quantity}) is less than the adjustment increase ({$increase}).";
                        $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                        throw new ConflictHttpException("Cannot reverse adjustment: {$blockReason}");
                    }

                    // Check if unpicked capacity allows removing this increase
                    $unpickedAllocated = (int) OrderItemAllocation::where('order_item_id', $item->id)
                        ->whereIn('status', [AllocationStatus::ALLOCATED->value, AllocationStatus::RESERVED->value])
                        ->where('picked_quantity', 0)
                        ->where('dispatched_quantity', 0)
                        ->where('delivered_quantity', 0)
                        ->where('returned_quantity', 0)
                        ->sum('allocated_quantity');

                    $currentUnallocated = $item->unallocatedQuantity();
                    if (($currentUnallocated + $unpickedAllocated) < $increase) {
                        $blockReason = "Cannot reverse quantity increase of {$increase} units for line item #{$item->id} because units have already been picked/dispatched.";
                        $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                        throw new ConflictHttpException("Cannot reverse adjustment: {$blockReason}");
                    }
                } else {
                    $reduction = (int) ($adjItem->requested_quantity_reduction > 0 ? $adjItem->requested_quantity_reduction : abs((int) $adjItem->requested_quantity_delta));
                    if ($reduction <= 0) {
                        throw ValidationException::withMessages([
                            'requested_quantity_reduction' => "Requested quantity reduction must be positive for line item #{$item->id}.",
                        ]);
                    }

                    // Conservation check: cannot restore more cancelled units than currently recorded as cancelled
                    if ($item->cancelled_quantity < $reduction) {
                        $blockReason = "Line item #{$item->id} cancelled quantity ({$item->cancelled_quantity}) is less than the adjustment reduction ({$reduction}).";
                        $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                        throw new ConflictHttpException("Cannot reverse adjustment: {$blockReason}");
                    }

                    // Case B check: if affected_allocation_quantity > 0, verify unallocated headroom
                    $affectedAllocation = (int) $adjItem->affected_allocation_quantity;
                    if ($affectedAllocation > 0) {
                        $newFulfillable = $item->fulfillableQuantity() + $reduction;
                        $currentAllocated = $item->allocatedQuantity();
                        if (($currentAllocated + $affectedAllocation) > $newFulfillable) {
                            $blockReason = "Restoring {$affectedAllocation} allocated units for line item #{$item->id} would exceed the restored fulfillable quantity ({$newFulfillable}).";
                            $this->logReversalBlocked($lockedAdjustment, $lockedOrder, $actor, $blockReason, $clientIp);
                            throw new ConflictHttpException("Cannot reverse adjustment: {$blockReason}");
                        }
                    }
                }
            }

            // 12. EXECUTE ATOMIC MUTATIONS FOR EACH LINE
            foreach ($adjItems as $adjItem) {
                /** @var OrderItem $item */
                $item = $lockedItemsById->get($adjItem->order_item_id);
                $actionType = $adjItem->action_type ?? 'DECREASE';
                $isIncrease = ($actionType === 'INCREASE') || ((int) ($adjItem->requested_quantity_increase ?? 0) > 0);

                if ($isIncrease) {
                    $increase = (int) ($adjItem->requested_quantity_increase > 0 ? $adjItem->requested_quantity_increase : $adjItem->requested_quantity_delta);

                    // 1. Decrement increased_quantity
                    $item->increased_quantity = max(0, ($item->increased_quantity ?? 0) - $increase);
                    $item->save();

                    // 2. Release physical stock on inventory balance
                    $balance = InventoryBalance::where('product_id', $item->product_id)->lockForUpdate()->first();
                    if ($balance) {
                        $onHandBefore = (int) $balance->on_hand_quantity;
                        $reservedBefore = (int) $balance->reserved_quantity;
                        $availableBefore = (int) $balance->available_quantity;
                        $damagedBefore = (int) $balance->damaged_quantity;

                        $balance->reserved_quantity = max(0, $balance->reserved_quantity - $increase);
                        $balance->available_quantity = $balance->calculateAvailableQuantity();
                        $balance->version += 1;
                        $balance->save();

                        $this->movementService->recordMovement([
                            'warehouse_id' => $balance->warehouse_id,
                            'product_id' => $item->product_id,
                            'inventory_balance_id' => $balance->id,
                            'movement_type' => InventoryMovementType::RELEASE,
                            'from_state' => InventoryStockState::RESERVED,
                            'to_state' => InventoryStockState::AVAILABLE,
                            'quantity' => $increase,
                            'on_hand_before' => $onHandBefore,
                            'on_hand_after' => (int) $balance->on_hand_quantity,
                            'reserved_before' => $reservedBefore,
                            'reserved_after' => (int) $balance->reserved_quantity,
                            'available_before' => $availableBefore,
                            'available_after' => (int) $balance->available_quantity,
                            'damaged_before' => $damagedBefore,
                            'damaged_after' => (int) $balance->damaged_quantity,
                            'reference_type' => 'App\\Models\\OrderAdjustment',
                            'reference_id' => $lockedAdjustment->id,
                            'reference_number' => $lockedAdjustment->adjustment_number,
                            'notes' => "Stock released via reversed adjustment {$lockedAdjustment->adjustment_number} (-{$increase} units)",
                            'actor_id' => $actor->id,
                        ]);
                    }

                    // 3. Release any allocation created for this increase
                    $createdAllocations = OrderItemAllocation::where('order_item_id', $item->id)
                        ->where('notes', 'like', "%{$lockedAdjustment->adjustment_number}%")
                        ->whereIn('status', [AllocationStatus::ALLOCATED->value, AllocationStatus::RESERVED->value])
                        ->get();

                    foreach ($createdAllocations as $cAlloc) {
                        $cAlloc->status = AllocationStatus::RELEASED;
                        $cAlloc->reserved_quantity = 0;
                        $cAlloc->notes = trim(($cAlloc->notes ? $cAlloc->notes . ' | ' : '') . "Released via reversed adjustment {$lockedAdjustment->adjustment_number}");
                        $cAlloc->save();
                    }
                } else {
                    $reduction = (int) ($adjItem->requested_quantity_reduction > 0 ? $adjItem->requested_quantity_reduction : abs((int) $adjItem->requested_quantity_delta));
                    $affectedAllocation = (int) $adjItem->affected_allocation_quantity;

                    // 1. Decrement cancelled_quantity (authoritatively restores fulfillable quantity)
                    $item->cancelled_quantity -= $reduction;
                    $totalUnitsRestored += $reduction;
                    $item->save();

                    // 2. Case B: Create forward restoration allocation record
                    if ($affectedAllocation > 0) {
                        // Derive authoritative warehouse_code from historical released row for this adjustment
                        $releasedAlloc = OrderItemAllocation::where('order_item_id', $item->id)
                            ->where('status', AllocationStatus::RELEASED)
                            ->where('notes', 'like', "%{$lockedAdjustment->adjustment_number}%")
                            ->orderBy('id', 'desc')
                            ->first();

                        $warehouseCode = $releasedAlloc?->warehouse_code ?: 'MAIN';

                        // Generate next deterministic sequence under locked OrderItem boundary
                        $orderNumClean = $lockedOrder->order_number ?: 'ORD-' . $lockedOrder->id;
                        $maxSeq = OrderItemAllocation::where('order_item_id', $item->id)
                            ->pluck('allocation_number')
                            ->map(function ($num) {
                                if (preg_match('/-(\d+)$/', (string) $num, $matches)) {
                                    return (int) $matches[1];
                                }
                                return 0;
                            })
                            ->max() ?? 0;

                        $nextSeq = sprintf('%02d', $maxSeq + 1);
                        $restorationAllocNumber = "ALC-{$orderNumClean}-{$item->id}-{$nextSeq}";

                        // Forward restoration allocation:
                        // Invariant: 0 <= reserved_quantity <= allocated_quantity.
                        // Setting reserved_quantity = 0 prevents fabricating unverified reservation capacity.
                        $restorationAlloc = OrderItemAllocation::create([
                            'allocation_number' => $restorationAllocNumber,
                            'order_id' => $lockedOrder->id,
                            'order_item_id' => $item->id,
                            'product_id' => $item->product_id,
                            'allocated_quantity' => $affectedAllocation,
                            'reserved_quantity' => 0,
                            'picked_quantity' => 0,
                            'dispatched_quantity' => 0,
                            'delivered_quantity' => 0,
                            'returned_quantity' => 0,
                            'status' => AllocationStatus::ALLOCATED,
                            'warehouse_code' => $warehouseCode,
                            'notes' => "Restoration allocation of {$affectedAllocation} units via reversed adjustment {$lockedAdjustment->adjustment_number}",
                            'allocated_by' => $actor->id,
                            'allocated_at' => Carbon::now(),
                        ]);

                        $restoredAllocationsLog[] = [
                            'order_item_id' => $item->id,
                            'allocation_id' => $restorationAlloc->id,
                            'allocation_number' => $restorationAlloc->allocation_number,
                            'restored_quantity' => $affectedAllocation,
                            'warehouse_code' => $warehouseCode,
                        ];
                    }
                }

                // 3. Synchronize line item rollups authoritatively from active allocations
                $this->allocationService->syncOrderItemRollups($item);

                // 4. Authoritatively recalculate line financials from restored fulfillable quantity
                $newFulfillable = $item->fulfillableQuantity();
                if ($newFulfillable > 0) {
                    $lineTaxResult = $this->taxCalculationService->calculateLineTax(
                        $item->product,
                        $item->unit_price,
                        $newFulfillable
                    );

                    $item->taxable_amount = $lineTaxResult->taxableAmount;
                    $item->tax_amount = $lineTaxResult->taxAmount;
                    $item->line_total = $lineTaxResult->lineTotal;
                } else {
                    $item->taxable_amount = '0.00';
                    $item->tax_amount = '0.00';
                    $item->line_total = '0.00';
                }
                $item->save();

                // 5. Validate line conservation and progression constraints
                $this->allocationValidator->validateItemConservation($item);
            }

            // 13. AUTHORITATIVE ORDER TOTALS RECALCULATION
            $allOrderItems = OrderItem::where('order_id', $lockedOrder->id)->get();
            $orderSubtotal = '0.00';
            $orderTaxTotal = '0.00';
            $orderGrandTotal = '0.00';

            foreach ($allOrderItems as $itm) {
                $orderSubtotal = bcadd($orderSubtotal, (string) $itm->taxable_amount, 2);
                $orderTaxTotal = bcadd($orderTaxTotal, (string) $itm->tax_amount, 2);
                $orderGrandTotal = bcadd($orderGrandTotal, (string) $itm->line_total, 2);
            }

            $oldSubtotal = (string) $lockedOrder->subtotal;
            $oldTaxTotal = (string) $lockedOrder->tax_total;
            $oldGrandTotal = (string) $lockedOrder->grand_total;
            $oldAdjustmentTotal = (string) $lockedOrder->adjustment_total;

            $lockedOrder->subtotal = $orderSubtotal;
            $lockedOrder->tax_total = $orderTaxTotal;
            $lockedOrder->grand_total = $orderGrandTotal;

            // Cumulative adjustment total tracking: subtract net reduction of this adjustment
            $addition = (string) ($lockedAdjustment->projected_grand_total_addition ?? '0.00');
            $reduction = (string) ($lockedAdjustment->projected_grand_total_reduction ?? '0.00');
            $netReduction = bcsub($reduction, $addition, 2);
            $newAdjustmentTotal = bcsub($oldAdjustmentTotal, $netReduction, 2);
            if (bccomp($newAdjustmentTotal, '0.00', 2) < 0) {
                $newAdjustmentTotal = '0.00';
            }
            $lockedOrder->adjustment_total = $newAdjustmentTotal;

            // 14. UPDATE ORDER STATE & VERSION
            $hasPriorApplied = OrderAdjustment::where('order_id', $lockedOrder->id)
                ->where('id', '!=', $lockedAdjustment->id)
                ->where('status', OrderAdjustmentStatus::APPLIED)
                ->exists();

            $lockedOrder->adjustment_status = $hasPriorApplied ? AdjustmentStatus::APPLIED : AdjustmentStatus::REVERSED;
            $lockedOrder->version = (int) $lockedOrder->version + 1;
            $lockedOrder->save();

            // 15. UPDATE ADJUSTMENT STATE
            $lockedAdjustment->status = OrderAdjustmentStatus::REVERSED;
            $lockedAdjustment->reversed_at = Carbon::now();
            $lockedAdjustment->reversed_by = $actor->id;
            $lockedAdjustment->reversal_reason = $validatedReason;
            $lockedAdjustment->save();

            $financialDeltaLog = [
                'old_subtotal' => $oldSubtotal,
                'new_subtotal' => $orderSubtotal,
                'old_tax_total' => $oldTaxTotal,
                'new_tax_total' => $orderTaxTotal,
                'old_grand_total' => $oldGrandTotal,
                'new_grand_total' => $orderGrandTotal,
                'old_adjustment_total' => $oldAdjustmentTotal,
                'new_adjustment_total' => (string) $lockedOrder->adjustment_total,
            ];

            return $lockedAdjustment->load(['order', 'items', 'reviewer', 'requester', 'reverser']);
        }, 3);

        // 16. POST-COMMIT OBSERVABILITY LOGGING
        Log::info('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_REVERSED',
            'adjustment_id' => $reversedAdjustment->id,
            'adjustment_number' => $reversedAdjustment->adjustment_number,
            'order_id' => $reversedAdjustment->order_id,
            'order_number' => $reversedAdjustment->order_number_snapshot,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role->value,
            'reversal_reason' => $validatedReason,
            'is_emergency_override' => $isEmergencyOverride,
            'override_reason' => $overrideReason,
            'total_units_restored' => $totalUnitsRestored,
            'financial_deltas' => $financialDeltaLog,
            'restored_allocations' => $restoredAllocationsLog,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        if (! empty($restoredAllocationsLog)) {
            Log::info('commerce.order_adjustment_event', [
                'action' => 'ALLOCATION_RESTORED',
                'order_id' => $reversedAdjustment->order_id,
                'adjustment_id' => $reversedAdjustment->id,
                'restored_allocations' => $restoredAllocationsLog,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);
        }

        Log::info('commerce.order_adjustment_event', [
            'action' => 'ORDER_FINANCIALS_RECALCULATED',
            'order_id' => $reversedAdjustment->order_id,
            'adjustment_id' => $reversedAdjustment->id,
            'financials' => $financialDeltaLog,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);

        if ($isEmergencyOverride) {
            Log::info('commerce.order_adjustment_event', [
                'action' => 'ADJUSTMENT_EMERGENCY_OVERRIDE',
                'adjustment_id' => $reversedAdjustment->id,
                'adjustment_number' => $reversedAdjustment->adjustment_number,
                'order_id' => $reversedAdjustment->order_id,
                'order_number' => $reversedAdjustment->order_number_snapshot,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'actor_role' => $actor->role->value,
                'override_reason' => $overrideReason,
                'decision' => 'REVERSED',
                'ip_address' => $clientIp,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);
        }

        return $reversedAdjustment;
    }

    /**
     * Helper to log blocked reversal attempts for audit/observability.
     */
    protected function logReversalBlocked(
        OrderAdjustment $adjustment,
        Order $order,
        User $actor,
        string $reason,
        ?string $clientIp
    ): void {
        Log::warning('commerce.order_adjustment_event', [
            'action' => 'ADJUSTMENT_REVERSAL_BLOCKED',
            'adjustment_id' => $adjustment->id,
            'adjustment_number' => $adjustment->adjustment_number,
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role->value,
            'reason' => $reason,
            'ip_address' => $clientIp,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);
    }
}


