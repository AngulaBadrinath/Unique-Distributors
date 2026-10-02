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

    public function test_admin_cash_payment_via_inertia_returns_redirect_and_not_plain_json(): void
    {
        $response = $this->actingAs($this->admin)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Requested-With' => 'XMLHttpRequest',
                'Accept' => 'text/html, application/xhtml+xml',
            ])
            ->from(route('admin.orders.show', $this->order1->id))
            ->post('/admin/payments/cash', [
                'customer_id' => $this->customer1->id,
                'order_id' => $this->order1->id,
                'amount' => 250.00,
                'payment_date' => now()->toDateString(),
                'receipt_reference' => 'ADM-INERTIA-01',
                'notes' => 'Inertia test cash payment',
            ]);

        $response->assertStatus(302);
        $response->assertRedirect(route('admin.orders.show', $this->order1->id));
        $response->assertSessionHas('success');
        $this->assertFalse(str_starts_with($response->headers->get('content-type', ''), 'application/json'));

        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order1->id,
            'customer_id' => $this->customer1->id,
            'payment_method' => PaymentMethod::CASH->value,
            'amount' => 250.00,
            'recorded_by' => $this->admin->id,
        ]);
    }

    public function test_admin_cash_payment_pessimistic_lock_aggregates_without_sql_aggregate_for_update_error(): void
    {
        // Pre-create an existing verified payment and a pending payment
        Payment::create([
            'payment_number' => 'PAY-PRE-01',
            'order_id' => $this->order1->id,
            'customer_id' => $this->customer1->id,
            'recorded_by' => $this->admin->id,
            'payment_method' => PaymentMethod::CASH,
            'amount' => '150.00',
            'payment_date' => now()->toDateString(),
            'status' => PaymentTransactionStatus::VERIFIED,
        ]);

        Payment::create([
            'payment_number' => 'PAY-PRE-02',
            'order_id' => $this->order1->id,
            'customer_id' => $this->customer1->id,
            'recorded_by' => $this->admin->id,
            'payment_method' => PaymentMethod::CASH,
            'amount' => '100.00',
            'payment_date' => now()->toDateString(),
            'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
        ]);

        // Total existing: 250.00. Order total: 500.00. Collectible remaining: 250.00.
        // Record 250.00 - should succeed without PostgreSQL 0A000 error
        $response = $this->actingAs($this->admin)->post('/admin/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 250.00,
            'payment_date' => now()->toDateString(),
            'receipt_reference' => 'ADM-REC-LOCK',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // Now collectible remaining is 0.00. Another payment must be rejected.
        $overpayResponse = $this->actingAs($this->admin)->post('/admin/payments/cash', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 10.00,
            'payment_date' => now()->toDateString(),
        ]);

        $overpayResponse->assertSessionHasErrors(['amount']);
    }

    public function test_inertia_cheque_and_money_order_mutations_preserve_inertia_contract(): void
    {
        $jpegFile = $this->createValidJpeg();

        // Cheque via Inertia
        $responseCheque = $this->actingAs($this->admin)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Requested-With' => 'XMLHttpRequest',
            ])
            ->from(route('admin.orders.show', $this->approvedOrder->id))
            ->post('/admin/payments/cheque', [
                'customer_id' => $this->customer1->id,
                'order_id' => $this->approvedOrder->id,
                'amount' => 300.00,
                'payment_date' => now()->toDateString(),
                'bank_name' => 'TD Bank',
                'cheque_number' => 'CHK-INERTIA-01',
                'cheque_date' => now()->toDateString(),
                'evidence' => $jpegFile,
            ]);

        $responseCheque->assertStatus(302);
        $responseCheque->assertRedirect(route('admin.orders.show', $this->approvedOrder->id));
        $responseCheque->assertSessionHas('success');

        // Money Order via Inertia
        $jpegFile2 = $this->createValidJpeg();
        $responseMO = $this->actingAs($this->admin)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Requested-With' => 'XMLHttpRequest',
            ])
            ->from(route('admin.orders.show', $this->approvedOrder->id))
            ->post('/admin/payments/money-order', [
                'customer_id' => $this->customer1->id,
                'order_id' => $this->approvedOrder->id,
                'amount' => 200.00,
                'payment_date' => now()->toDateString(),
                'issuer_name' => 'US Postal Service',
                'money_order_number' => 'MO-INERTIA-01',
                'evidence' => $jpegFile2,
            ]);

        $responseMO->assertStatus(302);
        $responseMO->assertRedirect(route('admin.orders.show', $this->approvedOrder->id));
        $responseMO->assertSessionHas('success');
    }

    public function test_salesman_inertia_cash_payment_returns_redirect_and_not_plain_json(): void
    {
        $response = $this->actingAs($this->salesman1)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Requested-With' => 'XMLHttpRequest',
            ])
            ->from(route('salesman.orders.show', $this->order1->id))
            ->post('/salesman/payments/cash', [
                'customer_id' => $this->customer1->id,
                'order_id' => $this->order1->id,
                'amount' => 100.00,
                'payment_date' => now()->toDateString(),
            ]);

        $response->assertStatus(302);
        $response->assertRedirect(route('salesman.orders.show', $this->order1->id));
        $response->assertSessionHas('success');
    }
}
