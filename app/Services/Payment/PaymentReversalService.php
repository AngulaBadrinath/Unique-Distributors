<?php

namespace App\Services\Payment;

use App\Enums\PaymentReversalReason;
use App\Enums\PaymentTransactionStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Accounting\JournalMappingService;
use App\Services\Auth\PermissionService;
use App\Services\Receivable\ReceivableLedgerService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PaymentReversalService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected PaymentVerificationService $verificationService,
        protected ReceivableLedgerService $receivableLedgerService,
        protected JournalMappingService $journalMappingService
    ) {}

    /**
     * Authoritatively reverse a previously verified payment (e.g. bounced cheque, NSF, bank dispute).
     *
     * @param  Payment  $payment
     * @param  User  $actor
     * @param  PaymentReversalReason  $reason
     * @param  string  $notes
     * @return Payment
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    public function reversePayment(
        Payment $payment,
        User $actor,
        PaymentReversalReason $reason,
        string $notes
    ): Payment {
        // 1. Strictly enforce payment.reverse permission (Accountant & Super Admin only)
        $this->permissionService->authorize($actor, Permission::PAYMENT_REVERSE);

        // 2. Maker-checker segregation of duties: recorder cannot reverse own payment unless Super Admin
        if ((int) $payment->recorded_by === (int) $actor->id && $actor->role !== UserRole::SUPER_ADMIN) {
            throw new AuthorizationException('Maker-checker violation: You cannot reverse a payment that you recorded.');
        }

        // 3. State machine gate: Only VERIFIED payments can be reversed
        if ($payment->status !== PaymentTransactionStatus::VERIFIED) {
            throw new ConflictHttpException("Payment {$payment->payment_number} is in '{$payment->status->label()}' status and cannot be reversed.");
        }

        // 3. Atomic transaction with deterministic aggregate lock order: Customer -> Order -> Payment
        return DB::transaction(function () use ($payment, $actor, $reason, $notes) {
            // Lock Customer
            $customer = Customer::where('id', $payment->customer_id)->lockForUpdate()->first();

            // Lock Order if linked
            $order = null;
            if ($payment->order_id) {
                $order = Order::where('id', $payment->order_id)->lockForUpdate()->first();
            }

            // Lock Payment row
            $lockedPayment = Payment::where('id', $payment->id)->lockForUpdate()->firstOrFail();

            // Re-verify status under row lock
            if ($lockedPayment->status !== PaymentTransactionStatus::VERIFIED) {
                throw new ConflictHttpException("Payment {$lockedPayment->payment_number} is no longer in verified status (current: '{$lockedPayment->status->label()}').");
            }

            // Apply reversal
            $lockedPayment->update([
                'status' => PaymentTransactionStatus::REVERSED,
                'reversed_by' => $actor->id,
                'reversed_at' => now(),
                'reversal_reason_code' => $reason,
                'reversal_notes' => $notes,
                'version' => $lockedPayment->version + 1,
            ]);

            // Reconcile order payment status (the reversed payment no longer counts toward settled balance)
            if ($order) {
                $this->verificationService->reconcileOrderPaymentStatus($order);
            }

            // Post compensating debit to customer accounts receivable ledger
            $this->receivableLedgerService->recordPaymentReversal($lockedPayment, $actor);

            // Post compensating entry to General Ledger
            $this->journalMappingService->postPaymentReversed($lockedPayment, $actor);

            Log::warning('Payment reversed and bounced', [
                'payment_id' => $lockedPayment->id,
                'payment_number' => $lockedPayment->payment_number,
                'amount' => $lockedPayment->amount,
                'method' => $lockedPayment->payment_method?->value,
                'reversal_reason' => $reason->value,
                'reversed_by' => $actor->id,
                'order_id' => $order?->id,
            ]);

            return $lockedPayment->fresh(['customer', 'order', 'recordedBy', 'verifiedBy', 'reversedBy']);
        }, 3);
    }
}
