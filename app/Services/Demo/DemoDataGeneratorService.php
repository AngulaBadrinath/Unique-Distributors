<?php

namespace App\Services\Demo;

use App\Models\Category;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ReturnRequest;
use App\Services\Storage\StorageManagerService;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DemoDataGeneratorService
{
    public function __construct(
        protected StorageManagerService $storageManager
    ) {}

    /**
     * Generate synthetic product catalogue image binary (PNG 800x500).
     */
    public function generateProductImageBinary(string $sku, string $name, string $categoryName): string
    {
        $width = 800;
        $height = 500;
        $image = imagecreatetruecolor($width, $height);

        // Color palettes based on category
        $palettes = [
            'Beverages' => ['bg1' => [240, 249, 255], 'bg2' => [219, 234, 254], 'accent' => [37, 99, 235], 'card' => [255, 255, 255]],
            'Grocery & Staples' => ['bg1' => [254, 252, 232], 'bg2' => [254, 240, 138], 'accent' => [202, 138, 4], 'card' => [255, 255, 255]],
            'Snacks & Confectionery' => ['bg1' => [255, 241, 242], 'bg2' => [254, 205, 211], 'accent' => [225, 29, 72], 'card' => [255, 255, 255]],
            'Household & Cleaning' => ['bg1' => [240, 253, 250], 'bg2' => [204, 251, 241], 'accent' => [13, 148, 136], 'card' => [255, 255, 255]],
            'Personal Care' => ['bg1' => [245, 243, 255], 'bg2' => [233, 213, 255], 'accent' => [124, 58, 237], 'card' => [255, 255, 255]],
        ];

        $palette = $palettes[$categoryName] ?? ['bg1' => [248, 250, 252], 'bg2' => [226, 232, 240], 'accent' => [71, 85, 105], 'card' => [255, 255, 255]];

        // Draw background gradient
        for ($y = 0; $y < $height; $y++) {
            $ratio = $y / $height;
            $r = (int) ($palette['bg1'][0] * (1 - $ratio) + $palette['bg2'][0] * $ratio);
            $g = (int) ($palette['bg1'][1] * (1 - $ratio) + $palette['bg2'][1] * $ratio);
            $b = (int) ($palette['bg1'][2] * (1 - $ratio) + $palette['bg2'][2] * $ratio);
            $color = imagecolorallocate($image, $r, $g, $b);
            imageline($image, 0, $y, $width, $y, $color);
        }

        // Draw central card container
        $cardBg = imagecolorallocate($image, $palette['card'][0], $palette['card'][1], $palette['card'][2]);
        $borderColor = imagecolorallocate($image, 226, 232, 240);
        $accentColor = imagecolorallocate($image, $palette['accent'][0], $palette['accent'][1], $palette['accent'][2]);
        $textColor = imagecolorallocate($image, 30, 41, 59);
        $subtextColor = imagecolorallocate($image, 100, 116, 139);

        imagefilledrectangle($image, 60, 60, $width - 60, $height - 60, $cardBg);
        imagerectangle($image, 60, 60, $width - 60, $height - 60, $borderColor);

        // Header bar inside card
        imagefilledrectangle($image, 60, 60, $width - 60, 120, $accentColor);
        $headerText = imagecolorallocate($image, 255, 255, 255);
        imagestring($image, 5, 80, 82, strtoupper($categoryName).' CATALOGUE', $headerText);

        // Central product representation
        imagestring($image, 5, 80, 160, "SKU: {$sku}", $accentColor);
        imagestring($image, 5, 80, 200, $name, $textColor);
        imagestring($image, 4, 80, 240, 'Wholesale Distribution B2B Item', $subtextColor);
        imagestring($image, 3, 80, 280, 'Standard Distribution Pack / Verified Quality', $subtextColor);

        // Footer stamp
        imagefilledrectangle($image, 80, $height - 110, 280, $height - 80, $accentColor);
        imagestring($image, 4, 95, $height - 102, 'GENUINE WHOLESALE', $headerText);

        ob_start();
        imagepng($image);
        $binary = ob_get_clean();
        imagedestroy($image);

        return $binary ?: '';
    }

    /**
     * Generate synthetic delivery signature binary (PNG).
     */
    public function generateSignatureBinary(string $recipientName): string
    {
        $width = 400;
        $height = 200;
        $image = imagecreatetruecolor($width, $height);
        $bg = imagecolorallocate($image, 255, 255, 255);
        imagefilledrectangle($image, 0, 0, $width, $height, $bg);

        $penColor = imagecolorallocate($image, 15, 23, 42);
        $guideColor = imagecolorallocate($image, 226, 232, 240);

        imageline($image, 40, 150, 360, 150, $guideColor);

        // Draw realistic signature curves
        $points = [
            [50, 140], [70, 90], [90, 145], [110, 80], [130, 130],
            [160, 120], [190, 140], [220, 100], [260, 145], [310, 110], [340, 140],
        ];

        imagesetthickness($image, 2);
        for ($i = 0; $i < count($points) - 1; $i++) {
            imageline($image, $points[$i][0], $points[$i][1], $points[$i+1][0], $points[$i+1][1], $penColor);
        }

        $captionColor = imagecolorallocate($image, 148, 163, 184);
        imagestring($image, 3, 40, 160, 'Signee: '.$recipientName, $captionColor);

        ob_start();
        imagepng($image);
        $binary = ob_get_clean();
        imagedestroy($image);

        return $binary ?: '';
    }

    /**
     * Generate synthetic POD / Delivery proof JPEG binary.
     */
    public function generatePodJpegBinary(string $deliveryNumber): string
    {
        $width = 640;
        $height = 480;
        $image = imagecreatetruecolor($width, $height);

        $bg = imagecolorallocate($image, 241, 245, 249);
        imagefilledrectangle($image, 0, 0, $width, $height, $bg);

        $crateColor = imagecolorallocate($image, 180, 83, 9);
        imagefilledrectangle($image, 100, 150, 540, 380, $crateColor);

        $textColor = imagecolorallocate($image, 255, 255, 255);
        imagestring($image, 5, 140, 200, "PROOF OF DELIVERY: {$deliveryNumber}", $textColor);
        imagestring($image, 4, 140, 240, 'Warehouse Receiving Dock #4', $textColor);
        imagestring($image, 4, 140, 270, 'Timestamp: '.now()->toDateTimeString(), $textColor);

        ob_start();
        imagejpeg($image, null, 90);
        $binary = ob_get_clean();
        imagedestroy($image);

        return $binary ?: '';
    }

    /**
     * Generate synthetic Cheque / Money Order evidence JPEG binary.
     */
    public function generatePaymentEvidenceJpegBinary(string $paymentNumber, string $method, float $amount): string
    {
        $width = 800;
        $height = 400;
        $image = imagecreatetruecolor($width, $height);

        $bg = imagecolorallocate($image, 248, 250, 252);
        imagefilledrectangle($image, 0, 0, $width, $height, $bg);

        // Check container
        $checkBg = imagecolorallocate($image, 240, 253, 244);
        $border = imagecolorallocate($image, 34, 197, 94);
        imagefilledrectangle($image, 30, 30, $width - 30, $height - 30, $checkBg);
        imagerectangle($image, 30, 30, $width - 30, $height - 30, $border);

        $text = imagecolorallocate($image, 22, 101, 52);
        imagestring($image, 5, 60, 60, "SAMPLE {$method} EVIDENCE - SYNTHETIC DEMO ONLY", $text);
        imagestring($image, 5, 60, 110, "PAYMENT REF: {$paymentNumber}", $text);
        imagestring($image, 5, 60, 160, 'PAY TO: UNIQUE DISTRIBUTORS WHOLESALE', $text);
        imagestring($image, 5, 60, 210, 'AMOUNT: $'.number_format($amount, 2).' USD', $text);
        imagestring($image, 4, 60, 260, 'AUTHORIZED SIGNATURE: [VERIFIED COMMERCIAL ACCOUNT]', $text);
        imagestring($image, 3, 60, 320, 'MICR: C001234C A123456789A 9876543210C', $text);

        ob_start();
        imagejpeg($image, null, 90);
        $binary = ob_get_clean();
        imagedestroy($image);

        return $binary ?: '';
    }

    /**
     * Seed all dummy product images to private storage and attach to ProductImage records.
     */
    public function seedProductImages(string $disk = 's3'): int
    {
        $products = Product::with('category', 'images')->get();
        $count = 0;

        foreach ($products as $product) {
            $categoryName = $product->category?->name ?? 'General';
            $imageBinary = $this->generateProductImageBinary($product->sku, $product->name, $categoryName);

            $uuid = (string) Str::uuid();
            $filename = "{$uuid}.png";
            $objectKey = "products/{$product->id}/images/{$filename}";

            // Put binary into target storage
            $this->storageManager->put($objectKey, $imageBinary, $disk);

            // Create or update primary ProductImage record
            ProductImage::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'is_primary' => true,
                ],
                [
                    'object_key' => $objectKey,
                    'original_filename' => strtolower($product->sku).'_catalogue.png',
                    'mime_type' => 'image/png',
                    'size_bytes' => strlen($imageBinary),
                    'sort_order' => 0,
                ]
            );

            $count++;
        }

        return $count;
    }

    /**
     * Seed payment evidence, delivery proof, and signatures to storage.
     */
    public function seedOperationalEvidence(string $disk = 's3'): array
    {
        $counts = ['payments' => 0, 'deliveries' => 0, 'returns' => 0];

        // 1. Payment Evidence
        $payments = Payment::whereNull('evidence_object_key')->get();
        foreach ($payments as $payment) {
            $methodName = $payment->payment_method?->value ?? 'CHEQUE';
            if ($methodName === 'CASH') {
                continue;
            }

            $binary = $this->generatePaymentEvidenceJpegBinary($payment->payment_number, $methodName, (float) $payment->amount);
            $uuid = (string) Str::uuid();
            $objectKey = "payments/{$payment->id}/evidence/{$uuid}.jpg";

            $this->storageManager->put($objectKey, $binary, $disk);

            $payment->update([
                'evidence_object_key' => $objectKey,
                'evidence_mime_type' => 'image/jpeg',
                'evidence_size_bytes' => strlen($binary),
                'evidence_uploaded_at' => now(),
            ]);

            $counts['payments']++;
        }

        // 2. Delivery Proof & Signature
        $deliveries = Delivery::whereNull('recipient_signature_path')->get();
        foreach ($deliveries as $delivery) {
            $sigBinary = $this->generateSignatureBinary($delivery->delivery_contact_name ?? 'Authorized Receiver');
            $sigUuid = (string) Str::uuid();
            $sigKey = "deliveries/{$delivery->id}/signatures/{$sigUuid}.png";
            $this->storageManager->put($sigKey, $sigBinary, $disk);

            $podBinary = $this->generatePodJpegBinary($delivery->delivery_number);
            $podUuid = (string) Str::uuid();
            $podKey = "deliveries/{$delivery->id}/pod/{podUuid}.jpg";
            $this->storageManager->put($podKey, $podBinary, $disk);

            $delivery->update([
                'recipient_signature_path' => $sigKey,
                'pod_evidence_path' => $podKey,
                'delivered_at' => $delivery->delivered_at ?? now(),
            ]);

            $counts['deliveries']++;
        }

        return $counts;
    }
}
