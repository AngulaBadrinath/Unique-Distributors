<?php

declare(strict_types=1);

namespace App\Services\Receivable;

use App\Models\Customer;
use App\Models\ReceivableTransaction;
use App\Services\System\CompanyInformationService;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CustomerStatementService
{
    public function __construct(
        protected ReceivableLedgerService $ledgerService,
        protected CompanyInformationService $companyInformationService
    ) {}

    /**
     * Generate an authoritative, deterministic customer statement for a specified date range.
     *
     * @return array{
     *     customer: array<string, mixed>,
     *     company: array<string, mixed>,
     *     statement_period: array{
     *         start_date: string,
     *         end_date: string
     *     },
     *     opening_balance: string,
     *     total_debits: string,
     *     total_credits: string,
     *     closing_balance: string,
     *     available_credit: string,
     *     transactions: array<int, array<string, mixed>>
     * }
     */
    public function generateStatement(
        Customer|int $customerInput,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        /** @var Customer $customer */
        $customer = $customerInput instanceof Customer
            ? $customerInput
            : Customer::findOrFail($customerInput);

        // Default period: start of current month to current date, or start of year
        $start = $startDate ? Carbon::parse($startDate)->startOfDay() : Carbon::now()->startOfMonth()->startOfDay();
        $end = $endDate ? Carbon::parse($endDate)->endOfDay() : Carbon::now()->endOfDay();

        // 1. Calculate Opening Balance: Sum of all debits minus sum of all credits before $start
        $openingData = ReceivableTransaction::query()
            ->where('customer_id', $customer->id)
            ->where('transaction_date', '<', $start->toDateString())
            ->selectRaw('COALESCE(SUM(debit_amount), 0) as debits, COALESCE(SUM(credit_amount), 0) as credits')
            ->first();

        $openingDebits = $openingData ? (string) $openingData->debits : '0.00';
        $openingCredits = $openingData ? (string) $openingData->credits : '0.00';
        $openingBalance = bcsub($openingDebits, $openingCredits, 2);

        // 2. Fetch all transactions in period in deterministic order
        $transactions = ReceivableTransaction::query()
            ->where('customer_id', $customer->id)
            ->whereBetween('transaction_date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('transaction_date', 'asc')
            ->orderBy('posting_date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $runningBalance = $openingBalance;
        $totalPeriodDebits = '0.00';
        $totalPeriodCredits = '0.00';
        $transactionRows = [];

        foreach ($transactions as $txn) {
            $debit = number_format((float) $txn->debit_amount, 2, '.', '');
            $credit = number_format((float) $txn->credit_amount, 2, '.', '');

            $totalPeriodDebits = bcadd($totalPeriodDebits, $debit, 2);
            $totalPeriodCredits = bcadd($totalPeriodCredits, $credit, 2);

            // running balance = previous + debit - credit
            $runningBalance = bcadd($runningBalance, $debit, 2);
            $runningBalance = bcsub($runningBalance, $credit, 2);

            $txnDateStr = $txn->transaction_date ? Carbon::parse($txn->transaction_date)->toDateString() : Carbon::now()->toDateString();
            $postingDateStr = $txn->posting_date ? Carbon::parse($txn->posting_date)->toDateString() : Carbon::now()->toDateString();

            $transactionRows[] = [
                'id' => $txn->id,
                'transaction_number' => $txn->transaction_number,
                'transaction_date' => $txnDateStr,
                'posting_date' => $postingDateStr,
                'type' => $txn->type->value,
                'type_label' => $txn->type->label(),
                'source_type' => $txn->source_type,
                'source_id' => $txn->source_id,
                'source_number' => $txn->source_number,
                'description' => $txn->description,
                'debit_amount' => $debit,
                'credit_amount' => $credit,
                'running_balance' => $runningBalance,
            ];
        }

        // 3. Calculate Closing Balance: Opening + Total Debits - Total Credits
        $closingBalance = bcadd($openingBalance, $totalPeriodDebits, 2);
        $closingBalance = bcsub($closingBalance, $totalPeriodCredits, 2);

        // 4. Pending payments and operational position
        $financialSummary = $this->ledgerService->getCustomerFinancialSummary($customer);
        $availableCredit = $financialSummary['available_credit'];
        $pendingPayments = $financialSummary['pending_payments'];
        $operationalBalance = $financialSummary['operational_outstanding'];

        // 5. Company Info Snapshot
        $company = $this->companyInformationService->get();

        return [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'code' => $customer->code ?? $customer->customer_code ?? '',
                'contact_name' => $customer->contact_name ?? '',
                'email' => $customer->email,
                'phone' => $customer->phone,
                'billing_address_line1' => $customer->billing_address_line1,
                'billing_city' => $customer->billing_city,
                'billing_state' => $customer->billing_state,
                'billing_postal_code' => $customer->billing_postal_code,
                'billing_country' => $customer->billing_country ?? 'US',
            ],
            'company' => [
                'name' => $company->legal_name ?? $company->company_name ?? 'Unique Jersey Wholesale',
                'address' => trim(sprintf('%s, %s, %s %s', $company->address_line1, $company->city, $company->state, $company->postal_code)),
                'phone' => $company->phone,
                'email' => $company->email,
                'tax_id' => $company->tax_id,
            ],
            'statement_period' => [
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
            ],
            'opening_balance' => $openingBalance,
            'total_debits' => $totalPeriodDebits,
            'total_credits' => $totalPeriodCredits,
            'closing_balance' => $closingBalance,
            'pending_payments' => $pendingPayments,
            'operational_balance' => $operationalBalance,
            'available_credit' => $availableCredit,
            'transactions' => $transactionRows,
        ];
    }
}
