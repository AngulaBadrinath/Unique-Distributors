import React, { useState, useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import BarcodeScannerModal from '@/Components/Barcode/BarcodeScannerModal';
import { Category, ProductStatusOption, TaxProfileSelectOption } from '@/types';
import {
    Package,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    DollarSign,
    Info,
    Layers,
    Tag,
    Lock,
    Receipt,
    Scan,
} from 'lucide-react';

interface ProductCreateProps {
    suggestedSku: string;
    categories: Category[];
    taxProfiles: TaxProfileSelectOption[];
    statuses: ProductStatusOption[];
}

export default function ProductCreate({
    suggestedSku,
    categories,
    taxProfiles,
    statuses,
}: ProductCreateProps) {
    const [scannerOpen, setScannerOpen] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        sku: suggestedSku || '',
        barcode: '',
        barcode_type: 'CODE-128',
        name: '',
        description: '',
        category_id: '',
        tax_profile_id: '',
        unit: 'PCS',
        status: 'ACTIVE',
        cost_price: '',
        minimum_allowed_price: '',
        default_selling_price: '',
        mrp: '',
    });

    // Check for pre-populated barcode from query parameter (e.g. from scanner not-found flow)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const initialBarcode = params.get('barcode');
            if (initialBarcode && !data.barcode) {
                setData('barcode', initialBarcode);
            }
        }
    }, []);

    const standardUnits = ['PCS', 'BOX', 'CASE', 'KG', 'LTR', 'PACK', 'DOZEN', 'SET', 'MTR', 'BAG'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/products');
    };

    // Client-side pricing validation hints (for user convenience only; server is authoritative)
    const costNum = parseFloat(data.cost_price) || 0;
    const minNum = parseFloat(data.minimum_allowed_price) || 0;
    const sellNum = parseFloat(data.default_selling_price) || 0;
    const mrpNum = parseFloat(data.mrp) || 0;

    const isPricingValid =
        minNum > 0 &&
        sellNum >= minNum &&
        mrpNum >= sellNum &&
        costNum >= 0;

    return (
        <AppLayout title="Add New Product">
            <Head title="Add New Product" />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Top Navigation */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/products"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Product Catalog
                    </Link>
                </div>

                {/* Header */}
                <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        <span>Master Data Creation</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Create Master Product
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Define product identity, unit representation, categorization, and commercial pricing boundaries.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* General Information Card */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Tag className="h-4 w-4 text-primary" />
                                Product Identity & Metadata
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Unique stock keeping unit, product title, unit specification, and classification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* SKU */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="sku" className="text-xs font-medium">
                                            Stock Keeping Unit (SKU) <span className="text-destructive">*</span>
                                        </Label>
                                        <span className="text-[11px] font-mono text-muted-foreground">Auto-suggested</span>
                                    </div>
                                    <Input
                                        id="sku"
                                        type="text"
                                        value={data.sku}
                                        onChange={(e) => setData('sku', e.target.value.toUpperCase())}
                                        placeholder="e.g. PROD-00001"
                                        className="font-mono mt-1 uppercase"
                                    />
                                    {errors.sku && (
                                        <p className="text-destructive text-xs mt-1">{errors.sku}</p>
                                    )}
                                </div>

                                {/* Status */}
                                <div>
                                    <Label htmlFor="status" className="text-xs font-medium">
                                        Initial Status <span className="text-destructive">*</span>
                                    </Label>
                                    <select
                                        id="status"
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value)}
                                        className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        {statuses.map((s) => (
                                             <option key={s.value} value={s.value}>
                                                 {s.label}
                                             </option>
                                        ))}
                                    </select>
                                    {errors.status && (
                                        <p className="text-destructive text-xs mt-1">{errors.status}</p>
                                    )}
                                </div>
                            </div>

                            {/* Barcode & Barcode Type */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                <div className="sm:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="barcode" className="text-xs font-medium">
                                            Barcode / UPC / EAN
                                        </Label>
                                        <span className="text-[11px] text-muted-foreground">Optional identifier</span>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            id="barcode"
                                            type="text"
                                            value={data.barcode}
                                            onChange={(e) => setData('barcode', e.target.value.trim())}
                                            placeholder="e.g. 012345678905 or scan barcode"
                                            className="font-mono"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setScannerOpen(true)}
                                            className="gap-1.5 shrink-0 px-3 text-xs"
                                        >
                                            <Scan className="h-3.5 w-3.5 text-primary" />
                                            <span>Scan</span>
                                        </Button>
                                    </div>
                                    {errors.barcode && (
                                        <p className="text-destructive text-xs mt-1">{errors.barcode}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="barcode_type" className="text-xs font-medium">
                                        Barcode Type
                                    </Label>
                                    <select
                                        id="barcode_type"
                                        value={data.barcode_type}
                                        onChange={(e) => setData('barcode_type', e.target.value)}
                                        className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="UPC-A">UPC-A (12 digits)</option>
                                        <option value="EAN-13">EAN-13 (13 digits)</option>
                                        <option value="CODE-128">Code 128 (Standard)</option>
                                        <option value="CODE-39">Code 39</option>
                                        <option value="ITF-14">ITF-14 (Case barcode)</option>
                                        <option value="CUSTOM">Custom / Other</option>
                                    </select>
                                    {errors.barcode_type && (
                                        <p className="text-destructive text-xs mt-1">{errors.barcode_type}</p>
                                    )}
                                </div>
                            </div>

                            {/* Product Name */}
                            <div>
                                <Label htmlFor="name" className="text-xs font-medium">
                                    Product Name / Title <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="e.g. Industrial Stainless Steel Fasteners 10mm"
                                    className="mt-1"
                                />
                                {errors.name && (
                                    <p className="text-destructive text-xs mt-1">{errors.name}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Unit of Measure */}
                                <div>
                                    <Label htmlFor="unit" className="text-xs font-medium">
                                        Unit of Measure (UOM) <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            id="unit"
                                            type="text"
                                            value={data.unit}
                                            onChange={(e) => setData('unit', e.target.value.toUpperCase())}
                                            placeholder="e.g. PCS, BOX, KG"
                                            className="font-mono uppercase"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {standardUnits.map((u) => (
                                            <button
                                                key={u}
                                                type="button"
                                                onClick={() => setData('unit', u)}
                                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                                                    data.unit === u
                                                        ? 'bg-primary/20 text-primary border-primary/40'
                                                        : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                                                }`}
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                    {errors.unit && (
                                        <p className="text-destructive text-xs mt-1">{errors.unit}</p>
                                    )}
                                </div>

                                {/* Category */}
                                <div>
                                    <Label htmlFor="category_id" className="text-xs font-medium">
                                        Category Classification
                                    </Label>
                                    <select
                                        id="category_id"
                                        value={data.category_id}
                                        onChange={(e) => setData('category_id', e.target.value)}
                                        className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">-- Uncategorized / None --</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id.toString()}>
                                                {c.hierarchy_path || c.name} ({c.code})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.category_id && (
                                        <p className="text-destructive text-xs mt-1">{errors.category_id}</p>
                                    )}
                                </div>
                            </div>

                            {/* Tax Profile */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="tax_profile_id" className="text-xs font-medium">
                                        Tax Profile & Calculation Rule
                                    </Label>
                                    <span className="text-[10px] font-mono text-muted-foreground">Optional / Product-Specific</span>
                                </div>
                                <select
                                    id="tax_profile_id"
                                    value={data.tax_profile_id}
                                    onChange={(e) => setData('tax_profile_id', e.target.value)}
                                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs"
                                >
                                    <option value="">-- No Tax Profile (Tax-Free / Direct) --</option>
                                    {taxProfiles.map((tp) => (
                                        <option key={tp.id} value={tp.id.toString()}>
                                            {tp.name} [{tp.code}] — {parseFloat(tp.rate).toFixed(4)}%
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Authoritative tax profile applied to line totals during order calculations.
                                </p>
                                {errors.tax_profile_id && (
                                    <p className="text-destructive text-xs mt-1">{errors.tax_profile_id}</p>
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <Label htmlFor="description" className="text-xs font-medium">
                                    Description & Specifications
                                </Label>
                                <textarea
                                    id="description"
                                    rows={3}
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    placeholder="Optional technical specifications, dimensions, packaging details..."
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {errors.description && (
                                    <p className="text-destructive text-xs mt-1">{errors.description}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Commercial Pricing Hierarchy Card */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-primary" />
                                    Commercial Pricing Hierarchy (RULE-PRI-002)
                                </CardTitle>
                                <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                    Server-Authoritative
                                </span>
                            </div>
                            <CardDescription className="text-xs">
                                Invariant Rule: 0 ≤ Cost Price | 0 &lt; Min Allowed Price ≤ Default Selling Price ≤ MRP / List Price.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {/* Cost Price */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="cost_price" className="text-xs font-medium">
                                            Cost Price <span className="text-destructive">*</span>
                                        </Label>
                                        <span className="text-[10px] font-mono text-amber-500/80 flex items-center gap-0.5">
                                            <Lock className="h-2.5 w-2.5" /> Confidential
                                        </span>
                                    </div>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">$</span>
                                        <Input
                                            id="cost_price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={data.cost_price}
                                            onChange={(e) => setData('cost_price', e.target.value)}
                                            placeholder="0.00"
                                            className="font-mono pl-7"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Masked for sales roles.</p>
                                    {errors.cost_price && (
                                        <p className="text-destructive text-xs mt-1">{errors.cost_price}</p>
                                    )}
                                </div>

                                {/* Minimum Allowed Price */}
                                <div>
                                    <Label htmlFor="minimum_allowed_price" className="text-xs font-medium">
                                        Min Allowed Price <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">$</span>
                                        <Input
                                            id="minimum_allowed_price"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={data.minimum_allowed_price}
                                            onChange={(e) => setData('minimum_allowed_price', e.target.value)}
                                            placeholder="0.00"
                                            className="font-mono pl-7"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Absolute floor price.</p>
                                    {errors.minimum_allowed_price && (
                                        <p className="text-destructive text-xs mt-1">{errors.minimum_allowed_price}</p>
                                    )}
                                </div>

                                {/* Default Selling Price */}
                                <div>
                                    <Label htmlFor="default_selling_price" className="text-xs font-medium">
                                        Default Selling Price <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">$</span>
                                        <Input
                                            id="default_selling_price"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={data.default_selling_price}
                                            onChange={(e) => setData('default_selling_price', e.target.value)}
                                            placeholder="0.00"
                                            className="font-mono pl-7 font-semibold"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Standard catalog rate.</p>
                                    {errors.default_selling_price && (
                                        <p className="text-destructive text-xs mt-1">{errors.default_selling_price}</p>
                                    )}
                                </div>

                                {/* MRP / List Price */}
                                <div>
                                    <Label htmlFor="mrp" className="text-xs font-medium">
                                        MRP / List Price <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">$</span>
                                        <Input
                                            id="mrp"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={data.mrp}
                                            onChange={(e) => setData('mrp', e.target.value)}
                                            placeholder="0.00"
                                            className="font-mono pl-7"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Maximum retail / ceiling.</p>
                                    {errors.mrp && (
                                        <p className="text-destructive text-xs mt-1">{errors.mrp}</p>
                                    )}
                                </div>
                            </div>

                            {/* Pricing Hierarchy Feedback Bar */}
                            {(data.minimum_allowed_price || data.default_selling_price || data.mrp) && (
                                <div
                                    className={`p-3 rounded-md border text-xs flex items-start gap-2.5 transition-colors ${
                                        isPricingValid
                                            ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                                            : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                                    }`}
                                >
                                    {isPricingValid ? (
                                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <div className="font-semibold font-mono text-[11px]">
                                            Pricing Hierarchy Validation:
                                        </div>
                                        <div className="font-mono text-[11px] mt-0.5">
                                            Cost (${costNum.toFixed(2)}) ≤ Floor [Min: ${minNum.toFixed(2)}] ≤ Selling [${sellNum.toFixed(2)}] ≤ Ceiling [MRP: ${mrpNum.toFixed(2)}]
                                        </div>
                                        {!isPricingValid && (
                                            <p className="text-[11px] text-amber-400 mt-1">
                                                Ensure: Min Allowed &gt; $0.00, Selling Price ≥ Min Allowed, and MRP ≥ Selling Price.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Form Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Link href="/products">
                            <Button variant="outline" type="button" disabled={processing}>
                                Cancel
                            </Button>
                        </Link>
                        <Button type="submit" disabled={processing} className="shadow-xs gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            {processing ? 'Saving Product...' : 'Create Master Product'}
                        </Button>
                    </div>
                </form>

                {/* Inline Scanner Modal */}
                <BarcodeScannerModal
                    isOpen={scannerOpen}
                    onClose={() => setScannerOpen(false)}
                    onProductSelected={(p) => {
                        if (p.barcode) {
                            setData('barcode', p.barcode);
                            if (p.barcode_type) setData('barcode_type', p.barcode_type);
                        }
                    }}
                    autoRedirectToEdit={false}
                />
            </div>
        </AppLayout>
    );
}
