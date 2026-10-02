<?php

namespace App\Http\Controllers\Order;

use App\DTOs\Adjustment\CreateOrderAdjustmentDTO;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Adjustment\CreateOrderAdjustmentRequest;
use App\Http\Requests\Adjustment\WithdrawOrderAdjustmentRequest;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Services\Adjustment\OrderAdjustmentService;
use App\Services\Auth\ResourceScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class OrderAdjustmentRequestController extends Controller
{
    public function __construct(
        protected OrderAdjustmentService $orderAdjustmentService,
        protected ResourceScopeService $resourceScopeService,
    ) {}

    /**
     * Authoritatively store a new order adjustment request.
     */
    public function store(CreateOrderAdjustmentRequest $request, Order $order): JsonResponse|RedirectResponse
    {
        $actor = $request->user();

        // Anti-IDOR: Fail closed if salesman attempts to adjust an order outside their portfolio
        if (! $this->resourceScopeService->canAccessOrder($actor, $order)) {
            throw new NotFoundHttpException('Order not found.');
        }

        $dto = CreateOrderAdjustmentDTO::fromArray($request->validated(), $order->id);

        $adjustment = $this->orderAdjustmentService->createAdjustmentRequest(
            actor: $actor,
            order: $order,
            dto: $dto,
            clientIp: $request->ip()
        );

        $isReplay = ! $adjustment->wasRecentlyCreated;

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'success' => true,
                'is_replay' => $isReplay,
                'adjustment' => [
                    'id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'status' => $adjustment->status->value,
                    'status_label' => $adjustment->status->label(),
                    'reason_code' => $adjustment->reason_code->value,
                    'projected_subtotal_reduction' => (string) $adjustment->projected_subtotal_reduction,
                    'projected_tax_reduction' => (string) $adjustment->projected_tax_reduction,
                    'projected_grand_total_reduction' => (string) $adjustment->projected_grand_total_reduction,
                    'items' => $adjustment->items->map(fn ($i) => [
                        'order_item_id' => $i->order_item_id,
                        'requested_quantity_reduction' => $i->requested_quantity_reduction,
                        'affected_allocation_quantity' => $i->affected_allocation_quantity,
                        'is_case_b' => $i->affected_allocation_quantity > 0,
                    ]),
                ],
                'message' => $isReplay
                    ? "Existing adjustment request {$adjustment->adjustment_number} retrieved."
                    : "Adjustment request {$adjustment->adjustment_number} submitted successfully.",
            ], $isReplay ? 200 : 201);
        }

        return redirect()->back()->with('success', "Adjustment request {$adjustment->adjustment_number} submitted successfully.");
    }

    /**
     * Authoritatively withdraw an unreviewed adjustment request.
     */
    public function withdraw(WithdrawOrderAdjustmentRequest $request, Order $order, OrderAdjustment $adjustment): JsonResponse|RedirectResponse
    {
        $actor = $request->user();

        // Nested Resource IDOR defense: Verify parent-child integrity
        if (! $this->resourceScopeService->verifyOrderAdjustmentOwnership($adjustment, $order)) {
            throw new NotFoundHttpException('Adjustment does not belong to the specified order.');
        }

        // Anti-IDOR: Fail closed if salesman attempts to withdraw an adjustment on an order outside their portfolio
        if (! $this->resourceScopeService->canAccessOrder($actor, $order)) {
            throw new NotFoundHttpException('Order not found.');
        }

        $withdrawn = $this->orderAdjustmentService->withdrawAdjustmentRequest(
            actor: $actor,
            adjustment: $adjustment,
            reason: (string) $request->validated('reason'),
            clientIp: $request->ip()
        );

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'success' => true,
                'adjustment' => [
                    'id' => $withdrawn->id,
                    'status' => $withdrawn->status->value,
                    'status_label' => $withdrawn->status->label(),
                ],
                'message' => "Adjustment request {$withdrawn->adjustment_number} has been withdrawn.",
            ], 200);
        }

        return redirect()->back()->with('success', "Adjustment request {$withdrawn->adjustment_number} has been withdrawn.");
    }
}
