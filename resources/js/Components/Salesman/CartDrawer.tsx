import React, { useMemo } from 'react';
import { CartLineItem } from '@/types/order';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { X, ShoppingBag, Trash2, ArrowRight, Package } from 'lucide-react';
import { QuantityStepper } from '@/Components/Salesman/QuantityStepper';

interface CartDrawerProps {
    open: boolean;
    onClose: () => void;
    cart: CartLineItem[];
    onUpdateQuantity: (productId: number, quantity: number) => void;
    onRemoveItem: (productId: number) => void;
    onProceedToReview: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
    open,
    onClose,
    cart,
    onUpdateQuantity,
    onRemoveItem,
    onProceedToReview,
}) => {
    if (!open) return null;

    const summary = useMemo(() => {
        let total = 0;
        let count = 0;

        for (const item of cart) {
            const price = parseFloat(item.unit_price) || 0;
            const taxable = price * item.quantity;
            const taxRate = item.product.tax_profile
                ? parseFloat(item.product.tax_profile.rate) || 0
                : 0;
            const tax = Math.round((taxable * (taxRate / 100)) * 100) / 100;
            total += taxable + tax;
            count += item.quantity;
        }

        return {
            total: total.toFixed(2),
            count,
        };
    }, [cart]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in-0">
            <div className="w-full max-w-md bg-background border-l shadow-2xl flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-base text-foreground">Current Cart ({summary.count})</h3>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground space-y-2">
                            <ShoppingBag className="mx-auto h-10 w-10 opacity-40" />
                            <p className="text-sm">Your cart is empty.</p>
                        </div>
                    ) : (
                        cart.map((item) => {
                            const lineSubtotal = (parseFloat(item.unit_price) || 0) * item.quantity;

                            return (
                                <div
                                    key={item.product.id}
                                    className="p-3 rounded-lg border bg-card flex gap-3 text-xs items-center"
                                >
                                    {/* Product Thumbnail */}
                                    <div className="w-12 h-12 rounded-md border border-border/70 bg-muted/20 shrink-0 flex items-center justify-center overflow-hidden p-1">
                                        {item.product.primary_image_url ? (
                                            <img
                                                src={item.product.primary_image_url}
                                                alt={item.product.name}
                                                className="object-contain w-full h-full drop-shadow-2xs"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <Package className="h-5 w-5 text-muted-foreground/40 stroke-[1.5]" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="font-semibold text-foreground line-clamp-1">
                                            {item.product.name}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                            <Badge variant="outline" className="text-[10px] py-0">
                                                {item.product.sku}
                                            </Badge>
                                            <span>${parseFloat(item.unit_price).toFixed(2)} / {item.product.unit}</span>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                             {/* Quantity Control */}
                                             <QuantityStepper
                                                 value={item.quantity}
                                                 min={1}
                                                 max={999999}
                                                 onChange={(qty) => onUpdateQuantity(item.product.id, qty)}
                                                 size="sm"
                                                 ariaLabel={`quantity for ${item.product.name}`}
                                             />

                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-sm text-foreground">
                                                    ${lineSubtotal.toFixed(2)}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onRemoveItem(item.product.id)}
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="p-4 border-t bg-muted/20 space-y-3">
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm text-muted-foreground">Estimated Total:</span>
                            <span className="text-xl font-bold font-mono text-primary">${summary.total}</span>
                        </div>
                        <Button
                            className="w-full gap-2 font-semibold"
                            onClick={() => {
                                onClose();
                                onProceedToReview();
                            }}
                        >
                            <span>Proceed to Review</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
