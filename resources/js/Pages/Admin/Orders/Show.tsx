import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { AdminOrderDetailData, OrderPaymentDetail } from '@/types/order';
import OrderTimeline from '@/Pages/Salesman/Orders/Partials/OrderTimeline';
import OrderDetailHeader from './Partials/OrderDetailHeader';
import OrderDetailCustomerCard from './Partials/OrderDetailCustomerCard';
import OrderDetailItemsTable from './Partials/OrderDetailItemsTable';
import OrderDetailItemsCards from './Partials/OrderDetailItemsCards';
import OrderDetailFinancialSummary from './Partials/OrderDetailFinancialSummary';
import OrderDetailOperationalCards from './Partials/OrderDetailOperationalCards';
import PendingAdjustmentBanner from './Partials/PendingAdjustmentBanner';
import RequestAdjustmentModal from './Partials/RequestAdjustmentModal';
import RecordOrderPaymentModal from '@/Components/Order/RecordOrderPaymentModal';
import { PaymentEvidencePreviewModal } from '@/Components/Payment/PaymentEvidencePreviewModal';
import { MessageSquare, ShieldCheck, Clock, Banknote, FileImage } from 'lucide-react';

interface AdminOrderShowPageProps {
    orderData: AdminOrderDetailData;
    backUrl?: string;
    backLabel?: string;
}

export default function Show({
    orderData,
    backUrl = '/admin/orders',
    backLabel = 'Back to Order Queue',
}: AdminOrderShowPageProps) {
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedEvidencePayment, setSelectedEvidencePayment] = useState<OrderPaymentDetail | null>(null);

    const {
        order,
        customer,
        salesman,
        creator,
        items,
        tax_breakdown,
        fulfillment_summary,
        timeline,
        active_adjustment,
        payments,
        financial_summary,
        can,
    } = orderData;

    return (
        <AppLayout title={`Order ${order.order_number}`}>
            <Head title={`Order ${order.order_number} — Detail Workspace`} />

            <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8">
                {/* Header, Actions & Status Dimension Bar */}
                <OrderDetailHeader
                    order={order}
                    customer={customer}
                    salesman={salesman}
                    creator={creator}
                    can={can}
                    backUrl={orderData.backUrl || backUrl}
                    backLabel={orderData.backLabel || backLabel}
                    onRequestAdjustment={() => setIsAdjustmentModalOpen(true)}
                    onRecordPayment={() => setIsPaymentModalOpen(true)}
                />

                {/* Pending Adjustment Banner (When an active submitted adjustment exists) */}
                {active_adjustment && (
                    <PendingAdjustmentBanner
                        orderId={order.id}
                        orderNumber={order.order_number}
                        activeAdjustment={active_adjustment}
                    />
                )}

                {/* Request Adjustment Modal */}
                <RequestAdjustmentModal
                    isOpen={isAdjustmentModalOpen}
                    orderId={order.id}
                    orderNumber={order.order_number}
                    items={items}
                    onClose={() => setIsAdjustmentModalOpen(false)}
                />

                {/* Record Balance Payment Modal */}
                <RecordOrderPaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    orderId={order.id}
                    orderNumber={order.order_number}
                    customerId={customer.id}
                    customerName={customer.name}
                    customerCode={customer.code}
                    grandTotal={order.grand_total}
                    verifiedPaid={financial_summary?.verified_payments_total}
                    pendingPaid={financial_summary?.pending_payments_total}
                    outstandingBalance={financial_summary?.outstanding_balance ?? order.grand_total}
                    portal="admin"
                />

                {/* Payment Evidence Preview Modal */}
                <PaymentEvidencePreviewModal
                    isOpen={!!selectedEvidencePayment}
                    onClose={() => setSelectedEvidencePayment(null)}
                    payment={selectedEvidencePayment ? {
                        id: selectedEvidencePayment.id,
                        payment_number: selectedEvidencePayment.payment_number,
                        payment_method: selectedEvidencePayment.payment_method,
                        amount: selectedEvidencePayment.amount,
                        cheque_number: selectedEvidencePayment.cheque_number,
                        bank_name: selectedEvidencePayment.bank_name,
                        money_order_number: selectedEvidencePayment.money_order_number,
                        issuer_name: selectedEvidencePayment.issuer_name,
                        payment_date: selectedEvidencePayment.payment_date,
                        customer_name: customer.name,
                        evidence_original_name: selectedEvidencePayment.evidence_original_name,
                    } : null}
                />

                {/* 12-Column Responsive Command Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Main Operational Stream (8 Cols on Desktop) */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Operational Summaries Grid (Fulfillment, Payment, Delivery, Adjustments) */}
                        <OrderDetailOperationalCards
                            order={order}
                            customer={customer}
                            fulfillmentSummary={fulfillment_summary}
                            financialSummary={financial_summary}
                            canRecordPayment={can.record_payment}
                            onRecordPayment={() => setIsPaymentModalOpen(true)}
                        />

                        {/* Desktop High-Density Line Items Table */}
                        <div className="hidden md:block">
                            <OrderDetailItemsTable items={items} />
                        </div>

                        {/* Mobile Purpose-Built Cards */}
                        <div className="md:hidden">
                            <OrderDetailItemsCards items={items} />
                        </div>

                        {/* Recorded Payments & Financial Settlements */}
                        {payments && payments.length > 0 && (
                            <Card className="border shadow-sm">
                                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Banknote className="h-5 w-5 text-primary" />
                                        <div>
                                            <CardTitle className="text-base font-bold">Recorded Payment Collections</CardTitle>
                                            <CardDescription className="text-xs">
                                                All recorded balance payments and instrument details associated with this order
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-0 overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b bg-muted/40 font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th scope="col" className="py-3 px-4">Payment #</th>
                                                <th scope="col" className="py-3 px-3">Method</th>
                                                <th scope="col" className="py-3 px-3">Instrument Details</th>
                                                <th scope="col" className="py-3 px-3">Date</th>
                                                <th scope="col" className="py-3 px-3">Recorded By</th>
                                                <th scope="col" className="py-3 px-3 text-right">Amount</th>
                                                <th scope="col" className="py-3 px-3 text-center">Evidence</th>
                                                <th scope="col" className="py-3 px-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {payments.map((pmt) => (
                                                <tr key={pmt.id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                                                        {pmt.payment_number}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {pmt.payment_method_label}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-3 text-muted-foreground text-[11px]">
                                                        {pmt.payment_method === 'CHEQUE' && (
                                                            <div>
                                                                <span className="font-mono font-medium text-foreground">{pmt.cheque_number}</span>
                                                                <span className="block text-[10px]">{pmt.bank_name}</span>
                                                            </div>
                                                        )}
                                                        {pmt.payment_method === 'MONEY_ORDER' && (
                                                            <div>
                                                                <span className="font-mono font-medium text-foreground">{pmt.money_order_number}</span>
                                                                <span className="block text-[10px]">{pmt.issuer_name}</span>
                                                            </div>
                                                        )}
                                                        {pmt.payment_method === 'CASH' && (
                                                            <span>{pmt.receipt_reference || 'Cash on Order'}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 font-mono text-muted-foreground">
                                                        {pmt.payment_date}
                                                    </td>
                                                    <td className="py-3 px-3 text-muted-foreground">
                                                        {pmt.recorded_by || 'Staff'}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                                                        ${parseFloat(pmt.amount).toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        {pmt.has_evidence ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setSelectedEvidencePayment(pmt)}
                                                                className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary/90"
                                                            >
                                                                <FileImage className="h-3.5 w-3.5" />
                                                                <span>View</span>
                                                            </Button>
                                                        ) : (
                                                            <span className="text-muted-foreground text-[10px]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] ${
                                                                pmt.status === 'VERIFIED'
                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                                                    : pmt.status === 'PENDING_VERIFICATION'
                                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                                    : 'bg-destructive/10 text-destructive border-destructive/30'
                                                            }`}
                                                        >
                                                            {pmt.status_label}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        )}

                        {/* Order Notes (When entered during checkout) */}
                        {order.notes && (
                            <Card className="border shadow-sm">
                                <CardHeader className="pb-2.5 border-b bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-primary" />
                                        <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                            Order & Operational Notes
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-3 text-xs text-foreground whitespace-pre-line leading-relaxed font-mono bg-muted/10">
                                    {order.notes}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right Side Rail: Commercial Profile, Financials, Timeline (4 Cols on Desktop) */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Customer Commercial Profile */}
                        <OrderDetailCustomerCard
                            customer={customer}
                            salesman={salesman}
                        />

                        {/* Financial Summary & Tax Breakdown */}
                        <OrderDetailFinancialSummary
                            order={order}
                            taxBreakdown={tax_breakdown}
                            financialSummary={financial_summary}
                        />

                        {/* Verifiable Multi-State Order Timeline */}
                        <OrderTimeline timeline={timeline} />

                        {/* Audit & Integrity Context Card */}
                        <Card className="border shadow-sm text-xs bg-muted/20">
                            <CardHeader className="pb-2 border-b">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                        Audit & Integrity Context
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-3 space-y-2 text-[11px] text-muted-foreground font-mono">
                                <div className="flex justify-between">
                                    <span>Record Version:</span>
                                    <span className="font-semibold text-foreground">v{order.version}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Operating Currency:</span>
                                    <span className="font-semibold text-foreground">{order.currency}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Initialized:</span>
                                    <span className="font-semibold text-foreground">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {order.submitted_at && (
                                    <div className="flex justify-between">
                                        <span>Committed:</span>
                                        <span className="font-semibold text-foreground">
                                            {new Date(order.submitted_at).toLocaleDateString()}
                                        </span>
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
