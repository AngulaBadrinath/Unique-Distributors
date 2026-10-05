<?php

declare(strict_types=1);

namespace Tests\Feature\QA;

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
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\OrderAdjustmentItem;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * QA-004: Master Order Adjustment Lifecycle & Invariant Hardening Test Suite
 *
 * Covers:
 * 1. Adjustment request creation & validation
 * 2. Invalid quantity rejection (cannot reduce > fulfillable)
 * 3. Maker-checker enforcement (maker cannot approve own adjustment)
 * 4. Case A (Unallocated reduction) application & tax recalculation
 * 5. Case B (Allocated reduction & release) application & inventory release
 * 6. Mathematical invariants: ordered = cancelled + fulfillable, sum(active alloc) <= fulfillable, 0 <= reserved <= allocated
 * 7. Order adjustment reversal engine & inventory re-reservation
 * 8. Duplicate apply idempotency (409 Conflict on re-apply)
 * 9. Stale state / Stale version concurrency protection
 */
class QA004OrderAdjustmentE2ETest extends TestCase
{
    use RefreshDatabase;

    protected User $salesman;
    protected User $adminMaker;
    protected User $adminChecker;
    protected User $superAdmin;
    protected Customer $customer;
    protected Warehouse $warehouse;
    protected Category $category;
    protected TaxProfile $taxProfile;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            ['name' => 'Main Distribution Hub', 'is_active' => true, 'is_default' => true]
        );

        $this->salesman = User::factory()->create([
            'name' => 'Salesman Sam QA004',
            'email' => 'salesman.qa004@example.test',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('Password123!'),
        ]);

        $this->adminMaker = User::factory()->create([
            'name' => 'Admin Maker Alice QA004',
            'email' => 'admin.maker.qa004@example.test',
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('Password123!'),
        ]);

        $this->adminChecker = User::factory()->create([
            'name' => 'Admin Checker Bob QA004',
            'email' => 'admin.checker.qa004@example.test',
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('Password123!'),
        ]);

        $this->superAdmin = User::factory()->create([
            'name' => 'Super Admin QA004',
            'email' => 'superadmin.qa004@example.test',
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('Password123!'),
        ]);

        $this->customer = Customer::create([
            'code' => 'CUST-ADJ-001',
            'name' => 'Apex Retailer QA004',
            'contact_name' => 'Alice Buyer',
            'email' => 'alice@apexretail.test',
            'phone' => '+1-555-0101',
            'billing_address_line1' => '100 Market St',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'US',
            'shipping_address_line1' => '100 Market St',
            'shipping_city' => 'Metropolis',
            'shipping_state' => 'NY',
            'shipping_postal_code' => '10001',
            'shipping_country' => 'US',
            'credit_limit' => 50000.00,
            'status' => CustomerStatus::ACTIVE,
            'salesman_id' => $this->salesman->id,
        ]);

        $this->category = Category::create([
            'name' => 'Dry Goods QA004',
            'code' => 'CAT-DRY-QA004',
        ]);

        $this->taxProfile = TaxProfile::create([
            'name' => 'Standard Rate 10%',
            'code' => 'TAX-10',
            'rate' => 10.00,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->product = Product::create([
            'sku' => 'PRD-ADJ-01',
            'name' => 'Premium Pasta 1kg',
            'category_id' => $this->category->id,
            'unit' => 'BAG',
            'cost_price' => 10.00,
            'minimum_allowed_price' => 15.00,
            'default_selling_price' => 20.00,
            'mrp' => 25.00,
            'tax_profile_id' => $this->taxProfile->id,
            'status' => ProductStatus::ACTIVE,
        ]);

        // 100 in stock
        InventoryBalance::updateOrCreate(
            ['warehouse_id' => $this->warehouse->id, 'product_id' => $this->product->id],
            ['on_hand_quantity' => 100, 'reserved_quantity' => 0, 'available_quantity' => 100, 'damaged_quantity' => 0, 'version' => 1]
        );
    }

    /**
     * Helper to create an approved order with specified quantities.
     */
    protected function createApprovedOrder(int $orderedQty, int $allocatedQty = 0, int $reservedQty = 0, int $pickedQty = 0): array
    {
        $subtotal = bcmul('20.00', (string) $orderedQty, 2);
        $tax = bcmul($subtotal, '0.10', 2);
        $grandTotal = bcadd($subtotal, $tax, 2);

        $order = Order::create([
            'order_number' => 'ORD-' . strtoupper(uniqid()),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'delivery_status' => \App\Enums\DeliveryStatus::PENDING_ASSIGNMENT,
            'adjustment_status' => AdjustmentStatus::NONE,
            'currency' => 'USD',
            'idempotency_key' => (string) Str::uuid(),
            'subtotal' => (float) $subtotal,
            'tax_total' => (float) $tax,
            'adjustment_total' => '0.00',
            'grand_total' => (float) $grandTotal,
            'submitted_at' => Carbon::now()->subHours(2),
            'approved_at' => Carbon::now()->subHour(),
            'approved_by' => $this->adminMaker->id,
            'version' => 1,
        ]);

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => $this->product->unit,
            'ordered_quantity' => $orderedQty,
            'cancelled_quantity' => 0,
            'reserved_quantity' => $reservedQty,
            'picked_quantity' => $pickedQty,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
            'unit_price' => 20.00,
            'tax_rate_snapshot' => 10.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
            'taxable_amount' => (float) $subtotal,
            'tax_amount' => (float) $tax,
            'line_total' => (float) $grandTotal,
        ]);

        $allocation = null;
        if ($allocatedQty > 0) {
            $allocation = OrderItemAllocation::create([
                'allocation_number' => 'ALC-' . $order->order_number . '-' . $item->id . '-1',
                'order_id' => $order->id,
                'order_item_id' => $item->id,
                'product_id' => $this->product->id,
                'allocated_quantity' => $allocatedQty,
                'reserved_quantity' => $reservedQty,
                'picked_quantity' => $pickedQty,
                'dispatched_quantity' => 0,
                'delivered_quantity' => 0,
                'returned_quantity' => 0,
                'status' => AllocationStatus::ALLOCATED->value,
                'allocated_by' => $this->adminMaker->id,
                'allocated_at' => Carbon::now()->subHour(),
            ]);

            // Adjust inventory balance
            $bal = InventoryBalance::where('warehouse_id', $this->warehouse->id)
                ->where('product_id', $this->product->id)
                ->first();
            $bal->update([
                'reserved_quantity' => $reservedQty,
                'available_quantity' => $bal->on_hand_quantity - $reservedQty,
            ]);
        }

        return [$order, $item, $allocation];
    }

    /**
     * Helper to create an adjustment request for an order.
     */
    protected function createAdjustmentRequest(Order $order, OrderItem $item, int $reductionQty, User $requester, OrderAdjustmentStatus $status = OrderAdjustmentStatus::SUBMITTED): OrderAdjustment
    {
        $orderedQty = $item->ordered_quantity;
        $allocatedQty = (int) OrderItemAllocation::where('order_item_id', $item->id)
            ->whereIn('status', [AllocationStatus::ALLOCATED->value, AllocationStatus::RESERVED->value])
            ->sum('allocated_quantity');
        $fulfillableQty = max(0, $orderedQty - $item->cancelled_quantity);
        $unallocated = max(0, $fulfillableQty - $allocatedQty);
        $affectedAlloc = max(0, $reductionQty - $unallocated);

        $subtotalRed = bcmul('20.00', (string) $reductionQty, 2);
        $taxRed = bcmul($subtotalRed, '0.10', 2);
        $grandRed = bcadd($subtotalRed, $taxRed, 2);

        $order->update(['adjustment_status' => AdjustmentStatus::REQUESTED]);

        $adj = OrderAdjustment::create([
            'adjustment_number' => 'ADJ-' . strtoupper(uniqid()),
            'order_id' => $order->id,
            'order_number_snapshot' => $order->order_number,
            'order_version_snapshot' => $order->version,
            'order_status_snapshot' => $order->status->value,
            'order_subtotal_snapshot' => $order->subtotal,
            'order_tax_total_snapshot' => $order->tax_total,
            'order_grand_total_snapshot' => $order->grand_total,
            'type' => 'QUANTITY_REDUCTION',
            'status' => $status,
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST,
            'notes' => 'Customer reduced quantity.',
            'requested_by' => $requester->id,
            'requested_at' => Carbon::now()->subMinutes(30),
            'reviewed_by' => $status === OrderAdjustmentStatus::APPROVED ? $this->adminChecker->id : null,
            'reviewed_at' => $status === OrderAdjustmentStatus::APPROVED ? Carbon::now()->subMinutes(15) : null,
            'projected_subtotal_reduction' => (float) $subtotalRed,
            'projected_tax_reduction' => (float) $taxRed,
            'projected_grand_total_reduction' => (float) $grandRed,
            'idempotency_key' => (string) Str::uuid(),
            'request_fingerprint' => hash('sha256', 'adj-' . uniqid()),
        ]);

        OrderAdjustmentItem::create([
            'adjustment_id' => $adj->id,
            'order_item_id' => $item->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_price_snapshot' => '20.00',
            'tax_rate_snapshot' => '10.0000',
            'tax_profile_code_snapshot' => 'TAX-10',
            'ordered_quantity_snapshot' => $orderedQty,
            'cancelled_quantity_snapshot' => $item->cancelled_quantity,
            'fulfillable_quantity_snapshot' => $fulfillableQty,
            'allocated_quantity_snapshot' => $allocatedQty,
            'unallocated_quantity_snapshot' => $unallocated,
            'requested_quantity_reduction' => $reductionQty,
            'projected_fulfillable_quantity' => $fulfillableQty - $reductionQty,
            'projected_cancelled_quantity' => $item->cancelled_quantity + $reductionQty,
            'affected_allocation_quantity' => $affectedAlloc,
            'projected_taxable_amount_reduction' => (float) $subtotalRed,
            'projected_tax_amount_reduction' => (float) $taxRed,
            'projected_line_total_reduction' => (float) $grandRed,
        ]);

        return $adj;
    }

    /**
     * Helper to create an approved order scenario with specified quantities.
     */
    protected function createApprovedScenario(
        int $orderedQty,
        int $allocatedQty,
        int $reservedQty,
        int $pickedQty,
        int $reductionQty,
        string $allocationStatus = AllocationStatus::ALLOCATED->value
    ): array {
        $subtotal = bcmul('20.00', (string) $orderedQty, 2);
        $tax = bcmul($subtotal, '0.10', 2);
        $grandTotal = bcadd($subtotal, $tax, 2);

        $order = Order::create([
            'order_number' => 'ORD-' . strtoupper(uniqid()),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'delivery_status' => \App\Enums\DeliveryStatus::PENDING_ASSIGNMENT,
            'adjustment_status' => AdjustmentStatus::REQUESTED,
            'currency' => 'USD',
            'idempotency_key' => (string) Str::uuid(),
            'subtotal' => (float) $subtotal,
            'tax_total' => (float) $tax,
            'adjustment_total' => '0.00',
            'grand_total' => (float) $grandTotal,
            'submitted_at' => Carbon::now()->subHours(2),
            'approved_at' => Carbon::now()->subHour(),
            'approved_by' => $this->adminMaker->id,
            'version' => 1,
        ]);

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => $this->product->unit,
            'ordered_quantity' => $orderedQty,
            'cancelled_quantity' => 0,
            'reserved_quantity' => $reservedQty,
            'picked_quantity' => $pickedQty,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
            'unit_price' => 20.00,
            'tax_rate_snapshot' => 10.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
            'taxable_amount' => (float) $subtotal,
            'tax_amount' => (float) $tax,
            'line_total' => (float) $grandTotal,
        ]);

        $allocation = null;
        if ($allocatedQty > 0) {
            $allocation = OrderItemAllocation::create([
                'allocation_number' => 'ALC-' . $order->order_number . '-' . $item->id . '-1',
                'order_id' => $order->id,
                'order_item_id' => $item->id,
                'product_id' => $this->product->id,
                'allocated_quantity' => $allocatedQty,
                'reserved_quantity' => $reservedQty,
                'picked_quantity' => $pickedQty,
                'dispatched_quantity' => 0,
                'delivered_quantity' => 0,
                'returned_quantity' => 0,
                'status' => $allocationStatus,
                'allocated_by' => $this->adminMaker->id,
                'allocated_at' => Carbon::now()->subHour(),
            ]);

            // Adjust inventory balance
            $bal = InventoryBalance::where('warehouse_id', $this->warehouse->id)
                ->where('product_id', $this->product->id)
                ->first();
            $bal->update([
                'reserved_quantity' => $reservedQty,
                'available_quantity' => $bal->on_hand_quantity - $reservedQty,
            ]);
        }

        $unallocated = max(0, $orderedQty - $allocatedQty);
        $affectedAlloc = max(0, $reductionQty - $unallocated);

        $subtotalRed = bcmul('20.00', (string) $reductionQty, 2);
        $taxRed = bcmul($subtotalRed, '0.10', 2);
        $grandRed = bcadd($subtotalRed, $taxRed, 2);

        $adj = OrderAdjustment::create([
            'adjustment_number' => 'ADJ-APP-' . strtoupper(uniqid()),
            'order_id' => $order->id,
            'order_number_snapshot' => $order->order_number,
            'order_version_snapshot' => 1,
            'order_status_snapshot' => 'APPROVED',
            'order_subtotal_snapshot' => (float) $subtotal,
            'order_tax_total_snapshot' => (float) $tax,
            'order_grand_total_snapshot' => (float) $grandTotal,
            'type' => 'QUANTITY_REDUCTION',
            'status' => OrderAdjustmentStatus::APPROVED,
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST,
            'notes' => 'Customer requested reduction.',
            'requested_by' => $this->salesman->id,
            'requested_at' => Carbon::now()->subHour(),
            'reviewed_by' => $this->adminChecker->id,
            'reviewed_at' => Carbon::now()->subMinutes(30),
            'projected_subtotal_reduction' => (float) $subtotalRed,
            'projected_tax_reduction' => (float) $taxRed,
            'projected_grand_total_reduction' => (float) $grandRed,
            'idempotency_key' => 'idem-' . uniqid(),
            'request_fingerprint' => hash('sha256', 'payload-' . uniqid()),
        ]);

        $adjItem = OrderAdjustmentItem::create([
            'adjustment_id' => $adj->id,
            'order_item_id' => $item->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_price_snapshot' => '20.00',
            'tax_rate_snapshot' => '10.0000',
            'tax_profile_code_snapshot' => 'TAX-10',
            'ordered_quantity_snapshot' => $orderedQty,
            'cancelled_quantity_snapshot' => 0,
            'fulfillable_quantity_snapshot' => $orderedQty,
            'allocated_quantity_snapshot' => $allocatedQty,
            'unallocated_quantity_snapshot' => $unallocated,
            'requested_quantity_reduction' => $reductionQty,
            'projected_fulfillable_quantity' => $orderedQty - $reductionQty,
            'projected_cancelled_quantity' => $reductionQty,
            'affected_allocation_quantity' => $affectedAlloc,
            'projected_taxable_amount_reduction' => (float) $subtotalRed,
            'projected_tax_amount_reduction' => (float) $taxRed,
            'projected_line_total_reduction' => (float) $grandRed,
        ]);

        return [$order, $adj, $item, $allocation, $adjItem];
    }

    /**
     * 1. Valid Adjustment Request: Salesman can initiate adjustment request.
     */
    public function test_01_salesman_can_request_order_adjustment(): void
    {
        [$order, $item] = $this->createApprovedOrder(10);

        $payload = [
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'notes' => 'Customer requests 3 unit reduction',
            'idempotency_key' => (string) Str::uuid(),
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'reduction_quantity' => 3,
                ],
            ],
        ];

        $response = $this->actingAs($this->salesman)
            ->postJson("/orders/{$order->id}/adjustments", $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('order_adjustments', [
            'order_id' => $order->id,
            'requested_by' => $this->salesman->id,
            'status' => 'SUBMITTED',
        ]);
    }

    /**
     * 2. Invalid Quantity Validation: Cannot reduce more than fulfillable quantity.
     */
    public function test_02_cannot_reduce_more_than_fulfillable_quantity(): void
    {
        [$order, $item] = $this->createApprovedOrder(10);

        // Fulfillable is 10, attempting to reduce 15
        $payload = [
            'reason_code' => AdjustmentReasonCode::CUSTOMER_REQUEST->value,
            'notes' => 'Attempting over-reduction',
            'idempotency_key' => (string) Str::uuid(),
            'items' => [
                [
                    'order_item_id' => $item->id,
                    'reduction_quantity' => 15,
                ],
            ],
        ];

        $response = $this->actingAs($this->salesman)
            ->postJson("/orders/{$order->id}/adjustments", $payload);

        $response->assertStatus(422);
        $this->assertDatabaseCount('order_adjustments', 0);
    }

    /**
     * 3. Maker-Checker Segregation: Requester cannot approve their own adjustment.
     */
    public function test_03_maker_checker_enforces_requester_cannot_approve_adjustment(): void
    {
        [$order, $item] = $this->createApprovedOrder(10);
        $adj = $this->createAdjustmentRequest($order, $item, 3, $this->adminMaker);

        // Admin Maker attempts to approve own request
        $responseMaker = $this->actingAs($this->adminMaker)
            ->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/approve");

        $responseMaker->assertStatus(403);
        $adj->refresh();
        $this->assertEquals(OrderAdjustmentStatus::SUBMITTED, $adj->status);

        // Distinct Admin Checker approves successfully
        $responseChecker = $this->actingAs($this->adminChecker)
            ->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/approve");

        $responseChecker->assertRedirect();
        $adj->refresh();
        $this->assertEquals(OrderAdjustmentStatus::APPROVED, $adj->status);
        $this->assertEquals($this->adminChecker->id, $adj->reviewed_by);
    }

    /**
     * 4. Case A (Unallocated reduction) application & mathematical conservation.
     */
    public function test_04_case_a_unallocated_reduction_preserves_conservation_invariants(): void
    {
        // 10 ordered, 4 allocated, 4 reserved, reduction 3 (<= 6 unallocated) -> Case A
        [$order, $item, $allocation] = $this->createApprovedOrder(10, 4, 4);
        $adj = $this->createAdjustmentRequest($order, $item, 3, $this->salesman, OrderAdjustmentStatus::APPROVED);

        $response = $this->actingAs($this->adminChecker)
            ->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/apply");

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $adj->refresh();
        $this->assertEquals(OrderAdjustmentStatus::APPLIED, $adj->status);
        $this->assertNotNull($adj->applied_at);

        $order->refresh();
        $this->assertEquals(AdjustmentStatus::APPLIED, $order->adjustment_status);
        $this->assertEquals(2, $order->version); // version incremented
        $this->assertEquals('140.00', (string) $order->subtotal); // 7 * 20.00
        $this->assertEquals('14.00', (string) $order->tax_total);  // 10%
        $this->assertEquals('154.00', (string) $order->grand_total);
        $this->assertEquals('66.00', (string) $order->adjustment_total); // 3 * 22.00

        $item->refresh();
        // RULE-DOM-001: Original ordered quantity is NEVER mutated!
        $this->assertEquals(10, $item->ordered_quantity);
        $this->assertEquals(3, $item->cancelled_quantity);
        $this->assertEquals(7, $item->fulfillableQuantity());

        // Mathematical Invariant: ordered = cancelled + fulfillable
        $this->assertEquals($item->ordered_quantity, $item->cancelled_quantity + $item->fulfillableQuantity());

        // Line financial recalculation
        $this->assertEquals('140.00', (string) $item->taxable_amount);
        $this->assertEquals('14.00', (string) $item->tax_amount);
        $this->assertEquals('154.00', (string) $item->line_total);

        // Allocations untouched in Case A
        $this->assertEquals(4, $allocation->fresh()->allocated_quantity);
        $this->assertEquals(4, $allocation->fresh()->reserved_quantity);
    }

    /**
     * 5. Case B (Allocated reduction & release) splits allocation and releases inventory.
     */
    public function test_05_case_b_allocated_reduction_releases_physical_inventory(): void
    {
        // 10 ordered, 8 allocated, 8 reserved, 0 picked, 5 reduction
        // unallocated = 2, reduction = 5 => 3 units released from allocation of 8 (Case B)
        [$order, $adj, $item, $allocation] = $this->createApprovedScenario(10, 8, 8, 0, 5);

        $response = $this->actingAs($this->adminChecker)
            ->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/apply");

        $response->assertRedirect();
        $response->assertSessionHas('success');

        // Verify active allocation remainder: 8 - 3 = 5
        $allocFresh = $allocation->fresh();
        $this->assertEquals(AllocationStatus::ALLOCATED, $allocFresh->status);
        $this->assertEquals(5, $allocFresh->allocated_quantity);
        $this->assertEquals(5, $allocFresh->reserved_quantity);
        $this->assertEquals(0, $allocFresh->picked_quantity);

        // Verify released child row created: 3 units released
        $releasedChild = OrderItemAllocation::where('order_item_id', $item->id)
            ->where('status', AllocationStatus::RELEASED->value)
            ->first();
        $this->assertNotNull($releasedChild);
        $this->assertEquals(3, $releasedChild->allocated_quantity);
        $this->assertEquals(0, $releasedChild->reserved_quantity);
        $this->assertEquals(0, $releasedChild->picked_quantity);

        // Conservation: active + released = 5 + 3 = 8
        $this->assertEquals(8, $allocFresh->allocated_quantity + $releasedChild->allocated_quantity);

        // Verify Invariants:
        // sum(active allocations) <= fulfillable
        // 0 <= reserved <= allocated
        $itemFresh = $item->fresh(['allocations']);
        $this->assertEquals(10, $itemFresh->ordered_quantity);
        $this->assertEquals(5, $itemFresh->cancelled_quantity);
        $this->assertEquals(5, $itemFresh->fulfillableQuantity());
        $this->assertEquals(5, $itemFresh->reserved_quantity);
        $this->assertEquals(5, $itemFresh->allocatedQuantity());
        $this->assertTrue($itemFresh->allocatedQuantity() <= $itemFresh->fulfillableQuantity());
        $this->assertTrue(0 <= $itemFresh->reserved_quantity && $itemFresh->reserved_quantity <= $itemFresh->allocatedQuantity());
    }

    /**
     * 6. Duplicate Apply Idempotency: Re-applying an already APPLIED adjustment returns 409 Conflict.
     */
    public function test_06_duplicate_apply_is_prevented_with_conflict(): void
    {
        [$order, $item] = $this->createApprovedOrder(10, 4, 4);
        $item->refresh();
        $adj = $this->createAdjustmentRequest($order, $item, 2, $this->salesman, OrderAdjustmentStatus::APPROVED);

        // First apply
        $response1 = $this->actingAs($this->adminChecker)
            ->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/apply");
        $response1->assertRedirect();

        // Duplicate apply
        $response2 = $this->actingAs($this->adminChecker)
            ->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/apply");

        $response2->assertStatus(409);
    }

    /**
     * 7. Adjustment Reversal Engine: Applied adjustment can be reversed with inventory re-reservation.
     */
    public function test_07_admin_can_reverse_applied_adjustment_restoring_state(): void
    {
        [$order, $item] = $this->createApprovedOrder(10, 10, 10);
        $item->refresh();
        $adj = $this->createAdjustmentRequest($order, $item, 3, $this->salesman, OrderAdjustmentStatus::APPROVED);

        // Apply adjustment
        $this->actingAs($this->adminChecker)->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/apply");
        $adj->refresh();
        $this->assertEquals(OrderAdjustmentStatus::APPLIED, $adj->status);

        // Reverse adjustment
        $reverseResponse = $this->actingAs($this->adminChecker)
            ->post("/admin/orders/{$order->id}/adjustments/{$adj->id}/reverse", [
                'reason' => 'Customer renewed original quantity order in full.',
            ]);

        $reverseResponse->assertRedirect();
        $reverseResponse->assertSessionHas('success');

        $adj->refresh();
        $this->assertEquals(OrderAdjustmentStatus::REVERSED, $adj->status);
        $this->assertNotNull($adj->reversed_at);
        $this->assertEquals($this->adminChecker->id, $adj->reversed_by);

        $order->refresh();
        $this->assertEquals(3, $order->version); // version incremented again
        $this->assertEquals('200.00', (string) $order->subtotal);
        $this->assertEquals('20.00', (string) $order->tax_total);
        $this->assertEquals('220.00', (string) $order->grand_total);
        $this->assertEquals('0.00', (string) $order->adjustment_total);

        $item->refresh();
        $this->assertEquals(10, $item->ordered_quantity);
        $this->assertEquals(0, $item->cancelled_quantity);
        $this->assertEquals(10, $item->fulfillableQuantity());
    }

    /**
     * 8. Stale State & Concurrency: Stale version detection on review.
     */
    public function test_08_adjustment_rejection_on_stale_order_version(): void
    {
        [$order, $item] = $this->createApprovedOrder(10, 4, 4);
        $item->refresh();
        $adj = $this->createAdjustmentRequest($order, $item, 2, $this->salesman, OrderAdjustmentStatus::SUBMITTED);

        // Bump order version independently to simulate concurrent mutation
        $order->update(['version' => 5]);

        $response = $this->actingAs($this->adminChecker)
            ->get("/admin/orders/{$order->id}/adjustments/{$adj->id}/review");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->where('evaluation.is_stale', true)
            ->where('evaluation.current_order_version', 5)
            ->where('evaluation.order_version_snapshot', 1)
            ->where('evaluation.evaluation_status', 'STALE')
        );
    }
}
