import React, { useState, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import { Category, PaginatedResponse, PageProps, CategoryStatusOption } from '@/types';
import {
    FolderTree,
    Search,
    Plus,
    Filter,
    ChevronRight,
    ChevronDown,
    ArrowUpDown,
    CheckCircle2,
    XCircle,
    Package,
    Folder,
    FolderOpen,
    Layers,
    List,
    GitBranch,
    Eye,
    Edit,
} from 'lucide-react';

interface CategoryIndexProps {
    categories: PaginatedResponse<Category>;
    tree: Category[];
    filters: {
        search: string;
        status: string;
        root_only: boolean;
        sort_by: string;
        sort_order: string;
    };
    statuses: CategoryStatusOption[];
    can: {
        create: boolean;
        update: boolean;
        delete: boolean;
    };
}

export default function CategoryIndex({
    categories,
    tree,
    filters,
    statuses,
    can,
}: CategoryIndexProps) {
    const { auth } = usePage<PageProps>().props;
    const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
    const [search, setSearch] = useState(filters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'ALL');
    const [rootOnly, setRootOnly] = useState<boolean>(filters.root_only || false);
    const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

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
            '/categories',
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

    const toggleNode = (id: number) => {
        setExpandedNodes((prev) => ({
            ...prev,
            [id]: prev[id] === undefined ? false : !prev[id],
        }));
    };

    // Calculate metrics
    const totalCount = categories.total ?? categories.data.length;
    const activeCount = categories.data.filter((c) => c.status === 'ACTIVE').length;
    const rootCategoriesCount = tree.length;
    const totalAttachedProducts = categories.data.reduce((sum, c) => sum + (c.products_count || 0), 0);

    return (
        <AppLayout title="Product Category Hierarchy & Management">
            <Head title="Product Categories" />

            <div className="space-y-6">
                {/* Header & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                            <FolderTree className="h-3.5 w-3.5 text-primary" />
                            <span>Catalog Taxonomies & Classifications</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Product Categories
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage hierarchical product classifications, sibling ordering, and catalog assignment policies.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Switcher */}
                        <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    viewMode === 'table'
                                        ? 'bg-card text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <List className="h-3.5 w-3.5" />
                                <span>Directory Table</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('tree')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    viewMode === 'tree'
                                        ? 'bg-card text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <GitBranch className="h-3.5 w-3.5" />
                                <span>Hierarchy Tree</span>
                            </button>
                        </div>

                        {can.create && (
                            <Link href="/categories/create">
                                <Button className="gap-2 shadow-xs">
                                    <Plus className="h-4 w-4" />
                                    <span>Create Category</span>
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Metrics Summary Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Total Categories</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {totalCount}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <FolderTree className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Root Taxonomies</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {rootCategoriesCount}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <Layers className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Active Classifications</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {activeCount}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Attached Products</p>
                                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                                    {totalAttachedProducts}
                                </p>
                            </div>
                            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Package className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters & Search Toolbar */}
                <Card className="border-border shadow-xs">
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search by code, category name, or description..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 bg-background/50 h-9 text-xs"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Filters */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2.5 py-1">
                                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => {
                                            setSelectedStatus(e.target.value);
                                            applyFilters({ status: e.target.value });
                                        }}
                                        className="text-xs bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-foreground"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        {statuses.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextRootOnly = !rootOnly;
                                        setRootOnly(nextRootOnly);
                                        applyFilters({ root_only: nextRootOnly });
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                                        rootOnly
                                            ? 'bg-primary/10 text-primary border-primary/30'
                                            : 'bg-background text-muted-foreground border-input hover:bg-muted'
                                    }`}
                                >
                                    <Layers className="h-3.5 w-3.5" />
                                    <span>Root Categories Only</span>
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* View Mode: Table vs Tree */}
                {viewMode === 'table' ? (
                    <Card className="border-border shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[11px] border-b border-border">
                                    <tr>
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                            onClick={() => handleSort('code')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Code / Hierarchy</span>
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Category Name</span>
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3">Parent Classification</th>
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-foreground select-none text-center"
                                            onClick={() => handleSort('sort_order')}
                                        >
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span>Order</span>
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-center">Attached Products</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {categories.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center">
                                                <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                                                        <FolderTree className="h-5 w-5" />
                                                    </div>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        No categories found
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1 text-center">
                                                        No category records match the selected filter criteria or search query.
                                                    </p>
                                                    {(filters.search || filters.status !== 'ALL' || filters.root_only) && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSearch('');
                                                                setSelectedStatus('ALL');
                                                                setRootOnly(false);
                                                                applyFilters({
                                                                    search: '',
                                                                    status: 'ALL',
                                                                    root_only: false,
                                                                });
                                                            }}
                                                            className="mt-4 text-xs"
                                                        >
                                                            Reset Filters
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        categories.data.map((cat) => (
                                            <tr
                                                key={cat.id}
                                                className="hover:bg-muted/30 transition-colors group"
                                            >
                                                <td className="px-4 py-3 font-mono font-medium">
                                                    <Link
                                                        href={`/categories/${cat.id}`}
                                                        className="text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                                                        <span>{cat.code}</span>
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <Link
                                                            href={`/categories/${cat.id}`}
                                                            className="font-medium text-foreground hover:text-primary transition-colors"
                                                        >
                                                            {cat.name}
                                                        </Link>
                                                        {cat.description && (
                                                            <span className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                                                                {cat.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {cat.parent ? (
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/60">
                                                                {cat.parent.code}
                                                            </span>
                                                            <span className="truncate max-w-[150px]">{cat.parent.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] font-mono text-muted-foreground/60 italic">
                                                            Top-level Root
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                                                    {cat.sort_order}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted/50 px-2 py-0.5 rounded-full border border-border/60">
                                                        <Package className="h-3 w-3 text-muted-foreground" />
                                                        <span>{cat.products_count ?? 0}</span>
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={cat.status === 'ACTIVE' ? 'default' : 'secondary'}
                                                        className="text-[10px] uppercase font-mono px-2 py-0.5"
                                                    >
                                                        {cat.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link href={`/categories/${cat.id}`}>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                                title="View Details"
                                                            >
                                                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                                            </Button>
                                                        </Link>
                                                        {can.update && (
                                                            <Link href={`/categories/${cat.id}/edit`}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0"
                                                                    title="Edit Category"
                                                                >
                                                                    <Edit className="h-3.5 w-3.5 text-muted-foreground" />
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

                        {/* Pagination Footer */}
                        {categories.links && categories.links.length > 3 && (
                            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                <div>
                                    Showing <span className="font-medium text-foreground">{categories.from || 0}</span> to{' '}
                                    <span className="font-medium text-foreground">{categories.to || 0}</span> of{' '}
                                    <span className="font-medium text-foreground">{categories.total}</span> categories
                                </div>
                                <div className="flex items-center gap-1">
                                    {categories.links.map((link, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                            disabled={!link.url || link.active}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                                                link.active
                                                    ? 'bg-primary text-primary-foreground font-semibold border-primary'
                                                    : link.url
                                                    ? 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                                                    : 'text-muted-foreground/40 border-transparent cursor-not-allowed'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>
                ) : (
                    /* Hierarchy Tree View */
                    <Card className="border-border shadow-xs">
                        <CardContent className="p-6">
                            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <GitBranch className="h-4 w-4 text-primary" />
                                        Complete Taxonomic Hierarchy Tree
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Explore full nested structure with active states, sibling sequence, and attached products count.
                                    </p>
                                </div>
                            </div>

                            {tree.length === 0 ? (
                                <div className="py-12 text-center">
                                    <FolderTree className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm font-medium text-foreground">No taxonomy tree defined</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Create top-level root categories to begin organizing your catalog.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {tree.map((node) => (
                                        <TreeNode
                                            key={node.id}
                                            category={node}
                                            depth={0}
                                            expandedNodes={expandedNodes}
                                            onToggle={toggleNode}
                                            canUpdate={can.update}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}

interface TreeNodeProps {
    category: Category;
    depth: number;
    expandedNodes: Record<number, boolean>;
    onToggle: (id: number) => void;
    canUpdate: boolean;
}

function TreeNode({ category, depth, expandedNodes, onToggle, canUpdate }: TreeNodeProps) {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedNodes[category.id] !== false; // Default expanded

    return (
        <div className="select-none">
            <div
                className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-colors group ${
                    category.status === 'ACTIVE'
                        ? 'bg-card border-border/80 hover:border-border hover:bg-muted/30'
                        : 'bg-muted/20 border-dashed border-border/60 text-muted-foreground'
                }`}
                style={{ marginLeft: `${depth * 24}px` }}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={() => onToggle(category.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                            )}
                        </button>
                    ) : (
                        <div className="w-5 flex items-center justify-center text-muted-foreground/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-border" />
                        </div>
                    )}

                    {hasChildren ? (
                        isExpanded ? (
                            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                            <Folder className="h-4 w-4 text-primary shrink-0" />
                        )
                    ) : (
                        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}

                    <div className="flex items-center gap-2 min-w-0">
                        <Link
                            href={`/categories/${category.id}`}
                            className="font-medium text-xs text-foreground hover:text-primary transition-colors truncate"
                        >
                            {category.name}
                        </Link>
                        <span className="font-mono text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.2 rounded border border-border/60">
                            {category.code}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{category.products_count ?? 0}</span>
                    </span>

                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        #{category.sort_order}
                    </span>

                    <Badge
                        variant={category.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="text-[9px] uppercase font-mono px-1.5 py-0"
                    >
                        {category.status}
                    </Badge>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Link href={`/categories/${category.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Eye className="h-3 w-3" />
                            </Button>
                        </Link>
                        {canUpdate && (
                            <Link href={`/categories/${category.id}/edit`}>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Edit className="h-3 w-3" />
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Render nested children */}
            {hasChildren && isExpanded && (
                <div className="mt-1.5 space-y-1.5">
                    {category.children!.map((child) => (
                        <TreeNode
                            key={child.id}
                            category={child}
                            depth={depth + 1}
                            expandedNodes={expandedNodes}
                            onToggle={onToggle}
                            canUpdate={canUpdate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
