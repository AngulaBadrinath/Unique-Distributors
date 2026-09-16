<?php

namespace Tests\Feature\Document;

use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
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
use App\Services\Invoices\InvoiceNumberGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InvoiceGenerationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $salesman;
    protected Customer $customer;
    protected TaxProfile $taxProfile;
    protected Product $productA;
    protected Product $productB;

    protected function setUp(): void
    {
        parent::setUp();

        \App\Services\System\CompanyInformationService::clearCache();

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => 'ACTIVE',
        ]);

        $this->salesman = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => 'ACTIVE',
        ]);

        $this->customer = Customer::create([
            'code' => 'CUST-001',
            'name' => 'Acme Wholesale Corp',
            'contact_name' => 'John Doe',
            'email' => 'john@acmewholesale.com',
            'phone' => '+1 555-0199',
            'billing_address_line1' => '123 Market Street',
            'billing_address_line2' => 'Suite 200',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30303',
            'billing_country' => 'US',
            'shipping_address_line1' => '456 Warehouse Lane',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30305',
            'shipping_country' => 'US',
            'tax_id' => 'TAX-998877',
            'payment_terms' => PaymentTerms::NET_30,
            'salesman_id' => $this->salesman->id,
            'status' => 'ACTIVE',
        ]);

        $this->taxProfile = TaxProfile::create([
            'code' => 'STD_RATE',
            'name' => 'Standard State Tax',
            'rate' => 0.0800,
            'is_active' => true,
        ]);

        $this->productA = Product::create([
            'sku' => 'PROD-A',
            'name' => 'Widget A Premium',
            'unit' => 'box',
            'cost_price' => 50.00,
            'minimum_allowed_price' => 80.00,
            'default_selling_price' => 100.00,
            'mrp' => 120.00,
            'tax_profile_id' => $this->taxProfile->id,
            'status' => 'ACTIVE',
        ]);

        $this->productB = Product::create([
            'sku' => 'PROD-B',
            'name' => 'Gadget B Pro',
            'unit' => 'pack',
            'cost_price' => 25.00,
            'minimum_allowed_price' => 40.00,
            'default_selling_price' => 50.00,
            'mrp' => 60.00,
            'tax_profile_id' => $this->taxProfile->id,
            'status' => 'ACTIVE',
        ]);

        CompanyInformation::updateOrCreate(
            ['is_singleton' => true],
            [
                'legal_name' => 'Apex Distribution LLC',
                'dba_name' => 'Apex Wholesale',
                'address_line1' => '999 Industrial Pkwy',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country' => 'US',
                'phone' => '+1 800-555-0100',
                'email' => 'billing@apexdist.com',
                'tax_id' => 'EIN-1234567',
                'state_tax_id' => 'GA-998877',
                'currency' => 'USD',
                'timezone' => 'America/New_York',
                'invoice_footer_note' => 'Net 30 terms. Remit payment to Apex Distribution.',
            ]
        );
    }

    protected function createTestOrder(OrderStatus $status = OrderStatus::APPROVED): Order
    {
        $order = Order::create([
            'order_number' => 'ORD-2026-000001',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->admin->id,
            'status' => $status,
            'currency' => 'USD',
            'subtotal' => 250.00,
            'tax_total' => 20.00,
            'adjustment_total' => 0.00,
            'grand_total' => 270.00,
            'submitted_at' => Carbon::now(),
            'approved_at' => $status === OrderStatus::APPROVED || $status === OrderStatus::COMPLETED ? Carbon::now() : null,
            'approved_by' => $status === OrderStatus::APPROVED || $status === OrderStatus::COMPLETED ? $this->admin->id : null,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->productA->id,
            'product_name_snapshot' => 'Widget A Premium',
            'sku_snapshot' => 'PROD-A',
            'unit_snapshot' => 'box',
            'ordered_quantity' => 2,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 2,
            'unit_price' => 100.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => 'STD_RATE',
            'tax_profile_name_snapshot' => 'Standard State Tax',
            'tax_rate_snapshot' => 0.0800,
            'taxable_amount' => 200.00,
            'tax_amount' => 16.00,
            'line_total' => 216.00,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->productB->id,
            'product_name_snapshot' => 'Gadget B Pro',
            'sku_snapshot' => 'PROD-B',
            'unit_snapshot' => 'pack',
            'ordered_quantity' => 1,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 1,
            'unit_price' => 50.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => 'STD_RATE',
            'tax_profile_name_snapshot' => 'Standard State Tax',
            'tax_rate_snapshot' => 0.0800,
            'taxable_amount' => 50.00,
            'tax_amount' => 4.00,
            'line_total' => 54.00,
        ]);

        return $order;
    }

    public function test_invoice_can_be_generated_for_approved_order(): void
    {
        $order = $this->createTestOrder(OrderStatus::APPROVED);
        $generator = app(InvoiceGeneratorService::class);

        $invoice = $generator->generateForOrder($order, $this->admin);

        $this->assertInstanceOf(Invoice::class, $invoice);
        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'order_id' => $order->id,
            'customer_id' => $this->customer->id,
            'status' => InvoiceStatus::ISSUED->value,
            'subtotal' => 250.00,
            'tax_total' => 20.00,
            'grand_total' => 270.00,
            'amount_due' => 270.00,
            'amount_paid' => 0.00,
            'payment_status' => PaymentStatus::UNPAID->value,
            'customer_name_snapshot' => 'Acme Wholesale Corp',
            'customer_code_snapshot' => 'CUST-001',
            'billing_city_snapshot' => 'Atlanta',
            'company_legal_name_snapshot' => 'Apex Distribution LLC',
        ]);

        $this->assertCount(2, $invoice->items);
        $this->assertDatabaseHas('invoice_items', [
            'invoice_id' => $invoice->id,
            'product_name_snapshot' => 'Widget A Premium',
            'sku_snapshot' => 'PROD-A',
            'quantity' => 2,
            'unit_price' => 100.00,
            'tax_amount' => 16.00,
            'line_total' => 216.00,
        ]);
    }

    public function test_invoice_can_be_generated_for_completed_order(): void
    {
        $order = $this->createTestOrder(OrderStatus::COMPLETED);
        $generator = app(InvoiceGeneratorService::class);

        $invoice = $generator->generateForOrder($order, $this->admin);

        $this->assertInstanceOf(Invoice::class, $invoice);
        $this->assertSame(InvoiceStatus::ISSUED, $invoice->status);
    }

    public function test_invoice_cannot_be_generated_for_draft_order(): void
    {
        $order = $this->createTestOrder(OrderStatus::DRAFT);
        $generator = app(InvoiceGeneratorService::class);

        $this->expectException(ValidationException::class);
        $generator->generateForOrder($order, $this->admin);
    }

    public function test_invoice_can_be_generated_for_submitted_order(): void
    {
        $order = $this->createTestOrder(OrderStatus::SUBMITTED);
        $generator = app(InvoiceGeneratorService::class);

        $invoice = $generator->generateForOrder($order, $this->admin);
        $this->assertInstanceOf(Invoice::class, $invoice);
        $this->assertSame(InvoiceStatus::ISSUED, $invoice->status);
    }

    public function test_invoice_cannot_be_generated_for_cancelled_order(): void
    {
        $order = $this->createTestOrder(OrderStatus::CANCELLED);
        $generator = app(InvoiceGeneratorService::class);

        $this->expectException(ValidationException::class);
        $generator->generateForOrder($order, $this->admin);
    }

    public function test_invoice_generation_is_idempotent(): void
    {
        $order = $this->createTestOrder(OrderStatus::APPROVED);
        $generator = app(InvoiceGeneratorService::class);

        $invoice1 = $generator->generateForOrder($order, $this->admin);
        $invoice2 = $generator->generateForOrder($order, $this->admin);

        $this->assertSame($invoice1->id, $invoice2->id);
        $this->assertSame($invoice1->invoice_number, $invoice2->invoice_number);
        $this->assertSame(1, Invoice::where('order_id', $order->id)->count());
    }

    public function test_invoice_number_generator_produces_canonical_format(): void
    {
        $generator = app(InvoiceNumberGenerator::class);
        $year = (int) Carbon::now()->format('Y');

        $num1 = $generator->generate();
        $this->assertMatchesRegularExpression("/^INV-{$year}-\d{6}$/", $num1);
    }

    public function test_invoice_quantity_respects_fulfillable_quantity_after_line_cancellation(): void
    {
        $order = $this->createTestOrder(OrderStatus::APPROVED);

        // Simulate cancellation of 1 unit of product A
        $itemA = $order->items()->where('product_id', $this->productA->id)->first();
        $itemA->update([
            'cancelled_quantity' => 1,
            'taxable_amount' => 100.00,
            'tax_amount' => 8.00,
            'line_total' => 108.00,
        ]);

        $order->update([
            'subtotal' => 150.00,
            'tax_total' => 12.00,
            'grand_total' => 162.00,
        ]);

        $generator = app(InvoiceGeneratorService::class);
        $invoice = $generator->generateForOrder($order, $this->admin);

        $invoiceItemA = $invoice->items()->where('sku_snapshot', 'PROD-A')->first();
        $this->assertSame(1, $invoiceItemA->quantity); // 2 ordered - 1 cancelled = 1
        $this->assertSame('150.00', (string) $invoice->subtotal);
        $this->assertSame('162.00', (string) $invoice->grand_total);
    }

    public function test_admin_can_generate_invoice_via_http_endpoint(): void
    {
        $order = $this->createTestOrder(OrderStatus::APPROVED);

        $response = $this->actingAs($this->admin)->postJson(route('admin.orders.invoice.generate', $order));

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Invoice generated successfully.');
        $this->assertDatabaseHas('invoices', [
            'order_id' => $order->id,
            'status' => 'ISSUED',
        ]);
    }

    public function test_unauthorized_user_cannot_generate_invoice_via_http(): void
    {
        $order = $this->createTestOrder(OrderStatus::APPROVED);

        // Salesman does not have order.approve permission
        $response = $this->actingAs($this->salesman)->postJson(route('admin.orders.invoice.generate', $order));

        $response->assertStatus(403);
    }
}
