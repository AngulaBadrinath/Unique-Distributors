import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { 
    ShieldAlert, 
    FileQuestion, 
    ServerCrash, 
    Wrench, 
    ArrowLeft, 
    Home, 
    RotateCcw 
} from 'lucide-react';

interface ErrorPageProps {
    status?: number;
    message?: string;
}

export default function ErrorPage({ status = 500, message }: ErrorPageProps) {
    const errorConfigs: Record<number, { title: string; defaultMessage: string; icon: React.ReactNode; badge: string }> = {
        403: {
            title: 'Access Restricted',
            defaultMessage: 'You do not have the required permissions to access this administrative resource. If you believe this is an error, contact your system administrator.',
            icon: <ShieldAlert className="h-12 w-12 text-amber-500" />,
            badge: '403 Forbidden',
        },
        404: {
            title: 'Resource Not Found',
            defaultMessage: 'The page or operational resource you are attempting to reach does not exist or may have been relocated.',
            icon: <FileQuestion className="h-12 w-12 text-sky-500" />,
            badge: '404 Not Found',
        },
        500: {
            title: 'Application Error',
            defaultMessage: 'An unexpected error occurred while processing your request. The event has been logged for review.',
            icon: <ServerCrash className="h-12 w-12 text-rose-500" />,
            badge: '500 Server Error',
        },
        503: {
            title: 'Service Maintenance',
            defaultMessage: 'The system is temporarily unavailable due to routine maintenance or updates. Please try again shortly.',
            icon: <Wrench className="h-12 w-12 text-indigo-500" />,
            badge: '503 Service Unavailable',
        },
    };

    const config = errorConfigs[status] || errorConfigs[500];
    const displayMessage = message || config.defaultMessage;

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 antialiased selection:bg-primary/20 selection:text-primary">
            <Head title={`${config.badge} — ${config.title}`} />

            <div className="w-full max-w-lg space-y-6 text-center">
                {/* Visual Icon Container */}
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-card border border-border shadow-md">
                    {config.icon}
                </div>

                {/* Status & Title */}
                <div className="space-y-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border">
                        {config.badge}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {config.title}
                    </h1>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                        {displayMessage}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Button
                        variant="outline"
                        onClick={() => window.history.back()}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Go Back</span>
                    </Button>

                    <Link href="/dashboard" className="w-full sm:w-auto">
                        <Button
                            variant="default"
                            className="w-full flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Home className="h-4 w-4" />
                            <span>Dashboard Home</span>
                        </Button>
                    </Link>

                    {status >= 500 && (
                        <Button
                            variant="ghost"
                            onClick={() => window.location.reload()}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            <RotateCcw className="h-4 w-4" />
                            <span>Retry</span>
                        </Button>
                    )}
                </div>

                {/* Footer Note */}
                <p className="text-[11px] text-muted-foreground/70 font-mono pt-4 border-t border-border">
                    Unique Distributors &bull; Secure Multi-Role Platform
                </p>
            </div>
        </div>
    );
}
