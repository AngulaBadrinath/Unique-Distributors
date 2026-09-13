import React, { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    Key,
    QrCode,
    Copy,
    Check,
    Download,
    RefreshCw,
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Lock,
} from 'lucide-react';

interface MfaIndexProps extends PageProps {
    enabled: boolean;
    mandatory: boolean;
    can_disable: boolean;
    recovery_codes_count: number;
    setup_data?: {
        qr_code_svg: string;
        manual_key: string;
    } | null;
    recovery_codes?: string[] | null;
    status?: string | null;
}

export default function MfaIndex({
    enabled,
    mandatory,
    can_disable,
    recovery_codes_count,
    setup_data,
    recovery_codes,
    status,
}: MfaIndexProps) {
    const [stepUpAction, setStepUpAction] = useState<'enable' | 'disable' | 'regenerate' | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);
    const [copiedRecovery, setCopiedRecovery] = useState(false);

    // Form for step-up password confirmation
    const stepUpForm = useForm({
        current_password: '',
    });

    // Form for TOTP confirmation during enrollment
    const confirmForm = useForm({
        code: '',
    });

    const handleStepUpSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (stepUpAction === 'enable') {
            stepUpForm.post('/security/mfa/enable', {
                onSuccess: () => {
                    setStepUpAction(null);
                    stepUpForm.reset();
                },
            });
        } else if (stepUpAction === 'disable') {
            stepUpForm.delete('/security/mfa', {
                onSuccess: () => {
                    setStepUpAction(null);
                    stepUpForm.reset();
                },
            });
        } else if (stepUpAction === 'regenerate') {
            stepUpForm.post('/security/mfa/recovery-codes', {
                onSuccess: () => {
                    setStepUpAction(null);
                    stepUpForm.reset();
                },
            });
        }
    };

    const handleConfirmSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        confirmForm.post('/security/mfa/confirm', {
            onSuccess: () => {
                confirmForm.reset();
            },
        });
    };

    const handleCopyManualKey = () => {
        if (setup_data?.manual_key) {
            navigator.clipboard.writeText(setup_data.manual_key.replace(/\s+/g, ''));
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2000);
        }
    };

    const handleCopyRecoveryCodes = () => {
        if (recovery_codes && recovery_codes.length > 0) {
            navigator.clipboard.writeText(recovery_codes.join('\n'));
            setCopiedRecovery(true);
            setTimeout(() => setCopiedRecovery(false), 2000);
        }
    };

    const { appName, identity } = usePage<PageProps>().props;
    const titleName = (identity?.name || appName || 'Unique Distributors').toUpperCase();

    const handleDownloadRecoveryCodes = () => {
        if (recovery_codes && recovery_codes.length > 0) {
            const content = `${titleName}\nTWO-FACTOR AUTHENTICATION RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\nEach code can only be used once.\n\n${recovery_codes.join(
                '\n'
            )}\n`;
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'mfa-recovery-codes.txt';
            link.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <Head title="Two-Factor Authentication Settings" />

            {/* Header */}
            <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/security/sessions"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            aria-label="Back to Security Sessions"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Two-Factor Authentication</h1>
                            <p className="text-xs text-muted-foreground">
                                Manage TOTP authenticator app verification and emergency recovery codes
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href="/security/sessions">
                            <Button variant="outline" size="sm" className="h-9">
                                Active Sessions
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
                {/* Status Banners */}
                {status && (
                    <div
                        role="status"
                        className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-3"
                    >
                        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>{status}</span>
                    </div>
                )}

                {/* Status Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                    <Shield className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Authentication Security Status</CardTitle>
                                    <CardDescription>
                                        Multi-Factor Authentication adds an extra layer of protection to your account.
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {enabled ? (
                                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 py-1 px-2.5">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        <span>Enabled</span>
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground gap-1.5 py-1 px-2.5">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        <span>Disabled</span>
                                    </Badge>
                                )}
                                {mandatory && (
                                    <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                                        <span>Required for Role</span>
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {enabled ? (
                            <div className="space-y-4">
                                <div className="text-sm text-muted-foreground">
                                    Your account is protected by an authenticator application. You have{' '}
                                    <strong className="text-foreground">{recovery_codes_count}</strong> active
                                    emergency recovery code{recovery_codes_count === 1 ? '' : 's'} remaining.
                                </div>

                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setStepUpAction('regenerate');
                                            stepUpForm.reset();
                                        }}
                                        className="gap-2 h-10"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        <span>Regenerate Recovery Codes</span>
                                    </Button>

                                    {can_disable ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setStepUpAction('disable');
                                                stepUpForm.reset();
                                            }}
                                            className="text-rose-600 dark:text-rose-400 hover:text-rose-500 gap-2 h-10"
                                        >
                                            <AlertTriangle className="h-4 w-4" />
                                            <span>Disable MFA</span>
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">
                                            (MFA is required for your privileged role and cannot be disabled)
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    When enabled, you will be required to provide a 6-digit security code generated by your
                                    authenticator app (such as Google Authenticator, 1Password, or Authy) upon signing in.
                                </p>
                                {!setup_data && (
                                    <Button
                                        onClick={() => {
                                            setStepUpAction('enable');
                                            stepUpForm.reset();
                                        }}
                                        className="gap-2 h-10"
                                    >
                                        <ShieldCheck className="h-4 w-4" />
                                        <span>Enable Two-Factor Authentication</span>
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* One-Time Recovery Codes Presentation Banner */}
                {recovery_codes && recovery_codes.length > 0 && (
                    <Card className="border-amber-500/40 bg-amber-500/5">
                        <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <Key className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <CardTitle className="text-base text-amber-700 dark:text-amber-300">
                                        Save Your Emergency Recovery Codes
                                    </CardTitle>
                                    <CardDescription className="text-xs text-amber-600/90 dark:text-amber-400/90">
                                        Store these recovery codes in a secure password manager. They will NOT be
                                        displayed again. Each code can be used once to access your account if you lose your
                                        authenticator device.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-xl bg-card border font-mono text-sm text-center">
                                {recovery_codes.map((code, idx) => (
                                    <div
                                        key={idx}
                                        className="p-2 rounded-md bg-muted/60 border text-foreground tracking-wider font-semibold"
                                    >
                                        {code}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyRecoveryCodes}
                                    className="gap-1.5 h-9"
                                >
                                    {copiedRecovery ? (
                                        <>
                                            <Check className="h-4 w-4 text-emerald-500" />
                                            <span>Copied to clipboard</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4" />
                                            <span>Copy all codes</span>
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownloadRecoveryCodes}
                                    className="gap-1.5 h-9"
                                >
                                    <Download className="h-4 w-4" />
                                    <span>Download .txt</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Setup Flow Active (QR Code + Confirmation) */}
                {setup_data && !enabled && (
                    <Card className="border-indigo-500/40 bg-indigo-500/5">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                <QrCode className="h-5 w-5" />
                                <span>Scan QR Code with Your Authenticator App</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Use Google Authenticator, 1Password, Authy, or any standard TOTP app to scan the code
                                below.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-card border">
                                <div
                                    className="bg-white p-3 rounded-lg shadow-sm shrink-0"
                                    dangerouslySetInnerHTML={{ __html: setup_data.qr_code_svg }}
                                    aria-label="Two-factor QR Code"
                                />
                                <div className="space-y-2 text-center sm:text-left">
                                    <span className="text-xs font-medium text-muted-foreground block">
                                        Unable to scan? Use manual setup key:
                                    </span>
                                    <div className="inline-flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg font-mono text-sm text-foreground">
                                        <span>{setup_data.manual_key}</span>
                                        <button
                                            type="button"
                                            onClick={handleCopyManualKey}
                                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                            title="Copy manual key"
                                            aria-label="Copy manual key"
                                        >
                                            {copiedKey ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Verification Form */}
                            <form onSubmit={handleConfirmSubmit} className="space-y-4 max-w-sm">
                                <div>
                                    <label htmlFor="confirm_code" className="block text-sm font-medium mb-1.5">
                                        Enter 6-Digit Code to Confirm Setup
                                    </label>
                                    <Input
                                        id="confirm_code"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        placeholder="123456"
                                        value={confirmForm.data.code}
                                        onChange={(e) =>
                                            confirmForm.setData('code', e.target.value.replace(/[^0-9]/g, ''))
                                        }
                                        className="text-center font-mono text-lg tracking-widest h-11"
                                        required
                                    />
                                    {confirmForm.errors.code && (
                                        <p className="mt-1.5 text-xs text-rose-500">{confirmForm.errors.code}</p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    disabled={confirmForm.processing}
                                    className="w-full h-10 gap-2"
                                >
                                    <Check className="h-4 w-4" />
                                    <span>Verify & Complete Setup</span>
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Step-Up Password Confirmation Dialog Modal */}
                {stepUpAction && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold">Confirm Your Password</h3>
                                    <p className="text-xs text-muted-foreground">
                                        For your security, please confirm your password to proceed with this high-risk
                                        action.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleStepUpSubmit} className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="stepup_password"
                                        className="block text-sm font-medium mb-1"
                                    >
                                        Current Password
                                    </label>
                                    <Input
                                        id="stepup_password"
                                        type="password"
                                        autoFocus
                                        value={stepUpForm.data.current_password}
                                        onChange={(e) => stepUpForm.setData('current_password', e.target.value)}
                                        className="h-10"
                                        required
                                    />
                                    {stepUpForm.errors.current_password && (
                                        <p className="mt-1 text-xs text-rose-500">
                                            {stepUpForm.errors.current_password}
                                        </p>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStepUpAction(null)}
                                        className="h-10"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={stepUpForm.processing}
                                        variant={stepUpAction === 'disable' ? 'destructive' : 'default'}
                                        className="h-10"
                                    >
                                        {stepUpForm.processing ? 'Verifying...' : 'Confirm'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
