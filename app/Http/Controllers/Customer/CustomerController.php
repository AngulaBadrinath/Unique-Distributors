<?php

namespace App\Http\Controllers\Customer;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\AssignCustomerSalesmanRequest;
use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerStatusRequest;
use App\Models\Customer;
use App\Services\Customer\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function __construct(
        protected CustomerService $customerService
    ) {}

    /**
     * Display a paginated listing of customers.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $filters = $request->only(['search', 'status', 'salesman_id', 'sort_by', 'sort_order']);
        $perPage = max(1, min((int) $request->input('per_page', 15), 100));

        $customers = $this->customerService->list($filters, $perPage, $user);

        return Inertia::render('Customer/Index', [
            'customers' => $customers,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', 'ALL'),
                'salesman_id' => $request->input('salesman_id', 'ALL'),
                'sort_by' => $request->input('sort_by', 'name'),
                'sort_order' => $request->input('sort_order', 'asc'),
            ],
            'statuses' => collect(CustomerStatus::cases())->map(fn (CustomerStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
                'badgeVariant' => $s->badgeVariant(),
            ]),
            'paymentTerms' => collect(PaymentTerms::cases())->map(fn (PaymentTerms $p) => [
                'value' => $p->value,
                'label' => $p->label(),
            ]),
            'eligibleSalesmen' => $user && $user->role !== UserRole::SALESMAN
                ? $this->customerService->getEligibleSalesmen()
                : [],
            'can' => [
                'create' => $user?->can('create', Customer::class),
                'assign' => $user?->role === UserRole::SUPER_ADMIN || $user?->role === UserRole::ADMIN,
            ],
        ]);
    }

    /**
     * Show the form for creating a new customer.
     */
    public function create(Request $request): Response
    {
        $user = $request->user();
        $isSalesman = $user && $user->role === UserRole::SALESMAN;

        return Inertia::render('Customer/Create', [
            'suggestedCode' => $this->customerService->generateNextCustomerCode(),
            'statuses' => collect(CustomerStatus::cases())->map(fn (CustomerStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
            'paymentTerms' => collect(PaymentTerms::cases())->map(fn (PaymentTerms $p) => [
                'value' => $p->value,
                'label' => $p->label(),
            ]),
            'eligibleSalesmen' => $isSalesman ? [] : $this->customerService->getEligibleSalesmen(),
            'isSalesman' => $isSalesman,
        ]);
    }

    /**
     * Store a newly created customer in storage.
     */
    public function store(StoreCustomerRequest $request): RedirectResponse|JsonResponse
    {
        $customer = $this->customerService->create(
            data: $request->toDto(),
            actor: $request->user(),
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Customer created successfully.',
                'customer' => $customer,
            ], 201);
        }

        return redirect()->route('customers.show', $customer)
            ->with('success', 'Customer created successfully.');
    }

    /**
     * Display the specified customer profile.
     */
    public function show(Request $request, Customer $customer): Response
    {
        $user = $request->user();

        if ($user && ! $user->can('view', $customer)) {
            abort(403, 'You are not authorized to access this customer record.');
        }

        $profile = $this->customerService->getProfile($customer, $user);

        return Inertia::render('Customer/Show', [
            'customer' => $profile,
            'statuses' => collect(CustomerStatus::cases())->map(fn (CustomerStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
                'badgeVariant' => $s->badgeVariant(),
            ]),
            'eligibleSalesmen' => $user && $user->role !== UserRole::SALESMAN
                ? $this->customerService->getEligibleSalesmen()
                : [],
            'can' => [
                'update' => $user?->can('update', $customer),
                'assign' => $user?->can('assign', $customer),
            ],
        ]);
    }

    /**
     * Show the form for editing the specified customer.
     */
    public function edit(Request $request, Customer $customer): Response
    {
        $user = $request->user();

        if ($user && ! $user->can('update', $customer)) {
            abort(403, 'You are not authorized to edit this customer.');
        }

        $customer->loadMissing('salesman:id,name,email,role,status');

        return Inertia::render('Customer/Edit', [
            'customer' => [
                'id' => $customer->id,
                'code' => $customer->code,
                'name' => $customer->name,
                'contact_name' => $customer->contact_name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'billing_address_line1' => $customer->billing_address_line1,
                'billing_address_line2' => $customer->billing_address_line2,
                'billing_city' => $customer->billing_city,
                'billing_state' => $customer->billing_state,
                'billing_postal_code' => $customer->billing_postal_code,
                'billing_country' => $customer->billing_country,
                'shipping_address_line1' => $customer->shipping_address_line1,
                'shipping_address_line2' => $customer->shipping_address_line2,
                'shipping_city' => $customer->shipping_city,
                'shipping_state' => $customer->shipping_state,
                'shipping_postal_code' => $customer->shipping_postal_code,
                'shipping_country' => $customer->shipping_country,
                'tax_id' => $customer->tax_id,
                'credit_limit' => (float) $customer->credit_limit,
                'payment_terms' => $customer->payment_terms instanceof PaymentTerms ? $customer->payment_terms->value : (string) $customer->payment_terms,
                'status' => $customer->status instanceof CustomerStatus ? $customer->status->value : (string) $customer->status,
                'notes' => $customer->notes,
                'salesman_id' => $customer->salesman_id,
            ],
            'statuses' => collect(CustomerStatus::cases())->map(fn (CustomerStatus $s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
            'paymentTerms' => collect(PaymentTerms::cases())->map(fn (PaymentTerms $p) => [
                'value' => $p->value,
                'label' => $p->label(),
            ]),
            'eligibleSalesmen' => $this->customerService->getEligibleSalesmen(),
        ]);
    }

    /**
     * Update the specified customer in storage.
     */
    public function update(UpdateCustomerRequest $request, Customer $customer): RedirectResponse|JsonResponse
    {
        $updated = $this->customerService->update(
            customer: $customer,
            data: $request->toDto(),
            actor: $request->user(),
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Customer updated successfully.',
                'customer' => $updated,
            ]);
        }

        return redirect()->route('customers.show', $updated)
            ->with('success', 'Customer updated successfully.');
    }

    /**
     * Assign or reassign customer to a sales representative.
     */
    public function assignSalesman(AssignCustomerSalesmanRequest $request, Customer $customer): RedirectResponse|JsonResponse
    {
        $salesmanId = $request->validated('salesman_id');
        $reason = $request->validated('reason');

        $updated = $this->customerService->assignSalesman(
            customer: $customer,
            salesmanId: $salesmanId,
            actor: $request->user(),
            reason: $reason,
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Sales representative assignment updated successfully.',
                'customer' => $updated,
            ]);
        }

        return redirect()->route('customers.show', $updated)->with('success', 'Sales representative assignment updated successfully.');
    }

    /**
     * Update customer lifecycle status.
     */
    public function updateStatus(UpdateCustomerStatusRequest $request, Customer $customer): RedirectResponse|JsonResponse
    {
        $newStatus = CustomerStatus::from($request->validated('status'));
        $reason = $request->validated('reason');

        $updated = $this->customerService->updateStatus(
            customer: $customer,
            newStatus: $newStatus,
            actor: $request->user(),
            reason: $reason,
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Customer status updated successfully.',
                'customer' => $updated,
            ]);
        }

        return redirect()->route('customers.show', $updated)->with('success', "Customer status transitioned to {$newStatus->label()}.");
    }
}

