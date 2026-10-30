import React from 'react';
import { LineFinancialPreview } from '@/types/order';
import { QuantityStepper } from '@/Components/Salesman/QuantityStepper';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Trash2, Tag, Percent, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/financial';

interface OrderReviewLineCardProps {
    line: LineFinancialPreview;
    onUpdateQuantity: (productId: number, quantity: number) => void;
    onRemoveItem: (productId: number) => void;
    disabled?: boolean;
}

export const OrderReviewLineCard: React.FC<OrderReviewLineCardProps> = ({
    line,
    onUpdateQuantity,
    onRemoveItem,
    disabled = false,
}) => {
    return (
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 transition-colors">
            {/* Header: Product Thumbnail, Name, SKU, and Remove */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-md border border-border/70 bg-muted/20 shrink-0 flex items-center justify-center overflow-hidden p-1">
                        {line.product.primary_image_url ? (
                            <img
                                src={line.product.primary_image_url}
                                alt={line.product.name}
                                className="object-contain w-full h-full drop-shadow-2xs"
                                loading="lazy"
                            />
                        ) : (
                            <Package className="h-5 w-5 text-muted-foreground/40 stroke-[1.5]" />
                        )}
                    </div>
                    <div className="space-y-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                            {line.product.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>SKU: {line.product.sku}</span>
                            {line.product.barcode && (
                                <>
                                    <span>•</span>
                                    <span>UPC: {line.product.barcode}</span>
                                </>
                            )}
                            <span>•</span>
                            <span>Unit: {line.product.unit}</span>
                            {line.isCustomPrice && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-sans">
                                    <Tag className="h-2.5 w-2.5" />
                                    <span>Custom Price</span>
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => onRemoveItem(line.product.id)}
                    disabled={disabled}
                    aria-label={`Remove ${line.product.name} from order`}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Price & Quantity Row */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
                <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Unit Price</span>
                    <div className="font-mono font-semibold text-sm text-foreground">
                        {formatCurrency(line.unitPrice)}
                    </div>
                </div>

                <div className="space-y-0.5 flex flex-col items-end">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Quantity</span>
                    <QuantityStepper
                        value={line.quantity}
                        min={1}
                        max={999999}
                        onChange={(qty) => onUpdateQuantity(line.product.id, qty)}
                        disabled={disabled}
                        size="sm"
                        ariaLabel={`Quantity for ${line.product.name}`}
                    />
                </div>
            </div>

            {/* Financial & Tax Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-md p-2.5 text-xs">
                {/* Taxable Subtotal */}
                <div>
                    <span className="text-muted-foreground block text-[11px]">Taxable Amount</span>
                    <span className="font-mono font-medium text-foreground text-sm">
                        {formatCurrency(line.taxableAmount)}
                    </span>
                </div>

                {/* Line Tax */}
                <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                        <Percent className="h-3 w-3 text-muted-foreground" />
                        <span>Tax ({line.formattedTaxRate})</span>
                    </div>
                    <div className="font-mono font-medium text-foreground text-sm">
                        {formatCurrency(line.taxAmount)}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                        {line.taxProfileCode}
                    </div>
                </div>
            </div>

            {/* Line Total */}
            <div className="flex items-center justify-between pt-1 border-t border-border/80">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Line Total</span>
                <span className="font-mono font-bold text-base text-primary">
                    {formatCurrency(line.lineTotal)}
                </span>
            </div>
        </div>
    );
};
