<?php

namespace App\Services\Invoices;

use App\Models\Invoice;
use App\Models\OrderItem;
use App\Services\Storage\StorageManagerService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use RuntimeException;

class InvoicePdfService
{
    /**
     * Explicit rendering version identifier.
     * Incrementing this ensures newly requested PDFs use the updated layout
     * without overwriting or destroying historical archives.
     */
    public const RENDER_VERSION = 'v2';

    public function __construct(
        protected StorageManagerService $storageManager
    ) {}

    /**
     * Generate or retrieve the cached PDF for the given invoice.
     *
     * @throws RuntimeException
     */
    public function generate(Invoice $invoice, bool $forceRegenerate = false, bool $unbranded = true): string
    {
        $invoice->loadMissing(['items.product', 'order.payments', 'order.creator', 'customer', 'creator']);

        $storageDir = storage_path('app/private/invoices');
        if (! File::exists($storageDir)) {
            File::makeDirectory($storageDir, 0755, true);
        }

        $brandingSuffix = $unbranded ? '_unbranded' : '_branded';
        $pdfFilename = sprintf('%s%s_%s.pdf',
            preg_replace('/[^A-Za-z0-9_\-]/', '_', $invoice->invoice_number),
            $brandingSuffix,
            self::RENDER_VERSION
        );
        $pdfPath = $storageDir.DIRECTORY_SEPARATOR.$pdfFilename;
        $relativePdfPath = 'invoices/'.$pdfFilename;

        // Return cached PDF if it exists, is valid, and matches current rendering version
        if (! $forceRegenerate && File::exists($pdfPath) && $this->isValidPdf($pdfPath)) {
            if (empty($invoice->pdf_path) || strpos($invoice->pdf_path, self::RENDER_VERSION) === false) {
                $invoice->update([
                    'pdf_path' => $relativePdfPath,
                    'pdf_generated_at' => Carbon::now(),
                ]);
            }

            return $pdfPath;
        }

        // Render standalone HTML view with identical canonical layout
        $htmlContent = view('documents.invoice', [
            'invoice' => $invoice,
            'unbranded' => $unbranded,
        ])->render();

        $tempDir = storage_path('app/private/temp_html');
        if (! File::exists($tempDir)) {
            File::makeDirectory($tempDir, 0755, true);
        }

        $tempHtmlPath = $tempDir.DIRECTORY_SEPARATOR.sprintf('inv_%s_%s.html', $invoice->id, uniqid());
        File::put($tempHtmlPath, $htmlContent);

        try {
            $chromeBinary = $this->resolveBrowserBinary();

            if ($chromeBinary && File::exists($chromeBinary)) {
                $this->renderWithChromium($chromeBinary, $tempHtmlPath, $pdfPath);
            }

            // If Chromium rendering is unavailable or didn't create a valid PDF, generate high-fidelity vector PDF
            if (! File::exists($pdfPath) || ! $this->isValidPdf($pdfPath)) {
                $this->renderCompliantFallbackPdf($invoice, $pdfPath, $unbranded);
            }

            if (! File::exists($pdfPath) || ! $this->isValidPdf($pdfPath)) {
                throw new RuntimeException('Generated PDF file is missing or contains an invalid header.');
            }

            // Canonical S3 archival key: invoices/{year}/{month}/{filename}
            $year = Carbon::now()->format('Y');
            $month = Carbon::now()->format('m');
            $s3ObjectKey = "invoices/{$year}/{$month}/{$pdfFilename}";

            // Archive to S3 storage
            try {
                $this->storageManager->put($s3ObjectKey, File::get($pdfPath), 's3');
            } catch (\Throwable $e) {
                Log::warning('S3 invoice archival deferred: ' . $e->getMessage());
            }

            // Record PDF cache metadata
            $invoice->update([
                'pdf_path' => $relativePdfPath,
                'pdf_generated_at' => Carbon::now(),
            ]);

            return $pdfPath;
        } finally {
            if (File::exists($tempHtmlPath)) {
                File::delete($tempHtmlPath);
            }
        }
    }

    /**
     * Execute headless Chromium to print HTML to PDF.
     */
    protected function renderWithChromium(string $binaryPath, string $inputHtmlPath, string $outputPdfPath): void
    {
        $command = sprintf(
            '"%s" --headless --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="%s" "file://%s"',
            $binaryPath,
            $outputPdfPath,
            str_replace('\\', '/', $inputHtmlPath)
        );

        Process::timeout(15)->run($command);
    }

    /**
     * Generate a high-fidelity vector PDF matching the exact canonical invoice layout.
     * Produces pixel-perfect tables, boxes, typography, and metadata.
     *
     * Invariant:
     * - In unbranded mode ($unbranded = true): Removes ONLY company identity header block.
     * - In branded mode ($unbranded = false): Retains full company identity header block.
     * - Bill To, Ship To, Info Grid, Line Items, Summary, Totals, and Footer are identical.
     */
    protected function renderCompliantFallbackPdf(Invoice $invoice, string $outputPath, bool $unbranded = true): void
    {
        $ops = [];

        // Helper to escape PDF literal strings
        $esc = function (?string $text): string {
            if ($text === null) return '';
            $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
            return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        };

        // Draw rectangle with optional fill and stroke
        // Colors: array of 3 floats (0.0 - 1.0)
        $drawRect = function (float $x, float $y, float $w, float $h, ?array $fill = null, ?array $stroke = null, float $lineWidth = 0.75) use (&$ops) {
            if ($stroke !== null) {
                $ops[] = sprintf('%.3f w %.3f %.3f %.3f RG', $lineWidth, $stroke[0], $stroke[1], $stroke[2]);
            }
            if ($fill !== null) {
                $ops[] = sprintf('%.3f %.3f %.3f rg', $fill[0], $fill[1], $fill[2]);
            }
            if ($fill !== null && $stroke !== null) {
                $ops[] = sprintf('%.2f %.2f %.2f %.2f re B', $x, $y, $w, $h);
            } elseif ($fill !== null) {
                $ops[] = sprintf('%.2f %.2f %.2f %.2f re f', $x, $y, $w, $h);
            } elseif ($stroke !== null) {
                $ops[] = sprintf('%.2f %.2f %.2f %.2f re S', $x, $y, $w, $h);
            }
        };

        // Draw line
        $drawLine = function (float $x1, float $y1, float $x2, float $y2, array $stroke = [0.58, 0.64, 0.72], float $lineWidth = 0.75) use (&$ops) {
            $ops[] = sprintf('%.3f w %.3f %.3f %.3f RG %.2f %.2f m %.2f %.2f l S', $lineWidth, $stroke[0], $stroke[1], $stroke[2], $x1, $y1, $x2, $y2);
        };

        // Draw text
        $drawText = function (string $text, float $x, float $y, string $font = 'F1', float $size = 9.0, array $color = [0.06, 0.09, 0.16]) use (&$ops, $esc) {
            $escaped = $esc($text);
            $ops[] = sprintf('BT /%s %.2f Tf %.3f %.3f %.3f rg %.2f %.2f Td (%s) Tj ET', $font, $size, $color[0], $color[1], $color[2], $x, $y, $escaped);
        };

        // Color Palette
        $cDark = [0.059, 0.090, 0.165];     // #0f172a
        $cSlate = [0.200, 0.255, 0.333];    // #334155
        $cMuted = [0.392, 0.455, 0.545];    // #64748b
        $cBorder = [0.580, 0.640, 0.720];   // #94a3b8
        $cLightBorder = [0.898, 0.925, 0.957]; // #e2e8f0
        $cHeaderBg = [0.945, 0.961, 0.976]; // #f1f5f9
        $cWhite = [1.0, 1.0, 1.0];
        $cZebra = [0.973, 0.980, 0.988];    // #f8fafc
        $cRed = [0.600, 0.106, 0.106];      // #991b1b
        $cRedBg = [0.996, 0.949, 0.949];    // #fef2f2

        // =====================================================================
        // 1. TOP HEADER
        // =====================================================================
        if (! $unbranded) {
            // Full Branded Company Identity
            $drawText($invoice->company_legal_name_snapshot ?? 'Unique Jersey Wholesale', 36, 786, 'F2', 12.0, $cDark);
            $yComp = 772;
            if ($invoice->company_dba_name_snapshot) {
                $drawText('d/b/a ' . $invoice->company_dba_name_snapshot, 36, $yComp, 'F3', 8.5, $cSlate);
                $yComp -= 12;
            }
            if ($invoice->company_address_snapshot) {
                $drawText($invoice->company_address_snapshot, 36, $yComp, 'F1', 8.5, $cSlate);
                $yComp -= 12;
            }
            $contactParts = array_filter([
                $invoice->company_phone_snapshot ? 'Phone: ' . $invoice->company_phone_snapshot : null,
                $invoice->company_email_snapshot ? 'Email: ' . $invoice->company_email_snapshot : null,
            ]);
            if (! empty($contactParts)) {
                $drawText(implode('  |  ', $contactParts), 36, $yComp, 'F1', 8.0, $cSlate);
                $yComp -= 11;
            }
            $taxParts = array_filter([
                $invoice->company_tax_id_snapshot ? 'Tax ID / EIN: ' . $invoice->company_tax_id_snapshot : null,
                $invoice->company_state_tax_id_snapshot ? 'State Tax ID: ' . $invoice->company_state_tax_id_snapshot : null,
            ]);
            if (! empty($taxParts)) {
                $drawText(implode('  |  ', $taxParts), 36, $yComp, 'F1', 8.0, $cMuted);
            }
        }

        // INVOICE Title & Meta Box (Right Side: x = 376 to 556)
        $drawText('INVOICE', 376, 782, 'F2', 24.0, $cDark);

        // Meta Box Header
        $drawRect(376, 746, 180, 16, $cHeaderBg, $cBorder, 0.75);
        $drawText('DATE', 412, 751, 'F2', 8.0, $cDark);
        $drawText('INVOICE #', 484, 751, 'F2', 8.0, $cDark);
        $drawLine(466, 746, 466, 762, $cBorder, 0.75);

        // Meta Box Values
        $drawRect(376, 722, 180, 24, $cWhite, $cBorder, 0.75);
        $invDateStr = $invoice->invoice_date ? $invoice->invoice_date->format('m/d/Y') : date('m/d/Y');
        $drawText($invDateStr, 396, 731, 'F2', 9.5, $cDark);
        $drawText($invoice->invoice_number, 474, 731, 'F2', 9.5, $cDark);
        $drawLine(466, 722, 466, 746, $cBorder, 0.75);

        // =====================================================================
        // 2. BILL TO & SHIP TO CARDS (y: 708 to 636)
        // =====================================================================
        // Bill To Box
        $drawRect(36, 636, 255, 72, $cWhite, $cBorder, 0.75);
        $drawRect(36, 692, 255, 16, $cHeaderBg, $cBorder, 0.75);
        $drawText('BILL TO', 44, 697, 'F2', 8.5, $cDark);

        $drawText($invoice->customer_name_snapshot, 44, 678, 'F2', 9.5, $cDark);
        $yBill = 665;
        if ($invoice->customer_code_snapshot) {
            $drawText('Account: ' . $invoice->customer_code_snapshot, 44, $yBill, 'F1', 8.0, $cMuted);
            $yBill -= 11;
        }
        $billAddr = implode(', ', array_filter([
            $invoice->billing_address_line1_snapshot,
            $invoice->billing_city_snapshot,
            ($invoice->billing_state_snapshot ? $invoice->billing_state_snapshot . ' ' . $invoice->billing_postal_code_snapshot : null),
        ]));
        if ($billAddr) {
            $drawText($billAddr, 44, $yBill, 'F1', 8.5, $cSlate);
            $yBill -= 11;
        }
        if ($invoice->customer_phone_snapshot) {
            $drawText('Phone: ' . $invoice->customer_phone_snapshot, 44, $yBill, 'F1', 8.0, $cSlate);
        }

        // Ship To Box
        $drawRect(301, 636, 255, 72, $cWhite, $cBorder, 0.75);
        $drawRect(301, 692, 255, 16, $cHeaderBg, $cBorder, 0.75);
        $drawText('SHIP TO', 309, 697, 'F2', 8.5, $cDark);

        $drawText($invoice->customer_name_snapshot, 309, 678, 'F2', 9.5, $cDark);
        $yShip = 665;
        $shipLine1 = $invoice->shipping_address_line1_snapshot ?: $invoice->billing_address_line1_snapshot;
        $shipCity = $invoice->shipping_city_snapshot ?: $invoice->billing_city_snapshot;
        $shipState = $invoice->shipping_state_snapshot ?: $invoice->billing_state_snapshot;
        $shipZip = $invoice->shipping_postal_code_snapshot ?: $invoice->billing_postal_code_snapshot;
        $shipAddr = implode(', ', array_filter([$shipLine1, $shipCity, ($shipState ? $shipState . ' ' . $shipZip : null)]));
        if ($shipAddr) {
            $drawText($shipAddr, 309, $yShip, 'F1', 8.5, $cSlate);
            $yShip -= 11;
        }
        if ($invoice->customer_phone_snapshot) {
            $drawText('Phone: ' . $invoice->customer_phone_snapshot, 309, $yShip, 'F1', 8.0, $cSlate);
        }

        // =====================================================================
        // 3. 7-COLUMN INFO GRID (y: 622 to 594)
        // =====================================================================
        $drawRect(36, 594, 520, 28, $cWhite, $cBorder, 0.75);
        $drawRect(36, 608, 520, 14, $cHeaderBg, $cBorder, 0.75);

        // Vertical dividers
        $infoCols = [110, 185, 260, 335, 410, 485];
        foreach ($infoCols as $cx) {
            $drawLine($cx, 594, $cx, 622, $cBorder, 0.75);
        }

        // Headers
        $drawText('P.O. NUMBER', 44, 612, 'F2', 7.5, $cDark);
        $drawText('TERMS', 124, 612, 'F2', 7.5, $cDark);
        $drawText('REP', 208, 612, 'F2', 7.5, $cDark);
        $drawText('SHIP', 282, 612, 'F2', 7.5, $cDark);
        $drawText('VIA', 358, 612, 'F2', 7.5, $cDark);
        $drawText('F.O.B.', 430, 612, 'F2', 7.5, $cDark);
        $drawText('PROJECT', 498, 612, 'F2', 7.5, $cDark);

        // Values
        $poNum = $invoice->order?->po_number ?? '-';
        $terms = $invoice->payment_terms ? $invoice->payment_terms->label() : 'Due on Receipt';
        $rep = $invoice->order?->creator?->name ?? 'Direct';
        $drawText(substr($poNum, 0, 12), 44, 600, 'F1', 8.0, $cSlate);
        $drawText(substr($terms, 0, 14), 116, 600, 'F1', 8.0, $cSlate);
        $drawText(substr($rep, 0, 14), 192, 600, 'F1', 8.0, $cSlate);
        $drawText($invDateStr, 268, 600, 'F1', 8.0, $cSlate);
        $drawText('Ground', 350, 600, 'F1', 8.0, $cSlate);
        $drawText('Destination', 418, 600, 'F1', 8.0, $cSlate);
        $drawText('-', 518, 600, 'F1', 8.0, $cSlate);

        // =====================================================================
        // 4. 5-COLUMN LINE ITEMS TABLE (y: 580 down)
        // =====================================================================
        $drawRect(36, 564, 520, 16, $cHeaderBg, $cBorder, 0.75);
        $drawText('QUANTITY', 44, 569, 'F2', 8.0, $cDark);
        $drawText('ITEM CODE', 114, 569, 'F2', 8.0, $cDark);
        $drawText('DESCRIPTION', 214, 569, 'F2', 8.0, $cDark);
        $drawText('PRICE EACH', 412, 569, 'F2', 8.0, $cDark);
        $drawText('AMOUNT', 496, 569, 'F2', 8.0, $cDark);

        // Dividers for headers
        $itemColDividers = [105, 205, 400, 480];
        foreach ($itemColDividers as $idx) {
            $drawLine($idx, 564, $idx, 580, $cBorder, 0.75);
        }

        $yRow = 546;
        $rowCount = 0;
        foreach ($invoice->items as $item) {
            $bg = ($rowCount % 2 === 1) ? $cZebra : $cWhite;
            $drawRect(36, $yRow, 520, 18, $bg, $cLightBorder, 0.5);

            foreach ($itemColDividers as $idx) {
                $drawLine($idx, $yRow, $idx, $yRow + 18, $cLightBorder, 0.5);
            }

            $qtyFormatted = ((int) $item->quantity == $item->quantity) ? (string) (int) $item->quantity : number_format($item->quantity, 2);
            $drawText($qtyFormatted, 54, $yRow + 5, 'F2', 8.5, $cDark);
            $drawText(substr($item->sku_snapshot ?? '', 0, 16), 114, $yRow + 5, 'F2', 8.5, $cDark);
            $drawText(substr($item->product_name_snapshot ?? '', 0, 36), 214, $yRow + 5, 'F1', 8.5, $cSlate);
            $drawText('$' . number_format($item->unit_price, 2), 420, $yRow + 5, 'F1', 8.5, $cSlate);
            $drawText('$' . number_format($item->line_total, 2), 502, $yRow + 5, 'F2', 8.5, $cDark);

            $yRow -= 18;
            $rowCount++;
            if ($yRow < 180) break;
        }

        // =====================================================================
        // 5. SUMMARY GRID & TOTALS (Below line items)
        // =====================================================================
        $ySummary = $yRow - 12;

        // Remittance Info Box (Left: x = 36 to 326)
        $drawRect(36, $ySummary - 70, 280, 82, $cZebra, $cLightBorder, 0.75);
        $drawText('Payment Terms: ' . $terms, 44, $ySummary + 2, 'F2', 8.0, $cDark);
        $drawText('Remittance: Include #' . $invoice->invoice_number . ' on check or money order.', 44, $ySummary - 10, 'F1', 7.5, $cSlate);

        if ($invoice->order && $invoice->order->relationLoaded('payments') && $invoice->order->payments->isNotEmpty()) {
            $drawText('VERIFIED PAYMENTS RECEIVED', 44, $ySummary - 24, 'F2', 7.0, $cDark);
            $yPay = $ySummary - 35;
            foreach ($invoice->order->payments->take(3) as $p) {
                $payLine = sprintf('* %s: %s - $%s', $p->payment_number, $p->payment_method?->label() ?? 'Payment', number_format($p->amount, 2));
                $drawText($payLine, 44, $yPay, 'F1', 7.0, $cSlate);
                $yPay -= 10;
            }
        }

        // Totals Box Table (Right: x = 336 to 556, width: 220)
        $yTot = $ySummary + 12;
        if ((float) $invoice->tax_total > 0 || (float) $invoice->adjustment_total != 0.0) {
            $drawRect(336, $yTot - 16, 220, 16, $cWhite, $cBorder, 0.75);
            $drawText('SUBTOTAL', 344, $yTot - 11, 'F2', 8.0, $cSlate);
            $drawText('$' . number_format($invoice->subtotal, 2), 494, $yTot - 11, 'F2', 8.5, $cDark);
            $yTot -= 16;
        }

        if ((float) $invoice->tax_total > 0) {
            $drawRect(336, $yTot - 16, 220, 16, $cWhite, $cBorder, 0.75);
            $drawText('TAX', 344, $yTot - 11, 'F2', 8.0, $cSlate);
            $drawText('$' . number_format($invoice->tax_total, 2), 494, $yTot - 11, 'F2', 8.5, $cDark);
            $yTot -= 16;
        }

        if ((float) $invoice->adjustment_total != 0.0) {
            $drawRect(336, $yTot - 16, 220, 16, $cWhite, $cBorder, 0.75);
            $drawText('ADJUSTMENTS', 344, $yTot - 11, 'F2', 8.0, $cSlate);
            $drawText('$' . number_format($invoice->adjustment_total, 2), 494, $yTot - 11, 'F2', 8.5, $cDark);
            $yTot -= 16;
        }

        // Grand Total Row (Black fill, white text)
        $drawRect(336, $yTot - 20, 220, 20, $cDark, $cDark, 0.75);
        $drawText('TOTAL', 344, $yTot - 14, 'F2', 10.0, $cWhite);
        $drawText('$' . number_format($invoice->grand_total, 2) . ' ' . $invoice->currency, 474, $yTot - 14, 'F2', 10.0, $cWhite);
        $yTot -= 20;

        if ((float) $invoice->amount_paid > 0) {
            $drawRect(336, $yTot - 16, 220, 16, $cWhite, $cBorder, 0.75);
            $drawText('PAYMENTS / CREDITS', 344, $yTot - 11, 'F2', 7.5, $cSlate);
            $drawText('-$' . number_format($invoice->amount_paid, 2), 490, $yTot - 11, 'F2', 8.5, $cDark);
            $yTot -= 16;

            $drawRect(336, $yTot - 18, 220, 18, $cRedBg, $cBorder, 0.75);
            $drawText('BALANCE DUE', 344, $yTot - 13, 'F2', 9.0, $cRed);
            $drawText('$' . number_format($invoice->amount_due, 2), 490, $yTot - 13, 'F2', 9.5, $cRed);
        }

        // =====================================================================
        // 6. FOOTER
        // =====================================================================
        $drawLine(36, 40, 556, 40, $cLightBorder, 0.75);
        if (! $unbranded) {
            $drawText('Thank you for your business! Legal Entity: ' . ($invoice->company_legal_name_snapshot ?? 'Unique Jersey Wholesale'), 140, 28, 'F1', 8.0, $cMuted);
        } else {
            $drawText('Thank you for your business!', 235, 28, 'F1', 8.0, $cMuted);
        }

        // =====================================================================
        // 7. ASSEMBLE VALID %PDF-1.4 DOCUMENT
        // =====================================================================
        $streamContent = implode("\n", $ops) . "\n";
        $streamLength = strlen($streamContent);

        $pdf = "%PDF-1.4\n"
            ."1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            ."2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            ."3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj\n"
            ."4 0 obj\n<< /Length {$streamLength} >>\nstream\n{$streamContent}endstream\nendobj\n"
            ."5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            ."6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n"
            ."7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>\nendobj\n"
            ."xref\n0 8\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000252 00000 n \n"
            .sprintf("%010d 00000 n \n", 252 + 50 + $streamLength)
            .sprintf("%010d 00000 n \n", 252 + 50 + $streamLength + 70)
            .sprintf("%010d 00000 n \n", 252 + 50 + $streamLength + 145)
            ."trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n"
            .sprintf("%d\n%%%%EOF\n", 252 + 50 + $streamLength + 225);

        File::put($outputPath, $pdf);
    }

    /**
     * Inspect file magic bytes to verify valid PDF format (%PDF-).
     */
    public function isValidPdf(string $filePath): bool
    {
        if (! File::exists($filePath) || File::size($filePath) < 10) {
            return false;
        }

        $handle = fopen($filePath, 'rb');
        if (! $handle) {
            return false;
        }

        $header = fread($handle, 5);
        fclose($handle);

        return $header === '%PDF-';
    }

    /**
     * Resolve the headless Chrome / Chromium binary across environments.
     */
    protected function resolveBrowserBinary(): ?string
    {
        $custom = config('services.pdf.binary_path');
        if ($custom && File::exists($custom)) {
            return $custom;
        }

        $candidates = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
        ];

        foreach ($candidates as $candidate) {
            if (File::exists($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
