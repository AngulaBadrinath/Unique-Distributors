<?php

namespace App\Http\Requests\Customer;

use App\DTOs\Customer\CustomerData;
use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\PaymentTerms;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Services\Auth\PermissionService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
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

        return $permissionService->has($user, Permission::CUSTOMER_CREATE);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:32', 'unique:customers,code'],
            'name' => ['required', 'string', 'max:255'],
            'contact_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'billing_address_line1' => ['required', 'string', 'max:255'],
            'billing_address_line2' => ['nullable', 'string', 'max:255'],
            'billing_city' => ['required', 'string', 'max:100'],
            'billing_state' => ['required', 'string', 'max:100'],
            'billing_postal_code' => ['required', 'string', 'max:20'],
            'billing_country' => ['required', 'string', 'size:2'],
            'shipping_address_line1' => ['nullable', 'string', 'max:255'],
            'shipping_address_line2' => ['nullable', 'string', 'max:255'],
            'shipping_city' => ['nullable', 'string', 'max:100'],
            'shipping_state' => ['nullable', 'string', 'max:100'],
            'shipping_postal_code' => ['nullable', 'string', 'max:20'],
            'shipping_country' => ['nullable', 'string', 'size:2'],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'credit_limit' => ['required', 'numeric', 'min:0', 'max:999999999.99'],
            'payment_terms' => ['required', 'string', Rule::in(PaymentTerms::values())],
            'status' => ['required', 'string', Rule::in(CustomerStatus::values())],
            'notes' => ['nullable', 'string', 'max:2000'],
            'salesman_id' => ['nullable', 'integer'],
        ];
    }

    /**
     * Prepare inputs for validation (trim whitespace and enforce salesman ownership).
     */
    protected function prepareForValidation(): void
    {
        $sanitized = [];

        foreach ($this->all() as $key => $value) {
            if (is_string($value)) {
                $trimmed = trim($value);
                $sanitized[$key] = $trimmed === '' ? null : $trimmed;
            } else {
                $sanitized[$key] = $value;
            }
        }

        if ($this->user()?->role === UserRole::SALESMAN) {
            $sanitized['salesman_id'] = $this->user()->id;
        }

        $this->merge($sanitized);
    }

    /**
     * Convert validated request to DTO.
     */
    public function toDto(): CustomerData
    {
        $validated = $this->validated();
        if ($this->user()?->role === UserRole::SALESMAN) {
            $validated['salesman_id'] = $this->user()->id;
        }

        return CustomerData::fromArray($validated);
    }
}
