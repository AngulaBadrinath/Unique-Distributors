# UJW Master Forensic Audit: HTTP 500 & 400 Root Cause Register

**Document ID:** `UJW_500_400_ROOT_CAUSE_REGISTER.md`  
**Target Repository:** Unique Jersey Wholesale (UJW) / Wholesale Distribution Management System  
**Auditor:** Lead Principal Software Architect & Multi-Agent Forensic Investigation Team  
**Git Baseline:** `cee76b8` (`fix: correct invoice pdf caching and order completion state`)  
**Operating Constraint:** Phase 1 Strictly Audit-Only (Zero Mutations, Read-Only Diagnostics)  
**Status:** Completed & Consolidated

---

## 1. Overview and Taxonomy

This register consolidates every identified root cause behind reported HTTP 500 (Internal Server Error) and HTTP 400/409/422 (Client & Business Logic Error) conditions across all functional domains in the UJW Wholesale Distribution Management System.

Every entry has been forensically verified with code references, reproduction vectors, database schema dependencies, and resolution statuses using the following classifications:
- **`CONFIRMED DEFECT`**: Verified software or schema bug triggering unintended failures.
- **`CONFIRMED RESOLVED`**: Defect historically present, now patched and regression-tested.
- **`CONFIRMED EXPECTED GUARD`**: Intentional RFC 7231 / RFC 7235 HTTP status code enforcing business invariants, concurrency locking, or security boundaries.

---

## 2. Root Cause Register Matrix

| Root Cause ID | Domain / Module | Route / Endpoint | HTTP Code | Status | Root Cause Summary |
|---|---|---|---|---|---|
| **RC-500-01** | Security / RBAC | `DELETE /security/users/{user}` | **500** | **CONFIRMED DEFECT** | `hasHistoricalReferences()` queries non-existent columns (`orders.creator_id`, `customers.created_by`, `deliveries.assigned_by`). PostgreSQL throws `SQLSTATE[42703]`. |
| **RC-500-02** | Security / RBAC | `DELETE /security/users/{user}` | **500** | **CONFIRMED DEFECT** | `hasHistoricalReferences()` omits foreign key checks on secondary operational tables (`order_adjustments`, `inventory_movements`, etc.). Causes `SQLSTATE[23503]`. |
| **RC-500-03** | Payments / Database | `POST /admin/payments/cash` | **500** | **CONFIRMED RESOLVED** | `Payment::lockForUpdate()->sum('amount')` executed row-lock on SQL aggregate. PostgreSQL rejected via `SQLSTATE[0A000]`. Patched in `CHANGE-041`. |
| **RC-500-04** | Invoices / Documents | `GET /invoices/{invoice}/pdf` | **500** | **CONFIRMED RESOLVED** | Missing headless Chromium on Linux host threw `RuntimeException: Generated PDF file is missing`. Patched in `cee76b8` with pure PHP `%PDF-1.4` vector fallback. |
| **RC-500-05** | DevOps / Readiness | `GET /ready` | **503** | **CONFIRMED DEFECT** | S3 readiness check evaluated `! empty(config('filesystems.disks.s3.key'))`, failing EC2 IAM instance profiles. Patched in `c14c95a` but still lacks live network probe. |
| **RC-409-01** | Inertia / Frontend | Multiple Mutation Routes | **Inertia Protocol Error** | **CONFIRMED DEFECT** | Controllers check `if ($request->wantsJson())` without `&& ! $request->header('X-Inertia')`. Returns plain JSON to Inertia modals, causing frontend crashes. |
| **RC-422-01** | Security / RBAC | `DELETE /security/users/{user}` | **422** | **CONFIRMED EXPECTED GUARD** | Deletion payload missing `confirm: true` or providing reason under 10 characters rejected by domain validation. |
| **RC-409-02** | Order Adjustments | `POST /admin/orders/{id}/adjustments/{adj}/approve` | **409** | **CONFIRMED EXPECTED GUARD** | Optimistic locking prevents race conditions when two administrators attempt to review or approve the same adjustment simultaneously. |
| **RC-409-03** | Order Adjustments | `POST /admin/orders/{id}/adjustments/{adj}/apply` | **409** | **CONFIRMED EXPECTED GUARD** | Multi-line quantity reduction rejected if requested reduction encroaches upon warehouse inventory already picked or dispatched. |
| **RC-403-01** | Security / Segregation | `POST /admin/orders/{id}/adjustments/{adj}/approve` | **403** | **CONFIRMED EXPECTED GUARD** | Maker-checker segregation of duties: user cannot approve their own adjustment request unless emergency Super Admin override reason is provided. |
| **RC-403-02** | Security / RBAC | `DELETE /security/users/{user}` | **403** | **CONFIRMED EXPECTED GUARD** | Administrators attempting user deletion rejected because `Permission::USER_DELETE` is restricted to `SUPER_ADMIN`. |
| **RC-404-01** | Security / Anti-IDOR | `/salesman/invoices/{id}`, `/salesman/orders/{id}` | **404** | **CONFIRMED EXPECTED GUARD** | Salesman attempting to access records outside their assigned customer territory receives `404 Not Found` to prevent data enumeration. |

---

## 3. Deep-Dive Forensic Root Cause Descriptions

### RC-500-01: Critical Database Schema Mismatches in User Deletion
- **File:** [`app/Services/Auth/UserLifecycleService.php` (Lines 250–258)](file:///f:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L250-L258)
- **Code:**
  ```php
  protected function hasHistoricalReferences(int $userId): bool
  {
      return Order::query()->where('creator_id', $userId)->orWhere('salesman_id', $userId)->exists()
          || Customer::query()->where('created_by', $userId)->orWhere('salesman_id', $userId)->exists()
          || Payment::query()->where('recorded_by', $userId)->orWhere('verified_by', $userId)->exists()
          || Invoice::query()->where('created_by', $userId)->exists()
          || Delivery::query()->where('driver_id', $userId)->orWhere('assigned_by', $userId)->exists()
          || AuditLog::query()->where('actor_id', $userId)->exists();
  }
  ```
- **Mechanism of Failure:**
  1. `orders` table (migration `2026_09_05_000008`) contains `created_by`, NOT `creator_id`.
  2. `customers` table (migrations `2026_09_04_000005`, `2026_09_04_000006`) contains `salesman_id`, NOT `created_by`.
  3. `deliveries` table (migration `2026_09_06_000008`) contains `driver_id`, `created_by`, `updated_by`, NOT `assigned_by`.
- **Live Diagnostic Execution Against PostgreSQL (Neon DB):**
  ```text
  CAUGHT: SQLSTATE[42703]: Undefined column: 7 ERROR: column "creator_id" does not exist
  LINE 1: select exists(select * from "orders" where "creator_id" = 1)...
  ```
- **Operational Impact:** Every user deletion attempt in production triggers an uncaught `QueryException`, returning HTTP 500.

---

### RC-500-02: Secondary PostgreSQL Foreign Key Violation on User Deletion
- **File:** [`app/Services/Auth/UserLifecycleService.php` (Lines 173–245)](file:///f:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L173-L245)
- **Mechanism of Failure:**
  The `users` table is referenced with `restrictOnDelete()` in 9 additional tables:
  `order_adjustments.requested_by`, `inventory_movements.actor_id`, `stock_exceptions.reported_by`, `inventory_adjustments.actor_id`, `return_requests.created_by`, `credit_notes.issued_by`, `refund_requests.requested_by`, `receivable_transactions.created_by`, `supplier_bills.created_by`.
  Because `hasHistoricalReferences()` does not inspect these tables, if an operational user (e.g. an Accountant or Warehouse Manager) has activity exclusively in these tables, `hasHistoricalReferences()` returns `false` and attempts hard deletion (`$target->delete()`).
- **Operational Impact:** PostgreSQL aborts the transaction with `SQLSTATE[23503]: Foreign key constraint violation`, generating an HTTP 500.

---

### RC-409-01: Inertia Web Request / Plain JSON Response Violations (`CHANGE-040`)
- **Files:**
  - [`app/Http/Controllers/Security/UserLifecycleController.php` (Lines 43, 78)](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/UserLifecycleController.php#L43)
  - [`app/Http/Controllers/Security/RoleAssignmentController.php` (Line 45)](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/RoleAssignmentController.php#L45)
  - [`app/Http/Controllers/Admin/AdminInvoiceController.php` (Line 109)](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminInvoiceController.php#L109)
- **Code:**
  ```php
  // Defective logic:
  if ($request->wantsJson()) {
      return response()->json($result);
  }
  ```
- **Mechanism of Failure:**
  Inertia requests use Axios with `Accept: application/json` and `X-Requested-With: XMLHttpRequest`. Standard Laravel methods `$request->wantsJson()` and `$request->ajax()` evaluate to `true` for these browser requests. When the controller returns a `200/201 JsonResponse`, Inertia halts page navigation and displays a fatal client modal:
  *"All Inertia requests must receive a valid Inertia response, however a plain JSON response was received."*
- **Operational Impact:** When staff attempt to update account status, delete users, change roles, or click "Generate Invoice", the UI crashes with an unhandled JSON response modal.

---

### RC-500-03: PostgreSQL Aggregate Row-Locking Constraint (`SQLSTATE[0A000]`)
- **File:** [`app/Services/Payment/PaymentService.php` (Lines 195–204)](file:///f:/Wholesale%20Distribution%20Management%20System/app/Services/Payment/PaymentService.php#L195-L204)
- **Code Pre-Fix:**
  ```php
  $existingPaymentsTotal = Payment::where('order_id', $order->id)
      ->whereIn('status', [...])
      ->lockForUpdate()
      ->sum('amount'); // Fails in PostgreSQL
  ```
- **Mechanism of Failure:**
  PostgreSQL prohibits `FOR UPDATE` on SQL statements containing aggregation functions (`SUM`, `COUNT`, `AVG`). While silently tolerated in SQLite, it crashes with `SQLSTATE[0A000]` on PostgreSQL.
- **Resolution (`CHANGE-041`, Commit `a90541a`):**
  Patched by fetching individual locked rows (`->lockForUpdate()->get(['id', 'amount'])`) and calculating the sum in PHP using `bcadd`. Forensic audit verified zero remaining instances across the codebase.

---

### RC-500-04: Headless Chromium PDF Missing Binary Exception
- **File:** [`app/Services/Invoices/InvoicePdfService.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Services/Invoices/InvoicePdfService.php)
- **Mechanism of Failure:**
  When generating invoice PDFs on EC2 or Docker environments without Google Chrome installed, the process crashed with `RuntimeException: Generated PDF file is missing`.
- **Resolution (Commit `cee76b8`):**
  Patched by introducing `renderCompliantFallbackPdf()`, generating a vector-compliant `%PDF-1.4` document stream entirely in PHP. Verified with 60/60 passing tests in the `Invoice` test suite.

---

### RC-500-05: S3 Readiness Probe Failure on EC2 IAM Roles
- **File:** [`app/Http/Controllers/Health/ReadyCheckController.php` (Line 66)](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Health/ReadyCheckController.php#L66)
- **Mechanism of Failure:**
  Commit `487873f` updated `deploy-production.sh` to probe `https://uniquejerseywholesale.com/ready`. `ReadyCheckController` checked `! empty(config('filesystems.disks.s3.key'))`. On EC2 with IAM instance profiles, static keys are empty, returning HTTP 503 and aborting deployment.
- **Resolution (Commit `c14c95a`):**
  Patched by evaluating `! empty($bucket)`.
- **Remaining Risk:** It checks only configuration presence, omitting a live AWS S3 network probe.

---

## 4. Remediation Action Plan Summary

| Target ID | Remediation Task | Target Files | Priority |
|---|---|---|---|
| **REM-01** | Fix non-existent columns in `hasHistoricalReferences()` and add all 9 restricted FK tables | `app/Services/Auth/UserLifecycleService.php` | **P0 (Immediate)** |
| **REM-02** | Add `&& ! $request->header('X-Inertia')` to dual-response controllers | `UserLifecycleController.php`, `RoleAssignmentController.php`, `AdminInvoiceController.php` | **P0 (Immediate)** |
| **REM-03** | Align route middleware on user deletion to `permission:user.delete` | `routes/web.php` | **P1 (Security)** |
| **REM-04** | Wire `UserPolicy::delete()` to `USER_DELETE` permission and enforce in controller | `app/Policies/UserPolicy.php`, `UserLifecycleController.php` | **P1 (Security)** |
| **REM-05** | Add live AWS S3 `headBucket` or `has()` probe in `ReadyCheckController` | `app/Http/Controllers/Health/ReadyCheckController.php` | **P1 (DevOps)** |

