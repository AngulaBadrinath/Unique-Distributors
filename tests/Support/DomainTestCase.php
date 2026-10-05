<?php

namespace Tests\Support;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

abstract class DomainTestCase extends TestCase
{
    use RefreshDatabase;

    /**
     * Assert two monetary amounts are equal to 2 decimal places.
     */
    protected function assertMoneyEquals(float|string $expected, float|string $actual, string $message = ''): void
    {
        $this->assertEqualsWithDelta((float) $expected, (float) $actual, 0.001, $message);
    }

    /**
     * Assert that debits equal credits.
     */
    protected function assertBalanced(float|string $debits, float|string $credits, string $message = 'Debits must equal credits'): void
    {
        $this->assertEqualsWithDelta((float) $debits, (float) $credits, 0.001, $message);
    }
}
