<?php

namespace App\Services\Customer;

use App\DTOs\Customer\CustomerData;
use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\PaymentTerms;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use App\Services\Auth\PermissionService;
use Illuminate\Auth\Access\AuthorizationException;
use App\Services\Receivable\ReceivableAgingService;
use App\Services\Receivable\ReceivableLedgerService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CustomerService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected ReceivableLedgerService $receivableLedgerService,
        protected ReceivableAgingService $agingService
    ) {}

    /**
     * Retrieve paginated, searchable, filterable customer list.
     * Automatically scopes results for Salesmen to their assigned portfolio.
     *
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = [], int $perPage = 15, ?User $actor = null): LengthAwarePaginator
    {
        $query = Customer::query()->with('salesman:id,name,email,role,status');

        // 1. Enforce Actor Resource Scope
        if ($actor) {
            $query->forUser($actor);
        }

        // 2. Search filter (cross code, name, contact, email, phone)
        if (! empty($filters['search'])) {
            $query->search((string) $filters['search']);
        }

        // 3. Lifecycle Status filter
        if (! empty($filters['status'])) {
            $query->filterByStatus((string) $filters['status']);
        }

        // 4. Salesman filter (available to privileged roles only)
        if ($actor && $actor->role !== UserRole::SALESMAN && ! empty($filters['salesman_id'])) {
            if ($filters['salesman_id'] === 'UNASSIGNED') {
                $query->unassigned();
            } elseif (is_numeric($filters['salesman_id'])) {
                $query->assignedTo((int) $filters['salesman_id']);
            }
        }

        // 5. Sorting (allow-listed fields only)
        $allowedSorts = ['name', 'code', 'contact_name', 'email', 'status', 'credit_limit', 'created_at', 'salesman_id'];
        $sortBy = in_array($filters['sort_by'] ?? null, $allowedSorts, true) ? $filters['sort_by'] : 'name';
        $sortOrder = strtolower((string) ($filters['sort_order'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';

        return $query->orderBy($sortBy, $sortOrder)->paginate($perPage)->withQueryString();
    }

    /**
     * Retrieve customer by ID or throw exception.
     */
    public function findById(int $id): Customer
    {
        return Customer::with('salesman:id,name,email,role,status')->findOrFail($id);
    }

    /**
     * Retrieve authoritative customer profile data with structured commercial and deferred financial state.
     * Eager-loads salesman relation without N+1 overhead.
     *
     * Invariant on Financial Values (RULE-ACC-001 / RULE-DOM-001):
     * Transactional domains (Orders, Payments, Invoices, Receivables) do not exist yet in Phase 02.
     * Financial summary values (outstanding balance, available credit, aging) are explicitly modeled
     * as a DEFERRED presentation contract (null amounts, is_authoritative = false) with zero fabricated numbers.
     *
     * @return array<string, mixed>
     */
    public function getProfile(Customer $customer, ?User $actor = null): array
    {
        $customer->loadMissing('salesman:id,name,email,role,status');

        $creditLimit = (float) $customer->credit_limit;

        return [
            'id' => $customer->id,
            'code' => $customer->code,
            'name' => $customer->name,
            'contact_name' => $customer->contact_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'salesman_id' => $customer->salesman_id,
            'salesman' => $customer->salesman ? [
                'id' => $customer->salesman->id,
                'name' => $customer->salesman->name,
                'email' => $customer->salesman->email,
                'status' => $customer->salesman->status instanceof AccountStatus ? $customer->salesman->status->value : (string) $customer->salesman->status,
            ] : null,
            'billing_address_line1' => $customer->billing_address_line1,
            'billing_address_line2' => $customer->billing_address_line2,
            'billing_city' => $customer->billing_city,
            'billing_state' => $customer->billing_state,
            'billing_postal_code' => $customer->billing_postal_code,
            'billing_country' => $customer->billing_country,
            'formatted_billing_address' => $customer->formattedBillingAddress(),
            'shipping_address_line1' => $customer->shipping_address_line1,
            'shipping_address_line2' => $customer->shipping_address_line2,
            'shipping_city' => $customer->shipping_city,
            'shipping_state' => $customer->shipping_state,
            'shipping_postal_code' => $customer->shipping_postal_code,
            'shipping_country' => $customer->shipping_country,
            'formatted_shipping_address' => $customer->formattedShippingAddress(),
            'tax_id' => $customer->tax_id,
            'credit_limit' => $creditLimit,
            'payment_terms' => $customer->payment_terms instanceof PaymentTerms ? $customer->payment_terms->value : (string) $customer->payment_terms,
            'payment_terms_label' => $customer->payment_terms instanceof PaymentTerms ? $customer->payment_terms->label() : (string) $customer->payment_terms,
            'status' => $customer->status instanceof CustomerStatus ? $customer->status->value : (string) $customer->status,
            'status_label' => $customer->status instanceof CustomerStatus ? $customer->status->label() : (string) $customer->status,
            'status_badge_variant' => $customer->status instanceof CustomerStatus ? $customer->status->badgeVariant() : 'secondary',
            'can_order' => $customer->canPlaceOrders(),
            'notes' => $customer->notes,
            'financial_summary' => (function () use ($customer, $creditLimit) {
                $summary = $this->receivableLedgerService->getCustomerFinancialSummary($customer);
                $aging = $this->agingService->getAgingForCustomer($customer);
                $creditLimitNum = (float) $creditLimit;
                $outstandingNum = (float) $summary['operational_outstanding'];
                $utilizationPct = $creditLimitNum > 0 ? round(($outstandingNum / $creditLimitNum) * 100, 1) : 0.0;

                return [
                    'status' => 'ACTIVE',
                    'is_authoritative' => true,
                    'credit_limit' => $creditLimit,
                    'outstanding_balance' => $summary['operational_outstanding'],
                    'verified_receivable' => $summary['net_receivable'],
                    'pending_payments' => $summary['pending_payments'],
                    'available_credit' => $summary['available_credit'],
                    'credit_utilization_pct' => $utilizationPct,
                    'aging' => [
                        'current' => $aging['current'],
                        'days_1_30' => $aging['days_1_30'],
                        'days_31_60' => $aging['days_31_60'],
                        'days_61_90' => $aging['days_61_90'],
                        'days_90_plus' => $aging['days_91_plus'],
                    ],
                    'source_notice' => 'Authoritative live calculation from transaction ledgers (invoices, active orders, verified & pending payments).',
                ];
            })(),
            'created_at' => $customer->created_at?->toIso8601String(),
            'updated_at' => $customer->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Validate salesman eligibility for assignment.
     * Target user must exist, possess UserRole::SALESMAN, and have AccountStatus::ACTIVE.
     *
     * @throws ValidationException
     */
    public function validateSalesmanEligibility(?int $salesmanId): ?User
    {
        if ($salesmanId === null) {
            return null;
        }

        $user = User::find($salesmanId);

        if (! $user) {
            throw ValidationException::withMessages([
                'salesman_id' => 'The selected sales representative does not exist.',
            ]);
        }

        if ($user->role !== UserRole::SALESMAN) {
            throw ValidationException::withMessages([
                'salesman_id' => 'The selected user does not possess the Sales Representative role.',
            ]);
        }

        if (! $user->isActive()) {
            throw ValidationException::withMessages([
                'salesman_id' => 'The selected sales representative account is not active.',
            ]);
        }

        return $user;
    }

    /**
     * Retrieve all active sales representatives eligible for customer assignment.
     *
     * @return Collection<int, User>
     */
    public function getEligibleSalesmen(): Collection
    {
        return User::query()
            ->where('role', UserRole::SALESMAN)
            ->where('status', AccountStatus::ACTIVE)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'status']);
    }

    /**
     * Create a new customer master record with optional initial salesman assignment.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function create(CustomerData $data, User $actor, ?string $ip = null): Customer
    {
        $this->ensureActorIsActiveAndAuthorized($actor, Permission::CUSTOMER_CREATE);

        // Salesman actor is strictly bound to self-attribution (cannot assign other salesmen or leave unassigned)
        $salesmanId = $actor->role === UserRole::SALESMAN ? $actor->id : $data->salesman_id;

        if ($salesmanId !== null) {
            $this->validateSalesmanEligibility($salesmanId);
        }

        return DB::transaction(function () use ($data, $actor, $salesmanId, $ip) {
            $attributes = $data->toArray();
            $attributes['salesman_id'] = $salesmanId;

            // Auto-generate code if not explicitly provided
            if (empty($attributes['code'])) {
                $attributes['code'] = $this->generateNextCustomerCode();
            }

            $customer = Customer::create($attributes);

            Log::info('Customer master record created', [
                'event' => 'audit.customer_event',
                'action' => 'CUSTOMER_CREATED',
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'customer_id' => $customer->id,
                'customer_code' => $customer->code,
                'customer_name' => $customer->name,
                'salesman_id' => $customer->salesman_id,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            if ($customer->salesman_id !== null) {
                Log::info('Customer sales representative assigned on creation', [
                    'event' => 'audit.customer_event',
                    'action' => 'CUSTOMER_SALESMAN_ASSIGNED',
                    'actor_id' => $actor->id,
                    'actor_email' => $actor->email,
                    'actor_role' => $actor->role?->value,
                    'customer_id' => $customer->id,
                    'customer_code' => $customer->code,
                    'previous_salesman_id' => null,
                    'new_salesman_id' => $customer->salesman_id,
                    'reason' => 'Initial assignment during customer creation',
                    'ip_address' => $ip,
                    'timestamp' => now()->toIso8601String(),
                ]);
            }

            return $customer->load('salesman:id,name,email,role,status');
        });
    }

    /**
     * Update an existing customer master record.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function update(Customer $customer, CustomerData $data, User $actor, ?string $ip = null): Customer
    {
        $this->ensureActorIsActiveAndAuthorized($actor, Permission::CUSTOMER_UPDATE);

        if ($data->salesman_id !== null) {
            $this->validateSalesmanEligibility($data->salesman_id);
        }

        return DB::transaction(function () use ($customer, $data, $actor, $ip) {
            /** @var Customer $lockedCustomer */
            $lockedCustomer = Customer::query()
                ->where('id', $customer->id)
                ->lockForUpdate()
                ->firstOrFail();

            $previousSalesmanId = $lockedCustomer->salesman_id;
            $original = $lockedCustomer->only(array_keys($data->toArray()));
            $newValues = $data->toArray();

            $changedFields = [];
            foreach ($newValues as $key => $val) {
                if (($original[$key] ?? null) !== $val) {
                    $changedFields[] = $key;
                }
            }

            $lockedCustomer->fill($newValues);
            $lockedCustomer->save();

            Log::info('Customer master record updated', [
                'event' => 'audit.customer_event',
                'action' => 'CUSTOMER_UPDATED',
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'customer_id' => $lockedCustomer->id,
                'customer_code' => $lockedCustomer->code,
                'changed_fields' => $changedFields,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            // If salesman assignment changed during edit, log assignment transition audit
            if ($previousSalesmanId !== $lockedCustomer->salesman_id) {
                $action = $this->classifyAssignmentAction($previousSalesmanId, $lockedCustomer->salesman_id);

                Log::info("Customer sales representative assignment changed: {$action}", [
                    'event' => 'audit.customer_event',
                    'action' => $action,
                    'actor_id' => $actor->id,
                    'actor_email' => $actor->email,
                    'actor_role' => $actor->role?->value,
                    'customer_id' => $lockedCustomer->id,
                    'customer_code' => $lockedCustomer->code,
                    'previous_salesman_id' => $previousSalesmanId,
                    'new_salesman_id' => $lockedCustomer->salesman_id,
                    'reason' => 'Customer profile update',
                    'ip_address' => $ip,
                    'timestamp' => now()->toIso8601String(),
                ]);
            }

            return $lockedCustomer->load('salesman:id,name,email,role,status');
        });
    }

    /**
     * Authoritative dedicated operation to assign, reassign, or unassign a customer's salesman.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function assignSalesman(
        Customer $customer,
        ?int $salesmanId,
        User $actor,
        ?string $reason = null,
        ?string $ip = null
    ): Customer {
        $this->ensureActorIsActiveAndAuthorized($actor, Permission::CUSTOMER_UPDATE);

        // Validate salesman eligibility centrally
        $this->validateSalesmanEligibility($salesmanId);

        return DB::transaction(function () use ($customer, $salesmanId, $actor, $reason, $ip) {
            /** @var Customer $lockedCustomer */
            $lockedCustomer = Customer::query()
                ->where('id', $customer->id)
                ->lockForUpdate()
                ->firstOrFail();

            $previousSalesmanId = $lockedCustomer->salesman_id;

            // No-op check: if assigning identical salesman, return without duplicate audit/write
            if ($previousSalesmanId === $salesmanId) {
                return $lockedCustomer->load('salesman:id,name,email,role,status');
            }

            $action = $this->classifyAssignmentAction($previousSalesmanId, $salesmanId);

            $lockedCustomer->salesman_id = $salesmanId;
            $lockedCustomer->save();

            Log::info("Customer sales representative assignment changed: {$action}", [
                'event' => 'audit.customer_event',
                'action' => $action,
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'customer_id' => $lockedCustomer->id,
                'customer_code' => $lockedCustomer->code,
                'previous_salesman_id' => $previousSalesmanId,
                'new_salesman_id' => $salesmanId,
                'reason' => $reason,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            return $lockedCustomer->load('salesman:id,name,email,role,status');
        });
    }

    /**
     * Classify the assignment action based on transition states.
     */
    protected function classifyAssignmentAction(?int $previousId, ?int $newId): string
    {
        if ($previousId === null && $newId !== null) {
            return 'CUSTOMER_SALESMAN_ASSIGNED';
        }

        if ($previousId !== null && $newId !== null) {
            return 'CUSTOMER_SALESMAN_REASSIGNED';
        }

        return 'CUSTOMER_SALESMAN_UNASSIGNED';
    }

    /**
     * Transition customer lifecycle status with row locking and structured audit logging.
     *
     * @throws AuthorizationException
     */
    public function updateStatus(
        Customer $customer,
        CustomerStatus $newStatus,
        User $actor,
        ?string $reason = null,
        ?string $ip = null
    ): Customer {
        $this->ensureActorIsActiveAndAuthorized($actor, Permission::CUSTOMER_UPDATE);

        return DB::transaction(function () use ($customer, $newStatus, $actor, $reason, $ip) {
            /** @var Customer $lockedCustomer */
            $lockedCustomer = Customer::query()
                ->where('id', $customer->id)
                ->lockForUpdate()
                ->firstOrFail();

            $previousStatus = $lockedCustomer->status;

            // No-op check: if identical target status, return without duplicate database writes or audits
            if ($previousStatus === $newStatus) {
                return $lockedCustomer;
            }

            $action = $this->classifyStatusTransitionAction($previousStatus, $newStatus);

            $lockedCustomer->status = $newStatus;
            $lockedCustomer->save();

            Log::info("Customer status transitioned: {$action}", [
                'event' => 'audit.customer_event',
                'action' => $action,
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'customer_id' => $lockedCustomer->id,
                'customer_code' => $lockedCustomer->code,
                'previous_status' => $previousStatus?->value ?? (string) $previousStatus,
                'new_status' => $newStatus->value,
                'reason' => $reason,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            return $lockedCustomer;
        });
    }

    /**
     * Classify the lifecycle transition audit action based on target status.
     */
    protected function classifyStatusTransitionAction(CustomerStatus $previous, CustomerStatus $new): string
    {
        return match ($new) {
            CustomerStatus::ACTIVE => 'CUSTOMER_ACTIVATED',
            CustomerStatus::ON_HOLD => 'CUSTOMER_PLACED_ON_HOLD',
            CustomerStatus::INACTIVE => 'CUSTOMER_DEACTIVATED',
        };
    }

    /**
     * Generate the next deterministic sequential customer code.
     */
    public function generateNextCustomerCode(): string
    {
        $maxNum = 0;
        $codes = Customer::query()->whereNotNull('code')->pluck('code');

        foreach ($codes as $code) {
            if (preg_match('/^CUST-(\d+)$/i', trim($code), $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        if ($maxNum === 0) {
            $maxId = (int) Customer::max('id');
            $maxNum = $maxId;
        }

        return sprintf('CUST-%05d', $maxNum + 1);
    }

    /**
     * Ensure actor has an active account status and required permission.
     *
     * @throws AuthorizationException
     */
    protected function ensureActorIsActiveAndAuthorized(User $actor, Permission $permission): void
    {
        $isActive = ($actor->status instanceof AccountStatus)
            ? $actor->status === AccountStatus::ACTIVE
            : $actor->status === AccountStatus::ACTIVE->value;

        if (! $isActive) {
            throw new AuthorizationException('Inactive accounts are not authorized to perform customer operations.');
        }

        $this->permissionService->authorize($actor, $permission);
    }
}

