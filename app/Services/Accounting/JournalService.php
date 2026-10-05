<?php

declare(strict_types=1);

namespace App\Services\Accounting;

use App\Enums\JournalEntryType;
use App\Enums\JournalStatus;
use App\Models\Account;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JournalService
{
    public function __construct(
        protected JournalNumberGenerator $numberGenerator
    ) {}

    /**
     * Create and atomically post a balanced double-entry journal entry.
     *
     * @param  array<string, mixed>  $header
     * @param  array<int, array<string, mixed>>  $lines
     *
     * @throws ValidationException
     */
    public function createAndPostJournal(array $header, array $lines, ?User $actor = null): JournalEntry
    {
        if (count($lines) < 2) {
            throw ValidationException::withMessages([
                'lines' => 'A journal entry must contain at least two line items.',
            ]);
        }

        // 1. Calculate & Validate Double-Entry Balance
        $totalDebit = '0.00';
        $totalCredit = '0.00';
        $validatedLines = [];

        foreach ($lines as $index => $line) {
            $accountId = (int) ($line['account_id'] ?? 0);
            if (! $accountId || ! Account::where('id', $accountId)->where('is_active', true)->exists()) {
                throw ValidationException::withMessages([
                    "lines.{$index}.account_id" => 'Each line must reference an active account in the Chart of Accounts.',
                ]);
            }

            $debit = isset($line['debit']) ? trim((string) $line['debit']) : '0.00';
            $credit = isset($line['credit']) ? trim((string) $line['credit']) : '0.00';

            $debitFormatted = number_format((float) $debit, 2, '.', '');
            $creditFormatted = number_format((float) $credit, 2, '.', '');

            $isDebitPositive = bccomp($debitFormatted, '0.00', 2) > 0;
            $isCreditPositive = bccomp($creditFormatted, '0.00', 2) > 0;

            if (($isDebitPositive && $isCreditPositive) || (! $isDebitPositive && ! $isCreditPositive)) {
                throw ValidationException::withMessages([
                    "lines.{$index}" => "Line item must specify either a positive debit or a positive credit amount, not both or zero. (Debit: {$debitFormatted}, Credit: {$creditFormatted})",
                ]);
            }

            $totalDebit = bcadd($totalDebit, $debitFormatted, 2);
            $totalCredit = bcadd($totalCredit, $creditFormatted, 2);

            $validatedLines[] = [
                'line_number' => $index + 1,
                'account_id' => $accountId,
                'debit' => $debitFormatted,
                'credit' => $creditFormatted,
                'description' => ! empty($line['description']) ? trim((string) $line['description']) : null,
            ];
        }

        if (bccomp($totalDebit, $totalCredit, 2) !== 0) {
            throw ValidationException::withMessages([
                'balance' => "Journal entry is unbalanced. Total Debits ({$totalDebit}) must exactly equal Total Credits ({$totalCredit}).",
            ]);
        }

        if (bccomp($totalDebit, '0.00', 2) <= 0) {
            throw ValidationException::withMessages([
                'balance' => 'Journal entry total monetary amount must be greater than zero.',
            ]);
        }

        return DB::transaction(function () use ($header, $validatedLines, $totalDebit, $totalCredit, $actor) {
            $sourceType = ! empty($header['source_type']) ? (string) $header['source_type'] : null;
            $sourceId = ! empty($header['source_id']) ? (int) $header['source_id'] : null;
            $sourceEvent = ! empty($header['source_event']) ? (string) $header['source_event'] : null;

            // Check if existing posted entry exists for source event (Idempotency)
            if ($sourceType && $sourceId && $sourceEvent) {
                $existing = JournalEntry::where('source_type', $sourceType)
                    ->where('source_id', $sourceId)
                    ->where('source_event', $sourceEvent)
                    ->with(['lines.account', 'creator', 'poster'])
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            $journalNumber = $this->numberGenerator->generate();
            $postingDate = ! empty($header['posting_date']) ? Carbon::parse($header['posting_date'])->toDateString() : Carbon::now()->toDateString();
            $accountingDate = ! empty($header['accounting_date']) ? Carbon::parse($header['accounting_date'])->toDateString() : $postingDate;
            $rawEntryType = $header['entry_type'] ?? null;
            $entryType = $rawEntryType instanceof JournalEntryType
                ? $rawEntryType
                : (JournalEntryType::tryFrom((string) $rawEntryType) ?? JournalEntryType::SYSTEM);

            try {
                /** @var JournalEntry $journal */
                $journal = JournalEntry::create([
                    'journal_number' => $journalNumber,
                    'entry_type' => $entryType,
                    'source_type' => $sourceType,
                    'source_id' => $sourceId,
                    'source_number' => ! empty($header['source_number']) ? (string) $header['source_number'] : null,
                    'source_event' => $sourceEvent,
                    'status' => JournalStatus::POSTED,
                    'posting_date' => $postingDate,
                    'accounting_date' => $accountingDate,
                    'total_debit' => $totalDebit,
                    'total_credit' => $totalCredit,
                    'description' => trim((string) ($header['description'] ?? "Journal entry {$journalNumber}")),
                    'notes' => ! empty($header['notes']) ? trim((string) $header['notes']) : null,
                    'reversed_journal_id' => ! empty($header['reversed_journal_id']) ? (int) $header['reversed_journal_id'] : null,
                    'reversal_reason' => ! empty($header['reversal_reason']) ? trim((string) $header['reversal_reason']) : null,
                    'created_by' => $actor?->id,
                    'posted_by' => $actor?->id,
                    'posted_at' => Carbon::now(),
                    'idempotency_key' => ! empty($header['idempotency_key']) ? trim((string) $header['idempotency_key']) : null,
                ]);

                foreach ($validatedLines as $line) {
                    JournalLine::create(array_merge($line, [
                        'journal_entry_id' => $journal->id,
                    ]));
                }

                return $journal->fresh(['lines.account', 'creator', 'poster']);
            } catch (QueryException $e) {
                // If unique constraint hit on concurrent source event, retrieve winning record
                if ($sourceType && $sourceId && $sourceEvent) {
                    $existing = JournalEntry::where('source_type', $sourceType)
                        ->where('source_id', $sourceId)
                        ->where('source_event', $sourceEvent)
                        ->with(['lines.account', 'creator', 'poster'])
                        ->first();

                    if ($existing) {
                        return $existing;
                    }
                }

                throw $e;
            }
        });
    }
}
