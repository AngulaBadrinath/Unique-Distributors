<?php

namespace App\Http\Controllers\Admin;

use App\DTOs\Adjustment\OrderAdjustmentReviewDTO;
use App\Enums\AdjustmentReasonCode;
use App\Enums\OrderAdjustmentStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Adjustment\AdminAdjustmentQueueRequest;
use App\Http\Requests\Adjustment\ApproveOrderAdjustmentRequest;
use App\Http\Requests\Adjustment\RejectOrderAdjustmentRequest;
use App\Http\Requests\Adjustment\ReverseOrderAdjustmentRequest;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\OrderAdjustmentItem;
use App\Services\Adjustment\OrderAdjustmentReviewService;
use App\Services\Adjustment\OrderAdjustmentWorkflowService;
use App\Services\Auth\PermissionService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AdminOrderAdjustmentController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService,
        protected OrderAdjustmentReviewService $reviewService,
        protected OrderAdjustmentWorkflowService $workflowService,
    ) {}

    /**
     * Display the administrative adjustment queue.
     */
    public function index(AdminAdjustmentQueueRequest $request): Response
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_REVIEW);

        if ($actor->role === UserRole::SALESMAN) {
            throw new AuthorizationException('Salesmen are not authorized to access the administrative adjustment workspace.');
        }

        // 1. Single SQL Aggregation Query for queue badge counts
        $counts = \App\Services\Adjustment\OrderAdjustmentClassifier::getBadgeCounts();

        // 2. Resolve Active Queue (with legacy status fallback support)
        $activeQueue = $request->validated('queue');
        if (! $activeQueue) {
            $legacyStatus = $request->validated('status');
            $activeQueue = match ($legacyStatus) {
                'APPROVED' => 'ready_to_apply',
                'APPLIED' => 'applied',
                'REVERSED' => 'reversed',
                'REJECTED', 'CANCELLED' => 'closed',
                'ALL' => 'all',
                default => 'pending',
            };
        }

        // 3. Base Query with bounded, selective eager loading (prevents N+1)
        $query = OrderAdjustment::query()
            ->select([
                'order_adjustments.id',
                'order_adjustments.adjustment_number',
                'order_adjustments.order_id',
                'order_adjustments.order_number_snapshot',
                'order_adjustments.order_version_snapshot',
                'order_adjustments.order_status_snapshot',
                'order_adjustments.status',
                'order_adjustments.reason_code',
                'order_adjustments.notes',
                'order_adjustments.requested_by',
                'order_adjustments.requested_at',
                'order_adjustments.projected_subtotal_reduction',
                'order_adjustments.projected_tax_reduction',
                'order_adjustments.projected_grand_total_reduction',
                'order_adjustments.created_at',
            ])
            ->with([
                'order:id,order_number,customer_id,salesman_id,status,adjustment_status,version',
                'order.customer:id,code,name',
                'order.salesman:id,name',
                'requester:id,name,email,role',
                'items:id,adjustment_id,order_item_id,requested_quantity_reduction,affected_allocation_quantity',
                'items.orderItem:id,ordered_quantity,cancelled_quantity',
                'items.orderItem.allocations:id,order_item_id,status,allocated_quantity,picked_quantity',
            ]);

        // 4. Apply Canonical Queue Scope
        \App\Services\Adjustment\OrderAdjustmentClassifier::applyQueueScope($query, $activeQueue);

        // 5. Apply Exception Type Filter
        if ($exceptionType = $request->validated('exception_type')) {
            if ($exceptionType !== 'ALL') {
                \App\Services\Adjustment\OrderAdjustmentClassifier::applyExceptionTypeScope($query, $exceptionType);
            }
        }

        // 6. Secondary Filters
        if ($reasonFilter = $request->validated('reason_code')) {
            $query->where('order_adjustments.reason_code', $reasonFilter);
        }

        if ($impactCase = $request->validated('impact_case')) {
            if ($impactCase === 'CASE_A') {
                $query->whereDoesntHave('items', fn (Builder $q) => $q->where('affected_allocation_quantity', '>', 0));
            } elseif ($impactCase === 'CASE_B') {
                $query->whereHas('items', fn (Builder $q) => $q->where('affected_allocation_quantity', '>', 0));
            }
        }

        if ($dateFrom = $request->validated('date_from')) {
            $query->where('order_adjustments.requested_at', '>=', \Carbon\Carbon::parse($dateFrom)->startOfDay());
        }

        if ($dateTo = $request->validated('date_to')) {
            $query->where('order_adjustments.requested_at', '<=', \Carbon\Carbon::parse($dateTo)->endOfDay());
        }

        // 7. Multi-Column Search
        if ($search = $request->validated('search')) {
            $isPgsql = $query->getConnection()->getDriverName() === 'pgsql';
            $like = $isPgsql ? 'ilike' : 'like';

            $query->where(function (Builder $q) use ($search, $like) {
                $q->where('order_adjustments.adjustment_number', $like, "%{$search}%")
                    ->orWhere('order_adjustments.order_number_snapshot', $like, "%{$search}%")
                    ->orWhereHas('order', function (Builder $oq) use ($search, $like) {
                        $oq->where('orders.order_number', $like, "%{$search}%")
                            ->orWhereHas('customer', function (Builder $cq) use ($search, $like) {
                                $cq->where('name', $like, "%{$search}%")
                                    ->orWhere('code', $like, "%{$search}%");
                            });
                    })
                    ->orWhereHas('requester', function (Builder $rq) use ($search, $like) {
                        $rq->where('name', $like, "%{$search}%")
                            ->orWhere('email', $like, "%{$search}%");
                    });
            });
        }

        // 8. Allow-listed Sorting with Deterministic Secondary Tie-Breaker
        $sortBy = $request->validated('sort_by') ?: 'requested_at';
        $sortDirection = $request->validated('sort_direction') ?: 'desc';

        if ($sortBy === 'age') {
            $dir = $sortDirection === 'asc' ? 'desc' : 'asc';
            $query->orderBy('order_adjustments.requested_at', $dir);
        } elseif (in_array($sortBy, ['requested_at', 'adjustment_number', 'projected_grand_total_reduction'], true)) {
            $query->orderBy("order_adjustments.{$sortBy}", $sortDirection);
        } else {
            $query->orderBy('order_adjustments.requested_at', 'desc');
        }

        // Deterministic secondary tie-breaker
        $query->orderBy('order_adjustments.id', 'desc');

        // 9. Pagination
        $perPage = (int) ($request->validated('per_page') ?: 15);
        $paginator = $query->paginate($perPage)->withQueryString();

        // 10. Transform items with in-memory domain classification & action capabilities
        $transformedItems = $paginator->getCollection()->map(function (OrderAdjustment $adj) use ($actor) {
            $classification = \App\Services\Adjustment\OrderAdjustmentClassifier::classify($adj, $adj->order);
            $totalAffected = (int) $adj->items->sum('affected_allocation_quantity');
            $impactCase = $totalAffected > 0 ? 'CASE_B' : 'CASE_A';

            return [
                'id' => $adj->id,
                'adjustment_number' => $adj->adjustment_number,
                'order_id' => $adj->order_id,
                'order_number' => $adj->order->order_number ?? $adj->order_number_snapshot,
                'order_status' => $adj->order->status->value ?? $adj->order_status_snapshot,
                'order_status_label' => $adj->order->status->label() ?? (string) $adj->order_status_snapshot,
                'customer_name' => $adj->order->customer->name ?? '—',
                'customer_code' => $adj->order->customer->code ?? '—',
                'requester_name' => $adj->requester?->name ?? 'System',
                'requester_email' => $adj->requester?->email ?? '',
                'requester_role' => $adj->requester?->role instanceof UserRole ? $adj->requester->role->value : ($adj->requester?->role ?? ''),
                'reason_code' => $adj->reason_code instanceof AdjustmentReasonCode ? $adj->reason_code->value : (string) $adj->reason_code,
                'reason_label' => $adj->reason_code instanceof AdjustmentReasonCode ? $adj->reason_code->label() : (string) $adj->reason_code,
                'status' => $adj->status instanceof OrderAdjustmentStatus ? $adj->status->value : (string) $adj->status,
                'status_label' => $adj->status instanceof OrderAdjustmentStatus ? $adj->status->label() : (string) $adj->status,
                'badge_variant' => $adj->status instanceof OrderAdjustmentStatus ? $adj->status->badgeVariant() : 'secondary',
                'impact_case' => $impactCase,
                'affected_allocation_quantity' => $totalAffected,
                'items_count' => $adj->items->count(),
                'projected_grand_total_reduction' => (string) $adj->projected_grand_total_reduction,
                'requested_at' => $adj->requested_at?->toIso8601String(),
                'requested_at_formatted' => $adj->requested_at?->format('M d, Y H:i'),
                'age_hours' => $classification['age_hours'],
                'age_relative' => $classification['age_relative'],
                'is_aging' => $classification['is_aging'],
                'attention_flags' => $classification['attention_flags'],
                'needs_attention' => $classification['needs_attention'],
                'primary_exception' => $classification['primary_exception'],
                'has_blocker' => $classification['has_blocker'],
                'is_ready_to_apply' => $classification['is_ready_to_apply'],
                'is_terminal' => $adj->isTerminal(),
                'can' => [
                    'review' => true,
                    'approve' => $actor->can('approve', [$adj, $adj->order]),
                    'apply' => $actor->can('apply', [$adj, $adj->order]),
                    'reverse' => $actor->can('reverse', [$adj, $adj->order]),
                ],
            ];
        });

        $paginatedAdjustments = [
            'data' => $transformedItems->all(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
            'links' => $paginator->linkCollection()->toArray(),
        ];

        return Inertia::render('Admin/Adjustments/Index', [
            'adjustments' => $paginatedAdjustments,
            'counts' => $counts,
            'filters' => [
                'queue' => $activeQueue,
                'exception_type' => $request->validated('exception_type') ?: 'ALL',
                'status' => $request->validated('status') ?: '',
                'impact_case' => $request->validated('impact_case') ?: 'ALL',
                'reason_code' => $request->validated('reason_code') ?: '',
                'date_from' => $request->validated('date_from') ?: '',
                'date_to' => $request->validated('date_to') ?: '',
                'search' => $request->validated('search') ?: '',
                'sort_by' => $sortBy,
                'sort_direction' => $sortDirection,
                'per_page' => $perPage,
            ],
            'reasonCodes' => array_map(fn (AdjustmentReasonCode $c) => [
                'value' => $c->value,
                'label' => $c->label(),
            ], AdjustmentReasonCode::cases()),
        ]);
    }

    /**
     * Display the dedicated Administrative Adjustment Review Workspace.
     */
    public function review(Order $order, OrderAdjustment $adjustment, Request $request): Response
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::ORDER_ADJUST_REVIEW);

        if ($actor->role === UserRole::SALESMAN) {
            throw new AuthorizationException('Salesmen are not authorized to access the administrative adjustment review workspace.');
        }

        // Mismatched Order/Adjustment IDOR Guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            abort(404, 'Adjustment request does not belong to the specified order.');
        }

        // Deep eager loading for review inspection
        $adjustment->load([
            'order' => fn ($q) => $q->with([
                'customer:id,code,name,credit_limit,payment_terms,status',
                'salesman:id,name,email',
                'creator:id,name,email',
            ]),
            'requester:id,name,email,role',
            'reviewer:id,name,email',
            'canceller:id,name,email',
            'reverser:id,name,email',
            'items' => fn ($q) => $q->orderBy('id', 'asc'),
            'items.orderItem' => fn ($q) => $q->with([
                'allocations' => fn ($allocQ) => $allocQ->orderBy('id', 'asc'),
            ]),
            'items.product:id,sku,name,status,minimum_allowed_price,mrp',
        ]);

        // Pure read-only evaluation of live order state vs request snapshot
        $evaluation = $this->reviewService->evaluate($adjustment);

        $adjustmentData = [
            'id' => $adjustment->id,
            'adjustment_number' => $adjustment->adjustment_number,
            'order_id' => $adjustment->order_id,
            'order_number' => $order->order_number,
            'order_version_snapshot' => (int) $adjustment->order_version_snapshot,
            'current_order_version' => (int) $order->version,
            'order_status_snapshot' => is_string($adjustment->order_status_snapshot)
                ? $adjustment->order_status_snapshot
                : ($adjustment->order_status_snapshot?->value ?? ''),
            'current_order_status' => $order->status instanceof OrderStatus ? $order->status->value : (string) $order->status,
            'current_order_status_label' => $order->status instanceof OrderStatus ? $order->status->label() : (string) $order->status,
            'status' => $adjustment->status instanceof OrderAdjustmentStatus ? $adjustment->status->value : (string) $adjustment->status,
            'status_label' => $adjustment->status instanceof OrderAdjustmentStatus ? $adjustment->status->label() : (string) $adjustment->status,
            'badge_variant' => $adjustment->status instanceof OrderAdjustmentStatus ? $adjustment->status->badgeVariant() : 'secondary',
            'reason_code' => $adjustment->reason_code instanceof AdjustmentReasonCode ? $adjustment->reason_code->value : (string) $adjustment->reason_code,
            'reason_label' => $adjustment->reason_code instanceof AdjustmentReasonCode ? $adjustment->reason_code->label() : (string) $adjustment->reason_code,
            'notes' => $adjustment->notes,
            'requested_by' => [
                'id' => $adjustment->requester?->id,
                'name' => $adjustment->requester?->name ?? 'System',
                'email' => $adjustment->requester?->email ?? '',
                'role' => $adjustment->requester?->role instanceof UserRole ? $adjustment->requester->role->value : ($adjustment->requester?->role ?? ''),
                'role_label' => $adjustment->requester?->role instanceof UserRole ? $adjustment->requester->role->label() : ($adjustment->requester?->role ?? ''),
            ],
            'requested_at' => $adjustment->requested_at?->toIso8601String(),
            'requested_at_formatted' => $adjustment->requested_at?->format('M d, Y H:i:s'),
            'reviewed_by' => $adjustment->reviewer ? [
                'id' => $adjustment->reviewer->id,
                'name' => $adjustment->reviewer->name,
            ] : null,
            'reviewed_at' => $adjustment->reviewed_at?->toIso8601String(),
            'applied_at' => $adjustment->applied_at?->toIso8601String(),
            'applied_at_formatted' => $adjustment->applied_at?->format('M d, Y H:i:s'),
            'rejection_reason' => $adjustment->rejection_reason,
            'cancelled_by' => $adjustment->canceller ? [
                'id' => $adjustment->canceller->id,
                'name' => $adjustment->canceller->name,
            ] : null,
            'cancelled_at' => $adjustment->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $adjustment->cancellation_reason,
            'reversed_by' => $adjustment->reverser ? [
                'id' => $adjustment->reverser->id,
                'name' => $adjustment->reverser->name,
            ] : null,
            'reversed_at' => $adjustment->reversed_at?->toIso8601String(),
            'reversed_at_formatted' => $adjustment->reversed_at?->format('M d, Y H:i:s'),
            'reversal_reason' => $adjustment->reversal_reason,
            'customer' => [
                'id' => $order->customer->id,
                'code' => $order->customer->code,
                'name' => $order->customer->name,
                'credit_limit' => (string) $order->customer->credit_limit,
                'payment_terms' => $order->customer->payment_terms instanceof \App\Enums\PaymentTerms ? $order->customer->payment_terms->label() : (string) ($order->customer->payment_terms ?? 'Standard'),
            ],
            'current_order_totals' => [
                'subtotal' => (string) $order->subtotal,
                'tax_total' => (string) $order->tax_total,
                'grand_total' => (string) $order->grand_total,
            ],
            'order_snapshot_totals' => [
                'subtotal' => (string) $adjustment->order_subtotal_snapshot,
                'tax_total' => (string) $adjustment->order_tax_total_snapshot,
                'grand_total' => (string) $adjustment->order_grand_total_snapshot,
            ],
            'projected_reductions' => [
                'subtotal' => (string) $adjustment->projected_subtotal_reduction,
                'tax_total' => (string) $adjustment->projected_tax_reduction,
                'grand_total' => (string) $adjustment->projected_grand_total_reduction,
            ],
        ];

        return Inertia::render('Admin/Adjustments/Review', [
            'adjustment' => $adjustmentData,
            'evaluation' => $evaluation->toArray(),
            'can' => [
                'review' => true,
                'approve' => $actor->can('approve', [$adjustment, $order]),
                'reject' => $actor->can('reject', [$adjustment, $order]),
                'apply' => $actor->can('apply', [$adjustment, $order]),
                'reverse' => $actor->can('reverse', [$adjustment, $order]),
                'is_requester' => (int) $adjustment->requested_by === (int) $actor->id,
                'is_super_admin' => $actor->isSuperAdmin(),
            ],
        ]);
    }

    /**
     * Authoritatively approve an order adjustment request.
     */
    public function approve(
        ApproveOrderAdjustmentRequest $request,
        Order $order,
        OrderAdjustment $adjustment
    ): RedirectResponse {
        $actor = $request->user();

        // Mismatched Order/Adjustment IDOR Guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            abort(404, 'Adjustment request does not belong to the specified order.');
        }

        Gate::authorize('approve', [$adjustment, $order]);

        $approvedAdjustment = $this->workflowService->approveAdjustment(
            $actor,
            $order,
            $adjustment,
            $request->validated(),
            $request->ip()
        );

        return redirect()
            ->route('admin.orders.adjustments.review', [
                'order' => $order->id,
                'adjustment' => $adjustment->id,
            ])
            ->with('success', "Adjustment {$approvedAdjustment->adjustment_number} has been approved.");
    }

    /**
     * Authoritatively reject an order adjustment request.
     */
    public function reject(
        RejectOrderAdjustmentRequest $request,
        Order $order,
        OrderAdjustment $adjustment
    ): RedirectResponse {
        $actor = $request->user();

        // Mismatched Order/Adjustment IDOR Guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            abort(404, 'Adjustment request does not belong to the specified order.');
        }

        Gate::authorize('reject', [$adjustment, $order]);

        $rejectedAdjustment = $this->workflowService->rejectAdjustment(
            $actor,
            $order,
            $adjustment,
            $request->validated('reason'),
            $request->validated(),
            $request->ip()
        );

        return redirect()
            ->route('admin.orders.adjustments.review', [
                'order' => $order->id,
                'adjustment' => $adjustment->id,
            ])
            ->with('success', "Adjustment {$rejectedAdjustment->adjustment_number} has been rejected.");
    }

    /**
     * Authoritatively apply an approved order adjustment request.
     */
    public function apply(
        Request $request,
        Order $order,
        OrderAdjustment $adjustment
    ): RedirectResponse {
        $actor = $request->user();

        // Mismatched Order/Adjustment IDOR Guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            abort(404, 'Adjustment request does not belong to the specified order.');
        }

        Gate::authorize('apply', [$adjustment, $order]);

        $appliedAdjustment = $this->workflowService->applyAdjustment(
            $actor,
            $order,
            $adjustment,
            $request->ip()
        );

        return redirect()
            ->route('admin.orders.adjustments.review', [
                'order' => $order->id,
                'adjustment' => $adjustment->id,
            ])
            ->with('success', "Adjustment {$appliedAdjustment->adjustment_number} has been applied successfully.");
    }

    /**
     * Authoritatively reverse an applied order adjustment request.
     */
    public function reverse(
        ReverseOrderAdjustmentRequest $request,
        Order $order,
        OrderAdjustment $adjustment
    ): RedirectResponse {
        $actor = $request->user();

        // Mismatched Order/Adjustment IDOR Guard
        if ((int) $adjustment->order_id !== (int) $order->id) {
            abort(404, 'Adjustment request does not belong to the specified order.');
        }

        Gate::authorize('reverse', [$adjustment, $order]);

        $reversedAdjustment = $this->workflowService->reverseAdjustment(
            $actor,
            $order,
            $adjustment,
            $request->validated('reason'),
            $request->validated(),
            $request->ip()
        );

        return redirect()
            ->route('admin.orders.adjustments.review', [
                'order' => $order->id,
                'adjustment' => $adjustment->id,
            ])
            ->with('success', "Adjustment {$reversedAdjustment->adjustment_number} has been reversed successfully.");
    }
}
