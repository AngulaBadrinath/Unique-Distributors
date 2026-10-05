<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'order_id',
        'product_id',
        'product_name_snapshot',
        'sku_snapshot',
        'unit_snapshot',
        'ordered_quantity',
        'cancelled_quantity',
        'increased_quantity',
        'reserved_quantity',
        'picked_quantity',
        'dispatched_quantity',
        'delivered_quantity',
        'returned_quantity',
        'unit_price',
        'is_price_overridden',
        'price_override_reason',
        'price_override_approved_by',
        'tax_profile_id',
        'tax_profile_code_snapshot',
        'tax_profile_name_snapshot',
        'tax_rate_snapshot',
        'taxable_amount',
        'tax_amount',
        'line_total',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'ordered_quantity' => 'integer',
        'cancelled_quantity' => 'integer',
        'increased_quantity' => 'integer',
        'reserved_quantity' => 'integer',
        'picked_quantity' => 'integer',
        'dispatched_quantity' => 'integer',
        'delivered_quantity' => 'integer',
        'returned_quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'is_price_overridden' => 'boolean',
        'tax_rate_snapshot' => 'decimal:4',
        'taxable_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'order_id' => 'integer',
        'product_id' => 'integer',
        'tax_profile_id' => 'integer',
        'price_override_approved_by' => 'integer',
    ];

    /**
     * Get the order that this line item belongs to.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /**
     * Get the product referenced by this line item.
     *
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * Get the tax profile referenced by this line item snapshot.
     *
     * @return BelongsTo<TaxProfile, $this>
     */
    public function taxProfile(): BelongsTo
    {
        return $this->belongsTo(TaxProfile::class, 'tax_profile_id');
    }

    /**
     * Get the user who authorized the price override, if any.
     *
     * @return BelongsTo<User, $this>
     */
    public function priceOverrideApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'price_override_approved_by');
    }

    /**
     * Get the discrete allocations for this line item.
     *
     * @return HasMany<OrderItemAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(OrderItemAllocation::class, 'order_item_id')->orderBy('id', 'asc');
    }

    /**
     * Get all adjustment item records referencing this order line.
     *
     * @return HasMany<OrderAdjustmentItem, $this>
     */
    public function adjustmentItems(): HasMany
    {
        return $this->hasMany(OrderAdjustmentItem::class, 'order_item_id')->orderBy('id', 'asc');
    }

    /**
     * Calculate current fulfillable quantity adhering to formal quantity delta conservation rule.
     * fulfillable_quantity = ordered_quantity + increased_quantity - cancelled_quantity
     */
    public function fulfillableQuantity(): int
    {
        return max(0, ($this->ordered_quantity + ($this->increased_quantity ?? 0)) - $this->cancelled_quantity);
    }

    /**
     * Calculate total quantity currently allocated across non-cancelled allocation records.
     */
    public function allocatedQuantity(): int
    {
        if ($this->relationLoaded('allocations')) {
            return (int) $this->allocations
                ->filter(function (OrderItemAllocation $a) {
                    $status = $a->status instanceof \App\Enums\AllocationStatus ? $a->status->value : (string) $a->status;
                    return ! in_array($status, [\App\Enums\AllocationStatus::CANCELLED->value, \App\Enums\AllocationStatus::RELEASED->value], true);
                })
                ->sum('allocated_quantity');
        }

        return (int) $this->allocations()
            ->whereNotIn('status', [\App\Enums\AllocationStatus::CANCELLED->value, \App\Enums\AllocationStatus::RELEASED->value])
            ->sum('allocated_quantity');
    }

    /**
     * Calculate unallocated fulfillable quantity remaining for this item.
     * Invariant: unallocated_quantity = fulfillable_quantity - allocated_quantity
     */
    public function unallocatedQuantity(): int
    {
        return max(0, $this->fulfillableQuantity() - $this->allocatedQuantity());
    }

    /**
     * Determine if an additional quantity can be legally allocated without exceeding fulfillable quantity.
     */
    public function canAllocate(int $quantity): bool
    {
        if ($quantity <= 0) {
            return false;
        }

        return $quantity <= $this->unallocatedQuantity();
    }

    /**
     * Determine if fulfillable quantity can be reduced by a proposed quantity without violating active allocations.
     * Invariant: reduction <= unallocated_quantity
     */
    public function canReduceFulfillableQuantity(int $reductionQuantity): bool
    {
        if ($reductionQuantity <= 0) {
            return false;
        }

        return $reductionQuantity <= $this->unallocatedQuantity();
    }
}

