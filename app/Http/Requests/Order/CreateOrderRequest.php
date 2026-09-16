<?php

namespace App\Http\Requests\Order;

use App\DTOs\Order\CreateOrderDTO;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class CreateOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authoritative domain authorization is executed in OrderPolicy and OrderService
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'idempotency_key' => ['required', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999999'],
            'items.*.unit_price' => ['nullable', 'string', 'regex:/^\d+(\.\d{1,2})?$/'],

            // Optional Payment Recording Fields
            'payment_method' => ['nullable', 'string', 'in:CASH,CHEQUE,MONEY_ORDER'],
            'payment_amount' => ['required_with:payment_method', 'nullable', 'numeric', 'min:0.01', 'max:999999999.99'],
            'payment_date' => ['required_with:payment_method', 'nullable', 'date', 'date_format:Y-m-d', 'before_or_equal:today'],
            'bank_name' => ['required_if:payment_method,CHEQUE', 'nullable', 'string', 'max:100'],
            'cheque_number' => ['required_if:payment_method,CHEQUE', 'nullable', 'string', 'max:50'],
            'cheque_date' => ['required_if:payment_method,CHEQUE', 'nullable', 'date', 'date_format:Y-m-d'],
            'issuer_name' => ['required_if:payment_method,MONEY_ORDER', 'nullable', 'string', 'max:100'],
            'money_order_number' => ['required_if:payment_method,MONEY_ORDER', 'nullable', 'string', 'max:50'],
            'receipt_reference' => ['nullable', 'string', 'max:100'],
            'payment_notes' => ['nullable', 'string', 'max:1000'],
            'payment_evidence' => ['nullable', 'file'],

            // Nested payment object support (if sent as JSON)
            'payment' => ['nullable', 'array'],
            'payment.method' => ['nullable', 'string', 'in:CASH,CHEQUE,MONEY_ORDER'],
            'payment.amount' => ['required_with:payment.method', 'nullable', 'numeric', 'min:0.01', 'max:999999999.99'],
            'payment.payment_date' => ['required_with:payment.method', 'nullable', 'date', 'date_format:Y-m-d', 'before_or_equal:today'],
            'payment.bank_name' => ['required_if:payment.method,CHEQUE', 'nullable', 'string', 'max:100'],
            'payment.cheque_number' => ['required_if:payment.method,CHEQUE', 'nullable', 'string', 'max:50'],
            'payment.cheque_date' => ['required_if:payment.method,CHEQUE', 'nullable', 'date', 'date_format:Y-m-d'],
            'payment.issuer_name' => ['required_if:payment.method,MONEY_ORDER', 'nullable', 'string', 'max:100'],
            'payment.money_order_number' => ['required_if:payment.method,MONEY_ORDER', 'nullable', 'string', 'max:50'],
            'payment.receipt_reference' => ['nullable', 'string', 'max:100'],
            'payment.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Custom validation messages for commercial clarity.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'customer_id.required' => 'Please select a customer for this order.',
            'idempotency_key.required' => 'An idempotency key is required to prevent duplicate order submissions.',
            'items.required' => 'An order must contain at least one product line item.',
            'items.min' => 'An order must contain at least one product line item.',
            'items.*.product_id.required' => 'Each line item must reference a valid product.',
            'items.*.quantity.required' => 'Please specify a quantity for each line item.',
            'items.*.quantity.min' => 'Ordered quantity must be at least 1.',
            'items.*.quantity.max' => 'Ordered quantity cannot exceed 999,999.',
            'items.*.quantity.integer' => 'Ordered quantity must be a whole number.',
            'items.*.unit_price.regex' => 'Unit price must be a valid monetary decimal with up to 2 decimal places.',
            'payment_amount.min' => 'Payment amount must be greater than zero.',
            'payment_date.before_or_equal' => 'Payment date cannot be in the future.',
            'bank_name.required_if' => 'Bank name is required for cheque payments.',
            'cheque_number.required_if' => 'Cheque number is required for cheque payments.',
            'cheque_date.required_if' => 'Cheque date is required for cheque payments.',
            'issuer_name.required_if' => 'Issuer name is required for money order payments.',
            'money_order_number.required_if' => 'Money order number is required for money order payments.',
        ];
    }

    /**
     * Retrieve normalized payment payload if present.
     *
     * @return array<string, mixed>|null
     */
    public function getPaymentPayload(): ?array
    {
        $method = $this->input('payment_method') ?? $this->input('payment.method');

        if (! $method) {
            return null;
        }

        return [
            'method' => strtoupper($method),
            'amount' => (float) ($this->input('payment_amount') ?? $this->input('payment.amount') ?? 0),
            'payment_date' => $this->input('payment_date') ?? $this->input('payment.payment_date') ?? now()->toDateString(),
            'bank_name' => $this->input('bank_name') ?? $this->input('payment.bank_name'),
            'cheque_number' => $this->input('cheque_number') ?? $this->input('payment.cheque_number'),
            'cheque_date' => $this->input('cheque_date') ?? $this->input('payment.cheque_date'),
            'issuer_name' => $this->input('issuer_name') ?? $this->input('payment.issuer_name'),
            'money_order_number' => $this->input('money_order_number') ?? $this->input('payment.money_order_number'),
            'receipt_reference' => $this->input('receipt_reference') ?? $this->input('payment.receipt_reference'),
            'notes' => $this->input('payment_notes') ?? $this->input('payment.notes'),
        ];
    }

    /**
     * Retrieve payment evidence file if provided.
     */
    public function getPaymentEvidence(): ?UploadedFile
    {
        return $this->file('payment_evidence') ?? $this->file('evidence') ?? $this->file('payment.evidence');
    }

    /**
     * Build the strongly-typed CreateOrderDTO from validated data.
     */
    public function toDTO(): CreateOrderDTO
    {
        return CreateOrderDTO::fromArray($this->validated());
    }
}

