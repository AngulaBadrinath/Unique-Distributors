import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    FileText,
    Search,
    RotateCcw,
    Printer,
    Download,
    Eye,
    Filter,
    Calendar,
    DollarSign,
    CheckCircle2,
    Clock,
    AlertCircle,
    Building2,
    ExternalLink,
    X,
} from 'lucide-react';

interface InvoiceRow {
    id: number;
    invoice_number: string;
    order_id: number;
    customer_id: number;
    status: 'ISSUED' | 'PAID' | 'VOID';
    payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERPAID' | 'REFUNDED';
    invoice_date: string;
    due_date: string;
    payment_terms: string;
    currency: string;
    subtotal: string | number;
    tax_total: string | number;
    grand_total: string | number;
    amount_paid: string | number;
    amount_due: string | number;
    customer_name_snapshot: string;
    customer_code_snapshot: string;
    order?: {
        id: number;
        order_number: string;
        status: string;
    };
    customer?: {
        id: number;
        name: string;
        code: string;
    };
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedInvoices {
    data: InvoiceRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface CustomerOption {
    id: number;
    name: string;
    code: string;
}

interface Props {
    invoices: PaginatedInvoices;
    customers?: CustomerOption[];
    filters: {
        status?: string;
        payment_status?: string;
        customer_id?: string | number;
        search?: string;
        per_page?: number;
    };
    statuses: string[];
    paymentStatuses: string[];
    isSalesmanView?: boolean;
}

export default function InvoiceIndex({
    invoices,
    customers = [],
    filters,
    statuses,
    paymentStatuses,
    isSalesmanView = false,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [paymentStatus, setPaymentStatus] = useState(filters.payment_status || '');
    const [customerId, setCustomerId] = useState(filters.customer_id || '');

    const handleFilter = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const basePath = isSalesmanView ? '/salesman/invoices' : '/admin/invoices';
        router.get(
            basePath,
            {
                search: search || undefined,
                status: status || undefined,
                payment_status: paymentStatus || undefined,
                customer_id: customerId || undefined,
            },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleReset = () => {
        setSearch('');
        setStatus('');
        setPaymentStatus('');
        setCustomerId('');
        const basePath = isSalesmanView ? '/salesman/invoices' : '/admin/invoices';
        router.get(basePath, {}, { preserveState: true });
    };

    const getStatusBadge = (invoiceStatus: string) => {
        switch (invoiceStatus) {
            case 'PAID':
                return <Badge variant="success" className="gap-1 font-medium"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>;
            case 'ISSUED':
                return <Badge variant="default" className="gap-1 font-medium"><FileText className="h-3 w-3" /> Issued</Badge>;
            case 'VOID':
                return <Badge variant="destructive" className="gap-1 font-medium"><AlertCircle className="h-3 w-3" /> Void</Badge>;
            default:
                return <Badge variant="secondary">{invoiceStatus}</Badge>;
        }
    };

    const getPaymentBadge = (paymentSt: string) => {
        switch (paymentSt) {
            case 'PAID':
                return (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-medium">
                        Settled
                    </Badge>
                );
            case 'PARTIALLY_PAID':
                return (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-medium">
                        Partial
                    </Badge>
                );
            case 'UNPAID':
                return (
                    <Badge variant="outline" className="border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10 font-medium">
                        Unpaid
                    </Badge>
                );
            default:
                return <Badge variant="outline">{paymentSt}</Badge>;
        }
    };

    const getItemUrl = (id: number) => isSalesmanView ? `/salesman/invoices/${id}` : `/admin/invoices/${id}`;
    const hasActiveFilters = Boolean(search || status || paymentStatus || customerId);

    return (
        <AppLayout title={isSalesmanView ? "Customer Invoices" : "Invoices & Billing Documents"}>
            <Head title={isSalesmanView ? "My Customer Invoices" : "Invoices & Billing — Operational Documents"} />

            <div className="max-w-7xl mx-auto space-y-4 pb-16">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <FileText className="h-7 w-7 text-primary" />
                            {isSalesmanView ? "Customer Invoices" : "Invoices & Billing Documents"}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Authoritative, immutable tax invoices, historical snapshots, and document compliance.
                        </p>
                    </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="bg-card p-3 sm:p-4 rounded-xl border border-border shadow-xs space-y-3">
                    <form onSubmit={handleFilter} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                                type="text"
                                placeholder="Search invoice #, customer..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-9 text-xs"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-xs"
                                    aria-label="Clear search input"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <div>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full h-9 px-2.5 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                                aria-label="Filter by document status"
                            >
                                <option value="">All Document Statuses</option>
                                {statuses.map((st) => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <select
                                value={paymentStatus}
                                onChange={(e) => setPaymentStatus(e.target.value)}
                                className="w-full h-9 px-2.5 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                                aria-label="Filter by payment status"
                            >
                                <option value="">All Payment Statuses</option>
                                {paymentStatuses.map((pst) => (
                                    <option key={pst} value={pst}>{pst}</option>
                                ))}
                            </select>
                        </div>

                        {!isSalesmanView && customers.length > 0 && (
                            <div>
                                <select
                                    value={customerId}
                                    onChange={(e) => setCustomerId(e.target.value)}
                                    className="w-full h-9 px-2.5 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary truncate cursor-pointer"
                                    aria-label="Filter by customer"
                                >
                                    <option value="">All Customers</option>
                                    {customers.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-9 text-xs">
                                <Filter className="w-3.5 h-3.5 mr-1.5" />
                                Filter
                            </Button>
                            {hasActiveFilters && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                    title="Reset all filters"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Invoices Table (Desktop) */}
                <div className="hidden lg:block bg-card rounded-xl border border-border shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 border-b border-border text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Invoice Number</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Order Ref</th>
                                <th className="px-4 py-3">Dates</th>
                                <th className="px-4 py-3 text-right">Grand Total</th>
                                <th className="px-4 py-3 text-right">Balance Due</th>
                                <th className="px-4 py-3 text-center">Document Status</th>
                                <th className="px-4 py-3 text-center">Payment Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {invoices.data.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="h-10 w-10 text-muted-foreground/40" />
                                            <p className="font-semibold text-foreground text-sm">No invoices found</p>
                                            <p className="text-xs text-muted-foreground max-w-sm">
                                                {hasActiveFilters
                                                    ? 'No invoices match your current search filters. Try clearing filters.'
                                                    : 'Invoices are generated upon order approval and fulfillment delivery.'}
                                            </p>
                                            {hasActiveFilters && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleReset}
                                                    className="mt-2 text-xs"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filters
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                invoices.data.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                                        <td className="px-4 py-3.5 font-semibold font-mono text-foreground">
                                            <Link
                                                href={getItemUrl(inv.id)}
                                                className="text-primary hover:underline flex items-center gap-1.5"
                                            >
                                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                                {inv.invoice_number}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-medium text-foreground truncate max-w-[200px]">
                                                {inv.customer_name_snapshot}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground font-mono">
                                                {inv.customer_code_snapshot}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                                            {inv.order ? (
                                                <Link
                                                    href={isSalesmanView ? `/salesman/orders/${inv.order.id}` : `/admin/orders/${inv.order.id}`}
                                                    className="hover:underline text-primary flex items-center gap-1"
                                                >
                                                    {inv.order.order_number}
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                                            <div>Issued: {new Date(inv.invoice_date).toLocaleDateString()}</div>
                                            <div className="text-[11px] text-muted-foreground/80">Due: {new Date(inv.due_date).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground text-sm">
                                            ${Number(inv.grand_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono font-bold text-sm">
                                            <span className={Number(inv.amount_due) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                                                ${Number(inv.amount_due).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                            {getStatusBadge(inv.status)}
                                        </td>
                                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                            {getPaymentBadge(inv.payment_status)}
                                        </td>
                                        <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                                            <Link
                                                href={getItemUrl(inv.id)}
                                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Link>
                                            <a
                                                href={`/invoices/${inv.id}/print`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                                                title="Print HTML Document"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </a>
                                            <a
                                                href={`/invoices/${inv.id}/pdf`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-primary hover:bg-primary/10"
                                                title="Download PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* Card View (Mobile / Tablet) */}
                <div className="grid grid-cols-1 gap-3 lg:hidden">
                    {invoices.data.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-border text-center text-muted-foreground space-y-2">
                            <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
                            <p className="font-semibold text-foreground text-sm">No invoices found.</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your active filters.</p>
                        </div>
                    ) : (
                        invoices.data.map((inv) => (
                            <div
                                key={inv.id}
                                className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <Link
                                            href={getItemUrl(inv.id)}
                                            className="font-mono font-bold text-sm text-primary hover:underline flex items-center gap-1.5"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            {inv.invoice_number}
                                        </Link>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {inv.customer_name_snapshot} ({inv.customer_code_snapshot})
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-base text-foreground">
                                            ${Number(inv.grand_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[11px] font-mono mt-0.5">
                                            <span className={Number(inv.amount_due) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                                                Due: ${Number(inv.amount_due).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                                    <div className="flex items-center gap-1.5">
                                        {getStatusBadge(inv.status)}
                                        {getPaymentBadge(inv.payment_status)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Link
                                            href={getItemUrl(inv.id)}
                                            className="inline-flex items-center justify-center h-8 px-2.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent text-foreground min-h-[44px]"
                                        >
                                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                                        </Link>
                                        <a
                                            href={`/invoices/${inv.id}/pdf`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center h-8 px-2.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px]"
                                        >
                                            <Download className="w-3.5 h-3.5 mr-1" /> PDF
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {invoices.last_page > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 gap-3">
                        <div className="text-xs text-muted-foreground">
                            Showing {invoices.from || 0} to {invoices.to || 0} of {invoices.total} invoices
                        </div>
                        <div className="flex gap-1 flex-wrap">
                            {invoices.links.map((link, i) => (
                                link.url ? (
                                    <Link
                                        key={i}
                                        href={link.url}
                                        className={`inline-flex items-center justify-center h-8 min-w-[32px] px-2.5 text-xs rounded-md border min-h-[36px] transition-colors ${
                                            link.active
                                                ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                                                : 'border-input bg-background hover:bg-accent text-foreground'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : (
                                    <span
                                        key={i}
                                        className="inline-flex items-center justify-center h-8 min-w-[32px] px-2.5 text-xs rounded-md border border-input opacity-40 cursor-not-allowed min-h-[36px] text-muted-foreground"
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                )
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
