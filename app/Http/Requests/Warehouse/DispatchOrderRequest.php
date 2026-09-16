<?php

namespace App\Http\Requests\Warehouse;

use App\Enums\Permission;
use Illuminate\Foundation\Http\FormRequest;

class DispatchOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->canPermission(Permission::ORDER_VIEW)
            || $this->user()?->canPermission(Permission::INVENTORY_VIEW)
            || $this->user()?->canPermission(Permission::DELIVERY_ASSIGN)
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
            'scheduled_date' => ['nullable', 'date'],
            'delivery_window' => ['nullable', 'string', 'max:100'],
            'driver_instructions' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
