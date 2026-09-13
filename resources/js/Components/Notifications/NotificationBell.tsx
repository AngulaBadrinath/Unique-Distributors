import React, { useState, useEffect, useRef } from 'react';
import { Link, router } from '@inertiajs/react';
import { 
    Bell, 
    Check, 
    CheckCheck, 
    ExternalLink, 
    Info, 
    AlertTriangle, 
    AlertCircle, 
    CheckCircle2, 
    Settings, 
    X,
    Loader2 
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

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const isMountedRef = useRef(true);

    // Fetch feed and unread count
    const fetchFeed = async (signal?: AbortSignal) => {
        try {
            if (isMountedRef.current) setLoading(true);
            const res = await fetch('/notifications/feed', {
                signal,
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            if (res.ok && isMountedRef.current) {
                const data = await res.json();
                if (isMountedRef.current) {
                    setUnreadCount(data.unread_count || 0);
                    setNotifications(data.notifications || []);
                }
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error('Failed to fetch notification feed', err);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        const controller = new AbortController();
        fetchFeed(controller.signal);

        // Periodic check for new unread notifications
        const interval = setInterval(() => {
            fetchFeed(controller.signal);
        }, 30000);

        return () => {
            isMountedRef.current = false;
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    // Close popover on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleMarkAsRead = async (id: number, actionUrl?: string | null) => {
        try {
            await fetch(`/notifications/${id}/read`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            // Update local state
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));

            if (actionUrl) {
                setIsOpen(false);
                router.visit(actionUrl);
            }
        } catch (err) {
            console.error('Failed to mark notification as read', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await fetch('/notifications/read-all', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read', err);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'SUCCESS':
                return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
            case 'WARNING':
                return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
            case 'CRITICAL':
                return <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />;
            default:
                return <Info className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />;
        }
    };

    return (
        <div className="relative inline-block text-left" ref={popoverRef}>
            {/* Bell Trigger */}
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) fetchFeed();
                }}
                className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/8 bg-dark-surface shadow-neu-dark focus:outline-hidden focus:ring-2 focus:ring-action-accent transition-all cursor-pointer"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                aria-expanded={isOpen}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-neu-dark glow-cyan-subtle">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 bg-dark-surface shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 shadow-neu-dark">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-dark-surface-elevated/90">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-[11px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-mono">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllAsRead}
                                    title="Mark all as read"
                                    className="p-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                                >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    <span className="text-[11px]">Mark read</span>
                                </button>
                            )}
                            <Link
                                href="/notifications/preferences"
                                onClick={() => setIsOpen(false)}
                                title="Notification Preferences"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <Settings className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Notification Feed List */}
                    <div className="max-h-[380px] overflow-y-auto divide-y divide-white/6 bg-dark-surface">
                        {loading && notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin mb-2 text-cyan-400" />
                                <span className="text-xs">Loading notifications...</span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-medium text-white">No notifications yet</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    You are all caught up with your operational tasks.
                                </p>
                            </div>
                        ) : (
                            notifications.map((item) => (
                                <div
                                    key={item.id}
                                    className={`p-3.5 flex gap-3 text-xs transition-colors hover:bg-white/5 ${
                                        !item.is_read ? 'bg-cyan-500/10' : ''
                                    }`}
                                >
                                    {getSeverityIcon(item.severity)}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="font-semibold text-foreground truncate">
                                                {item.title}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">
                                            {item.message}
                                        </p>
                                        <div className="mt-2 flex items-center justify-between pt-1">
                                            <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {item.category}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {!item.is_read && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkAsRead(item.id)}
                                                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Mark read
                                                    </button>
                                                )}
                                                {item.action_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkAsRead(item.id, item.action_url)}
                                                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                                                    >
                                                        View
                                                        <ExternalLink className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-border bg-muted/20 text-center">
                        <Link
                            href="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-medium text-primary hover:underline inline-block py-1 px-3"
                        >
                            View All Notifications &rarr;
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
