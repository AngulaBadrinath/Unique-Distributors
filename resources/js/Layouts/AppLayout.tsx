import React, { useState, useEffect } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { PageProps } from '@/types';
import { 
    Menu, 
    X, 
    Layers, 
    Activity, 
    ShieldCheck, 
    Terminal, 
    Settings,
    Building2,
    Users,
    KeyRound,
    Package,
    FolderTree,
    Receipt,
    Shield,
    FileText,
    RotateCcw,
    DollarSign,
    CreditCard,
    BookOpen,
    Scale,
    TrendingUp,
    Landmark,
    FileSpreadsheet,
    BarChart3,
    Truck,
    Boxes,
    History,
    ShieldAlert,
    Bell,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LogOut,
    User as UserIcon,
    Home,
    PlusCircle,
    FileCheck,
    CheckCircle2,
    SlidersHorizontal,
    Search
} from 'lucide-react';
import NotificationBell from '@/Components/Notifications/NotificationBell';

interface AppLayoutProps {
    children: React.ReactNode;
    title?: string;
    breadcrumbs?: { label: string; href?: string }[];
}

export default function AppLayout({ children, title, breadcrumbs }: AppLayoutProps) {
    const { appName, identity, company, auth, flash } = usePage<PageProps>().props;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('app_sidebar_collapsed') === 'true';
        }
        return false;
    });

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { url: pageUrl } = usePage();
    const currentUrl = pageUrl ? pageUrl.split('?')[0] : (typeof window !== 'undefined' ? window.location.pathname : '');

    const displayName = identity?.name || appName || 'Unique Distributors';
    const displayCompany = company?.display_name || identity?.company_name || 'Unique Distributors';
    const initials = displayName.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'UD';

    const toggleSidebarCollapse = () => {
        const next = !sidebarCollapsed;
        setSidebarCollapsed(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem('app_sidebar_collapsed', String(next));
        }
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    // Permission checks
    const hasRoleManage = auth?.user?.permissions?.includes('role.manage') || auth?.user?.role === 'SUPER_ADMIN' || auth?.user?.role === 'ADMIN';
    const hasCustomerView = auth?.user?.permissions?.includes('customer.view') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SALESMAN'].includes(auth?.user?.role || '');
    const hasCustomerCreate = auth?.user?.permissions?.includes('customer.create') || ['SUPER_ADMIN', 'ADMIN'].includes(auth?.user?.role || '');
    const hasUserView = auth?.user?.permissions?.includes('user.view') || ['SUPER_ADMIN', 'ADMIN'].includes(auth?.user?.role || '');
    const hasProductView = auth?.user?.permissions?.includes('product.view') || ['SUPER_ADMIN', 'ADMIN', 'SALESMAN', 'WAREHOUSE_MANAGER'].includes(auth?.user?.role || '');
    const hasTaxManage = auth?.user?.permissions?.includes('product.tax.update') || ['SUPER_ADMIN', 'ADMIN'].includes(auth?.user?.role || '');
    const hasOrderCreate = auth?.user?.permissions?.includes('order.create') || ['SUPER_ADMIN', 'ADMIN', 'SALESMAN'].includes(auth?.user?.role || '');
    const hasOrderView = auth?.user?.permissions?.includes('order.view') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SALESMAN'].includes(auth?.user?.role || '');
    const hasAdminOrderQueue = (hasOrderView && ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(auth?.user?.role || '')) || false;
    const hasAdjustReview = auth?.user?.permissions?.includes('order.adjust.review') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(auth?.user?.role || '');
    const hasPaymentVerify = (auth?.user?.permissions?.includes('payment.verify') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(auth?.user?.role || '')) && auth?.user?.role !== 'SALESMAN';
    const hasCreditView = (auth?.user?.permissions?.includes('credit.create') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(auth?.user?.role || '')) && !['SALESMAN', 'DELIVERY_PARTNER', 'WAREHOUSE_MANAGER'].includes(auth?.user?.role || '');
    const hasPaymentView = auth?.user?.permissions?.includes('payment.view') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SALESMAN'].includes(auth?.user?.role || '');
    const hasReturnReview = auth?.user?.permissions?.includes('return.review') || ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'ACCOUNTANT'].includes(auth?.user?.role || '');
    const hasReturnRequest = auth?.user?.permissions?.includes('return.request') || ['SUPER_ADMIN', 'ADMIN', 'SALESMAN'].includes(auth?.user?.role || '');
    const hasReceivableView = auth?.user?.permissions?.includes('receivable.view') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SALESMAN'].includes(auth?.user?.role || '');
    const hasPayableView = auth?.user?.permissions?.includes('payable.view') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(auth?.user?.role || '');
    const hasAccountingView = auth?.user?.permissions?.includes('accounting.view') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(auth?.user?.role || '');
    const hasInventoryView = auth?.user?.permissions?.includes('inventory.view') || ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'].includes(auth?.user?.role || '');
    const hasDeliveryView = auth?.user?.permissions?.includes('delivery.view') || ['SUPER_ADMIN', 'ADMIN', 'DELIVERY_PARTNER', 'WAREHOUSE_MANAGER'].includes(auth?.user?.role || '');
    const hasInvoiceView = auth?.user?.permissions?.includes('invoice.view') || ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SALESMAN'].includes(auth?.user?.role || '');
    const invoiceUrl = auth?.user?.role === 'SALESMAN' ? '/salesman/invoices' : '/admin/invoices';
    const hasReportingAccess = (hasOrderView || hasCustomerView || hasInventoryView || hasDeliveryView || hasAccountingView || hasUserView) && !['SALESMAN', 'DELIVERY_PARTNER'].includes(auth?.user?.role || '');
    const hasAuditView = auth?.user?.permissions?.includes('audit.view') || ['SUPER_ADMIN', 'ADMIN'].includes(auth?.user?.role || '');
    const hasSecurityView = auth?.user?.permissions?.includes('audit.security.view') || ['SUPER_ADMIN', 'ADMIN'].includes(auth?.user?.role || '');

    const isLinkActive = (path: string) => {
        if (path === '/dashboard' && (currentUrl === '/dashboard' || currentUrl === '/')) return true;
        if (path === currentUrl) return true;
        // Sibling exclusion: /notifications must NOT match when visiting /notifications/preferences
        if (path === '/notifications' && currentUrl.startsWith('/notifications/preferences')) return false;
        // Prefix matching with trailing slash for nested details (e.g. /customers/1)
        if (path !== '/dashboard' && path !== '/' && currentUrl.startsWith(`${path}/`)) return true;
        return false;
    };

    const renderNavLink = (href: string, icon: React.ReactNode, label: string) => {
        const active = isLinkActive(href);
        return (
            <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? label : undefined}
                className={`group flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                    active
                        ? 'bg-brand-surface text-brand-surface-foreground font-semibold shadow-xs'
                        : 'text-brand-muted hover:bg-brand-hover hover:text-brand-foreground'
                } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
            >
                <div className={`shrink-0 transition-transform group-hover:scale-105 ${active ? 'text-action-accent' : 'text-brand-muted group-hover:text-brand-foreground'}`}>
                    {icon}
                </div>
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </Link>
        );
    };


    // Keyboard shortcut for sidebar toggle (Ctrl+B / Cmd+B)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleSidebarCollapse();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sidebarCollapsed]);

    // Nav Groups and Items definitions
    interface NavItem {
        href: string;
        label: string;
        icon: React.ReactNode;
        show: boolean;
    }

    interface NavGroup {
        id: string;
        title: string;
        icon: React.ReactNode;
        show: boolean;
        items: NavItem[];
    }

    const navGroups: NavGroup[] = [
        {
            id: 'sales_ops',
            title: 'Sales & Operations',
            icon: <Layers className="h-4 w-4" />,
            show: Boolean(hasOrderView || hasOrderCreate || hasAdjustReview || hasReturnReview || hasInvoiceView),
            items: [
                { href: '/admin/orders', label: 'Order Processing', icon: <Layers className="h-3.5 w-3.5" />, show: Boolean(hasAdminOrderQueue) },
                { href: '/salesman/orders', label: 'Sales Order History', icon: <Receipt className="h-3.5 w-3.5" />, show: Boolean(auth?.user?.role === 'SALESMAN') },
                { href: '/salesman/orders/create', label: 'New Sales Order', icon: <PlusCircle className="h-3.5 w-3.5" />, show: Boolean(hasOrderCreate) },
                { href: '/admin/adjustments', label: 'Order Adjustments', icon: <SlidersHorizontal className="h-3.5 w-3.5" />, show: Boolean(hasAdjustReview) },
                { href: '/admin/returns', label: 'Reverse Logistics', icon: <RotateCcw className="h-3.5 w-3.5" />, show: Boolean(hasReturnReview) },
                { href: invoiceUrl, label: 'Invoices & Billing', icon: <FileText className="h-3.5 w-3.5" />, show: Boolean(hasInvoiceView) },
            ]
        },
        {
            id: 'customers',
            title: 'Customer Accounts',
            icon: <Users className="h-4 w-4" />,
            show: Boolean(hasCustomerView),
            items: [
                { href: '/customers', label: 'Customer Master', icon: <Users className="h-3.5 w-3.5" />, show: true },
                { href: '/customers/create', label: 'Onboard Customer', icon: <PlusCircle className="h-3.5 w-3.5" />, show: Boolean(hasCustomerCreate) },
            ]
        },
        {
            id: 'products',
            title: 'Product Master',
            icon: <Package className="h-4 w-4" />,
            show: Boolean(hasProductView),
            items: [
                { href: '/products', label: 'Product Catalog', icon: <Package className="h-3.5 w-3.5" />, show: true },
                { href: '/categories', label: 'Categories', icon: <FolderTree className="h-3.5 w-3.5" />, show: true },
                { href: '/tax-profiles', label: 'Tax Profiles', icon: <Receipt className="h-3.5 w-3.5" />, show: Boolean(hasTaxManage) },
            ]
        },
        {
            id: 'inventory',
            title: 'Warehouse Inventory',
            icon: <Boxes className="h-4 w-4" />,
            show: Boolean(hasInventoryView),
            items: [
                { href: '/admin/inventory', label: 'Stock Balances', icon: <Boxes className="h-3.5 w-3.5" />, show: true },
                { href: '/admin/inventory-exceptions', label: 'Stock Exceptions', icon: <ShieldAlert className="h-3.5 w-3.5" />, show: true },
            ]
        },
        {
            id: 'payments',
            title: 'Payments & Subledgers',
            icon: <CreditCard className="h-4 w-4" />,
            show: Boolean(hasPaymentVerify || hasCreditView || hasReceivableView || hasPayableView),
            items: [
                { href: '/admin/payments', label: 'Payment Verification', icon: <CreditCard className="h-3.5 w-3.5" />, show: Boolean(hasPaymentVerify) },
                { href: '/admin/credits', label: 'Credit Notes', icon: <Receipt className="h-3.5 w-3.5" />, show: Boolean(hasCreditView) },
                { href: '/admin/receivables', label: 'Accounts Receivable', icon: <TrendingUp className="h-3.5 w-3.5" />, show: Boolean(hasReceivableView) },
                { href: '/admin/payables', label: 'Accounts Payable', icon: <Scale className="h-3.5 w-3.5" />, show: Boolean(hasPayableView) },
            ]
        },
        {
            id: 'accounting',
            title: 'Financial Accounting',
            icon: <BookOpen className="h-4 w-4" />,
            show: Boolean(hasAccountingView),
            items: [
                { href: '/admin/accounting/general-ledger', label: 'General Ledger', icon: <BookOpen className="h-3.5 w-3.5" />, show: true },
                { href: '/admin/accounting/trial-balance', label: 'Trial Balance', icon: <Scale className="h-3.5 w-3.5" />, show: true },
                { href: '/admin/accounting/profit-loss', label: 'Profit & Loss', icon: <TrendingUp className="h-3.5 w-3.5" />, show: true },
                { href: '/admin/accounting/balance-sheet', label: 'Balance Sheet', icon: <Landmark className="h-3.5 w-3.5" />, show: true },
                { href: '/admin/accounting/reconciliation', label: 'Cash Reconciliation', icon: <FileCheck className="h-3.5 w-3.5" />, show: true },
                { href: '/admin/accounting/accounts', label: 'Chart of Accounts', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, show: true },
            ]
        },
        {
            id: 'reports',
            title: 'Analytics & Reports',
            icon: <BarChart3 className="h-4 w-4" />,
            show: Boolean(hasReportingAccess),
            items: [
                { href: '/admin/reports/sales', label: 'Sales Analysis', icon: <BarChart3 className="h-3.5 w-3.5" />, show: Boolean(hasOrderView) },
                { href: '/admin/reports/customers', label: 'Customer Reports', icon: <Users className="h-3.5 w-3.5" />, show: Boolean(hasCustomerView) },
                { href: '/admin/reports/salesmen', label: 'Sales Rep Performance', icon: <TrendingUp className="h-3.5 w-3.5" />, show: Boolean(hasOrderView || hasUserView) },
                { href: '/admin/reports/inventory', label: 'Inventory Analytics', icon: <Boxes className="h-3.5 w-3.5" />, show: Boolean(hasInventoryView) },
                { href: '/admin/reports/delivery', label: 'Delivery Performance', icon: <Truck className="h-3.5 w-3.5" />, show: Boolean(hasDeliveryView) },
                { href: '/admin/reports/financial', label: 'Financial Reports', icon: <Landmark className="h-3.5 w-3.5" />, show: Boolean(hasAccountingView) },
            ]
        },
        {
            id: 'governance',
            title: 'Audit & Governance',
            icon: <ShieldCheck className="h-4 w-4" />,
            show: Boolean(hasAuditView || hasSecurityView),
            items: [
                { href: '/admin/audit/timeline', label: 'Activity Timeline', icon: <History className="h-3.5 w-3.5" />, show: Boolean(hasAuditView) },
                { href: '/admin/audit/security', label: 'Security Logs', icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />, show: Boolean(hasSecurityView) },
            ]
        },
        {
            id: 'admin',
            title: 'Administration',
            icon: <Settings className="h-4 w-4" />,
            show: Boolean(hasUserView || hasRoleManage),
            items: [
                { href: '/salesmen', label: 'Staff & Sales Reps', icon: <Users className="h-3.5 w-3.5" />, show: Boolean(hasUserView) },
                { href: '/security/roles', label: 'Role Governance', icon: <KeyRound className="h-3.5 w-3.5" />, show: Boolean(hasRoleManage) },
                { href: '/system/company', label: 'Company Information', icon: <Building2 className="h-3.5 w-3.5" />, show: Boolean(hasRoleManage) },
            ]
        },
        {
            id: 'profile',
            title: 'My Profile & Security',
            icon: <UserIcon className="h-4 w-4" />,
            show: Boolean(auth?.user),
            items: [
                { href: '/notifications', label: 'Notification Center', icon: <Bell className="h-3.5 w-3.5" />, show: true },
                { href: '/notifications/preferences', label: 'Alert Preferences', icon: <Settings className="h-3.5 w-3.5" />, show: true },
                { href: '/security/mfa', label: 'Two-Factor Auth', icon: <Shield className="h-3.5 w-3.5" />, show: true },
                { href: '/security/sessions', label: 'Active Sessions', icon: <KeyRound className="h-3.5 w-3.5" />, show: true },
            ]
        }
    ];

    // Nested group expansion state with localStorage persistence
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('app_sidebar_expanded_groups');
                if (saved) return JSON.parse(saved);
            } catch {
                // fallback
            }
        }
        return {};
    });

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = { ...prev, [groupId]: !prev[groupId] };
            if (typeof window !== 'undefined') {
                localStorage.setItem('app_sidebar_expanded_groups', JSON.stringify(next));
            }
            return next;
        });
    };

    // Auto-expand any group that contains the current active route
    useEffect(() => {
        const toOpen: Record<string, boolean> = {};
        let shouldUpdate = false;
        navGroups.forEach(group => {
            if (group.show && group.items.some(item => item.show && isLinkActive(item.href))) {
                if (!expandedGroups[group.id]) {
                    toOpen[group.id] = true;
                    shouldUpdate = true;
                }
            }
        });
        if (shouldUpdate) {
            setExpandedGroups(prev => {
                const next = { ...prev, ...toOpen };
                if (typeof window !== 'undefined') {
                    localStorage.setItem('app_sidebar_expanded_groups', JSON.stringify(next));
                }
                return next;
            });
        }
    }, [currentUrl]);

    // Collapsed rail hover flyout state
    const [flyoutState, setFlyoutState] = useState<{
        groupId: string;
        top: number;
        group: NavGroup;
    } | null>(null);
    const flyoutTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleGroupMouseEnter = (e: React.MouseEvent<HTMLElement>, group: NavGroup) => {
        if (!sidebarCollapsed) return;
        if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
        const rect = e.currentTarget.getBoundingClientRect();
        const top = Math.min(rect.top, window.innerHeight - 280);
        setFlyoutState({
            groupId: group.id,
            top: Math.max(10, top),
            group,
        });
    };

    const handleGroupMouseLeave = () => {
        if (!sidebarCollapsed) return;
        flyoutTimerRef.current = setTimeout(() => {
            setFlyoutState(null);
        }, 150);
    };

    const handleFlyoutMouseEnter = () => {
        if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
    };

    const handleFlyoutMouseLeave = () => {
        setFlyoutState(null);
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-150"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div className="flex flex-1 w-full min-w-0">
                {/* Sidebar Navigation */}
                <aside
                    className={`fixed inset-y-0 left-0 z-50 border-r border-brand-border bg-brand text-brand-foreground flex flex-col transition-all duration-200 ease-in-out lg:static lg:translate-x-0 ${
                        sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
                    } ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
                >
                    {/* Brand header */}
                    <div className="h-16 flex items-center justify-between px-4 border-b border-brand-border bg-brand">
                        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-action-accent text-white font-semibold text-sm tracking-tight shadow-neu">
                                {initials}
                            </div>
                            {!sidebarCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-xs leading-tight truncate text-brand-foreground">
                                        {displayName}
                                    </span>
                                    <span className="text-[10px] text-brand-muted font-mono truncate">
                                        {displayCompany}
                                    </span>
                                </div>
                            )}
                        </Link>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden rounded-lg p-1.5 text-brand-muted hover:bg-brand-hover hover:text-brand-foreground cursor-pointer"
                            aria-label="Close navigation"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-3 scrollbar-thin">
                        {/* Main Hub */}
                        <div className="space-y-1">
                            {renderNavLink('/dashboard', <Home className="h-4 w-4" />, 'Overview Dashboard')}
                        </div>

                        {/* Collapsed Rail View (Icons with hover flyouts) */}
                        {sidebarCollapsed ? (
                            <div className="space-y-2 pt-2 border-t border-brand-border/60">
                                {navGroups.filter(g => g.show).map(group => {
                                    const visibleItems = group.items.filter(i => i.show);
                                    if (visibleItems.length === 0) return null;
                                    const hasActiveChild = visibleItems.some(i => isLinkActive(i.href));

                                    return (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onMouseEnter={(e) => handleGroupMouseEnter(e, group)}
                                            onMouseLeave={handleGroupMouseLeave}
                                            onClick={() => {
                                                setSidebarCollapsed(false);
                                                if (typeof window !== 'undefined') {
                                                    localStorage.setItem('app_sidebar_collapsed', 'false');
                                                }
                                                setExpandedGroups(prev => ({ ...prev, [group.id]: true }));
                                            }}
                                            title={group.title}
                                            className={`group relative flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-150 cursor-pointer ${
                                                hasActiveChild
                                                    ? 'bg-brand-surface text-brand-surface-foreground shadow-xs'
                                                    : 'text-brand-muted hover:bg-brand-hover hover:text-brand-foreground'
                                            }`}
                                        >
                                            <div className={`shrink-0 transition-transform group-hover:scale-110 ${hasActiveChild ? 'text-action-accent' : 'text-brand-muted group-hover:text-brand-foreground'}`}>
                                                {group.icon}
                                            </div>
                                            {hasActiveChild && (
                                                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-action-accent ring-2 ring-brand" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Expanded View (Accordion Hierarchical Groups) */
                            <div className="space-y-3 pt-2 border-t border-brand-border/60">
                                {navGroups.filter(g => g.show).map(group => {
                                    const visibleItems = group.items.filter(i => i.show);
                                    if (visibleItems.length === 0) return null;
                                    const isExpanded = expandedGroups[group.id] ?? false;
                                    const hasActiveChild = visibleItems.some(i => isLinkActive(i.href));

                                    return (
                                        <div key={group.id} className="space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(group.id)}
                                                aria-expanded={isExpanded}
                                                className={`w-full group flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                                                    hasActiveChild
                                                        ? 'text-white bg-white/5'
                                                        : 'text-brand-muted hover:bg-brand-hover hover:text-brand-foreground'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={`shrink-0 transition-transform group-hover:scale-105 ${hasActiveChild ? 'text-action-accent' : 'text-brand-muted group-hover:text-brand-foreground'}`}>
                                                        {group.icon}
                                                    </div>
                                                    <span className="truncate tracking-tight font-medium text-[12px]">{group.title}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                    {hasActiveChild && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-action-accent" />
                                                    )}
                                                    <ChevronDown
                                                        className={`h-3.5 w-3.5 text-brand-muted transition-transform duration-200 ${
                                                            isExpanded ? 'rotate-0 text-white' : '-rotate-90'
                                                        }`}
                                                    />
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="ml-4 pl-3.5 border-l border-white/10 space-y-0.5 pt-0.5 pb-1">
                                                    {visibleItems.map(item => renderNavLink(item.href, item.icon, item.label))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Flyout Menu for Collapsed Rail (Immune to clipping via position: fixed) */}
                    {sidebarCollapsed && flyoutState && (
                        <div
                            className="fixed z-50 left-16 ml-1 w-56 rounded-xl border border-brand-border bg-brand text-brand-foreground shadow-2xl p-2 animate-in fade-in-50 zoom-in-95 duration-100"
                            style={{ top: `${flyoutState.top}px` }}
                            onMouseEnter={handleFlyoutMouseEnter}
                            onMouseLeave={handleFlyoutMouseLeave}
                        >
                            <div className="px-2.5 py-1.5 mb-1 border-b border-brand-border/60">
                                <div className="flex items-center gap-2">
                                    <div className="text-action-accent">{flyoutState.group.icon}</div>
                                    <span className="text-xs font-semibold text-white truncate">
                                        {flyoutState.group.title}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                {flyoutState.group.items.filter(i => i.show).map(item => {
                                    const active = isLinkActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => {
                                                setFlyoutState(null);
                                                setSidebarOpen(false);
                                            }}
                                            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                active
                                                    ? 'bg-brand-surface text-brand-surface-foreground font-semibold'
                                                    : 'text-brand-muted hover:bg-brand-hover hover:text-brand-foreground'
                                            }`}
                                        >
                                            <div className={`shrink-0 ${active ? 'text-action-accent' : 'text-brand-muted'}`}>
                                                {item.icon}
                                            </div>
                                            <span className="truncate">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sidebar Footer with Collapse Toggle */}
                    <div className="p-3 border-t border-white/6 bg-dark-canvas/50 flex items-center justify-between text-xs">
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse glow-cyan-subtle" />
                                <span className="text-slate-300">Platform Operational</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={toggleSidebarCollapse}
                            title={sidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
                            className={`hidden lg:flex items-center justify-center p-1.5 rounded-xl border border-white/10 bg-dark-surface-elevated hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer ${
                                sidebarCollapsed ? 'mx-auto' : ''
                            }`}
                        >
                            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden bg-dark-canvas">
                    {/* Top App Header */}
                    <header className="h-16 border-b border-white/7 glass-header-dark px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-neu-dark">
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden rounded-xl p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
                                aria-label="Open navigation"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={toggleSidebarCollapse}
                                className="hidden lg:flex rounded-xl p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                                title={sidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
                                aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                            >
                                {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                            </button>
                            
                            <div className="flex flex-col min-w-0">
                                {breadcrumbs && breadcrumbs.length > 0 && (
                                    <nav className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                                        {breadcrumbs.map((b, idx) => (
                                            <React.Fragment key={idx}>
                                                {idx > 0 && <span className="opacity-40">/</span>}
                                                {b.href ? (
                                                    <Link href={b.href} className="hover:text-cyan-300 transition-colors truncate max-w-[150px]">
                                                        {b.label}
                                                    </Link>
                                                ) : (
                                                    <span className="text-slate-300 truncate max-w-[150px]">{b.label}</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </nav>
                                )}
                                <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate font-sans">
                                    {title || 'Executive Command Center'}
                                </h1>
                            </div>
                        </div>

                        {/* Top Header Actions */}
                        <div className="flex items-center gap-3">
                            {auth?.user && <NotificationBell />}

                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-dark-surface-elevated font-mono text-[10px] text-slate-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span>SYSTEM: ACTIVE</span>
                            </div>

                            {/* User Profile Dropdown / Trigger */}
                            {auth?.user && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 focus:outline-hidden focus:ring-2 focus:ring-action-accent transition-all cursor-pointer"
                                        aria-expanded={userMenuOpen}
                                    >
                                        <div className="h-8 w-8 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center border border-cyan-500/40 shadow-neu-dark glow-cyan-subtle hover:border-cyan-400">
                                            {auth.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                                        </div>
                                    </button>

                                    {userMenuOpen && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-40" 
                                                onClick={() => setUserMenuOpen(false)} 
                                            />
                                            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-50 p-2 text-xs divide-y divide-border animate-in fade-in-50 zoom-in-95 duration-100">
                                                <div className="px-3 py-2 pb-2.5">
                                                    <p className="font-semibold text-foreground truncate">{auth.user.name}</p>
                                                    <p className="text-[11px] text-muted-foreground truncate">{auth.user.email}</p>
                                                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] font-medium">
                                                        {auth.user.role}
                                                    </span>
                                                </div>

                                                <div className="py-1 space-y-0.5">
                                                    <Link
                                                        href="/security/mfa"
                                                        onClick={() => setUserMenuOpen(false)}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        <Shield className="h-3.5 w-3.5" />
                                                        Two-Factor Auth
                                                    </Link>
                                                    <Link
                                                        href="/security/sessions"
                                                        onClick={() => setUserMenuOpen(false)}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        <KeyRound className="h-3.5 w-3.5" />
                                                        Active Sessions
                                                    </Link>
                                                    <Link
                                                        href="/notifications/preferences"
                                                        onClick={() => setUserMenuOpen(false)}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        <Settings className="h-3.5 w-3.5" />
                                                        Notification Preferences
                                                    </Link>
                                                </div>

                                                <div className="pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setUserMenuOpen(false);
                                                            handleLogout();
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-medium cursor-pointer"
                                                    >
                                                        <LogOut className="h-3.5 w-3.5" />
                                                        Sign Out
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </header>

                    {/* Flash Message Banners */}
                    {flash?.success && (
                        <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{flash.success}</span>
                        </div>
                    )}
                    {flash?.error && (
                        <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
                            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>{flash.error}</span>
                        </div>
                    )}

                    {/* Page Content */}
                    <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 min-w-0">
                        <div className="max-w-7xl mx-auto w-full min-w-0">
                            {children}
                        </div>
                    </main>

                    {/* Subdued Footer */}
                    <footer className="border-t border-border py-3 px-4 sm:px-6 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 bg-card/40">
                        <div className="font-mono text-[11px]">
                            {identity?.footer_text || displayName} &bull; Enterprise Distribution Platform
                        </div>
                        <div className="flex items-center gap-4 text-[11px]">
                            <span>Tailwind CSS 4</span>
                            <span>&bull;</span>
                            <span>shadcn/ui Foundation</span>
                            <span>&bull;</span>
                            <span>Inertia 3</span>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}
