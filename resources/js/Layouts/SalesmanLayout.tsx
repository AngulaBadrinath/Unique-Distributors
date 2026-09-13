import React, { useState } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { PageProps } from '@/types';
import { 
    Home, 
    Users, 
    PlusCircle, 
    ShoppingBag, 
    Package, 
    LogOut, 
    User as UserIcon, 
    ChevronLeft, 
    CheckCircle2, 
    AlertCircle, 
    Settings,
    FileText,
    Menu,
    X,
    TrendingUp
} from 'lucide-react';
import NotificationBell from '@/Components/Notifications/NotificationBell';

interface SalesmanLayoutProps {
    children: React.ReactNode;
    title?: string;
    showBackButton?: boolean;
    backUrl?: string;
}

export default function SalesmanLayout({ 
    children, 
    title = 'Sales Workspace',
    showBackButton = false,
    backUrl = '/dashboard'
}: SalesmanLayoutProps) {
    const { identity, company, auth, flash } = usePage<PageProps>().props;
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname : '';

    const handleLogout = () => {
        router.post('/logout');
    };

    const isLinkActive = (path: string) => {
        if (path === '/dashboard' && (currentUrl === '/dashboard' || currentUrl === '/')) return true;
        return currentUrl === path || (path !== '/dashboard' && path !== '/' && currentUrl.startsWith(path));
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary/20 selection:text-primary pb-20 sm:pb-0">
            {/* Top Fixed Header */}
            <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                    {showBackButton ? (
                        <Link
                            href={backUrl}
                            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            aria-label="Go back"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    ) : (
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs">
                                SW
                            </div>
                            <div className="hidden sm:block">
                                <span className="font-semibold text-xs text-foreground block leading-tight">Sales Workspace</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{company?.display_name || identity?.company_name || 'Wholesale Portal'}</span>
                            </div>
                        </Link>
                    )}

                    <h1 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate max-w-[200px] sm:max-w-xs">
                        {title}
                    </h1>
                </div>

                {/* Desktop Nav Links */}
                <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
                    <Link
                        href="/dashboard"
                        className={`px-3 py-1.5 rounded-lg transition-colors ${
                            isLinkActive('/dashboard') ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        Home
                    </Link>
                    <Link
                        href="/customers"
                        className={`px-3 py-1.5 rounded-lg transition-colors ${
                            isLinkActive('/customers') ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        My Customers
                    </Link>
                    <Link
                        href="/orders"
                        className={`px-3 py-1.5 rounded-lg transition-colors ${
                            isLinkActive('/orders') ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        Order History
                    </Link>
                    <Link
                        href="/products"
                        className={`px-3 py-1.5 rounded-lg transition-colors ${
                            isLinkActive('/products') ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        Catalogue
                    </Link>
                </nav>

                <div className="flex items-center gap-2.5">
                    {/* Primary New Order CTA on desktop */}
                    <Link
                        href="/orders/create"
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                    >
                        <PlusCircle className="h-4 w-4" />
                        <span>New Order</span>
                    </Link>

                    {auth?.user && <NotificationBell />}

                    {/* User Menu */}
                    {auth?.user && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary transition-colors cursor-pointer"
                                aria-label="User profile menu"
                            >
                                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary font-semibold text-xs flex items-center justify-center border border-primary/30">
                                    {auth.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                            </button>

                            {userMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-card shadow-xl z-50 p-2 text-xs divide-y divide-border animate-in fade-in-50 zoom-in-95 duration-100">
                                        <div className="px-3 py-2 pb-2.5">
                                            <p className="font-semibold text-foreground truncate">{auth.user.name}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">{auth.user.email}</p>
                                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] font-medium">
                                                Sales Representative
                                            </span>
                                        </div>
                                        <div className="py-1 space-y-0.5">
                                            <Link
                                                href="/notifications/preferences"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <Settings className="h-3.5 w-3.5" />
                                                Alert Preferences
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

            {/* Flash Alerts */}
            {flash?.success && (
                <div className="max-w-4xl mx-auto w-full px-4 mt-3">
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{flash.success}</span>
                    </div>
                </div>
            )}
            {flash?.error && (
                <div className="max-w-4xl mx-auto w-full px-4 mt-3">
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>{flash.error}</span>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                {children}
            </main>

            {/* Mobile Bottom Navigation Bar (Fixed for thumb reachability, >=44px touch targets) */}
            <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-2 py-1.5 sm:hidden shadow-lg">
                <div className="grid grid-cols-5 gap-1 items-center">
                    {/* Home */}
                    <Link
                        href="/dashboard"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[10px] font-medium transition-all ${
                            isLinkActive('/dashboard') ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Home className="h-5 w-5 mb-0.5" />
                        <span>Home</span>
                    </Link>

                    {/* Customers */}
                    <Link
                        href="/customers"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[10px] font-medium transition-all ${
                            isLinkActive('/customers') ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Users className="h-5 w-5 mb-0.5" />
                        <span>Customers</span>
                    </Link>

                    {/* Prominent New Order Center Action */}
                    <div className="flex items-center justify-center -mt-4">
                        <Link
                            href="/orders/create"
                            className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform"
                            aria-label="Create New Sales Order"
                        >
                            <PlusCircle className="h-6 w-6" />
                        </Link>
                    </div>

                    {/* Orders */}
                    <Link
                        href="/orders"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[10px] font-medium transition-all ${
                            isLinkActive('/orders') ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <ShoppingBag className="h-5 w-5 mb-0.5" />
                        <span>Orders</span>
                    </Link>

                    {/* Catalogue */}
                    <Link
                        href="/products"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[10px] font-medium transition-all ${
                            isLinkActive('/products') ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Package className="h-5 w-5 mb-0.5" />
                        <span>Catalog</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
