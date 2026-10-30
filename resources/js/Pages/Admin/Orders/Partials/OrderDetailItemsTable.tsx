import React from 'react';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { AdminOrderDetailItem } from '@/types/order';
import { Package, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ProductThumbnail } from '@/Components/Common/ProductThumbnail';

interface OrderDetailItemsTableProps {
    items: AdminOrderDetailItem[];
}

export default function OrderDetailItemsTable({ items }: OrderDetailItemsTableProps) {
    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <div>
                            <CardTitle className="text-sm font-bold">Line Items & Allocations</CardTitle>
                            <CardDescription className="text-xs">
                                Historical transaction snapshots and non-destructive quantity conservation
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-xs self-start sm:self-auto font-mono">
                        {items.length} {items.length === 1 ? 'Line Item' : 'Line Items'}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-muted/40 border-b text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th scope="col" className="py-2.5 px-3 w-12 text-center">#</th>
                                <th scope="col" className="py-2.5 px-3 min-w-[200px]">Product / SKU</th>
                                <th scope="col" className="py-2.5 px-3 text-center min-w-[160px]">
                                    <div className="flex flex-col items-center">
                                        <span>Quantity Breakdown</span>
                                        <span className="text-[9px] font-normal lowercase text-muted-foreground/80">
                                            (ord / res / ful / can)
                                        </span>
                                    </div>
                                </th>
                                <th scope="col" className="py-2.5 px-3 text-right">Unit Price</th>
                                <th scope="col" className="py-2.5 px-3 text-right">Tax Rate & Amt</th>
                                <th scope="col" className="py-2.5 px-3 text-right">Line Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {items.map((item, index) => {
                                const isCatalogDeactivated = item.catalog_product && !item.catalog_product.is_active;

                                return (
                                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                                        {/* Line Number */}
                                        <td className="py-3 px-3 text-center font-mono text-muted-foreground text-[11px]">
                                            {index + 1}
                                        </td>

                                        {/* Product & SKU */}
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-3">
                                                <ProductThumbnail
                                                    src={item.primary_image_url || item.catalog_product?.primary_image_url}
                                                    alt={item.product_name}
                                                    size="md"
                                                />
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-foreground text-xs leading-tight">
                                                        {item.product_name}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[11px] text-muted-foreground">
                                                        <span>SKU: {item.sku}</span>
                                                        <span>•</span>
                                                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal h-4 uppercase">
                                                            {item.unit}
                                                        </Badge>

                                                        {/* Current Catalog Inactive Warning */}
                                                        {isCatalogDeactivated && (
                                                            <Badge variant="destructive" className="text-[9px] py-0 px-1 h-4 gap-1">
                                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                                <span>Catalog Inactive</span>
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {/* Price Override Note */}
                                                    {item.is_price_overridden && (
                                                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                                                            <ShieldAlert className="h-3 w-3 shrink-0" />
                                                            <span>
                                                                Authorized Override
                                                                {item.price_override_approver ? ` by ${item.price_override_approver.name}` : ''}
                                                                {item.price_override_reason ? `: "${item.price_override_reason}"` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Quantity Breakdown (Ordered, Reserved, Fulfillable, Cancelled) */}
                                        <td className="py-3 px-3 text-center">
                                            <div className="inline-grid grid-cols-4 gap-1 bg-muted/30 p-1.5 rounded border border-border/40 font-mono text-[11px]">
                                                <div title="Ordered Quantity">
                                                    <div className="text-[9px] text-muted-foreground font-sans font-semibold">ORD</div>
                                                    <div className="font-bold text-foreground">{item.ordered_quantity}</div>
                                                </div>
                                                <div title="Reserved Quantity (Order-Level)">
                                                    <div className="text-[9px] text-sky-600 dark:text-sky-400 font-sans font-semibold">RES</div>
                                                    <div className="font-bold text-sky-700 dark:text-sky-300">{item.reserved_quantity}</div>
                                                </div>
                                                <div title="Fulfillable Quantity (Ordered - Cancelled)">
                                                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">FUL</div>
                                                    <div className="font-bold text-emerald-700 dark:text-emerald-300">{item.fulfillable_quantity}</div>
                                                </div>
                                                <div title="Cancelled Quantity">
                                                    <div className="text-[9px] text-rose-600 dark:text-rose-400 font-sans font-semibold">CAN</div>
                                                    <div className={`font-bold ${item.cancelled_quantity > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}>
                                                        {item.cancelled_quantity}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Discrete allocation rollup if allocations exist */}
                                            {item.allocations && item.allocations.length > 0 && (
                                                <div className="flex items-center justify-center gap-1.5 mt-1 text-[9px] text-muted-foreground font-mono">
                                                    <span className="text-primary font-semibold">Alloc: {item.allocated_quantity ?? item.fulfillable_quantity}</span>
                                                    {item.unallocated_quantity !== undefined && item.unallocated_quantity > 0 && (
                                                        <span className="text-amber-600 dark:text-amber-400 font-semibold">(Unalloc: {item.unallocated_quantity})</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Operational fulfillment progress if any picked/delivered */}
                                            {(item.picked_quantity > 0 || item.dispatched_quantity > 0 || item.delivered_quantity > 0 || item.returned_quantity > 0) && (
                                                <div className="flex justify-center gap-2 mt-1 text-[9px] text-muted-foreground font-mono">
                                                    {item.picked_quantity > 0 && <span>Picked: {item.picked_quantity}</span>}
                                                    {item.dispatched_quantity > 0 && <span>Disp: {item.dispatched_quantity}</span>}
                                                    {item.delivered_quantity > 0 && <span>Del: {item.delivered_quantity}</span>}
                                                    {item.returned_quantity > 0 && <span className="text-rose-600">Ret: {item.returned_quantity}</span>}
                                                </div>
                                            )}
                                        </td>

                                        {/* Unit Price */}
                                        <td className="py-3 px-3 text-right font-mono">
                                            <div className="font-semibold text-foreground">
                                                ${item.unit_price}
                                            </div>
                                            {item.catalog_product && (
                                                <div className="text-[10px] text-muted-foreground font-normal">
                                                    (MRP: ${item.catalog_product.mrp})
                                                </div>
                                            )}
                                        </td>

                                        {/* Tax Rate & Amount */}
                                        <td className="py-3 px-3 text-right font-mono">
                                            <div className="text-foreground font-medium">
                                                ${item.tax_amount}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {item.tax_profile_code} ({item.formatted_tax_rate})
                                            </div>
                                        </td>

                                        {/* Line Total */}
                                        <td className="py-3 px-3 text-right font-mono font-bold text-foreground text-xs">
                                            ${item.line_total}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
