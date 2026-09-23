<?php

namespace App\Http\Requests\Product;

use App\DTOs\Product\ProductData;
use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\ProductStatus;
use App\Models\Product;
use App\Services\Auth\PermissionService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
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

        return $permissionService->has($user, Permission::PRODUCT_UPDATE);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Product|null $product */
        $product = $this->route('product');
        $productId = $product instanceof Product ? $product->id : $product;

        return [
            'sku' => ['required', 'string', 'max:50', Rule::unique('products', 'sku')->ignore($productId)],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('products', 'barcode')->ignore($productId)],
            'barcode_type' => ['nullable', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'tax_profile_id' => ['nullable', 'integer', 'exists:tax_profiles,id'],
            'unit' => ['required', 'string', 'max:30'],
            'status' => ['required', 'string', Rule::in(ProductStatus::values())],
            'cost_price' => ['required', 'regex:/^\d+(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99999999.99'],
            'minimum_allowed_price' => ['required', 'regex:/^\d+(\.\d{1,2})?$/', 'numeric', 'min:0.01', 'max:99999999.99'],
            'default_selling_price' => [
                'required',
                'regex:/^\d+(\.\d{1,2})?$/',
                'numeric',
                'min:0.01',
                'max:99999999.99',
                'gte:minimum_allowed_price',
                'lte:mrp',
            ],
            'mrp' => ['required', 'regex:/^\d+(\.\d{1,2})?$/', 'numeric', 'min:0.01', 'max:99999999.99', 'gte:default_selling_price'],
        ];
    }

    /**
     * Custom validation error messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'barcode.unique' => 'This barcode is already assigned to another product.',
            'default_selling_price.gte' => 'Default selling price cannot be less than the minimum allowed price.',
            'default_selling_price.lte' => 'Default selling price cannot exceed the MRP / list price.',
            'mrp.gte' => 'MRP / list price cannot be less than the default selling price.',
            'minimum_allowed_price.min' => 'Minimum allowed price must be greater than zero.',
            'cost_price.min' => 'Cost price cannot be negative.',
            'cost_price.regex' => 'Cost price must be a valid non-negative amount with at most 2 decimal places.',
            'minimum_allowed_price.regex' => 'Minimum allowed price must be a valid positive amount with at most 2 decimal places.',
            'default_selling_price.regex' => 'Default selling price must be a valid positive amount with at most 2 decimal places.',
            'mrp.regex' => 'MRP / list price must be a valid positive amount with at most 2 decimal places.',
        ];
    }

    /**
     * Prepare inputs for validation (trim whitespace and normalize SKU & barcode).
     */
    protected function prepareForValidation(): void
    {
        $sanitized = [];

        foreach ($this->all() as $key => $value) {
            if (is_string($value)) {
                $trimmed = trim($value);
                $sanitized[$key] = $trimmed === '' ? null : $trimmed;
            } elseif (is_numeric($value) && in_array($key, ['cost_price', 'minimum_allowed_price', 'default_selling_price', 'mrp'], true)) {
                $sanitized[$key] = (string) $value;
            } else {
                $sanitized[$key] = $value;
            }
        }

        if (isset($sanitized['sku']) && is_string($sanitized['sku'])) {
            $sanitized['sku'] = strtoupper(trim((string) $sanitized['sku']));
        }

        if (isset($sanitized['barcode']) && is_string($sanitized['barcode'])) {
            $normalizedBarcode = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', $sanitized['barcode']);
            $normalizedBarcode = trim((string) $normalizedBarcode);
            $sanitized['barcode'] = $normalizedBarcode === '' ? null : $normalizedBarcode;
        }

        $this->merge($sanitized);
    }

    /**
     * Convert validated request to DTO.
     */
    public function toDto(): ProductData
    {
        return ProductData::fromArray($this->validated());
    }
}
