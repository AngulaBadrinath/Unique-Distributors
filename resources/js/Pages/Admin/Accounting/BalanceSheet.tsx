import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    Landmark,
    Filter,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    Scale
} from 'lucide-react';

interface BalanceItem {
    account_id: number;
    account_code: string;
    name: string;
    category: string;
    amount: string;
}

interface BalanceSheetReport {
    as_of_date: string;
    assets: {
        current_assets: BalanceItem[];
        total_current_assets: string;
        non_current_assets: BalanceItem[];
        total_non_current_assets: string;
        total_assets: string;
    };
    liabilities: {
        current_liabilities: BalanceItem[];
        total_current_liabilities: string;
        long_term_liabilities: BalanceItem[];
        total_long_term_liabilities: string;
        total_liabilities: string;
    };
    equity: {
        accounts: BalanceItem[];
        total_base_equity: string;
        current_period_earnings: string;
        total_equity: string;
    };
    total_liabilities_and_equity: string;
    is_balanced: boolean;
    difference: string;
}

interface Props {
    report: BalanceSheetReport;
    filters: {
        as_of_date?: string;
    };
}

export default function BalanceSheetPage({ report, filters }: Props) {
    const [asOfDate, setAsOfDate] = useState(filters.as_of_date || '');

    const handleFilterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/admin/accounting/balance-sheet', {
            as_of_date: asOfDate || undefined,
        }, { preserveState: true });
    };

    return (
        <AppLayout title="Balance Sheet">
            <Head title="Balance Sheet Statement" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Balance Sheet Statement</h1>
                            {report.is_balanced ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs py-0.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    Equation Satisfied: Assets = Liabilities + Equity
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs py-0.5">
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                    Imbalance: ${report.difference}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Financial position statement as of {report.as_of_date}.
                        </p>
                    </div>
                </div>

                {/* Filter Controls */}
                <form onSubmit={handleFilterSubmit} className="rounded-xl border bg-card p-4 shadow-xs">
                    <div className="flex items-center gap-3 text-xs max-w-sm">
                        <div className="flex-1">
                            <label className="block font-medium text-muted-foreground mb-1">As Of Date</label>
                            <Input
                                type="date"
                                value={asOfDate}
                                onChange={(e) => setAsOfDate(e.target.value)}
                                className="text-xs h-8"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" size="sm" className="text-xs h-8">
                                <Filter className="w-3.5 h-3.5 mr-1" />
                                Apply
                            </Button>
                        </div>
                    </div>
                </form>

                {/* Balance Sheet Statement */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
                    {/* Left Column: ASSETS */}
                    <div className="rounded-xl border bg-card shadow-xs p-6 space-y-6 text-xs">
                        <div className="border-b pb-2 flex items-center justify-between">
                            <h2 className="text-base font-bold uppercase tracking-wider text-emerald-600">
                                Assets
                            </h2>
                            <span className="font-mono text-base font-bold text-emerald-600">
                                ${report.assets.total_assets}
                            </span>
                        </div>

                        {/* Current Assets */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                Current Assets
                            </h3>
                            <div className="space-y-1.5 pl-2">
                                {report.assets.current_assets.map((item) => (
                                    <div key={item.account_id} className="flex justify-between py-1 border-b border-border/40">
                                        <span>{item.account_code} — {item.name}</span>
                                        <span className="font-mono font-medium">${item.amount}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-1 font-semibold text-xs border-t">
                                    <span>Total Current Assets:</span>
                                    <span className="font-mono">${report.assets.total_current_assets}</span>
                                </div>
                            </div>
                        </div>

                        {/* Non-Current Assets */}
                        {report.assets.non_current_assets.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                    Non-Current Assets
                                </h3>
                                <div className="space-y-1.5 pl-2">
                                    {report.assets.non_current_assets.map((item) => (
                                        <div key={item.account_id} className="flex justify-between py-1 border-b border-border/40">
                                            <span>{item.account_code} — {item.name}</span>
                                            <span className="font-mono font-medium">${item.amount}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between pt-1 font-semibold text-xs border-t">
                                        <span>Total Non-Current Assets:</span>
                                        <span className="font-mono">${report.assets.total_non_current_assets}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center text-sm font-bold text-emerald-700">
                            <span>TOTAL ASSETS:</span>
                            <span className="font-mono text-lg">${report.assets.total_assets}</span>
                        </div>
                    </div>

                    {/* Right Column: LIABILITIES & EQUITY */}
                    <div className="space-y-6">
                        {/* Liabilities Card */}
                        <div className="rounded-xl border bg-card shadow-xs p-6 space-y-4 text-xs">
                            <div className="border-b pb-2 flex items-center justify-between">
                                <h2 className="text-base font-bold uppercase tracking-wider text-blue-600">
                                    Liabilities
                                </h2>
                                <span className="font-mono text-base font-bold text-blue-600">
                                    ${report.liabilities.total_liabilities}
                                </span>
                            </div>

                            {/* Current Liabilities */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                    Current Liabilities
                                </h3>
                                <div className="space-y-1.5 pl-2">
                                    {report.liabilities.current_liabilities.map((item) => (
                                        <div key={item.account_id} className="flex justify-between py-1 border-b border-border/40">
                                            <span>{item.account_code} — {item.name}</span>
                                            <span className="font-mono font-medium">${item.amount}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between pt-1 font-semibold text-xs border-t">
                                        <span>Total Current Liabilities:</span>
                                        <span className="font-mono">${report.liabilities.total_current_liabilities}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Long-Term Liabilities */}
                            {report.liabilities.long_term_liabilities.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                        Long-Term Liabilities
                                    </h3>
                                    <div className="space-y-1.5 pl-2">
                                        {report.liabilities.long_term_liabilities.map((item) => (
                                            <div key={item.account_id} className="flex justify-between py-1 border-b border-border/40">
                                                <span>{item.account_code} — {item.name}</span>
                                                <span className="font-mono font-medium">${item.amount}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2 font-bold text-xs border-t">
                                <span>TOTAL LIABILITIES:</span>
                                <span className="font-mono text-sm text-blue-600">${report.liabilities.total_liabilities}</span>
                            </div>
                        </div>

                        {/* Equity Card */}
                        <div className="rounded-xl border bg-card shadow-xs p-6 space-y-4 text-xs">
                            <div className="border-b pb-2 flex items-center justify-between">
                                <h2 className="text-base font-bold uppercase tracking-wider text-indigo-600">
                                    Owner's Equity
                                </h2>
                                <span className="font-mono text-base font-bold text-indigo-600">
                                    ${report.equity.total_equity}
                                </span>
                            </div>

                            <div className="space-y-1.5 pl-2">
                                {report.equity.accounts.map((item) => (
                                    <div key={item.account_id} className="flex justify-between py-1 border-b border-border/40">
                                        <span>{item.account_code} — {item.name}</span>
                                        <span className="font-mono font-medium">${item.amount}</span>
                                    </div>
                                ))}

                                <div className="flex justify-between py-1 border-b border-border/40 font-medium">
                                    <span>Current Period Net Earnings:</span>
                                    <span className="font-mono text-emerald-600">${report.equity.current_period_earnings}</span>
                                </div>

                                <div className="flex justify-between pt-1 font-semibold text-xs border-t">
                                    <span>TOTAL EQUITY:</span>
                                    <span className="font-mono text-sm text-indigo-600">${report.equity.total_equity}</span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex justify-between items-center text-sm font-bold text-blue-700">
                                <span>TOTAL LIABILITIES & EQUITY:</span>
                                <span className="font-mono text-lg">${report.total_liabilities_and_equity}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
