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

class MoneyOrderPaymentEntryTest extends TestCase
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
            'name' => 'Atlantic Retailers',
            'code' => 'CUST-ATL',
            'contact_name' => 'Alex Atlantic',
            'phone' => '+1-555-0401',
            'email' => 'atl@wholesale.test',
            'billing_address_line1' => '100 Atlantic Ave',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'billing_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
        ]);

        $this->customer2 = Customer::create([
            'salesman_id' => $this->salesman2->id,
            'name' => 'Pacific Stores',
            'code' => 'CUST-PAC',
            'contact_name' => 'Pam Pacific',
            'phone' => '+1-555-0402',
            'email' => 'pac@wholesale.test',
            'billing_address_line1' => '200 Pacific Ave',
            'billing_city' => 'Metropolis',
            'billing_state' => 'NY',
            'billing_postal_code' => '10002',
            'billing_country' => 'USA',
            'status' => CustomerStatus::ACTIVE,
        ]);

        $this->order1 = Order::create([
            'order_number' => 'ORD-2026-MO-01',
            'customer_id' => $this->customer1->id,
            'salesman_id' => $this->salesman1->id,
            'created_by' => $this->salesman1->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => \App\Enums\FulfillmentStatus::UNALLOCATED,
            'payment_status' => \App\Enums\PaymentStatus::UNPAID,
            'delivery_status' => \App\Enums\DeliveryStatus::PENDING_ASSIGNMENT,
            'adjustment_status' => \App\Enums\AdjustmentStatus::NONE,
            'currency' => 'USD',
            'idempotency_key' => 'idemp-mo-ord-1',
            'subtotal' => '1500.00',
            'tax_total' => '150.00',
            'adjustment_total' => '0.00',
            'grand_total' => '1650.00',
            'version' => 1,
            'submitted_at' => now(),
        ]);
    }

    protected function createValidJpeg(): UploadedFile
    {
        return UploadedFile::fake()->image('mo_receipt.jpg', 800, 600)->size(180);
    }

    public function test_admin_can_record_money_order_payment_with_evidence(): void
    {
        $payload = [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'amount' => 1650.00,
            'payment_date' => now()->toDateString(),
            'issuer_name' => 'US Postal Service',
            'money_order_number' => 'USPS-77665544',
            'notes' => 'Settlement via Postal Money Order',
            'evidence' => $this->createValidJpeg(),
        ];

        $response = $this->actingAs($this->admin)->post(route('admin.payments.money-order.store'), $payload);

        $response->assertStatus(302);

        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'order_id' => $this->order1->id,
            'payment_method' => 'MONEY_ORDER',
            'status' => 'PENDING_VERIFICATION',
            'amount' => '1650.00',
            'issuer_name' => 'US Postal Service',
            'money_order_number' => 'USPS-77665544',
            'evidence_original_name' => 'mo_receipt.jpg',
        ]);
    }

    public function test_salesman_can_record_money_order_for_assigned_customer(): void
    {
        $payload = [
            'customer_id' => $this->customer1->id,
            'amount' => 750.00,
            'payment_date' => now()->toDateString(),
            'issuer_name' => 'Western Union',
            'money_order_number' => 'WU-99887766',
            'evidence' => $this->createValidJpeg(),
        ];

        $response = $this->actingAs($this->salesman1)->post(route('salesman.payments.money-order.store'), $payload);

        $response->assertStatus(302);

        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'payment_method' => 'MONEY_ORDER',
            'issuer_name' => 'Western Union',
            'money_order_number' => 'WU-99887766',
            'recorded_by' => $this->salesman1->id,
        ]);
    }

    public function test_duplicate_money_order_recording_is_rejected(): void
    {
        // First entry
        $payload1 = [
            'customer_id' => $this->customer1->id,
            'amount' => 400.00,
            'payment_date' => now()->toDateString(),
            'issuer_name' => 'MoneyGram',
            'money_order_number' => 'MG-123123',
            'evidence' => $this->createValidJpeg(),
        ];

        $this->actingAs($this->admin)->post(route('admin.payments.money-order.store'), $payload1)->assertStatus(302);

        // Duplicate entry
        $payload2 = [
            'customer_id' => $this->customer1->id,
            'amount' => 400.00,
            'payment_date' => now()->toDateString(),
            'issuer_name' => 'MoneyGram',
            'money_order_number' => 'MG-123123',
            'evidence' => $this->createValidJpeg(),
        ];

        $response2 = $this->actingAs($this->admin)->postJson(route('admin.payments.money-order.store'), $payload2);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors('money_order_number');
    }

    public function test_money_order_without_evidence_succeeds(): void
    {
        $payload = [
            'customer_id' => $this->customer1->id,
            'amount' => 300.00,
            'payment_date' => now()->toDateString(),
            'issuer_name' => 'US Postal Service',
            'money_order_number' => 'USPS-001122',
        ];

        $response = $this->actingAs($this->admin)->postJson(route('admin.payments.money-order.store'), $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('payments', [
            'customer_id' => $this->customer1->id,
            'payment_method' => 'MONEY_ORDER',
            'money_order_number' => 'USPS-001122',
            'amount' => '300.00',
            'evidence_object_key' => null,
        ]);
    }

    public function test_salesman_cannot_record_money_order_for_unassigned_customer(): void
    {
        $payload = [
            'customer_id' => $this->customer2->id,
            'amount' => 300.00,
            'payment_date' => now()->toDateString(),
            'issuer_name' => 'US Postal Service',
            'money_order_number' => 'USPS-445566',
            'evidence' => $this->createValidJpeg(),
        ];

        $response = $this->actingAs($this->salesman1)->postJson(route('salesman.payments.money-order.store'), $payload);

        $response->assertStatus(403);
    }
}
