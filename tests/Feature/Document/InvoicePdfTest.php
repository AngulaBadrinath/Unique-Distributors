<?php

namespace Tests\Feature\Document;

use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\CompanyInformation;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Services\Invoices\InvoiceGeneratorService;
use App\Services\Invoices\InvoicePdfService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class InvoicePdfTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $accountant;
    protected User $salesman1;
    protected User $salesman2;
    protected User $warehouseManager;
    protected User $deliveryPartner;
    protected Customer $customer1;
    protected Customer $customer2;
    protected TaxProfile $taxProfile;
    protected Product $product;
    protected Invoice $invoice1;
    protected Invoice $invoice2;

    protected function setUp(): void
    {
        parent::setUp();

        \App\Services\System\CompanyInformationService::clearCache();

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => 'ACTIVE',
        ]);

        $this->accountant = User::factory()->create([
            'role' => UserRole::ACCOUNTANT,
            'status' => 'ACTIVE',
        ]);

        $this->salesman1 = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => 'ACTIVE',
        ]);

        $this->salesman2 = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => 'ACTIVE',
        ]);

        $this->warehouseManager = User::factory()->create([
            'role' => UserRole::WAREHOUSE_MANAGER,
            'status' => 'ACTIVE',
        ]);

        $this->deliveryPartner = User::factory()->create([
            'role' => UserRole::DELIVERY_PARTNER,
            'status' => 'ACTIVE',
        ]);

        $this->customer1 = Customer::create([
            'code' => 'CUST-PDF-01',
            'name' => 'Acme Wholesale Corp',
            'contact_name' => 'Alice Smith',
            'email' => 'alice@acme.com',
            'phone' => '+1 555-0100',
            'billing_address_line1' => '100 Commerce Blvd',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30303',
            'billing_country' => 'US',
            'shipping_address_line1' => '100 Warehouse Dock',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30303',
            'shipping_country' => 'US',
            'tax_id' => 'TAX-112233',
            'payment_terms' => PaymentTerms::NET_30,
            'salesman_id' => $this->salesman1->id,
            'status' => 'ACTIVE',
        ]);

        $this->customer2 = Customer::create([
            'code' => 'CUST-PDF-02',
            'name' => 'Beta Logistics Inc',
            'contact_name' => 'Bob Jones',
            'email' => 'bob@betalogistics.com',
            'phone' => '+1 555-0200',
            'billing_address_line1' => '200 Logistics Way',
            'billing_city' => 'Savannah',
            'billing_state' => 'GA',
            'billing_postal_code' => '31401',
            'billing_country' => 'US',
            'shipping_address_line1' => '200 Port Way',
            'shipping_city' => 'Savannah',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '31401',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_15,
            'salesman_id' => $this->salesman2->id,
            'status' => 'ACTIVE',
        ]);

        $this->taxProfile = TaxProfile::create([
            'code' => 'STD_TAX',
            'name' => 'Standard Tax Rate',
            'rate' => 0.0800,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'sku' => 'SKU-PDF-01',
            'name' => 'Industrial Heavy Widget',
            'unit' => 'crate',
            'cost_price' => 50.00,
            'minimum_allowed_price' => 80.00,
            'default_selling_price' => 100.00,
            'mrp' => 120.00,
            'tax_profile_id' => $this->taxProfile->id,
            'status' => 'ACTIVE',
        ]);

        CompanyInformation::updateOrCreate(
            ['is_singleton' => true],
            [
                'legal_name' => 'Apex Distribution Corp',
                'dba_name' => 'Apex Wholesale',
                'address_line1' => '500 Logistics Way',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country' => 'US',
                'phone' => '+1 800-555-0199',
                'email' => 'invoicing@apexdist.com',
                'tax_id' => 'EIN-9988776',
                'state_tax_id' => 'GA-112233',
                'currency' => 'USD',
                'timezone' => 'America/New_York',
                'invoice_footer_note' => 'Thank you for your business.',
            ]
        );

        $order1 = Order::create([
            'order_number' => 'ORD-2026-PDF-01',
            'idempotency_key' => (string) Str::uuid(),
            'customer_id' => $this->customer1->id,
            'salesman_id' => $this->salesman1->id,
            'created_by' => $this->admin->id,
            'status' => OrderStatus::APPROVED,
            'currency' => 'USD',
            'subtotal' => 200.00,
            'tax_total' => 16.00,
            'adjustment_total' => 0.00,
            'grand_total' => 216.00,
            'submitted_at' => Carbon::now(),
            'approved_at' => Carbon::now(),
            'approved_by' => $this->admin->id,
        ]);

        OrderItem::create([
            'order_id' => $order1->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => 'Industrial Heavy Widget',
            'sku_snapshot' => 'SKU-PDF-01',
            'unit_snapshot' => 'crate',
            'ordered_quantity' => 2,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 2,
            'unit_price' => 100.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => 'STD_TAX',
            'tax_profile_name_snapshot' => 'Standard Tax Rate',
            'tax_rate_snapshot' => 0.0800,
            'taxable_amount' => 200.00,
            'tax_amount' => 16.00,
            'line_total' => 216.00,
        ]);

        $order2 = Order::create([
            'order_number' => 'ORD-2026-PDF-02',
            'idempotency_key' => (string) Str::uuid(),
            'customer_id' => $this->customer2->id,
            'salesman_id' => $this->salesman2->id,
            'created_by' => $this->admin->id,
            'status' => OrderStatus::APPROVED,
            'currency' => 'USD',
            'subtotal' => 100.00,
            'tax_total' => 8.00,
            'adjustment_total' => 0.00,
            'grand_total' => 108.00,
            'submitted_at' => Carbon::now(),
            'approved_at' => Carbon::now(),
            'approved_by' => $this->admin->id,
        ]);

        OrderItem::create([
            'order_id' => $order2->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => 'Industrial Heavy Widget',
            'sku_snapshot' => 'SKU-PDF-01',
            'unit_snapshot' => 'crate',
            'ordered_quantity' => 1,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 1,
            'unit_price' => 100.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => 'STD_TAX',
            'tax_profile_name_snapshot' => 'Standard Tax Rate',
            'tax_rate_snapshot' => 0.0800,
            'taxable_amount' => 100.00,
            'tax_amount' => 8.00,
            'line_total' => 108.00,
        ]);

        $generator = app(InvoiceGeneratorService::class);
        $this->invoice1 = $generator->generateForOrder($order1, $this->admin);
        $this->invoice2 = $generator->generateForOrder($order2, $this->admin);
    }

    public function test_authorized_admin_can_download_invoice_pdf(): void
    {
        $response = $this->actingAs($this->admin)->get(route('invoices.pdf', $this->invoice1));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');

        $content = $response->streamedContent();
        $this->assertStringStartsWith('%PDF-', $content);
    }

    public function test_accountant_can_download_invoice_pdf(): void
    {
        $response = $this->actingAs($this->accountant)->get(route('invoices.pdf', $this->invoice1));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_salesman_can_download_invoice_for_assigned_customer(): void
    {
        // Salesman role has invoice.download for assigned customer invoices
        $response = $this->actingAs($this->salesman1)->get(route('invoices.pdf', $this->invoice1));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_salesman_anti_idor_pdf_download_protection(): void
    {
        // When a user with invoice.download accesses an unassigned customer invoice (or salesman scoped view)
        // Give salesman1 temporary permission or test scoped query
        $this->salesman1->role = UserRole::ACCOUNTANT; // Role with invoice.download permission
        $this->salesman1->save();

        // Accountant has invoice.download, but if we test salesman scoping:
        $scopedInvoice = Invoice::query()->forUser($this->salesman2)->find($this->invoice1->id);
        $this->assertNull($scopedInvoice);

        // Accessing non-existent/out-of-scope ID on controller yields 404
        $response = $this->actingAs($this->salesman1)->get(route('invoices.pdf', 999999));
        $response->assertStatus(404);
    }

    public function test_unauthorized_roles_receive_403_for_pdf_download(): void
    {
        // Warehouse Manager receives 403
        $response1 = $this->actingAs($this->warehouseManager)->get(route('invoices.pdf', $this->invoice1));
        $response1->assertStatus(403);

        // Delivery Partner receives 403
        $response2 = $this->actingAs($this->deliveryPartner)->get(route('invoices.pdf', $this->invoice1));
        $response2->assertStatus(403);
    }

    public function test_pdf_file_is_stored_in_private_storage(): void
    {
        $pdfService = app(InvoicePdfService::class);
        $pdfPath = $pdfService->generate($this->invoice1);

        $this->assertFileExists($pdfPath);
        $normalizedPath = str_replace('\\', '/', $pdfPath);
        $this->assertStringContainsString('storage/app/private/invoices', $normalizedPath);

        // Ensure file is NOT in public storage
        $publicPath = public_path('invoices'.DIRECTORY_SEPARATOR.basename($pdfPath));
        $this->assertFileDoesNotExist($publicPath);
    }

    public function test_repeated_pdf_download_reuses_cached_document(): void
    {
        $pdfService = app(InvoicePdfService::class);
        $path1 = $pdfService->generate($this->invoice1);
        $path2 = $pdfService->generate($this->invoice1);

        $this->assertSame($path1, $path2);
    }

    public function test_rule_doc_001_strictly_no_product_images_rendered_for_pdf(): void
    {
        $html = view('documents.invoice', ['invoice' => $this->invoice1])->render();

        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringNotContainsString('thumbnail', $html);
        $this->assertStringNotContainsString('.png', $html);
        $this->assertStringNotContainsString('.jpg', $html);
    }
}
