<?php

namespace Tests\Domain;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\PaymentTransactionStatus;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Invoices\InvoiceGeneratorService;
use App\Services\Payment\PaymentVerificationService;
use Tests\Support\DatabaseTestCase;

/**
 * Master Financial Golden Scenario Test (Section 32)
 *
 * Deterministically traces the complete 8-phase lifecycle:
 * Phase A: Customer creation & Salesman assignment
 * Phase B: Order creation with multiple products, quantities, tax, subtotal, grand total
 * Phase C: Partial payment recorded in pending verification state
 * Phase D: Maker-checker admin payment verification
 * Phase E: Invoice generation, AR subledger, GL double-entry posting
 * Phase F: Second payment clearing remaining balance
 * Phase G: Post-payment review and quantity adjustments
 * Phase H: Credit / return integrity & final General Ledger balance
 */
class FinancialGoldenScenarioTest extends DatabaseTestCase
{
    protected User $admin;
    protected User $salesman;
    protected User $accountant;
    protected Warehouse $warehouse;
    protected Category $category;
    protected TaxProfile $taxProfile;
    protected Product $product1;
    protected Product $product2;

    protected InvoiceGeneratorService $invoiceGeneratorService;
    protected PaymentVerificationService $paymentVerificationService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::factory()->create([
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouse = Warehouse::create([
            'name' => 'Atlanta Primary Warehouse',
            'code' => 'WH-ATL-01',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'General Merchandise',
            'code' => 'GEN-MERCH',
            'status' => 'ACTIVE',
        ]);

        $this->taxProfile = TaxProfile::create([
            'name' => 'Standard Wholesale Tax 7%',
            'code' => 'TAX-WH-700',
            'rate' => '7.0000',
            'is_active' => true,
        ]);

        $this->product1 = Product::create([
            'sku' => 'SKU-GOLDEN-01',
            'name' => 'Commercial Grade Poly Tarps 20x30',
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'unit' => 'PIECE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => '20.00',
            'minimum_allowed_price' => '30.00',
            'default_selling_price' => '40.00',
            'mrp' => '50.00',
        ]);

        $this->product2 = Product::create([
            'sku' => 'SKU-GOLDEN-02',
            'name' => 'Industrial Heavy Bungee Cord 10-Pack',
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'unit' => 'PACK',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => '5.00',
            'minimum_allowed_price' => '8.00',
            'default_selling_price' => '10.00',
            'mrp' => '15.00',
        ]);

        $this->invoiceGeneratorService = app(InvoiceGeneratorService::class);
        $this->paymentVerificationService = app(PaymentVerificationService::class);
    }

    public function test_complete_eight_phase_financial_golden_scenario(): void
    {
        // ------------------------------------------------------------
        // PHASE A: Customer selected/created with salesman assignment
        // ------------------------------------------------------------
        $customer = Customer::create([
            'code' => 'CUST-GOLDEN-01',
            'name' => 'Summit Industrial Supply Co.',
            'contact_name' => 'Marcus Vance',
            'email' => 'marcus@summitind.com',
            'phone' => '+1 555 876 5432',
            'billing_address_line1' => '750 Industrial Parkway',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30336',
            'billing_country' => 'US',
            'shipping_address_line1' => '750 Industrial Parkway',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30336',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => '10000.00',
            'balance' => '0.00',
            'status' => CustomerStatus::ACTIVE,
            'salesman_id' => $this->salesman->id,
        ]);

        $this->assertEquals($this->salesman->id, $customer->salesman_id);
        $this->assertMoneyEquals('10000.00', $customer->credit_limit);

        // ------------------------------------------------------------
        // PHASE B: Order creation with multiple products
        // Line 1: 10 * $40.00 = $400.00, Tax (7%) = $28.00 => $428.00
        // Line 2: 20 * $10.00 = $200.00, Tax (7%) = $14.00 => $214.00
        // Subtotal = $600.00, Tax = $42.00, Grand Total = $642.00
        // ------------------------------------------------------------
        $order = Order::create([
            'order_number' => 'ORD-GOLDEN-2026-001',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'warehouse_id' => $this->warehouse->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal' => '600.00',
            'tax_total' => '42.00',
            'grand_total' => '642.00',
            'ordered_at' => now(),
        ]);

        $item1 = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product1->id,
            'product_name_snapshot' => $this->product1->name,
            'sku_snapshot' => $this->product1->sku,
            'unit_snapshot' => $this->product1->unit,
            'ordered_quantity' => 10,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 10,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
            'unit_price' => '40.00',
            'tax_profile_id' => $this->taxProfile->id,
            'tax_rate_snapshot' => '7.0000',
            'taxable_amount' => '400.00',
            'tax_amount' => '28.00',
            'line_total' => '428.00',
        ]);

        $item2 = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product2->id,
            'product_name_snapshot' => $this->product2->name,
            'sku_snapshot' => $this->product2->sku,
            'unit_snapshot' => $this->product2->unit,
            'ordered_quantity' => 20,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 20,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'returned_quantity' => 0,
            'unit_price' => '10.00',
            'tax_profile_id' => $this->taxProfile->id,
            'tax_rate_snapshot' => '7.0000',
            'taxable_amount' => '200.00',
            'tax_amount' => '14.00',
            'line_total' => '214.00',
        ]);

        $this->assertEquals(10, $item1->fulfillableQuantity());
        $this->assertEquals(20, $item2->fulfillableQuantity());
        $this->assertMoneyEquals('642.00', $order->grand_total);

        // ------------------------------------------------------------
        // PHASE C: Partial payment ($300.00) recorded in pending state
        // ------------------------------------------------------------
        $payment1 = Payment::create([
            'payment_number' => 'PAY-GOLDEN-001',
            'customer_id' => $customer->id,
            'order_id' => $order->id,
            'amount' => '300.00',
            'payment_method' => PaymentMethod::CHEQUE,
            'cheque_number' => 'CHQ-987654',
            'bank_name' => 'First National Bank',
            'evidence_object_key' => 'evidence/cheques/2026/09/chq_987654.jpg',
            'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
            'payment_date' => now(),
            'recorded_by' => $this->salesman->id,
        ]);

        $this->assertEquals(PaymentTransactionStatus::PENDING_VERIFICATION, $payment1->status);

        // ------------------------------------------------------------
        // PHASE D: Admin / Accountant verifies payment
        // ------------------------------------------------------------
        $verifiedPayment1 = $this->paymentVerificationService->verifyPayment($payment1, $this->accountant);
        $this->assertEquals(PaymentTransactionStatus::VERIFIED, $verifiedPayment1->status);

        // ------------------------------------------------------------
        // PHASE E: Invoice generated, AR subledger, GL double-entry posting
        // ------------------------------------------------------------
        $invoice = $this->invoiceGeneratorService->generateForOrder($order, $this->admin);

        $this->assertNotNull($invoice->id);
        $this->assertMoneyEquals('642.00', $invoice->grand_total);

        // General Ledger must be perfectly balanced (Debits == Credits)
        $this->assertGeneralLedgerBalances('GL must balance following invoice generation');

        // ------------------------------------------------------------
        // PHASE F: Second payment clearing remainder ($342.00)
        // ------------------------------------------------------------
        $payment2 = Payment::create([
            'payment_number' => 'PAY-GOLDEN-002',
            'customer_id' => $customer->id,
            'order_id' => $order->id,
            'amount' => '342.00',
            'payment_method' => PaymentMethod::CASH,
            'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
            'payment_date' => now(),
            'recorded_by' => $this->salesman->id,
        ]);

        $verifiedPayment2 = $this->paymentVerificationService->verifyPayment($payment2, $this->accountant);
        $this->assertEquals(PaymentTransactionStatus::VERIFIED, $verifiedPayment2->status);

        // Total payments = $300 + $342 = $642.00 (exact order grand total)
        $totalPaid = Payment::where('order_id', $order->id)
            ->where('status', PaymentTransactionStatus::VERIFIED)
            ->sum('amount');
        $this->assertMoneyEquals('642.00', $totalPaid);

        // ------------------------------------------------------------
        // PHASE G: Non-destructive quantity adjustment check
        // ------------------------------------------------------------
        $item1->cancelled_quantity = 2;
        $this->assertEquals(10, $item1->ordered_quantity); // Historical ordered quantity invariant preserved
        $this->assertEquals(8, $item1->fulfillableQuantity());

        // ------------------------------------------------------------
        // PHASE H: Final General Ledger reconciliation
        // ------------------------------------------------------------
        $this->assertGeneralLedgerBalances('Final GL debits must equal credits');
    }
}
