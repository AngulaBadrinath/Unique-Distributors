import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button, buttonVariants } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import {
    ArrowLeft,
    Mail,
    User as UserIcon,
    Loader2,
    Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryPartnerEditProps {
    driver: {
        id: number;
        name: string;
        email: string;
        status: string;
        created_at?: string;
    };
}

export default function DeliveryPartnerEdit({ driver }: DeliveryPartnerEditProps) {
    const { data, setData, put, processing, errors } = useForm({
        name: driver.name,
        email: driver.email,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/delivery-partners/${driver.id}`);
    };

    return (
        <AppLayout>
            <Head title={`Edit ${driver.name} — Delivery Partner`} />

            <div className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Back Navigation */}
                <div className="flex items-center justify-between border-b border-border/80 pb-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/admin/delivery-partners/${driver.id}`}
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 w-8 p-0')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                Edit Delivery Partner
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Update profile details for {driver.name}
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card className="border-border/70 shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Truck className="h-4 w-4 text-indigo-400" />
                                Account Details
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Update the legal name or corporate email for this delivery driver.
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
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className={cn(errors.email && 'border-red-500 focus-visible:ring-red-500')}
                                />
                                {errors.email && (
                                    <p className="text-xs text-red-500 font-medium">{errors.email}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Link
                            href={`/admin/delivery-partners/${driver.id}`}
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
                                    Saving Changes...
                                </>
                            ) : (
                                'Save Profile Changes'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
