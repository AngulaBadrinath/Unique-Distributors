<?php

namespace App\Http\Controllers\Delivery;

use App\Enums\DeliveryStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Services\Auth\PermissionService;
use App\Services\Delivery\DeliveryWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeliveryPartnerController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService,
        protected DeliveryWorkflowService $workflowService,
    ) {}

    /**
     * Display the mobile driver assigned delivery queue.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $tab = $request->query('tab', 'today');

        $query = Delivery::query()
            ->with([
                'order:id,order_number,status,fulfillment_status,grand_total',
                'customer:id,name,code,phone,billing_city,billing_state,shipping_city,shipping_state',
                'items.product:id,name,sku',
            ]);

        // Anti-IDOR / Driver Scoping: DELIVERY_PARTNER role can ONLY see their assigned deliveries
        if ($user->role === UserRole::DELIVERY_PARTNER) {
            $query->forDriver($user->id);
        } elseif ($request->filled('driver_id')) {
            $query->where('driver_id', (int) $request->query('driver_id'));
        }

        // Aggregate metric badges for the driver's dashboard
        $countsQuery = Delivery::query();
        if ($user->role === UserRole::DELIVERY_PARTNER) {
            $countsQuery->forDriver($user->id);
        }

        $today = Carbon::today()->toDateString();
        $counts = [
            'today' => (clone $countsQuery)->whereDate('scheduled_date', $today)->count(),
            'active' => (clone $countsQuery)->whereIn('status', [DeliveryStatus::PICKED_UP->value, DeliveryStatus::OUT_FOR_DELIVERY->value])->count(),
            'pending' => (clone $countsQuery)->where('status', DeliveryStatus::ASSIGNED->value)->count(),
            'completed' => (clone $countsQuery)->where('status', DeliveryStatus::DELIVERED->value)->count(),
            'all' => (clone $countsQuery)->count(),
        ];

        // Apply Tab Filters
        match ($tab) {
            'today' => $query->whereDate('scheduled_date', $today)->whereNotIn('status', [DeliveryStatus::DELIVERED->value]),
            'active' => $query->whereIn('status', [DeliveryStatus::PICKED_UP->value, DeliveryStatus::OUT_FOR_DELIVERY->value]),
            'pending' => $query->where('status', DeliveryStatus::ASSIGNED->value),
            'completed' => $query->where('status', DeliveryStatus::DELIVERED->value),
            default => null,
        };

        $deliveries = $query->orderByRaw("
            CASE 
                WHEN status = 'OUT_FOR_DELIVERY' THEN 1
                WHEN status = 'PICKED_UP' THEN 2
                WHEN status = 'ASSIGNED' THEN 3
                WHEN status = 'RESCHEDULED' THEN 4
                WHEN status = 'FAILED' THEN 5
                ELSE 6
            END
        ")
            ->orderBy('scheduled_date', 'asc')
            ->orderBy('id', 'asc')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Delivery/Index', [
            'deliveries' => $deliveries,
            'counts' => $counts,
            'currentTab' => $tab,
            'driver' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
            ],
            'capabilities' => [
                'can_update' => $user->canPermission(Permission::DELIVERY_UPDATE),
                'is_driver' => $user->role === UserRole::DELIVERY_PARTNER,
            ],
        ]);
    }

    /**
     * Display authoritative delivery mission details with anti-IDOR protection.
     */
    public function show(Request $request, Delivery $delivery): Response
    {
        $user = $request->user();

        // Fail-Closed Anti-IDOR Convention:
        // A Delivery Partner trying to access another driver's delivery gets 404 (not 403 to prevent enumeration)
        if ($user->role === UserRole::DELIVERY_PARTNER && $delivery->driver_id !== $user->id) {
            throw new NotFoundHttpException('Delivery mission not found or not assigned to your account.');
        }

        $delivery->load([
            'order:id,order_number,status,fulfillment_status,delivery_status,grand_total,created_at',
            'customer:id,name,code,contact_name,phone,email,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_postal_code,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code',
            'driver:id,name,email',
            'items.product.primaryImage',
            'items.allocation',
            'events' => fn ($q) => $q->with('actor:id,name,role')->orderBy('created_at', 'desc'),
            'failures' => fn ($q) => $q->with('reporter:id,name')->orderBy('reported_at', 'desc'),
        ]);

        return Inertia::render('Delivery/Show', [
            'delivery' => $delivery,
            'capabilities' => [
                'can_pickup' => $delivery->canBePickedUp() && $user->canPermission(Permission::DELIVERY_UPDATE),
                'can_start_route' => $delivery->canStartRoute() && $user->canPermission(Permission::DELIVERY_UPDATE),
                'can_complete' => $delivery->canBeCompleted() && $user->canPermission(Permission::DELIVERY_UPDATE),
                'can_fail' => $delivery->canBeFailed() && $user->canPermission(Permission::DELIVERY_UPDATE),
                'can_reschedule' => $delivery->canBeRescheduled() && $user->canPermission(Permission::DELIVERY_UPDATE),
                'can_return_warehouse' => $delivery->canBeReturnedToWarehouse() && $user->canPermission(Permission::DELIVERY_UPDATE),
                'is_assigned_driver' => $delivery->driver_id === $user->id,
            ],
        ]);
    }

    /**
     * Retrieve chronological immutable delivery history events.
     */
    public function history(Request $request, Delivery $delivery): JsonResponse
    {
        $user = $request->user();

        if ($user->role === UserRole::DELIVERY_PARTNER && $delivery->driver_id !== $user->id) {
            throw new NotFoundHttpException('Delivery mission not found.');
        }

        $events = $delivery->events()
            ->with('actor:id,name,role')
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'delivery_id' => $delivery->id,
            'delivery_number' => $delivery->delivery_number,
            'events' => $events,
        ]);
    }

    /**
     * Confirm pickup of goods from warehouse.
     */
    public function pickup(Request $request, Delivery $delivery): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $updatedDelivery = $this->workflowService->confirmPickup(
            $delivery,
            $request->user(),
            $request->only(['notes'])
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Delivery {$updatedDelivery->delivery_number} confirmed as picked up from warehouse.",
                'delivery' => $updatedDelivery,
            ]);
        }

        return back()->with('success', "Delivery {$updatedDelivery->delivery_number} confirmed as picked up.");
    }

    /**
     * Start out-for-delivery route (FEAT-DEL-004).
     */
    public function startRoute(Request $request, Delivery $delivery): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $updatedDelivery = $this->workflowService->startRoute(
            $delivery,
            $request->user(),
            $request->only(['notes'])
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Delivery {$updatedDelivery->delivery_number} is now out for delivery.",
                'delivery' => $updatedDelivery,
            ]);
        }

        return back()->with('success', "Delivery {$updatedDelivery->delivery_number} is now out for delivery.");
    }

    /**
     * Complete delivery mission with proof of delivery (FEAT-DEL-005).
     */
    public function complete(\App\Http\Requests\Delivery\CompleteDeliveryRequest $request, Delivery $delivery): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $updatedDelivery = $this->workflowService->completeDelivery(
            $delivery,
            $request->user(),
            $request->validated()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Delivery {$updatedDelivery->delivery_number} successfully completed.",
                'delivery' => $updatedDelivery,
            ]);
        }

        return back()->with('success', "Delivery {$updatedDelivery->delivery_number} successfully completed.");
    }

    /**
     * Record delivery failure / exception (FEAT-DEL-006).
     */
    public function fail(\App\Http\Requests\Delivery\RecordDeliveryFailureRequest $request, Delivery $delivery): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $updatedDelivery = $this->workflowService->recordFailure(
            $delivery,
            $request->user(),
            $request->validated()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Delivery {$updatedDelivery->delivery_number} recorded as failed.",
                'delivery' => $updatedDelivery,
            ]);
        }

        return back()->with('warning', "Delivery {$updatedDelivery->delivery_number} recorded as failed.");
    }

    /**
     * Reschedule delivery mission for a future date (FEAT-DEL-007).
     */
    public function reschedule(\App\Http\Requests\Delivery\RescheduleDeliveryRequest $request, Delivery $delivery): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $updatedDelivery = $this->workflowService->reschedule(
            $delivery,
            $request->user(),
            $request->validated()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Delivery {$updatedDelivery->delivery_number} rescheduled to {$updatedDelivery->scheduled_date->toDateString()}.",
                'delivery' => $updatedDelivery,
            ]);
        }

        return back()->with('success', "Delivery {$updatedDelivery->delivery_number} rescheduled to {$updatedDelivery->scheduled_date->toDateString()}.");
    }

    /**
     * Return undelivered shipment back to warehouse custody (FEAT-DEL-007).
     */
    public function returnToWarehouse(\App\Http\Requests\Delivery\ReturnToWarehouseRequest $request, Delivery $delivery): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $updatedDelivery = $this->workflowService->returnToWarehouse(
            $delivery,
            $request->user(),
            $request->validated()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Delivery {$updatedDelivery->delivery_number} safely returned to warehouse custody.",
                'delivery' => $updatedDelivery,
            ]);
        }

        return back()->with('success', "Delivery {$updatedDelivery->delivery_number} safely returned to warehouse custody.");
    }
}
