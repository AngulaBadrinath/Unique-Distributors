import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import {
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    X,
    Loader2,
    Calculator,
    Lock,
} from 'lucide-react';

interface ApproveAdjustmentModalProps {
    isOpen: boolean;
    orderId: number;
    orderNumber: string;
    adjustmentId: number;
    adjustmentNumber: string;
    hasAllocationImpact: boolean;
    totalAffectedAllocationQuantity: number;
    projectedReductions: {
        subtotal: string;
        tax_total: string;
        grand_total: string;
    };
    isRequester: boolean;
    isSuperAdmin: boolean;
    onClose: () => void;
}

export default function ApproveAdjustmentModal({
    isOpen,
    orderId,
    orderNumber,
    adjustmentId,
    adjustmentNumber,
    hasAllocationImpact,
    totalAffectedAllocationQuantity,
    projectedReductions,
    isRequester,
    isSuperAdmin,
    onClose,
}: ApproveAdjustmentModalProps) {
    const [acknowledgeAllocation, setAcknowledgeAllocation] = useState(false);
    const [emergencyOverrideReason, setEmergencyOverrideReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setAcknowledgeAllocation(false);
            setEmergencyOverrideReason('');
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isSubmitting) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen) return null;

    const requiresEmergencyOverride = isRequester && isSuperAdmin;
    const canSubmit =
        !isSubmitting &&
        (!hasAllocationImpact || acknowledgeAllocation) &&
        (!requiresEmergencyOverride || emergencyOverrideReason.trim().length >= 10);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        setErrorMessage(null);

        router.post(
            `/admin/orders/${orderId}/adjustments/${adjustmentId}/approve`,
            {
                acknowledge_allocation_impact: acknowledgeAllocation,
                emergency_override_reason: requiresEmergencyOverride ? emergencyOverrideReason.trim() : null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                },
                onError: (errors) => {
                    const first = Object.values(errors)[0] as string;
                    setErrorMessage(first || 'Failed to approve adjustment.');
                },
                onFinish: () => {
                    setIsSubmitting(false);
                },
            }
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-adjustment-title"
        >
            <div className="w-full max-w-lg my-8 p-6 bg-card border rounded-2xl shadow-xl space-y-5 text-foreground">
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 id="approve-adjustment-title" className="text-lg font-bold text-foreground">
                                Approve Adjustment Request
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Order <span className="font-mono font-medium text-foreground">{orderNumber}</span> &bull;{' '}
                                <span className="font-mono font-medium text-foreground">{adjustmentNumber}</span>
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {errorMessage && (
                    <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Financial Summary */}
                    <div className="p-3.5 bg-muted/40 rounded-xl border space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <Calculator className="h-3.5 w-3.5 text-primary" />
                            <span>Projected Financial Reduction</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 bg-background rounded-lg border">
                                <span className="text-[10px] text-muted-foreground block">Subtotal</span>
                                <span className="font-mono font-bold text-red-600 dark:text-red-400">
                                    -${projectedReductions.subtotal}
                                </span>
                            </div>
                            <div className="p-2 bg-background rounded-lg border">
                                <span className="text-[10px] text-muted-foreground block">Tax</span>
                                <span className="font-mono font-bold text-red-600 dark:text-red-400">
                                    -${projectedReductions.tax_total}
                                </span>
                            </div>
                            <div className="p-2 bg-background rounded-lg border">
                                <span className="text-[10px] text-muted-foreground block">Grand Total</span>
                                <span className="font-mono font-bold text-red-600 dark:text-red-400">
                                    -${projectedReductions.grand_total}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Case B Allocation Impact Warning & Acknowledgment */}
                    {hasAllocationImpact && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                            <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                <div className="space-y-0.5 text-xs">
                                    <h4 className="font-semibold">Case B: Active Allocation Impact</h4>
                                    <p className="text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                                        This adjustment reduces active warehouse allocations by{' '}
                                        <span className="font-bold font-mono text-foreground">
                                            {totalAffectedAllocationQuantity}
                                        </span>{' '}
                                        units. Upon application, allocated quantities will be released/de-allocated.
                                    </p>
                                </div>
                            </div>

                            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer pt-1 border-t border-amber-500/20">
                                <input
                                    type="checkbox"
                                    checked={acknowledgeAllocation}
                                    onChange={(e) => setAcknowledgeAllocation(e.target.checked)}
                                    disabled={isSubmitting}
                                    className="rounded border-amber-500/40 text-amber-600 focus:ring-amber-500 h-4 w-4"
                                />
                                <span className="font-medium">
                                    I acknowledge that active allocations will be modified upon application.
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Super Admin Emergency Override Section */}
                    {requiresEmergencyOverride && (
                        <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2.5">
                            <div className="flex items-start gap-2 text-blue-800 dark:text-blue-300">
                                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                                <div className="space-y-0.5 text-xs">
                                    <h4 className="font-semibold">Super Admin Emergency Override</h4>
                                    <p className="text-blue-700/90 dark:text-blue-300/90 leading-relaxed">
                                        You are approving an adjustment that you personally submitted. Document the emergency business justification below (mandatory for audit compliance).
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <textarea
                                    value={emergencyOverrideReason}
                                    onChange={(e) => setEmergencyOverrideReason(e.target.value)}
                                    disabled={isSubmitting}
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="Provide detailed emergency justification (min 10 characters)..."
                                    className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                    <span>Minimum 10 characters</span>
                                    <span>{emergencyOverrideReason.trim().length} / 1000</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Informational Decision Boundary Note */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>Approval authorizes the request. Order quantities and inventory are preserved until adjustment application.</span>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            size="sm"
                            disabled={!canSubmit}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Approving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Confirm Approval</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
