import React, { useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button, buttonVariants } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { PageProps } from '@/types';
import {
    Truck,
    ArrowLeft,
    Mail,
    CheckCircle2,
    Clock,
    ShieldAlert,
    UserX,
    Edit,
    Shield,
    SlidersHorizontal,
    Info,
    X,
    Loader2,
    ExternalLink,
    PackageCheck,
    Navigation,
    RotateCcw,
    AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryMissionSummary {
    id: number;
    delivery_number: string;
    order_number?: string;
    customer_name?: string;
    customer_location?: string;
    status: string;
    scheduled_date?: string;
    delivered_at?: string;
}

interface DriverProfile {
    id: number;
    name: string;
    email: string;
    status: string;
    status_label: string;
    can_authenticate: boolean;
    can_be_assigned: boolean;
    created_at: string;
    updated_at: string;
}

interface StatusOption {
    value: string;
    label: string;
    description: string;
    can_transition: boolean;
}

interface DeliveryPartnerShowProps {
    driver: DriverProfile;
    counts: {
        total_assigned: number;
        pending_pickup: number;
        in_transit: number;
        delivered: number;
        failed: number;
        returned: number;
    };
    recent_deliveries: DeliveryMissionSummary[];
    statuses: StatusOption[];
    canEdit: boolean;
    canSuspend: boolean;
}

export default function DeliveryPartnerShow({
    driver,
    counts,
    recent_deliveries,
    statuses,
    canEdit,
    canSuspend,
}: DeliveryPartnerShowProps) {
    const { flash } = usePage<PageProps>().props;
    const [statusModalOpen, setStatusModalOpen] = useState(false);

    const {
        data: statusData,
        setData: setStatusData,
        patch: patchStatus,
        processing: statusProcessing,
        errors: statusErrors,
        reset: resetStatusForm,
    } = useForm({
        status: driver.status,
        reason: '',
    });

    const handleStatusSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patchStatus(`/admin/delivery-partners/${driver.id}/status`, {
            onSuccess: () => {
                setStatusModalOpen(false);
                resetStatusForm('reason');
            },
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/60 font-mono text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                    </Badge>
                );
            case 'INVITED':
                return (
                    <Badge variant="outline" className="bg-amber-950/40 text-amber-400 border-amber-800/60 font-mono text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Invited
                    </Badge>
                );
            case 'SUSPENDED':
                return (
                    <Badge variant="outline" className="bg-rose-950/40 text-rose-400 border-rose-800/60 font-mono text-xs">
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Suspended
                    </Badge>
                );
            case 'DISABLED':
                return (
                    <Badge variant="outline" className="bg-slate-900/60 text-slate-400 border-slate-700/60 font-mono text-xs">
                        <UserX className="h-3 w-3 mr-1" />
                        Disabled
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 font-mono text-xs">
                        {status}
                    </Badge>
                );
        }
    };

    return (
        <AppLayout>
            <Head title={`${driver.name} — Delivery Partner`} />

            <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/delivery-partners"
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 w-8 p-0')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                                    {driver.name}
                                </h1>
                                {getStatusBadge(driver.status)}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                Delivery Partner ID: #{driver.id} • {driver.email}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {canEdit && (
                            <Link
                                href={`/admin/delivery-partners/${driver.id}/edit`}
                                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 text-xs')}
                            >
                                <Edit className="h-3.5 w-3.5" />
                                Edit Profile
                            </Link>
                        )}
                        {canSuspend && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatusModalOpen(true)}
                                className="gap-1.5 text-xs text-amber-400 border-amber-800/60 hover:bg-amber-950/20"
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Lifecycle Actions
                            </Button>
                        )}
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Card className="border-border/60 bg-brand-surface/40 p-3 shadow-xs">
                        <div className="text-xs font-mono text-muted-foreground">Total Missions</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">{counts.total_assigned}</div>
                    </Card>
                    <Card className="border-border/60 bg-brand-surface/40 p-3 shadow-xs">
                        <div className="text-xs font-mono text-amber-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pending Pickup
                        </div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">{counts.pending_pickup}</div>
                    </Card>
                    <Card className="border-border/60 bg-brand-surface/40 p-3 shadow-xs">
                        <div className="text-xs font-mono text-indigo-400 flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            In Transit
                        </div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">{counts.in_transit}</div>
                    </Card>
                    <Card className="border-border/60 bg-brand-surface/40 p-3 shadow-xs">
                        <div className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Delivered
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{counts.delivered}</div>
                    </Card>
                    <Card className="border-border/60 bg-brand-surface/40 p-3 shadow-xs">
                        <div className="text-xs font-mono text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                        </div>
                        <div className="text-xl font-bold font-mono text-rose-400 mt-1">{counts.failed}</div>
                    </Card>
                    <Card className="border-border/60 bg-brand-surface/40 p-3 shadow-xs">
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" />
                            Returned
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-300 mt-1">{counts.returned}</div>
                    </Card>
                </div>

                {/* Recent Deliveries Table */}
                <Card className="border-border/60 bg-brand-surface/40 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <PackageCheck className="h-4 w-4 text-indigo-400" />
                                <CardTitle className="text-base font-mono">Assigned Delivery Missions</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono">
                                {recent_deliveries.length} Recent
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recent_deliveries.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                No delivery missions currently assigned to this driver.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-brand-surface border-b border-border/60 text-xs font-mono uppercase text-muted-foreground">
                                        <tr>
                                            <th className="py-3 px-4">Delivery #</th>
                                            <th className="py-3 px-4">Order #</th>
                                            <th className="py-3 px-4">Customer & Location</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-right">Scheduled Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40 font-mono text-xs">
                                        {recent_deliveries.map((del) => (
                                            <tr key={del.id} className="hover:bg-brand-surface/60 transition-colors">
                                                <td className="py-3 px-4 font-semibold text-indigo-400">
                                                    {del.delivery_number}
                                                </td>
                                                <td className="py-3 px-4 text-foreground">
                                                    #{del.order_number}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-foreground">{del.customer_name}</div>
                                                    <div className="text-muted-foreground text-[11px]">{del.customer_location}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className="text-[11px]">
                                                        {del.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-right text-muted-foreground">
                                                    {del.scheduled_date || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Status Lifecycle Modal */}
                {statusModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-base font-bold text-white font-mono">Driver Lifecycle Status</h2>
                                </div>
                                <button
                                    onClick={() => setStatusModalOpen(false)}
                                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleStatusSubmit} className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-300">Target Account Status</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {statuses.map((s) => (
                                            <button
                                                key={s.value}
                                                type="button"
                                                onClick={() => setStatusData('status', s.value)}
                                                className={cn(
                                                    'p-3 rounded-xl border text-left transition-all',
                                                    statusData.status === s.value
                                                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-xs'
                                                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80 hover:text-white'
                                                )}
                                            >
                                                <div className="text-xs font-bold font-mono">{s.label}</div>
                                                <div className="text-[11px] text-slate-400 mt-1">{s.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Reason / Audit Notes</label>
                                    <textarea
                                        value={statusData.reason}
                                        onChange={(e) => setStatusData('reason', e.target.value)}
                                        placeholder="Document reason for status change (e.g. driver on medical leave, termination, seasonal reactivation)..."
                                        rows={3}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setStatusModalOpen(false)}
                                        className="text-xs"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={statusProcessing}
                                        className="text-xs bg-indigo-600 hover:bg-indigo-500 font-semibold"
                                    >
                                        {statusProcessing ? 'Updating...' : 'Confirm Status Transition'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
