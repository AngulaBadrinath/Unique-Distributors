import React from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { PageProps } from '@/types';
import { 
    Truck, 
    Navigation, 
    CheckCircle2, 
    LogOut, 
    Package, 
    Shield, 
    ChevronLeft 
} from 'lucide-react';
import NotificationBell from '@/Components/Notifications/NotificationBell';

interface DeliveryLayoutProps {
    children: React.ReactNode;
    title?: string;
    showBackButton?: boolean;
    backUrl?: string;
}

export default function DeliveryLayout({ 
    children, 
    title = 'Driver Portal', 
    showBackButton = false,
    backUrl = '/delivery'
}: DeliveryLayoutProps) {
    const { auth, flash } = usePage<PageProps>().props;
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

    const handleLogout = () => {
        router.post('/logout');
    };

    const isTabActive = (tab: string) => {
        if (tab === 'today') {
            return currentUrl === '/delivery' || currentUrl.includes('tab=today');
        }
        return currentUrl.includes(`tab=${tab}`);
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-accent selection:text-accent-foreground">
            {/* Top Fixed Header - Zero Black Brand Anchor */}
            <header className="sticky top-0 z-40 bg-brand text-white border-b border-neutral-900 px-4 py-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                    {showBackButton ? (
                        <Link
                            href={backUrl}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 active:scale-95 transition-all cursor-pointer"
                            aria-label="Go back"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-brand-surface text-brand-surface-foreground border border-brand-surface-foreground/20 flex items-center justify-center shadow-xs">
                            <Truck className="w-5 h-5" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white flex items-center gap-2">
                            {title}
                        </h1>
                        <p className="text-[11px] text-slate-400 font-medium">
                            {auth?.user?.name || 'Delivery Partner'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <NotificationBell />
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Online
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Sign Out"
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#141414] hover:bg-rose-950/40 hover:text-rose-300 text-slate-300 transition-colors cursor-pointer"
                        aria-label="Sign Out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Flash Alerts */}
            {flash?.success && (
                <div className="max-w-4xl mx-auto w-full px-4 mt-4">
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{flash.success}</span>
                    </div>
                </div>
            )}
            {flash?.error && (
                <div className="max-w-4xl mx-auto w-full px-4 mt-4">
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
                        <Shield className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>{flash.error}</span>
                    </div>
                </div>
            )}

            {/* Main Scrollable Content */}
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-8">
                {children}
            </main>

            {/* Mobile Bottom Navigation Bar - Zero Black Anchor & Ghost Green Active Tabs */}
            <nav className="fixed bottom-0 inset-x-0 z-40 bg-brand text-slate-400 border-t border-neutral-900 px-2 py-1.5 sm:hidden shadow-lg">
                <div className="grid grid-cols-4 gap-1">
                    <Link
                        href="/delivery?tab=today"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            isTabActive('today')
                                ? 'bg-brand-surface text-brand-surface-foreground font-semibold shadow-xs'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Truck className="w-5 h-5 mb-0.5" />
                        <span>Today</span>
                    </Link>

                    <Link
                        href="/delivery?tab=active"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            isTabActive('active')
                                ? 'bg-brand-surface text-brand-surface-foreground font-semibold shadow-xs'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Navigation className="w-5 h-5 mb-0.5" />
                        <span>In Transit</span>
                    </Link>

                    <Link
                        href="/delivery?tab=completed"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            isTabActive('completed')
                                ? 'bg-brand-surface text-brand-surface-foreground font-semibold shadow-xs'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <CheckCircle2 className="w-5 h-5 mb-0.5" />
                        <span>Done</span>
                    </Link>

                    <Link
                        href="/delivery?tab=all"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            isTabActive('all')
                                ? 'bg-brand-surface text-brand-surface-foreground font-semibold shadow-xs'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Package className="w-5 h-5 mb-0.5" />
                        <span>All</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
