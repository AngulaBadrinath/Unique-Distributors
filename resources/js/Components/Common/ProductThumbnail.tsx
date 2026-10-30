import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProductThumbnailSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ProductThumbnailProps {
    src?: string | null;
    alt: string;
    size?: ProductThumbnailSize;
    className?: string;
    imageClassName?: string;
    fallbackIcon?: React.ReactNode;
}

const sizeClasses: Record<ProductThumbnailSize, { container: string; icon: string }> = {
    xs: { container: 'w-7 h-7 min-w-[1.75rem]', icon: 'h-3.5 w-3.5' },
    sm: { container: 'w-9 h-9 min-w-[2.25rem]', icon: 'h-4 w-4' },
    md: { container: 'w-12 h-12 min-w-[3rem]', icon: 'h-5 w-5' },
    lg: { container: 'w-14 h-14 min-w-[3.5rem]', icon: 'h-6 w-6' },
    xl: { container: 'w-16 h-16 min-w-[4rem]', icon: 'h-7 w-7' },
};

export const ProductThumbnail: React.FC<ProductThumbnailProps> = ({
    src,
    alt,
    size = 'md',
    className,
    imageClassName,
    fallbackIcon,
}) => {
    const [imageError, setImageError] = useState(false);
    const { container: containerSizeClass, icon: iconSizeClass } = sizeClasses[size];

    const hasValidImage = Boolean(src && !imageError);

    return (
        <div
            className={cn(
                'rounded-md border border-border/70 bg-muted/20 shrink-0 flex items-center justify-center overflow-hidden p-0.5 aspect-square',
                containerSizeClass,
                className
            )}
        >
            {hasValidImage ? (
                <img
                    src={src!}
                    alt={alt}
                    className={cn('object-contain w-full h-full drop-shadow-2xs', imageClassName)}
                    loading="lazy"
                    onError={() => setImageError(true)}
                />
            ) : (
                fallbackIcon || (
                    <Package className={cn('text-muted-foreground/40 stroke-[1.5]', iconSizeClass)} />
                )
            )}
        </div>
    );
};
