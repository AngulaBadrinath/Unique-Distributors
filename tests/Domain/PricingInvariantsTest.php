<?php

namespace Tests\Domain;

use App\DTOs\Pricing\PriceOverrideDecision;
use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\Pricing\PricingOverrideService;
use Illuminate\Auth\Access\AuthorizationException;
use Tests\Support\DomainTestCase;

class PricingInvariantsTest extends DomainTestCase
{
    protected PricingOverrideService $pricingOverrideService;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pricingOverrideService = app(PricingOverrideService::class);

        $category = Category::create([
            'name' => 'Hardware',
            'code' => 'HDW',
            'status' => 'ACTIVE',
        ]);

        $this->product = Product::create([
            'sku' => 'HDW-100',
            'name' => 'Steel Nut M10',
            'category_id' => $category->id,
            'unit' => 'PIECE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => '10.00',
            'minimum_allowed_price' => '15.00',
            'default_selling_price' => '20.00',
            'mrp' => '25.00',
        ]);
    }

    /**
     * RULE-PRI-002: Normal prices must satisfy minimum_allowed_price <= actual <= mrp.
     */
    public function test_standard_price_within_boundaries_is_valid(): void
    {
        $price = (float) $this->product->default_selling_price;
        $min = (float) $this->product->minimum_allowed_price;
        $max = (float) $this->product->mrp;

        $this->assertGreaterThanOrEqual($min, $price);
        $this->assertLessThanOrEqual($max, $price);
    }

    /**
     * Normal salesman cannot order below minimum allowed price without authorization.
     */
    public function test_salesman_cannot_override_below_minimum_price(): void
    {
        $salesman = User::factory()->salesman()->create();

        $this->expectException(AuthorizationException::class);

        $this->pricingOverrideService->authorizeOverride(
            $this->product,
            '12.00',
            $salesman,
            'Attempted unapproved discount'
        );
    }

    /**
     * Super admin can authorize below-minimum price with documented reason.
     */
    public function test_authorized_override_records_actor_and_prices(): void
    {
        $admin = User::factory()->superAdmin()->create();

        $decision = $this->pricingOverrideService->authorizeOverride(
            $this->product,
            '12.50',
            $admin,
            'Volume promotion discount approved by executive'
        );

        $this->assertInstanceOf(PriceOverrideDecision::class, $decision);
        $this->assertTrue($decision->isOverride);
        $this->assertEquals('12.50', $decision->unitPrice);
        $this->assertEquals($admin->id, $decision->authorizedById);
    }
}
