<?php

namespace Tests\Feature\Salesman;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use App\Services\Customer\CustomerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SalesmanScopedCustomerAccessTest extends TestCase
{
    use RefreshDatabase;

    protected CustomerService $customerService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->customerService = app(CustomerService::class);
    }

    /**
     * Helper to create a user with a specific role and status.
     */
    protected function createUserWithRole(UserRole $role, AccountStatus $status = AccountStatus::ACTIVE): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => $status,
            'password' => bcrypt('ValidPassword123!'),
        ]);
    }

    /**
     * Helper to create a customer record.
     */
    protected function createCustomer(array $overrides = []): Customer
    {
        static $counter = 5000;
        $counter++;

        return Customer::create(array_merge([
            'code' => 'CUST-' . str_pad((string) $counter, 5, '0', STR_PAD_LEFT),
            'name' => 'Wholesale Client ' . $counter,
            'contact_name' => 'Contact Person ' . $counter,
            'email' => "client{$counter}@example.com",
            'phone' => '+1 (555) ' . rand(100, 999) . '-' . rand(1000, 9999),
            'billing_address_line1' => '100 Main St',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '200 Supply Way',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30302',
            'shipping_country' => 'US',
            'tax_id' => 'TAX-' . $counter,
            'credit_limit' => 25000.00,
            'payment_terms' => PaymentTerms::NET_30,
            'status' => CustomerStatus::ACTIVE,
            'notes' => 'Commercial account note.',
            'salesman_id' => null,
        ], $overrides));
    }

    // =========================================================================
    // 1. List & Single Resource Scoping (SLM-SCOPE-001 to SLM-SCOPE-007)
    // =========================================================================

    /**
     * SLM-SCOPE-001: Salesman can list only assigned customers.
     */
    public function test_salesman_can_list_only_assigned_customers(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $custA = $this->createCustomer(['name' => 'Alpha Grocery Corp', 'salesman_id' => $salesmanA->id]);
        $custB = $this->createCustomer(['name' => 'Beta Food Distributors', 'salesman_id' => $salesmanB->id]);
        $custUnassigned = $this->createCustomer(['name' => 'Gamma Retail Mart', 'salesman_id' => null]);

        $response = $this->actingAs($salesmanA)->get(route('customers.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Index')
            ->where('customers.total', 1)
            ->where('customers.data.0.id', $custA->id)
            ->where('customers.data.0.name', 'Alpha Grocery Corp')
        );
    }

    /**
     * SLM-SCOPE-002: Salesman cannot access other salesman's customer profile (IDOR).
     */
    public function test_salesman_cannot_access_other_salesman_customer_profile_idor(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $custB = $this->createCustomer(['salesman_id' => $salesmanB->id]);

        $response = $this->actingAs($salesmanA)->get(route('customers.show', $custB));

        $response->assertForbidden();
    }

    /**
     * SLM-SCOPE-003: Salesman cannot access unassigned customer profile (IDOR).
     */
    public function test_salesman_cannot_access_unassigned_customer_profile_idor(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $unassignedCust = $this->createCustomer(['salesman_id' => null]);

        $response = $this->actingAs($salesman)->get(route('customers.show', $unassignedCust));

        $response->assertForbidden();
    }

    /**
     * SLM-SCOPE-004: Salesman can view assigned ON_HOLD customer.
     */
    public function test_salesman_can_view_assigned_on_hold_customer(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $onHoldCust = $this->createCustomer([
            'salesman_id' => $salesman->id,
            'status' => CustomerStatus::ON_HOLD,
        ]);

        // Show endpoint
        $response = $this->actingAs($salesman)->get(route('customers.show', $onHoldCust));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Show')
            ->where('customer.id', $onHoldCust->id)
            ->where('customer.status', 'ON_HOLD')
            ->where('customer.can_order', false)
        );

        // Index endpoint
        $indexResponse = $this->actingAs($salesman)->get(route('customers.index'));
        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 1)
            ->where('customers.data.0.id', $onHoldCust->id)
        );
    }

    /**
     * SLM-SCOPE-005: Salesman can view assigned INACTIVE customer.
     */
    public function test_salesman_can_view_assigned_inactive_customer(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $inactiveCust = $this->createCustomer([
            'salesman_id' => $salesman->id,
            'status' => CustomerStatus::INACTIVE,
        ]);

        // Show endpoint
        $response = $this->actingAs($salesman)->get(route('customers.show', $inactiveCust));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Show')
            ->where('customer.id', $inactiveCust->id)
            ->where('customer.status', 'INACTIVE')
            ->where('customer.can_order', false)
        );

        // Index endpoint
        $indexResponse = $this->actingAs($salesman)->get(route('customers.index'));
        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 1)
            ->where('customers.data.0.id', $inactiveCust->id)
        );
    }

    /**
     * SLM-SCOPE-006: Salesman cannot view other salesman's ON_HOLD customer.
     */
    public function test_salesman_cannot_view_other_salesman_on_hold_customer(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $onHoldCustB = $this->createCustomer([
            'salesman_id' => $salesmanB->id,
            'status' => CustomerStatus::ON_HOLD,
        ]);

        $response = $this->actingAs($salesmanA)->get(route('customers.show', $onHoldCustB));
        $response->assertForbidden();
    }

    /**
     * SLM-SCOPE-007: Salesman cannot view other salesman's INACTIVE customer.
     */
    public function test_salesman_cannot_view_other_salesman_inactive_customer(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $inactiveCustB = $this->createCustomer([
            'salesman_id' => $salesmanB->id,
            'status' => CustomerStatus::INACTIVE,
        ]);

        $response = $this->actingAs($salesmanA)->get(route('customers.show', $inactiveCustB));
        $response->assertForbidden();
    }

    // =========================================================================
    // 2. Search, Filtering, and Query Tampering (SLM-SCOPE-008 to SLM-SCOPE-012)
    // =========================================================================

    /**
     * SLM-SCOPE-008: Salesman directory search is strictly scoped.
     */
    public function test_salesman_directory_search_is_strictly_scoped(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $custA = $this->createCustomer([
            'name' => 'Prime Supermarket Central',
            'salesman_id' => $salesmanA->id,
        ]);

        $custB = $this->createCustomer([
            'name' => 'Prime Wholesale Outlets',
            'salesman_id' => $salesmanB->id,
        ]);

        // Search for common keyword 'Prime'
        $response = $this->actingAs($salesmanA)->get(route('customers.index', ['search' => 'Prime']));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Index')
            ->where('customers.total', 1)
            ->where('customers.data.0.id', $custA->id)
            ->where('customers.data.0.name', 'Prime Supermarket Central')
        );

        // Search for keyword unique to Salesman B's customer
        $responseBQuery = $this->actingAs($salesmanA)->get(route('customers.index', ['search' => 'Outlets']));
        $responseBQuery->assertOk();
        $responseBQuery->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 0)
            ->where('customers.data', [])
        );
    }

    /**
     * SLM-SCOPE-009: Salesman status filter is strictly scoped.
     */
    public function test_salesman_status_filter_is_strictly_scoped(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $custAActive = $this->createCustomer([
            'salesman_id' => $salesmanA->id,
            'status' => CustomerStatus::ACTIVE,
        ]);
        $custAOnHold = $this->createCustomer([
            'salesman_id' => $salesmanA->id,
            'status' => CustomerStatus::ON_HOLD,
        ]);

        $custBOnHold = $this->createCustomer([
            'salesman_id' => $salesmanB->id,
            'status' => CustomerStatus::ON_HOLD,
        ]);

        $response = $this->actingAs($salesmanA)->get(route('customers.index', ['status' => 'ON_HOLD']));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 1)
            ->where('customers.data.0.id', $custAOnHold->id)
            ->where('customers.data.0.status', 'ON_HOLD')
        );
    }

    /**
     * SLM-SCOPE-010: Salesman pagination and total count are strictly scoped.
     */
    public function test_salesman_pagination_and_total_count_are_strictly_scoped(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        // Create 20 customers for Salesman A
        for ($i = 0; $i < 20; $i++) {
            $this->createCustomer(['salesman_id' => $salesmanA->id]);
        }

        // Create 30 customers for Salesman B
        for ($i = 0; $i < 30; $i++) {
            $this->createCustomer(['salesman_id' => $salesmanB->id]);
        }

        // Create 10 unassigned customers
        for ($i = 0; $i < 10; $i++) {
            $this->createCustomer(['salesman_id' => null]);
        }

        // Total in DB is 60, but Salesman A must see total = 20
        $response = $this->actingAs($salesmanA)->get(route('customers.index', ['per_page' => 15]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 20)
            ->where('customers.per_page', 15)
            ->where('customers.last_page', 2)
            ->has('customers.data', 15)
        );

        $page2Response = $this->actingAs($salesmanA)->get(route('customers.index', ['per_page' => 15, 'page' => 2]));
        $page2Response->assertOk();
        $page2Response->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 20)
            ->where('customers.current_page', 2)
            ->has('customers.data', 5)
        );
    }

    /**
     * SLM-SCOPE-011: Salesman query parameter tampering cannot bypass scope.
     */
    public function test_salesman_query_parameter_tampering_cannot_bypass_scope(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $custA = $this->createCustomer(['salesman_id' => $salesmanA->id]);
        $custB = $this->createCustomer(['salesman_id' => $salesmanB->id]);

        // Salesman A passes salesman_id=salesmanB in query string
        $response = $this->actingAs($salesmanA)->get(route('customers.index', [
            'salesman_id' => $salesmanB->id,
        ]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 1)
            ->where('customers.data.0.id', $custA->id)
        );
    }

    /**
     * SLM-SCOPE-012: Salesman cannot filter unassigned customers.
     */
    public function test_salesman_cannot_filter_unassigned_customers(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);

        $custAssigned = $this->createCustomer(['salesman_id' => $salesman->id]);
        $custUnassigned = $this->createCustomer(['salesman_id' => null]);

        // Salesman passes salesman_id=UNASSIGNED
        $response = $this->actingAs($salesman)->get(route('customers.index', [
            'salesman_id' => 'UNASSIGNED',
        ]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 1)
            ->where('customers.data.0.id', $custAssigned->id)
        );
    }

    // =========================================================================
    // 3. Customer Mutation Boundary Enforcement (SLM-SCOPE-013 to SLM-SCOPE-019)
    // =========================================================================

    /**
     * SLM-SCOPE-013: Salesman CAN access customer creation form (auto-assigned portfolio onboarding).
     */
    public function test_salesman_can_access_customer_creation_form(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);

        $response = $this->actingAs($salesman)->get(route('customers.create'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Create')
            ->where('isSalesman', true)
            ->where('eligibleSalesmen', [])
        );
    }

    /**
     * SLM-SCOPE-014: Salesman can store new customer with automatic salesman_id binding.
     */
    public function test_salesman_can_store_new_customer_with_automatic_salesman_binding(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $otherSalesman = $this->createUserWithRole(UserRole::SALESMAN);

        $payload = [
            'code' => 'CUST-SLM-NEW-01',
            'name' => 'Salesman Onboarded Customer',
            'contact_name' => 'Jane Sales',
            'email' => 'salesnew@example.com',
            'phone' => '+1 (555) 444-3322',
            'billing_address_line1' => '100 Main St',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'credit_limit' => 10000.00,
            'payment_terms' => PaymentTerms::NET_30->value,
            'status' => CustomerStatus::ACTIVE->value,
            // Even if a malicious salesman tries to pass another salesman's ID:
            'salesman_id' => $otherSalesman->id,
        ];

        $response = $this->actingAs($salesman)->post(route('customers.store'), $payload);

        $response->assertRedirect();
        $createdCust = Customer::where('code', 'CUST-SLM-NEW-01')->first();
        $this->assertNotNull($createdCust);
        // Server-side authority: forced to authenticated salesman ID!
        $this->assertEquals($salesman->id, $createdCust->salesman_id);
    }

    /**
     * SLM-SCOPE-015: Salesman cannot access customer edit form.
     */
    public function test_salesman_cannot_access_customer_edit_form(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $customer = $this->createCustomer(['salesman_id' => $salesman->id]);

        $response = $this->actingAs($salesman)->get(route('customers.edit', $customer));

        $response->assertForbidden();
    }

    /**
     * SLM-SCOPE-016: Salesman cannot update customer.
     */
    public function test_salesman_cannot_update_customer(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $customer = $this->createCustomer(['salesman_id' => $salesman->id]);

        $updatePayload = array_merge($customer->toArray(), [
            'name' => 'Maliciously Altered Name',
        ]);

        $response = $this->actingAs($salesman)->put(route('customers.update', $customer), $updatePayload);

        $response->assertForbidden();
        $this->assertNotEquals('Maliciously Altered Name', $customer->fresh()->name);
    }

    /**
     * SLM-SCOPE-017: Salesman cannot update customer status.
     */
    public function test_salesman_cannot_update_customer_status(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $customer = $this->createCustomer([
            'salesman_id' => $salesman->id,
            'status' => CustomerStatus::ACTIVE,
        ]);

        $response = $this->actingAs($salesman)->patch(route('customers.status', $customer), [
            'status' => CustomerStatus::ON_HOLD->value,
            'reason' => 'Salesman attempting to place on hold',
        ]);

        $response->assertForbidden();
        $this->assertEquals(CustomerStatus::ACTIVE, $customer->fresh()->status);
    }

    /**
     * SLM-SCOPE-018: Salesman cannot assign or reassign customer.
     */
    public function test_salesman_cannot_assign_or_reassign_customer(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);
        $customer = $this->createCustomer(['salesman_id' => $salesmanA->id]);

        $response = $this->actingAs($salesmanA)->patch(route('customers.assign', $customer), [
            'salesman_id' => $salesmanB->id,
            'reason' => 'Salesman transferring customer',
        ]);

        $response->assertForbidden();
        $this->assertEquals($salesmanA->id, $customer->fresh()->salesman_id);
    }

    /**
     * SLM-SCOPE-019: Salesman does not receive eligible salesmen directory in UI props.
     */
    public function test_salesman_does_not_receive_eligible_salesmen_list(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $customer = $this->createCustomer(['salesman_id' => $salesman->id]);

        // Index endpoint
        $indexResponse = $this->actingAs($salesman)->get(route('customers.index'));
        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn (Assert $page) => $page
            ->where('eligibleSalesmen', [])
            ->where('can.create', true)
            ->where('can.assign', false)
        );

        // Show endpoint
        $showResponse = $this->actingAs($salesman)->get(route('customers.show', $customer));
        $showResponse->assertOk();
        $showResponse->assertInertia(fn (Assert $page) => $page
            ->where('eligibleSalesmen', [])
            ->where('can.update', false)
            ->where('can.assign', false)
        );
    }

    // =========================================================================
    // 4. Reassignment, Account Status & RBAC Boundaries (SLM-SCOPE-020 to SLM-SCOPE-026)
    // =========================================================================

    /**
     * SLM-SCOPE-020: Reassigned customer immediately revokes previous salesman's access.
     */
    public function test_reassigned_customer_immediately_revokes_previous_salesman_access(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $customer = $this->createCustomer(['salesman_id' => $salesmanA->id]);

        // Step 1: Salesman A can access
        $this->actingAs($salesmanA)->get(route('customers.show', $customer))->assertOk();

        // Step 2: Admin reassigns to Salesman B
        $this->actingAs($admin)->patch(route('customers.assign', $customer), [
            'salesman_id' => $salesmanB->id,
            'reason' => 'Portfolio transfer',
        ])->assertRedirect(route('customers.show', $customer));

        // Step 3: Salesman A immediately denied access (403)
        $this->actingAs($salesmanA)->get(route('customers.show', $customer))->assertForbidden();

        // Step 4: Salesman B now has access
        $this->actingAs($salesmanB)->get(route('customers.show', $customer))->assertOk();
    }

    /**
     * SLM-SCOPE-021: Suspended salesman cannot access customer directory or profile.
     */
    public function test_suspended_salesman_cannot_access_customer_directory_or_profile(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN, AccountStatus::SUSPENDED);
        $customer = $this->createCustomer(['salesman_id' => $salesman->id]);

        $this->actingAs($salesman)->get(route('customers.index'))->assertRedirect(route('login'));
        $this->actingAs($salesman)->get(route('customers.show', $customer))->assertRedirect(route('login'));
    }

    /**
     * SLM-SCOPE-022: Disabled salesman cannot access customer directory or profile.
     */
    public function test_disabled_salesman_cannot_access_customer_directory_or_profile(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN, AccountStatus::DISABLED);
        $customer = $this->createCustomer(['salesman_id' => $salesman->id]);

        $this->actingAs($salesman)->get(route('customers.index'))->assertRedirect(route('login'));
        $this->actingAs($salesman)->get(route('customers.show', $customer))->assertRedirect(route('login'));
    }

    /**
     * SLM-SCOPE-023: Admin and Super Admin retain unrestricted customer access.
     */
    public function test_admin_and_super_admin_retain_unrestricted_customer_access(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $superAdmin = $this->createUserWithRole(UserRole::SUPER_ADMIN);
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        $custA = $this->createCustomer(['salesman_id' => $salesmanA->id]);
        $custB = $this->createCustomer(['salesman_id' => $salesmanB->id]);
        $custUnassigned = $this->createCustomer(['salesman_id' => null]);

        // Admin can list all 3
        $adminIndex = $this->actingAs($admin)->get(route('customers.index'));
        $adminIndex->assertOk();
        $adminIndex->assertInertia(fn (Assert $page) => $page->where('customers.total', 3));

        // Admin can view profile of any customer
        $this->actingAs($admin)->get(route('customers.show', $custA))->assertOk();
        $this->actingAs($admin)->get(route('customers.show', $custB))->assertOk();
        $this->actingAs($admin)->get(route('customers.show', $custUnassigned))->assertOk();

        // Super Admin can list all 3
        $superAdminIndex = $this->actingAs($superAdmin)->get(route('customers.index'));
        $superAdminIndex->assertOk();
        $superAdminIndex->assertInertia(fn (Assert $page) => $page->where('customers.total', 3));

        // Super Admin can view profile of any customer
        $this->actingAs($superAdmin)->get(route('customers.show', $custA))->assertOk();
        $this->actingAs($superAdmin)->get(route('customers.show', $custB))->assertOk();
        $this->actingAs($superAdmin)->get(route('customers.show', $custUnassigned))->assertOk();
    }

    /**
     * SLM-SCOPE-024: Accountant retains read-only access to all customers.
     */
    public function test_accountant_retains_read_only_access_to_all_customers(): void
    {
        $accountant = $this->createUserWithRole(UserRole::ACCOUNTANT);
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);

        $custA = $this->createCustomer(['salesman_id' => $salesman->id]);
        $custUnassigned = $this->createCustomer(['salesman_id' => null]);

        // Accountant lists all customers
        $response = $this->actingAs($accountant)->get(route('customers.index'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('customers.total', 2)
            ->where('can.create', false)
            ->where('can.assign', false)
        );

        // Accountant views profile
        $showResponse = $this->actingAs($accountant)->get(route('customers.show', $custA));
        $showResponse->assertOk();
        $showResponse->assertInertia(fn (Assert $page) => $page
            ->where('can.update', false)
            ->where('can.assign', false)
        );

        // Accountant cannot edit, update, or assign
        $this->actingAs($accountant)->get(route('customers.edit', $custA))->assertForbidden();
        $this->actingAs($accountant)->patch(route('customers.assign', $custA), [
            'salesman_id' => $salesman->id,
        ])->assertForbidden();
    }

    /**
     * SLM-SCOPE-025: Nonexistent customer ID returns 404 Not Found.
     */
    public function test_nonexistent_customer_id_returns_404_not_found(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);

        $response = $this->actingAs($salesman)->get('/customers/999999');

        $response->assertNotFound();
    }

    /**
     * SLM-SCOPE-026: Salesman with empty portfolio receives clean empty paginator.
     */
    public function test_salesman_with_empty_portfolio_receives_clean_empty_paginator(): void
    {
        $salesmanA = $this->createUserWithRole(UserRole::SALESMAN);
        $salesmanB = $this->createUserWithRole(UserRole::SALESMAN);

        // Customers assigned to Salesman B only
        $this->createCustomer(['salesman_id' => $salesmanB->id]);
        $this->createCustomer(['salesman_id' => $salesmanB->id]);

        $response = $this->actingAs($salesmanA)->get(route('customers.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Index')
            ->where('customers.total', 0)
            ->where('customers.data', [])
        );
    }
}
