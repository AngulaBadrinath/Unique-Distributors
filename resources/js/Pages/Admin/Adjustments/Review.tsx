import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import {
    OrderAdjustmentReviewDetailData,
    OrderAdjustmentReviewEvaluation,
} from '@/types/order';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    User,
    Building2,
    Package,
    ArrowLeft,
    ShieldAlert,
    AlertCircle,
    Boxes,
    Receipt,
    History,
    ChevronDown,
    ChevronUp,
    Info,
    X,
    Zap,
    RotateCcw,
} from 'lucide-react';
import ApproveAdjustmentModal from './Partials/ApproveAdjustmentModal';
import RejectAdjustmentModal from './Partials/RejectAdjustmentModal';
import ApplyAdjustmentModal from './Partials/ApplyAdjustmentModal';
import ReverseAdjustmentModal from './Partials/ReverseAdjustmentModal';

interface AdjustmentReviewProps {
    adjustment: OrderAdjustmentReviewDetailData;
    evaluation: OrderAdjustmentReviewEvaluation;
    can: {
        review: boolean;
        approve: boolean;
        reject: boolean;
        apply?: boolean;
        reverse?: boolean;
        is_requester?: boolean;
        is_super_admin?: boolean;
    };
}

export default function AdjustmentReview({
    adjustment,
    evaluation,
    can,
}: AdjustmentReviewProps) {
    const [expandedAllocations, setExpandedAllocations] = useState<Record<number, boolean>>({});
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);

    const toggleAllocationExpand = (itemId: number) => {
        setExpandedAllocations((prev) => ({
            ...prev,
            [itemId]: !prev[itemId],
        }));
    };

    const renderEvaluationBanner = () => {
        switch (evaluation.evaluation_status) {
            case 'READY':
                return (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-3 text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold">Ready for Review</h4>
                            <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90">
                                This adjustment request is mathematically valid and fully consistent with current order quantities and fulfillment allocations.
                            </p>
                        </div>
                    </div>
                );

            case 'WARNING_ALLOCATION':
                return (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3 text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold">Case B Allocation Impact Detected</h4>
                            <p className="text-xs text-amber-700/90 dark:text-amber-300/90">
                                This request requires reducing active allocations ({evaluation.total_affected_allocation_quantity} units affected).
                                Future approval will require allocation release handling.
                            </p>
                            {evaluation.stale_reasons.length > 0 && (
                                <ul className="list-disc list-inside text-xs mt-1.5 space-y-0.5">
                                    {evaluation.stale_reasons.map((reason, idx) => (
                                        <li key={idx}>{reason}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                );

            case 'WARNING_PICKED_ENCROACHMENT':
                return (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 flex items-start gap-3 text-rose-800 dark:text-rose-300">
                        <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold">Warning: Encroaches on Picked Stock</h4>
                            <p className="text-xs text-rose-700/90 dark:text-rose-300/90">
                                The requested reduction exceeds unpicked allocated units. Stock has already been physically picked in the warehouse and cannot be released without physical inventory restocking.
                            </p>
                            {evaluation.stale_reasons.length > 0 && (
                                <ul className="list-disc list-inside text-xs mt-1.5 space-y-0.5">
                                    {evaluation.stale_reasons.map((reason, idx) => (
                                        <li key={idx}>{reason}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                );

            case 'CONFLICTED':
                return (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3 text-destructive">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold">Quantity Conflict Detected</h4>
                            <p className="text-xs text-destructive/90">
                                One or more requested reductions exceed the current fulfillable quantity on the order. This request cannot be legally approved as submitted.
                            </p>
                            {evaluation.stale_reasons.length > 0 && (
                                <ul className="list-disc list-inside text-xs mt-1.5 space-y-0.5">
                                    {evaluation.stale_reasons.map((reason, idx) => (
                                        <li key={idx}>{reason}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                );

            case 'STALE':
                return (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3 text-amber-800 dark:text-amber-300">
                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold">Stale Request State</h4>
                            <p className="text-xs text-amber-700/90 dark:text-amber-300/90">
                                The order version or operational state has changed since this adjustment was submitted. Review current live order state carefully before making decisions.
                            </p>
                            {evaluation.stale_reasons.length > 0 && (
                                <ul className="list-disc list-inside text-xs mt-1.5 space-y-0.5">
                                    {evaluation.stale_reasons.map((reason, idx) => (
                                        <li key={idx}>{reason}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                );

            case 'INELIGIBLE_LIFECYCLE':
                return (
                    <div className="bg-muted border border-border rounded-lg p-4 flex items-start gap-3 text-muted-foreground">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-foreground">Order in Ineligible Lifecycle</h4>
                            <p className="text-xs">
                                The associated order has reached a terminal state ({adjustment.current_order_status_label}). Adjustments can only be processed on active orders.
                            </p>
                        </div>
                    </div>
                );

            case 'TERMINAL_REQUEST':
                if (adjustment.status === 'REVERSED') {
                    return (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3 text-destructive">
                            <RotateCcw className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-foreground">Adjustment Reversed (Terminal)</h4>
                                <p className="text-xs text-muted-foreground">
                                    This adjustment was reversed on {adjustment.reversed_at_formatted ?? 'recently'}
                                    {adjustment.reversed_by?.name ? ` by ${adjustment.reversed_by.name}` : ''}.
                                    All original quantities and financial totals have been restored.
                                </p>
                                {adjustment.reversal_reason && (
                                    <div className="text-xs text-foreground mt-1.5 bg-card/80 p-2.5 rounded-md border border-destructive/20 font-mono">
                                        <span className="text-muted-foreground font-sans font-semibold">Reason: </span>
                                        {adjustment.reversal_reason}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="bg-muted border border-border rounded-lg p-4 flex items-start gap-3 text-muted-foreground">
                        <History className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-foreground">
                                {adjustment.status === 'APPLIED' ? 'Adjustment Applied' : `Request Inactive (${adjustment.status_label})`}
                            </h4>
                            <p className="text-xs">
                                {adjustment.status === 'APPLIED'
                                    ? `This adjustment has been atomically applied to Order ${adjustment.order_number}. Order quantities, allocations, and financials have been updated.`
                                    : `This adjustment request is inactive (${adjustment.status_label}). It is displayed for historical audit and inspection purposes only.`}
                            </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <AppLayout title={`Review Adjustment ${adjustment.adjustment_number}`}>
            <Head title={`Review Adjustment ${adjustment.adjustment_number}`} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Navigation Breadcrumb & Back Link */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Link href="/admin/adjustments" className="hover:text-foreground transition-colors flex items-center gap-1">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>Adjustment Queue</span>
                        </Link>
                        <span>/</span>
                        <Link href={`/admin/orders/${adjustment.order_id}`} className="hover:text-foreground transition-colors">
                            {adjustment.order_number}
                        </Link>
                        <span>/</span>
                        <span className="text-foreground font-mono font-medium">{adjustment.adjustment_number}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href={`/admin/orders/${adjustment.order_id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                                <span>View Full Order</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Main Header */}
                <div className="bg-card border border-border rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                                {adjustment.adjustment_number}
                            </h1>
                            <Badge
                                variant={
                                    adjustment.status === 'SUBMITTED'
                                        ? 'default'
                                        : adjustment.status === 'APPROVED'
                                        ? 'default'
                                        : 'secondary'
                                }
                                className="text-xs"
                            >
                                {adjustment.status_label}
                            </Badge>
                            {evaluation.has_allocation_impact ? (
                                <Badge variant="destructive" className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Case B (Allocation Affected)</span>
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Case A (Unallocated Only)</span>
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Order <span className="font-medium text-foreground">{adjustment.order_number}</span> &bull; Submitted on {adjustment.requested_at_formatted} by {adjustment.requested_by.name} ({adjustment.requested_by.role_label})
                        </p>
                    </div>

                    {/* Header Action Controls */}
                    {adjustment.status === 'SUBMITTED' ? (
                        <div className="flex flex-wrap items-center gap-2.5">
                            {can.is_requester && !can.is_super_admin ? (
                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-lg text-xs">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span>Maker-checker rule: As the requester, you cannot approve or reject your own request.</span>
                                </div>
                            ) : (
                                <>
                                    {can.reject && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsRejectModalOpen(true)}
                                            className="h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-1.5"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            <span>Reject Request</span>
                                        </Button>
                                    )}

                                    {can.approve && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => setIsApproveModalOpen(true)}
                                            disabled={
                                                evaluation.evaluation_status === 'CONFLICTED' ||
                                                evaluation.evaluation_status === 'WARNING_PICKED_ENCROACHMENT' ||
                                                evaluation.evaluation_status === 'INELIGIBLE_LIFECYCLE' ||
                                                evaluation.evaluation_status === 'STALE'
                                            }
                                            className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span>Approve Adjustment</span>
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : adjustment.status === 'APPROVED' ? (
                        <div className="flex flex-wrap items-center gap-2.5">
                            {can.apply ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setIsApplyModalOpen(true)}
                                    disabled={
                                        evaluation.evaluation_status === 'CONFLICTED' ||
                                        evaluation.evaluation_status === 'WARNING_PICKED_ENCROACHMENT' ||
                                        evaluation.evaluation_status === 'INELIGIBLE_LIFECYCLE'
                                    }
                                    className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-medium"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    <span>Apply Adjustment</span>
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-lg text-xs">
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span>Approved. Awaiting administrator application.</span>
                                </div>
                            )}
                        </div>
                    ) : adjustment.status === 'APPLIED' ? (
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>
                                    Applied on <strong className="font-semibold">{adjustment.applied_at_formatted ?? 'recently'}</strong>
                                    {adjustment.applied_by?.name ? ` by ${adjustment.applied_by.name}` : ''}.
                                </span>
                            </div>

                            {can.reverse && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsReverseModalOpen(true)}
                                    disabled={
                                        evaluation.evaluation_status === 'INELIGIBLE_LIFECYCLE'
                                    }
                                    className="h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-1.5 font-medium"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>Reverse Adjustment</span>
                                </Button>
                            )}
                        </div>
                    ) : adjustment.status === 'REVERSED' ? (
                        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3.5 py-2 rounded-lg text-xs text-destructive">
                            <RotateCcw className="h-4 w-4 text-destructive shrink-0" />
                            <span>
                                Reversed on <strong className="font-semibold">{adjustment.reversed_at_formatted ?? 'recently'}</strong>
                                {adjustment.reversed_by?.name ? ` by ${adjustment.reversed_by.name}` : ''}.
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-muted border border-border px-3.5 py-2 rounded-lg text-xs text-muted-foreground">
                            <History className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>
                                Request is in terminal state <strong className="text-foreground font-semibold">{adjustment.status_label}</strong>.
                            </span>
                        </div>
                    )}
                </div>

                {/* Evaluation Status Banner */}
                {renderEvaluationBanner()}

                {/* Metadata & Context Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Requester & Reason Card */}
                    <Card className="shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <span>Requester & Reason</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <div>
                                <div className="text-muted-foreground">Requested By</div>
                                <div className="font-medium text-foreground mt-0.5">
                                    {adjustment.requested_by.name} ({adjustment.requested_by.role_label})
                                </div>
                                <div className="text-muted-foreground/80">{adjustment.requested_by.email}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Formal Reason</div>
                                <Badge variant="outline" className="mt-1 font-normal text-xs">
                                    {adjustment.reason_label}
                                </Badge>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Requester Justification Notes</div>
                                <div className="mt-1 p-2.5 rounded-md bg-muted/40 border border-border text-foreground italic text-xs">
                                    "{adjustment.notes || 'No notes provided by requester.'}"
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customer & Order Context Card */}
                    <Card className="shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <span>Customer & Order State</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <div>
                                <div className="text-muted-foreground">Customer Account</div>
                                <div className="font-medium text-foreground mt-0.5">
                                    {adjustment.customer.name} ({adjustment.customer.code})
                                </div>
                                <div className="text-muted-foreground/80">Credit Terms: {adjustment.customer.payment_terms || 'Standard'}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Order Status (Current vs Snapshot)</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline">{adjustment.current_order_status_label}</Badge>
                                    {adjustment.current_order_status !== adjustment.order_status_snapshot && (
                                        <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                            (was {adjustment.order_status_snapshot})
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Order Version</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-mono font-medium text-foreground">v{adjustment.current_order_version}</span>
                                    {adjustment.current_order_version !== adjustment.order_version_snapshot && (
                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                            Changed from v{adjustment.order_version_snapshot}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Financial Summary Card */}
                    <Card className="shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-primary" />
                                <span>Financial Impact Preview</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>Subtotal Reduction:</span>
                                    <span className="font-mono font-semibold text-destructive">
                                        -${adjustment.projected_reductions.subtotal}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>Tax Total Reduction:</span>
                                    <span className="font-mono font-semibold text-destructive">
                                        -${adjustment.projected_reductions.tax_total}
                                    </span>
                                </div>
                                <div className="border-t border-border pt-2 flex justify-between items-center font-medium">
                                    <span className="text-foreground">Grand Total Reduction:</span>
                                    <span className="font-mono text-sm font-bold text-destructive">
                                        -${adjustment.projected_reductions.grand_total}
                                    </span>
                                </div>
                            </div>

                            <div className="p-2.5 rounded-md bg-muted/40 border border-border text-[11px] text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                    <span>Current Grand Total:</span>
                                    <span className="font-mono text-foreground">${adjustment.current_order_totals.grand_total}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                    <span>Projected New Total:</span>
                                    <span className="font-mono text-foreground">
                                        ${(Number(adjustment.current_order_totals.grand_total) - Number(adjustment.projected_reductions.grand_total)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Line-by-Line Comparison Matrix */}
                <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs space-y-0">
                    <div className="px-5 py-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                <span>Line-Item Comparison Matrix: Request Snapshot vs Current Live State</span>
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Inspect requested quantity reductions against historical snapshot and current fulfillment balances.
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-border">
                        {evaluation.line_evaluations.map((line) => {
                            const isAllocExpanded = !!expandedAllocations[line.order_item_id];

                            return (
                                <div key={line.adjustment_item_id} className="p-5 space-y-4 hover:bg-muted/10 transition-colors">
                                    {/* Item Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-foreground">{line.product_name}</span>
                                                <span className="font-mono text-xs text-muted-foreground">SKU: {line.sku}</span>
                                                <Badge variant="outline" className="text-[10px]">
                                                    ${line.unit_price_snapshot} / unit &bull; Tax: {Number(line.tax_rate_snapshot) * 100}%
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {line.action_type === 'INCREASE' || ((line.requested_quantity_increase ?? 0) > 0) ? (
                                                <Badge variant="outline" className="text-xs gap-1 text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10">
                                                    <Boxes className="h-3 w-3" />
                                                    <span>Stock Increase (+ Reservation)</span>
                                                </Badge>
                                            ) : line.current_case === 'CASE_B' ? (
                                                <Badge variant="destructive" className="text-xs gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    <span>Case B: {line.current_affected_allocation_quantity} alloc. affected</span>
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    <span>Case A: Standard</span>
                                                </Badge>
                                            )}

                                            {line.case_changed && (
                                                <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
                                                    Case Shifted
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quantities Comparison Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        {/* Request-Time Snapshot */}
                                        <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                                            <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center justify-between">
                                                <span>Request-Time Snapshot</span>
                                                <span className="font-normal normal-case text-muted-foreground">Immutable</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 pt-1">
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Ordered</div>
                                                    <div className="font-mono font-medium text-foreground">{line.ordered_quantity_snapshot}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Fulfillable</div>
                                                    <div className="font-mono font-medium text-foreground">{line.fulfillable_quantity_snapshot}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Allocated</div>
                                                    <div className="font-mono font-medium text-foreground">{line.allocated_quantity_snapshot}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Unallocated</div>
                                                    <div className="font-mono font-medium text-foreground">{line.unallocated_quantity_snapshot}</div>
                                                </div>
                                            </div>
                                            <div className="border-t border-border/60 pt-2 flex justify-between items-center text-xs">
                                                {line.action_type === 'INCREASE' || ((line.requested_quantity_increase ?? 0) > 0) ? (
                                                    <>
                                                        <span className="text-muted-foreground font-medium">Requested Increase:</span>
                                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                                            +{line.requested_quantity_increase ?? line.requested_quantity_delta} units
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-muted-foreground font-medium">Requested Reduction:</span>
                                                        <span className="font-mono font-bold text-destructive">
                                                            -{line.requested_quantity_reduction} units
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Current Live Order State */}
                                        <div className={`p-3.5 rounded-lg border ${line.is_conflicted ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'} space-y-2`}>
                                            <div className="font-semibold text-foreground uppercase text-[10px] tracking-wider flex items-center justify-between">
                                                <span>Current Live State</span>
                                                <span className="font-normal normal-case text-muted-foreground">Authoritative</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 pt-1">
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Ordered</div>
                                                    <div className="font-mono font-medium text-foreground">{line.current_ordered_quantity}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Fulfillable</div>
                                                    <div className={`font-mono font-medium ${line.is_conflicted ? 'text-destructive font-bold' : 'text-foreground'}`}>
                                                        {line.current_fulfillable_quantity}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Allocated</div>
                                                    <div className="font-mono font-medium text-foreground">{line.current_allocated_quantity}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-[11px]">Unallocated</div>
                                                    <div className="font-mono font-medium text-foreground">{line.current_unallocated_quantity}</div>
                                                </div>
                                            </div>
                                            <div className="border-t border-border/60 pt-2 flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground font-medium">Live Affected Allocation:</span>
                                                <span className={`font-mono font-bold ${line.current_affected_allocation_quantity > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {line.current_affected_allocation_quantity} units
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Line Item Allocation Breakdown Toggle */}
                                    {line.allocations.length > 0 && (
                                        <div className="border border-border/80 rounded-md overflow-hidden bg-card text-xs">
                                            <button
                                                type="button"
                                                onClick={() => toggleAllocationExpand(line.order_item_id)}
                                                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 font-medium text-foreground">
                                                    <Boxes className="h-3.5 w-3.5 text-primary" />
                                                    <span>Active Allocations Breakdown ({line.allocations.length} records)</span>
                                                    <span className="text-muted-foreground font-normal">
                                                        &bull; Unpicked: {line.unpicked_allocated_quantity} units
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <span>{isAllocExpanded ? 'Hide' : 'Inspect'}</span>
                                                    {isAllocExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                </div>
                                            </button>

                                            {isAllocExpanded && (
                                                <div className="p-3 border-t border-border overflow-x-auto bg-muted/10">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="border-b border-border text-muted-foreground font-medium">
                                                                <th className="py-2 px-2">Allocation #</th>
                                                                <th className="py-2 px-2">Warehouse</th>
                                                                <th className="py-2 px-2">Status</th>
                                                                <th className="py-2 px-2 text-right">Allocated</th>
                                                                <th className="py-2 px-2 text-right">Picked</th>
                                                                <th className="py-2 px-2 text-right">Dispatched</th>
                                                                <th className="py-2 px-2 text-right">Delivered</th>
                                                                <th className="py-2 px-2 text-right">Unpicked</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/60">
                                                            {line.allocations.map((alloc) => (
                                                                <tr key={alloc.id} className="hover:bg-muted/20">
                                                                    <td className="py-2 px-2 font-mono">{alloc.allocation_number}</td>
                                                                    <td className="py-2 px-2">{alloc.warehouse_code || 'Default WH'}</td>
                                                                    <td className="py-2 px-2">
                                                                        <Badge variant="outline" className="text-[10px]">
                                                                            {alloc.status_label}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="py-2 px-2 text-right font-mono font-medium">{alloc.allocated_quantity}</td>
                                                                    <td className="py-2 px-2 text-right font-mono">{alloc.picked_quantity}</td>
                                                                    <td className="py-2 px-2 text-right font-mono">{alloc.dispatched_quantity}</td>
                                                                    <td className="py-2 px-2 text-right font-mono">{alloc.delivered_quantity}</td>
                                                                    <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                                                        {alloc.unpicked_quantity}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Audit & Follow-Up Footer */}
                <div className="bg-card border border-border rounded-lg p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>
                            Inspection complete. Formal approval, rejection, and atomic ledger execution are governed by the adjustment workflow.
                        </span>
                    </div>

                    <Link href="/admin/adjustments">
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                            Return to Adjustment Queue
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Approve Modal */}
            <ApproveAdjustmentModal
                isOpen={isApproveModalOpen}
                orderId={adjustment.order_id}
                orderNumber={adjustment.order_number}
                adjustmentId={adjustment.id}
                adjustmentNumber={adjustment.adjustment_number}
                hasAllocationImpact={evaluation.has_allocation_impact}
                totalAffectedAllocationQuantity={evaluation.total_affected_allocation_quantity}
                projectedReductions={adjustment.projected_reductions}
                isRequester={!!can.is_requester}
                isSuperAdmin={!!can.is_super_admin}
                onClose={() => setIsApproveModalOpen(false)}
            />

            {/* Reject Modal */}
            <RejectAdjustmentModal
                isOpen={isRejectModalOpen}
                orderId={adjustment.order_id}
                orderNumber={adjustment.order_number}
                adjustmentId={adjustment.id}
                adjustmentNumber={adjustment.adjustment_number}
                isRequester={!!can.is_requester}
                isSuperAdmin={!!can.is_super_admin}
                onClose={() => setIsRejectModalOpen(false)}
            />

            {/* Apply Modal */}
            <ApplyAdjustmentModal
                isOpen={isApplyModalOpen}
                orderId={adjustment.order_id}
                orderNumber={adjustment.order_number}
                adjustmentId={adjustment.id}
                adjustmentNumber={adjustment.adjustment_number}
                hasAllocationImpact={evaluation.has_allocation_impact}
                totalAffectedAllocationQuantity={evaluation.total_affected_allocation_quantity}
                projectedReductions={adjustment.projected_reductions}
                onClose={() => setIsApplyModalOpen(false)}
            />

            {/* Reverse Modal */}
            <ReverseAdjustmentModal
                isOpen={isReverseModalOpen}
                orderId={adjustment.order_id}
                orderNumber={adjustment.order_number}
                adjustmentId={adjustment.id}
                adjustmentNumber={adjustment.adjustment_number}
                hasAllocationImpact={evaluation.has_allocation_impact}
                totalAffectedAllocationQuantity={evaluation.total_affected_allocation_quantity}
                projectedReductions={adjustment.projected_reductions}
                isRequester={!!can.is_requester}
                isSuperAdmin={!!can.is_super_admin}
                onClose={() => setIsReverseModalOpen(false)}
            />
        </AppLayout>
    );
}
