import React, { useState, useEffect, useRef, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import {
    Scan,
    Camera,
    Keyboard,
    Search,
    AlertCircle,
    CheckCircle2,
    Plus,
    X,
    ExternalLink,
    RefreshCw,
    Package,
    Tag,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Product } from '@/types';

interface BarcodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProductSelected?: (product: Product) => void;
    autoRedirectToEdit?: boolean;
}

export default function BarcodeScannerModal({
    isOpen,
    onClose,
    onProductSelected,
    autoRedirectToEdit = true,
}: BarcodeScannerModalProps) {
    const [mode, setMode] = useState<'hardware' | 'camera'>('hardware');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
    const [detectedType, setDetectedType] = useState<string | null>(null);
    const [notFoundError, setNotFoundError] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerId = 'interactive-camera-barcode-viewfinder';
    const lastScannedTimeRef = useRef<number>(0);

    // Auto-focus input when modal opens or mode changes to hardware
    useEffect(() => {
        if (isOpen && mode === 'hardware') {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, mode, matchedProduct, notFoundError]);

    // Handle lookup API
    const performLookup = useCallback(async (code: string) => {
        const trimmed = code.trim();
        if (!trimmed || isSearching) return;

        // Prevent duplicate rapid burst calls
        const now = Date.now();
        if (now - lastScannedTimeRef.current < 400 && scannedBarcode === trimmed) {
            return;
        }
        lastScannedTimeRef.current = now;

        setIsSearching(true);
        setScannedBarcode(trimmed);
        setNotFoundError(null);
        setMatchedProduct(null);

        try {
            const response = await fetch(`/products/barcode/lookup?barcode=${encodeURIComponent(trimmed)}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            const result = await response.json();

            if (result.found && result.product) {
                setMatchedProduct(result.product);
                setDetectedType(result.detected_type || null);
            } else {
                setNotFoundError(result.message || `Barcode '${trimmed}' not found in catalog.`);
                setDetectedType(result.detected_type || null);
            }
        } catch (err) {
            setNotFoundError('An error occurred during barcode lookup. Please try again.');
        } finally {
            setIsSearching(false);
        }
    }, [isSearching, scannedBarcode]);

    // Camera scanner start/stop logic
    const stopCamera = useCallback(async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                await scannerRef.current.clear();
            } catch (err) {
                console.warn('Camera shutdown warning:', err);
            } finally {
                scannerRef.current = null;
                setIsCameraActive(false);
            }
        }
    }, []);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        await stopCamera();

        try {
            const html5QrCode = new Html5Qrcode(scannerContainerId);
            scannerRef.current = html5QrCode;

            const config = {
                fps: 15,
                qrbox: { width: 260, height: 160 },
                aspectRatio: 1.6,
            };

            await html5QrCode.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    // On barcode detected
                    performLookup(decodedText);
                    // Pause camera scanning after match to prevent spam
                    stopCamera();
                },
                () => {
                    // QR/Barcode search loop frame - ignored
                }
            );

            setIsCameraActive(true);
        } catch (err: any) {
            console.error('Camera startup error:', err);
            setCameraError(
                err?.message || 'Camera access unavailable or permission denied. Fallback to manual entry.'
            );
            setIsCameraActive(false);
        }
    }, [performLookup, stopCamera]);

    useEffect(() => {
        if (isOpen && mode === 'camera') {
            const timer = setTimeout(() => {
                startCamera();
            }, 250);
            return () => {
                clearTimeout(timer);
                stopCamera();
            };
        } else {
            stopCamera();
        }
    }, [isOpen, mode, startCamera, stopCamera]);

    // Cleanup on unmount or modal close
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            setBarcodeInput('');
            setMatchedProduct(null);
            setNotFoundError(null);
            setScannedBarcode(null);
            setCameraError(null);
        }
    }, [isOpen, stopCamera]);

    const handleHardwareSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (barcodeInput.trim()) {
            performLookup(barcodeInput);
            setBarcodeInput('');
        }
    };

    const handleCreateProductWithBarcode = () => {
        if (!scannedBarcode) return;
        onClose();
        router.visit(`/products/create?barcode=${encodeURIComponent(scannedBarcode)}`);
    };

    const handleSelectProduct = (product: Product) => {
        if (onProductSelected) {
            onProductSelected(product);
            onClose();
        } else if (autoRedirectToEdit) {
            onClose();
            router.visit(`/products/${product.id}`);
        }
    };

    const handleResetScan = () => {
        setMatchedProduct(null);
        setNotFoundError(null);
        setScannedBarcode(null);
        setBarcodeInput('');
        if (mode === 'camera') {
            startCamera();
        } else {
            inputRef.current?.focus();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="barcode-scanner-title"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Scan className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 id="barcode-scanner-title" className="text-base font-semibold text-foreground leading-none">
                                Barcode Scanner
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Scan hardware USB/Bluetooth barcodes or mobile camera
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Close scanner"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Scanner Mode Selector */}
                    {!matchedProduct && !notFoundError && (
                        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => setMode('hardware')}
                                className={`flex items-center justify-center gap-2 py-2 rounded-md transition-all cursor-pointer ${
                                    mode === 'hardware'
                                        ? 'bg-background text-foreground shadow-xs font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Keyboard className="h-3.5 w-3.5" />
                                <span>Hardware Scanner / Input</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('camera')}
                                className={`flex items-center justify-center gap-2 py-2 rounded-md transition-all cursor-pointer ${
                                    mode === 'camera'
                                        ? 'bg-background text-foreground shadow-xs font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Camera className="h-3.5 w-3.5" />
                                <span>Camera Scanner</span>
                            </button>
                        </div>
                    )}

                    {/* Hardware Scanner Mode */}
                    {mode === 'hardware' && !matchedProduct && !notFoundError && (
                        <div className="space-y-4 py-2">
                            <form onSubmit={handleHardwareSubmit} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1.5">
                                        Scan Barcode with USB / Bluetooth Scanner
                                    </label>
                                    <div className="relative">
                                        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            ref={inputRef}
                                            type="text"
                                            placeholder="Point scanner or type barcode..."
                                            value={barcodeInput}
                                            onChange={(e) => setBarcodeInput(e.target.value)}
                                            className="pl-9 pr-24 font-mono text-sm"
                                            disabled={isSearching}
                                            autoComplete="off"
                                        />
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={!barcodeInput.trim() || isSearching}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 text-xs gap-1 shadow-2xs"
                                        >
                                            {isSearching ? (
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Search className="h-3 w-3" />
                                            )}
                                            <span>Lookup</span>
                                        </Button>
                                    </div>
                                </div>
                            </form>

                            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
                                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                                    <Scan className="h-4.5 w-4.5" />
                                </div>
                                <h3 className="text-xs font-semibold text-foreground">
                                    Ready for Scanner Input
                                </h3>
                                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
                                    Hardware scanners send rapid keystrokes with an automatic Enter suffix. Simply scan any standard UPC, EAN, or Code 128 barcode.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Camera Scanner Mode */}
                    {mode === 'camera' && !matchedProduct && !notFoundError && (
                        <div className="space-y-3">
                            <div className="relative rounded-lg overflow-hidden border border-border bg-black min-h-[220px] flex items-center justify-center">
                                <div id={scannerContainerId} className="w-full" />
                                {cameraError && (
                                    <div className="p-4 text-center space-y-2 bg-background/95 m-4 rounded-lg border border-destructive/30">
                                        <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
                                        <p className="text-xs text-foreground font-medium">{cameraError}</p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setMode('hardware')}
                                            className="text-xs"
                                        >
                                            Switch to Manual / Hardware Entry
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-center text-muted-foreground">
                                Position the barcode inside the camera viewfinder to scan automatically.
                            </p>
                        </div>
                    )}

                    {/* Product Matched State */}
                    {matchedProduct && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Product Found in Catalog</span>
                            </div>

                            <Card className="border-border shadow-xs bg-muted/20">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                                                    {matchedProduct.sku}
                                                </Badge>
                                                {matchedProduct.barcode && (
                                                    <Badge variant="secondary" className="font-mono text-[10px]">
                                                        Barcode: {matchedProduct.barcode}
                                                    </Badge>
                                                )}
                                                <Badge
                                                    variant={matchedProduct.status === 'ACTIVE' ? 'success' : 'secondary'}
                                                    className="text-[10px]"
                                                >
                                                    {matchedProduct.status_label || matchedProduct.status}
                                                </Badge>
                                            </div>
                                            <h3 className="text-sm font-bold text-foreground">
                                                {matchedProduct.name}
                                            </h3>
                                            {matchedProduct.category && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Category: {matchedProduct.category.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                                        <div>
                                            <span className="text-muted-foreground block text-[10px] uppercase font-mono">
                                                Selling Price
                                            </span>
                                            <span className="font-bold text-foreground font-mono">
                                                ${parseFloat(String(matchedProduct.default_selling_price || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[10px] uppercase font-mono">
                                                MRP / List
                                            </span>
                                            <span className="font-bold text-foreground font-mono">
                                                ${parseFloat(String(matchedProduct.mrp || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    type="button"
                                    onClick={() => handleSelectProduct(matchedProduct)}
                                    className="flex-1 gap-1.5 shadow-xs"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>View / Edit Product</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleResetScan}
                                    className="gap-1.5"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>Scan Another</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Not Found State */}
                    {notFoundError && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>Barcode Not Found in System</span>
                                </div>
                                <p className="text-xs text-foreground">
                                    No product was found matching barcode:{' '}
                                    <strong className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                                        {scannedBarcode}
                                    </strong>
                                    {detectedType && (
                                        <span className="text-muted-foreground text-[11px] ml-1">
                                            (Detected format: {detectedType})
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    You can create a new product master record immediately with this barcode pre-populated.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    type="button"
                                    onClick={handleCreateProductWithBarcode}
                                    className="flex-1 gap-1.5 shadow-xs"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Create Product with this Barcode</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleResetScan}
                                    className="gap-1.5"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>Try Again</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                        Supported: UPC-A • EAN-13 • Code 128 • Code 39 • ITF-14
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
