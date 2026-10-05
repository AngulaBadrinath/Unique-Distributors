<?php

namespace Tests\Domain;

use App\Models\OrderItem;
use Tests\Support\DomainTestCase;

class AllocationMathTest extends DomainTestCase
{
    /**
     * RULE-DOM-001: ordered_quantity is non-destructive and conserved.
     * ordered_quantity = cancelled_quantity + fulfillable_quantity
     */
    public function test_ordered_quantity_is_conserved_upon_cancellation(): void
    {
        $item = new OrderItem([
            'ordered_quantity' => 10,
            'cancelled_quantity' => 2,
            'reserved_quantity' => 8,
            'picked_quantity' => 0,
            'dispatched_quantity' => 0,
            'delivered_quantity' => 0,
        ]);

        $this->assertEquals(10, $item->ordered_quantity);
        $this->assertEquals(2, $item->cancelled_quantity);
        $this->assertEquals(8, $item->fulfillableQuantity());
    }

    /**
     * Complete cancellation conserves ordered_quantity while fulfillable becomes zero.
     */
    public function test_complete_cancellation_preserves_historical_ordered_quantity(): void
    {
        $item = new OrderItem([
            'ordered_quantity' => 25,
            'cancelled_quantity' => 25,
            'reserved_quantity' => 0,
        ]);

        $this->assertEquals(25, $item->ordered_quantity);
        $this->assertEquals(25, $item->cancelled_quantity);
        $this->assertEquals(0, $item->fulfillableQuantity());
    }

    /**
     * Fulfillable quantity cannot be negative even if cancelled exceeds ordered.
     */
    public function test_fulfillable_quantity_never_negative(): void
    {
        $item = new OrderItem([
            'ordered_quantity' => 5,
            'cancelled_quantity' => 6,
        ]);

        $this->assertEquals(0, $item->fulfillableQuantity());
    }
}
