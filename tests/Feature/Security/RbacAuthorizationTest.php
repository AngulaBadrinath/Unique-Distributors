<?php

namespace Tests\Feature\Security;

use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentRejectionReason;
use App\Enums\PaymentReversalReason;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\PaymentTransactionStatus;
use App\Enums\Permission;
use App\Enums\ProductStatus;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class RbacAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clearResolvedInstances();
    }

    /**
     * Helper to create a user with specific role and active status.
     */
    protected function createUser(UserRole $role, array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role' => $role,
            'status' => AccountStatus::ACTIVE,
        ], $attributes));
    }

    /**
     * Helper to create a customer.
     */
    protected function createCustomer(array $attributes = []): Customer
    {
        static $counter = 1;
        $num = str_pad((string) $counter++, 4, '0', STR_PAD_LEFT);

        return Customer::create(array_merge([
            'code' => 'CUST-' . $num,
            'name' => 'Customer ' . $num,
            'contact_name' => 'Contact ' . $num,
            'email' => "customer{$num}@example.com",
            'phone' => '555-0100',
            'billing_address_line1' => '123 Market St',
            'billing_city' => 'Jersey City',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07302',
            'billing_country' => 'US',
            'credit_limit' => 50000.00,
            'payment_terms' => PaymentTerms::NET_30,
            'status' => CustomerStatus::ACTIVE,
        ], $attributes));
    }

    /**
     * Helper to create a tax profile.
     */
    protected function createTaxProfile(array $attributes = []): TaxProfile
    {
        static $taxCounter = 1;
        $num = $taxCounter++;

        return TaxProfile::create(array_merge([
            'name' => 'Standard Tax ' . $num,
            'code' => 'STD' . $num,
            'rate' => 6.625,
            'status' => TaxProfileStatus::ACTIVE,
            'is_default' => false,
        ], $attributes));
    }

    /**
     * Helper to create a product.
     */
    protected function createProduct(array $attributes = []): Product
    {
        static $prodCounter = 1;
        $num = str_pad((string) $prodCounter++, 4, '0', STR_PAD_LEFT);
        $tax = $this->createTaxProfile();

        return Product::create(array_merge([
            'sku' => 'SKU-' . $num,
            'name' => 'Product ' . $num,
            'unit' => 'CASE',
            'status' => ProductStatus::ACTIVE,
            'cost_price' => 20.00,
            'default_selling_price' => 45.00,
            'minimum_allowed_price' => 35.00,
            'mrp' => 50.00,
            'tax_profile_id' => $tax->id,
            'barcode' => '8901234' . $num,
        ], $attributes));
    }

    /**
     * Helper to create an order.
     */
    protected function createOrder(Customer $customer, User $creator, array $attributes = []): Order
    {
        static $orderCounter = 1;
        $num = str_pad((string) $orderCounter++, 4, '0', STR_PAD_LEFT);

        return Order::create(array_merge([
            'order_number' => 'ORD-2026-' . $num,
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'customer_id' => $customer->id,
            'salesman_id' => $customer->salesman_id ?? $creator->id,
            'created_by' => $creator->id,
            'status' => OrderStatus::SUBMITTED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal' => 450.00,
            'tax_amount' => 29.81,
            'grand_total' => 479.81,
            'order_date' => now(),
        ], $attributes));
    }

    /**
     * Helper to create a delivery.
     */
    protected function createDelivery(Order $order, User $driver, array $attributes = []): Delivery
    {
        static $delCounter = 1;
        $num = str_pad((string) $delCounter++, 4, '0', STR_PAD_LEFT);

        return Delivery::create(array_merge([
            'delivery_number' => 'DEL-2026-' . $num,
            'order_id' => $order->id,
            'customer_id' => $order->customer_id,
            'driver_id' => $driver->id,
            'created_by' => $order->created_by,
            'status' => DeliveryStatus::ASSIGNED,
            'delivery_address_line1' => '123 Delivery St',
            'delivery_city' => 'Jersey City',
            'delivery_state' => 'NJ',
            'delivery_postal_code' => '07302',
            'delivery_country_code' => 'US',
            'scheduled_date' => now()->toDateString(),
            'assigned_at' => now(),
        ], $attributes));
    }

    /**
     * Helper to create an invoice.
     */
    protected function createInvoice(Order $order, Customer $customer, User $creator, array $attributes = []): Invoice
    {
        static $invCounter = 1;
        $num = str_pad((string) $invCounter++, 4, '0', STR_PAD_LEFT);

        return Invoice::create(array_merge([
            'invoice_number' => 'INV-2026-' . $num,
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'created_by' => $creator->id,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'payment_terms' => PaymentTerms::NET_30,
            'currency' => 'USD',
            'subtotal' => 450.00,
            'tax_total' => 29.81,
            'grand_total' => 479.81,
            'amount_paid' => 0.00,
            'amount_due' => 479.81,
            'payment_status' => PaymentStatus::UNPAID,
            'customer_name_snapshot' => $customer->name,
            'customer_code_snapshot' => $customer->code,
            'customer_contact_snapshot' => $customer->contact_name,
            'customer_email_snapshot' => $customer->email,
            'customer_phone_snapshot' => $customer->phone,
            'billing_address_line1_snapshot' => $customer->billing_address_line1,
            'billing_city_snapshot' => $customer->billing_city,
            'billing_state_snapshot' => $customer->billing_state,
            'billing_postal_code_snapshot' => $customer->billing_postal_code,
            'billing_country_snapshot' => $customer->billing_country,
            'shipping_address_line1_snapshot' => $customer->shipping_address_line1 ?? $customer->billing_address_line1,
            'shipping_city_snapshot' => $customer->shipping_city ?? $customer->billing_city,
            'shipping_state_snapshot' => $customer->shipping_state ?? $customer->billing_state,
            'shipping_postal_code_snapshot' => $customer->shipping_postal_code ?? $customer->billing_postal_code,
            'shipping_country_snapshot' => $customer->shipping_country ?? $customer->billing_country,
            'company_legal_name_snapshot' => 'Unique Jersey Wholesale',
            'company_address_snapshot' => '123 Enterprise Blvd, Jersey City, NJ',
            'company_phone_snapshot' => '+15551234567',
            'company_email_snapshot' => 'billing@uniquejersey.com',
            'company_tax_id_snapshot' => 'US-123456789',
            'status' => \App\Enums\InvoiceStatus::ISSUED,
        ], $attributes));
    }

    /**
     * 1. IDOR TEST: Salesman A cannot access Salesman B's customer portfolio.
     */
    public function test_salesman_cannot_access_unassigned_customer(): void
    {
        $salesmanA = $this->createUser(UserRole::SALESMAN);
        $salesmanB = $this->createUser(UserRole::SALESMAN);

        $customerB = $this->createCustomer([
            'salesman_id' => $salesmanB->id,
            'status' => CustomerStatus::ACTIVE,
        ]);

        // Salesman A attempting to access Customer B must receive 403
        $response = $this->actingAs($salesmanA)->get("/customers/{$customerB->id}");
        $response->assertStatus(403);
    }

    /**
     * 2. IDOR TEST: Salesman A cannot access Salesman B's orders or drafts.
     */
    public function test_salesman_cannot_access_unassigned_order_or_draft(): void
    {
        $salesmanA = $this->createUser(UserRole::SALESMAN);
        $salesmanB = $this->createUser(UserRole::SALESMAN);

        $customerB = $this->createCustomer(['salesman_id' => $salesmanB->id]);

        $orderB = $this->createOrder($customerB, $salesmanB, [
            'status' => OrderStatus::DRAFT,
        ]);

        // Salesman A attempting to view order (scoped query returns 404)
        $this->actingAs($salesmanA)->get("/salesman/orders/{$orderB->id}")
            ->assertStatus(404);

        // Salesman A attempting to edit draft (scoped check returns 404)
        $this->actingAs($salesmanA)->get("/salesman/orders/drafts/{$orderB->id}/edit")
            ->assertStatus(404);

        // Salesman A attempting to submit draft (throws AuthorizationException)
        $this->actingAs($salesmanA)->post("/salesman/orders/drafts/{$orderB->id}/submit")
            ->assertStatus(403);

        // Salesman A attempting to discard draft (throws AuthorizationException)
        $this->actingAs($salesmanA)->delete("/salesman/orders/drafts/{$orderB->id}")
            ->assertStatus(403);
    }

    /**
     * 3. IDOR TEST: Salesman A cannot access invoices for Salesman B's customer.
     */
    public function test_salesman_cannot_access_unassigned_customer_invoices(): void
    {
        $salesmanA = $this->createUser(UserRole::SALESMAN);
        $salesmanB = $this->createUser(UserRole::SALESMAN);

        $customerB = $this->createCustomer(['salesman_id' => $salesmanB->id]);
        $orderB = $this->createOrder($customerB, $salesmanB, [
            'status' => OrderStatus::APPROVED,
        ]);

        $invoiceB = $this->createInvoice($orderB, $customerB, $salesmanB);

        // Salesman A viewing invoice (scoped query throws 404 for unassigned)
        $this->actingAs($salesmanA)->get("/salesman/invoices/{$invoiceB->id}")
            ->assertStatus(404);

        // Salesman A downloading invoice PDF (scoped query throws 404 for unassigned)
        $this->actingAs($salesmanA)->get("/invoices/{$invoiceB->id}/pdf")
            ->assertStatus(404);

        // Salesman A printing invoice (scoped query throws 404 for unassigned)
        $this->actingAs($salesmanA)->get("/invoices/{$invoiceB->id}/print")
            ->assertStatus(404);
    }

    /**
     * 4. IDOR TEST: Delivery Partner A cannot access or manipulate Delivery Partner B's mission.
     */
    public function test_delivery_partner_cannot_access_or_mutate_other_driver_delivery(): void
    {
        $driverA = $this->createUser(UserRole::DELIVERY_PARTNER);
        $driverB = $this->createUser(UserRole::DELIVERY_PARTNER);
        $admin = $this->createUser(UserRole::ADMIN);

        $customer = $this->createCustomer();
        $order = $this->createOrder($customer, $admin, [
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::PACKED,
        ]);

        $deliveryB = $this->createDelivery($order, $driverB);

        // Driver A viewing Driver B's delivery details (404 anti-enumeration)
        $this->actingAs($driverA)->get("/delivery/{$deliveryB->id}")
            ->assertStatus(404);

        // Driver A viewing Driver B's delivery history
        $this->actingAs($driverA)->get("/delivery/{$deliveryB->id}/history")
            ->assertStatus(404);

        // Driver A attempting to pick up Driver B's delivery
        $this->actingAs($driverA)->post("/delivery/{$deliveryB->id}/pickup")
            ->assertStatus(404);

        // Driver A attempting to complete Driver B's delivery
        $this->actingAs($driverA)->post("/delivery/{$deliveryB->id}/complete", [
            'recipient_name' => 'John Doe',
            'signature_data' => 'sig_test',
        ])->assertStatus(404);
    }

    /**
     * 5. PRIVILEGE ESCALATION: Salesman cannot approve/reject orders, access accounting, or manage users.
     */
    public function test_salesman_privilege_escalation_is_blocked(): void
    {
        $salesman = $this->createUser(UserRole::SALESMAN);
        $customer = $this->createCustomer(['salesman_id' => $salesman->id]);
        $order = $this->createOrder($customer, $salesman);

        // Salesman cannot approve order
        $this->actingAs($salesman)->post("/admin/orders/{$order->id}/approve")
            ->assertStatus(403);

        // Salesman cannot reject order
        $this->actingAs($salesman)->post("/admin/orders/{$order->id}/reject", [
            'rejection_reason_code' => 'CUSTOMER_REQUESTED',
            'rejection_notes' => 'Test rejection',
        ])->assertStatus(403);

        // Salesman cannot access admin orders queue
        $this->actingAs($salesman)->get('/admin/orders')
            ->assertStatus(403);

        // Salesman cannot access GL Accounting
        $this->actingAs($salesman)->get('/admin/accounting')
            ->assertStatus(403);

        // Salesman cannot access Accounts Payable
        $this->actingAs($salesman)->get('/admin/payables')
            ->assertStatus(403);

        // Salesman cannot access User provisioning
        $this->actingAs($salesman)->get('/salesmen/create')
            ->assertStatus(403);

        $this->actingAs($salesman)->get('/delivery-partners/create')
            ->assertStatus(403);

        // Salesman cannot access Role Management
        $this->actingAs($salesman)->get('/security/roles')
            ->assertStatus(403);
    }

    /**
     * 6. PRIVILEGE ESCALATION: Delivery Partner cannot access accounting, admin queues, or payment verification.
     */
    public function test_delivery_partner_privilege_escalation_is_blocked(): void
    {
        $driver = $this->createUser(UserRole::DELIVERY_PARTNER);

        // Delivery Partner cannot access Accounting
        $this->actingAs($driver)->get('/admin/accounting')->assertStatus(403);
        $this->actingAs($driver)->get('/admin/payables')->assertStatus(403);
        $this->actingAs($driver)->get('/admin/receivables')->assertStatus(403);

        // Delivery Partner cannot access Payment verification workspace
        $this->actingAs($driver)->get('/admin/payments')->assertStatus(403);

        // Delivery Partner cannot access Admin Order workspace
        $this->actingAs($driver)->get('/admin/orders')->assertStatus(403);

        // Delivery Partner cannot access Customer Management
        $this->actingAs($driver)->get('/customers')->assertStatus(403);

        // Delivery Partner cannot access Reports hub
        $this->actingAs($driver)->get('/admin/reports')->assertStatus(403);
    }

    /**
     * 7. PRIVILEGE ESCALATION: Warehouse Manager cannot access accounting, payables, or salesman reports.
     */
    public function test_warehouse_manager_privilege_escalation_is_blocked(): void
    {
        $warehouse = $this->createUser(UserRole::WAREHOUSE_MANAGER);

        // Warehouse Manager cannot access Accounting GL
        $this->actingAs($warehouse)->get('/admin/accounting')->assertStatus(403);
        $this->actingAs($warehouse)->get('/admin/payables')->assertStatus(403);
        $this->actingAs($warehouse)->get('/admin/receivables')->assertStatus(403);

        // Warehouse Manager cannot access Payment Verification
        $this->actingAs($warehouse)->get('/admin/payments')->assertStatus(403);

        // Warehouse Manager cannot view Salesman Performance Reports
        $this->actingAs($warehouse)->get('/admin/reports/salesmen')->assertStatus(403);
    }

    /**
     * 8. CROSS-DOMAIN RESTRICTION: Accountant cannot perform warehouse fulfillment operations.
     */
    public function test_accountant_cannot_execute_warehouse_fulfillment(): void
    {
        $accountant = $this->createUser(UserRole::ACCOUNTANT);
        $admin = $this->createUser(UserRole::ADMIN);
        $customer = $this->createCustomer();
        $order = $this->createOrder($customer, $admin, [
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::RESERVED,
        ]);

        // Accountant cannot access warehouse fulfillment workspace
        $this->actingAs($accountant)->get('/admin/warehouse/fulfillment')->assertStatus(403);

        // Accountant cannot execute pick/pack/dispatch
        $this->actingAs($accountant)->post("/admin/warehouse/fulfillment/{$order->id}/pick")->assertStatus(403);
        $this->actingAs($accountant)->post("/admin/warehouse/fulfillment/{$order->id}/pack")->assertStatus(403);
        $this->actingAs($accountant)->post("/admin/warehouse/fulfillment/{$order->id}/dispatch")->assertStatus(403);
    }

    /**
     * 9. MAKER-CHECKER SEGREGATION OF DUTIES: Payment recorder cannot verify, reject, or reverse own payment.
     */
    public function test_maker_checker_prevents_payment_recorder_from_verifying_or_reversing_own_payment(): void
    {
        $accountantA = $this->createUser(UserRole::ACCOUNTANT);
        $accountantB = $this->createUser(UserRole::ACCOUNTANT);
        $superAdmin = $this->createUser(UserRole::SUPER_ADMIN);

        $customer = $this->createCustomer();

        // Accountant A records a cash payment
        $payment = Payment::create([
            'payment_number' => 'PAY-2026-0001',
            'customer_id' => $customer->id,
            'recorded_by' => $accountantA->id,
            'payment_method' => PaymentMethod::CASH,
            'amount' => 500.00,
            'payment_date' => now(),
            'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
        ]);

        // 1. Accountant A attempting to verify their OWN recorded payment MUST FAIL with 403
        $this->actingAs($accountantA)->post("/admin/payments/{$payment->id}/verify")
            ->assertStatus(403);

        // 2. Accountant A attempting to reject their OWN recorded payment MUST FAIL with 403
        $this->actingAs($accountantA)->post("/admin/payments/{$payment->id}/reject", [
            'rejection_reason_code' => PaymentRejectionReason::ILLEGIBLE_EVIDENCE->value,
            'rejection_notes' => 'Self-rejection test',
        ])->assertStatus(403);

        // 3. Different Accountant B CAN verify the payment (valid maker-checker segregation)
        $this->actingAs($accountantB)->post("/admin/payments/{$payment->id}/verify")
            ->assertStatus(302);

        $payment->refresh();
        $this->assertEquals(PaymentTransactionStatus::VERIFIED, $payment->status);
        $this->assertEquals($accountantB->id, $payment->verified_by);

        // 4. Accountant A attempting to reverse their OWN recorded verified payment MUST FAIL with 403
        $this->actingAs($accountantA)->post("/admin/payments/{$payment->id}/reverse", [
            'reversal_reason_code' => PaymentReversalReason::BOUNCED_CHEQUE->value,
            'reversal_notes' => 'Self-reversal test',
        ])->assertStatus(403);

        // 5. Super Admin CAN reverse or verify (emergency bypass)
        $this->actingAs($superAdmin)->post("/admin/payments/{$payment->id}/reverse", [
            'reversal_reason_code' => PaymentReversalReason::ADMIN_CORRECTION->value,
            'reversal_notes' => 'Super admin authorized reversal',
        ])->assertStatus(302);

        $payment->refresh();
        $this->assertEquals(PaymentTransactionStatus::REVERSED, $payment->status);
    }

    /**
     * 10. COST PRICE MASKING: Cost price is strictly masked for non-administrative roles.
     */
    public function test_cost_price_is_masked_for_salesman_and_non_admins(): void
    {
        $salesman = $this->createUser(UserRole::SALESMAN);
        $admin = $this->createUser(UserRole::ADMIN);

        $product = $this->createProduct([
            'sku' => 'PROD-999',
            'barcode' => '7891234567890',
            'cost_price' => 25.50,
        ]);

        // Salesman barcode lookup: cost_price must be NULL
        $salesmanBarcodeRes = $this->actingAs($salesman)->getJson("/products/barcode/lookup?barcode=7891234567890");
        $salesmanBarcodeRes->assertStatus(200);
        $salesmanBarcodeRes->assertJson([
            'found' => true,
            'product' => [
                'sku' => 'PROD-999',
                'cost_price' => null,
            ],
        ]);

        // Admin barcode lookup: cost_price must be visible
        $adminBarcodeRes = $this->actingAs($admin)->getJson("/products/barcode/lookup?barcode=7891234567890");
        $adminBarcodeRes->assertStatus(200);
        $adminBarcodeRes->assertJson([
            'found' => true,
            'product' => [
                'sku' => 'PROD-999',
                'cost_price' => 25.50,
            ],
        ]);
    }

    /**
     * 11. INACTIVE & SUSPENDED ACCOUNT ENFORCEMENT: Disabled accounts cannot access any authenticated routes.
     */
    public function test_suspended_and_disabled_accounts_are_rejected(): void
    {
        $suspendedUser = $this->createUser(UserRole::SALESMAN, ['status' => AccountStatus::SUSPENDED]);
        $disabledUser = $this->createUser(UserRole::ADMIN, ['status' => AccountStatus::DISABLED]);

        // Web requests redirect to login
        $this->actingAs($suspendedUser)->get('/dashboard')->assertRedirect('/login');
        $this->actingAs($disabledUser)->get('/admin/orders')->assertRedirect('/login');

        // JSON requests receive 403
        $this->actingAs($suspendedUser)->getJson('/dashboard')->assertStatus(403);
        $this->actingAs($disabledUser)->getJson('/admin/orders')->assertStatus(403);
    }

    /**
     * 12. POSITIVE WORKFLOW: Authorized roles can execute their legitimate operations.
     */
    public function test_positive_legitimate_workflows_succeed(): void
    {
        $superAdmin = $this->createUser(UserRole::SUPER_ADMIN);
        $admin = $this->createUser(UserRole::ADMIN);
        $accountant = $this->createUser(UserRole::ACCOUNTANT);
        $warehouse = $this->createUser(UserRole::WAREHOUSE_MANAGER);
        $driver = $this->createUser(UserRole::DELIVERY_PARTNER);
        $salesman = $this->createUser(UserRole::SALESMAN);

        // Super Admin access
        $this->actingAs($superAdmin)->get('/security/roles')->assertStatus(200);
        $this->actingAs($superAdmin)->get('/admin/accounting')->assertStatus(200);

        // Admin access
        $this->actingAs($admin)->get('/admin/orders')->assertStatus(200);
        $this->actingAs($admin)->get('/admin/deliveries')->assertStatus(200);

        // Accountant access
        $this->actingAs($accountant)->get('/admin/accounting')->assertStatus(200);
        $this->actingAs($accountant)->get('/admin/receivables')->assertStatus(200);
        $this->actingAs($accountant)->get('/admin/payables')->assertStatus(200);

        // Warehouse Manager access
        $this->actingAs($warehouse)->get('/admin/inventory')->assertStatus(200);
        $this->actingAs($warehouse)->get('/admin/warehouse/fulfillment')->assertStatus(200);

        // Delivery Partner access
        $this->actingAs($driver)->get('/delivery')->assertStatus(200);

        // Salesman access
        $this->actingAs($salesman)->get('/salesman/orders')->assertStatus(200);
        $this->actingAs($salesman)->get('/customers')->assertStatus(200);
    }
}
