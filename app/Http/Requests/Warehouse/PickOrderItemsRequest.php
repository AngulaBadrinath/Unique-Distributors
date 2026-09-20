<?php

namespace App\Http\Requests\Warehouse;

use App\Enums\Permission;
use Illuminate\Foundation\Http\FormRequest;

class PickOrderItemsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->canPermission(Permission::INVENTORY_VIEW)
            || $this->user()?->canPermission(Permission::INVENTORY_ADJUST)
            ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'items' => ['nullable', 'array'],
            'items.*.order_item_id' => ['required_with:items', 'integer'],
            'items.*.picked_quantity' => ['required_with:items', 'integer', 'min:0'],
        ];
    }
}
