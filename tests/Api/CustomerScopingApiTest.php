<?php

namespace Tests\Api;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use Tests\Support\ApiTestCase;

class CustomerScopingApiTest extends ApiTestCase
{
    protected User $salesmanA;
    protected User $salesmanB;
    protected User $admin;
    protected Customer $customerA;
    protected Customer $customerB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->salesmanA = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesmanB = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->customerA = Customer::create([
            'code' => 'CUST-A-001',
            'name' => 'Customer Alpha',
            'contact_name' => 'Alice Agent',
            'email' => 'alpha@example.com',
            'phone' => '+1 555 111 2222',
            'billing_address_line1' => '100 Alpha St',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '100 Alpha St',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30301',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => '5000.00',
            'status' => CustomerStatus::ACTIVE,
            'salesman_id' => $this->salesmanA->id,
        ]);

        $this->customerB = Customer::create([
            'code' => 'CUST-B-001',
            'name' => 'Customer Beta',
            'contact_name' => 'Bob Broker',
            'email' => 'beta@example.com',
            'phone' => '+1 555 333 4444',
            'billing_address_line1' => '200 Beta Blvd',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '200 Beta Blvd',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30301',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => '5000.00',
            'status' => CustomerStatus::ACTIVE,
            'salesman_id' => $this->salesmanB->id,
        ]);
    }

    /**
     * Unauthenticated guest is redirected to login.
     */
    public function test_guest_cannot_access_customers(): void
    {
        $this->assertGuestRedirected('/customers');
    }

    /**
     * Salesman A can view their assigned customer.
     */
    public function test_salesman_can_view_assigned_customer(): void
    {
        $response = $this->actingAs($this->salesmanA)->get("/customers/{$this->customerA->id}");
        $response->assertStatus(200);
    }

    /**
     * RULE-SEC-003: Salesman A cannot access Salesman B's customer (IDOR protection).
     */
    public function test_salesman_cannot_view_unassigned_customer_idor(): void
    {
        $response = $this->actingAs($this->salesmanA)->get("/customers/{$this->customerB->id}");
        $this->assertContains($response->status(), [403, 404]);
    }

    /**
     * Admin can view any customer regardless of assigned salesman.
     */
    public function test_admin_can_view_any_customer(): void
    {
        $response = $this->actingAs($this->admin)->get("/customers/{$this->customerB->id}");
        $response->assertStatus(200);
    }
}
