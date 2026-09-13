import React, { useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import {
    OrderAdjustmentQueueItem,
    OrderAdjustmentQueueCounts,
    OrderAdjustmentQueueFilters,
} from '@/types/order';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import AdminAdjustmentQueueTabs from './Partials/AdminAdjustmentQueueTabs';
import {
    Search,
    RotateCcw,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    AlertTriangle,
    AlertOctagon,
    CheckCircle2,
    Clock,
    FileText,
    RefreshCw,
    XCircle,
    ChevronRight,
} from 'lucide-react';

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedAdjustments {
    data: OrderAdjustmentQueueItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface AdjustmentsIndexProps {
    adjustments: PaginatedAdjustments;
    counts: OrderAdjustmentQueueCounts;
    filters: OrderAdjustmentQueueFilters;
    reasonCodes: Array<{ value: string; label: string }>;
}

export default function AdjustmentsIndex({
    adjustments,
    counts,
    filters,
    reasonCodes,
}: AdjustmentsIndexProps) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');

    const handleQueueSelect = (queueKey: string) => {
        router.get(
            '/admin/adjustments',
            {
                ...filters,
                queue: queueKey,
                page: 1,
            },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const handleFilterChange = (newFilters: Partial<OrderAdjustmentQueueFilters>) => {
        router.get(
            '/admin/adjustments',
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

    const handleSortChange = (column: string) => {
        const isCurrent = filters.sort_by === column;
        const newDirection = isCurrent && filters.sort_direction === 'asc' ? 'desc' : 'asc';
        handleFilterChange({
            sort_by: column,
            sort_direction: newDirection,
        });
    };

    const handleReset = () => {
        setSearchTerm('');
        router.get('/admin/adjustments', { queue: filters.queue || 'pending' }, { preserveState: true, preserveScroll: true });
    };

    const renderAttentionBadge = (adj: OrderAdjustmentQueueItem) => {
        if (!adj.needs_attention && !adj.is_aging) {
            return null;
        }

        switch (adj.primary_exception) {
            case 'CONFLICTED':
                return (
                    <Badge variant="destructive" className="text-[10px] gap-1 font-medium bg-red-600/15 text-red-700 dark:text-red-400 border-red-500/30">
                        <AlertOctagon className="h-3 w-3" />
                        <span>Qty Conflict</span>
                    </Badge>
                );
            case 'INELIGIBLE_LIFECYCLE':
                return (
                    <Badge variant="destructive" className="text-[10px] gap-1 font-medium bg-red-600/15 text-red-700 dark:text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3" />
                        <span>Order Blocked</span>
                    </Badge>
                );
            case 'PICKED_ENCROACHMENT':
                return (
                    <Badge variant="destructive" className="text-[10px] gap-1 font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Picked Encroachment</span>
                    </Badge>
                );
            case 'STALE_VERSION':
            case 'STALE_STATUS':
                return (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium text-muted-foreground border-border bg-muted/40">
                        <RefreshCw className="h-3 w-3" />
                        <span>Stale Snapshot</span>
                    </Badge>
                );
            case 'AGING':
                return (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                        <Clock className="h-3 w-3" />
                        <span>Aging ({adj.age_relative})</span>
                    </Badge>
                );
            default:
                return (
                    <Badge variant="destructive" className="text-[10px] gap-1 font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Attention</span>
                    </Badge>
                );
        }
    };

    const renderStatusBadge = (adj: OrderAdjustmentQueueItem) => {
        if (adj.status === 'APPROVED') {
            if (adj.is_ready_to_apply) {
                return (
                    <Badge variant="outline" className="text-[11px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Ready to Apply</span>
                    </Badge>
                );
            }
            return (
                <Badge variant="outline" className="text-[11px] gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Approved (Blocked)</span>
                </Badge>
            );
        }

        if (adj.status === 'APPLIED') {
            return (
                <Badge variant="default" className="text-[11px] font-medium bg-blue-600 hover:bg-blue-600">
                    Applied
                </Badge>
            );
        }

        if (adj.status === 'REVERSED') {
            return (
                <Badge variant="outline" className="text-[11px] font-medium text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">
                    Reversed
                </Badge>
            );
        }

        if (adj.status === 'SUBMITTED') {
            return (
                <Badge variant="secondary" className="text-[11px] font-medium">
                    Pending Review
                </Badge>
            );
        }

        return (
            <Badge variant="secondary" className="text-[11px] font-medium">
                {adj.status_label}
            </Badge>
        );
    };

    const renderSortHeader = (label: string, column: string, align: 'left' | 'right' | 'center' = 'left') => {
        const isCurrentSort = filters.sort_by === column;
        const Icon = isCurrentSort
            ? filters.sort_direction === 'asc'
                ? ArrowUp
                : ArrowDown
            : ArrowUpDown;

        return (
            <th
                scope="col"
                className={`py-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                }`}
            >
                <button
                    type="button"
                    onClick={() => handleSortChange(column)}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors group focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded-xs ${
                        align === 'right' ? 'justify-end' : ''
                    }`}
                >
                    <span>{label}</span>
                    <Icon className={`h-3 w-3 ${isCurrentSort ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-foreground'}`} />
                </button>
            </th>
        );
    };

    const hasActiveFilters = Boolean(
        filters.search ||
        (filters.exception_type && filters.exception_type !== 'ALL') ||
        (filters.impact_case && filters.impact_case !== 'ALL') ||
        filters.reason_code ||
        filters.date_from ||
        filters.date_to
    );

    return (
        <AppLayout title="Order Adjustment & Exception Queue">
            <Head title="Order Adjustment & Exception Queue" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Adjustment & Exception Queue
                            </h1>
                            <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
                                Operational Triage
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Operational command center for triaging, evaluating, and applying post-submission order adjustments and resolving exceptions.
                        </p>
                    </div>
                </div>

                {/* Queue Navigation Tabs */}
                <AdminAdjustmentQueueTabs
                    activeQueue={filters.queue || 'pending'}
                    counts={counts}
                    onSelectQueue={handleQueueSelect}
                />

                {/* Filters Bar */}
                <div className="bg-card border border-border rounded-lg p-4 shadow-xs space-y-4">
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                        {/* Search Input */}
                        <div className="lg:col-span-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search adjustment #, order #, customer, or requester..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 text-xs h-9"
                                aria-label="Search adjustments"
                            />
                        </div>

                        {/* Exception Type Filter */}
                        <div className="lg:col-span-3">
                            <select
                                value={filters.exception_type || 'ALL'}
                                onChange={(e) => handleFilterChange({ exception_type: e.target.value })}
                                aria-label="Filter by exception category"
                                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary text-foreground"
                            >
                                <option value="ALL">All Exceptions / Conditions</option>
                                <option value="CONFLICTED">Quantity Conflicted (Exceeds Fulfillable)</option>
                                <option value="PICKED_ENCROACHMENT">Picked Encroachment (Case B)</option>
                                <option value="STALE">Stale Order Version / Status</option>
                                <option value="INELIGIBLE_LIFECYCLE">Ineligible Order Lifecycle</option>
                                <option value="AGING">Aging (&gt;24h Backlog)</option>
                            </select>
                        </div>

                        {/* Impact Case Filter */}
                        <div className="lg:col-span-2">
                            <select
                                value={filters.impact_case || 'ALL'}
                                onChange={(e) => handleFilterChange({ impact_case: e.target.value })}
                                aria-label="Filter by allocation impact case"
                                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary text-foreground"
                            >
                                <option value="ALL">All Impact Cases</option>
                                <option value="CASE_A">Case A: Unallocated</option>
                                <option value="CASE_B">Case B: Alloc. Affected</option>
                            </select>
                        </div>

                        {/* Reason Filter */}
                        <div className="lg:col-span-2">
                            <select
                                value={filters.reason_code || ''}
                                onChange={(e) => handleFilterChange({ reason_code: e.target.value })}
                                aria-label="Filter by reason code"
                                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary text-foreground"
                            >
                                <option value="">All Reason Codes</option>
                                {reasonCodes.map((rc) => (
                                    <option key={rc.value} value={rc.value}>
                                        {rc.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Actions */}
                        <div className="lg:col-span-1 flex items-center gap-2">
                            <Button type="submit" size="sm" className="h-9 w-full text-xs">
                                Filter
                            </Button>
                            {hasActiveFilters && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                    title="Reset filters"
                                    aria-label="Reset filters"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Queue Items Presentation */}
                {adjustments.data.length === 0 ? (
                    <div className="bg-card border border-border rounded-lg p-12 text-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                            <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">No adjustment requests found</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            There are currently no adjustment requests matching the selected queue or filter criteria.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop & Tablet Table View (hidden on small screens) */}
                        <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse" aria-label="Order Adjustment Queue">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            {renderSortHeader('Adjustment #', 'adjustment_number')}
                                            <th scope="col" className="py-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Order & Customer
                                            </th>
                                            <th scope="col" className="py-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Attention & Status
                                            </th>
                                            <th scope="col" className="py-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Requester
                                            </th>
                                            <th scope="col" className="py-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Allocation Impact
                                            </th>
                                            {renderSortHeader('Projected Reduction', 'projected_grand_total_reduction', 'right')}
                                            {renderSortHeader('Requested At', 'requested_at')}
                                            <th scope="col" className="py-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {adjustments.data.map((adj) => (
                                            <tr key={adj.id} className="hover:bg-muted/20 transition-colors">
                                                {/* Adjustment # */}
                                                <td className="py-3 px-3.5 whitespace-nowrap">
                                                    <div className="font-mono text-xs font-semibold text-foreground">
                                                        {adj.adjustment_number}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {adj.items_count} {adj.items_count === 1 ? 'item' : 'items'}
                                                    </div>
                                                </td>

                                                {/* Order & Customer */}
                                                <td className="py-3 px-3.5">
                                                    <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                                                        <span>{adj.order_number}</span>
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                                            {adj.order_status_label || adj.order_status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {adj.customer_name} ({adj.customer_code})
                                                    </div>
                                                </td>

                                                {/* Attention & Status */}
                                                <td className="py-3 px-3.5">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {renderAttentionBadge(adj)}
                                                        {renderStatusBadge(adj)}
                                                    </div>
                                                </td>

                                                {/* Requester */}
                                                <td className="py-3 px-3.5 whitespace-nowrap">
                                                    <div className="text-xs font-medium text-foreground">
                                                        {adj.requester_name}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {adj.requester_role}
                                                    </div>
                                                </td>

                                                {/* Allocation Impact */}
                                                <td className="py-3 px-3.5 whitespace-nowrap">
                                                    {adj.impact_case === 'CASE_B' ? (
                                                        <Badge variant="destructive" className="text-[11px] gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span>Case B ({adj.affected_allocation_quantity} alloc)</span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[11px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            <span>Case A (Unalloc)</span>
                                                        </Badge>
                                                    )}
                                                </td>

                                                {/* Projected Reduction */}
                                                <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono text-xs font-semibold text-destructive">
                                                    -${adj.projected_grand_total_reduction}
                                                </td>

                                                {/* Requested At */}
                                                <td className="py-3 px-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                                    <div>{adj.requested_at_formatted || '—'}</div>
                                                    <div className="text-[11px] text-muted-foreground/75">{adj.age_relative}</div>
                                                </td>

                                                {/* Action */}
                                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                                    <Link href={`/admin/orders/${adj.order_id}/adjustments/${adj.id}/review`}>
                                                        <Button
                                                            variant={adj.is_ready_to_apply ? 'default' : 'outline'}
                                                            size="sm"
                                                            className="h-8 min-h-[32px] px-3 text-xs gap-1.5 shadow-xs"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            <span>{adj.is_ready_to_apply ? 'Apply' : 'Review'}</span>
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground bg-muted/10">
                                <div>
                                    Showing <span className="font-medium text-foreground">{adjustments.from || 0}</span> to{' '}
                                    <span className="font-medium text-foreground">{adjustments.to || 0}</span> of{' '}
                                    <span className="font-medium text-foreground">{adjustments.total}</span> requests
                                </div>
                                <div className="flex items-center gap-1">
                                    {adjustments.links.map((link, i) => (
                                        <Button
                                            key={i}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
                                            disabled={!link.url}
                                            onClick={() => link.url && router.visit(link.url, { preserveScroll: true })}
                                            className="h-8 min-w-[32px] px-2 text-xs"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Mobile Card Presentation (Visible on < 768px viewports) */}
                        <div className="md:hidden space-y-3" role="feed" aria-label="Adjustment Requests Mobile Feed">
                            {adjustments.data.map((adj) => (
                                <div
                                    key={adj.id}
                                    className="bg-card border border-border rounded-lg p-4 shadow-xs space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-mono text-xs font-bold text-foreground">
                                                {adj.adjustment_number}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Order: <span className="font-medium text-foreground">{adj.order_number}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {renderStatusBadge(adj)}
                                            {renderAttentionBadge(adj)}
                                        </div>
                                    </div>

                                    <div className="text-xs space-y-1 border-t border-border/50 pt-2 text-muted-foreground">
                                        <div className="flex justify-between">
                                            <span>Customer:</span>
                                            <span className="font-medium text-foreground truncate max-w-[180px]">
                                                {adj.customer_name}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Requester:</span>
                                            <span className="text-foreground">{adj.requester_name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Impact:</span>
                                            <span>
                                                {adj.impact_case === 'CASE_B' ? (
                                                    <span className="text-amber-600 font-medium">Case B ({adj.affected_allocation_quantity} alloc)</span>
                                                ) : (
                                                    <span className="text-emerald-600 font-medium">Case A (Unalloc)</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Projected Reduction:</span>
                                            <span className="font-mono font-bold text-destructive">
                                                -${adj.projected_grand_total_reduction}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span>Requested:</span>
                                            <span>{adj.age_relative} ({adj.requested_at_formatted || '—'})</span>
                                        </div>
                                    </div>

                                    <div className="pt-1">
                                        <Link
                                            href={`/admin/orders/${adj.order_id}/adjustments/${adj.id}/review`}
                                            className="w-full block"
                                        >
                                            <Button
                                                variant={adj.is_ready_to_apply ? 'default' : 'outline'}
                                                size="sm"
                                                className="w-full h-11 min-h-[44px] text-xs gap-1.5 justify-center shadow-xs"
                                            >
                                                <FileText className="h-4 w-4" />
                                                <span>{adj.is_ready_to_apply ? 'Apply Adjustment' : 'Review Request'}</span>
                                                <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}

                            {/* Mobile Pagination */}
                            <div className="p-3 bg-card border border-border rounded-lg flex items-center justify-between gap-2 text-xs">
                                <div>
                                    Page <span className="font-medium text-foreground">{adjustments.current_page}</span> of{' '}
                                    <span className="font-medium text-foreground">{adjustments.last_page}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {adjustments.links.map((link, i) => (
                                        <Button
                                            key={i}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
                                            disabled={!link.url}
                                            onClick={() => link.url && router.visit(link.url, { preserveScroll: true })}
                                            className="h-8 min-w-[32px] px-2 text-xs"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
