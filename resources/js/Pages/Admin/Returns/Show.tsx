import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    RotateCcw,
    ArrowLeft,
    PackageCheck,
    ShieldCheck,
    XCircle,
    Ban,
    Clock,
    Building2,
    CheckCircle2,
    FileText
} from 'lucide-react';
import InspectReturnModal from './Partials/InspectReturnModal';
import ApproveReturnModal from './Partials/ApproveReturnModal';

interface ReturnItem {
    id: number;
    return_request_id: number;
    order_item_id: number;
    product_id: number;
    requested_quantity: number;
    received_quantity: number;
    accepted_good_quantity: number;
    accepted_damaged_quantity: number;
    rejected_quantity: number;
    unit_price_snapshot: string | number;
    tax_rate_snapshot: string | number;
    tax_amount_snapshot: string | number;
    line_total: string | number;
    reason_code: string;
    item_notes?: string;
    product?: {
        name: string;
        sku: string;
        unit: string;
    };
    order_item?: {
        product_name_snapshot: string;
        sku_snapshot: string;
        unit_snapshot: string;
    };
}

interface ReturnEvent {
    id: number;
    actor_id: number;
    event_type: string;
    payload: any;
    created_at: string;
    actor?: {
        id: number;
        name: string;
        role: string;
    };
}

interface ReturnRequestDetail {
    id: number;
    return_number: string;
    order_id: number;
    customer_id: number;
    salesman_id?: number;
    warehouse_id: number;
    status: 'REQUESTED' | 'UNDER_REVIEW' | 'INSPECTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    created_by: number;
    inspected_by?: number;
    approved_by?: number;
    requested_at: string;
    inspected_at?: string;
    approved_at?: string;
    rejected_at?: string;
    cancelled_at?: string;
    rejection_reason?: string;
    notes?: string;
    inspection_notes?: string;
    evidence_photos?: string[];
    estimated_refund_subtotal: string | number;
    estimated_refund_tax: string | number;
    estimated_refund_total: string | number;
    is_credit_processed: boolean;
    credit_note_id?: number;
    items: ReturnItem[];
    events: ReturnEvent[];
    customer?: {
        id: number;
        name: string;
        code: string;
        email?: string;
        phone?: string;
    };
    order?: {
        id: number;
        order_number: string;
        total_amount: string | number;
        created_at: string;
    };
    warehouse?: {
        id: number;
        name: string;
        code: string;
    };
    created_by_user?: {
        id: number;
        name: string;
    };
    inspected_by_user?: {
        id: number;
        name: string;
    };
    approved_by_user?: {
        id: number;
        name: string;
    };
}

interface Props {
    returnRequest: ReturnRequestDetail;
    isSalesmanView?: boolean;
}

export default function Show({ returnRequest, isSalesmanView = false }: Props) {
    const [isInspectOpen, setIsInspectOpen] = useState(false);
    const [isApproveOpen, setIsApproveOpen] = useState(false);

    const getStatusBadge = (statusVal: string) => {
        switch (statusVal) {
            case 'REQUESTED':
                return <Badge variant="warning">Requested</Badge>;
            case 'UNDER_REVIEW':
                return <Badge variant="action">Under Review</Badge>;
            case 'INSPECTED':
                return <Badge variant="brand">Inspected</Badge>;
            case 'APPROVED':
                return <Badge variant="success">Approved</Badge>;
            case 'REJECTED':
                return <Badge variant="destructive">Rejected</Badge>;
            case 'CANCELLED':
                return <Badge variant="neutral">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{statusVal}</Badge>;
        }
    };

    const handleReject = () => {
        const reason = prompt('Please enter a mandatory rejection reason:');
        if (!reason || reason.trim() === '') return;

        router.post(`/admin/returns/${returnRequest.id}/reject`, {
            rejection_reason: reason,
        });
    };

    const handleCancel = () => {
        if (confirm('Are you sure you want to withdraw and cancel this return request?')) {
            const targetUrl = isSalesmanView
                ? `/salesman/returns/${returnRequest.id}/cancel`
                : `/admin/returns/${returnRequest.id}/cancel`;
            router.post(targetUrl);
        }
    };

    const backUrl = isSalesmanView ? '/salesman/returns' : '/admin/returns';

    const totalRequested = (returnRequest.items || []).reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0);
    const totalReceived = (returnRequest.items || []).reduce((sum, item) => sum + Number(item.received_quantity || 0), 0);

    return (
        <AppLayout>
            <Head title={`Return ${returnRequest.return_number}`} />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header and Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href={backUrl}
                            className="inline-flex items-center justify-center h-9 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent text-slate-800 dark:text-slate-200"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1.5" />
                            Back
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                    {returnRequest.return_number}
                                </h1>
                                {getStatusBadge(returnRequest.status)}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Order: <span className="font-semibold text-slate-700 dark:text-slate-300">{returnRequest.order?.order_number}</span> •
                                Customer: <span className="font-semibold text-slate-700 dark:text-slate-300">{returnRequest.customer?.name}</span>
                            </p>
                        </div>
                    </div>

                    {!isSalesmanView && (
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Inspect Button */}
                            {(returnRequest.status === 'REQUESTED' || returnRequest.status === 'UNDER_REVIEW') && (
                                <Button
                                    onClick={() => setIsInspectOpen(true)}
                                    variant="action"
                                    className="gap-1.5"
                                >
                                    <PackageCheck className="w-4 h-4" />
                                    Warehouse Inspection
                                </Button>
                            )}

                            {/* Approve Button */}
                            {returnRequest.status === 'INSPECTED' && (
                                <Button
                                    onClick={() => setIsApproveOpen(true)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Approve &amp; Disposition
                                </Button>
                            )}

                            {/* Reject Button */}
                            {returnRequest.status !== 'APPROVED' && returnRequest.status !== 'REJECTED' && returnRequest.status !== 'CANCELLED' && (
                                <Button
                                    variant="outline"
                                    onClick={handleReject}
                                    className="text-rose-600 hover:bg-rose-50 border-rose-200 gap-1.5"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Reject Return
                                </Button>
                            )}

                            {/* Cancel Button */}
                            {returnRequest.status === 'REQUESTED' && (
                                <Button
                                    variant="ghost"
                                    onClick={handleCancel}
                                    className="text-slate-500 hover:bg-slate-100 gap-1.5"
                                >
                                    <Ban className="w-4 h-4" />
                                    Cancel Request
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left 2 Cols: Line Items and Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Line Items Table */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-between items-center">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <RotateCcw className="w-4 h-4 text-primary" />
                                    Merchandise Return Line Items
                                </h2>
                                <span className="text-xs text-slate-500 font-medium">
                                    {returnRequest.items.length} item(s)
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                    <thead className="bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 uppercase text-xs border-b border-slate-200 dark:border-slate-700 font-semibold">
                                        <tr>
                                            <th className="px-5 py-3">Product</th>
                                            <th className="px-3 py-3 text-center">Requested</th>
                                            <th className="px-3 py-3 text-center">Received</th>
                                            <th className="px-3 py-3 text-center text-emerald-700 dark:text-emerald-400">Good</th>
                                            <th className="px-3 py-3 text-center text-amber-700 dark:text-amber-400">Damaged</th>
                                            <th className="px-3 py-3 text-center text-rose-700 dark:text-rose-400">Rejected</th>
                                            <th className="px-5 py-3 text-right">Est. Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-750">
                                        {returnRequest.items.map(item => {
                                            const productName = item.product?.name || item.order_item?.product_name_snapshot || 'Product';
                                            const sku = item.product?.sku || item.order_item?.sku_snapshot || '';

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                                                    <td className="px-5 py-3.5">
                                                        <p className="font-semibold text-slate-900 dark:text-slate-100">{productName}</p>
                                                        <p className="text-xs text-slate-400">SKU: {sku} • Reason: {item.reason_code}</p>
                                                        {item.item_notes && (
                                                            <p className="text-xs text-slate-500 italic mt-0.5">Notes: {item.item_notes}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                        {item.requested_quantity}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-semibold text-action-accent">
                                                        {item.received_quantity > 0 ? item.received_quantity : '—'}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-bold text-emerald-700 dark:text-emerald-400">
                                                        {item.accepted_good_quantity > 0 ? item.accepted_good_quantity : '—'}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-bold text-amber-700 dark:text-amber-400">
                                                        {item.accepted_damaged_quantity > 0 ? item.accepted_damaged_quantity : '—'}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-bold text-rose-700 dark:text-rose-400">
                                                        {item.rejected_quantity > 0 ? item.rejected_quantity : '—'}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-foreground">
                                                        ${parseFloat(String(item.line_total || 0)).toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Financial Subtotals */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                                <div className="text-right space-y-1">
                                    <div className="text-xs text-slate-500">Total Units Requested: <span className="font-semibold text-slate-800 dark:text-slate-200">{totalRequested}</span></div>
                                    <div className="text-xs text-slate-500">Total Received: <span className="font-semibold text-slate-800 dark:text-slate-200">{totalReceived}</span></div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-700">
                                        Estimated Refund Total: {' '}
                                        <span className="text-emerald-700 dark:text-emerald-400">${parseFloat(String(returnRequest.estimated_refund_total || 0)).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inspection & Disposition Notes */}
                        {(returnRequest.notes || returnRequest.inspection_notes || returnRequest.rejection_reason) && (
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Return Notes &amp; Documentation
                                </h3>

                                {returnRequest.notes && (
                                    <div className="p-3 bg-muted/40 rounded border border-border text-sm">
                                        <span className="font-semibold text-foreground block text-xs">Request Notes</span>
                                        <p className="text-muted-foreground mt-1">{returnRequest.notes}</p>
                                    </div>
                                )}

                                {returnRequest.inspection_notes && (
                                    <div className="p-3 bg-brand-surface/30 rounded border border-brand-surface-foreground/20 text-sm">
                                        <span className="font-semibold text-brand-surface-foreground block text-xs">Warehouse Inspection Notes</span>
                                        <p className="text-brand-surface-foreground/90 mt-1">{returnRequest.inspection_notes}</p>
                                    </div>
                                )}

                                {returnRequest.rejection_reason && (
                                    <div className="p-3 bg-destructive/10 rounded border border-destructive/20 text-sm">
                                        <span className="font-semibold text-destructive block text-xs">Rejection Reason</span>
                                        <p className="text-destructive/90 mt-1">{returnRequest.rejection_reason}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Col: Metadata & Audit Events */}
                    <div className="space-y-6">
                        {/* Meta Card */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-xs space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary" />
                                Return Specifications
                            </h3>

                            <dl className="divide-y divide-border/60 text-sm space-y-3">
                                <div className="pt-2 flex justify-between">
                                    <dt className="text-muted-foreground">Customer</dt>
                                    <dd className="font-semibold text-foreground text-right">
                                        {returnRequest.customer?.name} ({returnRequest.customer?.code})
                                    </dd>
                                </div>
                                <div className="pt-2 flex justify-between">
                                    <dt className="text-muted-foreground">Original Order</dt>
                                    <dd className="font-semibold text-action-accent text-right">
                                        <Link href={`/admin/orders/${returnRequest.order_id}`} className="hover:underline">
                                            {returnRequest.order?.order_number}
                                        </Link>
                                    </dd>
                                </div>
                                <div className="pt-2 flex justify-between">
                                    <dt className="text-muted-foreground">Target Warehouse</dt>
                                    <dd className="font-semibold text-foreground text-right">
                                        {returnRequest.warehouse?.name}
                                    </dd>
                                </div>
                                <div className="pt-2 flex justify-between">
                                    <dt className="text-muted-foreground">Requested Date</dt>
                                    <dd className="font-medium text-foreground text-right">
                                        {new Date(returnRequest.requested_at).toLocaleString()}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Audit Timeline */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-xs space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                Immutable Lifecycle Timeline
                            </h3>

                            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                {returnRequest.events?.map((ev, idx) => (
                                    <div key={ev.id || idx} className="flex items-start gap-3 relative pl-1">
                                        <div className="w-6 h-6 rounded-full bg-brand-surface border border-brand-surface-foreground/30 text-brand-surface-foreground flex items-center justify-center shrink-0 z-10">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-brand-surface-foreground" />
                                        </div>
                                        <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                                            <div className="flex justify-between items-center font-semibold text-slate-800 dark:text-slate-200">
                                                <span>{ev.event_type}</span>
                                                <span className="text-slate-400 font-normal">
                                                    {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 mt-0.5">
                                                By: {ev.actor?.name || 'System User'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modals */}
                <InspectReturnModal
                    isOpen={isInspectOpen}
                    onClose={() => setIsInspectOpen(false)}
                    returnRequest={returnRequest}
                />

                <ApproveReturnModal
                    isOpen={isApproveOpen}
                    onClose={() => setIsApproveOpen(false)}
                    returnRequest={returnRequest}
                />
            </div>
        </AppLayout>
    );
}
