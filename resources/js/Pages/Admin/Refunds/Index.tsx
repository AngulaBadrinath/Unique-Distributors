import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    RefreshCw,
    Search,
    Eye,
    Receipt,
    CreditCard,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    Banknote,
    FileText,
} from 'lucide-react';

interface RefundRequestRow {
    id: number;
    refund_number: string;
    customer_id: number;
    credit_note_id: number;
    status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PROCESSING' | 'PROCESSED' | 'REJECTED' | 'CANCELLED';
    amount: string | number;
    payment_method: 'CASH' | 'CHEQUE' | 'MONEY_ORDER';
    reason: string;
    requested_at: string;
    requested_by: number;
    reviewed_at?: string | null;
    approved_at?: string | null;
    processed_at?: string | null;
    rejected_at?: string | null;
    cancelled_at?: string | null;
    customer?: {
        id: number;
        name: string;
        code: string;
    };
    credit_note?: {
        id: number;
        credit_number: string;
        total_amount: string | number;
        remaining_balance: string | number;
    };
    requester?: {
        id: number;
        name: string;
    };
    approver?: {
        id: number;
        name: string;
    };
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedRefunds {
    data: RefundRequestRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface Props {
    refundRequests: PaginatedRefunds;
    filters: {
        status?: string;
        customer_id?: string | number;
        credit_note_id?: string | number;
        search?: string;
        per_page?: number;
    };
    statuses?: Array<{ value: string; label: string }>;
}

export default function Index({ refundRequests, filters, statuses = [] }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');

    const handleFilter = (newStatus?: string) => {
        const queryParams: Record<string, any> = {};
        const s = newStatus !== undefined ? newStatus : status;
        if (s) queryParams.status = s;
        if (search) queryParams.search = search;
        if (filters.credit_note_id) queryParams.credit_note_id = filters.credit_note_id;
        if (filters.customer_id) queryParams.customer_id = filters.customer_id;

        router.get('/admin/refunds', queryParams, {
            preserveState: true,
            replace: true,
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilter();
    };

    const getStatusBadge = (refundStatus: string) => {
        switch (refundStatus) {
            case 'REQUESTED':
                return (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                        <Clock className="w-3 h-3" /> REQUESTED
                    </Badge>
                );
            case 'UNDER_REVIEW':
                return (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                        <Clock className="w-3 h-3" /> UNDER REVIEW
                    </Badge>
                );
            case 'APPROVED':
                return (
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> APPROVED
                    </Badge>
                );
            case 'PROCESSING':
                return (
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> PROCESSING
                    </Badge>
                );
            case 'PROCESSED':
                return (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> PROCESSED
                    </Badge>
                );
            case 'REJECTED':
                return (
                    <Badge className="bg-rose-50 text-rose-700 border-rose-200 gap-1">
                        <XCircle className="w-3 h-3" /> REJECTED
                    </Badge>
                );
            case 'CANCELLED':
                return (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-300 gap-1">
                        <AlertTriangle className="w-3 h-3" /> CANCELLED
                    </Badge>
                );
            default:
                return <Badge variant="outline">{refundStatus}</Badge>;
        }
    };

    const getPaymentMethodBadge = (method: string) => {
        switch (method) {
            case 'CASH':
                return <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">CASH</span>;
            case 'CHEQUE':
                return <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">CHEQUE</span>;
            case 'MONEY_ORDER':
                return <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-100">MONEY ORDER</span>;
            default:
                return <span className="font-mono text-xs text-slate-600">{method}</span>;
        }
    };

    return (
        <AppLayout title="Customer Refund Requests">
            <Head title="Customer Refund Requests" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Customer Refund Requests
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Maker-checker governed refund disbursements against available credit note balances.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/credits">
                            <Button variant="outline" className="gap-2">
                                <CreditCard className="w-4 h-4 text-slate-500" />
                                Credit Notes
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search by Refund #, Customer name/code, or Credit Note #..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 h-10 w-full"
                                />
                            </div>
                            <Button type="submit" variant="secondary" className="h-10">
                                Search
                            </Button>
                        </form>

                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                            <Button
                                type="button"
                                variant={status === '' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setStatus('');
                                    handleFilter('');
                                }}
                                className="h-9"
                            >
                                All Statuses
                            </Button>
                            <Button
                                type="button"
                                variant={status === 'REQUESTED' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setStatus('REQUESTED');
                                    handleFilter('REQUESTED');
                                }}
                                className="h-9"
                            >
                                Pending Review
                            </Button>
                            <Button
                                type="button"
                                variant={status === 'APPROVED' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setStatus('APPROVED');
                                    handleFilter('APPROVED');
                                }}
                                className="h-9"
                            >
                                Approved (To Process)
                            </Button>
                            <Button
                                type="button"
                                variant={status === 'PROCESSED' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setStatus('PROCESSED');
                                    handleFilter('PROCESSED');
                                }}
                                className="h-9"
                            >
                                Disbursed
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Desktop Data Table */}
                <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                                <tr>
                                    <th className="px-6 py-4">Refund #</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Source Credit Note</th>
                                    <th className="px-6 py-4">Method</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    <th className="px-6 py-4">Requested By & Date</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {refundRequests.data.length > 0 ? (
                                    refundRequests.data.map((req) => (
                                        <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-4 font-mono font-semibold text-slate-900">
                                                {req.refund_number}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-900">{req.customer?.name || 'Customer'}</div>
                                                <div className="text-xs text-slate-400 font-mono">{req.customer?.code || ''}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs">
                                                {req.credit_note ? (
                                                    <Link
                                                        href={`/admin/credits/${req.credit_note.id}`}
                                                        className="text-blue-600 hover:underline font-semibold"
                                                    >
                                                        {req.credit_note.credit_number}
                                                    </Link>
                                                ) : (
                                                    <span className="text-slate-400">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getPaymentMethodBadge(req.payment_method)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                                                ${parseFloat(String(req.amount)).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                <div>{req.requester?.name || 'User'}</div>
                                                <div className="text-slate-400">{new Date(req.requested_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {getStatusBadge(req.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/admin/refunds/${req.id}`}>
                                                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-600 hover:text-slate-900">
                                                        <Eye className="w-4 h-4" />
                                                        Details
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                            <RefreshCw className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                            <p className="text-base font-semibold text-slate-700">No refund requests found</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Refund requests can be initiated from eligible credit notes with positive remaining balance.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile / Tablet Cards View */}
                <div className="lg:hidden space-y-4">
                    {refundRequests.data.length > 0 ? (
                        refundRequests.data.map((req) => (
                            <div key={req.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-slate-900 text-base">
                                        {req.refund_number}
                                    </span>
                                    {getStatusBadge(req.status)}
                                </div>

                                <div className="border-t border-slate-100 pt-2 space-y-1">
                                    <div className="text-sm font-semibold text-slate-800">{req.customer?.name}</div>
                                    <div className="text-xs text-slate-400 font-mono">Code: {req.customer?.code}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg text-xs font-mono">
                                    <div>
                                        <span className="text-slate-400 block">Refund Amount</span>
                                        <span className="font-bold text-slate-900">${parseFloat(String(req.amount)).toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Disbursement Method</span>
                                        <span className="font-semibold text-slate-700">{req.payment_method}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                                    <span>Requested: {new Date(req.requested_at).toLocaleDateString()}</span>
                                    <Link href={`/admin/refunds/${req.id}`}>
                                        <Button variant="outline" size="sm" className="h-8 gap-1">
                                            <Eye className="w-3.5 h-3.5" />
                                            Review
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
                            <RefreshCw className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                            <p className="text-base font-semibold text-slate-700">No refund requests found</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {refundRequests.last_page > 1 && (
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-medium">{refundRequests.from}</span> to{' '}
                            <span className="font-medium">{refundRequests.to}</span> of{' '}
                            <span className="font-medium">{refundRequests.total}</span> refund requests
                        </div>
                        <div className="flex gap-1">
                            {refundRequests.links.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.url || '#'}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                                        link.active
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : link.url
                                            ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                                            : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
