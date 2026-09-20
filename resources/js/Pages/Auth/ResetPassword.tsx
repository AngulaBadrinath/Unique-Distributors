import React, { FormEventHandler, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { PageProps } from '@/types';
import { Shield, Eye, EyeOff, KeyRound, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

interface ResetPasswordProps {
    token: string;
    email?: string | null;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const { appName, identity } = usePage<PageProps>().props;
    const displayName = (usePage().props as any)?.company?.legal_name || identity?.name || appName || 'Wholesale Distribution';

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        token: token || '',
        email: email || '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/reset-password', {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12">
            <Head title={`Set New Password — ${displayName}`} />

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
                            Credential Security
                        </p>
                    </div>
                </div>

                {/* Error Banner for General / Token Errors */}
                {errors.email && (
                    <div
                        className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 shadow-2xs"
                        role="alert"
                    >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <span className="font-semibold block">Password Reset Error</span>
                            <span>{errors.email}</span>
                        </div>
                    </div>
                )}

                {/* Reset Password Card */}
                <Card className="border-border shadow-xs">
                    <CardHeader className="space-y-1 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold">Set New Password</CardTitle>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                Single-Use Token
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            Choose a strong, secure password for your account. All previous sessions will be signed out automatically.
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
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="user@distribution.example"
                                    autoComplete="email"
                                    required
                                    aria-invalid={errors.email ? 'true' : 'false'}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                                />
                            </div>

                            {/* New Password Input */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="password"
                                    className="block text-xs font-medium text-foreground tracking-tight"
                                >
                                    New Password
                                </label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="Minimum 8 characters"
                                        autoComplete="new-password"
                                        autoFocus
                                        required
                                        aria-invalid={errors.password ? 'true' : 'false'}
                                        aria-describedby={errors.password ? 'password-error' : undefined}
                                        className={`pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p id="password-error" className="text-xs text-destructive mt-1" role="alert">
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password Input */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="password_confirmation"
                                    className="block text-xs font-medium text-foreground tracking-tight"
                                >
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <Input
                                        id="password_confirmation"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        name="password_confirmation"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        placeholder="Re-enter new password"
                                        autoComplete="new-password"
                                        required
                                        aria-invalid={errors.password_confirmation ? 'true' : 'false'}
                                        aria-describedby={errors.password_confirmation ? 'password-confirmation-error' : undefined}
                                        className={`pr-10 ${errors.password_confirmation ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                                        aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {errors.password_confirmation && (
                                    <p id="password-confirmation-error" className="text-xs text-destructive mt-1" role="alert">
                                        {errors.password_confirmation}
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
                                        Updating Password...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <KeyRound className="h-4 w-4" />
                                        Update Password & Sign Out Prior Sessions
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
                    <p>Upon password update, all other active sessions will be terminated.</p>
                </div>
            </div>
        </div>
    );
}
