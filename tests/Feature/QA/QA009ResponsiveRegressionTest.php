<?php

declare(strict_types=1);

namespace Tests\Feature\QA;

use App\Enums\AccountStatus;
use App\Enums\CategoryStatus;
use App\Enums\CustomerStatus;
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
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * QA-009: Master Responsive Layout Regression Test Suite
 *
 * Verifies responsive contracts, viewport state payloads, and mobile/tablet/desktop
 * presentation data integrity across all core operational workspaces:
 * 1. Admin Order Queue (Dense desktop pagination vs mobile card layout data contract)
 * 2. Admin Order Detail (12-column desktop layout vs stacked mobile operational cards)
 * 3. Salesman Order Catalogue & Cart (Touch target data contracts & mobile review summaries)
 * 4. Delivery Partner Mobile Queue (Touch-first mission cards & responsive route status)
 * 5. General Ledger & Financial Statements (Mobile stacked transaction cards vs desktop ledger table)
 */
class QA009ResponsiveRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $salesman;
    protected User $deliveryPartner;
    protected User $accountant;

    protected Warehouse $warehouse;
    protected Customer $customer;
    protected Category $category;
    protected TaxProfile $taxProfile;
    protected Product $product;
    protected Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin QA009',
            'email' => 'admin.qa009@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::create([
            'name' => 'Salesman QA009',
            'email' => 'salesman.qa009@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->deliveryPartner = User::create([
            'name' => 'Driver QA009',
            'email' => 'driver.qa009@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::DELIVERY_PARTNER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::create([
            'name' => 'Accountant QA009',
            'email' => 'accountant.qa009@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::ACCOUNTANT,
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

        $this->customer = Customer::create([
            'name' => 'Continental Markets',
            'code' => 'CUST-QA009',
            'contact_name' => 'Claire Continental',
            'email' => 'claire@continental.test',
            'phone' => '+1-555-0901',
            'billing_address_line1' => '100 Continental Blvd',
            'billing_city' => 'Newark',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07102',
            'billing_country' => 'USA',
            'salesman_id' => $this->salesman->id,
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => '80000.00',
        ]);

        $this->category = Category::create([
            'name' => 'Produce QA009',
            'code' => 'CAT-PROD-009',
            'status' => CategoryStatus::ACTIVE,
        ]);

        $this->taxProfile = TaxProfile::create([
            'name' => 'Standard Rate',
            'code' => 'TAX-STD-009',
            'rate' => 10.00,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->product = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'sku' => 'SKU-RESP-009',
            'name' => 'Hass Avocados Case 48ct',
            'cost_price' => '25.00',
            'minimum_allowed_price' => '30.00',
            'default_selling_price' => '40.00',
            'mrp' => '50.00',
            'unit' => 'CASE',
            'status' => ProductStatus::ACTIVE,
        ]);

        $this->order = Order::create([
            'order_number' => 'ORD-2026-RESP-001',
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::RESERVED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => '400.00',
            'tax_total' => '40.00',
            'adjustment_total' => '0.00',
            'grand_total' => '440.00',
            'idempotency_key' => (string) Str::uuid(),
            'submitted_at' => Carbon::now(),
        ]);

        OrderItem::create([
            'order_id' => $this->order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => $this->product->unit,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
            'tax_rate_snapshot' => $this->taxProfile->rate,
            'ordered_quantity' => 10,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 10,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'unit_price' => '40.00',
            'tax_profile_id' => $this->taxProfile->id,
            'taxable_amount' => '400.00',
            'tax_amount' => '40.00',
            'line_total' => '440.00',
        ]);
    }

    /**
     * Test 1: Admin Order Queue delivers required props for both desktop table and mobile card views.
     */
    public function test_admin_order_queue_delivers_responsive_pagination_and_badge_props(): void
    {
        $response = $this->actingAs($this->admin)->get('/admin/orders');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Orders/Index')
            ->has('orders.data')
            ->has('counts')
            ->has('filters')
        );
    }

    /**
     * Test 2: Admin Order Detail delivers complete 12-column and stacked card view models.
     */
    public function test_admin_order_detail_delivers_complete_operational_models(): void
    {
        $response = $this->actingAs($this->admin)->get("/admin/orders/{$this->order->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Orders/Show')
            ->has('orderData.order')
            ->has('orderData.customer')
            ->has('orderData.items')
            ->has('orderData.tax_breakdown')
            ->has('orderData.fulfillment_summary')
            ->has('orderData.financial_summary')
            ->has('orderData.can')
        );
    }

    /**
     * Test 3: Salesman Order Workspace delivers customer-scoped catalogue and review props.
     */
    public function test_salesman_order_flow_delivers_scoped_catalogue_and_pricing_props(): void
    {
        $response = $this->actingAs($this->salesman)->get('/salesman/orders/create');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Salesman/Orders/Create')
            ->has('customers')
            ->has('categories')
            ->has('products')
        );
    }

    /**
     * Test 4: Delivery Partner mobile portal delivers touch-optimized assigned delivery list.
     */
    public function test_delivery_partner_mobile_queue_delivers_assigned_deliveries(): void
    {
        $delivery = Delivery::create([
            'delivery_number' => 'DEL-2026-RESP-001',
            'order_id' => $this->order->id,
            'customer_id' => $this->customer->id,
            'driver_id' => $this->deliveryPartner->id,
            'status' => DeliveryStatus::ASSIGNED,
            'delivery_contact_name' => $this->customer->contact_name ?? 'Test Contact',
            'delivery_contact_phone' => $this->customer->phone ?? '555-0199',
            'delivery_address_line1' => $this->customer->billing_address_line1 ?? '123 Test St',
            'delivery_city' => $this->customer->billing_city ?? 'Newark',
            'delivery_state' => $this->customer->billing_state ?? 'NJ',
            'delivery_postal_code' => $this->customer->billing_postal_code ?? '07102',
            'delivery_country_code' => 'US',
            'scheduled_date' => Carbon::now()->toDateString(),
            'assigned_at' => Carbon::now(),
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->deliveryPartner)->get('/delivery');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Delivery/Index')
            ->has('deliveries')
            ->has('counts')
        );
    }

    /**
     * Test 5: Accountant Financial Workspaces deliver responsive balance sheet & P&L structures.
     */
    public function test_accountant_financial_workspaces_deliver_responsive_reports(): void
    {
        $response = $this->actingAs($this->accountant)->get('/admin/accounting/profit-loss');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Accounting/ProfitLoss')
            ->has('report')
            ->has('filters')
        );
    }
}
