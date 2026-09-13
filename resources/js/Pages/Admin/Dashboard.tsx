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
    DollarSign
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
        <AppLayout title="Operational Command Center">
            <Head title="Executive Dashboard" />

            <div className="space-y-6">
                {/* Header Welcome Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            Operational Overview
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                            Real-time transaction status, fulfillment queues, and risk exceptions.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href="/admin/orders">
                            <Button size="sm" className="text-xs flex items-center gap-1.5 cursor-pointer">
                                <Layers className="h-3.5 w-3.5" />
                                <span>Review Orders</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Top Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Pending Approvals */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Pending Approval
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <Clock className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono text-foreground">
                                {metrics.pending_approval_orders}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                                <span>Action required queue</span>
                                <Link href="/admin/orders" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    Review <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 2: Today's Orders / Sales */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Today's Sales
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono text-foreground">
                                {formatCurrency(metrics.today_sales_volume)}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                                <span>{metrics.today_orders_count} orders submitted today</span>
                                <Link href="/admin/reports/sales" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    Analytics <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 3: Inventory Low Stock Alerts */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Low Stock SKUs
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                <Boxes className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono text-foreground">
                                {metrics.low_stock_items_count}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                                <span>Critical reorder balance</span>
                                <Link href="/admin/inventory" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    Stock <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 4: Active Logistics & In-Transit */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Active In-Transit
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                <Truck className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono text-foreground">
                                {metrics.active_deliveries_count}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                                <span>Logistics out for delivery</span>
                                <Link href="/admin/deliveries" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    Dispatch <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Operations Grid: Recent Orders + Quick Operations Hub */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left 2 Cols: Recent Order Submissions */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                <span>Recent Sales Orders</span>
                            </h3>
                            <Link href="/admin/orders" className="text-xs text-primary hover:underline font-medium">
                                View all orders &rarr;
                            </Link>
                        </div>

                        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="border-b border-border bg-muted/40 font-mono text-muted-foreground uppercase text-[10px]">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Order Number</th>
                                            <th className="px-4 py-3 font-medium">Customer</th>
                                            <th className="px-4 py-3 font-medium">Sales Rep</th>
                                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                                            <th className="px-4 py-3 font-medium text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {recentOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                                    No orders recorded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            recentOrders.map((order) => (
                                                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                                                        <Link href={`/admin/orders/${order.id}`} className="hover:text-primary hover:underline">
                                                            {order.order_number}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 text-foreground font-medium truncate max-w-[140px]">
                                                        {order.customer_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                                                        {order.salesman_name}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-semibold text-right text-foreground">
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
                        <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span>Operational Queues</span>
                        </h3>

                        <div className="space-y-3">
                            {/* Queue 1: Payment Verification */}
                            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-foreground block">
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
                            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-foreground block">
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
                            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-foreground block">
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
                            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-foreground block">
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
