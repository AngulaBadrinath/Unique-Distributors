import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Input } from '@/Components/ui/input';
import {
    Users,
    Calendar,
    Filter,
    DollarSign,
    TrendingUp,
    CheckCircle2,
    AlertCircle,
    Package,
    ShieldAlert,
    Info
} from 'lucide-react';

interface SalesmanRow {
    salesman_id: number;
    salesman_name: string;
    salesman_email: string;
    assigned_customers_count: number;
    active_customers_count: number;
    orders_submitted: number;
    orders_approved: number;
    orders_cancelled: number;
    orders_fulfilled: number;
    orders_partially_fulfilled: number;
    gross_sales: string;
    discount_total: string;
    tax_total: string;
    net_sales: string;
    average_order_value: string;
    price_overrides_count: number;
    commission_status: string;
}

interface ReportData {
    data: SalesmanRow[];
    summary: {
        total_salesmen: number;
        total_orders: number;
        total_gross_sales: string;
        total_net_sales: string;
    };
    filters: {
        date_from?: string;
        date_to?: string;
        salesman_id?: string;
    };
}

interface Props {
    report: ReportData;
    filters: {
        date_from?: string;
        date_to?: string;
        salesman_id?: string;
    };
}

export default function SalesmanReport({ report, filters }: Props) {
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/admin/reports/salesmen', {
            ...filters,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
        }, { preserveState: true });
    };

    const handleReset = () => {
        setDateFrom('');
        setDateTo('');
        router.get('/admin/reports/salesmen');
    };

    return (
        <AppLayout title="Salesman Performance & Commission Reports">
            <Head title="Salesman Performance Reports" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Sales Representative Performance</h1>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Sales representative volumes, order conversions, customer activity, price override monitoring, and historical attribution.
                        </p>
                    </div>
                </div>

                {/* Commission Policy Notice */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                        <div className="font-semibold text-blue-900 dark:text-blue-300">Commission Policy Notice</div>
                        <div className="text-blue-800/80 dark:text-blue-400/80">
                            Automatic commission calculations are not prescribed in V1 specifications. Operational performance, sales volumes, and override frequencies are reported authoritatively above for administrative evaluation.
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <form onSubmit={handleFilter} className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                From:
                            </span>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-8 w-36 text-xs"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                To:
                            </span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-8 w-36 text-xs"
                            />
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <Button type="submit" size="sm" className="h-8 text-xs">
                                <Filter className="h-3.5 w-3.5 mr-1" />
                                Apply Range
                            </Button>
                            {(dateFrom || dateTo) && (
                                <Button type="button" variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs">
                                    Clear
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Salesmen</span>
                        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{report.summary.total_salesmen}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Approved Orders</span>
                        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{report.summary.total_orders}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gross Sales Volume</span>
                        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">${report.summary.total_gross_sales}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Realized Revenue</span>
                        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">${report.summary.total_net_sales}</div>
                    </div>
                </div>

                {/* League Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Sales Representative Performance Matrix</h3>
                        <span className="text-xs text-muted-foreground">Historical attribution by order salesman snapshot</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                                <tr>
                                    <th className="p-3">Salesman</th>
                                    <th className="p-3 text-center">Assigned / Active Customers</th>
                                    <th className="p-3 text-right">Orders Submitted</th>
                                    <th className="p-3 text-right">Orders Approved</th>
                                    <th className="p-3 text-right">Fulfilled</th>
                                    <th className="p-3 text-right">Price Overrides</th>
                                    <th className="p-3 text-right">Gross Sales</th>
                                    <th className="p-3 text-right">Net Sales</th>
                                    <th className="p-3 text-right">Avg Order (AOV)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {report.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                            No sales representatives found in scope.
                                        </td>
                                    </tr>
                                ) : (
                                    report.data.map((s) => (
                                        <tr key={s.salesman_id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-medium text-foreground">{s.salesman_name}</div>
                                                <div className="text-[11px] text-muted-foreground">{s.salesman_email}</div>
                                            </td>
                                            <td className="p-3 text-center font-mono">
                                                <span className="font-semibold text-foreground">{s.assigned_customers_count}</span>
                                                <span className="text-muted-foreground"> / </span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{s.active_customers_count} active</span>
                                            </td>
                                            <td className="p-3 text-right">{s.orders_submitted}</td>
                                            <td className="p-3 text-right font-semibold text-foreground">{s.orders_approved}</td>
                                            <td className="p-3 text-right text-muted-foreground">{s.orders_fulfilled}</td>
                                            <td className="p-3 text-right">
                                                {s.price_overrides_count > 0 ? (
                                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                                                        {s.price_overrides_count} overrides
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">0</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-mono">${s.gross_sales}</td>
                                            <td className="p-3 text-right font-mono font-bold text-foreground">${s.net_sales}</td>
                                            <td className="p-3 text-right font-mono">${s.average_order_value}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
