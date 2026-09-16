<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use App\DTOs\Order\CreateOrderDTO;
use App\DTOs\Order\CreateOrderItemDTO;
use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\CompanyInformation;
use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReceivableTransaction;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Order\OrderService;
use App\Services\Order\OrderWorkflowService;
use App\Services\Payment\PaymentService;
use App\Services\Payment\PaymentVerificationService;
use App\Services\System\CompanyInformationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class InvoiceLifecycleAndPrintTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $accountant;
    private User $salesman1;
    private User $salesman2;
    private User $warehouseManager;
    private Customer $customer1;
    private Customer $customer2;
    private TaxProfile $taxProfile;
    private Product $defaultProduct;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        CompanyInformationService::clearCache();

        $this->admin = User::factory()->admin()->create([
            'name' => 'Super Admin',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::factory()->create([
            'name' => 'Alice Accountant',
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman1 = User::factory()->salesman()->create([
            'name' => 'Sam Salesman',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman2 = User::factory()->salesman()->create([
            'name' => 'Sally SecondSalesman',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouseManager = User::factory()->warehouseManager()->create([
            'name' => 'Walter Warehouse',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Central Hub',
                'address_line1' => '100 Distribution Ave',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country_code' => 'USA',
                'is_active' => true,
                'is_default' => true,
            ]
        );

        CompanyInformation::updateOrCreate(
            ['id' => 1],
            [
                'company_name' => 'Unique Wholesale Distributors LLC',
                'legal_business_name' => 'Unique Distributors Inc.',
                'address_line1' => '500 Apex Parkway',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country' => 'US',
                'phone' => '+1 800-555-0199',
                'email' => 'billing@uniquedistributors.com',
                'tax_id' => 'EIN-12-3456789',
                'state_tax_id' => 'GA-9876543',
                'currency' => 'USD',
                'timezone' => 'America/New_York',
                'invoice_footer_note' => 'Thank you for your business.',
            ]
        );

        $this->customer1 = Customer::create([
            'salesman_id' => $this->salesman1->id,
            'code' => 'CUST-001',
            'name' => 'Atlanta Grocers Union',
            'contact_name' => 'George Grocer',
            'email' => 'george@atlantagrocers.com',
            'phone' => '555-0101',
            'status' => CustomerStatus::ACTIVE,
            'billing_address_line1' => '100 Main Street',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30303',
            'shipping_address_line1' => '100 Delivery Dock',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30303',
            'credit_limit' => 50000.00,
            'payment_terms' => PaymentTerms::NET_30,
        ]);

        $this->customer2 = Customer::create([
            'salesman_id' => $this->salesman2->id,
            'code' => 'CUST-002',
            'name' => 'Savannah Foods Corp',
            'contact_name' => 'Sarah Savannah',
            'email' => 'sarah@savannahfoods.com',
            'phone' => '555-0202',
            'status' => CustomerStatus::ACTIVE,
            'billing_address_line1' => '200 Coastal Way',
            'billing_city' => 'Savannah',
            'billing_state' => 'GA',
            'billing_postal_code' => '31401',
            'shipping_address_line1' => '200 Port Dock',
            'shipping_city' => 'Savannah',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '31401',
            'credit_limit' => 30000.00,
            'payment_terms' => PaymentTerms::NET_15,
        ]);

        $this->taxProfile = TaxProfile::create([
            'code' => 'GA_STD',
            'name' => 'Georgia Standard Tax (5%)',
            'rate' => '5.0000',
            'is_active' => true,
        ]);

        $this->defaultProduct = Product::create([
            'sku' => 'SKU-DFL-01',
            'name' => 'Premium Arabica Whole Bean 1kg',
            'unit' => 'BAG',
            'cost_price' => 10.00,
            'default_selling_price' => 20.00,
            'mrp' => 25.00,
            'minimum_allowed_price' => 15.00,
            'tax_profile_id' => $this->taxProfile->id,
            'status' => 'ACTIVE',
        ]);

        InventoryBalance::updateOrCreate(
            [
                'product_id' => $this->defaultProduct->id,
                'warehouse_id' => $this->warehouse->id,
            ],
            [
                'on_hand_quantity' => 10000,
                'reserved_quantity' => 0,
                'available_quantity' => 10000,
                'damaged_quantity' => 0,
            ]
        );
    }

    public function test_invoice_is_automatically_generated_when_salesman_submits_order(): void
    {
        $orderService = app(OrderService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 10,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'First submission invoice test',
            idempotencyKey: 'INV-SUBMIT-TEST-01'
        );

        $order = $orderService->createOrder($this->salesman1, $dto);

        $this->assertNotNull($order);
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);

        // Verify invoice was created immediately upon submission
        $invoice = Invoice::where('order_id', $order->id)->first();
        $this->assertNotNull($invoice, 'Invoice must be generated at order submission time.');
        $this->assertEquals(InvoiceStatus::ISSUED, $invoice->status);
        $this->assertEquals(PaymentStatus::UNPAID, $invoice->payment_status);
        $this->assertEquals('200.00', (string) $invoice->subtotal);
        $this->assertEquals('10.00', (string) $invoice->tax_total);
        $this->assertEquals('210.00', (string) $invoice->grand_total);
        $this->assertEquals('0.00', (string) $invoice->amount_paid);
        $this->assertEquals('210.00', (string) $invoice->amount_due);

        // AR and GL financial ledgers must NOT be posted yet because order is not APPROVED
        $this->assertEquals(0, ReceivableTransaction::where('invoice_id', $invoice->id)->count());
        $this->assertEquals(0, JournalEntry::where('source_type', 'invoice')->where('source_id', $invoice->id)->count());
    }

    public function test_invoice_contains_strictly_order_isolated_data_and_zero_product_images(): void
    {
        $orderService = app(OrderService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 4,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'Zero product images check',
            idempotencyKey: 'INV-ISOLATED-01'
        );

        $order = $orderService->createOrder($this->salesman1, $dto);
        $invoice = Invoice::where('order_id', $order->id)->firstOrFail();

        // Render printable view
        $response = $this->actingAs($this->admin)->get(route('invoices.print', $invoice));
        $response->assertStatus(200);

        $content = $response->getContent();

        // Check RULE-DOC-001: Zero product images on invoice
        $this->assertStringNotContainsString('<img class="product-thumb', $content);
        $this->assertStringNotContainsString('product_image', $content);

        // Check snapshot values
        $response->assertSee($this->defaultProduct->sku);
        $response->assertSee($this->defaultProduct->name);
        $response->assertSee('Atlanta Grocers Union');
        $response->assertSee('100 Main Street');
        $response->assertSee('TAX INVOICE');
    }

    public function test_invoice_generation_is_idempotent_upon_order_approval(): void
    {
        $orderService = app(OrderService::class);
        $workflowService = app(OrderWorkflowService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 5,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'Approval idempotency check',
            idempotencyKey: 'INV-IDEMPOTENT-01'
        );

        $order = $orderService->createOrder($this->salesman1, $dto);
        $invoiceBeforeApproval = Invoice::where('order_id', $order->id)->firstOrFail();
        $invoiceId = $invoiceBeforeApproval->id;

        // Approve order
        $approvedOrder = $workflowService->approveOrder($order, $this->admin);
        $this->assertEquals(OrderStatus::APPROVED, $approvedOrder->status);

        // Verify exactly one invoice exists for this order (no duplicate generated)
        $this->assertEquals(1, Invoice::where('order_id', $order->id)->count());

        $invoiceAfterApproval = Invoice::where('order_id', $order->id)->firstOrFail();
        $this->assertEquals($invoiceId, $invoiceAfterApproval->id);

        // Verify financial postings are recognized after approval
        $this->assertGreaterThan(0, ReceivableTransaction::where('invoice_id', $invoiceId)->count());
        $this->assertGreaterThan(0, JournalEntry::where('source_type', 'invoice')->where('source_id', $invoiceId)->count());
    }

    public function test_invoice_is_voided_if_order_is_rejected_or_cancelled(): void
    {
        $orderService = app(OrderService::class);
        $workflowService = app(OrderWorkflowService::class);

        // Case 1: Order rejection
        $dto1 = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 2,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'Rejection test',
            idempotencyKey: 'INV-REJECT-01'
        );

        $order1 = $orderService->createOrder($this->salesman1, $dto1);
        $invoice1 = Invoice::where('order_id', $order1->id)->firstOrFail();
        $this->assertEquals(InvoiceStatus::ISSUED, $invoice1->status);

        $workflowService->rejectOrder($order1, $this->admin, 'Credit review failure');

        $invoice1->refresh();
        $this->assertEquals(InvoiceStatus::VOID, $invoice1->status, 'Invoice must be VOIDed upon order rejection.');

        // Case 2: Order cancellation
        $dto2 = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 3,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'Cancellation test',
            idempotencyKey: 'INV-CANCEL-01'
        );

        $order2 = $orderService->createOrder($this->salesman1, $dto2);
        $invoice2 = Invoice::where('order_id', $order2->id)->firstOrFail();

        $workflowService->cancelOrder($order2, $this->admin, 'Customer requested immediate cancellation');

        $invoice2->refresh();
        $this->assertEquals(InvoiceStatus::VOID, $invoice2->status, 'Invoice must be VOIDed upon order cancellation.');
    }

    public function test_payment_verification_updates_invoice_amount_paid_and_balance_due(): void
    {
        $orderService = app(OrderService::class);
        $workflowService = app(OrderWorkflowService::class);
        $paymentService = app(PaymentService::class);
        $verificationService = app(PaymentVerificationService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 10,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'Payment verification test (Grand Total: 210.00)',
            idempotencyKey: 'INV-PAY-SYNC-01'
        );

        $order = $orderService->createOrder($this->salesman1, $dto);
        $workflowService->approveOrder($order, $this->admin);

        $invoice = Invoice::where('order_id', $order->id)->firstOrFail();
        $this->assertEquals('210.00', (string) $invoice->grand_total);

        // Step 1: Record partial payment of $100.00
        $payment1 = $paymentService->recordCashPayment([
            'customer_id' => $this->customer1->id,
            'amount' => '100.00',
            'order_id' => $order->id,
            'reference_number' => 'CASH-PART-01',
            'notes' => 'Partial payment 1',
            'payment_date' => Carbon::now()->toDateString(),
        ], $this->salesman1);

        // Verify payment 1
        $verificationService->verifyPayment($payment1, $this->accountant, 'Verified by cash desk');

        $invoice->refresh();
        $this->assertEquals('100.00', (string) $invoice->amount_paid);
        $this->assertEquals('110.00', (string) $invoice->amount_due);
        $this->assertEquals(PaymentStatus::PARTIALLY_PAID, $invoice->payment_status);

        // Step 2: Record remaining payment of $110.00
        $payment2 = $paymentService->recordCashPayment([
            'customer_id' => $this->customer1->id,
            'amount' => '110.00',
            'order_id' => $order->id,
            'reference_number' => 'CASH-FINAL-02',
            'notes' => 'Final settlement payment',
            'payment_date' => Carbon::now()->toDateString(),
        ], $this->salesman1);

        // Verify payment 2
        $verificationService->verifyPayment($payment2, $this->accountant, 'Verified full settlement');

        $invoice->refresh();
        $this->assertEquals('210.00', (string) $invoice->amount_paid);
        $this->assertEquals('0.00', (string) $invoice->amount_due);
        $this->assertEquals(PaymentStatus::PAID, $invoice->payment_status);
        $this->assertEquals(InvoiceStatus::PAID, $invoice->status);
    }

    public function test_salesman_can_print_and_download_invoice_for_their_customer(): void
    {
        $orderService = app(OrderService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 2,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'Salesman access test',
            idempotencyKey: 'INV-SALESMAN-ACCESS-01'
        );

        $order = $orderService->createOrder($this->salesman1, $dto);
        $invoice = Invoice::where('order_id', $order->id)->firstOrFail();

        // 1. Salesman 1 accesses HTML print view
        $responsePrint = $this->actingAs($this->salesman1)->get(route('invoices.print', $invoice));
        $responsePrint->assertStatus(200);
        $responsePrint->assertSee('TAX INVOICE');
        $responsePrint->assertSee($invoice->invoice_number);

        // 2. Salesman 1 downloads PDF
        $responsePdf = $this->actingAs($this->salesman1)->get(route('invoices.pdf', $invoice));
        $responsePdf->assertStatus(200);
        $this->assertEquals('application/pdf', $responsePdf->headers->get('Content-Type'));
    }

    public function test_salesman_cannot_access_invoice_for_another_salesmans_customer(): void
    {
        $orderService = app(OrderService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer1->id, // Belongs to Salesman 1
            items: [
                new CreateOrderItemDTO(
                    productId: $this->defaultProduct->id,
                    quantity: 2,
                    unitPrice: '20.00'
                ),
            ],
            notes: 'Anti IDOR test',
            idempotencyKey: 'INV-ANTI-IDOR-01'
        );

        $order = $orderService->createOrder($this->salesman1, $dto);
        $invoice = Invoice::where('order_id', $order->id)->firstOrFail();

        // Salesman 2 tries to access Salesman 1's invoice (Anti-IDOR returns 404 for unassigned resource)
        $responsePrint = $this->actingAs($this->salesman2)->get(route('invoices.print', $invoice));
        $responsePrint->assertStatus(404);

        $responsePdf = $this->actingAs($this->salesman2)->get(route('invoices.pdf', $invoice));
        $responsePdf->assertStatus(404);
    }

    public function test_invoice_html_print_renders_cleanly_for_3_items_order(): void
    {
        $invoice = $this->createOrderWithItemsCount(3, 'INV-PAG-03');

        $response = $this->actingAs($this->admin)->get(route('invoices.print', $invoice));
        $response->assertStatus(200);
        $response->assertSee('TAX INVOICE');
        $response->assertSee($invoice->invoice_number);

        $items = $invoice->items;
        $this->assertCount(3, $items);
        foreach ($items as $item) {
            $response->assertSee($item->sku_snapshot);
            $response->assertSee($item->product_name_snapshot);
        }
    }

    public function test_invoice_html_print_renders_cleanly_for_8_items_order(): void
    {
        $invoice = $this->createOrderWithItemsCount(8, 'INV-PAG-08');

        $response = $this->actingAs($this->admin)->get(route('invoices.print', $invoice));
        $response->assertStatus(200);
        $response->assertSee('TAX INVOICE');
        $response->assertSee($invoice->invoice_number);

        $items = $invoice->items;
        $this->assertCount(8, $items);
        foreach ($items as $item) {
            $response->assertSee($item->sku_snapshot);
            $response->assertSee($item->product_name_snapshot);
        }
    }

    public function test_invoice_html_print_renders_cleanly_for_12_items_order(): void
    {
        $invoice = $this->createOrderWithItemsCount(12, 'INV-PAG-12');

        $response = $this->actingAs($this->admin)->get(route('invoices.print', $invoice));
        $response->assertStatus(200);
        $response->assertSee('TAX INVOICE');
        $response->assertSee($invoice->invoice_number);

        $items = $invoice->items;
        $this->assertCount(12, $items);
        foreach ($items as $item) {
            $response->assertSee($item->sku_snapshot);
        }
    }

    public function test_invoice_html_print_renders_cleanly_for_25_items_order(): void
    {
        $invoice = $this->createOrderWithItemsCount(25, 'INV-PAG-25');

        $response = $this->actingAs($this->admin)->get(route('invoices.print', $invoice));
        $response->assertStatus(200);
        $response->assertSee('TAX INVOICE');
        $response->assertSee($invoice->invoice_number);

        $items = $invoice->items;
        $this->assertCount(25, $items);
        foreach ($items as $item) {
            $response->assertSee($item->sku_snapshot);
        }
    }

    private function createOrderWithItemsCount(int $count, string $keyPrefix): Invoice
    {
        $orderService = app(OrderService::class);
        $items = [];

        for ($i = 1; $i <= $count; $i++) {
            $sku = sprintf('SKU-TEST-%02d', $i);
            $product = Product::firstOrCreate(
                ['sku' => $sku],
                [
                    'name' => "Catalog Item Product {$i} Premium Package",
                    'unit' => 'BAG',
                    'cost_price' => 5.00 + $i,
                    'default_selling_price' => 10.00 + $i,
                    'mrp' => 15.00 + $i,
                    'minimum_allowed_price' => 8.00 + $i,
                    'tax_profile_id' => $this->taxProfile->id,
                    'status' => 'ACTIVE',
                ]
            );

            InventoryBalance::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'warehouse_id' => $this->warehouse->id,
                ],
                [
                    'on_hand_quantity' => 1000,
                    'reserved_quantity' => 0,
                    'available_quantity' => 1000,
                    'damaged_quantity' => 0,
                ]
            );

            $items[] = new CreateOrderItemDTO(
                productId: $product->id,
                quantity: 2,
                unitPrice: (string) (10.00 + $i)
            );
        }

        $dto = new CreateOrderDTO(
            customerId: $this->customer1->id,
            items: $items,
            notes: "Multi-item test order ({$count} items)",
            idempotencyKey: "{$keyPrefix}-" . Str::uuid()
        );

        $order = $orderService->createOrder($this->salesman1, $dto);

        return Invoice::where('order_id', $order->id)->firstOrFail();
    }
}
