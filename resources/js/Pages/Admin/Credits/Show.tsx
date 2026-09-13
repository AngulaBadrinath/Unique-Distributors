import React, { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    CreditCard,
    ArrowLeft,
    RefreshCw,
    CheckCircle2,
    Clock,
    FileText,
    Building,
    User,
    AlertCircle,
    Receipt,
    Plus,
    X,
} from 'lucide-react';

interface CreditNoteItem {
    id: number;
    product_id: number;
    product_name_snapshot: string;
    sku_snapshot: string;
    quantity: number;
    unit_price_snapshot: string | number;
    tax_rate_snapshot: string | number;
    tax_amount_snapshot: string | number;
    line_subtotal: string | number;
    line_total: string | number;
}

interface RefundRequestSummary {
    id: number;
    refund_number: string;
    status: string;
    amount: string | number;
    payment_method: string;
    reason: string;
    requested_at: string;
    requester?: {
        id: number;
        name: string;
    };
    approver?: {
        id: number;
        name: string;
    };
}

interface RefundTransactionSummary {
    id: number;
    transaction_number: string;
    status: string;
    amount: string | number;
    payment_method: string;
    reference_number: string | null;
    processed_at: string;
    processor?: {
        id: number;
        name: string;
    };
}

interface CreditNoteDetail {
    id: number;
    credit_number: string;
    customer_id: number;
    order_id: number;
    invoice_id: number | null;
    return_request_id: number | null;
    status: 'ISSUED' | 'APPLIED' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED' | 'CLOSED';
    currency: string;
    subtotal: string | number;
    tax_total: string | number;
    total_amount: string | number;
    allocated_to_refunds: string | number;
    remaining_balance: string | number;
    reason: string;
    issued_at: string;
    customer_name_snapshot: string;
    customer_code_snapshot: string;
    customer_contact_snapshot: string | null;
    customer_email_snapshot: string | null;
    customer_phone_snapshot: string | null;
    billing_address_line1_snapshot: string | null;
    billing_city_snapshot: string | null;
    billing_state_snapshot: string | null;
    billing_postal_code_snapshot: string | null;
    billing_country_snapshot: string | null;
    company_legal_name_snapshot: string | null;
    company_address_snapshot: string | null;
    company_tax_id_snapshot: string | null;
    items: CreditNoteItem[];
    customer?: {
        id: number;
        name: string;
        code: string;
    };
    order?: {
        id: number;
        order_number: string;
    };
    return_request?: {
        id: number;
        return_number: string;
    };
    issuer?: {
        id: number;
        name: string;
    };
    refund_requests?: RefundRequestSummary[];
    refund_transactions?: RefundTransactionSummary[];
}

interface Props {
    creditNote: CreditNoteDetail;
}

export default function Show({ creditNote }: Props) {
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        credit_note_id: creditNote.id,
        requested_amount: String(creditNote.remaining_balance),
        payment_method: 'CASH',
        reason: 'Customer requested refund for credit balance',
        notes: '',
    });

    const isRefundable =
        parseFloat(String(creditNote.remaining_balance)) > 0 &&
        (creditNote.status === 'ISSUED' || creditNote.status === 'PARTIALLY_REFUNDED');

    const handleCreateRefund = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/refunds', {
            onSuccess: () => {
                setIsRefundModalOpen(false);
                reset();
            },
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ISSUED':
                return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">ISSUED (ACTIVE)</Badge>;
            case 'PARTIALLY_REFUNDED':
                return <Badge className="bg-amber-50 text-amber-700 border-amber-200">PARTIALLY REFUNDED</Badge>;
            case 'FULLY_REFUNDED':
                return <Badge className="bg-slate-100 text-slate-700 border-slate-300">FULLY REFUNDED</Badge>;
            case 'APPLIED':
                return <Badge className="bg-blue-50 text-blue-700 border-blue-200">APPLIED TO INVOICE</Badge>;
            case 'CLOSED':
                return <Badge className="bg-rose-50 text-rose-700 border-rose-200">CLOSED</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <AppLayout title={`Credit Note ${creditNote.credit_number}`}>
            <Head title={`Credit Note ${creditNote.credit_number}`} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/credits">
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                                    {creditNote.credit_number}
                                </h1>
                                {getStatusBadge(creditNote.status)}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Issued on {new Date(creditNote.issued_at).toLocaleString()} by {creditNote.issuer?.name || 'System'}
                            </p>
                        </div>
                    </div>

                    {isRefundable && (
                        <Button
                            onClick={() => setIsRefundModalOpen(true)}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Plus className="w-4 h-4" />
                            Request Customer Refund
                        </Button>
                    )}
                </div>

                {/* Financial Summary KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Total Credit Issued
                        </span>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                            ${parseFloat(String(creditNote.total_amount)).toFixed(2)}
                        </div>
                        <span className="text-xs text-slate-400 mt-1 block">
                            Subtotal: ${parseFloat(String(creditNote.subtotal)).toFixed(2)} | Tax: ${parseFloat(String(creditNote.tax_total)).toFixed(2)}
                        </span>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Allocated to Refunds
                        </span>
                        <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
                            ${parseFloat(String(creditNote.allocated_to_refunds)).toFixed(2)}
                        </div>
                        <span className="text-xs text-slate-400 mt-1 block">
                            Total disbursed / settled to customer
                        </span>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Remaining Available Balance
                        </span>
                        <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                            ${parseFloat(String(creditNote.remaining_balance)).toFixed(2)}
                        </div>
                        <span className="text-xs text-slate-400 mt-1 block">
                            Available for new refund requests
                        </span>
                    </div>
                </div>

                {/* Snapshots Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Customer Snapshot */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-semibold text-sm">
                            <User className="w-4 h-4 text-slate-500" />
                            Customer Master Snapshot (Transaction-Time)
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div><span className="font-semibold text-slate-800">Legal Name:</span> {creditNote.customer_name_snapshot}</div>
                            <div><span className="font-semibold text-slate-800">Account Code:</span> <span className="font-mono">{creditNote.customer_code_snapshot}</span></div>
                            {creditNote.customer_contact_snapshot && <div><span className="font-semibold text-slate-800">Contact:</span> {creditNote.customer_contact_snapshot}</div>}
                            {creditNote.customer_email_snapshot && <div><span className="font-semibold text-slate-800">Email:</span> {creditNote.customer_email_snapshot}</div>}
                            {creditNote.customer_phone_snapshot && <div><span className="font-semibold text-slate-800">Phone:</span> {creditNote.customer_phone_snapshot}</div>}
                            {creditNote.billing_address_line1_snapshot && (
                                <div><span className="font-semibold text-slate-800">Billing Address:</span> {creditNote.billing_address_line1_snapshot}, {creditNote.billing_city_snapshot} {creditNote.billing_state_snapshot} {creditNote.billing_postal_code_snapshot}</div>
                            )}
                        </div>
                    </div>

                    {/* Source References */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-semibold text-sm">
                            <Receipt className="w-4 h-4 text-slate-500" />
                            Authoritative Business Event Linkages
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Source Return Request:</span>
                                {creditNote.return_request ? (
                                    <Link
                                        href={`/admin/returns/${creditNote.return_request.id}`}
                                        className="font-mono font-semibold text-blue-600 hover:underline"
                                    >
                                        {creditNote.return_request.return_number}
                                    </Link>
                                ) : (
                                    <span className="font-mono text-slate-400">N/A</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Originating Order:</span>
                                {creditNote.order ? (
                                    <Link
                                        href={`/admin/orders/${creditNote.order.id}`}
                                        className="font-mono font-semibold text-blue-600 hover:underline"
                                    >
                                        {creditNote.order.order_number}
                                    </Link>
                                ) : (
                                    <span className="font-mono text-slate-400">N/A</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Reason / Justification:</span>
                                <span className="text-slate-800 font-medium">{creditNote.reason}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Company Issuer Profile:</span>
                                <span className="text-slate-800">{creditNote.company_legal_name_snapshot || 'Unique Distributors Inc.'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Credit Note Items Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-900">
                            Credit Note Line Items (Historical Snapshots)
                        </h2>
                        <span className="text-xs text-slate-400">
                            {creditNote.items.length} item(s) credited
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                                <tr>
                                    <th className="px-6 py-3">Product / SKU</th>
                                    <th className="px-6 py-3 text-center">Credited Qty</th>
                                    <th className="px-6 py-3 text-right">Unit Price</th>
                                    <th className="px-6 py-3 text-right">Tax Rate</th>
                                    <th className="px-6 py-3 text-right">Tax Amount</th>
                                    <th className="px-6 py-3 text-right">Line Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {creditNote.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{item.product_name_snapshot}</div>
                                            <div className="text-xs text-slate-400 font-mono">{item.sku_snapshot}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono font-semibold text-slate-800">
                                            {item.quantity}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-700">
                                            ${parseFloat(String(item.unit_price_snapshot)).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs text-slate-500">
                                            {(parseFloat(String(item.tax_rate_snapshot)) * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-700">
                                            ${parseFloat(String(item.tax_amount_snapshot)).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                                            ${parseFloat(String(item.line_total)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Associated Refund Requests */}
                {creditNote.refund_requests && creditNote.refund_requests.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-900">
                                Associated Refund Requests
                            </h2>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {creditNote.refund_requests.map((ref) => (
                                <div key={ref.id} className="p-4 flex items-center justify-between text-sm hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <Link
                                            href={`/admin/refunds/${ref.id}`}
                                            className="font-mono font-bold text-blue-600 hover:underline"
                                        >
                                            {ref.refund_number}
                                        </Link>
                                        <Badge variant="outline">{ref.status}</Badge>
                                        <span className="text-xs text-slate-400">Method: {ref.payment_method}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono font-semibold text-slate-900">
                                            ${parseFloat(String(ref.amount)).toFixed(2)}
                                        </span>
                                        <Link href={`/admin/refunds/${ref.id}`}>
                                            <Button variant="ghost" size="sm">View</Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Request Refund */}
            {isRefundModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Create Refund Request</h3>
                                <p className="text-xs text-slate-500 font-mono">Credit Note: {creditNote.credit_number}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsRefundModalOpen(false)}
                                className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <form onSubmit={handleCreateRefund} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Refund Amount (USD)
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={String(creditNote.remaining_balance)}
                                    value={data.requested_amount}
                                    onChange={(e) => setData('requested_amount', e.target.value)}
                                    required
                                    className="font-mono"
                                />
                                <span className="text-xs text-slate-400 mt-0.5 block">
                                    Max available refundable: ${parseFloat(String(creditNote.remaining_balance)).toFixed(2)}
                                </span>
                                {errors.requested_amount && (
                                    <p className="text-xs text-rose-600 mt-1">{errors.requested_amount}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Disbursement Payment Method (V1)
                                </label>
                                <select
                                    value={data.payment_method}
                                    onChange={(e) => setData('payment_method', e.target.value as 'CASH' | 'CHEQUE' | 'MONEY_ORDER')}
                                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm text-slate-800 bg-white"
                                >
                                    <option value="CASH">CASH (Physical Cash Disbursement)</option>
                                    <option value="CHEQUE">CHEQUE (Bank Cheque Payout)</option>
                                    <option value="MONEY_ORDER">MONEY_ORDER (Postal Money Order)</option>
                                </select>
                                {errors.payment_method && (
                                    <p className="text-xs text-rose-600 mt-1">{errors.payment_method}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Refund Justification Reason
                                </label>
                                <Input
                                    value={data.reason}
                                    onChange={(e) => setData('reason', e.target.value)}
                                    placeholder="Enter refund reason..."
                                    required
                                />
                                {errors.reason && (
                                    <p className="text-xs text-rose-600 mt-1">{errors.reason}</p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsRefundModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {processing ? 'Submitting...' : 'Submit Refund Request'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
