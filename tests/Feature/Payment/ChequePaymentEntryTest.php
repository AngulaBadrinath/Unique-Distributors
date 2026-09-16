<?php

namespace Tests\Feature\Payment;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentTransactionStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChequePaymentEntryTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $salesman1;
    protected User $salesman2;
    protected Customer $customer1;
    protected Customer $customer2;
    protected Order $order1;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->admin = User::factory()->create([
            'name' => 'Alice Admin',
            'email' => 'admin@wholesale.test',
            'role' => UserRole::ADMIN,
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
            'name' => 'First City Groceries',
            'code' => 'CUST-FCG',
            'contact_name' => 'Frank First',
            'phone' => '+1-555-0301',
            'email' => 'fcg@wholesale.test',
            'billing_address_line1' => '100 First Ave',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
        ]);

        $this->customer2 = Customer::create([
            'salesman_id' => $this->salesman2->id,
            'name' => 'Second City Foods',
            'code' => 'CUST-SCF',
            'contact_name' => 'Sarah Second',
            'phone' => '+1-555-0302',
            'email' => 'scf@wholesale.test',
            'billing_address_line1' => '200 Second Ave',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10002',
            'billing_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
        ]);

        $this->order1 = Order::create([
            'order_number' => 'ORD-2026-CHQ-01',
            'customer_id' => $this->customer1->id,
            'salesman_id' => $this->salesman1->id,
            'created_by' => $this->salesman1->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => \App\Enums\FulfillmentStatus::UNALLOCATED,
            'payment_status' => \App\Enums\PaymentStatus::UNPAID,
            'delivery_status' => \App\Enums\DeliveryStatus::PENDING_ASSIGNMENT,
            'adjustment_status' => \App\Enums\AdjustmentStatus::NONE,
            'currency' => 'USD',
            'idempotency_key' => 'idemp-chq-ord-1',
            'subtotal' => '2000.00',
            'tax_total' => '200.00',
            'adjustment_total' => '0.00',
            'grand_total' => '2200.00',
            'version' => 1,
            'submitted_at' => now(),
        ]);
    }

    protected function createValidJpeg(): UploadedFile
    {
        return UploadedFile::fake()->image('cheque_scan.jpg', 800, 600)->size(200);
    }

    public function test_admin_can_record_cheque_payment_with_evidence(): void
    {
        $payload = [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 2200.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Chase Manhattan Bank',
            'cheque_number' => 'CHQ-889900',
            'cheque_date' => now()->subDay()->toDateString(),
            'notes' => 'Settlement in full via cheque',
            'evidence' => $this->createValidJpeg(),
        ];

        $response = $this->actingAs($this->admin)->post(route('admin.payments.cheque.store'), $payload);

        $response->assertStatus(302); // Redirect back on web form

        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'payment_method' => 'CHEQUE',
            'status' => 'PENDING_VERIFICATION',
            'amount' => '2200.00',
            'bank_name' => 'Chase Manhattan Bank',
            'cheque_number' => 'CHQ-889900',
            'evidence_original_name' => 'cheque_scan.jpg',
        ]);
    }

    public function test_salesman_can_record_cheque_payment_for_assigned_customer(): void
    {
        $payload = [
            'customer_id' => $this->customer1->id,
            'amount' => 1000.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Wells Fargo',
            'cheque_number' => 'WF-123456',
            'cheque_date' => now()->toDateString(),
            'evidence' => $this->createValidJpeg(),
        ];

        $response = $this->actingAs($this->salesman1)->post(route('salesman.payments.cheque.store'), $payload);

        $response->assertStatus(302);

        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'payment_method' => 'CHEQUE',
            'bank_name' => 'Wells Fargo',
            'cheque_number' => 'WF-123456',
            'recorded_by' => $this->salesman1->id,
        ]);
    }

    public function test_duplicate_cheque_recording_is_rejected(): void
    {
        // First entry
        $payload1 = [
            'customer_id' => $this->customer1->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Bank of America',
            'cheque_number' => 'BOA-999000',
            'cheque_date' => now()->toDateString(),
            'evidence' => $this->createValidJpeg(),
        ];

        $this->actingAs($this->admin)->post(route('admin.payments.cheque.store'), $payload1)->assertStatus(302);

        // Second entry with same customer, bank, and cheque number
        $payload2 = [
            'customer_id' => $this->customer1->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Bank of America',
            'cheque_number' => 'BOA-999000',
            'cheque_date' => now()->toDateString(),
            'evidence' => $this->createValidJpeg(),
        ];

        $response2 = $this->actingAs($this->admin)->postJson(route('admin.payments.cheque.store'), $payload2);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors('cheque_number');
    }

    public function test_cheque_payment_without_evidence_succeeds(): void
    {
        $payload = [
            'customer_id' => $this->customer1->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Bank of America',
            'cheque_number' => 'BOA-111222',
            'cheque_date' => now()->toDateString(),
        ];

        $response = $this->actingAs($this->admin)->postJson(route('admin.payments.cheque.store'), $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'payment_method' => 'CHEQUE',
            'cheque_number' => 'BOA-111222',
            'amount' => '500.00',
            'evidence_object_key' => null,
        ]);
    }

    public function test_cheque_payment_with_fake_pdf_evidence_is_rejected(): void
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'test_fake_pdf');
        file_put_contents($tempPath, "%PDF-1.4\nFake PDF body\n%%EOF");

        $fakePdf = new UploadedFile($tempPath, 'fake_cheque.jpg', 'image/jpeg', null, true);

        $payload = [
            'customer_id' => $this->customer1->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Bank of America',
            'cheque_number' => 'BOA-333444',
            'cheque_date' => now()->toDateString(),
            'evidence' => $fakePdf,
        ];

        $response = $this->actingAs($this->admin)->postJson(route('admin.payments.cheque.store'), $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('evidence');

        @unlink($tempPath);
    }

    public function test_salesman_cannot_record_cheque_for_unassigned_customer(): void
    {
        $payload = [
            'customer_id' => $this->customer2->id,
            'amount' => 500.00,
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Citibank',
            'cheque_number' => 'CITI-555666',
            'cheque_date' => now()->toDateString(),
            'evidence' => $this->createValidJpeg(),
        ];

        $response = $this->actingAs($this->salesman1)->postJson(route('salesman.payments.cheque.store'), $payload);

        $response->assertStatus(403);
    }
}
