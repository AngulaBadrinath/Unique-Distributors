import React, { useState, useEffect } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Badge } from '@/Components/ui/badge';
import {
    RotateCcw,
    ArrowLeft,
    PackageCheck,
    AlertCircle,
    Info,
    Building2,
    DollarSign,
    CheckCircle2
} from 'lucide-react';

interface ReturnableItem {
    order_item_id: number;
    product_id: number;
    product_name: string;
    sku: string;
    delivered_quantity: number;
    returned_quantity: number;
    pending_return_quantity: number;
    returnable_quantity: number;
    unit_price: string;
    tax_rate: string;
}

interface OrderOption {
    id: number;
    order_number: string;
    customer_id: number;
    total_amount: string | number;
    created_at: string;
    customer?: {
        id: number;
        name: string;
        code: string;
    };
}

interface WarehouseOption {
    id: number;
    name: string;
    code: string;
}

interface ReasonOption {
    value: string;
    label: string;
}

interface Props {
    eligibleOrders: OrderOption[];
    selectedOrder?: any;
    returnableItems?: Record<number, ReturnableItem> | ReturnableItem[];
    warehouses: WarehouseOption[];
    reasons: ReasonOption[];
    isSalesmanView?: boolean;
}

export default function Create({
    eligibleOrders = [],
    selectedOrder,
    returnableItems = [],
    warehouses = [],
    reasons = [],
    isSalesmanView = false,
}: Props) {
    const rawItems = Array.isArray(returnableItems) ? returnableItems : Object.values(returnableItems);

    const [itemsList, setItemsList] = useState<ReturnableItem[]>(rawItems);
    const [selectedOrderId, setSelectedOrderId] = useState<string>(selectedOrder?.id?.toString() || '');

    const { data, setData, processing, errors } = useForm({
        order_id: selectedOrder?.id || '',
        warehouse_id: warehouses[0]?.id || '',
        notes: '',
        items: [] as Array<{
            order_item_id: number;
            requested_quantity: number;
            reason_code: string;
            item_notes: string;
        }>,
    });

    useEffect(() => {
        if (selectedOrder && rawItems.length > 0) {
            setItemsList(rawItems);
            setData(prev => ({
                ...prev,
                order_id: selectedOrder.id,
                items: rawItems.map(item => ({
                    order_item_id: item.order_item_id,
                    requested_quantity: 0,
                    reason_code: reasons[0]?.value || 'DEFECTIVE',
                    item_notes: '',
                })),
            }));
        }
    }, [selectedOrder]);

    const handleOrderSelect = (orderId: string) => {
        setSelectedOrderId(orderId);
        if (!orderId) return;

        const baseUrl = isSalesmanView ? '/salesman/returns/create' : '/admin/returns/create';
        router.get(`${baseUrl}?order_id=${orderId}`, {}, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleItemQtyChange = (orderItemId: number, qtyStr: string) => {
        const qty = parseInt(qtyStr, 10) || 0;
        const currentItems = [...data.items];
        const existingIdx = currentItems.findIndex(i => i.order_item_id === orderItemId);

        if (existingIdx >= 0) {
            currentItems[existingIdx].requested_quantity = qty;
        } else {
            currentItems.push({
                order_item_id: orderItemId,
                requested_quantity: qty,
                reason_code: reasons[0]?.value || 'DEFECTIVE',
                item_notes: '',
            });
        }

        setData('items', currentItems);
    };

    const handleItemReasonChange = (orderItemId: number, reasonCode: string) => {
        const currentItems = [...data.items];
        const existingIdx = currentItems.findIndex(i => i.order_item_id === orderItemId);

        if (existingIdx >= 0) {
            currentItems[existingIdx].reason_code = reasonCode;
        } else {
            currentItems.push({
                order_item_id: orderItemId,
                requested_quantity: 0,
                reason_code: reasonCode,
                item_notes: '',
            });
        }

        setData('items', currentItems);
    };

    const handleItemNotesChange = (orderItemId: number, notes: string) => {
        const currentItems = [...data.items];
        const existingIdx = currentItems.findIndex(i => i.order_item_id === orderItemId);

        if (existingIdx >= 0) {
            currentItems[existingIdx].item_notes = notes;
        } else {
            currentItems.push({
                order_item_id: orderItemId,
                requested_quantity: 0,
                reason_code: reasons[0]?.value || 'DEFECTIVE',
                item_notes: notes,
            });
        }

        setData('items', currentItems);
    };

    // Calculate live financial summary
    let estimatedSubtotal = 0;
    let estimatedTax = 0;
    let totalUnitsRequested = 0;

    data.items.forEach(inputItem => {
        const refItem = itemsList.find(i => i.order_item_id === inputItem.order_item_id);
        if (refItem && inputItem.requested_quantity > 0) {
            const price = parseFloat(refItem.unit_price) || 0;
            const taxRate = parseFloat(refItem.tax_rate) || 0;
            const lineSub = inputItem.requested_quantity * price;
            const lineTax = lineSub * taxRate;

            estimatedSubtotal += lineSub;
            estimatedTax += lineTax;
            totalUnitsRequested += inputItem.requested_quantity;
        }
    });

    const estimatedTotal = estimatedSubtotal + estimatedTax;
    const backUrl = isSalesmanView ? '/salesman/returns' : '/admin/returns';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const activeItems = data.items.filter(i => i.requested_quantity > 0);
        if (activeItems.length === 0) {
            alert('Please specify a return quantity of at least 1 unit for at least one line item.');
            return;
        }

        const submitData = {
            ...data,
            items: activeItems,
        };

        const targetUrl = isSalesmanView ? '/salesman/returns' : '/admin/returns';
        router.post(targetUrl, submitData);
    };

    return (
        <AppLayout>
            <Head title="Initiate Return Request" />

            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link
                        href={backUrl}
                        className="inline-flex items-center justify-center h-9 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent text-slate-800 dark:text-slate-200"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        Back to Returns
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Initiate Return Request</h1>
                        <p className="text-xs text-slate-500">Create a merchandise return request against delivered customer orders.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Select Delivered Order */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <PackageCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            1. Select Delivered Order
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="order_select">Delivered Order</Label>
                                <select
                                    id="order_select"
                                    value={selectedOrderId}
                                    onChange={e => handleOrderSelect(e.target.value)}
                                    className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    <option value="">-- Choose delivered order --</option>
                                    {eligibleOrders.map(ord => (
                                        <option key={ord.id} value={ord.id}>
                                            {ord.order_number} — {ord.customer?.name} (${parseFloat(String(ord.total_amount)).toFixed(2)})
                                        </option>
                                    ))}
                                </select>
                                {errors.order_id && <p className="text-xs text-rose-600">{errors.order_id}</p>}
                            </div>

                            {!isSalesmanView && warehouses.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="warehouse_select">Target Warehouse (Receiving)</Label>
                                    <select
                                        id="warehouse_select"
                                        value={data.warehouse_id}
                                        onChange={e => setData('warehouse_id', parseInt(e.target.value, 10))}
                                        className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>
                                                {w.name} ({w.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Line Items Selection */}
                    {selectedOrder && itemsList.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <RotateCcw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    2. Returnable Line Items ({selectedOrder.order_number})
                                </h2>
                                <span className="text-xs text-slate-500">
                                    Only previously delivered and unreturned quantities are eligible.
                                </span>
                            </div>

                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
                                {itemsList.map(item => {
                                    const formItem = data.items.find(i => i.order_item_id === item.order_item_id);
                                    const isEligible = item.returnable_quantity > 0;

                                    return (
                                        <div
                                            key={item.order_item_id}
                                            className={`p-4 space-y-3 ${!isEligible ? 'bg-slate-50/70 dark:bg-slate-900/40 opacity-60' : 'bg-white dark:bg-slate-800'}`}
                                        >
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.product_name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">SKU: {item.sku} • Unit Price: ${parseFloat(item.unit_price).toFixed(2)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-slate-500 dark:text-slate-400">Delivered: <strong className="text-slate-700 dark:text-slate-200">{item.delivered_quantity}</strong></span>
                                                    <span className="text-slate-500 dark:text-slate-400">Already Returned: <strong className="text-slate-700 dark:text-slate-200">{item.returned_quantity}</strong></span>
                                                    <Badge variant="outline" className={isEligible ? 'border-indigo-300 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400'}>
                                                        Returnable: {item.returnable_quantity} units
                                                    </Badge>
                                                </div>
                                            </div>

                                            {isEligible ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`req-qty-${item.order_item_id}`} className="text-xs">
                                                            Quantity to Return
                                                        </Label>
                                                        <Input
                                                            id={`req-qty-${item.order_item_id}`}
                                                            type="number"
                                                            min="0"
                                                            max={item.returnable_quantity}
                                                            value={formItem?.requested_quantity ?? 0}
                                                            onChange={e => handleItemQtyChange(item.order_item_id, e.target.value)}
                                                            className="h-9 font-semibold"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label htmlFor={`reason-${item.order_item_id}`} className="text-xs">
                                                            Return Reason
                                                        </Label>
                                                        <select
                                                            id={`reason-${item.order_item_id}`}
                                                            value={formItem?.reason_code || (reasons[0]?.value ?? 'DEFECTIVE')}
                                                            onChange={e => handleItemReasonChange(item.order_item_id, e.target.value)}
                                                            className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        >
                                                            {reasons.map(r => (
                                                                <option key={r.value} value={r.value}>
                                                                    {r.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label htmlFor={`item-notes-${item.order_item_id}`} className="text-xs">
                                                            Item Notes
                                                        </Label>
                                                        <Input
                                                            id={`item-notes-${item.order_item_id}`}
                                                            type="text"
                                                            placeholder="e.g. Expired, wrong size, leaking"
                                                            value={formItem?.item_notes || ''}
                                                            onChange={e => handleItemNotesChange(item.order_item_id, e.target.value)}
                                                            className="h-9 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">No returnable units remaining for this line.</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Notes and Financial Summary */}
                    {selectedOrder && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="notes">Return Request Notes & RMA Explanation</Label>
                                <textarea
                                    id="notes"
                                    rows={3}
                                    placeholder="State the reason for return, authorization details, or customer feedback..."
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Live Financial Projection */}
                            <div className="p-4 bg-slate-900 text-white rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <span className="text-xs text-slate-400 block">Total Units to Return</span>
                                    <span className="text-xl font-bold text-indigo-300">{totalUnitsRequested} units</span>
                                </div>
                                <div className="flex gap-6 text-right">
                                    <div>
                                        <span className="text-xs text-slate-400 block">Subtotal</span>
                                        <span className="font-semibold text-slate-200">${estimatedSubtotal.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-400 block">Est. Tax</span>
                                        <span className="font-semibold text-slate-200">${estimatedTax.toFixed(2)}</span>
                                    </div>
                                    <div className="border-l border-slate-700 pl-6">
                                        <span className="text-xs text-slate-400 block">Estimated Credit Total</span>
                                        <span className="text-2xl font-black text-emerald-400">${estimatedTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <Link href={backUrl}>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                    disabled={processing || totalUnitsRequested === 0}
                                >
                                    {processing ? 'Submitting Return...' : 'Submit Return Request'}
                                </Button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </AppLayout>
    );
}
