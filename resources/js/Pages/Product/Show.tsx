import React, { useState, useEffect, useCallback } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Label } from '@/Components/ui/label';
import { PageProps, Product, ProductImage, ProductStatus, ProductStatusOption } from '@/types';
import {
    Package,
    ArrowLeft,
    Edit,
    CheckCircle2,
    Clock,
    AlertCircle,
    DollarSign,
    Lock,
    Tag,
    Layers,
    Boxes,
    ShieldCheck,
    Calendar,
    FileText,
    TrendingUp,
    ShieldAlert,
    ImageIcon,
    ZoomIn,
    X,
    ChevronLeft,
    ChevronRight,
    Star,
    Barcode,
} from 'lucide-react';

interface ProductShowProps {
    product: Product;
    statuses: ProductStatusOption[];
    can: {
        update: boolean;
        updatePrice: boolean;
        updateTax: boolean;
    };
}

export default function ProductShow({
    product,
    statuses,
    can,
}: ProductShowProps) {
    const { auth } = usePage<PageProps>().props;
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const images: ProductImage[] = product.images || [];
    const primaryIndex = images.findIndex((img) => img.is_primary);
    const [selectedIndex, setSelectedIndex] = useState(primaryIndex >= 0 ? primaryIndex : 0);

    const activeImage: ProductImage | undefined = images[selectedIndex];

    const isPrivileged = auth?.user?.role === 'SUPER_ADMIN' || auth?.user?.role === 'ADMIN';

    const statusForm = useForm<{
        status: ProductStatus;
        reason: string;
    }>({
        status: product.status,
        reason: '',
    });

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!lightboxOpen) return;
            if (e.key === 'Escape') {
                setLightboxOpen(false);
            } else if (e.key === 'ArrowRight' && images.length > 1) {
                setSelectedIndex((prev) => (prev + 1) % images.length);
            } else if (e.key === 'ArrowLeft' && images.length > 1) {
                setSelectedIndex((prev) => (prev - 1 + images.length) % images.length);
            }
        },
        [lightboxOpen, images.length]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const formatCurrency = (amount: number | string | null | undefined) => {
        if (amount === null || amount === undefined || amount === '') {
            return null;
        }
        const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(numeric)) return null;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numeric);
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(2)} MB`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleStatusSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        statusForm.patch(`/products/${product.id}/status`, {
            onSuccess: () => {
                setStatusModalOpen(false);
                statusForm.reset('reason');
            },
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/60 text-xs font-mono">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Active Catalog Product
                    </Badge>
                );
            case 'INACTIVE':
                return (
                    <Badge variant="outline" className="bg-zinc-800/60 text-zinc-400 border-zinc-700 text-xs font-mono">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Inactive / Blocked
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="text-xs font-mono">
                        {status}
                    </Badge>
                );
        }
    };

    // Calculate margins if cost price is available (UX display only)
    const costNum = product.cost_price !== null && product.cost_price !== undefined ? Number(product.cost_price) : null;
    const sellingNum = Number(product.default_selling_price) || 0;
    const grossMargin = costNum !== null && sellingNum > 0
        ? ((sellingNum - costNum) / sellingNum) * 100
        : null;

    return (
        <AppLayout title={`Product: ${product.sku} — ${product.name}`}>
            <Head title={`Product ${product.sku} — ${product.name}`} />

            <div className="space-y-6">
                {/* Top Navigation */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/products"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Product Catalog
                    </Link>

                    <div className="flex items-center gap-2">
                        {can.update && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStatusModalOpen(true)}
                                    className="h-8 text-xs font-mono"
                                >
                                    Change Status
                                </Button>
                                <Link href={`/products/${product.id}/edit`}>
                                    <Button size="sm" className="h-8 text-xs gap-1.5 shadow-xs">
                                        <Edit className="h-3.5 w-3.5" />
                                        Edit Product & Images
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Hero Product & Gallery Card */}
                <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left: Image Gallery (4 cols) */}
                        <div className="lg:col-span-4 space-y-3">
                            <div className="relative group rounded-lg border border-border overflow-hidden bg-muted/30 aspect-square flex items-center justify-center">
                                {activeImage?.url ? (
                                    <>
                                        <img
                                            src={activeImage.url}
                                            alt={product.name}
                                            className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setLightboxOpen(true)}
                                            className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs shadow-md"
                                            title="Click to zoom / view lightbox"
                                        >
                                            <ZoomIn className="h-4 w-4" />
                                            <span>Zoom</span>
                                        </button>
                                        {activeImage.is_primary && (
                                            <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-mono px-2 py-0.5 rounded-sm font-semibold flex items-center gap-1 shadow-sm">
                                                <Star className="h-3 w-3 fill-current" />
                                                Primary Image
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-6 text-center">
                                        <Package className="h-16 w-16 mb-2 stroke-1" />
                                        <span className="text-xs font-mono font-medium text-muted-foreground">No Product Image</span>
                                        {can.update && (
                                            <Link href={`/products/${product.id}/edit`} className="mt-2">
                                                <span className="text-[11px] text-primary hover:underline">Upload in Edit view &rarr;</span>
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail strip if multiple images */}
                            {images.length > 1 && (
                                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                    {images.map((img, idx) => (
                                        <button
                                            key={img.id}
                                            type="button"
                                            onClick={() => setSelectedIndex(idx)}
                                            className={`relative h-14 w-14 shrink-0 rounded-md border-2 overflow-hidden transition-all ${
                                                selectedIndex === idx
                                                    ? 'border-primary ring-2 ring-primary/20 scale-105'
                                                    : 'border-border/80 opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            {img.url ? (
                                                <img src={img.url} alt={img.original_filename} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                            {img.is_primary && (
                                                <div className="absolute top-0 right-0 bg-primary h-2.5 w-2.5 rounded-bl-xs" title="Primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeImage && (
                                <div className="text-[11px] font-mono text-muted-foreground/80 flex items-center justify-between px-1">
                                    <span className="truncate max-w-[180px]" title={activeImage.original_filename}>
                                        {activeImage.original_filename}
                                    </span>
                                    <span>{formatBytes(activeImage.size_bytes)} · {activeImage.mime_type.replace('image/', '').toUpperCase()}</span>
                                </div>
                            )}
                        </div>

                        {/* Right: Product Metadata & Info (8 cols) */}
                        <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2.5 py-1 rounded border border-primary/20">
                                        {product.sku}
                                    </span>
                                    {product.barcode && (
                                        <span className="font-mono text-xs font-semibold text-foreground bg-accent/60 px-2.5 py-1 rounded border border-border flex items-center gap-1.5" title={`Barcode Format: ${product.barcode_type || 'AUTO'}`}>
                                            <Barcode className="w-3.5 h-3.5 text-primary" />
                                            {product.barcode}
                                            {product.barcode_type && (
                                                <span className="text-[10px] text-muted-foreground uppercase">({product.barcode_type})</span>
                                            )}
                                        </span>
                                    )}
                                    {getStatusBadge(product.status)}
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                        Unit: {product.unit}
                                    </span>
                                    {product.category ? (
                                        <Badge variant="outline" className="text-xs font-mono">
                                            Category: {product.category.name} ({product.category.code})
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic font-mono">
                                            Uncategorized
                                        </span>
                                    )}
                                    {product.tax_profile ? (
                                        <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/20">
                                            Tax: {product.tax_profile.name} [{product.tax_profile.code}] ({parseFloat(product.tax_profile.rate).toFixed(4)}%)
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic font-mono">
                                            No Tax Profile (Tax-Free)
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    {product.name}
                                </h1>

                                {product.description ? (
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {product.description}
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                        No description or technical specifications provided.
                                    </p>
                                )}
                            </div>

                            {/* Order Eligibility Callout */}
                            <div className="p-4 rounded-md border border-border/80 bg-muted/20">
                                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                    Order Readiness Contract
                                </div>
                                <div className="flex items-center gap-2">
                                    {product.status === 'ACTIVE' ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                            <span className="text-xs font-semibold text-emerald-400 font-mono">
                                                Eligible for Selection
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="h-4 w-4 text-amber-400" />
                                            <span className="text-xs font-semibold text-amber-400 font-mono">
                                                Ordering Disabled
                                            </span>
                                        </>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {product.status === 'ACTIVE'
                                        ? 'Product may participate in new orders.'
                                        : 'Product will fail ensureCanOrder() validation.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Commercial Pricing Hierarchy Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Cost Price */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                Cost Price
                            </CardTitle>
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {product.cost_price !== null ? (
                                <>
                                    <div className="text-xl font-bold font-mono text-foreground">
                                        {formatCurrency(product.cost_price)}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Confidential procurement cost.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="text-sm font-mono text-muted-foreground flex items-center gap-1.5 py-1">
                                        <Lock className="h-3.5 w-3.5 text-amber-500/80" />
                                        <span>Masked / Confidential</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Hidden for non-administrative roles.
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Minimum Allowed Price */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                Min Allowed Price
                            </CardTitle>
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-500/60" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-xl font-bold font-mono text-foreground">
                                {formatCurrency(product.minimum_allowed_price)}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Strict minimum selling floor.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Default Selling Price */}
                    <Card className="border-primary/40 bg-primary/5 shadow-xs">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">
                                Default Selling Price
                            </CardTitle>
                            <DollarSign className="h-3.5 w-3.5 text-primary" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-xl font-bold font-mono text-primary">
                                {formatCurrency(product.default_selling_price)}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Standard catalog invoice rate.
                            </p>
                        </CardContent>
                    </Card>

                    {/* MRP / List Price */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                MRP / List Price
                            </CardTitle>
                            <Tag className="h-3.5 w-3.5 text-muted-foreground/60" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-xl font-bold font-mono text-foreground">
                                {formatCurrency(product.mrp)}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Maximum retail ceiling.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Technical Metadata & Invariants Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Metadata & Attribution */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Master Record Attribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-border/60">
                                <span className="text-muted-foreground">Internal Product ID:</span>
                                <span className="font-mono font-medium text-foreground">#{product.id}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/60">
                                <span className="text-muted-foreground">Stock Keeping Unit (SKU):</span>
                                <span className="font-mono font-semibold text-primary">{product.sku}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/60">
                                <span className="text-muted-foreground">Category Classification:</span>
                                <span className="font-medium text-foreground">
                                    {product.category?.name || 'Uncategorized'}
                                </span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/60">
                                <span className="text-muted-foreground">Unit of Measure:</span>
                                <span className="font-mono text-foreground">{product.unit}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/60">
                                <span className="text-muted-foreground">Assigned Tax Profile:</span>
                                {product.tax_profile ? (
                                    <span className="font-mono text-foreground font-medium">
                                        {product.tax_profile.name} ({parseFloat(product.tax_profile.rate).toFixed(4)}%)
                                    </span>
                                ) : (
                                    <span className="font-mono text-muted-foreground italic">
                                        None (Tax-Free / Direct)
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/60">
                                <span className="text-muted-foreground">Created At:</span>
                                <span className="font-mono text-muted-foreground">{formatDate(product.created_at)}</span>
                            </div>
                            <div className="flex justify-between py-1.5">
                                <span className="text-muted-foreground">Last Updated:</span>
                                <span className="font-mono text-muted-foreground">{formatDate(product.updated_at)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Commercial Pricing Analysis (Privileged) */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Commercial Pricing Rules & Boundaries
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                            <div className="p-3 rounded-md bg-muted/40 border border-border space-y-2">
                                <div className="font-mono text-[11px] font-semibold text-foreground">
                                    Authoritative Pricing Invariant (RULE-PRI-002):
                                </div>
                                <div className="font-mono text-[11px] text-muted-foreground">
                                    0 ≤ Cost Price (${product.cost_price !== null ? Number(product.cost_price).toFixed(2) : '***'})
                                    <br />
                                    0 &lt; Min Price (${Number(product.minimum_allowed_price).toFixed(2)}) ≤ Selling (${Number(product.default_selling_price).toFixed(2)}) ≤ MRP (${Number(product.mrp).toFixed(2)})
                                </div>
                            </div>

                            {grossMargin !== null && isPrivileged && (
                                <div className="flex items-center justify-between p-3 rounded-md bg-emerald-950/20 border border-emerald-800/40 text-emerald-400">
                                    <span className="font-medium">Estimated Default Gross Margin:</span>
                                    <span className="font-mono font-bold text-sm">
                                        {grossMargin.toFixed(1)}%
                                    </span>
                                </div>
                            )}

                            <div className="space-y-1.5 text-muted-foreground text-[11px]">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                    <span>Historical transaction snapshotting enabled for future orders.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                    <span>Physical deletion prohibited — master records remain immutable.</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Lifecycle Status Change Dialog */}
            {statusModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
                        <div className="px-6 py-4 border-b border-border">
                            <h3 className="text-base font-semibold text-foreground">
                                Update Product Lifecycle Status
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Change catalog availability and order-eligibility state.
                            </p>
                        </div>

                        <form onSubmit={handleStatusSubmit} className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="dialog_status" className="text-xs font-medium">
                                    Target Status <span className="text-destructive">*</span>
                                </Label>
                                <select
                                    id="dialog_status"
                                    value={statusForm.data.status}
                                    onChange={(e) => statusForm.setData('status', e.target.value as ProductStatus)}
                                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    {statuses.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                                {statusForm.errors.status && (
                                    <p className="text-destructive text-xs mt-1">{statusForm.errors.status}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="dialog_reason" className="text-xs font-medium">
                                    Change Reason / Operational Note
                                </Label>
                                <textarea
                                    id="dialog_reason"
                                    rows={2}
                                    value={statusForm.data.reason}
                                    onChange={(e) => statusForm.setData('reason', e.target.value)}
                                    placeholder="Optional note for audit log..."
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {statusForm.errors.reason && (
                                    <p className="text-destructive text-xs mt-1">{statusForm.errors.reason}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setStatusModalOpen(false)}
                                    disabled={statusForm.processing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={statusForm.processing}
                                    className="shadow-xs"
                                >
                                    {statusForm.processing ? 'Updating...' : 'Confirm Status Transition'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Image Lightbox Dialog */}
            {lightboxOpen && activeImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in-50"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Product Image Lightbox"
                >
                    <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
                        {/* Lightbox Controls */}
                        <div className="w-full flex items-center justify-between pb-3 text-white">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-white/80">
                                    {selectedIndex + 1} of {images.length}
                                </span>
                                <span className="text-white/40">·</span>
                                <span className="text-xs font-mono text-white/90 truncate max-w-xs">
                                    {activeImage.original_filename}
                                </span>
                                {activeImage.is_primary && (
                                    <Badge variant="outline" className="bg-primary/30 text-primary-foreground border-primary/50 text-[10px] font-mono">
                                        Primary
                                    </Badge>
                                )}
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLightboxOpen(false)}
                                className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0 rounded-full"
                                title="Close (Esc)"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Full Size Image */}
                        <div className="relative w-full flex items-center justify-center bg-black/40 rounded-lg overflow-hidden max-h-[75vh]">
                            {images.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedIndex((prev) => (prev - 1 + images.length) % images.length)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black text-white p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                                    title="Previous Image (Left Arrow)"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </button>
                            )}

                            <img
                                src={activeImage.url || ''}
                                alt={activeImage.original_filename}
                                className="max-h-[72vh] max-w-full object-contain select-none"
                            />

                            {images.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedIndex((prev) => (prev + 1) % images.length)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black text-white p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                                    title="Next Image (Right Arrow)"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            )}
                        </div>

                        {/* Lightbox thumbnail row */}
                        {images.length > 1 && (
                            <div className="flex items-center gap-2 pt-3 overflow-x-auto max-w-full">
                                {images.map((img, idx) => (
                                    <button
                                        key={img.id}
                                        type="button"
                                        onClick={() => setSelectedIndex(idx)}
                                        className={`relative h-12 w-12 shrink-0 rounded-md border overflow-hidden transition-all ${
                                            selectedIndex === idx
                                                ? 'border-primary ring-2 ring-primary/40 scale-105'
                                                : 'border-white/20 opacity-50 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={img.url || ''} alt={img.original_filename} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
