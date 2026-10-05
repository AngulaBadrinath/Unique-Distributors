<?php

namespace Tests\Domain;

use App\Services\Tax\TaxCalculationService;
use Illuminate\Validation\ValidationException;
use Tests\Support\DomainTestCase;

class TaxCalculationTest extends DomainTestCase
{
    /**
     * RULE-TAX-001: Normalize rate strictly requires valid numeric decimal format up to 4 decimal places.
     */
    public function test_normalize_rate_valid_scales(): void
    {
        $this->assertEquals('7.0000', TaxCalculationService::normalizeRate('7'));
        $this->assertEquals('7.5000', TaxCalculationService::normalizeRate('7.5'));
        $this->assertEquals('7.2500', TaxCalculationService::normalizeRate('7.25'));
        $this->assertEquals('8.8750', TaxCalculationService::normalizeRate('8.875'));
        $this->assertEquals('10.1234', TaxCalculationService::normalizeRate('10.1234'));
        $this->assertEquals('0.0000', TaxCalculationService::normalizeRate(null));
        $this->assertEquals('0.0000', TaxCalculationService::normalizeRate(''));
    }

    /**
     * Rates with more than 4 decimal places are strictly rejected.
     */
    public function test_normalize_rate_rejects_excess_decimals(): void
    {
        $this->expectException(ValidationException::class);
        TaxCalculationService::normalizeRate('8.12345');
    }

    /**
     * Negative rates are strictly rejected.
     */
    public function test_normalize_rate_rejects_negative_rate(): void
    {
        $this->expectException(ValidationException::class);
        TaxCalculationService::normalizeRate('-5.0000');
    }

    /**
     * Rates exceeding 100% are strictly rejected.
     */
    public function test_normalize_rate_rejects_rate_over_100_percent(): void
    {
        $this->expectException(ValidationException::class);
        TaxCalculationService::normalizeRate('100.0001');
    }

    /**
     * Deterministic arbitrary-precision ROUND_HALF_UP rounding.
     */
    public function test_round_half_up_financial_precision(): void
    {
        $this->assertEquals('10.55', TaxCalculationService::roundHalfUp('10.545', 2));
        $this->assertEquals('10.54', TaxCalculationService::roundHalfUp('10.544', 2));
        $this->assertEquals('10.55', TaxCalculationService::roundHalfUp('10.546', 2));
        $this->assertEquals('100.00', TaxCalculationService::roundHalfUp('99.999', 2));
    }
}
