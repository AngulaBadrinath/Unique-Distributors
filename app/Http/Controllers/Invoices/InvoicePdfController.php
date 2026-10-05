<?php

namespace App\Http\Controllers\Invoices;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Services\Invoices\InvoicePdfService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class InvoicePdfController extends Controller
{
    public function __construct(
        protected InvoicePdfService $pdfService
    ) {}

    /**
     * Stream or download the authoritative server-rendered PDF document.
     * Enforces permission and salesman resource scoping (Anti-IDOR).
     */
    public function download(int $id, Request $request): BinaryFileResponse
    {
        /** @var Invoice|null $invoice */
        $invoice = Invoice::query()
            ->with(['items.product', 'order.payments', 'customer', 'creator'])
            ->forUser($request->user())
            ->find($id);

        if (! $invoice) {
            throw new NotFoundHttpException('Invoice not found.');
        }

        Gate::authorize('download', $invoice);

        $force = $request->boolean('regenerate', false);
        $pdfPath = $this->pdfService->generate($invoice, $force, true);

        $downloadFilename = sprintf('%s.pdf', $invoice->invoice_number);

        return response()->file($pdfPath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('inline; filename="%s"', $downloadFilename),
        ]);
    }
}
