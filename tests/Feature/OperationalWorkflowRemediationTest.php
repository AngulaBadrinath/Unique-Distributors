<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\AdjustmentReasonCode;
use App\Enums\AdjustmentStatus;
use App\Enums\CustomerStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\InventoryMovementType;
use App\Enums\InventoryStockState;
use App\Enums\OrderAdjustmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Adjustment\OrderAdjustmentWorkflowService;
use App\Services\Order\OrderWorkflowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OperationalWorkflowRemediationTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $admin;
    protected User $salesmanA;
    protected User $salesmanB;
    protected Warehouse $warehouse;
    protected TaxProfile $standardTax;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('ValidPassword123!'),
        ]);

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('ValidPassword123!'),
        ]);

        $this->salesmanA = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('ValidPassword123!'),
        ]);

        $this->salesmanB = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('ValidPassword123!'),
        ]);

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Distribution Hub',
                'address_line1' => '100 Main Logistics Way',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country' => 'US',
                'is_active' => true,
            ]
        );

        $this->standardTax = TaxProfile::firstOrCreate(
            ['code' => 'STANDARD'],
            [
                'name' => 'Standard Rate (10%)',
                'rate' => '10.0000',
                'status' => \App\Enums\TaxProfileStatus::ACTIVE,
            ]
        );
    }

    protected function createProduct(string $sku, int $onHand = 100, int $reserved = 0): Product
    {
        $product = Product::create([
            'sku' => $sku,
            'name' => 'Product ' . $sku,
            'cost_price' => 15.00,
            'minimum_allowed_price' => 18.00,
            'default_selling_price' => 20.00,
            'mrp' => 25.00,
            'tax_profile_id' => $this->standardTax->id,
            'status' => \App\Enums\ProductStatus::ACTIVE,
            'unit' => 'EA',
        ]);

        InventoryBalance::updateOrCreate(
            [
                'warehouse_id' => $this->warehouse->id,
                'product_id' => $product->id,
            ],
            [
                'on_hand_quantity' => $onHand,
                'reserved_quantity' => $reserved,
                'damaged_quantity' => 0,
                'available_quantity' => $onHand - $reserved,
                'version' => 1,
            ]
        );

        return $product;
    }

    protected function createCustomer(User $salesman): Customer
    {
        static $c = 1000;
        $c++;

        return Customer::create([
            'code' => 'CUST-' . $c,
            'name' => 'Customer Corp ' . $c,
            'contact_name' => 'John Doe',
            'email' => "cust{$c}@example.com",
            'phone' => '+1555123456',
            'billing_address_line1' => '100 Commercial St',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'credit_limit' => 50000.00,
            'payment_terms' => PaymentTerms::NET_30,
            'status' => CustomerStatus::ACTIVE,
            'salesman_id' => $salesman->id,
        ]);
    }

    // =========================================================================
    // PART 3: Salesman Customer Onboarding
    // =========================================================================

    public function test_salesman_can_onboard_customer_with_automatic_salesman_id_assignment(): void
    {
        $response = $this->actingAs($this->salesmanA)->get(route('customers.create'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Customer/Create')
            ->where('isSalesman', true)
            ->where('eligibleSalesmen', [])
        );

        $payload = [
            'code' => 'CUST-SLM-AUTO-01',
            'name' => 'Acme Wholesale Stores',
            'contact_name' => 'Alice Manager',
            'email' => 'alice@acmestores.com',
            'phone' => '+1 (555) 333-2211',
            'billing_address_line1' => '400 Wholesale Blvd',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'credit_limit' => 20000.00,
            'payment_terms' => PaymentTerms::NET_30->value,
            'status' => CustomerStatus::ACTIVE->value,
            // Malicious payload attempting to assign Salesman B
            'salesman_id' => $this->salesmanB->id,
        ];

        $postResponse = $this->actingAs($this->salesmanA)->post(route('customers.store'), $payload);
        $postResponse->assertRedirect();

        $customer = Customer::where('code', 'CUST-SLM-AUTO-01')->first();
        $this->assertNotNull($customer);
        // Authoritatively bound to authenticated salesman
        $this->assertEquals($this->salesmanA->id, $customer->salesman_id);
    }

    public function test_salesman_cannot_view_or_edit_another_salesmans_customer(): void
    {
        $customerB = $this->createCustomer($this->salesmanB);

        // Salesman A cannot view Customer B
        $this->actingAs($this->salesmanA)->get(route('customers.show', $customerB))->assertForbidden();

        // Salesman A cannot edit Customer B
        $this->actingAs($this->salesmanA)->get(route('customers.edit', $customerB))->assertForbidden();

        // Salesman A cannot update Customer B
        $this->actingAs($this->salesmanA)->put(route('customers.update', $customerB), [
            'name' => 'Tampered Customer Name',
        ])->assertForbidden();
    }

    protected function createOrder(array $attributes = []): Order
    {
        static $orderSeq = 1000;
        $orderSeq++;

        return Order::create(array_merge([
            'order_number' => 'ORD-TEST-' . $orderSeq,
            'customer_id' => $this->createCustomer($this->salesmanA)->id,
            'salesman_id' => $this->salesmanA->id,
            'created_by' => $this->salesmanA->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'delivery_status' => DeliveryStatus::PENDING_ASSIGNMENT,
            'adjustment_status' => AdjustmentStatus::NONE,
            'subtotal' => '200.00',
            'tax_total' => '20.00',
            'grand_total' => '220.00',
            'adjustment_total' => '0.00',
            'payment_terms' => PaymentTerms::NET_30,
            'version' => 1,
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
        ], $attributes));
    }

    protected function createOrderItem(Order $order, Product $product, array $attributes = []): OrderItem
    {
        return OrderItem::create(array_merge([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'unit_snapshot' => 'EA',
            'tax_rate_snapshot' => '10.0000',
            'ordered_quantity' => 10,
            'cancelled_quantity' => 0,
            'increased_quantity' => 0,
            'delivered_quantity' => 0,
            'unit_price' => '20.00',
            'taxable_amount' => '200.00',
            'tax_amount' => '20.00',
            'line_total' => '220.00',
        ], $attributes));
    }

    // =========================================================================
    // PART 5: Return Create Route HTTP 500 Fix
    // =========================================================================

    public function test_admin_return_create_page_renders_successfully_200(): void
    {
        $product = $this->createProduct('SKU-RET-01', 50, 0);
        $customer = $this->createCustomer($this->salesmanA);

        $order = $this->createOrder([
            'order_number' => 'ORD-RET-TEST-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'status' => OrderStatus::PROCESSING,
            'fulfillment_status' => FulfillmentStatus::DELIVERED,
            'payment_status' => PaymentStatus::PAID,
            'delivery_status' => DeliveryStatus::DELIVERED,
        ]);

        $this->createOrderItem($order, $product, [
            'delivered_quantity' => 10,
        ]);

        $response = $this->actingAs($this->admin)->get('/admin/returns/create');
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Returns/Create')
            ->has('eligibleOrders')
        );
    }

    // =========================================================================
    // PART 6: Symmetric Quantity Adjustments (+ and -)
    // =========================================================================

    public function test_quantity_increase_adjustment_workflow_reserves_stock_and_updates_totals(): void
    {
        $product = $this->createProduct('SKU-INC-01', 100, 10);
        $customer = $this->createCustomer($this->salesmanA);

        $order = $this->createOrder([
            'order_number' => 'ORD-INC-TEST-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'status' => OrderStatus::APPROVED,
        ]);

        $item = $this->createOrderItem($order, $product);

        // 1. Submit Increase Adjustment (+5 units)
        $submitResponse = $this->actingAs($this->salesmanA)->post("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'inc-adj-key-1',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'notes' => 'Customer requested adding 5 additional units to the order.',
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'action_type' => 'INCREASE',
                    'requested_quantity_increase' => 5,
                ],
            ],
        ]);
        $submitResponse->assertRedirect();

        $adj = OrderAdjustment::where('order_id', $order->id)->first();
        $this->assertNotNull($adj);
        $this->assertEquals(OrderAdjustmentStatus::SUBMITTED, $adj->status);
        $this->assertEquals('100.00', (string) $adj->projected_subtotal_addition);
        $this->assertEquals('10.00', (string) $adj->projected_tax_addition);
        $this->assertEquals('110.00', (string) $adj->projected_grand_total_addition);

        // 2. Admin Approves Adjustment
        $approveResponse = $this->actingAs($this->admin)->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/approve");
        $approveResponse->assertRedirect();
        $this->assertEquals(OrderAdjustmentStatus::APPROVED, $adj->fresh()->status);

        // 3. Admin Applies Adjustment
        $applyResponse = $this->actingAs($this->admin)->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/apply");
        $applyResponse->assertRedirect();

        $adj->refresh();
        $this->assertEquals(OrderAdjustmentStatus::APPLIED, $adj->status);

        $item->refresh();
        // RULE-DOM-001: ordered_quantity remains immutable 10!
        $this->assertEquals(10, $item->ordered_quantity);
        $this->assertEquals(5, $item->increased_quantity);
        $this->assertEquals(0, $item->cancelled_quantity);
        $this->assertEquals(15, $item->fulfillableQuantity());

        // Line financials updated from authoritative price snapshot
        $this->assertEquals('300.00', (string) $item->taxable_amount);
        $this->assertEquals('30.00', (string) $item->tax_amount);
        $this->assertEquals('330.00', (string) $item->line_total);

        // Inventory reserved: was 10, now 10 + 5 = 15 reserved
        $balance = InventoryBalance::where('product_id', $product->id)->first();
        $this->assertEquals(15, $balance->reserved_quantity);
        $this->assertEquals(85, $balance->available_quantity);

        // Movement logged
        $movement = InventoryMovement::where('reference_id', $adj->id)->first();
        $this->assertNotNull($movement);
        $this->assertEquals(InventoryMovementType::RESERVATION, $movement->movement_type);
        $this->assertEquals(5, $movement->quantity);

        // Order financials updated
        $order->refresh();
        $this->assertEquals('300.00', (string) $order->subtotal);
        $this->assertEquals('30.00', (string) $order->tax_total);
        $this->assertEquals('330.00', (string) $order->grand_total);
    }

    public function test_insufficient_inventory_blocks_quantity_increase(): void
    {
        // Only 2 available in inventory
        $product = $this->createProduct('SKU-SHORT-01', 10, 8); // on_hand: 10, reserved: 8 => available: 2
        $customer = $this->createCustomer($this->salesmanA);

        $order = $this->createOrder([
            'order_number' => 'ORD-SHORT-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'subtotal' => '40.00',
            'tax_total' => '4.00',
            'grand_total' => '44.00',
        ]);

        $item = $this->createOrderItem($order, $product, [
            'ordered_quantity' => 2,
            'taxable_amount' => '40.00',
            'tax_amount' => '4.00',
            'line_total' => '44.00',
        ]);

        // Attempting to request increase of 10 (exceeds 2 available)
        $response = $this->actingAs($this->salesmanA)->post("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'short-adj-key-1',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'action_type' => 'INCREASE',
                    'requested_quantity_increase' => 10,
                ],
            ],
        ]);

        $response->assertSessionHasErrors(["items.{$item->id}"]);
    }

    public function test_positive_adjustment_rejected_on_completed_order(): void
    {
        $product = $this->createProduct('SKU-CMP-01', 50, 0);
        $customer = $this->createCustomer($this->salesmanA);

        $order = $this->createOrder([
            'order_number' => 'ORD-CMP-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'status' => OrderStatus::COMPLETED,
            'fulfillment_status' => FulfillmentStatus::DELIVERED,
            'payment_status' => PaymentStatus::PAID,
            'delivery_status' => DeliveryStatus::DELIVERED,
        ]);

        $item = $this->createOrderItem($order, $product);

        $response = $this->actingAs($this->salesmanA)->post("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'cmp-adj-key-1',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'action_type' => 'INCREASE',
                    'requested_quantity_increase' => 2,
                ],
            ],
        ]);

        $response->assertStatus(409);
    }

    // =========================================================================
    // PART 7: Automatic Order Completion Gate
    // =========================================================================

    public function test_automatic_order_completion_gate_closes_order_when_fully_paid_and_delivered(): void
    {
        $product = $this->createProduct('SKU-AUTO-CMP-01', 50, 0);
        $customer = $this->createCustomer($this->salesmanA);

        $order = $this->createOrder([
            'order_number' => 'ORD-AUTO-CMP-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'status' => OrderStatus::PROCESSING,
            'fulfillment_status' => FulfillmentStatus::DELIVERED,
            'payment_status' => PaymentStatus::PAID,
            'delivery_status' => DeliveryStatus::DELIVERED,
        ]);

        $this->createOrderItem($order, $product, [
            'delivered_quantity' => 10,
        ]);

        $orderWorkflowService = app(OrderWorkflowService::class);
        $completed = $orderWorkflowService->evaluateAndCompleteOrder($order, $this->admin);

        $this->assertTrue($completed);
        $this->assertEquals(OrderStatus::COMPLETED, $order->fresh()->status);
        $this->assertNotNull($order->fresh()->completed_at);
    }

    public function test_order_completion_blocked_if_unpaid(): void
    {
        $product = $this->createProduct('SKU-UNPAID-01', 50, 0);
        $customer = $this->createCustomer($this->salesmanA);

        $order = $this->createOrder([
            'order_number' => 'ORD-UNPAID-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'status' => OrderStatus::PROCESSING,
            'fulfillment_status' => FulfillmentStatus::DELIVERED,
            'payment_status' => PaymentStatus::UNPAID, // NOT PAID
            'delivery_status' => DeliveryStatus::DELIVERED,
        ]);

        $this->createOrderItem($order, $product, [
            'delivered_quantity' => 10,
        ]);

        $orderWorkflowService = app(OrderWorkflowService::class);
        $completed = $orderWorkflowService->evaluateAndCompleteOrder($order, $this->admin);

        $this->assertFalse($completed);
        $this->assertEquals(OrderStatus::PROCESSING, $order->fresh()->status);
    }

    public function test_order_completion_blocked_if_items_partially_delivered(): void
    {
        $product = $this->createProduct('SKU-PARTIAL-01', 50, 0);
        $customer = $this->createCustomer($this->salesmanA);

        $order = $this->createOrder([
            'order_number' => 'ORD-PARTIAL-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'status' => OrderStatus::PROCESSING,
            'fulfillment_status' => FulfillmentStatus::DELIVERED,
            'payment_status' => PaymentStatus::PAID,
            'delivery_status' => DeliveryStatus::DELIVERED,
        ]);

        $this->createOrderItem($order, $product, [
            'delivered_quantity' => 7, // 3 units remain undelivered!
        ]);

        $orderWorkflowService = app(OrderWorkflowService::class);
        $completed = $orderWorkflowService->evaluateAndCompleteOrder($order, $this->admin);

        $this->assertFalse($completed);
        $this->assertEquals(OrderStatus::PROCESSING, $order->fresh()->status);
    }

    // =========================================================================
    // PART 8: Canonical Fallback Redirect for Invoice Order Links
    // =========================================================================

    public function test_legacy_order_link_redirects_to_canonical_admin_order_route(): void
    {
        $customer = $this->createCustomer($this->salesmanA);
        $order = $this->createOrder([
            'order_number' => 'ORD-REDIR-01',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanA->id,
            'status' => OrderStatus::APPROVED,
            'subtotal' => '100.00',
            'tax_total' => '10.00',
            'grand_total' => '110.00',
        ]);

        // Acting as Admin accessing /orders/{id}
        $response = $this->actingAs($this->admin)->get("/orders/{$order->id}");
        $response->assertRedirect("/admin/orders/{$order->id}");

        // Acting as Salesman accessing /orders/{id}
        $salesmanResponse = $this->actingAs($this->salesmanA)->get("/orders/{$order->id}");
        $salesmanResponse->assertRedirect("/salesman/orders/{$order->id}");
    }
}
