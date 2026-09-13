import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DeliveryLayout from '@/Layouts/DeliveryLayout';
import { 
    Truck, 
    Navigation, 
    CheckCircle2, 
    Clock, 
    MapPin, 
    Package, 
    ChevronRight,
} from 'lucide-react';
import { Badge } from '@/Components/ui/badge';

interface DeliveryItem {
    id: number;
    deliverable_quantity: number;
    delivered_quantity: number;
    product?: {
        id: number;
        name: string;
        sku: string;
    };
}

interface DeliverySummary {
    id: number;
    delivery_number: string;
    status: string;
    scheduled_date: string;
    delivery_window?: string;
    delivery_contact_name?: string;
    delivery_contact_phone?: string;
    delivery_address_line1: string;
    delivery_city: string;
    delivery_state: string;
    delivery_postal_code: string;
    order?: {
        id: number;
        order_number: string;
        grand_total: string | number;
    };
    customer?: {
        id: number;
        name: string;
        customer_code: string;
        phone: string;
    };
    items?: DeliveryItem[];
}

interface DeliveryIndexProps {
    deliveries: {
        data: DeliverySummary[];
        links: any[];
        total: number;
        current_page: number;
        last_page: number;
    };
    counts: {
        today: number;
        active: number;
        pending: number;
        completed: number;
        all: number;
    };
    currentTab: string;
    driver: {
        id: number;
        name: string;
        email: string;
    };
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'ASSIGNED':
            return {
                label: 'Assigned (Pickup Pending)',
                bg: 'bg-muted border-border text-muted-foreground',
                dot: 'bg-muted-foreground'
            };
        case 'PICKED_UP':
            return {
                label: 'Picked Up (Ready)',
                bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
                dot: 'bg-amber-500'
            };
        case 'OUT_FOR_DELIVERY':
            return {
                label: 'Out for Delivery',
                bg: 'bg-action-accent/10 border-action-accent/30 text-action-accent',
                dot: 'bg-action-accent animate-pulse'
            };
        case 'DELIVERED':
            return {
                label: 'Delivered',
                bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
                dot: 'bg-emerald-500'
            };
        case 'FAILED_ATTEMPT':
        case 'CANCELLED':
            return {
                label: status === 'CANCELLED' ? 'Cancelled' : 'Failed Attempt',
                bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300',
                dot: 'bg-rose-500'
            };
        default:
            return {
                label: status,
                bg: 'bg-muted border-border text-muted-foreground',
                dot: 'bg-muted-foreground'
            };
    }
};

export default function DeliveryIndex({ deliveries, counts, currentTab, driver }: DeliveryIndexProps) {
    const handleTabChange = (tab: string) => {
        router.get('/delivery', { tab }, { preserveState: true, preserveScroll: true });
    };

    return (
        <DeliveryLayout title="My Deliveries">
            <Head title="Driver Deliveries" />

            <div className="space-y-4">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                        onClick={() => handleTabChange('today')}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer ${
                            currentTab === 'today'
                                ? 'bg-[#D7FFE0] border-[#063312]/30 text-[#063312] shadow-xs ring-1 ring-[#063312]/20'
                                : 'bg-card border-border hover:border-border/80 text-foreground'
                        }`}
                    >
                        <div className="flex items-center justify-between opacity-80 mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider">Today</span>
                            <Clock className="w-4 h-4" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight">{counts.today}</div>
                        <span className="text-[11px] opacity-75">Scheduled</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('active')}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer ${
                            currentTab === 'active'
                                ? 'bg-[#D7FFE0] border-[#063312]/30 text-[#063312] shadow-xs ring-1 ring-[#063312]/20'
                                : 'bg-card border-border hover:border-border/80 text-foreground'
                        }`}
                    >
                        <div className="flex items-center justify-between opacity-80 mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider">In Transit</span>
                            <Navigation className="w-4 h-4" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight">{counts.active}</div>
                        <span className="text-[11px] opacity-75">En Route</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('pending')}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer ${
                            currentTab === 'pending'
                                ? 'bg-[#D7FFE0] border-[#063312]/30 text-[#063312] shadow-xs ring-1 ring-[#063312]/20'
                                : 'bg-card border-border hover:border-border/80 text-foreground'
                        }`}
                    >
                        <div className="flex items-center justify-between opacity-80 mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider">Pickup</span>
                            <Package className="w-4 h-4" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight">{counts.pending}</div>
                        <span className="text-[11px] opacity-75">At Warehouse</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('completed')}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer ${
                            currentTab === 'completed'
                                ? 'bg-[#D7FFE0] border-[#063312]/30 text-[#063312] shadow-xs ring-1 ring-[#063312]/20'
                                : 'bg-card border-border hover:border-border/80 text-foreground'
                        }`}
                    >
                        <div className="flex items-center justify-between opacity-80 mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider">Delivered</span>
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight">{counts.completed}</div>
                        <span className="text-[11px] opacity-75">Success</span>
                    </button>
                </div>

                {/* Delivery List */}
                <div className="space-y-3">
                    {deliveries.data.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-card border border-border text-center shadow-2xs">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                                <Truck className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground mb-1">No deliveries found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                There are no delivery missions currently in this queue. Check back or change tabs.
                            </p>
                        </div>
                    ) : (
                        deliveries.data.map((del) => {
                            const badge = getStatusBadge(del.status);
                            const totalQty = del.items?.reduce((sum, item) => sum + (item.deliverable_quantity || 0), 0) || 0;

                            return (
                                <Link
                                    key={del.id}
                                    href={`/delivery/${del.id}`}
                                    className="block p-4 rounded-2xl bg-card border border-border hover:border-border/80 active:scale-[0.99] transition-all shadow-2xs hover:shadow-xs group cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2.5">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono font-semibold text-white bg-primary px-2 py-0.5 rounded-md">
                                                    {del.delivery_number}
                                                </span>
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    Order {del.order?.order_number}
                                                </span>
                                            </div>
                                            <h2 className="text-base font-bold text-foreground tracking-tight group-hover:text-action-accent transition-colors">
                                                {del.customer?.name || 'Customer'}
                                            </h2>
                                        </div>

                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badge.bg}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                            <span>{badge.label}</span>
                                        </div>
                                    </div>

                                    {/* Address & Items Snapshot */}
                                    <div className="space-y-1.5 pt-2.5 border-t border-border/60 text-xs text-muted-foreground">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                            <span className="line-clamp-1 text-foreground/90">
                                                {del.delivery_address_line1}, {del.delivery_city}, {del.delivery_state} {del.delivery_postal_code}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <Package className="w-3.5 h-3.5" />
                                                    {totalQty} units ({del.items?.length || 0} items)
                                                </span>
                                                {del.delivery_window && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {del.delivery_window}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 text-action-accent font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
                                                <span>View mission</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>
        </DeliveryLayout>
    );
}
