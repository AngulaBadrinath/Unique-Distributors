import React, { useMemo } from 'react';
import { CustomerSummary, CartLineItem } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    Building,
    CreditCard,
    ShieldCheck,
    ArrowRight,
    ShoppingBag,
    Trash2,
    CheckCircle2,
    Loader2,
} from 'lucide-react';
import { calculateOrderPreview, formatCurrency } from '@/lib/financial';
import { cn } from '@/lib/utils';
import { ProductThumbnail } from '@/Components/Common/ProductThumbnail';

export interface OrderSummaryPanelProps {
    customer: CustomerSummary | null;
    cart: CartLineItem[];
    onProceedToReview?: () => void;
    onRemoveItem?: (productId: number) => void;
    onUpdateQuantity?: (productId: number, quantity: number) => void;
    isReviewMode?: boolean;
    isSubmitting?: boolean;
    className?: string;
}

export function OrderSummaryPanel({
    customer,
    cart,
    onProceedToReview,
    onRemoveItem,
    onUpdateQuantity,
    isReviewMode = false,
    isSubmitting = false,
    className,
}: OrderSummaryPanelProps) {
    const calculation = useMemo(() => calculateOrderPreview(cart), [cart]);

    return (
        <Card className={cn('border border-border/80 bg-card shadow-xs overflow-hidden rounded-xl', className)}>
            {/* Header */}
            <CardHeader className="p-4 border-b border-border/70 bg-muted/25">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                        <span>Order Summary</span>
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0.5">
                        {calculation.totalUnits} {calculation.totalUnits === 1 ? 'unit' : 'units'}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                {/* Customer Context (if selected) */}
                {customer ? (
                    <div className="p-3 rounded-lg border border-border/60 bg-muted/15 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground truncate flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                {customer.name}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px] py-0 shrink-0">
                                {customer.code}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                            <span className="flex items-center gap-1">
                                <CreditCard className="w-3 h-3 opacity-70" />
                                {customer.payment_terms_label || 'Default Terms'}
                            </span>
                            <span>Limit: {formatCurrency(customer.credit_limit)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 rounded-lg border border-dashed border-border/70 text-center text-xs text-muted-foreground">
                        No customer selected
                    </div>
                )}

                {/* Compact Cart Items Preview */}
                {!isReviewMode && cart.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Line Items ({calculation.itemCount})
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-2 divide-y divide-border/40 pr-1">
                            {calculation.lines.map((line) => (
                                <div
                                    key={line.product.id}
                                    className="pt-2 first:pt-0 flex items-center justify-between text-xs gap-2.5"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <ProductThumbnail
                                            src={line.product.primary_image_url}
                                            alt={line.product.name}
                                            size="sm"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-foreground truncate" title={line.product.name}>
                                                {line.product.name}
                                            </div>
                                            <div className="text-[11px] font-mono text-muted-foreground">
                                                {line.quantity} × {formatCurrency(line.unitPrice)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 font-mono">
                                        <span className="font-semibold text-foreground">
                                            {formatCurrency(line.lineTotal)}
                                        </span>
                                        {onRemoveItem && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveItem(line.product.id)}
                                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                                aria-label={`Remove ${line.product.name}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Financial Breakdown */}
                <div className="pt-2 border-t border-border/60 space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Taxable Subtotal:</span>
                        <span className="font-mono font-medium text-foreground">
                            {formatCurrency(calculation.subtotal)}
                        </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Estimated Taxes:</span>
                        <span className="font-mono font-medium text-foreground">
                            {formatCurrency(calculation.taxTotal)}
                        </span>
                    </div>
                    <div className="pt-2.5 border-t border-border/80 flex justify-between items-baseline">
                        <span className="text-sm font-bold text-foreground">Estimated Total:</span>
                        <span className="text-xl font-bold font-mono text-primary">
                            {formatCurrency(calculation.grandTotal)}
                        </span>
                    </div>
                </div>

                {/* Server Authority Guarantee Notice */}
                <div className="rounded-lg bg-muted/30 p-2.5 text-[11px] text-muted-foreground space-y-1 border border-border/50">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Server Authoritative</span>
                    </div>
                    <p className="leading-relaxed opacity-90">
                        Line prices and tax rates are verified and locked authoritatively on the backend upon order creation.
                    </p>
                </div>

                {/* CTA Action */}
                {!isReviewMode && onProceedToReview && (
                    <Button
                        type="button"
                        onClick={onProceedToReview}
                        disabled={cart.length === 0 || !customer || isSubmitting}
                        className="w-full h-10 font-semibold gap-2 shadow-xs cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <span>Review & Submit Order</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
