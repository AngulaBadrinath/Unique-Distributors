<?php

namespace Tests\Feature\Product;

use App\Enums\AccountStatus;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\Barcode\BarcodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductBarcodeTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $salesman;
    protected User $warehouseManager;
    protected User $deliveryPartner;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('AdminPassword123!'),
        ]);

        $this->salesman = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('SalesmanPassword123!'),
        ]);

        $this->warehouseManager = User::factory()->create([
            'role' => UserRole::WAREHOUSE_MANAGER,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('WarehousePassword123!'),
        ]);

        $this->deliveryPartner = User::factory()->create([
            'role' => UserRole::DELIVERY_PARTNER,
            'status' => AccountStatus::ACTIVE,
            'password' => bcrypt('DeliveryPassword123!'),
        ]);

        $this->category = Category::create([
            'code' => 'CAT-VAPES',
            'name' => 'Vape Products',
            'status' => 'ACTIVE',
        ]);
    }

    public function test_barcode_service_normalizes_whitespace_and_control_characters(): void
    {
        $service = app(BarcodeService::class);

        // Hardware scanner sending carriage return / newline
        $normalized = $service->normalize("  \r\n 012345678905 \t \n ");
        $this->assertEquals('012345678905', $normalized);

        // Format detection
        $this->assertEquals('UPC-A', $service->detectType('012345678905'));
        $this->assertEquals('EAN-13', $service->detectType('9780201379624'));
        $this->assertEquals('CODE-128', $service->detectType('SKU-1004-DISP'));
    }

    public function test_can_create_product_with_valid_barcode(): void
    {
        $payload = [
            'sku' => 'SKU-SCAN-001',
            'name' => 'Oxbar 30K Disposable',
            'description' => 'Oxbar 30000 Puffs Disposable Pod',
            'category_id' => $this->category->id,
            'unit' => 'PIECE',
            'status' => 'ACTIVE',
            'cost_price' => '85.00',
            'minimum_allowed_price' => '120.00',
            'default_selling_price' => '140.00',
            'mrp' => '150.00',
            'barcode' => '840123456789',
            'barcode_type' => 'UPC_A',
        ];

        $response = $this->actingAs($this->admin)->post('/products', $payload);
        $response->assertStatus(302);

        $this->assertDatabaseHas('products', [
            'sku' => 'SKU-SCAN-001',
            'barcode' => '840123456789',
            'barcode_type' => 'UPC_A',
        ]);
    }

    public function test_duplicate_barcode_is_rejected_on_create(): void
    {
        Product::create([
            'sku' => 'SKU-FIRST-001',
            'name' => 'Existing Product',
            'category_id' => $this->category->id,
            'unit' => 'PIECE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => 50.00,
            'minimum_allowed_price' => 80.00,
            'default_selling_price' => 90.00,
            'mrp' => 100.00,
            'barcode' => '123456789012',
            'barcode_type' => 'UPC_A',
        ]);

        $payload = [
            'sku' => 'SKU-SECOND-002',
            'name' => 'Second Product with Same Barcode',
            'category_id' => $this->category->id,
            'unit' => 'PIECE',
            'status' => 'ACTIVE',
            'cost_price' => '50.00',
            'minimum_allowed_price' => '80.00',
            'default_selling_price' => '90.00',
            'mrp' => '100.00',
            'barcode' => '123456789012', // Duplicate barcode
        ];

        $response = $this->actingAs($this->admin)->post('/products', $payload);
        $response->assertSessionHasErrors('barcode');
    }

    public function test_barcode_lookup_endpoint_finds_product_by_barcode(): void
    {
        $product = Product::create([
            'sku' => 'SKU-PABLO-001',
            'name' => 'Pablo 50mg Nicotine Pouches',
            'category_id' => $this->category->id,
            'unit' => 'PACK',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => 25.00,
            'minimum_allowed_price' => 40.00,
            'default_selling_price' => 45.00,
            'mrp' => 50.00,
            'barcode' => '735000123456',
            'barcode_type' => 'EAN_13',
        ]);

        // Hardware scanner sending carriage return
        $response = $this->actingAs($this->salesman)
            ->getJson('/products/barcode/lookup?barcode=' . urlencode("  735000123456\r\n  "));

        $response->assertOk();
        $response->assertJson([
            'found' => true,
            'product' => [
                'id' => $product->id,
                'sku' => 'SKU-PABLO-001',
                'name' => 'Pablo 50mg Nicotine Pouches',
                'barcode' => '735000123456',
            ],
        ]);
    }

    public function test_barcode_lookup_masks_sensitive_cost_prices_for_salesman(): void
    {
        Product::create([
            'sku' => 'SKU-TYSON-15K',
            'name' => 'Tyson 15k Disposable',
            'category_id' => $this->category->id,
            'unit' => 'PIECE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => 55.00,
            'minimum_allowed_price' => 85.00,
            'default_selling_price' => 95.00,
            'mrp' => 110.00,
            'barcode' => '888000999111',
            'barcode_type' => 'CODE_128',
        ]);

        // Salesman query
        $response = $this->actingAs($this->salesman)
            ->getJson('/products/barcode/lookup?barcode=888000999111');

        $response->assertOk();
        $data = $response->json('product');
        $this->assertEquals('95.00', $data['default_selling_price']);
        // Cost price must be hidden/null for salesman
        $this->assertNull($data['cost_price']);

        // Admin query
        $adminResponse = $this->actingAs($this->admin)
            ->getJson('/products/barcode/lookup?barcode=888000999111');
        $adminResponse->assertOk();
        $adminData = $adminResponse->json('product');
        $this->assertEquals('55.00', $adminData['cost_price']);
    }

    public function test_barcode_lookup_returns_not_found_cleanly(): void
    {
        $response = $this->actingAs($this->salesman)
            ->getJson('/products/barcode/lookup?barcode=999999999999');

        $response->assertOk();
        $response->assertJson([
            'found' => false,
            'barcode' => '999999999999',
        ]);
    }

    public function test_barcode_lookup_is_read_only_and_does_not_mutate_state(): void
    {
        Product::create([
            'sku' => 'SKU-READONLY-01',
            'name' => 'Readonly Test Product',
            'category_id' => $this->category->id,
            'unit' => 'PIECE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => 10.00,
            'minimum_allowed_price' => 15.00,
            'default_selling_price' => 20.00,
            'mrp' => 25.00,
            'barcode' => '555444333222',
        ]);

        $beforeCount = Product::count();

        $this->actingAs($this->salesman)
            ->getJson('/products/barcode/lookup?barcode=555444333222')
            ->assertOk();

        $this->assertEquals($beforeCount, Product::count());
    }
}
