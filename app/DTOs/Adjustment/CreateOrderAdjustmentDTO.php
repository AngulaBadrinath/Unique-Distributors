<?php

namespace App\DTOs\Adjustment;

class CreateOrderAdjustmentDTO
{
    /**
     * @param  array<int, CreateOrderAdjustmentItemDTO>  $items
     */
    public function __construct(
        public readonly int $orderId,
        public readonly string $reasonCode,
        public readonly string $notes,
        public readonly string $idempotencyKey,
        public readonly array $items = [],
    ) {}

    /**
     * Build instance from validated array data.
     *
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data, int $orderId): self
    {
        $items = array_map(
            fn (array $item) => CreateOrderAdjustmentItemDTO::fromArray($item),
            $data['items'] ?? []
        );

        return new self(
            orderId: $orderId,
            reasonCode: trim((string) ($data['reason_code'] ?? '')),
            notes: trim((string) ($data['notes'] ?? '')),
            idempotencyKey: trim((string) ($data['idempotency_key'] ?? '')),
            items: $items,
        );
    }

    /**
     * Generate a deterministic canonical hash fingerprint of the client command intent.
     * Used for idempotency payload mismatch (409 Conflict) detection.
     */
    public function canonicalFingerprint(): string
    {
        $canonicalItems = array_map(
            fn (CreateOrderAdjustmentItemDTO $item) => [
                'order_item_id' => $item->orderItemId,
                'action_type' => $item->actionType,
                'reduction_quantity' => $item->reductionQuantity,
                'increase_quantity' => $item->increaseQuantity,
                'quantity_delta' => $item->quantityDelta(),
            ],
            $this->items
        );

        // Sort items by order_item_id ascending for deterministic hash
        usort($canonicalItems, fn ($a, $b) => $a['order_item_id'] <=> $b['order_item_id']);

        $canonicalStructure = [
            'order_id' => $this->orderId,
            'reason_code' => $this->reasonCode,
            'notes' => $this->notes,
            'items' => $canonicalItems,
        ];

        return hash('sha256', (string) json_encode($canonicalStructure, JSON_THROW_ON_ERROR));
    }
}
