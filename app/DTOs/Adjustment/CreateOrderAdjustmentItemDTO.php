<?php

namespace App\DTOs\Adjustment;

class CreateOrderAdjustmentItemDTO
{
    public function __construct(
        public readonly int $orderItemId,
        public readonly int $reductionQuantity = 0,
        public readonly int $increaseQuantity = 0,
        public readonly string $actionType = 'DECREASE',
    ) {}

    /**
     * Get the signed integer delta for this item adjustment.
     * DECREASE = -reductionQuantity, INCREASE = +increaseQuantity.
     */
    public function quantityDelta(): int
    {
        return $this->actionType === 'INCREASE'
            ? $this->increaseQuantity
            : -$this->reductionQuantity;
    }

    /**
     * Build instance from validated array.
     *
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $rawAction = strtoupper(trim((string) ($data['action_type'] ?? '')));
        $reduction = (int) ($data['reduction_quantity'] ?? $data['requested_quantity_reduction'] ?? 0);
        $increase = (int) ($data['increase_quantity'] ?? $data['requested_quantity_increase'] ?? 0);
        $genericQty = (int) ($data['quantity'] ?? 0);

        if ($rawAction === 'INCREASE') {
            $actionType = 'INCREASE';
            $increaseQuantity = $increase > 0 ? $increase : $genericQty;
            $reductionQuantity = 0;
        } elseif ($rawAction === 'DECREASE') {
            $actionType = 'DECREASE';
            $reductionQuantity = $reduction > 0 ? $reduction : $genericQty;
            $increaseQuantity = 0;
        } else {
            // Auto-detect based on provided fields
            if ($increase > 0) {
                $actionType = 'INCREASE';
                $increaseQuantity = $increase;
                $reductionQuantity = 0;
            } else {
                $actionType = 'DECREASE';
                $reductionQuantity = $reduction > 0 ? $reduction : $genericQty;
                $increaseQuantity = 0;
            }
        }

        return new self(
            orderItemId: (int) $data['order_item_id'],
            reductionQuantity: $reductionQuantity,
            increaseQuantity: $increaseQuantity,
            actionType: $actionType,
        );
    }
}
