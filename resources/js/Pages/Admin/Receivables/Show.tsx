import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    DollarSign,
    Calendar,
    ArrowLeft,
    FileText,
    CreditCard,
    ShieldCheck,
    Clock,
    AlertTriangle,
    Receipt,
    User,
    Mail,
    Phone
} from 'lucide-react';

interface InvoiceDetail {
    id: number;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    grand_total: string;
    amount_paid: string;
    amount_due: string;
    days_overdue: number;
    bucket: string;
    status: string;
}

interface AgingData {
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
    available_credit: string;
    operational_outstanding?: string;
    pending_payments?: string;
    invoices: InvoiceDetail[];
}

interface ReceivableTransactionRow {
    id: number;
    transaction_number: string;
    type: string;
    source_type: string;
    source_id: number;
    source_number: string;
    debit_amount: string;
    credit_amount: string;
    transaction_date: string;
    posting_date: string;
    currency: string;
    description: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedTransactions {
    data: ReceivableTransactionRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

interface CustomerInfo {
    id: number;
    name: string;
    code: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    salesman?: {
        id: number;
        name: string;
    };
}

interface Props {
    customer: CustomerInfo;
    aging: AgingData;
    receivable_balance: string;
    pending_payments?: string;
    operational_outstanding?: string;
    available_credit: string;
    transactions: PaginatedTransactions;
    filters: {
        reference_date?: string;
    };
}

export default function ReceivablesShow({
    customer,
    aging,
    receivable_balance,
    pending_payments = '0.00',
    operational_outstanding,
    available_credit,
    transactions,
    filters,
}: Props) {
    const [referenceDate, setReferenceDate] = useState(filters.reference_date || aging.reference_date);
    const effectiveOperationalOutstanding = operational_outstanding ?? aging.operational_outstanding ?? receivable_balance;
    const effectivePendingPayments = pending_payments ?? aging.pending_payments ?? '0.00';

    const handleDateChange = (newDate: string) => {
        setReferenceDate(newDate);
        router.get(
            `/admin/receivables/${customer.id}`,
            { reference_date: newDate },
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

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'INVOICE_CHARGE':
                return <Badge variant="default" className="bg-blue-600">Invoice Charge</Badge>;
            case 'PAYMENT':
                return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Payment</Badge>;
            case 'PAYMENT_REVERSAL':
                return <Badge variant="destructive">Payment Reversal</Badge>;
            case 'CREDIT_NOTE':
                return <Badge variant="outline" className="text-indigo-600 border-indigo-300">Credit Note</Badge>;
            case 'CREDIT_APPLICATION':
                return <Badge variant="outline" className="text-purple-600 border-purple-300">Credit Application</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
    };

    return (
        <AppLayout>
            <Head title={`AR Ledger - ${customer.name}`} />

            <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
                {/* Header Navigation */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/receivables">
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    {customer.name}
                                </h1>
                                <Badge variant="secondary" className="font-mono">
                                    {customer.code}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-4 mt-0.5">
                                {customer.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-3.5 w-3.5" /> {customer.email}
                                    </span>
                                )}
                                {customer.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3.5 w-3.5" /> {customer.phone}
                                    </span>
                                )}
                                {customer.salesman && (
                                    <span className="flex items-center gap-1">
                                        <User className="h-3.5 w-3.5" /> Rep: {customer.salesman.name}
                                    </span>
                                )}
                            </p>
                        </div>
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

                        <Link href={`/admin/receivables/${customer.id}/statement`}>
                            <Button variant="default" className="gap-2">
                                <FileText className="h-4 w-4" />
                                Customer Statement
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Balances & Aging Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1 border-primary/30">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Receivable</span>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            {formatCurrency(receivable_balance)}
                        </p>
                        <span className="text-xs text-muted-foreground">Verified customer debt</span>
                    </div>

                    {parseFloat(effectivePendingPayments) > 0 && (
                        <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1 border-amber-500/30 bg-amber-500/5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</span>
                                <Clock className="h-4 w-4 text-amber-500" />
                            </div>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {formatCurrency(effectivePendingPayments)}
                            </p>
                            <span className="text-xs text-muted-foreground">Awaiting verification</span>
                        </div>
                    )}

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operational Due</span>
                            <Receipt className="h-4 w-4 text-foreground" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            {formatCurrency(effectiveOperationalOutstanding)}
                        </p>
                        <span className="text-xs text-muted-foreground">After pending payments</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1 bg-muted/20">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Available Credit</span>
                            <CreditCard className="h-4 w-4 text-indigo-500" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            {formatCurrency(available_credit)}
                        </p>
                        <span className="text-xs text-muted-foreground">Refundable credits</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Current</span>
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(aging.current)}
                        </p>
                        <span className="text-xs text-muted-foreground">0 days / not due</span>
                    </div>

                    <div className="bg-card border rounded-lg p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Overdue</span>
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {formatCurrency(
                                (parseFloat(aging.days_1_30) + parseFloat(aging.days_31_60) + parseFloat(aging.days_61_90) + parseFloat(aging.days_91_plus)).toFixed(2)
                            )}
                        </p>
                        <span className="text-xs text-muted-foreground">Past due sum</span>
                    </div>
                </div>

                {/* Open Invoices Participating in Aging */}
                {aging.invoices.length > 0 && (
                    <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-primary" />
                                Open Invoices Participating in Aging ({aging.invoices.length})
                            </h2>
                            <span className="text-xs text-muted-foreground">
                                Only outstanding unpaid balances are aged
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b font-medium">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Invoice #</th>
                                        <th scope="col" className="px-4 py-3">Invoice Date</th>
                                        <th scope="col" className="px-4 py-3">Due Date</th>
                                        <th scope="col" className="px-4 py-3 text-right">Grand Total</th>
                                        <th scope="col" className="px-4 py-3 text-right">Paid</th>
                                        <th scope="col" className="px-4 py-3 text-right font-bold text-foreground">Amount Due</th>
                                        <th scope="col" className="px-4 py-3 text-center">Days Overdue</th>
                                        <th scope="col" className="px-4 py-3 text-center">Aging Bucket</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {aging.invoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                                            <td className="px-4 py-3 font-semibold text-primary">
                                                {inv.invoice_number}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{inv.invoice_date}</td>
                                            <td className="px-4 py-3 font-medium">{inv.due_date}</td>
                                            <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(inv.grand_total)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.amount_paid)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{formatCurrency(inv.amount_due)}</td>
                                            <td className="px-4 py-3 text-center font-mono">
                                                {inv.days_overdue > 0 ? (
                                                    <span className="text-rose-600 font-semibold">+{inv.days_overdue} d</span>
                                                ) : (
                                                    <span className="text-emerald-600">0 d</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        inv.bucket === 'current'
                                                            ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                                                            : inv.bucket === 'days_1_30'
                                                            ? 'border-blue-300 text-blue-700 dark:text-blue-400'
                                                            : 'border-rose-300 text-rose-700 dark:text-rose-400'
                                                    }
                                                >
                                                    {inv.bucket.replace('_', ' ').toUpperCase()}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Immutable Receivable Ledger Table */}
                <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">Receivable Transaction Ledger</h2>
                            <p className="text-xs text-muted-foreground">
                                Append-only immutable sub-ledger transactions recorded for this account.
                            </p>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                            Total Records: {transactions.total}
                        </span>
                    </div>

                    {transactions.data.length === 0 ? (
                        <div className="p-12 text-center space-y-3">
                            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto stroke-1" />
                            <h3 className="text-lg font-medium text-foreground">No accounts receivable transactions recorded</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Invoices, verified payments, and credit notes will appear here automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b font-medium">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Txn Number</th>
                                        <th scope="col" className="px-4 py-3">Txn Date</th>
                                        <th scope="col" className="px-4 py-3">Type</th>
                                        <th scope="col" className="px-4 py-3">Source Ref</th>
                                        <th scope="col" className="px-4 py-3">Description</th>
                                        <th scope="col" className="px-4 py-3 text-right">Debit (+)</th>
                                        <th scope="col" className="px-4 py-3 text-right">Credit (-)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {transactions.data.map((txn) => (
                                        <tr key={txn.id} className="hover:bg-muted/40 transition-colors">
                                            <td className="px-4 py-3 font-mono font-semibold text-foreground">
                                                {txn.transaction_number}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                                {txn.transaction_date}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getTypeBadge(txn.type)}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                {txn.source_number || `${txn.source_type} #${txn.source_id}`}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {txn.description}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold">
                                                {parseFloat(txn.debit_amount) > 0 ? (
                                                    <span className="text-blue-600 dark:text-blue-400">
                                                        +{formatCurrency(txn.debit_amount)}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold">
                                                {parseFloat(txn.credit_amount) > 0 ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">
                                                        -{formatCurrency(txn.credit_amount)}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {transactions.links && transactions.links.length > 3 && (
                        <div className="p-4 border-t flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                                Showing page {transactions.current_page} of {transactions.last_page}
                            </span>
                            <div className="flex gap-1">
                                {transactions.links.map((link, idx) => (
                                    <Link
                                        key={idx}
                                        href={link.url || '#'}
                                        preserveScroll
                                        className={`px-3 py-1 text-xs rounded border transition-colors ${
                                            link.active
                                                ? 'bg-primary text-primary-foreground font-semibold border-primary'
                                                : link.url
                                                ? 'hover:bg-muted text-foreground'
                                                : 'text-muted-foreground opacity-50 cursor-not-allowed'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
