<?php

namespace Tests\Database;

use App\Enums\AccountStatus;
use App\Enums\JournalEntryType;
use App\Enums\JournalStatus;
use App\Enums\UserRole;
use App\Models\User;
use App\Services\Accounting\AccountService;
use App\Services\Accounting\JournalService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\Support\DatabaseTestCase;

class AccountingInvariantsTest extends DatabaseTestCase
{
    protected User $accountant;
    protected AccountService $accountService;
    protected JournalService $journalService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountant = User::factory()->create([
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountService = app(AccountService::class);
        $this->journalService = app(JournalService::class);
    }

    /**
     * RULE-ACC-001: General ledger debits must equal credits in authoritative database tables.
     */
    public function test_posted_journal_entry_debits_equal_credits_in_database(): void
    {
        $cash = $this->accountService->resolveAccount('1010');
        $equity = $this->accountService->resolveAccount('3010');

        $journal = $this->journalService->createAndPostJournal(
            [
                'entry_type' => JournalEntryType::MANUAL,
                'posting_date' => '2026-09-12',
                'accounting_date' => '2026-09-12',
                'description' => 'Seed equity transaction',
                'source_type' => 'EQUITY_SEED',
                'source_id' => 999,
                'source_event' => 'SEED_TEST',
            ],
            [
                [
                    'account_id' => $cash->id,
                    'debit' => '25000.00',
                    'credit' => '0.00',
                    'description' => 'Debit Cash',
                ],
                [
                    'account_id' => $equity->id,
                    'debit' => '0.00',
                    'credit' => '25000.00',
                    'description' => 'Credit Equity',
                ],
            ],
            $this->accountant
        );

        $this->assertEquals(JournalStatus::POSTED, $journal->status);
        $this->assertGeneralLedgerBalances();
    }

    /**
     * Unbalanced journal entries must be strictly rejected with ValidationException.
     */
    public function test_unbalanced_entry_is_rejected_and_not_persisted(): void
    {
        $cash = $this->accountService->resolveAccount('1010');
        $equity = $this->accountService->resolveAccount('3010');

        $initialJournalCount = DB::table('journal_entries')->count();

        try {
            $this->journalService->createAndPostJournal(
                [
                    'entry_type' => JournalEntryType::MANUAL,
                    'description' => 'Invalid unbalanced entry',
                ],
                [
                    [
                        'account_id' => $cash->id,
                        'debit' => '1000.00',
                        'credit' => '0.00',
                    ],
                    [
                        'account_id' => $equity->id,
                        'debit' => '0.00',
                        'credit' => '800.00',
                    ],
                ],
                $this->accountant
            );
            $this->fail('Expected ValidationException for unbalanced journal entry');
        } catch (ValidationException $e) {
            $this->assertEquals($initialJournalCount, DB::table('journal_entries')->count());
        }
    }
}
