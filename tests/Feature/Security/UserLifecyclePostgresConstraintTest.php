<?php

namespace Tests\Feature\Security;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserLifecyclePostgresConstraintTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email' => 'superadmin.constraint@uniquejerseywholesale.com',
        ]);
    }

    /**
     * Helper to create a customer.
     */
    protected function createCustomer(User $salesman): Customer
    {
        return Customer::create([
            'code' => 'CUST-' . strtoupper(Str::random(6)),
            'name' => 'Constraint Test Retailer',
            'contact_name' => 'John Contact',
            'email' => 'retailer.' . Str::random(6) . '@example.com',
            'phone' => '555-0199',
            'billing_address_line1' => '123 Market St',
            'billing_city' => 'Newark',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07101',
            'billing_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => 10000.00,
            'salesman_id' => $salesman->id,
            'status' => CustomerStatus::ACTIVE,
        ]);
    }

    /**
     * Helper to create an order.
     */
    protected function createOrder(Customer $customer, User $creator): Order
    {
        return Order::create([
            'order_number' => 'ORD-POSTGRES-' . strtoupper(Str::random(6)),
            'idempotency_key' => (string) Str::uuid(),
            'customer_id' => $customer->id,
            'salesman_id' => $customer->salesman_id,
            'created_by' => $creator->id,
            'status' => OrderStatus::SUBMITTED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal' => 250.00,
            'tax_amount' => 16.56,
            'grand_total' => 266.56,
            'order_date' => now(),
        ]);
    }

    public function test_non_super_admin_cannot_delete_users_403(): void
    {
        $salesman = User::factory()->salesman()->create();
        $target = User::factory()->create();

        $response = $this->actingAs($salesman)->delete(
            route('users.destroy', $target),
            [
                'reason' => 'Unauthorized deletion attempt by salesman',
                'confirm' => true,
            ]
        );

        $response->assertStatus(403);
        $this->assertDatabaseHas('users', ['id' => $target->id]);
    }

    public function test_user_without_historical_references_is_hard_deleted(): void
    {
        $target = User::factory()->create([
            'name' => 'Ephemeral User',
            'email' => 'ephemeral.' . Str::random(6) . '@example.com',
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->actingAs($this->superAdmin)->delete(
            route('users.destroy', $target),
            [
                'reason' => 'Permanent removal of newly created test account',
                'confirm' => true,
            ]
        );

        $response->assertRedirect(route('roles.index'));
        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    public function test_user_with_historical_orders_is_safely_retired_preserving_foreign_keys(): void
    {
        $salesman = User::factory()->salesman()->create([
            'name' => 'Historical Sales Rep',
            'email' => 'rep.' . Str::random(6) . '@example.com',
        ]);

        $customer = $this->createCustomer($salesman);
        $order = $this->createOrder($customer, $salesman);

        $response = $this->actingAs($this->superAdmin)->delete(
            route('users.destroy', $salesman),
            [
                'reason' => 'Sales representative left the company; preserve historical order attribution',
                'confirm' => true,
            ]
        );

        $response->assertRedirect(route('roles.index'));

        // User record must still exist to avoid violating FK constraints
        $this->assertDatabaseHas('users', ['id' => $salesman->id]);

        $retiredUser = $salesman->fresh();
        $this->assertSame(AccountStatus::DISABLED, $retiredUser->status);
        $this->assertNull($retiredUser->remember_token);
        $this->assertNull($retiredUser->email_verified_at);

        // Order FK integrity remains valid
        $this->assertSame($salesman->id, $order->fresh()->created_by);
    }

    public function test_inertia_requests_receive_redirect_not_plain_json(): void
    {
        $target = User::factory()->create([
            'status' => AccountStatus::ACTIVE,
        ]);

        // Simulating Inertia request (X-Inertia: true with Accept: text/html, application/xhtml+xml)
        $response = $this->actingAs($this->superAdmin)
            ->withHeaders([
                'X-Inertia' => 'true',
                'Accept' => 'text/html, application/xhtml+xml',
            ])
            ->delete(route('users.destroy', $target), [
                'reason' => 'Clean removal via Inertia modal',
                'confirm' => true,
            ]);

        $response->assertRedirect(route('roles.index'));
        $response->assertSessionHas('status');
    }

    public function test_json_api_requests_receive_json_response(): void
    {
        $target = User::factory()->create([
            'status' => AccountStatus::ACTIVE,
        ]);

        // Pure JSON request (no X-Inertia header)
        $response = $this->actingAs($this->superAdmin)
            ->withHeaders([
                'Accept' => 'application/json',
            ])
            ->deleteJson(route('users.destroy', $target), [
                'reason' => 'Automated API deletion of test account',
                'confirm' => true,
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'deleted',
            'mode',
            'message',
        ]);
        $response->assertJson([
            'deleted' => true,
            'mode' => 'hard_deleted',
        ]);
    }
}
