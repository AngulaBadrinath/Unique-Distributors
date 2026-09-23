<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TAX INVOICE - {{ $invoice->invoice_number }} — Unique Jersey Wholesale</title>
    <style>
        @page {
            size: letter portrait;
            margin: 0.5in;
        }

        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background-color: #ffffff;
            font-size: 10px;
            line-height: 1.35;
            padding: 16px;
        }

        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
        }

        /* Top Action Bar (Screen only) */
        .no-print-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #ffffff;
            padding: 10px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            font-size: 12px;
        }

        .no-print-bar .btn {
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .no-print-bar .btn:hover {
            background: #0369a1;
        }

        .no-print-bar .btn-secondary {
            background: #334155;
            margin-right: 8px;
        }

        .no-print-bar .btn-secondary:hover {
            background: #475569;
        }

        /* Header Layout */
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 18px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .company-brand {
            max-width: 380px;
        }

        .company-brand .brand-logo-wrap {
            margin-bottom: 8px;
        }

        .company-address-block {
            font-size: 9.5px;
            color: #334155;
            line-height: 1.4;
        }

        .company-address-block .company-title {
            font-weight: 700;
            color: #0f172a;
            font-size: 11px;
            margin-bottom: 2px;
        }

        .invoice-title-block {
            text-align: right;
            width: 260px;
        }

        .invoice-title-block h1 {
            font-size: 30px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 1px;
            line-height: 1;
            margin-bottom: 12px;
            text-transform: uppercase;
        }

        /* Meta Box (Date / Invoice #) */
        .meta-box-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #94a3b8;
            font-size: 10px;
        }

        .meta-box-table th {
            background-color: #f1f5f9;
            border: 1px solid #94a3b8;
            color: #0f172a;
            font-weight: 700;
            text-align: center;
            padding: 4px 6px;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
        }

        .meta-box-table td {
            border: 1px solid #94a3b8;
            text-align: center;
            padding: 6px 8px;
            font-weight: 700;
            color: #0f172a;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            background-color: #ffffff;
        }

        /* Bill To / Ship To Cards */
        .parties-grid {
            display: flex;
            gap: 16px;
            margin-bottom: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .party-box {
            flex: 1;
            border: 1px solid #94a3b8;
            background-color: #ffffff;
        }

        .party-box-header {
            background-color: #f1f5f9;
            border-bottom: 1px solid #94a3b8;
            padding: 4px 8px;
            font-weight: 800;
            font-size: 9.5px;
            text-transform: uppercase;
            color: #0f172a;
            letter-spacing: 0.4px;
        }

        .party-box-body {
            padding: 8px 10px;
            font-size: 10px;
            color: #1e293b;
            line-height: 1.4;
            min-height: 72px;
        }

        .party-box-body .party-name {
            font-weight: 800;
            color: #0f172a;
            font-size: 11px;
            margin-bottom: 2px;
        }

        /* 7-Column Info Grid */
        .info-grid-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #94a3b8;
            margin-bottom: 16px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .info-grid-table th {
            background-color: #f1f5f9;
            border: 1px solid #94a3b8;
            color: #0f172a;
            font-weight: 700;
            text-align: center;
            padding: 4px 6px;
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .info-grid-table td {
            border: 1px solid #94a3b8;
            text-align: center;
            padding: 5px 6px;
            font-size: 9.5px;
            color: #1e293b;
            font-weight: 600;
            background-color: #ffffff;
        }

        /* 5-Column Line Items Table (Exact Client Spec) */
        .items-table-wrap {
            width: 100%;
            margin-bottom: 16px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #94a3b8;
            font-size: 10px;
        }

        .items-table thead {
            display: table-header-group;
        }

        .items-table th {
            background-color: #f1f5f9;
            border: 1px solid #94a3b8;
            color: #0f172a;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            padding: 6px 8px;
            font-size: 9px;
        }

        .items-table th.col-qty {
            width: 80px;
            text-align: center;
        }

        .items-table th.col-code {
            width: 130px;
            text-align: left;
        }

        .items-table th.col-desc {
            text-align: left;
        }

        .items-table th.col-price {
            width: 110px;
            text-align: right;
        }

        .items-table th.col-amount {
            width: 120px;
            text-align: right;
        }

        .items-table tbody tr {
            border-bottom: 1px solid #cbd5e1;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .items-table tbody tr:nth-child(even) {
            background-color: #f8fafc;
        }

        .items-table td {
            border-left: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
            padding: 5.5px 8px;
            font-size: 9.5px;
            color: #1e293b;
            vertical-align: middle;
        }

        .items-table td.col-qty {
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
        }

        .items-table td.col-code {
            text-align: left;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            color: #0f172a;
        }

        .items-table td.col-desc {
            text-align: left;
            font-weight: 500;
        }

        .items-table td.col-price {
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .items-table td.col-amount {
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            color: #0f172a;
        }

        /* Bottom Summary & Total */
        .bottom-summary-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-top: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .remittance-info {
            flex: 1;
            font-size: 9px;
            color: #475569;
            line-height: 1.45;
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            border-radius: 4px;
            background-color: #f8fafc;
        }

        .remittance-info strong {
            color: #0f172a;
        }

        .totals-block {
            width: 270px;
        }

        .totals-box-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #94a3b8;
            font-size: 10px;
        }

        .totals-box-table td {
            border: 1px solid #94a3b8;
            padding: 5px 10px;
        }

        .totals-box-table .total-label {
            font-weight: 700;
            color: #334155;
            background-color: #f8fafc;
            text-transform: uppercase;
            font-size: 9px;
        }

        .totals-box-table .total-val {
            text-align: right;
            font-weight: 700;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            color: #0f172a;
        }

        .totals-box-table tr.grand-total-row td {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 900;
            font-size: 12px;
            padding: 7px 10px;
        }

        .totals-box-table tr.grand-total-row .total-label {
            background-color: #0f172a;
            color: #ffffff;
        }

        .totals-box-table tr.grand-total-row .total-val {
            color: #ffffff;
        }

        .totals-box-table tr.due-row td {
            background-color: #fef2f2;
            color: #991b1b;
            font-weight: 800;
            font-size: 11px;
        }

        .totals-box-table tr.due-row .total-label {
            background-color: #fef2f2;
            color: #991b1b;
        }

        .totals-box-table tr.due-row .total-val {
            color: #991b1b;
        }

        /* Document Footer */
        .invoice-footer {
            margin-top: 24px;
            padding-top: 8px;
            border-top: 1px solid #cbd5e1;
            font-size: 8.5px;
            color: #64748b;
            text-align: center;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        @media screen {
            body {
                padding-top: 60px;
                background-color: #f1f5f9;
            }
            .invoice-container {
                background: #ffffff;
                padding: 32px;
                border-radius: 6px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            }
        }

        @media screen and (max-width: 640px) {
            body {
                padding-top: 75px;
            }
            .invoice-container {
                padding: 16px;
            }
            .invoice-header {
                flex-direction: column;
                gap: 14px;
            }
            .invoice-title-block {
                text-align: left;
                width: 100%;
            }
            .parties-grid {
                flex-direction: column;
                gap: 10px;
            }
            .bottom-summary-grid {
                flex-direction: column;
                gap: 14px;
            }
            .totals-block {
                width: 100%;
            }
            .info-grid-table th, .info-grid-table td {
                font-size: 7.5px;
                padding: 3px 2px;
            }
        }

        @media print {
            .no-print-bar {
                display: none !important;
            }
            body {
                padding: 0 !important;
                background: transparent !important;
                font-size: 9.5px !important;
            }
            .invoice-container {
                max-width: 100% !important;
                padding: 0 !important;
                box-shadow: none !important;
            }
            .items-table thead {
                display: table-header-group !important;
            }
            .items-table tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .bottom-summary-grid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
        }
    </style>
</head>
<body>

    <!-- Screen-Only Actions -->
    <div class="no-print-bar">
        <div>
            <strong>TAX INVOICE #{{ $invoice->invoice_number }}</strong> &mdash; {{ $invoice->customer_name_snapshot }}
        </div>
        <div>
            <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
            <button class="btn" onclick="window.print()">Print / Export PDF</button>
        </div>
    </div>

    <div class="invoice-container">
        <!-- Top Header -->
        <header class="invoice-header">
            <div class="company-brand">
                <!-- RULE-DOC-001: Inline SVG Vector Logo (Zero img tags) -->
                <div class="brand-logo-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 434 80" style="height: 48px; width: auto; max-width: 260px; display: block;"><g transform="translate(16 12)"><mask id="m" maskUnits="userSpaceOnUse" x="-40" y="-40" width="200" height="140"><rect x="-40" y="-40" width="200" height="140" fill="#fff"/><path d="M-8 52Q46 52 98 -2Q40 28 -8 52Z" fill="#000" stroke="#000" stroke-width="7" stroke-linejoin="round"/></mask><g mask="url(#m)"><g transform="skewX(-12)" fill="none" stroke="#0B1220" stroke-width="16"><path d="M8 0V40A16 16 0 0 0 40 40V0"/><path d="M80 -9V40.04A15.96 15.96 0 0 1 64.04 56H50"/></g></g><path d="M-8 52Q46 52 98 -2Q40 28 -8 52Z" fill="#0891B2"/></g><text x="132" y="42" font-family="Inter,Manrope,'Segoe UI',Arial,sans-serif" font-size="34" font-weight="800" lengthAdjust="spacing" textLength="300" fill="#0B1220">UNIQUE <tspan fill="#0891B2">JERSEY</tspan></text><text x="132" y="68" font-family="Inter,Manrope,'Segoe UI',Arial,sans-serif" font-size="17" font-weight="500" letter-spacing="7" fill="#5B6B80">WHOLESALE</text></svg>
                </div>
                <div class="company-address-block">
                    <div class="company-title">{{ $invoice->company_legal_name_snapshot ?? 'Unique Jersey Wholesale' }}</div>
                    @if($invoice->company_dba_name_snapshot)
                        <div>d/b/a {{ $invoice->company_dba_name_snapshot }}</div>
                    @endif
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

            <div class="invoice-title-block">
                <h1>INVOICE</h1>
                <table class="meta-box-table">
                    <thead>
                        <tr>
                            <th>DATE</th>
                            <th>INVOICE #</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{{ $invoice->invoice_date ? $invoice->invoice_date->format('m/d/Y') : date('m/d/Y') }}</td>
                            <td>{{ $invoice->invoice_number }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </header>

        <!-- Bill To / Ship To Section -->
        <section class="parties-grid">
            <div class="party-box">
                <div class="party-box-header">Bill To</div>
                <div class="party-box-body">
                    <div class="party-name">{{ $invoice->customer_name_snapshot }}</div>
                    @if($invoice->customer_code_snapshot)
                        <div style="font-size: 9px; color: #64748b; margin-bottom: 2px;">Account: {{ $invoice->customer_code_snapshot }}</div>
                    @endif
                    @if($invoice->billing_address_line1_snapshot)
                        <div>{{ $invoice->billing_address_line1_snapshot }}</div>
                    @endif
                    @if($invoice->billing_address_line2_snapshot)
                        <div>{{ $invoice->billing_address_line2_snapshot }}</div>
                    @endif
                    @if($invoice->billing_city_snapshot || $invoice->billing_state_snapshot || $invoice->billing_postal_code_snapshot)
                        <div>{{ $invoice->billing_city_snapshot }}{{ $invoice->billing_city_snapshot && $invoice->billing_state_snapshot ? ', ' : '' }}{{ $invoice->billing_state_snapshot }} {{ $invoice->billing_postal_code_snapshot }}</div>
                    @endif
                    @if($invoice->customer_phone_snapshot)
                        <div>Phone: {{ $invoice->customer_phone_snapshot }}</div>
                    @endif
                </div>
            </div>

            <div class="party-box">
                <div class="party-box-header">Ship To</div>
                <div class="party-box-body">
                    <div class="party-name">{{ $invoice->customer_name_snapshot }}</div>
                    @if($invoice->shipping_address_line1_snapshot)
                        <div>{{ $invoice->shipping_address_line1_snapshot }}</div>
                    @elseif($invoice->billing_address_line1_snapshot)
                        <div>{{ $invoice->billing_address_line1_snapshot }}</div>
                    @endif
                    @if($invoice->shipping_address_line2_snapshot)
                        <div>{{ $invoice->shipping_address_line2_snapshot }}</div>
                    @endif
                    @if($invoice->shipping_city_snapshot || $invoice->shipping_state_snapshot || $invoice->shipping_postal_code_snapshot)
                        <div>{{ $invoice->shipping_city_snapshot }}{{ $invoice->shipping_city_snapshot && $invoice->shipping_state_snapshot ? ', ' : '' }}{{ $invoice->shipping_state_snapshot }} {{ $invoice->shipping_postal_code_snapshot }}</div>
                    @elseif($invoice->billing_city_snapshot)
                        <div>{{ $invoice->billing_city_snapshot }}, {{ $invoice->billing_state_snapshot }} {{ $invoice->billing_postal_code_snapshot }}</div>
                    @endif
                    @if($invoice->customer_phone_snapshot)
                        <div>Phone: {{ $invoice->customer_phone_snapshot }}</div>
                    @endif
                </div>
            </div>
        </section>

        <!-- 7-Column Info Grid -->
        <table class="info-grid-table">
            <thead>
                <tr>
                    <th>P.O. NUMBER</th>
                    <th>TERMS</th>
                    <th>REP</th>
                    <th>SHIP</th>
                    <th>VIA</th>
                    <th>F.O.B.</th>
                    <th>PROJECT</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{{ $invoice->order?->po_number ?? '—' }}</td>
                    <td>{{ $invoice->payment_terms ? $invoice->payment_terms->label() : 'Due on Receipt' }}</td>
                    <td>{{ $invoice->order?->creator?->name ?? 'Direct' }}</td>
                    <td>{{ $invoice->invoice_date ? $invoice->invoice_date->format('m/d/Y') : date('m/d/Y') }}</td>
                    <td>Ground</td>
                    <td>Destination</td>
                    <td>—</td>
                </tr>
            </tbody>
        </table>

        <!-- 5-Column Line Items Table (Exact Client Spec) -->
        <div class="items-table-wrap">
            <table class="items-table">
                <thead>
                    <tr>
                        <th class="col-qty">QUANTITY</th>
                        <th class="col-code">ITEM CODE</th>
                        <th class="col-desc">DESCRIPTION</th>
                        <th class="col-price">PRICE EACH</th>
                        <th class="col-amount">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($invoice->items as $item)
                    <tr>
                        <td class="col-qty">{{ (int) $item->quantity == $item->quantity ? (int) $item->quantity : number_format($item->quantity, 2) }}</td>
                        <td class="col-code">{{ $item->sku_snapshot }}</td>
                        <td class="col-desc">{{ $item->product_name_snapshot }}</td>
                        <td class="col-price">${{ number_format($item->unit_price, 2) }}</td>
                        <td class="col-amount">${{ number_format($item->line_total, 2) }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <!-- Bottom Summary & Total -->
        <section class="bottom-summary-grid">
            <div class="remittance-info">
                <p><strong>Payment Terms:</strong> {{ $invoice->payment_terms ? $invoice->payment_terms->label() : 'Due on Receipt' }}</p>
                <p><strong>Remittance:</strong> Please include invoice number <strong>{{ $invoice->invoice_number }}</strong> on your check or money order.</p>
                @if($invoice->invoice_footer_note_snapshot)
                    <p style="margin-top: 4px;">{{ $invoice->invoice_footer_note_snapshot }}</p>
                @endif

                @if($invoice->order && $invoice->order->payments && $invoice->order->payments->where('status', \App\Enums\PaymentTransactionStatus::VERIFIED)->count() > 0)
                <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                    <div style="font-weight: 700; font-size: 9px; text-transform: uppercase; color: #0f172a; margin-bottom: 2px;">Verified Payments Received</div>
                    @foreach($invoice->order->payments->where('status', \App\Enums\PaymentTransactionStatus::VERIFIED) as $payment)
                        <div style="font-size: 8.5px; margin-bottom: 1px;">
                            &bull; <strong>{{ $payment->payment_number }}</strong>: {{ $payment->payment_method->label() }} &mdash; ${{ number_format($payment->amount, 2) }} ({{ $payment->payment_date ? $payment->payment_date->format('M d, Y') : 'Payment date unavailable' }})
                        </div>
                    @endforeach
                </div>
                @endif
            </div>

            <div class="totals-block">
                <table class="totals-box-table">
                    @if((float) $invoice->tax_total > 0 || (float) $invoice->adjustment_total != 0.00)
                    <tr>
                        <td class="total-label">Subtotal</td>
                        <td class="total-val">${{ number_format($invoice->subtotal, 2) }}</td>
                    </tr>
                    @endif
                    @if((float) $invoice->tax_total > 0)
                    <tr>
                        <td class="total-label">Tax</td>
                        <td class="total-val">${{ number_format($invoice->tax_total, 2) }}</td>
                    </tr>
                    @endif
                    @if((float) $invoice->adjustment_total != 0.00)
                    <tr>
                        <td class="total-label">Adjustments</td>
                        <td class="total-val">${{ number_format($invoice->adjustment_total, 2) }}</td>
                    </tr>
                    @endif
                    <tr class="grand-total-row">
                        <td class="total-label">Total</td>
                        <td class="total-val">${{ number_format($invoice->grand_total, 2) }}</td>
                    </tr>
                    @if((float) $invoice->amount_paid > 0)
                    <tr>
                        <td class="total-label">Payments / Credits</td>
                        <td class="total-val">-${{ number_format($invoice->amount_paid, 2) }}</td>
                    </tr>
                    <tr class="due-row">
                        <td class="total-label">Balance Due</td>
                        <td class="total-val">${{ number_format($invoice->amount_due, 2) }}</td>
                    </tr>
                    @endif
                </table>
            </div>
        </section>

        <!-- Document Footer -->
        <footer class="invoice-footer">
            <p>Thank you for your business! Legal Entity: {{ $invoice->company_legal_name_snapshot ?? 'Unique Jersey Wholesale' }}</p>
        </footer>
    </div>

</body>
</html>
