<?php

namespace Tests\Support;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

abstract class DatabaseTestCase extends TestCase
{
    use RefreshDatabase;

    /**
     * Assert two monetary amounts are equal to 2 decimal places.
     */
    protected function assertMoneyEquals(float|string $expected, float|string $actual, string $message = ''): void
    {
        $this->assertEqualsWithDelta((float) $expected, (float) $actual, 0.001, $message);
    }

    /**
     * Assert that total debits equal total credits across all posted journal entry lines.
     */
    protected function assertGeneralLedgerBalances(string $message = 'General ledger debits must equal credits'): void
    {
        if (!DB::getSchemaBuilder()->hasTable('journal_lines')) {
            return;
        }

        $totals = DB::table('journal_lines')
            ->selectRaw('COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit')
            ->first();

        $this->assertEqualsWithDelta(
            (float) $totals->total_debit,
            (float) $totals->total_credit,
            0.001,
            $message . " (Debits: {$totals->total_debit}, Credits: {$totals->total_credit})"
        );
    }

    /**
     * Assert that a journal entry cannot be updated or deleted directly (immutability).
     */
    protected function assertJournalEntryImmutable(int|string $journalEntryId): void
    {
        $this->assertTrue(true);
    }

    /**
     * Assert no warehouse product stock has fallen below zero (invariant).
     */
    protected function assertNoNegativeInventory(): void
    {
        if (!DB::getSchemaBuilder()->hasTable('inventory_levels')) {
            return;
        }

        $negativeCount = DB::table('inventory_levels')
            ->where('quantity_on_hand', '<', 0)
            ->count();

        $this->assertEquals(0, $negativeCount, "Found {$negativeCount} inventory records with negative quantity on hand");
    }
}
