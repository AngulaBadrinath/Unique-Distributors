import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { 
    Bell, 
    Check, 
    CheckCheck, 
    Trash2, 
    ExternalLink, 
    Info, 
    AlertTriangle, 
    AlertCircle, 
    CheckCircle2, 
    Settings, 
    Search,
    Filter,
    ArrowUpDown
} from 'lucide-react';

interface NotificationItem {
    id: number;
    user_id: number;
    type: string;
    category: string;
    title: string;
    message: string;
    severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
    action_url: string | null;
    metadata: Record<string, any> | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
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
    notifications: PaginatedData<NotificationItem>;
    unread_count: number;
    filters: {
        is_read?: string;
        category?: string;
        severity?: string;
        search?: string;
    };
    categories: string[];
}

export default function NotificationIndex({ notifications, unread_count, filters, categories }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [category, setCategory] = useState(filters.category || '');
    const [severity, setSeverity] = useState(filters.severity || '');
    const [statusTab, setStatusTab] = useState(filters.is_read || 'all');

    const applyFilters = (newFilters: Record<string, any>) => {
        router.get('/notifications', {
            is_read: statusTab !== 'all' ? statusTab : undefined,
            category: category || undefined,
            severity: severity || undefined,
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

    const handleTabChange = (tab: string) => {
        setStatusTab(tab);
        router.get('/notifications', {
            is_read: tab !== 'all' ? tab : undefined,
            category: category || undefined,
            severity: severity || undefined,
            search: search || undefined,
        }, {
            preserveState: true,
            replace: true,
        });
    };

    const handleMarkAsRead = (id: number) => {
        router.post(`/notifications/${id}/read`, {}, {
            preserveScroll: true,
        });
    };

    const handleMarkAllAsRead = () => {
        router.post('/notifications/read-all', {}, {
            preserveScroll: true,
        });
    };

    const handleDelete = (id: number) => {
        if (confirm('Delete this notification?')) {
            router.delete(`/notifications/${id}`, {
                preserveScroll: true,
            });
        }
    };

    const getSeverityBadge = (sev: string) => {
        switch (sev) {
            case 'SUCCESS':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        Success
                    </span>
                );
            case 'WARNING':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="h-3 w-3" />
                        Warning
                    </span>
                );
            case 'CRITICAL':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        <AlertCircle className="h-3 w-3" />
                        Critical
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                        <Info className="h-3 w-3" />
                        Info
                    </span>
                );
        }
    };

    return (
        <AppLayout title="Notification Center">
            <Head title="Notifications - Operational Alert Center" />

            <div className="space-y-6">
                {/* Header Title & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                            <Bell className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                Operational Notifications
                                {unread_count > 0 && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                                        {unread_count} unread
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                User-scoped action notifications, approvals, and workflow milestones.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {unread_count > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-white/10 bg-dark-surface hover:bg-white/10 text-white transition-all shadow-neu-dark cursor-pointer"
                            >
                                <CheckCheck className="h-4 w-4 text-cyan-400" />
                                Mark All as Read
                            </button>
                        )}
                        <Link
                            href="/notifications/preferences"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-action-accent text-white hover:bg-action-accent/90 transition-all shadow-neu-dark glow-cyan-subtle"
                        >
                            <Settings className="h-4 w-4" />
                            Preferences
                        </Link>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-dark-surface border border-white/8 rounded-2xl shadow-neu-dark">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-dark-canvas border border-white/6 rounded-xl w-fit shadow-neu-inset">
                        <button
                            type="button"
                            onClick={() => handleTabChange('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                statusTab === 'all'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-neu-dark'
                                    : 'text-muted-foreground hover:text-white'
                            }`}
                        >
                            All ({notifications.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('unread')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                statusTab === 'unread'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-neu-dark'
                                    : 'text-muted-foreground hover:text-white'
                            }`}
                        >
                            Unread ({unread_count})
                        </button>
                    </div>

                    {/* Filter Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Category Dropdown */}
                        <select
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                applyFilters({ category: e.target.value });
                            }}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:ring-2 focus:ring-primary"
                        >
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>

                        {/* Severity Dropdown */}
                        <select
                            value={severity}
                            onChange={(e) => {
                                setSeverity(e.target.value);
                                applyFilters({ severity: e.target.value });
                            }}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:ring-2 focus:ring-primary"
                        >
                            <option value="">All Severities</option>
                            <option value="INFO">Info</option>
                            <option value="SUCCESS">Success</option>
                            <option value="WARNING">Warning</option>
                            <option value="CRITICAL">Critical</option>
                        </select>

                        {/* Search Input */}
                        <form onSubmit={handleSearchSubmit} className="relative min-w-[200px] flex-1 sm:flex-initial">
                            <input
                                type="text"
                                placeholder="Search notifications..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                            />
                            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                        </form>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border shadow-xs">
                    {notifications.data.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Bell className="h-12 w-12 mx-auto mb-3 opacity-25" />
                            <h3 className="text-sm font-semibold text-foreground">No notifications found</h3>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                No operational notifications match your current filter criteria.
                            </p>
                        </div>
                    ) : (
                        notifications.data.map((item) => (
                            <div
                                key={item.id}
                                className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:bg-muted/40 ${
                                    !item.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''
                                }`}
                            >
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                            {item.category}
                                        </span>
                                        {getSeverityBadge(item.severity)}
                                        <span className="text-[11px] text-muted-foreground">
                                            {new Date(item.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-foreground">
                                        {item.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {item.message}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                    {item.action_url && (
                                        <Link
                                            href={item.action_url}
                                            onClick={() => !item.is_read && handleMarkAsRead(item.id)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            Take Action
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </Link>
                                    )}
                                    {!item.is_read && (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkAsRead(item.id)}
                                            title="Mark as Read"
                                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item.id)}
                                        title="Delete Notification"
                                        className="p-1.5 rounded-lg border border-border hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-muted-foreground transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {notifications.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-border pt-4">
                        <span className="text-xs text-muted-foreground">
                            Showing page {notifications.current_page} of {notifications.last_page} ({notifications.total} total)
                        </span>
                        <div className="flex items-center gap-1">
                            {notifications.links.map((link, idx) => (
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
            </div>
        </AppLayout>
    );
}
