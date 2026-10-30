<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Order;
use App\Services\Invoices\InvoiceGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AdminInvoiceController extends Controller
{
    public function __construct(
        protected InvoiceGeneratorService $generatorService
    ) {}

    /**
     * Display a listing of invoices.
     */
    public function index(Request $request): Response
    {
        $status = $request->query('status');
        $paymentStatus = $request->query('payment_status');
        $customerId = $request->query('customer_id');
        $search = $request->query('search');
        $perPage = (int) $request->query('per_page', 25);

        $query = Invoice::query()
            ->with(['customer', 'order'])
            ->forUser($request->user())
            ->orderBy('id', 'desc');

        if ($status && in_array($status, InvoiceStatus::values(), true)) {
            $query->where('status', $status);
        }

        if ($paymentStatus && in_array($paymentStatus, PaymentStatus::values(), true)) {
            $query->where('payment_status', $paymentStatus);
        }

        if ($customerId) {
            $query->where('customer_id', $customerId);
        }

        if ($search && trim($search) !== '') {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('invoice_number', 'ILIKE', $term)
                    ->orWhere('customer_name_snapshot', 'ILIKE', $term)
                    ->orWhere('customer_code_snapshot', 'ILIKE', $term)
                    ->orWhereHas('order', fn ($oq) => $oq->where('order_number', 'ILIKE', $term));
            });
        }

        $invoices = $query->paginate($perPage)->withQueryString();

        $customers = Customer::query()
            ->active()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Admin/Invoices/Index', [
            'invoices' => $invoices,
            'customers' => $customers,
            'filters' => [
                'status' => $status,
                'payment_status' => $paymentStatus,
                'customer_id' => $customerId,
                'search' => $search,
                'per_page' => $perPage,
            ],
            'statuses' => InvoiceStatus::values(),
            'paymentStatuses' => PaymentStatus::values(),
        ]);
    }

    /**
     * Display the specified invoice detail view.
     */
    public function show(Invoice $invoice, Request $request): Response
    {
        Gate::authorize('view', $invoice);

        $invoice->load(['items.product', 'order.payments', 'customer', 'creator']);

        return Inertia::render('Admin/Invoices/Show', [
            'invoice' => $invoice,
        ]);
    }

    /**
     * Generate an invoice for an approved order.
     */
    public function generate(Order $order, Request $request): JsonResponse|RedirectResponse
    {
        Gate::authorize('generate', Invoice::class);

        $invoice = $this->generatorService->generateForOrder($order, $request->user());

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'message' => 'Invoice generated successfully.',
                'invoice' => $invoice,
            ], 201);
        }

        return redirect()->route('admin.invoices.show', $invoice)
            ->with('success', sprintf('Invoice %s generated successfully.', $invoice->invoice_number));
    }
}
