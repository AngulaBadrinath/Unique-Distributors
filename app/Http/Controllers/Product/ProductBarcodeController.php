<?php

namespace App\Http\Controllers\Product;

use App\Http\Controllers\Controller;
use App\Services\Barcode\BarcodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductBarcodeController extends Controller
{
    public function __construct(
        protected BarcodeService $barcodeService
    ) {}

    /**
     * Authoritatively lookup a product by scanned barcode.
     * Enforces authentication and product.view permission.
     * Barcode lookup ONLY identifies/resolves products; it never alters stock, prices, or orders.
     */
    public function lookup(Request $request): JsonResponse
    {
        $rawBarcode = (string) $request->input('barcode', '');
        $normalized = $this->barcodeService->normalize($rawBarcode);

        if ($normalized === '') {
            return response()->json([
                'found' => false,
                'barcode' => '',
                'message' => 'Barcode value is required.',
            ], 422);
        }

        $product = $this->barcodeService->lookup($normalized, $request->user());

        if (! $product) {
            return response()->json([
                'found' => false,
                'barcode' => $normalized,
                'detected_type' => $this->barcodeService->detectType($normalized),
                'message' => "Barcode '{$normalized}' not found in catalog.",
            ], 200);
        }

        return response()->json([
            'found' => true,
            'barcode' => $normalized,
            'detected_type' => $product['barcode_type'] ?? $this->barcodeService->detectType($normalized),
            'product' => $product,
        ], 200);
    }
}
