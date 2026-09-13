import React, { useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { PaymentEvidencePreviewModal } from '@/Components/Payment/PaymentEvidencePreviewModal';
import { PaymentEvidenceUploader } from '@/Components/Payment/PaymentEvidenceUploader';
import {
    Search,
    RotateCcw,
    CheckCircle2,
    Clock,
    XCircle,
    FileImage,
    Plus,
    Filter,
    ArrowUpDown,
    ShieldAlert,
    AlertTriangle,
    CreditCard,
    DollarSign,
    Landmark,
    Send,
    Loader2,
    X,
    Building2,
} from 'lucide-react';

interface CustomerOption {
    id: number;
    name: string;
    code: string;
}

interface PaymentItem {
    id: number;
    payment_number: string;
    customer_id: number;
    order_id?: number | null;
    payment_method: 'CASH' | 'CHEQUE' | 'MONEY_ORDER';
    status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'REVERSED';
    amount: string | number;
    payment_date: string;
    cheque_number?: string | null;
    bank_name?: string | null;
    cheque_date?: string | null;
    money_order_number?: string | null;
    issuer_name?: string | null;
    receipt_reference?: string | null;
    evidence_object_key?: string | null;
    evidence_original_name?: string | null;
    evidence_mime_type?: string | null;
    evidence_size_bytes?: number | null;
    notes?: string | null;
    rejection_reason_code?: string | null;
    rejection_notes?: string | null;
    reversal_reason_code?: string | null;
    reversal_notes?: string | null;
    customer?: {
        id: number;
        name: string;
        code: string;
        contact_name?: string;
    };
    order?: {
        id: number;
        order_number: string;
        grand_total: string | number;
        payment_status: string;
    } | null;
    recorded_by?: {
        id: number;
        name: string;
        role: string;
    };
    verified_by?: {
        id: number;
        name: string;
        role: string;
    };
    rejected_by?: {
        id: number;
        name: string;
        role: string;
    };
    reversed_by?: {
        id: number;
        name: string;
        role: string;
    };
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedPayments {
    data: PaymentItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface PaymentsIndexProps {
    payments: PaginatedPayments;
    counts: {
        all: number;
        pending_verification: number;
        verified: number;
        rejected: number;
        reversed: number;
    };
    filters: {
        tab?: string;
        status?: string;
        method?: string;
        search?: string;
        customer_id?: number | string;
        per_page?: number;
    };
    customers: CustomerOption[];
    userPermissions: string[];
}

export default function PaymentsIndex({
    payments,
    counts,
    filters,
    customers,
    userPermissions = [],
}: PaymentsIndexProps) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [previewPayment, setPreviewPayment] = useState<PaymentItem | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);

    // Form states
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'MONEY_ORDER'>('CASH');
    const [formData, setFormData] = useState({
        customer_id: '',
        order_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        receipt_reference: '',
        bank_name: '',
        cheque_number: '',
        cheque_date: new Date().toISOString().split('T')[0],
        issuer_name: '',
        money_order_number: '',
        notes: '',
    });
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Rejection & Reversal state
    const [rejectionReason, setRejectionReason] = useState('ILLEGIBLE_EVIDENCE');
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [reversalReason, setReversalReason] = useState('BOUNCED_CHEQUE');
    const [reversalNotes, setReversalNotes] = useState('');

    const canVerify = userPermissions.includes('payment.verify');
    const canReverse = userPermissions.includes('payment.reverse');
    const canCreate = userPermissions.includes('payment.create');

    const handleTabChange = (tabKey: string) => {
        router.get(
            '/admin/payments',
            {
                ...filters,
                tab: tabKey,
                page: 1,
            },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const handleFilterChange = (newFilters: Record<string, any>) => {
        router.get(
            '/admin/payments',
            {
                ...filters,
                ...newFilters,
                page: 1,
            },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange({ search: searchTerm });
    };

    const handleVerify = (payment: PaymentItem) => {
        if (!confirm(`Are you sure you want to verify and reconcile payment ${payment.payment_number} for $${Number(payment.amount).toFixed(2)}?`)) {
            return;
        }

        router.post(
            `/admin/payments/${payment.id}/verify`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    // Flash notification automatically handled
                },
            }
        );
    };

    const handleCreatePaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormErrors({});

        const endpoint =
            paymentMethod === 'CASH'
                ? '/admin/payments/cash'
                : paymentMethod === 'CHEQUE'
                ? '/admin/payments/cheque'
                : '/admin/payments/money-order';

        const submitPayload = new FormData();
        Object.entries(formData).forEach(([key, val]) => {
            if (val) submitPayload.append(key, val);
        });
        if (evidenceFile) {
            submitPayload.append('evidence', evidenceFile);
        }

        router.post(endpoint, submitPayload as any, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setIsCreateModalOpen(false);
                setFormData({
                    customer_id: '',
                    order_id: '',
                    amount: '',
                    payment_date: new Date().toISOString().split('T')[0],
                    receipt_reference: '',
                    bank_name: '',
                    cheque_number: '',
                    cheque_date: new Date().toISOString().split('T')[0],
                    issuer_name: '',
                    money_order_number: '',
                    notes: '',
                });
                setEvidenceFile(null);
                setIsSubmitting(false);
            },
            onError: (errors) => {
                setFormErrors(errors);
                setIsSubmitting(false);
            },
        });
    };

    const handleRejectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayment) return;
        setIsSubmitting(true);

        router.post(
            `/admin/payments/${selectedPayment.id}/reject`,
            {
                rejection_reason_code: rejectionReason,
                rejection_notes: rejectionNotes,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsRejectModalOpen(false);
                    setSelectedPayment(null);
                    setRejectionNotes('');
                    setIsSubmitting(false);
                },
                onError: (errors) => {
                    setFormErrors(errors);
                    setIsSubmitting(false);
                },
            }
        );
    };

    const handleReverseSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayment) return;
        setIsSubmitting(true);

        router.post(
            `/admin/payments/${selectedPayment.id}/reverse`,
            {
                reversal_reason_code: reversalReason,
                reversal_notes: reversalNotes,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsReverseModalOpen(false);
                    setSelectedPayment(null);
                    setReversalNotes('');
                    setIsSubmitting(false);
                },
                onError: (errors) => {
                    setFormErrors(errors);
                    setIsSubmitting(false);
                },
            }
        );
    };

    const activeTab = filters.tab || 'all';

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING_VERIFICATION':
                return (
                    <Badge variant="warning" className="gap-1 font-medium">
                        <Clock className="h-3 w-3" /> Pending Verification
                    </Badge>
                );
            case 'VERIFIED':
                return (
                    <Badge variant="success" className="gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Verified & Settled
                    </Badge>
                );
            case 'REJECTED':
                return (
                    <Badge variant="destructive" className="gap-1 font-medium">
                        <XCircle className="h-3 w-3" /> Rejected
                    </Badge>
                );
            case 'REVERSED':
                return (
                    <Badge variant="secondary" className="gap-1 font-medium">
                        <RotateCcw className="h-3 w-3" /> Reversed / Bounced
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getMethodBadge = (method: string) => {
        switch (method) {
            case 'CASH':
                return (
                    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                        <DollarSign className="h-3 w-3" /> Cash
                    </Badge>
                );
            case 'CHEQUE':
                return (
                    <Badge variant="outline" className="gap-1 border-indigo-500/30 text-indigo-700 dark:text-indigo-400 bg-indigo-500/10">
                        <Landmark className="h-3 w-3" /> Cheque
                    </Badge>
                );
            case 'MONEY_ORDER':
                return (
                    <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                        <Send className="h-3 w-3" /> Money Order
                    </Badge>
                );
            default:
                return <Badge variant="outline">{method}</Badge>;
        }
    };

    const tabs = [
        { id: 'all', label: 'All Payments', count: counts.all, icon: CreditCard, badgeVariant: 'secondary' as const },
        { id: 'pending_verification', label: 'Pending Verification', count: counts.pending_verification, icon: Clock, badgeVariant: 'warning' as const },
        { id: 'verified', label: 'Verified & Settled', count: counts.verified, icon: CheckCircle2, badgeVariant: 'success' as const },
        { id: 'rejected', label: 'Rejected', count: counts.rejected, icon: XCircle, badgeVariant: 'destructive' as const },
        { id: 'reversed', label: 'Reversed / Bounced', count: counts.reversed, icon: RotateCcw, badgeVariant: 'secondary' as const },
    ];

    const hasActiveFilters = Boolean(filters.search || (filters.method && filters.method !== 'ALL') || filters.customer_id);

    return (
        <AppLayout title="Payments & Collections Workspace">
            <Head title="Payments & Collections — Operational Workspace" />

            <div className="max-w-7xl mx-auto space-y-4 pb-16">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <CreditCard className="h-7 w-7 text-primary" />
                            Payments & Collections Workspace
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Operational payment registry, multi-instrument verification, and secure evidence auditing.
                        </p>
                    </div>

                    {canCreate && (
                        <Button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="gap-2 shrink-0"
                        >
                            <Plus className="h-4 w-4" /> Record New Payment
                        </Button>
                    )}
                </div>

                {/* Workspace Navigation Tabs & Filter Container */}
                <div className="rounded-lg shadow-xs overflow-hidden border border-border">
                    {/* Tabs Header */}
                    <div className="w-full border-b border-border bg-card/50 backdrop-blur-xs">
                        <nav
                            className="flex space-x-1 overflow-x-auto p-1.5 scrollbar-thin"
                            role="tablist"
                            aria-label="Payment Verification Queues"
                        >
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                const isUrgent = tab.id === 'pending_verification' && tab.count > 0;

                                return (
                                    <button
                                        key={tab.id}
                                        role="tab"
                                        type="button"
                                        aria-selected={isActive}
                                        onClick={() => handleTabChange(tab.id)}
                                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-all duration-150 shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                                            isActive
                                                ? 'bg-background text-foreground shadow-xs border border-border font-semibold'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                        }`}
                                    >
                                        <Icon
                                            className={`h-4 w-4 ${
                                                isActive
                                                    ? 'text-primary'
                                                    : isUrgent
                                                    ? 'text-amber-500 animate-pulse'
                                                    : 'text-muted-foreground'
                                            }`}
                                        />
                                        <span>{tab.label}</span>
                                        <Badge
                                            variant={isActive ? 'default' : isUrgent ? 'warning' : 'secondary'}
                                            className={`h-5 min-w-5 px-1.5 text-[10px] font-mono justify-center rounded-full ${
                                                isActive ? 'bg-primary text-primary-foreground' : ''
                                            }`}
                                        >
                                            {tab.count.toLocaleString()}
                                        </Badge>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="bg-card p-3 sm:p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                            {/* Search Input */}
                            <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    type="text"
                                    placeholder="Search payment #, customer, cheque/MO #, receipt ref..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-8 h-9 text-xs"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            handleFilterChange({ search: '' });
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-xs"
                                        aria-label="Clear search input"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </form>

                            {/* Dropdowns & Reset */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <select
                                    value={filters.method || 'ALL'}
                                    onChange={(e) => handleFilterChange({ method: e.target.value })}
                                    className="h-9 px-2.5 text-xs bg-background border border-input rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer w-full sm:w-auto"
                                    aria-label="Filter by payment method"
                                >
                                    <option value="ALL">All Payment Methods</option>
                                    <option value="CASH">Cash</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="MONEY_ORDER">Money Order</option>
                                </select>

                                <select
                                    value={filters.customer_id || ''}
                                    onChange={(e) => handleFilterChange({ customer_id: e.target.value })}
                                    className="h-9 px-2.5 text-xs bg-background border border-input rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary max-w-full sm:max-w-[220px] truncate cursor-pointer w-full sm:w-auto"
                                    aria-label="Filter by customer account"
                                >
                                    <option value="">All Customers</option>
                                    {customers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.code})
                                        </option>
                                    ))}
                                </select>

                                {hasActiveFilters && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSearchTerm('');
                                            router.get('/admin/payments', { tab: activeTab });
                                        }}
                                        className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                                        title="Reset all filters"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        <span>Reset</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table View (Desktop) */}
                <div className="hidden lg:block bg-card rounded-xl border border-border shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 border-b border-border text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Payment Number</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Customer & Order</th>
                                <th className="px-4 py-3">Method & Instrument</th>
                                <th className="px-4 py-3">Evidence</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {payments.data.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <CreditCard className="h-10 w-10 text-muted-foreground/40" />
                                            <p className="font-semibold text-foreground text-sm">No payment transactions found</p>
                                            <p className="text-xs text-muted-foreground max-w-sm">
                                                {hasActiveFilters
                                                    ? 'No payments match your current filter parameters. Try clearing filters.'
                                                    : 'No payment entries exist for this queue yet.'}
                                            </p>
                                            {hasActiveFilters && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => router.get('/admin/payments', { tab: activeTab })}
                                                    className="mt-2 text-xs"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filters
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                payments.data.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-muted/40 transition-colors">
                                        <td className="px-4 py-3.5 font-mono font-semibold text-foreground">
                                            {payment.payment_number}
                                        </td>
                                        <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                                            {payment.payment_date}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-medium text-foreground truncate max-w-[200px]">
                                                {payment.customer?.name || 'Customer Account'}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground font-mono">
                                                {payment.customer?.code}
                                                {payment.order && (
                                                    <span className="ml-1 text-primary">
                                                        • {payment.order.order_number}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                {getMethodBadge(payment.payment_method)}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                                                {payment.payment_method === 'CHEQUE' && (
                                                    <span>#{payment.cheque_number} ({payment.bank_name})</span>
                                                )}
                                                {payment.payment_method === 'MONEY_ORDER' && (
                                                    <span>#{payment.money_order_number} ({payment.issuer_name})</span>
                                                )}
                                                {payment.payment_method === 'CASH' && payment.receipt_reference && (
                                                    <span>Ref: {payment.receipt_reference}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {payment.evidence_object_key ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPreviewPayment(payment)}
                                                    className="h-7 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                                                >
                                                    <FileImage className="h-3.5 w-3.5" /> View Scan
                                                </Button>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground/60 italic">No Scan</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground text-sm">
                                            ${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            {getStatusBadge(payment.status)}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {payment.status === 'PENDING_VERIFICATION' && canVerify && (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => handleVerify(payment)}
                                                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        >
                                                            Verify
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedPayment(payment);
                                                                setIsRejectModalOpen(true);
                                                            }}
                                                            className="h-7 text-xs"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}

                                                {payment.status === 'VERIFIED' && canReverse && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedPayment(payment);
                                                            setIsReverseModalOpen(true);
                                                        }}
                                                        className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                                    >
                                                        Reverse
                                                    </Button>
                                                )}
                                            </div>
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
                    {payments.data.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-border text-center text-muted-foreground space-y-2">
                            <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40" />
                            <p className="font-medium text-foreground text-sm">No payment records found.</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your active queue or filters.</p>
                        </div>
                    ) : (
                        payments.data.map((payment) => (
                            <div
                                key={payment.id}
                                className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="font-mono font-bold text-sm text-foreground">
                                            {payment.payment_number}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {payment.payment_date} • {payment.customer?.name}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-base text-foreground">
                                            ${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="mt-1">{getStatusBadge(payment.status)}</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                                    <div>{getMethodBadge(payment.payment_method)}</div>
                                    {payment.evidence_object_key && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPreviewPayment(payment)}
                                            className="h-8 gap-1 text-xs text-primary min-h-[44px]"
                                        >
                                            <FileImage className="h-3.5 w-3.5" /> View Scan
                                        </Button>
                                    )}
                                </div>

                                {payment.status === 'PENDING_VERIFICATION' && canVerify && (
                                    <div className="flex gap-2 pt-2 border-t border-border">
                                        <Button
                                            type="button"
                                            onClick={() => handleVerify(payment)}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
                                        >
                                            Verify & Settle
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={() => {
                                                setSelectedPayment(payment);
                                                setIsRejectModalOpen(true);
                                            }}
                                            className="flex-1 min-h-[44px]"
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                )}

                                {payment.status === 'VERIFIED' && canReverse && (
                                    <div className="pt-2 border-t border-border">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedPayment(payment);
                                                setIsReverseModalOpen(true);
                                            }}
                                            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 min-h-[44px]"
                                        >
                                            Reverse / Bounce
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {payments.last_page > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 gap-3">
                        <div className="text-xs text-muted-foreground">
                            Showing {payments.from || 0} to {payments.to || 0} of {payments.total} transactions
                        </div>
                        <div className="flex gap-1 flex-wrap">
                            {payments.links.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.url || '#'}
                                    preserveScroll
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium min-h-[36px] flex items-center justify-center transition-colors ${
                                        link.active
                                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                            : !link.url
                                            ? 'text-muted-foreground/40 pointer-events-none'
                                            : 'border border-input bg-background text-foreground hover:bg-accent'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Evidence Preview Modal */}
            <PaymentEvidencePreviewModal
                isOpen={!!previewPayment}
                onClose={() => setPreviewPayment(null)}
                payment={
                    previewPayment
                        ? {
                              id: previewPayment.id,
                              payment_number: previewPayment.payment_number,
                              payment_method: previewPayment.payment_method,
                              amount: previewPayment.amount,
                              cheque_number: previewPayment.cheque_number,
                              bank_name: previewPayment.bank_name,
                              money_order_number: previewPayment.money_order_number,
                              issuer_name: previewPayment.issuer_name,
                              payment_date: previewPayment.payment_date,
                              customer_name: previewPayment.customer?.name,
                              evidence_original_name: previewPayment.evidence_original_name,
                          }
                        : null
                }
            />

            {/* Record Payment Entry Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="relative w-full max-w-xl bg-card rounded-xl shadow-2xl border border-border max-h-[90vh] overflow-y-auto p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">
                                    Record Inbound Payment
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Capture collection details. Cheque and Money Order entries require mandatory JPEG evidence.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Payment Method Selector Tabs */}
                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-lg">
                            {(['CASH', 'CHEQUE', 'MONEY_ORDER'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                        setPaymentMethod(m);
                                        setFormErrors({});
                                    }}
                                    className={`py-2 text-xs font-semibold rounded-md transition-all ${
                                        paymentMethod === m
                                            ? 'bg-background text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {m === 'CASH' ? 'Cash' : m === 'CHEQUE' ? 'Cheque' : 'Money Order'}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleCreatePaymentSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground">
                                    Customer Account <span className="text-destructive">*</span>
                                </label>
                                <select
                                    value={formData.customer_id}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                    required
                                    className="w-full mt-1 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">Select customer...</option>
                                    {customers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.code})
                                        </option>
                                    ))}
                                </select>
                                {formErrors.customer_id && (
                                    <p className="text-xs text-destructive mt-1">{formErrors.customer_id}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-foreground">
                                        Amount ($) <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        className="mt-1 h-9 text-xs"
                                    />
                                    {formErrors.amount && (
                                        <p className="text-xs text-destructive mt-1">{formErrors.amount}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-foreground">
                                        Payment Date <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.payment_date}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                        required
                                        className="mt-1 h-9 text-xs"
                                    />
                                    {formErrors.payment_date && (
                                        <p className="text-xs text-destructive mt-1">{formErrors.payment_date}</p>
                                    )}
                                </div>
                            </div>

                            {/* Method-specific fields */}
                            {paymentMethod === 'CASH' && (
                                <div>
                                    <label className="block text-xs font-medium text-foreground">
                                        Receipt Reference
                                    </label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. RCPT-12345"
                                        value={formData.receipt_reference}
                                        onChange={(e) => setFormData({ ...formData, receipt_reference: e.target.value })}
                                        className="mt-1 h-9 text-xs"
                                    />
                                </div>
                            )}

                            {paymentMethod === 'CHEQUE' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-foreground">
                                                Bank Name <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder="e.g. Chase, Wells Fargo"
                                                value={formData.bank_name}
                                                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                                required
                                                className="mt-1 h-9 text-xs"
                                            />
                                            {formErrors.bank_name && (
                                                <p className="text-xs text-destructive mt-1">{formErrors.bank_name}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-foreground">
                                                Cheque Number <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder="e.g. 100234"
                                                value={formData.cheque_number}
                                                onChange={(e) => setFormData({ ...formData, cheque_number: e.target.value })}
                                                required
                                                className="mt-1 h-9 text-xs"
                                            />
                                            {formErrors.cheque_number && (
                                                <p className="text-xs text-destructive mt-1">{formErrors.cheque_number}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-foreground">
                                            Cheque Issue Date <span className="text-destructive">*</span>
                                        </label>
                                        <Input
                                            type="date"
                                            value={formData.cheque_date}
                                            onChange={(e) => setFormData({ ...formData, cheque_date: e.target.value })}
                                            required
                                            className="mt-1 h-9 text-xs"
                                        />
                                    </div>

                                    <PaymentEvidenceUploader
                                        value={evidenceFile}
                                        onChange={setEvidenceFile}
                                        required
                                        error={formErrors.evidence}
                                        label="Cheque Photo / Scan (JPEG Only)"
                                    />
                                </div>
                            )}

                            {paymentMethod === 'MONEY_ORDER' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-foreground">
                                                Issuer Name <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder="e.g. USPS, Western Union"
                                                value={formData.issuer_name}
                                                onChange={(e) => setFormData({ ...formData, issuer_name: e.target.value })}
                                                required
                                                className="mt-1 h-9 text-xs"
                                            />
                                            {formErrors.issuer_name && (
                                                <p className="text-xs text-destructive mt-1">{formErrors.issuer_name}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-foreground">
                                                Money Order Number <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder="e.g. MO-88776655"
                                                value={formData.money_order_number}
                                                onChange={(e) => setFormData({ ...formData, money_order_number: e.target.value })}
                                                required
                                                className="mt-1 h-9 text-xs"
                                            />
                                            {formErrors.money_order_number && (
                                                <p className="text-xs text-destructive mt-1">{formErrors.money_order_number}</p>
                                            )}
                                        </div>
                                    </div>

                                    <PaymentEvidenceUploader
                                        value={evidenceFile}
                                        onChange={setEvidenceFile}
                                        required
                                        error={formErrors.evidence}
                                        label="Money Order Receipt Scan (JPEG Only)"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-foreground">
                                    Internal Audit Notes
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Optional notes or remarks..."
                                    className="w-full mt-1 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    disabled={isSubmitting}
                                    className="text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="text-xs"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Submitting...
                                        </>
                                    ) : (
                                        'Save Payment Entry'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {isRejectModalOpen && selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="relative w-full max-w-md bg-card rounded-xl shadow-2xl border border-border p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-5 w-5" />
                                <h2 className="text-base font-bold">Reject Payment Entry</h2>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setIsRejectModalOpen(false);
                                    setSelectedPayment(null);
                                }}
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Reject payment <span className="font-mono font-semibold text-foreground">{selectedPayment.payment_number}</span> (${Number(selectedPayment.amount).toFixed(2)}).
                        </p>

                        <form onSubmit={handleRejectSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground">
                                    Rejection Reason Code <span className="text-destructive">*</span>
                                </label>
                                <select
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    required
                                    className="w-full mt-1 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                >
                                    <option value="ILLEGIBLE_EVIDENCE">Illegible / Blurry Evidence Photo</option>
                                    <option value="CHEQUE_DATE_INVALID">Invalid / Post-Dated / Stale Cheque Date</option>
                                    <option value="AMOUNT_MISMATCH">Amount Mismatch (Written vs Declared)</option>
                                    <option value="SIGNATURE_MISSING">Missing / Invalid Authorized Signature</option>
                                    <option value="INCOMPLETE_DETAILS">Incomplete Bank / Issuer Details</option>
                                    <option value="DUPLICATE_ENTRY">Duplicate Payment Submission</option>
                                    <option value="OTHER">Other Verification Failure</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground">
                                    Operational Rejection Notes <span className="text-destructive">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={rejectionNotes}
                                    onChange={(e) => setRejectionNotes(e.target.value)}
                                    placeholder="Explain why this payment is rejected..."
                                    required
                                    className="w-full mt-1 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsRejectModalOpen(false);
                                        setSelectedPayment(null);
                                    }}
                                    disabled={isSubmitting}
                                    className="text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={isSubmitting}
                                    className="text-xs"
                                >
                                    {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reversal Modal */}
            {isReverseModalOpen && selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="relative w-full max-w-md bg-card rounded-xl shadow-2xl border border-border p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2 text-destructive">
                                <ShieldAlert className="h-5 w-5" />
                                <h2 className="text-base font-bold">Reverse Verified Payment</h2>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setIsReverseModalOpen(false);
                                    setSelectedPayment(null);
                                }}
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Reverse <span className="font-mono font-semibold text-foreground">{selectedPayment.payment_number}</span> (${Number(selectedPayment.amount).toFixed(2)}). This is a terminal financial operation.
                        </p>

                        <form onSubmit={handleReverseSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground">
                                    Reversal Reason Code <span className="text-destructive">*</span>
                                </label>
                                <select
                                    value={reversalReason}
                                    onChange={(e) => setReversalReason(e.target.value)}
                                    required
                                    className="w-full mt-1 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                >
                                    <option value="BOUNCED_CHEQUE">Bounced Cheque / Returned Item</option>
                                    <option value="INSUFFICIENT_FUNDS">Non-Sufficient Funds (NSF)</option>
                                    <option value="STOP_PAYMENT">Customer Stop Payment Order</option>
                                    <option value="DATA_ENTRY_ERROR">Data Entry Error / Duplicate Recording</option>
                                    <option value="FRAUDULENT_PAYMENT">Fraudulent / Unauthorized Transaction</option>
                                    <option value="ADMIN_CORRECTION">Administrative Correction</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground">
                                    Reversal Notes & Bank Reference <span className="text-destructive">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={reversalNotes}
                                    onChange={(e) => setReversalNotes(e.target.value)}
                                    placeholder="Document bank memo, NSF notice, or correction details..."
                                    required
                                    className="w-full mt-1 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsReverseModalOpen(false);
                                        setSelectedPayment(null);
                                    }}
                                    disabled={isSubmitting}
                                    className="text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={isSubmitting}
                                    className="text-xs"
                                >
                                    {isSubmitting ? 'Reversing...' : 'Confirm Reversal'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
