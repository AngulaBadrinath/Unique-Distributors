<?php

namespace App\Services\Payment;

use App\Enums\PaymentRejectionReason;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTransactionStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Accounting\JournalMappingService;
use App\Services\Auth\PermissionService;
use App\Services\Invoices\InvoiceGeneratorService;
use App\Services\Notification\DomainNotificationDispatcher;
use App\Services\Receivable\ReceivableLedgerService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PaymentVerificationService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected ReceivableLedgerService $receivableLedgerService,
        protected ?JournalMappingService $journalMappingService = null,
        protected ?InvoiceGeneratorService $invoiceGeneratorService = null,
        protected ?DomainNotificationDispatcher $notificationDispatcher = null,
    ) {
        $this->journalMappingService ??= app(JournalMappingService::class);
        $this->invoiceGeneratorService ??= app(InvoiceGeneratorService::class);
        $this->notificationDispatcher ??= app(DomainNotificationDispatcher::class);
    }

    /**
     * Authoritatively verify and reconcile a pending payment.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    public function verifyPayment(Payment $payment, User $actor): Payment
    {
        // 1. Authorize payment.verify permission
        $this->permissionService->authorize($actor, Permission::PAYMENT_VERIFY);

        // 2. Maker-checker segregation of duties: recorder cannot verify own payment unless Super Admin
        if ((int) $payment->recorded_by === (int) $actor->id && $actor->role !== UserRole::SUPER_ADMIN) {
            throw new AuthorizationException('Maker-checker violation: You cannot verify a payment that you recorded.');
        }

        // 3. State machine pre-check
        if ($payment->status !== PaymentTransactionStatus::PENDING_VERIFICATION) {
            throw new ConflictHttpException("Payment {$payment->payment_number} is in '{$payment->status->label()}' status and cannot be verified.");
        }

        // 3. Pessimistic aggregate lock: Customer -> Order -> Payment
        return DB::transaction(function () use ($payment, $actor) {
            // Lock Customer
            $customer = Customer::where('id', $payment->customer_id)->lockForUpdate()->first();

            // Lock Order if linked
            $order = null;
            if ($payment->order_id) {
                $order = Order::where('id', $payment->order_id)->lockForUpdate()->first();
            }

            // Lock Payment
            $lockedPayment = Payment::where('id', $payment->id)->lockForUpdate()->firstOrFail();

            // Re-verify status under row lock
            if ($lockedPayment->status !== PaymentTransactionStatus::PENDING_VERIFICATION) {
                throw new ConflictHttpException("Payment {$lockedPayment->payment_number} is already in '{$lockedPayment->status->label()}' status.");
            }

            // Mutate payment state
            $lockedPayment->update([
                'status' => PaymentTransactionStatus::VERIFIED,
                'verified_by' => $actor->id,
                'verified_at' => now(),
                'version' => $lockedPayment->version + 1,
            ]);

            // Reconcile order payment status if linked
            if ($order) {
                $this->reconcileOrderPaymentStatus($order);
                $this->invoiceGeneratorService->syncOnPaymentVerified($order, $actor);
            }

            // Post authoritative payment credit to customer accounts receivable ledger
            $this->receivableLedgerService->recordPaymentCredit($lockedPayment, $actor);

            // Post authoritative payment receipt to General Ledger
            if ($this->journalMappingService) {
                $this->journalMappingService->postPaymentVerified($lockedPayment, $actor);
            }

            Log::info('Payment verified successfully', [
                'payment_id' => $lockedPayment->id,
                'payment_number' => $lockedPayment->payment_number,
                'amount' => $lockedPayment->amount,
                'verified_by' => $actor->id,
                'order_id' => $order?->id,
            ]);

            // Queue domain notification after transaction commit
            DB::afterCommit(function () use ($lockedPayment) {
                $this->notificationDispatcher->notifyPaymentVerified($lockedPayment);
            });

            return $lockedPayment->fresh(['customer', 'order', 'recordedBy', 'verifiedBy']);
        }, 3);
    }

    /**
     * Reconcile authoritative order payment status based strictly on verified payment totals.
     */
    public function reconcileOrderPaymentStatus(Order $order): Order
    {
        // Compute sum of VERIFIED payments only
        $verifiedSum = Payment::where('order_id', $order->id)
            ->where('status', PaymentTransactionStatus::VERIFIED)
            ->sum('amount');

        $verifiedDecimal = (float) $verifiedSum;
        $grandTotalDecimal = (float) $order->grand_total;

        // Determine new status using exact financial precision comparison
        if ($verifiedDecimal <= 0.0) {
            $newStatus = PaymentStatus::UNPAID;
        } elseif (bccomp((string) $verifiedDecimal, (string) $grandTotalDecimal, 2) === -1) {
            $newStatus = PaymentStatus::PARTIALLY_PAID;
        } elseif (bccomp((string) $verifiedDecimal, (string) $grandTotalDecimal, 2) === 0) {
            $newStatus = PaymentStatus::PAID;
        } else {
            $newStatus = PaymentStatus::OVERPAID;
        }

        if ($order->payment_status !== $newStatus) {
            $oldStatus = $order->payment_status;
            $order->update(['payment_status' => $newStatus]);

            Log::info('Order payment status reconciled', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'old_status' => $oldStatus?->value,
                'new_status' => $newStatus->value,
                'verified_payments_total' => $verifiedDecimal,
                'grand_total' => $grandTotalDecimal,
            ]);
        }

        return $order;
    }

    /**
     * Authoritatively reject a pending payment with documented operational reason.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    public function rejectPayment(
        Payment $payment,
        User $actor,
        PaymentRejectionReason $reason,
        string $notes
    ): Payment {
        $this->permissionService->authorize($actor, Permission::PAYMENT_VERIFY);

        // Maker-checker segregation of duties: recorder cannot reject own payment unless Super Admin
        if ((int) $payment->recorded_by === (int) $actor->id && $actor->role !== UserRole::SUPER_ADMIN) {
            throw new AuthorizationException('Maker-checker violation: You cannot reject a payment that you recorded.');
        }

        if ($payment->status !== PaymentTransactionStatus::PENDING_VERIFICATION) {
            throw new ConflictHttpException("Payment {$payment->payment_number} is in '{$payment->status->label()}' status and cannot be rejected.");
        }

        return DB::transaction(function () use ($payment, $actor, $reason, $notes) {
            $customer = Customer::where('id', $payment->customer_id)->lockForUpdate()->first();
            $order = $payment->order_id ? Order::where('id', $payment->order_id)->lockForUpdate()->first() : null;

            $lockedPayment = Payment::where('id', $payment->id)->lockForUpdate()->firstOrFail();

            if ($lockedPayment->status !== PaymentTransactionStatus::PENDING_VERIFICATION) {
                throw new ConflictHttpException("Payment {$lockedPayment->payment_number} is already '{$lockedPayment->status->label()}'.");
            }

            $lockedPayment->update([
                'status' => PaymentTransactionStatus::REJECTED,
                'rejected_by' => $actor->id,
                'rejection_reason_code' => $reason,
                'rejection_notes' => $notes,
                'rejected_at' => now(),
                'version' => $lockedPayment->version + 1,
            ]);

            // Reconcile order if necessary
            if ($order) {
                $this->reconcileOrderPaymentStatus($order);
            }

            Log::info('Payment rejected', [
                'payment_id' => $lockedPayment->id,
                'payment_number' => $lockedPayment->payment_number,
                'reason' => $reason->value,
                'rejected_by' => $actor->id,
            ]);

            // Queue domain notification after transaction commit
            DB::afterCommit(function () use ($lockedPayment, $reason, $notes) {
                $this->notificationDispatcher->notifyPaymentRejected($lockedPayment, $reason->label() . ': ' . $notes);
            });

            return $lockedPayment->fresh(['customer', 'order', 'recordedBy', 'rejectedBy']);
        }, 3);
    }

    /**
     * Get aggregate count badges for payment workspace tabs.
     *
     * @return array<string, int>
     */
    public static function getBadgeCounts(?User $actor = null): array
    {
        $query = Payment::query();
        if ($actor) {
            $query->forUser($actor);
        }

        $rows = $query->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $all = array_sum($rows);
        $pending = $rows[PaymentTransactionStatus::PENDING_VERIFICATION->value] ?? 0;
        $verified = $rows[PaymentTransactionStatus::VERIFIED->value] ?? 0;
        $rejected = $rows[PaymentTransactionStatus::REJECTED->value] ?? 0;
        $reversed = $rows[PaymentTransactionStatus::REVERSED->value] ?? 0;

        return [
            'all' => $all,
            'pending_verification' => $pending,
            'verified' => $verified,
            'rejected' => $rejected,
            'reversed' => $reversed,
        ];
    }
}
