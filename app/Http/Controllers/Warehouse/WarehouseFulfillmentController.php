<?php

namespace App\Http\Controllers\Warehouse;

use App\Enums\FulfillmentStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\Warehouse\DispatchOrderRequest;
use App\Http\Requests\Warehouse\PackOrderRequest;
use App\Http\Requests\Warehouse\PickOrderItemsRequest;
use App\Models\Order;
use App\Services\Warehouse\WarehouseFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WarehouseFulfillmentController extends Controller
{
    public function __construct(
        protected WarehouseFulfillmentService $fulfillmentService
    ) {}

    /**
     * Display the warehouse operational fulfillment queue.
     */
    public function index(Request $request): Response
    {
        $actor = $request->user();

        if (! $actor->canPermission(Permission::ORDER_VIEW) && ! $actor->canPermission(Permission::INVENTORY_VIEW)) {
            abort(403, 'You do not have permission to view warehouse fulfillment operations.');
        }

        $filters = $request->only(['tab', 'search', 'fulfillment_status']);
        $result = $this->fulfillmentService->paginateFulfillmentOrders($filters);

        $orders = $result['orders']->through(function (Order $order) {
            $totalOrdered = $order->items->sum('ordered_quantity');
            $totalPicked = $order->items->sum('picked_quantity');
            $totalDispatched = $order->items->sum('dispatched_quantity');

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer' => [
                    'id' => $order->customer?->id,
                    'name' => $order->customer?->name,
                    'code' => $order->customer?->code,
                    'phone' => $order->customer?->phone,
                    'city' => $order->customer?->shipping_city ?: $order->customer?->billing_city,
                    'state' => $order->customer?->shipping_state ?: $order->customer?->billing_state,
                ],
                'status' => $order->status->value,
                'status_label' => $order->status->label(),
                'fulfillment_status' => $order->fulfillment_status instanceof FulfillmentStatus ? $order->fulfillment_status->value : (string) $order->fulfillment_status,
                'fulfillment_status_label' => $order->fulfillment_status instanceof FulfillmentStatus ? $order->fulfillment_status->label() : (string) $order->fulfillment_status,
                'total_ordered' => $totalOrdered,
                'total_picked' => $totalPicked,
                'total_dispatched' => $totalDispatched,
                'grand_total' => (string) $order->grand_total,
                'approved_at' => $order->approved_at?->toIso8601String(),
                'delivery' => $order->latestDelivery ? [
                    'id' => $order->latestDelivery->id,
                    'delivery_number' => $order->latestDelivery->delivery_number,
                    'status' => $order->latestDelivery->status instanceof \App\Enums\DeliveryStatus ? $order->latestDelivery->status->value : (string) $order->latestDelivery->status,
                    'driver_name' => $order->latestDelivery->driver?->name,
                    'scheduled_date' => $order->latestDelivery->scheduled_date?->toDateString(),
                ] : null,
                'items_count' => $order->items->count(),
            ];
        });

        return Inertia::render('Warehouse/Fulfillment/Index', [
            'orders' => $orders,
            'badgeCounts' => $result['badgeCounts'],
            'filters' => $filters,
            'capabilities' => [
                'can_pick' => true,
                'can_pack' => true,
                'can_dispatch' => true,
                'can_assign_delivery' => $actor->canPermission(Permission::DELIVERY_ASSIGN),
            ],
        ]);
    }

    /**
     * Display a specific order in the warehouse fulfillment workspace.
     */
    public function show(Request $request, Order $order): Response
    {
        $actor = $request->user();

        if (! $actor->canPermission(Permission::ORDER_VIEW) && ! $actor->canPermission(Permission::INVENTORY_VIEW)) {
            abort(403, 'You do not have permission to view this fulfillment order.');
        }

        $order->load([
            'customer',
            'items.product',
            'items.allocations',
            'latestDelivery.driver',
        ]);

        $items = $order->items->map(function ($item) {
            $alloc = $item->allocations->first();

            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name_snapshot,
                'sku' => $item->sku_snapshot,
                'unit' => $item->unit_snapshot,
                'ordered_quantity' => $item->ordered_quantity,
                'fulfillable_quantity' => $item->fulfillableQuantity(),
                'reserved_quantity' => $item->reserved_quantity,
                'picked_quantity' => $item->picked_quantity,
                'dispatched_quantity' => $item->dispatched_quantity,
                'allocation_status' => $alloc?->status?->value ?? 'UNALLOCATED',
                'allocation_number' => $alloc?->allocation_number,
                'warehouse_code' => $alloc?->warehouse_code ?? 'MAIN',
            ];
        });

        return Inertia::render('Warehouse/Fulfillment/Show', [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status->value,
                'status_label' => $order->status->label(),
                'fulfillment_status' => $order->fulfillment_status instanceof FulfillmentStatus ? $order->fulfillment_status->value : (string) $order->fulfillment_status,
                'fulfillment_status_label' => $order->fulfillment_status instanceof FulfillmentStatus ? $order->fulfillment_status->label() : (string) $order->fulfillment_status,
                'delivery_status' => $order->delivery_status instanceof \App\Enums\DeliveryStatus ? $order->delivery_status->value : (string) $order->delivery_status,
                'customer' => [
                    'id' => $order->customer->id,
                    'name' => $order->customer->name,
                    'code' => $order->customer->code,
                    'phone' => $order->customer->phone,
                    'contact_name' => $order->customer->contact_name,
                    'shipping_address' => [
                        'line1' => $order->customer->shipping_address_line1 ?: $order->customer->billing_address_line1,
                        'line2' => $order->customer->shipping_address_line2 ?: $order->customer->billing_address_line2,
                        'city' => $order->customer->shipping_city ?: $order->customer->billing_city,
                        'state' => $order->customer->shipping_state ?: $order->customer->billing_state,
                        'postal_code' => $order->customer->shipping_postal_code ?: $order->customer->billing_postal_code,
                    ],
                ],
                'items' => $items,
                'approved_at' => $order->approved_at?->toIso8601String(),
                'notes' => $order->notes,
                'delivery' => $order->latestDelivery ? [
                    'id' => $order->latestDelivery->id,
                    'delivery_number' => $order->latestDelivery->delivery_number,
                    'status' => $order->latestDelivery->status instanceof \App\Enums\DeliveryStatus ? $order->latestDelivery->status->value : (string) $order->latestDelivery->status,
                    'scheduled_date' => $order->latestDelivery->scheduled_date?->toDateString(),
                    'driver_name' => $order->latestDelivery->driver?->name,
                ] : null,
            ],
            'capabilities' => [
                'can_pick' => true,
                'can_pack' => true,
                'can_dispatch' => true,
                'can_assign_delivery' => $actor->canPermission(Permission::DELIVERY_ASSIGN),
            ],
        ]);
    }

    /**
     * Mark items as picked for an order.
     */
    public function pick(PickOrderItemsRequest $request, Order $order): RedirectResponse|JsonResponse
    {
        $actor = $request->user();
        $pickedItems = $request->validated('items', []);

        $updatedOrder = $this->fulfillmentService->pickOrder($order, $actor, $pickedItems);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Order #{$order->order_number} marked as Picked.",
                'order' => $updatedOrder,
            ]);
        }

        return back()->with('status', "Order #{$order->order_number} items have been picked.");
    }

    /**
     * Mark order as packed.
     */
    public function pack(PackOrderRequest $request, Order $order): RedirectResponse|JsonResponse
    {
        $actor = $request->user();
        $notes = $request->validated('notes');

        $updatedOrder = $this->fulfillmentService->packOrder($order, $actor, $notes);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Order #{$order->order_number} marked as Packed.",
                'order' => $updatedOrder,
            ]);
        }

        return back()->with('status', "Order #{$order->order_number} has been packed.");
    }

    /**
     * Dispatch order and create downstream Delivery mission.
     */
    public function dispatch(DispatchOrderRequest $request, Order $order): RedirectResponse|JsonResponse
    {
        $actor = $request->user();
        $options = $request->validated();

        $result = $this->fulfillmentService->dispatchOrder($order, $actor, $options);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Order #{$order->order_number} dispatched. Delivery #{$result['delivery']->delivery_number} created.",
                'order' => $result['order'],
                'delivery' => $result['delivery'],
            ]);
        }

        return back()->with('status', "Order #{$order->order_number} has been dispatched to logistics (Delivery #{$result['delivery']->delivery_number}).");
    }
}
