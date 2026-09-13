import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DeliveryLayout from '@/Layouts/DeliveryLayout';
import DeliveryCompleteModal from '@/Components/Delivery/DeliveryCompleteModal';
import DeliveryFailureModal from '@/Components/Delivery/DeliveryFailureModal';
import DeliveryRescheduleModal from '@/Components/Delivery/DeliveryRescheduleModal';
import DeliveryReturnModal from '@/Components/Delivery/DeliveryReturnModal';
import { 
    Truck, 
    Navigation, 
    CheckCircle2, 
    Clock, 
    MapPin, 
    Package, 
    Phone, 
    ExternalLink, 
    Calendar, 
    RotateCcw, 
    XCircle, 
    History, 
    AlertTriangle 
} from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';

interface DeliveryItem {
    id: number;
    order_item_id: number;
    deliverable_quantity: number;
    delivered_quantity: number;
    returned_quantity: number;
    product_name_snapshot: string;
    sku_snapshot: string;
    product?: {
        id: number;
        name: string;
        sku: string;
        unit?: string;
    };
}

interface DeliveryEvent {
    id: number;
    event_type: string;
    from_status?: string;
    to_status: string;
    notes?: string;
    created_at: string;
    actor?: {
        id: number;
        name: string;
        role: string;
    };
}

interface DeliveryFailure {
    id: number;
    failure_reason: string;
    driver_notes: string;
    reported_at: string;
    reporter?: {
        id: number;
        name: string;
    };
}

interface DeliveryDetail {
    id: number;
    delivery_number: string;
    status: string;
    scheduled_date: string;
    delivery_window?: string;
    driver_instructions?: string;
    delivery_contact_name?: string;
    delivery_contact_phone?: string;
    delivery_address_line1: string;
    delivery_address_line2?: string;
    delivery_city: string;
    delivery_state: string;
    delivery_postal_code: string;
    delivery_country_code: string;
    assigned_at?: string;
    picked_up_at?: string;
    out_for_delivery_at?: string;
    delivered_at?: string;
    failed_at?: string;
    returned_at?: string;
    recipient_name?: string;
    pod_notes?: string;
    order?: {
        id: number;
        order_number: string;
        status: string;
        fulfillment_status: string;
        grand_total: string | number;
    };
    customer?: {
        id: number;
        name: string;
        customer_code: string;
        phone: string;
    };
    items: DeliveryItem[];
    events: DeliveryEvent[];
    failures?: DeliveryFailure[];
}

interface DeliveryCapabilities {
    can_pickup: boolean;
    can_start_route: boolean;
    can_complete: boolean;
    can_fail: boolean;
    can_reschedule: boolean;
    can_return_warehouse: boolean;
}

interface DeliveryShowProps {
    delivery: DeliveryDetail;
    capabilities: DeliveryCapabilities;
}

export default function DeliveryShow({ delivery, capabilities }: DeliveryShowProps) {
    const [submittingAction, setSubmittingAction] = useState<string | null>(null);
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [isFailureModalOpen, setIsFailureModalOpen] = useState(false);
    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

    const fullAddress = `${delivery.delivery_address_line1}, ${delivery.delivery_city}, ${delivery.delivery_state} ${delivery.delivery_postal_code}`;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    const phoneToCall = delivery.delivery_contact_phone || delivery.customer?.phone;

    const handlePickup = () => {
        setSubmittingAction('pickup');
        router.post(`/delivery/${delivery.id}/pickup`, {}, {
            onFinish: () => setSubmittingAction(null),
        });
    };

    const handleStartRoute = () => {
        setSubmittingAction('start_route');
        router.post(`/delivery/${delivery.id}/start-route`, {}, {
            onFinish: () => setSubmittingAction(null),
        });
    };

    return (
        <DeliveryLayout title={`Mission #${delivery.delivery_number}`} showBackButton={true}>
            <Head title={`Delivery ${delivery.delivery_number}`} />

            <div className="space-y-4 pb-28">
                {/* Status Hero Card */}
                <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-xs font-mono font-bold text-white bg-primary px-2.5 py-1 rounded-lg">
                            {delivery.delivery_number}
                        </span>

                        <Badge variant="brand">
                            {delivery.status.replace(/_/g, ' ')}
                        </Badge>
                    </div>

                    <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Customer Destination</span>
                        <h2 className="text-xl font-bold text-foreground tracking-tight">
                            {delivery.customer?.name}
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium">
                            Order #{delivery.order?.order_number}
                        </p>
                    </div>

                    {/* Operational Action Shortcuts */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/60">
                        {phoneToCall ? (
                            <a
                                href={`tel:${phoneToCall}`}
                                className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold active:scale-95 transition-all border border-border cursor-pointer"
                            >
                                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Call Customer</span>
                            </a>
                        ) : (
                            <div className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-muted/40 text-muted-foreground text-xs font-medium border border-border/40 select-none">
                                <Phone className="w-4 h-4" />
                                <span>No Phone</span>
                            </div>
                        )}

                        <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-action-accent/10 hover:bg-action-accent/15 text-action-accent text-xs font-semibold active:scale-95 transition-all border border-action-accent/30 cursor-pointer"
                        >
                            <ExternalLink className="w-4 h-4 text-action-accent" />
                            <span>Navigate (Map)</span>
                        </a>
                    </div>
                </div>

                {/* Delivery Location & Schedule Card */}
                <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-primary" />
                        Delivery Destination
                    </h3>

                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-sm text-foreground">
                        <p className="font-semibold text-foreground">{delivery.delivery_contact_name || delivery.customer?.name}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">{delivery.delivery_address_line1}</p>
                        {delivery.delivery_address_line2 && <p className="text-muted-foreground text-xs">{delivery.delivery_address_line2}</p>}
                        <p className="text-muted-foreground text-xs">{delivery.delivery_city}, {delivery.delivery_state} {delivery.delivery_postal_code}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                            <span className="text-muted-foreground flex items-center gap-1 mb-1 text-[11px]">
                                <Calendar className="w-3.5 h-3.5" />
                                Scheduled Date
                            </span>
                            <span className="font-semibold text-foreground">{delivery.scheduled_date}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                            <span className="text-muted-foreground flex items-center gap-1 mb-1 text-[11px]">
                                <Clock className="w-3.5 h-3.5" />
                                Delivery Window
                            </span>
                            <span className="font-semibold text-foreground">{delivery.delivery_window || 'Standard'}</span>
                        </div>
                    </div>

                    {delivery.driver_instructions && (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                            <span className="font-semibold block mb-0.5">Driver Instructions:</span>
                            {delivery.driver_instructions}
                        </div>
                    )}
                </div>

                {/* Failures / Exceptions Card */}
                {delivery.failures && delivery.failures.length > 0 && (
                    <div className="p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 shadow-2xs space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                            Delivery Exceptions & Issues ({delivery.failures.length})
                        </h3>

                        <div className="space-y-2">
                            {delivery.failures.map((fail) => (
                                <div key={fail.id} className="p-3 rounded-xl bg-card border border-rose-200 dark:border-rose-900/40 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-rose-700 dark:text-rose-400">
                                            {fail.failure_reason.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-muted-foreground text-[11px]">{fail.reported_at}</span>
                                    </div>
                                    <p className="text-foreground">{fail.driver_notes}</p>
                                    <p className="text-[10px] text-muted-foreground">Reported by {fail.reporter?.name || 'Driver'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Items Manifest */}
                <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-primary" />
                        Items Manifest ({delivery.items.length})
                    </h3>

                    <div className="divide-y divide-border/60">
                        {delivery.items.map((item) => (
                            <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                                <div>
                                    <p className="font-semibold text-foreground">
                                        {item.product_name_snapshot || item.product?.name}
                                    </p>
                                    <p className="text-muted-foreground font-mono text-[11px]">
                                        SKU: {item.sku_snapshot || item.product?.sku}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-foreground text-sm">
                                        {item.deliverable_quantity}
                                    </span>
                                    <span className="text-muted-foreground ml-1">units</span>
                                    {item.delivered_quantity > 0 && (
                                        <p className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                                            Delivered: {item.delivered_quantity}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline / Audit Summary */}
                <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <History className="w-4 h-4 text-primary" />
                        Mission Timeline
                    </h3>

                    <div className="space-y-2">
                        {delivery.events.map((evt) => (
                            <div key={evt.id} className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                                <div className="flex items-center justify-between text-muted-foreground mb-0.5">
                                    <span className="font-semibold text-foreground">
                                        {evt.event_type.replace(/_/g, ' ')}
                                    </span>
                                    <span>{evt.created_at}</span>
                                </div>
                                {evt.notes && <p className="text-muted-foreground text-xs">{evt.notes}</p>}
                                <p className="text-[10px] text-muted-foreground mt-0.5">By {evt.actor?.name || 'System'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <DeliveryCompleteModal
                isOpen={isCompleteModalOpen}
                onClose={() => setIsCompleteModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
                defaultRecipientName={delivery.delivery_contact_name || delivery.customer?.name || ''}
            />

            <DeliveryFailureModal
                isOpen={isFailureModalOpen}
                onClose={() => setIsFailureModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
            />

            <DeliveryRescheduleModal
                isOpen={isRescheduleModalOpen}
                onClose={() => setIsRescheduleModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
                currentScheduledDate={delivery.scheduled_date}
            />

            <DeliveryReturnModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
            />

            {/* Bottom Sticky Action Bar - Zero Black Anchor Surface */}
            <div className="fixed bottom-0 inset-x-0 z-40 bg-[#050505] border-t border-[#1a1a1a] p-3 flex gap-2 max-w-4xl mx-auto shadow-2xl">
                {capabilities.can_pickup && (
                    <button
                        onClick={handlePickup}
                        disabled={submittingAction !== null}
                        className="flex-1 min-h-[48px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all border border-[#333] shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                        <Package className="w-5 h-5" />
                        <span>Confirm Warehouse Pickup</span>
                    </button>
                )}

                {capabilities.can_start_route && (
                    <button
                        onClick={handleStartRoute}
                        disabled={submittingAction !== null}
                        className="flex-1 min-h-[48px] rounded-xl bg-action-accent hover:bg-action-accent/90 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                        <Navigation className="w-5 h-5" />
                        <span>Start Route (Out for Delivery)</span>
                    </button>
                )}

                {capabilities.can_complete && (
                    <button
                        onClick={() => setIsCompleteModalOpen(true)}
                        className="flex-1 min-h-[48px] rounded-xl bg-[#D7FFE0] hover:bg-[#c2f7cd] text-[#063312] font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all border border-[#063312]/30 shadow-xs cursor-pointer"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Complete Delivery & POD</span>
                    </button>
                )}

                {capabilities.can_fail && (
                    <button
                        onClick={() => setIsFailureModalOpen(true)}
                        className="min-h-[48px] px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                    >
                        <XCircle className="w-5 h-5 text-rose-400" />
                        <span>Report Issue</span>
                    </button>
                )}

                {capabilities.can_reschedule && !capabilities.can_start_route && !capabilities.can_pickup && (
                    <button
                        onClick={() => setIsRescheduleModalOpen(true)}
                        className="flex-1 min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xs cursor-pointer"
                    >
                        <Calendar className="w-5 h-5" />
                        <span>Reschedule</span>
                    </button>
                )}

                {capabilities.can_return_warehouse && (
                    <button
                        onClick={() => setIsReturnModalOpen(true)}
                        className="min-h-[48px] px-4 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                    >
                        <RotateCcw className="w-5 h-5 text-muted-foreground" />
                        <span>Return to Hub</span>
                    </button>
                )}
            </div>
        </DeliveryLayout>
    );
}
