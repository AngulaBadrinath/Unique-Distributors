import React, { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button, buttonVariants } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { PageProps } from '@/types';
import {
    Boxes,
    ArrowLeft,
    CheckSquare,
    Package,
    Send,
    Truck,
    MapPin,
    Calendar,
    Phone,
    User,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FulfillmentItem {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    unit: string;
    ordered_quantity: number;
    fulfillable_quantity: number;
    reserved_quantity: number;
    picked_quantity: number;
    dispatched_quantity: number;
    allocation_status: string;
    allocation_number?: string;
    warehouse_code: string;
}

interface FulfillmentOrderDetails {
    id: number;
    order_number: string;
    status: string;
    status_label: string;
    fulfillment_status: string;
    fulfillment_status_label: string;
    delivery_status?: string;
    customer: {
        id: number;
        name: string;
        code: string;
        phone?: string;
        contact_name?: string;
        shipping_address: {
            line1: string;
            line2?: string;
            city: string;
            state: string;
            postal_code: string;
        };
    };
    items: FulfillmentItem[];
    approved_at?: string;
    notes?: string;
    delivery?: {
        id: number;
        delivery_number: string;
        status: string;
        scheduled_date?: string;
        driver_name?: string;
    } | null;
}

interface WarehouseFulfillmentShowProps {
    order: FulfillmentOrderDetails;
    capabilities: {
        can_pick: boolean;
        can_pack: boolean;
        can_dispatch: boolean;
        can_assign_delivery: boolean;
    };
}

export default function WarehouseFulfillmentShow({
    order,
    capabilities,
}: WarehouseFulfillmentShowProps) {
    const { flash } = usePage<PageProps>().props;

    // Local pick quantities state for custom picking
    const [pickedQuantities, setPickedQuantities] = useState<Record<number, number>>(() => {
        const initial: Record<number, number> = {};
        order.items.forEach((item) => {
            initial[item.id] = item.picked_quantity > 0 ? item.picked_quantity : item.fulfillable_quantity;
        });
        return initial;
    });

    const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [dispatchWindow, setDispatchWindow] = useState('Morning (09:00 - 13:00)');
    const [dispatchInstructions, setDispatchInstructions] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePickSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const itemsPayload = Object.entries(pickedQuantities).map(([itemId, qty]) => ({
            order_item_id: Number(itemId),
            picked_quantity: Number(qty),
        }));

        router.post(
            `/admin/warehouse/fulfillment/${order.id}/pick`,
            { items: itemsPayload },
            {
                preserveScroll: true,
                onFinish: () => setIsSubmitting(false),
            }
        );
    };

    const handlePackSubmit = () => {
        setIsSubmitting(true);
        router.post(
            `/admin/warehouse/fulfillment/${order.id}/pack`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsSubmitting(false),
            }
        );
    };

    const handleDispatchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        router.post(
            `/admin/warehouse/fulfillment/${order.id}/dispatch`,
            {
                scheduled_date: dispatchDate,
                delivery_window: dispatchWindow,
                driver_instructions: dispatchInstructions.trim() || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => setDispatchModalOpen(false),
                onFinish: () => setIsSubmitting(false),
            }
        );
    };

    const isReserved = order.fulfillment_status === 'RESERVED';
    const isPicked = order.fulfillment_status === 'PICKED';
    const isPacked = order.fulfillment_status === 'PACKED';
    const isDispatched = order.fulfillment_status === 'DISPATCHED';

    return (
        <AppLayout>
            <Head title={`Fulfillment — Order #${order.order_number}`} />

            <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/warehouse/fulfillment"
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 w-8 p-0')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                                    Order #{order.order_number}
                                </h1>
                                <Badge variant="outline" className="font-mono text-xs">
                                    {order.fulfillment_status_label}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                Approved on {order.approved_at ? new Date(order.approved_at).toLocaleString() : '—'} • Customer: {order.customer.name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isReserved && (
                            <Button
                                size="sm"
                                onClick={handlePickSubmit}
                                disabled={isSubmitting}
                                className="bg-indigo-600 hover:bg-indigo-500 font-mono text-xs gap-1.5"
                            >
                                <CheckSquare className="h-3.5 w-3.5" />
                                Mark Items Picked
                            </Button>
                        )}

                        {isPicked && (
                            <Button
                                size="sm"
                                onClick={handlePackSubmit}
                                disabled={isSubmitting}
                                className="bg-purple-600 hover:bg-purple-500 font-mono text-xs gap-1.5"
                            >
                                <Package className="h-3.5 w-3.5" />
                                Confirm Packed
                            </Button>
                        )}

                        {(isPacked || isPicked) && (
                            <Button
                                size="sm"
                                onClick={() => setDispatchModalOpen(true)}
                                disabled={isSubmitting}
                                className="bg-blue-600 hover:bg-blue-500 font-mono text-xs gap-1.5"
                            >
                                <Send className="h-3.5 w-3.5" />
                                Dispatch & Create Delivery
                            </Button>
                        )}

                        {order.delivery && (
                            <Link
                                href="/admin/deliveries"
                                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'font-mono text-xs gap-1.5 text-indigo-400 border-indigo-800/60')}
                            >
                                <Truck className="h-3.5 w-3.5" />
                                View in Logistics
                            </Link>
                        )}
                    </div>
                </div>

                {/* Shipping & Customer Destination Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-border/60 bg-brand-surface/40 p-4 shadow-xs md:col-span-2">
                        <div className="text-xs font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                            Shipping Destination & Address Snapshot
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                            {order.customer.shipping_address.line1}
                        </div>
                        {order.customer.shipping_address.line2 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                                {order.customer.shipping_address.line2}
                            </div>
                        )}
                        <div className="text-xs font-mono text-brand-muted mt-1">
                            {order.customer.shipping_address.city}, {order.customer.shipping_address.state} {order.customer.shipping_address.postal_code}
                        </div>
                        {order.customer.contact_name && (
                            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1 font-mono">
                                <User className="h-3 w-3" />
                                Contact: {order.customer.contact_name} {order.customer.phone ? `(${order.customer.phone})` : ''}
                            </div>
                        )}
                    </Card>

                    <Card className="border-border/60 bg-brand-surface/40 p-4 shadow-xs">
                        <div className="text-xs font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-indigo-400" />
                            Downstream Delivery Status
                        </div>
                        {order.delivery ? (
                            <div className="space-y-1.5 font-mono text-xs">
                                <div className="font-bold text-indigo-400">
                                    Delivery #{order.delivery.delivery_number}
                                </div>
                                <div className="text-muted-foreground">
                                    Status: <span className="text-foreground">{order.delivery.status}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    Driver: <span className="text-foreground">{order.delivery.driver_name || 'Unassigned'}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs font-mono text-muted-foreground space-y-1">
                                <div>Not yet dispatched to logistics.</div>
                                <div className="text-[11px] text-brand-muted">
                                    Clicking Dispatch will create the delivery mission in pending driver assignment status.
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Fulfillment Items Checklist */}
                <Card className="border-border/60 bg-brand-surface/40 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Boxes className="h-4 w-4 text-indigo-400" />
                                <CardTitle className="text-base font-mono">Physical Items Checklist</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono">
                                {order.items.length} SKUs
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            Verify physical stock against reserved order allocations before packing cartons.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm font-mono text-xs">
                                <thead className="bg-brand-surface border-b border-border/60 uppercase text-muted-foreground">
                                    <tr>
                                        <th className="py-3 px-4">Product / SKU</th>
                                        <th className="py-3 px-4 text-center">Warehouse</th>
                                        <th className="py-3 px-4 text-right">Ordered</th>
                                        <th className="py-3 px-4 text-right">Reserved</th>
                                        <th className="py-3 px-4 text-right">Picked Qty</th>
                                        <th className="py-3 px-4 text-right">Dispatched</th>
                                        <th className="py-3 px-4 text-center">Allocation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {order.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-brand-surface/60 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-foreground">{item.product_name}</div>
                                                <div className="text-[11px] text-muted-foreground">SKU: {item.sku}</div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {item.warehouse_code}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-right text-foreground font-medium">
                                                {item.ordered_quantity} {item.unit}
                                            </td>
                                            <td className="py-3 px-4 text-right text-amber-400 font-medium">
                                                {item.reserved_quantity} {item.unit}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {isReserved ? (
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={item.fulfillable_quantity}
                                                        value={pickedQuantities[item.id] ?? item.fulfillable_quantity}
                                                        onChange={(e) => setPickedQuantities({
                                                            ...pickedQuantities,
                                                            [item.id]: Math.max(0, parseInt(e.target.value) || 0)
                                                        })}
                                                        className="w-20 ml-auto text-right h-7 bg-brand-surface border-border/60 text-xs font-mono"
                                                    />
                                                ) : (
                                                    <span className="text-indigo-400 font-bold">
                                                        {item.picked_quantity} {item.unit}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right text-muted-foreground">
                                                {item.dispatched_quantity} {item.unit}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {item.allocation_status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Dispatch Modal */}
                {dispatchModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Send className="w-5 h-5 text-blue-400" />
                                    <h2 className="text-base font-bold text-white font-mono">Dispatch Order to Logistics</h2>
                                </div>
                                <button
                                    onClick={() => setDispatchModalOpen(false)}
                                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleDispatchSubmit} className="p-4 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Scheduled Delivery Date</label>
                                    <Input
                                        type="date"
                                        value={dispatchDate}
                                        onChange={(e) => setDispatchDate(e.target.value)}
                                        className="bg-slate-950 border-slate-700 text-white font-mono text-xs"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Delivery Window</label>
                                    <select
                                        value={dispatchWindow}
                                        onChange={(e) => setDispatchWindow(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="Morning (09:00 - 13:00)">Morning (09:00 - 13:00)</option>
                                        <option value="Afternoon (13:00 - 17:00)">Afternoon (13:00 - 17:00)</option>
                                        <option value="Evening (17:00 - 20:00)">Evening (17:00 - 20:00)</option>
                                        <option value="Full Day Flexible">Full Day Flexible</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Driver Instructions / Gate Notes</label>
                                    <textarea
                                        value={dispatchInstructions}
                                        onChange={(e) => setDispatchInstructions(e.target.value)}
                                        placeholder="Add gate code, loading dock instructions, or recipient phone notes..."
                                        rows={3}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDispatchModalOpen(false)}
                                        className="text-xs"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isSubmitting}
                                        className="text-xs bg-blue-600 hover:bg-blue-500 font-semibold"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                Dispatching...
                                            </>
                                        ) : (
                                            'Confirm Dispatch'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
