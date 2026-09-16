import React from 'react';
import { Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import OrderStatusBadge from '@/Pages/Salesman/Orders/Partials/OrderStatusBadge';
import { AdminOrderDetailData } from '@/types/order';
import {
    ArrowLeft,
    FileText,
    Printer,
    CheckCircle2,
    Clock,
    AlertCircle,
    XCircle,
    Calendar,
    User,
    ListFilter,
    SlidersHorizontal,
} from 'lucide-react';

interface OrderDetailHeaderProps {
    order: AdminOrderDetailData['order'];
    customer: AdminOrderDetailData['customer'];
    salesman: AdminOrderDetailData['salesman'];
    creator: AdminOrderDetailData['creator'];
    can: AdminOrderDetailData['can'];
    backUrl: string;
    backLabel: string;
    onRequestAdjustment?: () => void;
}

export default function OrderDetailHeader({
    order,
    customer,
    salesman,
    creator,
    can,
    backUrl,
    backLabel,
    onRequestAdjustment,
}: OrderDetailHeaderProps) {
    const handlePrint = () => {
        if (order.invoice?.id) {
            window.open(`/invoices/${order.invoice.id}/print`, '_blank');
        } else {
            window.print();
        }
    };

    const isReviewable = order.is_reviewable;

    return (
        <div className="space-y-4">
            {/* Top Navigation Bar & Action Entry Points */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 print:hidden">
                <div className="flex items-center gap-2">
                    <Link href={backUrl}>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>{backLabel}</span>
                        </Button>
                    </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link href="/admin/orders">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <ListFilter className="h-3.5 w-3.5" />
                            <span>All Orders</span>
                        </Button>
                    </Link>

                    {can.review && isReviewable && (
                        <Link href={`/admin/orders/${order.id}/review`}>
                            <Button size="sm" className="gap-1.5 text-xs bg-primary hover:bg-primary/90 shadow-sm">
                                <FileText className="h-3.5 w-3.5" />
                                <span>Open Review Workspace</span>
                            </Button>
                        </Link>
                    )}

                    {can.request_adjustment && onRequestAdjustment && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRequestAdjustment}
                            className="gap-1.5 text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/60"
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                            <span>Request Adjustment</span>
                        </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print Summary</span>
                    </Button>
                </div>
            </div>

            {/* Title & Metadata Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                            {order.order_number}
                        </h1>
                        <Badge variant="outline" className="text-xs font-mono font-normal">
                            v{order.version}
                        </Badge>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs font-medium text-muted-foreground">
                            {customer.name} ({customer.code})
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground mt-1.5">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                            <span>
                                {order.submitted_at_formatted
                                    ? `Submitted ${order.submitted_at_formatted}`
                                    : `Created ${new Date(order.created_at).toLocaleDateString()}`}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                            <span>
                                Salesman: <span className="font-medium text-foreground">{salesman.name}</span>
                            </span>
                        </div>
                        {creator && creator.id !== salesman.id && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">
                                    (Created by: <span className="font-medium text-foreground">{creator.name}</span>)
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Five Independent Status Dimensions Command Bar */}
            <div className="bg-card border rounded-lg p-3.5 shadow-sm">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                    Multi-Dimensional Operational Status
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <OrderStatusBadge
                        dimension="order"
                        label={order.status_label}
                        variant={order.status_badge_variant}
                        showDimensionLabel={true}
                        size="md"
                    />
                    <OrderStatusBadge
                        dimension="fulfillment"
                        label={order.fulfillment_status_label ?? 'Unallocated'}
                        variant={order.fulfillment_badge_variant ?? 'secondary'}
                        showDimensionLabel={true}
                        size="md"
                    />
                    <OrderStatusBadge
                        dimension="payment"
                        label={order.payment_status_label ?? 'Unpaid'}
                        variant={order.payment_badge_variant ?? 'destructive'}
                        showDimensionLabel={true}
                        size="md"
                    />
                    <OrderStatusBadge
                        dimension="delivery"
                        label={order.delivery_status_label ?? 'Pending Assignment'}
                        variant={order.delivery_badge_variant ?? 'secondary'}
                        showDimensionLabel={true}
                        size="md"
                    />
                    <OrderStatusBadge
                        dimension="adjustment"
                        label={order.adjustment_status_label ?? 'None'}
                        variant={order.adjustment_badge_variant ?? 'secondary'}
                        showDimensionLabel={true}
                        size="md"
                    />
                </div>
            </div>

            {/* Contextual Status Alert Banners */}
            {order.status === 'DRAFT' && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3.5 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                            Draft Order Record
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            This order is currently drafted and has not been formally submitted to operational workflows.
                        </p>
                    </div>
                </div>
            )}

            {isReviewable && (
                <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-xs font-semibold text-sky-900 dark:text-sky-200">
                                Order Awaiting Administrative Review
                            </h4>
                            <p className="text-xs text-sky-700 dark:text-sky-300 mt-0.5">
                                This order is in {order.status_label} state. Open the Review Workspace to evaluate customer credit, pricing overrides, and approve or reject.
                            </p>
                        </div>
                    </div>
                    {can.review && (
                        <Link href={`/admin/orders/${order.id}/review`} className="shrink-0">
                            <Button size="sm" className="text-xs gap-1.5 shadow-sm">
                                <FileText className="h-3.5 w-3.5" />
                                <span>Review Order</span>
                            </Button>
                        </Link>
                    )}
                </div>
            )}

            {order.status === 'APPROVED' && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3.5 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                            Order Approved & Order-Level Reservation Active
                        </h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                            {order.approver
                                ? `Approved by ${order.approver.name} on ${order.approved_at ? new Date(order.approved_at).toLocaleString() : 'N/A'}.`
                                : 'Order is approved.'}{' '}
                            Fulfillable quantities have established order-level reservation state. Physical stock picking is handled downstream in Warehouse Operations.
                        </p>
                    </div>
                </div>
            )}

            {(order.status === 'CANCELLED' || order.status === 'REJECTED') && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-3.5 flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                            {order.status === 'REJECTED' ? 'Order Rejected by Administration' : 'Order Cancelled'}
                        </h4>
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                            {order.canceller ? `Decision recorded by ${order.canceller.name} on ` : 'Recorded on '}
                            {order.cancelled_at ? new Date(order.cancelled_at).toLocaleString() : 'N/A'}.
                        </p>
                        {order.cancellation_reason && (
                            <div className="mt-2 text-xs bg-rose-100/70 dark:bg-rose-900/40 p-2.5 rounded border border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100 font-mono">
                                <span className="font-semibold font-sans">Documented Reason:</span> {order.cancellation_reason}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {order.status === 'COMPLETED' && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3.5 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                            Order Completed
                        </h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                            This order has completed all operational phases and is closed.
                            {order.completed_at ? ` Completed at ${new Date(order.completed_at).toLocaleString()}.` : ''}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
