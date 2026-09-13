import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { 
    Layers, 
    TrendingUp, 
    Users, 
    Boxes, 
    CreditCard, 
    Truck, 
    ArrowUpRight, 
    Clock, 
    CheckCircle2, 
    AlertTriangle,
    ShieldAlert,
    ChevronRight,
    PackagePlus,
    FileSpreadsheet,
    DollarSign,
    Activity,
    Compass
} from 'lucide-react';

interface OperationalMetrics {
    pending_approval_orders: number;
    today_orders_count: number;
    today_sales_volume: string;
    active_customers_count: number;
    low_stock_items_count: number;
    pending_payments_count: number;
    active_deliveries_count: number;
}

interface RecentOrderItem {
    id: number;
    order_number: string;
    customer_name: string;
    salesman_name: string;
    status: string;
    grand_total: string;
    created_at: string;
}

interface DashboardProps {
    metrics: OperationalMetrics;
    recentOrders: RecentOrderItem[];
}

export default function Dashboard({ metrics, recentOrders }: DashboardProps) {
    const formatCurrency = (val: string | number) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? '$0.00' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
            case 'COMPLETED':
                return <Badge variant="success" className="font-mono text-[10px]">{status}</Badge>;
            case 'SUBMITTED':
                return <Badge variant="warning" className="font-mono text-[10px]">PENDING APPROVAL</Badge>;
            case 'REJECTED':
            case 'CANCELLED':
                return <Badge variant="destructive" className="font-mono text-[10px]">{status}</Badge>;
            default:
                return <Badge variant="outline" className="font-mono text-[10px]">{status}</Badge>;
        }
    };

    return (
        <AppLayout title="Executive Command Center">
            <Head title="Executive Dashboard" />

            <div className="space-y-6">
                {/* Header Welcome Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse glow-cyan" />
                            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">Live Enterprise Operations</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                            Executive Overview
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                            Real-time transaction flow, live fulfillment queues, and liquidity balances.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Link href="/admin/orders">
                            <Button size="sm" variant="action" className="text-xs flex items-center gap-1.5 cursor-pointer shadow-neu-dark">
                                <Layers className="h-3.5 w-3.5" />
                                <span>Review Orders ({metrics.pending_approval_orders})</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Featured Executive Showcase: Master Revenue Card with Glowing Sparkline (Reference 01) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Featured Large Dark Glass Card */}
                    <Card variant="executive" className="lg:col-span-2 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                                    Wholesale Sales Volume
                                </span>
                                <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono mt-1 tracking-tight">
                                    {formatCurrency(metrics.today_sales_volume)}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                                        <TrendingUp className="h-3 w-3" /> +19.4% Today
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {metrics.today_orders_count} orders processed in current cycle
                                    </span>
                                </div>
                            </div>

                            <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 glow-cyan-subtle">
                                <DollarSign className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Luminous Glowing Sparkline Wave (Inspired by Reference 01) */}
                        <div className="mt-8 pt-4 border-t border-white/8">
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono mb-2">
                                <span>Cycle Trajectory</span>
                                <span className="text-cyan-400 font-semibold">98.4% Fulfillment Rate</span>
                            </div>
                            <div className="h-16 w-full flex items-end gap-1 sm:gap-2">
                                {[40, 55, 38, 65, 48, 80, 72, 90, 85, 95, 78, 92, 100].map((val, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                        <div 
                                            className="w-full bg-gradient-to-t from-cyan-600/40 via-cyan-400/80 to-cyan-300 rounded-t-sm transition-all duration-300 group-hover:from-cyan-500 group-hover:to-cyan-200"
                                            style={{ height: `${val}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Operational Progress Ring & Health Card */}
                    <Card variant="default" className="p-6 rounded-2xl flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                                    Warehouse Health
                                </span>
                                <Badge variant="brand" className="text-[10px]">Optimal</Badge>
                            </div>

                            {/* Dual-tone Progress Ring (Inspired by Reference 01 & 02) */}
                            <div className="flex items-center justify-center my-6">
                                <div className="relative flex items-center justify-center">
                                    <div className="h-32 w-32 rounded-full border-8 border-white/5 border-t-cyan-400 border-r-indigo-500 animate-spin-slow glow-cyan-subtle flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold font-mono text-white">91%</div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-mono">Capacity</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-white/8 text-xs font-mono">
                            <div className="flex justify-between text-muted-foreground">
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Active Customers</span>
                                <span className="text-white font-semibold">{metrics.active_customers_count}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-400" /> Dispatched Shipments</span>
                                <span className="text-white font-semibold">{metrics.active_deliveries_count}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Top Supporting KPI Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Pending Approvals */}
                    <Card variant="interactive" className="p-5 rounded-2xl">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Pending Approval
                            </span>
                            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold font-mono text-white mt-1">
                            {metrics.pending_approval_orders}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/8 text-[11px] text-muted-foreground">
                            <span>Order intake queue</span>
                            <Link href="/admin/orders" className="text-cyan-400 hover:underline font-medium flex items-center gap-0.5">
                                Review <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </Card>

                    {/* Card 2: Low Stock SKUs */}
                    <Card variant="interactive" className="p-5 rounded-2xl">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Low Stock Alerts
                            </span>
                            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <Boxes className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold font-mono text-white mt-1">
                            {metrics.low_stock_items_count}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/8 text-[11px] text-muted-foreground">
                            <span>Reorder thresholds breached</span>
                            <Link href="/admin/inventory" className="text-cyan-400 hover:underline font-medium flex items-center gap-0.5">
                                Stock <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </Card>

                    {/* Card 3: In-Transit Deliveries */}
                    <Card variant="interactive" className="p-5 rounded-2xl">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                In-Transit Fleets
                            </span>
                            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                <Truck className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold font-mono text-white mt-1">
                            {metrics.active_deliveries_count}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/8 text-[11px] text-muted-foreground">
                            <span>Live dispatch routes</span>
                            <Link href="/admin/deliveries" className="text-cyan-400 hover:underline font-medium flex items-center gap-0.5">
                                Logistics <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </Card>

                    {/* Card 4: Cheque & Transfer Verifications */}
                    <Card variant="interactive" className="p-5 rounded-2xl">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Unverified Payments
                            </span>
                            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                <CreditCard className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold font-mono text-white mt-1">
                            {metrics.pending_payments_count}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/8 text-[11px] text-muted-foreground">
                            <span>Cheque/transfer review</span>
                            <Link href="/admin/payments" className="text-cyan-400 hover:underline font-medium flex items-center gap-0.5">
                                Verify <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </Card>
                </div>

                {/* Operations Grid: Recent Orders + Quick Operations Hub */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left 2 Cols: Recent Order Submissions */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2 font-sans">
                                <Layers className="h-4 w-4 text-cyan-400" />
                                <span>Recent Sales Orders</span>
                            </h3>
                            <Link href="/admin/orders" className="text-xs text-cyan-400 hover:underline font-medium">
                                View all orders &rarr;
                            </Link>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-dark-surface overflow-hidden shadow-neu-dark">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="border-b border-white/8 bg-dark-surface-elevated/90 font-mono text-muted-foreground uppercase text-[10px]">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Order Number</th>
                                            <th className="px-4 py-3 font-medium">Customer</th>
                                            <th className="px-4 py-3 font-medium">Sales Rep</th>
                                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                                            <th className="px-4 py-3 font-medium text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {recentOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                                    No orders recorded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            recentOrders.map((order) => (
                                                <tr key={order.id} className="hover:bg-white/4 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-medium text-white">
                                                        <Link href={`/admin/orders/${order.id}`} className="hover:text-cyan-300 hover:underline">
                                                            {order.order_number}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 text-white font-medium truncate max-w-[140px]">
                                                        {order.customer_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                                                        {order.salesman_name}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-semibold text-right text-white">
                                                        {formatCurrency(order.grand_total)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {getStatusBadge(order.status)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right 1 Col: Operational Shortcuts & Risk Snapshot */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2 font-sans">
                            <CreditCard className="h-4 w-4 text-cyan-400" />
                            <span>Executive Queues</span>
                        </h3>

                        <div className="space-y-3">
                            {/* Queue 1: Payment Verification */}
                            <div className="p-4 rounded-2xl border border-white/8 bg-dark-surface shadow-neu-dark flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-white block">
                                        Payment Verification
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        {metrics.pending_payments_count} cheques/transfers awaiting review
                                    </span>
                                </div>
                                <Link href="/admin/payments">
                                    <Button size="sm" variant="outline" className="text-xs cursor-pointer">
                                        Verify
                                    </Button>
                                </Link>
                            </div>

                            {/* Queue 2: Customer Accounts */}
                            <div className="p-4 rounded-2xl border border-white/8 bg-dark-surface shadow-neu-dark flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-white block">
                                        Customer Master
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        {metrics.active_customers_count} active merchant accounts
                                    </span>
                                </div>
                                <Link href="/customers">
                                    <Button size="sm" variant="outline" className="text-xs cursor-pointer">
                                        Manage
                                    </Button>
                                </Link>
                            </div>

                            {/* Queue 3: Receivables & Subledger */}
                            <div className="p-4 rounded-2xl border border-white/8 bg-dark-surface shadow-neu-dark flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-white block">
                                        Accounts Receivable
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        Subledger balances & aging statements
                                    </span>
                                </div>
                                <Link href="/admin/receivables">
                                    <Button size="sm" variant="outline" className="text-xs cursor-pointer">
                                        Ledger
                                    </Button>
                                </Link>
                            </div>

                            {/* Queue 4: General Ledger Reports */}
                            <div className="p-4 rounded-2xl border border-white/8 bg-dark-surface shadow-neu-dark flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-white block">
                                        Financial Reporting
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        P&L, Balance Sheet, and Trial Balance
                                    </span>
                                </div>
                                <Link href="/admin/reports/financial">
                                    <Button size="sm" variant="outline" className="text-xs cursor-pointer">
                                        Reports
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
