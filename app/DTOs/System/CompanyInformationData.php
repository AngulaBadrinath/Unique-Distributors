<?php

namespace App\DTOs\System;

readonly class CompanyInformationData
{
    public function __construct(
        public string $legal_name,
        public ?string $dba_name,
        public string $address_line1,
        public ?string $address_line2,
        public string $city,
        public string $state,
        public string $postal_code,
        public string $country,
        public string $phone,
        public string $email,
        public ?string $website,
        public ?string $tax_id,
        public ?string $state_tax_id,
        public string $currency,
        public string $timezone,
        public ?string $invoice_footer_note,
        public ?bool $is_title_locked = null,
    ) {}

    /**
     * Build instance from validated array.
     *
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            legal_name: trim((string) ($data['legal_name'] ?? '')),
            dba_name: isset($data['dba_name']) && trim((string) $data['dba_name']) !== '' ? trim((string) $data['dba_name']) : null,
            address_line1: trim((string) ($data['address_line1'] ?? '')),
            address_line2: isset($data['address_line2']) && trim((string) $data['address_line2']) !== '' ? trim((string) $data['address_line2']) : null,
            city: trim((string) ($data['city'] ?? '')),
            state: trim((string) ($data['state'] ?? '')),
            postal_code: trim((string) ($data['postal_code'] ?? '')),
            country: strtoupper(trim((string) ($data['country'] ?? 'US'))),
            phone: trim((string) ($data['phone'] ?? '')),
            email: strtolower(trim((string) ($data['email'] ?? ''))),
            website: isset($data['website']) && trim((string) $data['website']) !== '' ? trim((string) $data['website']) : null,
            tax_id: isset($data['tax_id']) && trim((string) $data['tax_id']) !== '' ? trim((string) $data['tax_id']) : null,
            state_tax_id: isset($data['state_tax_id']) && trim((string) $data['state_tax_id']) !== '' ? trim((string) $data['state_tax_id']) : null,
            currency: strtoupper(trim((string) ($data['currency'] ?? 'USD'))),
            timezone: trim((string) ($data['timezone'] ?? 'America/New_York')),
            invoice_footer_note: isset($data['invoice_footer_note']) && trim((string) $data['invoice_footer_note']) !== '' ? trim((string) $data['invoice_footer_note']) : null,
            is_title_locked: isset($data['is_title_locked']) ? (bool) $data['is_title_locked'] : null,
        );
    }

    /**
     * Convert DTO to array for model persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $arr = [
            'legal_name' => $this->legal_name,
            'dba_name' => $this->dba_name,
            'address_line1' => $this->address_line1,
            'address_line2' => $this->address_line2,
            'city' => $this->city,
            'state' => $this->state,
            'postal_code' => $this->postal_code,
            'country' => $this->country,
            'phone' => $this->phone,
            'email' => $this->email,
            'website' => $this->website,
            'tax_id' => $this->tax_id,
            'state_tax_id' => $this->state_tax_id,
            'currency' => $this->currency,
            'timezone' => $this->timezone,
            'invoice_footer_note' => $this->invoice_footer_note,
        ];

        if ($this->is_title_locked !== null) {
            $arr['is_title_locked'] = $this->is_title_locked;
        }

        return $arr;
    }
}
