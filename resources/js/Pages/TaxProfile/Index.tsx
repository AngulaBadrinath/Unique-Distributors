import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import { TaxProfile, PaginatedResponse, TaxProfileStatusOption } from '@/types';
import {
    Receipt,
    Search,
    Plus,
    Filter,
    ArrowUpDown,
    CheckCircle2,
    Clock,
    Percent,
    Package,
    Edit,
    Trash2,
    ShieldAlert,
    AlertCircle,
} from 'lucide-react';

import { formatTaxPercentage } from '@/lib/financial';

interface TaxProfileIndexProps {
    taxProfiles: PaginatedResponse<TaxProfile>;
    filters: {
        search: string;
        status: string;
        sort_by: string;
        sort_order: string;
    };
    statuses: TaxProfileStatusOption[];
    can: {
        manage: boolean;
    };
}

export default function TaxProfileIndex({
    taxProfiles,
    filters,
    statuses,
    can,
}: TaxProfileIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'ALL');
    const [deleteTarget, setDeleteTarget] = useState<TaxProfile | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Debounced search
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== (filters.search || '')) {
                applyFilters({ search });
            }
        }, 350);

        return () => clearTimeout(timeout);
    }, [search]);

    const applyFilters = (newFilters: Partial<typeof filters>) => {
        router.get(
            '/tax-profiles',
            {
                ...filters,
                ...newFilters,
                page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleSort = (field: string) => {
        const newOrder = filters.sort_by === field && filters.sort_order === 'asc' ? 'desc' : 'asc';
        applyFilters({ sort_by: field, sort_order: newOrder });
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        router.delete(`/tax-profiles/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setDeleteTarget(null);
            },
        });
    };

    // Calculate metrics
    const totalCount = taxProfiles.total ?? taxProfiles.data.length;
    const activeCount = taxProfiles.data.filter((t) => t.status === 'ACTIVE').length;
    const zeroRateCount = taxProfiles.data.filter((t) => parseFloat(t.rate) === 0).length;
    const totalAttachedProducts = taxProfiles.data.reduce((sum, t) => sum + (t.products_count || 0), 0);

    return (
        <AppLayout title="Product Tax Profiles & Calculation Rules">
            <Head title="Tax Profiles" />

            <div className="space-y-6">
                {/* Header & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                            <Receipt className="h-3.5 w-3.5 text-primary" />
                            <span>Financial Engine</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Tax Profiles & Rates
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Define product-specific tax profiles, authoritative rates (DECIMAL 7,4), and line-level ROUND_HALF_UP rules.
                        </p>
                    </div>

                    {can.manage && (
                        <div className="flex items-center gap-2">
                            <Link href="/tax-profiles/create">
                                <Button className="gap-2 shadow-xs">
                                    <Plus className="h-4 w-4" />
                                    <span>Create Tax Profile</span>
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Metrics Summary Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Total Profiles</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {totalCount}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <Receipt className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Active Profiles</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {activeCount}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Zero / Exempt Rates</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {zeroRateCount}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Percent className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Attached Products</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {totalAttachedProducts}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Package className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters & Search Toolbar */}
                <Card className="border-border shadow-xs">
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search by code, tax name, or description..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 bg-background/50 h-9 text-xs"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Filters */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2.5 py-1">
                                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => {
                                            setSelectedStatus(e.target.value);
                                            applyFilters({ status: e.target.value });
                                        }}
                                        className="text-xs bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-foreground"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        {statuses.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tax Profiles Table */}
                <Card className="border-border shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[11px] border-b border-border">
                                <tr>
                                    <th
                                        className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                        onClick={() => handleSort('code')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Tax Code</span>
                                            <ArrowUpDown className="h-3 w-3" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Profile Name</span>
                                            <ArrowUpDown className="h-3 w-3" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 cursor-pointer hover:text-foreground select-none text-right"
                                        onClick={() => handleSort('rate')}
                                    >
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span>Tax Rate (%)</span>
                                            <ArrowUpDown className="h-3 w-3" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center">Attached Products</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {taxProfiles.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                                                    <Receipt className="h-5 w-5" />
                                                </div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    No tax profiles found
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1 text-center">
                                                    No tax profile records match the selected filter criteria or search query.
                                                </p>
                                                {(filters.search || filters.status !== 'ALL') && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSearch('');
                                                            setSelectedStatus('ALL');
                                                            applyFilters({
                                                                search: '',
                                                                status: 'ALL',
                                                            });
                                                        }}
                                                        className="mt-4 text-xs"
                                                    >
                                                        Reset Filters
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    taxProfiles.data.map((profile) => (
                                        <tr
                                            key={profile.id}
                                            className="hover:bg-muted/30 transition-colors group"
                                        >
                                            <td className="px-4 py-3 font-mono font-medium">
                                                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[11px]">
                                                    {profile.code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">
                                                        {profile.name}
                                                    </span>
                                                    {profile.description && (
                                                        <span className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                                                            {profile.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                                                {formatTaxPercentage(profile.rate)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted/50 px-2 py-0.5 rounded-full border border-border/60">
                                                    <Package className="h-3 w-3 text-muted-foreground" />
                                                    <span>{profile.products_count ?? 0}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    variant={profile.status === 'ACTIVE' ? 'default' : 'secondary'}
                                                    className="text-[10px] uppercase font-mono px-2 py-0.5"
                                                >
                                                    {profile.status === 'ACTIVE' ? (
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                                            ACTIVE
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3 text-zinc-400" />
                                                            INACTIVE
                                                        </span>
                                                    )}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {can.manage && (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link href={`/tax-profiles/${profile.id}/edit`}>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                                title="Edit Profile"
                                                            >
                                                                <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setDeleteTarget(profile)}
                                                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                            title="Delete Profile"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {taxProfiles.links && taxProfiles.links.length > 3 && (
                        <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                            <div>
                                Showing <span className="font-medium text-foreground">{taxProfiles.from || 0}</span> to{' '}
                                <span className="font-medium text-foreground">{taxProfiles.to || 0}</span> of{' '}
                                <span className="font-medium text-foreground">{taxProfiles.total}</span> tax profiles
                            </div>
                            <div className="flex items-center gap-1">
                                {taxProfiles.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                        disabled={!link.url || link.active}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                        className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                                            link.active
                                                ? 'bg-primary text-primary-foreground font-semibold border-primary'
                                                : link.url
                                                ? 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                                                : 'text-muted-foreground/40 border-transparent cursor-not-allowed'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Deletion Safeguard Modal */}
                {deleteTarget && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirm Delete Tax Profile"
                    >
                        <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
                            <div className="px-6 py-4 border-b border-border">
                                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 text-destructive" />
                                    Delete Tax Profile
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Verify assignment before removing this tax configuration.
                                </p>
                            </div>

                            <div className="p-6 space-y-4 text-xs">
                                {(deleteTarget.products_count ?? 0) > 0 ? (
                                    <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2.5">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold">Deletion Blocked (ON DELETE RESTRICT)</p>
                                            <p className="mt-1">
                                                This profile is currently referenced by{' '}
                                                <span className="font-bold">{deleteTarget.products_count}</span> product(s).
                                                Deactivate the profile instead to prevent new assignments.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground">
                                        Are you sure you want to permanently delete tax profile{' '}
                                        <span className="font-semibold text-foreground">
                                            {deleteTarget.name} ({deleteTarget.code})
                                        </span>
                                        ? This action cannot be undone.
                                    </p>
                                )}
                            </div>

                            <div className="px-6 py-3 bg-muted/40 border-t border-border flex items-center justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </Button>
                                {(deleteTarget.products_count ?? 0) === 0 && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
