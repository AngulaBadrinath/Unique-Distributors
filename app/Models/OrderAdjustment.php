<?php

namespace App\Models;

use App\Enums\AdjustmentReasonCode;
use App\Enums\OrderAdjustmentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderAdjustment extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'order_adjustments';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'adjustment_number',
        'order_id',
        'order_number_snapshot',
        'order_version_snapshot',
        'order_status_snapshot',
        'order_subtotal_snapshot',
        'order_tax_total_snapshot',
        'order_grand_total_snapshot',
        'type',
        'status',
        'reason_code',
        'notes',
        'requested_by',
        'requested_at',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
        'cancelled_by',
        'cancelled_at',
        'cancellation_reason',
        'applied_at',
        'reversed_at',
        'reversed_by',
        'reversal_reason',
        'projected_subtotal_reduction',
        'projected_tax_reduction',
        'projected_grand_total_reduction',
        'projected_subtotal_addition',
        'projected_tax_addition',
        'projected_grand_total_addition',
        'idempotency_key',
        'request_fingerprint',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'status' => OrderAdjustmentStatus::class,
        'reason_code' => AdjustmentReasonCode::class,
        'order_version_snapshot' => 'integer',
        'order_subtotal_snapshot' => 'decimal:2',
        'order_tax_total_snapshot' => 'decimal:2',
        'order_grand_total_snapshot' => 'decimal:2',
        'projected_subtotal_reduction' => 'decimal:2',
        'projected_tax_reduction' => 'decimal:2',
        'projected_grand_total_reduction' => 'decimal:2',
        'projected_subtotal_addition' => 'decimal:2',
        'projected_tax_addition' => 'decimal:2',
        'projected_grand_total_addition' => 'decimal:2',
        'requested_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'applied_at' => 'datetime',
        'reversed_at' => 'datetime',
        'order_id' => 'integer',
        'requested_by' => 'integer',
        'reviewed_by' => 'integer',
        'cancelled_by' => 'integer',
        'reversed_by' => 'integer',
    ];

    /**
     * Get the order associated with this adjustment.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /**
     * Get the line items belonging to this adjustment.
     *
     * @return HasMany<OrderAdjustmentItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderAdjustmentItem::class, 'adjustment_id')->orderBy('id', 'asc');
    }

    /**
     * Get the user who requested this adjustment.
     *
     * @return BelongsTo<User, $this>
     */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /**
     * Get the administrative user who reviewed/approved/rejected this adjustment.
     *
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Get the user who cancelled/withdrew this adjustment.
     *
     * @return BelongsTo<User, $this>
     */
    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /**
     * Get the administrative user who reversed this applied adjustment.
     *
     * @return BelongsTo<User, $this>
     */
    public function reverser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reversed_by');
    }

    /**
     * Determine if this adjustment is in SUBMITTED status.
     */
    public function isSubmitted(): bool
    {
        return $this->status === OrderAdjustmentStatus::SUBMITTED;
    }

    /**
     * Determine if this adjustment is in REVERSED status.
     */
    public function isReversed(): bool
    {
        return $this->status === OrderAdjustmentStatus::REVERSED;
    }

    /**
     * Determine if this adjustment is in a terminal state.
     */
    public function isTerminal(): bool
    {
        return $this->status instanceof OrderAdjustmentStatus
            ? $this->status->isTerminal()
            : in_array($this->status, [OrderAdjustmentStatus::REJECTED->value, OrderAdjustmentStatus::CANCELLED->value, OrderAdjustmentStatus::REVERSED->value], true);
    }
}

