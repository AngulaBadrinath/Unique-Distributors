import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import OrderStatusBadge from '@/Pages/Salesman/Orders/Partials/OrderStatusBadge';
import {
    Users,
    FileText,
    Layers,
    CheckCircle2,
    Plus,
    Receipt,
    Package,
    FolderTree,
    ArrowUpRight,
    ChevronRight,
    Phone,
    ShoppingBag,
    FilePlus,
    UserCheck,
} from 'lucide-react';

interface SalesmanMetrics {
    assigned_customers_count: number;
    draft_orders_count: number;
    in_flight_orders_count: number;
    completed_orders_count: number;
}

interface RecentOrder {
    id: number;
    order_number: string;
    customer_name: string;
    customer_code?: string;
    status: string;
    status_label: string;
    status_badge_variant: string;
    grand_total: string;
    currency: string;
    submitted_at: string;
}

interface AssignedCustomer {
    id: number;
    code: string;
    name: string;
    contact_name?: string;
    phone?: string;
    orders_count: number;
}

interface CategoryItem {
    id: number;
    name: string;
    code: string;
    products_count: number;
}

interface SalesmanDashboardProps {
    metrics: SalesmanMetrics;
    recentOrders: RecentOrder[];
    assignedCustomers: AssignedCustomer[];
    categories: CategoryItem[];
}

export default function SalesmanDashboard({
    metrics,
    recentOrders,
    assignedCustomers,
    categories,
}: SalesmanDashboardProps) {
    const formatCurrency = (val: string | number, currency = 'USD') => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num)
            ? '$0.00'
            : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
    };

    const formatDate = (isoStr: string) => {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return isNaN(d.getTime())
            ? '—'
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <AppLayout title="Salesman Workspace">
            <Head title="Salesman Overview Dashboard" />

            <div className="space-y-6 pb-12">
                {/* Header Welcome Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Receipt className="h-5 w-5" />
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                Field Sales Dashboard
                            </h1>
                            <Badge variant="secondary" className="font-mono text-xs">
                                Sales Operations
                            </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Monitor your assigned customer accounts, draft orders in progress, and active fulfillment status.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Link href="/salesman/orders/drafts">
                            <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 cursor-pointer">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Draft Orders ({metrics.draft_orders_count})</span>
                            </Button>
                        </Link>
                        <Link href="/salesman/orders/create">
                            <Button size="sm" className="text-xs h-9 gap-1.5 cursor-pointer">
                                <Plus className="h-3.5 w-3.5" />
                                <span>New Sales Order</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Top Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Metric 1: Assigned Customers */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Assigned Accounts
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Users className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight font-mono text-foreground">
                                {metrics.assigned_customers_count}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                <span>Active Clients</span>
                                <Link href="/customers" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    <span>Browse Directory</span>
                                    <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Metric 2: Draft Orders */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Draft Orders
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <FileText className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight font-mono text-foreground">
                                {metrics.draft_orders_count}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                <span>In-Progress Drafts</span>
                                <Link href="/salesman/orders/drafts" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    <span>Resume Editing</span>
                                    <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Metric 3: Active Orders In-Flight */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                In-Flight Orders
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                <Layers className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight font-mono text-foreground">
                                {metrics.in_flight_orders_count}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                <span>Pending / Processing</span>
                                <Link href="/salesman/orders" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    <span>Track Status</span>
                                    <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Metric 4: Completed Orders */}
                    <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                                Completed Orders
                            </CardTitle>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight font-mono text-foreground">
                                {metrics.completed_orders_count}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                <span>Delivered & Closed</span>
                                <Link href="/salesman/orders?status=COMPLETED" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                                    <span>View History</span>
                                    <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Grid: Recent Orders Feed + Side Panels */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column (2 Cols): Recent Orders Feed */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-border shadow-xs">
                            <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Recent Sales Orders</CardTitle>
                                    <CardDescription className="text-xs">
                                        Latest orders submitted for your customer portfolio.
                                    </CardDescription>
                                </div>
                                <Link href="/salesman/orders">
                                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
                                        <span>Full History</span>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent className="p-0">
                                {recentOrders.length > 0 ? (
                                    <div className="divide-y divide-border">
                                        {recentOrders.map((order) => (
                                            <div
                                                key={order.id}
                                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Link
                                                            href={`/salesman/orders/${order.id}`}
                                                            className="font-mono text-xs font-bold text-foreground hover:text-primary transition-colors"
                                                        >
                                                            {order.order_number}
                                                        </Link>
                                                        <OrderStatusBadge
                                                            dimension="order"
                                                            label={order.status_label || order.status}
                                                            variant={order.status_badge_variant}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span className="font-medium text-foreground truncate max-w-[200px]">
                                                            {order.customer_name}
                                                        </span>
                                                        {order.customer_code && (
                                                            <>
                                                                <span>&bull;</span>
                                                                <span className="font-mono text-[11px]">{order.customer_code}</span>
                                                            </>
                                                        )}
                                                        <span>&bull;</span>
                                                        <span>{formatDate(order.submitted_at)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                                    <span className="font-mono text-xs font-semibold text-foreground">
                                                        {formatCurrency(order.grand_total, order.currency)}
                                                    </span>
                                                    <Link href={`/salesman/orders/${order.id}`}>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                                                            View
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center space-y-3">
                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                                            <ShoppingBag className="h-5 w-5" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-foreground">No submitted orders yet</p>
                                            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                                                Create your first order draft and submit it for processing.
                                            </p>
                                        </div>
                                        <Link href="/salesman/orders/create">
                                            <Button size="sm" className="text-xs gap-1.5 h-8">
                                                <Plus className="h-3.5 w-3.5" />
                                                <span>Create New Order</span>
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column (1 Col): Assigned Customers & Catalog Shortcuts */}
                    <div className="space-y-6">
                        {/* Panel 1: Assigned Customers Shortcut */}
                        <Card className="border-border shadow-xs">
                            <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Assigned Accounts</CardTitle>
                                    <CardDescription className="text-xs">Your client directory</CardDescription>
                                </div>
                                <Link href="/customers">
                                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
                                        <span>All ({metrics.assigned_customers_count})</span>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent className="p-0">
                                {assignedCustomers.length > 0 ? (
                                    <div className="divide-y divide-border">
                                        {assignedCustomers.map((customer) => (
                                            <div
                                                key={customer.id}
                                                className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="space-y-0.5 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-xs text-foreground truncate">
                                                            {customer.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                        <span className="font-mono">{customer.code}</span>
                                                        {customer.phone && (
                                                            <>
                                                                <span>&bull;</span>
                                                                <span className="flex items-center gap-1">
                                                                    <Phone className="h-2.5 w-2.5" />
                                                                    <span>{customer.phone}</span>
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <Link href={`/salesman/orders/create?customer_id=${customer.id}`}>
                                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" title="Create order for this customer">
                                                        <FilePlus className="h-3 w-3" />
                                                        <span>Order</span>
                                                    </Button>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6 text-center text-xs text-muted-foreground">
                                        <UserCheck className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/60" />
                                        <span>No assigned customer accounts found.</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Panel 2: Product Catalog & Categories */}
                        <Card className="border-border shadow-xs">
                            <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Product Catalog</CardTitle>
                                    <CardDescription className="text-xs">Browse items & pricing</CardDescription>
                                </div>
                                <Link href="/products">
                                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
                                        <span>Full Catalog</span>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent className="p-3.5">
                                {categories.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {categories.map((cat) => (
                                            <Link
                                                key={cat.id}
                                                href={`/products?category_id=${cat.id}`}
                                                className="p-2.5 rounded-lg border border-border/80 bg-card hover:bg-muted/50 hover:border-border transition-colors flex items-center justify-between text-xs"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FolderTree className="h-3.5 w-3.5 text-primary shrink-0" />
                                                    <span className="font-medium text-foreground truncate">{cat.name}</span>
                                                </div>
                                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 shrink-0">
                                                    {cat.products_count}
                                                </Badge>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-xs text-muted-foreground">
                                        <Package className="h-6 w-6 mx-auto mb-1 text-muted-foreground/60" />
                                        <span>No product categories defined.</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
