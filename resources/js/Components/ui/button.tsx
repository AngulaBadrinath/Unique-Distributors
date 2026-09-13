import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
    {
        variants: {
            variant: {
                // LEVEL 1: Zero Black + White text
                default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs active:scale-[0.98]',
                // LEVEL 2: Ghost Green + dark brand foreground text
                secondary: 'bg-brand-surface text-brand-surface-foreground hover:bg-brand-surface/85 border border-brand-surface-foreground/20 shadow-2xs active:scale-[0.98]',
                // LEVEL 3: Selective Quantum Blue + White text
                action: 'bg-action-accent text-action-accent-foreground hover:bg-action-accent/90 shadow-xs active:scale-[0.98]',
                // Semantic Destructive
                destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs active:scale-[0.98]',
                // Neutral Outline
                outline: 'border border-input bg-card hover:bg-muted text-foreground active:scale-[0.98]',
                // Neutral Ghost
                ghost: 'hover:bg-muted hover:text-foreground text-muted-foreground',
                // Link
                link: 'text-action-accent underline-offset-4 hover:underline p-0 h-auto font-normal',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-8.5 rounded-md px-3 text-xs',
                lg: 'h-11 rounded-lg px-8 text-base',
                icon: 'h-9 w-9 rounded-lg',
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
