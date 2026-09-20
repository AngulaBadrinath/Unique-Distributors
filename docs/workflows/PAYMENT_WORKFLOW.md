# Payment & Cash Reconciliation Workflow Specification

## 1. Workflow Overview & Purpose
The **Payment & Cash Reconciliation Workflow** manages field cash collections, cheque and money order submissions with cryptographic JPEG evidence validation, backoffice verification, double-entry Accounts Receivable posting, payment reversals (e.g., NSF/bounced cheques), and daily cash drawer reconciliations.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `SALESMAN`, `ACCOUNTANT`, `ADMIN`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/salesman/payments` | `salesman.payments.index` | `SalesmanPaymentController@index` | `auth`, `account.active`, `role:salesman` |
| `POST` | `/salesman/payments` | `salesman.payments.store` | `SalesmanPaymentController@store` | `auth`, `account.active`, `role:salesman` |
| `GET` | `/admin/payments` | `admin.payments.index` | `AdminPaymentController@index` | `auth`, `account.active`, `permission:payment.view` |
| `GET` | `/admin/payments/{payment}` | `admin.payments.show` | `AdminPaymentController@show` | `auth`, `account.active`, `permission:payment.view` |
| `POST` | `/admin/payments/{payment}/verify` | `admin.payments.verify` | `AdminPaymentController@verify` | `auth`, `account.active`, `permission:payment.verify` |
| `POST` | `/admin/payments/{payment}/reject` | `admin.payments.reject` | `AdminPaymentController@reject` | `auth`, `account.active`, `permission:payment.verify` |
| `POST` | `/admin/payments/{payment}/reverse` | `admin.payments.reverse` | `AdminPaymentController@reverse` | `auth`, `account.active`, `permission:payment.reverse` |
| `GET` | `/admin/accounting/cash-reconciliations` | `admin.accounting.cash-reconciliations.index` | `AdminAccountingController@cashReconciliations` | `auth`, `account.active`, `permission:accounting.view` |

### Frontend UI Pages
- Salesman Field Payment Form: `resources/js/Pages/Salesman/Payments/Create.tsx`
- Admin Payment Verification Desk: `resources/js/Pages/Admin/Payments/Index.tsx`
- Payment Detail & Evidence Viewer: `resources/js/Pages/Admin/Payments/Show.tsx`
- Cash Drawer Daily Reconciliation: `resources/js/Pages/Admin/Accounting/CashReconciliations.tsx`

---

## 3. Step-by-Step Execution Sequence

### A. Payment Recording (`PaymentService::recordPaymentInternal`)
1. **Method Validation (RULE-PAY-001):** Supports `CASH`, `CHEQUE`, and `MONEY_ORDER`.
2. **Evidence Validation (RULE-PAY-002 & RULE-SEC-004):**
   - Mandatory for `CHEQUE` and `MONEY_ORDER`.
   - Server inspects magic bytes for JPEG (`\xFF\xD8\xFF`).
   - File stored with cryptographically random key in private storage.
3. **Pessimistic Order & Customer Locking:**
   - Locks target `Order` and `Customer`.
   - Validates that order is not `CANCELLED` or `REJECTED`.
   - Validates that payment amount does not exceed order balance due.
4. **Entity Generation:**
   - Generates sequential payment number (`PAY-YYYY-MM-XXXX`) via `PaymentNumberGenerator`.
   - Stores payment method, amount, reference/cheque number, bank name, cheque date, and evidence paths.
   - Initial status: `SUBMITTED` (for review) or `VERIFIED` (if pre-authorized cash).
5. **Notification Dispatch:** Calls `DomainNotificationDispatcher->notifyPaymentSubmitted($payment)`.

### B. Payment Verification (`PaymentVerificationService::verifyPayment`)
1. **Authorization Gate:** Checks `Permission::PAYMENT_VERIFY`. Salesmen are strictly disallowed.
2. **Deterministic Transaction Locking:**
   `Payment` $\rightarrow$ `Order` $\rightarrow$ `Invoice` $\rightarrow$ `Customer`.
3. **Status Progression:**
   - Sets `Payment` status to `PaymentTransactionStatus::VERIFIED`, `verified_by = $actor->id`, `verified_at = now()`.
4. **Order & Invoice Payment Status Evaluation:**
   - Computes total verified payments against order/invoice grand total:
     - `verified_total == 0` $\rightarrow$ `PaymentStatus::UNPAID`
     - `0 < verified_total < grand_total` $\rightarrow$ `PaymentStatus::PARTIALLY_PAID`
     - `verified_total >= grand_total` $\rightarrow$ `PaymentStatus::PAID`
   - Updates `invoices.balance_due = max(0, grand_total - verified_total)`.
5. **Accounts Receivable Ledger Posting:**
   - Calls `ReceivableLedgerService::recordPaymentPosting($payment)`.
   - Records `ReceivableTransaction` (`type = PAYMENT_RECEIVED`, credit amount).
6. **General Ledger Journal Posting (RULE-ACC-001):**
   - Calls `JournalMappingService::postPaymentReceipt($payment, $actor)`.
   - Balanced Journal Entry:
     - **Debit:** Cash on Hand (`1010`) or Bank Clearing (`1020`)
     - **Credit:** Accounts Receivable (`1100`)
7. **Notification Dispatch:** Calls `DomainNotificationDispatcher->notifyPaymentVerified($payment)`.

### C. Payment Rejection (`PaymentVerificationService::rejectPayment`)
1. **Rejection Reason Required:** Requires `PaymentRejectionReason` (`UNREADABLE_EVIDENCE`, `CHEQUE_MISMATCH`, `SIGNATURE_MISSING`, `INCORRECT_AMOUNT`, `INVALID_ACCOUNT`).
2. **State Transition:** Sets `Payment` status to `REJECTED`, stores rejection reason code and audit notes.
3. **Re-evaluation:** Re-evaluates order and invoice balance due and payment status.

### D. Payment Reversal / Bounced Cheque (`PaymentReversalService::reversePayment`)
1. **Pessimistic Lock:** Locks `Payment`, `Order`, and `Invoice`.
2. **Reversal Reason Required:** Requires `PaymentReversalReason` (`BOUNCED_CHEQUE`, `NSF`, `STOP_PAYMENT`, `DATA_ENTRY_ERROR`, `FRAUDULENT`).
3. **State Transition:** Sets `Payment` status to `REVERSED`.
4. **Balance Restoration:** Restores invoice `balance_due` and order `payment_status`.
5. **Reversing Journal Entry (RULE-ACC-001):**
   - Balanced Journal Entry:
     - **Debit:** Accounts Receivable (`1100`)
     - **Credit:** Cash/Bank Clearing (`1010`/`1020`)

---

## 4. Cash Drawer Daily Reconciliation

```text
[Salesman Daily Cash Collection]
        │
        ├──> [Count Cash on Hand] ──> [Compare against System Verified Payments]
        │                                             │
        └──> [Variance Computed] ────────────────────┘
                    │
                    ├── Zero Variance ──> [Reconciliation Approved]
                    └── Non-Zero Variance ──> [Discrepancy Logged & Over/Short GL Journal]
```

---

## 5. Source Code Traceability Index
- `app/Services/Payment/PaymentService.php`
- `app/Services/Payment/PaymentVerificationService.php`
- `app/Services/Payment/PaymentReversalService.php`
- `app/Services/Payment/PaymentEvidenceService.php`
- `app/Services/Payment/PaymentNumberGenerator.php`
- `app/Services/Accounting/CashReconciliationService.php`
- `app/Http/Controllers/Salesman/SalesmanPaymentController.php`
- `app/Http/Controllers/Admin/AdminPaymentController.php`
- `app/Models/Payment.php`
- `app/Models/CashReconciliation.php`
- `app/Models/CashReconciliationItem.php`
- `app/Policies/PaymentPolicy.php`
