import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { ShieldCheck, AlertTriangle, X, Loader2, AlertCircle } from 'lucide-react';

interface ReturnItem {
    id: number;
    product_id: number;
    requested_quantity: number;
    received_quantity: number;
    unit_price_snapshot: string | number;
    tax_rate_snapshot: string | number;
    product?: {
        name: string;
        sku: string;
    };
    order_item?: {
        product_name_snapshot: string;
        sku_snapshot: string;
    };
}

interface ReturnRequestData {
    id: number;
    return_number: string;
    items: ReturnItem[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    returnRequest: ReturnRequestData;
}

export default function ApproveReturnModal({ isOpen, onClose, returnRequest }: Props) {
    const [itemsData, setItemsData] = useState<Array<{
        item_id: number;
        accepted_good_quantity: number;
        accepted_damaged_quantity: number;
        rejected_quantity: number;
    }>>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setItemsData(returnRequest.items.map(item => ({
                item_id: item.id,
                accepted_good_quantity: item.received_quantity, // default to all good
                accepted_damaged_quantity: 0,
                rejected_quantity: 0,
            })));
            setIsSubmitting(false);
            setErrorMessage(null);
        }
    }, [isOpen, returnRequest]);

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

    const handleQtyChange = (
        itemId: number,
        field: 'accepted_good_quantity' | 'accepted_damaged_quantity' | 'rejected_quantity',
        val: string
    ) => {
        const num = parseInt(val, 10) || 0;
        setItemsData(prev => prev.map(i => i.item_id === itemId ? { ...i, [field]: num } : i));
    };

    let totalGood = 0;
    let totalDamaged = 0;
    let totalRejected = 0;
    let hasDispositionMismatch = false;

    itemsData.forEach(itemData => {
        const originalItem = returnRequest.items.find(i => i.id === itemData.item_id);
        const received = originalItem?.received_quantity ?? 0;
        const currentSum = itemData.accepted_good_quantity + itemData.accepted_damaged_quantity + itemData.rejected_quantity;

        if (currentSum !== received) {
            hasDispositionMismatch = true;
        }

        totalGood += itemData.accepted_good_quantity;
        totalDamaged += itemData.accepted_damaged_quantity;
        totalRejected += itemData.rejected_quantity;
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (hasDispositionMismatch) return;

        setIsSubmitting(true);
        setErrorMessage(null);

        router.post(
            `/admin/returns/${returnRequest.id}/approve`,
            { items: itemsData },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                },
                onError: (errs) => {
                    const first = Object.values(errs)[0] as string;
                    setErrorMessage(first || 'Failed to approve return.');
                },
                onFinish: () => {
                    setIsSubmitting(false);
                },
            }
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
            role="dialog"
            aria-modal="true"
        >
            <div className="w-full max-w-4xl my-8 p-6 bg-card border rounded-2xl shadow-xl space-y-5 text-foreground">
                <div className="flex items-start justify-between gap-4 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">
                                Authoritative Return Approval & Stock Disposition — {returnRequest.return_number}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Classify verified received units into Sellable Good Stock, Quarantined Damaged Stock, or Rejected.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1 rounded-md text-muted-foreground hover:bg-muted"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <div className="border rounded-lg divide-y bg-muted/20">
                        {returnRequest.items.map(item => {
                            const itemData = itemsData.find(i => i.item_id === item.id);
                            const productName = item.product?.name || item.order_item?.product_name_snapshot || 'Product';
                            const sku = item.product?.sku || item.order_item?.sku_snapshot || '';
                            const received = item.received_quantity;
                            const good = itemData?.accepted_good_quantity ?? 0;
                            const damaged = itemData?.accepted_damaged_quantity ?? 0;
                            const rejected = itemData?.rejected_quantity ?? 0;
                            const itemSum = good + damaged + rejected;
                            const isMismatch = itemSum !== received;

                            return (
                                <div key={item.id} className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-foreground text-sm">{productName}</p>
                                            <p className="text-xs text-muted-foreground">SKU: {sku}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-muted-foreground block">Verified Received</span>
                                            <span className="font-bold text-indigo-600 text-xs">{received} units</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-background p-3 rounded border">
                                        <div className="space-y-1">
                                            <Label htmlFor={`good-${item.id}`} className="text-xs font-semibold text-emerald-600">
                                                Accept Good Stock (Restock)
                                            </Label>
                                            <Input
                                                id={`good-${item.id}`}
                                                type="number"
                                                min="0"
                                                max={received}
                                                value={good}
                                                onChange={e => handleQtyChange(item.id, 'accepted_good_quantity', e.target.value)}
                                                className="h-9 font-semibold text-emerald-600"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor={`damaged-${item.id}`} className="text-xs font-semibold text-amber-600">
                                                Accept Damaged Stock (Quarantine)
                                            </Label>
                                            <Input
                                                id={`damaged-${item.id}`}
                                                type="number"
                                                min="0"
                                                max={received}
                                                value={damaged}
                                                onChange={e => handleQtyChange(item.id, 'accepted_damaged_quantity', e.target.value)}
                                                className="h-9 font-semibold text-amber-600"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor={`rejected-${item.id}`} className="text-xs font-semibold text-rose-600">
                                                Reject Return
                                            </Label>
                                            <Input
                                                id={`rejected-${item.id}`}
                                                type="number"
                                                min="0"
                                                max={received}
                                                value={rejected}
                                                onChange={e => handleQtyChange(item.id, 'rejected_quantity', e.target.value)}
                                                className="h-9 font-semibold text-rose-600"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-xs px-1">
                                        <span className={isMismatch ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-muted-foreground'}>
                                            {isMismatch && <AlertTriangle className="h-3.5 w-3.5" />}
                                            Disposition Sum: {itemSum} / {received} units
                                        </span>
                                        <span className="text-muted-foreground font-medium">
                                            Approved for Credit: {good + damaged} units
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 rounded-lg bg-slate-900 text-white flex flex-wrap justify-between items-center gap-4 text-xs">
                        <div>
                            <span className="text-slate-400 block">Total Restock (Good)</span>
                            <span className="text-base font-bold text-emerald-400">{totalGood} units</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Total Quarantine (Damaged)</span>
                            <span className="text-base font-bold text-amber-400">{totalDamaged} units</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Total Rejected</span>
                            <span className="text-base font-bold text-rose-400">{totalRejected} units</span>
                        </div>
                        <div className="border-l border-slate-700 pl-4">
                            <span className="text-slate-400 block">Approved for Credit</span>
                            <span className="text-lg font-black text-indigo-300">{totalGood + totalDamaged} units</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isSubmitting || hasDispositionMismatch}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Executing...
                                </>
                            ) : (
                                'Authorize & Execute Disposition'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
