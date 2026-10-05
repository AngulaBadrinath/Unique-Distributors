<?php

namespace App\Http\Controllers\Salesman;

use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\ReturnReasonCode;
use App\Enums\ReturnStatus;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use App\Models\ReturnRequest;
use App\Models\Warehouse;
use App\Services\Return\ReturnRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SalesmanReturnController extends Controller
{
    public function __construct(
        protected ReturnRequestService $returnRequestService,
    ) {}

    /**
     * Display a listing of return requests scoped to assigned customers.
     */
    public function index(Request $request): Response
    {
        $status = $request->query('status');
        $customerId = $request->query('customer_id');
        $search = $request->query('search');
        $perPage = (int) $request->query('per_page', 25);

        $query = ReturnRequest::query()
            ->with(['customer', 'order', 'warehouse', 'createdBy'])
            ->forUser($request->user())
            ->orderBy('id', 'desc');

        if ($status && in_array($status, ReturnStatus::values(), true)) {
            $query->where('status', $status);
        }

        if ($customerId) {
            $query->where('customer_id', $customerId);
        }

        if ($search && trim($search) !== '') {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('return_number', 'ILIKE', $term)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'ILIKE', $term)->orWhere('code', 'ILIKE', $term))
                    ->orWhereHas('order', fn ($oq) => $oq->where('order_number', 'ILIKE', $term));
            });
        }

        $returns = $query->paginate($perPage)->withQueryString();

        $badgeCounts = [
            'all' => ReturnRequest::forUser($request->user())->count(),
            'requested' => ReturnRequest::forUser($request->user())->where('status', ReturnStatus::REQUESTED)->count(),
            'under_review' => ReturnRequest::forUser($request->user())->where('status', ReturnStatus::UNDER_REVIEW)->count(),
            'inspected' => ReturnRequest::forUser($request->user())->where('status', ReturnStatus::INSPECTED)->count(),
            'approved' => ReturnRequest::forUser($request->user())->where('status', ReturnStatus::APPROVED)->count(),
            'rejected' => ReturnRequest::forUser($request->user())->where('status', ReturnStatus::REJECTED)->count(),
            'cancelled' => ReturnRequest::forUser($request->user())->where('status', ReturnStatus::CANCELLED)->count(),
        ];

        $customers = Customer::query()
            ->where('salesman_id', $request->user()->id)
            ->active()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Admin/Returns/Index', [
            'returns' => $returns,
            'customers' => $customers,
            'warehouses' => [],
            'badgeCounts' => $badgeCounts,
            'filters' => [
                'status' => $status,
                'customer_id' => $customerId,
                'search' => $search,
                'per_page' => $perPage,
            ],
            'isSalesmanView' => true,
        ]);
    }

    /**
     * Show the form for creating a new return request scoped to assigned customers.
     */
    public function create(Request $request): Response
    {
        $orderId = $request->query('order_id');
        $selectedOrder = null;
        $returnableItems = [];

        if ($orderId) {
            $selectedOrder = Order::with(['customer', 'items.product', 'allocations'])
                ->forUser($request->user())
                ->find($orderId);

            if (! $selectedOrder) {
                throw new NotFoundHttpException('Order not found or not assigned to you.');
            }

            $returnableItems = $this->returnRequestService->calculateReturnableQuantities($selectedOrder);
        }

        $eligibleOrders = Order::query()
            ->forUser($request->user())
            ->where(function ($q) {
                $q->where('status', OrderStatus::COMPLETED)
                    ->orWhere('fulfillment_status', FulfillmentStatus::DELIVERED)
                    ->orWhereHas('items', fn ($iq) => $iq->where('delivered_quantity', '>', 0));
            })
            ->with('customer:id,name,code')
            ->orderBy('id', 'desc')
            ->limit(50)
            ->get(['id', 'order_number', 'customer_id', 'status', 'grand_total', 'created_at'])
            ->map(fn ($order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_id' => $order->customer_id,
                'status' => $order->status instanceof OrderStatus ? $order->status->value : (string) $order->status,
                'grand_total' => (string) $order->grand_total,
                'total_amount' => (string) $order->grand_total,
                'created_at' => $order->created_at?->toIso8601String(),
                'customer' => $order->customer ? [
                    'id' => $order->customer->id,
                    'name' => $order->customer->name,
                    'code' => $order->customer->code,
                ] : null,
            ]);

        $warehouses = Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']);
        $reasons = array_map(fn ($r) => ['value' => $r->value, 'label' => $r->label()], ReturnReasonCode::cases());

        return Inertia::render('Admin/Returns/Create', [
            'eligibleOrders' => $eligibleOrders,
            'selectedOrder' => $selectedOrder,
            'returnableItems' => $returnableItems,
            'warehouses' => $warehouses,
            'reasons' => $reasons,
            'isSalesmanView' => true,
        ]);
    }

    /**
     * Store a return request submitted by a salesman.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'items.*.requested_quantity' => ['required', 'integer', 'min:1'],
            'items.*.reason_code' => ['nullable', 'string'],
            'items.*.item_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $returnRequest = $this->returnRequestService->createRequest($validated, $request->user());

        return redirect()->route('salesman.returns.show', $returnRequest->id)
            ->with('success', "Return Request #{$returnRequest->return_number} has been submitted.");
    }

    /**
     * Display the specified return request workspace for a salesman.
     */
    public function show(int $id, Request $request): Response
    {
        /** @var ReturnRequest|null $returnRequest */
        $returnRequest = ReturnRequest::query()
            ->with([
                'order.customer',
                'order.items',
                'customer',
                'warehouse',
                'createdBy',
                'inspectedBy',
                'approvedBy',
                'items.product',
                'items.orderItem',
                'events.actor',
            ])
            ->forUser($request->user())
            ->find($id);

        if (! $returnRequest) {
            throw new NotFoundHttpException('Return request not found.');
        }

        return Inertia::render('Admin/Returns/Show', [
            'returnRequest' => $returnRequest,
            'reasons' => array_map(fn ($r) => ['value' => $r->value, 'label' => $r->label()], ReturnReasonCode::cases()),
            'isSalesmanView' => true,
        ]);
    }
}
