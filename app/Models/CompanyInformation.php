<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyInformation extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'company_information';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'legal_name',
        'dba_name',
        'address_line1',
        'address_line2',
        'city',
        'state',
        'postal_code',
        'country',
        'phone',
        'email',
        'website',
        'tax_id',
        'state_tax_id',
        'currency',
        'timezone',
        'invoice_footer_note',
        'is_singleton',
        'is_title_locked',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_singleton' => 'boolean',
        'is_title_locked' => 'boolean',
    ];

    /**
     * Get the formatted multi-line physical address.
     */
    public function formattedAddress(): string
    {
        $lines = array_filter([
            $this->address_line1,
            $this->address_line2,
            trim("{$this->city}, {$this->state} {$this->postal_code}"),
            $this->country,
        ]);

        return implode("\n", $lines);
    }

    /**
     * Transform the model into a safe array for frontend presentation.
     * Sensitive fields or internal columns are formatted safely.
     *
     * @return array<string, mixed>
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'legal_name' => $this->legal_name,
            'dba_name' => $this->dba_name,
            'display_name' => $this->dba_name ?: $this->legal_name,
            'address_line1' => $this->address_line1,
            'address_line2' => $this->address_line2,
            'city' => $this->city,
            'state' => $this->state,
            'postal_code' => $this->postal_code,
            'country' => $this->country,
            'formatted_address' => $this->formattedAddress(),
            'phone' => $this->phone,
            'email' => $this->email,
            'website' => $this->website,
            'tax_id' => $this->tax_id,
            'state_tax_id' => $this->state_tax_id,
            'currency' => $this->currency,
            'timezone' => $this->timezone,
            'invoice_footer_note' => $this->invoice_footer_note,
            'is_title_locked' => (bool) ($this->is_title_locked ?? true),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
