import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
    'rounded-2xl transition-all duration-200 text-card-foreground',
    {
        variants: {
            variant: {
                default: 'bg-dark-surface border border-white/8 shadow-neu-dark',
                elevated: 'bg-dark-surface-elevated border border-white/10 shadow-neu-dark-hover',
                interactive: 'bg-dark-surface border border-white/8 shadow-neu-dark hover:shadow-neu-dark-hover hover:border-action-accent/30 cursor-pointer',
                glass: 'glass-dark border border-white/10 shadow-neu-dark',
                inset: 'bg-dark-canvas border border-white/5 shadow-neu-inset',
                brand: 'bg-brand-surface border border-brand-surface-border text-brand-surface-foreground shadow-neu-dark',
                executive: 'bg-gradient-to-br from-dark-surface-elevated to-dark-surface border border-action-accent/25 shadow-neu-dark glow-cyan-subtle',
                metric: 'bg-dark-surface border border-white/8 shadow-neu-dark hover:border-action-accent/40 transition-colors',
                light: 'bg-white border border-slate-200 text-slate-900 shadow-sm',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(cardVariants({ variant }), className)}
            {...props}
        />
    )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-4 sm:p-6', className)}
        {...props}
    />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            'text-lg sm:text-xl font-semibold leading-none tracking-tight text-white font-sans',
            className
        )}
        {...props}
    />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-xs sm:text-sm text-muted-foreground', className)}
        {...props}
    />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 sm:p-6 pt-0 sm:pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex items-center p-4 sm:p-6 pt-0 sm:pt-0', className)}
        {...props}
    />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
