import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    BookOpen,
    Scale,
    TrendingUp,
    Landmark,
    FileSpreadsheet,
    FileText,
    Receipt,
    RefreshCw,
    FolderTree,
    CheckCircle2,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    DollarSign
} from 'lucide-react';

interface JournalRow {
    id: number;
    journal_number: string;
    entry_type: string;
    source_type: string | null;
    source_number: string | null;
    source_event: string | null;
    status: 'DRAFT' | 'POSTED' | 'REVERSED';
    accounting_date: string;
    total_debit: string;
    total_credit: string;
    description: string;
    creator?: {
        id: number;
        name: string;
    };
}

interface Summary {
    total_assets: string;
    total_liabilities: string;
    total_equity: string;
    net_revenue: string;
    gross_profit: string;
    net_income: string;
    is_tb_balanced: boolean;
    is_bs_balanced: boolean;
    total_journals_count: number;
}

interface Props {
    summary: Summary;
    recent_journals: JournalRow[];
}

export default function AccountingIndex({ summary, recent_journals }: Props) {
    const handleSyncEvents = () => {
        if (confirm('Sync all unposted historical business events into the General Ledger?')) {
            router.post('/admin/accounting/sync-events');
        }
    };

    return (
        <AppLayout title="General Ledger Accounting">
            <Head title="General Ledger Accounting Hub" />

            <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">General Ledger & Financial Hub</h1>
                            {summary.is_tb_balanced && summary.is_bs_balanced ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs py-0.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    Ledger Balanced (GAAP)
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs py-0.5">
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                    Reconciliation Needed
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Double-entry financial accounting, Chart of Accounts, immutable journal ledger, and core financial statements.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncEvents}
                            className="text-xs"
                        >
                            <RefreshCw className="w-4 h-4 mr-1.5" />
                            Sync Operational Events
                        </Button>
                        <Link href="/admin/accounting/journals">
                            <Button size="sm" className="text-xs">
                                <FileText className="w-4 h-4 mr-1.5" />
                                Journal Entries
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Assets */}
                    <div className="rounded-xl border bg-card p-5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Assets</span>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                                <Landmark className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono tracking-tight">${summary.total_assets}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <span>Cash, Receivables & Inventory</span>
                        </div>
                    </div>

                    {/* Total Liabilities */}
                    <div className="rounded-xl border bg-card p-5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Liabilities</span>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono tracking-tight">${summary.total_liabilities}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                            <span>Payables & Tax Obligations</span>
                        </div>
                    </div>

                    {/* Total Equity */}
                    <div className="rounded-xl border bg-card p-5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Equity</span>
                            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                                <Scale className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono tracking-tight">${summary.total_equity}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                            <span>Capital + Retained Net Income</span>
                        </div>
                    </div>

                    {/* Net Income */}
                    <div className="rounded-xl border bg-card p-5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Operating Income</span>
                            <div className={`p-2 rounded-lg ${parseFloat(summary.net_income) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                <TrendingUp className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono tracking-tight">${summary.net_income}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            {parseFloat(summary.net_income) >= 0 ? (
                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                                <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />
                            )}
                            <span>Revenue: ${summary.net_revenue} | Gross Profit: ${summary.gross_profit}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link
                        href="/admin/accounting/accounts"
                        className="p-5 rounded-xl border bg-card hover:bg-muted/40 transition-colors shadow-xs group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <FolderTree className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Chart of Accounts</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Configure hierarchical GAAP accounts & codes</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/admin/accounting/general-ledger"
                        className="p-5 rounded-xl border bg-card hover:bg-muted/40 transition-colors shadow-xs group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <FileSpreadsheet className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">General Ledger</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Chronological account statement with running balances</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/admin/accounting/trial-balance"
                        className="p-5 rounded-xl border bg-card hover:bg-muted/40 transition-colors shadow-xs group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Scale className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Trial Balance</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Verify Debit = Credit balance equality across all accounts</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/admin/accounting/profit-loss"
                        className="p-5 rounded-xl border bg-card hover:bg-muted/40 transition-colors shadow-xs group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Profit & Loss</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Operating revenue, COGS, expenses & net income</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/admin/accounting/balance-sheet"
                        className="p-5 rounded-xl border bg-card hover:bg-muted/40 transition-colors shadow-xs group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Landmark className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Balance Sheet</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Assets = Liabilities + Equity financial statement</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/admin/accounting/reconciliation"
                        className="p-5 rounded-xl border bg-card hover:bg-muted/40 transition-colors shadow-xs group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Receipt className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Cash & Bank Reconciliation</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Reconcile GL Cash accounts against verified payments</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Recent Journals Table */}
                <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
                    <div className="p-5 border-b flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Recent Journal Entries</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Latest double-entry accounting transactions</p>
                        </div>
                        <Link href="/admin/accounting/journals">
                            <Button variant="outline" size="sm" className="text-xs">
                                View All ({summary.total_journals_count})
                            </Button>
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="py-3 px-4">Journal #</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-4">Source</th>
                                    <th className="py-3 px-4">Description</th>
                                    <th className="py-3 px-4 text-right">Debit</th>
                                    <th className="py-3 px-4 text-right">Credit</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recent_journals.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-muted-foreground">
                                            No journal entries posted yet.
                                        </td>
                                    </tr>
                                ) : (
                                    recent_journals.map((journal) => (
                                        <tr key={journal.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4 font-mono font-medium">
                                                {journal.journal_number}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {journal.accounting_date}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {journal.entry_type}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                {journal.source_number ? (
                                                    <span className="font-mono text-muted-foreground">
                                                        {journal.source_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground italic">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 max-w-xs truncate" title={journal.description}>
                                                {journal.description}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-medium text-emerald-600">
                                                ${journal.total_debit}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-medium text-blue-600">
                                                ${journal.total_credit}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        journal.status === 'POSTED'
                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                                                            : journal.status === 'REVERSED'
                                                            ? 'bg-red-500/10 text-red-600 border-red-500/20 text-[10px]'
                                                            : 'text-[10px]'
                                                    }
                                                >
                                                    {journal.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Link href={`/admin/accounting/journals/${journal.id}`}>
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                                                        View Lines
                                                    </Button>
                                                </Link>
                                            </td>
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
