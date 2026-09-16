import React, { useState, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button, buttonVariants } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import { PaginatedResponse, PageProps } from '@/types';
import {
    Truck,
    Search,
    Plus,
    Filter,
    ChevronRight,
    Mail,
    ArrowUpDown,
    CheckCircle2,
    Clock,
    ShieldAlert,
    UserX,
    PackageCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryPartnerListItem {
    id: number;
    name: string;
    email: string;
    status: string;
    status_label: string;
    can_authenticate: boolean;
    can_be_assigned: boolean;
    assigned_deliveries_count: number;
    created_at: string;
}

interface StatusOption {
    value: string;
    label: string;
    description: string;
}

interface DeliveryPartnerIndexProps {
    deliveryPartners: PaginatedResponse<DeliveryPartnerListItem>;
    filters: {
        search?: string;
        status?: string;
        sort?: string;
        direction?: string;
    };
    statuses: StatusOption[];
}

export default function DeliveryPartnerIndex({ deliveryPartners, filters, statuses }: DeliveryPartnerIndexProps) {
    const { auth } = usePage<PageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'ALL');

    const canCreate = auth?.user?.permissions?.includes('user.create') ||
        auth?.user?.role === 'SUPER_ADMIN' || auth?.user?.role === 'ADMIN';

    // Debounced search handler
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
            '/admin/delivery-partners',
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
        const newDirection = filters.sort === field && filters.direction === 'asc' ? 'desc' : 'asc';
        applyFilters({ sort: field, direction: newDirection });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/60 text-xs font-mono">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                    </Badge>
                );
            case 'INVITED':
                return (
                    <Badge variant="outline" className="bg-amber-950/40 text-amber-400 border-amber-800/60 text-xs font-mono">
                        <Clock className="h-3 w-3 mr-1" />
                        Invited
                    </Badge>
                );
            case 'SUSPENDED':
                return (
                    <Badge variant="outline" className="bg-rose-950/40 text-rose-400 border-rose-800/60 text-xs font-mono">
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Suspended
                    </Badge>
                );
            case 'DISABLED':
                return (
                    <Badge variant="outline" className="bg-slate-900/60 text-slate-400 border-slate-700/60 text-xs font-mono">
                        <UserX className="h-3 w-3 mr-1" />
                        Disabled
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-xs font-mono">
                        {status}
                    </Badge>
                );
        }
    };

    return (
        <AppLayout>
            <Head title="Delivery Partners — Logistics Fleet" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-brand-foreground font-mono">
                                Delivery Partners
                            </h1>
                            <Badge variant="outline" className="text-xs font-mono">
                                {deliveryPartners.total} Total
                            </Badge>
                        </div>
                        <p className="text-sm text-brand-muted mt-1">
                            Manage logistics drivers, active delivery routes, assignments, and portal access.
                        </p>
                    </div>

                    {canCreate && (
                        <div className="flex items-center gap-3">
                            <Link
                                href="/admin/delivery-partners/create"
                                className={cn(buttonVariants({ variant: 'default' }), 'gap-2 shadow-xs')}
                            >
                                <Plus className="h-4 w-4" />
                                Provision Delivery Partner
                            </Link>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative sm:col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
                        <Input
                            placeholder="Search by driver name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-brand-surface border-border/60 text-brand-foreground placeholder:text-brand-muted/60"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted pointer-events-none" />
                        <select
                            value={selectedStatus}
                            onChange={(e) => {
                                setSelectedStatus(e.target.value);
                                applyFilters({ status: e.target.value === 'ALL' ? undefined : e.target.value });
                            }}
                            className="w-full pl-9 pr-8 py-2 text-sm bg-brand-surface border border-border/60 rounded-md text-brand-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                        >
                            <option value="ALL">All Account Statuses</option>
                            {statuses.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table / Cards */}
                <Card className="border-border/60 bg-brand-surface/40 backdrop-blur-xs shadow-xs overflow-hidden">
                    <CardContent className="p-0">
                        {deliveryPartners.data.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <div className="mx-auto w-12 h-12 rounded-full bg-brand-surface border border-border/60 flex items-center justify-center text-brand-muted">
                                    <Truck className="h-6 w-6" />
                                </div>
                                <h3 className="text-base font-medium text-brand-foreground">No delivery partners found</h3>
                                <p className="text-sm text-brand-muted max-w-sm mx-auto">
                                    {filters.search || filters.status
                                        ? 'No delivery partner accounts match the specified filter criteria.'
                                        : 'No delivery partner accounts have been provisioned in the system yet.'}
                                </p>
                                {canCreate && (
                                    <div className="pt-2">
                                        <Link
                                            href="/admin/delivery-partners/create"
                                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Provision First Partner
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-brand-surface border-b border-border/60 text-xs font-mono uppercase text-brand-muted">
                                        <tr>
                                            <th className="py-3.5 px-4 font-semibold">
                                                <button
                                                    onClick={() => handleSort('name')}
                                                    className="flex items-center gap-1.5 hover:text-brand-foreground transition-colors"
                                                >
                                                    Driver Name
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </th>
                                            <th className="py-3.5 px-4 font-semibold">
                                                <button
                                                    onClick={() => handleSort('email')}
                                                    className="flex items-center gap-1.5 hover:text-brand-foreground transition-colors"
                                                >
                                                    Email Address
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </th>
                                            <th className="py-3.5 px-4 font-semibold text-center">
                                                <button
                                                    onClick={() => handleSort('status')}
                                                    className="flex items-center gap-1.5 justify-center mx-auto hover:text-brand-foreground transition-colors"
                                                >
                                                    Status
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </th>
                                            <th className="py-3.5 px-4 font-semibold text-right">
                                                <button
                                                    onClick={() => handleSort('assigned_deliveries_count')}
                                                    className="flex items-center gap-1.5 justify-end ml-auto hover:text-brand-foreground transition-colors"
                                                >
                                                    Total Deliveries
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </th>
                                            <th className="py-3.5 px-4 font-semibold text-right">
                                                <button
                                                    onClick={() => handleSort('created_at')}
                                                    className="flex items-center gap-1.5 justify-end ml-auto hover:text-brand-foreground transition-colors"
                                                >
                                                    Created
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </th>
                                            <th className="py-3.5 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {deliveryPartners.data.map((driver) => (
                                            <tr
                                                key={driver.id}
                                                className="hover:bg-brand-surface/60 transition-colors group cursor-pointer"
                                                onClick={() => router.get(`/admin/delivery-partners/${driver.id}`)}
                                            >
                                                <td className="py-3.5 px-4 font-medium text-brand-foreground">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-950/40 border border-indigo-800/60 text-indigo-400 flex items-center justify-center font-mono font-semibold text-xs shrink-0">
                                                            <Truck className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-brand-foreground group-hover:text-indigo-400 transition-colors">
                                                                {driver.name}
                                                            </div>
                                                            <div className="text-xs text-brand-muted font-mono">
                                                                ID: #{driver.id}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-brand-muted font-mono text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="h-3.5 w-3.5 text-brand-muted/70 shrink-0" />
                                                        <span className="truncate">{driver.email}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    {getStatusBadge(driver.status)}
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 font-mono text-xs text-brand-foreground font-medium">
                                                        <PackageCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                                        <span>{driver.assigned_deliveries_count} missions</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-right text-xs text-brand-muted font-mono">
                                                    {new Date(driver.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                                                        <Link
                                                            href={`/admin/delivery-partners/${driver.id}`}
                                                            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 px-2 text-brand-muted hover:text-brand-foreground')}
                                                        >
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {deliveryPartners.total > deliveryPartners.per_page && (
                    <div className="flex items-center justify-between border-t border-border/40 pt-4">
                        <p className="text-xs font-mono text-brand-muted">
                            Showing {deliveryPartners.from} to {deliveryPartners.to} of {deliveryPartners.total} delivery partners
                        </p>
                        <div className="flex items-center gap-1">
                            {deliveryPartners.links.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.url || '#'}
                                    preserveScroll
                                    preserveState
                                    className={cn(
                                        buttonVariants({
                                            variant: link.active ? 'default' : 'outline',
                                            size: 'sm',
                                        }),
                                        'h-8 px-3 text-xs font-mono',
                                        !link.url && 'opacity-40 pointer-events-none'
                                    )}
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
