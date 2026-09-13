import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { 
    History, 
    Search, 
    Filter, 
    Calendar, 
    User as UserIcon, 
    Code, 
    X, 
    Layers, 
    Clock, 
    ShieldAlert,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Shield
} from 'lucide-react';

interface Actor {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface AuditItem {
    id: number;
    event_type: string;
    module: string;
    action: string;
    actor_id: number | null;
    actor_email: string | null;
    actor_role_snapshot: string | null;
    entity_type: string | null;
    entity_id: number | null;
    reference_number: string | null;
    description: string | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    actor?: Actor | null;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    logs: PaginatedData<AuditItem>;
    modules: string[];
    filters: {
        module?: string;
        event_type?: string;
        entity_type?: string;
        entity_id?: string;
        actor_id?: string;
        date_from?: string;
        date_to?: string;
        search?: string;
    };
}

export default function AuditTimeline({ logs, modules, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [selectedModule, setSelectedModule] = useState(filters.module || '');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    const [selectedMetadata, setSelectedMetadata] = useState<AuditItem | null>(null);

    const applyFilters = (newFilters: Record<string, any>) => {
        router.get('/admin/audit/timeline', {
            module: selectedModule || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            search: search || undefined,
            ...newFilters,
        }, {
            preserveState: true,
            replace: true,
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters({ search });
    };

    const handleClearFilters = () => {
        setSearch('');
        setSelectedModule('');
        setDateFrom('');
        setDateTo('');
        router.get('/admin/audit/timeline', {}, { replace: true });
    };

    const getModuleColor = (mod: string) => {
        switch (mod.toUpperCase()) {
            case 'ORDER':
            case 'ORDERS':
                return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800';
            case 'PAYMENT':
            case 'PAYMENTS':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800';
            case 'INVENTORY':
                return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800';
            case 'DELIVERY':
                return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800';
            case 'ACCOUNTING':
                return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800';
            case 'TAX':
                return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400 dark:border-cyan-800';
            case 'SECURITY':
            case 'AUTH':
                return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
        }
    };

    return (
        <AppLayout title="Business Audit Timeline">
            <Head title="Audit Trail & User Activity Timeline" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                            <History className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                Business Audit & Activity Timeline
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Immutable, append-only historical record of operational transactions and user actions.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/audit/security"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-xs"
                        >
                            <Shield className="h-4 w-4 text-rose-500" />
                            Security Event Log
                        </Link>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Search Input */}
                        <div className="lg:col-span-2">
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                Search Action / Reference / Description
                            </label>
                            <form onSubmit={handleSearchSubmit} className="relative">
                                <input
                                    type="text"
                                    placeholder="e.g. ORDER_APPROVED or ORD-10023..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary"
                                />
                                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                            </form>
                        </div>

                        {/* Module Dropdown */}
                        <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                Module
                            </label>
                            <select
                                value={selectedModule}
                                onChange={(e) => {
                                    setSelectedModule(e.target.value);
                                    applyFilters({ module: e.target.value });
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary"
                            >
                                <option value="">All Modules</option>
                                {modules.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date From */}
                        <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                Date From
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => {
                                    setDateFrom(e.target.value);
                                    applyFilters({ date_from: e.target.value });
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                Date To
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => {
                                    setDateTo(e.target.value);
                                    applyFilters({ date_to: e.target.value });
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {(search || selectedModule || dateFrom || dateTo) && (
                        <div className="flex items-center justify-end pt-1">
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Audit Timeline / Table Hybrid */}
                <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Timestamp</th>
                                    <th className="px-4 py-3">Module & Action</th>
                                    <th className="px-4 py-3">Actor</th>
                                    <th className="px-4 py-3">Entity / Target</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {logs.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                            <History className="h-10 w-10 mx-auto mb-2 opacity-25" />
                                            <p className="font-semibold text-foreground">No audit entries found</p>
                                            <p className="text-[11px] mt-0.5">Try adjusting your filters or date range.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.data.map((item) => (
                                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                            {/* Timestamp */}
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                                <div className="font-mono text-[11px]">
                                                    {new Date(item.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] opacity-75">
                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                            </td>

                                            {/* Module & Action */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getModuleColor(item.module)}`}>
                                                        {item.module}
                                                    </span>
                                                </div>
                                                <div className="font-semibold text-foreground font-mono text-[11px]">
                                                    {item.action}
                                                </div>
                                            </td>

                                            {/* Actor */}
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">
                                                    {item.actor?.name || item.actor_email || 'System'}
                                                </div>
                                                <div className="text-[10px] font-mono text-muted-foreground">
                                                    {item.actor_role_snapshot || 'SYSTEM'}
                                                </div>
                                            </td>

                                            {/* Entity */}
                                            <td className="px-4 py-3">
                                                {item.entity_type ? (
                                                    <div>
                                                        <span className="font-mono text-[11px] text-foreground font-semibold">
                                                            {item.reference_number || `#${item.entity_id}`}
                                                        </span>
                                                        <div className="text-[10px] text-muted-foreground uppercase">
                                                            {item.entity_type}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">&mdash;</span>
                                                )}
                                            </td>

                                            {/* Description */}
                                            <td className="px-4 py-3 max-w-xs truncate text-muted-foreground" title={item.description || ''}>
                                                {item.description || '&mdash;'}
                                            </td>

                                            {/* Details Button */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {item.metadata && Object.keys(item.metadata).length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedMetadata(item)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-muted hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer border border-border"
                                                    >
                                                        <Code className="h-3 w-3" />
                                                        Payload
                                                    </button>
                                                ) : (
                                                    <span className="text-muted-foreground text-[10px]">&mdash;</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Vertical Timeline View */}
                    <div className="md:hidden divide-y divide-border">
                        {logs.data.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <History className="h-8 w-8 mx-auto mb-2 opacity-25" />
                                <p className="text-xs font-semibold text-foreground">No audit entries found</p>
                            </div>
                        ) : (
                            logs.data.map((item) => (
                                <div key={item.id} className="p-4 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getModuleColor(item.module)}`}>
                                            {item.module}
                                        </span>
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                            {new Date(item.created_at).toLocaleString()}
                                        </span>
                                    </div>

                                    <h4 className="font-mono text-xs font-bold text-foreground">
                                        {item.action}
                                    </h4>

                                    {item.description && (
                                        <p className="text-xs text-muted-foreground">
                                            {item.description}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 text-muted-foreground border-t border-border/50">
                                        <div>
                                            Actor: <strong className="text-foreground">{item.actor?.name || item.actor_email || 'System'}</strong> ({item.actor_role_snapshot || 'SYSTEM'})
                                        </div>
                                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMetadata(item)}
                                                className="text-primary hover:underline font-mono text-[10px] flex items-center gap-0.5"
                                            >
                                                <Code className="h-3 w-3" />
                                                View Metadata
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pagination */}
                {logs.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-border pt-4">
                        <span className="text-xs text-muted-foreground">
                            Showing page {logs.current_page} of {logs.last_page} ({logs.total} total audit logs)
                        </span>
                        <div className="flex items-center gap-1">
                            {logs.links.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.url || '#'}
                                    preserveScroll
                                    className={`px-3 py-1 text-xs rounded-md border ${
                                        link.active
                                            ? 'bg-primary text-primary-foreground border-primary font-medium'
                                            : 'bg-card text-muted-foreground border-border hover:bg-muted'
                                    } ${!link.url ? 'opacity-40 pointer-events-none' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Metadata JSON Modal / Drawer */}
                {selectedMetadata && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
                            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <Code className="h-4 w-4 text-primary" />
                                        Audit Event Context Payload
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                        ID: {selectedMetadata.id} &bull; Action: {selectedMetadata.action}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMetadata(null)}
                                    className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-4 overflow-y-auto space-y-3 font-mono text-xs">
                                <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-lg bg-muted/40 border border-border">
                                    <div>
                                        <span className="text-muted-foreground">IP Address:</span>{' '}
                                        <span className="text-foreground font-semibold">{selectedMetadata.ip_address || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Actor Role:</span>{' '}
                                        <span className="text-foreground font-semibold">{selectedMetadata.actor_role_snapshot || 'SYSTEM'}</span>
                                    </div>
                                    <div className="col-span-2 truncate" title={selectedMetadata.user_agent || ''}>
                                        <span className="text-muted-foreground">User Agent:</span>{' '}
                                        <span className="text-foreground">{selectedMetadata.user_agent || 'N/A'}</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider block mb-1">
                                        Sanitized Metadata JSON
                                    </span>
                                    <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 dark:bg-black overflow-x-auto text-[11px] leading-relaxed border border-border">
                                        {JSON.stringify(selectedMetadata.metadata, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setSelectedMetadata(null)}
                                    className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
