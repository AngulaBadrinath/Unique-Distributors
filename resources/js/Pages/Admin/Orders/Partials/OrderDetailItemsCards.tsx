import React from 'react';
import { Card, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { AdminOrderDetailItem } from '@/types/order';
import { Package, ShieldAlert, AlertTriangle } from 'lucide-react';
import { ProductThumbnail } from '@/Components/Common/ProductThumbnail';

interface OrderDetailItemsCardsProps {
    items: AdminOrderDetailItem[];
}

export default function OrderDetailItemsCards({ items }: OrderDetailItemsCardsProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Line Items ({items.length})
                </span>
            </div>

            {items.map((item, index) => {
                const isCatalogDeactivated = item.catalog_product && !item.catalog_product.is_active;

                return (
                    <Card key={item.id} className="border shadow-sm overflow-hidden">
                        <CardContent className="p-3.5 space-y-3 text-xs">
                            {/* Product Header */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <ProductThumbnail
                                        src={item.primary_image_url || item.catalog_product?.primary_image_url}
                                        alt={item.product_name}
                                        size="md"
                                    />
                                    <div className="min-w-0">
                                        <div className="font-semibold text-foreground text-sm line-clamp-2">
                                            {item.product_name}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-muted-foreground font-mono text-[11px]">
                                            <span>SKU: {item.sku}</span>
                                            <span>•</span>
                                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal h-4 uppercase">
                                                {item.unit}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-bold font-mono text-foreground">
                                        ${item.line_total}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">Line Total</div>
                                </div>
                            </div>

                            {/* Inactive Warning */}
                            {isCatalogDeactivated && (
                                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded p-1.5 flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span>Product is currently deactivated in the catalog.</span>
                                </div>
                            )}

                            {/* Price Override */}
                            {item.is_price_overridden && (
                                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded p-1.5 flex items-start gap-1 text-[10px] text-amber-800 dark:text-amber-200">
                                    <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold">Authorized Override</span>
                                        {item.price_override_approver ? ` by ${item.price_override_approver.name}` : ''}
                                        {item.price_override_reason ? `: "${item.price_override_reason}"` : ''}
                                    </div>
                                </div>
                            )}

                            {/* Quantity Breakdown Grid */}
                            <div className="grid grid-cols-4 gap-1.5 bg-muted/30 p-2 rounded border border-border/40 font-mono text-center">
                                <div>
                                    <div className="text-[9px] text-muted-foreground font-sans font-semibold">ORD</div>
                                    <div className="font-bold text-foreground text-xs">{item.ordered_quantity}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-sky-600 dark:text-sky-400 font-sans font-semibold">RES</div>
                                    <div className="font-bold text-sky-700 dark:text-sky-300 text-xs">{item.reserved_quantity}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">FUL</div>
                                    <div className="font-bold text-emerald-700 dark:text-emerald-300 text-xs">{item.fulfillable_quantity}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-rose-600 dark:text-rose-400 font-sans font-semibold">CAN</div>
                                    <div className={`font-bold text-xs ${item.cancelled_quantity > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}>
                                        {item.cancelled_quantity}
                                    </div>
                                </div>
                            </div>

                            {/* Discrete Allocation Rollup */}
                            {item.allocations && item.allocations.length > 0 && (
                                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
                                    <span className="text-primary font-semibold">Allocated: {item.allocated_quantity ?? item.fulfillable_quantity}</span>
                                    {item.unallocated_quantity !== undefined && item.unallocated_quantity > 0 && (
                                        <span className="text-amber-600 dark:text-amber-400 font-semibold">Unallocated: {item.unallocated_quantity}</span>
                                    )}
                                </div>
                            )}

                            {/* Pricing & Tax Details */}
                            <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[11px] font-mono">
                                <div className="text-muted-foreground">
                                    Unit: <span className="font-semibold text-foreground">${item.unit_price}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    Tax: <span className="font-semibold text-foreground">${item.tax_amount}</span>{' '}
                                    <span className="text-[10px]">({item.formatted_tax_rate})</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
