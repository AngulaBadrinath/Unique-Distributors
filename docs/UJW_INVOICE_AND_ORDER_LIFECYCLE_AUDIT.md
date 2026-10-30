# UJW Forensic Audit Report: Invoice and Order Lifecycle Engine

**Audit Scope:** Invoice & Order Lifecycle, Document Generation, PDF Streaming, State Completion Invariants, Database Schema, and HTTP 500/400 Failure Investigation  
**Commit Inspected:** `cee76b8` (*fix: correct invoice pdf caching and order completion state*) and ancestor commits (`5d0a77b`, `29d846e`, `48e8ad2`, `78824c5`, `3126b3e`)  
**Status:** Audit Complete (Strictly Read-Only Phase 1)  
**Confidence Status:** CONFIRMED across all audited modules and failure vectors  

---

## 1. Executive Summary

A forensic code, migration, test suite, and operational log audit was conducted on the **Unique Jersey Wholesale (UJW)** Invoice and Order Lifecycle subsystems. 

Key Findings:
1. **Invoice PDF Generation Resilience (`InvoicePdfService.php`):** The system implements a robust dual-pipeline PDF generator. It attempts headless Chromium first with expanded multi-platform binary paths, but crucially provides a pure PHP vector graphics `%PDF-1.4` raw stream fallback engine that guarantees invoice downloads never fail even if Chromium is completely missing or blocked by container/sandbox constraints.
2. **Layout Versioning & Cache Invalidation:** The PDF engine uses explicit version hashing (`RENDER_VERSION = 'v2'`) combined with branding suffixes (`_branded` vs `_unbranded`). Invalidation occurs automatically on version increments or via explicit forced regeneration (`?regenerate=1`).
3. **Order Completion State Engine (`OrderWorkflowService.php`):** Order completion enforces strict multi-dimensional state invariants (`status = COMPLETED`, `fulfillment_status = DELIVERED`, `payment_status = PAID`, and delivered quantities matching fulfillable quantities). As of commit `cee76b8`, delivered quantity rollups from allocations and self-healing evaluation hooks in both administrative and salesman order show actions prevent orders from becoming stranded in `PROCESSING`.
4. **Architectural Defect in `AdminInvoiceController@generate`:** A defect was confirmed where `AdminInvoiceController@generate` evaluates `$request->wantsJson()` without checking `! $request->header('X-Inertia')`. When called via Inertia web requests, Axios sends `Accept: application/json`, causing the controller to return a `201 Created` JSON response rather than a 302 redirect. Inertia intercepts this as an unexpected response modal rather than navigating to the invoice view.
5. **Double-Barreled Immutability & Financial Precision:** Invoices and invoice items enforce strict financial immutability at both the Eloquent application layer (blocking `delete()` and restricting `update()` to operational settlement fields) and the database layer (PostgreSQL triggers). All monetary amounts and tax totals strictly use arbitrary-precision string math (`bcmath`) and line-level `roundHalfUp`. In strict accordance with **RULE-DOC-001**, zero product images appear on invoices.

---

## 2. Detailed Technical Findings

### 2.1. Invoice PDF Generation Engine (`InvoicePdfService.php`)

**Location:** [`app/Services/Invoices/InvoicePdfService.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Invoices/InvoicePdfService.php#L1-L505)  
**Confidence:** **CONFIRMED**

#### A. Generation & Caching Workflow
1. **File Storage & Cache Keys:**
   - Physical storage path: `storage/app/private/invoices/` (Lines 36–39).
   - Filename key format:
     `{sanitized_invoice_number}_{branding_suffix}_{RENDER_VERSION}.pdf`  
     *Example:* `INV_2026_000001_unbranded_v2.pdf` (Lines 42–47).
   - Relative cache path stored in database: `invoices/{filename}`.
2. **Cache Verification (`isValidPdf`):**
   - The engine validates cached PDFs by reading the first 5 magic bytes (`fread($handle, 5) === '%PDF-'`) and verifying file size >= 10 bytes (Lines 457–472).
   - If `$forceRegenerate === false`, the file exists, and `isValidPdf()` passes, the cached PDF is returned immediately (Lines 51–60).
3. **Explicit Invalidation & Versioning:**
   - Const `RENDER_VERSION = 'v2'` (Line 21). Any layout adjustment incrementing this constant automatically bypasses older cached files without destructive deletion of historical disk files.
   - Forced regeneration is exposed via controller query parameter `$request->boolean('regenerate', false)` passed to `$pdfService->generate($invoice, $force, true)` (Line 38 of `InvoicePdfController`).
4. **Browser Binary Resolution (`resolveBrowserBinary`):**
   - Checks `config('services.pdf.binary_path')` first (Lines 479–482).
   - Candidate discovery scans both Windows and Linux standard paths:
     - `C:\Program Files\Google\Chrome\Application\chrome.exe`
     - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
     - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
     - `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
     - `/usr/bin/google-chrome`
     - `/usr/bin/google-chrome-stable` (Added in `cee76b8`)
     - `/usr/bin/chromium`
     - `/usr/bin/chromium-browser`
     - `/snap/bin/chromium` (Added in `cee76b8`)
5. **Headless Chromium Execution:**
   - Runs: `"{binary}" --headless --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="{pdfPath}" "file://{tempHtmlPath}"` with a 15-second process timeout (Lines 121–131).
6. **Raw Vector PDF Fallback (`renderCompliantFallbackPdf`):**
   - If Chromium is missing or fails to generate a valid PDF, the engine invokes `renderCompliantFallbackPdf()` (Lines 84–86, 142–452).
   - Generates a standard-compliant `%PDF-1.4` document stream entirely in pure PHP:
     - Vector drawing operators: `re B`, `re f`, `re S` (rectangles), `m`, `l`, `S` (lines), `BT ... Tf ... Tj ET` (text blocks).
     - Standard Type1 fonts: `/Helvetica` (F1), `/Helvetica-Bold` (F2), `/Helvetica-Oblique` (F3).
     - Renders complete canonical invoice layout: Bill To / Ship To cards, 7-column info grid, 5-column line items table, remittance box, verified payments list, subtotal, tax, adjustments, grand total, balance due, and footer.
     - Assembles 8 PDF objects with calculated byte offsets in the cross-reference (`xref`) table and trailer (Lines 436–450).
7. **S3 Archival:**
   - Canonical S3 Key: `invoices/{YYYY}/{MM}/{filename}` (Lines 93–95).
   - Wrapped in a non-blocking `try ... catch (\Throwable $e)` block logging `Log::warning('S3 invoice archival deferred: ' . $e->getMessage())` so transient AWS/S3 network issues do not interrupt client downloads (Lines 98–102).

---

### 2.2. Order Lifecycle & Completion State Engine

**Location:** [`app/Services/Order/OrderWorkflowService.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Order/OrderWorkflowService.php#L396-L498)  
**Confidence:** **CONFIRMED**

#### A. Multi-Dimensional Completion Invariants
An order is strictly evaluated for completion against 6 invariant gates:
1. Lifecycle Status: Must be `OrderStatus::APPROVED` or `OrderStatus::PROCESSING` (Lines 403, 431).
2. Payment Status: Must be `PaymentStatus::PAID` (Lines 407, 435).
3. Fulfillment Status: Must be `FulfillmentStatus::DELIVERED` (Lines 411, 439).
4. Delivery Status: Must be `null` or `DeliveryStatus::DELIVERED` (Lines 415, 443).
5. Adjustment Status: Must not be `AdjustmentStatus::REQUESTED` (Lines 419, 447).
6. Line-Level Quantity Delivery: Every order line must satisfy `delivered_quantity >= fulfillableQuantity()` (Lines 457–474).

#### B. Allocation Rollup & Self-Healing Logic (Commit `cee76b8`)
Before verifying item delivered quantities, the engine automatically reconciles `delivered_quantity` from discrete delivery allocations:
```php
$allocDelivered = (int) OrderItemAllocation::where('order_item_id', $item->id)
    ->where('status', AllocationStatus::DELIVERED)
    ->sum('delivered_quantity');

$effectiveDelivered = max((int) $item->delivered_quantity, $allocDelivered);
if ($effectiveDelivered > (int) $item->delivered_quantity) {
    $item->delivered_quantity = $effectiveDelivered;
    $item->save();
}
```
This guarantees that asynchronous delivery confirmations that updated `order_item_allocations` without updating `order_items` are reconciled atomically under row lock.

#### C. Order Completion Triggers
`evaluateAndCompleteOrder()` is triggered at 5 key operational junctures:
1. **Delivery Completion:** `DeliveryWorkflowService::completeDelivery` (Line 425 of [`DeliveryWorkflowService.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Delivery/DeliveryWorkflowService.php#L425)).
2. **Payment Verification:** `PaymentVerificationService::verifyPayment` (Line 93 of [`PaymentVerificationService.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Payment/PaymentVerificationService.php#L93)).
3. **Adjustment Application:** `OrderAdjustmentWorkflowService::applyAdjustment` (Line 950 of [`OrderAdjustmentWorkflowService.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Adjustment/OrderAdjustmentWorkflowService.php#L950)).
4. **Admin Order Detail View (Self-Healing Read Hook):** `AdminOrderController::show` (Lines 388–391 of [`AdminOrderController.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminOrderController.php#L388-L391)).
5. **Salesman Order Detail View (Self-Healing Read Hook):** `SalesmanOrderController::show` (Lines 592–595 of [`SalesmanOrderController.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Salesman/SalesmanOrderController.php#L592-L595)).

---

### 2.3. Invoice Routes & Controllers

**Confidence:** **CONFIRMED**

#### A. Route Definitions ([`routes/web.php`](file:///F:/Wholesale%20Distribution%20Management%20System/routes/web.php#L466-L498))
- `GET /admin/invoices` &rarr; `AdminInvoiceController@index` (`permission:invoice.view`)
- `GET /admin/invoices/{invoice}` &rarr; `AdminInvoiceController@show` (`permission:invoice.view`, `whereNumber('invoice')`)
- `GET /salesman/invoices` &rarr; `SalesmanInvoiceController@index` (`permission:invoice.view`)
- `GET /salesman/invoices/{invoice}` &rarr; `SalesmanInvoiceController@show` (`permission:invoice.view`, `whereNumber('invoice')`)
- `POST /admin/orders/{order}/invoice` &rarr; `AdminInvoiceController@generate` (`permission:order.approve`, `throttle:invoice-pdf`)
- `GET /invoices/{invoice}/print` &rarr; `InvoicePrintController@show` (`permission:invoice.print`, `whereNumber('invoice')`)
- `GET /invoices/{invoice}/pdf` &rarr; `InvoicePdfController@download` (`permission:invoice.download`, `throttle:invoice-pdf`, `whereNumber('invoice')`)

#### B. Controller Evaluation

| Controller | Method | Authorization / Scoping | Response Type | Finding / Risk |
|---|---|---|---|---|
| `AdminInvoiceController` | `generate` | `Gate::authorize('generate', Invoice::class)` | `JsonResponse` / `RedirectResponse` | **DEFECT:** Line 109 checks `if ($request->wantsJson())` without `&& ! $request->header('X-Inertia')`. Inertia requests receive raw 201 JSON instead of redirecting. |
| `AdminInvoiceController` | `show` | `Gate::authorize('view', $invoice)` | `Inertia::render('Admin/Invoices/Show')` | Clean, loads `['items.product', 'order.payments', 'customer', 'creator']`. |
| `SalesmanInvoiceController`| `show` | Anti-IDOR: `Invoice::forUser($user)->find($id)` | `Inertia::render('Admin/Invoices/Show')` | Throws `404 NotFoundHttpException` on unassigned customer invoice. |
| `InvoicePdfController` | `download` | `Invoice::forUser($user)->find($id)` + `Gate::authorize('download', $invoice)` | `BinaryFileResponse` (`Content-Type: application/pdf`) | Validates cache, generates fallback if needed, returns inline PDF download. |
| `InvoicePrintController` | `show` | `Invoice::forUser($user)->find($id)` + `Gate::authorize('print', $invoice)` | `View` (`documents.invoice`, `unbranded => false`) | Full branded HTML view for browser print dialog. |

---

### 2.4. Database Schema, Models & Financial Integrity

**Confidence:** **CONFIRMED**

#### A. Database Schema
- **`invoices` Table:** Defined in [`database/migrations/2026_09_06_000011_create_invoices_and_invoice_items_tables.php`](file:///F:/Wholesale%20Distribution%20Management%20System/database/migrations/2026_09_06_000011_create_invoices_and_invoice_items_tables.php#L21-L81).
  - Primary Key: `id` (bigint)
  - Business Key: `invoice_number` (varchar 50, unique index, generated from PostgreSQL sequence `invoice_number_seq`).
  - Foreign Keys: `order_id` (unique, `restrictOnDelete`), `customer_id` (`restrictOnDelete`), `created_by` (`nullOnDelete`).
  - Snapshot Columns: Customer name, code, contact, email, phone, tax ID; Billing address (line1, line2, city, state, postal_code, country); Shipping address; Company legal entity (legal name, dba name, address, phone, email, tax IDs, footer note).
  - PostgreSQL Constraints: `chk_invoices_subtotal_non_negative`, `chk_invoices_tax_total_non_negative`, `chk_invoices_grand_total_non_negative`, `chk_invoices_amount_paid_non_negative`, `chk_invoices_amount_due_non_negative`.
- **`invoice_items` Table:**
  - Foreign Keys: `invoice_id` (`restrictOnDelete`), `order_item_id` (`restrictOnDelete`), `product_id` (`restrictOnDelete`).
  - Snapshot Columns: `product_name_snapshot`, `sku_snapshot`, `unit_snapshot`, `quantity` (unsigned integer > 0), `unit_price`, `tax_profile_code_snapshot`, `tax_profile_name_snapshot`, `tax_rate_snapshot` (decimal 6,4), `taxable_amount`, `tax_amount`, `line_total`.
  - PostgreSQL Constraints: `chk_invoice_items_quantity_positive`, non-negative checks on unit price, tax rate, taxable amount, tax amount, and line total.

#### B. Immutability Architecture
1. **Application-Layer Immutability ([`Invoice.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Models/Invoice.php#L24-L49), [`InvoiceItem.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Models/InvoiceItem.php#L16-L25)):**
   - In `Invoice::booted()`:
     - `deleting` hook throws `LogicException('Issued invoices are permanent financial records and cannot be deleted.')`.
     - `updating` hook strictly restricts dirty fields to operational payment and cache attributes: `['status', 'amount_paid', 'amount_due', 'payment_status', 'pdf_path', 'pdf_generated_at', 'updated_at']`. Any attempt to alter financial totals or snapshot fields throws a `LogicException`.
   - In `InvoiceItem::booted()`:
     - Both `updating` and `deleting` hooks unconditionally throw `LogicException`.
2. **Database-Layer Immutability ([`2026_09_06_000012_create_invoice_immutability_triggers.php`](file:///F:/Wholesale%20Distribution%20Management%20System/database/migrations/2026_09_06_000012_create_invoice_immutability_triggers.php)):**
   - PostgreSQL trigger `trg_protect_invoices` executes `protect_invoice_immutability()`, preventing `DELETE` and blocking `UPDATE` on `invoice_number`, `order_id`, `customer_id`, `invoice_date`, `due_date`, `currency`, `subtotal`, `tax_total`, `adjustment_total`, `grand_total`, and snapshots.
   - PostgreSQL trigger `trg_protect_invoice_items` executes `protect_invoice_item_immutability()`, completely blocking all `UPDATE` and `DELETE` queries on `invoice_items`.

#### C. Tax Calculations & Financial Precision (`TaxCalculationService.php`)
- **Arbitrary Precision:** All tax calculations in [`app/Services/Tax/TaxCalculationService.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Tax/TaxCalculationService.php#L13-L182) use PHP `bcmath` extension (`bcmul`, `bcdiv`, `bcadd`, `bccomp`) with string decimal scale.
- **Deterministic Rounding:** Uses arbitrary-precision `roundHalfUp($rawTax, 2)` (Lines 75–100) adding `0.005` at scale 3 and cleanly truncating to scale 2, preventing IEEE-754 float drift.
- **Line-by-Line Aggregation:** Order totals are calculated by summing individually rounded line totals (Lines 164–182), eliminating 1-cent invoice rounding discrepancies between line items and header totals.
- **RULE-DOC-001 Enforcement:** Verified that `resources/views/documents/invoice.blade.php` contains **zero** `<img>` tags and renders company branding solely via inline SVG vector geometry. Product images are strictly prohibited and absent from invoice line tables.

---

## 3. Investigation of Reported HTTP 500 / 400 Failures

| # | Failure Scenario | HTTP Code | Root Cause Analysis | Reproduction / Trigger | Status / Resolution |
|---|---|---|---|---|---|
| **1** | **PDF Download Crash** (`/invoices/{id}/pdf`) | **500** | Headless Chromium missing on Linux host/container, or Process timeout/sandbox crash. Service previously threw `RuntimeException: Generated PDF file is missing`. | Triggered when `google-chrome` or `chromium` binary was not present at `/usr/bin/google-chrome`. | **CONFIRMED & FIXED (Commit `cee76b8`):** Implemented `%PDF-1.4` vector fallback `renderCompliantFallbackPdf` + expanded candidate paths. |
| **2** | **PDF Header / Offset Corruption** | **500** | Early fallback prototype generated malformed cross-reference (`xref`) byte offsets for 8 PDF objects, failing PDF viewers with header/parsing errors. | Calling PDF download on systems without Chrome when fallback ran. | **CONFIRMED & FIXED (Commit `cee76b8`):** Exact dynamic offset calculation via `sprintf("%010d 00000 n \n", $offset)`. |
| **3** | **Invoice Generation Inertia vs JSON Desynchronization** | **Unexpected JSON Modal (Client-side 201 unhandled)** | `AdminInvoiceController::generate` checks `if ($request->wantsJson())` without verifying `! $request->header('X-Inertia')`. Inertia requests send `Accept: application/json`, returning a 201 JSON object instead of a 302 redirect to `admin.invoices.show`. | Click "Generate Invoice" from an Inertia web page. | **CONFIRMED DEFECT / RISK:** Needs `if ($request->wantsJson() && ! $request->header('X-Inertia'))`. |
| **4** | **Call to undefined method `Order::invoices()`** | **500** | Historical log error: Code invoked plural `$order->invoices()` instead of singular `$order->invoice()` (`HasOne`). | Legacy order detail or seeding queries invoking `$order->invoices()`. | **CONFIRMED HISTORICAL, VERIFIED RESOLVED:** Audited all controllers and views; singular `invoice()` is consistently used. |
| **5** | **Null Value in `order_item_id` of `invoice_items`** | **500** | Historical log error: `SQLSTATE[23502]: Not null violation on invoice_items.order_item_id` during manual testing. | Creating an `InvoiceItem` without providing `order_item_id`. | **CONFIRMED HISTORICAL, VERIFIED RESOLVED:** `InvoiceGeneratorService::generateForOrder` line 212 explicitly maps `'order_item_id' => $item->id`. |
| **6** | **Invoice Generation Pre-Condition Violations** | **422 / 400** | Attempting to generate an invoice for an ineligible order (`DRAFT`, `CANCELLED`, `REJECTED`, or missing customer). | Submitting `POST /admin/orders/{order}/invoice` on an unapproved or cancelled order. | **CONFIRMED BY DESIGN:** Throws `ValidationException` with precise domain error messages. |
| **7** | **Unauthorized Invoice Access (Anti-IDOR)** | **404 / 403** | Salesman attempting to view/print/download invoice for a customer not in their portfolio; or user missing required permission (`invoice.view`, `invoice.print`, `invoice.download`). | Salesman accessing `/salesman/invoices/{unassigned_id}`. | **CONFIRMED BY DESIGN:** Evaluated fail-closed with HTTP 404 (for Anti-IDOR) and HTTP 403 (for missing permissions). |
| **8** | **Order Stuck in `PROCESSING` after Delivery + Payment** | **State Inconsistency** | Disconnected delivery confirmation and payment verification where allocation delivery did not roll up to order item quantities before evaluation. | Delivery marked DELIVERED, payment VERIFIED, but order status remained PROCESSING. | **CONFIRMED & FIXED (Commit `cee76b8`):** Delivered quantities reconciled from allocations in both `completeDelivery` and `evaluateAndCompleteOrder`; self-healing check added in `show()`. |

---

## 4. Test Suite Execution & Audit Evidence

The following targeted non-destructive test suites were executed in the repository:

1. **Invoice Test Suite (`php artisan test --filter=Invoice`):**
   - **Result:** **PASSED** (60 tests, 60 passed, 325 assertions, duration: 38.8s).
   - Covered suites:
     - `Tests\Feature\Document\InvoiceGenerationTest` (12 tests)
     - `Tests\Feature\Document\InvoicePdfTest` (13 tests)
     - `Tests\Feature\Document\InvoicePrintTest` (9 tests)
     - `Tests\Feature\Document\InvoiceImmutabilityTest` (9 tests)
     - `Tests\Feature\Document\ClientInvoiceRegressionTest` (1 test, verifying exact $1,185.00 reference invoice reconciliation)
     - `Tests\Feature\Operations\InvoiceLifecycleAndPrintTest` (16 tests)
2. **Order Lifecycle End-to-End Suite (`php artisan test tests/Feature/QA/QA003OrderLifecycleE2ETest.php`):**
   - **Result:** **PASSED** (10 tests, 10 passed, 89 assertions, duration: 9.2s).
   - Verified: Draft creation, salesman submission, credit check, admin review/approval, allocation, fulfillment, delivery completion, payment verification, and automated transition to `COMPLETED`.

---

## 5. Architectural Recommendations for Lead Architect

1. **Remediate Inertia Header in `AdminInvoiceController@generate`:**
   In `app/Http/Controllers/Admin/AdminInvoiceController.php` (Line 109), change:
   ```php
   // Current:
   if ($request->wantsJson()) {
   
   // Recommended:
   if ($request->wantsJson() && ! $request->header('X-Inertia')) {
   ```
   This standardizes `AdminInvoiceController` with `AdminPaymentController`, `AdminAuditController`, and `SalesmanOrderController`, preventing client-side Inertia modal errors when staff click "Generate Invoice".

2. **Null-Safety Guard in `resources/views/documents/invoice.blade.php`:**
   In line 688 of `invoice.blade.php`, change:
   ```php
   // Current:
   {{ $payment->payment_method->label() }}
   
   // Recommended:
   {{ $payment->payment_method?->label() ?? 'Payment' }}
   ```
   This mirrors the defensive pattern already used in `InvoicePdfService.php` (Line 374).

---

*Forensic Audit Completed in accordance with Operating Constraint: PHASE 1 IS STRICTLY AUDIT-ONLY. No code, migrations, or database records were modified.*
