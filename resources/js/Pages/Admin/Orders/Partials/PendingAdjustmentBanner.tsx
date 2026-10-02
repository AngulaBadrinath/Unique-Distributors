import React, { useState } from 'react';
import { router, Link, usePage } from '@inertiajs/react';
import { ActiveAdjustmentData } from '@/types/order';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    AlertTriangle,
    Clock,
    User,
    Calendar,
    ArrowDownRight,
    XCircle,
    Loader2,
    ShieldAlert,
    CheckCircle2,
    Info,
    FileText,
} from 'lucide-react';

interface PendingAdjustmentBannerProps {
    orderId: number;
    orderNumber: string;
    activeAdjustment: ActiveAdjustmentData;
}

export default function PendingAdjustmentBanner({
    orderId,
    orderNumber,
    activeAdjustment,
}: PendingAdjustmentBannerProps) {
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [withdrawalReason, setWithdrawalReason] = useState('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [withdrawError, setWithdrawError] = useState<string | null>(null);

    const { auth } = usePage<any>().props;
    const canReview = auth?.user?.permissions?.includes('order.adjust.review') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(auth?.user?.role || '');

    const hasCaseB = activeAdjustment.items.some((item) => item.is_case_b);
    const totalReductionUnits = activeAdjustment.items.reduce(
        (sum, item) => sum + item.requested_quantity_reduction,
        0
    );

    const handleConfirmWithdraw = (e: React.FormEvent) => {
        e.preventDefault();
        setIsWithdrawing(true);
        setWithdrawError(null);

        router.post(
            `/orders/${orderId}/adjustments/${activeAdjustment.id}/withdraw`,
            {
                reason: withdrawalReason.trim() || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsWithdrawModalOpen(false);
                    setWithdrawalReason('');
                },
                onError: (errors) => {
                    setWithdrawError(
                        errors.reason ||
                            errors.conflict ||
                            errors.unauthorized ||
                            'Failed to withdraw adjustment request.'
                    );
                },
                onFinish: () => {
                    setIsWithdrawing(false);
                },
            }
        );
    };

    return (
        <>
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800 p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-800/80 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg shrink-0">
                            <Clock className="h-5 w-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-bold text-amber-950 dark:text-amber-100">
                                    {activeAdjustment.adjustment_number}
                                </span>
                                <Badge
                                    variant="outline"
                                    className="bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-[11px] font-semibold"
                                >
                                    {activeAdjustment.status_label}
                                </Badge>
                                {hasCaseB && (
                                    <Badge
                                        variant="outline"
                                        className="bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 text-[11px] font-semibold flex items-center gap-1"
                                    >
                                        <ShieldAlert className="h-3 w-3" />
                                        Case B: Allocation-Impacting
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                                Pending review and authorization. Order baseline pricing and inventory remain unaffected.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {canReview && (
                            <Link href={`/admin/orders/${orderId}/adjustments/${activeAdjustment.id}/review`}>
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    className="text-xs shrink-0 gap-1.5 shadow-xs"
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>Open Review Workspace</span>
                                </Button>
                            </Link>
                        )}

                        {activeAdjustment.can_withdraw && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsWithdrawModalOpen(true)}
                                className="text-xs border-amber-300 bg-white/70 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:bg-amber-950/40 dark:border-amber-700 dark:hover:bg-red-950/60 dark:hover:text-red-300 shrink-0 gap-1.5"
                            >
                                <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                <span>Withdraw Request</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Metadata & Financial Reduction Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white/60 dark:bg-muted/40 rounded-lg border border-amber-200/60 dark:border-amber-800/40 space-y-1">
                        <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                            Requester & Reason
                        </span>
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{activeAdjustment.requested_by || 'Unknown'}</span>
                        </div>
                        <div className="text-muted-foreground">
                            Reason: <span className="font-medium text-foreground">{activeAdjustment.reason_label}</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white/60 dark:bg-muted/40 rounded-lg border border-amber-200/60 dark:border-amber-800/40 space-y-1">
                        <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                            Requested Units
                        </span>
                        <div className="text-base font-bold font-mono text-foreground flex items-center gap-1">
                            <ArrowDownRight className="h-4 w-4 text-amber-600" />
                            <span>-{totalReductionUnits} Units</span>
                        </div>
                        <div className="text-muted-foreground">
                            Across {activeAdjustment.items.length} order line{activeAdjustment.items.length !== 1 ? 's' : ''}
                        </div>
                    </div>

                    <div className="p-3 bg-white/60 dark:bg-muted/40 rounded-lg border border-amber-200/60 dark:border-amber-800/40 space-y-1">
                        <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                            Projected Subtotal & Tax
                        </span>
                        <div className="text-foreground font-mono">
                            Subtotal: <span className="font-semibold text-red-600 dark:text-red-400">-${activeAdjustment.projected_subtotal_reduction}</span>
                        </div>
                        <div className="text-muted-foreground font-mono">
                            Tax: <span className="font-medium text-red-600 dark:text-red-400">-${activeAdjustment.projected_tax_reduction}</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white/60 dark:bg-muted/40 rounded-lg border border-amber-200/60 dark:border-amber-800/40 space-y-1">
                        <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                            Projected Grand Total Reduction
                        </span>
                        <div className="text-base font-bold font-mono text-red-600 dark:text-red-400">
                            -${activeAdjustment.projected_grand_total_reduction}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                            Informational snapshot only
                        </div>
                    </div>
                </div>

                {/* Items preview table */}
                <div className="overflow-x-auto rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-white/40 dark:bg-muted/20">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200/60 dark:border-amber-800/50 text-muted-foreground uppercase text-[10px]">
                            <tr>
                                <th className="py-2 px-3 font-semibold">Item</th>
                                <th className="py-2 px-3 font-semibold text-right">Requested Reduction</th>
                                <th className="py-2 px-3 font-semibold">Allocation Impact</th>
                                <th className="py-2 px-3 font-semibold text-right">Projected Reduction</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-200/40 dark:divide-amber-800/40">
                            {activeAdjustment.items.map((item) => (
                                <tr key={item.order_item_id} className="hover:bg-amber-100/30 dark:hover:bg-amber-900/20">
                                    <td className="py-2 px-3">
                                        <span className="font-medium text-foreground">{item.product_name}</span>
                                        <span className="text-muted-foreground font-mono ml-2 text-[11px]">({item.sku})</span>
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-900 dark:text-amber-200">
                                        -{item.requested_quantity_reduction}
                                    </td>
                                    <td className="py-2 px-3">
                                        {item.is_case_b ? (
                                            <Badge
                                                variant="outline"
                                                className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-semibold dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700"
                                            >
                                                Case B: {item.affected_allocation_quantity} units allocated
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-medium dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                            >
                                                Case A: Unallocated only
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-red-600 dark:text-red-400 font-medium">
                                        -${item.projected_line_total_reduction}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {activeAdjustment.notes && (
                    <div className="text-xs text-muted-foreground bg-white/50 dark:bg-muted/30 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                        <span className="font-semibold text-foreground">Requester Notes: </span>
                        {activeAdjustment.notes}
                    </div>
                )}
            </div>

            {/* Withdrawal Confirmation Dialog Modal */}
            {isWithdrawModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="withdraw-dialog-title"
                >
                    <div className="w-full max-w-md p-6 bg-card border rounded-xl shadow-lg space-y-4">
                        <div className="flex items-center gap-3 text-destructive">
                            <div className="p-2 bg-destructive/10 rounded-full">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <h3 id="withdraw-dialog-title" className="text-lg font-semibold text-foreground">
                                Withdraw Adjustment Request?
                            </h3>
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Are you sure you want to withdraw request{' '}
                            <span className="font-mono font-bold text-foreground">
                                {activeAdjustment.adjustment_number}
                            </span>
                            ? The request will transition to <span className="font-semibold">CANCELLED</span>, and the order will return to standard operational processing.
                        </p>

                        {withdrawError && (
                            <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{withdrawError}</span>
                            </div>
                        )}

                        <form onSubmit={handleConfirmWithdraw} className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-foreground block mb-1">
                                    Withdrawal Reason (Optional)
                                </label>
                                <textarea
                                    value={withdrawalReason}
                                    onChange={(e) => setWithdrawalReason(e.target.value)}
                                    maxLength={500}
                                    rows={3}
                                    placeholder="State why this adjustment request is being withdrawn..."
                                    className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2 border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsWithdrawModalOpen(false);
                                        setWithdrawError(null);
                                    }}
                                    disabled={isWithdrawing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={isWithdrawing}
                                >
                                    {isWithdrawing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Withdrawing...
                                        </>
                                    ) : (
                                        'Confirm Withdrawal'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
