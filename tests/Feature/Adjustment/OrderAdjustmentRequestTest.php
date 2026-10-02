<?php

namespace Tests\Feature\Adjustment;

use App\Enums\AccountStatus;
use App\Enums\AdjustmentReasonCode;
use App\Enums\AdjustmentStatus;
use App\Enums\AllocationStatus;
use App\Enums\CustomerStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderAdjustmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderAdjustmentRequestTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $salesmanA;
    protected User $salesmanB;
    protected User $warehouseManager;
    protected User $accountant;
    protected User $deliveryPartner;

    protected Customer $customerA;
    protected Customer $customerB;
    protected Category $category;
    protected TaxProfile $taxProfileStandard;
    protected TaxProfile $taxProfileExempt;
    protected Product $productStandard;
    protected Product $productExempt;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'name' => 'Super Admin',
            'email' => 'super@wholesale.test',
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->admin = User::factory()->create([
            'name' => 'Alice Admin',
            'email' => 'admin@wholesale.test',
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesmanA = User::factory()->create([
            'name' => 'Salesman One',
            'email' => 'sales1@wholesale.test',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesmanB = User::factory()->create([
            'name' => 'Salesman Two',
            'email' => 'sales2@wholesale.test',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouseManager = User::factory()->create([
            'name' => 'Warehouse Wendy',
            'email' => 'warehouse@wholesale.test',
            'role' => UserRole::WAREHOUSE_MANAGER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::factory()->create([
            'name' => 'Bob Accountant',
            'email' => 'accountant@wholesale.test',
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->deliveryPartner = User::factory()->create([
            'name' => 'Dave Delivery',
            'email' => 'delivery@wholesale.test',
            'role' => UserRole::DELIVERY_PARTNER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->customerA = Customer::create([
            'salesman_id' => $this->salesmanA->id,
            'name' => 'Metro Retail A',
            'code' => 'CUST-A-001',
            'contact_name' => 'Alice Client',
            'phone' => '+1-555-1001',
            'email' => 'metro_a@wholesale.test',
            'billing_address_line1' => '100 Broadway',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'USA',
            'shipping_address_line1' => '100 Broadway',
            'shipping_city' => 'Metropolis',
            'shipping_state' => 'NY',
            'shipping_postal_code' => '10001',
            'shipping_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => 50000.00,
        ]);

        $this->customerB = Customer::create([
            'salesman_id' => $this->salesmanB->id,
            'name' => 'Metro Retail B',
            'code' => 'CUST-B-001',
            'contact_name' => 'Bob Client',
            'phone' => '+1-555-2002',
            'email' => 'metro_b@wholesale.test',
            'billing_address_line1' => '200 Broadway',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10002',
            'billing_country' => 'USA',
            'shipping_address_line1' => '200 Broadway',
            'shipping_city' => 'Metropolis',
            'shipping_state' => 'NY',
            'shipping_postal_code' => '10002',
            'shipping_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => 50000.00,
        ]);

        $this->category = Category::create([
            'name' => 'General Provisions',
            'code' => 'GEN-PROV',
        ]);

        $this->taxProfileStandard = TaxProfile::create([
            'name' => 'Standard Rate 10%',
            'code' => 'STD-10',
            'rate' => 10.00,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->taxProfileExempt = TaxProfile::create([
            'name' => 'Zero Tax Exempt',
            'code' => 'ZERO-EX',
            'rate' => 0.00,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->productStandard = Product::create([
            'name' => 'Wheat Flour 25kg',
            'sku' => 'SKU-WHEAT-25',
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfileStandard->id,
            'cost_price' => 15.00,
            'minimum_allowed_price' => 18.00,
            'default_selling_price' => 20.00,
            'mrp' => 25.00,
            'status' => ProductStatus::ACTIVE,
            'unit' => 'BAG',
        ]);

        $this->productExempt = Product::create([
            'name' => 'Table Salt 1kg Pack',
            'sku' => 'SKU-SALT-01',
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfileExempt->id,
            'cost_price' => 1.00,
            'minimum_allowed_price' => 1.20,
            'default_selling_price' => 1.50,
            'mrp' => 2.00,
            'status' => ProductStatus::ACTIVE,
            'unit' => 'PACK',
        ]);
    }

    protected function createOrder(
        Customer $customer,
        User $salesman,
        OrderStatus $status = OrderStatus::SUBMITTED,
        array $itemsData = []
    ): Order {
        if (empty($itemsData)) {
            $itemsData = [
                [
                    'product' => $this->productStandard,
                    'quantity' => 10,
                    'price' => 20.00,
                    'tax_rate' => 10.00,
                ],
            ];
        }

        $subtotal = 0.00;
        $taxTotal = 0.00;

        foreach ($itemsData as $data) {
            $lineSubtotal = $data['quantity'] * $data['price'];
            $lineTax = $lineSubtotal * ($data['tax_rate'] / 100);
            $subtotal += $lineSubtotal;
            $taxTotal += $lineTax;
        }

        $order = Order::create([
            'order_number' => 'ORD-' . strtoupper(uniqid()),
            'idempotency_key' => 'idemp-' . uniqid(),
            'customer_id' => $customer->id,
            'salesman_id' => $salesman->id,
            'created_by' => $salesman->id,
            'status' => $status,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'adjustment_status' => AdjustmentStatus::NONE,
            'currency' => 'USD',
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'adjustment_total' => 0.00,
            'grand_total' => $subtotal + $taxTotal,
            'submitted_at' => $status !== OrderStatus::DRAFT ? Carbon::now()->subHours(2) : null,
        ]);

        foreach ($itemsData as $data) {
            $prod = $data['product'];
            $qty = $data['quantity'];
            $price = $data['price'];
            $taxRate = $data['tax_rate'];
            $taxable = $qty * $price;
            $taxAmt = $taxable * ($taxRate / 100);

            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $prod->id,
                'product_name_snapshot' => $prod->name,
                'sku_snapshot' => $prod->sku,
                'unit_snapshot' => $prod->unit,
                'ordered_quantity' => $qty,
                'cancelled_quantity' => 0,
                'reserved_quantity' => $data['reserved_quantity'] ?? 0,
                'picked_quantity' => 0,
                'dispatched_quantity' => 0,
                'delivered_quantity' => 0,
                'returned_quantity' => 0,
                'unit_price' => $price,
                'is_price_overridden' => false,
                'tax_profile_id_snapshot' => $prod->tax_profile_id,
                'tax_profile_code_snapshot' => $taxRate > 0 ? 'STD-10' : 'ZERO-EX',
                'tax_profile_name_snapshot' => $taxRate > 0 ? 'Standard 10%' : 'Zero Exempt',
                'tax_rate_snapshot' => $taxRate,
                'taxable_amount' => $taxable,
                'tax_amount' => $taxAmt,
                'line_total' => $taxable + $taxAmt,
            ]);
        }

        return $order;
    }

    public function test_admin_can_create_valid_adjustment_request_case_a(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload = [
            'idempotency_key' => 'idemp-adj-001',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'notes' => 'Customer requested 3 bags reduction due to storage limit.',
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 3,
                ],
            ],
        ];

        $response = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('adjustment.status', OrderAdjustmentStatus::SUBMITTED->value);
        $response->assertJsonPath('adjustment.items.0.requested_quantity_reduction', 3);
        $response->assertJsonPath('adjustment.items.0.affected_allocation_quantity', 0);
        $response->assertJsonPath('adjustment.items.0.is_case_b', false);

        // Verify sequence format: ADJ-{order_number}-01
        $cleanOrderNum = preg_replace('/[^A-Za-z0-9]/', '', $order->order_number);
        $this->assertEquals("ADJ-{$cleanOrderNum}-01", $response->json('adjustment.adjustment_number'));

        // Verify database persistence
        $this->assertDatabaseHas('order_adjustments', [
            'order_id' => $order->id,
            'status' => OrderAdjustmentStatus::SUBMITTED->value,
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'requested_by' => $this->admin->id,
        ]);

        $this->assertDatabaseHas('order_adjustment_items', [
            'order_item_id' => $item->id,
            'requested_quantity_reduction' => 3,
            'affected_allocation_quantity' => 0,
        ]);

        // Verify orders.adjustment_status updated to REQUESTED
        $order->refresh();
        $this->assertEquals(AdjustmentStatus::REQUESTED, $order->adjustment_status);

        // CRITICAL INVARIANT: Order baseline totals and item quantities MUST NOT be mutated!
        $this->assertEquals('200.00', (string) $order->subtotal);
        $this->assertEquals('20.00', (string) $order->tax_total);
        $this->assertEquals('0.00', (string) $order->adjustment_total);
        $this->assertEquals('220.00', (string) $order->grand_total);
        $this->assertEquals(10, $item->fresh()->ordered_quantity);
        $this->assertEquals(0, $item->fresh()->cancelled_quantity);
    }

    public function test_multi_line_adjustment_request_with_mixed_tax(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED, [
            [
                'product' => $this->productStandard,
                'quantity' => 10,
                'price' => 20.00,
                'tax_rate' => 10.00,
            ],
            [
                'product' => $this->productExempt,
                'quantity' => 50,
                'price' => 1.50,
                'tax_rate' => 0.00,
            ],
        ]);

        $itemStandard = $order->items->firstWhere('product_id', $this->productStandard->id);
        $itemExempt = $order->items->firstWhere('product_id', $this->productExempt->id);

        $payload = [
            'idempotency_key' => 'idemp-multi-001',
            'reason_code' => AdjustmentReasonCode::WAREHOUSE_DAMAGE->value,
            'notes' => 'Damaged during unloading.',
            'items' => [
                [
                    'order_item_id' => $itemStandard->id,
                    'requested_quantity_reduction' => 2, // 2 * $20 = $40 subtotal, $4 tax
                ],
                [
                    'order_item_id' => $itemExempt->id,
                    'requested_quantity_reduction' => 10, // 10 * $1.50 = $15 subtotal, $0 tax
                ],
            ],
        ];

        $response = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);

        $response->assertStatus(201);
        $adj = $response->json('adjustment');

        // Projected subtotal: 40 + 15 = 55.00
        $this->assertEquals('55.00', $adj['projected_subtotal_reduction']);
        // Projected tax: 4.00
        $this->assertEquals('4.00', $adj['projected_tax_reduction']);
        // Projected grand total: 59.00
        $this->assertEquals('59.00', $adj['projected_grand_total_reduction']);

        $this->assertCount(2, $adj['items']);
    }

    public function test_case_b_classification_when_reduction_exceeds_unallocated(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::APPROVED, [
            [
                'product' => $this->productStandard,
                'quantity' => 10,
                'price' => 20.00,
                'tax_rate' => 10.00,
                'reserved_quantity' => 7,
            ],
        ]);

        $item = $order->items->first();

        // Create an allocation of 7 units for this item
        OrderItemAllocation::create([
            'order_id' => $order->id,
            'order_item_id' => $item->id,
            'product_id' => $item->product_id,
            'allocation_number' => 'ALC-TEST-001',
            'allocated_quantity' => 7,
            'reserved_quantity' => 7,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
            'status' => AllocationStatus::RESERVED,
            'warehouse_code' => 'WH-MAIN',
        ]);

        // Fulfillable = 10, Allocated = 7, Unallocated = 3.
        // If reduction = 5:
        // reduction (5) > unallocated (3) => Case B
        // affected_allocation_quantity = 5 - 3 = 2
        $payload = [
            'idempotency_key' => 'idemp-case-b-01',
            'reason_code' => AdjustmentReasonCode::STOCKOUT_DEFECT->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 5,
                ],
            ],
        ];

        $response = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('adjustment.items.0.affected_allocation_quantity', 2);
        $response->assertJsonPath('adjustment.items.0.is_case_b', true);

        // CRITICAL: ACTIVE ALLOCATION MUST NOT BE MUTATED IN FEAT-ADJ-001
        $allocation = OrderItemAllocation::where('order_item_id', $item->id)->first();
        $this->assertEquals(7, $allocation->allocated_quantity);
        $this->assertEquals(7, $allocation->reserved_quantity);
        $this->assertEquals(AllocationStatus::RESERVED, $allocation->status);
    }

    public function test_salesman_can_request_adjustment_for_their_own_order(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload = [
            'idempotency_key' => 'idemp-salesman-own',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 1,
                ],
            ],
        ];

        $response = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", $payload);
        $response->assertStatus(201);
    }

    public function test_salesman_cannot_request_adjustment_for_another_salesman_order(): void
    {
        // Order belongs to salesman B
        $order = $this->createOrder($this->customerB, $this->salesmanB, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload = [
            'idempotency_key' => 'idemp-salesman-idor',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 1,
                ],
            ],
        ];

        // Salesman A attempts to adjust Salesman B's order => 404 Not Found (Fail-closed anti-IDOR convention)
        $response = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", $payload);
        $this->assertTrue(in_array($response->status(), [403, 404], true));
    }

    public function test_warehouse_manager_can_request_adjustment_on_approved_or_processing_orders(): void
    {
        $orderApproved = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::APPROVED);
        $item = $orderApproved->items->first();

        $payload = [
            'idempotency_key' => 'idemp-wh-app',
            'reason_code' => AdjustmentReasonCode::WAREHOUSE_DAMAGE->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 1,
                ],
            ],
        ];

        $response = $this->actingAs($this->warehouseManager)->postJson("/orders/{$orderApproved->id}/adjustments", $payload);
        $response->assertStatus(201);
    }

    public function test_warehouse_manager_cannot_request_adjustment_on_submitted_order(): void
    {
        // SUBMITTED orders are in commercial sales/credit review, not warehouse hands
        $orderSubmitted = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $orderSubmitted->items->first();

        $payload = [
            'idempotency_key' => 'idemp-wh-sub',
            'reason_code' => AdjustmentReasonCode::WAREHOUSE_DAMAGE->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 1,
                ],
            ],
        ];

        $response = $this->actingAs($this->warehouseManager)->postJson("/orders/{$orderSubmitted->id}/adjustments", $payload);
        $response->assertStatus(403);
    }

    public function test_unauthorized_roles_are_rejected(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload = [
            'idempotency_key' => 'idemp-unauth',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 1,
                ],
            ],
        ];

        // Accountant
        $resAccountant = $this->actingAs($this->accountant)->postJson("/orders/{$order->id}/adjustments", $payload);
        $resAccountant->assertStatus(403);

        // Delivery Partner
        $resDelivery = $this->actingAs($this->deliveryPartner)->postJson("/orders/{$order->id}/adjustments", $payload);
        $resDelivery->assertStatus(403);
    }

    public function test_order_lifecycle_validation_rejects_disallowed_states(): void
    {
        $disallowedStatuses = [
            OrderStatus::DRAFT,
            OrderStatus::COMPLETED,
            OrderStatus::CANCELLED,
            OrderStatus::REJECTED,
        ];

        foreach ($disallowedStatuses as $status) {
            $order = $this->createOrder($this->customerA, $this->salesmanA, $status);
            $item = $order->items->first();

            $payload = [
                'idempotency_key' => 'idemp-life-' . $status->value,
                'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
                'items' => [
                    [
                        'order_item_id' => $item->id,
                        'requested_quantity_reduction' => 1,
                    ],
                ],
            ];

            $response = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);
            $response->assertStatus(409);
        }
    }

    public function test_zero_or_negative_quantity_is_rejected(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payloadZero = [
            'idempotency_key' => 'idemp-zero',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 0,
                ],
            ],
        ];

        $response = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payloadZero);
        $response->assertStatus(422);
    }

    public function test_reduction_exceeding_fulfillable_quantity_is_rejected(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first(); // fulfillable = 10

        $payload = [
            'idempotency_key' => 'idemp-overflow',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 11, // > 10
                ],
            ],
        ];

        $response = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(["items.{$item->id}"]);
    }

    public function test_exact_full_line_reduction_is_permitted(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first(); // fulfillable = 10

        $payload = [
            'idempotency_key' => 'idemp-exact-full',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 10,
                ],
            ],
        ];

        $response = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);
        $response->assertStatus(201);
        $response->assertJsonPath('adjustment.items.0.requested_quantity_reduction', 10);
    }

    public function test_single_open_request_invariant_rejects_second_concurrent_submission(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        // 1st request
        $payload1 = [
            'idempotency_key' => 'idemp-first',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 2,
                ],
            ],
        ];
        $res1 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload1);
        $res1->assertStatus(201);

        // 2nd request while 1st is still SUBMITTED
        $payload2 = [
            'idempotency_key' => 'idemp-second',
            'reason_code' => AdjustmentReasonCode::WAREHOUSE_DAMAGE->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 1,
                ],
            ],
        ];
        $res2 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload2);
        $res2->assertStatus(409);
        $this->assertStringContainsString('already pending', $res2->json('message'));
    }

    public function test_idempotent_replay_returns_same_adjustment(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload = [
            'idempotency_key' => 'idemp-deterministic-key-1',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'notes' => 'Customer call on Sep 5.',
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 2,
                ],
            ],
        ];

        // 1st call -> 201 Created
        $res1 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);
        $res1->assertStatus(201);
        $adj1Id = $res1->json('adjustment.id');

        // 2nd call with identical key, actor, and payload -> Idempotent Replay
        $res2 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);
        $res2->assertStatus(200);
        $res2->assertJsonPath('is_replay', true);
        $this->assertEquals($adj1Id, $res2->json('adjustment.id'));

        // Verify only 1 database record exists
        $this->assertEquals(1, OrderAdjustment::where('order_id', $order->id)->count());
    }

    public function test_idempotency_conflict_rejects_mismatched_payload(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload1 = [
            'idempotency_key' => 'idemp-conflict-test',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 2,
                ],
            ],
        ];

        $res1 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload1);
        $res1->assertStatus(201);

        // Same idempotency key but different payload (different reduction qty)
        $payload2 = [
            'idempotency_key' => 'idemp-conflict-test',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 4, // different!
                ],
            ],
        ];

        $res2 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload2);
        $res2->assertStatus(409);
        $this->assertStringContainsString('different payload', $res2->json('message'));
    }

    public function test_idempotency_conflict_rejects_different_actor(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload = [
            'idempotency_key' => 'idemp-diff-actor',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 2,
                ],
            ],
        ];

        // Salesman A creates it
        $res1 = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", $payload);
        $res1->assertStatus(201);

        // Admin submits the same idempotency key
        $res2 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", $payload);
        $res2->assertStatus(409);
    }

    public function test_adjustment_number_sequence_increments_monotonically(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();
        $cleanOrderNum = preg_replace('/[^A-Za-z0-9]/', '', $order->order_number);

        // 1st request
        $res1 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'idemp-seq-1',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [['order_item_id' => $item->id, 'requested_quantity_reduction' => 1]],
        ]);
        $res1->assertStatus(201);
        $this->assertEquals("ADJ-{$cleanOrderNum}-01", $res1->json('adjustment.adjustment_number'));
        $adj1Id = $res1->json('adjustment.id');

        // Withdraw 1st request to allow a 2nd request
        $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments/{$adj1Id}/withdraw", [
            'reason' => 'Withdrawing 1st',
        ])->assertStatus(200);

        // 2nd request
        $res2 = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'idemp-seq-2',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [['order_item_id' => $item->id, 'requested_quantity_reduction' => 1]],
        ]);
        $res2->assertStatus(201);
        // Sequence must increment to 02!
        $this->assertEquals("ADJ-{$cleanOrderNum}-02", $res2->json('adjustment.adjustment_number'));
    }

    public function test_requester_can_withdraw_submitted_adjustment_request(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $createRes = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'idemp-with-01',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [['order_item_id' => $item->id, 'requested_quantity_reduction' => 2]],
        ]);
        $createRes->assertStatus(201);
        $adjId = $createRes->json('adjustment.id');

        $this->assertEquals(AdjustmentStatus::REQUESTED, $order->fresh()->adjustment_status);

        // Requester salesman A withdraws it
        $withdrawRes = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments/{$adjId}/withdraw", [
            'reason' => 'Customer changed mind and wants full quantity.',
        ]);

        $withdrawRes->assertStatus(200);
        $withdrawRes->assertJsonPath('success', true);
        $withdrawRes->assertJsonPath('adjustment.status', OrderAdjustmentStatus::CANCELLED->value);

        // Verify database
        $adjustment = OrderAdjustment::find($adjId);
        $this->assertEquals(OrderAdjustmentStatus::CANCELLED, $adjustment->status);
        $this->assertEquals($this->salesmanA->id, $adjustment->cancelled_by);
        $this->assertNotNull($adjustment->cancelled_at);
        $this->assertEquals('Customer changed mind and wants full quantity.', $adjustment->cancellation_reason);

        // Order adjustment_status reset to NONE
        $order->refresh();
        $this->assertEquals(AdjustmentStatus::NONE, $order->adjustment_status);
    }

    public function test_admin_can_withdraw_adjustment_requested_by_salesman(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $createRes = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'idemp-admin-with-01',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [['order_item_id' => $item->id, 'requested_quantity_reduction' => 2]],
        ]);
        $adjId = $createRes->json('adjustment.id');

        // Admin withdraws it
        $withdrawRes = $this->actingAs($this->admin)->postJson("/orders/{$order->id}/adjustments/{$adjId}/withdraw", [
            'reason' => 'Administrative override cancellation.',
        ]);

        $withdrawRes->assertStatus(200);
        $this->assertEquals(OrderAdjustmentStatus::CANCELLED, OrderAdjustment::find($adjId)->status);
    }

    public function test_non_requester_salesman_cannot_withdraw_adjustment(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $createRes = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'idemp-unauth-with-01',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [['order_item_id' => $item->id, 'requested_quantity_reduction' => 2]],
        ]);
        $adjId = $createRes->json('adjustment.id');

        // Salesman B attempts to withdraw Salesman A's adjustment request => 404 (or 403)
        $withdrawRes = $this->actingAs($this->salesmanB)->postJson("/orders/{$order->id}/adjustments/{$adjId}/withdraw");
        $this->assertTrue(in_array($withdrawRes->status(), [403, 404], true));
    }

    public function test_cannot_withdraw_non_submitted_adjustment(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $createRes = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'idemp-double-with-01',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [['order_item_id' => $item->id, 'requested_quantity_reduction' => 2]],
        ]);
        $adjId = $createRes->json('adjustment.id');

        // 1st withdrawal
        $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments/{$adjId}/withdraw")->assertStatus(200);

        // 2nd withdrawal attempt on CANCELLED adjustment => 409
        $secondWithdraw = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments/{$adjId}/withdraw");
        $secondWithdraw->assertStatus(409);
        $this->assertStringContainsString('Cannot withdraw adjustment', $secondWithdraw->json('message'));
    }

    /**
     * Regression Test: An Inertia mutation request (X-Inertia: true) to /orders/{order}/adjustments
     * MUST receive an Inertia-compatible 302 redirect response with session flash message,
     * NOT a plain JSON response (fixes production protocol error).
     */
    public function test_inertia_adjustment_request_returns_valid_inertia_redirect_not_plain_json(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        $payload = [
            'idempotency_key' => 'idemp-inertia-001',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'notes' => 'Customer requested reduction via Inertia modal.',
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'requested_quantity_reduction' => 2,
                ],
            ],
        ];

        // Simulate an Inertia form post with X-Inertia header
        $response = $this->actingAs($this->admin)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Requested-With' => 'XMLHttpRequest',
            ])
            ->post("/orders/{$order->id}/adjustments", $payload);

        // 1. Must be an HTTP 302 redirect (Inertia mutation protocol)
        $response->assertStatus(302);
        $response->assertSessionHas('success');

        // 2. Response MUST NOT be a plain JSON payload
        $this->assertNotEquals('application/json', $response->headers->get('Content-Type'));

        // 3. Database invariants and adjustment status verified
        $this->assertDatabaseHas('order_adjustments', [
            'order_id' => $order->id,
            'status' => OrderAdjustmentStatus::SUBMITTED->value,
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
        ]);

        $order->refresh();
        $this->assertEquals(AdjustmentStatus::REQUESTED, $order->adjustment_status);
    }

    /**
     * Regression Test: An Inertia withdrawal request (X-Inertia: true) to /orders/{order}/adjustments/{adjustment}/withdraw
     * MUST receive an Inertia-compatible 302 redirect response with session flash message,
     * NOT a plain JSON response.
     */
    public function test_inertia_adjustment_withdrawal_returns_valid_inertia_redirect_not_plain_json(): void
    {
        $order = $this->createOrder($this->customerA, $this->salesmanA, OrderStatus::SUBMITTED);
        $item = $order->items->first();

        // Create adjustment
        $createRes = $this->actingAs($this->salesmanA)->postJson("/orders/{$order->id}/adjustments", [
            'idempotency_key' => 'idemp-inertia-with-01',
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'items' => [['order_item_id' => $item->id, 'requested_quantity_reduction' => 2]],
        ]);
        $adjId = $createRes->json('adjustment.id');

        // Withdraw via Inertia form post
        $withdrawRes = $this->actingAs($this->salesmanA)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Requested-With' => 'XMLHttpRequest',
            ])
            ->post("/orders/{$order->id}/adjustments/{$adjId}/withdraw", [
                'reason' => 'Customer changed their mind.',
            ]);

        // Must be an HTTP 302 redirect back
        $withdrawRes->assertStatus(302);
        $withdrawRes->assertSessionHas('success');
        $this->assertNotEquals('application/json', $withdrawRes->headers->get('Content-Type'));

        $this->assertEquals(OrderAdjustmentStatus::CANCELLED, OrderAdjustment::find($adjId)->status);
    }
}
