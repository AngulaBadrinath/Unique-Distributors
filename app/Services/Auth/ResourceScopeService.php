<?php

namespace App\Services\Auth;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\CreditNote;
use App\Models\CreditNoteItem;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\InventoryBalance;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\ReceivableTransaction;
use App\Models\RefundRequest;
use App\Models\RefundTransaction;
use App\Models\ReturnItem;
use App\Models\ReturnRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class ResourceScopeService
{
    public function __construct(
        protected PermissionService $permissionService,
    ) {}

    /**
     * Determine whether the authenticated user has access to a specific customer record.
     */
    public function canAccessCustomer(User $user, Customer|int $customer): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        $customerId = $customer instanceof Customer ? $customer->id : (int) $customer;
        $salesmanId = $customer instanceof Customer ? $customer->salesman_id : Customer::where('id', $customerId)->value('salesman_id');

        if ($user->role === UserRole::SALESMAN) {
            return (int) $salesmanId === (int) $user->id;
        }

        return $this->permissionService->has($user, Permission::CUSTOMER_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to a specific order record.
     */
    public function canAccessOrder(User $user, Order|int $order): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($order instanceof Order) {
            $orderSalesmanId = $order->salesman_id;
        } else {
            $orderSalesmanId = Order::where('id', (int) $order)->value('salesman_id');
        }

        if ($user->role === UserRole::SALESMAN) {
            return (int) $orderSalesmanId === (int) $user->id;
        }

        return $this->permissionService->has($user, Permission::ORDER_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to a specific delivery mission.
     */
    public function canAccessDelivery(User $user, Delivery|int $delivery): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        $driverId = $delivery instanceof Delivery ? $delivery->driver_id : Delivery::where('id', (int) $delivery)->value('driver_id');

        if ($user->role === UserRole::DELIVERY_PARTNER) {
            return (int) $driverId === (int) $user->id;
        }

        return $this->permissionService->has($user, Permission::DELIVERY_VIEW)
            || $this->permissionService->has($user, Permission::DELIVERY_UPDATE);
    }

    /**
     * Determine whether the authenticated user has access to a specific return request.
     */
    public function canAccessReturn(User $user, ReturnRequest|int $returnRequest): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($user->role === UserRole::SALESMAN) {
            if ($returnRequest instanceof ReturnRequest) {
                if ((int) $returnRequest->created_by === (int) $user->id) {
                    return true;
                }
                $customerSalesmanId = $returnRequest->customer?->salesman_id ?? Customer::where('id', $returnRequest->customer_id)->value('salesman_id');

                return (int) $customerSalesmanId === (int) $user->id;
            }

            return ReturnRequest::query()
                ->where('id', (int) $returnRequest)
                ->where(function (Builder $q) use ($user) {
                    $q->where('created_by', $user->id)
                        ->orWhereHas('customer', fn ($cq) => $cq->where('salesman_id', $user->id))
                        ->orWhereHas('order', fn ($oq) => $oq->where('salesman_id', $user->id));
                })
                ->exists();
        }

        return $this->permissionService->has($user, Permission::RETURN_REVIEW)
            || $this->permissionService->has($user, Permission::RETURN_REQUEST)
            || $this->permissionService->has($user, Permission::RETURN_APPROVE);
    }

    /**
     * Determine whether the authenticated user has access to a specific payment record.
     */
    public function canAccessPayment(User $user, Payment|int $payment): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($user->role === UserRole::SALESMAN) {
            if ($payment instanceof Payment) {
                if ((int) $payment->recorded_by === (int) $user->id) {
                    return true;
                }
                $customerSalesmanId = $payment->customer?->salesman_id ?? Customer::where('id', $payment->customer_id)->value('salesman_id');

                return (int) $customerSalesmanId === (int) $user->id;
            }

            return Payment::query()
                ->where('id', (int) $payment)
                ->where(function (Builder $q) use ($user) {
                    $q->where('recorded_by', $user->id)
                        ->orWhereHas('customer', fn ($cq) => $cq->where('salesman_id', $user->id))
                        ->orWhereHas('order', fn ($oq) => $oq->where('salesman_id', $user->id));
                })
                ->exists();
        }

        return $this->permissionService->has($user, Permission::PAYMENT_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to a specific invoice.
     */
    public function canAccessInvoice(User $user, Invoice|int $invoice): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($user->role === UserRole::SALESMAN) {
            if ($invoice instanceof Invoice) {
                $customerSalesmanId = $invoice->customer?->salesman_id ?? Customer::where('id', $invoice->customer_id)->value('salesman_id');
                if ((int) $customerSalesmanId === (int) $user->id) {
                    return true;
                }

                $orderSalesmanId = $invoice->order?->salesman_id ?? Order::where('id', $invoice->order_id)->value('salesman_id');

                return (int) $orderSalesmanId === (int) $user->id;
            }

            return Invoice::query()
                ->where('id', (int) $invoice)
                ->where(function (Builder $q) use ($user) {
                    $q->whereHas('customer', fn ($cq) => $cq->where('salesman_id', $user->id))
                        ->orWhereHas('order', fn ($oq) => $oq->where('salesman_id', $user->id));
                })
                ->exists();
        }

        return $this->permissionService->has($user, Permission::INVOICE_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to a specific credit note.
     */
    public function canAccessCreditNote(User $user, CreditNote|int $creditNote): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($user->role === UserRole::SALESMAN) {
            if ($creditNote instanceof CreditNote) {
                if ((int) $creditNote->issued_by === (int) $user->id) {
                    return true;
                }
                $customerSalesmanId = $creditNote->customer?->salesman_id ?? Customer::where('id', $creditNote->customer_id)->value('salesman_id');

                return (int) $customerSalesmanId === (int) $user->id;
            }

            return CreditNote::query()
                ->where('id', (int) $creditNote)
                ->where(function (Builder $q) use ($user) {
                    $q->where('issued_by', $user->id)
                        ->orWhereHas('customer', fn ($cq) => $cq->where('salesman_id', $user->id))
                        ->orWhereHas('order', fn ($oq) => $oq->where('salesman_id', $user->id));
                })
                ->exists();
        }

        return $this->permissionService->has($user, Permission::CREDIT_CREATE)
            || $this->permissionService->has($user, Permission::REFUND_REQUEST)
            || $this->permissionService->has($user, Permission::REFUND_APPROVE)
            || $this->permissionService->has($user, Permission::ACCOUNTING_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to a specific refund request.
     */
    public function canAccessRefundRequest(User $user, RefundRequest|int $refundRequest): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($user->role === UserRole::SALESMAN) {
            if ($refundRequest instanceof RefundRequest) {
                if ((int) $refundRequest->requested_by === (int) $user->id) {
                    return true;
                }
                $customerSalesmanId = $refundRequest->customer?->salesman_id ?? Customer::where('id', $refundRequest->customer_id)->value('salesman_id');

                return (int) $customerSalesmanId === (int) $user->id;
            }

            return RefundRequest::query()
                ->where('id', (int) $refundRequest)
                ->where(function (Builder $q) use ($user) {
                    $q->where('requested_by', $user->id)
                        ->orWhereHas('customer', fn ($cq) => $cq->where('salesman_id', $user->id));
                })
                ->exists();
        }

        return $this->permissionService->has($user, Permission::REFUND_REQUEST)
            || $this->permissionService->has($user, Permission::REFUND_APPROVE)
            || $this->permissionService->has($user, Permission::ACCOUNTING_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to a specific refund transaction.
     */
    public function canAccessRefundTransaction(User $user, RefundTransaction|int $transaction): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($user->role === UserRole::SALESMAN) {
            if ($transaction instanceof RefundTransaction) {
                if ((int) $transaction->processed_by === (int) $user->id) {
                    return true;
                }
                $customerSalesmanId = $transaction->customer?->salesman_id ?? Customer::where('id', $transaction->customer_id)->value('salesman_id');

                return (int) $customerSalesmanId === (int) $user->id;
            }

            return RefundTransaction::query()
                ->where('id', (int) $transaction)
                ->where(function (Builder $q) use ($user) {
                    $q->where('processed_by', $user->id)
                        ->orWhereHas('customer', fn ($cq) => $cq->where('salesman_id', $user->id));
                })
                ->exists();
        }

        return $this->permissionService->has($user, Permission::REFUND_APPROVE)
            || $this->permissionService->has($user, Permission::ACCOUNTING_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to a specific inventory balance.
     */
    public function canAccessInventoryBalance(User $user, InventoryBalance|int $balance): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        return $this->permissionService->has($user, Permission::INVENTORY_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to an order adjustment.
     */
    public function canAccessAdjustment(User $user, OrderAdjustment|int $adjustment): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if ($user->role === UserRole::SALESMAN) {
            if ($adjustment instanceof OrderAdjustment) {
                if ((int) $adjustment->requested_by === (int) $user->id) {
                    return true;
                }
                $orderSalesmanId = $adjustment->order?->salesman_id ?? Order::where('id', $adjustment->order_id)->value('salesman_id');

                return (int) $orderSalesmanId === (int) $user->id;
            }

            return OrderAdjustment::query()
                ->where('id', (int) $adjustment)
                ->where(function (Builder $q) use ($user) {
                    $q->where('requested_by', $user->id)
                        ->orWhereHas('order', fn ($oq) => $oq->where('salesman_id', $user->id));
                })
                ->exists();
        }

        return $this->permissionService->has($user, Permission::ORDER_ADJUST_REVIEW)
            || $this->permissionService->has($user, Permission::ORDER_ADJUST_REQUEST);
    }

    /**
     * Query scoping helper: apply authoritative customer scope.
     */
    public function scopeCustomers(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->where('customers.salesman_id', $user->id);
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative order scope.
     */
    public function scopeOrders(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->where('orders.salesman_id', $user->id);
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative delivery scope.
     */
    public function scopeDeliveries(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::DELIVERY_PARTNER) {
            return $query->where('deliveries.driver_id', $user->id);
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative return request scope.
     */
    public function scopeReturns(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->where(function (Builder $q) use ($user) {
                $q->where('return_requests.created_by', $user->id)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('customers.salesman_id', $user->id))
                    ->orWhereHas('order', fn ($oq) => $oq->where('orders.salesman_id', $user->id));
            });
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative payment scope.
     */
    public function scopePayments(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->where(function (Builder $q) use ($user) {
                $q->where('payments.recorded_by', $user->id)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('customers.salesman_id', $user->id))
                    ->orWhereHas('order', fn ($oq) => $oq->where('orders.salesman_id', $user->id));
            });
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative invoice scope.
     */
    public function scopeInvoices(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->whereHas('customer', fn ($cq) => $cq->where('customers.salesman_id', $user->id));
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative credit note scope.
     */
    public function scopeCreditNotes(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->where(function (Builder $q) use ($user) {
                $q->where('credit_notes.issued_by', $user->id)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('customers.salesman_id', $user->id))
                    ->orWhereHas('order', fn ($oq) => $oq->where('orders.salesman_id', $user->id));
            });
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative refund request scope.
     */
    public function scopeRefundRequests(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->where(function (Builder $q) use ($user) {
                $q->where('refund_requests.requested_by', $user->id)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('customers.salesman_id', $user->id));
            });
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative refund transaction scope.
     */
    public function scopeRefundTransactions(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::SALESMAN) {
            return $query->where(function (Builder $q) use ($user) {
                $q->where('refund_transactions.processed_by', $user->id)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('customers.salesman_id', $user->id));
            });
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative inventory balance scope.
     */
    public function scopeInventoryBalances(Builder $query, User $user): Builder
    {
        return $query;
    }

    /**
     * Determine whether the authenticated user has access to a specific customer's receivables / statements.
     */
    public function canAccessCustomerReceivables(User $user, Customer|int $customer): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        if (! $this->permissionService->has($user, Permission::RECEIVABLE_VIEW)) {
            return false;
        }

        $customerId = $customer instanceof Customer ? $customer->id : (int) $customer;
        $salesmanId = $customer instanceof Customer ? $customer->salesman_id : Customer::where('id', $customerId)->value('salesman_id');

        if ($user->role === UserRole::SALESMAN) {
            return (int) $salesmanId === (int) $user->id;
        }

        return true;
    }

    /**
     * Query scoping helper: apply authoritative accounts receivable ledger query scope.
     */
    public function scopeReceivableTransactions(Builder $query, User $user): Builder
    {
        if (! $this->isUserActive($user)) {
            return $query->whereRaw('1 = 0');
        }

        if (! $this->permissionService->has($user, Permission::RECEIVABLE_VIEW)) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->role === UserRole::SALESMAN) {
            return $query->whereHas('customer', function (Builder $cq) use ($user) {
                $cq->where('salesman_id', $user->id);
            });
        }

        return $query;
    }

    /**
     * Determine whether the authenticated user has access to view supplier payables.
     */
    public function canAccessSupplierPayables(User $user): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        return $this->permissionService->has($user, Permission::PAYABLE_VIEW);
    }

    /**
     * Determine whether the authenticated user has access to manage supplier payables.
     */
    public function canManageSupplierPayables(User $user): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        return $this->permissionService->has($user, Permission::PAYABLE_MANAGE);
    }

    /**
     * Query scoping helper: apply authoritative accounts payable ledger query scope.
     */
    public function scopePayableTransactions(Builder $query, User $user): Builder
    {
        if (! $this->isUserActive($user)) {
            return $query->whereRaw('1 = 0');
        }

        if (! $this->permissionService->has($user, Permission::PAYABLE_VIEW)) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative supplier bills query scope.
     */
    public function scopeSupplierBills(Builder $query, User $user): Builder
    {
        if (! $this->isUserActive($user)) {
            return $query->whereRaw('1 = 0');
        }

        if (! $this->permissionService->has($user, Permission::PAYABLE_VIEW)) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative supplier payments query scope.
     */
    public function scopeSupplierPayments(Builder $query, User $user): Builder
    {
        if (! $this->isUserActive($user)) {
            return $query->whereRaw('1 = 0');
        }

        if (! $this->permissionService->has($user, Permission::PAYABLE_VIEW)) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative suppliers query scope.
     */
    public function scopeSuppliers(Builder $query, User $user): Builder
    {
        if (! $this->isUserActive($user)) {
            return $query->whereRaw('1 = 0');
        }

        if (! $this->permissionService->has($user, Permission::PAYABLE_VIEW)) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }

    /**
     * Determine whether the user can access General Ledger and Chart of Accounts.
     */
    public function canAccessAccounting(User $user): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        return $this->permissionService->has($user, Permission::ACCOUNTING_VIEW);
    }

    /**
     * Determine whether the user can post manual journals or create accounts.
     */
    public function canPostAccounting(User $user): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        return $this->permissionService->has($user, Permission::ACCOUNTING_POST);
    }

    /**
     * Determine whether the user can execute controlled journal reversals.
     */
    public function canReverseAccounting(User $user): bool
    {
        if (! $this->isUserActive($user)) {
            return false;
        }

        return $this->permissionService->has($user, Permission::ACCOUNTING_REVERSE);
    }

    /**
     * Query scoping helper: apply authoritative journal entries query scope.
     */
    public function scopeJournalEntries(Builder $query, User $user): Builder
    {
        if (! $this->canAccessAccounting($user)) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative accounts query scope.
     */
    public function scopeAccounts(Builder $query, User $user): Builder
    {
        if (! $this->canAccessAccounting($user)) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }

    /**
     * Query scoping helper: apply authoritative cash reconciliations query scope.
     */
    public function scopeCashReconciliations(Builder $query, User $user): Builder
    {
        if (! $this->canAccessAccounting($user)) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }

    /**
     * Nested resource verification: CreditNote -> CreditNoteItem.
     */
    public function verifyCreditNoteItemOwnership(CreditNoteItem $item, CreditNote $creditNote): bool
    {
        return (int) $item->credit_note_id === (int) $creditNote->id;
    }

    /**
     * Nested resource verification: Order -> OrderAdjustment.
     */
    public function verifyOrderAdjustmentOwnership(OrderAdjustment $adjustment, Order $order): bool
    {
        return (int) $adjustment->order_id === (int) $order->id;
    }

    /**
     * Nested resource verification: Order -> OrderItem.
     */
    public function verifyOrderItemOwnership(OrderItem $item, Order $order): bool
    {
        return (int) $item->order_id === (int) $order->id;
    }

    /**
     * Nested resource verification: Delivery -> DeliveryItem.
     */
    public function verifyDeliveryItemOwnership(DeliveryItem $item, Delivery $delivery): bool
    {
        return (int) $item->delivery_id === (int) $delivery->id;
    }

    /**
     * Nested resource verification: ReturnRequest -> ReturnItem.
     */
    public function verifyReturnItemOwnership(ReturnItem $item, ReturnRequest $returnRequest): bool
    {
        return (int) $item->return_request_id === (int) $returnRequest->id;
    }

    /**
     * Nested resource verification: Invoice -> InvoiceItem.
     */
    public function verifyInvoiceItemOwnership(InvoiceItem $item, Invoice $invoice): bool
    {
        return (int) $item->invoice_id === (int) $invoice->id;
    }

    /**
     * Check whether a user is active.
     */
    protected function isUserActive(User $user): bool
    {
        if ($user->status instanceof AccountStatus) {
            return $user->status === AccountStatus::ACTIVE;
        }

        return $user->status === AccountStatus::ACTIVE->value;
    }
}
