<?php

namespace Tests\Feature\Order;

use App\Enums\AccountStatus;
use App\Enums\AdjustmentStatus;
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
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminOrderDetailTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $accountant;
    protected User $salesman;
    protected User $warehouseManager;
    protected User $deliveryPartner;
    protected Customer $customer;
    protected Product $productA;
    protected Product $productB;
    protected TaxProfile $taxProfileStandard;
    protected TaxProfile $taxProfileReduced;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'name' => 'Operational Admin',
            'email' => 'admin@wholesale.test',
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->superAdmin = User::factory()->create([
            'name' => 'Super Administrator',
            'email' => 'super@wholesale.test',
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::factory()->create([
            'name' => 'Corporate Accountant',
            'email' => 'accountant@wholesale.test',
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::factory()->create([
            'name' => 'Sam Salesman',
            'email' => 'sam@wholesale.test',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouseManager = User::factory()->create([
            'name' => 'Walter Warehouse',
            'email' => 'warehouse@wholesale.test',
            'role' => UserRole::WAREHOUSE_MANAGER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->deliveryPartner = User::factory()->create([
            'name' => 'Dave Delivery',
            'email' => 'delivery@wholesale.test',
            'role' => UserRole::DELIVERY_PARTNER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->customer = Customer::create([
            'salesman_id' => $this->salesman->id,
            'name' => 'Apex Retailers Inc',
            'code' => 'CUST-APEX-01',
            'contact_name' => 'John Apex',
            'phone' => '+1-555-0987',
            'email' => 'john@apexretail.test',
            'billing_address_line1' => '742 Evergreen Terrace',
            'billing_city' => 'Springfield',
            'billing_state' => 'OR',
            'billing_postal_code' => '97477',
            'billing_country' => 'US',
            'shipping_address_line1' => '100 Industrial Parkway',
            'shipping_city' => 'Springfield',
            'shipping_state' => 'OR',
            'shipping_postal_code' => '97477',
            'shipping_country' => 'US',
            'tax_id' => 'TAX-US-99182',
            'credit_limit' => '1000.00',
            'payment_terms' => 'NET_30',
            'status' => CustomerStatus::ACTIVE,
        ]);

        $this->category = Category::create([
            'name' => 'Pantry Goods',
            'code' => 'PANTRY',
            'sort_order' => 1,
        ]);

        $this->taxProfileStandard = TaxProfile::create([
            'name' => 'Standard Tax',
            'code' => 'TAX_STD',
            'rate' => '10.00',
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->taxProfileReduced = TaxProfile::create([
            'name' => 'Reduced Tax',
            'code' => 'TAX_RED',
            'rate' => '5.00',
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->productA = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfileStandard->id,
            'name' => 'Organic Coffee Beans',
            'sku' => 'BEV-COF-001',
            'unit' => 'CASE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => '21.49',
            'minimum_allowed_price' => '30.00',
            'default_selling_price' => '40.00',
            'mrp' => '50.00',
        ]);

        $this->productB = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfileReduced->id,
            'name' => 'Earl Grey Tea',
            'sku' => 'BEV-TEA-002',
            'unit' => 'BOX',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => '11.87',
            'minimum_allowed_price' => '15.00',
            'default_selling_price' => '20.00',
            'mrp' => '25.00',
        ]);
    }

    protected function createStandardOrder(array $attributes = []): Order
    {
        static $orderSequence = 1;
        $seq = $orderSequence++;

        $order = Order::create(array_merge([
            'order_number' => "ORD-2026-9{$seq}",
            'idempotency_key' => "idemp-test-detail-{$seq}",
            'version' => 1,
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::SUBMITTED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'delivery_status' => DeliveryStatus::PENDING_ASSIGNMENT,
            'adjustment_status' => AdjustmentStatus::NONE,
            'currency' => 'USD',
            'subtotal' => '200.00',
            'tax_total' => '17.50',
            'adjustment_total' => '0.00',
            'grand_total' => '217.50',
            'notes' => 'Please deliver to rear loading dock.',
            'submitted_at' => Carbon::now()->subHours(2),
        ], $attributes));

        // Line Item 1: 5 units of Product A @ $30.00 = $150.00 taxable, 10% tax = $15.00, total = $165.00
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->productA->id,
            'product_name_snapshot' => $this->productA->name,
            'sku_snapshot' => $this->productA->sku,
            'unit_snapshot' => $this->productA->unit,
            'ordered_quantity' => 5,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 0,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
            'unit_price' => '30.00',
            'is_price_overridden' => false,
            'tax_profile_id' => $this->taxProfileStandard->id,
            'tax_profile_code_snapshot' => $this->taxProfileStandard->code,
            'tax_profile_name_snapshot' => $this->taxProfileStandard->name,
            'tax_rate_snapshot' => '10.00',
            'taxable_amount' => '150.00',
            'tax_amount' => '15.00',
            'line_total' => '165.00',
        ]);

        // Line Item 2: 2 units of Product B @ $25.00 (overridden) = $50.00 taxable, 5% tax = $2.50, total = $52.50
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->productB->id,
            'product_name_snapshot' => $this->productB->name,
            'sku_snapshot' => $this->productB->sku,
            'unit_snapshot' => $this->productB->unit,
            'ordered_quantity' => 2,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 0,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
            'unit_price' => '25.00',
            'is_price_overridden' => true,
            'price_override_reason' => 'Special promotion pricing',
            'price_override_approved_by' => $this->admin->id,
            'tax_profile_id' => $this->taxProfileReduced->id,
            'tax_profile_code_snapshot' => $this->taxProfileReduced->code,
            'tax_profile_name_snapshot' => $this->taxProfileReduced->name,
            'tax_rate_snapshot' => '5.00',
            'taxable_amount' => '50.00',
            'tax_amount' => '2.50',
            'line_total' => '52.50',
        ]);

        return $order;
    }

    public function test_admin_can_view_order_detail_workspace(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Orders/Show')
            ->has('orderData')
            ->where('orderData.order.id', $order->id)
            ->where('orderData.order.order_number', $order->order_number)
            ->where('orderData.order.status', 'SUBMITTED')
            ->where('orderData.can.review', true)
            ->where('orderData.can.print', true)
        );
    }

    public function test_super_admin_can_view_order_detail_workspace(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->superAdmin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Orders/Show')
            ->where('orderData.order.id', $order->id)
            ->where('orderData.can.review', true)
        );
    }

    public function test_accountant_can_view_order_detail_workspace_read_only(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->accountant)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Orders/Show')
            ->where('orderData.order.id', $order->id)
            ->where('orderData.can.review', false)
            ->where('orderData.can.print', true)
        );
    }

    public function test_salesman_access_to_admin_order_detail_is_forbidden_403(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->salesman)->get("/admin/orders/{$order->id}");

        $response->assertForbidden();
    }

    public function test_warehouse_manager_access_to_admin_order_detail_is_forbidden_403(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->warehouseManager)->get("/admin/orders/{$order->id}");

        $response->assertForbidden();
    }

    public function test_delivery_partner_access_to_admin_order_detail_is_forbidden_403(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->deliveryPartner)->get("/admin/orders/{$order->id}");

        $response->assertForbidden();
    }

    public function test_unauthenticated_guest_is_redirected_to_login(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->get("/admin/orders/{$order->id}");

        $response->assertRedirect('/login');
    }

    public function test_inactive_admin_is_redirected_to_login(): void
    {
        $inactiveAdmin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::DISABLED,
        ]);

        $order = $this->createStandardOrder();

        $response = $this->actingAs($inactiveAdmin)->get("/admin/orders/{$order->id}");

        $response->assertRedirect('/login');
    }

    public function test_nonexistent_order_returns_404(): void
    {
        $response = $this->actingAs($this->admin)->get('/admin/orders/999999');

        $response->assertNotFound();
    }

    public function test_all_five_status_dimensions_are_accurately_projected(): void
    {
        $order = $this->createStandardOrder([
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::RESERVED,
            'payment_status' => PaymentStatus::PARTIALLY_PAID,
            'delivery_status' => DeliveryStatus::ASSIGNED,
            'adjustment_status' => AdjustmentStatus::REQUESTED,
        ]);

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('orderData.order.status', 'APPROVED')
            ->where('orderData.order.status_label', 'Approved')
            ->where('orderData.order.fulfillment_status', 'RESERVED')
            ->where('orderData.order.fulfillment_status_label', 'Reserved')
            ->where('orderData.order.payment_status', 'PARTIALLY_PAID')
            ->where('orderData.order.payment_status_label', 'Partially Paid')
            ->where('orderData.order.delivery_status', 'ASSIGNED')
            ->where('orderData.order.delivery_status_label', 'Assigned')
            ->where('orderData.order.adjustment_status', 'REQUESTED')
            ->where('orderData.order.adjustment_status_label', 'Requested')
        );
    }

    public function test_lifecycle_states_render_correctly_for_draft_and_completed(): void
    {
        // 1. Draft Order
        $draftOrder = $this->createStandardOrder([
            'status' => OrderStatus::DRAFT,
            'submitted_at' => null,
        ]);

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$draftOrder->id}");
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('orderData.order.status', 'DRAFT')
            ->where('orderData.order.is_reviewable', false)
            ->where('orderData.can.review', false)
        );

        // 2. Completed Order
        $completedOrder = $this->createStandardOrder([
            'status' => OrderStatus::COMPLETED,
            'completed_at' => Carbon::now()->subHour(),
        ]);

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$completedOrder->id}");
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('orderData.order.status', 'COMPLETED')
            ->where('orderData.order.is_reviewable', false)
            ->where('orderData.can.review', false)
        );
    }

    public function test_line_item_quantity_breakdown_reflects_conservation_rule(): void
    {
        $order = $this->createStandardOrder();

        // Update line 1 to simulate partial cancellation: ordered = 10, cancelled = 2, reserved = 8
        $order->items()->first()->update([
            'ordered_quantity' => 10,
            'cancelled_quantity' => 2,
            'reserved_quantity' => 8,
            'picked_quantity' => 4,
            'dispatched_quantity' => 2,
            'delivered_quantity' => 1,
            'returned_quantity' => 0,
        ]);

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->has('orderData.items', 2)
            ->where('orderData.items.0.ordered_quantity', 10)
            ->where('orderData.items.0.cancelled_quantity', 2)
            ->where('orderData.items.0.reserved_quantity', 8)
            ->where('orderData.items.0.fulfillable_quantity', 8) // 10 - 2
            ->where('orderData.items.0.picked_quantity', 4)
            ->where('orderData.items.0.dispatched_quantity', 2)
            ->where('orderData.items.0.delivered_quantity', 1)
        );
    }

    public function test_historical_pricing_and_line_tax_snapshots_remain_immutable(): void
    {
        $order = $this->createStandardOrder();

        // Alter catalog product and tax profile after order placement
        $this->productA->update([
            'name' => 'NEW Brand Coffee 2.0',
            'sku' => 'CHANGED-SKU-999',
            'unit' => 'PALLET',
            'default_selling_price' => '999.00',
        ]);
        $this->taxProfileStandard->update([
            'rate' => '25.00',
        ]);

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            // Historical snapshot values are preserved
            ->where('orderData.items.0.product_name', 'Organic Coffee Beans')
            ->where('orderData.items.0.sku', 'BEV-COF-001')
            ->where('orderData.items.0.unit', 'CASE')
            ->where('orderData.items.0.unit_price', '30.00')
            ->where('orderData.items.0.tax_rate', '10.00')
            ->where('orderData.items.0.line_total', '165.00')
            // Contextual master properties are separately visible
            ->where('orderData.items.0.catalog_product.default_selling_price', '999.00')
        );
    }

    public function test_tax_breakdown_aggregates_accurately_across_multiple_profiles(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->has('orderData.tax_breakdown', 2)
            ->where('orderData.tax_breakdown.0.code', 'TAX_STD')
            ->where('orderData.tax_breakdown.0.taxable_amount', '150.00')
            ->where('orderData.tax_breakdown.0.tax_amount', '15.00')
            ->where('orderData.tax_breakdown.1.code', 'TAX_RED')
            ->where('orderData.tax_breakdown.1.taxable_amount', '50.00')
            ->where('orderData.tax_breakdown.1.tax_amount', '2.50')
        );
    }

    public function test_fulfillment_summary_aggregates_quantities_accurately(): void
    {
        $order = $this->createStandardOrder();

        // 5 + 2 = 7 ordered
        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('orderData.fulfillment_summary.total_ordered', 7)
            ->where('orderData.fulfillment_summary.total_reserved', 0)
            ->where('orderData.fulfillment_summary.total_fulfillable', 7)
            ->where('orderData.fulfillment_summary.total_cancelled', 0)
        );
    }

    public function test_rejection_details_are_projected_when_order_is_rejected(): void
    {
        $cancelledAt = Carbon::now()->subMinute();
        $order = $this->createStandardOrder([
            'status' => OrderStatus::REJECTED,
            'cancelled_at' => $cancelledAt,
            'cancelled_by' => $this->admin->id,
            'cancellation_reason' => 'Customer failed commercial credit check and terms verification.',
        ]);

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('orderData.order.status', 'REJECTED')
            ->where('orderData.order.status_label', 'Rejected')
            ->where('orderData.order.cancellation_reason', 'Customer failed commercial credit check and terms verification.')
            ->where('orderData.order.approver', null)
            ->where('orderData.order.canceller.name', 'Operational Admin')
        );
    }

    public function test_approval_details_are_projected_when_order_is_approved(): void
    {
        $approvedAt = Carbon::now()->subMinutes(10);
        $order = $this->createStandardOrder([
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::RESERVED,
            'approved_at' => $approvedAt,
            'approved_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('orderData.order.status', 'APPROVED')
            ->where('orderData.order.status_label', 'Approved')
            ->where('orderData.order.fulfillment_status', 'RESERVED')
            ->where('orderData.order.approver.name', 'Operational Admin')
            ->where('orderData.order.is_reviewable', false)
            ->where('orderData.can.review', false)
        );
    }

    public function test_cost_price_and_supplier_costs_are_strictly_excluded_from_payload(): void
    {
        $order = $this->createStandardOrder();

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");

        $response->assertOk();
        $content = $response->getContent();

        // Strictly verify that cost_price or purchase_cost is not in the JSON response
        $this->assertStringNotContainsString('"cost_price"', $content);
        $this->assertStringNotContainsString('21.49', $content); // Product A cost
        $this->assertStringNotContainsString('11.87', $content); // Product B cost
    }

    public function test_safe_back_url_is_preserved_and_malicious_open_redirect_is_sanitized(): void
    {
        $order = $this->createStandardOrder();

        // 1. Valid queue back URL
        $validResponse = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}?backUrl=/admin/orders?queue=processing");
        $validResponse->assertOk();
        $validResponse->assertInertia(fn (Assert $page) => $page
            ->where('backUrl', '/admin/orders?queue=processing')
        );

        // 2. Malicious open redirect back URL
        $maliciousResponse = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}?backUrl=https://attacker.evil.com/phish");
        $maliciousResponse->assertOk();
        $maliciousResponse->assertInertia(fn (Assert $page) => $page
            ->where('backUrl', '/admin/orders')
        );
    }

    public function test_query_footprint_is_bounded_with_no_n_plus_one(): void
    {
        $order = $this->createStandardOrder();

        // Add 5 more items to verify query count does not scale linearly
        for ($i = 3; $i <= 7; $i++) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $this->productA->id,
                'product_name_snapshot' => "Batch Item {$i}",
                'sku_snapshot' => "SKU-{$i}",
                'unit_snapshot' => 'CASE',
                'ordered_quantity' => 1,
                'cancelled_quantity' => 0,
                'reserved_quantity' => 0,
                'picked_quantity' => 0,
                'dispatched_quantity' => 0,
                'delivered_quantity' => 0,
                'returned_quantity' => 0,
                'unit_price' => '30.00',
                'is_price_overridden' => false,
                'tax_profile_id' => $this->taxProfileStandard->id,
                'tax_profile_code_snapshot' => $this->taxProfileStandard->code,
                'tax_profile_name_snapshot' => $this->taxProfileStandard->name,
                'tax_rate_snapshot' => '10.00',
                'taxable_amount' => '30.00',
                'tax_amount' => '3.00',
                'line_total' => '33.00',
            ]);
        }

        DB::enableQueryLog();

        $response = $this->actingAs($this->admin)->get("/admin/orders/{$order->id}");
        $response->assertOk();

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // The query count should be bounded and small (typically <= 12 including session/user/order/invoice/eager loads)
        $this->assertLessThanOrEqual(12, count($queries));
    }
}
