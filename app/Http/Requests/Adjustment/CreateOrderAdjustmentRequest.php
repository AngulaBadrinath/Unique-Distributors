<?php

namespace App\Http\Requests\Adjustment;

use App\Enums\AdjustmentReasonCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateOrderAdjustmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authoritative domain authorization is enforced in PermissionService and OrderAdjustmentService
    }

    /**
     * Prepare data for validation by trimming strings.
     */
    protected function prepareForValidation(): void
    {
        $items = $this->items;
        if (is_array($items)) {
            foreach ($items as $idx => $item) {
                if (is_array($item)) {
                    $actionType = strtoupper(trim((string) ($item['action_type'] ?? '')));
                    if ($actionType === 'INCREASE') {
                        if (isset($item['requested_quantity_increase']) && ! isset($item['increase_quantity'])) {
                            $items[$idx]['increase_quantity'] = $item['requested_quantity_increase'];
                        } elseif (isset($item['increase_quantity']) && ! isset($item['requested_quantity_increase'])) {
                            $items[$idx]['requested_quantity_increase'] = $item['increase_quantity'];
                        } elseif (isset($item['quantity']) && ! isset($item['increase_quantity'])) {
                            $items[$idx]['increase_quantity'] = $item['quantity'];
                            $items[$idx]['requested_quantity_increase'] = $item['quantity'];
                        }
                    } else {
                        // DECREASE default / legacy
                        if (isset($item['requested_quantity_reduction']) && ! isset($item['reduction_quantity'])) {
                            $items[$idx]['reduction_quantity'] = $item['requested_quantity_reduction'];
                        } elseif (isset($item['reduction_quantity']) && ! isset($item['requested_quantity_reduction'])) {
                            $items[$idx]['requested_quantity_reduction'] = $item['reduction_quantity'];
                        } elseif (isset($item['quantity']) && ! isset($item['reduction_quantity'])) {
                            $items[$idx]['reduction_quantity'] = $item['quantity'];
                            $items[$idx]['requested_quantity_reduction'] = $item['quantity'];
                        }
                    }
                }
            }
        }

        $this->merge([
            'notes' => is_string($this->notes) ? trim($this->notes) : $this->notes,
            'reason_code' => is_string($this->reason_code) ? trim($this->reason_code) : $this->reason_code,
            'idempotency_key' => is_string($this->idempotency_key) ? trim($this->idempotency_key) : $this->idempotency_key,
            'items' => $items,
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason_code' => ['required', 'string', Rule::in(AdjustmentReasonCode::values())],
            'notes' => ['nullable', 'string', 'max:2000'],
            'idempotency_key' => ['required', 'string', 'max:64'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'items.*.action_type' => ['nullable', 'string', Rule::in(['DECREASE', 'INCREASE'])],
            'items.*.reduction_quantity' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'items.*.requested_quantity_reduction' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'items.*.increase_quantity' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'items.*.requested_quantity_increase' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:999999'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(\Illuminate\Validation\Validator $validator): void
    {
        $validator->after(function ($validator) {
            $items = $this->input('items', []);
            if (is_array($items)) {
                foreach ($items as $idx => $item) {
                    $actionType = strtoupper(trim((string) ($item['action_type'] ?? 'DECREASE')));
                    if ($actionType === 'INCREASE') {
                        $inc = (int) ($item['increase_quantity'] ?? $item['requested_quantity_increase'] ?? $item['quantity'] ?? 0);
                        if ($inc <= 0) {
                            $validator->errors()->add("items.{$idx}.increase_quantity", 'Increase quantity must be at least 1 unit.');
                        }
                    } else {
                        $red = (int) ($item['reduction_quantity'] ?? $item['requested_quantity_reduction'] ?? $item['quantity'] ?? 0);
                        if ($red <= 0) {
                            $validator->errors()->add("items.{$idx}.reduction_quantity", 'Reduction quantity must be at least 1 unit.');
                        }
                    }
                }
            }
        });
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'reason_code' => 'adjustment reason',
            'notes' => 'adjustment notes',
            'idempotency_key' => 'idempotency key',
            'items' => 'adjusted items',
            'items.*.order_item_id' => 'line item',
            'items.*.reduction_quantity' => 'reduction quantity',
            'items.*.increase_quantity' => 'increase quantity',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason_code.in' => 'The selected adjustment reason is invalid.',
            'notes.min' => 'Adjustment notes must be at least 5 characters.',
            'notes.max' => 'Adjustment notes may not exceed 2000 characters.',
            'items.required' => 'At least one line item must be selected for adjustment.',
            'items.*.reduction_quantity.min' => 'Reduction quantity must be at least 1 unit.',
            'items.*.increase_quantity.min' => 'Increase quantity must be at least 1 unit.',
        ];
    }
}
