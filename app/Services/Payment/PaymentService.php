<?php

namespace App\Services\Payment;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentTransactionStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Notification\DomainNotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PaymentService
{
    public function __construct(
        protected PaymentNumberGenerator $numberGenerator,
        protected PaymentEvidenceService $evidenceService,
        protected PermissionService $permissionService,
        protected ?DomainNotificationDispatcher $notificationDispatcher = null,
    ) {
        $this->notificationDispatcher ??= app(DomainNotificationDispatcher::class);
    }

    /**
     * Record a new cash payment entry.
     *
     * @param  array<string, mixed>  $data
     * @return Payment
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function recordCashPayment(array $data, User $actor): Payment
    {
        return $this->recordPaymentInternal(
            method: PaymentMethod::CASH,
            data: $data,
            evidenceFile: null,
            actor: $actor
        );
    }

    /**
     * Record a new cheque payment entry.
     *
     * @param  array<string, mixed>  $data
     * @param  UploadedFile|null  $evidenceFile
     * @return Payment
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function recordChequePayment(array $data, ?UploadedFile $evidenceFile, User $actor): Payment
    {
        return $this->recordPaymentInternal(
            method: PaymentMethod::CHEQUE,
            data: $data,
            evidenceFile: $evidenceFile,
            actor: $actor
        );
    }

    /**
     * Record a new money order payment entry.
     *
     * @param  array<string, mixed>  $data
     * @param  UploadedFile|null  $evidenceFile
     * @return Payment
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function recordMoneyOrderPayment(array $data, ?UploadedFile $evidenceFile, User $actor): Payment
    {
        return $this->recordPaymentInternal(
            method: PaymentMethod::MONEY_ORDER,
            data: $data,
            evidenceFile: $evidenceFile,
            actor: $actor
        );
    }

    /**
     * Core transactional payment recording method enforcing domain rules, aggregate locking, and anti-IDOR.
     *
     * @param  PaymentMethod  $method
     * @param  array<string, mixed>  $data
     * @param  UploadedFile|null  $evidenceFile
     * @param  User  $actor
     * @return Payment
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    protected function recordPaymentInternal(
        PaymentMethod $method,
        array $data,
        ?UploadedFile $evidenceFile,
        User $actor
    ): Payment {
        // 1. Authorize payment creation
        $this->permissionService->authorize($actor, Permission::PAYMENT_CREATE);

        $customerId = (int) ($data['customer_id'] ?? 0);
        $orderId = ! empty($data['order_id']) ? (int) $data['order_id'] : null;
        $amount = (float) ($data['amount'] ?? 0);
        $paymentDate = $data['payment_date'] ?? Carbon::now()->toDateString();

        // 2. Validate amount > 0
        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'Payment amount must be greater than zero.',
            ]);
        }

        // 3. Validate payment date is not in future
        if (Carbon::parse($paymentDate)->isFuture()) {
            throw ValidationException::withMessages([
                'payment_date' => 'Payment date cannot be in the future.',
            ]);
        }

        // 4. Method-specific evidence validation (Optional upload support, backward-compatible)
        $evidenceMetadata = [];
        if ($method->requiresEvidence()) {
            if (! $evidenceFile) {
                throw ValidationException::withMessages([
                    'evidence' => "Visual JPEG evidence is mandatory for {$method->label()} payments.",
                ]);
            }
            $evidenceMetadata = $this->evidenceService->validateAndStoreEvidence($evidenceFile);
        } elseif ($evidenceFile) {
            $evidenceMetadata = $this->evidenceService->validateAndStoreEvidence($evidenceFile);
        }

        // 5. Atomic transaction with deterministic aggregate lock hierarchy: Customer -> Order -> Payment
        return DB::transaction(function () use ($method, $data, $customerId, $orderId, $amount, $paymentDate, $evidenceMetadata, $actor) {
            // A. Lock and validate Customer
            $customer = Customer::where('id', $customerId)->lockForUpdate()->first();

            if (! $customer) {
                throw ValidationException::withMessages([
                    'customer_id' => 'The selected customer does not exist.',
                ]);
            }

            if (! $customer->isActive()) {
                throw ValidationException::withMessages([
                    'customer_id' => 'Payments cannot be recorded for inactive customer accounts.',
                ]);
            }

            // Anti-IDOR: If Salesman, verify customer is assigned to this salesman
            if ($actor->role === UserRole::SALESMAN && $customer->salesman_id !== $actor->id) {
                throw new AuthorizationException('You are not authorized to record payments for accounts outside your assigned portfolio.');
            }

            // B. Lock and validate Order (if linked)
            $order = null;
            if ($orderId) {
                $order = Order::where('id', $orderId)->lockForUpdate()->first();

                if (! $order) {
                    throw ValidationException::withMessages([
                        'order_id' => 'The selected order does not exist.',
                    ]);
                }

                if ($order->customer_id !== $customer->id) {
                    throw ValidationException::withMessages([
                        'order_id' => 'The selected order does not belong to this customer.',
                    ]);
                }

                if ($order->status === OrderStatus::DRAFT) {
                    throw ValidationException::withMessages([
                        'order_id' => 'Payments cannot be linked to draft orders. The order must be submitted or approved.',
                    ]);
                }

                if ($order->status === OrderStatus::CANCELLED) {
                    throw ValidationException::withMessages([
                        'order_id' => 'Payments cannot be recorded against cancelled orders.',
                    ]);
                }
            }

            // C. Instrument-specific duplicate checks
            if ($method === PaymentMethod::CHEQUE) {
                $bankName = trim((string) ($data['bank_name'] ?? ''));
                $chequeNumber = trim((string) ($data['cheque_number'] ?? ''));
                $chequeDate = $data['cheque_date'] ?? null;

                if (empty($bankName)) {
                    throw ValidationException::withMessages(['bank_name' => 'Bank name is required for cheque payments.']);
                }
                if (empty($chequeNumber)) {
                    throw ValidationException::withMessages(['cheque_number' => 'Cheque number is required.']);
                }
                if (empty($chequeDate)) {
                    throw ValidationException::withMessages(['cheque_date' => 'Cheque date is required.']);
                }

                // Race-safe duplicate cheque check
                $duplicateCheque = Payment::where('customer_id', $customer->id)
                    ->where('bank_name', $bankName)
                    ->where('cheque_number', $chequeNumber)
                    ->whereIn('status', [PaymentTransactionStatus::PENDING_VERIFICATION, PaymentTransactionStatus::VERIFIED])
                    ->lockForUpdate()
                    ->exists();

                if ($duplicateCheque) {
                    throw ValidationException::withMessages([
                        'cheque_number' => "A cheque with number '{$chequeNumber}' from '{$bankName}' is already recorded for this customer.",
                    ]);
                }
            } elseif ($method === PaymentMethod::MONEY_ORDER) {
                $issuerName = trim((string) ($data['issuer_name'] ?? ''));
                $moNumber = trim((string) ($data['money_order_number'] ?? ''));

                if (empty($issuerName)) {
                    throw ValidationException::withMessages(['issuer_name' => 'Issuer name is required for money order payments.']);
                }
                if (empty($moNumber)) {
                    throw ValidationException::withMessages(['money_order_number' => 'Money order number is required.']);
                }

                // Race-safe duplicate money order check
                $duplicateMo = Payment::where('customer_id', $customer->id)
                    ->where('issuer_name', $issuerName)
                    ->where('money_order_number', $moNumber)
                    ->whereIn('status', [PaymentTransactionStatus::PENDING_VERIFICATION, PaymentTransactionStatus::VERIFIED])
                    ->lockForUpdate()
                    ->exists();

                if ($duplicateMo) {
                    throw ValidationException::withMessages([
                        'money_order_number' => "A money order with number '{$moNumber}' from '{$issuerName}' is already recorded for this customer.",
                    ]);
                }
            }

            // D. Generate sequential payment number
            $paymentNumber = $this->numberGenerator->generate();

            // E. Create payment record
            $payment = Payment::create([
                'payment_number' => $paymentNumber,
                'customer_id' => $customer->id,
                'order_id' => $order?->id,
                'payment_method' => $method,
                'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
                'amount' => number_format($amount, 2, '.', ''),
                'payment_date' => $paymentDate,
                'cheque_number' => $data['cheque_number'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'cheque_date' => $data['cheque_date'] ?? null,
                'money_order_number' => $data['money_order_number'] ?? null,
                'issuer_name' => $data['issuer_name'] ?? null,
                'receipt_reference' => $data['receipt_reference'] ?? null,
                'evidence_object_key' => $evidenceMetadata['evidence_object_key'] ?? null,
                'evidence_original_name' => $evidenceMetadata['evidence_original_name'] ?? null,
                'evidence_mime_type' => $evidenceMetadata['evidence_mime_type'] ?? null,
                'evidence_size_bytes' => $evidenceMetadata['evidence_size_bytes'] ?? null,
                'evidence_uploaded_at' => $evidenceMetadata['evidence_uploaded_at'] ?? null,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $actor->id,
                'version' => 1,
            ]);

            Log::info('Payment recorded successfully', [
                'payment_id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'method' => $method->value,
                'amount' => $payment->amount,
                'customer_id' => $customer->id,
                'order_id' => $order?->id,
                'recorded_by' => $actor->id,
            ]);

            // Queue domain notification after transaction commit
            DB::afterCommit(function () use ($payment) {
                $this->notificationDispatcher->notifyPaymentRecorded($payment);
            });

            return $payment;
        }, 3);
    }

    /**
     * Correct and resubmit a rejected payment with updated instrument details and/or replacement evidence.
     *
     * @param  Payment  $payment
     * @param  array<string, mixed>  $data
     * @param  UploadedFile|null  $evidenceFile
     * @param  User  $actor
     * @return Payment
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function correctAndResubmitPayment(
        Payment $payment,
        array $data,
        ?UploadedFile $evidenceFile,
        User $actor
    ): Payment {
        $this->permissionService->authorize($actor, Permission::PAYMENT_CREATE);

        // State machine pre-check: only REJECTED payments can be corrected
        if ($payment->status !== PaymentTransactionStatus::REJECTED) {
            throw new ConflictHttpException("Payment {$payment->payment_number} is in '{$payment->status->label()}' status and cannot be corrected.");
        }

        // Anti-IDOR for Salesman role
        if ($actor->role === UserRole::SALESMAN) {
            $isAssigned = $payment->customer && $payment->customer->salesman_id === $actor->id;
            $isRecorder = $payment->recorded_by === $actor->id;

            if (! $isAssigned && ! $isRecorder) {
                throw new AuthorizationException('You are not authorized to correct payments for this customer account.');
            }
        }

        // Handle replacement evidence if uploaded
        $evidenceMetadata = [];
        if ($evidenceFile) {
            $evidenceMetadata = $this->evidenceService->validateAndStoreEvidence($evidenceFile);
        }

        return DB::transaction(function () use ($payment, $data, $evidenceMetadata, $actor) {
            $lockedPayment = Payment::where('id', $payment->id)->lockForUpdate()->firstOrFail();

            if ($lockedPayment->status !== PaymentTransactionStatus::REJECTED) {
                throw new ConflictHttpException("Payment {$lockedPayment->payment_number} is no longer in rejected status.");
            }

            $updatePayload = [
                'status' => PaymentTransactionStatus::PENDING_VERIFICATION,
                'version' => $lockedPayment->version + 1,
            ];

            if (isset($data['amount']) && (float) $data['amount'] > 0) {
                $updatePayload['amount'] = number_format((float) $data['amount'], 2, '.', '');
            }

            if (! empty($data['payment_date'])) {
                if (Carbon::parse($data['payment_date'])->isFuture()) {
                    throw ValidationException::withMessages(['payment_date' => 'Payment date cannot be in the future.']);
                }
                $updatePayload['payment_date'] = $data['payment_date'];
            }

            if (! empty($data['bank_name'])) {
                $updatePayload['bank_name'] = trim((string) $data['bank_name']);
            }
            if (! empty($data['cheque_number'])) {
                $updatePayload['cheque_number'] = trim((string) $data['cheque_number']);
            }
            if (! empty($data['cheque_date'])) {
                $updatePayload['cheque_date'] = $data['cheque_date'];
            }
            if (! empty($data['issuer_name'])) {
                $updatePayload['issuer_name'] = trim((string) $data['issuer_name']);
            }
            if (! empty($data['money_order_number'])) {
                $updatePayload['money_order_number'] = trim((string) $data['money_order_number']);
            }
            if (! empty($data['receipt_reference'])) {
                $updatePayload['receipt_reference'] = trim((string) $data['receipt_reference']);
            }
            if (! empty($data['notes'])) {
                $updatePayload['notes'] = trim((string) $data['notes']);
            }

            if (! empty($evidenceMetadata)) {
                $updatePayload['evidence_object_key'] = $evidenceMetadata['evidence_object_key'];
                $updatePayload['evidence_original_name'] = $evidenceMetadata['evidence_original_name'];
                $updatePayload['evidence_mime_type'] = $evidenceMetadata['evidence_mime_type'];
                $updatePayload['evidence_size_bytes'] = $evidenceMetadata['evidence_size_bytes'];
                $updatePayload['evidence_uploaded_at'] = $evidenceMetadata['evidence_uploaded_at'];
            }

            $lockedPayment->update($updatePayload);

            Log::info('Payment corrected and resubmitted for verification', [
                'payment_id' => $lockedPayment->id,
                'payment_number' => $lockedPayment->payment_number,
                'corrected_by' => $actor->id,
                'new_version' => $lockedPayment->version,
            ]);

            return $lockedPayment->fresh(['customer', 'order', 'recordedBy']);
        }, 3);
    }
}
