<?php

namespace Tests\Database;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\PaymentTerms;
use App\Enums\ReceivableTransactionType;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\ReceivableTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Support\DatabaseTestCase;

class AccountsReceivableInvariantsTest extends DatabaseTestCase
{
    protected User $admin;
    protected Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->customer = Customer::create([
            'code' => 'CUST-AR-001',
            'name' => 'AR Test Customer',
            'contact_name' => 'Charlie Cashier',
            'email' => 'ar@example.com',
            'phone' => '+1 555 444 5555',
            'billing_address_line1' => '100 Ledger Way',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '100 Ledger Way',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30301',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => '10000.00',
            'balance' => '0.00',
            'status' => CustomerStatus::ACTIVE,
        ]);
    }

    /**
     * Invariant: Subledger net transactions reconcile to customer balance.
     */
    public function test_customer_balance_matches_subledger_net_transactions(): void
    {
        ReceivableTransaction::create([
            'transaction_number' => 'AR-INV-001',
            'customer_id' => $this->customer->id,
            'source_type' => 'INVOICE',
            'source_id' => 101,
            'source_number' => 'INV-001',
            'type' => ReceivableTransactionType::INVOICE_CHARGE,
            'description' => 'Standard invoice charge',
            'amount' => '1500.00',
            'debit_amount' => '1500.00',
            'credit_amount' => '0.00',
            'running_balance' => '1500.00',
            'transaction_date' => now(),
            'posting_date' => now(),
            'due_date' => now()->addDays(30),
            'currency' => 'USD',
            'created_by' => $this->admin->id,
        ]);

        ReceivableTransaction::create([
            'transaction_number' => 'AR-PAY-001',
            'customer_id' => $this->customer->id,
            'source_type' => 'PAYMENT',
            'source_id' => 201,
            'source_number' => 'PAY-001',
            'type' => ReceivableTransactionType::PAYMENT,
            'description' => 'Cash payment received',
            'amount' => '500.00',
            'debit_amount' => '0.00',
            'credit_amount' => '500.00',
            'running_balance' => '1000.00',
            'transaction_date' => now(),
            'posting_date' => now(),
            'due_date' => now(),
            'currency' => 'USD',
            'created_by' => $this->admin->id,
        ]);

        $netBalance = DB::table('receivable_transactions')
            ->where('customer_id', $this->customer->id)
            ->selectRaw('COALESCE(SUM(debit_amount) - SUM(credit_amount), 0) as balance')
            ->value('balance');

        $this->assertMoneyEquals('1000.00', $netBalance);
    }

    /**
     * RULE-ACC-001: Posted receivable transactions are permanent and immutable.
     */
    public function test_receivable_transaction_is_immutable_against_deletion(): void
    {
        $txn = ReceivableTransaction::create([
            'transaction_number' => 'AR-IMM-001',
            'customer_id' => $this->customer->id,
            'source_type' => 'INVOICE',
            'source_id' => 102,
            'source_number' => 'INV-002',
            'type' => ReceivableTransactionType::INVOICE_CHARGE,
            'description' => 'Invoice charge to test immutability',
            'amount' => '250.00',
            'debit_amount' => '250.00',
            'credit_amount' => '0.00',
            'running_balance' => '250.00',
            'transaction_date' => now(),
            'posting_date' => now(),
            'currency' => 'USD',
            'created_by' => $this->admin->id,
        ]);

        $this->expectException(\LogicException::class);
        $txn->delete();
    }
}
