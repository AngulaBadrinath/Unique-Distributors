# Invoice & Commercial Billing Workflow Specification

## 1. Workflow Overview & Purpose
The **Invoice & Commercial Billing Workflow** issues authoritative, legally compliant, and financially immutable commercial invoices. Invoicing captures transactional snapshots, calculates taxes per line item, triggers Accounts Receivable subledger postings, and writes double-entry General Ledger journal entries.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `ACCOUNTANT`, `ADMIN`, `SALESMAN`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/admin/invoices` | `admin.invoices.index` | `AdminInvoiceController@index` | `auth`, `account.active`, `permission:invoice.view` |
| `GET` | `/admin/invoices/{invoice}` | `admin.invoices.show` | `AdminInvoiceController@show` | `auth`, `account.active`, `permission:invoice.view` |
| `GET` | `/salesman/invoices` | `salesman.invoices.index` | `SalesmanInvoiceController@index` | `auth`, `account.active`, `role:salesman` |
| `GET` | `/salesman/invoices/{invoice}` | `salesman.invoices.show` | `SalesmanInvoiceController@show` | `auth`, `account.active`, `role:salesman` |
| `GET` | `/invoices/{invoice}/pdf` | `invoices.pdf` | `InvoicePdfController@download` | `auth`, `account.active`, `permission:invoice.download` |
| `GET` | `/invoices/{invoice}/print` | `invoices.print` | `InvoicePrintController@print` | `auth`, `account.active`, `permission:invoice.print` |

### Frontend UI Pages
- Admin Invoice Ledger: `resources/js/Pages/Admin/Invoices/Index.tsx`
- Admin Invoice Document View: `resources/js/Pages/Admin/Invoices/Show.tsx`
- Salesman Invoice Explorer: `resources/js/Pages/Salesman/Invoices/Index.tsx`

---

## 3. Step-by-Step Execution Sequence

### A. Invoice Generation (`InvoiceGeneratorService::generateForOrder`)
1. **Pessimistic Order Lock:** Locks target `Order` (`lockForUpdate()`).
2. **Idempotency Gate:** Checks `Invoice::where('order_id', $order->id)->first()`. If exists, returns existing invoice cleanly.
3. **State Eligibility Guard:** Asserts order status is in `[SUBMITTED, APPROVED, PROCESSING, COMPLETED]`. Rejects `DRAFT`, `CANCELLED`, `REJECTED`.
4. **Header & Sequence Generation:**
   - Generates sequential invoice number (`INV-YYYY-MM-XXXX`) via `InvoiceNumberGenerator`.
   - Snapshots billing address, contact phone, payment terms (`Net 30`, etc.), and issue date.
5. **Item Line Snapshotting & Document Compliance (RULE-DOC-001):**
   - Iterates through order items.
   - Snapshots: `description`, `sku`, `unit_price`, `quantity`, `tax_profile_id`, `tax_rate`, `taxable_amount`, `tax_amount`, `line_total`.
   - **Document Compliance Rule:** Product catalogue images are NEVER embedded into invoice line items or PDFs. Invoices are pure commercial accounting instruments.
6. **Financial Aggregation:**
   - `subtotal = sum(taxable_amount)`
   - `tax_total = sum(tax_amount)`
   - `grand_total = subtotal + tax_total`
   - `balance_due = grand_total - total_verified_payments`
7. **Accounts Receivable Subledger Integration:**
   - Calls `ReceivableLedgerService::recordInvoicePosting($invoice)`.
   - Creates `ReceivableTransaction` (`type = INVOICE_POSTED`, `debit = grand_total`).
8. **General Ledger Journal Posting (RULE-ACC-001):**
   - Calls `JournalMappingService::postInvoiceIssued($invoice, $actor)`.
   - Generates balanced GL journal entry:
     - **Debit:** Accounts Receivable (`1100`) = `grand_total`
     - **Credit:** Wholesale Sales Revenue (`4010`) = `subtotal`
     - **Credit:** Sales Tax Payable (`2100`) = `tax_total`
     - **Debit:** Sales Discounts (`4020`) = adjustment discounts (if applicable)

### B. PDF & Print Rendering (`InvoicePdfService` & `InvoicePrintController`)
1. Fetches invoice with relationships (`customer`, `items`, `order`).
2. Injects company header details via `CompanyInformationService`.
3. Renders strict financial layout with clear subtotal, tax breakdown, and banking payment instructions.

---

## 4. Invoice State Lifecycle

```text
[ORDER APPROVED] ──> [INVOICE ISSUED] ──> [PARTIALLY PAID] ──> [PAID / RECONCILED]
                            │
                            └──> [ADJUSTED / CREDIT NOTE ISSUED] ──> [VOIDED / ZEROED]
```

---

## 5. Source Code Traceability Index
- `app/Services/Invoices/InvoiceGeneratorService.php`
- `app/Services/Invoices/InvoicePdfService.php`
- `app/Services/Invoices/InvoiceNumberGenerator.php`
- `app/Http/Controllers/Invoices/InvoicePdfController.php`
- `app/Http/Controllers/Invoices/InvoicePrintController.php`
- `app/Http/Controllers/Admin/AdminInvoiceController.php`
- `app/Http/Controllers/Salesman/SalesmanInvoiceController.php`
- `app/Models/Invoice.php`
- `app/Models/InvoiceItem.php`
- `app/Policies/InvoicePolicy.php`
