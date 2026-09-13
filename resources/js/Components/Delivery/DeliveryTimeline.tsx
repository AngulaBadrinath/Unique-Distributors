import React from 'react';
import {
    FileText,
    UserCheck,
    UserPlus,
    UserX,
    Package,
    Navigation,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    RotateCcw,
    Clock,
    User,
    ArrowRight
} from 'lucide-react';

export interface DeliveryTimelineEvent {
    id: number;
    delivery_id: number;
    event_type: string;
    from_status?: string | null;
    to_status: string;
    notes?: string | null;
    metadata?: Record<string, any> | null;
    created_at: string;
    actor?: {
        id: number;
        name: string;
        role?: string;
    } | null;
}

interface DeliveryTimelineProps {
    events: DeliveryTimelineEvent[];
    className?: string;
}

const getEventConfig = (eventType: string) => {
    switch (eventType) {
        case 'CREATED':
            return {
                icon: FileText,
                bg: 'bg-slate-500/15',
                border: 'border-slate-500/30',
                text: 'text-slate-300',
                badgeBg: 'bg-slate-800 text-slate-300',
            };
        case 'ASSIGNED':
            return {
                icon: UserCheck,
                bg: 'bg-indigo-500/15',
                border: 'border-indigo-500/30',
                text: 'text-indigo-400',
                badgeBg: 'bg-indigo-900/40 text-indigo-300 border border-indigo-500/30',
            };
        case 'REASSIGNED':
            return {
                icon: UserPlus,
                bg: 'bg-blue-500/15',
                border: 'border-blue-500/30',
                text: 'text-blue-400',
                badgeBg: 'bg-blue-900/40 text-blue-300 border border-blue-500/30',
            };
        case 'UNASSIGNED':
            return {
                icon: UserX,
                bg: 'bg-rose-500/15',
                border: 'border-rose-500/30',
                text: 'text-rose-400',
                badgeBg: 'bg-rose-900/40 text-rose-300 border border-rose-500/30',
            };
        case 'PICKED_UP':
            return {
                icon: Package,
                bg: 'bg-purple-500/15',
                border: 'border-purple-500/30',
                text: 'text-purple-400',
                badgeBg: 'bg-purple-900/40 text-purple-300 border border-purple-500/30',
            };
        case 'OUT_FOR_DELIVERY':
            return {
                icon: Navigation,
                bg: 'bg-amber-500/15',
                border: 'border-amber-500/30',
                text: 'text-amber-400',
                badgeBg: 'bg-amber-900/40 text-amber-300 border border-amber-500/30',
            };
        case 'DELIVERED':
            return {
                icon: CheckCircle2,
                bg: 'bg-emerald-500/15',
                border: 'border-emerald-500/30',
                text: 'text-emerald-400',
                badgeBg: 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30',
            };
        case 'FAILED':
            return {
                icon: AlertTriangle,
                bg: 'bg-rose-500/15',
                border: 'border-rose-500/30',
                text: 'text-rose-400',
                badgeBg: 'bg-rose-900/40 text-rose-300 border border-rose-500/30',
            };
        case 'RESCHEDULED':
            return {
                icon: Calendar,
                bg: 'bg-amber-500/15',
                border: 'border-amber-500/30',
                text: 'text-amber-400',
                badgeBg: 'bg-amber-900/40 text-amber-300 border border-amber-500/30',
            };
        case 'RETURNED_TO_WAREHOUSE':
            return {
                icon: RotateCcw,
                bg: 'bg-purple-500/15',
                border: 'border-purple-500/30',
                text: 'text-purple-400',
                badgeBg: 'bg-purple-900/40 text-purple-300 border border-purple-500/30',
            };
        default:
            return {
                icon: Clock,
                bg: 'bg-slate-500/15',
                border: 'border-slate-500/30',
                text: 'text-slate-400',
                badgeBg: 'bg-slate-800 text-slate-300',
            };
    }
};

export default function DeliveryTimeline({ events, className = '' }: DeliveryTimelineProps) {
    if (!events || events.length === 0) {
        return (
            <div className="p-6 text-center text-xs text-slate-500">
                No tracking events recorded yet.
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {events.map((evt) => {
                    const config = getEventConfig(evt.event_type);
                    const Icon = config.icon;

                    return (
                        <div key={evt.id} className="relative group">
                            {/* Node icon */}
                            <div className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full ${config.bg} border ${config.border} flex items-center justify-center ${config.text} shadow-xs z-10 bg-slate-950`}>
                                <Icon className="w-3.5 h-3.5" />
                            </div>

                            {/* Event content box */}
                            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors shadow-xs space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight ${config.badgeBg}`}>
                                            {evt.event_type.replace(/_/g, ' ')}
                                        </span>

                                        {evt.from_status && evt.from_status !== evt.to_status && (
                                            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                                                <span>{evt.from_status}</span>
                                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                                <span className="text-white font-medium">{evt.to_status}</span>
                                            </div>
                                        )}
                                    </div>

                                    <span className="text-[11px] font-mono text-slate-400">
                                        {evt.created_at}
                                    </span>
                                </div>

                                {evt.notes && (
                                    <p className="text-xs text-slate-200 leading-relaxed font-normal">
                                        {evt.notes}
                                    </p>
                                )}

                                {/* Metadata attributes */}
                                {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {evt.metadata.recipient_name && (
                                            <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[10px] text-emerald-300 font-medium">
                                                Recipient: {evt.metadata.recipient_name}
                                            </span>
                                        )}
                                        {evt.metadata.failure_reason && (
                                            <span className="px-2 py-0.5 rounded-md bg-rose-950/40 border border-rose-900/40 text-[10px] text-rose-300 font-medium">
                                                Reason: {evt.metadata.failure_reason}
                                            </span>
                                        )}
                                        {evt.metadata.new_scheduled_date && (
                                            <span className="px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-900/40 text-[10px] text-amber-300 font-medium">
                                                New Date: {evt.metadata.new_scheduled_date}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5 border-t border-slate-800/40">
                                    <User className="w-3 h-3" />
                                    <span>By {evt.actor?.name || 'System / Auto'}</span>
                                    {evt.actor?.role && (
                                        <span className="text-slate-400">({evt.actor.role.replace(/_/g, ' ')})</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
