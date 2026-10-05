import React, { FormEventHandler, useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { CustomerStatusOption, EligibleSalesman, PaymentTermsOption, PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import {
    Building2,
    MapPin,
    Phone,
    Mail,
    CreditCard,
    ArrowLeft,
    Loader2,
    Save,
    AlertCircle,
    Copy,
    UserCheck,
} from 'lucide-react';

interface CustomerCreateProps {
    suggestedCode: string;
    statuses: CustomerStatusOption[];
    paymentTerms: PaymentTermsOption[];
    eligibleSalesmen?: EligibleSalesman[];
    isSalesman?: boolean;
}

export default function CustomerCreate({ suggestedCode, statuses, paymentTerms, eligibleSalesmen = [], isSalesman = false }: CustomerCreateProps) {
    const { auth } = usePage<PageProps>().props;
    const isUserSalesman = isSalesman || auth?.user?.role === 'SALESMAN';
    const [sameAsBilling, setSameAsBilling] = useState(true);

    const { data, setData, post, processing, errors } = useForm({
        code: suggestedCode || '',
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        salesman_id: '',
        billing_address_line1: '',
        billing_address_line2: '',
        billing_city: '',
        billing_state: '',
        billing_postal_code: '',
        billing_country: 'US',
        shipping_address_line1: '',
        shipping_address_line2: '',
        shipping_city: '',
        shipping_state: '',
        shipping_postal_code: '',
        shipping_country: 'US',
        tax_id: '',
        credit_limit: '0.00',
        payment_terms: 'NET_30',
        status: 'ACTIVE',
        notes: '',
    });

    const handleBillingChange = (field: string, value: string) => {
        setData((prev) => {
            const updated = { ...prev, [field]: value };
            if (sameAsBilling) {
                if (field === 'billing_address_line1') updated.shipping_address_line1 = value;
                if (field === 'billing_address_line2') updated.shipping_address_line2 = value;
                if (field === 'billing_city') updated.shipping_city = value;
                if (field === 'billing_state') updated.shipping_state = value;
                if (field === 'billing_postal_code') updated.shipping_postal_code = value;
                if (field === 'billing_country') updated.shipping_country = value;
            }
            return updated;
        });
    };

    const handleSameAsBillingToggle = (checked: boolean) => {
        setSameAsBilling(checked);
        if (checked) {
            setData((prev) => ({
                ...prev,
                shipping_address_line1: prev.billing_address_line1,
                shipping_address_line2: prev.billing_address_line2,
                shipping_city: prev.billing_city,
                shipping_state: prev.billing_state,
                shipping_postal_code: prev.billing_postal_code,
                shipping_country: prev.billing_country,
            }));
        }
    };

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/customers');
    };

    return (
        <AppLayout title="Add Customer Account">
            <Head title="Create New Customer" />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-2 border-b border-border">
                    <Link href="/customers" className="shrink-0">
                        <Button variant="outline" size="sm" className="h-8 px-2">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Directory
                        </Button>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold tracking-tight text-foreground">
                            Register Customer Account
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Add a new wholesale buyer account, physical delivery destination, and credit parameters.
                        </p>
                    </div>
                </div>

                {/* Validation Summary Error Alert */}
                {Object.keys(errors).length > 0 && (
                    <div className="flex items-start gap-2 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        <div className="space-y-1">
                            <span className="font-semibold">Unable to register customer. Please fix errors:</span>
                            <ul className="list-disc list-inside text-xs space-y-0.5">
                                {Object.entries(errors).map(([k, err]) => (
                                    <li key={k}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Account Identity & Primary Contact */}
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <CardTitle className="text-base font-semibold">Account Identity & Contact</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Unique customer identification, legal company name, and key operational contact.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="code" className="text-xs font-medium text-foreground">
                                        Customer Code <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="code"
                                        type="text"
                                        value={data.code}
                                        onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                        placeholder="CUST-00001"
                                        required
                                        disabled={processing}
                                        className={`font-mono ${errors.code ? 'border-destructive' : ''}`}
                                    />
                                    {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
                                </div>

                                <div className="space-y-1.5 sm:col-span-2">
                                    <label htmlFor="name" className="text-xs font-medium text-foreground">
                                        Company / Account Name <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="e.g. Metro Supermarket Group"
                                        required
                                        disabled={processing}
                                        className={errors.name ? 'border-destructive' : ''}
                                    />
                                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="contact_name" className="text-xs font-medium text-foreground">
                                        Primary Contact <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="contact_name"
                                        type="text"
                                        value={data.contact_name}
                                        onChange={(e) => setData('contact_name', e.target.value)}
                                        placeholder="e.g. Sarah Jenkins"
                                        required
                                        disabled={processing}
                                        className={errors.contact_name ? 'border-destructive' : ''}
                                    />
                                    {errors.contact_name && <p className="text-xs text-destructive">{errors.contact_name}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="phone" className="text-xs font-medium text-foreground flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                        Phone Number <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        placeholder="+1 (555) 019-2834"
                                        required
                                        disabled={processing}
                                        className={errors.phone ? 'border-destructive' : ''}
                                    />
                                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                        Billing / Orders Email
                                    </label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="buyer@metrosuper.com"
                                        disabled={processing}
                                        className={errors.email ? 'border-destructive' : ''}
                                    />
                                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section 2: Billing Address */}
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <CardTitle className="text-base font-semibold">Physical / Billing Address</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Registered physical headquarters and invoice billing destination.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label htmlFor="billing_address_line1" className="text-xs font-medium text-foreground">
                                        Street Address <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="billing_address_line1"
                                        type="text"
                                        value={data.billing_address_line1}
                                        onChange={(e) => handleBillingChange('billing_address_line1', e.target.value)}
                                        placeholder="123 Commerce Way"
                                        required
                                        disabled={processing}
                                        className={errors.billing_address_line1 ? 'border-destructive' : ''}
                                    />
                                    {errors.billing_address_line1 && (
                                        <p className="text-xs text-destructive">{errors.billing_address_line1}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5 sm:col-span-2">
                                    <label htmlFor="billing_address_line2" className="text-xs font-medium text-foreground">
                                        Suite / Floor / Unit (Optional)
                                    </label>
                                    <Input
                                        id="billing_address_line2"
                                        type="text"
                                        value={data.billing_address_line2}
                                        onChange={(e) => handleBillingChange('billing_address_line2', e.target.value)}
                                        placeholder="Building 4, Suite 200"
                                        disabled={processing}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="billing_city" className="text-xs font-medium text-foreground">
                                        City <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="billing_city"
                                        type="text"
                                        value={data.billing_city}
                                        onChange={(e) => handleBillingChange('billing_city', e.target.value)}
                                        placeholder="Atlanta"
                                        required
                                        disabled={processing}
                                        className={errors.billing_city ? 'border-destructive' : ''}
                                    />
                                    {errors.billing_city && <p className="text-xs text-destructive">{errors.billing_city}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="billing_state" className="text-xs font-medium text-foreground">
                                        State / Province <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="billing_state"
                                        type="text"
                                        value={data.billing_state}
                                        onChange={(e) => handleBillingChange('billing_state', e.target.value)}
                                        placeholder="GA"
                                        required
                                        disabled={processing}
                                        className={errors.billing_state ? 'border-destructive' : ''}
                                    />
                                    {errors.billing_state && <p className="text-xs text-destructive">{errors.billing_state}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="billing_postal_code" className="text-xs font-medium text-foreground">
                                        Postal / ZIP Code <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="billing_postal_code"
                                        type="text"
                                        value={data.billing_postal_code}
                                        onChange={(e) => handleBillingChange('billing_postal_code', e.target.value)}
                                        placeholder="30301"
                                        required
                                        disabled={processing}
                                        className={errors.billing_postal_code ? 'border-destructive' : ''}
                                    />
                                    {errors.billing_postal_code && (
                                        <p className="text-xs text-destructive">{errors.billing_postal_code}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="billing_country" className="text-xs font-medium text-foreground">
                                        Country Code <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="billing_country"
                                        type="text"
                                        maxLength={2}
                                        value={data.billing_country}
                                        onChange={(e) => handleBillingChange('billing_country', e.target.value.toUpperCase())}
                                        placeholder="US"
                                        required
                                        disabled={processing}
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section 3: Shipping / Delivery Address */}
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-base font-semibold">Delivery / Shipping Destination</CardTitle>
                                </div>

                                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={sameAsBilling}
                                        onChange={(e) => handleSameAsBillingToggle(e.target.checked)}
                                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                                    />
                                    <span>Same as billing address</span>
                                </label>
                            </div>
                            <CardDescription className="text-xs">
                                Warehouse, dock, or store address for driver delivery routing.
                            </CardDescription>
                        </CardHeader>

                        {!sameAsBilling && (
                            <CardContent className="space-y-4 pt-0">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label htmlFor="shipping_address_line1" className="text-xs font-medium text-foreground">
                                            Delivery Address Line 1
                                        </label>
                                        <Input
                                            id="shipping_address_line1"
                                            type="text"
                                            value={data.shipping_address_line1}
                                            onChange={(e) => setData('shipping_address_line1', e.target.value)}
                                            placeholder="Receiving Dock 2, 450 Logistics Blvd"
                                            disabled={processing}
                                        />
                                    </div>

                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label htmlFor="shipping_address_line2" className="text-xs font-medium text-foreground">
                                            Dock / Bay / Instructions (Optional)
                                        </label>
                                        <Input
                                            id="shipping_address_line2"
                                            type="text"
                                            value={data.shipping_address_line2}
                                            onChange={(e) => setData('shipping_address_line2', e.target.value)}
                                            placeholder="Gate 3, ring buzzer"
                                            disabled={processing}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="shipping_city" className="text-xs font-medium text-foreground">
                                            City
                                        </label>
                                        <Input
                                            id="shipping_city"
                                            type="text"
                                            value={data.shipping_city}
                                            onChange={(e) => setData('shipping_city', e.target.value)}
                                            placeholder="Atlanta"
                                            disabled={processing}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="shipping_state" className="text-xs font-medium text-foreground">
                                            State / Province
                                        </label>
                                        <Input
                                            id="shipping_state"
                                            type="text"
                                            value={data.shipping_state}
                                            onChange={(e) => setData('shipping_state', e.target.value)}
                                            placeholder="GA"
                                            disabled={processing}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="shipping_postal_code" className="text-xs font-medium text-foreground">
                                            Postal / ZIP Code
                                        </label>
                                        <Input
                                            id="shipping_postal_code"
                                            type="text"
                                            value={data.shipping_postal_code}
                                            onChange={(e) => setData('shipping_postal_code', e.target.value)}
                                            placeholder="30301"
                                            disabled={processing}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="shipping_country" className="text-xs font-medium text-foreground">
                                            Country Code
                                        </label>
                                        <Input
                                            id="shipping_country"
                                            type="text"
                                            maxLength={2}
                                            value={data.shipping_country}
                                            onChange={(e) => setData('shipping_country', e.target.value.toUpperCase())}
                                            placeholder="US"
                                            disabled={processing}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* Section 4: Commercial Terms & Lifecycle */}
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-primary" />
                                <CardTitle className="text-base font-semibold">Commercial Terms & Lifecycle</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Credit limits, payment terms, tax identifier, and initial lifecycle status.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="credit_limit" className="text-xs font-medium text-foreground">
                                        Credit Limit ($ USD) <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="credit_limit"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.credit_limit}
                                        onChange={(e) => setData('credit_limit', e.target.value)}
                                        placeholder="10000.00"
                                        required
                                        disabled={processing}
                                        className={errors.credit_limit ? 'border-destructive font-mono' : 'font-mono'}
                                    />
                                    {errors.credit_limit && <p className="text-xs text-destructive">{errors.credit_limit}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="payment_terms" className="text-xs font-medium text-foreground">
                                        Payment Terms <span className="text-destructive">*</span>
                                    </label>
                                    <select
                                        id="payment_terms"
                                        value={data.payment_terms}
                                        onChange={(e) => setData('payment_terms', e.target.value)}
                                        disabled={processing}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                    >
                                        {paymentTerms.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.payment_terms && <p className="text-xs text-destructive">{errors.payment_terms}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="status" className="text-xs font-medium text-foreground">
                                        Lifecycle Status <span className="text-destructive">*</span>
                                    </label>
                                    <select
                                        id="status"
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value)}
                                        disabled={processing}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                    >
                                        {statuses.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5 sm:col-span-1">
                                    <label htmlFor="salesman_id" className="text-xs font-medium text-foreground flex items-center gap-1">
                                        <UserCheck className="h-3.5 w-3.5 text-primary" />
                                        Sales Representative
                                    </label>
                                    {isUserSalesman ? (
                                        <div className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 py-1 flex items-center text-xs text-foreground">
                                            <span className="font-semibold text-primary">{auth?.user?.name || 'You'}</span>
                                            <span className="text-muted-foreground ml-1.5 text-[11px]">(Direct Portfolio Attribution)</span>
                                        </div>
                                    ) : (
                                        <select
                                            id="salesman_id"
                                            value={data.salesman_id}
                                            onChange={(e) => setData('salesman_id', e.target.value)}
                                            disabled={processing}
                                            className={`w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring ${
                                                errors.salesman_id ? 'border-destructive' : ''
                                            }`}
                                        >
                                            <option value="">Unassigned (No Sales Rep)</option>
                                            {eligibleSalesmen.map((slm) => (
                                                <option key={slm.id} value={slm.id}>
                                                    {slm.name} ({slm.email})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {errors.salesman_id && <p className="text-xs text-destructive">{errors.salesman_id}</p>}
                                </div>

                                <div className="space-y-1.5 sm:col-span-2">
                                    <label htmlFor="tax_id" className="text-xs font-medium text-foreground">
                                        Tax / Resale Registration ID (Optional)
                                    </label>
                                    <Input
                                        id="tax_id"
                                        type="text"
                                        value={data.tax_id}
                                        onChange={(e) => setData('tax_id', e.target.value)}
                                        placeholder="e.g. GA-9876543"
                                        disabled={processing}
                                        className="font-mono"
                                    />
                                    {errors.tax_id && <p className="text-xs text-destructive">{errors.tax_id}</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="notes" className="text-xs font-medium text-foreground">
                                    Internal Notes / Account Instructions
                                </label>
                                <Input
                                    id="notes"
                                    type="text"
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    placeholder="Special handling, delivery windows, or discount tier"
                                    disabled={processing}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
                        <Link href="/customers" className="w-full sm:w-auto">
                            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={processing}>
                                Cancel
                            </Button>
                        </Link>

                        <Button type="submit" disabled={processing} className="w-full sm:w-auto">
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Registering Customer...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Register Customer
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
