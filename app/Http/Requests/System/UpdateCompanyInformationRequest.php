<?php

namespace App\Http\Requests\System;

use App\DTOs\System\CompanyInformationData;
use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Services\Auth\PermissionService;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCompanyInformationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(PermissionService $permissionService): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        $isActive = ($user->status instanceof AccountStatus)
            ? $user->status === AccountStatus::ACTIVE
            : $user->status === AccountStatus::ACTIVE->value;

        if (! $isActive) {
            return false;
        }

        return $permissionService->has($user, Permission::ROLE_MANAGE);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'legal_name' => ['required', 'string', 'max:255'],
            'dba_name' => ['nullable', 'string', 'max:255'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'postal_code' => ['required', 'string', 'max:20'],
            'country' => ['required', 'string', 'size:2'],
            'phone' => ['required', 'string', 'max:50'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'website' => [
                'nullable',
                'string',
                'url',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value && ! preg_match('/^https?:\/\//i', (string) $value)) {
                        $fail('The website URL must use http:// or https:// protocol.');
                    }
                },
            ],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'state_tax_id' => ['nullable', 'string', 'max:50'],
            'currency' => ['required', 'string', 'size:3'],
            'timezone' => ['required', 'string', 'max:50', 'timezone'],
            'invoice_footer_note' => ['nullable', 'string', 'max:500'],
            'is_title_locked' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Prepare inputs for validation (trim whitespace).
     */
    protected function prepareForValidation(): void
    {
        $sanitized = [];

        foreach ($this->all() as $key => $value) {
            if ($key === 'is_title_locked') {
                $sanitized[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            } elseif (is_string($value)) {
                $trimmed = trim($value);
                $sanitized[$key] = $trimmed === '' ? null : $trimmed;
            } else {
                $sanitized[$key] = $value;
            }
        }

        $this->merge($sanitized);
    }

    /**
     * Convert validated request to DTO.
     */
    public function toDto(): CompanyInformationData
    {
        return CompanyInformationData::fromArray($this->validated());
    }
}
