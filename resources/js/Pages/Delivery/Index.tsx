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
    Phone, 
    AlertCircle,
    ChevronRight,
    ArrowRight,
    Calendar
} from 'lucide-react';

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
                bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
                dot: 'bg-indigo-400'
            };
        case 'PICKED_UP':
            return {
                label: 'Picked Up (Ready)',
                bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
                dot: 'bg-amber-400'
            };
        case 'OUT_FOR_DELIVERY':
            return {
                label: 'Out for Delivery',
                bg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
                dot: 'bg-blue-400 animate-pulse'
            };
        case 'DELIVERED':
            return {
                label: 'Delivered',
                bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
                dot: 'bg-emerald-400'
            };
        case 'FAILED':
            return {
                label: 'Delivery Failed',
                bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
                dot: 'bg-rose-400'
            };
        case 'RESCHEDULED':
            return {
                label: 'Rescheduled',
                bg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
                dot: 'bg-purple-400'
            };
        case 'RETURNED_TO_WAREHOUSE':
            return {
                label: 'Returned to Warehouse',
                bg: 'bg-slate-500/15 border-slate-500/30 text-slate-300',
                dot: 'bg-slate-400'
            };
        default:
            return {
                label: status,
                bg: 'bg-slate-800 border-slate-700 text-slate-300',
                dot: 'bg-slate-400'
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
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 ${
                            currentTab === 'today'
                                ? 'bg-indigo-600/20 border-indigo-500/50 shadow-xs ring-1 ring-indigo-500/30'
                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850'
                        }`}
                    >
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-xs font-medium uppercase tracking-wider">Today</span>
                            <Clock className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{counts.today}</div>
                        <span className="text-[11px] text-slate-400">Scheduled</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('active')}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 ${
                            currentTab === 'active'
                                ? 'bg-blue-600/20 border-blue-500/50 shadow-xs ring-1 ring-blue-500/30'
                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850'
                        }`}
                    >
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-xs font-medium uppercase tracking-wider">In Transit</span>
                            <Navigation className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{counts.active}</div>
                        <span className="text-[11px] text-slate-400">En Route</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('pending')}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 ${
                            currentTab === 'pending'
                                ? 'bg-amber-600/20 border-amber-500/50 shadow-xs ring-1 ring-amber-500/30'
                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850'
                        }`}
                    >
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-xs font-medium uppercase tracking-wider">Pickup</span>
                            <Package className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{counts.pending}</div>
                        <span className="text-[11px] text-slate-400">At Warehouse</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('completed')}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-98 ${
                            currentTab === 'completed'
                                ? 'bg-emerald-600/20 border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/30'
                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850'
                        }`}
                    >
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-xs font-medium uppercase tracking-wider">Delivered</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{counts.completed}</div>
                        <span className="text-[11px] text-slate-400">Success</span>
                    </button>
                </div>

                {/* Delivery List */}
                <div className="space-y-3">
                    {deliveries.data.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <Truck className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-white mb-1">No deliveries found</h3>
                            <p className="text-sm text-slate-400 max-w-sm mx-auto">
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
                                    className="block p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-850/80 active:scale-[0.99] transition-all shadow-xs"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2.5">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                                                    {del.delivery_number}
                                                </span>
                                                <span className="text-xs font-medium text-slate-400">
                                                    Order {del.order?.order_number}
                                                </span>
                                            </div>
                                            <h2 className="text-base font-bold text-white tracking-tight">
                                                {del.customer?.name || 'Customer'}
                                            </h2>
                                        </div>

                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badge.bg}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                            <span>{badge.label}</span>
                                        </div>
                                    </div>

                                    {/* Address & Items Snapshot */}
                                    <div className="space-y-1.5 pt-2 border-t border-slate-800/50 text-xs text-slate-300">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                            <span className="line-clamp-1">
                                                {del.delivery_address_line1}, {del.delivery_city}, {del.delivery_state} {del.delivery_postal_code}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-slate-400 pt-1">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <Package className="w-3.5 h-3.5 text-slate-400" />
                                                    {totalQty} units ({del.items?.length || 0} items)
                                                </span>
                                                {del.delivery_window && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        {del.delivery_window}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 text-indigo-400 font-semibold text-xs">
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
