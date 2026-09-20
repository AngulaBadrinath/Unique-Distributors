import React, { FormEventHandler } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { PageProps } from '@/types';
import { Shield, ArrowLeft, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ForgotPasswordProps {
    status?: string | null;
}

export default function ForgotPassword({ status }: ForgotPasswordProps) {
    const { appName, identity } = usePage<PageProps>().props;
    const displayName = (usePage().props as any)?.company?.legal_name || identity?.name || appName || 'Wholesale Distribution';

    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/forgot-password');
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12">
            <Head title={`Forgot Password — ${displayName}`} />

            <div className="w-full max-w-md space-y-6">
                {/* Brand Header */}
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
                        <Shield className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                            {displayName}
                        </h1>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mt-0.5">
                            Password Recovery
                        </p>
                    </div>
                </div>

                {/* Session Status Notice */}
                {status && (
                    <div
                        className="p-3 text-xs font-medium text-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-900 shadow-2xs flex items-start gap-2.5"
                        role="status"
                    >
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{status}</span>
                    </div>
                )}

                {/* Error Banner for Rate-Limit / Validation Errors */}
                {errors.email && (
                    <div
                        className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 shadow-2xs"
                        role="alert"
                    >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <span className="font-semibold block">Notice</span>
                            <span>{errors.email}</span>
                        </div>
                    </div>
                )}

                {/* Forgot Password Card */}
                <Card className="border-border shadow-xs">
                    <CardHeader className="space-y-1 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold">Reset Password</CardTitle>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                Secure Recovery
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            Enter your registered work email address and we will send you an authentication link to reset your password.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={submit} className="space-y-4" noValidate>
                            {/* Email Input */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="email"
                                    className="block text-xs font-medium text-foreground tracking-tight"
                                >
                                    Work Email Address
                                </label>
                                <div className="relative">
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="user@distribution.example"
                                        autoComplete="email"
                                        autoFocus
                                        required
                                        aria-invalid={errors.email ? 'true' : 'false'}
                                        aria-describedby={errors.email ? 'email-error' : undefined}
                                        className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                                    />
                                </div>
                                {errors.email && (
                                    <p id="email-error" className="text-xs text-destructive mt-1" role="alert">
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full h-10 font-medium tracking-tight text-xs uppercase"
                                disabled={processing}
                            >
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Sending Link...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        Send Password Reset Link
                                    </span>
                                )}
                            </Button>

                            {/* Back to Login */}
                            <div className="pt-2 text-center">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded-xs px-2 py-1"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    <span>Return to sign in</span>
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Footer Metadata */}
                <div className="text-center text-[11px] text-muted-foreground space-y-1">
                    <p>Protected by rate limiting and zero-enumeration controls.</p>
                </div>
            </div>
        </div>
    );
}
