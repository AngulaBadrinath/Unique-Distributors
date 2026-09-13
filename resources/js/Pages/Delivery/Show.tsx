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
    AlertCircle, 
    ArrowRight,
    ExternalLink,
    Calendar,
    RotateCcw,
    XCircle,
    FileText,
    History,
    Shield,
    AlertTriangle
} from 'lucide-react';

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
    driver?: {
        id: number;
        name: string;
        email: string;
    };
    items: DeliveryItem[];
    events: DeliveryEvent[];
    failures: DeliveryFailure[];
}

interface DeliveryShowProps {
    delivery: DeliveryDetail;
    capabilities: {
        can_pickup: boolean;
        can_start_route: boolean;
        can_complete: boolean;
        can_fail: boolean;
        can_reschedule: boolean;
        can_return_warehouse: boolean;
        is_assigned_driver: boolean;
    };
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
        if (!confirm('Confirm picking up goods for this delivery from the warehouse?')) return;
        setSubmittingAction('pickup');
        router.post(`/delivery/${delivery.id}/pickup`, {}, {
            onFinish: () => setSubmittingAction(null),
        });
    };

    const handleStartRoute = () => {
        if (!confirm('Start route to customer? Status will change to OUT FOR DELIVERY.')) return;
        setSubmittingAction('start_route');
        router.post(`/delivery/${delivery.id}/start-route`, {}, {
            onFinish: () => setSubmittingAction(null),
        });
    };

    return (
        <DeliveryLayout title={`Mission #${delivery.delivery_number}`} showBackButton={true}>
            <Head title={`Delivery ${delivery.delivery_number}`} />

            <div className="space-y-4 pb-24">
                {/* Status Hero Card */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                            {delivery.delivery_number}
                        </span>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            {delivery.status.replace(/_/g, ' ')}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</span>
                        <h2 className="text-lg font-bold text-white tracking-tight">
                            {delivery.customer?.name}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium">
                            Order #{delivery.order?.order_number}
                        </p>
                    </div>

                    {/* Operational Action Shortcuts */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
                        {phoneToCall ? (
                            <a
                                href={`tel:${phoneToCall}`}
                                className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold active:scale-95 transition-all"
                            >
                                <Phone className="w-4 h-4 text-emerald-400" />
                                <span>Call Customer</span>
                            </a>
                        ) : (
                            <div className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-slate-800/40 text-slate-500 text-xs font-medium">
                                <Phone className="w-4 h-4" />
                                <span>No Phone</span>
                            </div>
                        )}

                        <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold active:scale-95 transition-all"
                        >
                            <ExternalLink className="w-4 h-4 text-blue-400" />
                            <span>Navigate (Map)</span>
                        </a>
                    </div>
                </div>

                {/* Delivery Location & Schedule Card */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                        Delivery Destination
                    </h3>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-sm text-slate-200">
                        <p className="font-semibold text-white">{delivery.delivery_contact_name || delivery.customer?.name}</p>
                        <p>{delivery.delivery_address_line1}</p>
                        {delivery.delivery_address_line2 && <p>{delivery.delivery_address_line2}</p>}
                        <p>{delivery.delivery_city}, {delivery.delivery_state} {delivery.delivery_postal_code}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                            <span className="text-slate-400 flex items-center gap-1 mb-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Scheduled Date
                            </span>
                            <span className="font-semibold text-white">{delivery.scheduled_date}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                            <span className="text-slate-400 flex items-center gap-1 mb-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                Delivery Window
                            </span>
                            <span className="font-semibold text-white">{delivery.delivery_window || 'Standard'}</span>
                        </div>
                    </div>

                    {delivery.driver_instructions && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                            <span className="font-semibold block mb-0.5">Driver Instructions:</span>
                            {delivery.driver_instructions}
                        </div>
                    )}
                </div>

                {/* Failures / Exceptions Card */}
                {delivery.failures && delivery.failures.length > 0 && (
                    <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/50 shadow-sm space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            Delivery Exceptions & Issues ({delivery.failures.length})
                        </h3>

                        <div className="space-y-2">
                            {delivery.failures.map((fail) => (
                                <div key={fail.id} className="p-3 rounded-xl bg-slate-900/80 border border-rose-900/40 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-rose-300">
                                            {fail.failure_reason.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-slate-400 text-[11px]">{fail.reported_at}</span>
                                    </div>
                                    <p className="text-slate-200">{fail.driver_notes}</p>
                                    <p className="text-[10px] text-slate-400">Reported by {fail.reporter?.name || 'Driver'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Items Manifest */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-indigo-400" />
                        Items Manifest ({delivery.items.length})
                    </h3>

                    <div className="divide-y divide-slate-800/80">
                        {delivery.items.map((item) => (
                            <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                                <div>
                                    <p className="font-semibold text-white">
                                        {item.product_name_snapshot || item.product?.name}
                                    </p>
                                    <p className="text-slate-400 font-mono text-[11px]">
                                        SKU: {item.sku_snapshot || item.product?.sku}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-white text-sm">
                                        {item.deliverable_quantity}
                                    </span>
                                    <span className="text-slate-400 ml-1">units</span>
                                    {item.delivered_quantity > 0 && (
                                        <p className="text-emerald-400 text-[11px] font-medium">
                                            Delivered: {item.delivered_quantity}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline / Audit Summary */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-indigo-400" />
                        Mission Timeline
                    </h3>

                    <div className="space-y-2">
                        {delivery.events.map((evt) => (
                            <div key={evt.id} className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                                <div className="flex items-center justify-between text-slate-400 mb-0.5">
                                    <span className="font-semibold text-indigo-300">
                                        {evt.event_type.replace(/_/g, ' ')}
                                    </span>
                                    <span>{evt.created_at}</span>
                                </div>
                                {evt.notes && <p className="text-slate-300">{evt.notes}</p>}
                                <p className="text-[11px] text-slate-400 mt-0.5">By {evt.actor?.name || 'System'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Complete Delivery Modal */}
            <DeliveryCompleteModal
                isOpen={isCompleteModalOpen}
                onClose={() => setIsCompleteModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
                defaultRecipientName={delivery.delivery_contact_name || delivery.customer?.name || ''}
            />

            {/* Delivery Failure Modal */}
            <DeliveryFailureModal
                isOpen={isFailureModalOpen}
                onClose={() => setIsFailureModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
            />

            {/* Delivery Reschedule Modal */}
            <DeliveryRescheduleModal
                isOpen={isRescheduleModalOpen}
                onClose={() => setIsRescheduleModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
                currentScheduledDate={delivery.scheduled_date}
            />

            {/* Delivery Return Modal */}
            <DeliveryReturnModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                deliveryId={delivery.id}
                deliveryNumber={delivery.delivery_number}
            />

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 flex gap-2 max-w-3xl mx-auto shadow-2xl">
                {capabilities.can_pickup && (
                    <button
                        onClick={handlePickup}
                        disabled={submittingAction !== null}
                        className="flex-1 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                    >
                        <Package className="w-5 h-5" />
                        <span>Confirm Warehouse Pickup</span>
                    </button>
                )}

                {capabilities.can_start_route && (
                    <button
                        onClick={handleStartRoute}
                        disabled={submittingAction !== null}
                        className="flex-1 min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    >
                        <Navigation className="w-5 h-5" />
                        <span>Start Route (Out for Delivery)</span>
                    </button>
                )}

                {capabilities.can_complete && (
                    <button
                        onClick={() => setIsCompleteModalOpen(true)}
                        className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-emerald-600/20"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Complete Delivery & POD</span>
                    </button>
                )}

                {capabilities.can_fail && (
                    <button
                        onClick={() => setIsFailureModalOpen(true)}
                        className="min-h-[48px] px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all"
                    >
                        <XCircle className="w-5 h-5 text-rose-400" />
                        <span>Report Issue</span>
                    </button>
                )}

                {capabilities.can_reschedule && !capabilities.can_start_route && !capabilities.can_pickup && (
                    <button
                        onClick={() => setIsRescheduleModalOpen(true)}
                        className="flex-1 min-h-[48px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-amber-600/20"
                    >
                        <Calendar className="w-5 h-5" />
                        <span>Reschedule</span>
                    </button>
                )}

                {capabilities.can_return_warehouse && (
                    <button
                        onClick={() => setIsReturnModalOpen(true)}
                        className="min-h-[48px] px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all"
                    >
                        <RotateCcw className="w-5 h-5 text-purple-400" />
                        <span>Return to Hub</span>
                    </button>
                )}
            </div>
        </DeliveryLayout>
    );
}

