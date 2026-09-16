<?php

namespace App\Services\Invoices;

use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\PaymentTransactionStatus;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Accounting\JournalMappingService;
use App\Services\Receivable\ReceivableLedgerService;
use App\Services\System\CompanyInformationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceGeneratorService
{
    public function __construct(
        protected InvoiceNumberGenerator $numberGenerator,
        protected CompanyInformationService $companyInformationService,
        protected ReceivableLedgerService $receivableLedgerService,
        protected ?JournalMappingService $journalMappingService = null
    ) {
        $this->journalMappingService ??= app(JournalMappingService::class);
    }

    /**
     * Generate an authoritative, immutable invoice for an approved or completed order.
     *
     * @throws ValidationException
     */
    public function generateInvoiceForOrder(Order|int $orderInput, ?User $actor = null): Invoice
    {
        return $this->generateForOrder($orderInput, $actor);
    }

    public function generateForOrder(Order|int $orderInput, ?User $actor = null): Invoice
    {
        $orderId = $orderInput instanceof Order ? $orderInput->id : $orderInput;

        return DB::transaction(function () use ($orderId, $actor) {
            /** @var Order|null $order */
            $order = Order::query()
                ->with(['customer', 'items', 'payments'])
                ->lockForUpdate()
                ->find($orderId);

            if (! $order) {
                throw ValidationException::withMessages([
                    'order' => 'The specified order does not exist.',
                ]);
            }

            // 1. Idempotency Check: Return existing invoice if already issued
            /** @var Invoice|null $existingInvoice */
            $existingInvoice = Invoice::query()
                ->where('order_id', $order->id)
                ->with(['items', 'customer', 'order', 'creator'])
                ->first();

            if ($existingInvoice) {
                return $existingInvoice;
            }

            // 2. Order State Eligibility Validation (RULE-DOC-001)
            $isEligible = in_array($order->status, [
                OrderStatus::SUBMITTED,
                OrderStatus::APPROVED,
                OrderStatus::PROCESSING,
                OrderStatus::COMPLETED,
            ], true);

            if (! $isEligible) {
                if ($order->status === OrderStatus::CANCELLED || $order->status === OrderStatus::REJECTED) {
                    throw ValidationException::withMessages([
                        'order' => sprintf('Cannot generate invoice for a %s order.', strtolower($order->status->value ?? (string) $order->status)),
                    ]);
                }

                if ($order->status === OrderStatus::DRAFT) {
                    throw ValidationException::withMessages([
                        'order' => 'Cannot generate invoice for a draft order. Submit the order first.',
                    ]);
                }

                throw ValidationException::withMessages([
                    'order' => sprintf('Only submitted, approved, or completed orders can be invoiced. Current status: %s.', $order->status->value ?? (string) $order->status),
                ]);
            }

            $customer = $order->customer;
            if (! $customer) {
                throw ValidationException::withMessages([
                    'customer' => 'Order must have an associated customer to generate an invoice.',
                ]);
            }

            // 3. Payment settlement snapshot
            $verifiedPaidTotal = (string) Payment::query()
                ->where('order_id', $order->id)
                ->where('status', PaymentTransactionStatus::VERIFIED)
                ->sum('amount');

            $amountPaid = (float) $verifiedPaidTotal;
            $grandTotal = (float) $order->grand_total;
            $amountDue = max(0.00, round($grandTotal - $amountPaid, 2));

            $paymentStatus = match (true) {
                $amountPaid >= $grandTotal => PaymentStatus::PAID,
                $amountPaid > 0.00 => PaymentStatus::PARTIALLY_PAID,
                default => PaymentStatus::UNPAID,
            };

            // 4. Company profile snapshot
            $company = $this->companyInformationService->get();
            $companyAddress = trim(sprintf(
                '%s%s, %s, %s %s, %s',
                $company->address_line1,
                $company->address_line2 ? ' '.$company->address_line2 : '',
                $company->city,
                $company->state,
                $company->postal_code,
                $company->country
            ));

            // 5. Payment terms and due date computation
            /** @var PaymentTerms $paymentTerms */
            $paymentTerms = $customer->payment_terms instanceof PaymentTerms
                ? $customer->payment_terms
                : PaymentTerms::tryFrom((string) $customer->payment_terms) ?? PaymentTerms::NET_30;

            $invoiceDate = Carbon::now();
            $dueDate = $invoiceDate->copy()->addDays($paymentTerms->gracePeriodDays());

            // 6. Generate sequential, unique invoice number
            $invoiceNumber = $this->numberGenerator->generate();

            // 7. Persist Invoice Record
            /** @var Invoice $invoice */
            $invoice = Invoice::create([
                'invoice_number' => $invoiceNumber,
                'order_id' => $order->id,
                'customer_id' => $customer->id,
                'created_by' => $actor?->id,
                'status' => InvoiceStatus::ISSUED,
                'invoice_date' => $invoiceDate->toDateString(),
                'due_date' => $dueDate->toDateString(),
                'payment_terms' => $paymentTerms,
                'currency' => $order->currency ?? 'USD',

                // Financial Totals
                'subtotal' => $order->subtotal,
                'tax_total' => $order->tax_total,
                'adjustment_total' => $order->adjustment_total,
                'grand_total' => $order->grand_total,
                'amount_paid' => $amountPaid,
                'amount_due' => $amountDue,
                'payment_status' => $paymentStatus,

                // Customer Snapshot
                'customer_name_snapshot' => $customer->name,
                'customer_code_snapshot' => $customer->code,
                'customer_contact_snapshot' => $customer->contact_name,
                'customer_email_snapshot' => $customer->email,
                'customer_phone_snapshot' => $customer->phone,
                'customer_tax_id_snapshot' => $customer->tax_id,

                // Billing Address Snapshot
                'billing_address_line1_snapshot' => $customer->billing_address_line1,
                'billing_address_line2_snapshot' => $customer->billing_address_line2,
                'billing_city_snapshot' => $customer->billing_city,
                'billing_state_snapshot' => $customer->billing_state,
                'billing_postal_code_snapshot' => $customer->billing_postal_code,
                'billing_country_snapshot' => $customer->billing_country ?? 'US',

                // Shipping Address Snapshot
                'shipping_address_line1_snapshot' => $customer->shipping_address_line1 ?? $customer->billing_address_line1,
                'shipping_address_line2_snapshot' => $customer->shipping_address_line2 ?? $customer->billing_address_line2,
                'shipping_city_snapshot' => $customer->shipping_city ?? $customer->billing_city,
                'shipping_state_snapshot' => $customer->shipping_state ?? $customer->billing_state,
                'shipping_postal_code_snapshot' => $customer->shipping_postal_code ?? $customer->billing_postal_code,
                'shipping_country_snapshot' => $customer->shipping_country ?? $customer->billing_country ?? 'US',

                // Company Snapshot
                'company_legal_name_snapshot' => $company->legal_name,
                'company_dba_name_snapshot' => $company->dba_name,
                'company_address_snapshot' => $companyAddress,
                'company_phone_snapshot' => $company->phone,
                'company_email_snapshot' => $company->email,
                'company_tax_id_snapshot' => $company->tax_id,
                'company_state_tax_id_snapshot' => $company->state_tax_id,
                'invoice_footer_note_snapshot' => $company->invoice_footer_note,
            ]);

            // 8. Persist Invoice Items from Order Item Historical Snapshots
            foreach ($order->items as $item) {
                $fulfillableQty = max(0, $item->ordered_quantity - $item->cancelled_quantity);

                // If line was fully cancelled prior to invoice generation, skip it
                if ($fulfillableQty <= 0) {
                    continue;
                }

                InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'order_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name_snapshot' => $item->product_name_snapshot ?? ($item->product?->name ?? 'Unknown Product'),
                    'sku_snapshot' => $item->sku_snapshot ?? ($item->product?->sku ?? 'UNKNOWN'),
                    'unit_snapshot' => $item->unit_snapshot ?? ($item->product?->unit ?? 'unit'),
                    'quantity' => $fulfillableQty,
                    'unit_price' => $item->unit_price,
                    'tax_profile_code_snapshot' => $item->tax_profile_code_snapshot,
                    'tax_profile_name_snapshot' => $item->tax_profile_name_snapshot,
                    'tax_rate_snapshot' => $item->tax_rate_snapshot ?? 0.0000,
                    'taxable_amount' => $item->taxable_amount,
                    'tax_amount' => $item->tax_amount,
                    'line_total' => $item->line_total,
                ]);
            }

            // 9. Post authoritative invoice charge to customer accounts receivable ledger (Only upon approval / active fulfillment)
            if (in_array($order->status, [OrderStatus::APPROVED, OrderStatus::PROCESSING, OrderStatus::COMPLETED], true)) {
                $this->receivableLedgerService->recordInvoiceCharge($invoice, $actor);

                if ($this->journalMappingService) {
                    $this->journalMappingService->postInvoiceIssued($invoice, $actor);
                }
            }

            return $invoice->load(['items', 'order', 'customer', 'creator']);
        });
    }

    /**
     * Synchronize and post financial recognition when an order is approved.
     */
    public function syncOnOrderApproved(Order $order, ?User $actor = null): ?Invoice
    {
        return DB::transaction(function () use ($order, $actor) {
            /** @var Invoice|null $invoice */
            $invoice = Invoice::where('order_id', $order->id)->lockForUpdate()->first();

            if (! $invoice) {
                $invoice = $this->generateForOrder($order, $actor);
            }

            if ($invoice && $invoice->status !== InvoiceStatus::VOID) {
                // Post AR charge and GL Journal if not yet posted
                $this->receivableLedgerService->recordInvoiceCharge($invoice, $actor);

                if ($this->journalMappingService) {
                    $this->journalMappingService->postInvoiceIssued($invoice, $actor);
                }
            }

            return $invoice;
        });
    }

    /**
     * Synchronize payment settlement totals on the invoice when a payment is verified.
     */
    public function syncOnPaymentVerified(Order $order, ?User $actor = null): ?Invoice
    {
        return DB::transaction(function () use ($order) {
            /** @var Invoice|null $invoice */
            $invoice = Invoice::where('order_id', $order->id)->lockForUpdate()->first();

            if (! $invoice || $invoice->status === InvoiceStatus::VOID) {
                return null;
            }

            $verifiedPaidTotal = (string) Payment::query()
                ->where('order_id', $order->id)
                ->where('status', PaymentTransactionStatus::VERIFIED)
                ->sum('amount');

            $amountPaid = (float) $verifiedPaidTotal;
            $grandTotal = (float) $invoice->grand_total;
            $amountDue = max(0.00, round($grandTotal - $amountPaid, 2));

            $paymentStatus = match (true) {
                $amountPaid >= $grandTotal => PaymentStatus::PAID,
                $amountPaid > 0.00 => PaymentStatus::PARTIALLY_PAID,
                default => PaymentStatus::UNPAID,
            };

            $invoiceStatus = $amountPaid >= $grandTotal ? InvoiceStatus::PAID : InvoiceStatus::ISSUED;

            $invoice->update([
                'amount_paid' => $amountPaid,
                'amount_due' => $amountDue,
                'payment_status' => $paymentStatus,
                'status' => $invoiceStatus,
            ]);

            return $invoice;
        });
    }

    /**
     * Void the invoice when an order is cancelled or rejected.
     */
    public function voidInvoiceForOrder(Order $order, ?User $actor = null, string $reason = ''): ?Invoice
    {
        return DB::transaction(function () use ($order) {
            /** @var Invoice|null $invoice */
            $invoice = Invoice::where('order_id', $order->id)->lockForUpdate()->first();

            if (! $invoice) {
                return null;
            }

            if ($invoice->status !== InvoiceStatus::VOID) {
                $invoice->update([
                    'status' => InvoiceStatus::VOID,
                ]);
            }

            return $invoice;
        });
    }
}
