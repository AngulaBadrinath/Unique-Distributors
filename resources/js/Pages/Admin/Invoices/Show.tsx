import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    FileText,
    Printer,
    Download,
    ArrowLeft,
    Building2,
    Calendar,
    DollarSign,
    CheckCircle2,
    Clock,
    AlertCircle,
    User,
    MapPin,
    CreditCard,
    ExternalLink,
} from 'lucide-react';

interface InvoiceItemRow {
    id: number;
    product_name_snapshot: string;
    sku_snapshot: string;
    unit_snapshot: string;
    quantity: number;
    unit_price: string | number;
    tax_profile_code_snapshot?: string | null;
    tax_profile_name_snapshot?: string | null;
    tax_rate_snapshot: string | number;
    taxable_amount: string | number;
    tax_amount: string | number;
    line_total: string | number;
}

interface PaymentRow {
    id: number;
    payment_number: string;
    payment_method: string;
    amount: string | number;
    status: string;
    transaction_date: string;
    reference_number?: string | null;
}

interface InvoiceDetail {
    id: number;
    invoice_number: string;
    order_id: number;
    customer_id: number;
    status: 'ISSUED' | 'PAID' | 'VOID';
    payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERPAID' | 'REFUNDED';
    invoice_date: string;
    due_date: string;
    payment_terms: string;
    currency: string;
    subtotal: string | number;
    tax_total: string | number;
    adjustment_total: string | number;
    grand_total: string | number;
    amount_paid: string | number;
    amount_due: string | number;
    customer_name_snapshot: string;
    customer_code_snapshot: string;
    customer_contact_snapshot?: string | null;
    customer_email_snapshot?: string | null;
    customer_phone_snapshot?: string | null;
    customer_tax_id_snapshot?: string | null;
    billing_address_line1_snapshot: string;
    billing_address_line2_snapshot?: string | null;
    billing_city_snapshot: string;
    billing_state_snapshot: string;
    billing_postal_code_snapshot: string;
    billing_country_snapshot: string;
    shipping_address_line1_snapshot: string;
    shipping_address_line2_snapshot?: string | null;
    shipping_city_snapshot: string;
    shipping_state_snapshot: string;
    shipping_postal_code_snapshot: string;
    shipping_country_snapshot: string;
    company_legal_name_snapshot: string;
    company_dba_name_snapshot?: string | null;
    company_address_snapshot: string;
    company_phone_snapshot?: string | null;
    company_email_snapshot?: string | null;
    company_tax_id_snapshot?: string | null;
    company_state_tax_id_snapshot?: string | null;
    invoice_footer_note_snapshot?: string | null;
    pdf_path?: string | null;
    pdf_generated_at?: string | null;
    created_at: string;
    items: InvoiceItemRow[];
    order?: {
        id: number;
        order_number: string;
        status: string;
        payments?: PaymentRow[];
    };
    customer?: {
        id: number;
        name: string;
        code: string;
    };
    creator?: {
        id: number;
        name: string;
        email: string;
    };
}

interface Props {
    invoice: InvoiceDetail;
    isSalesmanView?: boolean;
}

export default function InvoiceShow({ invoice, isSalesmanView = false }: Props) {
    const getStatusBadge = (st: string) => {
        switch (st) {
            case 'PAID':
                return <Badge variant="success" className="gap-1 font-medium"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>;
            case 'ISSUED':
                return <Badge variant="default" className="gap-1 font-medium"><FileText className="h-3 w-3" /> Issued</Badge>;
            case 'VOID':
                return <Badge variant="destructive" className="gap-1 font-medium"><AlertCircle className="h-3 w-3" /> Void</Badge>;
            default:
                return <Badge variant="secondary">{st}</Badge>;
        }
    };

    const getPaymentBadge = (pst: string) => {
        switch (pst) {
            case 'PAID':
                return (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-medium">
                        Settled
                    </Badge>
                );
            case 'PARTIALLY_PAID':
                return (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-medium">
                        Partially Paid
                    </Badge>
                );
            case 'UNPAID':
                return (
                    <Badge variant="outline" className="border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10 font-medium">
                        Unpaid
                    </Badge>
                );
            default:
                return <Badge variant="outline">{pst}</Badge>;
        }
    };

    const verifiedPayments = invoice.order?.payments?.filter(p => p.status === 'VERIFIED') || [];
    const backUrl = isSalesmanView ? '/salesman/invoices' : '/admin/invoices';

    return (
        <AppLayout title={`Invoice ${invoice.invoice_number}`}>
            <Head title={`Invoice ${invoice.invoice_number} — Formal Billing Document`} />

            <div className="max-w-5xl mx-auto space-y-6 pb-16">
                {/* Navigation and Top Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href={backUrl}
                            className="inline-flex items-center justify-center h-9 px-3 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                            {isSalesmanView ? "Customer Invoices" : "All Invoices"}
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                                    {invoice.invoice_number}
                                </h1>
                                {getStatusBadge(invoice.status)}
                                {getPaymentBadge(invoice.payment_status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Issued on {new Date(invoice.invoice_date).toLocaleDateString()} &bull; Terms: {invoice.payment_terms}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={`/invoices/${invoice.id}/print`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-9 px-3.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent text-foreground transition-colors"
                        >
                            <Printer className="w-3.5 h-3.5 mr-1.5" />
                            Print HTML
                        </a>
                        <a
                            href={`/invoices/${invoice.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-9 px-3.5 rounded-md text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors"
                        >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Download PDF
                        </a>
                    </div>
                </div>

                {/* Main Invoice Card (Document Presentation) */}
                <div className="bg-card rounded-xl border border-border shadow-xs p-6 sm:p-8 space-y-6">
                    {/* Company and Document Meta Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-border pb-6">
                        <div>
                            <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-foreground">
                                {invoice.company_legal_name_snapshot}
                            </h2>
                            {invoice.company_dba_name_snapshot && (
                                <p className="text-xs font-semibold text-muted-foreground">
                                    d/b/a {invoice.company_dba_name_snapshot}
                                </p>
                            )}
                            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                <div>{invoice.company_address_snapshot}</div>
                                {invoice.company_phone_snapshot && <div>Phone: {invoice.company_phone_snapshot}</div>}
                                {invoice.company_email_snapshot && <div>Email: {invoice.company_email_snapshot}</div>}
                                {invoice.company_tax_id_snapshot && <div>Tax ID / EIN: {invoice.company_tax_id_snapshot}</div>}
                                {invoice.company_state_tax_id_snapshot && <div>State Tax ID: {invoice.company_state_tax_id_snapshot}</div>}
                            </div>
                        </div>

                        <div className="text-left sm:text-right">
                            <span className="text-2xl font-black tracking-tight text-foreground block mb-1">
                                TAX INVOICE
                            </span>
                            <div className="text-xs space-y-1 font-mono">
                                <div><span className="text-muted-foreground">Invoice #:</span> <strong className="text-foreground">{invoice.invoice_number}</strong></div>
                                <div><span className="text-muted-foreground">Invoice Date:</span> {new Date(invoice.invoice_date).toLocaleDateString()}</div>
                                <div><span className="text-muted-foreground">Due Date:</span> {new Date(invoice.due_date).toLocaleDateString()}</div>
                                {invoice.order && (
                                    <div>
                                        <span className="text-muted-foreground">Order Ref:</span>{' '}
                                        <Link href={isSalesmanView ? `/salesman/orders/${invoice.order.id}` : `/admin/orders/${invoice.order.id}`} className="text-primary hover:underline">
                                            {invoice.order.order_number}
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Customer Billed / Shipped Addresses Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Billed To
                            </h3>
                            <div className="font-semibold text-foreground text-sm">
                                {invoice.customer_name_snapshot}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                                Customer Code: {invoice.customer_code_snapshot}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                {invoice.customer_contact_snapshot && <div>Attn: {invoice.customer_contact_snapshot}</div>}
                                <div>{invoice.billing_address_line1_snapshot}</div>
                                {invoice.billing_address_line2_snapshot && <div>{invoice.billing_address_line2_snapshot}</div>}
                                <div>{invoice.billing_city_snapshot}, {invoice.billing_state_snapshot} {invoice.billing_postal_code_snapshot}</div>
                                <div>{invoice.billing_country_snapshot}</div>
                                {invoice.customer_tax_id_snapshot && <div className="mt-1 font-mono">Tax ID: {invoice.customer_tax_id_snapshot}</div>}
                            </div>
                        </div>

                        <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Shipped To
                            </h3>
                            <div className="font-semibold text-foreground text-sm">
                                {invoice.customer_name_snapshot}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                <div>{invoice.shipping_address_line1_snapshot}</div>
                                {invoice.shipping_address_line2_snapshot && <div>{invoice.shipping_address_line2_snapshot}</div>}
                                <div>{invoice.shipping_city_snapshot}, {invoice.shipping_state_snapshot} {invoice.shipping_postal_code_snapshot}</div>
                                <div>{invoice.shipping_country_snapshot}</div>
                                {invoice.customer_phone_snapshot && <div className="mt-1">Phone: {invoice.customer_phone_snapshot}</div>}
                            </div>
                        </div>
                    </div>

                    {/* Line Items Table (RULE-DOC-001: STRICTLY ZERO PRODUCT IMAGES) */}
                    <div className="border border-border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                            <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
                                <tr>
                                    <th className="px-3 py-2.5 text-center w-10">#</th>
                                    <th className="px-3 py-2.5">SKU</th>
                                    <th className="px-3 py-2.5">Description</th>
                                    <th className="px-3 py-2.5 text-center">Unit</th>
                                    <th className="px-3 py-2.5 text-right">Qty</th>
                                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                                    <th className="px-3 py-2.5 text-right">Tax Rate</th>
                                    <th className="px-3 py-2.5 text-right">Tax</th>
                                    <th className="px-3 py-2.5 text-right">Line Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {invoice.items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground font-mono">{index + 1}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-foreground">{item.sku_snapshot}</td>
                                        <td className="px-3 py-2.5 font-medium text-foreground">{item.product_name_snapshot}</td>
                                        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{item.unit_snapshot}</td>
                                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">{item.quantity}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                                            ${Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                                            {(Number(item.tax_rate_snapshot) * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                                            ${Number(item.tax_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                                            ${Number(item.line_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    {/* Summary and Financial Totals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Remittance and Payments Summary */}
                        <div className="space-y-4">
                            <div className="bg-muted/30 p-4 rounded-lg border border-border">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                    Payment Instructions
                                </h4>
                                <p className="text-xs text-foreground">
                                    Payment is due upon <strong>{invoice.payment_terms}</strong> terms on or before <strong>{new Date(invoice.due_date).toLocaleDateString()}</strong>.
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Please reference invoice <strong className="text-foreground">{invoice.invoice_number}</strong> on all remittances.
                                </p>
                            </div>

                            {verifiedPayments.length > 0 && (
                                <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                        Verified Payments Applied
                                    </h4>
                                    <div className="space-y-1.5">
                                        {verifiedPayments.map(p => (
                                            <div key={p.id} className="flex justify-between items-center text-xs font-mono">
                                                <span className="text-foreground font-semibold">{p.payment_number} ({p.payment_method})</span>
                                                <span className="text-emerald-600 font-bold">+${Number(p.amount).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Totals Breakdown */}
                        <div className="bg-muted/30 p-4 rounded-lg border border-border">
                            <div className="space-y-2 font-mono text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal:</span>
                                    <span className="text-foreground">${Number(invoice.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Tax Total:</span>
                                    <span className="text-foreground">${Number(invoice.tax_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {Number(invoice.adjustment_total) !== 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Adjustments:</span>
                                        <span className="text-foreground">${Number(invoice.adjustment_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-foreground">
                                    <span>Grand Total ({invoice.currency}):</span>
                                    <span>${Number(invoice.grand_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-emerald-600 font-semibold text-xs">
                                    <span>Amount Paid:</span>
                                    <span>${Number(invoice.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                                    <span className={Number(invoice.amount_due) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                                        Balance Due:
                                    </span>
                                    <span className={Number(invoice.amount_due) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                                        ${Number(invoice.amount_due).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer note */}
                    {invoice.invoice_footer_note_snapshot && (
                        <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
                            {invoice.invoice_footer_note_snapshot}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
