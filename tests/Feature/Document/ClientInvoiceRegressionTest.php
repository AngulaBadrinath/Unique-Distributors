<?php

namespace Tests\Feature\Document;

use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ClientInvoiceRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => 'ACTIVE',
        ]);

        $this->customer = Customer::create([
            'code' => 'CUST-JERSEY-001',
            'name' => 'Jersey Smoke & Vape LLC',
            'contact_name' => 'John Doe',
            'email' => 'john@jerseysmoke.com',
            'phone' => '+1 (201) 555-0144',
            'billing_address_line1' => '123 Main Street',
            'billing_address_line2' => 'Suite 400',
            'billing_city' => 'Newark',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07102',
            'billing_country' => 'US',
            'shipping_address_line1' => '123 Main Street',
            'shipping_city' => 'Newark',
            'shipping_state' => 'NJ',
            'shipping_postal_code' => '07102',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::DUE_ON_RECEIPT,
            'credit_limit' => 5000.00,
            'status' => 'ACTIVE',
        ]);
    }

    public function test_client_reference_sample_invoice_renders_with_exact_1185_dollar_reconciliation(): void
    {
        // 9 Sample reference items from client's original bill:
        $sampleItems = [
            ['qty' => 3, 'sku' => 'PABLO-50', 'name' => 'pablo', 'price' => 45.00, 'total' => 135.00],
            ['qty' => 1, 'sku' => 'OXBAR-30K', 'name' => 'Oxbar 30k', 'price' => 140.00, 'total' => 140.00],
            ['qty' => 1, 'sku' => 'G-25K', 'name' => 'G 25K', 'price' => 125.00, 'total' => 125.00],
            ['qty' => 2, 'sku' => 'KOMBO-500', 'name' => 'Kombo 500mg', 'price' => 45.00, 'total' => 90.00],
            ['qty' => 1, 'sku' => 'TYSON-15K', 'name' => 'Tyson 15k', 'price' => 95.00, 'total' => 95.00],
            ['qty' => 10, 'sku' => 'M-DISPO-35', 'name' => 'M Dispo 3.5', 'price' => 12.00, 'total' => 120.00],
            ['qty' => 1, 'sku' => 'SEDA-70H', 'name' => 'Seda 70h', 'price' => 120.00, 'total' => 120.00],
            ['qty' => 6, 'sku' => 'BOUTIQUE-2G', 'name' => 'Boutique 2g', 'price' => 30.00, 'total' => 180.00],
            ['qty' => 8, 'sku' => 'MYNT-35G', 'name' => 'Mynt 3.5g', 'price' => 22.50, 'total' => 180.00],
        ];

        $calculatedSubtotal = array_sum(array_column($sampleItems, 'total'));
        $this->assertEquals(1185.00, $calculatedSubtotal);

        $order = Order::create([
            'order_number' => 'ORD-2026-09001',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->admin->id,
            'created_by' => $this->admin->id,
            'status' => OrderStatus::SUBMITTED,
            'currency' => 'USD',
            'subtotal' => $calculatedSubtotal,
            'tax_total' => 0.00,
            'grand_total' => $calculatedSubtotal,
            'payment_status' => PaymentStatus::UNPAID,
        ]);

        $invoice = Invoice::create([
            'order_id' => $order->id,
            'invoice_number' => 'INV-2026-09001',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'invoice_date' => Carbon::parse('2026-09-23'),
            'due_date' => Carbon::parse('2026-09-23'),
            'payment_terms' => PaymentTerms::DUE_ON_RECEIPT,
            'status' => InvoiceStatus::ISSUED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => $calculatedSubtotal,
            'tax_total' => 0.00,
            'adjustment_total' => 0.00,
            'grand_total' => $calculatedSubtotal,
            'amount_paid' => 0.00,
            'amount_due' => $calculatedSubtotal,
            'company_legal_name_snapshot' => 'Unique Jersey Wholesale',
            'company_dba_name_snapshot' => 'Unique Jersey Wholesale',
            'company_address_snapshot' => '100 Distribution Blvd, Secaucus, NJ 07094',
            'company_phone_snapshot' => '+1 (800) 555-0199',
            'company_email_snapshot' => 'billing@uniquejersey.com',
            'company_tax_id_snapshot' => 'XX-XXXXXXX',
            'customer_name_snapshot' => $this->customer->name,
            'customer_code_snapshot' => $this->customer->code,
            'billing_address_line1_snapshot' => $this->customer->billing_address_line1,
            'billing_address_line2_snapshot' => $this->customer->billing_address_line2,
            'billing_city_snapshot' => $this->customer->billing_city,
            'billing_state_snapshot' => $this->customer->billing_state,
            'billing_postal_code_snapshot' => $this->customer->billing_postal_code,
            'billing_country_snapshot' => $this->customer->billing_country,
            'shipping_address_line1_snapshot' => $this->customer->shipping_address_line1,
            'shipping_city_snapshot' => $this->customer->shipping_city,
            'shipping_state_snapshot' => $this->customer->shipping_state,
            'shipping_postal_code_snapshot' => $this->customer->shipping_postal_code,
            'shipping_country_snapshot' => $this->customer->shipping_country,
        ]);

        foreach ($sampleItems as $idx => $item) {
            $product = \App\Models\Product::create([
                'sku' => $item['sku'],
                'name' => $item['name'],
                'unit' => 'PIECE',
                'cost_price' => $item['price'] * 0.6,
                'minimum_allowed_price' => $item['price'] * 0.8,
                'default_selling_price' => $item['price'],
                'mrp' => $item['price'] * 1.2,
                'status' => 'ACTIVE',
            ]);

            $orderItem = \App\Models\OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'product_name_snapshot' => $item['name'],
                'sku_snapshot' => $item['sku'],
                'unit_snapshot' => 'PIECE',
                'ordered_quantity' => $item['qty'],
                'cancelled_quantity' => 0,
                'reserved_quantity' => $item['qty'],
                'unit_price' => $item['price'],
                'tax_rate_snapshot' => 0.0000,
                'taxable_amount' => $item['total'],
                'tax_amount' => 0.00,
                'line_total' => $item['total'],
            ]);

            InvoiceItem::create([
                'invoice_id' => $invoice->id,
                'order_item_id' => $orderItem->id,
                'sku_snapshot' => $item['sku'],
                'product_name_snapshot' => $item['name'],
                'unit_snapshot' => 'PIECE',
                'quantity' => $item['qty'],
                'unit_price' => $item['price'],
                'tax_rate_snapshot' => 0.0000,
                'taxable_amount' => $item['total'],
                'tax_amount' => 0.00,
                'line_total' => $item['total'],
                'sort_order' => $idx + 1,
            ]);
        }

        // Render blade view
        $html = view('documents.invoice', ['invoice' => $invoice->fresh(['items'])])->render();

        // Invariant RULE-DOC-001: STRICTLY ZERO <img> tags
        $this->assertStringNotContainsString('<img', $html, 'Invoice violates RULE-DOC-001: contains <img> tag!');

        // Verify Grand Total matches $1,185.00
        $this->assertStringContainsString('1,185.00', $html);

        // Verify US Letter formatting in stylesheet
        $this->assertStringContainsString('size: letter portrait;', $html);

        // Verify 7-Column Info Grid Headers
        $this->assertStringContainsString('P.O. NUMBER', $html);
        $this->assertStringContainsString('TERMS', $html);
        $this->assertStringContainsString('REP', $html);
        $this->assertStringContainsString('SHIP', $html);
        $this->assertStringContainsString('VIA', $html);
        $this->assertStringContainsString('F.O.B.', $html);
        $this->assertStringContainsString('PROJECT', $html);

        // Verify 5-Column Line Items Table Headers
        $this->assertStringContainsString('QUANTITY', $html);
        $this->assertStringContainsString('ITEM CODE', $html);
        $this->assertStringContainsString('DESCRIPTION', $html);
        $this->assertStringContainsString('PRICE EACH', $html);
        $this->assertStringContainsString('AMOUNT', $html);

        // Verify sample line items are rendered
        $this->assertStringContainsString('Oxbar 30k', $html);
        $this->assertStringContainsString('Tyson 15k', $html);
        $this->assertStringContainsString('Boutique 2g', $html);
        $this->assertStringContainsString('Mynt 3.5g', $html);

        // Verify Vector SVG branding is present
        $this->assertStringContainsString('UNIQUE', $html);
        $this->assertStringContainsString('JERSEY', $html);
        $this->assertStringContainsString('WHOLESALE', $html);
    }
}
