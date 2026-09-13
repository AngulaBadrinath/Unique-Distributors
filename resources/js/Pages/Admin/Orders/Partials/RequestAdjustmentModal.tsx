import React, { useState, useId, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { AdjustmentReasonCode } from '@/types/order';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    AlertTriangle,
    SlidersHorizontal,
    Calculator,
    ShieldAlert,
    CheckCircle2,
    X,
    Loader2,
    Info,
    ArrowDownRight,
} from 'lucide-react';

interface AdjustmentEligibleItem {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    unit: string;
    ordered_quantity: number;
    fulfillable_quantity: number;
    allocated_quantity?: number;
    unallocated_quantity?: number;
    unit_price: string;
    tax_rate: string;
}

interface RequestAdjustmentModalProps {
    isOpen: boolean;
    orderId: number;
    orderNumber: string;
    items: AdjustmentEligibleItem[];
    onClose: () => void;
}

const REASON_OPTIONS: Array<{ value: AdjustmentReasonCode; label: string; description: string }> = [
    {
        value: 'CUSTOMER_REQUEST',
        label: 'Customer Request',
        description: 'Customer requested quantity cancellation or reduction',
    },
    {
        value: 'WAREHOUSE_DAMAGE',
        label: 'Warehouse Damage',
        description: 'Product damaged in warehouse prior to fulfillment',
    },
    {
        value: 'STOCKOUT_DEFECT',
        label: 'Stockout / Defect',
        description: 'Physical shortage, defect, or inventory count mismatch',
    },
    {
        value: 'PRICING_DISPUTE',
        label: 'Pricing Dispute',
        description: 'Commercial pricing adjustment requiring line cancellation',
    },
    {
        value: 'OTHER',
        label: 'Other Documented Reason',
        description: 'Operational exception with mandatory audit notes',
    },
];

export default function RequestAdjustmentModal({
    isOpen,
    orderId,
    orderNumber,
    items,
    onClose,
}: RequestAdjustmentModalProps) {
    const [reductions, setReductions] = useState<Record<number, number>>({});
    const [reasonCode, setReasonCode] = useState<AdjustmentReasonCode>('CUSTOMER_REQUEST');
    const [notes, setNotes] = useState('');
    const [idempotencyKey, setIdempotencyKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Initialize/reset form state whenever opened
    useEffect(() => {
        if (isOpen) {
            setReductions({});
            setReasonCode('CUSTOMER_REQUEST');
            setNotes('');
            setSubmitError(null);
            setIdempotencyKey(
                typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `adj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            );
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Filter to items that can actually be reduced (fulfillable > 0)
    const eligibleItems = items.filter((i) => i.fulfillable_quantity > 0);

    const handleQuantityChange = (itemId: number, maxFulfillable: number, valueStr: string) => {
        const parsed = parseInt(valueStr, 10);
        if (isNaN(parsed) || parsed <= 0) {
            setReductions((prev) => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
            return;
        }

        const clamped = Math.min(parsed, maxFulfillable);
        setReductions((prev) => ({
            ...prev,
            [itemId]: clamped,
        }));
    };

    // Calculate item-level impacts and aggregate financial projections
    let totalReductionUnits = 0;
    let projectedSubtotalReduction = 0;
    let projectedTaxReduction = 0;
    let hasCaseBImpact = false;

    const lineCalculations = eligibleItems.map((item) => {
        const reduction = reductions[item.id] || 0;
        const unallocated =
            item.unallocated_quantity !== undefined
                ? item.unallocated_quantity
                : Math.max(0, item.fulfillable_quantity - (item.allocated_quantity || 0));

        const isCaseB = reduction > unallocated;
        const affectedAllocation = isCaseB ? reduction - unallocated : 0;

        if (isCaseB) {
            hasCaseBImpact = true;
        }

        const unitPrice = parseFloat(item.unit_price) || 0;
        const taxRate = parseFloat(item.tax_rate) || 0;

        const lineSubtotal = reduction * unitPrice;
        const lineTax = lineSubtotal * (taxRate / 100);

        totalReductionUnits += reduction;
        projectedSubtotalReduction += lineSubtotal;
        projectedTaxReduction += lineTax;

        return {
            item,
            reduction,
            unallocated,
            isCaseB,
            affectedAllocation,
            lineSubtotal,
            lineTax,
            lineTotal: lineSubtotal + lineTax,
        };
    });

    const projectedGrandTotalReduction = projectedSubtotalReduction + projectedTaxReduction;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (totalReductionUnits <= 0) {
            setSubmitError('Please specify a quantity reduction of at least 1 unit on one or more items.');
            return;
        }

        const requestItems = Object.entries(reductions)
            .filter(([_, qty]) => qty > 0)
            .map(([itemIdStr, qty]) => ({
                order_item_id: parseInt(itemIdStr, 10),
                requested_quantity_reduction: qty,
            }));

        setIsSubmitting(true);

        router.post(
            `/orders/${orderId}/adjustments`,
            {
                idempotency_key: idempotencyKey,
                reason_code: reasonCode,
                notes: notes.trim() || undefined,
                items: requestItems,
            },
            {
                onSuccess: () => {
                    onClose();
                },
                onError: (errors) => {
                    const firstError = Object.values(errors)[0] as string;
                    setSubmitError(firstError || 'Failed to submit adjustment request.');
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
            aria-labelledby="request-adjustment-title"
        >
            <div className="w-full max-w-3xl my-8 p-6 bg-card border rounded-2xl shadow-xl space-y-5 text-foreground">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <SlidersHorizontal className="h-5 w-5" />
                            </div>
                            <h2 id="request-adjustment-title" className="text-lg font-bold text-foreground">
                                Request Order Adjustment
                            </h2>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Submit a post-submission quantity reduction request for Order{' '}
                            <span className="font-mono font-bold text-foreground">{orderNumber}</span>.
                        </p>
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

                {submitError && (
                    <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{submitError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Eligible Order Items Table */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                                Select Line Items & Reductions
                            </span>
                            <span className="text-muted-foreground">
                                {eligibleItems.length} eligible line item{eligibleItems.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                            <div className="overflow-x-auto max-h-72 divide-y">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[10px] sticky top-0 bg-card">
                                        <tr>
                                            <th className="py-2.5 px-3 font-semibold">Product & SKU</th>
                                            <th className="py-2.5 px-3 font-semibold text-center">Fulfillable</th>
                                            <th className="py-2.5 px-3 font-semibold text-center">Unallocated</th>
                                            <th className="py-2.5 px-3 font-semibold text-center w-28">Reduction Qty</th>
                                            <th className="py-2.5 px-3 font-semibold">Allocation Impact</th>
                                            <th className="py-2.5 px-3 font-semibold text-right">Proj. Reduction</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {lineCalculations.map(
                                            ({
                                                item,
                                                reduction,
                                                unallocated,
                                                isCaseB,
                                                affectedAllocation,
                                                lineTotal,
                                            }) => (
                                                <tr
                                                    key={item.id}
                                                    className={`hover:bg-muted/30 transition-colors ${
                                                        reduction > 0 ? 'bg-primary/5' : ''
                                                    }`}
                                                >
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-medium text-foreground">
                                                            {item.product_name}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground font-mono">
                                                            {item.sku} • ${item.unit_price} / {item.unit}
                                                        </div>
                                                    </td>

                                                    <td className="py-2.5 px-3 text-center font-mono font-semibold">
                                                        {item.fulfillable_quantity}
                                                    </td>

                                                    <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                                                        {unallocated}
                                                    </td>

                                                    <td className="py-2.5 px-3 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={item.fulfillable_quantity}
                                                            value={reductions[item.id] ?? ''}
                                                            onChange={(e) =>
                                                                handleQuantityChange(
                                                                    item.id,
                                                                    item.fulfillable_quantity,
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder="0"
                                                            className="w-20 px-2 py-1 text-xs text-center border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                                        />
                                                    </td>

                                                    <td className="py-2.5 px-3">
                                                        {reduction === 0 ? (
                                                            <span className="text-muted-foreground text-[11px]">—</span>
                                                        ) : isCaseB ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-semibold dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700"
                                                            >
                                                                Case B: {affectedAllocation} allocated
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-medium dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                                            >
                                                                Case A: Clean
                                                            </Badge>
                                                        )}
                                                    </td>

                                                    <td className="py-2.5 px-3 text-right font-mono font-medium">
                                                        {reduction > 0 ? (
                                                            <span className="text-red-600 dark:text-red-400">
                                                                -${lineTotal.toFixed(2)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">$0.00</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Reason Code & Notes Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground block">
                                Reason Code <span className="text-destructive">*</span>
                            </label>
                            <select
                                value={reasonCode}
                                onChange={(e) => setReasonCode(e.target.value as AdjustmentReasonCode)}
                                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {REASON_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label} — {opt.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground block">
                                Operational Audit Notes
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                maxLength={1000}
                                rows={2}
                                placeholder="Explain reason and business context for this adjustment..."
                                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* Live Financial Projection Summary Card */}
                    <div className="p-4 bg-muted/40 rounded-xl border space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <Calculator className="h-4 w-4 text-primary" />
                                <span>Projected Financial Reduction</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                                Total Reduction: <span className="font-mono font-bold text-foreground">-{totalReductionUnits} Units</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="p-2.5 bg-background rounded-lg border">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                                    Subtotal Reduction
                                </div>
                                <div className="text-sm font-mono font-bold text-red-600 dark:text-red-400 mt-0.5">
                                    -${projectedSubtotalReduction.toFixed(2)}
                                </div>
                            </div>

                            <div className="p-2.5 bg-background rounded-lg border">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                                    Tax Reduction
                                </div>
                                <div className="text-sm font-mono font-bold text-red-600 dark:text-red-400 mt-0.5">
                                    -${projectedTaxReduction.toFixed(2)}
                                </div>
                            </div>

                            <div className="p-2.5 bg-background rounded-lg border">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                                    Grand Total Reduction
                                </div>
                                <div className="text-sm font-mono font-bold text-red-600 dark:text-red-400 mt-0.5">
                                    -${projectedGrandTotalReduction.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-background/60 p-2.5 rounded-lg border">
                            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <span>
                                Financial projections and Case A/B indicators are informational snapshots. Baseline order totals, historical tax records, and warehouse inventory reservations remain strictly unmutated until an administrative review approves and applies the adjustment.
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || totalReductionUnits <= 0}
                            className="gap-2 shadow-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Submitting Request...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Submit Adjustment Request
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
