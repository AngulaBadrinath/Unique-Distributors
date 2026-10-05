<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderAdjustmentItem extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'order_adjustment_items';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'adjustment_id',
        'order_item_id',
        'product_id',
        'product_name_snapshot',
        'sku_snapshot',
        'unit_price_snapshot',
        'tax_rate_snapshot',
        'tax_profile_code_snapshot',
        'ordered_quantity_snapshot',
        'cancelled_quantity_snapshot',
        'fulfillable_quantity_snapshot',
        'allocated_quantity_snapshot',
        'unallocated_quantity_snapshot',
        'action_type',
        'requested_quantity_reduction',
        'requested_quantity_increase',
        'requested_quantity_delta',
        'projected_fulfillable_quantity',
        'projected_cancelled_quantity',
        'affected_allocation_quantity',
        'projected_taxable_amount_reduction',
        'projected_tax_amount_reduction',
        'projected_line_total_reduction',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'unit_price_snapshot' => 'decimal:2',
        'tax_rate_snapshot' => 'decimal:4',
        'ordered_quantity_snapshot' => 'integer',
        'cancelled_quantity_snapshot' => 'integer',
        'fulfillable_quantity_snapshot' => 'integer',
        'allocated_quantity_snapshot' => 'integer',
        'unallocated_quantity_snapshot' => 'integer',
        'requested_quantity_reduction' => 'integer',
        'requested_quantity_increase' => 'integer',
        'requested_quantity_delta' => 'integer',
        'projected_fulfillable_quantity' => 'integer',
        'projected_cancelled_quantity' => 'integer',
        'affected_allocation_quantity' => 'integer',
        'projected_taxable_amount_reduction' => 'decimal:2',
        'projected_tax_amount_reduction' => 'decimal:2',
        'projected_line_total_reduction' => 'decimal:2',
        'adjustment_id' => 'integer',
        'order_item_id' => 'integer',
        'product_id' => 'integer',
    ];

    /**
     * Get the adjustment that this line item belongs to.
     *
     * @return BelongsTo<OrderAdjustment, $this>
     */
    public function adjustment(): BelongsTo
    {
        return $this->belongsTo(OrderAdjustment::class, 'adjustment_id');
    }

    /**
     * Get the original order line item referenced by this adjustment item.
     *
     * @return BelongsTo<OrderItem, $this>
     */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    /**
     * Get the product referenced by this adjustment item.
     *
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
