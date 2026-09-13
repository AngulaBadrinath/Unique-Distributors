import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { 
    Settings, 
    ShieldCheck, 
    Bell, 
    Check, 
    Lock, 
    AlertCircle, 
    ArrowLeft,
    Save
} from 'lucide-react';

interface PreferenceItem {
    category: string;
    is_in_app_enabled: boolean;
    is_mandatory: boolean;
    label: string;
    description: string;
}

interface Props {
    preferences: PreferenceItem[];
}

export default function NotificationPreferences({ preferences }: Props) {
    const [settings, setSettings] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        preferences.forEach((p) => {
            initial[p.category] = p.is_in_app_enabled;
        });
        return initial;
    });

    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    const handleToggle = (category: string, isMandatory: boolean) => {
        if (isMandatory) return; // Cannot toggle mandatory categories

        setSettings((prev) => ({
            ...prev,
            [category]: !prev[category],
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSavedMessage(null);

        router.put('/notifications/preferences', {
            preferences: settings,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setSaving(false);
                setSavedMessage('Notification preferences updated successfully.');
                setTimeout(() => setSavedMessage(null), 4000);
            },
            onError: () => {
                setSaving(false);
            }
        });
    };

    return (
        <AppLayout title="Notification Preferences">
            <Head title="Notification Preferences - Operational Settings" />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/notifications"
                            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" />
                                Notification Preferences
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Customize which in-app operational notifications you receive. Security and system notices remain mandatory.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-action-accent text-white hover:bg-action-accent/90 transition-all shadow-neu-dark glow-cyan-subtle hover:glow-cyan disabled:opacity-50 cursor-pointer"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>

                {savedMessage && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200 shadow-neu-dark">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{savedMessage}</span>
                    </div>
                )}

                {/* Preferences Form Card */}
                <div className="border border-white/8 rounded-2xl bg-dark-surface divide-y divide-white/6 overflow-hidden shadow-neu-dark">
                    {preferences.map((item) => {
                        const isEnabled = settings[item.category] ?? item.is_in_app_enabled;

                        return (
                            <div
                                key={item.category}
                                className={`p-5 flex items-start justify-between gap-6 transition-colors ${
                                    item.is_mandatory ? 'bg-muted/30' : 'hover:bg-muted/10'
                                }`}
                            >
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-foreground">
                                            {item.label}
                                        </span>
                                        {item.is_mandatory ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                <Lock className="h-2.5 w-2.5" />
                                                Mandatory
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                {item.category}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>

                                <div className="flex items-center pt-1">
                                    {item.is_mandatory ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-medium cursor-not-allowed shadow-xs">
                                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                            Always Active
                                        </div>
                                    ) : (
                                        <label className="relative inline-flex items-center cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={isEnabled}
                                                onChange={() => handleToggle(item.category, item.is_mandatory)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-12 h-6 bg-dark-canvas border border-white/10 rounded-full shadow-neu-inset peer peer-checked:bg-cyan-500/20 peer-checked:border-cyan-500/50 transition-all duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-200 after:shadow-neu-dark peer-checked:after:translate-x-6 peer-checked:after:bg-cyan-400 peer-checked:after:shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
                                        </label>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Audit Separation Notice */}
                <div className="p-4 rounded-xl border border-border bg-card/50 text-xs text-muted-foreground flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                        <strong className="text-foreground">Architectural Guarantee:</strong> In-app notification preferences govern user UX delivery only. Business audit logs and immutable ledger records are independently preserved for system governance regardless of notification settings.
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
