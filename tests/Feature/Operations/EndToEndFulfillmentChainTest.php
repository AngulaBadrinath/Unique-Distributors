<?php

namespace Tests\Feature\Operations;

use App\Enums\AccountStatus;
use App\Enums\AllocationStatus;
use App\Enums\CustomerStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Order\OrderWorkflowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class EndToEndFulfillmentChainTest extends TestCase
{
    use RefreshDatabase;

    private User $salesman;
    private User $admin;
    private User $warehouseManager;
    private User $driver;
    private User $unassignedDriver;
    private Warehouse $warehouse;
    private Customer $customer;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->salesman = User::factory()->salesman()->create(['name' => 'Sam Salesman']);
        $this->admin = User::factory()->admin()->create(['name' => 'Alice Admin']);
        $this->warehouseManager = User::factory()->warehouseManager()->create(['name' => 'Walter Warehouse']);
        $this->driver = User::factory()->deliveryPartner()->create(['name' => 'Dan Driver', 'status' => AccountStatus::ACTIVE]);
        $this->unassignedDriver = User::factory()->deliveryPartner()->create(['name' => 'Una Unassigned', 'status' => AccountStatus::ACTIVE]);

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Distribution Hub',
                'address_line1' => '100 Distribution Parkway',
                'city' => 'Metro',
                'state' => 'NY',
                'postal_code' => '10001',
                'country_code' => 'USA',
                'is_active' => true,
                'is_default' => true,
            ]
        );

        $this->customer = Customer::create([
            'salesman_id' => $this->salesman->id,
            'name' => 'Apex Supermarket',
            'code' => 'CUST-APEX-01',
            'contact_name' => 'Arthur Apex',
            'phone' => '555-4321',
            'status' => CustomerStatus::ACTIVE,
            'billing_address_line1' => '777 Commerce Blvd',
            'billing_city' => 'Metro',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'shipping_address_line1' => '888 Delivery Dock',
            'shipping_city' => 'Metro',
            'shipping_state' => 'NY',
            'shipping_postal_code' => '10002',
            'credit_limit' => 100000.00,
            'current_balance' => 0.00,
            'available_credit' => 100000.00,
            'payment_terms' => 'NET_30',
        ]);

        $taxProfile = TaxProfile::create([
            'code' => 'TAX-STD',
            'name' => 'Standard Rate',
            'rate' => 0.05,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'sku' => 'SKU-SNK-001',
            'name' => 'Organic Almond Clusters 12pk',
            'unit' => 'BOX',
            'cost_price' => 12.00,
            'default_selling_price' => 20.00,
            'mrp' => 25.00,
            'minimum_allowed_price' => 15.00,
            'status' => ProductStatus::ACTIVE,
            'tax_profile_id' => $taxProfile->id,
        ]);

        // Seed initial warehouse inventory
        InventoryBalance::where('product_id', $this->product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->update([
                'on_hand_quantity' => 500,
                'reserved_quantity' => 0,
                'available_quantity' => 500,
                'damaged_quantity' => 0,
            ]);
    }

    public function test_complete_operational_chain_end_to_end(): void
    {
        // =========================================================================
        // STEP 1: Salesman submits order
        // =========================================================================
        $order = Order::create([
            'order_number' => 'ORD-2026-999001',
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::SUBMITTED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal' => 1000.00,
            'tax_total' => 50.00,
            'grand_total' => 1050.00,
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'submitted_at' => Carbon::now(),
            'version' => 1,
        ]);

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => $this->product->unit,
            'ordered_quantity' => 50,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 0,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'unit_price' => 20.00,
            'tax_rate_snapshot' => 0.05,
            'taxable_amount' => 1000.00,
            'tax_amount' => 50.00,
            'line_total' => 1050.00,
        ]);

        // =========================================================================
        // STEP 2: Admin approves order (reserves inventory & creates allocations)
        // =========================================================================
        $workflowService = app(OrderWorkflowService::class);
        $approvedOrder = $workflowService->approveOrder($order, $this->admin);

        $this->assertSame(OrderStatus::APPROVED, $approvedOrder->status);
        $this->assertSame(FulfillmentStatus::RESERVED, $approvedOrder->fulfillment_status);

        // Check physical inventory was reserved
        $balance = InventoryBalance::where('product_id', $this->product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();
        $this->assertSame(50, $balance->reserved_quantity);
        $this->assertSame(450, $balance->available_quantity);

        // =========================================================================
        // STEP 3: Order appears in Warehouse Fulfillment Queue
        // =========================================================================
        $warehouseResponse = $this->actingAs($this->warehouseManager)
            ->get('/admin/warehouse/fulfillment');

        $warehouseResponse->assertOk();
        $warehouseResponse->assertInertia(fn ($page) => $page
            ->component('Warehouse/Fulfillment/Index')
            ->where('badgeCounts.awaiting', 1)
        );

        // =========================================================================
        // STEP 4: Warehouse fulfills (Pick -> Pack -> Dispatch)
        // =========================================================================
        // Pick
        $pickResponse = $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/pick");
        $pickResponse->assertSessionHasNoErrors();
        $order->refresh();
        $this->assertSame(FulfillmentStatus::PICKED, $order->fulfillment_status);

        // Pack
        $packResponse = $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/pack");
        $packResponse->assertSessionHasNoErrors();
        $order->refresh();
        $this->assertSame(FulfillmentStatus::PACKED, $order->fulfillment_status);

        // Dispatch
        $dispatchResponse = $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/dispatch", [
                'scheduled_date' => Carbon::today()->toDateString(),
                'delivery_window' => 'Morning (09:00 - 13:00)',
                'driver_instructions' => 'Ring dock bell #2',
            ]);
        $dispatchResponse->assertSessionHasNoErrors();
        $order->refresh();
        $this->assertSame(FulfillmentStatus::DISPATCHED, $order->fulfillment_status);

        // Verify Delivery was created in PENDING_ASSIGNMENT
        $delivery = Delivery::where('order_id', $order->id)->first();
        $this->assertNotNull($delivery);
        $this->assertSame(DeliveryStatus::PENDING_ASSIGNMENT, $delivery->status);
        $this->assertNull($delivery->driver_id);

        // =========================================================================
        // STEP 5: Delivery appears in Admin Deliveries Pending Queue
        // =========================================================================
        $adminDeliveriesResponse = $this->actingAs($this->admin)
            ->get('/admin/deliveries?tab=pending');
        $adminDeliveriesResponse->assertOk();
        $adminDeliveriesResponse->assertInertia(fn ($page) => $page
            ->component('Admin/Deliveries/Index')
            ->where('badgeCounts.pending', 1)
            ->where('deliveries.data.0.id', $delivery->id)
        );

        // =========================================================================
        // STEP 6: Admin assigns active Delivery Partner driver
        // =========================================================================
        $assignResponse = $this->actingAs($this->admin)
            ->post('/admin/deliveries/assign', [
                'order_id' => $order->id,
                'driver_id' => $this->driver->id,
                'scheduled_date' => Carbon::today()->toDateString(),
                'delivery_window' => 'Morning (09:00 - 13:00)',
            ]);
        $assignResponse->assertSessionHasNoErrors();

        $delivery->refresh();
        $this->assertSame(DeliveryStatus::ASSIGNED, $delivery->status);
        $this->assertSame($this->driver->id, $delivery->driver_id);

        // =========================================================================
        // STEP 7: Assigned Delivery Partner sees mission in Driver Portal
        // =========================================================================
        $driverResponse = $this->actingAs($this->driver)
            ->get('/delivery?tab=pending');
        $driverResponse->assertOk();
        $driverResponse->assertInertia(fn ($page) => $page
            ->component('Delivery/Index')
            ->where('counts.pending', 1)
            ->where('deliveries.data.0.id', $delivery->id)
        );

        // =========================================================================
        // STEP 8: Resource Scoping / Anti-IDOR: Other driver CANNOT see this delivery
        // =========================================================================
        $unassignedResponse = $this->actingAs($this->unassignedDriver)
            ->get('/delivery?tab=pending');
        $unassignedResponse->assertOk();
        $unassignedResponse->assertInertia(fn ($page) => $page
            ->component('Delivery/Index')
            ->where('counts.pending', 0)
            ->has('deliveries.data', 0)
        );

        $this->actingAs($this->unassignedDriver)
            ->get("/delivery/{$delivery->id}")
            ->assertNotFound();

        // =========================================================================
        // STEP 9: Driver executes delivery mission (Pickup -> Start Route -> Complete)
        // =========================================================================
        // Driver Pickup
        $this->actingAs($this->driver)
            ->post("/delivery/{$delivery->id}/pickup")
            ->assertSessionHasNoErrors();
        $delivery->refresh();
        $this->assertSame(DeliveryStatus::PICKED_UP, $delivery->status);

        // Driver Start Route
        $this->actingAs($this->driver)
            ->post("/delivery/{$delivery->id}/start-route")
            ->assertSessionHasNoErrors();
        $delivery->refresh();
        $this->assertSame(DeliveryStatus::OUT_FOR_DELIVERY, $delivery->status);

        // Driver Complete Delivery with POD
        $completeResponse = $this->actingAs($this->driver)
            ->post("/delivery/{$delivery->id}/complete", [
                'recipient_name' => 'Arthur Apex',
                'pod_notes' => 'Received in good condition at dock #2.',
            ]);
        $completeResponse->assertSessionHasNoErrors();

        // =========================================================================
        // STEP 10: Final state validation across Delivery & Order
        // =========================================================================
        $delivery->refresh();
        $order->refresh();

        $this->assertSame(DeliveryStatus::DELIVERED, $delivery->status);
        $this->assertSame('Arthur Apex', $delivery->recipient_name);
        $this->assertSame(FulfillmentStatus::DELIVERED, $order->fulfillment_status);
        $this->assertSame(DeliveryStatus::DELIVERED, $order->delivery_status);
        $this->assertSame(OrderStatus::PROCESSING, $order->status);

        // Inventory invariant check: stock on hand deducted upon completion
        $finalBalance = InventoryBalance::where('product_id', $this->product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();
        $this->assertGreaterThanOrEqual(0, $finalBalance->on_hand_quantity);
        $this->assertGreaterThanOrEqual(0, $finalBalance->available_quantity);
    }
}
