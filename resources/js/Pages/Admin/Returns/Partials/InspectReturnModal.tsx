import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { PackageCheck, X, Camera, Upload, Loader2, AlertCircle } from 'lucide-react';

interface ReturnItem {
    id: number;
    product_id: number;
    requested_quantity: number;
    received_quantity: number;
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

export default function InspectReturnModal({ isOpen, onClose, returnRequest }: Props) {
    const [inspectionNotes, setInspectionNotes] = useState('');
    const [itemsData, setItemsData] = useState<Array<{
        item_id: number;
        received_quantity: number;
        item_notes: string;
    }>>([]);
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const [fileNames, setFileNames] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setInspectionNotes('');
            setItemsData(returnRequest.items.map(item => ({
                item_id: item.id,
                received_quantity: item.requested_quantity,
                item_notes: item.item_notes || '',
            })));
            setEvidenceFiles([]);
            setFileNames([]);
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

    const handleQuantityChange = (itemId: number, value: string) => {
        const qty = parseInt(value, 10) || 0;
        setItemsData(prev => prev.map(i => i.item_id === itemId ? { ...i, received_quantity: qty } : i));
    };

    const handleNotesChange = (itemId: number, notes: string) => {
        setItemsData(prev => prev.map(i => i.item_id === itemId ? { ...i, item_notes: notes } : i));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setEvidenceFiles(files);
            setFileNames(files.map(f => f.name));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage(null);

        const formData = new FormData();
        formData.append('inspection_notes', inspectionNotes);

        itemsData.forEach((item, index) => {
            formData.append(`items[${index}][item_id]`, item.item_id.toString());
            formData.append(`items[${index}][received_quantity]`, item.received_quantity.toString());
            if (item.item_notes) {
                formData.append(`items[${index}][item_notes]`, item.item_notes);
            }
        });

        evidenceFiles.forEach((file, index) => {
            formData.append(`evidence_photos[${index}]`, file);
        });

        router.post(`/admin/returns/${returnRequest.id}/inspect`, formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                onClose();
            },
            onError: (errs) => {
                const first = Object.values(errs)[0] as string;
                setErrorMessage(first || 'Failed to record inspection.');
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
            role="dialog"
            aria-modal="true"
        >
            <div className="w-full max-w-3xl my-8 p-6 bg-card border rounded-2xl shadow-xl space-y-5 text-foreground">
                <div className="flex items-start justify-between gap-4 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
                            <PackageCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">
                                Warehouse Physical Inspection — {returnRequest.return_number}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Verify received quantities and log condition notes. Physical stock is updated upon approval.
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

                    <div className="space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Line Item Physical Check-In
                        </Label>

                        <div className="border rounded-lg divide-y bg-muted/20">
                            {returnRequest.items.map(item => {
                                const itemData = itemsData.find(i => i.item_id === item.id);
                                const productName = item.product?.name || item.order_item?.product_name_snapshot || 'Product';
                                const sku = item.product?.sku || item.order_item?.sku_snapshot || '';

                                return (
                                    <div key={item.id} className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-foreground text-sm">{productName}</p>
                                                <p className="text-xs text-muted-foreground">SKU: {sku} • Reason: {item.reason_code}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs text-muted-foreground block">Requested</span>
                                                <span className="font-bold text-foreground text-xs">{item.requested_quantity} units</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <Label htmlFor={`qty-${item.id}`} className="text-xs text-muted-foreground">
                                                    Received Quantity
                                                </Label>
                                                <Input
                                                    id={`qty-${item.id}`}
                                                    type="number"
                                                    min="0"
                                                    max={item.requested_quantity}
                                                    value={itemData?.received_quantity ?? 0}
                                                    onChange={e => handleQuantityChange(item.id, e.target.value)}
                                                    className="h-9 font-semibold"
                                                    required
                                                />
                                            </div>
                                            <div className="sm:col-span-2 space-y-1">
                                                <Label htmlFor={`notes-${item.id}`} className="text-xs text-muted-foreground">
                                                    Item Condition Notes
                                                </Label>
                                                <Input
                                                    id={`notes-${item.id}`}
                                                    type="text"
                                                    placeholder="e.g. Unopened, Damaged seal, Leaking"
                                                    value={itemData?.item_notes ?? ''}
                                                    onChange={e => handleNotesChange(item.id, e.target.value)}
                                                    className="h-9"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="inspection_notes" className="text-xs font-semibold text-foreground">
                            General Inspection Summary
                        </Label>
                        <textarea
                            id="inspection_notes"
                            rows={3}
                            placeholder="Summary of package condition, carrier handling, warehouse receiving notes..."
                            value={inspectionNotes}
                            onChange={e => setInspectionNotes(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Camera className="h-4 w-4 text-muted-foreground" />
                            Damage / Physical Evidence Photos (JPEG/PNG, Max 5MB)
                        </Label>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted text-xs font-medium text-foreground">
                                <Upload className="h-4 w-4" />
                                Choose Files
                                <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                            <span className="text-xs text-muted-foreground">
                                {fileNames.length > 0 ? `${fileNames.length} file(s) selected` : 'No files selected'}
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Recording...
                                </>
                            ) : (
                                'Confirm Warehouse Inspection'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
