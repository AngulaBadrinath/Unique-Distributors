import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dark-canvas disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98] cursor-pointer',
    {
        variants: {
            variant: {
                default: 'bg-dark-surface-elevated text-white border border-white/10 shadow-neu-dark hover:bg-white/10 hover:border-white/20 hover:shadow-neu-dark-hover',
                secondary: 'bg-dark-surface text-muted-foreground border border-white/8 hover:text-white hover:bg-white/5',
                action: 'bg-action-accent text-white shadow-neu-dark hover:bg-action-accent/90 glow-cyan-subtle hover:glow-cyan font-semibold',
                brand: 'bg-brand-surface text-brand-surface-foreground border border-brand-surface-border hover:bg-brand-surface/80',
                outline: 'border border-white/15 bg-transparent text-white hover:bg-white/8 hover:border-white/25',
                ghost: 'hover:bg-white/8 text-muted-foreground hover:text-white',
                destructive: 'bg-destructive/20 border border-destructive/40 text-rose-300 hover:bg-destructive/30',
                link: 'text-action-accent underline-offset-4 hover:underline p-0 h-auto font-medium',
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 rounded-lg px-3 text-xs',
                lg: 'h-11 rounded-xl px-6 text-sm',
                icon: 'h-9 w-9 p-0 rounded-xl',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
