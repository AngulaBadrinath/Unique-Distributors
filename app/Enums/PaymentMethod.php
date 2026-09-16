<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case CASH = 'CASH';
    case CHEQUE = 'CHEQUE';
    case MONEY_ORDER = 'MONEY_ORDER';

    /**
     * Get the human-readable label for the payment method.
     */
    public function label(): string
    {
        return match ($this) {
            self::CASH => 'Cash',
            self::CHEQUE => 'Cheque',
            self::MONEY_ORDER => 'Money Order',
        };
    }

    /**
     * Determine whether this payment method mandates visual evidence upload.
     * Updated per client requirement: image upload is no longer mandatory for any payment method.
     */
    public function requiresEvidence(): bool
    {
        return false;
    }

    /**
     * Badge visual variant for UI presentation.
     */
    public function badgeVariant(): string
    {
        return match ($this) {
            self::CASH => 'success',
            self::CHEQUE => 'indigo',
            self::MONEY_ORDER => 'warning',
        };
    }

    /**
     * Return all enum string values.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
