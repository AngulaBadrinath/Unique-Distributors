import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import OrderStatusBadge from '@/Pages/Salesman/Orders/Partials/OrderStatusBadge';
import { AdminOrderDetailData } from '@/types/order';
import {
    Package,
    CreditCard,
    Truck,
    SlidersHorizontal,
    Info,
    CheckCircle2,
    Clock,
    Banknote,
} from 'lucide-react';
import { Button } from '@/Components/ui/button';

interface OrderDetailOperationalCardsProps {
    order: AdminOrderDetailData['order'];
    customer: AdminOrderDetailData['customer'];
    fulfillmentSummary: AdminOrderDetailData['fulfillment_summary'];
    financialSummary?: AdminOrderDetailData['financial_summary'];
    canRecordPayment?: boolean;
    onRecordPayment?: () => void;
}

export default function OrderDetailOperationalCards({
    order,
    customer,
    fulfillmentSummary,
    financialSummary,
    canRecordPayment,
    onRecordPayment,
}: OrderDetailOperationalCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Fulfillment & Stock Allocation Card */}
            <Card className="border shadow-sm">
                <CardHeader className="pb-2.5 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                Fulfillment & Stock
                            </CardTitle>
                        </div>
                        <OrderStatusBadge
                            dimension="fulfillment"
                            label={order.fulfillment_status_label ?? 'Unallocated'}
                            variant={order.fulfillment_badge_variant ?? 'secondary'}
                            size="sm"
                        />
                    </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-3 text-xs">
                    <div className="grid grid-cols-4 gap-1.5 bg-muted/30 p-2 rounded border border-border/40 font-mono text-center">
                        <div>
                            <div className="text-[9px] text-muted-foreground font-sans font-semibold">Ordered</div>
                            <div className="font-bold text-foreground text-xs">{fulfillmentSummary.total_ordered}</div>
                        </div>
                        <div>
                            <div className="text-[9px] text-sky-600 dark:text-sky-400 font-sans font-semibold">Reserved</div>
                            <div className="font-bold text-sky-700 dark:text-sky-300 text-xs">{fulfillmentSummary.total_reserved}</div>
                        </div>
                        <div>
                            <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">Fulfillable</div>
                            <div className="font-bold text-emerald-700 dark:text-emerald-300 text-xs">{fulfillmentSummary.total_fulfillable}</div>
                        </div>
                        <div>
                            <div className="text-[9px] text-rose-600 dark:text-rose-400 font-sans font-semibold">Cancelled</div>
                            <div className={`font-bold text-xs ${fulfillmentSummary.total_cancelled > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}>
                                {fulfillmentSummary.total_cancelled}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/30">
                        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold text-foreground">Order-Level Reservation:</span> Quantities reflect authoritative order-line reservation. Physical stock picking and warehouse bin movements are managed in Warehouse Operations.
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Payment & Terms Card */}
            <Card className="border shadow-sm">
                <CardHeader className="pb-2.5 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                Payment & Terms
                            </CardTitle>
                        </div>
                        <OrderStatusBadge
                            dimension="payment"
                            label={order.payment_status_label ?? 'Unpaid'}
                            variant={order.payment_badge_variant ?? 'destructive'}
                            size="sm"
                        />
                    </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-3 text-xs">
                    <div className="bg-muted/30 p-2.5 rounded border border-border/40 space-y-1.5">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-[11px]">Payment Terms:</span>
                            <span className="font-semibold text-foreground">{customer.payment_terms || 'Due on Receipt'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-[11px]">Payment Status:</span>
                            <span className="font-bold text-foreground">{order.payment_status_label ?? 'Unpaid'}</span>
                        </div>
                        {financialSummary && (
                            <div className="pt-2 border-t border-border/40 space-y-1">
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-muted-foreground">Grand Total:</span>
                                    <span className="font-mono font-semibold text-foreground">${financialSummary.grand_total}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-muted-foreground">Verified Paid:</span>
                                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                        ${financialSummary.verified_payments_total}
                                    </span>
                                </div>
                                {parseFloat(financialSummary.pending_payments_total) > 0 && (
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-muted-foreground">Pending Verification:</span>
                                        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                            ${financialSummary.pending_payments_total}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-dashed">
                                    <span className="font-bold text-foreground">Outstanding Balance:</span>
                                    <span className="font-mono font-bold text-foreground">
                                        ${financialSummary.outstanding_balance}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {canRecordPayment && onRecordPayment && parseFloat(financialSummary?.outstanding_balance ?? order.grand_total) > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRecordPayment}
                            className="w-full gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
                        >
                            <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Record Balance Payment</span>
                        </Button>
                    )}

                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/30">
                        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold text-foreground">Payment Operations:</span> Cash collection, cheque deposits, money order evidence validation, and accountant ledger verification are managed in Payments Workspace.
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 3. Delivery & Shipping Card */}
            <Card className="border shadow-sm">
                <CardHeader className="pb-2.5 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-primary" />
                            <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                Logistics & Delivery
                            </CardTitle>
                        </div>
                        <OrderStatusBadge
                            dimension="delivery"
                            label={order.delivery_status_label ?? 'Pending Assignment'}
                            variant={order.delivery_badge_variant ?? 'secondary'}
                            size="sm"
                        />
                    </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-3 text-xs">
                    <div className="bg-muted/30 p-2 rounded border border-border/40">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                            Destination Shipping Address
                        </div>
                        <div className="text-foreground whitespace-pre-line text-[11px]">
                            {customer.shipping_address || 'No destination address recorded.'}
                        </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/30">
                        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold text-foreground">Logistics Workflow:</span> Driver assignment, vehicle dispatch routes, and proof-of-delivery capture are managed in Delivery Logistics.
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 4. Adjustments & Exceptions Card */}
            <Card className="border shadow-sm">
                <CardHeader className="pb-2.5 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                Order Adjustments
                            </CardTitle>
                        </div>
                        <OrderStatusBadge
                            dimension="adjustment"
                            label={order.adjustment_status_label ?? 'None'}
                            variant={order.adjustment_badge_variant ?? 'secondary'}
                            size="sm"
                        />
                    </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-3 text-xs">
                    <div className="bg-muted/30 p-2.5 rounded border border-border/40 flex justify-between items-center">
                        <span className="text-muted-foreground text-[11px]">Total Net Adjustment:</span>
                        <span className="font-mono font-bold text-foreground">
                            ${order.adjustment_total ?? '0.00'}
                        </span>
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/30">
                        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold text-foreground">Adjustment Framework:</span> Non-destructive post-submission adjustments, warehouse exceptions, and supervisor approvals are managed in the Adjustments Workspace.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
