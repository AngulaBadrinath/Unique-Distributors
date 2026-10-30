<?php

namespace Tests\Feature\Order;

use App\Enums\AllocationStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAllocation;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CrossRoleProductImagePropagationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $salesman;
    protected User $warehouseUser;
    protected User $driver;
    protected Customer $customer;
    protected Category $category;
    protected Product $product;
    protected ProductImage $productImage;
    protected TaxProfile $taxProfile;
    protected Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('s3');

        $this->taxProfile = TaxProfile::firstOrCreate(
            ['code' => 'TAX-STD'],
            [
                'name' => 'Standard Tax',
                'rate' => 6.625,
                'status' => TaxProfileStatus::ACTIVE,
            ]
        );

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Warehouse',
                'address_line1' => '100 Distribution Way',
                'city' => 'Newark',
                'state' => 'NJ',
                'postal_code' => '07101',
                'country' => 'USA',
                'is_active' => true,
            ]
        );

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
        ]);

        $this->salesman = User::factory()->create([
            'role' => UserRole::SALESMAN,
        ]);

        $this->warehouseUser = User::factory()->create([
            'role' => UserRole::WAREHOUSE_MANAGER,
        ]);

        $this->driver = User::factory()->create([
            'role' => UserRole::DELIVERY_PARTNER,
        ]);

        $this->customer = Customer::create([
            'salesman_id' => $this->salesman->id,
            'tax_profile_id' => $this->taxProfile->id,
            'name' => 'Acme Supermarket',
            'code' => 'CUST-ACME-01',
            'contact_name' => 'John Doe',
            'phone' => '+1-555-0199',
            'email' => 'acme@wholesale.test',
            'billing_address_line1' => '100 Main St',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07101',
            'billing_country' => 'USA',
            'shipping_address_line1' => '100 Main St',
            'shipping_city' => 'Metropolis',
            'shipping_state' => 'NJ',
            'shipping_postal_code' => '07101',
            'shipping_country' => 'USA',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'General Merchandise',
            'code' => 'CAT-GEN',
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'name' => '7 LIVES II CR-4CT',
            'sku' => 'SKU-7LIVES-4CT',
            'unit' => 'CT',
            'default_selling_price' => 270.00,
            'minimum_allowed_price' => 200.00,
            'mrp' => 300.00,
            'status' => ProductStatus::ACTIVE,
            'is_active' => true,
        ]);

        // Create S3 primary image
        $imagePath = 'products/' . $this->product->id . '/primary.jpg';
        Storage::disk('s3')->put($imagePath, 'fake-jpeg-data');

        $this->productImage = ProductImage::create([
            'product_id' => $this->product->id,
            'object_key' => $imagePath,
            'original_filename' => 'primary.jpg',
            'size_bytes' => 1024,
            'mime_type' => 'image/jpeg',
            'sort_order' => 1,
            'is_primary' => true,
        ]);
    }

    protected function createTestOrder(array $attributes = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'ORD-' . uniqid(),
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::SUBMITTED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'delivery_status' => DeliveryStatus::PENDING_ASSIGNMENT,
            'currency' => 'USD',
            'subtotal' => 810.00,
            'tax_total' => 53.66,
            'adjustment_total' => 0.00,
            'grand_total' => 863.66,
        ], $attributes));
    }

    protected function createTestDelivery(Order $order, array $attributes = []): Delivery
    {
        return Delivery::create(array_merge([
            'delivery_number' => 'DEL-' . uniqid(),
            'order_id' => $order->id,
            'customer_id' => $this->customer->id,
            'driver_id' => $this->driver->id,
            'status' => DeliveryStatus::ASSIGNED,
            'delivery_address_line1' => '100 Main St',
            'delivery_city' => 'Metropolis',
            'delivery_state' => 'NJ',
            'delivery_postal_code' => '07101',
            'scheduled_date' => now()->toDateString(),
            'created_by' => $this->admin->id,
        ], $attributes));
    }

    public function test_order_item_model_accessor_returns_primary_image_url_when_product_and_image_loaded(): void
    {
        $order = $this->createTestOrder();

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => 'CT',
            'ordered_quantity' => 3,
            'unit_price' => 270.00,
            'line_total' => 810.00,
            'taxable_amount' => 810.00,
            'tax_amount' => 53.66,
            'tax_rate_snapshot' => 6.625,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
        ]);

        $item->load('product.primaryImage');
        $this->assertNotNull($item->primary_image_url);
        $this->assertStringContainsString('primary.jpg', $item->primary_image_url);
    }

    public function test_delivery_item_model_accessor_returns_primary_image_url_when_product_loaded(): void
    {
        $order = $this->createTestOrder();

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => 'CT',
            'ordered_quantity' => 2,
            'unit_price' => 270.00,
            'line_total' => 540.00,
            'taxable_amount' => 540.00,
            'tax_amount' => 35.78,
            'tax_rate_snapshot' => 6.625,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
        ]);

        $delivery = $this->createTestDelivery($order);

        $allocation = OrderItemAllocation::create([
            'allocation_number' => 'ALC-' . \Illuminate\Support\Str::random(8),
            'order_id' => $order->id,
            'order_item_id' => $orderItem->id,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'warehouse_code' => $this->warehouse->code,
            'allocated_quantity' => 2,
            'reserved_quantity' => 2,
            'picked_quantity' => 2,
            'status' => AllocationStatus::PICKED,
        ]);

        $deliveryItem = DeliveryItem::create([
            'delivery_id' => $delivery->id,
            'order_item_id' => $orderItem->id,
            'order_item_allocation_id' => $allocation->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'deliverable_quantity' => 2,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
        ]);

        $deliveryItem->load('product.primaryImage');
        $this->assertNotNull($deliveryItem->primary_image_url);
        $this->assertStringContainsString('primary.jpg', $deliveryItem->primary_image_url);
    }

    public function test_salesman_order_show_propagates_primary_image_url_on_items(): void
    {
        $order = $this->createTestOrder(['status' => OrderStatus::SUBMITTED]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => 'CT',
            'ordered_quantity' => 3,
            'unit_price' => 270.00,
            'line_total' => 810.00,
            'taxable_amount' => 810.00,
            'tax_amount' => 53.66,
            'tax_rate_snapshot' => 6.625,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
        ]);

        $response = $this->actingAs($this->salesman)->get(route('salesman.orders.show', $order));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Salesman/Orders/Show')
            ->has('order.items.0.primary_image_url')
            ->where('order.items.0.primary_image_url', fn ($url) => !empty($url) && str_contains($url, 'primary.jpg'))
        );
    }

    public function test_admin_order_show_and_review_propagate_primary_image_url_on_items(): void
    {
        $order = $this->createTestOrder(['status' => OrderStatus::SUBMITTED]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => 'CT',
            'ordered_quantity' => 1,
            'unit_price' => 270.00,
            'line_total' => 270.00,
            'taxable_amount' => 270.00,
            'tax_amount' => 17.89,
            'tax_rate_snapshot' => 6.625,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
        ]);

        // Admin show
        $showResponse = $this->actingAs($this->admin)->get(route('admin.orders.show', $order));
        $showResponse->assertOk();
        $showResponse->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Orders/Show')
            ->has('orderData.items.0.primary_image_url')
            ->where('orderData.items.0.primary_image_url', fn ($url) => !empty($url) && str_contains($url, 'primary.jpg'))
        );

        // Admin review
        $reviewResponse = $this->actingAs($this->admin)->get(route('admin.orders.review', $order));
        $reviewResponse->assertOk();
        $reviewResponse->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Orders/Review')
            ->has('reviewData.items.0.primary_image_url')
            ->where('reviewData.items.0.primary_image_url', fn ($url) => !empty($url) && str_contains($url, 'primary.jpg'))
        );
    }

    public function test_warehouse_fulfillment_show_propagates_primary_image_url(): void
    {
        $order = $this->createTestOrder([
            'status' => OrderStatus::PROCESSING,
            'fulfillment_status' => FulfillmentStatus::RESERVED,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => 'CT',
            'ordered_quantity' => 5,
            'reserved_quantity' => 5,
            'unit_price' => 270.00,
            'line_total' => 1350.00,
            'taxable_amount' => 1350.00,
            'tax_amount' => 89.44,
            'tax_rate_snapshot' => 6.625,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
        ]);

        $response = $this->actingAs($this->warehouseUser)->get(route('warehouse.fulfillment.show', $order));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Warehouse/Fulfillment/Show')
            ->has('order.items.0.primary_image_url')
            ->where('order.items.0.primary_image_url', fn ($url) => !empty($url) && str_contains($url, 'primary.jpg'))
        );
    }

    public function test_delivery_partner_show_propagates_primary_image_url(): void
    {
        $order = $this->createTestOrder();

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => 'CT',
            'ordered_quantity' => 2,
            'unit_price' => 270.00,
            'line_total' => 540.00,
            'taxable_amount' => 540.00,
            'tax_amount' => 35.78,
            'tax_rate_snapshot' => 6.625,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
        ]);

        $delivery = $this->createTestDelivery($order);

        $allocation = OrderItemAllocation::create([
            'allocation_number' => 'ALC-' . \Illuminate\Support\Str::random(8),
            'order_id' => $order->id,
            'order_item_id' => $orderItem->id,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'warehouse_code' => $this->warehouse->code,
            'allocated_quantity' => 2,
            'reserved_quantity' => 2,
            'picked_quantity' => 2,
            'status' => AllocationStatus::PICKED,
        ]);

        DeliveryItem::create([
            'delivery_id' => $delivery->id,
            'order_item_id' => $orderItem->id,
            'order_item_allocation_id' => $allocation->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'deliverable_quantity' => 2,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
        ]);

        $response = $this->actingAs($this->driver)->get(route('delivery.show', $delivery));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Delivery/Show')
            ->has('delivery.items.0.primary_image_url')
            ->where('delivery.items.0.primary_image_url', fn ($url) => !empty($url) && str_contains($url, 'primary.jpg'))
        );
    }

    public function test_invoices_strictly_enforce_rule_doc_001_with_zero_product_images(): void
    {
        $order = $this->createTestOrder(['status' => OrderStatus::APPROVED]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => 'CT',
            'ordered_quantity' => 2,
            'unit_price' => 270.00,
            'line_total' => 540.00,
            'taxable_amount' => 540.00,
            'tax_amount' => 35.78,
            'tax_rate_snapshot' => 6.625,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
        ]);

        $generator = app(\App\Services\Invoices\InvoiceGeneratorService::class);
        $invoice = $generator->generateForOrder($order, $this->admin);

        $html = view('documents.invoice', [
            'invoice' => $invoice,
            'unbranded' => true,
        ])->render();

        $this->assertNotEmpty($html);
        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringNotContainsString('primary.jpg', $html);
        $this->assertStringNotContainsString('thumbnail', strtolower($html));

        $pdfService = app(\App\Services\Invoices\InvoicePdfService::class);
        $pdfPath = $pdfService->generate($invoice, true);
        $this->assertFileExists($pdfPath);
    }
}
