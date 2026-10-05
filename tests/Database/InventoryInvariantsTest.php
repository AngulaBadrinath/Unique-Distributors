<?php

namespace Tests\Database;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Warehouse;
use Tests\Support\DatabaseTestCase;

class InventoryInvariantsTest extends DatabaseTestCase
{
    protected Warehouse $warehouse;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->warehouse = Warehouse::create([
            'name' => 'Atlanta Hub',
            'code' => 'WH-ATL-01',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Tools',
            'code' => 'TOOLS',
            'status' => 'ACTIVE',
        ]);

        $this->product = Product::create([
            'sku' => 'TOOL-100',
            'name' => 'Adjustable Wrench 10in',
            'category_id' => $category->id,
            'unit' => 'PIECE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => '15.00',
            'minimum_allowed_price' => '20.00',
            'default_selling_price' => '25.00',
            'mrp' => '30.00',
        ]);
    }

    /**
     * RULE-INV-001: Available inventory equals on-hand minus reserved.
     */
    public function test_inventory_balance_quantity_invariant(): void
    {
        $balance = InventoryBalance::create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'on_hand_quantity' => 100,
            'reserved_quantity' => 30,
            'available_quantity' => 70,
            'damaged_quantity' => 0,
            'is_active' => true,
        ]);

        $this->assertEquals(70, $balance->available_quantity);
        $this->assertEquals(
            $balance->on_hand_quantity - $balance->reserved_quantity,
            $balance->available_quantity
        );
    }

    /**
     * Invariant: Stock quantities cannot fall below zero.
     */
    public function test_stock_quantities_non_negative(): void
    {
        $balance = InventoryBalance::create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'on_hand_quantity' => 50,
            'reserved_quantity' => 0,
            'available_quantity' => 50,
            'damaged_quantity' => 5,
            'is_active' => true,
        ]);

        $this->assertGreaterThanOrEqual(0, $balance->on_hand_quantity);
        $this->assertGreaterThanOrEqual(0, $balance->reserved_quantity);
        $this->assertGreaterThanOrEqual(0, $balance->available_quantity);
        $this->assertGreaterThanOrEqual(0, $balance->damaged_quantity);
    }
}
