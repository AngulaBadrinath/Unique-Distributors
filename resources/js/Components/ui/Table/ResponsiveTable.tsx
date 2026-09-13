import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileListCard, MobileMetadataItem } from './MobileListCard';
import { TablePagination, TablePaginationProps } from './TablePagination';
import { TableSkeleton } from './TableSkeleton';
import { TableEmptyState, TableEmptyStateProps } from './TableEmptyState';

export interface ColumnDef<T> {
    header: React.ReactNode;
    accessorKey?: keyof T | string;
    cell?: (item: T, index: number) => React.ReactNode;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
    sortField?: string;
    className?: string;
    hiddenOnMobile?: boolean;
    hiddenOnTablet?: boolean;
    /** Marks this column as the primary title in automated mobile cards */
    isPrimary?: boolean;
    /** Marks this column as the status badge in automated mobile cards */
    isBadge?: boolean;
    /** Marks this column as the amount / total in automated mobile cards */
    isAmount?: boolean;
    /** Marks this column as secondary detail (collapsed by default on mobile) */
    isSecondary?: boolean;
}

export interface ResponsiveTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    keyExtractor: (item: T) => string | number;
    isLoading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyIcon?: React.ComponentType<{ className?: string }>;
    emptyAction?: React.ReactNode;
    renderMobileCard?: (item: T, isSelected?: boolean, onSelect?: (selected: boolean) => void) => React.ReactNode;
    renderRowActions?: (item: T) => React.ReactNode;
    onSort?: (field: string, direction: 'asc' | 'desc') => void;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    selectable?: boolean;
    selectedKeys?: (string | number)[];
    onSelectionChange?: (keys: (string | number)[]) => void;
    onRowClick?: (item: T) => void;
    stickyHeader?: boolean;
    pagination?: TablePaginationProps;
    className?: string;
    containerClassName?: string;
}

export function ResponsiveTable<T>({
    data,
    columns,
    keyExtractor,
    isLoading = false,
    error = null,
    onRetry,
    emptyTitle,
    emptyDescription,
    emptyIcon,
    emptyAction,
    renderMobileCard,
    renderRowActions,
    onSort,
    sortField,
    sortDirection,
    selectable = false,
    selectedKeys = [],
    onSelectionChange,
    onRowClick,
    stickyHeader = false,
    pagination,
    className,
    containerClassName,
}: ResponsiveTableProps<T>) {
    // Selection helpers
    const allSelected = data.length > 0 && data.every((item) => selectedKeys.includes(keyExtractor(item)));
    const someSelected = selectedKeys.length > 0 && !allSelected;

    const handleSelectAll = (checked: boolean) => {
        if (!onSelectionChange) return;
        if (checked) {
            const allKeys = data.map(keyExtractor);
            onSelectionChange(Array.from(new Set([...selectedKeys, ...allKeys])));
        } else {
            const currentKeys = data.map(keyExtractor);
            onSelectionChange(selectedKeys.filter((k) => !currentKeys.includes(k)));
        }
    };

    const handleSelectRow = (key: string | number, checked: boolean) => {
        if (!onSelectionChange) return;
        if (checked) {
            onSelectionChange([...selectedKeys, key]);
        } else {
            onSelectionChange(selectedKeys.filter((k) => k !== key));
        }
    };

    // Sorting helper
    const handleHeaderClick = (col: ColumnDef<T>) => {
        if (!col.sortable || !onSort) return;
        const field = col.sortField || (typeof col.accessorKey === 'string' ? col.accessorKey : '');
        if (!field) return;

        let nextDirection: 'asc' | 'desc' = 'asc';
        if (sortField === field) {
            nextDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        }
        onSort(field, nextDirection);
    };

    // Helper to evaluate cell value
    const getCellValue = (item: T, col: ColumnDef<T>, index: number): React.ReactNode => {
        if (col.cell) {
            return col.cell(item, index);
        }
        if (col.accessorKey) {
            const val = (item as any)[col.accessorKey];
            if (val === null || val === undefined) return '—';
            return String(val);
        }
        return null;
    };

    // Render loading state
    if (isLoading) {
        return (
            <div className={containerClassName}>
                <TableSkeleton
                    columns={columns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0)}
                    rows={6}
                    showCheckbox={selectable}
                />
            </div>
        );
    }

    // Render error state
    if (error) {
        return (
            <div className={containerClassName}>
                <TableEmptyState
                    error={error}
                    onRetry={onRetry}
                />
            </div>
        );
    }

    // Render empty state
    if (!data || data.length === 0) {
        return (
            <div className={containerClassName}>
                <TableEmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    icon={emptyIcon}
                    action={emptyAction}
                />
            </div>
        );
    }

    // Default Mobile Card Generator
    const renderDefaultMobileCard = (item: T, index: number) => {
        const key = keyExtractor(item);
        const isSelected = selectedKeys.includes(key);

        const primaryCol = columns.find((c) => c.isPrimary) || columns[0];
        const badgeCol = columns.find((c) => c.isBadge);
        const amountCol = columns.find((c) => c.isAmount);
        
        const metadataCols = columns.filter(
            (c) => c !== primaryCol && c !== badgeCol && c !== amountCol && !c.isSecondary
        );
        const secondaryCols = columns.filter((c) => c.isSecondary);

        const metadata: MobileMetadataItem[] = metadataCols.map((col) => ({
            label: typeof col.header === 'string' ? col.header : '',
            value: getCellValue(item, col, index),
            hiddenOnMobile: col.hiddenOnMobile,
        }));

        const expandableContent = secondaryCols.length > 0 ? (
            <div className="space-y-1.5">
                {secondaryCols.map((col, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{col.header}:</span>
                        <span className="font-medium text-foreground">{getCellValue(item, col, index)}</span>
                    </div>
                ))}
            </div>
        ) : undefined;

        const actions = renderRowActions ? renderRowActions(item) : undefined;

        return (
            <MobileListCard
                key={key}
                title={getCellValue(item, primaryCol, index)}
                badge={badgeCol ? getCellValue(item, badgeCol, index) : undefined}
                amount={amountCol ? getCellValue(item, amountCol, index) : undefined}
                metadata={metadata}
                expandableContent={expandableContent}
                actions={actions}
                isSelected={isSelected}
                onSelect={selectable ? (sel) => handleSelectRow(key, sel) : undefined}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
            />
        );
    };

    return (
        <div className={cn('space-y-3', containerClassName)}>
            {/* Desktop and Tablet Data Table (>= 768px) */}
            <div className="hidden md:block rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className={cn('w-full text-sm text-left border-collapse', className)}>
                        {/* Table Header */}
                        <thead
                            className={cn(
                                'text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 border-b border-border',
                                stickyHeader ? 'sticky top-0 z-10 backdrop-blur-md bg-muted/90' : ''
                            )}
                        >
                            <tr>
                                {selectable && (
                                    <th scope="col" className="px-4 py-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = someSelected;
                                            }}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20 cursor-pointer"
                                            aria-label="Select all rows"
                                        />
                                    </th>
                                )}

                                {columns.map((col, idx) => {
                                    const field = col.sortField || (typeof col.accessorKey === 'string' ? col.accessorKey : '');
                                    const isSorted = field && sortField === field;

                                    return (
                                        <th
                                            key={idx}
                                            scope="col"
                                            onClick={() => handleHeaderClick(col)}
                                            className={cn(
                                                'px-4 py-3 text-xs select-none',
                                                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                                                col.hiddenOnTablet ? 'hidden lg:table-cell' : '',
                                                col.sortable ? 'cursor-pointer hover:text-foreground hover:bg-muted/70 transition-colors' : '',
                                                col.className
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    'inline-flex items-center gap-1.5',
                                                    col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                                                )}
                                            >
                                                <span>{col.header}</span>
                                                {col.sortable && (
                                                    <span className="text-muted-foreground/60">
                                                        {isSorted ? (
                                                            sortDirection === 'asc' ? (
                                                                <ArrowUp className="w-3.5 h-3.5 text-primary" />
                                                            ) : (
                                                                <ArrowDown className="w-3.5 h-3.5 text-primary" />
                                                            )
                                                        ) : (
                                                            <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}

                                {renderRowActions && (
                                    <th scope="col" className="px-4 py-3 text-right w-24">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody className="divide-y divide-border bg-card">
                            {data.map((item, rowIdx) => {
                                const key = keyExtractor(item);
                                const isSelected = selectedKeys.includes(key);

                                return (
                                    <tr
                                        key={key}
                                        onClick={onRowClick ? () => onRowClick(item) : undefined}
                                        className={cn(
                                            'transition-colors hover:bg-muted/40',
                                            isSelected ? 'bg-primary/5 dark:bg-primary/10' : '',
                                            onRowClick ? 'cursor-pointer' : ''
                                        )}
                                    >
                                        {selectable && (
                                            <td
                                                className="px-4 py-3 text-center"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectRow(key, e.target.checked)}
                                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20 cursor-pointer"
                                                    aria-label={`Select row ${key}`}
                                                />
                                            </td>
                                        )}

                                        {columns.map((col, colIdx) => (
                                            <td
                                                key={colIdx}
                                                className={cn(
                                                    'px-4 py-3 text-xs leading-relaxed text-foreground',
                                                    col.align === 'right'
                                                        ? 'text-right font-mono'
                                                        : col.align === 'center'
                                                        ? 'text-center'
                                                        : 'text-left',
                                                    col.hiddenOnTablet ? 'hidden lg:table-cell' : '',
                                                    col.className
                                                )}
                                            >
                                                {getCellValue(item, col, rowIdx)}
                                            </td>
                                        ))}

                                        {renderRowActions && (
                                            <td
                                                className="px-4 py-3 text-right"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {renderRowActions(item)}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden space-y-3">
                {data.map((item, index) => {
                    if (renderMobileCard) {
                        const key = keyExtractor(item);
                        const isSelected = selectedKeys.includes(key);
                        return (
                            <React.Fragment key={key}>
                                {renderMobileCard(
                                    item,
                                    isSelected,
                                    selectable ? (sel) => handleSelectRow(key, sel) : undefined
                                )}
                            </React.Fragment>
                        );
                    }
                    return renderDefaultMobileCard(item, index);
                })}
            </div>

            {/* Integrated Pagination */}
            {pagination && <TablePagination {...pagination} />}
        </div>
    );
}
