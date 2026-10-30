import React from 'react';
import { Package, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { AdminOrderReviewItem } from '@/types/order';
import { ProductThumbnail } from '@/Components/Common/ProductThumbnail';

interface ReviewItemsCardsProps {
    items: AdminOrderReviewItem[];
    currency: string;
}

export default function ReviewItemsCards({ items, currency }: ReviewItemsCardsProps) {
    const formatMoney = (amount: string | number) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
        }).format(num || 0);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Package className="h-4 w-4 text-primary" />
                    <span>Line Items ({items.length})</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Mobile Cards View</span>
            </div>

            <div className="space-y-3">
                {items.map((item, idx) => {
                    const isInactiveInCatalog = item.catalog_product && !item.catalog_product.is_active;

                    return (
                        <div
                            key={item.id}
                            className="bg-card border rounded-lg p-4 shadow-xs space-y-3 text-xs"
                        >
                            {/* Product Header */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <ProductThumbnail
                                        src={item.primary_image_url || item.catalog_product?.primary_image_url}
                                        alt={item.product_name}
                                        size="md"
                                    />
                                    <div className="space-y-0.5 min-w-0">
                                        <div className="font-bold text-sm text-foreground line-clamp-2">
                                            <span className="text-muted-foreground mr-1.5 font-mono">#{idx + 1}</span>
                                            {item.product_name}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                            <span>SKU: {item.sku}</span>
                                            <span>•</span>
                                            <span className="capitalize">{item.unit}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-sm font-bold font-mono text-foreground block">
                                        {formatMoney(item.line_total)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        Total
                                    </span>
                                </div>
                            </div>

                            {/* Catalog Inactive Alert */}
                            {isInactiveInCatalog && (
                                <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    <span>Product deactivated in master catalog after order submission.</span>
                                </div>
                            )}

                            {/* Price Override Details */}
                            {item.is_price_overridden && (
                                <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        <span>Authorized Price Override</span>
                                    </div>
                                    {item.price_override_reason && (
                                        <p className="text-[11px] italic">
                                            "{item.price_override_reason}"
                                        </p>
                                    )}
                                    {item.price_override_approver && (
                                        <p className="text-[10px] text-muted-foreground">
                                            Approved By: {item.price_override_approver.name}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Key Values Grid */}
                            <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2.5 rounded-md border text-[11px]">
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">Qty</span>
                                    <span className="font-bold text-foreground font-mono">
                                        {item.ordered_quantity.toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">Unit Price</span>
                                    <span className="font-bold text-foreground font-mono">
                                        {formatMoney(item.unit_price)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">Tax ({item.formatted_tax_rate})</span>
                                    <span className="font-mono text-muted-foreground font-semibold">
                                        {formatMoney(item.tax_amount)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
