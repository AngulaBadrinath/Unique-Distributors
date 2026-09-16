import React, { useState, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button, buttonVariants } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import { PaginatedResponse, PageProps } from '@/types';
import {
    Boxes,
    Search,
    Filter,
    Package,
    CheckCircle2,
    Clock,
    Truck,
    ChevronRight,
    ArrowUpDown,
    CheckSquare,
    Send,
    Eye,
    MapPin,
    Calendar,
    User,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FulfillmentOrderRow {
    id: number;
    order_number: string;
    customer: {
        id: number;
        name: string;
        code: string;
        phone?: string;
        city?: string;
        state?: string;
    };
    status: string;
    status_label: string;
    fulfillment_status: string;
    fulfillment_status_label: string;
    total_ordered: number;
    total_picked: number;
    total_dispatched: number;
    grand_total: string;
    approved_at?: string;
    delivery?: {
        id: number;
        delivery_number: string;
        status: string;
        driver_name?: string;
        scheduled_date?: string;
    } | null;
    items_count: number;
}

interface WarehouseFulfillmentIndexProps {
    orders: PaginatedResponse<FulfillmentOrderRow>;
    badgeCounts: {
        all: number;
        awaiting: number;
        in_fulfillment: number;
        ready_dispatch: number;
    };
    filters: {
        tab?: string;
        search?: string;
        fulfillment_status?: string;
    };
    capabilities: {
        can_pick: boolean;
        can_pack: boolean;
        can_dispatch: boolean;
        can_assign_delivery: boolean;
    };
}

export default function WarehouseFulfillmentIndex({
    orders,
    badgeCounts,
    filters,
    capabilities,
}: WarehouseFulfillmentIndexProps) {
    const { flash } = usePage<PageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const currentTab = filters.tab || 'all';

    const [dispatchingOrderId, setDispatchingOrderId] = useState<number | null>(null);

    // Debounced search
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== (filters.search || '')) {
                applyFilters({ search });
            }
        }, 350);
        return () => clearTimeout(timeout);
    }, [search]);

    const applyFilters = (newFilters: Partial<typeof filters>) => {
        router.get(
            '/admin/warehouse/fulfillment',
            {
                ...filters,
                ...newFilters,
                page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleQuickPick = (e: React.MouseEvent, orderId: number) => {
        e.stopPropagation();
        router.post(`/admin/warehouse/fulfillment/${orderId}/pick`, {}, {
            preserveScroll: true,
        });
    };

    const handleQuickPack = (e: React.MouseEvent, orderId: number) => {
        e.stopPropagation();
        router.post(`/admin/warehouse/fulfillment/${orderId}/pack`, {}, {
            preserveScroll: true,
        });
    };

    const handleQuickDispatch = (e: React.MouseEvent, orderId: number) => {
        e.stopPropagation();
        setDispatchingOrderId(orderId);
        router.post(`/admin/warehouse/fulfillment/${orderId}/dispatch`, {}, {
            preserveScroll: true,
            onFinish: () => setDispatchingOrderId(null),
        });
    };

    const getFulfillmentBadge = (status: string) => {
        switch (status) {
            case 'RESERVED':
                return (
                    <Badge variant="outline" className="bg-amber-950/40 text-amber-400 border-amber-800/60 font-mono text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Awaiting Pick
                    </Badge>
                );
            case 'PICKED':
                return (
                    <Badge variant="outline" className="bg-indigo-950/40 text-indigo-400 border-indigo-800/60 font-mono text-xs">
                        <CheckSquare className="h-3 w-3 mr-1" />
                        Picked
                    </Badge>
                );
            case 'PACKED':
                return (
                    <Badge variant="outline" className="bg-purple-950/40 text-purple-400 border-purple-800/60 font-mono text-xs">
                        <Package className="h-3 w-3 mr-1" />
                        Packed
                    </Badge>
                );
            case 'DISPATCHED':
                return (
                    <Badge variant="outline" className="bg-blue-950/40 text-blue-400 border-blue-800/60 font-mono text-xs">
                        <Truck className="h-3 w-3 mr-1" />
                        Dispatched
                    </Badge>
                );
            case 'DELIVERED':
                return (
                    <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/60 font-mono text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Delivered
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="bg-slate-800 text-slate-300 font-mono text-xs">
                        {status}
                    </Badge>
                );
        }
    };

    return (
        <AppLayout>
            <Head title="Warehouse Fulfillment Workspace" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <Boxes className="h-6 w-6 text-indigo-400" />
                            <h1 className="text-2xl font-bold tracking-tight text-brand-foreground font-mono">
                                Warehouse Fulfillment
                            </h1>
                            <Badge variant="outline" className="text-xs font-mono">
                                {badgeCounts.all} Active Orders
                            </Badge>
                        </div>
                        <p className="text-sm text-brand-muted mt-1">
                            Physical order processing workspace: pick inventory, pack cartons, and dispatch to logistics.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/deliveries"
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2 font-mono text-xs')}
                        >
                            <Truck className="h-3.5 w-3.5" />
                            Logistics Queue
                        </Link>
                    </div>
                </div>

                {/* Tab Navigation & Badge Counters */}
                <div className="flex flex-wrap gap-2 border-b border-border/40 pb-3">
                    <button
                        onClick={() => applyFilters({ tab: 'all' })}
                        className={cn(
                            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                            currentTab === 'all'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-brand-surface text-brand-muted hover:text-brand-foreground hover:bg-brand-surface/80'
                        )}
                    >
                        All Orders
                        <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono">
                            {badgeCounts.all}
                        </span>
                    </button>

                    <button
                        onClick={() => applyFilters({ tab: 'awaiting' })}
                        className={cn(
                            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                            currentTab === 'awaiting'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-brand-surface text-amber-400/80 hover:text-amber-300 hover:bg-brand-surface/80'
                        )}
                    >
                        <Clock className="h-3.5 w-3.5" />
                        Awaiting Fulfillment
                        <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono">
                            {badgeCounts.awaiting}
                        </span>
                    </button>

                    <button
                        onClick={() => applyFilters({ tab: 'in_fulfillment' })}
                        className={cn(
                            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                            currentTab === 'in_fulfillment'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-brand-surface text-indigo-400/80 hover:text-indigo-300 hover:bg-brand-surface/80'
                        )}
                    >
                        <Package className="h-3.5 w-3.5" />
                        In Fulfillment (Pick/Pack)
                        <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono">
                            {badgeCounts.in_fulfillment}
                        </span>
                    </button>

                    <button
                        onClick={() => applyFilters({ tab: 'ready_dispatch' })}
                        className={cn(
                            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                            currentTab === 'ready_dispatch'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-brand-surface text-blue-400/80 hover:text-blue-300 hover:bg-brand-surface/80'
                        )}
                    >
                        <Truck className="h-3.5 w-3.5" />
                        Dispatched / Ready
                        <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono">
                            {badgeCounts.ready_dispatch}
                        </span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
                    <Input
                        placeholder="Search by order number (#ORD-...) or customer name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-brand-surface border-border/60 text-brand-foreground placeholder:text-brand-muted/60 text-xs"
                    />
                </div>

                {/* Orders Table */}
                <Card className="border-border/60 bg-brand-surface/40 shadow-xs overflow-hidden">
                    <CardContent className="p-0">
                        {orders.data.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <div className="mx-auto w-12 h-12 rounded-full bg-brand-surface border border-border/60 flex items-center justify-center text-brand-muted">
                                    <Boxes className="h-6 w-6" />
                                </div>
                                <h3 className="text-base font-medium text-brand-foreground font-mono">No fulfillment tasks in queue</h3>
                                <p className="text-sm text-brand-muted max-w-sm mx-auto">
                                    {search
                                        ? 'No orders match your search criteria.'
                                        : 'All approved orders have been processed, or no orders are currently awaiting warehouse action.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-brand-surface border-b border-border/60 text-xs font-mono uppercase text-brand-muted">
                                        <tr>
                                            <th className="py-3.5 px-4 font-semibold">Order</th>
                                            <th className="py-3.5 px-4 font-semibold">Customer & Destination</th>
                                            <th className="py-3.5 px-4 font-semibold text-center">Fulfillment State</th>
                                            <th className="py-3.5 px-4 font-semibold text-center">Progress (Units)</th>
                                            <th className="py-3.5 px-4 font-semibold text-center">Delivery Link</th>
                                            <th className="py-3.5 px-4 text-right">Fulfillment Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40 font-mono text-xs">
                                        {orders.data.map((order) => {
                                            const isReserved = order.fulfillment_status === 'RESERVED';
                                            const isPicked = order.fulfillment_status === 'PICKED';
                                            const isPacked = order.fulfillment_status === 'PACKED';
                                            const isDispatched = order.fulfillment_status === 'DISPATCHED';

                                            return (
                                                <tr
                                                    key={order.id}
                                                    className="hover:bg-brand-surface/60 transition-colors group cursor-pointer"
                                                    onClick={() => router.get(`/admin/warehouse/fulfillment/${order.id}`)}
                                                >
                                                    <td className="py-3.5 px-4 font-medium text-brand-foreground">
                                                        <div className="font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                                                            {order.order_number}
                                                        </div>
                                                        <div className="text-[11px] text-brand-muted mt-0.5">
                                                            {order.items_count} line items • ${Number(order.grand_total).toFixed(2)}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-semibold text-brand-foreground">{order.customer.name}</div>
                                                        <div className="text-brand-muted text-[11px] flex items-center gap-1 mt-0.5">
                                                            <MapPin className="h-3 w-3 text-brand-muted/70" />
                                                            {order.customer.city || 'Standard'}, {order.customer.state || 'Hub'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        {getFulfillmentBadge(order.fulfillment_status)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className="font-bold text-foreground">
                                                                {isDispatched ? order.total_dispatched : (isPacked || isPicked ? order.total_picked : 0)} / {order.total_ordered}
                                                            </span>
                                                            <span className="text-[10px] text-brand-muted uppercase">
                                                                {isDispatched ? 'Dispatched' : (isPacked ? 'Packed' : (isPicked ? 'Picked' : 'Reserved'))}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        {order.delivery ? (
                                                            <div className="inline-flex flex-col items-center">
                                                                <Badge variant="outline" className="text-[10px] bg-indigo-950/40 text-indigo-300 border-indigo-800/60">
                                                                    #{order.delivery.delivery_number}
                                                                </Badge>
                                                                <span className="text-[10px] text-brand-muted mt-0.5">
                                                                    {order.delivery.driver_name ? `Driver: ${order.delivery.driver_name}` : 'Unassigned'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-brand-muted text-[11px]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isReserved && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={(e) => handleQuickPick(e, order.id)}
                                                                    className="h-7 px-2.5 text-[11px] bg-indigo-950/30 text-indigo-400 border-indigo-800/60 hover:bg-indigo-900/50"
                                                                >
                                                                    <CheckSquare className="h-3 w-3 mr-1" />
                                                                    Pick All
                                                                </Button>
                                                            )}

                                                            {isPicked && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={(e) => handleQuickPack(e, order.id)}
                                                                    className="h-7 px-2.5 text-[11px] bg-purple-950/30 text-purple-400 border-purple-800/60 hover:bg-purple-900/50"
                                                                >
                                                                    <Package className="h-3 w-3 mr-1" />
                                                                    Pack Order
                                                                </Button>
                                                            )}

                                                            {(isPacked || isPicked) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={dispatchingOrderId === order.id}
                                                                    onClick={(e) => handleQuickDispatch(e, order.id)}
                                                                    className="h-7 px-2.5 text-[11px] bg-blue-950/30 text-blue-400 border-blue-800/60 hover:bg-blue-900/50"
                                                                >
                                                                    {dispatchingOrderId === order.id ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                                    ) : (
                                                                        <Send className="h-3 w-3 mr-1" />
                                                                    )}
                                                                    Dispatch
                                                                </Button>
                                                            )}

                                                            <Link
                                                                href={`/admin/warehouse/fulfillment/${order.id}`}
                                                                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 px-2 text-brand-muted hover:text-brand-foreground')}
                                                            >
                                                                <ChevronRight className="h-4 w-4" />
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {orders.total > orders.per_page && (
                    <div className="flex items-center justify-between border-t border-border/40 pt-4">
                        <p className="text-xs font-mono text-brand-muted">
                            Showing {orders.from} to {orders.to} of {orders.total} fulfillment orders
                        </p>
                        <div className="flex items-center gap-1">
                            {orders.links.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.url || '#'}
                                    preserveScroll
                                    preserveState
                                    className={cn(
                                        buttonVariants({
                                            variant: link.active ? 'default' : 'outline',
                                            size: 'sm',
                                        }),
                                        'h-8 px-3 text-xs font-mono',
                                        !link.url && 'opacity-40 pointer-events-none'
                                    )}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
