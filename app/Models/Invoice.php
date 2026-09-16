<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\PaymentTerms;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasFactory;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::updating(function (Invoice $invoice) {
            $dirty = array_keys($invoice->getDirty());
            $allowedOperationalFields = [
                'status',
                'amount_paid',
                'amount_due',
                'payment_status',
                'pdf_path',
                'pdf_generated_at',
                'updated_at',
            ];

            $disallowed = array_diff($dirty, $allowedOperationalFields);

            if (! empty($disallowed)) {
                throw new \LogicException(sprintf(
                    'Issued invoices are immutable financial records. Cannot modify fields: [%s].',
                    implode(', ', $disallowed)
                ));
            }
        });

        static::deleting(function () {
            throw new \LogicException('Issued invoices are permanent financial records and cannot be deleted.');
        });
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'invoice_number',
        'order_id',
        'customer_id',
        'created_by',
        'status',
        'invoice_date',
        'due_date',
        'payment_terms',
        'currency',
        'subtotal',
        'tax_total',
        'adjustment_total',
        'grand_total',
        'amount_paid',
        'amount_due',
        'payment_status',
        'customer_name_snapshot',
        'customer_code_snapshot',
        'customer_contact_snapshot',
        'customer_email_snapshot',
        'customer_phone_snapshot',
        'customer_tax_id_snapshot',
        'billing_address_line1_snapshot',
        'billing_address_line2_snapshot',
        'billing_city_snapshot',
        'billing_state_snapshot',
        'billing_postal_code_snapshot',
        'billing_country_snapshot',
        'shipping_address_line1_snapshot',
        'shipping_address_line2_snapshot',
        'shipping_city_snapshot',
        'shipping_state_snapshot',
        'shipping_postal_code_snapshot',
        'shipping_country_snapshot',
        'company_legal_name_snapshot',
        'company_dba_name_snapshot',
        'company_address_snapshot',
        'company_phone_snapshot',
        'company_email_snapshot',
        'company_tax_id_snapshot',
        'company_state_tax_id_snapshot',
        'invoice_footer_note_snapshot',
        'pdf_path',
        'pdf_generated_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'status' => InvoiceStatus::class,
        'payment_status' => PaymentStatus::class,
        'payment_terms' => PaymentTerms::class,
        'invoice_date' => 'date',
        'due_date' => 'date',
        'subtotal' => 'decimal:2',
        'tax_total' => 'decimal:2',
        'adjustment_total' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'amount_due' => 'decimal:2',
        'pdf_generated_at' => 'datetime',
        'order_id' => 'integer',
        'customer_id' => 'integer',
        'created_by' => 'integer',
    ];

    /**
     * Get the originating order.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /**
     * Get the customer that this invoice was issued to.
     *
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /**
     * Get the line items associated with this invoice.
     *
     * @return HasMany<InvoiceItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id');
    }

    /**
     * Get the user who generated this invoice.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Credit notes issued against this invoice.
     *
     * @return HasMany<CreditNote, $this>
     */
    public function creditNotes(): HasMany
    {
        return $this->hasMany(CreditNote::class, 'invoice_id');
    }

    /**
     * Receivable transactions linked to this invoice.
     *
     * @return HasMany<ReceivableTransaction, $this>
     */
    public function receivableTransactions(): HasMany
    {
        return $this->hasMany(ReceivableTransaction::class, 'invoice_id');
    }

    /**
     * Scope query based on the authenticated actor's resource scope.
     * Salesmen can only access invoices for their assigned customers.
     */
    public function scopeForUser(Builder $query, ?User $user): Builder
    {
        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->role === UserRole::SALESMAN) {
            return $query->where(function (Builder $q) use ($user) {
                $q->whereHas('customer', function (Builder $cq) use ($user) {
                    $cq->where('salesman_id', $user->id);
                })->orWhereHas('order', function (Builder $oq) use ($user) {
                    $oq->where('salesman_id', $user->id);
                });
            });
        }

        return $query;
    }
}
