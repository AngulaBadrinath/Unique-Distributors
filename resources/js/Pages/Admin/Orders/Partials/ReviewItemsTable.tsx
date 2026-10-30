import React from 'react';
import { Package, ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { AdminOrderReviewItem } from '@/types/order';
import { ProductThumbnail } from '@/Components/Common/ProductThumbnail';

interface ReviewItemsTableProps {
    items: AdminOrderReviewItem[];
    currency: string;
}

export default function ReviewItemsTable({ items, currency }: ReviewItemsTableProps) {
    const formatMoney = (amount: string | number) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
        }).format(num || 0);
    };

    return (
        <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">
                        Order Line Items ({items.length})
                    </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                    Historical Immutable Snapshots
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left" role="table">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold border-b uppercase text-[10px] tracking-wider">
                        <tr>
                            <th scope="col" className="px-4 py-3">#</th>
                            <th scope="col" className="px-4 py-3">Product Description & SKU</th>
                            <th scope="col" className="px-4 py-3 text-right">Qty Ordered</th>
                            <th scope="col" className="px-4 py-3 text-right">Unit Price</th>
                            <th scope="col" className="px-4 py-3">Pricing Context</th>
                            <th scope="col" className="px-4 py-3 text-right">Tax Rate</th>
                            <th scope="col" className="px-4 py-3 text-right">Tax Amount</th>
                            <th scope="col" className="px-4 py-3 text-right">Line Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map((item, idx) => {
                            const isInactiveInCatalog = item.catalog_product && !item.catalog_product.is_active;

                            return (
                                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                    {/* Line Number */}
                                    <td className="px-4 py-3 text-muted-foreground font-mono">
                                        {idx + 1}
                                    </td>

                                    {/* Product Name & SKU */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <ProductThumbnail
                                                src={item.primary_image_url || item.catalog_product?.primary_image_url}
                                                alt={item.product_name}
                                                size="md"
                                            />
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="font-bold text-foreground">
                                                    {item.product_name}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                                    <span>SKU: {item.sku}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{item.unit}</span>
                                                </div>
                                                {isInactiveInCatalog && (
                                                    <div className="pt-1">
                                                        <Badge variant="destructive" className="text-[9px] gap-1 px-1.5 py-0 h-4">
                                                            <AlertTriangle className="h-2.5 w-2.5" />
                                                            <span>Catalog Inactive</span>
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Quantity Ordered */}
                                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                                        {item.ordered_quantity.toLocaleString()}
                                    </td>

                                    {/* Unit Price */}
                                    <td className="px-4 py-3 text-right font-mono text-foreground">
                                        {formatMoney(item.unit_price)}
                                    </td>

                                    {/* Pricing Context / Override Disclosures */}
                                    <td className="px-4 py-3">
                                        {item.is_price_overridden ? (
                                            <div className="space-y-1">
                                                <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800">
                                                    <ShieldAlert className="h-3 w-3" />
                                                    <span>Price Override</span>
                                                </Badge>
                                                {item.price_override_reason && (
                                                    <div className="text-[10px] text-muted-foreground italic line-clamp-1" title={item.price_override_reason}>
                                                        "{item.price_override_reason}"
                                                    </div>
                                                )}
                                                {item.price_override_approver && (
                                                    <div className="text-[9px] text-muted-foreground/80">
                                                        By: {item.price_override_approver.name}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                <span>Standard</span>
                                            </div>
                                        )}
                                    </td>

                                    {/* Tax Profile & Rate */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="space-y-0.5">
                                            <span className="font-mono text-foreground font-semibold">
                                                {item.formatted_tax_rate}
                                            </span>
                                            <div className="text-[10px] text-muted-foreground truncate max-w-[120px] ml-auto" title={item.tax_profile_name}>
                                                {item.tax_profile_code}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Tax Amount */}
                                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                        {formatMoney(item.tax_amount)}
                                    </td>

                                    {/* Line Total */}
                                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground text-sm">
                                        {formatMoney(item.line_total)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
