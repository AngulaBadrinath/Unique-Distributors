import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button, buttonVariants } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import {
    ArrowLeft,
    Shield,
    CheckCircle2,
    Clock,
    Lock,
    Mail,
    User as UserIcon,
    Loader2,
    Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusOption {
    value: string;
    label: string;
    description: string;
}

interface DeliveryPartnerCreateProps {
    statuses: StatusOption[];
}

export default function DeliveryPartnerCreate({ statuses }: DeliveryPartnerCreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        status: 'ACTIVE',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/delivery-partners');
    };

    return (
        <AppLayout>
            <Head title="Provision Delivery Partner — Logistics Fleet" />

            <div className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Back Navigation */}
                <div className="flex items-center justify-between border-b border-border/80 pb-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/delivery-partners"
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 w-8 p-0')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                Provision Delivery Partner
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Create an authorized driver account with mobile delivery portal and dispatch execution access
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Role Attribution Card */}
                    <Card className="bg-muted/40 border-border/70 shadow-xs">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 text-primary font-medium text-xs">
                                <Shield className="h-4 w-4" />
                                <span>Role Assignment & System Authority</span>
                            </div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Truck className="h-4 w-4 text-indigo-400" />
                                Delivery Partner (DELIVERY_PARTNER)
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Account is automatically granted driver capabilities: viewing assigned delivery missions, updating mission status (pickup, route start, complete), and collecting proof of delivery.
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    {/* Account Identity & Credentials */}
                    <Card className="border-border/70 shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Account Identity & Credentials</CardTitle>
                            <CardDescription className="text-xs">
                                Enter the driver's full legal name, login email, and initial password.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Full Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Full Legal Name</span>
                                    <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className={cn(errors.name && 'border-red-500 focus-visible:ring-red-500')}
                                />
                                {errors.name && (
                                    <p className="text-xs text-red-500 font-medium">{errors.name}</p>
                                )}
                            </div>

                            {/* Email Address */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Corporate / Login Email Address</span>
                                    <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="email"
                                    placeholder="driver@uniquedistributors.test"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className={cn(errors.email && 'border-red-500 focus-visible:ring-red-500')}
                                />
                                {errors.email && (
                                    <p className="text-xs text-red-500 font-medium">{errors.email}</p>
                                )}
                            </div>

                            {/* Initial Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Initial Secure Password</span>
                                    <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="password"
                                    placeholder="••••••••••••"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className={cn(errors.password && 'border-red-500 focus-visible:ring-red-500')}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Must be at least 8 characters. Password will be securely hashed with bcrypt.
                                </p>
                                {errors.password && (
                                    <p className="text-xs text-red-500 font-medium">{errors.password}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Initial Account Lifecycle State */}
                    <Card className="border-border/70 shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Initial Account Status</CardTitle>
                            <CardDescription className="text-xs">
                                Choose whether the driver can authenticate immediately or requires an invitation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {statuses.map((s) => (
                                    <label
                                        key={s.value}
                                        className={cn(
                                            'relative flex flex-col p-3.5 rounded-lg border cursor-pointer transition-all',
                                            data.status === s.value
                                                ? 'bg-primary/5 border-primary ring-1 ring-primary'
                                                : 'bg-background border-border hover:bg-muted/50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {s.value === 'ACTIVE' ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <Clock className="h-4 w-4 text-amber-500" />
                                                )}
                                                <span className="text-xs font-semibold text-foreground">
                                                    {s.label}
                                                </span>
                                            </div>
                                            <input
                                                type="radio"
                                                name="status"
                                                value={s.value}
                                                checked={data.status === s.value}
                                                onChange={(e) => setData('status', e.target.value)}
                                                className="sr-only"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {s.description}
                                        </p>
                                    </label>
                                ))}
                            </div>
                            {errors.status && (
                                <p className="text-xs text-red-500 font-medium">{errors.status}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Link
                            href="/admin/delivery-partners"
                            className={cn(buttonVariants({ variant: 'outline' }), 'text-xs')}
                        >
                            Cancel
                        </Link>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="gap-2 text-xs font-semibold"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Provisioning Account...
                                </>
                            ) : (
                                <>
                                    <Truck className="h-3.5 w-3.5" />
                                    Provision Delivery Partner
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
