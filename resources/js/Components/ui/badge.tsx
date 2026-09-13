import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none',
    {
        variants: {
            variant: {
                default:
                    'border-white/10 bg-dark-surface-elevated text-white shadow-neu-dark',
                secondary:
                    'border-white/8 bg-white/5 text-muted-foreground',
                brand:
                    'border-cyan-500/30 bg-cyan-500/15 text-cyan-300 font-semibold',
                action:
                    'border-transparent bg-action-accent text-white font-medium glow-cyan-subtle',
                outline:
                    'border-white/20 text-white bg-transparent',
                neutral:
                    'border-white/8 bg-white/5 text-muted-foreground',
                success:
                    'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 font-medium',
                warning:
                    'border-amber-500/30 bg-amber-500/15 text-amber-300 font-medium',
                destructive:
                    'border-rose-500/30 bg-rose-500/15 text-rose-300 font-medium',
                info:
                    'border-blue-500/30 bg-blue-500/15 text-blue-300 font-medium',
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
