import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'flex h-9 w-full rounded-xl border border-white/10 bg-dark-canvas/80 px-3 py-1.5 text-xs sm:text-sm text-white shadow-neu-inset ring-offset-dark-canvas file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-accent/40 focus-visible:border-action-accent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150',
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = 'Input';

export { Input };
