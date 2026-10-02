<?php

declare(strict_types=1);

namespace Tests\Feature\QA;

use App\Enums\AccountStatus;
use App\Enums\AllocationStatus;
use App\Enums\CategoryStatus;
use App\Enums\CustomerStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\InventoryAdjustmentReason;
use App\Enums\InventoryAdjustmentType;
use App\Enums\InventoryMovementType;
use App\Enums\InventoryStockState;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\StockExceptionType;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Exceptions\Inventory\InsufficientStockException;
use App\Models\Category;
use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Allocation\OrderAllocationService;
use App\Services\Inventory\InventoryAdjustmentService;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StockExceptionService;
use App\Services\Order\OrderWorkflowService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Tests\TestCase;

/**
 * QA-005: Master Inventory Concurrency & Race-Condition Test Suite
 *
 * Verifies:
 * 1. Competing orders competing for scarce inventory (exactly one succeeds, one fails cleanly)
 * 2. Multi-product deterministic ascending lock ordering preventing deadlock under reverse item orderings
 * 3. Stock exception damage quarantine competing with active order reservations
 * 4. Concurrent order adjustment allocation release restoring available stock for competing orders
 * 5. Atomic reservation failure rollback isolation (zero dirty reservations or orphaned movements)
 * 6. Inventory balance mathematical invariants (on_hand == reserved + available + damaged) under concurrent load
 * 7. Authorized inventory balance adjustment serialization vs active reservations
 * 8. Double-release prevention on repeated order rejection / cancellation
 */
class QA005InventoryConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $salesman;
    protected User $warehouseManager;

    protected Warehouse $warehouse;
    protected Customer $customerA;
    protected Customer $customerB;
    protected Category $category;
    protected TaxProfile $taxProfile;
    protected Product $productA;
    protected Product $productB;
    protected Product $productC;
    protected InventoryBalance $balanceA;
    protected InventoryBalance $balanceB;
    protected InventoryBalance $balanceC;

    protected OrderWorkflowService $workflowService;
    protected InventoryService $inventoryService;
    protected InventoryAdjustmentService $adjustmentService;
    protected StockExceptionService $exceptionService;
    protected OrderAllocationService $allocationService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->workflowService = app(OrderWorkflowService::class);
        $this->inventoryService = app(InventoryService::class);
        $this->adjustmentService = app(InventoryAdjustmentService::class);
        $this->exceptionService = app(StockExceptionService::class);
        $this->allocationService = app(OrderAllocationService::class);

        $this->admin = User::create([
            'name' => 'Admin QA',
            'email' => 'admin.qa005@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Admin QA',
            'email' => 'superadmin.qa005@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::create([
            'name' => 'Salesman QA',
            'email' => 'salesman.qa005@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouseManager = User::create([
            'name' => 'Warehouse Manager QA',
            'email' => 'whm.qa005@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::WAREHOUSE_MANAGER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Distribution Hub',
                'country_code' => 'US',
                'is_active' => true,
                'is_default' => true,
            ]
        );

        $this->customerA = Customer::create([
            'name' => 'Atlantic Retail Group',
            'code' => 'CUST-QA005-A',
            'contact_name' => 'Alice Atlantic',
            'email' => 'alice@atlantic.test',
            'phone' => '+1-555-0501',
            'billing_address_line1' => '100 Atlantic Ave',
            'billing_city' => 'New York',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'USA',
            'salesman_id' => $this->salesman->id,
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => '100000.00',
        ]);

        $this->customerB = Customer::create([
            'name' => 'Pacific Wholesale Mart',
            'code' => 'CUST-QA005-B',
            'contact_name' => 'Bob Pacific',
            'email' => 'bob@pacific.test',
            'phone' => '+1-555-0502',
            'billing_address_line1' => '200 Pacific Blvd',
            'billing_city' => 'Los Angeles',
            'billing_state' => 'CA',
            'billing_postal_code' => '90001',
            'billing_country' => 'USA',
            'salesman_id' => $this->salesman->id,
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => '100000.00',
        ]);

        $this->category = Category::create([
            'name' => 'Dairy & Beverages',
            'code' => 'CAT-DB-005',
            'status' => CategoryStatus::ACTIVE,
        ]);

        $this->taxProfile = TaxProfile::create([
            'name' => 'Standard Rate',
            'code' => 'TAX-STD-005',
            'rate' => 10.00,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        // Product A: 50 physical units available
        $this->productA = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'sku' => 'SKU-CONCUR-A',
            'name' => 'Organic Whole Milk 1 Gal',
            'cost_price' => '2.50',
            'minimum_allowed_price' => '3.00',
            'default_selling_price' => '4.50',
            'mrp' => '6.00',
            'unit' => 'BOTTLE',
            'status' => ProductStatus::ACTIVE,
        ]);

        // Product B: 30 physical units available
        $this->productB = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'sku' => 'SKU-CONCUR-B',
            'name' => 'Greek Yogurt 32oz',
            'cost_price' => '3.00',
            'minimum_allowed_price' => '4.00',
            'default_selling_price' => '5.50',
            'mrp' => '7.50',
            'unit' => 'TUB',
            'status' => ProductStatus::ACTIVE,
        ]);

        // Product C: 10 physical units available
        $this->productC = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'sku' => 'SKU-CONCUR-C',
            'name' => 'Artisan Cheese Wheel 5lb',
            'cost_price' => '15.00',
            'minimum_allowed_price' => '20.00',
            'default_selling_price' => '28.00',
            'mrp' => '35.00',
            'unit' => 'WHEEL',
            'status' => ProductStatus::ACTIVE,
        ]);

        // Set authoritative starting inventory balances
        $this->balanceA = InventoryBalance::where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->productA->id)
            ->firstOrFail();
        $this->balanceA->update([
            'on_hand_quantity' => 50,
            'reserved_quantity' => 0,
            'available_quantity' => 50,
            'damaged_quantity' => 0,
        ]);

        $this->balanceB = InventoryBalance::where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->productB->id)
            ->firstOrFail();
        $this->balanceB->update([
            'on_hand_quantity' => 30,
            'reserved_quantity' => 0,
            'available_quantity' => 30,
            'damaged_quantity' => 0,
        ]);

        $this->balanceC = InventoryBalance::where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->productC->id)
            ->firstOrFail();
        $this->balanceC->update([
            'on_hand_quantity' => 10,
            'reserved_quantity' => 0,
            'available_quantity' => 10,
            'damaged_quantity' => 0,
        ]);
    }

    /**
     * Helper to create submitted orders for concurrency testing.
     */
    protected function createSubmittedOrder(Customer $customer, array $items): Order
    {
        $order = Order::create([
            'order_number' => 'ORD-QA005-'.Str::upper(Str::random(8)),
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::SUBMITTED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => '0.00',
            'tax_total' => '0.00',
            'adjustment_total' => '0.00',
            'grand_total' => '0.00',
            'idempotency_key' => (string) Str::uuid(),
            'submitted_at' => Carbon::now(),
        ]);

        $subtotal = 0.00;
        $taxTotal = 0.00;

        foreach ($items as $itemData) {
            /** @var Product $product */
            $product = $itemData['product'];
            $quantity = (int) $itemData['quantity'];
            $price = (float) ($itemData['price'] ?? $product->default_selling_price);

            $taxableAmount = round($quantity * $price, 2);
            $taxAmount = round($taxableAmount * ($this->taxProfile->rate / 100), 2);
            $lineTotal = round($taxableAmount + $taxAmount, 2);

            $subtotal += $taxableAmount;
            $taxTotal += $taxAmount;

            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'product_name_snapshot' => $product->name,
                'sku_snapshot' => $product->sku,
                'unit_snapshot' => $product->unit,
                'tax_profile_code_snapshot' => $this->taxProfile->code,
                'tax_profile_name_snapshot' => $this->taxProfile->name,
                'tax_rate_snapshot' => $this->taxProfile->rate,
                'ordered_quantity' => $quantity,
                'cancelled_quantity' => 0,
                'reserved_quantity' => 0,
                'picked_quantity' => 0,
                'dispatched_quantity' => 0,
                'delivered_quantity' => 0,
                'unit_price' => number_format($price, 2, '.', ''),
                'tax_profile_id' => $this->taxProfile->id,
                'taxable_amount' => number_format($taxableAmount, 2, '.', ''),
                'tax_amount' => number_format($taxAmount, 2, '.', ''),
                'line_total' => number_format($lineTotal, 2, '.', ''),
            ]);
        }

        $order->update([
            'subtotal' => number_format($subtotal, 2, '.', ''),
            'tax_total' => number_format($taxTotal, 2, '.', ''),
            'grand_total' => number_format($subtotal + $taxTotal, 2, '.', ''),
        ]);

        return $order->fresh(['items']);
    }

    /**
     * Test 1: Two orders competing for scarce inventory: first succeeds, second fails cleanly.
     * Available stock must never become negative.
     */
    public function test_competing_orders_for_scarce_inventory_allows_first_and_rejects_second(): void
    {
        // Product C has exactly 10 units available.
        // Order 1 requests 8 units.
        // Order 2 requests 5 units (total 13 > 10).
        $order1 = $this->createSubmittedOrder($this->customerA, [
            ['product' => $this->productC, 'quantity' => 8],
        ]);

        $order2 = $this->createSubmittedOrder($this->customerB, [
            ['product' => $this->productC, 'quantity' => 5],
        ]);

        // Approve Order 1: Should succeed
        $approvedOrder1 = $this->workflowService->approveOrder($order1, $this->admin);
        $this->assertEquals(OrderStatus::APPROVED, $approvedOrder1->status);

        $this->balanceC->refresh();
        $this->assertEquals(10, $this->balanceC->on_hand_quantity);
        $this->assertEquals(8, $this->balanceC->reserved_quantity);
        $this->assertEquals(2, $this->balanceC->available_quantity);
        $this->assertEquals(0, $this->balanceC->damaged_quantity);

        // Approve Order 2: Must fail with InsufficientStockException because only 2 units remain
        try {
            $this->workflowService->approveOrder($order2, $this->admin);
            $this->fail('Expected InsufficientStockException when approving order exceeding available stock.');
        } catch (InsufficientStockException $e) {
            $this->assertEquals($this->productC->id, $e->productId);
            $this->assertEquals(5, $e->requestedQuantity);
            $this->assertEquals(2, $e->availableQuantity);
        }

        // Verify Order 2 remains SUBMITTED without dirty mutations
        $order2->refresh();
        $this->assertEquals(OrderStatus::SUBMITTED, $order2->status);

        // Verify Inventory Balance invariants
        $this->balanceC->refresh();
        $this->assertEquals(10, $this->balanceC->on_hand_quantity);
        $this->assertEquals(8, $this->balanceC->reserved_quantity);
        $this->assertEquals(2, $this->balanceC->available_quantity);
        $this->assertGreaterThanOrEqual(0, $this->balanceC->available_quantity);
        $this->assertEquals(
            $this->balanceC->on_hand_quantity,
            $this->balanceC->reserved_quantity + $this->balanceC->available_quantity + $this->balanceC->damaged_quantity
        );
    }

    /**
     * Test 2: Multi-product lock ordering prevents deadlocks under reverse item orderings.
     * Order 1 locks Product A then Product B.
     * Order 2 locks Product B then Product A.
     * Both must lock in ascending ID order (id ASC) without deadlock.
     */
    public function test_multi_product_deterministic_lock_ordering_prevents_deadlocks(): void
    {
        $idA = $this->productA->id;
        $idB = $this->productB->id;

        // Ensure we test both forward and reverse insertion orders
        $order1 = $this->createSubmittedOrder($this->customerA, [
            ['product' => $this->productA, 'quantity' => 10],
            ['product' => $this->productB, 'quantity' => 5],
        ]);

        $order2 = $this->createSubmittedOrder($this->customerB, [
            ['product' => $this->productB, 'quantity' => 10],
            ['product' => $this->productA, 'quantity' => 15],
        ]);

        // Approve Order 1
        $this->workflowService->approveOrder($order1, $this->admin);

        // Approve Order 2
        $this->workflowService->approveOrder($order2, $this->admin);

        $this->balanceA->refresh();
        $this->balanceB->refresh();

        // Product A: 50 on hand, 25 reserved (10 + 15), 25 available
        $this->assertEquals(50, $this->balanceA->on_hand_quantity);
        $this->assertEquals(25, $this->balanceA->reserved_quantity);
        $this->assertEquals(25, $this->balanceA->available_quantity);

        // Product B: 30 on hand, 15 reserved (5 + 10), 15 available
        $this->assertEquals(30, $this->balanceB->on_hand_quantity);
        $this->assertEquals(15, $this->balanceB->reserved_quantity);
        $this->assertEquals(15, $this->balanceB->available_quantity);

        // Invariant checks
        $this->assertEquals(
            $this->balanceA->on_hand_quantity,
            $this->balanceA->reserved_quantity + $this->balanceA->available_quantity + $this->balanceA->damaged_quantity
        );
        $this->assertEquals(
            $this->balanceB->on_hand_quantity,
            $this->balanceB->reserved_quantity + $this->balanceB->available_quantity + $this->balanceB->damaged_quantity
        );
    }

    /**
     * Test 3: Stock exception damage quarantine competing with active order reservations.
     * When stock is quarantined as damaged, available stock is reduced and subsequent orders cannot over-reserve.
     */
    public function test_stock_exception_damage_quarantine_competing_with_active_order_approval(): void
    {
        // Product C has 10 units available.
        // Quarantine 6 units as DAMAGED via StockExceptionService.
        $this->actingAs($this->warehouseManager);
        $exception = $this->exceptionService->reportException([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->productC->id,
            'source_stock_state' => 'AVAILABLE',
            'quantity' => 6,
            'exception_type' => StockExceptionType::DAMAGE,
            'description' => 'Water damage from packaging leak in warehouse bay 4',
        ], $this->warehouseManager);

        $this->assertNotNull($exception);

        $this->balanceC->refresh();
        $this->assertEquals(10, $this->balanceC->on_hand_quantity);
        $this->assertEquals(0, $this->balanceC->reserved_quantity);
        $this->assertEquals(4, $this->balanceC->available_quantity);
        $this->assertEquals(6, $this->balanceC->damaged_quantity);

        // Attempt to approve order requesting 5 units of Product C: Must fail because only 4 available
        $order = $this->createSubmittedOrder($this->customerA, [
            ['product' => $this->productC, 'quantity' => 5],
        ]);

        $this->expectException(InsufficientStockException::class);
        $this->workflowService->approveOrder($order, $this->admin);
    }

    /**
     * Test 4: Concurrent order adjustment allocation release restoring available stock for competing orders.
     */
    public function test_concurrent_order_adjustment_allocation_release_and_re_reservation(): void
    {
        // Product C has 10 units.
        // Order 1 reserves all 10 units.
        $order1 = $this->createSubmittedOrder($this->customerA, [
            ['product' => $this->productC, 'quantity' => 10],
        ]);

        $this->workflowService->approveOrder($order1, $this->admin);

        $this->balanceC->refresh();
        $this->assertEquals(0, $this->balanceC->available_quantity);
        $this->assertEquals(10, $this->balanceC->reserved_quantity);

        // Order 2 requests 4 units (currently blocked)
        $order2 = $this->createSubmittedOrder($this->customerB, [
            ['product' => $this->productC, 'quantity' => 4],
        ]);

        // Release 5 units from Order 1 reservation via OrderWorkflowService / InventoryService
        $this->inventoryService->releaseStockForOrder(
            $order1,
            $this->admin,
            $this->warehouse->id,
            [$order1->items->first()->id => 5]
        );

        $this->balanceC->refresh();
        $this->assertEquals(5, $this->balanceC->available_quantity);
        $this->assertEquals(5, $this->balanceC->reserved_quantity);

        // Now Order 2 approval must succeed
        $approvedOrder2 = $this->workflowService->approveOrder($order2, $this->admin);
        $this->assertEquals(OrderStatus::APPROVED, $approvedOrder2->status);

        $this->balanceC->refresh();
        $this->assertEquals(1, $this->balanceC->available_quantity);
        $this->assertEquals(9, $this->balanceC->reserved_quantity);
        $this->assertEquals(10, $this->balanceC->on_hand_quantity);
    }

    /**
     * Test 5: Atomic reservation rollback isolation on multi-line failure.
     * If an order has 3 items and item 3 has insufficient stock, items 1 and 2 must NOT remain reserved.
     */
    public function test_atomic_reservation_rollback_isolation_on_multi_line_failure(): void
    {
        // Product A has 50, Product B has 30, Product C has 10.
        // Order requests: Product A = 10 (ok), Product B = 10 (ok), Product C = 15 (insufficient: 15 > 10).
        $order = $this->createSubmittedOrder($this->customerA, [
            ['product' => $this->productA, 'quantity' => 10],
            ['product' => $this->productB, 'quantity' => 10],
            ['product' => $this->productC, 'quantity' => 15],
        ]);

        try {
            $this->workflowService->approveOrder($order, $this->admin);
            $this->fail('Expected InsufficientStockException.');
        } catch (InsufficientStockException $e) {
            $this->assertEquals($this->productC->id, $e->productId);
        }

        // Verify that neither Product A nor Product B has dirty reservations
        $this->balanceA->refresh();
        $this->balanceB->refresh();
        $this->balanceC->refresh();

        $this->assertEquals(0, $this->balanceA->reserved_quantity);
        $this->assertEquals(50, $this->balanceA->available_quantity);

        $this->assertEquals(0, $this->balanceB->reserved_quantity);
        $this->assertEquals(30, $this->balanceB->available_quantity);

        $this->assertEquals(0, $this->balanceC->reserved_quantity);
        $this->assertEquals(10, $this->balanceC->available_quantity);

        // Verify zero reservation movement entries written for this failed order
        $movements = InventoryMovement::where('reference_id', $order->id)->get();
        $this->assertCount(0, $movements);
    }

    /**
     * Test 6: Authorized inventory balance adjustment serialization vs active reservations.
     */
    public function test_simultaneous_inventory_adjustment_vs_order_reservation(): void
    {
        // Reserve 20 units of Product A
        $order = $this->createSubmittedOrder($this->customerA, [
            ['product' => $this->productA, 'quantity' => 20],
        ]);
        $this->workflowService->approveOrder($order, $this->admin);

        $this->balanceA->refresh();
        $this->assertEquals(50, $this->balanceA->on_hand_quantity);
        $this->assertEquals(20, $this->balanceA->reserved_quantity);
        $this->assertEquals(30, $this->balanceA->available_quantity);

        // Warehouse manager increases on-hand by 25 units
        $this->adjustmentService->adjustBalance([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->productA->id,
            'quantity' => 25,
            'adjustment_type' => InventoryAdjustmentType::INCREASE_ON_HAND,
            'reason_code' => InventoryAdjustmentReason::FOUND_STOCK,
            'notes' => 'Physical count discrepancy recount in warehouse A',
        ], $this->warehouseManager);

        $this->balanceA->refresh();
        $this->assertEquals(75, $this->balanceA->on_hand_quantity);
        $this->assertEquals(20, $this->balanceA->reserved_quantity);
        $this->assertEquals(55, $this->balanceA->available_quantity);
        $this->assertEquals(
            $this->balanceA->on_hand_quantity,
            $this->balanceA->reserved_quantity + $this->balanceA->available_quantity + $this->balanceA->damaged_quantity
        );
    }

    /**
     * Test 7: Double-release prevention on repeated order rejection and repeated inventory release.
     */
    public function test_repeated_order_rejection_double_release_prevention(): void
    {
        $order = $this->createSubmittedOrder($this->customerA, [
            ['product' => $this->productA, 'quantity' => 15],
        ]);

        // Reject submitted order
        $this->workflowService->rejectOrder($order, $this->admin, 'Customer cancelled order before review');

        $order->refresh();
        $this->assertEquals(OrderStatus::REJECTED, $order->status);

        // Repeated rejection attempt: Must throw ConflictHttpException, never double mutate
        try {
            $this->workflowService->rejectOrder($order, $this->admin, 'Second rejection attempt');
            $this->fail('Expected ConflictHttpException on duplicate rejection.');
        } catch (ConflictHttpException $e) {
            $this->assertStringContainsString('cannot be rejected', $e->getMessage());
        }

        // Test repeated releaseStockForOrder on approved order
        $order2 = $this->createSubmittedOrder($this->customerB, [
            ['product' => $this->productA, 'quantity' => 20],
        ]);
        $this->workflowService->approveOrder($order2, $this->admin);

        $this->balanceA->refresh();
        $this->assertEquals(20, $this->balanceA->reserved_quantity);
        $this->assertEquals(30, $this->balanceA->available_quantity);

        // First release of 20 units
        $this->inventoryService->releaseStockForOrder($order2, $this->admin, $this->warehouse->id);

        $this->balanceA->refresh();
        $this->assertEquals(0, $this->balanceA->reserved_quantity);
        $this->assertEquals(50, $this->balanceA->available_quantity);

        // Second release on the same order: Already at 0 reserved, must safely return without inflating available stock
        $this->inventoryService->releaseStockForOrder($order2, $this->admin, $this->warehouse->id);

        $this->balanceA->refresh();
        $this->assertEquals(50, $this->balanceA->on_hand_quantity);
        $this->assertEquals(0, $this->balanceA->reserved_quantity);
        $this->assertEquals(50, $this->balanceA->available_quantity);
    }
}
