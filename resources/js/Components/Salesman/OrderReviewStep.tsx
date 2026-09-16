import React, { useMemo } from 'react';
import { CustomerSummary, CartLineItem } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Input } from '@/Components/ui/input';
import {
    Building,
    MapPin,
    CreditCard,
    ArrowLeft,
    CheckCircle2,
    Trash2,
    AlertTriangle,
    ShieldCheck,
    Tag,
    FileText,
    Receipt,
    Banknote,
    UploadCloud,
    FileImage,
    X,
    Clock,
    DollarSign,
    Check,
} from 'lucide-react';
import { QuantityStepper } from '@/Components/Salesman/QuantityStepper';
import { OrderReviewLineCard } from '@/Components/Salesman/OrderReviewLineCard';
import { SubmitButton } from '@/Components/ui/Form/SubmitButton';
import { calculateOrderPreview, formatCurrency } from '@/lib/financial';

export interface PaymentCollectionState {
    recordPayment: boolean;
    paymentMethod: 'CASH' | 'CHEQUE' | 'MONEY_ORDER';
    paymentAmount: string;
    paymentDate: string;
    bankName: string;
    chequeNumber: string;
    chequeDate: string;
    issuerName: string;
    moneyOrderNumber: string;
    receiptReference: string;
    paymentNotes: string;
    evidenceFile: File | null;
}

interface OrderReviewStepProps {
    customer: CustomerSummary;
    cart: CartLineItem[];
    notes: string;
    onNotesChange: (notes: string) => void;
    onUpdateQuantity: (productId: number, quantity: number) => void;
    onRemoveItem: (productId: number) => void;
    onBackToCatalog: () => void;
    onSubmitOrder: () => void;
    isSubmitting: boolean;
    errorMessage: string | null;
    paymentForm: PaymentCollectionState;
    onPaymentFormChange: (updater: (prev: PaymentCollectionState) => PaymentCollectionState) => void;
}

export const OrderReviewStep: React.FC<OrderReviewStepProps> = ({
    customer,
    cart,
    notes,
    onNotesChange,
    onUpdateQuantity,
    onRemoveItem,
    onBackToCatalog,
    onSubmitOrder,
    isSubmitting,
    errorMessage,
    paymentForm,
    onPaymentFormChange,
}) => {
    // Non-authoritative client preview calculation (ROUND_HALF_UP parity helper)
    const calculation = useMemo(() => calculateOrderPreview(cart), [cart]);

    // Financial balance preview - safely parsed numeric values
    const parsedGrandTotal = typeof calculation.numericGrandTotal === 'number'
        ? calculation.numericGrandTotal
        : (parseFloat(calculation.grandTotal) || 0);
    const parsedPaymentAmount = parseFloat(paymentForm.paymentAmount) || 0;
    const remainingOutstanding = Math.max(0, parsedGrandTotal - (paymentForm.recordPayment ? parsedPaymentAmount : 0));
    const isOverpaying = paymentForm.recordPayment && parsedPaymentAmount > parsedGrandTotal;

    const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.includes('jpeg') && !file.type.includes('jpg') && !file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
            alert('Evidence must be a JPEG image file (.jpg or .jpeg).');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Evidence file size must be less than 5MB.');
            return;
        }

        onPaymentFormChange((prev) => ({
            ...prev,
            evidenceFile: file,
        }));
    };

    const handleRemoveEvidence = () => {
        onPaymentFormChange((prev) => ({
            ...prev,
            evidenceFile: null,
        }));
    };

    const handleSetFullPayment = () => {
        onPaymentFormChange((prev) => ({
            ...prev,
            paymentAmount: parsedGrandTotal > 0 ? parsedGrandTotal.toFixed(2) : (calculation.grandTotal || '0.00'),
        }));
    };

    return (
        <div className="space-y-6">
            {/* Top Navigation & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">Order Review & Confirmation</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Review customer account, product lines, record payment collection, and confirm order submission.
                    </p>
                </div>
                <Button variant="outline" onClick={onBackToCatalog} className="shrink-0 gap-2 text-xs font-semibold">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Catalogue</span>
                </Button>
            </div>

            {/* Error Message Banner */}
            {errorMessage && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-3 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-sm">Submission Failed</p>
                        <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left 2 Columns: Customer & Line Items & Payment & Notes */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Information Card */}
                    <Card className="rounded-xl border border-border/80 shadow-2xs">
                        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/15">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-sm font-bold">{customer.name}</CardTitle>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {customer.code}
                                    </Badge>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                    {customer.status_label || customer.status}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
                            <div>
                                <span className="font-semibold text-foreground block mb-1">Shipping Address:</span>
                                <div className="flex items-start gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                                    <span>{customer.shipping_address || customer.billing_address || 'No address specified'}</span>
                                </div>
                            </div>
                            <div>
                                <span className="font-semibold text-foreground block mb-1">Commercial Terms:</span>
                                <div className="flex items-center gap-1.5">
                                    <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span>Terms: {customer.payment_terms_label || 'Standard Terms'}</span>
                                </div>
                                <div className="mt-1 font-mono text-muted-foreground">
                                    Credit Limit: {formatCurrency(customer.credit_limit)}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order Line Items */}
                    <Card className="rounded-xl border border-border/80 shadow-2xs overflow-hidden">
                        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/15 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-primary" />
                                <span>Order Lines ({calculation.totalUnits} {calculation.totalUnits === 1 ? 'unit' : 'units'})</span>
                            </CardTitle>
                            <Badge variant="outline" className="font-mono text-xs">
                                {calculation.itemCount} {calculation.itemCount === 1 ? 'line item' : 'line items'}
                            </Badge>
                        </CardHeader>

                        {/* Mobile Card Layout (<640px) */}
                        <div className="p-4 space-y-3 sm:hidden">
                            {calculation.lines.length === 0 ? (
                                <div className="text-center py-8 text-xs text-muted-foreground">
                                    Your order is empty. Please add items from the catalog.
                                </div>
                            ) : (
                                calculation.lines.map((line) => (
                                    <OrderReviewLineCard
                                        key={line.product.id}
                                        line={line}
                                        onUpdateQuantity={onUpdateQuantity}
                                        onRemoveItem={onRemoveItem}
                                        disabled={isSubmitting}
                                    />
                                ))
                            )}
                        </div>

                        {/* Desktop / Tablet Table Layout (>=640px) */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="border-b border-border/60 bg-muted/30 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th scope="col" className="py-3 px-4 w-[32%]">Product / SKU</th>
                                        <th scope="col" className="py-3 px-3 text-right">Unit Price</th>
                                        <th scope="col" className="py-3 px-3 text-center">Quantity</th>
                                        <th scope="col" className="py-3 px-3 text-right">Taxable</th>
                                        <th scope="col" className="py-3 px-3 text-right">Tax Rate</th>
                                        <th scope="col" className="py-3 px-3 text-right">Tax Amount</th>
                                        <th scope="col" className="py-3 px-4 text-right">Line Total</th>
                                        <th scope="col" className="py-3 px-3 w-[40px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 bg-card">
                                    {calculation.lines.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                                                Your order is empty. Please add items from the catalog.
                                            </td>
                                        </tr>
                                    ) : (
                                        calculation.lines.map((line) => (
                                            <tr key={line.product.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-foreground">{line.product.name}</div>
                                                    <div className="text-[11px] font-mono text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                                                        <span>SKU: {line.product.sku}</span>
                                                        <span>•</span>
                                                        <span>Unit: {line.product.unit}</span>
                                                        {line.isCustomPrice && (
                                                            <Badge variant="outline" className="text-[9px] py-0 px-1 h-3.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-0.5 font-sans">
                                                                <Tag className="h-2 w-2" />
                                                                <span>Custom</span>
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono font-medium">
                                                    {formatCurrency(line.unitPrice)}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <div className="flex justify-center">
                                                        <QuantityStepper
                                                            value={line.quantity}
                                                            min={1}
                                                            max={999999}
                                                            onChange={(qty) => onUpdateQuantity(line.product.id, qty)}
                                                            disabled={isSubmitting}
                                                            size="sm"
                                                            ariaLabel={`Quantity for ${line.product.name}`}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono text-foreground">
                                                    {formatCurrency(line.taxableAmount)}
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono">
                                                    <div className="text-foreground font-medium">{line.formattedTaxRate}</div>
                                                    <div className="text-[10px] text-muted-foreground truncate max-w-[100px] ml-auto">
                                                        {line.taxProfileCode}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono text-foreground font-medium">
                                                    {formatCurrency(line.taxAmount)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                                                    {formatCurrency(line.lineTotal)}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => onRemoveItem(line.product.id)}
                                                        disabled={isSubmitting}
                                                        aria-label={`Remove ${line.product.name}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Salesman Payment Collection Panel */}
                    <Card className="rounded-xl border border-border/80 shadow-2xs overflow-hidden">
                        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/15">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Banknote className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-sm font-bold">Payment Collection</CardTitle>
                                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                        Salesman Workflow
                                    </Badge>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                                    <input
                                        type="checkbox"
                                        checked={paymentForm.recordPayment}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            onPaymentFormChange((prev) => ({
                                                ...prev,
                                                recordPayment: checked,
                                                paymentAmount: checked && !prev.paymentAmount
                                                    ? (parsedGrandTotal > 0 ? parsedGrandTotal.toFixed(2) : (calculation.grandTotal || ''))
                                                    : prev.paymentAmount,
                                            }));
                                        }}
                                        disabled={isSubmitting}
                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                    />
                                    <span>Record payment with this order</span>
                                </label>
                            </div>
                        </CardHeader>

                        {paymentForm.recordPayment ? (
                            <CardContent className="p-4 space-y-4">
                                {/* Payment Method Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground block">
                                        Select Payment Method <span className="text-destructive">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['CASH', 'CHEQUE', 'MONEY_ORDER'] as const).map((method) => {
                                            const isSelected = paymentForm.paymentMethod === method;
                                            const labels = {
                                                CASH: 'Cash Collection',
                                                CHEQUE: 'Cheque',
                                                MONEY_ORDER: 'Money Order',
                                            };
                                            const icons = {
                                                CASH: Banknote,
                                                CHEQUE: FileText,
                                                MONEY_ORDER: CreditCard,
                                            };
                                            const IconComponent = icons[method];

                                            return (
                                                <button
                                                    type="button"
                                                    key={method}
                                                    onClick={() => onPaymentFormChange((prev) => ({ ...prev, paymentMethod: method }))}
                                                    disabled={isSubmitting}
                                                    className={`p-3 rounded-lg border text-left transition-all flex flex-col items-start gap-1.5 ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/5 ring-1 ring-primary text-foreground'
                                                            : 'border-border/80 bg-card hover:bg-muted/40 text-muted-foreground'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <IconComponent className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                                                    </div>
                                                    <span className="text-xs font-bold">{labels[method]}</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {method === 'CASH' ? 'Immediate receipt' : 'Recorded instrument'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Amount & Date Inputs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-foreground">
                                                Collected Amount ($) <span className="text-destructive">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleSetFullPayment}
                                                className="text-[11px] text-primary hover:underline font-medium"
                                            >
                                                Pay in Full ({formatCurrency(calculation.grandTotal)})
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                max={parsedGrandTotal > 0 ? parsedGrandTotal : 999999999}
                                                placeholder="0.00"
                                                value={paymentForm.paymentAmount}
                                                onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                                                disabled={isSubmitting}
                                                className="pl-8 text-xs font-mono font-semibold"
                                            />
                                        </div>
                                        {isOverpaying && (
                                            <p className="text-[11px] text-destructive flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                                Amount exceeds order grand total of {formatCurrency(calculation.grandTotal)}.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">
                                            Collection Date <span className="text-destructive">*</span>
                                        </label>
                                        <Input
                                            type="date"
                                            value={paymentForm.paymentDate}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, paymentDate: e.target.value }))}
                                            disabled={isSubmitting}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Method Specific Fields */}
                                {paymentForm.paymentMethod === 'CHEQUE' && (
                                    <div className="p-3.5 rounded-lg bg-muted/20 border border-border/60 space-y-3">
                                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5 text-primary" />
                                            <span>Cheque Instrument Details</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-foreground">
                                                    Cheque Number <span className="text-destructive">*</span>
                                                </label>
                                                <Input
                                                    placeholder="e.g. CHQ-98124"
                                                    value={paymentForm.chequeNumber}
                                                    onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, chequeNumber: e.target.value }))}
                                                    disabled={isSubmitting}
                                                    className="text-xs font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-foreground">
                                                    Bank Name <span className="text-destructive">*</span>
                                                </label>
                                                <Input
                                                    placeholder="e.g. Chase / Wells Fargo"
                                                    value={paymentForm.bankName}
                                                    onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, bankName: e.target.value }))}
                                                    disabled={isSubmitting}
                                                    className="text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-foreground">
                                                    Cheque Date <span className="text-destructive">*</span>
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={paymentForm.chequeDate}
                                                    onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, chequeDate: e.target.value }))}
                                                    disabled={isSubmitting}
                                                    className="text-xs font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {paymentForm.paymentMethod === 'MONEY_ORDER' && (
                                    <div className="p-3.5 rounded-lg bg-muted/20 border border-border/60 space-y-3">
                                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <CreditCard className="h-3.5 w-3.5 text-primary" />
                                            <span>Money Order Instrument Details</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-foreground">
                                                    Money Order Number <span className="text-destructive">*</span>
                                                </label>
                                                <Input
                                                    placeholder="e.g. MO-883921"
                                                    value={paymentForm.moneyOrderNumber}
                                                    onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, moneyOrderNumber: e.target.value }))}
                                                    disabled={isSubmitting}
                                                    className="text-xs font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-foreground">
                                                    Issuer / Organization <span className="text-destructive">*</span>
                                                </label>
                                                <Input
                                                    placeholder="e.g. Western Union / USPS"
                                                    value={paymentForm.issuerName}
                                                    onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, issuerName: e.target.value }))}
                                                    disabled={isSubmitting}
                                                    className="text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {paymentForm.paymentMethod === 'CASH' && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-foreground">
                                            Cash Receipt / Reference (Optional)
                                        </label>
                                        <Input
                                            placeholder="e.g. Cash Receipt # or Deposit Tag"
                                            value={paymentForm.receiptReference}
                                            onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, receiptReference: e.target.value }))}
                                            disabled={isSubmitting}
                                            className="text-xs"
                                        />
                                    </div>
                                )}

                                {/* Payment Notes */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-foreground">
                                        Payment Collection Notes (Optional)
                                    </label>
                                    <Input
                                        placeholder="Add notes for cashier or accounting verification..."
                                        value={paymentForm.paymentNotes}
                                        onChange={(e) => onPaymentFormChange((prev) => ({ ...prev, paymentNotes: e.target.value }))}
                                        disabled={isSubmitting}
                                        className="text-xs"
                                    />
                                </div>
                            </CardContent>
                        ) : (
                            <CardContent className="p-4 text-xs text-muted-foreground flex items-center justify-between">
                                <span>No payment collected upfront. Order will be submitted with status Unpaid.</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onPaymentFormChange((prev) => ({
                                        ...prev,
                                        recordPayment: true,
                                        paymentAmount: parsedGrandTotal > 0 ? parsedGrandTotal.toFixed(2) : (calculation.grandTotal || '0.00'),
                                    }))}
                                    className="text-xs h-7"
                                >
                                    + Add Payment
                                </Button>
                            </CardContent>
                        )}
                    </Card>

                    {/* Order Notes / Instructions */}
                    <Card className="rounded-xl border border-border/80 shadow-2xs">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">Order Instructions / Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-1">
                            <textarea
                                placeholder="Add optional customer PO reference, delivery notes, or specific handling instructions..."
                                value={notes}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNotesChange(e.target.value)}
                                rows={3}
                                maxLength={1000}
                                disabled={isSubmitting}
                                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs shadow-2xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            />
                            <div className="flex justify-end text-[10px] text-muted-foreground font-mono mt-1">
                                {notes.length} / 1000 characters
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Financial Summary & Submit */}
                <div className="space-y-6 lg:sticky lg:top-20">
                    <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
                        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
                            <CardTitle className="text-sm font-bold">Order Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal (Taxable):</span>
                                    <span className="font-mono font-medium text-foreground">
                                        {formatCurrency(calculation.subtotal)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Estimated Line Taxes:</span>
                                    <span className="font-mono font-medium text-foreground">
                                        {formatCurrency(calculation.taxTotal)}
                                    </span>
                                </div>
                                <div className="pt-2.5 border-t border-border/80 flex justify-between items-baseline">
                                    <span className="text-sm font-bold text-foreground">Grand Total:</span>
                                    <span className="text-xl font-bold font-mono text-primary">
                                        {formatCurrency(calculation.grandTotal)}
                                    </span>
                                </div>

                                {paymentForm.recordPayment && (
                                    <div className="pt-2.5 border-t border-dashed border-border space-y-2 text-xs">
                                        <div className="flex justify-between items-center text-foreground">
                                            <span className="font-semibold flex items-center gap-1">
                                                <span>Payment Recorded:</span>
                                                <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                                    {paymentForm.paymentMethod}
                                                </Badge>
                                            </span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(parsedPaymentAmount)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-muted-foreground">
                                            <span>Payment Status:</span>
                                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                                                <Clock className="h-2.5 w-2.5" />
                                                <span>Pending Verification</span>
                                            </Badge>
                                        </div>

                                        <div className="flex justify-between items-baseline text-foreground pt-1 border-t border-border/40">
                                            <span className="font-bold">Remaining Outstanding:</span>
                                            <span className="font-mono font-bold text-sm">
                                                {formatCurrency(remainingOutstanding)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1 border border-border/50">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                    <span>Server-Authoritative Calculation</span>
                                </div>
                                <p className="leading-relaxed opacity-90">
                                    Product prices, tax profile rates, and payment amounts are validated server-side. Recorded payments are linked to the order and queued for Admin verification.
                                </p>
                            </div>

                            <SubmitButton
                                type="button"
                                className="w-full h-11 text-sm font-semibold gap-2 shadow-xs"
                                onClick={onSubmitOrder}
                                isLoading={isSubmitting}
                                loadingText="Placing Order..."
                                disabled={cart.length === 0 || isOverpaying}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Submit Order</span>
                            </SubmitButton>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
