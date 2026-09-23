import React, { useState, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import BarcodeScannerModal from '@/Components/Barcode/BarcodeScannerModal';
import { Category, PaginatedResponse, PageProps, Product, ProductStatusOption } from '@/types';
import {
    Package,
    Search,
    Plus,
    Filter,
    ChevronRight,
    ArrowUpDown,
    CheckCircle2,
    Clock,
    AlertCircle,
    Building2,
    Lock,
    Tag,
    Layers,
    DollarSign,
    Boxes,
    Scan,
} from 'lucide-react';

interface ProductIndexProps {
    products: PaginatedResponse<Product>;
    filters: {
        search: string;
        status: string;
        category_id: string;
        sort_by: string;
        sort_order: string;
    };
    statuses: ProductStatusOption[];
    categories: Category[];
    can: {
        create: boolean;
        update: boolean;
        updatePrice: boolean;
    };
}

export default function ProductIndex({
    products,
    filters,
    statuses,
    categories,
    can,
}: ProductIndexProps) {
    const { auth } = usePage<PageProps>().props;
    const [scannerOpen, setScannerOpen] = useState(false);
    const [search, setSearch] = useState(filters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'ALL');
    const [selectedCategory, setSelectedCategory] = useState(filters.category_id || 'ALL');

    const isPrivileged = auth?.user?.role === 'SUPER_ADMIN' || auth?.user?.role === 'ADMIN';

    // Debounced search handler
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== (filters.search || '')) {
                applyFilters({ search });
            }
        }, 350);

        return () => clearTimeout(timeout);
    }, [search]);

    const applyFilters = (newFilters: Partial<typeof filters>) => {
        router.get(
            '/products',
            {
                ...filters,
                ...newFilters,
                page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleSort = (field: string) => {
        const newOrder = filters.sort_by === field && filters.sort_order === 'asc' ? 'desc' : 'asc';
        applyFilters({ sort_by: field, sort_order: newOrder });
    };

    const formatCurrency = (amount: number | string | null | undefined) => {
        if (amount === null || amount === undefined || amount === '') {
            return '—';
        }
        const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(numeric)) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numeric);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/60 text-xs font-mono">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                    </Badge>
                );
            case 'INACTIVE':
                return (
                    <Badge variant="outline" className="bg-zinc-800/60 text-zinc-400 border-zinc-700 text-xs font-mono">
                        <Clock className="h-3 w-3 mr-1" />
                        Inactive
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

    return (
        <AppLayout title="Product Master Catalog">
            <Head title="Product Master Catalog" />

            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                            <Package className="h-3.5 w-3.5 text-primary" />
                            <span>Master Data Catalog</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Product Master Catalog
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Authoritative catalog for SKUs, commercial pricing hierarchy, and product lifecycle controls.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            variant="outline"
                            onClick={() => setScannerOpen(true)}
                            className="w-full sm:w-auto shadow-xs gap-2"
                        >
                            <Scan className="h-4 w-4 text-primary" />
                            Scan Barcode
                        </Button>

                        {can.create && (
                            <Link href="/products/create">
                                <Button className="w-full sm:w-auto shadow-xs gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add New Product
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <Card className="border-border shadow-xs bg-card">
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Search Input */}
                            <div className="relative md:col-span-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search by SKU, product name, or description..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 bg-background text-sm"
                                />
                            </div>

                            {/* Category Filter */}
                            <div>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        applyFilters({ category_id: e.target.value });
                                    }}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="ALL">All Categories</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id.toString()}>
                                            {c.name} ({c.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div>
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => {
                                        setSelectedStatus(e.target.value);
                                        applyFilters({ status: e.target.value });
                                    }}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="ALL">All Lifecycle Statuses</option>
                                    {statuses.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Active Filter Pills */}
                        {(filters.search || (filters.status && filters.status !== 'ALL') || (filters.category_id && filters.category_id !== 'ALL')) && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
                                <span className="text-muted-foreground font-mono">Active Filters:</span>
                                {filters.search && (
                                    <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                                        Query: "{filters.search}"
                                        <button
                                            onClick={() => {
                                                setSearch('');
                                                applyFilters({ search: '' });
                                            }}
                                            className="ml-1 hover:text-foreground"
                                        >
                                            ×
                                        </button>
                                    </Badge>
                                )}
                                {filters.category_id && filters.category_id !== 'ALL' && (
                                    <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                                        Category: {categories.find((c) => c.id.toString() === filters.category_id)?.name || filters.category_id}
                                        <button
                                            onClick={() => {
                                                setSelectedCategory('ALL');
                                                applyFilters({ category_id: 'ALL' });
                                            }}
                                            className="ml-1 hover:text-foreground"
                                        >
                                            ×
                                        </button>
                                    </Badge>
                                )}
                                {filters.status && filters.status !== 'ALL' && (
                                    <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                                        Status: {statuses.find((s) => s.value === filters.status)?.label || filters.status}
                                        <button
                                            onClick={() => {
                                                setSelectedStatus('ALL');
                                                applyFilters({ status: 'ALL' });
                                            }}
                                            className="ml-1 hover:text-foreground"
                                        >
                                            ×
                                        </button>
                                    </Badge>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSearch('');
                                        setSelectedCategory('ALL');
                                        setSelectedStatus('ALL');
                                        router.get('/products', {}, { preserveState: true });
                                    }}
                                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                    Reset All
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Products Table (Desktop & Tablet) */}
                <div className="hidden md:block rounded-lg border border-border bg-card shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/40 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th className="w-12 px-3 py-3 text-center">Image</th>
                                    <th className="px-4 py-3">
                                        <button
                                            onClick={() => handleSort('sku')}
                                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                                        >
                                            SKU
                                            <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button
                                            onClick={() => handleSort('name')}
                                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                                        >
                                            Product Name & Unit
                                            <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">Category</th>
                                    {isPrivileged && (
                                        <th className="px-4 py-3 text-right">Cost Price</th>
                                    )}
                                    <th className="px-4 py-3 text-right">Min Allowed</th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleSort('default_selling_price')}
                                            className="flex items-center gap-1 justify-end ml-auto hover:text-foreground transition-colors"
                                        >
                                            Selling Price
                                            <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">MRP / List</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {products.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={isPrivileged ? 10 : 9} className="px-4 py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Boxes className="h-8 w-8 text-muted-foreground/50" />
                                                <p className="font-medium text-foreground text-sm">No products found</p>
                                                <p className="text-xs text-muted-foreground max-w-sm">
                                                    No product records match your current filter parameters or the catalog is empty.
                                                </p>
                                                {can.create && (
                                                    <Link href="/products/create" className="mt-2">
                                                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                                                            <Plus className="h-3.5 w-3.5" />
                                                            Create First Product
                                                        </Button>
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    products.data.map((product) => (
                                        <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-3 py-3 text-center">
                                                {product.primary_image_url ? (
                                                    <img
                                                        src={product.primary_image_url}
                                                        alt={product.name}
                                                        className="h-10 w-10 object-cover rounded-md border border-border/80 bg-muted shrink-0 mx-auto"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-md border border-dashed border-border/80 bg-muted/40 flex items-center justify-center text-muted-foreground/60 mx-auto">
                                                        <Package className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 w-fit">
                                                        {product.sku}
                                                    </span>
                                                    {product.barcode && (
                                                        <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Scan className="h-2.5 w-2.5" />
                                                            {product.barcode}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground leading-snug">
                                                        {product.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span className="inline-flex items-center text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                                                            Unit: {product.unit}
                                                        </span>
                                                        {product.description && (
                                                            <span className="truncate max-w-xs text-[11px]" title={product.description}>
                                                                {product.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {product.category ? (
                                                    <Badge variant="outline" className="text-xs font-mono bg-muted/40">
                                                        {product.category.name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        Uncategorized
                                                    </span>
                                                )}
                                            </td>
                                            {isPrivileged && (
                                                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                                                    {formatCurrency(product.cost_price)}
                                                </td>
                                            )}
                                            <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                                                {formatCurrency(product.minimum_allowed_price)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                                                {formatCurrency(product.default_selling_price)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                                                {formatCurrency(product.mrp)}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                {getStatusBadge(product.status)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/products/${product.id}`}>
                                                        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
                                                            View
                                                        </Button>
                                                    </Link>
                                                    {can.update && (
                                                        <Link href={`/products/${product.id}/edit`}>
                                                            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                                                                Edit
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Cards (Phones & Small Tablets) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                    {products.data.length === 0 ? (
                        <Card className="border-border">
                            <CardContent className="p-6 text-center text-muted-foreground">
                                <Boxes className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                <p className="font-medium text-foreground text-sm">No products found</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    No records match your filters.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        products.data.map((product) => (
                            <Card key={product.id} className="border-border shadow-xs hover:border-primary/40 transition-colors">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            {product.primary_image_url ? (
                                                <img
                                                    src={product.primary_image_url}
                                                    alt={product.name}
                                                    className="h-12 w-12 object-cover rounded-md border border-border/80 bg-muted shrink-0"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="h-12 w-12 rounded-md border border-dashed border-border/80 bg-muted/40 flex items-center justify-center text-muted-foreground/60 shrink-0">
                                                    <Package className="h-5 w-5" />
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                                    {product.sku}
                                                </span>
                                                <h3 className="font-medium text-foreground text-sm mt-1">
                                                    {product.name}
                                                </h3>
                                            </div>
                                        </div>
                                        <div>{getStatusBadge(product.status)}</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                                        <div>
                                            <span className="text-muted-foreground text-[11px] block">Selling Price:</span>
                                            <span className="font-mono font-semibold text-foreground">
                                                {formatCurrency(product.default_selling_price)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-[11px] block">MRP:</span>
                                            <span className="font-mono text-muted-foreground">
                                                {formatCurrency(product.mrp)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-[11px] block">Min Allowed:</span>
                                            <span className="font-mono text-muted-foreground">
                                                {formatCurrency(product.minimum_allowed_price)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-[11px] block">Unit / Category:</span>
                                            <span className="text-muted-foreground truncate">
                                                {product.unit} · {product.category?.name || 'Uncategorized'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                                        <Link href={`/products/${product.id}`} className="w-full">
                                            <Button variant="outline" size="sm" className="w-full text-xs">
                                                View Details
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {products.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-muted-foreground">
                        <div>
                            Showing <span className="font-medium text-foreground">{products.from || 0}</span> to{' '}
                            <span className="font-medium text-foreground">{products.to || 0}</span> of{' '}
                            <span className="font-medium text-foreground">{products.total}</span> products
                        </div>

                        <div className="flex items-center gap-1">
                            {products.links.map((link, idx) => {
                                if (!link.url) {
                                    return (
                                        <span
                                            key={idx}
                                            className="px-3 py-1 text-muted-foreground/50 cursor-not-allowed select-none text-xs"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    );
                                }
                                return (
                                    <Link
                                        key={idx}
                                        href={link.url}
                                        preserveScroll
                                        preserveState
                                        className={`px-3 py-1 rounded text-xs transition-colors ${
                                            link.active
                                                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                                : 'hover:bg-muted text-foreground'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Barcode Scanner Dialog */}
                <BarcodeScannerModal
                    isOpen={scannerOpen}
                    onClose={() => setScannerOpen(false)}
                />
            </div>
        </AppLayout>
    );
}
