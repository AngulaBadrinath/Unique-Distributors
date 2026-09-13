import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
    'rounded-xl border transition-all text-card-foreground',
    {
        variants: {
            variant: {
                // Base Card: Neutral white surface with crisp border
                default: 'border-border bg-card shadow-2xs',
                // Interactive Card: Neutral with hover elevation
                interactive: 'border-border bg-card shadow-2xs hover:border-border/80 hover:shadow-xs cursor-pointer',
                // Brand Card: Ghost Green surface with dark brand foreground
                brand: 'border-brand-surface-foreground/20 bg-brand-surface text-brand-surface-foreground shadow-2xs',
                // Executive Card: Zero Black brand anchor with crisp white text
                executive: 'border-neutral-900 bg-brand text-brand-foreground shadow-md',
                // Action Card: Selective Quantum Blue tint
                action: 'border-action-accent/30 bg-action-accent/5 text-card-foreground shadow-2xs',
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
            'text-lg sm:text-xl font-semibold leading-tight tracking-tight',
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
        className={cn('flex items-center p-4 sm:p-6 pt-0 sm:pt-0 border-t border-border/50 mt-4', className)}
        {...props}
    />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
