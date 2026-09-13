import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    DollarSign,
    Search,
    Eye,
    FileText,
    Calendar,
    ArrowUpRight,
    Clock,
    AlertTriangle,
    ShieldCheck,
    CreditCard
} from 'lucide-react';

interface CustomerAgingRow {
    customer_id: number;
    customer_name: string;
    customer_code: string;
    reference_date: string;
    current: string;
    days_1_30: string;
    days_31_60: string;
    days_61_90: string;
    days_91_plus: string;
    total_receivable: string;
    pending_payments?: string;
    operational_outstanding?: string;
    available_credit: string;
}

interface AgingSummary {
    current: string;
    days_1_30: string;
    days_31_60: string;
    days_61_90: string;
    days_91_plus: string;
    total_receivable: string;
    total_pending_payments?: string;
    total_operational_outstanding?: string;
    total_available_credit: string;
}

interface AgingReport {
    reference_date: string;
    summary: AgingSummary;
    customers: CustomerAgingRow[];
}

interface Props {
    agingReport: AgingReport;
    filters: {
        search?: string;
        reference_date?: string;
    };
}

export default function ReceivablesIndex({ agingReport, filters }: Props) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [referenceDate, setReferenceDate] = useState(filters.reference_date || agingReport.reference_date);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            '/admin/receivables',
            { search: searchTerm, reference_date: referenceDate },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleDateChange = (newDate: string) => {
        setReferenceDate(newDate);
        router.get(
            '/admin/receivables',
            { search: searchTerm, reference_date: newDate },
            { preserveState: true, preserveScroll: true }
        );
    };

    const formatCurrency = (val: string | number) => {
        const num = typeof val === 'number' ? val : parseFloat(val || '0');
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(num);
    };

    const { summary, customers } = agingReport;

    return (
        <AppLayout>
            <Head title="Accounts Receivable & Aging" />

            <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <DollarSign className="h-8 w-8 text-primary" />
                            Accounts Receivable & Aging
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Authoritative customer receivable sub-ledger, aging exposure buckets, and statement projections.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-card border rounded-md px-3 py-1.5 shadow-sm text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground text-xs uppercase font-medium">As of:</span>
                            <input
                                type="date"
                                value={referenceDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Aggregate Aging Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1 col-span-2 sm:col-span-3 lg:col-span-1 border-primary/30">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total AR</span>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-xl font-bold text-foreground">
                            {formatCurrency(summary.total_receivable)}
                        </p>
                        <span className="text-xs text-muted-foreground">Total open balance</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Current</span>
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(summary.current)}
                        </p>
                        <span className="text-xs text-muted-foreground">0 days / not due</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">1–30 Days</span>
                            <Clock className="h-4 w-4 text-blue-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(summary.days_1_30)}
                        </p>
                        <span className="text-xs text-muted-foreground">Past due</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">31–60 Days</span>
                            <Clock className="h-4 w-4 text-amber-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(summary.days_31_60)}
                        </p>
                        <span className="text-xs text-muted-foreground">Past due</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">61–90 Days</span>
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(summary.days_61_90)}
                        </p>
                        <span className="text-xs text-muted-foreground">Past due</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">91+ Days</span>
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(summary.days_91_plus)}
                        </p>
                        <span className="text-xs text-muted-foreground">Critical overdue</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1 col-span-2 sm:col-span-3 lg:col-span-1 bg-muted/20">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Credit Balance</span>
                            <CreditCard className="h-4 w-4 text-indigo-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(summary.total_available_credit)}
                        </p>
                        <span className="text-xs text-muted-foreground">Available credits</span>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-card border rounded-lg p-4 shadow-sm">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by customer name or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button type="submit" variant="default" className="shrink-0">
                            Apply Filter
                        </Button>
                    </form>
                </div>

                {/* Customer Aging Table */}
                <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-foreground">Customer Accounts ({customers.length})</h2>
                        <span className="text-xs text-muted-foreground">
                            Aging calculated relative to reference date: <strong className="text-foreground">{referenceDate}</strong>
                        </span>
                    </div>

                    {customers.length === 0 ? (
                        <div className="p-12 text-center space-y-3">
                            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto stroke-1" />
                            <h3 className="text-lg font-medium text-foreground">No customer receivable records found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Try adjusting your search query or reference date filters.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b font-medium">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">Customer</th>
                                            <th scope="col" className="px-4 py-3 text-right">Current</th>
                                            <th scope="col" className="px-4 py-3 text-right">1–30 Days</th>
                                            <th scope="col" className="px-4 py-3 text-right">31–60 Days</th>
                                            <th scope="col" className="px-4 py-3 text-right">61–90 Days</th>
                                            <th scope="col" className="px-4 py-3 text-right">91+ Days</th>
                                            <th scope="col" className="px-4 py-3 text-right font-bold text-foreground">Total AR</th>
                                            <th scope="col" className="px-4 py-3 text-right text-indigo-600 dark:text-indigo-400">Available Credit</th>
                                            <th scope="col" className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {customers.map((row) => (
                                            <tr key={row.customer_id} className="hover:bg-muted/40 transition-colors">
                                                <td className="px-4 py-3 font-medium">
                                                    <div className="flex flex-col">
                                                        <span className="text-foreground font-semibold">{row.customer_name}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{row.customer_code}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                                    {parseFloat(row.current) > 0 ? (
                                                        <span className="text-foreground">{formatCurrency(row.current)}</span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                                    {parseFloat(row.days_1_30) > 0 ? (
                                                        <span className="text-blue-600 dark:text-blue-400 font-semibold">{formatCurrency(row.days_1_30)}</span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                                    {parseFloat(row.days_31_60) > 0 ? (
                                                        <span className="text-amber-600 dark:text-amber-400 font-semibold">{formatCurrency(row.days_31_60)}</span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                                    {parseFloat(row.days_61_90) > 0 ? (
                                                        <span className="text-orange-600 dark:text-orange-400 font-semibold">{formatCurrency(row.days_61_90)}</span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                                    {parseFloat(row.days_91_plus) > 0 ? (
                                                        <span className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(row.days_91_plus)}</span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                                                    {formatCurrency(row.total_receivable)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {parseFloat(row.available_credit) > 0 ? (
                                                        <Badge variant="outline" className="text-indigo-600 border-indigo-300 dark:text-indigo-400 font-mono">
                                                            {formatCurrency(row.available_credit)}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Link href={`/admin/receivables/${row.customer_id}`}>
                                                            <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1.5 text-xs">
                                                                <Eye className="h-3.5 w-3.5" />
                                                                Ledger
                                                            </Button>
                                                        </Link>
                                                        <Link href={`/admin/receivables/${row.customer_id}/statement`}>
                                                            <Button variant="secondary" size="sm" className="h-8 px-2.5 gap-1.5 text-xs">
                                                                <FileText className="h-3.5 w-3.5" />
                                                                Statement
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card List View */}
                            <div className="md:hidden divide-y divide-border">
                                {customers.map((row) => (
                                    <div key={row.customer_id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-foreground text-sm">{row.customer_name}</div>
                                                <span className="text-xs text-muted-foreground font-mono">{row.customer_code}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-mono text-muted-foreground block">Total AR</span>
                                                <span className="font-bold font-mono text-foreground text-base">
                                                    {formatCurrency(row.total_receivable)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Aging Exposure Grid */}
                                        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                                            <div className="p-2 rounded bg-muted/40 border border-border">
                                                <span className="text-[10px] text-muted-foreground block">Current</span>
                                                <span className="font-mono font-medium">{formatCurrency(row.current)}</span>
                                            </div>
                                            <div className="p-2 rounded bg-muted/40 border border-border">
                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 block">1–30d</span>
                                                <span className="font-mono font-medium">{formatCurrency(row.days_1_30)}</span>
                                            </div>
                                            <div className="p-2 rounded bg-muted/40 border border-border">
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 block">31–60d</span>
                                                <span className="font-mono font-medium">{formatCurrency(row.days_31_60)}</span>
                                            </div>
                                            <div className="p-2 rounded bg-muted/40 border border-border">
                                                <span className="text-[10px] text-orange-600 dark:text-orange-400 block">61–90d</span>
                                                <span className="font-mono font-medium">{formatCurrency(row.days_61_90)}</span>
                                            </div>
                                            <div className="p-2 rounded bg-muted/40 border border-border">
                                                <span className="text-[10px] text-rose-600 dark:text-rose-400 block">91+d</span>
                                                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(row.days_91_plus)}</span>
                                            </div>
                                            <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20">
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block">Credit</span>
                                                <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(row.available_credit)}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                            <Link href={`/admin/receivables/${row.customer_id}`} className="flex-1">
                                                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
                                                    <Eye className="h-3.5 w-3.5" />
                                                    Ledger
                                                </Button>
                                            </Link>
                                            <Link href={`/admin/receivables/${row.customer_id}/statement`} className="flex-1">
                                                <Button variant="secondary" size="sm" className="w-full h-8 text-xs gap-1.5">
                                                    <FileText className="h-3.5 w-3.5" />
                                                    Statement
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
