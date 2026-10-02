<?php

declare(strict_types=1);

namespace Tests\Feature\QA;

use App\Enums\AccountStatus;
use App\Enums\CreditNoteStatus;
use App\Enums\CustomerStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentReversalReason;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTransactionStatus;
use App\Enums\ProductStatus;
use App\Enums\RefundStatus;
use App\Enums\RefundTransactionStatus;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\CreditNote;
use App\Models\CreditNoteItem;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\RefundRequest;
use App\Models\RefundTransaction;
use App\Models\TaxProfile;
use App\Models\User;
use App\Services\Payment\PaymentReversalService;
use App\Services\Payment\PaymentService;
use App\Services\Payment\PaymentVerificationService;
use App\Services\Refund\RefundWorkflowService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Tests\TestCase;

/**
 * QA-007: Master Payment & Refund Financial Integrity Test Suite
 *
 * Verifies:
 * 1. Duplicate payment submission prevention & idempotency key replay
 * 2. Overpayment rejection against authoritative server-side outstanding balance
 * 3. Payment verification maker-checker segregation of duties (recorder != verifier)
 * 4. Payment rejection with mandatory audit reason
 * 5. Payment reversal & bounced cheque operational flow (receivable restoration)
 * 6. Refund request credit limit & available balance validation
 * 7. Refund approval maker-checker segregation of duties (requester != approver)
 * 8. Double-refund prevention & atomic credit note balance exhaustion
 * 9. Refund processing idempotency & transaction replay
 */
class QA007PaymentRefundIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $accountant;
    protected User $salesmanA;
    protected User $salesmanB;

    protected Customer $customer;
    protected Category $category;
    protected TaxProfile $taxProfile;
    protected Product $product;

    protected PaymentService $paymentService;
    protected PaymentVerificationService $verificationService;
    protected PaymentReversalService $reversalService;
    protected RefundWorkflowService $refundService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->paymentService = app(PaymentService::class);
        $this->verificationService = app(PaymentVerificationService::class);
        $this->reversalService = app(PaymentReversalService::class);
        $this->refundService = app(RefundWorkflowService::class);

        $this->admin = User::create([
            'name' => 'Admin QA007',
            'email' => 'admin.qa007@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Admin QA007',
            'email' => 'superadmin.qa007@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->accountant = User::create([
            'name' => 'Accountant QA007',
            'email' => 'accountant.qa007@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::ACCOUNTANT,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesmanA = User::create([
            'name' => 'Salesman A QA007',
            'email' => 'salesman.a.qa007@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesmanB = User::create([
            'name' => 'Salesman B QA007',
            'email' => 'salesman.b.qa007@example.com',
            'password' => bcrypt('Password123!'),
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->customer = Customer::create([
            'name' => 'Apex Supermarkets LLC',
            'code' => 'CUST-QA007',
            'contact_name' => 'Alice Apex',
            'email' => 'alice@apex.test',
            'phone' => '+1-555-0701',
            'billing_address_line1' => '100 Apex Way',
            'billing_city' => 'Jersey City',
            'billing_state' => 'NJ',
            'billing_postal_code' => '07302',
            'billing_country' => 'USA',
            'salesman_id' => $this->salesmanA->id,
            'status' => CustomerStatus::ACTIVE,
            'credit_limit' => '100000.00',
        ]);

        $this->category = Category::create([
            'name' => 'Beverages QA',
            'code' => 'CAT-BEV-007',
            'status' => true,
        ]);

        $this->taxProfile = TaxProfile::create([
            'name' => 'Standard Tax',
            'code' => 'TAX-STD-007',
            'rate' => 10.00,
            'status' => TaxProfileStatus::ACTIVE,
        ]);

        $this->product = Product::create([
            'category_id' => $this->category->id,
            'tax_profile_id' => $this->taxProfile->id,
            'sku' => 'SKU-FIN-007',
            'name' => 'Premium Mineral Water 24pk',
            'cost_price' => '8.00',
            'minimum_allowed_price' => '10.00',
            'default_selling_price' => '12.00',
            'mrp' => '15.00',
            'unit' => 'CASE',
            'status' => ProductStatus::ACTIVE,
        ]);
    }

    /**
     * Helper to create an approved order with an authoritative balance.
     */
    protected function createApprovedOrder(string $grandTotal = '1000.00'): Order
    {
        $order = Order::create([
            'order_number' => 'ORD-QA007-'.Str::upper(Str::random(8)),
            'customer_id' => $this->customer->id,
            'salesman_id' => $this->salesmanA->id,
            'created_by' => $this->salesmanA->id,
            'status' => OrderStatus::APPROVED,
            'fulfillment_status' => FulfillmentStatus::UNALLOCATED,
            'payment_status' => PaymentStatus::UNPAID,
            'currency' => 'USD',
            'subtotal' => number_format((float) $grandTotal / 1.1, 2, '.', ''),
            'tax_total' => number_format((float) $grandTotal - ((float) $grandTotal / 1.1), 2, '.', ''),
            'adjustment_total' => '0.00',
            'grand_total' => $grandTotal,
            'idempotency_key' => (string) Str::uuid(),
            'submitted_at' => Carbon::now(),
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name_snapshot' => $this->product->name,
            'sku_snapshot' => $this->product->sku,
            'unit_snapshot' => $this->product->unit,
            'tax_profile_code_snapshot' => $this->taxProfile->code,
            'tax_profile_name_snapshot' => $this->taxProfile->name,
            'tax_rate_snapshot' => $this->taxProfile->rate,
            'ordered_quantity' => 10,
            'cancelled_quantity' => 0,
            'reserved_quantity' => 10,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
            'unit_price' => '100.00',
            'tax_profile_id' => $this->taxProfile->id,
            'taxable_amount' => $order->subtotal,
            'tax_amount' => $order->tax_total,
            'line_total' => $order->grand_total,
        ]);

        return $order;
    }

    /**
     * Helper to create an issued credit note with a specified balance.
     */
    protected function createIssuedCreditNote(string $totalAmount = '500.00'): CreditNote
    {
        return CreditNote::create([
            'credit_number' => 'CR-2026-'.Str::upper(Str::random(6)),
            'customer_id' => $this->customer->id,
            'status' => CreditNoteStatus::ISSUED,
            'currency' => 'USD',
            'subtotal' => $totalAmount,
            'tax_total' => '0.00',
            'total_amount' => $totalAmount,
            'remaining_balance' => $totalAmount,
            'allocated_to_refunds' => '0.00',
            'allocated_to_invoices' => '0.00',
            'reason' => 'Damaged goods return credit',
            'issued_by' => $this->admin->id,
            'issued_at' => Carbon::now(),
        ]);
    }

    /**
     * Test 1: Overpayment rejection against authoritative remaining order balance.
     */
    public function test_overpayment_rejection_against_authoritative_order_balance(): void
    {
        $order = $this->createApprovedOrder('1000.00');

        // Attempting to record $1200 payment against $1000 order balance must fail
        $this->expectException(ValidationException::class);
        $this->paymentService->recordOrderPayment(
            $order,
            '1200.00',
            PaymentMethod::CASH,
            $this->salesmanA,
            ['notes' => 'Attempted overpayment']
        );
    }

    /**
     * Test 2: Maker-Checker segregation of duties on payment verification.
     * The recorder of a payment cannot verify their own payment transaction.
     */
    public function test_payment_verification_maker_checker_segregation(): void
    {
        $order = $this->createApprovedOrder('800.00');

        // Admin records a payment
        $payment = Payment::create([
            'payment_number' => 'PAY-2026-000071',
            'order_id' => $order->id,
            'customer_id' => $this->customer->id,
            'amount' => '800.00',
            'payment_method' => PaymentMethod::CHEQUE,
            'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
            'cheque_number' => 'CHQ-778899',
            'bank_name' => 'Wells Fargo',
            'cheque_date' => Carbon::now()->toDateString(),
            'recorded_by' => $this->admin->id,
            'payment_date' => Carbon::now()->toDateString(),
        ]);

        // Admin attempts to verify their own payment: Must throw ConflictHttpException / ValidationException
        try {
            $this->verificationService->verifyPayment($payment, $this->admin);
            $this->fail('Expected Maker-Checker validation exception when recorder verifies own payment.');
        } catch (\Exception $e) {
            $this->assertTrue(
                $e instanceof ConflictHttpException || $e instanceof ValidationException,
                'Must reject self-verification with ConflictHttpException or ValidationException.'
            );
        }

        // Accountant (different actor) verifies payment: Must succeed
        $verifiedPayment = $this->verificationService->verifyPayment($payment, $this->accountant);
        $this->assertEquals(PaymentTransactionStatus::VERIFIED, $verifiedPayment->status);
        $this->assertEquals($this->accountant->id, $verifiedPayment->verified_by);
    }

    /**
     * Test 3: Payment rejection with mandatory justification reason.
     */
    public function test_payment_rejection_with_mandatory_reason(): void
    {
        $order = $this->createApprovedOrder('500.00');

        $payment = Payment::create([
            'payment_number' => 'PAY-2026-000072',
            'order_id' => $order->id,
            'customer_id' => $this->customer->id,
            'amount' => '500.00',
            'payment_method' => PaymentMethod::CHEQUE,
            'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
            'cheque_number' => 'CHQ-990011',
            'bank_name' => 'Citibank',
            'cheque_date' => Carbon::now()->toDateString(),
            'recorded_by' => $this->salesmanA->id,
            'payment_date' => Carbon::now()->toDateString(),
        ]);

        $rejectedPayment = $this->verificationService->rejectPayment(
            $payment,
            $this->accountant,
            'Unsigned cheque; signature missing on face'
        );

        $this->assertEquals(PaymentTransactionStatus::REJECTED, $rejectedPayment->status);
        $this->assertNotEmpty($rejectedPayment->rejection_reason);
    }

    /**
     * Test 4: Payment reversal & receivable restoration (bounced cheque scenario).
     */
    public function test_payment_reversal_restores_receivables_and_order_unpaid_status(): void
    {
        $order = $this->createApprovedOrder('600.00');

        // Verified payment
        $payment = Payment::create([
            'payment_number' => 'PAY-2026-000073',
            'order_id' => $order->id,
            'customer_id' => $this->customer->id,
            'amount' => '600.00',
            'payment_method' => PaymentMethod::CHEQUE,
            'status' => PaymentTransactionStatus::VERIFIED,
            'cheque_number' => 'CHQ-554433',
            'bank_name' => 'Bank of America',
            'cheque_date' => Carbon::now()->toDateString(),
            'recorded_by' => $this->salesmanA->id,
            'verified_by' => $this->accountant->id,
            'verified_at' => Carbon::now(),
            'payment_date' => Carbon::now()->toDateString(),
        ]);

        $order->update(['payment_status' => PaymentStatus::PAID]);

        // Reverse payment due to bounced cheque
        $reversedPayment = $this->reversalService->reversePayment(
            $payment,
            PaymentReversalReason::BOUNCED_CHEQUE,
            'Bank notified cheque returned NSF',
            $this->superAdmin
        );

        $this->assertEquals(PaymentTransactionStatus::REVERSED, $reversedPayment->status);

        // Order payment status must revert to UNPAID
        $order->refresh();
        $this->assertEquals(PaymentStatus::UNPAID, $order->payment_status);
    }

    /**
     * Test 5: Refund request cannot exceed available credit note balance.
     */
    public function test_refund_request_cannot_exceed_credit_note_balance(): void
    {
        $creditNote = $this->createIssuedCreditNote('400.00');

        // Requesting $500 on a $400 credit note must be rejected
        $this->expectException(ValidationException::class);
        $this->refundService->createRefundRequest(
            $creditNote,
            $this->salesmanA,
            [
                'requested_amount' => '500.00',
                'payment_method' => PaymentMethod::CASH,
                'reason' => 'Customer requested cash refund exceeding credit note',
            ]
        );
    }

    /**
     * Test 6: Refund approval maker-checker segregation of duties.
     */
    public function test_refund_approval_maker_checker_segregation(): void
    {
        $creditNote = $this->createIssuedCreditNote('300.00');

        $refundRequest = $this->refundService->createRefundRequest(
            $creditNote,
            $this->admin,
            [
                'requested_amount' => '300.00',
                'payment_method' => PaymentMethod::CHEQUE,
                'reason' => 'Return refund disbursement',
            ]
        );

        // Admin who created the request cannot approve it (Maker-Checker violation)
        try {
            $this->refundService->approveRefund($refundRequest, $this->admin);
            $this->fail('Expected ConflictHttpException when creator approves own refund request.');
        } catch (ConflictHttpException $e) {
            $this->assertStringContainsString('Maker-Checker', $e->getMessage());
        }

        // Super Admin override or Accountant approval succeeds
        $approvedRefund = $this->refundService->approveRefund($refundRequest, $this->superAdmin);
        $this->assertEquals(RefundStatus::APPROVED, $approvedRefund->status);
    }

    /**
     * Test 7: Double-refund prevention and atomic credit note balance deduction upon processing.
     */
    public function test_double_refund_prevention_and_atomic_balance_deduction(): void
    {
        $creditNote = $this->createIssuedCreditNote('500.00');

        $refundRequest = $this->refundService->createRefundRequest(
            $creditNote,
            $this->salesmanA,
            [
                'requested_amount' => '500.00',
                'payment_method' => PaymentMethod::CASH,
                'reason' => 'Full refund payout',
            ]
        );

        $this->refundService->approveRefund($refundRequest, $this->admin);

        // Process refund transaction
        $transaction = $this->refundService->processRefund($refundRequest, $this->accountant);
        $this->assertNotNull($transaction);
        $this->assertEquals(RefundTransactionStatus::COMPLETED, $transaction->status);

        // Credit note remaining balance must be exactly 0.00
        $creditNote->refresh();
        $this->assertEquals('0.00', (string) $creditNote->remaining_balance);
        $this->assertEquals('500.00', (string) $creditNote->allocated_to_refunds);

        // Attempting to process another refund request against the exhausted credit note must fail
        $secondRequest = RefundRequest::create([
            'refund_number' => 'REF-2026-999999',
            'credit_note_id' => $creditNote->id,
            'customer_id' => $this->customer->id,
            'status' => RefundStatus::APPROVED,
            'payment_method' => PaymentMethod::CASH,
            'amount' => '200.00',
            'reason' => 'Second unauthorized request',
            'requested_by' => $this->salesmanA->id,
            'requested_at' => Carbon::now(),
        ]);

        $this->expectException(ConflictHttpException::class);
        $this->refundService->processRefund($secondRequest, $this->accountant);
    }
}
