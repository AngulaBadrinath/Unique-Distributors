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
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class InvoiceImmutabilityTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $salesman;
    protected Customer $customer;
    protected TaxProfile $taxProfile;
    protected Product $product;
    protected Order $order;
    protected Invoice $invoice;

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
            'code' => 'CUST-IMMUT-01',
            'name' => 'Original Customer Name Corp',
            'contact_name' => 'Original Contact',
            'email' => 'original@customer.com',
            'phone' => '+1 555-0100',
            'billing_address_line1' => '100 Original Street',
            'billing_city' => 'Original City',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '100 Original Shipping Dock',
            'shipping_city' => 'Original City',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30301',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'salesman_id' => $this->salesman->id,
            'status' => 'ACTIVE',
        ]);

        $this->taxProfile = TaxProfile::create([
            'code' => 'STD_TAX',
            'name' => 'Original Tax Profile',
            'rate' => 0.0800,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'sku' => 'SKU-IMMUT-01',
            'name' => 'Original Product Name',
            'unit' => 'box',
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
                'legal_name' => 'Original Apex Inc',
                'dba_name' => 'Apex',
                'address_line1' => '100 Original Blvd',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country' => 'US',
                'phone' => '+1 800-555-0100',
                'email' => 'billing@apex.com',
                'tax_id' => 'EIN-001122',
                'currency' => 'USD',
                'timezone' => 'America/New_York',
                'invoice_footer_note' => 'Original invoice note.',
            ]
        );

        $this->order = Order::create([
            'order_number' => 'ORD-2026-IMMUT-01',
            'idempotency_key' => (string) Str::uuid(),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
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
            'order_id' => $this->order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => 'Original Product Name',
            'sku_snapshot' => 'SKU-IMMUT-01',
            'unit_snapshot' => 'box',
            'ordered_quantity' => 2,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 2,
            'unit_price' => 100.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => 'STD_TAX',
            'tax_profile_name_snapshot' => 'Original Tax Profile',
            'tax_rate_snapshot' => 0.0800,
            'taxable_amount' => 200.00,
            'tax_amount' => 16.00,
            'line_total' => 216.00,
        ]);

        $generator = app(InvoiceGeneratorService::class);
        $this->invoice = $generator->generateForOrder($this->order, $this->admin);
    }

    public function test_catalog_product_price_edit_does_not_alter_historical_invoice(): void
    {
        // Alter product master price in database
        $this->product->update([
            'name' => 'MUTATED Product Name V2',
            'default_selling_price' => 999.00,
            'minimum_allowed_price' => 800.00,
        ]);

        $freshInvoice = Invoice::with('items')->find($this->invoice->id);

        $this->assertSame('200.00', (string) $freshInvoice->subtotal);
        $this->assertSame('216.00', (string) $freshInvoice->grand_total);
        $this->assertSame('Original Product Name', $freshInvoice->items->first()->product_name_snapshot);
        $this->assertSame('100.00', (string) $freshInvoice->items->first()->unit_price);
        $this->assertSame('216.00', (string) $freshInvoice->items->first()->line_total);
    }

    public function test_catalog_tax_rate_edit_does_not_alter_historical_invoice(): void
    {
        // Alter tax profile in database
        $this->taxProfile->update([
            'code' => 'NEW_RATE',
            'rate' => 0.2500, // 25% tax
        ]);

        $freshInvoice = Invoice::with('items')->find($this->invoice->id);

        $this->assertSame('16.00', (string) $freshInvoice->tax_total);
        $this->assertSame('0.0800', (string) $freshInvoice->items->first()->tax_rate_snapshot);
        $this->assertSame('16.00', (string) $freshInvoice->items->first()->tax_amount);
    }

    public function test_customer_address_edit_does_not_alter_historical_invoice(): void
    {
        // Alter customer profile and address in database
        $this->customer->update([
            'name' => 'NEW Customer Brand LLC',
            'billing_address_line1' => '999 Completely Different St',
            'billing_city' => 'Los Angeles',
            'billing_state' => 'CA',
        ]);

        $freshInvoice = Invoice::find($this->invoice->id);

        $this->assertSame('Original Customer Name Corp', $freshInvoice->customer_name_snapshot);
        $this->assertSame('100 Original Street', $freshInvoice->billing_address_line1_snapshot);
        $this->assertSame('Original City', $freshInvoice->billing_city_snapshot);
        $this->assertSame('GA', $freshInvoice->billing_state_snapshot);
    }

    public function test_eloquent_blocks_commercial_field_updates_on_issued_invoice(): void
    {
        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('Issued invoices are immutable financial records.');

        $this->invoice->update([
            'grand_total' => 5000.00,
        ]);
    }

    public function test_eloquent_blocks_deletion_of_issued_invoice(): void
    {
        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('Issued invoices are permanent financial records and cannot be deleted.');

        $this->invoice->delete();
    }

    public function test_eloquent_blocks_update_and_deletion_of_invoice_items(): void
    {
        $item = $this->invoice->items->first();

        // 1. Attempt update
        try {
            $item->update(['unit_price' => 999.00]);
            $this->fail('Expected LogicException on invoice item update.');
        } catch (\LogicException $e) {
            $this->assertStringContainsString('Invoice items are immutable historical records', $e->getMessage());
        }

        // 2. Attempt delete
        try {
            $item->delete();
            $this->fail('Expected LogicException on invoice item delete.');
        } catch (\LogicException $e) {
            $this->assertStringContainsString('Invoice items are permanent financial records', $e->getMessage());
        }
    }

    public function test_allowed_operational_fields_can_be_updated_without_exception(): void
    {
        $this->invoice->update([
            'pdf_path' => 'invoices/INV-2026-IMMUT-01.pdf',
            'pdf_generated_at' => Carbon::now(),
            'amount_paid' => 100.00,
            'amount_due' => 116.00,
            'payment_status' => PaymentStatus::PARTIALLY_PAID,
        ]);

        $fresh = Invoice::find($this->invoice->id);
        $this->assertSame('invoices/INV-2026-IMMUT-01.pdf', $fresh->pdf_path);
        $this->assertSame(PaymentStatus::PARTIALLY_PAID, $fresh->payment_status);
        $this->assertSame('100.00', (string) $fresh->amount_paid);
    }

    public function test_foreign_key_prevents_deletion_of_order_with_existing_invoice(): void
    {
        $this->expectException(QueryException::class);

        // Attempting to delete order when invoice exists must violate foreign key ON DELETE RESTRICT
        $this->order->delete();
    }

    /**
     * Verify that mutating CompanyInformation does NOT alter historical invoice company snapshots,
     * and that newly generated invoices capture the updated CompanyInformation values.
     */
    public function test_company_information_update_preserves_historical_invoice_snapshots_and_applies_to_new_invoices(): void
    {
        // 1. Verify original historical invoice company snapshot values
        $historicalInvoice = Invoice::find($this->invoice->id);
        $this->assertSame('Original Apex Inc', $historicalInvoice->company_legal_name_snapshot);
        $this->assertSame('Apex', $historicalInvoice->company_dba_name_snapshot);
        $this->assertNotEmpty($historicalInvoice->company_address_snapshot);
        $this->assertSame('+1 800-555-0100', $historicalInvoice->company_phone_snapshot);
        $this->assertSame('billing@apex.com', $historicalInvoice->company_email_snapshot);
        $this->assertSame('EIN-001122', $historicalInvoice->company_tax_id_snapshot);
        $this->assertSame('Original invoice note.', $historicalInvoice->invoice_footer_note_snapshot);

        // 2. Update CompanyInformation in database to new values
        \App\Services\System\CompanyInformationService::invalidateCache();
        CompanyInformation::updateOrCreate(
            ['is_singleton' => true],
            [
                'legal_name' => 'Updated Apex Logistics International LLC',
                'dba_name' => 'Apex Logistics',
                'address_line1' => '999 Global Trade Way',
                'city' => 'Savannah',
                'state' => 'GA',
                'postal_code' => '31401',
                'country' => 'US',
                'phone' => '+1 (912) 555-9988',
                'email' => 'invoices@apexlogistics.com',
                'tax_id' => 'EIN-998877',
                'currency' => 'USD',
                'timezone' => 'America/New_York',
                'invoice_footer_note' => 'Updated invoice terms: Net 15 days.',
            ]
        );
        \App\Services\System\CompanyInformationService::invalidateCache();

        // 3. Re-fetch historical invoice and assert snapshots remain completely unchanged
        $freshHistoricalInvoice = Invoice::find($this->invoice->id);
        $this->assertSame('Original Apex Inc', $freshHistoricalInvoice->company_legal_name_snapshot);
        $this->assertSame('Apex', $freshHistoricalInvoice->company_dba_name_snapshot);
        $this->assertSame($historicalInvoice->company_address_snapshot, $freshHistoricalInvoice->company_address_snapshot);
        $this->assertSame('+1 800-555-0100', $freshHistoricalInvoice->company_phone_snapshot);
        $this->assertSame('billing@apex.com', $freshHistoricalInvoice->company_email_snapshot);
        $this->assertSame('EIN-001122', $freshHistoricalInvoice->company_tax_id_snapshot);
        $this->assertSame('Original invoice note.', $freshHistoricalInvoice->invoice_footer_note_snapshot);

        // 4. Create a second order and generate a new invoice
        $newOrder = Order::create([
            'order_number' => 'ORD-2026-IMMUT-02',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->admin->id,
            'status' => \App\Enums\OrderStatus::APPROVED,
            'currency' => 'USD',
            'subtotal' => 100.00,
            'tax_total' => 8.00,
            'adjustment_total' => 0.00,
            'grand_total' => 108.00,
            'submitted_at' => \Carbon\Carbon::now(),
            'approved_at' => \Carbon\Carbon::now(),
            'approved_by' => $this->admin->id,
        ]);

        \App\Models\OrderItem::create([
            'order_id' => $newOrder->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => 'Original Product Name',
            'sku_snapshot' => 'SKU-IMMUT-01',
            'unit_snapshot' => 'box',
            'ordered_quantity' => 1,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 1,
            'unit_price' => 100.00,
            'tax_profile_id' => $this->taxProfile->id,
            'tax_profile_code_snapshot' => 'STD_TAX',
            'tax_profile_name_snapshot' => 'Original Tax Profile',
            'tax_rate_snapshot' => 0.0800,
            'taxable_amount' => 100.00,
            'tax_amount' => 8.00,
            'line_total' => 108.00,
        ]);

        $generator = app(\App\Services\Invoices\InvoiceGeneratorService::class);
        $newInvoice = $generator->generateForOrder($newOrder, $this->admin);

        // 5. Assert the newly generated invoice captured the updated CompanyInformation
        $this->assertSame('Updated Apex Logistics International LLC', $newInvoice->company_legal_name_snapshot);
        $this->assertSame('Apex Logistics', $newInvoice->company_dba_name_snapshot);
        $this->assertSame('999 Global Trade Way Suite 400, Savannah, GA 31401, US', $newInvoice->company_address_snapshot);
        $this->assertSame('+1 (912) 555-9988', $newInvoice->company_phone_snapshot);
        $this->assertSame('invoices@apexlogistics.com', $newInvoice->company_email_snapshot);
        $this->assertSame('EIN-998877', $newInvoice->company_tax_id_snapshot);
        $this->assertSame('Updated invoice terms: Net 15 days.', $newInvoice->invoice_footer_note_snapshot);
    }
}
