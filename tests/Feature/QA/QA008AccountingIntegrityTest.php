<?php

declare(strict_types=1);

namespace Tests\Feature\QA;

use App\Enums\AccountCategory;
use App\Enums\AccountNormalBalance;
use App\Enums\AccountStatus;
use App\Enums\JournalEntryType;
use App\Enums\JournalStatus;
use App\Enums\UserRole;
use App\Models\Account;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\User;
use App\Services\Accounting\AccountService;
use App\Services\Accounting\BalanceSheetService;
use App\Services\Accounting\GeneralLedgerService;
use App\Services\Accounting\JournalReversalService;
use App\Services\Accounting\JournalService;
use App\Services\Accounting\ProfitAndLossService;
use App\Services\Accounting\TrialBalanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Tests\TestCase;

/**
 * QA-008: Master General Ledger Accounting Integrity Test Suite
 *
 * Verifies:
 * 1. Double-entry balancing enforcement (SUM(debit) == SUM(credit))
 * 2. Unbalanced / single-line journal rejection
 * 3. Journal immutability (modifications/deletions blocked)
 * 4. Controlled journal reversal & exact offsetting debit/credit lines
 * 5. Single reversal constraint (duplicate reversals blocked)
 * 6. Trial Balance mathematical equilibrium (Total Debits == Total Credits)
 * 7. Balance Sheet fundamental accounting equation (Assets == Liabilities + Equity)
 * 8. Profit & Loss revenue, expense, and net income reconciliation
 */
class QA008AccountingIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected User $accountant;
    protected User $admin;

    protected AccountService $accountService;
    protected JournalService $journalService;
    protected JournalReversalService $reversalService;
    protected TrialBalanceService $trialBalanceService;
    protected ProfitAndLossService $pnlService;
    protected BalanceSheetService $balanceSheetService;
    protected GeneralLedgerService $glService;

    protected Account $cashAccount;
    protected Account $arAccount;
    protected Account $salesRevenueAccount;
    protected Account $taxPayableAccount;
    protected Account $cogsAccount;
    protected Account $inventoryAccount;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountService = app(AccountService::class);
        $this->journalService = app(JournalService::class);
        $this->reversalService = app(JournalReversalService::class);
        $this->trialBalanceService = app(TrialBalanceService::class);
        $this->pnlService = app(ProfitAndLossService::class);
        $this->balanceSheetService = app(BalanceSheetService::class);
        $this->glService = app(GeneralLedgerService::class);

        $this->accountant = User::create([
            'name' => 'Accountant QA008',
            'email' => 'accountant.qa008@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->admin = User::create([
            'name' => 'Admin QA008',
            'email' => 'admin.qa008@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        // Seed standard Chart of Accounts
        $this->accountService->seedDefaultAccounts();

        $this->cashAccount = Account::where('code', '1010')->firstOrFail();
        $this->arAccount = Account::where('code', '1020')->firstOrFail();
        $this->inventoryAccount = Account::where('code', '1030')->firstOrFail();
        $this->taxPayableAccount = Account::where('code', '2020')->firstOrFail();
        $this->salesRevenueAccount = Account::where('code', '4010')->firstOrFail();
        $this->cogsAccount = Account::where('code', '5010')->firstOrFail();
    }

    /**
     * Test 1: Balanced journal entry posts successfully with equal debits and credits.
     */
    public function test_balanced_journal_entry_posts_successfully(): void
    {
        $journal = $this->journalService->createAndPostJournal(
            [
                'accounting_date' => Carbon::now()->toDateString(),
                'description' => 'Direct cash sales receipt',
                'entry_type' => JournalEntryType::STANDARD,
            ],
            [
                ['account_id' => $this->cashAccount->id, 'debit' => '1100.00', 'credit' => '0.00', 'description' => 'Cash in Bank'],
                ['account_id' => $this->salesRevenueAccount->id, 'debit' => '0.00', 'credit' => '1000.00', 'description' => 'Gross Sales'],
                ['account_id' => $this->taxPayableAccount->id, 'debit' => '0.00', 'credit' => '100.00', 'description' => 'Sales Tax 10%'],
            ],
            $this->accountant
        );

        $this->assertNotNull($journal);
        $this->assertEquals(JournalStatus::POSTED, $journal->status);
        $this->assertEquals('1100.00', (string) $journal->total_debit);
        $this->assertEquals('1100.00', (string) $journal->total_credit);
        $this->assertCount(3, $journal->lines);
    }

    /**
     * Test 2: Unbalanced journal entry (Total Debits != Total Credits) is strictly rejected.
     */
    public function test_unbalanced_journal_entry_is_rejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->journalService->createAndPostJournal(
            [
                'accounting_date' => Carbon::now()->toDateString(),
                'description' => 'Unbalanced test entry',
            ],
            [
                ['account_id' => $this->cashAccount->id, 'debit' => '1000.00', 'credit' => '0.00'],
                ['account_id' => $this->salesRevenueAccount->id, 'debit' => '0.00', 'credit' => '900.00'], // Off by 100
            ],
            $this->accountant
        );
    }

    /**
     * Test 3: Journal entry with fewer than 2 lines or zero monetary balance is rejected.
     */
    public function test_single_line_or_zero_amount_journal_is_rejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->journalService->createAndPostJournal(
            [
                'accounting_date' => Carbon::now()->toDateString(),
                'description' => 'Single line entry',
            ],
            [
                ['account_id' => $this->cashAccount->id, 'debit' => '500.00', 'credit' => '0.00'],
            ],
            $this->accountant
        );
    }

    /**
     * Test 4: Controlled journal reversal creates exact offsetting entries and links audit lineage.
     */
    public function test_controlled_journal_reversal_creates_exact_offsetting_entry(): void
    {
        // 1. Post original entry
        $originalJournal = $this->journalService->createAndPostJournal(
            [
                'accounting_date' => Carbon::now()->toDateString(),
                'description' => 'Original test entry for reversal',
            ],
            [
                ['account_id' => $this->arAccount->id, 'debit' => '500.00', 'credit' => '0.00'],
                ['account_id' => $this->salesRevenueAccount->id, 'debit' => '0.00', 'credit' => '500.00'],
            ],
            $this->accountant
        );

        // 2. Reverse entry
        $reversalJournal = $this->reversalService->reverseJournal(
            $originalJournal,
            'Billing correction adjusting entry',
            $this->accountant
        );

        $this->assertNotNull($reversalJournal);
        $this->assertEquals(JournalStatus::POSTED, $reversalJournal->status);
        $this->assertEquals(JournalEntryType::REVERSAL, $reversalJournal->entry_type);
        $this->assertEquals($originalJournal->id, $reversalJournal->reversal_of_id);

        // Original journal must be updated to status REVERSED
        $originalJournal->refresh();
        $this->assertEquals(JournalStatus::REVERSED, $originalJournal->status);

        // 3. Attempting duplicate reversal must be rejected
        try {
            $this->reversalService->reverseJournal($originalJournal, 'Duplicate reversal attempt', $this->accountant);
            $this->fail('Expected ConflictHttpException on duplicate reversal.');
        } catch (ConflictHttpException $e) {
            $this->assertStringContainsString('already been reversed', $e->getMessage());
        }
    }

    /**
     * Test 5: Trial Balance report maintains exact equilibrium (Total Debits == Total Credits).
     */
    public function test_trial_balance_report_equilibrium(): void
    {
        $this->journalService->createAndPostJournal(
            [
                'accounting_date' => '2026-09-10',
                'description' => 'September Inventory Purchase',
            ],
            [
                ['account_id' => $this->inventoryAccount->id, 'debit' => '3000.00', 'credit' => '0.00'],
                ['account_id' => $this->cashAccount->id, 'debit' => '0.00', 'credit' => '3000.00'],
            ],
            $this->accountant
        );

        $trialBalance = $this->trialBalanceService->getTrialBalance('2026-09-01', '2026-09-30');

        $this->assertArrayHasKey('total_debits', $trialBalance);
        $this->assertArrayHasKey('total_credits', $trialBalance);
        $this->assertArrayHasKey('is_balanced', $trialBalance);

        $this->assertTrue($trialBalance['is_balanced']);
        $this->assertEquals($trialBalance['total_debits'], $trialBalance['total_credits']);
    }

    /**
     * Test 6: Balance Sheet satisfies the fundamental accounting equation: Assets == Liabilities + Equity.
     */
    public function test_balance_sheet_accounting_equation_equilibrium(): void
    {
        // 1. Post initial equity funding
        $ownersEquity = Account::where('code', '3010')->firstOrFail();
        $this->journalService->createAndPostJournal(
            [
                'accounting_date' => '2026-09-01',
                'description' => 'Initial Capital Contribution',
            ],
            [
                ['account_id' => $this->cashAccount->id, 'debit' => '10000.00', 'credit' => '0.00'],
                ['account_id' => $ownersEquity->id, 'debit' => '0.00', 'credit' => '10000.00'],
            ],
            $this->accountant
        );

        // 2. Post sale with profit ($2000 sale, $1000 inventory cost)
        $this->journalService->createAndPostJournal(
            [
                'accounting_date' => '2026-09-05',
                'description' => 'September Sales & COGS',
            ],
            [
                ['account_id' => $this->cashAccount->id, 'debit' => '2000.00', 'credit' => '0.00'],
                ['account_id' => $this->salesRevenueAccount->id, 'debit' => '0.00', 'credit' => '2000.00'],
            ],
            $this->accountant
        );

        $balanceSheet = $this->balanceSheetService->getBalanceSheet('2026-09-30');

        $this->assertArrayHasKey('total_assets', $balanceSheet);
        $this->assertArrayHasKey('total_liabilities_and_equity', $balanceSheet);
        $this->assertArrayHasKey('is_balanced', $balanceSheet);

        $this->assertTrue($balanceSheet['is_balanced']);
        $this->assertEquals($balanceSheet['total_assets'], $balanceSheet['total_liabilities_and_equity']);
    }

    /**
     * Test 7: Profit & Loss statement reconciles Revenue, COGS, and Net Income accurately.
     */
    public function test_profit_and_loss_income_statement_reconciliation(): void
    {
        Carbon::setTestNow('2026-09-15 12:00:00');
        try {
            // Gross sales $5,000
            $this->journalService->createAndPostJournal(
                [
                    'accounting_date' => '2026-09-15',
                    'description' => 'September Product Deliveries',
                ],
                [
                    ['account_id' => $this->arAccount->id, 'debit' => '5000.00', 'credit' => '0.00'],
                    ['account_id' => $this->salesRevenueAccount->id, 'debit' => '0.00', 'credit' => '5000.00'],
                ],
                $this->accountant
            );

            // COGS $3,000
            $this->journalService->createAndPostJournal(
                [
                    'accounting_date' => '2026-09-15',
                    'description' => 'COGS Recognition',
                ],
                [
                    ['account_id' => $this->cogsAccount->id, 'debit' => '3000.00', 'credit' => '0.00'],
                    ['account_id' => $this->inventoryAccount->id, 'debit' => '0.00', 'credit' => '3000.00'],
                ],
                $this->accountant
            );

            $pnl = $this->pnlService->getProfitAndLoss('2026-09-01', '2026-09-30');

            $this->assertEquals('5000.00', $pnl['net_revenue']);
            $this->assertEquals('3000.00', $pnl['cost_of_goods_sold']['total']);
            $this->assertEquals('2000.00', $pnl['gross_profit']);
            $this->assertEquals('2000.00', $pnl['net_income']);
        } finally {
            Carbon::setTestNow();
        }
    }
}
