import React, { useState, useRef } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Category, Product, ProductImage, ProductStatus, ProductStatusOption, TaxProfileSelectOption } from '@/types';
import {
    Package,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    DollarSign,
    Tag,
    Lock,
    Save,
    Upload,
    Trash2,
    Star,
    ImageIcon,
    X,
    FileCheck,
    Receipt,
    Scan,
} from 'lucide-react';
import BarcodeScannerModal from '@/Components/Barcode/BarcodeScannerModal';

interface ProductEditProps {
    product: Product;
    categories: Category[];
    taxProfiles: TaxProfileSelectOption[];
    statuses: ProductStatusOption[];
    can: {
        updatePrice: boolean;
        updateTax: boolean;
    };
}

interface ProductEditFormData {
    sku: string;
    barcode: string;
    barcode_type: string;
    name: string;
    description: string;
    category_id: string;
    tax_profile_id: string;
    unit: string;
    status: ProductStatus;
    cost_price: string;
    minimum_allowed_price: string;
    default_selling_price: string;
    mrp: string;
}

export default function ProductEdit({
    product,
    categories,
    taxProfiles,
    statuses,
    can,
}: ProductEditProps) {
    const [scannerOpen, setScannerOpen] = useState(false);

    const { data, setData, put, processing, errors } = useForm<ProductEditFormData>({
        sku: product.sku || '',
        barcode: product.barcode || '',
        barcode_type: product.barcode_type || 'CODE-128',
        name: product.name || '',
        description: product.description || '',
        category_id: product.category_id ? product.category_id.toString() : '',
        tax_profile_id: product.tax_profile_id ? product.tax_profile_id.toString() : '',
        unit: product.unit || 'PCS',
        status: product.status || 'ACTIVE',
        cost_price: product.cost_price !== null && product.cost_price !== undefined ? product.cost_price.toString() : '',
        minimum_allowed_price: product.minimum_allowed_price ? product.minimum_allowed_price.toString() : '',
        default_selling_price: product.default_selling_price ? product.default_selling_price.toString() : '',
        mrp: product.mrp ? product.mrp.toString() : '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [uploadIsPrimary, setUploadIsPrimary] = useState(false);
    const [uploadSortOrder, setUploadSortOrder] = useState('0');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);

    const [deleteTargetImage, setDeleteTargetImage] = useState<ProductImage | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSettingPrimary, setIsSettingPrimary] = useState<number | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    const images: ProductImage[] = product.images || [];

    const processFile = (file: File | null) => {
        setUploadErrorMessage(null);

        if (!file) {
            setSelectedFile(null);
            setFilePreview(null);
            return;
        }

        // Client-side quick check
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setUploadErrorMessage('Only JPEG, PNG, and WebP image files are allowed. SVG and other file types are prohibited.');
            setSelectedFile(null);
            setFilePreview(null);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setUploadErrorMessage('File size exceeds the 5MB maximum limit.');
            setSelectedFile(null);
            setFilePreview(null);
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        processFile(file);
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0] || null;
        if (file) {
            processFile(file);
        }
    };

    const handleUploadSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        setIsUploading(true);
        setUploadErrorMessage(null);

        const formData = new FormData();
        formData.append('image', selectedFile);
        if (uploadIsPrimary) {
            formData.append('is_primary', '1');
        }
        formData.append('sort_order', uploadSortOrder);

        router.post(`/products/${product.id}/images`, formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setIsUploading(false);
                setSelectedFile(null);
                setFilePreview(null);
                setUploadIsPrimary(false);
                setUploadSortOrder('0');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            },
            onError: (errs) => {
                setIsUploading(false);
                const firstErr = Object.values(errs)[0];
                setUploadErrorMessage(firstErr || 'Failed to upload image. Please try again.');
            },
        });
    };

    const handleSetPrimary = (image: ProductImage) => {
        if (image.is_primary) return;

        setIsSettingPrimary(image.id);
        router.patch(
            `/products/${product.id}/images/${image.id}/primary`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsSettingPrimary(null),
            }
        );
    };

    const handleDeleteImage = () => {
        if (!deleteTargetImage) return;

        setIsDeleting(true);
        router.delete(`/products/${product.id}/images/${deleteTargetImage.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsDeleting(false);
                setDeleteTargetImage(null);
            },
            onError: () => {
                setIsDeleting(false);
            },
        });
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(2)} MB`;
    };

    const standardUnits = ['PCS', 'BOX', 'CASE', 'KG', 'LTR', 'PACK', 'DOZEN', 'SET', 'MTR', 'BAG'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/products/${product.id}`);
    };

    // Helper calculations for visual feedback
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
        <AppLayout title={`Edit Product: ${product.sku}`}>
            <Head title={`Edit Product ${product.sku}`} />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Top Navigation */}
                <div className="flex items-center justify-between">
                    <Link
                        href={`/products/${product.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Product Details
                    </Link>
                </div>

                {/* Header */}
                <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        <span>Master Data Update / SKU: {product.sku}</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Edit Master Product
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Modify product attributes, categorization, status, or commercial pricing structure.
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
                                Unique SKU, product naming, classification, and unit specification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* SKU */}
                                <div>
                                    <Label htmlFor="sku" className="text-xs font-medium">
                                        Stock Keeping Unit (SKU) <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="sku"
                                        type="text"
                                        value={data.sku}
                                        onChange={(e) => setData('sku', e.target.value.toUpperCase())}
                                        className="font-mono mt-1 uppercase"
                                    />
                                    {errors.sku && (
                                        <p className="text-destructive text-xs mt-1">{errors.sku}</p>
                                    )}
                                </div>

                                {/* Status */}
                                <div>
                                    <Label htmlFor="status" className="text-xs font-medium">
                                        Lifecycle Status <span className="text-destructive">*</span>
                                    </Label>
                                    <select
                                        id="status"
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value as any)}
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
                                    <Input
                                        id="unit"
                                        type="text"
                                        value={data.unit}
                                        onChange={(e) => setData('unit', e.target.value.toUpperCase())}
                                        className="font-mono uppercase mt-1"
                                    />
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
                                    {!can.updateTax ? (
                                        <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                                            <Lock className="h-3 w-3" /> Requires product.tax.update
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-mono text-muted-foreground">Product-Specific (V1)</span>
                                    )}
                                </div>
                                <select
                                    id="tax_profile_id"
                                    value={data.tax_profile_id}
                                    disabled={!can.updateTax}
                                    onChange={(e) => setData('tax_profile_id', e.target.value)}
                                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs disabled:opacity-60"
                                >
                                    <option value="">-- No Tax Profile (Tax-Free / Direct) --</option>
                                    {taxProfiles.map((tp) => (
                                        <option key={tp.id} value={tp.id.toString()}>
                                            {tp.name} [{tp.code}] — {parseFloat(tp.rate).toFixed(4)}%
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Assigning a profile dictates line-level tax calculation (ROUND_HALF_UP). Deactivated profiles cannot be newly selected.
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
                                {!can.updatePrice && (
                                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                                        <Lock className="h-3 w-3" /> Requires product.price.update
                                    </span>
                                )}
                            </div>
                            <CardDescription className="text-xs">
                                Enforces: 0 ≤ Cost Price | 0 &lt; Min Allowed Price ≤ Default Selling Price ≤ MRP / List Price.
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
                                            disabled={!can.updatePrice}
                                            value={data.cost_price}
                                            onChange={(e) => setData('cost_price', e.target.value)}
                                            className="font-mono pl-7 disabled:opacity-60"
                                        />
                                    </div>
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
                                            disabled={!can.updatePrice}
                                            value={data.minimum_allowed_price}
                                            onChange={(e) => setData('minimum_allowed_price', e.target.value)}
                                            className="font-mono pl-7 disabled:opacity-60"
                                        />
                                    </div>
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
                                            disabled={!can.updatePrice}
                                            value={data.default_selling_price}
                                            onChange={(e) => setData('default_selling_price', e.target.value)}
                                            className="font-mono pl-7 font-semibold disabled:opacity-60"
                                        />
                                    </div>
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
                                            disabled={!can.updatePrice}
                                            value={data.mrp}
                                            onChange={(e) => setData('mrp', e.target.value)}
                                            className="font-mono pl-7 disabled:opacity-60"
                                        />
                                    </div>
                                    {errors.mrp && (
                                        <p className="text-destructive text-xs mt-1">{errors.mrp}</p>
                                    )}
                                </div>
                            </div>

                            {/* Pricing Feedback */}
                            {can.updatePrice && (data.minimum_allowed_price || data.default_selling_price || data.mrp) && (
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
                                            Cost (${costNum.toFixed(2)}) ≤ Floor [${minNum.toFixed(2)}] ≤ Selling [${sellNum.toFixed(2)}] ≤ Ceiling [MRP: ${mrpNum.toFixed(2)}]
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

                    {/* Product Images Management Card */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ImageIcon className="h-4 w-4 text-primary" />
                                Product Images & Assets (Private S3 Storage)
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Upload and manage product catalog images. The first uploaded image is automatically designated as the primary image. Allowed: JPEG, PNG, WebP (Max 5MB). SVG is prohibited.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Upload Section / Dropzone */}
                            <div
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`p-4 rounded-lg border border-dashed transition-all duration-200 space-y-4 ${
                                    isDragging
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                                        : 'border-border/80 bg-muted/20 hover:border-border'
                                }`}
                            >
                                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Upload className={`h-4 w-4 transition-colors ${isDragging ? 'text-primary scale-110' : 'text-primary'}`} />
                                        <span>Upload New Product Image</span>
                                    </div>
                                    {isDragging && (
                                        <span className="text-[11px] font-medium text-primary animate-pulse">
                                            Drop image file to select
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                    {/* File Picker & Dropzone */}
                                    <div className="md:col-span-8 space-y-2">
                                        <input
                                            ref={fileInputRef}
                                            id="product_image_input"
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleFileChange}
                                            className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Supported: JPEG, PNG, WebP · Max File Size: 5MB. Drag and drop file or browse. Magic bytes verified server-side.
                                        </p>

                                        {uploadErrorMessage && (
                                            <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded-md">
                                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                <span>{uploadErrorMessage}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Preview & Options */}
                                    <div className="md:col-span-4 space-y-3">
                                        {filePreview && (
                                            <div className="flex items-center gap-3 p-2 rounded-md border border-border bg-background">
                                                <img
                                                    src={filePreview}
                                                    alt="Preview"
                                                    className="h-14 w-14 object-cover rounded-md border border-border shrink-0"
                                                />
                                                <div className="overflow-hidden text-xs">
                                                    <p className="font-medium truncate text-foreground text-[11px]">
                                                        {selectedFile?.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {selectedFile ? formatBytes(selectedFile.size) : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <input
                                                id="upload_is_primary"
                                                type="checkbox"
                                                checked={uploadIsPrimary}
                                                onChange={(e) => setUploadIsPrimary(e.target.checked)}
                                                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                                            />
                                            <label htmlFor="upload_is_primary" className="text-xs text-foreground cursor-pointer">
                                                Set as primary image
                                            </label>
                                        </div>

                                        <Button
                                            type="button"
                                            onClick={handleUploadSubmit}
                                            disabled={!selectedFile || isUploading}
                                            size="sm"
                                            className="w-full text-xs shadow-xs gap-1.5"
                                        >
                                            <Upload className="h-3.5 w-3.5" />
                                            {isUploading ? 'Uploading to Private S3...' : 'Upload Image Asset'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Current Images List / Grid */}
                            <div className="space-y-3">
                                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span>Attached Catalog Images ({images.length})</span>
                                    <span className="text-[11px] font-mono text-muted-foreground">
                                        {images.filter((i) => i.is_primary).length > 0 ? '1 Primary Active' : 'No Primary Image'}
                                    </span>
                                </div>

                                {images.length === 0 ? (
                                    <div className="p-8 text-center rounded-md border border-border/80 bg-muted/10">
                                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                                        <p className="text-xs font-medium text-foreground">No images attached</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Upload an image above to set the hero catalog thumbnail.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {images.map((img) => (
                                            <div
                                                key={img.id}
                                                className={`relative rounded-lg border p-3 flex flex-col justify-between gap-3 transition-colors ${
                                                    img.is_primary
                                                        ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                                                        : 'bg-card border-border hover:border-border/80'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {img.url ? (
                                                        <img
                                                            src={img.url}
                                                            alt={img.original_filename}
                                                            className="h-16 w-16 object-cover rounded-md border border-border/80 bg-muted shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                                            <ImageIcon className="h-6 w-6" />
                                                        </div>
                                                    )}

                                                    <div className="overflow-hidden space-y-1 text-xs">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {img.is_primary ? (
                                                                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono gap-1">
                                                                    <Star className="h-2.5 w-2.5 fill-current" />
                                                                    Primary
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                                                                    Gallery
                                                                </Badge>
                                                            )}
                                                            <span className="text-[10px] font-mono text-muted-foreground">
                                                                {img.mime_type.replace('image/', '').toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <p className="font-mono text-[11px] truncate text-foreground" title={img.original_filename}>
                                                            {img.original_filename}
                                                        </p>
                                                        <p className="text-[10px] font-mono text-muted-foreground">
                                                            {formatBytes(img.size_bytes)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-2">
                                                    {!img.is_primary ? (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleSetPrimary(img)}
                                                            disabled={isSettingPrimary === img.id}
                                                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                                                        >
                                                            <Star className="h-3 w-3" />
                                                            {isSettingPrimary === img.id ? 'Setting...' : 'Set Primary'}
                                                        </Button>
                                                    ) : (
                                                        <span className="text-[11px] font-mono text-primary flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> Hero Image
                                                        </span>
                                                    )}

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeleteTargetImage(img)}
                                                        className="h-7 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 ml-auto"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Form Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Link href={`/products/${product.id}`}>
                            <Button variant="outline" type="button" disabled={processing}>
                                Cancel
                            </Button>
                        </Link>
                        <Button type="submit" disabled={processing} className="shadow-xs gap-2">
                            <Save className="h-4 w-4" />
                            {processing ? 'Saving Changes...' : 'Save Product Changes'}
                        </Button>
                    </div>
                </form>

                {/* Delete Confirmation Modal */}
                {deleteTargetImage && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirm Delete Image"
                    >
                        <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
                            <div className="px-6 py-4 border-b border-border">
                                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    Delete Product Image
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    This asset will be permanently removed from private cloud storage.
                                </p>
                            </div>

                            <div className="p-6 space-y-4 text-xs">
                                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40 border border-border">
                                    {deleteTargetImage.url ? (
                                        <img
                                            src={deleteTargetImage.url}
                                            alt={deleteTargetImage.original_filename}
                                            className="h-12 w-12 object-cover rounded-md border border-border shrink-0"
                                        />
                                    ) : (
                                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                            <ImageIcon className="h-5 w-5" />
                                        </div>
                                    )}
                                    <div className="overflow-hidden">
                                        <p className="font-mono font-medium text-foreground truncate">
                                            {deleteTargetImage.original_filename}
                                        </p>
                                        <p className="text-muted-foreground font-mono text-[11px]">
                                            {formatBytes(deleteTargetImage.size_bytes)} · {deleteTargetImage.mime_type}
                                        </p>
                                    </div>
                                </div>

                                {deleteTargetImage.is_primary && images.length > 1 && (
                                    <div className="p-3 rounded-md bg-amber-950/20 border border-amber-800/40 text-amber-300 text-[11px] flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>
                                            <strong>Primary Image Notice:</strong> Deleting the primary image will automatically promote the next available image in the gallery to primary.
                                        </span>
                                    </div>
                                )}

                                <p className="text-muted-foreground">
                                    Are you sure you want to delete this image? This operation cannot be undone.
                                </p>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setDeleteTargetImage(null)}
                                        disabled={isDeleting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={handleDeleteImage}
                                        disabled={isDeleting}
                                        className="shadow-xs gap-1.5"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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
