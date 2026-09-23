<?php

namespace App\Services\Barcode;

use App\Models\Product;
use App\Models\User;
use App\Services\Product\ProductService;

class BarcodeService
{
    public function __construct(
        protected ProductService $productService
    ) {}

    /**
     * Deterministically normalize barcode string input.
     * Strips HID scanner Enter suffixes (\r, \n), whitespace, and non-printable control characters.
     */
    public function normalize(?string $rawBarcode): string
    {
        if ($rawBarcode === null) {
            return '';
        }

        // Remove carriage returns, newlines, and non-printable ASCII control chars
        $cleaned = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', $rawBarcode);

        // Trim leading and trailing whitespace
        return trim((string) $cleaned);
    }

    /**
     * Detect standard wholesale/retail barcode format based on structure.
     */
    public function detectType(?string $barcode): ?string
    {
        $normalized = $this->normalize($barcode);

        if ($normalized === '') {
            return null;
        }

        $length = strlen($normalized);
        $isAllDigits = ctype_digit($normalized);

        if ($isAllDigits) {
            return match ($length) {
                12 => 'UPC-A',
                13 => 'EAN-13',
                14 => 'ITF-14',
                8 => 'EAN-8',
                default => 'NUMERIC',
            };
        }

        if (preg_match('/^[A-Z0-9\-\.\ \$\/\+\%]+$/i', $normalized)) {
            return 'CODE-128';
        }

        return 'CUSTOM';
    }

    /**
     * Authoritatively lookup product by normalized barcode.
     * Enforces permission checks and masks sensitive cost prices for non-administrative roles.
     *
     * @return array<string, mixed>|null
     */
    public function lookup(string $rawBarcode, ?User $actor = null): ?array
    {
        $normalized = $this->normalize($rawBarcode);

        if ($normalized === '') {
            return null;
        }

        /** @var Product|null $product */
        $product = Product::query()
            ->with(['category:id,name,code', 'primaryImage', 'taxProfile', 'images'])
            ->where('barcode', $normalized)
            ->orWhere('sku', $normalized)
            ->first();

        if (! $product) {
            return null;
        }

        return $this->productService->formatProduct($product, $actor);
    }
}
