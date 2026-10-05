<?php

namespace Tests\Api;

use App\Enums\AccountStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Tests\Support\ApiTestCase;

class OrderAuthorizationApiTest extends ApiTestCase
{
    protected User $salesmanA;
    protected User $salesmanB;
    protected User $admin;
    protected Customer $customerA;
    protected Order $orderA;

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
            'code' => 'CUST-ORD-01',
            'name' => 'Order Cust Alpha',
            'contact_name' => 'Alice',
            'email' => 'ordalpha@example.com',
            'phone' => '+1 555 111 9999',
            'billing_address_line1' => '100 Main St',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '100 Main St',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30301',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => '10000.00',
            'salesman_id' => $this->salesmanA->id,
        ]);

        $this->orderA = Order::create([
            'order_number' => 'ORD-TEST-001',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'customer_id' => $this->customerA->id,
            'salesman_id' => $this->salesmanA->id,
            'created_by' => $this->salesmanA->id,
            'status' => OrderStatus::PENDING_APPROVAL,
            'subtotal' => '500.00',
            'tax_total' => '35.00',
            'grand_total' => '535.00',
            'ordered_at' => now(),
        ]);
    }

    /**
     * Salesman A can view their own order.
     */
    public function test_salesman_can_view_own_order(): void
    {
        $response = $this->actingAs($this->salesmanA)->get("/salesman/orders/{$this->orderA->id}");
        $response->assertStatus(200);
    }

    /**
     * RULE-SEC-003: Salesman B cannot view Salesman A's order (anti-IDOR).
     */
    public function test_salesman_cannot_view_other_salesman_order(): void
    {
        $response = $this->actingAs($this->salesmanB)->get("/salesman/orders/{$this->orderA->id}");
        $this->assertContains($response->status(), [403, 404]);
    }

    /**
     * Salesman cannot approve orders (requires order.approve).
     */
    public function test_salesman_cannot_approve_order(): void
    {
        $response = $this->actingAs($this->salesmanA)->post("/admin/orders/{$this->orderA->id}/approve");
        $response->assertStatus(403);
    }

    /**
     * Unauthenticated guest cannot view or approve orders.
     */
    public function test_guest_cannot_access_orders(): void
    {
        $this->assertGuestRedirected("/salesman/orders/{$this->orderA->id}");
        $this->assertGuestRedirected("/admin/orders/{$this->orderA->id}/approve", 'POST');
    }
}
