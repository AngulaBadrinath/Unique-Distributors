import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { OrderDraftSummary } from '@/types/order';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { DiscardDraftModal } from '@/Components/Salesman/DiscardDraftModal';
import {
    FileText,
    Search,
    Plus,
    Clock,
    ShoppingBag,
    Trash2,
    ArrowRight,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

interface DraftsPageProps {
    drafts: {
        data: OrderDraftSummary[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
    };
    filters: {
        search: string;
    };
}

export default function Drafts({ drafts, filters }: DraftsPageProps) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedDraftToDiscard, setSelectedDraftToDiscard] = useState<OrderDraftSummary | null>(null);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            '/salesman/orders/drafts',
            { search: searchTerm },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        router.get('/salesman/orders/drafts', {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <AppLayout title="Draft Orders">
            <Head title="My Draft Orders" />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header & Primary Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Draft Orders</h1>
                            <Badge variant="secondary" className="font-mono text-xs">
                                {drafts.total} {drafts.total === 1 ? 'draft' : 'drafts'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Resume, update, or submit your saved working order drafts.
                        </p>
                    </div>

                    <Link href="/salesman/orders/create">
                        <Button className="flex items-center gap-2 shadow-sm w-full sm:w-auto">
                            <Plus className="h-4 w-4" />
                            <span>New Order</span>
                        </Button>
                    </Link>
                </div>

                {/* Filter / Search Bar */}
                <div className="bg-card border rounded-lg p-4 shadow-sm">
                    <form onSubmit={handleSearchSubmit} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search drafts by customer name or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button type="submit" variant="secondary" className="shrink-0">
                            Search
                        </Button>
                        {filters.search && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClearSearch}
                                className="shrink-0"
                            >
                                Clear
                            </Button>
                        )}
                    </form>
                </div>

                {/* Drafts List */}
                {drafts.data.length === 0 ? (
                    /* Empty State */
                    <div className="bg-card border rounded-xl p-12 text-center shadow-sm space-y-4">
                        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                            <h3 className="text-base font-semibold text-foreground">No draft orders found</h3>
                            <p className="text-sm text-muted-foreground">
                                {filters.search
                                    ? `No drafts matched "${filters.search}". Try adjusting your search query.`
                                    : 'You have no saved draft orders. Start a new order to begin building a draft.'}
                            </p>
                        </div>
                        {!filters.search && (
                            <Link href="/salesman/orders/create">
                                <Button className="mt-2">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create First Order
                                </Button>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Desktop Table (Hidden on Mobile) */}
                        <div className="hidden md:block bg-card border rounded-lg shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <tr>
                                            <th className="py-3 px-4">Customer</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-center">Items</th>
                                            <th className="py-3 px-4 text-right">Est. Total</th>
                                            <th className="py-3 px-4">Last Modified</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {drafts.data.map((draft) => (
                                            <tr key={draft.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3.5 px-4">
                                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                                        <span>{draft.customer.name}</span>
                                                        <Badge variant="outline" className="font-mono text-[10px] py-0">
                                                            {draft.customer.code}
                                                        </Badge>
                                                    </div>
                                                    {draft.customer.contact_name && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {draft.customer.contact_name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <Badge
                                                        variant={
                                                            draft.customer.status === 'ACTIVE'
                                                                ? 'outline'
                                                                : 'destructive'
                                                        }
                                                        className="text-[11px]"
                                                    >
                                                        Customer: {draft.customer.status_label}
                                                    </Badge>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <Badge variant="secondary" className="font-mono text-xs">
                                                        {draft.item_count} {draft.item_count === 1 ? 'item' : 'items'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground">
                                                    ${parseFloat(draft.grand_total).toFixed(2)}
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        <span>{new Date(draft.updated_at).toLocaleString()}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setSelectedDraftToDiscard(draft)}
                                                            className="text-destructive hover:bg-destructive/10 h-8 px-2.5"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="sr-only">Discard</span>
                                                        </Button>

                                                        <Link href={`/salesman/orders/drafts/${draft.id}/edit`}>
                                                            <Button size="sm" className="h-8 gap-1.5 px-3">
                                                                <span>Resume</span>
                                                                <ArrowRight className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards (Shown on Mobile) */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {drafts.data.map((draft) => (
                                <div
                                    key={draft.id}
                                    className="bg-card border rounded-xl p-4 shadow-sm space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-bold text-foreground flex items-center gap-2">
                                                <span>{draft.customer.name}</span>
                                                <Badge variant="outline" className="font-mono text-[10px]">
                                                    {draft.customer.code}
                                                </Badge>
                                            </div>
                                            {draft.customer.contact_name && (
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {draft.customer.contact_name}
                                                </div>
                                            )}
                                        </div>

                                        <Badge
                                            variant={
                                                draft.customer.status === 'ACTIVE'
                                                    ? 'secondary'
                                                    : 'destructive'
                                            }
                                            className="text-[10px]"
                                        >
                                            {draft.customer.status_label}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-1 border-t text-xs">
                                        <div>
                                            <span className="text-muted-foreground">Items:</span>{' '}
                                            <span className="font-semibold text-foreground">
                                                {draft.item_count}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-muted-foreground">Est. Total:</span>{' '}
                                            <span className="font-mono font-bold text-foreground">
                                                ${parseFloat(draft.grand_total).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                {new Date(draft.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedDraftToDiscard(draft)}
                                                className="text-destructive h-9 px-2.5"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>

                                            <Link href={`/salesman/orders/drafts/${draft.id}/edit`}>
                                                <Button size="sm" className="h-9 gap-1.5 px-3">
                                                    <span>Resume</span>
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {drafts.last_page > 1 && (
                            <div className="flex items-center justify-between bg-card border rounded-lg p-3 text-sm">
                                <div className="text-xs text-muted-foreground">
                                    Showing page {drafts.current_page} of {drafts.last_page}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={drafts.current_page <= 1}
                                        onClick={() =>
                                            router.get('/salesman/orders/drafts', {
                                                page: drafts.current_page - 1,
                                                search: filters.search,
                                            })
                                        }
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={drafts.current_page >= drafts.last_page}
                                        onClick={() =>
                                            router.get('/salesman/orders/drafts', {
                                                page: drafts.current_page + 1,
                                                search: filters.search,
                                            })
                                        }
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Discard Draft Modal */}
            <DiscardDraftModal
                isOpen={!!selectedDraftToDiscard}
                draftId={selectedDraftToDiscard?.id || null}
                customerName={selectedDraftToDiscard?.customer.name}
                onClose={() => setSelectedDraftToDiscard(null)}
            />
        </AppLayout>
    );
}
