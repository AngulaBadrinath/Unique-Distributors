import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    DollarSign,
    Calendar,
    ArrowLeft,
    Printer,
    FileText,
    Building,
    User,
    Mail,
    Phone,
    MapPin,
    CreditCard,
    ShieldCheck
} from 'lucide-react';
import { DATE_PRESETS, detectActivePreset, DatePresetKey } from '@/lib/datePresets';

interface StatementTransaction {
    id: number;
    transaction_number: string;
    transaction_date: string;
    posting_date: string;
    type: string;
    type_label: string;
    source_type: string;
    source_id: number;
    source_number: string;
    description: string;
    debit_amount: string;
    credit_amount: string;
    running_balance: string;
}

interface StatementData {
    customer: {
        id: number;
        name: string;
        code: string;
        contact_name: string;
        email: string;
        phone: string;
        billing_address_line1: string;
        billing_city: string;
        billing_state: string;
        billing_postal_code: string;
        billing_country: string;
    };
    company: {
        name: string;
        address: string;
        phone: string;
        email: string;
        tax_id: string;
    };
    statement_period: {
        start_date: string;
        end_date: string;
    };
    opening_balance: string;
    total_debits: string;
    total_credits: string;
    closing_balance: string;
    pending_payments?: string;
    operational_balance?: string;
    available_credit: string;
    transactions: StatementTransaction[];
}

interface Props {
    statement: StatementData;
    filters: {
        start_date?: string;
        end_date?: string;
    };
}

export default function ReceivablesStatement({ statement, filters }: Props) {
    const [startDate, setStartDate] = useState(filters.start_date || statement.statement_period.start_date);
    const [endDate, setEndDate] = useState(filters.end_date || statement.statement_period.end_date);

    const activePreset = detectActivePreset(startDate, endDate);

    const applyPreset = (presetKey: DatePresetKey) => {
        const preset = DATE_PRESETS.find((p) => p.key === presetKey);
        if (!preset) return;
        const range = preset.getRange();
        setStartDate(range.startDate);
        setEndDate(range.endDate);
        router.get(
            `/admin/receivables/${statement.customer.id}/statement`,
            { start_date: range.startDate, end_date: range.endDate },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            `/admin/receivables/${statement.customer.id}/statement`,
            { start_date: startDate, end_date: endDate },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val: string | number) => {
        const num = typeof val === 'number' ? val : parseFloat(val || '0');
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(num);
    };

    const { customer, company, statement_period, opening_balance, total_debits, total_credits, closing_balance, available_credit, transactions } = statement;

    return (
        <AppLayout>
            <Head title={`Customer Statement - ${customer.name}`} />

            <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
                {/* Screen-only Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-3">
                        <Link href={`/admin/receivables/${customer.id}`}>
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Customer Statement
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Detailed chronological receivable activity and account balance statement.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handlePrint} className="gap-2">
                            <Printer className="h-4 w-4" />
                            Print Statement
                        </Button>
                    </div>
                </div>

                {/* Filter & Quick Preset Controls (Screen-only) */}
                <div className="bg-card border rounded-lg p-4 shadow-sm space-y-3 print:hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Presets</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {DATE_PRESETS.map((preset) => {
                                const isSelected = activePreset === preset.key;
                                return (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => applyPreset(preset.key)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[36px] sm:min-h-[32px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                                            isSelected
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
                                        }`}
                                        aria-pressed={isSelected}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4 pt-2 border-t border-border/50">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase">Period Start</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="block bg-background border rounded-md px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none min-h-[38px]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase">Period End</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="block bg-background border rounded-md px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none min-h-[38px]"
                            />
                        </div>
                        <Button type="submit" variant="secondary" size="sm" className="h-9 min-h-[38px]">
                            Update Statement Period
                        </Button>
                    </form>
                </div>

                {/* Printable Statement Document Container */}
                <div className="bg-card border rounded-xl shadow-md p-8 space-y-8 print:border-none print:shadow-none print:p-0">
                    {/* Header: Company & Statement Title */}
                    <div className="flex flex-col sm:flex-row justify-between items-start border-b pb-6 gap-6">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">{company.name}</h2>
                            <p className="text-xs text-muted-foreground max-w-sm">{company.address}</p>
                            {company.phone && <p className="text-xs text-muted-foreground">Phone: {company.phone}</p>}
                            {company.email && <p className="text-xs text-muted-foreground">Email: {company.email}</p>}
                            {company.tax_id && <p className="text-xs text-muted-foreground font-mono">Tax ID: {company.tax_id}</p>}
                        </div>

                        <div className="sm:text-right space-y-1">
                            <h3 className="text-xl font-bold text-primary uppercase tracking-wider">STATEMENT OF ACCOUNT</h3>
                            <div className="text-xs space-y-0.5 text-muted-foreground">
                                <p>
                                    <span className="font-semibold text-foreground">Statement Period: </span>
                                    {statement_period.start_date} to {statement_period.end_date}
                                </p>
                                <p>
                                    <span className="font-semibold text-foreground">Generated Date: </span>
                                    {new Date().toISOString().split('T')[0]}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Customer Info Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statement For:</span>
                            <h4 className="text-base font-bold text-foreground">{customer.name}</h4>
                            <p className="text-xs font-mono text-muted-foreground">Account Code: {customer.code}</p>
                            {customer.contact_name && (
                                <p className="text-xs text-muted-foreground">Attn: {customer.contact_name}</p>
                            )}
                        </div>
                        <div className="sm:text-right space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing Address:</span>
                            <p className="text-xs text-foreground font-medium">{customer.billing_address_line1}</p>
                            <p className="text-xs text-muted-foreground">
                                {customer.billing_city}, {customer.billing_state} {customer.billing_postal_code}
                            </p>
                            <p className="text-xs text-muted-foreground">{customer.billing_country}</p>
                        </div>
                    </div>

                    {/* Statement Account Summary Box */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border rounded-lg p-4 bg-muted/10">
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase">Opening Balance</span>
                            <p className="text-base font-bold font-mono text-foreground">{formatCurrency(opening_balance)}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Period Debits (+)</span>
                            <p className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">+{formatCurrency(total_debits)}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Period Credits (-)</span>
                            <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">-{formatCurrency(total_credits)}</p>
                        </div>
                        <div className="space-y-1 bg-primary/5 p-2 rounded border border-primary/20">
                            <span className="text-xs font-semibold text-primary uppercase">Closing Receivable</span>
                            <p className="text-lg font-black font-mono text-primary">{formatCurrency(closing_balance)}</p>
                        </div>
                        <div className="space-y-1 bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded border border-indigo-200 dark:border-indigo-900 col-span-2 sm:col-span-1">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase">Available Credit</span>
                            <p className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(available_credit)}</p>
                        </div>
                    </div>

                    {/* Chronological Statement Activity Table */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Statement Activity
                        </h4>
                        <div className="border rounded-lg overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-2xs uppercase bg-muted/60 text-muted-foreground border-b font-semibold">
                                    <tr>
                                        <th scope="col" className="px-3 py-2.5">Date</th>
                                        <th scope="col" className="px-3 py-2.5">Txn #</th>
                                        <th scope="col" className="px-3 py-2.5">Type</th>
                                        <th scope="col" className="px-3 py-2.5">Reference</th>
                                        <th scope="col" className="px-3 py-2.5">Description</th>
                                        <th scope="col" className="px-3 py-2.5 text-right">Debit (+)</th>
                                        <th scope="col" className="px-3 py-2.5 text-right">Credit (-)</th>
                                        <th scope="col" className="px-3 py-2.5 text-right font-bold text-foreground">Running Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {/* Opening Balance Row */}
                                    <tr className="bg-muted/20 font-medium">
                                        <td className="px-3 py-2 font-mono">{statement_period.start_date}</td>
                                        <td className="px-3 py-2 font-mono text-muted-foreground">—</td>
                                        <td className="px-3 py-2 font-semibold">OPENING BALANCE</td>
                                        <td className="px-3 py-2 text-muted-foreground">—</td>
                                        <td className="px-3 py-2 text-muted-foreground">Balance brought forward</td>
                                        <td className="px-3 py-2 text-right font-mono">—</td>
                                        <td className="px-3 py-2 text-right font-mono">—</td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                                            {formatCurrency(opening_balance)}
                                        </td>
                                    </tr>

                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                                                No financial transactions recorded during this statement period.
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-muted/30">
                                                <td className="px-3 py-2 font-mono">{t.transaction_date}</td>
                                                <td className="px-3 py-2 font-mono font-semibold">{t.transaction_number}</td>
                                                <td className="px-3 py-2 font-medium">{t.type_label}</td>
                                                <td className="px-3 py-2 font-mono text-muted-foreground">{t.source_number || '—'}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{t.description}</td>
                                                <td className="px-3 py-2 text-right font-mono text-blue-600 dark:text-blue-400">
                                                    {parseFloat(t.debit_amount) > 0 ? `+${formatCurrency(t.debit_amount)}` : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                                    {parseFloat(t.credit_amount) > 0 ? `-${formatCurrency(t.credit_amount)}` : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                                                    {formatCurrency(t.running_balance)}
                                                </td>
                                            </tr>
                                        ))
                                    )}

                                    {/* Closing Balance Row */}
                                    <tr className="bg-muted/40 font-bold border-t-2">
                                        <td className="px-3 py-2.5 font-mono">{statement_period.end_date}</td>
                                        <td className="px-3 py-2.5 font-mono text-muted-foreground">—</td>
                                        <td className="px-3 py-2.5 uppercase text-primary font-extrabold">CLOSING BALANCE</td>
                                        <td className="px-3 py-2.5 text-muted-foreground">—</td>
                                        <td className="px-3 py-2.5 text-muted-foreground">Total outstanding receivable</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-blue-600 dark:text-blue-400">
                                            {formatCurrency(total_debits)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(total_credits)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-extrabold text-primary text-sm">
                                            {formatCurrency(closing_balance)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Statement Notes & Remittance Advice */}
                    <div className="border-t pt-4 text-2xs text-muted-foreground space-y-1">
                        <p className="font-semibold text-foreground">Remittance & Payment Terms:</p>
                        <p>
                            Please review this statement and notify our accounts receivable department immediately of any discrepancies.
                            Payments should be made according to your approved credit terms referencing your customer code ({customer.code}).
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
