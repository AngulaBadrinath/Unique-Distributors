import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import AssignDeliveryModal from '@/Components/Delivery/AssignDeliveryModal';
import DeliveryTimeline, { DeliveryTimelineEvent } from '@/Components/Delivery/DeliveryTimeline';
import {
    Truck,
    Search,
    RotateCcw,
    Calendar,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Package,
    Navigation,
    UserCheck,
    UserPlus,
    Eye,
    Filter,
    ArrowUpDown,
    MapPin,
    Phone,
    X,
    ExternalLink
} from 'lucide-react';

interface DriverInfo {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
}

interface CustomerInfo {
    id: number;
    name: string;
    customer_code: string;
    phone?: string;
    city?: string;
    state?: string;
}

interface OrderInfo {
    id: number;
    order_number: string;
    status: string;
    fulfillment_status: string;
    grand_total: string | number;
}

interface DeliveryItemSummary {
    id: number;
    deliverable_quantity: number;
    delivered_quantity: number;
    product?: {
        id: number;
        name: string;
        sku: string;
    };
}

interface DeliveryRow {
    id: number;
    delivery_number: string;
    order_id: number;
    customer_id: number;
    driver_id?: number | null;
    status: string;
    delivery_contact_name?: string;
    delivery_contact_phone?: string;
    delivery_address_line1: string;
    delivery_city: string;
    delivery_state: string;
    delivery_postal_code: string;
    scheduled_date: string;
    delivery_window?: string;
    assigned_at?: string;
    picked_up_at?: string;
    out_for_delivery_at?: string;
    delivered_at?: string;
    failed_at?: string;
    returned_at?: string;
    recipient_name?: string;
    order?: OrderInfo;
    customer?: CustomerInfo;
    driver?: DriverInfo;
    items?: DeliveryItemSummary[];
}

interface PaginatedDeliveries {
    data: DeliveryRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
}

interface AdminDeliveriesIndexProps {
    deliveries: PaginatedDeliveries;
    badgeCounts: {
        all: number;
        pending: number;
        assigned: number;
        active_route: number;
        delivered: number;
        failed: number;
        rescheduled: number;
        returned: number;
    };
    availableDrivers: DriverInfo[];
    filters: {
        tab?: string;
        status?: string;
        driver_id?: number | null;
        customer_id?: number | null;
        scheduled_date?: string;
        search?: string;
        sort_by?: string;
        sort_direction?: string;
        per_page?: number;
    };
    capabilities: {
        can_assign: boolean;
        can_update: boolean;
    };
}

export default function AdminDeliveriesIndex({
    deliveries,
    badgeCounts,
    availableDrivers,
    filters,
    capabilities,
}: AdminDeliveriesIndexProps) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedDriver, setSelectedDriver] = useState<string>(filters.driver_id ? String(filters.driver_id) : '');
    const [selectedDate, setSelectedDate] = useState<string>(filters.scheduled_date || '');

    // Assign modal state
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState<{
        orderId: number;
        orderNumber: string;
        deliveryId?: number;
        currentDriverId?: number;
    } | null>(null);

    // Quick History drawer state
    const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false);
    const [timelineDelivery, setTimelineDelivery] = useState<DeliveryRow | null>(null);
    const [timelineEvents, setTimelineEvents] = useState<DeliveryTimelineEvent[]>([]);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    const handleTabChange = (newTab: string) => {
        router.get('/admin/deliveries', {
            ...filters,
            tab: newTab,
            page: 1,
        }, { preserveState: true });
    };

    const handleFilterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/admin/deliveries', {
            ...filters,
            search: searchTerm.trim() || undefined,
            driver_id: selectedDriver || undefined,
            scheduled_date: selectedDate || undefined,
            page: 1,
        }, { preserveState: true });
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedDriver('');
        setSelectedDate('');
        router.get('/admin/deliveries', {
            tab: filters.tab,
        }, { preserveState: true });
    };

    const openAssignModal = (del: DeliveryRow) => {
        if (!del.order) return;
        setAssignTarget({
            orderId: del.order_id,
            orderNumber: del.order.order_number,
            deliveryId: del.id,
            currentDriverId: del.driver_id ?? undefined,
        });
        setAssignModalOpen(true);
    };

    const openTimelineDrawer = (del: DeliveryRow) => {
        setTimelineDelivery(del);
        setTimelineDrawerOpen(true);
        setLoadingTimeline(true);

        fetch(`/delivery/${del.id}/history`, {
            headers: { 'Accept': 'application/json' }
        })
            .then(res => res.json())
            .then(data => {
                setTimelineEvents(data.events || []);
                setLoadingTimeline(false);
            })
            .catch(() => {
                setLoadingTimeline(false);
            });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DELIVERED':
                return <Badge variant="success">Delivered</Badge>;
            case 'OUT_FOR_DELIVERY':
                return <Badge variant="warning" className="animate-pulse">Out for Delivery</Badge>;
            case 'PICKED_UP':
                return <Badge variant="action">Picked Up</Badge>;
            case 'ASSIGNED':
                return <Badge variant="brand">Assigned</Badge>;
            case 'FAILED':
                return <Badge variant="destructive">Failed</Badge>;
            case 'RESCHEDULED':
                return <Badge variant="warning">Rescheduled</Badge>;
            case 'RETURNED_TO_WAREHOUSE':
                return <Badge variant="neutral">Returned to Hub</Badge>;
            default:
                return <Badge variant="outline">Pending</Badge>;
        }
    };

    const currentTab = filters.tab || 'all';

    return (
        <AppLayout>
            <Head title="Logistics & Delivery Operations" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                            <Truck className="w-7 h-7 text-primary" />
                            Logistics & Delivery Operations
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Authoritative mission dispatch, real-time driver tracking, and chain-of-custody audit.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/delivery"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-all"
                        >
                            <Navigation className="w-4 h-4" />
                            <span>Driver Mobile View</span>
                        </Link>
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-3.5 shadow-xs">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Truck className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Missions</span>
                            <p className="text-2xl font-bold text-foreground tracking-tight">{badgeCounts.all}</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-3.5 shadow-xs">
                        <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Navigation className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Transit</span>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">{badgeCounts.active_route}</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-3.5 shadow-xs">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivered</span>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{badgeCounts.delivered}</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-3.5 shadow-xs">
                        <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exceptions</span>
                            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
                                {badgeCounts.failed + badgeCounts.rescheduled + badgeCounts.returned}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs & Filters */}
                <div className="space-y-4">
                    {/* Tab Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
                        {[
                            { key: 'all', label: 'All Missions', count: badgeCounts.all },
                            { key: 'pending', label: 'Pending Assignment', count: badgeCounts.pending },
                            { key: 'assigned', label: 'Assigned', count: badgeCounts.assigned },
                            { key: 'active_route', label: 'In Transit', count: badgeCounts.active_route },
                            { key: 'delivered', label: 'Delivered', count: badgeCounts.delivered },
                            { key: 'failed', label: 'Failed', count: badgeCounts.failed },
                            { key: 'rescheduled', label: 'Rescheduled', count: badgeCounts.rescheduled },
                            { key: 'returned', label: 'Returned to Hub', count: badgeCounts.returned },
                        ].map((t) => (
                            <button
                                key={t.key}
                                onClick={() => handleTabChange(t.key)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                                    currentTab === t.key
                                        ? 'bg-brand-surface text-brand-surface-foreground border border-brand-surface-foreground/20 font-bold shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                }`}
                            >
                                <span>{t.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                    currentTab === t.key ? 'bg-brand-surface-foreground text-brand-surface' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search & Filter Bar */}
                    <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-card p-3.5 rounded-2xl border border-border shadow-xs">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search Delivery #, Order, Customer..."
                                className="pl-9 bg-background border-border text-xs text-foreground placeholder-muted-foreground rounded-xl"
                            />
                        </div>

                        {/* Driver Filter */}
                        <div>
                            <select
                                value={selectedDriver}
                                onChange={(e) => setSelectedDriver(e.target.value)}
                                className="w-full bg-background border border-border text-xs text-foreground rounded-xl px-3 py-2 outline-hidden focus:border-ring focus:ring-1 focus:ring-ring"
                            >
                                <option value="">All Drivers</option>
                                {availableDrivers.map((driver) => (
                                    <option key={driver.id} value={driver.id}>
                                        {driver.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div>
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-background border-border text-xs text-foreground rounded-xl"
                            />
                        </div>

                        {/* Filter Buttons */}
                        <div className="flex items-center gap-2">
                            <Button type="submit" variant="default" className="flex-1 text-xs font-bold rounded-xl min-h-[38px]">
                                Filter
                            </Button>
                            {(searchTerm || selectedDriver || selectedDate) && (
                                <Button
                                    type="button"
                                    onClick={handleClearFilters}
                                    variant="outline"
                                    className="text-xs rounded-xl min-h-[38px]"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Deliveries Table */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                                    <th className="p-3.5">Mission / Delivery #</th>
                                    <th className="p-3.5">Order Ref</th>
                                    <th className="p-3.5">Customer / City</th>
                                    <th className="p-3.5">Assigned Driver</th>
                                    <th className="p-3.5">Scheduled Date</th>
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {deliveries.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-muted-foreground text-xs">
                                            No delivery missions matching current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    deliveries.data.map((del) => (
                                        <tr key={del.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3.5 font-mono font-bold text-foreground">
                                                <Link
                                                    href={`/delivery/${del.id}`}
                                                    className="hover:text-action-accent transition-colors"
                                                >
                                                    {del.delivery_number}
                                                </Link>
                                            </td>

                                            <td className="p-3.5 font-mono text-muted-foreground">
                                                {del.order?.order_number || `Order #${del.order_id}`}
                                            </td>

                                            <td className="p-3.5">
                                                <p className="font-semibold text-foreground">{del.customer?.name || 'Customer'}</p>
                                                <p className="text-muted-foreground text-[11px]">{del.delivery_city}, {del.delivery_state}</p>
                                            </td>

                                            <td className="p-3.5">
                                                {del.driver ? (
                                                    <span className="font-medium text-foreground">{del.driver.name}</span>
                                                ) : (
                                                    <span className="text-amber-600 dark:text-amber-400 italic">Unassigned</span>
                                                )}
                                            </td>

                                            <td className="p-3.5 text-muted-foreground">
                                                <p className="font-medium text-foreground">{del.scheduled_date}</p>
                                                {del.delivery_window && (
                                                    <p className="text-muted-foreground text-[10px]">{del.delivery_window}</p>
                                                )}
                                            </td>

                                            <td className="p-3.5">
                                                {getStatusBadge(del.status)}
                                            </td>

                                            <td className="p-3.5 text-right">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openTimelineDrawer(del)}
                                                        title="Quick Event Timeline"
                                                        className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                                    >
                                                        <Clock className="w-3.5 h-3.5" />
                                                    </button>

                                                    {capabilities.can_assign && (
                                                        <button
                                                            onClick={() => openAssignModal(del)}
                                                            title={del.driver ? 'Reassign Driver' : 'Assign Driver'}
                                                            className="p-1.5 rounded-lg bg-action-accent/10 hover:bg-action-accent/20 text-action-accent border border-action-accent/30 transition-colors"
                                                        >
                                                            {del.driver ? <UserPlus className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}

                                                    <Link
                                                        href={`/delivery/${del.id}`}
                                                        className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                                        title="Full Mission Details"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {deliveries.last_page > 1 && (
                        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                            <span>Showing {deliveries.data.length} of {deliveries.total} deliveries</span>
                            <div className="flex items-center gap-1">
                                {deliveries.links.map((link, i) => (
                                    link.url ? (
                                        <Link
                                            key={i}
                                            href={link.url}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                                link.active
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted hover:bg-muted/80 text-foreground'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-muted/40"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Assign/Reassign Modal */}
            {assignTarget && (
                <AssignDeliveryModal
                    isOpen={assignModalOpen}
                    onClose={() => { setAssignModalOpen(false); setAssignTarget(null); }}
                    orderId={assignTarget.orderId}
                    orderNumber={assignTarget.orderNumber}
                    deliveryId={assignTarget.deliveryId}
                    currentDriverId={assignTarget.currentDriverId}
                    availableDrivers={availableDrivers}
                />
            )}

            {/* Quick Timeline Side Drawer */}
            {timelineDrawerOpen && timelineDelivery && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-action-accent" />
                                    Mission Event Audit
                                </h3>
                                <p className="text-xs font-mono text-muted-foreground">#{timelineDelivery.delivery_number}</p>
                            </div>
                            <button
                                onClick={() => { setTimelineDrawerOpen(false); setTimelineDelivery(null); }}
                                className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto">
                            {loadingTimeline ? (
                                <div className="p-8 text-center text-xs text-muted-foreground">Loading audit history...</div>
                            ) : (
                                <DeliveryTimeline events={timelineEvents} />
                            )}
                        </div>

                        <div className="p-4 border-t border-border">
                            <Link
                                href={`/delivery/${timelineDelivery.id}`}
                                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>Open Full Mission Record</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
