import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { PaymentEvidenceUploader } from '@/Components/Payment/PaymentEvidenceUploader';
import {
    Banknote,
    CreditCard,
    DollarSign,
    Landmark,
    Send,
    Loader2,
    X,
    Building2,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    Clock,
    FileText,
} from 'lucide-react';

export interface RecordOrderPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: number;
    orderNumber: string;
    customerId: number;
    customerName: string;
    customerCode?: string;
    grandTotal: string | number;
    verifiedPaid?: string | number;
    pendingPaid?: string | number;
    outstandingBalance: string | number;
    portal?: 'admin' | 'salesman';
    onSuccess?: () => void;
}

export default function RecordOrderPaymentModal({
    isOpen,
    onClose,
    orderId,
    orderNumber,
    customerId,
    customerName,
    customerCode = '',
    grandTotal,
    verifiedPaid = '0.00',
    pendingPaid = '0.00',
    outstandingBalance,
    portal = 'admin',
    onSuccess,
}: RecordOrderPaymentModalProps) {
    const numOutstanding = Math.max(0, parseFloat(String(outstandingBalance)) || 0);
    const numGrandTotal = parseFloat(String(grandTotal)) || 0;
    const numVerified = parseFloat(String(verifiedPaid)) || 0;
    const numPending = parseFloat(String(pendingPaid)) || 0;

    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'MONEY_ORDER'>('CASH');
    const [amount, setAmount] = useState<string>('');
    const [isFullBalance, setIsFullBalance] = useState<boolean>(true);
    const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [receiptReference, setReceiptReference] = useState<string>('');
    const [bankName, setBankName] = useState<string>('');
    const [chequeNumber, setChequeNumber] = useState<string>('');
    const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [issuerName, setIssuerName] = useState<string>('');
    const [moneyOrderNumber, setMoneyOrderNumber] = useState<string>('');
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [notes, setNotes] = useState<string>('');

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            const defaultAmt = numOutstanding > 0 ? numOutstanding.toFixed(2) : '';
            setAmount(defaultAmt);
            setIsFullBalance(true);
            setPaymentMethod('CASH');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setReceiptReference('');
            setBankName('');
            setChequeNumber('');
            setChequeDate(new Date().toISOString().split('T')[0]);
            setIssuerName('');
            setMoneyOrderNumber('');
            setEvidenceFile(null);
            setNotes('');
            setErrors({});
            setIsSubmitting(false);
        }
    }, [isOpen, outstandingBalance]);

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isSubmitting) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen) return null;

    const handleQuickFullBalance = () => {
        setIsFullBalance(true);
        setAmount(numOutstanding.toFixed(2));
        if (errors.amount) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next.amount;
                return next;
            });
        }
    };

    const handleCustomAmountChange = (val: string) => {
        setIsFullBalance(false);
        setAmount(val);
        if (errors.amount) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next.amount;
                return next;
            });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setErrors({ amount: 'Please enter a valid payment amount greater than zero.' });
            return;
        }

        if (parsedAmount > numOutstanding + 0.001) {
            setErrors({
                amount: `Payment amount ($${parsedAmount.toFixed(2)}) exceeds remaining balance of $${numOutstanding.toFixed(2)}.`,
            });
            return;
        }

        if (paymentMethod === 'CHEQUE') {
            const errs: Record<string, string> = {};
            if (!bankName.trim()) errs.bank_name = 'Bank name is required for cheque payments.';
            if (!chequeNumber.trim()) errs.cheque_number = 'Cheque number is required.';
            if (!chequeDate) errs.cheque_date = 'Cheque date is required.';
            if (Object.keys(errs).length > 0) {
                setErrors(errs);
                return;
            }
        }

        if (paymentMethod === 'MONEY_ORDER') {
            const errs: Record<string, string> = {};
            if (!issuerName.trim()) errs.issuer_name = 'Issuer / Post Office / Provider name is required.';
            if (!moneyOrderNumber.trim()) errs.money_order_number = 'Money order number is required.';
            if (Object.keys(errs).length > 0) {
                setErrors(errs);
                return;
            }
        }

        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('customer_id', String(customerId));
        formData.append('order_id', String(orderId));
        formData.append('amount', String(parsedAmount.toFixed(2)));
        formData.append('payment_date', paymentDate);
        if (notes.trim()) formData.append('notes', notes.trim());

        let routeUrl = '';
        if (portal === 'salesman') {
            if (paymentMethod === 'CASH') {
                routeUrl = '/salesman/payments/cash';
                if (receiptReference.trim()) formData.append('receipt_reference', receiptReference.trim());
            } else if (paymentMethod === 'CHEQUE') {
                routeUrl = '/salesman/payments/cheque';
                formData.append('bank_name', bankName.trim());
                formData.append('cheque_number', chequeNumber.trim());
                formData.append('cheque_date', chequeDate);
                if (evidenceFile) formData.append('evidence', evidenceFile);
            } else if (paymentMethod === 'MONEY_ORDER') {
                routeUrl = '/salesman/payments/money-order';
                formData.append('issuer_name', issuerName.trim());
                formData.append('money_order_number', moneyOrderNumber.trim());
                if (receiptReference.trim()) formData.append('receipt_reference', receiptReference.trim());
                if (evidenceFile) formData.append('evidence', evidenceFile);
            }
        } else {
            if (paymentMethod === 'CASH') {
                routeUrl = '/admin/payments/cash';
                if (receiptReference.trim()) formData.append('receipt_reference', receiptReference.trim());
            } else if (paymentMethod === 'CHEQUE') {
                routeUrl = '/admin/payments/cheque';
                formData.append('bank_name', bankName.trim());
                formData.append('cheque_number', chequeNumber.trim());
                formData.append('cheque_date', chequeDate);
                if (evidenceFile) formData.append('evidence', evidenceFile);
            } else if (paymentMethod === 'MONEY_ORDER') {
                routeUrl = '/admin/payments/money-order';
                formData.append('issuer_name', issuerName.trim());
                formData.append('money_order_number', moneyOrderNumber.trim());
                if (receiptReference.trim()) formData.append('receipt_reference', receiptReference.trim());
                if (evidenceFile) formData.append('evidence', evidenceFile);
            }
        }

        router.post(routeUrl, formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmitting(false);
                onClose();
                if (onSuccess) onSuccess();
            },
            onError: (errs) => {
                setIsSubmitting(false);
                setErrors(errs as Record<string, string>);
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden my-8"
                role="dialog"
                aria-modal="true"
                aria-labelledby="record-payment-title"
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Banknote className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 id="record-payment-title" className="text-base font-bold text-foreground">
                                Record Order Balance Payment
                            </h2>
                            <p className="text-xs text-muted-foreground font-mono">
                                Order #{orderNumber} • {customerName} ({customerCode})
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Balance & Financial Snapshot Card */}
                <div className="px-6 py-3.5 bg-muted/20 border-b">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                        <div className="p-2 rounded bg-card border">
                            <div className="text-[10px] text-muted-foreground font-sans uppercase font-semibold">Grand Total</div>
                            <div className="text-sm font-bold text-foreground">${numGrandTotal.toFixed(2)}</div>
                        </div>
                        <div className="p-2 rounded bg-card border">
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans uppercase font-semibold">Verified Paid</div>
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${numVerified.toFixed(2)}</div>
                        </div>
                        <div className="p-2 rounded bg-card border">
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-sans uppercase font-semibold flex items-center justify-center gap-1">
                                <span>Pending</span>
                                {numPending > 0 && <Clock className="h-2.5 w-2.5" />}
                            </div>
                            <div className="text-sm font-bold text-amber-600 dark:text-amber-400">${numPending.toFixed(2)}</div>
                        </div>
                        <div className="p-2 rounded bg-primary/10 border border-primary/30">
                            <div className="text-[10px] text-primary font-sans uppercase font-bold">Outstanding</div>
                            <div className="text-sm font-bold text-primary">${numOutstanding.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Method Selector Tabs */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Payment Method
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('CASH')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                                    paymentMethod === 'CASH'
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-card text-muted-foreground hover:bg-muted/50 border-border'
                                }`}
                            >
                                <DollarSign className="h-4 w-4" />
                                <span>Cash</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('CHEQUE')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                                    paymentMethod === 'CHEQUE'
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-card text-muted-foreground hover:bg-muted/50 border-border'
                                }`}
                            >
                                <Landmark className="h-4 w-4" />
                                <span>Cheque</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('MONEY_ORDER')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                                    paymentMethod === 'MONEY_ORDER'
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-card text-muted-foreground hover:bg-muted/50 border-border'
                                }`}
                            >
                                <Send className="h-4 w-4" />
                                <span>Money Order</span>
                            </button>
                        </div>
                    </div>

                    {/* Amount & Quick Balance Selection */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Payment Amount ($) <span className="text-destructive">*</span>
                            </label>
                            {numOutstanding > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleQuickFullBalance}
                                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                            isFullBalance
                                                ? 'bg-primary/20 text-primary font-bold'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Full Balance (${numOutstanding.toFixed(2)})
                                    </button>
                                    <span className="text-muted-foreground/50">•</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFullBalance(false);
                                            setAmount('');
                                        }}
                                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                            !isFullBalance
                                                ? 'bg-primary/20 text-primary font-bold'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Partial Custom
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground font-bold">
                                $
                            </span>
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={numOutstanding}
                                value={amount}
                                onChange={(e) => handleCustomAmountChange(e.target.value)}
                                placeholder="0.00"
                                className={`pl-7 font-mono font-bold text-base ${errors.amount ? 'border-destructive' : ''}`}
                                disabled={isSubmitting}
                                required
                            />
                        </div>
                        {errors.amount && (
                            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>{errors.amount}</span>
                            </p>
                        )}
                    </div>

                    {/* Method Specific Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                                Payment Date <span className="text-destructive">*</span>
                            </label>
                            <Input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="text-xs font-mono"
                                disabled={isSubmitting}
                                required
                            />
                            {errors.payment_date && (
                                <p className="text-xs text-destructive mt-1">{errors.payment_date}</p>
                            )}
                        </div>

                        {paymentMethod === 'CASH' && (
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                    Receipt Reference
                                </label>
                                <Input
                                    type="text"
                                    value={receiptReference}
                                    onChange={(e) => setReceiptReference(e.target.value)}
                                    placeholder="e.g. RCT-88492"
                                    className="text-xs font-mono"
                                    disabled={isSubmitting}
                                />
                                {errors.receipt_reference && (
                                    <p className="text-xs text-destructive mt-1">{errors.receipt_reference}</p>
                                )}
                            </div>
                        )}

                        {paymentMethod === 'CHEQUE' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Bank Name <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        placeholder="e.g. Chase, Wells Fargo"
                                        className="text-xs"
                                        disabled={isSubmitting}
                                        required
                                    />
                                    {errors.bank_name && (
                                        <p className="text-xs text-destructive mt-1">{errors.bank_name}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Cheque Number <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={chequeNumber}
                                        onChange={(e) => setChequeNumber(e.target.value)}
                                        placeholder="e.g. 104829"
                                        className="text-xs font-mono"
                                        disabled={isSubmitting}
                                        required
                                    />
                                    {errors.cheque_number && (
                                        <p className="text-xs text-destructive mt-1">{errors.cheque_number}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Cheque Date <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={chequeDate}
                                        onChange={(e) => setChequeDate(e.target.value)}
                                        className="text-xs font-mono"
                                        disabled={isSubmitting}
                                        required
                                    />
                                    {errors.cheque_date && (
                                        <p className="text-xs text-destructive mt-1">{errors.cheque_date}</p>
                                    )}
                                </div>
                            </>
                        )}

                        {paymentMethod === 'MONEY_ORDER' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Issuer / Provider <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={issuerName}
                                        onChange={(e) => setIssuerName(e.target.value)}
                                        placeholder="e.g. USPS, Western Union"
                                        className="text-xs"
                                        disabled={isSubmitting}
                                        required
                                    />
                                    {errors.issuer_name && (
                                        <p className="text-xs text-destructive mt-1">{errors.issuer_name}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Money Order Number <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={moneyOrderNumber}
                                        onChange={(e) => setMoneyOrderNumber(e.target.value)}
                                        placeholder="e.g. MO-99281"
                                        className="text-xs font-mono"
                                        disabled={isSubmitting}
                                        required
                                    />
                                    {errors.money_order_number && (
                                        <p className="text-xs text-destructive mt-1">{errors.money_order_number}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Receipt Reference
                                    </label>
                                    <Input
                                        type="text"
                                        value={receiptReference}
                                        onChange={(e) => setReceiptReference(e.target.value)}
                                        placeholder="Optional receipt reference"
                                        className="text-xs font-mono"
                                        disabled={isSubmitting}
                                    />
                                    {errors.receipt_reference && (
                                        <p className="text-xs text-destructive mt-1">{errors.receipt_reference}</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Evidence Attachment for Cheque / Money Order */}
                    {(paymentMethod === 'CHEQUE' || paymentMethod === 'MONEY_ORDER') && (
                        <div>
                            <PaymentEvidenceUploader
                                value={evidenceFile}
                                onChange={setEvidenceFile}
                                error={errors.evidence}
                                disabled={isSubmitting}
                                label="Cheque / Money Order Physical Photo / Scan"
                                description="Upload a JPEG photo or scan of the physical instrument (Max 5 MB)."
                            />
                        </div>
                    )}

                    {/* Operational Notes */}
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                            Collection & Settlement Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes or collection reference details..."
                            rows={2}
                            maxLength={1000}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isSubmitting}
                        />
                        {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes}</p>}
                    </div>

                    {/* Server Generic Error */}
                    {errors.general && (
                        <div className="p-3 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{errors.general}</span>
                        </div>
                    )}

                    {/* Modal Actions */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            <span>Queues for authoritative ledger verification</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isSubmitting || numOutstanding <= 0}
                                className="gap-1.5 font-semibold"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Recording Payment...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        <span>Record Payment (${amount ? parseFloat(amount).toFixed(2) : '0.00'})</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
