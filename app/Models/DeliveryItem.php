<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryItem extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'delivery_items';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'delivery_id',
        'order_item_id',
        'order_item_allocation_id',
        'product_id',
        'product_name_snapshot',
        'sku_snapshot',
        'deliverable_quantity',
        'delivered_quantity',
        'returned_quantity',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected function casts(): array
    {
        return [
            'deliverable_quantity' => 'integer',
            'delivered_quantity' => 'integer',
            'returned_quantity' => 'integer',
        ];
    }

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'primary_image_url',
    ];

    /**
     * Get the primary image temporary URL when product with primaryImage relation is loaded.
     */
    public function getPrimaryImageUrlAttribute(): ?string
    {
        if ($this->relationLoaded('product') && $this->product) {
            return $this->product->primary_image_url;
        }

        return null;
    }

    /**
     * Get the delivery parent.
     */
    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class, 'delivery_id');
    }

    /**
     * Get the referenced order item.
     */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    /**
     * Get the referenced order item allocation.
     */
    public function allocation(): BelongsTo
    {
        return $this->belongsTo(OrderItemAllocation::class, 'order_item_allocation_id');
    }

    /**
     * Get the referenced product.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
