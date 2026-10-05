<?php

namespace Tests\Api;

use App\Enums\AccountStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentTransactionStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\User;
use Tests\Support\ApiTestCase;

class PaymentVerificationApiTest extends ApiTestCase
{
    protected User $admin;
    protected User $accountant;
    protected User $salesman;
    protected Payment $payment;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::factory()->create([
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::factory()->create([
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $customer = Customer::create([
            'code' => 'CUST-PAY-01',
            'name' => 'Pay Customer',
            'contact_name' => 'Pay Contact',
            'email' => 'pay@example.com',
            'phone' => '+1 555 222 3333',
            'billing_address_line1' => '500 Pay St',
            'billing_city' => 'Atlanta',
            'billing_state' => 'GA',
            'billing_postal_code' => '30301',
            'billing_country' => 'US',
            'shipping_address_line1' => '500 Pay St',
            'shipping_city' => 'Atlanta',
            'shipping_state' => 'GA',
            'shipping_postal_code' => '30301',
            'shipping_country' => 'US',
            'payment_terms' => PaymentTerms::NET_30,
            'credit_limit' => '10000.00',
            'salesman_id' => $this->salesman->id,
        ]);

        $this->payment = Payment::create([
            'payment_number' => 'PAY-2026-0001',
            'customer_id' => $customer->id,
            'amount' => '1000.00',
            'payment_method' => PaymentMethod::CASH,
            'status' => PaymentTransactionStatus::VERIFIED,
            'payment_date' => now(),
            'recorded_by' => $this->accountant->id,
        ]);
    }

    /**
     * Admin and Accountant can view payments workspace.
     */
    public function test_admin_and_accountant_can_view_payments(): void
    {
        $responseAdmin = $this->actingAs($this->admin)->get('/admin/payments');
        $responseAdmin->assertStatus(200);

        $responseAccountant = $this->actingAs($this->accountant)->get('/admin/payments');
        $responseAccountant->assertStatus(200);
    }

    /**
     * RULE-SEC-003: Delivery partner without payment permissions cannot access admin payments queue (forbidden).
     */
    public function test_delivery_partner_forbidden_from_admin_payments(): void
    {
        $deliveryPartner = User::factory()->create([
            'role' => UserRole::DELIVERY_PARTNER,
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->actingAs($deliveryPartner)->get('/admin/payments');
        $response->assertStatus(403);
    }

    /**
     * Unauthenticated guest is redirected to login.
     */
    public function test_guest_redirected_from_payments(): void
    {
        $this->assertGuestRedirected('/admin/payments');
    }
}
