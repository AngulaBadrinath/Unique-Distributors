import React, { useState, FormEventHandler } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { PageProps } from '@/types';
import { Shield, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
    status?: string;
}

export default function Login({ status }: LoginProps) {
    const { appName, identity } = usePage<PageProps>().props;
    const [showPassword, setShowPassword] = useState(false);
    const displayName = identity?.name || appName || 'Unique Distributors';
    const initials = displayName.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'UD';

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 antialiased selection:bg-primary/15 selection:text-primary">
            <Head title="Sign In — Centralized Authentication" />

            {/* Background geometric grid pattern */}
            <div className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20 [background-image:radial-gradient(#e2e8f0_1px,transparent_1px)] dark:[background-image:radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]" />

            <div className="w-full max-w-md space-y-6 relative z-10">
                {/* Brand Header */}
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-base shadow-xs">
                        {initials}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                            {displayName}
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1">
                            {identity?.tagline || 'Centralized Authentication Gateway • Multi-Portal Access'}
                        </p>
                    </div>
                </div>

                {/* Session Status Notice */}
                {status && (
                    <div
                        className="p-3 text-xs font-medium text-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-900 shadow-2xs"
                        role="status"
                    >
                        {status}
                    </div>
                )}

                {/* Error Banner for General / Rate-Limit Errors */}
                {errors.email && (
                    <div
                        className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 shadow-2xs"
                        role="alert"
                    >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <span className="font-semibold block">Authentication Notice</span>
                            <span>{errors.email}</span>
                        </div>
                    </div>
                )}

                {/* Authentication Card */}
                <Card className="border-border shadow-xs">
                    <CardHeader className="space-y-1 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold">Sign In</CardTitle>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                Single Identity
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            Enter your verified credentials to access your assigned operational portal.
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
                                    placeholder="name@company.com"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    aria-invalid={errors.email ? 'true' : 'false'}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                                />
                            </div>

                            {/* Password Input */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label
                                        htmlFor="password"
                                        className="block text-xs font-medium text-foreground tracking-tight"
                                    >
                                        Password
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-xs text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-ring rounded-xs"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
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

                            {/* Remember Me Checkbox */}
                            <div className="flex items-center space-x-2 pt-1">
                                <input
                                    id="remember"
                                    type="checkbox"
                                    name="remember"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-background cursor-pointer"
                                />
                                <label
                                    htmlFor="remember"
                                    className="text-xs text-muted-foreground font-medium select-none cursor-pointer"
                                >
                                    Remember this browser session
                                </label>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full text-xs font-semibold h-10 mt-2"
                                disabled={processing}
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Authenticating...
                                    </>
                                ) : (
                                    'Sign In to Portal'
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="bg-muted/30 border-t border-border py-3 px-6 text-[11px] text-muted-foreground flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-primary" />
                            <span>Encrypted Session &bull; Server-Side Abuse Protection</span>
                        </div>
                    </CardFooter>
                </Card>

                {/* Footer Note */}
                <div className="text-center text-[11px] text-muted-foreground space-y-1">
                    <p>
                        Authorized wholesale distribution personnel only. All access events are logged and audited.
                    </p>
                </div>
            </div>
        </div>
    );
}
