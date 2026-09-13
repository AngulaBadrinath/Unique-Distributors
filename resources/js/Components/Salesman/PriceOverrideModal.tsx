import React, { useState, useEffect, useRef } from 'react';
import { CatalogProduct } from '@/types/order';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { ShieldAlert, AlertTriangle, Check, X } from 'lucide-react';

interface PriceOverrideModalProps {
    isOpen: boolean;
    product: CatalogProduct | null;
    requestedPrice: string;
    onConfirm: (product: CatalogProduct, price: string, reason: string) => void;
    onClose: () => void;
}

export const PriceOverrideModal: React.FC<PriceOverrideModalProps> = ({
    isOpen,
    product,
    requestedPrice,
    onConfirm,
    onClose,
}) => {
    const [overridePrice, setOverridePrice] = useState(requestedPrice);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const dialogRef = useRef<HTMLDivElement>(null);
    const reasonInputRef = useRef<HTMLTextAreaElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen && product) {
            setOverridePrice(requestedPrice);
            setReason('');
            setError(null);
            previousActiveElement.current = document.activeElement as HTMLElement | null;

            // Handle Escape key and focus trapping
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                    return;
                }

                if (e.key === 'Tab' && dialogRef.current) {
                    const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    );
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    if (!firstElement) return;

                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement?.focus();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement?.focus();
                        }
                    }
                }
            };

            window.addEventListener('keydown', handleKeyDown);

            // Focus reason textarea
            const timeout = setTimeout(() => {
                reasonInputRef.current?.focus();
            }, 50);

            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                clearTimeout(timeout);
                if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
                    previousActiveElement.current.focus();
                }
            };
        }
    }, [isOpen, product, requestedPrice, onClose]);

    if (!isOpen || !product) return null;

    const numPrice = parseFloat(overridePrice);
    const isBelowMin = !isNaN(numPrice) && numPrice < product.minimum_allowed_price;
    const isAboveMrp = !isNaN(numPrice) && numPrice > product.mrp;

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseFloat(overridePrice);
        if (isNaN(parsed) || parsed <= 0) {
            setError('Please enter a valid selling price greater than zero.');
            return;
        }

        if (reason.trim().length < 5) {
            setError('A business justification of at least 5 characters is strictly required for price overrides.');
            return;
        }

        onConfirm(product, parsed.toFixed(2), reason.trim());
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-override-title"
            aria-describedby="price-override-description"
        >
            <div
                ref={dialogRef}
                className="w-full max-w-lg bg-card border rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-border bg-amber-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 id="price-override-title" className="text-base font-bold text-foreground">
                                Supervisor Price Override Request
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                SKU: {product.sku} — {product.name}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleConfirm} className="p-6 space-y-4 text-xs">
                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div id="price-override-description" className="p-3 rounded-lg bg-muted/40 border text-muted-foreground space-y-1.5">
                        <div className="flex justify-between">
                            <span>Minimum Allowed Price:</span>
                            <span className="font-mono font-semibold text-foreground">${product.minimum_allowed_price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Standard List Price (MRP):</span>
                            <span className="font-mono font-semibold text-foreground">${product.mrp.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-border/60">
                            <span>Exception Status:</span>
                            <Badge variant="outline" className={isBelowMin ? 'text-amber-600 border-amber-500/30' : 'text-blue-600 border-blue-500/30'}>
                                {isBelowMin ? 'Below Minimum Floor' : isAboveMrp ? 'Above Standard MRP' : 'Standard Boundary'}
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="override-price-input" className="font-semibold text-foreground block">
                            Requested Selling Price ($) <span className="text-destructive">*</span>
                        </label>
                        <Input
                            id="override-price-input"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={overridePrice}
                            onChange={(e) => setOverridePrice(e.target.value)}
                            className="h-9 font-mono text-sm"
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="override-reason-input" className="font-semibold text-foreground block">
                            Business Justification / Notes <span className="text-destructive">*</span>
                        </label>
                        <textarea
                            id="override-reason-input"
                            ref={reasonInputRef}
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="State the commercial reason for this price override (e.g., promotional volume agreement, damaged batch clearance)..."
                            className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder-muted-foreground outline-hidden focus:ring-1 focus:ring-primary focus:border-primary resize-none"
                            required
                        />
                        <span className="text-[10px] text-muted-foreground block">
                            Minimum 5 characters required for administrative audit attribution.
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                        <Button type="button" variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" className="gap-1.5">
                            <Check className="h-4 w-4" />
                            <span>Apply Override</span>
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
