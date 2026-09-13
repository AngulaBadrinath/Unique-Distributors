import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import {
    AlertTriangle,
    X,
    Loader2,
    XCircle,
    ShieldAlert,
    RotateCcw,
} from 'lucide-react';

interface RejectAdjustmentModalProps {
    isOpen: boolean;
    orderId: number;
    orderNumber: string;
    adjustmentId: number;
    adjustmentNumber: string;
    isRequester: boolean;
    isSuperAdmin: boolean;
    onClose: () => void;
}

export default function RejectAdjustmentModal({
    isOpen,
    orderId,
    orderNumber,
    adjustmentId,
    adjustmentNumber,
    isRequester,
    isSuperAdmin,
    onClose,
}: RejectAdjustmentModalProps) {
    const [reason, setReason] = useState('');
    const [emergencyOverrideReason, setEmergencyOverrideReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setReason('');
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

    const trimmedReason = reason.trim();
    const requiresEmergencyOverride = isRequester && isSuperAdmin;
    const canSubmit =
        !isSubmitting &&
        trimmedReason.length >= 5 &&
        trimmedReason.length <= 1000 &&
        (!requiresEmergencyOverride || emergencyOverrideReason.trim().length >= 10);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        setErrorMessage(null);

        router.post(
            `/admin/orders/${orderId}/adjustments/${adjustmentId}/reject`,
            {
                reason: trimmedReason,
                emergency_override_reason: requiresEmergencyOverride ? emergencyOverrideReason.trim() : null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                },
                onError: (errors) => {
                    const first = Object.values(errors)[0] as string;
                    setErrorMessage(first || 'Failed to reject adjustment.');
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
            aria-labelledby="reject-adjustment-title"
        >
            <div className="w-full max-w-lg my-8 p-6 bg-card border border-destructive/30 rounded-2xl shadow-xl space-y-5 text-foreground">
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-destructive/10 text-destructive rounded-xl">
                            <XCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 id="reject-adjustment-title" className="text-lg font-bold text-foreground">
                                Reject Adjustment Request
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
                    {/* Rejection Consequence Callout */}
                    <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-destructive">
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Terminal Rejection</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                            Rejecting this adjustment is permanent. The order adjustment status will be reset, allowing salesmen or warehouse staff to submit a new request if needed.
                        </p>
                    </div>

                    {/* Mandatory Rejection Reason */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>
                                Rejection Reason <span className="text-destructive">*</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground font-normal">
                                {trimmedReason.length} / 1000 characters
                            </span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={isSubmitting}
                            rows={3}
                            maxLength={1000}
                            placeholder="Provide a specific explanation for rejecting this adjustment (min 5 characters)..."
                            className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-[11px] text-muted-foreground">
                            Minimum 5 characters required for audit trail.
                        </span>
                    </div>

                    {/* Super Admin Emergency Override Section */}
                    {requiresEmergencyOverride && (
                        <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2.5">
                            <div className="flex items-start gap-2 text-blue-800 dark:text-blue-300">
                                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                                <div className="space-y-0.5 text-xs">
                                    <h4 className="font-semibold">Super Admin Emergency Override</h4>
                                    <p className="text-blue-700/90 dark:text-blue-300/90 leading-relaxed">
                                        You are rejecting an adjustment that you personally submitted. Document the emergency business justification below (mandatory for audit compliance).
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
                            variant="destructive"
                            size="sm"
                            disabled={!canSubmit}
                            className="gap-1.5"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Rejecting...</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span>Confirm Rejection</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
