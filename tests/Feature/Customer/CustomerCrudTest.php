<?php

namespace Tests\Feature\Customer;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use App\Services\Customer\CustomerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerCrudTest extends TestCase
{
    use RefreshDatabase;

    protected CustomerService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CustomerService::class);
    }

    /**
     * Helper to create active users with specific roles.
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
     * Helper to create standard valid customer payload.
     */
    protected function validCustomerPayload(array $overrides = []): array
    {
        return array_merge([
            'code' => 'CUST-00001',
            'name' => 'Acme Wholesale Grocers',
            'contact_name' => 'John Doe',
            'email' => 'buyer@acmegrocers.com',
            'phone' => '+1 (555) 123-4567',
            'billing_address_line1' => '100 Commerce Blvd',
            'billing_address_line2' => 'Suite 400',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '200 Logistics Pkwy',
            'shipping_address_line2' => 'Dock 5',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30302',
            'shipping_country' => 'US',
            'tax_id' => 'TAX-GA-998877',
            'credit_limit' => 25000.00,
            'payment_terms' => PaymentTerms::NET_30->value,
            'status' => CustomerStatus::ACTIVE->value,
            'notes' => 'Priority wholesale buyer with weekly restocking schedule.',
        ], $overrides);
    }

    /**
     * CUS-CRUD-001: Authorized users can access customer list.
     */
    public function test_cus_crud_001_authorized_users_can_access_customer_list(): void
    {
        Customer::create($this->validCustomerPayload());

        $authorizedRoles = [
            UserRole::SUPER_ADMIN,
            UserRole::ADMIN,
            UserRole::ACCOUNTANT,
            UserRole::SALESMAN,
        ];

        foreach ($authorizedRoles as $role) {
            $user = $this->createUserWithRole($role);

            $response = $this->actingAs($user)->get(route('customers.index'));
            $response->assertOk();
            $response->assertInertia(fn (Assert $page) => $page
                ->component('Customer/Index')
                ->has('customers.data')
                ->has('statuses')
                ->has('paymentTerms')
                ->has('can.create')
            );
        }
    }

    /**
     * CUS-CRUD-002: Unauthorized users cannot access customer list.
     */
    public function test_cus_crud_002_unauthorized_users_cannot_access_customer_list(): void
    {
        $unauthorizedRoles = [
            UserRole::WAREHOUSE_MANAGER,
            UserRole::DELIVERY_PARTNER,
        ];

        foreach ($unauthorizedRoles as $role) {
            $user = $this->createUserWithRole($role);

            $this->actingAs($user)
                ->get(route('customers.index'))
                ->assertForbidden();
        }
    }

    /**
     * CUS-CRUD-003: Guest cannot access protected customer routes.
     */
    public function test_cus_crud_003_guest_cannot_access_protected_customer_routes(): void
    {
        $customer = Customer::create($this->validCustomerPayload());

        $this->get(route('customers.index'))->assertRedirect(route('login'));
        $this->get(route('customers.create'))->assertRedirect(route('login'));
        $this->post(route('customers.store'), $this->validCustomerPayload())->assertRedirect(route('login'));
        $this->get(route('customers.show', $customer))->assertRedirect(route('login'));
        $this->get(route('customers.edit', $customer))->assertRedirect(route('login'));
        $this->put(route('customers.update', $customer), $this->validCustomerPayload())->assertRedirect(route('login'));
        $this->patch(route('customers.status', $customer), ['status' => 'INACTIVE'])->assertRedirect(route('login'));
    }

    /**
     * CUS-CRUD-004: Authorized user can view customer creation form.
     */
    public function test_cus_crud_004_authorized_user_can_view_customer_creation_form(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $response = $this->actingAs($admin)->get(route('customers.create'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Create')
            ->has('suggestedCode')
            ->has('statuses')
            ->has('paymentTerms')
        );
    }

    /**
     * CUS-CRUD-005: Authorized user can create customer.
     */
    public function test_cus_crud_005_authorized_user_can_create_customer(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $payload = $this->validCustomerPayload();

        $response = $this->actingAs($admin)->post(route('customers.store'), $payload);

        $customer = Customer::where('code', 'CUST-00001')->first();
        $this->assertNotNull($customer);
        $this->assertEquals('Acme Wholesale Grocers', $customer->name);
        $this->assertEquals('John Doe', $customer->contact_name);
        $this->assertEquals('buyer@acmegrocers.com', $customer->email);
        $this->assertEquals(25000.00, (float) $customer->credit_limit);
        $this->assertEquals(PaymentTerms::NET_30, $customer->payment_terms);
        $this->assertEquals(CustomerStatus::ACTIVE, $customer->status);

        $response->assertRedirect(route('customers.show', $customer));
    }

    /**
     * CUS-CRUD-006: Unauthorized users cannot create customer.
     */
    public function test_cus_crud_006_unauthorized_users_cannot_create_customer(): void
    {
        $unauthorizedRoles = [
            UserRole::ACCOUNTANT,
            UserRole::WAREHOUSE_MANAGER,
            UserRole::DELIVERY_PARTNER,
        ];

        foreach ($unauthorizedRoles as $role) {
            $user = $this->createUserWithRole($role);

            $this->actingAs($user)
                ->get(route('customers.create'))
                ->assertForbidden();

            $this->actingAs($user)
                ->post(route('customers.store'), $this->validCustomerPayload([
                    'code' => 'CUST-UNAUTH-' . $role->value,
                ]))
                ->assertForbidden();
        }

        $this->assertDatabaseMissing('customers', [
            'code' => 'CUST-UNAUTH-ACCOUNTANT',
        ]);
    }

    /**
     * CUS-CRUD-007: Required fields are validated.
     */
    public function test_cus_crud_007_required_fields_are_validated(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $response = $this->actingAs($admin)->post(route('customers.store'), []);

        $response->assertSessionHasErrors([
            'code',
            'name',
            'contact_name',
            'phone',
            'billing_address_line1',
            'billing_city',
            'billing_state',
            'billing_postal_code',
            'billing_country',
            'credit_limit',
            'payment_terms',
            'status',
        ]);
    }

    /**
     * CUS-CRUD-008: Invalid email is rejected.
     */
    public function test_cus_crud_008_invalid_email_is_rejected(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $response = $this->actingAs($admin)->post(route('customers.store'), $this->validCustomerPayload([
            'email' => 'not-an-email',
        ]));

        $response->assertSessionHasErrors(['email']);
    }

    /**
     * CUS-CRUD-009: Maximum lengths are enforced.
     */
    public function test_cus_crud_009_maximum_lengths_are_enforced(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $response = $this->actingAs($admin)->post(route('customers.store'), $this->validCustomerPayload([
            'code' => str_repeat('A', 33), // max 32
            'name' => str_repeat('B', 256), // max 255
            'billing_country' => 'USA', // max 2
        ]));

        $response->assertSessionHasErrors(['code', 'name', 'billing_country']);
    }

    /**
     * CUS-CRUD-010: Unique customer identifier is enforced.
     */
    public function test_cus_crud_010_unique_customer_identifier_is_enforced(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        Customer::create($this->validCustomerPayload(['code' => 'CUST-DUPE']));

        $response = $this->actingAs($admin)->post(route('customers.store'), $this->validCustomerPayload([
            'code' => 'CUST-DUPE',
        ]));

        $response->assertSessionHasErrors(['code']);
    }

    /**
     * CUS-CRUD-011: Concurrent duplicate creation remains safe.
     */
    public function test_cus_crud_011_database_uniqueness_constraint_prevents_duplicate_code(): void
    {
        Customer::create($this->validCustomerPayload(['code' => 'CUST-RACE']));

        $this->expectException(\Illuminate\Database\QueryException::class);
        Customer::create($this->validCustomerPayload(['code' => 'CUST-RACE']));
    }

    /**
     * CUS-CRUD-012: Authorized user can view customer detail.
     */
    public function test_cus_crud_012_authorized_user_can_view_customer_detail(): void
    {
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $customer = Customer::create($this->validCustomerPayload([
            'salesman_id' => $salesman->id,
        ]));

        $response = $this->actingAs($salesman)->get(route('customers.show', $customer));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Show')
            ->where('customer.code', 'CUST-00001')
            ->where('customer.name', 'Acme Wholesale Grocers')
            ->where('customer.status', 'ACTIVE')
            ->has('statuses')
            ->where('can.update', false) // salesman has view but not update
        );
    }

    /**
     * CUS-CRUD-013: Unauthorized user cannot view protected customer.
     */
    public function test_cus_crud_013_unauthorized_user_cannot_view_protected_customer(): void
    {
        $customer = Customer::create($this->validCustomerPayload());
        $delivery = $this->createUserWithRole(UserRole::DELIVERY_PARTNER);

        $this->actingAs($delivery)
            ->get(route('customers.show', $customer))
            ->assertForbidden();
    }

    /**
     * CUS-CRUD-014: Authorized user can update customer.
     */
    public function test_cus_crud_014_authorized_user_can_update_customer(): void
    {
        $customer = Customer::create($this->validCustomerPayload());
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $updatePayload = $this->validCustomerPayload([
            'name' => 'Acme Global Grocers LLC',
            'credit_limit' => 50000.00,
            'payment_terms' => PaymentTerms::NET_60->value,
            'status' => CustomerStatus::ON_HOLD->value,
        ]);

        $response = $this->actingAs($admin)->put(route('customers.update', $customer), $updatePayload);

        $customer->refresh();
        $this->assertEquals('Acme Global Grocers LLC', $customer->name);
        $this->assertEquals(50000.00, (float) $customer->credit_limit);
        $this->assertEquals(PaymentTerms::NET_60, $customer->payment_terms);
        $this->assertEquals(CustomerStatus::ON_HOLD, $customer->status);

        $response->assertRedirect(route('customers.show', $customer));
    }

    /**
     * CUS-CRUD-015: Unauthorized user cannot update customer.
     */
    public function test_cus_crud_015_unauthorized_user_cannot_update_customer(): void
    {
        $customer = Customer::create($this->validCustomerPayload());
        $salesman = $this->createUserWithRole(UserRole::SALESMAN);

        $this->actingAs($salesman)
            ->get(route('customers.edit', $customer))
            ->assertForbidden();

        $this->actingAs($salesman)
            ->put(route('customers.update', $customer), $this->validCustomerPayload(['name' => 'Hacked Name']))
            ->assertForbidden();

        $customer->refresh();
        $this->assertEquals('Acme Wholesale Grocers', $customer->name);
    }

    /**
     * CUS-CRUD-016: Customer status cannot be arbitrarily manipulated.
     */
    public function test_cus_crud_016_customer_status_cannot_be_arbitrarily_manipulated(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $customer = Customer::create($this->validCustomerPayload());

        $response = $this->actingAs($admin)->patch(route('customers.status', $customer), [
            'status' => 'INVALID_STATUS',
        ]);

        $response->assertSessionHasErrors(['status']);
        $customer->refresh();
        $this->assertEquals(CustomerStatus::ACTIVE, $customer->status);
    }

    /**
     * CUS-CRUD-017: Authorized deactivation / lifecycle status transition works.
     */
    public function test_cus_crud_017_authorized_deactivation_works(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $customer = Customer::create($this->validCustomerPayload());

        $response = $this->actingAs($admin)->patch(route('customers.status', $customer), [
            'status' => CustomerStatus::INACTIVE->value,
        ]);

        $customer->refresh();
        $this->assertEquals(CustomerStatus::INACTIVE, $customer->status);
        $this->assertFalse($customer->canPlaceOrders());
        $response->assertRedirect();
    }

    /**
     * CUS-CRUD-018: Unauthorized deactivation fails.
     */
    public function test_cus_crud_018_unauthorized_deactivation_fails(): void
    {
        $customer = Customer::create($this->validCustomerPayload());
        $accountant = $this->createUserWithRole(UserRole::ACCOUNTANT);

        $this->actingAs($accountant)
            ->patch(route('customers.status', $customer), [
                'status' => CustomerStatus::INACTIVE->value,
            ])
            ->assertForbidden();

        $customer->refresh();
        $this->assertEquals(CustomerStatus::ACTIVE, $customer->status);
    }

    /**
     * CUS-CRUD-019: Search works server-side across code, name, contact_name, email, and phone.
     */
    public function test_cus_crud_019_search_works_server_side(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        Customer::create($this->validCustomerPayload([
            'code' => 'CUST-ALPHA',
            'name' => 'Alpha Supermarket',
            'contact_name' => 'Alice Adams',
            'email' => 'alice@alpha.com',
            'phone' => '+1 (555) 111-2222',
        ]));

        Customer::create($this->validCustomerPayload([
            'code' => 'CUST-BETA',
            'name' => 'Beta Food Distributors',
            'contact_name' => 'Bob Baker',
            'email' => 'bob@beta.com',
            'phone' => '+1 (555) 333-4444',
        ]));

        // Search by code
        $respCode = $this->actingAs($admin)->get(route('customers.index', ['search' => 'ALPHA']));
        $respCode->assertOk();
        $respCode->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 1)
            ->where('customers.data.0.code', 'CUST-ALPHA')
        );

        // Search by contact name
        $respContact = $this->actingAs($admin)->get(route('customers.index', ['search' => 'Bob']));
        $respContact->assertOk();
        $respContact->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 1)
            ->where('customers.data.0.code', 'CUST-BETA')
        );
    }

    /**
     * CUS-CRUD-020: Pagination works correctly at database level.
     */
    public function test_cus_crud_020_pagination_works_correctly(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        for ($i = 1; $i <= 35; $i++) {
            Customer::create($this->validCustomerPayload([
                'code' => sprintf('CUST-%05d', $i),
                'name' => "Wholesale Customer $i",
            ]));
        }

        $responsePage1 = $this->actingAs($admin)->get(route('customers.index', ['page' => 1]));
        $responsePage1->assertOk();
        $responsePage1->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 15)
            ->where('customers.total', 35)
            ->where('customers.current_page', 1)
        );

        $responsePage2 = $this->actingAs($admin)->get(route('customers.index', ['page' => 2]));
        $responsePage2->assertOk();
        $responsePage2->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 15)
            ->where('customers.current_page', 2)
        );

        $responsePage3 = $this->actingAs($admin)->get(route('customers.index', ['page' => 3]));
        $responsePage3->assertOk();
        $responsePage3->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 5)
            ->where('customers.current_page', 3)
        );
    }

    /**
     * CUS-CRUD-021: Sort and filter parameters are validated and applied.
     */
    public function test_cus_crud_021_sort_and_filter_parameters_are_applied(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        Customer::create($this->validCustomerPayload([
            'code' => 'CUST-001',
            'name' => 'Zeta Supplies',
            'status' => CustomerStatus::INACTIVE->value,
        ]));

        Customer::create($this->validCustomerPayload([
            'code' => 'CUST-002',
            'name' => 'Alpha Supplies',
            'status' => CustomerStatus::ACTIVE->value,
        ]));

        // Filter by status = ACTIVE
        $respFilter = $this->actingAs($admin)->get(route('customers.index', ['status' => 'ACTIVE']));
        $respFilter->assertOk();
        $respFilter->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 1)
            ->where('customers.data.0.code', 'CUST-002')
        );

        // Sort by name ASC
        $respSort = $this->actingAs($admin)->get(route('customers.index', ['sort' => 'name', 'direction' => 'asc']));
        $respSort->assertOk();
        $respSort->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 2)
            ->where('customers.data.0.name', 'Alpha Supplies')
            ->where('customers.data.1.name', 'Zeta Supplies')
        );
    }

    /**
     * CUS-CRUD-022: No unauthorized customer data leaks through direct ID manipulation (IDOR).
     */
    public function test_cus_crud_022_idor_unauthorized_direct_id_access_blocked(): void
    {
        $customer = Customer::create($this->validCustomerPayload());
        $delivery = $this->createUserWithRole(UserRole::DELIVERY_PARTNER);

        $this->actingAs($delivery)
            ->get(route('customers.show', $customer->id))
            ->assertForbidden();

        $this->actingAs($delivery)
            ->put(route('customers.update', $customer->id), $this->validCustomerPayload())
            ->assertForbidden();
    }

    /**
     * CUS-CRUD-023: Audit event is generated for create/update/status mutation.
     */
    public function test_cus_crud_023_audit_events_are_logged_for_mutations(): void
    {
        Log::spy();

        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $payload = $this->validCustomerPayload();

        $this->actingAs($admin)->post(route('customers.store'), $payload);

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context) use ($admin) {
            return ($context['action'] ?? null) === 'CUSTOMER_CREATED' &&
                   $context['actor_id'] === $admin->id &&
                   $context['customer_code'] === 'CUST-00001';
        });

        $customer = Customer::where('code', 'CUST-00001')->first();

        $this->actingAs($admin)->put(route('customers.update', $customer), $this->validCustomerPayload([
            'name' => 'Updated Name Inc',
        ]));

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context) use ($admin) {
            return ($context['action'] ?? null) === 'CUSTOMER_UPDATED' &&
                   $context['actor_id'] === $admin->id &&
                   in_array('name', $context['changed_fields'] ?? []);
        });

        $this->actingAs($admin)->patch(route('customers.status', $customer), [
            'status' => CustomerStatus::INACTIVE->value,
        ]);

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context) use ($admin) {
            return ($context['action'] ?? null) === 'CUSTOMER_DEACTIVATED' &&
                   $context['actor_id'] === $admin->id;
        });
    }

    /**
     * CUS-CRUD-024: Audit metadata contains no passwords, secrets, or MFA data.
     */
    public function test_cus_crud_024_audit_contains_no_sensitive_secrets(): void
    {
        Log::spy();

        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $this->actingAs($admin)->post(route('customers.store'), $this->validCustomerPayload());

        Log::shouldNotHaveReceived('info', function ($message, $context) {
            return isset($context['password']) ||
                   isset($context['two_factor_secret']) ||
                   isset($context['remember_token']);
        });
    }

    /**
     * CUS-CRUD-025: Customer primary key and identity remain stable across updates.
     */
    public function test_cus_crud_025_customer_identity_remains_stable_after_updates(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $customer = Customer::create($this->validCustomerPayload());
        $originalId = $customer->id;

        $this->actingAs($admin)->put(route('customers.update', $customer), $this->validCustomerPayload([
            'name' => 'Rebranded Wholesale Corp',
            'phone' => '+1 (555) 999-0000',
        ]));

        $customer->refresh();
        $this->assertEquals($originalId, $customer->id);
        $this->assertEquals('CUST-00001', $customer->code);
    }

    /**
     * CUS-CRUD-026: Existing RBAC permissions remain authoritative.
     */
    public function test_cus_crud_026_rbac_permissions_remain_authoritative(): void
    {
        $superAdmin = $this->createUserWithRole(UserRole::SUPER_ADMIN);
        $this->assertTrue($superAdmin->can('customer.view'));
        $this->assertTrue($superAdmin->can('customer.create'));
        $this->assertTrue($superAdmin->can('customer.update'));

        $salesman = $this->createUserWithRole(UserRole::SALESMAN);
        $this->assertTrue($salesman->can('customer.view'));
        $this->assertTrue($salesman->can('customer.create'));
        $this->assertFalse($salesman->can('customer.update'));

        $delivery = $this->createUserWithRole(UserRole::DELIVERY_PARTNER);
        $this->assertFalse($delivery->can('customer.view'));
        $this->assertFalse($delivery->can('customer.create'));
        $this->assertFalse($delivery->can('customer.update'));
    }

    /**
     * CUS-CRUD-027: Next suggested customer code generation works sequentially.
     */
    public function test_cus_crud_027_customer_code_sequence_generation(): void
    {
        $this->assertEquals('CUST-00001', $this->service->generateNextCustomerCode());

        Customer::create($this->validCustomerPayload(['code' => 'CUST-00001']));
        $this->assertEquals('CUST-00002', $this->service->generateNextCustomerCode());

        Customer::create($this->validCustomerPayload(['code' => 'CUST-00010']));
        $this->assertEquals('CUST-00011', $this->service->generateNextCustomerCode());
    }

    /**
     * CUS-CRUD-028: Formatting helpers for address and phone are accurate.
     */
    public function test_cus_crud_028_address_formatting_helpers(): void
    {
        $customer = Customer::create($this->validCustomerPayload([
            'billing_address_line1' => '123 Main St',
            'billing_address_line2' => 'Ste 100',
            'billing_city' => 'Chicago',
            'billing_state' => 'IL',
            'billing_postal_code' => '60601',
            'billing_country' => 'US',
            'shipping_address_line1' => null,
        ]));

        $this->assertEquals(
            '123 Main St, Ste 100, Chicago, IL 60601, US',
            $customer->formatted_billing_address
        );

        $this->assertEquals(
            '123 Main St, Ste 100, Chicago, IL 60601, US',
            $customer->formatted_shipping_address
        );
    }

    /**
     * CUS-CRUD-029: Inactive status prevents order placement capability check.
     */
    public function test_cus_crud_029_customer_order_placement_status_invariants(): void
    {
        $activeCustomer = Customer::create($this->validCustomerPayload(['code' => 'CUST-ACT', 'status' => CustomerStatus::ACTIVE->value]));
        $onHoldCustomer = Customer::create($this->validCustomerPayload(['code' => 'CUST-HLD', 'status' => CustomerStatus::ON_HOLD->value]));
        $inactiveCustomer = Customer::create($this->validCustomerPayload(['code' => 'CUST-INA', 'status' => CustomerStatus::INACTIVE->value]));

        $this->assertTrue($activeCustomer->canPlaceOrders());
        $this->assertFalse($onHoldCustomer->canPlaceOrders());
        $this->assertFalse($inactiveCustomer->canPlaceOrders());

        $this->assertEquals(1, Customer::active()->count());
    }

    /**
     * CUS-CRUD-030: Adversarial payload rejection and sanitization.
     */
    public function test_cus_crud_030_adversarial_payload_rejection(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        // SQL injection / XSS payload in name / notes
        $response = $this->actingAs($admin)->post(route('customers.store'), $this->validCustomerPayload([
            'name' => '<script>alert("XSS")</script>',
            'credit_limit' => -500.00, // Negative credit limit
        ]));

        $response->assertSessionHasErrors(['credit_limit']);

        // Check clean string handling when credit limit is corrected
        $this->actingAs($admin)->post(route('customers.store'), $this->validCustomerPayload([
            'code' => 'CUST-SEC-01',
            'name' => '<script>alert("XSS")</script>',
            'credit_limit' => 100.00,
        ]))->assertRedirect();

        $saved = Customer::where('code', 'CUST-SEC-01')->first();
        $this->assertNotNull($saved);
        // Stored safely as raw string, never evaluated
        $this->assertEquals('<script>alert("XSS")</script>', $saved->name);
    }
}
