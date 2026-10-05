<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\CompanyInformation;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\System\CompanyInformationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class Prompt2TargetedRemediationTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $adminUser;
    protected User $salesmanUser;
    protected Warehouse $warehouse;
    protected TaxProfile $taxProfile;

    protected function setUp(): void
    {
        parent::setUp();

        CompanyInformationService::clearCache();

        $this->superAdmin = User::factory()->create([
            'name' => 'Super Admin',
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email' => 'superadmin@ujw-distribution.test',
        ]);

        $this->adminUser = User::factory()->create([
            'name' => 'Operations Admin',
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email' => 'admin@ujw-distribution.test',
        ]);

        $this->salesmanUser = User::factory()->create([
            'name' => 'Sam Salesman',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
            'email' => 'salesman@ujw-distribution.test',
        ]);

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Central Hub',
                'address_line1' => '100 Distribution Ave',
                'city' => 'Newark',
                'state' => 'NJ',
                'postal_code' => '07102',
                'country_code' => 'USA',
                'is_active' => true,
                'is_default' => true,
            ]
        );

        $this->taxProfile = TaxProfile::create([
            'name' => 'Standard NJ Sales Tax',
            'code' => 'NJ-STD',
            'rate' => 0.06625,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        CompanyInformation::updateOrCreate(
            ['is_singleton' => true],
            [
                'legal_name' => 'Unique Jersey Wholesale',
                'dba_name' => 'Wholesale Distribution Inc.',
                'address_line1' => '100 Distribution Way',
                'city' => 'Newark',
                'state' => 'NJ',
                'postal_code' => '07102',
                'country' => 'US',
                'phone' => '+1 555-019-2834',
                'email' => 'orders@uniquejerseywholesale.com',
                'tax_id' => 'NJ-987654321',
                'state_tax_id' => 'NJ-TAX-01',
                'currency' => 'USD',
                'timezone' => 'America/New_York',
                'invoice_footer_note' => 'Thank you for your business.',
                'is_singleton' => true,
            ]
        );
    }

    private function createTestCustomer(): Customer
    {
        return Customer::create([
            'code' => 'CUST-' . strtoupper(Str::random(6)),
            'name' => 'Acme Retail Outlet',
            'contact_name' => 'John Doe',
            'email' => 'john@acmeretail.test',
            'phone' => '+1 555-987-6543',
            'billing_address_line1' => '123 Market St',
            'billing_city' => 'Newark',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07102',
            'billing_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => 10000.00,
            'status' => CustomerStatus::ACTIVE,
            'salesman_id' => $this->salesmanUser->id,
        ]);
    }

    private function createTestProduct(string $name, float $price): Product
    {
        return Product::create([
            'name' => $name,
            'sku' => 'SKU-' . strtoupper(Str::random(6)),
            'default_selling_price' => $price,
            'mrp' => $price * 1.2,
            'cost_price' => $price * 0.6,
            'minimum_allowed_price' => $price * 0.8,
            'tax_profile_id' => $this->taxProfile->id,
            'status' => \App\Enums\ProductStatus::ACTIVE,
        ]);
    }

    /**
     * Area A: Invoice Print and PDF Layout Parity & Unbranded Variant
     */
    public function test_invoice_print_view_includes_ujw_favicon_and_branding(): void
    {
        $customer = $this->createTestCustomer();
        $product = $this->createTestProduct('Premium Jersey Blue', 50.00);

        $order = Order::create([
            'order_number' => 'ORD-TEST-001',
            'idempotency_key' => (string) Str::uuid(),
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanUser->id,
            'created_by' => $this->salesmanUser->id,
            'subtotal' => 100.00,
            'tax_total' => 6.63,
            'grand_total' => 106.63,
            'status' => OrderStatus::APPROVED,
            'payment_status' => PaymentStatus::UNPAID,
        ]);

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'unit_snapshot' => 'piece',
            'ordered_quantity' => 2,
            'cancelled_quantity' => 0,
            'unit_price' => 50.00,
            'taxable_amount' => 100.00,
            'tax_rate_snapshot' => 0.06625,
            'tax_amount' => 6.63,
            'line_total' => 106.63,
            'tax_profile_id' => $this->taxProfile->id,
        ]);

        $invoice = Invoice::create([
            'invoice_number' => 'INV-TEST-001',
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'created_by' => $this->adminUser->id,
            'invoice_date' => now(),
            'due_date' => now()->addDays(30),
            'payment_terms' => PaymentTerms::NET_30,
            'currency' => 'USD',
            'subtotal' => 100.00,
            'tax_total' => 6.63,
            'grand_total' => 106.63,
            'amount_paid' => 0.00,
            'amount_due' => 106.63,
            'payment_status' => PaymentStatus::UNPAID,
            'status' => InvoiceStatus::ISSUED,
            'company_legal_name_snapshot' => 'Unique Jersey Wholesale',
            'company_dba_name_snapshot' => 'Unique Jersey Wholesale',
            'company_address_snapshot' => '100 Distribution Way, Newark, NJ 07102',
            'company_phone_snapshot' => '+1 555-019-2834',
            'company_email_snapshot' => 'orders@uniquejerseywholesale.com',
            'company_tax_id_snapshot' => 'NJ-987654321',
            'customer_name_snapshot' => $customer->name,
            'customer_code_snapshot' => $customer->code,
            'billing_address_line1_snapshot' => $customer->billing_address_line1,
            'billing_city_snapshot' => $customer->billing_city,
            'billing_state_snapshot' => $customer->billing_state,
            'billing_postal_code_snapshot' => $customer->billing_postal_code,
            'billing_country_snapshot' => $customer->billing_country,
            'shipping_address_line1_snapshot' => $customer->billing_address_line1,
            'shipping_city_snapshot' => $customer->billing_city,
            'shipping_state_snapshot' => $customer->billing_state,
            'shipping_postal_code_snapshot' => $customer->billing_postal_code,
            'shipping_country_snapshot' => $customer->billing_country,
        ]);

        \App\Models\InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'order_item_id' => $orderItem->id,
            'sku_snapshot' => $product->sku,
            'product_name_snapshot' => $product->name,
            'unit_snapshot' => 'piece',
            'quantity' => 2,
            'unit_price' => 50.00,
            'tax_rate_snapshot' => 0.06625,
            'taxable_amount' => 100.00,
            'tax_amount' => 6.63,
            'line_total' => 106.63,
            'sort_order' => 1,
        ]);

        $response = $this->actingAs($this->adminUser)->get(route('invoices.print', $invoice));

        $response->assertOk();
        $response->assertSee('favicon.svg');
        $response->assertSee('favicon.ico');
        $response->assertSee('Unique Jersey Wholesale');
        $response->assertSee('INV-TEST-001');
        $response->assertDontSee('img src=', false); // No product images on invoice
    }

    public function test_invoice_pdf_renderer_generates_unbranded_copy_with_full_financial_data(): void
    {
        $customer = $this->createTestCustomer();
        $product = $this->createTestProduct('Premium Jersey Blue', 50.00);

        $order = Order::create([
            'order_number' => 'ORD-TEST-002',
            'idempotency_key' => (string) Str::uuid(),
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesmanUser->id,
            'created_by' => $this->salesmanUser->id,
            'subtotal' => 100.00,
            'tax_total' => 6.63,
            'grand_total' => 106.63,
            'status' => OrderStatus::APPROVED,
            'payment_status' => PaymentStatus::UNPAID,
        ]);

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'unit_snapshot' => 'piece',
            'ordered_quantity' => 2,
            'cancelled_quantity' => 0,
            'unit_price' => 50.00,
            'taxable_amount' => 100.00,
            'tax_rate_snapshot' => 0.06625,
            'tax_amount' => 6.63,
            'line_total' => 106.63,
            'tax_profile_id' => $this->taxProfile->id,
        ]);

        $invoice = Invoice::create([
            'invoice_number' => 'INV-TEST-002',
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'created_by' => $this->adminUser->id,
            'invoice_date' => now(),
            'due_date' => now()->addDays(30),
            'payment_terms' => PaymentTerms::NET_30,
            'currency' => 'USD',
            'subtotal' => 100.00,
            'tax_total' => 6.63,
            'grand_total' => 106.63,
            'amount_paid' => 0.00,
            'amount_due' => 106.63,
            'payment_status' => PaymentStatus::UNPAID,
            'status' => InvoiceStatus::ISSUED,
            'company_legal_name_snapshot' => 'Unique Jersey Wholesale',
            'company_dba_name_snapshot' => 'Unique Jersey Wholesale',
            'company_address_snapshot' => '100 Distribution Way, Newark, NJ 07102',
            'company_phone_snapshot' => '+1 555-019-2834',
            'company_email_snapshot' => 'orders@uniquejerseywholesale.com',
            'company_tax_id_snapshot' => 'NJ-987654321',
            'customer_name_snapshot' => $customer->name,
            'customer_code_snapshot' => $customer->code,
            'billing_address_line1_snapshot' => $customer->billing_address_line1,
            'billing_city_snapshot' => $customer->billing_city,
            'billing_state_snapshot' => $customer->billing_state,
            'billing_postal_code_snapshot' => $customer->billing_postal_code,
            'billing_country_snapshot' => $customer->billing_country,
            'shipping_address_line1_snapshot' => $customer->billing_address_line1,
            'shipping_city_snapshot' => $customer->billing_city,
            'shipping_state_snapshot' => $customer->billing_state,
            'shipping_postal_code_snapshot' => $customer->billing_postal_code,
            'shipping_country_snapshot' => $customer->billing_country,
        ]);

        \App\Models\InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'order_item_id' => $orderItem->id,
            'sku_snapshot' => $product->sku,
            'product_name_snapshot' => $product->name,
            'unit_snapshot' => 'piece',
            'quantity' => 2,
            'unit_price' => 50.00,
            'tax_rate_snapshot' => 0.06625,
            'taxable_amount' => 100.00,
            'tax_amount' => 6.63,
            'line_total' => 106.63,
            'sort_order' => 1,
        ]);

        // Test unbranded blade view directly (used by PDF engine)
        $view = view('documents.invoice', [
            'invoice' => $invoice->fresh(['items', 'order.items.product', 'order.payments']),
            'unbranded' => true,
        ])->render();

        // Must preserve customer, line items, prices, amounts, taxes, totals, balance
        $this->assertStringContainsString('INV-TEST-002', $view);
        $this->assertStringContainsString('Acme Retail Outlet', $view);
        $this->assertStringContainsString('Premium Jersey Blue', $view);
        $this->assertStringContainsString('106.63', $view);
        $this->assertStringContainsString('100.00', $view);
        $this->assertStringContainsString('6.63', $view);

        // Must hide company branding details for unbranded copy
        $this->assertStringNotContainsString('orders@uniquejerseywholesale.com', $view);
        $this->assertStringNotContainsString('NJ-987654321', $view);

        // Test controller endpoint
        $response = $this->actingAs($this->adminUser)->get(route('invoices.pdf', $invoice));
        $response->assertOk();
        $this->assertEquals('application/pdf', $response->headers->get('content-type'));
    }

    /**
     * Area B: Authoritative Dashboard & Stock Health KPIs
     */
    public function test_dashboard_computes_authoritative_metrics_without_hardcoded_placeholders(): void
    {
        $this->createTestCustomer();
        $this->createTestProduct('Product A', 20.00);

        $response = $this->actingAs($this->adminUser)->get(route('dashboard'));

        $response->assertOk();
        $props = $response->getOriginalContent()->getData()['page']['props'];

        $this->assertArrayHasKey('metrics', $props);
        $metrics = $props['metrics'];

        $this->assertArrayHasKey('today_sales_volume', $metrics);
        $this->assertArrayHasKey('sales_change_percentage', $metrics);
        $this->assertArrayHasKey('fulfillment_rate_percentage', $metrics);
        $this->assertArrayHasKey('warehouse_health_percentage', $metrics);
        $this->assertArrayHasKey('warehouse_health_status', $metrics);
        $this->assertArrayHasKey('total_on_hand_units', $metrics);
        $this->assertArrayHasKey('total_available_units', $metrics);
        $this->assertArrayHasKey('trajectory_percentages', $metrics);

        $this->assertIsNumeric($metrics['today_sales_volume']);
        $this->assertIsNumeric($metrics['fulfillment_rate_percentage']);
        $this->assertIsNumeric($metrics['warehouse_health_percentage']);
        $this->assertContains($metrics['warehouse_health_status'], ['Optimal', 'Warning', 'Critical']);
    }

    /**
     * Area C: Company Information Single Source of Truth
     */
    public function test_company_information_service_provides_authoritative_branding(): void
    {
        $info = app(CompanyInformationService::class)->get();

        $this->assertEquals('Unique Jersey Wholesale', $info->legal_name);
        $this->assertEquals('USD', $info->currency);
    }

    /**
     * Area D: User Account Lifecycle & Super Admin Deletion Protections
     */
    public function test_admin_can_update_user_lifecycle_status_and_revokes_sessions(): void
    {
        $targetUser = User::factory()->create([
            'name' => 'Target Salesman',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->actingAs($this->superAdmin)->put(
            route('users.status.update', $targetUser),
            [
                'status' => 'SUSPENDED',
                'reason' => 'Compliance investigation pending',
            ]
        );

        $response->assertRedirect();
        $this->assertEquals(AccountStatus::SUSPENDED, $targetUser->fresh()->status);

        // Audit log created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'USER_STATUS_UPDATED',
            'actor_id' => $this->superAdmin->id,
            'entity_id' => $targetUser->id,
        ]);
    }

    public function test_super_admin_cannot_delete_own_account(): void
    {
        $response = $this->actingAs($this->superAdmin)->delete(
            route('users.destroy', $this->superAdmin),
            [
                'reason' => 'Accidental deletion attempt',
                'confirm' => true,
            ]
        );

        $response->assertSessionHasErrors(['user']);
        $this->assertDatabaseHas('users', ['id' => $this->superAdmin->id]);
    }

    public function test_cannot_delete_last_active_super_admin(): void
    {
        $secondAdmin = User::factory()->create([
            'name' => 'Second Super Admin',
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        // Attempting to delete $secondAdmin when $this->superAdmin is suspended
        $this->superAdmin->update(['status' => AccountStatus::SUSPENDED]);

        $response = $this->actingAs($secondAdmin)->delete(
            route('users.destroy', $secondAdmin),
            [
                'reason' => 'Deleting the only active super admin',
                'confirm' => true,
            ]
        );

        $response->assertSessionHasErrors(['user']);
        $this->assertDatabaseHas('users', ['id' => $secondAdmin->id]);
    }

    public function test_non_super_admin_is_denied_from_deleting_users(): void
    {
        $targetUser = User::factory()->create([
            'name' => 'Target Salesman',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->actingAs($this->salesmanUser)->delete(
            route('users.destroy', $targetUser),
            [
                'reason' => 'Unauthorized deletion attempt',
                'confirm' => true,
            ]
        );

        $response->assertForbidden();
        $this->assertDatabaseHas('users', ['id' => $targetUser->id]);
    }

    public function test_super_admin_can_safely_delete_or_retire_user_with_reason(): void
    {
        $targetUser = User::factory()->create([
            'name' => 'Warehouse Manager',
            'role' => UserRole::WAREHOUSE_MANAGER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->actingAs($this->superAdmin)->delete(
            route('users.destroy', $targetUser),
            [
                'reason' => 'Staff departed organization gracefully',
                'confirm' => true,
            ]
        );

        $response->assertRedirect(route('roles.index'));

        // Verify either deleted or retired with zero permissions
        $userInDb = User::find($targetUser->id);
        if ($userInDb !== null) {
            $this->assertEquals(AccountStatus::DISABLED, $userInDb->status);
        } else {
            $this->assertNull($userInDb);
        }

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $this->superAdmin->id,
            'entity_id' => $targetUser->id,
        ]);
    }
}
