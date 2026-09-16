<?php

namespace Tests\Feature\Operations;

use App\Enums\AllocationStatus;
use App\Enums\CustomerStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class WarehouseFulfillmentTest extends TestCase
{
    use RefreshDatabase;

    private User $warehouseManager;
    private User $admin;
    private Customer $customer;
    private Product $product;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->warehouseManager = User::factory()->warehouseManager()->create(['name' => 'Walter Warehouse']);
        $this->admin = User::factory()->admin()->create(['name' => 'Alice Admin']);

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Distribution Hub',
                'address_line1' => '100 Warehouse Way',
                'city' => 'Logistics City',
                'state' => 'CA',
                'postal_code' => '90001',
                'country_code' => 'USA',
                'is_active' => true,
                'is_default' => true,
            ]
        );

        $this->customer = Customer::create([
            'salesman_id' => $this->admin->id,
            'name' => 'Metro Retailers',
            'code' => 'CUST-METRO-01',
            'contact_name' => 'Mark Metro',
            'phone' => '555-0199',
            'status' => CustomerStatus::ACTIVE,
            'billing_address_line1' => '123 Market St',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'shipping_address_line1' => '456 Freight Ave',
            'shipping_city' => 'Metropolis',
            'shipping_state' => 'NY',
            'shipping_postal_code' => '10002',
            'credit_limit' => 50000.00,
            'current_balance' => 0.00,
            'available_credit' => 50000.00,
            'payment_terms' => 'NET_30',
        ]);

        $taxProfile = TaxProfile::create([
            'code' => 'TAX-STD-01',
            'name' => 'Standard Rate',
            'rate' => 0.08,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'sku' => 'SKU-BEV-001',
            'name' => 'Sparkling Mineral Water 24pk',
            'unit' => 'CASE',
            'cost_price' => 10.00,
            'default_selling_price' => 15.00,
            'mrp' => 20.00,
            'minimum_allowed_price' => 12.00,
            'status' => ProductStatus::ACTIVE,
            'tax_profile_id' => $taxProfile->id,
        ]);
    }

    private function createApprovedOrder(int $orderedQty = 20): Order
    {
        $order = Order::create([
            'order_number' => 'ORD-2026-000101',
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->admin->id,
            'created_by' => $this->admin->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::RESERVED,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal' => 300.00,
            'tax_total' => 24.00,
            'grand_total' => 324.00,
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'approved_at' => Carbon::now(),
            'approved_by' => $this->admin->id,
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
            'reserved_quantity' => $orderedQty,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'unit_price' => 15.00,
            'tax_rate_snapshot' => 0.08,
            'taxable_amount' => 300.00,
            'tax_amount' => 24.00,
            'line_total' => 324.00,
        ]);

        OrderItemAllocation::create([
            'allocation_number' => 'ALC-ORD-2026-000101-1-01',
            'order_id' => $order->id,
            'order_item_id' => $item->id,
            'product_id' => $this->product->id,
            'allocated_quantity' => $orderedQty,
            'reserved_quantity' => $orderedQty,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'status' => AllocationStatus::RESERVED,
            'warehouse_code' => 'MAIN',
            'allocated_by' => $this->admin->id,
            'allocated_at' => Carbon::now(),
        ]);

        return $order;
    }

    public function test_approved_order_appears_in_warehouse_fulfillment_queue(): void
    {
        $order = $this->createApprovedOrder(25);

        $response = $this->actingAs($this->warehouseManager)
            ->get('/admin/warehouse/fulfillment');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Warehouse/Fulfillment/Index')
            ->has('orders.data', 1)
            ->where('orders.data.0.id', $order->id)
            ->where('orders.data.0.order_number', 'ORD-2026-000101')
            ->where('orders.data.0.fulfillment_status', 'RESERVED')
            ->where('badgeCounts.awaiting', 1)
        );
    }

    public function test_warehouse_manager_can_pick_order_items(): void
    {
        $order = $this->createApprovedOrder(25);
        $item = $order->items->first();

        $response = $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/pick", [
                'items' => [
                    [
                        'order_item_id' => $item->id,
                        'picked_quantity' => 25,
                    ],
                ],
            ]);

        $response->assertSessionHasNoErrors();

        $order->refresh();
        $item->refresh();

        $this->assertSame(FulfillmentStatus::PICKED, $order->fulfillment_status);
        $this->assertSame(OrderStatus::PROCESSING, $order->status);
        $this->assertSame(25, $item->picked_quantity);

        $allocation = OrderItemAllocation::where('order_item_id', $item->id)->first();
        $this->assertSame(AllocationStatus::PICKED, $allocation->status);
        $this->assertSame(25, $allocation->picked_quantity);
    }

    public function test_warehouse_manager_can_pack_order(): void
    {
        $order = $this->createApprovedOrder(25);

        // Pick first
        $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/pick");

        // Pack
        $response = $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/pack", [
                'notes' => 'Packed in 2 heavy-duty cartons.',
            ]);

        $response->assertSessionHasNoErrors();

        $order->refresh();
        $this->assertSame(FulfillmentStatus::PACKED, $order->fulfillment_status);

        $allocation = OrderItemAllocation::where('order_id', $order->id)->first();
        $this->assertSame(AllocationStatus::PACKED, $allocation->status);
    }

    public function test_warehouse_manager_can_dispatch_order_and_create_delivery(): void
    {
        $order = $this->createApprovedOrder(25);

        // Pick and pack
        $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/pick");
        $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/pack");

        // Dispatch
        $response = $this->actingAs($this->warehouseManager)
            ->post("/admin/warehouse/fulfillment/{$order->id}/dispatch", [
                'scheduled_date' => Carbon::tomorrow()->toDateString(),
                'delivery_window' => 'Morning (09:00 - 13:00)',
                'driver_instructions' => 'Gate code #9988',
            ]);

        $response->assertSessionHasNoErrors();

        $order->refresh();
        $this->assertSame(FulfillmentStatus::DISPATCHED, $order->fulfillment_status);
        $this->assertSame(DeliveryStatus::PENDING_ASSIGNMENT, $order->delivery_status);

        // Verify Delivery record was created
        $delivery = Delivery::where('order_id', $order->id)->first();
        $this->assertNotNull($delivery);
        $this->assertSame(DeliveryStatus::PENDING_ASSIGNMENT, $delivery->status);
        $this->assertNull($delivery->driver_id);
        $this->assertSame('456 Freight Ave', $delivery->delivery_address_line1);
        $this->assertSame('Metropolis', $delivery->delivery_city);
        $this->assertSame('Morning (09:00 - 13:00)', $delivery->delivery_window);
        $this->assertSame('Gate code #9988', $delivery->driver_instructions);

        // Verify Delivery Items
        $deliveryItems = $delivery->items;
        $this->assertCount(1, $deliveryItems);
        $this->assertSame(25, $deliveryItems->first()->deliverable_quantity);
    }
}
