import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { 
    X, 
    UserCheck, 
    Calendar, 
    Clock, 
    FileText,
    AlertCircle
} from 'lucide-react';

interface DriverOption {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
}

interface AssignDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId?: number | null;
    orderNumber?: string | null;
    deliveryId?: number | null;
    currentDriverId?: number | null;
    availableDrivers: DriverOption[];
}

export default function AssignDeliveryModal({
    isOpen,
    onClose,
    orderId,
    orderNumber,
    deliveryId,
    currentDriverId,
    availableDrivers,
}: AssignDeliveryModalProps) {
    const todayStr = new Date().toISOString().split('T')[0];
    const [driverId, setDriverId] = useState<number | ''>(currentDriverId || (availableDrivers[0]?.id ?? ''));
    const [scheduledDate, setScheduledDate] = useState(todayStr);
    const [deliveryWindow, setDeliveryWindow] = useState('Morning (09:00 - 13:00)');
    const [driverInstructions, setDriverInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!driverId) {
            setErrorMessage('Please select a delivery partner driver.');
            return;
        }
        if (!orderId) {
            setErrorMessage('Target order ID is required for driver assignment.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        router.post('/admin/deliveries/assign', {
            order_id: orderId,
            driver_id: driverId,
            scheduled_date: scheduledDate,
            delivery_window: deliveryWindow,
            driver_instructions: driverInstructions.trim() || undefined,
        }, {
            onSuccess: () => {
                setIsSubmitting(false);
                onClose();
            },
            onError: (errors) => {
                setIsSubmitting(false);
                setErrorMessage(Object.values(errors)[0] as string || 'Failed to assign delivery mission.');
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                {currentDriverId ? 'Reassign Delivery Partner' : 'Assign Delivery Partner'}
                            </h2>
                            {orderNumber && (
                                <p className="text-xs font-mono text-slate-400">Order #{orderNumber}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
                    {errorMessage && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Driver Selection */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                            Select Driver <span className="text-rose-400">*</span>
                        </label>
                        <select
                            value={driverId}
                            onChange={(e) => setDriverId(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-white outline-hidden transition-all"
                            required
                        >
                            {availableDrivers.map((driver) => (
                                <option key={driver.id} value={driver.id} className="bg-slate-900 text-white">
                                    {driver.name} ({driver.email}) {driver.phone ? `— ${driver.phone}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Scheduled Date */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                            Scheduled Date <span className="text-indigo-400">*</span>
                        </label>
                        <input
                            type="date"
                            min={todayStr}
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-white outline-hidden transition-all"
                            required
                        />
                    </div>

                    {/* Delivery Window */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                            Delivery Window
                        </label>
                        <select
                            value={deliveryWindow}
                            onChange={(e) => setDeliveryWindow(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-white outline-hidden transition-all"
                        >
                            <option value="Morning (09:00 - 13:00)">Morning (09:00 - 13:00)</option>
                            <option value="Afternoon (13:00 - 17:00)">Afternoon (13:00 - 17:00)</option>
                            <option value="Evening (17:00 - 20:00)">Evening (17:00 - 20:00)</option>
                            <option value="All Day (09:00 - 18:00)">All Day (09:00 - 18:00)</option>
                        </select>
                    </div>

                    {/* Driver Instructions */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                            Driver Instructions (Optional)
                        </label>
                        <textarea
                            rows={3}
                            value={driverInstructions}
                            onChange={(e) => setDriverInstructions(e.target.value)}
                            placeholder="e.g., Deliver via service entrance loading dock..."
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-hidden transition-all resize-none"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !driverId}
                            className="flex-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                        >
                            <UserCheck className="w-4 h-4" />
                            <span>{isSubmitting ? 'Assigning...' : 'Confirm Assignment'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
