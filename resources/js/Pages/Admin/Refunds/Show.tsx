import React, { useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    RefreshCw,
    ArrowLeft,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    CreditCard,
    User,
    Building,
    FileText,
    Receipt,
    Banknote,
    X,
} from 'lucide-react';

interface Actor {
    id: number;
    name: string;
    email?: string;
    role?: string;
}

interface RefundEvent {
    id: number;
    refund_request_id: number;
    actor_id: number;
    actor?: Actor;
    action: string;
    from_status: string | null;
    to_status: string;
    note: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
}

interface RefundTransaction {
    id: number;
    transaction_number: string;
    status: string;
    amount: string | number;
    payment_method: string;
    reference_number: string | null;
    processed_at: string;
    processor?: Actor;
    metadata?: Record<string, any> | null;
}

interface CreditNoteSummary {
    id: number;
    credit_number: string;
    status: string;
    total_amount: string | number;
    allocated_to_refunds: string | number;
    remaining_balance: string | number;
    issued_at: string;
    order?: {
        id: number;
        order_number: string;
    };
    items?: Array<{
        id: number;
        product_name_snapshot: string;
        sku_snapshot: string;
        quantity: number;
        line_total: string | number;
    }>;
}

interface RefundRequestDetail {
    id: number;
    refund_number: string;
    customer_id: number;
    credit_note_id: number;
    status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PROCESSING' | 'PROCESSED' | 'REJECTED' | 'CANCELLED';
    amount: string | number;
    payment_method: 'CASH' | 'CHEQUE' | 'MONEY_ORDER';
    reason: string;
    notes: string | null;
    requested_by: number;
    requested_at: string;
    reviewed_by: number | null;
    reviewed_at: string | null;
    approved_by: number | null;
    approved_at: string | null;
    rejected_by: number | null;
    rejected_at: string | null;
    reject_reason: string | null;
    cancelled_by: number | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    processed_at: string | null;
    customer?: {
        id: number;
        name: string;
        code: string;
    };
    credit_note?: CreditNoteSummary;
    requester?: Actor;
    reviewer?: Actor;
    approver?: Actor;
    rejector?: Actor;
    canceller?: Actor;
    events?: RefundEvent[];
    transaction?: RefundTransaction;
}

interface Props {
    refundRequest: RefundRequestDetail;
}

export default function Show({ refundRequest }: Props) {
    const { auth } = usePage().props as unknown as { auth: { user: { id: number; name: string; role: string } } };
    const currentUserId = auth?.user?.id;
    const isSuperAdmin = auth?.user?.role === 'SUPER_ADMIN';

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);

    // Form handlers
    const reviewForm = useForm({});
    const approveForm = useForm({});
    
    const rejectForm = useForm({
        reason: '',
    });

    const cancelForm = useForm({
        reason: '',
    });

    const processForm = useForm({
        reference_number: '',
        notes: '',
        idempotency_key: `REF-PROC-${refundRequest.id}-${Date.now()}`,
    });

    const isRequester = currentUserId === refundRequest.requested_by;
    const canApproveMakerChecker = !isRequester || isSuperAdmin;

    const handleReview = () => {
        reviewForm.post(`/admin/refunds/${refundRequest.id}/review`);
    };

    const handleApprove = () => {
        approveForm.post(`/admin/refunds/${refundRequest.id}/approve`);
    };

    const handleReject = (e: React.FormEvent) => {
        e.preventDefault();
        rejectForm.post(`/admin/refunds/${refundRequest.id}/reject`, {
            onSuccess: () => setIsRejectModalOpen(false),
        });
    };

    const handleCancel = (e: React.FormEvent) => {
        e.preventDefault();
        cancelForm.post(`/admin/refunds/${refundRequest.id}/cancel`, {
            onSuccess: () => setIsCancelModalOpen(false),
        });
    };

    const handleProcess = (e: React.FormEvent) => {
        e.preventDefault();
        processForm.post(`/admin/refunds/${refundRequest.id}/process`, {
            onSuccess: () => setIsProcessModalOpen(false),
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'REQUESTED':
                return (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 py-1 px-3">
                        <Clock className="w-3.5 h-3.5" /> REQUESTED
                    </Badge>
                );
            case 'UNDER_REVIEW':
                return (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1.5 py-1 px-3">
                        <Clock className="w-3.5 h-3.5" /> UNDER REVIEW
                    </Badge>
                );
            case 'APPROVED':
                return (
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1.5 py-1 px-3">
                        <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
                    </Badge>
                );
            case 'PROCESSING':
                return (
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 gap-1.5 py-1 px-3">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> PROCESSING
                    </Badge>
                );
            case 'PROCESSED':
                return (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1 px-3">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PROCESSED (DISBURSED)
                    </Badge>
                );
            case 'REJECTED':
                return (
                    <Badge className="bg-rose-50 text-rose-700 border-rose-200 gap-1.5 py-1 px-3">
                        <XCircle className="w-3.5 h-3.5" /> REJECTED
                    </Badge>
                );
            case 'CANCELLED':
                return (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-300 gap-1.5 py-1 px-3">
                        <AlertTriangle className="w-3.5 h-3.5" /> CANCELLED
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <AppLayout title={`Refund Request ${refundRequest.refund_number}`}>
            <Head title={`Refund Request ${refundRequest.refund_number}`} />

            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/refunds">
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                                    {refundRequest.refund_number}
                                </h1>
                                {getStatusBadge(refundRequest.status)}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Requested on {new Date(refundRequest.requested_at).toLocaleString()} by {refundRequest.requester?.name || 'User'}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                        {refundRequest.status === 'REQUESTED' && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleReview}
                                    disabled={reviewForm.processing}
                                    className="gap-1.5"
                                >
                                    <Clock className="w-4 h-4 text-blue-600" />
                                    Mark Under Review
                                </Button>
                                <Button
                                    onClick={handleApprove}
                                    disabled={approveForm.processing || (!canApproveMakerChecker)}
                                    className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Approve Refund
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsRejectModalOpen(true)}
                                    className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsCancelModalOpen(true)}
                                    className="gap-1.5 text-slate-500 hover:text-slate-700"
                                >
                                    Cancel
                                </Button>
                            </>
                        )}

                        {refundRequest.status === 'UNDER_REVIEW' && (
                            <>
                                <Button
                                    onClick={handleApprove}
                                    disabled={approveForm.processing || (!canApproveMakerChecker)}
                                    className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Approve Refund
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsRejectModalOpen(true)}
                                    className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsCancelModalOpen(true)}
                                    className="gap-1.5 text-slate-500 hover:text-slate-700"
                                >
                                    Cancel
                                </Button>
                            </>
                        )}

                        {refundRequest.status === 'APPROVED' && (
                            <>
                                <Button
                                    onClick={() => setIsProcessModalOpen(true)}
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <Banknote className="w-4 h-4" />
                                    Process Disbursement
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsCancelModalOpen(true)}
                                    className="text-slate-600"
                                >
                                    Cancel
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Maker-Checker Warning Banner if Self-Approval is blocked */}
                {isRequester && !isSuperAdmin && (refundRequest.status === 'REQUESTED' || refundRequest.status === 'UNDER_REVIEW') && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800 text-sm">
                        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="font-semibold">Segregation of Duties (Maker-Checker Rule)</div>
                            <div className="text-xs text-amber-700 mt-0.5">
                                You requested this refund. Under financial governance rules, you cannot approve your own request. A different authorized manager must approve or reject it.
                            </div>
                        </div>
                    </div>
                )}

                {/* Rejection / Cancellation Notice if applicable */}
                {refundRequest.status === 'REJECTED' && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-800 text-sm">
                        <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="font-semibold">Refund Request Rejected</div>
                            <div className="text-xs text-rose-700 mt-0.5">
                                Reason: {refundRequest.reject_reason || 'No reason provided.'}
                            </div>
                            <div className="text-xs text-rose-500 mt-1">
                                Rejected by {refundRequest.rejector?.name || 'Manager'} on {refundRequest.rejected_at ? new Date(refundRequest.rejected_at).toLocaleString() : ''}
                            </div>
                        </div>
                    </div>
                )}

                {refundRequest.status === 'CANCELLED' && (
                    <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 flex items-start gap-3 text-slate-800 text-sm">
                        <AlertTriangle className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="font-semibold">Refund Request Cancelled</div>
                            <div className="text-xs text-slate-600 mt-0.5">
                                Reason: {refundRequest.cancellation_reason || 'No reason provided.'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Cancelled by {refundRequest.canceller?.name || 'User'} on {refundRequest.cancelled_at ? new Date(refundRequest.cancelled_at).toLocaleString() : ''}
                            </div>
                        </div>
                    </div>
                )}

                {/* Financial KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Requested Refund Amount
                        </span>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                            ${parseFloat(String(refundRequest.amount)).toFixed(2)}
                        </div>
                        <span className="text-xs text-slate-400 mt-1 block">
                            Disbursement Method: <span className="font-semibold text-slate-700">{refundRequest.payment_method}</span>
                        </span>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Source Credit Note Total
                        </span>
                        <div className="text-2xl font-bold font-mono text-slate-700 mt-1">
                            ${parseFloat(String(refundRequest.credit_note?.total_amount || 0)).toFixed(2)}
                        </div>
                        <span className="text-xs text-slate-400 mt-1 block">
                            Credit Note: <span className="font-mono font-semibold">{refundRequest.credit_note?.credit_number}</span>
                        </span>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Remaining Credit Note Balance
                        </span>
                        <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                            ${parseFloat(String(refundRequest.credit_note?.remaining_balance || 0)).toFixed(2)}
                        </div>
                        <span className="text-xs text-slate-400 mt-1 block">
                            Remaining available after this allocation
                        </span>
                    </div>
                </div>

                {/* Disbursement Receipt (If Processed) */}
                {refundRequest.transaction && (
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                Disbursement Settlement Receipt
                            </div>
                            <span className="font-mono text-xs text-emerald-700 font-bold">
                                {refundRequest.transaction.transaction_number}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-emerald-600 block">Disbursed Amount</span>
                                <span className="text-base font-bold font-mono text-emerald-950">
                                    ${parseFloat(String(refundRequest.transaction.amount)).toFixed(2)}
                                </span>
                            </div>
                            <div>
                                <span className="text-emerald-600 block">Payment Method</span>
                                <span className="font-semibold text-emerald-950 font-mono">
                                    {refundRequest.transaction.payment_method}
                                </span>
                            </div>
                            <div>
                                <span className="text-emerald-600 block">Bank / Payout Reference #</span>
                                <span className="font-mono text-emerald-950">
                                    {refundRequest.transaction.reference_number || 'N/A (Direct Cash)'}
                                </span>
                            </div>
                            <div>
                                <span className="text-emerald-600 block">Disbursed At & By</span>
                                <span className="text-emerald-950">
                                    {new Date(refundRequest.transaction.processed_at).toLocaleString()} by {refundRequest.transaction.processor?.name || 'Cashier'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Request Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Customer & Details */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-semibold text-sm">
                            <User className="w-4 h-4 text-slate-500" />
                            Customer & Request Context
                        </div>
                        <div className="space-y-2 text-xs text-slate-600">
                            <div><span className="font-semibold text-slate-800">Customer Name:</span> {refundRequest.customer?.name}</div>
                            <div><span className="font-semibold text-slate-800">Account Code:</span> <span className="font-mono">{refundRequest.customer?.code}</span></div>
                            <div><span className="font-semibold text-slate-800">Refund Reason:</span> {refundRequest.reason}</div>
                            {refundRequest.notes && <div><span className="font-semibold text-slate-800">Internal Notes:</span> {refundRequest.notes}</div>}
                        </div>
                    </div>

                    {/* Maker-Checker & Governance Status */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-semibold text-sm">
                            <ShieldCheck className="w-4 h-4 text-slate-500" />
                            Maker-Checker Governance Chain
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Requested By (Maker):</span>
                                <span className="font-semibold text-slate-800">
                                    {refundRequest.requester?.name || 'User'} ({new Date(refundRequest.requested_at).toLocaleDateString()})
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Reviewed By:</span>
                                <span className="text-slate-800 font-medium">
                                    {refundRequest.reviewer ? `${refundRequest.reviewer.name} (${new Date(refundRequest.reviewed_at!).toLocaleDateString()})` : 'Pending / Not Applicable'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Approved By (Checker):</span>
                                <span className="text-slate-800 font-medium">
                                    {refundRequest.approver ? `${refundRequest.approver.name} (${new Date(refundRequest.approved_at!).toLocaleDateString()})` : 'Not yet approved'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Disbursed By (Cashier):</span>
                                <span className="text-slate-800 font-medium">
                                    {refundRequest.transaction?.processor?.name || (refundRequest.status === 'PROCESSED' ? 'Cashier' : 'Pending disbursement')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Credit Note Source Details */}
                {refundRequest.credit_note && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-slate-500" />
                                <h2 className="text-sm font-semibold text-slate-900">
                                    Originating Credit Note Reference
                                </h2>
                            </div>
                            <Link
                                href={`/admin/credits/${refundRequest.credit_note.id}`}
                                className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                                View Full Credit Note →
                            </Link>
                        </div>
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-slate-400 block">Credit Note #</span>
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                    {refundRequest.credit_note.credit_number}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Issued Total</span>
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                    ${parseFloat(String(refundRequest.credit_note.total_amount)).toFixed(2)}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Allocated To Refunds</span>
                                <span className="font-mono font-bold text-amber-600 text-sm">
                                    ${parseFloat(String(refundRequest.credit_note.allocated_to_refunds)).toFixed(2)}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Remaining Balance</span>
                                <span className="font-mono font-bold text-emerald-700 text-sm">
                                    ${parseFloat(String(refundRequest.credit_note.remaining_balance)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Audit Lifecycle Stream / Event History */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <h2 className="text-sm font-semibold text-slate-900">
                                Authoritative Audit Trail & Lifecycle Events
                            </h2>
                        </div>
                        <span className="text-xs text-slate-400">
                            {refundRequest.events?.length || 0} events recorded
                        </span>
                    </div>
                    <div className="p-6">
                        <div className="relative border-l border-slate-200 ml-4 space-y-6">
                            {refundRequest.events && refundRequest.events.length > 0 ? (
                                refundRequest.events.map((evt) => (
                                    <div key={evt.id} className="relative pl-6">
                                        {/* Timeline node */}
                                        <div className="absolute -left-2 top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-900" />
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-xs text-slate-900 uppercase tracking-wide">
                                                    {evt.action}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                                    {evt.to_status}
                                                </Badge>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {new Date(evt.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">
                                            Actor: <span className="font-medium text-slate-900">{evt.actor?.name || `User #${evt.actor_id}`}</span>
                                            {evt.note && <span className="text-slate-500"> — {evt.note}</span>}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-slate-400 pl-4">No events logged.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Reject Refund */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-bold text-slate-900">Reject Refund Request</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsRejectModalOpen(false)}
                                className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <form onSubmit={handleReject} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Rejection Reason (Required)
                                </label>
                                <Input
                                    value={rejectForm.data.reason}
                                    onChange={(e) => rejectForm.setData('reason', e.target.value)}
                                    placeholder="Enter reason for rejecting refund..."
                                    required
                                />
                                {rejectForm.errors.reason && (
                                    <p className="text-xs text-rose-600 mt-1">{rejectForm.errors.reason}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsRejectModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={rejectForm.processing}
                                    className="bg-rose-600 hover:bg-rose-700 text-white"
                                >
                                    {rejectForm.processing ? 'Rejecting...' : 'Confirm Rejection'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Cancel Refund */}
            {isCancelModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-bold text-slate-900">Cancel Refund Request</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsCancelModalOpen(false)}
                                className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <form onSubmit={handleCancel} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Cancellation Reason (Optional)
                                </label>
                                <Input
                                    value={cancelForm.data.reason}
                                    onChange={(e) => cancelForm.setData('reason', e.target.value)}
                                    placeholder="Enter reason for cancelling..."
                                />
                                {cancelForm.errors.reason && (
                                    <p className="text-xs text-rose-600 mt-1">{cancelForm.errors.reason}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsCancelModalOpen(false)}
                                >
                                    Back
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={cancelForm.processing}
                                    variant="destructive"
                                >
                                    {cancelForm.processing ? 'Cancelling...' : 'Confirm Cancellation'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Process Disbursement */}
            {isProcessModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Process Disbursement</h3>
                                <p className="text-xs text-slate-500 font-mono">Amount: ${parseFloat(String(refundRequest.amount)).toFixed(2)} ({refundRequest.payment_method})</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsProcessModalOpen(false)}
                                className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <form onSubmit={handleProcess} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Bank / Check / Receipt Reference #
                                </label>
                                <Input
                                    value={processForm.data.reference_number}
                                    onChange={(e) => processForm.setData('reference_number', e.target.value)}
                                    placeholder="e.g. CHQ-99124 or Receipt #"
                                    className="font-mono"
                                />
                                {processForm.errors.reference_number && (
                                    <p className="text-xs text-rose-600 mt-1">{processForm.errors.reference_number}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Disbursement Notes
                                </label>
                                <Input
                                    value={processForm.data.notes}
                                    onChange={(e) => processForm.setData('notes', e.target.value)}
                                    placeholder="Optional cashier notes..."
                                />
                                {processForm.errors.notes && (
                                    <p className="text-xs text-rose-600 mt-1">{processForm.errors.notes}</p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsProcessModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={processForm.processing}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {processForm.processing ? 'Processing...' : 'Confirm Disbursement'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
