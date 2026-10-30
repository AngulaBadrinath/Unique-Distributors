import React, { useState, useEffect } from 'react';
import { CatalogProduct, CartLineItem } from '@/types/order';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Package, Plus, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import { QuantityStepper } from '@/Components/Salesman/QuantityStepper';
import { PriceOverrideModal } from '@/Components/Salesman/PriceOverrideModal';

interface ProductOrderCardProps {
    product: CatalogProduct;
    cartItem?: CartLineItem;
    onUpdateCart: (product: CatalogProduct, quantity: number, unitPrice: string) => void;
    onRemoveFromCart: (productId: number) => void;
}

export const ProductOrderCard: React.FC<ProductOrderCardProps> = ({
    product,
    cartItem,
    onUpdateCart,
    onRemoveFromCart,
}) => {
    const [quantity, setQuantity] = useState<number>(cartItem?.quantity || 1);
    const [unitPrice, setUnitPrice] = useState<string>(
        cartItem?.unit_price || product.default_selling_price.toFixed(2)
    );
    const [priceError, setPriceError] = useState<string | null>(null);
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

    useEffect(() => {
        if (cartItem) {
            setQuantity(cartItem.quantity);
            setUnitPrice(cartItem.unit_price);
        }
    }, [cartItem]);

    const handleQuantityChange = (newQty: number) => {
        setQuantity(newQty);
        if (cartItem) {
            onUpdateCart(product, newQty, unitPrice);
        }
    };

    const handlePriceBlur = () => {
        const numPrice = parseFloat(unitPrice);
        if (isNaN(numPrice)) {
            setUnitPrice(product.default_selling_price.toFixed(2));
            setPriceError(null);
            if (cartItem) {
                onUpdateCart(product, quantity, product.default_selling_price.toFixed(2));
            }
            return;
        }

        if (numPrice < product.minimum_allowed_price) {
            setPriceError(`Price is below min ($${product.minimum_allowed_price.toFixed(2)}). Override required.`);
            return;
        }

        if (numPrice > product.mrp) {
            setPriceError(`Price exceeds MRP ($${product.mrp.toFixed(2)}). Override required.`);
            return;
        }

        setPriceError(null);
        const formatted = numPrice.toFixed(2);
        setUnitPrice(formatted);
        if (cartItem) {
            onUpdateCart(product, quantity, formatted);
        }
    };

    const handleAddToCart = () => {
        const numPrice = parseFloat(unitPrice);
        const validPrice = isNaN(numPrice) ? product.default_selling_price : numPrice;

        if (validPrice < product.minimum_allowed_price || validPrice > product.mrp) {
            setIsOverrideModalOpen(true);
            return;
        }

        const formattedPrice = validPrice.toFixed(2);
        setUnitPrice(formattedPrice);
        onUpdateCart(product, quantity, formattedPrice);
    };

    const handleOverrideConfirm = (_prod: CatalogProduct, price: string, _reason: string) => {
        setUnitPrice(price);
        setPriceError(null);
        onUpdateCart(product, quantity, price);
    };

    const isInCart = !!cartItem;

    return (
        <>
            <Card
                className={`overflow-hidden transition-all duration-200 rounded-xl border ${
                    isInCart
                        ? 'border-primary/80 ring-1 ring-primary/20 bg-primary/[0.02]'
                        : 'border-border/80 hover:border-border hover:shadow-xs'
                }`}
            >
                <div className="flex flex-col h-full">
                    {/* MOBILE COMPACT VIEW (<640px) - Inspired by Reference A */}
                    <div className="sm:hidden p-3 space-y-2.5">
                        <div className="flex gap-3 items-center">
                            {/* Product Thumbnail (Square, Uncropped) */}
                            <div className="relative w-14 h-14 rounded-lg border border-border/80 bg-muted/20 flex items-center justify-center overflow-hidden shrink-0 p-1">
                                {product.primary_image_url ? (
                                    <img
                                        src={product.primary_image_url}
                                        alt={product.name}
                                        className="object-contain w-full h-full drop-shadow-2xs"
                                        loading="lazy"
                                    />
                                ) : (
                                    <Package className="h-6 w-6 text-muted-foreground/40 stroke-[1.5]" />
                                )}
                                {isInCart && (
                                    <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" />
                                )}
                            </div>

                            {/* Product Info & Barcode */}
                            <div className="flex-1 min-w-0 space-y-0.5">
                                <h3 className="font-semibold text-xs line-clamp-1 text-foreground" title={product.name}>
                                    {product.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                                    <span>{product.sku}</span>
                                    <span>•</span>
                                    <span className="text-foreground/80 font-medium">UPC: {product.barcode || product.sku}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5 font-mono">
                                    <span className="text-xs font-bold text-foreground">
                                        ${parseFloat(unitPrice || '0').toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground line-through">
                                        ${product.mrp.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Quantity Stepper & Cart Action */}
                        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                            <QuantityStepper
                                value={quantity}
                                min={1}
                                max={999999}
                                onChange={handleQuantityChange}
                                size="sm"
                                ariaLabel={`quantity for ${product.name}`}
                                className="h-7 w-28 shrink-0"
                            />
                            {isInCart ? (
                                <div className="flex gap-1 flex-1 min-w-0">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="flex-1 text-[11px] h-7 px-2"
                                        onClick={handleAddToCart}
                                    >
                                        Update ({cartItem?.quantity})
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0 shrink-0"
                                        onClick={() => onRemoveFromCart(product.id)}
                                        aria-label={`Remove ${product.name} from cart`}
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="flex-1 text-[11px] h-7 gap-1"
                                    onClick={handleAddToCart}
                                >
                                    <Plus className="h-3 w-3" />
                                    <span>Add</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* TABLET & DESKTOP GRID VIEW (>=640px) - Fixed Aspect Ratio & Containment */}
                    <div className="hidden sm:flex flex-col h-full">
                        {/* Product Image & Badges */}
                        <div className="relative aspect-square bg-muted/20 flex items-center justify-center overflow-hidden border-b border-border/70 p-3">
                            {product.primary_image_url ? (
                                <img
                                    src={product.primary_image_url}
                                    alt={product.name}
                                    className="object-contain max-h-full max-w-full drop-shadow-xs transition-transform duration-200 hover:scale-105"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground/50">
                                    <Package className="h-10 w-10 stroke-[1.5]" />
                                    <span className="text-[10px] mt-1 font-mono uppercase tracking-wider">No Image</span>
                                </div>
                            )}
                            <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[80%]">
                                <Badge variant="secondary" className="font-mono text-[10px] bg-background/90 backdrop-blur-xs shadow-2xs">
                                    {product.sku}
                                </Badge>
                                {product.category && (
                                    <Badge variant="outline" className="text-[10px] bg-background/80 backdrop-blur-xs shadow-2xs">
                                        {product.category.name}
                                    </Badge>
                                )}
                            </div>
                            {isInCart && (
                                <div className="absolute top-2 right-2">
                                    <Badge className="bg-primary text-primary-foreground text-[10px] gap-1 shadow-2xs">
                                        <Check className="h-3 w-3" /> In Cart ({cartItem.quantity})
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {/* Product Details */}
                        <CardContent className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                                <h3 className="font-semibold text-xs line-clamp-2 text-foreground tracking-tight" title={product.name}>
                                    {product.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground mt-1 font-mono">
                                    <span>Unit: <span className="font-sans font-medium text-foreground">{product.unit}</span></span>
                                    <span>•</span>
                                    <span className="text-foreground/80 font-medium">UPC: {product.barcode || product.sku}</span>
                                </div>
                            </div>

                        {/* Pricing Display & Boundary Indicator */}
                        <div className="space-y-1.5 pt-2 border-t border-border/60">
                            <div className="flex items-baseline justify-between">
                                <span className="text-xs text-muted-foreground">Price:</span>
                                <div className="text-right font-mono">
                                    <span className="text-sm font-bold text-foreground">
                                        ${parseFloat(unitPrice || '0').toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground ml-1.5 line-through">
                                        ${product.mrp.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Allowed Price Bound Info */}
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                                <span>Min: ${product.minimum_allowed_price.toFixed(2)}</span>
                                <span>List: ${product.mrp.toFixed(2)}</span>
                                {product.tax_profile && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        Tax: {product.tax_profile.formatted_rate}
                                    </span>
                                )}
                            </div>

                            {priceError && (
                                <div className="flex items-center justify-between gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <AlertCircle className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{priceError}</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-500/20"
                                        onClick={() => setIsOverrideModalOpen(true)}
                                    >
                                        Override
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Quantity & Action Controls */}
                        <div className="pt-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                {/* Quantity Stepper */}
                                <div>
                                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                                        Quantity
                                    </label>
                                    <QuantityStepper
                                        value={quantity}
                                        min={1}
                                        max={999999}
                                        onChange={handleQuantityChange}
                                        ariaLabel={`quantity for ${product.name}`}
                                        className="w-full justify-between h-8"
                                    />
                                </div>

                                {/* Unit Price Customizer */}
                                <div>
                                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                                        Selling Price ($)
                                    </label>
                                    <Input
                                        type="text"
                                        value={unitPrice}
                                        onChange={(e) => setUnitPrice(e.target.value)}
                                        onBlur={handlePriceBlur}
                                        placeholder={product.default_selling_price.toFixed(2)}
                                        className="h-8 text-right font-mono text-xs"
                                    />
                                </div>
                            </div>

                            {/* Add / Update / Remove Button */}
                            {isInCart ? (
                                <div className="flex gap-1.5">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full text-xs h-8"
                                        onClick={handleAddToCart}
                                    >
                                        Update Cart
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-8 text-destructive hover:bg-destructive/10 shrink-0 px-2"
                                        onClick={() => onRemoveFromCart(product.id)}
                                        aria-label={`Remove ${product.name} from cart`}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="w-full text-xs h-8 gap-1.5 cursor-pointer"
                                    onClick={handleAddToCart}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Add to Cart</span>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                    </div>
                </div>
            </Card>

            {/* Accessible Price Override Request Modal */}
            <PriceOverrideModal
                isOpen={isOverrideModalOpen}
                product={product}
                requestedPrice={unitPrice}
                onConfirm={handleOverrideConfirm}
                onClose={() => setIsOverrideModalOpen(false)}
            />
        </>
    );
};
