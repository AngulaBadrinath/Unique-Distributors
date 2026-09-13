import React from 'react';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/lib/utils';
import {
    FileCheck,
    Clock,
    CheckCircle2,
    XCircle,
    Package,
    Boxes,
    Truck,
    DollarSign,
    CreditCard,
    Navigation,
    SlidersHorizontal,
    AlertCircle,
} from 'lucide-react';

export type StatusDimension = 'order' | 'fulfillment' | 'payment' | 'delivery' | 'adjustment';

interface OrderStatusBadgeProps {
    dimension: StatusDimension;
    label: string;
    variant?: string | null;
    showDimensionLabel?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

export default function OrderStatusBadge({
    dimension,
    label,
    variant = 'secondary',
    showDimensionLabel = false,
    size = 'sm',
    className,
}: OrderStatusBadgeProps) {
    if (!label) return null;

    // Dimension Prefix Label
    const dimensionPrefixes: Record<StatusDimension, string> = {
        order: 'Order',
        fulfillment: 'Fulfillment',
        payment: 'Payment',
        delivery: 'Delivery',
        adjustment: 'Adjustment',
    };

    // Semantic Icon Selection
    const getIcon = () => {
        const upperLabel = label.toUpperCase();

        if (upperLabel.includes('CANCEL') || upperLabel.includes('REJECT') || upperLabel.includes('FAIL')) {
            return <XCircle className="h-3 w-3 shrink-0" />;
        }
        if (upperLabel.includes('COMPLETE') || upperLabel.includes('DELIVERED') || upperLabel.includes('PAID') && !upperLabel.includes('PARTIAL') && !upperLabel.includes('UNPAID')) {
            return <CheckCircle2 className="h-3 w-3 shrink-0" />;
        }
        if (upperLabel.includes('SUBMIT') || upperLabel.includes('DRAFT')) {
            return <FileCheck className="h-3 w-3 shrink-0" />;
        }
        if (upperLabel.includes('PENDING') || upperLabel.includes('REVIEW')) {
            return <Clock className="h-3 w-3 shrink-0" />;
        }
        if (dimension === 'fulfillment') {
            return <Package className="h-3 w-3 shrink-0" />;
        }
        if (dimension === 'payment') {
            return <DollarSign className="h-3 w-3 shrink-0" />;
        }
        if (dimension === 'delivery') {
            return <Truck className="h-3 w-3 shrink-0" />;
        }
        if (dimension === 'adjustment') {
            return <SlidersHorizontal className="h-3 w-3 shrink-0" />;
        }

        return <AlertCircle className="h-3 w-3 shrink-0" />;
    };

    // Variant Style Mapper
    const getVariantClasses = () => {
        switch (variant) {
            case 'success':
                return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
            case 'destructive':
                return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
            case 'warning':
                return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
            case 'info':
            case 'primary':
                return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300';
            case 'indigo':
                return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
            case 'purple':
                return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
            default:
                return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300';
        }
    };

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors font-mono',
                size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
                getVariantClasses(),
                className
            )}
            title={`${dimensionPrefixes[dimension]}: ${label}`}
        >
            {getIcon()}
            {showDimensionLabel && (
                <span className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {dimensionPrefixes[dimension]}:
                </span>
            )}
            <span>{label}</span>
        </span>
    );
}
