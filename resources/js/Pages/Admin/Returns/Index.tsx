import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    RotateCcw,
    Search,
    Plus,
    Eye,
} from 'lucide-react';

interface ReturnRow {
    id: number;
    return_number: string;
    order_id: number;
    customer_id: number;
    status: 'REQUESTED' | 'UNDER_REVIEW' | 'INSPECTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    requested_at: string;
    inspected_at?: string;
    approved_at?: string;
    estimated_refund_total: string | number;
    notes?: string;
    order?: {
        id: number;
        order_number: string;
    };
    customer?: {
        id: number;
        name: string;
        code: string;
    };
    warehouse?: {
        id: number;
        name: string;
        code: string;
    };
    created_by_user?: {
        id: number;
        name: string;
    };
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedReturns {
    data: ReturnRow[];
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

interface WarehouseOption {
    id: number;
    name: string;
    code: string;
}

interface Props {
    returns: PaginatedReturns;
    customers?: CustomerOption[];
    warehouses?: WarehouseOption[];
    badgeCounts?: Record<string, number>;
    filters: {
        status?: string;
        customer_id?: string | number;
        warehouse_id?: string | number;
        search?: string;
        per_page?: number;
    };
    isSalesmanView?: boolean;
}

export default function Index({
    returns,
    customers = [],
    warehouses = [],
    badgeCounts = {},
    filters,
    isSalesmanView = false,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [customerId, setCustomerId] = useState(filters.customer_id || '');
    const [warehouseId, setWarehouseId] = useState(filters.warehouse_id || '');

    const applyFilters = (newFilters: Partial<typeof filters>) => {
        const query = {
            ...filters,
            ...newFilters,
            page: 1,
        };

        const basePath = isSalesmanView ? '/salesman/returns' : '/admin/returns';
        router.get(basePath, query, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters({ search });
    };

    const handleTabChange = (tabStatus: string) => {
        setStatus(tabStatus);
        applyFilters({ status: tabStatus });
    };

    const getStatusBadge = (statusVal: string) => {
        switch (statusVal) {
            case 'REQUESTED':
                return <Badge variant="warning">Requested</Badge>;
            case 'UNDER_REVIEW':
                return <Badge variant="info">Under Review</Badge>;
            case 'INSPECTED':
                return <Badge variant="brand">Inspected</Badge>;
            case 'APPROVED':
                return <Badge variant="success">Approved</Badge>;
            case 'REJECTED':
                return <Badge variant="destructive">Rejected</Badge>;
            case 'CANCELLED':
                return <Badge variant="secondary">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{statusVal}</Badge>;
        }
    };

    const tabs = [
        { id: '', label: 'All Returns', count: badgeCounts.all ?? 0 },
        { id: 'REQUESTED', label: 'Requested', count: badgeCounts.requested ?? 0 },
        { id: 'UNDER_REVIEW', label: 'Under Review', count: badgeCounts.under_review ?? 0 },
        { id: 'INSPECTED', label: 'Inspected', count: badgeCounts.inspected ?? 0 },
        { id: 'APPROVED', label: 'Approved', count: badgeCounts.approved ?? 0 },
        { id: 'REJECTED', label: 'Rejected', count: badgeCounts.rejected ?? 0 },
        { id: 'CANCELLED', label: 'Cancelled', count: badgeCounts.cancelled ?? 0 },
    ];

    return (
        <AppLayout title={isSalesmanView ? 'My Customer Returns' : 'Returns & Reverse Logistics'}>
            <Head title={isSalesmanView ? 'Customer Returns' : 'Returns Queue'} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                            <RotateCcw className="w-6 h-6 text-primary" />
                            {isSalesmanView ? 'Customer Returns' : 'Returns & Reverse Logistics'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {isSalesmanView
                                ? 'Initiate and monitor return requests for your assigned customer portfolio.'
                                : 'Manage customer merchandise returns, warehouse physical inspection, and stock disposition.'}
                        </p>
                    </div>
                    <div>
                        <Link href={isSalesmanView ? '/salesman/returns/create' : '/admin/returns/create'}>
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Initiate Return Request
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex overflow-x-auto border-b border-border gap-2 pb-px">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                                status === tab.id
                                    ? 'border-primary text-primary font-bold'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                status === tab.id
                                    ? 'bg-primary/10 text-primary font-bold'
                                    : 'bg-muted text-muted-foreground'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row gap-3">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by Return #, Order #, Customer..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                        <Button type="submit" variant="secondary" className="h-10">
                            Search
                        </Button>
                    </form>

                    <div className="flex flex-wrap items-center gap-3">
                        {customers.length > 0 && (
                            <select
                                value={customerId}
                                onChange={e => {
                                    setCustomerId(e.target.value);
                                    applyFilters({ customer_id: e.target.value });
                                }}
                                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">All Customers</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.code})
                                    </option>
                                ))}
                            </select>
                        )}

                        {!isSalesmanView && warehouses.length > 0 && (
                            <select
                                value={warehouseId}
                                onChange={e => {
                                    setWarehouseId(e.target.value);
                                    applyFilters({ warehouse_id: e.target.value });
                                }}
                                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">All Warehouses</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.name} ({w.code})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Returns Table (Desktop) */}
                <div className="hidden md:block bg-card rounded-xl border border-border shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-muted-foreground">
                            <thead className="bg-muted/40 text-foreground uppercase font-semibold text-xs border-b border-border">
                                <tr>
                                    <th className="px-5 py-3.5">Return #</th>
                                    <th className="px-5 py-3.5">Delivered Order</th>
                                    <th className="px-5 py-3.5">Customer</th>
                                    {!isSalesmanView && <th className="px-5 py-3.5">Warehouse</th>}
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Estimated Credit</th>
                                    <th className="px-5 py-3.5">Requested At</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {returns.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={isSalesmanView ? 7 : 8} className="px-5 py-12 text-center text-muted-foreground">
                                            <RotateCcw className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                                            <p className="font-semibold text-foreground">No return requests found.</p>
                                            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or initiate a new request.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    returns.data.map(row => (
                                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-5 py-4 font-bold text-foreground">
                                                <Link
                                                    href={isSalesmanView ? `/salesman/returns/${row.id}` : `/admin/returns/${row.id}`}
                                                    className="hover:text-primary hover:underline flex items-center gap-1.5"
                                                >
                                                    {row.return_number}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-medium text-foreground">{row.order?.order_number || `#${row.order_id}`}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="font-medium text-foreground">{row.customer?.name || 'Customer'}</p>
                                                <p className="text-xs text-muted-foreground">{row.customer?.code}</p>
                                            </td>
                                            {!isSalesmanView && (
                                                <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                                                    {row.warehouse?.name || 'Warehouse'}
                                                </td>
                                            )}
                                            <td className="px-5 py-4">
                                                {getStatusBadge(row.status)}
                                            </td>
                                            <td className="px-5 py-4 text-right font-bold text-foreground">
                                                ${parseFloat(String(row.estimated_refund_total || 0)).toFixed(2)}
                                            </td>
                                            <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(row.requested_at).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <Link
                                                    href={isSalesmanView ? `/salesman/returns/${row.id}` : `/admin/returns/${row.id}`}
                                                >
                                                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                                                        <Eye className="w-3.5 h-3.5" />
                                                        View
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

                {/* Returns Card View (Mobile / Tablet) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                    {returns.data.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-border text-center text-muted-foreground space-y-2">
                            <RotateCcw className="h-8 w-8 mx-auto text-muted-foreground/40" />
                            <p className="font-semibold text-foreground text-sm">No return requests found.</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your active filters.</p>
                        </div>
                    ) : (
                        returns.data.map(row => (
                            <div
                                key={row.id}
                                className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <Link
                                            href={isSalesmanView ? `/salesman/returns/${row.id}` : `/admin/returns/${row.id}`}
                                            className="font-mono font-bold text-sm text-primary hover:underline"
                                        >
                                            {row.return_number}
                                        </Link>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {row.customer?.name} ({row.customer?.code})
                                        </div>
                                    </div>
                                    <div>{getStatusBadge(row.status)}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                                    <div>
                                        <span className="text-muted-foreground block text-[11px]">Order:</span>
                                        <span className="font-medium text-foreground">{row.order?.order_number || `#${row.order_id}`}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-muted-foreground block text-[11px]">Estimated Credit:</span>
                                        <span className="font-mono font-bold text-foreground">
                                            ${parseFloat(String(row.estimated_refund_total || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                    {!isSalesmanView && row.warehouse && (
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Warehouse:</span>
                                            <span className="text-foreground">{row.warehouse.name}</span>
                                        </div>
                                    )}
                                    <div className={!isSalesmanView && row.warehouse ? 'text-right' : 'col-span-2'}>
                                        <span className="text-muted-foreground block text-[11px]">Requested:</span>
                                        <span className="text-muted-foreground">
                                            {new Date(row.requested_at).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-border/50 flex justify-end">
                                    <Link
                                        href={isSalesmanView ? `/salesman/returns/${row.id}` : `/admin/returns/${row.id}`}
                                        className="w-full sm:w-auto"
                                    >
                                        <Button variant="outline" size="sm" className="w-full sm:w-auto h-8 gap-1.5 text-xs">
                                            <Eye className="w-3.5 h-3.5" />
                                            View Details
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {returns.links && returns.links.length > 3 && (
                    <div className="bg-card rounded-xl border border-border px-5 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <p className="text-xs text-muted-foreground">
                            Showing <span className="font-semibold">{returns.from || 0}</span> to <span className="font-semibold">{returns.to || 0}</span> of <span className="font-semibold">{returns.total}</span> returns
                        </p>
                        <div className="flex gap-1 flex-wrap justify-center">
                            {returns.links.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.url || '#'}
                                    preserveScroll
                                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                                        link.active
                                            ? 'bg-primary text-primary-foreground font-bold border-primary'
                                            : link.url
                                            ? 'bg-background text-foreground hover:bg-muted border-border'
                                            : 'bg-muted text-muted-foreground border-border cursor-not-allowed'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
