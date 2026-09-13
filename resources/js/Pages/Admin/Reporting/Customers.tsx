import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Input } from '@/Components/ui/input';
import {
    Building2,
    Calendar,
    Filter,
    Search,
    DollarSign,
    Clock,
    FileText,
    ArrowUpRight,
    TrendingUp,
    CheckCircle2,
    AlertTriangle,
    Eye
} from 'lucide-react';

interface CustomerRow {
    customer_id: number;
    customer_name: string;
    customer_code: string;
    status: string;
    salesman_id: number | null;
    salesman_name: string | null;
    credit_limit: string;
    total_receivable: string;
    available_credit: string;
    aging_current: string;
    aging_1_30: string;
    aging_31_60: string;
    aging_61_90: string;
    aging_91_plus: string;
    total_orders: number;
    first_order_date: string | null;
    last_order_date: string | null;
    order_frequency_days: number | null;
    total_spend: string;
}

interface ReportData {
    data: CustomerRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    summary: {
        total_receivables: string;
        total_spend: string;
    };
    filters: {
        salesman_id?: string;
        status?: string;
        search?: string;
        balance_state?: string;
        as_of_date?: string;
    };
}

interface Props {
    report: ReportData;
    filters: {
        salesman_id?: string;
        status?: string;
        search?: string;
        balance_state?: string;
        as_of_date?: string;
    };
}

export default function CustomerReport({ report, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [balanceState, setBalanceState] = useState(filters.balance_state || 'all');
    const [status, setStatus] = useState(filters.status || '');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/admin/reports/customers', {
            ...filters,
            search: search || undefined,
            balance_state: balanceState !== 'all' ? balanceState : undefined,
            status: status || undefined,
        }, { preserveState: true });
    };

    const handleReset = () => {
        setSearch('');
        setBalanceState('all');
        setStatus('');
        router.get('/admin/reports/customers');
    };

    return (
        <AppLayout title="Customer Balances & Aging Reports">
            <Head title="Customer Reports" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Customer Balances, Aging & Cadence</h1>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Receivables aging analysis consuming AR ledger truth, purchase frequency cadence, and customer spend metrics.
                        </p>
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                            <Input
                                placeholder="Search customer by name, code, email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <select
                            value={balanceState}
                            onChange={(e) => setBalanceState(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-ring"
                        >
                            <option value="all">All Balance States</option>
                            <option value="with_balance">Outstanding Balance (&gt; $0)</option>
                            <option value="in_credit">Credit Balances (&lt; $0)</option>
                            <option value="zero_balance">Zero Balance</option>
                        </select>

                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-ring"
                        >
                            <option value="">All Statuses</option>
                            <option value="ACTIVE">Active Only</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspended</option>
                        </select>

                        <div className="flex items-center gap-2">
                            <Button type="submit" size="sm" className="h-8 text-xs">
                                <Search className="h-3.5 w-3.5 mr-1" />
                                Search
                            </Button>
                            {(search || balanceState !== 'all' || status) && (
                                <Button type="button" variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs">
                                    Reset
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Summary KPIs */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Open Receivables</span>
                            <div className="rounded-md bg-amber-500/10 p-2 text-amber-600">
                                <DollarSign className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                            ${report.summary.total_receivables}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Historical Spend</span>
                            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                            ${report.summary.total_spend}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Customers in Scope</span>
                            <div className="rounded-md bg-blue-500/10 p-2 text-blue-600">
                                <Building2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                            {report.total}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Customer Receivable & Purchase Matrix</h3>
                        <span className="text-xs text-muted-foreground">Page {report.current_page} of {report.last_page}</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                                <tr>
                                    <th className="p-3">Customer</th>
                                    <th className="p-3">Salesman</th>
                                    <th className="p-3 text-right">Total O/S</th>
                                    <th className="p-3 text-right">Current</th>
                                    <th className="p-3 text-right">1-30 Days</th>
                                    <th className="p-3 text-right">31-60 Days</th>
                                    <th className="p-3 text-right">61-90 Days</th>
                                    <th className="p-3 text-right">91+ Days</th>
                                    <th className="p-3 text-right">Orders</th>
                                    <th className="p-3 text-right">Avg Cadence</th>
                                    <th className="p-3 text-right">Total Spend</th>
                                    <th className="p-3 text-center">Statements</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {report.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="p-8 text-center text-muted-foreground">
                                            No customers matching search criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    report.data.map((c) => {
                                        const hasOverdue = (parseFloat(c.aging_91_plus || '0') > 0) || (parseFloat(c.aging_61_90 || '0') > 0);
                                        return (
                                            <tr key={c.customer_id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3">
                                                    <div className="font-medium text-foreground">{c.customer_name}</div>
                                                    <div className="text-[11px] font-mono text-muted-foreground">{c.customer_code}</div>
                                                </td>
                                                <td className="p-3 text-muted-foreground">{c.salesman_name || 'Unassigned'}</td>
                                                <td className="p-3 text-right font-mono font-bold text-foreground">
                                                    ${c.total_receivable}
                                                </td>
                                                <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">${c.aging_current}</td>
                                                <td className="p-3 text-right font-mono">${c.aging_1_30}</td>
                                                <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400">${c.aging_31_60}</td>
                                                <td className="p-3 text-right font-mono text-rose-500">${c.aging_61_90}</td>
                                                <td className={`p-3 text-right font-mono font-bold ${parseFloat(c.aging_91_plus || '0') > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                                                    ${c.aging_91_plus}
                                                </td>
                                                <td className="p-3 text-right">{c.total_orders}</td>
                                                <td className="p-3 text-right text-muted-foreground">
                                                    {c.order_frequency_days ? `${c.order_frequency_days}d` : '—'}
                                                </td>
                                                <td className="p-3 text-right font-mono font-medium">${c.total_spend}</td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Link href={`/admin/receivables/${c.customer_id}/statement`}>
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                                                                <FileText className="h-3.5 w-3.5 mr-1" />
                                                                Statement
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
