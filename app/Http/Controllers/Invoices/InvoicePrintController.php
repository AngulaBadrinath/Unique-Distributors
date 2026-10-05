<?php

namespace App\Http\Controllers\Invoices;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class InvoicePrintController extends Controller
{
    /**
     * Render the clean, dedicated printable HTML invoice document.
     * Enforces permission and salesman resource scoping (Anti-IDOR).
     */
    public function show(int $id, Request $request): View
    {
        /** @var Invoice|null $invoice */
        $invoice = Invoice::query()
            ->with(['items.product', 'order.payments', 'customer', 'creator'])
            ->forUser($request->user())
            ->find($id);

        if (! $invoice) {
            throw new NotFoundHttpException('Invoice not found.');
        }

        Gate::authorize('print', $invoice);

        return view('documents.invoice', [
            'invoice' => $invoice,
            'unbranded' => false,
        ]);
    }
}
