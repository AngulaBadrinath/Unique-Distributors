<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tax Invoice - {{ $invoice->invoice_number }}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
        }

        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #111827;
            background-color: #ffffff;
            font-size: 9.5px;
            line-height: 1.28;
            padding: 16px;
        }

        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
        }

        /* Header */
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 8px;
            margin-bottom: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .company-identity h1 {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
        }

        .company-dba {
            font-size: 10px;
            font-weight: 600;
            color: #475569;
            margin-bottom: 3px;
        }

        .company-details {
            font-size: 8.5px;
            color: #475569;
            line-height: 1.25;
        }

        .document-title {
            text-align: right;
        }

        .document-title h2 {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
        }

        .document-meta-table {
            border-collapse: collapse;
            margin-left: auto;
            font-size: 8.5px;
        }

        .document-meta-table td {
            padding: 1px 4px;
        }

        .document-meta-table .meta-label {
            font-weight: 600;
            color: #64748b;
            text-align: right;
        }

        .document-meta-table .meta-value {
            font-weight: 700;
            color: #0f172a;
            text-align: left;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        /* Addresses Grid */
        .address-grid {
            display: flex;
            gap: 10px;
            margin-bottom: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .address-card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px 10px;
        }

        .address-card-title {
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.4px;
            margin-bottom: 3px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 2px;
        }

        .customer-name {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 2px;
        }

        .address-lines {
            font-size: 8.5px;
            color: #334155;
            line-height: 1.25;
        }

        /* Items Table */
        .table-responsive {
            width: 100%;
            margin-bottom: 8px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }

        .items-table thead {
            display: table-header-group;
        }

        .items-table th {
            background-color: #1e293b;
            color: #ffffff;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            padding: 4px 6px;
            text-align: left;
        }

        .items-table th.text-right {
            text-align: right;
        }

        .items-table th.text-center {
            text-align: center;
        }

        .items-table tbody tr {
            border-bottom: 1px solid #e2e8f0;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .items-table tbody tr:nth-child(even) {
            background-color: #f8fafc;
        }

        .items-table td {
            padding: 3.5px 6px;
            font-size: 9px;
            color: #1e293b;
            vertical-align: middle;
            line-height: 1.22;
        }

        .items-table td.text-right {
            text-align: right;
        }

        .items-table td.text-center {
            text-align: center;
        }

        .items-table td.mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .item-sku {
            font-weight: 700;
            color: #0f172a;
            font-size: 8.5px;
        }

        .item-name {
            font-weight: 600;
            color: #334155;
        }

        /* Summary Grid */
        .summary-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .payment-remittance {
            flex: 1;
        }

        .payment-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px 8px;
            margin-bottom: 6px;
        }

        .payment-box h3 {
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            color: #475569;
            margin-bottom: 2px;
        }

        .payment-box p {
            font-size: 8.5px;
            color: #334155;
            line-height: 1.25;
        }

        .totals-card {
            width: 250px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            overflow: hidden;
        }

        .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }

        .totals-table td {
            padding: 2.5px 8px;
        }

        .totals-table tr:not(:last-child) td {
            border-bottom: 1px solid #f1f5f9;
        }

        .totals-table .total-label {
            color: #64748b;
            font-weight: 600;
        }

        .totals-table .total-value {
            text-align: right;
            font-weight: 700;
            color: #0f172a;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .totals-table tr.grand-total {
            background-color: #1e293b;
        }

        .totals-table tr.grand-total td {
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 8px;
        }

        .totals-table tr.grand-total .total-value {
            color: #ffffff;
        }

        .totals-table tr.due-total {
            background-color: #fef2f2;
        }

        .totals-table tr.due-total td {
            font-size: 9.5px;
            font-weight: 800;
            color: #991b1b;
        }

        /* Footer */
        .invoice-footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
            font-size: 8px;
            color: #64748b;
            text-align: center;
            line-height: 1.3;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .no-print-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #ffffff;
            padding: 8px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            z-index: 1000;
        }

        .no-print-bar .btn {
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 5px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }

        .no-print-bar .btn:hover {
            background: #1d4ed8;
        }

        .no-print-bar .btn-secondary {
            background: #334155;
            margin-right: 8px;
        }

        @media screen {
            body {
                padding-top: 50px;
                background-color: #f1f5f9;
            }
            .invoice-container {
                background: #ffffff;
                padding: 24px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            }
        }

        @media screen and (max-width: 640px) {
            body {
                padding-top: 70px;
            }
            .invoice-container {
                padding: 12px;
                margin: 6px auto;
            }
            .invoice-header {
                flex-direction: column;
                gap: 10px;
            }
            .document-title {
                text-align: left;
            }
            .document-meta-table {
                margin-left: 0;
            }
            .address-grid {
                flex-direction: column;
                gap: 8px;
            }
            .summary-grid {
                flex-direction: column;
                gap: 10px;
            }
            .totals-card {
                width: 100%;
            }
            .no-print-bar {
                padding: 6px 10px;
                flex-wrap: wrap;
                gap: 6px;
            }
            .table-responsive {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
        }

        @media print {
            .no-print-bar {
                display: none !important;
            }
            body {
                padding: 0 !important;
                background: transparent !important;
                font-size: 9px !important;
            }
            .invoice-container {
                max-width: 100% !important;
                padding: 0 !important;
                box-shadow: none !important;
            }
            .table-responsive {
                overflow: visible !important;
                display: block !important;
                width: 100% !important;
            }
            .items-table thead {
                display: table-header-group !important;
            }
            .items-table tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .summary-grid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .invoice-footer {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
        }
    </style>
</head>
<body>

    <div class="no-print-bar">
        <div>
            <strong>Invoice #{{ $invoice->invoice_number }}</strong> &mdash; {{ $invoice->customer_name_snapshot }}
        </div>
        <div>
            <button class="btn btn-secondary" onclick="window.close()">Close</button>
            <button class="btn" onclick="window.print()">Print Document</button>
        </div>
    </div>

    <div class="invoice-container">
        <!-- Invoice Header -->
        <header class="invoice-header">
            <div class="company-identity">
                <h1>{{ $invoice->company_legal_name_snapshot }}</h1>
                @if($invoice->company_dba_name_snapshot)
                    <div class="company-dba">d/b/a {{ $invoice->company_dba_name_snapshot }}</div>
                @endif
                <div class="company-details">
                    <div>{{ $invoice->company_address_snapshot }}</div>
                    @if($invoice->company_phone_snapshot)
                        <div>Phone: {{ $invoice->company_phone_snapshot }}</div>
                    @endif
                    @if($invoice->company_email_snapshot)
                        <div>Email: {{ $invoice->company_email_snapshot }}</div>
                    @endif
                    @if($invoice->company_tax_id_snapshot)
                        <div>Tax ID / EIN: {{ $invoice->company_tax_id_snapshot }}</div>
                    @endif
                    @if($invoice->company_state_tax_id_snapshot)
                        <div>State Tax ID: {{ $invoice->company_state_tax_id_snapshot }}</div>
                    @endif
                </div>
            </div>

            <div class="document-title">
                <h2>TAX INVOICE</h2>
                <table class="document-meta-table">
                    <tr>
                        <td class="meta-label">Invoice Number:</td>
                        <td class="meta-value">{{ $invoice->invoice_number }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Invoice Date:</td>
                        <td class="meta-value">{{ $invoice->invoice_date->format('M d, Y') }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Payment Terms:</td>
                        <td class="meta-value">{{ $invoice->payment_terms->label() }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Due Date:</td>
                        <td class="meta-value">{{ $invoice->due_date->format('M d, Y') }}</td>
                    </tr>
                    @if($invoice->order)
                    <tr>
                        <td class="meta-label">Order Number:</td>
                        <td class="meta-value">{{ $invoice->order->order_number }}</td>
                    </tr>
                    @endif
                    <tr>
                        <td class="meta-label">Document Status:</td>
                        <td class="meta-value">{{ $invoice->status->value }}</td>
                    </tr>
                </table>
            </div>
        </header>

        <!-- Addresses Grid -->
        <section class="address-grid">
            <div class="address-card">
                <div class="address-card-title">Billed To</div>
                <div class="customer-name">{{ $invoice->customer_name_snapshot }}</div>
                <div class="address-lines">
                    <div>Customer Code: <strong>{{ $invoice->customer_code_snapshot }}</strong></div>
                    @if($invoice->customer_contact_snapshot)
                        <div>Attn: {{ $invoice->customer_contact_snapshot }}</div>
                    @endif
                    <div>{{ $invoice->billing_address_line1_snapshot }}</div>
                    @if($invoice->billing_address_line2_snapshot)
                        <div>{{ $invoice->billing_address_line2_snapshot }}</div>
                    @endif
                    <div>{{ $invoice->billing_city_snapshot }}, {{ $invoice->billing_state_snapshot }} {{ $invoice->billing_postal_code_snapshot }}</div>
                    <div>{{ $invoice->billing_country_snapshot }}</div>
                    @if($invoice->customer_tax_id_snapshot)
                        <div>Tax ID: {{ $invoice->customer_tax_id_snapshot }}</div>
                    @endif
                </div>
            </div>

            <div class="address-card">
                <div class="address-card-title">Shipped To</div>
                <div class="customer-name">{{ $invoice->customer_name_snapshot }}</div>
                <div class="address-lines">
                    <div>{{ $invoice->shipping_address_line1_snapshot }}</div>
                    @if($invoice->shipping_address_line2_snapshot)
                        <div>{{ $invoice->shipping_address_line2_snapshot }}</div>
                    @endif
                    <div>{{ $invoice->shipping_city_snapshot }}, {{ $invoice->shipping_state_snapshot }} {{ $invoice->shipping_postal_code_snapshot }}</div>
                    <div>{{ $invoice->shipping_country_snapshot }}</div>
                    @if($invoice->customer_phone_snapshot)
                        <div>Phone: {{ $invoice->customer_phone_snapshot }}</div>
                    @endif
                </div>
            </div>
        </section>

        <!-- Line Items Table (RULE-DOC-001: STRICTLY ZERO PRODUCT IMAGES) -->
        <div class="table-responsive">
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 26px;" class="text-center">#</th>
                        <th style="width: 105px;">SKU</th>
                        <th>Description</th>
                        <th style="width: 48px;" class="text-center">Unit</th>
                        <th style="width: 45px;" class="text-right">Qty</th>
                        <th style="width: 75px;" class="text-right">Unit Price</th>
                        <th style="width: 65px;" class="text-right">Tax Rate</th>
                        <th style="width: 65px;" class="text-right">Tax</th>
                        <th style="width: 80px;" class="text-right">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($invoice->items as $index => $item)
                    <tr>
                        <td class="text-center mono">{{ $index + 1 }}</td>
                        <td class="mono item-sku">{{ $item->sku_snapshot }}</td>
                        <td class="item-name">{{ $item->product_name_snapshot }}</td>
                        <td class="text-center">{{ $item->unit_snapshot }}</td>
                        <td class="text-right mono">{{ $item->quantity }}</td>
                        <td class="text-right mono">${{ number_format($item->unit_price, 2) }}</td>
                        <td class="text-right mono">{{ number_format($item->tax_rate_snapshot * 100, 2) }}%</td>
                        <td class="text-right mono">${{ number_format($item->tax_amount, 2) }}</td>
                        <td class="text-right mono" style="font-weight: 700;">${{ number_format($item->line_total, 2) }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <!-- Summary and Totals -->
        <section class="summary-grid">
            <div class="payment-remittance">
                <div class="payment-box">
                    <h3>Payment Terms & Instructions</h3>
                    <p>Terms: <strong>{{ $invoice->payment_terms->label() }}</strong> (Due: {{ $invoice->due_date->format('M d, Y') }})</p>
                    <p>Please reference invoice number <strong>{{ $invoice->invoice_number }}</strong> on all remittances.</p>
                </div>

                @if($invoice->order && $invoice->order->payments->where('status', \App\Enums\PaymentTransactionStatus::VERIFIED)->count() > 0)
                <div class="payment-box">
                    <h3>Verified Payments Received</h3>
                    @foreach($invoice->order->payments->where('status', \App\Enums\PaymentTransactionStatus::VERIFIED) as $payment)
                        <div style="font-size: 8.5px; margin-bottom: 2px;">
                            &bull; <strong>{{ $payment->payment_number }}</strong>: {{ $payment->payment_method->label() }} &mdash; ${{ number_format($payment->amount, 2) }} ({{ $payment->payment_date?->format('M d, Y') ?? 'Payment date unavailable' }})
                        </div>
                    @endforeach
                </div>
                @endif
            </div>

            <div class="totals-card">
                <table class="totals-table">
                    <tr>
                        <td class="total-label">Subtotal:</td>
                        <td class="total-value">${{ number_format($invoice->subtotal, 2) }}</td>
                    </tr>
                    <tr>
                        <td class="total-label">Tax Total:</td>
                        <td class="total-value">${{ number_format($invoice->tax_total, 2) }}</td>
                    </tr>
                    @if((float) $invoice->adjustment_total != 0.00)
                    <tr>
                        <td class="total-label">Adjustments:</td>
                        <td class="total-value">${{ number_format($invoice->adjustment_total, 2) }}</td>
                    </tr>
                    @endif
                    <tr class="grand-total">
                        <td>Grand Total ({{ $invoice->currency }}):</td>
                        <td class="total-value">${{ number_format($invoice->grand_total, 2) }}</td>
                    </tr>
                    <tr>
                        <td class="total-label">Amount Paid:</td>
                        <td class="total-value">${{ number_format($invoice->amount_paid, 2) }}</td>
                    </tr>
                    <tr class="due-total">
                        <td class="total-label">Balance Due:</td>
                        <td class="total-value">${{ number_format($invoice->amount_due, 2) }}</td>
                    </tr>
                </table>
            </div>
        </section>

        <!-- Footer -->
        <footer class="invoice-footer">
            @if($invoice->invoice_footer_note_snapshot)
                <p>{{ $invoice->invoice_footer_note_snapshot }}</p>
            @endif
            <p style="margin-top: 2px;">This is an authoritative computer-generated tax invoice. Legal entity: {{ $invoice->company_legal_name_snapshot }}.</p>
        </footer>
    </div>

</body>
</html>
