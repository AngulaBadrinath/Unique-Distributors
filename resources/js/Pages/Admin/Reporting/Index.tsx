import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    BarChart3,
    TrendingUp,
    Building2,
    Users,
    Boxes,
    Truck,
    FileSpreadsheet,
    ArrowUpRight,
    DollarSign,
    CheckCircle2,
    Package,
    ShieldCheck
} from 'lucide-react';

interface SalesSummary {
    total_orders: number;
    gross_sales: string;
    tax_total: string;
    discount_total: string;
    net_sales: string;
    average_order_value: string;
    total_units_sold: number;
}

interface DeliverySummary {
    total_deliveries: number;
    delivered_count: number;
    failed_count: number;
    returned_count: number;
    in_transit_count: number;
    success_rate_percent: number;
    average_turnaround_hours: number;
}

interface Props {
    salesSummary: SalesSummary;
    deliverySummary: DeliverySummary;
    canViewCostPrice: boolean;
}

export default function ReportingIndex({ salesSummary, deliverySummary, canViewCostPrice }: Props) {
    return (
        <AppLayout title="Reporting & Analytics Hub">
            <Head title="Reporting & Analytics Hub" />

            <div className="space-y-8">
                {/* Header Section */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Reporting & Analytics Hub</h1>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs py-0.5">
                                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                Server Authoritative
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Derived read models and operational intelligence across Sales, Customers, Salesmen, Inventory, Logistics, and Financials.
                        </p>
                    </div>
                </div>

                {/* KPI Overview Strip */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Approved Net Sales</span>
                            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600">
                                <DollarSign className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold tracking-tight">${salesSummary.net_sales}</div>
                            <div className="mt-1 flex items-center text-xs text-muted-foreground">
                                <span>Across {salesSummary.total_orders} total orders</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Average Order Value</span>
                            <div className="rounded-md bg-blue-500/10 p-2 text-blue-600">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold tracking-tight">${salesSummary.average_order_value}</div>
                            <div className="mt-1 flex items-center text-xs text-muted-foreground">
                                <span>Units sold: {salesSummary.total_units_sold.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Delivery Success Rate</span>
                            <div className="rounded-md bg-purple-500/10 p-2 text-purple-600">
                                <Truck className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold tracking-tight">{deliverySummary.success_rate_percent}%</div>
                            <div className="mt-1 flex items-center text-xs text-muted-foreground">
                                <span>{deliverySummary.delivered_count} delivered / {deliverySummary.total_deliveries} total</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Turnaround Time</span>
                            <div className="rounded-md bg-amber-500/10 p-2 text-amber-600">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold tracking-tight">{deliverySummary.average_turnaround_hours}h</div>
                            <div className="mt-1 flex items-center text-xs text-muted-foreground">
                                <span>Assignment to customer delivery</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Report Catalog Cards */}
                <div>
                    <h2 className="text-lg font-semibold tracking-tight mb-4">Operations & Financial Reports</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Sales Reports */}
                        <div className="group rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                </div>
                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">Sales Reports</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Daily and periodic sales volume, order counts, gross/net realization, sales by customer, and sales by product catalog.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <Link href="/admin/reports/sales">
                                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                                        <span>View Sales Reports</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Customer Reports */}
                        <div className="group rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                </div>
                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">Customer Reports</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Accounts receivable aging summary (0-30, 31-60, 61-90, 91+), outstanding balances, order cadence, and purchase frequency.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <Link href="/admin/reports/customers">
                                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                                        <span>View Customer Reports</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Salesman Performance */}
                        <div className="group rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                                        <Users className="h-5 w-5" />
                                    </div>
                                </div>
                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">Salesman Performance</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Representative league tables, orders submitted vs approved, total sales volume, customer activity, and price override tracking.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <Link href="/admin/reports/salesmen">
                                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                                        <span>View Salesman Reports</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Inventory Reports */}
                        <div className="group rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                                        <Boxes className="h-5 w-5" />
                                    </div>
                                </div>
                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">Inventory Reports</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Warehouse valuation (on-hand, available, damaged), immutable inventory movement ledger audits, and low-stock reorder alerts.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <Link href="/admin/reports/inventory">
                                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                                        <span>View Inventory Reports</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Delivery Reports */}
                        <div className="group rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                                        <Truck className="h-5 w-5" />
                                    </div>
                                </div>
                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">Delivery Reports</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Logistics turnaround times (assignment, dispatch, delivery), driver success rates, and categorized failure root cause analysis.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <Link href="/admin/reports/delivery">
                                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                                        <span>View Delivery Reports</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Financial Reports */}
                        <div className="group rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                        <FileSpreadsheet className="h-5 w-5" />
                                    </div>
                                </div>
                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">Financial Reports</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Authoritative financial statements directly consuming General Ledger services: Trial Balance, Profit & Loss, and Balance Sheet.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <Link href="/admin/reports/financial">
                                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                                        <span>View Financial Reports</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
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
