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
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname : '';

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
        return currentUrl === path || (path !== '/dashboard' && path !== '/' && currentUrl.startsWith(path));
    };

    const renderNavLink = (href: string, icon: React.ReactNode, label: string) => {
        const active = isLinkActive(href);
        return (
            <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? label : undefined}
                className={`group flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                    active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
            >
                <div className={`shrink-0 transition-transform group-hover:scale-105 ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {icon}
                </div>
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </Link>
        );
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
                    className={`fixed inset-y-0 left-0 z-50 border-r border-border bg-card flex flex-col transition-all duration-200 ease-in-out lg:static lg:translate-x-0 ${
                        sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
                    } ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
                >
                    {/* Brand header */}
                    <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-card">
                        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm tracking-tight shadow-xs">
                                {initials}
                            </div>
                            {!sidebarCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-xs leading-tight truncate text-foreground">
                                        {displayName}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                                        {displayCompany}
                                    </span>
                                </div>
                            )}
                        </Link>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                            aria-label="Close navigation"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5 scrollbar-thin">
                        {/* Main Hub */}
                        <div className="space-y-1">
                            {renderNavLink('/dashboard', <Home className="h-4 w-4" />, 'Overview Dashboard')}
                        </div>

                        {/* Sales & Orders */}
                        {(hasOrderView || hasOrderCreate || hasAdjustReview || hasReturnReview || hasInvoiceView) && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Sales & Operations
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {hasAdminOrderQueue && renderNavLink('/admin/orders', <Layers className="h-4 w-4" />, 'Order Processing')}
                                    {auth?.user?.role === 'SALESMAN' && renderNavLink('/salesman/orders', <Receipt className="h-4 w-4" />, 'Sales Order History')}
                                    {hasAdjustReview && renderNavLink('/admin/adjustments', <SlidersHorizontal className="h-4 w-4" />, 'Order Adjustments')}
                                    {hasReturnReview && renderNavLink('/admin/returns', <RotateCcw className="h-4 w-4" />, 'Reverse Logistics')}
                                    {hasOrderCreate && renderNavLink('/salesman/orders/create', <PlusCircle className="h-4 w-4" />, 'New Sales Order')}
                                    {hasInvoiceView && renderNavLink(invoiceUrl, <FileText className="h-4 w-4" />, 'Invoices & Billing')}
                                </nav>
                            </div>
                        )}

                        {/* Customers */}
                        {hasCustomerView && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Customer Accounts
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {renderNavLink('/customers', <Users className="h-4 w-4" />, 'Customer Master')}
                                    {hasCustomerCreate && renderNavLink('/customers/create', <PlusCircle className="h-4 w-4" />, 'Onboard Customer')}
                                </nav>
                            </div>
                        )}

                        {/* Products & Pricing */}
                        {hasProductView && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Product Master
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {renderNavLink('/products', <Package className="h-4 w-4" />, 'Product Catalog')}
                                    {renderNavLink('/categories', <FolderTree className="h-4 w-4" />, 'Categories')}
                                    {hasTaxManage && renderNavLink('/tax-profiles', <Receipt className="h-4 w-4" />, 'Tax Profiles')}
                                </nav>
                            </div>
                        )}

                        {/* Warehouse & Inventory */}
                        {hasInventoryView && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Warehouse Inventory
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {renderNavLink('/admin/inventory', <Boxes className="h-4 w-4" />, 'Stock Balances')}
                                    {renderNavLink('/admin/inventory-exceptions', <ShieldAlert className="h-4 w-4" />, 'Stock Exceptions')}
                                </nav>
                            </div>
                        )}

                        {/* Payments & Subledgers */}
                        {(hasPaymentVerify || hasCreditView || hasReceivableView || hasPayableView) && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Payments & Subledgers
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {hasPaymentVerify && renderNavLink('/admin/payments', <CreditCard className="h-4 w-4" />, 'Payment Verification')}
                                    {hasCreditView && renderNavLink('/admin/credits', <Receipt className="h-4 w-4" />, 'Credit Notes')}
                                    {hasReceivableView && renderNavLink('/admin/receivables', <TrendingUp className="h-4 w-4" />, 'Accounts Receivable')}
                                    {hasPayableView && renderNavLink('/admin/payables', <Scale className="h-4 w-4" />, 'Accounts Payable')}
                                </nav>
                            </div>
                        )}

                        {/* General Ledger Accounting */}
                        {hasAccountingView && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Financial Accounting
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {renderNavLink('/admin/accounting/general-ledger', <BookOpen className="h-4 w-4" />, 'General Ledger')}
                                    {renderNavLink('/admin/accounting/trial-balance', <Scale className="h-4 w-4" />, 'Trial Balance')}
                                    {renderNavLink('/admin/accounting/profit-loss', <TrendingUp className="h-4 w-4" />, 'Profit & Loss')}
                                    {renderNavLink('/admin/accounting/balance-sheet', <Landmark className="h-4 w-4" />, 'Balance Sheet')}
                                    {renderNavLink('/admin/accounting/reconciliation', <FileCheck className="h-4 w-4" />, 'Cash Reconciliation')}
                                    {renderNavLink('/admin/accounting/accounts', <FileSpreadsheet className="h-4 w-4" />, 'Chart of Accounts')}
                                </nav>
                            </div>
                        )}

                        {/* Reports & Analytics */}
                        {hasReportingAccess && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Analytics & Reports
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {hasOrderView && renderNavLink('/admin/reports/sales', <BarChart3 className="h-4 w-4" />, 'Sales Analysis')}
                                    {hasCustomerView && renderNavLink('/admin/reports/customers', <Users className="h-4 w-4" />, 'Customer Reports')}
                                    {(hasOrderView || hasUserView) && renderNavLink('/admin/reports/salesmen', <TrendingUp className="h-4 w-4" />, 'Sales Rep Performance')}
                                    {hasInventoryView && renderNavLink('/admin/reports/inventory', <Boxes className="h-4 w-4" />, 'Inventory Analytics')}
                                    {hasDeliveryView && renderNavLink('/admin/reports/delivery', <Truck className="h-4 w-4" />, 'Delivery Performance')}
                                    {hasAccountingView && renderNavLink('/admin/reports/financial', <Landmark className="h-4 w-4" />, 'Financial Reports')}
                                </nav>
                            </div>
                        )}

                        {/* Audit & Security */}
                        {(hasAuditView || hasSecurityView) && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Audit & Governance
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {hasAuditView && renderNavLink('/admin/audit/timeline', <History className="h-4 w-4" />, 'Activity Timeline')}
                                    {hasSecurityView && renderNavLink('/admin/audit/security', <ShieldAlert className="h-4 w-4 text-rose-500" />, 'Security Logs')}
                                </nav>
                            </div>
                        )}

                        {/* System Administration */}
                        {(hasUserView || hasRoleManage) && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        Administration
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {hasUserView && renderNavLink('/salesmen', <Users className="h-4 w-4" />, 'Staff & Sales Reps')}
                                    {hasRoleManage && renderNavLink('/security/roles', <KeyRound className="h-4 w-4" />, 'Role Governance')}
                                    {hasRoleManage && renderNavLink('/system/company', <Building2 className="h-4 w-4" />, 'Company Information')}
                                </nav>
                            </div>
                        )}

                        {/* User Security & Preferences */}
                        {auth?.user && (
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                                        My Profile & Security
                                    </div>
                                )}
                                <nav className="space-y-0.5">
                                    {renderNavLink('/notifications', <Bell className="h-4 w-4" />, 'Notification Center')}
                                    {renderNavLink('/notifications/preferences', <Settings className="h-4 w-4" />, 'Alert Preferences')}
                                    {renderNavLink('/security/mfa', <Shield className="h-4 w-4" />, 'Two-Factor Auth')}
                                    {renderNavLink('/security/sessions', <KeyRound className="h-4 w-4" />, 'Active Sessions')}
                                </nav>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Footer with Collapse Toggle */}
                    <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs">
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Platform Operational</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={toggleSidebarCollapse}
                            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                            className={`hidden lg:flex items-center justify-center p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${
                                sidebarCollapsed ? 'mx-auto' : ''
                            }`}
                        >
                            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                    {/* Top App Header */}
                    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label="Open navigation"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            
                            <div className="flex flex-col min-w-0">
                                {breadcrumbs && breadcrumbs.length > 0 && (
                                    <nav className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                                        {breadcrumbs.map((b, idx) => (
                                            <React.Fragment key={idx}>
                                                {idx > 0 && <span className="opacity-50">/</span>}
                                                {b.href ? (
                                                    <Link href={b.href} className="hover:text-foreground truncate max-w-[150px]">
                                                        {b.label}
                                                    </Link>
                                                ) : (
                                                    <span className="text-foreground truncate max-w-[150px]">{b.label}</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </nav>
                                )}
                                <h1 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate">
                                    {title || 'Command Center'}
                                </h1>
                            </div>
                        </div>

                        {/* Top Header Actions */}
                        <div className="flex items-center gap-3">
                            {auth?.user && <NotificationBell />}

                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary/50 font-mono text-[10px] text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>ENV: local</span>
                            </div>

                            {/* User Profile Dropdown / Trigger */}
                            {auth?.user && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2 p-1 rounded-full hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary transition-colors cursor-pointer"
                                        aria-expanded={userMenuOpen}
                                    >
                                        <div className="h-8 w-8 rounded-full bg-primary/20 text-primary font-semibold text-xs flex items-center justify-center border border-primary/30">
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
