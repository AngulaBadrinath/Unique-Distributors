import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileMetadataItem {
    label: string;
    value: React.ReactNode;
    hiddenOnMobile?: boolean;
}

export interface MobileListCardProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    badge?: React.ReactNode;
    amount?: React.ReactNode;
    metadata?: MobileMetadataItem[];
    expandableContent?: React.ReactNode;
    actions?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    isSelected?: boolean;
    onSelect?: (selected: boolean) => void;
}

export function MobileListCard({
    title,
    subtitle,
    badge,
    amount,
    metadata = [],
    expandableContent,
    actions,
    onClick,
    className,
    isSelected,
    onSelect,
}: MobileListCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const visibleMetadata = metadata.filter((m) => !m.hiddenOnMobile);

    return (
        <div
            className={cn(
                'rounded-xl border border-border bg-card p-4 transition-all duration-200 shadow-xs relative overflow-hidden',
                onClick ? 'cursor-pointer active:scale-[0.99] hover:border-border/80' : '',
                isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : '',
                className
            )}
            onClick={onClick}
        >
            {/* Top Row: Title & Badge */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {onSelect && (
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onSelect(e.target.checked);
                                }}
                                className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20 cursor-pointer"
                                aria-label="Select row"
                            />
                        )}
                        <div className="font-semibold text-sm text-foreground truncate tracking-tight">
                            {title}
                        </div>
                    </div>
                    {subtitle && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {subtitle}
                        </div>
                    )}
                </div>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>

            {/* Middle Row: Metadata & Amount */}
            {(visibleMetadata.length > 0 || amount) && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-border/50 pt-2.5">
                    {visibleMetadata.map((item, idx) => (
                        <div key={idx} className="min-w-0">
                            <span className="text-[11px] text-muted-foreground block truncate">
                                {item.label}
                            </span>
                            <span className="font-medium text-foreground block truncate">
                                {item.value}
                            </span>
                        </div>
                    ))}
                    {amount && (
                        <div className="col-span-2 flex items-center justify-between pt-1 border-t border-dashed border-border/50">
                            <span className="text-[11px] font-medium text-muted-foreground">Total / Amount</span>
                            <span className="text-sm font-bold text-foreground font-mono">{amount}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Expandable Section */}
            {expandableContent && isExpanded && (
                <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground animate-in fade-in-50 duration-150">
                    {expandableContent}
                </div>
            )}

            {/* Bottom Actions Row & Expand Toggle */}
            <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
                <div>
                    {expandableContent && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors py-1 cursor-pointer"
                            aria-expanded={isExpanded}
                        >
                            <span>{isExpanded ? 'Less details' : 'More details'}</span>
                            {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                            )}
                        </button>
                    )}
                </div>
                {actions && (
                    <div
                        className="flex flex-wrap items-center justify-end gap-1.5 flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
