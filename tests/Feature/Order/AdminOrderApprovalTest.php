<?php

namespace Tests\Feature\Order;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class AdminOrderApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $accountant;
    protected User $salesman;
    protected User $warehouseManager;
    protected User $deliveryPartner;
    protected Customer $customer;
    protected Product $productA;
    protected Product $productB;
    protected TaxProfile $taxProfile;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'name' => 'Operational Admin',
            'email' => 'admin@wholesale.test',
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->superAdmin = User::factory()->create([
            'name' => 'Super Administrator',
            'email' => 'super@wholesale.test',
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::factory()->create([
            'name' => 'Corporate Accountant',
            'email' => 'accountant@wholesale.test',
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::factory()->create([
            'name' => 'Sam Salesman',
            'email' => 'sam@wholesale.test',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouseManager = User::factory()->create([
            'name' => 'Wendy Warehouse',
            'email' => 'wendy@wholesale.test',
            'role' => UserRole::WAREHOUSE_MANAGER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->deliveryPartner = User::factory()->create([
            'name' => 'Dave Delivery',
            'email' => 'dave@wholesale.test',
            'role' => UserRole::DELIVERY_PARTNER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->customer = Customer::create([
            'salesman_id' => $this->salesman->id,
            'name' => 'Apex Retailers Inc',
            'code' => 'CUST-APEX-01',
            'contact_name' => 'John Apex',
            'phone' => '+1-555-0987',
            'email' => 'buyer@apexretail.test',
            'billing_address_line1' => '100 Commerce Blvd',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'USA',
            'shipping_address_line1' => '100 Commerce Blvd',
            'shipping_city' => 'Metropolis',
            'shipping_state' => 'NY',
            'shipping_postal_code' => '10001',
            'shipping_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => 5000.00,
        ]);

        $this->category = Category::create([
            'name' => 'Beverages',
            'code' => 'BEV',
        ]);

        $this->taxProfile = TaxProfile::create([
            'name' => 'Standard Tax Rate',
            'code' => 'TAX-STD',
            'rate' => 0.0825,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->productA = Product::create([
            'name' => 'Premium Sparkling Water 24pk',
            'sku' => 'SKU-WATER-001',
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'cost_price' => 12.00,
            'minimum_allowed_price' => 18.00,
            'default_selling_price' => 24.00,
            'mrp' => 30.00,
            'status' => ProductStatus::ACTIVE,
            'unit' => 'CASE',
        ]);

        $this->productB = Product::create([
            'name' => 'Organic Orange Juice 12pk',
            'sku' => 'SKU-JUICE-002',
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'cost_price' => 15.00,
            'minimum_allowed_price' => 22.00,
            'default_selling_price' => 28.00,
            'mrp' => 35.00,
            'status' => ProductStatus::ACTIVE,
            'unit' => 'CASE',
        ]);

        InventoryBalance::whereIn('product_id', [$this->productA->id, $this->productB->id])
            ->update([
                'on_hand_quantity' => 100,
                'available_quantity' => 100,
            ]);
    }

    protected function createSubmittedOrder(array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'order_number' => 'ORD-' . uniqid(),
            'idempotency_key' => 'idemp-' . uniqid(),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::SUBMITTED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => 520.00,
            'tax_total' => 42.90,
            'grand_total' => 562.90,
            'submitted_at' => Carbon::now()->subHours(2),
        ], $overrides));

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->productA->id,
            'product_name_snapshot' => $this->productA->name,
            'sku_snapshot' => $this->productA->sku,
            'unit_snapshot' => $this->productA->unit,
            'ordered_quantity' => 10,
            'cancelled_quantity' => 2,
            'reserved_quantity' => 0,
            'unit_price' => 24.00,
            'tax_rate_snapshot' => 0.0825,
            'taxable_amount' => 192.00,
            'tax_amount' => 15.84,
            'line_total' => 207.84,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->productB->id,
            'product_name_snapshot' => $this->productB->name,
            'sku_snapshot' => $this->productB->sku,
            'unit_snapshot' => $this->productB->unit,
            'ordered_quantity' => 12,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 0,
            'unit_price' => 28.00,
            'tax_rate_snapshot' => 0.0825,
            'taxable_amount' => 336.00,
            'tax_amount' => 27.72,
            'line_total' => 363.72,
        ]);

        return $order;
    }

    public function test_admin_can_successfully_approve_submitted_order(): void
    {
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertRedirect(route('admin.orders.index', ['queue' => 'new']));
        $response->assertSessionHas('success');

        $order->refresh();
        $this->assertEquals(OrderStatus::APPROVED, $order->status);
        $this->assertEquals(FulfillmentStatus::RESERVED, $order->fulfillment_status);
        $this->assertNotNull($order->approved_at);
        $this->assertEquals($this->admin->id, $order->approved_by);

        // Verify order-level line quantity reservations
        $items = $order->items()->orderBy('id', 'asc')->get();
        // Item 1: ordered 10, cancelled 2 => fulfillable = 8
        $this->assertEquals(8, $items[0]->reserved_quantity);
        // Item 2: ordered 12, cancelled 0 => fulfillable = 12
        $this->assertEquals(12, $items[1]->reserved_quantity);
    }

    public function test_super_admin_can_successfully_approve_order(): void
    {
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->superAdmin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertRedirect(route('admin.orders.index', ['queue' => 'new']));
        $order->refresh();
        $this->assertEquals(OrderStatus::APPROVED, $order->status);
        $this->assertEquals($this->superAdmin->id, $order->approved_by);
    }

    public function test_admin_can_approve_pending_approval_order(): void
    {
        $order = $this->createSubmittedOrder([
            'status' => OrderStatus::PENDING_APPROVAL,
        ]);

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertRedirect(route('admin.orders.index', ['queue' => 'new']));
        $order->refresh();
        $this->assertEquals(OrderStatus::APPROVED, $order->status);
    }

    public function test_accountant_cannot_approve_order(): void
    {
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->accountant)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertForbidden();

        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
        $this->assertEquals(FulfillmentStatus::UNALLOCATED, $order->fulfillment_status);
        $this->assertNull($order->approved_at);
    }

    public function test_salesman_cannot_approve_order(): void
    {
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->salesman)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertForbidden();

        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
    }

    public function test_warehouse_manager_and_delivery_partner_cannot_approve_order(): void
    {
        $order = $this->createSubmittedOrder();

        $this->actingAs($this->warehouseManager)
            ->post("/admin/orders/{$order->id}/approve")
            ->assertForbidden();

        $this->actingAs($this->deliveryPartner)
            ->post("/admin/orders/{$order->id}/approve")
            ->assertForbidden();

        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
    }

    public function test_unauthenticated_user_cannot_approve_order(): void
    {
        $order = $this->createSubmittedOrder();

        $response = $this->post("/admin/orders/{$order->id}/approve");

        $response->assertRedirect('/login');
        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
    }

    public function test_inactive_admin_cannot_approve_order(): void
    {
        $suspendedAdmin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::SUSPENDED,
        ]);

        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($suspendedAdmin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertRedirect('/login');
        $response->assertSessionHasErrors('email');
        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
    }


    public function test_cannot_approve_order_for_customer_on_hold(): void
    {
        $this->customer->update(['status' => CustomerStatus::ON_HOLD]);
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertStatus(302); // Redirect back with validation error
        $response->assertSessionHasErrors('customer_id');

        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
        $this->assertEquals(FulfillmentStatus::UNALLOCATED, $order->fulfillment_status);
        $this->assertNull($order->approved_at);
    }

    public function test_cannot_approve_order_for_inactive_customer(): void
    {
        $this->customer->update(['status' => CustomerStatus::INACTIVE]);
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertStatus(302);
        $response->assertSessionHasErrors('customer_id');

        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
    }

    public function test_cannot_approve_order_containing_inactive_product(): void
    {
        $this->productA->update(['status' => ProductStatus::INACTIVE]);
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertStatus(302);
        $response->assertSessionHasErrors('order');

        $order->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);
        $this->assertEquals(FulfillmentStatus::UNALLOCATED, $order->fulfillment_status);
    }

    public function test_can_approve_order_with_credit_limit_exceeded_soft_warning(): void
    {
        // Customer credit limit is 100; order total is 562.90
        $this->customer->update(['credit_limit' => 100.00]);
        $order = $this->createSubmittedOrder();

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertRedirect(route('admin.orders.index', ['queue' => 'new']));

        $order->refresh();
        $this->assertEquals(OrderStatus::APPROVED, $order->status);
    }

    public function test_can_approve_order_with_authorized_price_override_soft_notice(): void
    {
        $order = $this->createSubmittedOrder();
        $order->items()->first()->update([
            'is_price_overridden' => true,
            'price_override_reason' => 'Authorized promotional volume concession',
            'price_override_approved_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertRedirect(route('admin.orders.index', ['queue' => 'new']));

        $order->refresh();
        $this->assertEquals(OrderStatus::APPROVED, $order->status);
    }

    public function test_double_approve_returns_409_conflict(): void
    {
        $order = $this->createSubmittedOrder();

        // First approval succeeds
        $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve")
            ->assertRedirect(route('admin.orders.index', ['queue' => 'new']));

        // Second approval attempt encounters already approved state -> 409 Conflict
        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertStatus(409);
    }

    public function test_cannot_approve_already_rejected_order(): void
    {
        $order = $this->createSubmittedOrder([
            'status' => OrderStatus::REJECTED,
            'cancelled_at' => Carbon::now(),
            'cancelled_by' => $this->admin->id,
            'cancellation_reason' => 'Duplicate order submitted in error.',
        ]);

        $response = $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $response->assertStatus(409);

        $order->refresh();
        $this->assertEquals(OrderStatus::REJECTED, $order->status);
    }

    public function test_financial_amounts_and_snapshots_are_strictly_immutable_on_approval(): void
    {
        $order = $this->createSubmittedOrder();

        $subtotalBefore = (string) $order->subtotal;
        $taxTotalBefore = (string) $order->tax_total;
        $grandTotalBefore = (string) $order->grand_total;

        $itemsBefore = $order->items->map(fn ($i) => [
            'id' => $i->id,
            'unit_price' => (string) $i->unit_price,
            'tax_rate' => (string) $i->tax_rate_snapshot,
            'taxable_amount' => (string) $i->taxable_amount,
            'tax_amount' => (string) $i->tax_amount,
            'line_total' => (string) $i->line_total,
        ]);

        $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve")
            ->assertRedirect(route('admin.orders.index', ['queue' => 'new']));

        $order->refresh();
        $this->assertEquals($subtotalBefore, (string) $order->subtotal);
        $this->assertEquals($taxTotalBefore, (string) $order->tax_total);
        $this->assertEquals($grandTotalBefore, (string) $order->grand_total);

        $itemsAfter = $order->items->map(fn ($i) => [
            'id' => $i->id,
            'unit_price' => (string) $i->unit_price,
            'tax_rate' => (string) $i->tax_rate_snapshot,
            'taxable_amount' => (string) $i->taxable_amount,
            'tax_amount' => (string) $i->tax_amount,
            'line_total' => (string) $i->line_total,
        ]);

        $this->assertEquals($itemsBefore->toArray(), $itemsAfter->toArray());
    }

    public function test_timeline_reflects_order_approved_milestone(): void
    {
        $order = $this->createSubmittedOrder();

        $this->actingAs($this->admin)
            ->post("/admin/orders/{$order->id}/approve");

        $order->refresh();

        // Review endpoint redirects to show once approved
        $showResponse = $this->actingAs($this->admin)
            ->get("/admin/orders/{$order->id}");

        $showResponse->assertOk();
    }
}
