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
            case 'action':
            case 'indigo':
            case 'purple':
                return 'border-action-accent/30 bg-action-accent/10 text-action-accent font-semibold';
            case 'brand':
            case 'secondary':
                return 'border-[#063312]/20 bg-[#D7FFE0] text-[#063312] font-semibold';
            case 'primary':
            case 'default':
                return 'border-transparent bg-primary text-primary-foreground';
            default:
                return 'border-border bg-muted text-muted-foreground';
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
