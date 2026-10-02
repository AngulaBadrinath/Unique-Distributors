<?php

namespace Tests\Feature\Accounting;

use App\Enums\AccountStatus;
use App\Enums\CategoryStatus;
use App\Enums\CustomerStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\ProductStatus;
use App\Enums\TaxProfileStatus;
use App\Enums\SupplierStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\TaxProfile;
use App\Models\User;
use App\Services\Accounting\AccountService;
use App\Services\Accounting\BalanceSheetService;
use App\Services\Accounting\JournalMappingService;
use App\Services\Accounting\JournalService;
use App\Services\Accounting\ProfitAndLossService;
use App\Services\Accounting\TrialBalanceService;
use App\Services\Invoices\InvoiceGeneratorService;
use App\Services\Payable\PayableLedgerService;
use App\Services\Payment\PaymentVerificationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfitLossReconciliationTest extends TestCase
{
    use RefreshDatabase;

    protected User $accountant;
    protected User $salesman;
    protected AccountService $accountService;
    protected JournalService $journalService;
    protected JournalMappingService $mappingService;
    protected ProfitAndLossService $pnlService;
    protected TrialBalanceService $trialBalanceService;
    protected BalanceSheetService $balanceSheetService;
    protected InvoiceGeneratorService $invoiceGeneratorService;
    protected PaymentVerificationService $paymentVerificationService;
    protected PayableLedgerService $payableLedgerService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountant = User::factory()->create([
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountService = app(AccountService::class);
        $this->journalService = app(JournalService::class);
        $this->mappingService = app(JournalMappingService::class);
        $this->pnlService = app(ProfitAndLossService::class);
        $this->trialBalanceService = app(TrialBalanceService::class);
        $this->balanceSheetService = app(BalanceSheetService::class);
        $this->invoiceGeneratorService = app(InvoiceGeneratorService::class);
        $this->paymentVerificationService = app(PaymentVerificationService::class);
        $this->payableLedgerService = app(PayableLedgerService::class);
    }

    public function test_profit_and_loss_aggregates_all_revenue_cogs_and_expense_accounts(): void
    {
        $startDate = '2026-09-01';
        $endDate = '2026-09-30';

        // 1. Post 4010 Wholesale Sales Revenue ($10,000) & 4030 Delivery Revenue ($500)
        $ar = $this->accountService->resolveAccount('1100');
        $revSales = $this->accountService->resolveAccount('4010');
        $revDelivery = $this->accountService->resolveAccount('4030');
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-09-02', 'description' => 'Wholesale Sales and Freight'],
            [
                ['account_id' => $ar->id, 'debit' => '10500.00', 'credit' => '0.00'],
                ['account_id' => $revSales->id, 'debit' => '0.00', 'credit' => '10000.00'],
                ['account_id' => $revDelivery->id, 'debit' => '0.00', 'credit' => '500.00'],
            ],
            $this->accountant
        );

        // 2. Post 4020 Sales Discounts & Allowances ($400 contra-revenue)
        $discounts = $this->accountService->resolveAccount('4020');
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-09-05', 'description' => 'Customer volume discount allowance'],
            [
                ['account_id' => $discounts->id, 'debit' => '400.00', 'credit' => '0.00'],
                ['account_id' => $ar->id, 'debit' => '0.00', 'credit' => '400.00'],
            ],
            $this->accountant
        );

        // 3. Post 5010 Cost of Goods Sold ($6,000)
        $cogs = $this->accountService->resolveAccount('5010');
        $inventory = $this->accountService->resolveAccount('1200');
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-09-10', 'description' => 'COGS Recognition on delivered order'],
            [
                ['account_id' => $cogs->id, 'debit' => '6000.00', 'credit' => '0.00'],
                ['account_id' => $inventory->id, 'debit' => '0.00', 'credit' => '6000.00'],
            ],
            $this->accountant
        );

        // 4. Post 5020 Inventory Shrinkage ($250)
        $shrinkage = $this->accountService->resolveAccount('5020');
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-09-15', 'description' => 'Damaged stock write-off'],
            [
                ['account_id' => $shrinkage->id, 'debit' => '250.00', 'credit' => '0.00'],
                ['account_id' => $inventory->id, 'debit' => '0.00', 'credit' => '250.00'],
            ],
            $this->accountant
        );

        // 5. Post 5030 Operating & Procurement Expense ($800)
        $expense = $this->accountService->resolveAccount('5030');
        $cash = $this->accountService->resolveAccount('1010');
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-09-20', 'description' => 'Warehouse utilities expense'],
            [
                ['account_id' => $expense->id, 'debit' => '800.00', 'credit' => '0.00'],
                ['account_id' => $cash->id, 'debit' => '0.00', 'credit' => '800.00'],
            ],
            $this->accountant
        );

        // 6. Post 5040 Payment Processing / Bank Charges ($50)
        $bankCharges = $this->accountService->resolveAccount('5040');
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-09-25', 'description' => 'Bank service fees'],
            [
                ['account_id' => $bankCharges->id, 'debit' => '50.00', 'credit' => '0.00'],
                ['account_id' => $cash->id, 'debit' => '0.00', 'credit' => '50.00'],
            ],
            $this->accountant
        );

        // Fetch P&L
        $pnl = $this->pnlService->getProfitAndLoss($startDate, $endDate);

        // Verify Calculations:
        // Operating Revenue: 10,000 + 500 = 10,500.00
        $this->assertEquals('10500.00', $pnl['operating_revenue']['total']);
        // Contra Revenue: 400.00
        $this->assertEquals('400.00', $pnl['contra_revenue']['total']);
        // Net Revenue: 10,500 - 400 = 10,100.00
        $this->assertEquals('10100.00', $pnl['net_revenue']);
        // COGS: 6,000.00
        $this->assertEquals('6000.00', $pnl['cost_of_goods_sold']['total']);
        // Gross Profit: 10,100 - 6,000 = 4,100.00
        $this->assertEquals('4100.00', $pnl['gross_profit']);
        // Operating Expenses: 250 + 800 + 50 = 1,100.00
        $this->assertEquals('1100.00', $pnl['total_operating_expenses']);
        // Net Income: 4,100 - 1,100 = 3,000.00
        $this->assertEquals('3000.00', $pnl['net_income']);

        // Verify Trial Balance Reconciliation: Total Debits == Total Credits
        $trialBalance = $this->trialBalanceService->getTrialBalance($endDate, $startDate);
        $this->assertTrue($trialBalance['is_balanced']);
        $this->assertEquals($trialBalance['total_debits'], $trialBalance['total_credits']);

        // Verify Balance Sheet Reconciliation: Net Income matches Current Earnings
        $balanceSheet = $this->balanceSheetService->getBalanceSheet($endDate);
        $this->assertTrue($balanceSheet['is_balanced']);
        $this->assertEquals('3000.00', $balanceSheet['equity']['current_period_earnings']);
    }

    public function test_profit_and_loss_respects_date_boundaries_and_empty_period(): void
    {
        $sales = $this->accountService->resolveAccount('4010');
        $ar = $this->accountService->resolveAccount('1100');

        // Post on 2026-08-31 (Before period)
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-08-31', 'description' => 'August Sales'],
            [
                ['account_id' => $ar->id, 'debit' => '5000.00', 'credit' => '0.00'],
                ['account_id' => $sales->id, 'debit' => '0.00', 'credit' => '5000.00'],
            ],
            $this->accountant
        );

        // Post on 2026-09-15 (Inside period)
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-09-15', 'description' => 'September Sales'],
            [
                ['account_id' => $ar->id, 'debit' => '3000.00', 'credit' => '0.00'],
                ['account_id' => $sales->id, 'debit' => '0.00', 'credit' => '3000.00'],
            ],
            $this->accountant
        );

        // Post on 2026-10-01 (After period)
        $this->journalService->createAndPostJournal(
            ['accounting_date' => '2026-10-01', 'description' => 'October Sales'],
            [
                ['account_id' => $ar->id, 'debit' => '7000.00', 'credit' => '0.00'],
                ['account_id' => $sales->id, 'debit' => '0.00', 'credit' => '7000.00'],
            ],
            $this->accountant
        );

        // 1. Query September only: should be exactly 3,000.00
        $sepPnl = $this->pnlService->getProfitAndLoss('2026-09-01', '2026-09-30');
        $this->assertEquals('3000.00', $sepPnl['operating_revenue']['total']);
        $this->assertEquals('3000.00', $sepPnl['net_income']);

        // 2. Query empty period (e.g. 2026-11-01 to 2026-11-30): should be exactly 0.00
        $novPnl = $this->pnlService->getProfitAndLoss('2026-11-01', '2026-11-30');
        $this->assertEquals('0.00', $novPnl['operating_revenue']['total']);
        $this->assertEquals('0.00', $novPnl['net_revenue']);
        $this->assertEquals('0.00', $novPnl['cost_of_goods_sold']['total']);
        $this->assertEquals('0.00', $novPnl['gross_profit']);
        $this->assertEquals('0.00', $novPnl['total_operating_expenses']);
        $this->assertEquals('0.00', $novPnl['net_income']);
    }

    public function test_profit_and_loss_end_to_end_operational_flow_to_gl(): void
    {
        Carbon::setTestNow('2026-09-05 10:00:00');
        try {
            $category = Category::create([
            'name' => 'Beverages',
            'code' => 'BEV',
            'status' => CategoryStatus::ACTIVE,
        ]);

        $taxProfile = TaxProfile::create([
            'name' => 'Standard Tax',
            'code' => 'TAX-STD',
            'rate' => 10.00,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'tax_profile_id' => $taxProfile->id,
            'sku' => 'BEV-001',
            'name' => 'Orange Juice 1L',
            'cost_price' => '15.00',
            'minimum_allowed_price' => '18.00',
            'default_selling_price' => '20.00',
            'mrp' => '25.00',
            'unit' => 'BOTTLE',
            'status' => ProductStatus::ACTIVE,
        ]);

        $customer = Customer::create([
            'name' => 'Apex Retailers',
            'code' => 'CUST-APEX-001',
            'contact_name' => 'Alice Smith',
            'email' => 'alice@apex.test',
            'phone' => '1234567890',
            'billing_address_line1' => '101 Market Street',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'USA',
            'salesman_id' => $this->salesman->id,
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => '50000.00',
            'payment_terms' => PaymentTerms::NET_30,
        ]);

        $order = Order::create([
            'order_number' => 'ORD-2026-E2E-001',
            'customer_id' => $customer->id,
            'salesman_id' => $this->salesman->id,
            'created_by' => $this->salesman->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::DELIVERED,
            'payment_status' => PaymentStatus::UNPAID,
            'delivery_status' => DeliveryStatus::DELIVERED,
            'currency' => 'USD',
            'subtotal' => '2000.00',
            'tax_total' => '200.00',
            'adjustment_total' => '0.00',
            'grand_total' => '2200.00',
            'idempotency_key' => 'idemp-e2e-001',
            'submitted_at' => Carbon::parse('2026-09-05 10:00:00'),
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'unit_snapshot' => $product->unit,
            'tax_profile_code_snapshot' => $taxProfile->code,
            'tax_profile_name_snapshot' => $taxProfile->name,
            'tax_rate_snapshot' => $taxProfile->rate,
            'ordered_quantity' => 100,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 100,
            'picked_quantity' => 100,
            'dispatched_quantity' => 100,
            'delivered_quantity' => 100,
            'unit_price' => '20.00',
            'tax_profile_id' => $taxProfile->id,
            'taxable_amount' => '2000.00',
            'tax_amount' => '200.00',
            'line_total' => '2200.00',
        ]);

        // 1. Generate Invoice (posts Revenue 4010 & Tax Payable 2020)
        $invoice = $this->invoiceGeneratorService->generateForOrder($order, $this->accountant);
        $this->assertNotNull($invoice);

        // 2. Query P&L for September: Revenue must be recognized
        $pnl = $this->pnlService->getProfitAndLoss('2026-09-01', '2026-09-30');
        $this->assertEquals('2000.00', $pnl['operating_revenue']['total']);
        $this->assertEquals('2000.00', $pnl['net_revenue']);
        $this->assertEquals('2000.00', $pnl['net_income']);

        // 3. Post Supplier Bill for $500 Procurement Expense
        $supplier = Supplier::create([
            'name' => 'Produce Wholesale Co',
            'supplier_code' => 'SUP-PROD-001',
            'status' => SupplierStatus::ACTIVE,
        ]);

        $bill = $this->payableLedgerService->createBill($supplier, [
            'bill_date' => '2026-09-08',
            'subtotal' => '500.00',
            'tax_total' => '0.00',
            'total_amount' => '500.00',
        ], $this->accountant);

        $this->payableLedgerService->recordSupplierBill($bill, $this->accountant);

        // 4. Query P&L again: Operating expense 5030 should be $500, Net Income $1500
        $pnlAfterBill = $this->pnlService->getProfitAndLoss('2026-09-01', '2026-09-30');
        $this->assertEquals('2000.00', $pnlAfterBill['net_revenue']);
        $this->assertEquals('500.00', $pnlAfterBill['total_operating_expenses']);
        $this->assertEquals('1500.00', $pnlAfterBill['net_income']);

        // 5. Verify Controller Inertia Response & Permissions
        $response = $this->actingAs($this->accountant)
            ->get('/admin/accounting/profit-loss?start_date=2026-09-01&end_date=2026-09-30');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Accounting/ProfitLoss')
            ->has('report')
            ->where('report.net_revenue', '2000.00')
            ->where('report.total_operating_expenses', '500.00')
            ->where('report.net_income', '1500.00')
        );

        // Unauthorized salesman should be forbidden (403)
        $unauthResponse = $this->actingAs($this->salesman)
            ->get('/admin/accounting/profit-loss');
        $unauthResponse->assertStatus(403);
        } finally {
            Carbon::setTestNow();
        }
    }
}
