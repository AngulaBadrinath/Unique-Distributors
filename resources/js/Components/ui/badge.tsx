import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                // Zero Black Brand Anchor Badge
                default:
                    'border-transparent bg-primary text-primary-foreground shadow-2xs',
                // Ghost Green Brand / Info Surface
                brand:
                    'border-brand-surface-foreground/20 bg-brand-surface text-brand-surface-foreground font-medium',
                secondary:
                    'border-brand-surface-foreground/20 bg-brand-surface text-brand-surface-foreground font-medium',
                info:
                    'border-brand-surface-foreground/20 bg-brand-surface text-brand-surface-foreground font-medium',
                // Selective Quantum Blue Action Badge
                action:
                    'border-transparent bg-action-accent text-action-accent-foreground shadow-2xs font-medium',
                // Semantic Invariants
                success:
                    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                warning:
                    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
                destructive:
                    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
                // Neutral Gray
                neutral:
                    'border-border bg-muted text-muted-foreground font-medium',
                outline:
                    'border-border bg-transparent text-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
