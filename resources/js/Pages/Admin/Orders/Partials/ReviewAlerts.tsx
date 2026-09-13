import React from 'react';
import { Link } from '@inertiajs/react';
import { AlertOctagon, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { ReviewWarning } from '@/types/order';

interface ReviewAlertsProps {
    warnings: ReviewWarning[];
}

export default function ReviewAlerts({ warnings }: ReviewAlertsProps) {
    if (!warnings || warnings.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Operational Review Notices ({warnings.length})
            </div>

            <div className="space-y-2.5">
                {warnings.map((warning, idx) => {
                    const isBlocker = warning.severity === 'blocker';
                    const isWarning = warning.severity === 'warning';

                    return (
                        <div
                            key={`${warning.code}-${idx}`}
                            className={`rounded-lg border p-4 text-xs transition-colors flex items-start gap-3.5 ${
                                isBlocker
                                    ? 'bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/15'
                                    : isWarning
                                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                                    : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                            }`}
                        >
                            <div className="shrink-0 mt-0.5">
                                {isBlocker ? (
                                    <AlertOctagon className="h-4 w-4 text-destructive" />
                                ) : isWarning ? (
                                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                ) : (
                                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                )}
                            </div>

                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-sm tracking-tight">
                                        {warning.title}
                                    </span>
                                    <span
                                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm font-semibold ${
                                            isBlocker
                                                ? 'bg-destructive/20 text-destructive'
                                                : isWarning
                                                ? 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                                                : 'bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300'
                                        }`}
                                    >
                                        {warning.severity}
                                    </span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    {warning.description}
                                </p>
                                {warning.action_url && warning.action_text && (
                                    <div className="pt-1.5">
                                        <Link
                                            href={warning.action_url}
                                            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                                        >
                                            <span>{warning.action_text}</span>
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
