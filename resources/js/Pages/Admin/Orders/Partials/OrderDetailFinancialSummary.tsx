import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { AdminOrderDetailData } from '@/types/order';
import { DollarSign, Receipt, ShieldCheck, Clock } from 'lucide-react';

interface OrderDetailFinancialSummaryProps {
    order: AdminOrderDetailData['order'];
    taxBreakdown: AdminOrderDetailData['tax_breakdown'];
    financialSummary?: AdminOrderDetailData['financial_summary'];
}

export default function OrderDetailFinancialSummary({
    order,
    taxBreakdown,
    financialSummary,
}: OrderDetailFinancialSummaryProps) {
    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-bold">Financial Summary & Tax</CardTitle>
                </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4 text-xs">
                {/* Financial Overview Stack */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-muted-foreground">
                        <span>Items Subtotal</span>
                        <span className="font-mono font-medium text-foreground">${order.subtotal}</span>
                    </div>

                    <div className="flex justify-between items-center text-muted-foreground">
                        <span>Tax Total</span>
                        <span className="font-mono font-medium text-foreground">${order.tax_total}</span>
                    </div>

                    {order.adjustment_total && parseFloat(order.adjustment_total) !== 0 && (
                        <div className="flex justify-between items-center text-muted-foreground">
                            <span>Adjustments Applied</span>
                            <span className="font-mono font-medium text-amber-700 dark:text-amber-400">
                                ${order.adjustment_total}
                            </span>
                        </div>
                    )}

                    <div className="pt-2 border-t border-border flex justify-between items-baseline">
                        <span className="font-bold text-sm text-foreground">Grand Total ({order.currency})</span>
                        <span className="font-mono font-extrabold text-lg text-foreground">
                            ${order.grand_total}
                        </span>
                    </div>

                    {financialSummary && (
                        <div className="pt-2 border-t border-dashed space-y-1.5 text-[11px]">
                            <div className="flex justify-between items-center text-muted-foreground">
                                <span>Verified Paid</span>
                                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    ${financialSummary.verified_payments_total}
                                </span>
                            </div>

                            {parseFloat(financialSummary.pending_payments_total) > 0 && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <span>Pending Verification</span>
                                        <Clock className="h-3 w-3 text-amber-500" />
                                    </span>
                                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                        ${financialSummary.pending_payments_total}
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between items-baseline text-foreground pt-1 border-t">
                                <span className="font-bold">Outstanding Balance:</span>
                                <span className="font-mono font-bold text-sm">
                                    ${financialSummary.outstanding_balance}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Multi-Line Tax Breakdown */}
                {taxBreakdown.length > 0 && (
                    <div className="pt-3 border-t border-border/60 space-y-2">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Line Tax Snapshot Breakdown
                        </div>

                        <div className="bg-muted/30 rounded border border-border/40 overflow-hidden">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-muted/60 border-b text-muted-foreground text-[10px] uppercase font-semibold">
                                    <tr>
                                        <th scope="col" className="py-1.5 px-2">Tax Profile</th>
                                        <th scope="col" className="py-1.5 px-2 text-right">Rate</th>
                                        <th scope="col" className="py-1.5 px-2 text-right">Taxable</th>
                                        <th scope="col" className="py-1.5 px-2 text-right">Tax Amt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 font-mono">
                                    {taxBreakdown.map((item) => (
                                        <tr key={item.code} className="hover:bg-muted/20">
                                            <td className="py-1.5 px-2 font-sans font-medium text-foreground">
                                                {item.name} ({item.code})
                                            </td>
                                            <td className="py-1.5 px-2 text-right text-muted-foreground">
                                                {item.formatted_rate}
                                            </td>
                                            <td className="py-1.5 px-2 text-right text-muted-foreground">
                                                ${item.taxable_amount}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-bold text-foreground">
                                                ${item.tax_amount}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Immutability Guarantee Note */}
                <div className="pt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Historical order financial and tax totals are immutable.</span>
                </div>
            </CardContent>
        </Card>
    );
}
