import React from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { PageProps } from '@/types';
import { 
    Truck, 
    Navigation, 
    CheckCircle2, 
    LogOut, 
    User,
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
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname : '';

    const handleLogout = () => {
        router.post('/logout');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
            {/* Top Fixed Header */}
            <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                    {showBackButton ? (
                        <Link
                            href={backUrl}
                            className="inline-flex items-center justify-center w-10 h-10 -ml-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all"
                            aria-label="Go back"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <Truck className="w-5 h-5" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                            {title}
                        </h1>
                        <p className="text-xs text-slate-400 font-medium">
                            {auth?.user?.name || 'Delivery Partner'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Online
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Sign Out"
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors cursor-pointer"
                        aria-label="Sign Out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Flash Alerts */}
            {flash?.success && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{flash.success}</span>
                </div>
            )}
            {flash?.error && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{flash.error}</span>
                </div>
            )}

            {/* Main Scrollable Content */}
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-4 pb-24 sm:pb-8">
                {children}
            </main>

            {/* Mobile Bottom Navigation Bar (Fixed for thumb reachability, >=44px touch targets) */}
            <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-2 sm:hidden shadow-lg">
                <div className="grid grid-cols-4 gap-1">
                    <Link
                        href="/delivery?tab=today"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            currentUrl === '/delivery' || currentUrl.includes('tab=today')
                                ? 'bg-indigo-600/20 text-indigo-400'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Truck className="w-5 h-5 mb-0.5" />
                        <span>Today</span>
                    </Link>

                    <Link
                        href="/delivery?tab=active"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            currentUrl.includes('tab=active')
                                ? 'bg-indigo-600/20 text-indigo-400'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Navigation className="w-5 h-5 mb-0.5" />
                        <span>In Transit</span>
                    </Link>

                    <Link
                        href="/delivery?tab=completed"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            currentUrl.includes('tab=completed')
                                ? 'bg-indigo-600/20 text-indigo-400'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <CheckCircle2 className="w-5 h-5 mb-0.5" />
                        <span>Done</span>
                    </Link>

                    <Link
                        href="/delivery?tab=all"
                        className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 px-2 text-xs font-medium transition-all ${
                            currentUrl.includes('tab=all')
                                ? 'bg-indigo-600/20 text-indigo-400'
                                : 'text-slate-400 hover:text-slate-200'
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
