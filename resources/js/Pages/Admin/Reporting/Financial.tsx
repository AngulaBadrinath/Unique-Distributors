import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Input } from '@/Components/ui/input';
import {
    FileSpreadsheet,
    Calendar,
    Filter,
    Scale,
    TrendingUp,
    Landmark,
    CheckCircle2,
    AlertTriangle,
    DollarSign,
    ShieldCheck,
    ArrowUpRight
} from 'lucide-react';

interface FinancialSummary {
    profit_and_loss: {
        period_start: string;
        period_end: string;
        net_sales_revenue: string;
        cogs: string;
        gross_profit: string;
        operating_expenses: string;
        net_income: string;
    };
    balance_sheet: {
        as_of_date: string;
        total_assets: string;
        total_liabilities: string;
        total_equity: string;
        is_balanced: boolean;
        difference: string;
    };
    trial_balance: {
        as_of_date: string;
        total_debits: string;
        total_credits: string;
        is_balanced: boolean;
        difference: string;
    };
}

interface TrialBalanceData {
    as_of_date: string;
    start_date: string | null;
    is_balanced: boolean;
    difference: string;
    total_debits: string;
    total_credits: string;
    total_net_debits: string;
    total_net_credits: string;
    accounts: Array<{
        account_id: number;
        account_code: string;
        name: string;
        type: string;
        category: string;
        normal_balance: string;
        debit: string;
        credit: string;
        net_debit: string;
        net_credit: string;
    }>;
}

interface ProfitLossData {
    start_date: string;
    end_date: string;
    total_operating_revenue: string;
    total_contra_revenue: string;
    net_operating_revenue: string;
    total_cogs: string;
    gross_profit: string;
    total_operating_expenses: string;
    net_operating_income: string;
    operating_revenue_accounts: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
    cogs_accounts: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
    operating_expense_accounts: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
}

interface BalanceSheetData {
    as_of_date: string;
    total_assets: string;
    total_current_assets: string;
    total_non_current_assets: string;
    total_liabilities: string;
    total_current_liabilities: string;
    total_long_term_liabilities: string;
    total_equity: string;
    total_liabilities_and_equity: string;
    is_balanced: boolean;
    difference: string;
    current_assets: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
    non_current_assets: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
    current_liabilities: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
    long_term_liabilities: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
    equity_accounts: Array<{ account_id: number; account_code: string; name: string; amount: string }>;
    current_period_net_income: string;
}

interface Props {
    activeTab: 'summary' | 'profit_loss' | 'balance_sheet' | 'trial_balance';
    summary: FinancialSummary | null;
    trialBalance: TrialBalanceData | null;
    profitLoss: ProfitLossData | null;
    balanceSheet: BalanceSheetData | null;
    filters: {
        start_date?: string;
        end_date?: string;
        as_of_date?: string;
    };
}

export default function FinancialReport({
    activeTab,
    summary,
    trialBalance,
    profitLoss,
    balanceSheet,
    filters
}: Props) {
    const [startDate, setStartDate] = useState(filters.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || '');
    const [asOfDate, setAsOfDate] = useState(filters.as_of_date || '');

    const handleTabChange = (tab: string) => {
        router.get('/admin/reports/financial', {
            tab,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            as_of_date: asOfDate || undefined,
        }, { preserveState: true });
    };

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/admin/reports/financial', {
            tab: activeTab,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            as_of_date: asOfDate || undefined,
        }, { preserveState: true });
    };

    return (
        <AppLayout title="Financial Accounting Reports">
            <Head title="Financial Accounting Reports" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Financial Accounting Statements</h1>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs py-0.5">
                                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                Reconciled with General Ledger (ACC)
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Double-entry financial reporting directly consuming canonical General Ledger accounting services.
                        </p>
                    </div>

                    <Link href="/admin/accounting">
                        <Button variant="outline" size="sm" className="text-xs">
                            <Landmark className="h-3.5 w-3.5 mr-1.5" />
                            Accounting Workspace
                        </Button>
                    </Link>
                </div>

                {/* Filter Controls */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <form onSubmit={handleFilter} className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Start Date:
                            </span>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-8 w-36 text-xs"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                End / As Of:
                            </span>
                            <Input
                                type="date"
                                value={endDate || asOfDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setAsOfDate(e.target.value);
                                }}
                                className="h-8 w-36 text-xs"
                            />
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <Button type="submit" size="sm" className="h-8 text-xs">
                                <Filter className="h-3.5 w-3.5 mr-1" />
                                Update Statements
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
                    <button
                        onClick={() => handleTabChange('summary')}
                        className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                            activeTab === 'summary'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        Executive Financial Summary
                    </button>
                    <button
                        onClick={() => handleTabChange('profit_loss')}
                        className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                            activeTab === 'profit_loss'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        Profit & Loss (P&L)
                    </button>
                    <button
                        onClick={() => handleTabChange('balance_sheet')}
                        className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                            activeTab === 'balance_sheet'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        Balance Sheet
                    </button>
                    <button
                        onClick={() => handleTabChange('trial_balance')}
                        className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                            activeTab === 'trial_balance'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        Trial Balance
                    </button>
                </div>

                {/* Tab 1: Executive Summary */}
                {activeTab === 'summary' && summary && (
                    <div className="space-y-6">
                        {/* Financial Health Badges */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Income</span>
                                    <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600">
                                        <TrendingUp className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                                    ${summary.profit_and_loss.net_income}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Gross Profit: ${summary.profit_and_loss.gross_profit}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Assets</span>
                                    <div className="rounded-md bg-blue-500/10 p-2 text-blue-600">
                                        <Landmark className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                                    ${summary.balance_sheet.total_assets}
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-xs">
                                    {summary.balance_sheet.is_balanced ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Balance Sheet Balanced
                                        </span>
                                    ) : (
                                        <span className="text-rose-500 font-medium flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Diff: ${summary.balance_sheet.difference}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Trial Balance Status</span>
                                    <div className="rounded-md bg-purple-500/10 p-2 text-purple-600">
                                        <Scale className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                                    ${summary.trial_balance.total_debits}
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-xs">
                                    {summary.trial_balance.is_balanced ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Debits Equal Credits
                                        </span>
                                    ) : (
                                        <span className="text-rose-500 font-medium flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Diff: ${summary.trial_balance.difference}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Statement Breakdown Panels */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* P&L Panel */}
                            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
                                <div className="flex items-center justify-between border-b border-border pb-3">
                                    <h3 className="font-semibold text-sm">Income Statement Summary</h3>
                                    <span className="text-xs text-muted-foreground">{summary.profit_and_loss.period_start} to {summary.profit_and_loss.period_end}</span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Net Sales Revenue</span>
                                        <span className="font-mono font-medium">${summary.profit_and_loss.net_sales_revenue}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Cost of Goods Sold (COGS)</span>
                                        <span className="font-mono font-medium text-rose-500">-${summary.profit_and_loss.cogs}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-t border-border font-semibold">
                                        <span>Gross Profit</span>
                                        <span className="font-mono">${summary.profit_and_loss.gross_profit}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Operating Expenses</span>
                                        <span className="font-mono font-medium text-rose-500">-${summary.profit_and_loss.operating_expenses}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-t-2 border-border font-bold text-sm">
                                        <span className="text-emerald-600 dark:text-emerald-400">Net Operating Income</span>
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400">${summary.profit_and_loss.net_income}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Balance Sheet Panel */}
                            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
                                <div className="flex items-center justify-between border-b border-border pb-3">
                                    <h3 className="font-semibold text-sm">Balance Sheet Summary</h3>
                                    <span className="text-xs text-muted-foreground">As of {summary.balance_sheet.as_of_date}</span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Total Assets</span>
                                        <span className="font-mono font-medium">${summary.balance_sheet.total_assets}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Total Liabilities</span>
                                        <span className="font-mono font-medium">${summary.balance_sheet.total_liabilities}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Total Equity</span>
                                        <span className="font-mono font-medium">${summary.balance_sheet.total_equity}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-t border-border font-semibold">
                                        <span>Total Liabilities & Equity</span>
                                        <span className="font-mono font-bold">
                                            ${(parseFloat(summary.balance_sheet.total_liabilities) + parseFloat(summary.balance_sheet.total_equity)).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1 border-t border-dashed border-border text-[11px] text-muted-foreground">
                                        <span>Accounting Equation Balance</span>
                                        <span className={summary.balance_sheet.is_balanced ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                            {summary.balance_sheet.is_balanced ? 'Assets = Liabilities + Equity' : 'Unbalanced Discrepancy'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Profit & Loss Statement */}
                {activeTab === 'profit_loss' && profitLoss && (
                    <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
                        <div className="border-b border-border pb-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base">Statement of Profit & Loss</h3>
                                <p className="text-xs text-muted-foreground">Period: {profitLoss.start_date} to {profitLoss.end_date}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-muted-foreground uppercase">Net Income</div>
                                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                    ${profitLoss.net_operating_income}
                                </div>
                            </div>
                        </div>

                        {/* Revenue Section */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Operating Revenue</h4>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-border">
                                        {profitLoss.operating_revenue_accounts.map((acc) => (
                                            <tr key={acc.account_id}>
                                                <td className="p-2.5 font-mono text-muted-foreground w-24">{acc.account_code}</td>
                                                <td className="p-2.5 font-medium">{acc.name}</td>
                                                <td className="p-2.5 text-right font-mono font-medium">${acc.amount}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-muted/30 font-semibold">
                                            <td colSpan={2} className="p-2.5">Total Operating Revenue</td>
                                            <td className="p-2.5 text-right font-mono">${profitLoss.total_operating_revenue}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* COGS Section */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Cost of Goods Sold (COGS)</h4>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-border">
                                        {profitLoss.cogs_accounts.map((acc) => (
                                            <tr key={acc.account_id}>
                                                <td className="p-2.5 font-mono text-muted-foreground w-24">{acc.account_code}</td>
                                                <td className="p-2.5 font-medium">{acc.name}</td>
                                                <td className="p-2.5 text-right font-mono text-rose-500">-${acc.amount}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-muted/30 font-semibold">
                                            <td colSpan={2} className="p-2.5">Total Cost of Goods Sold</td>
                                            <td className="p-2.5 text-right font-mono text-rose-500">-${profitLoss.total_cogs}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Gross Profit Callout */}
                        <div className="rounded-lg bg-muted/40 p-3 flex justify-between items-center text-sm font-bold border border-border">
                            <span>Gross Profit</span>
                            <span className="font-mono text-foreground">${profitLoss.gross_profit}</span>
                        </div>

                        {/* Expenses Section */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Operating Expenses</h4>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-border">
                                        {profitLoss.operating_expense_accounts.map((acc) => (
                                            <tr key={acc.account_id}>
                                                <td className="p-2.5 font-mono text-muted-foreground w-24">{acc.account_code}</td>
                                                <td className="p-2.5 font-medium">{acc.name}</td>
                                                <td className="p-2.5 text-right font-mono text-rose-500">-${acc.amount}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-muted/30 font-semibold">
                                            <td colSpan={2} className="p-2.5">Total Operating Expenses</td>
                                            <td className="p-2.5 text-right font-mono text-rose-500">-${profitLoss.total_operating_expenses}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Net Income Callout */}
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex justify-between items-center text-base font-bold">
                            <span className="text-emerald-700 dark:text-emerald-300">Net Income</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-300">${profitLoss.net_operating_income}</span>
                        </div>
                    </div>
                )}

                {/* Tab 3: Balance Sheet Statement */}
                {activeTab === 'balance_sheet' && balanceSheet && (
                    <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
                        <div className="border-b border-border pb-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base">Statement of Financial Position (Balance Sheet)</h3>
                                <p className="text-xs text-muted-foreground">As of Date: {balanceSheet.as_of_date}</p>
                            </div>
                            <Badge variant="outline" className={balanceSheet.is_balanced ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}>
                                {balanceSheet.is_balanced ? 'Balanced (Assets = L + E)' : `Discrepancy: $${balanceSheet.difference}`}
                            </Badge>
                        </div>

                        {/* Assets */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Assets</h4>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-border">
                                        {balanceSheet.current_assets.map((acc) => (
                                            <tr key={acc.account_id}>
                                                <td className="p-2.5 font-mono text-muted-foreground w-24">{acc.account_code}</td>
                                                <td className="p-2.5 font-medium">{acc.name}</td>
                                                <td className="p-2.5 text-right font-mono font-medium">${acc.amount}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-muted/30 font-semibold">
                                            <td colSpan={2} className="p-2.5">Total Assets</td>
                                            <td className="p-2.5 text-right font-mono font-bold">${balanceSheet.total_assets}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Liabilities */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Liabilities</h4>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-border">
                                        {balanceSheet.current_liabilities.map((acc) => (
                                            <tr key={acc.account_id}>
                                                <td className="p-2.5 font-mono text-muted-foreground w-24">{acc.account_code}</td>
                                                <td className="p-2.5 font-medium">{acc.name}</td>
                                                <td className="p-2.5 text-right font-mono font-medium">${acc.amount}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-muted/30 font-semibold">
                                            <td colSpan={2} className="p-2.5">Total Liabilities</td>
                                            <td className="p-2.5 text-right font-mono font-bold">${balanceSheet.total_liabilities}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Equity */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Equity</h4>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-border">
                                        {balanceSheet.equity_accounts.map((acc) => (
                                            <tr key={acc.account_id}>
                                                <td className="p-2.5 font-mono text-muted-foreground w-24">{acc.account_code}</td>
                                                <td className="p-2.5 font-medium">{acc.name}</td>
                                                <td className="p-2.5 text-right font-mono font-medium">${acc.amount}</td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td className="p-2.5 font-mono text-muted-foreground w-24">—</td>
                                            <td className="p-2.5 font-medium">Current Period Net Income (Retained)</td>
                                            <td className="p-2.5 text-right font-mono font-medium">${balanceSheet.current_period_net_income}</td>
                                        </tr>
                                        <tr className="bg-muted/30 font-semibold">
                                            <td colSpan={2} className="p-2.5">Total Equity</td>
                                            <td className="p-2.5 text-right font-mono font-bold">${balanceSheet.total_equity}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 4: Trial Balance */}
                {activeTab === 'trial_balance' && trialBalance && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-sm">Working Trial Balance</h3>
                                <span className="text-xs text-muted-foreground">As of {trialBalance.as_of_date}</span>
                            </div>
                            <Badge variant="outline" className={trialBalance.is_balanced ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}>
                                {trialBalance.is_balanced ? 'Trial Balance Balanced' : `Difference: $${trialBalance.difference}`}
                            </Badge>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                                    <tr>
                                        <th className="p-3">Code</th>
                                        <th className="p-3">Account Name</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3 text-right">Debit Total</th>
                                        <th className="p-3 text-right">Credit Total</th>
                                        <th className="p-3 text-right">Net Debit</th>
                                        <th className="p-3 text-right">Net Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {trialBalance.accounts.map((acc) => (
                                        <tr key={acc.account_id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3 font-mono font-semibold text-foreground">{acc.account_code}</td>
                                            <td className="p-3 font-medium">{acc.name}</td>
                                            <td className="p-3 text-muted-foreground">{acc.type}</td>
                                            <td className="p-3 text-right font-mono">${acc.debit}</td>
                                            <td className="p-3 text-right font-mono">${acc.credit}</td>
                                            <td className="p-3 text-right font-mono font-medium">${acc.net_debit}</td>
                                            <td className="p-3 text-right font-mono font-medium">${acc.net_credit}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-muted/50 font-bold border-t-2 border-border text-sm">
                                        <td colSpan={3} className="p-3">Total Working Balances</td>
                                        <td className="p-3 text-right font-mono">${trialBalance.total_debits}</td>
                                        <td className="p-3 text-right font-mono">${trialBalance.total_credits}</td>
                                        <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">${trialBalance.total_net_debits}</td>
                                        <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">${trialBalance.total_net_credits}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
