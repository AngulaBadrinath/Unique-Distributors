<?php

namespace Tests\Feature\Payment;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTransactionStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payment\PaymentVerificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OrderBalancePaymentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $accountant;
    protected User $salesman1;
    protected User $salesman2;
    protected Customer $customer1;
    protected Customer $customer2;
    protected Order $order1;
    protected Order $approvedOrder;
    protected Order $draftOrder;
    protected Order $cancelledOrder;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');

        $this->admin = User::factory()->create([
            'name' => 'Alice Admin',
            'email' => 'admin@wholesale.test',
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::factory()->create([
            'name' => 'Arthur Accountant',
            'email' => 'accountant@wholesale.test',
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman1 = User::factory()->create([
            'name' => 'Sam Salesman',
            'email' => 'salesman1@wholesale.test',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman2 = User::factory()->create([
            'name' => 'Sally Salesman',
            'email' => 'salesman2@wholesale.test',
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->customer1 = Customer::create([
            'salesman_id' => $this->salesman1->id,
            'name' => 'Metro Grocery',
            'code' => 'CUST-METRO',
            'contact_name' => 'Mark Manager',
            'phone' => '+1-555-0201',
            'email' => 'metro@wholesale.test',
            'billing_address_line1' => '100 Metro Way',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
        ]);

        $this->customer2 = Customer::create([
            'salesman_id' => $this->salesman2->id,
            'name' => 'Gotham Market',
            'code' => 'CUST-GOTHAM',
            'contact_name' => 'Gary Grocer',
            'phone' => '+1-555-0202',
            'email' => 'gotham@wholesale.test',
            'billing_address_line1' => '200 Gotham Way',
            'billing_city' => 'Gotham',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07001',
            'billing_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
        ]);

        // Submitted order with $500 total
        $this->order1 = Order::create([
            'order_number' => 'ORD-2026-0001',
            'customer_id' => $this->customer1->id,
            'salesman_id' => $this->salesman1->id,
            'created_by' => $this->salesman1->id,
            'status' => OrderStatus::SUBMITTED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => '450.00',
            'tax_total' => '50.00',
            'grand_total' => '500.00',
            'idempotency_key' => 'idemp-ord-0001',
            'submitted_at' => now(),
        ]);

        // Approved order with $1,000 total
        $this->approvedOrder = Order::create([
            'order_number' => 'ORD-2026-0002',
            'customer_id' => $this->customer1->id,
            'salesman_id' => $this->salesman1->id,
            'created_by' => $this->salesman1->id,
            'approved_by' => $this->admin->id,
            'status' => OrderStatus::APPROVED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => '900.00',
            'tax_total' => '100.00',
            'grand_total' => '1000.00',
            'idempotency_key' => 'idemp-ord-0002',
            'submitted_at' => now(),
            'approved_at' => now(),
        ]);

        // Draft order
        $this->draftOrder = Order::create([
            'order_number' => 'ORD-2026-DRAFT',
            'customer_id' => $this->customer1->id,
            'salesman_id' => $this->salesman1->id,
            'created_by' => $this->salesman1->id,
            'status' => OrderStatus::DRAFT,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => '100.00',
            'tax_total' => '10.00',
            'grand_total' => '110.00',
            'idempotency_key' => 'idemp-draft-0001',
        ]);

        // Cancelled order
        $this->cancelledOrder = Order::create([
            'order_number' => 'ORD-2026-CANCELLED',
            'customer_id' => $this->customer1->id,
            'salesman_id' => $this->salesman1->id,
            'created_by' => $this->salesman1->id,
            'status' => OrderStatus::CANCELLED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => '200.00',
            'tax_total' => '20.00',
            'grand_total' => '220.00',
            'idempotency_key' => 'idemp-cancelled-0001',
            'cancelled_at' => now(),
        ]);
    }

    public function test_salesman_can_record_cash_balance_payment_for_submitted_order(): void
    {
        $response = $this->actingAs($this->salesman1)->post('/salesman/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 200.00,
            'payment_date' => now()->toDateString(),
            'receipt_reference' => 'RCP-001',
            'notes' => 'Partial cash settlement on site',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'payment_method' => PaymentMethod::CASH->value,
            'amount' => 200.00,
            'status' => PaymentTransactionStatus::PENDING_VERIFICATION->value,
            'recorded_by' => $this->salesman1->id,
        ]);
    }

    protected function createValidJpeg(): UploadedFile
    {
        return UploadedFile::fake()->image('cheque.jpg', 800, 600)->size(200);
    }

    public function test_salesman_can_record_cheque_balance_payment_with_evidence(): void
    {
        $jpegFile = $this->createValidJpeg();

        $response = $this->actingAs($this->salesman1)->post('/salesman/payments/cheque', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->approvedOrder->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Chase Bank',
            'cheque_number' => 'CHK-998877',
            'cheque_date' => now()->toDateString(),
            'evidence' => $jpegFile,
            'notes' => 'Half payment via cheque',
        ]);

        $response->assertRedirect();
        $payment = Payment::where('cheque_number', 'CHK-998877')->first();
        $this->assertNotNull($payment);
        $this->assertEquals($this->approvedOrder->id, $payment->order_id);
        $this->assertEquals('500.00', (string) $payment->amount);
        $this->assertEquals(PaymentTransactionStatus::PENDING_VERIFICATION, $payment->status);
        $this->assertNotNull($payment->evidence_object_key);
    }

    public function test_cannot_record_payment_exceeding_order_outstanding_balance(): void
    {
        // First record $300 payment on order1 ($500 grand total)
        $this->actingAs($this->salesman1)->post('/salesman/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 300.00,
            'payment_date' => now()->toDateString(),
        ])->assertSessionHasNoErrors();

        // Attempting to record $250 should be rejected because remaining balance is $200
        $response = $this->actingAs($this->salesman1)->post('/salesman/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 250.00,
            'payment_date' => now()->toDateString(),
        ]);

        $response->assertSessionHasErrors(['amount']);
    }

    public function test_cannot_record_payment_against_draft_or_cancelled_orders(): void
    {
        // Draft order rejection
        $resDraft = $this->actingAs($this->salesman1)->post('/salesman/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->draftOrder->id,
            'amount' => 50.00,
            'payment_date' => now()->toDateString(),
        ]);
        $resDraft->assertSessionHasErrors(['order_id']);

        // Cancelled order rejection
        $resCancelled = $this->actingAs($this->salesman1)->post('/salesman/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->cancelledOrder->id,
            'amount' => 50.00,
            'payment_date' => now()->toDateString(),
        ]);
        $resCancelled->assertSessionHasErrors(['order_id']);
    }

    public function test_salesman_cannot_record_payment_for_another_salesmans_customer_or_order(): void
    {
        // Salesman 2 tries to record payment for Customer 1's Order 1
        $response = $this->actingAs($this->salesman2)->post('/salesman/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 100.00,
            'payment_date' => now()->toDateString(),
        ]);

        $response->assertForbidden();
    }

    public function test_admin_can_record_cash_balance_payment(): void
    {
        $response = $this->actingAs($this->admin)->post('/admin/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
            'receipt_reference' => 'ADM-REC-01',
            'notes' => 'Full payment recorded by admin',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 500.00,
            'recorded_by' => $this->admin->id,
        ]);
    }

    public function test_verifying_balance_payment_updates_order_payment_status(): void
    {
        // Record payment for $500
        $this->actingAs($this->salesman1)->post('/salesman/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
        ]);

        $payment = Payment::where('order_id', $this->order1->id)->first();
        $this->assertNotNull($payment);

        // Verify payment by accountant
        $verificationService = app(PaymentVerificationService::class);
        $verificationService->verifyPayment($payment, $this->accountant);

        $this->order1->refresh();
        $this->assertEquals(PaymentStatus::PAID, $this->order1->payment_status);
    }
}
