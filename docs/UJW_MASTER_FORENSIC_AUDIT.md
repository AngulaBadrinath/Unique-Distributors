# UJW Master Forensic Audit: Git History Recovery, Production Regressions, Architecture & Security

**Project:** Unique Jersey Wholesale (UJW) / Wholesale Distribution Management System  
**Auditor:** Principal Software Architect, Senior Laravel/React/PostgreSQL Engineer, AWS DevOps Lead, Security Lead  
**Operating Constraint:** Phase 1 Strictly Audit-Only (Zero Code/Data/Infrastructure Mutations)  
**Git Baseline SHA:** `cee76b8f7f389fb60b15ab40c47125dff7b727d8`  
**Git Commit Date:** Tue Oct 6 10:13:17 2026 +0530  
**Technology Stack:** Laravel 13, PHP 8.4-FPM / 8.5, Inertia.js, React 19, TypeScript, PostgreSQL 17, Tailwind CSS, AWS (EC2, SSM, S3, OIDC), Playwright  
**Target Environment:** AWS EC2 Production Instance (`i-04b5a0903d590e029`, Account `122979784839`), Neon Serverless PostgreSQL  
**Audit Status:** Completed & Fully Consolidated

---

## 1. Executive Summary & Forensic Audit Mandate

A master forensic investigation of the Unique Jersey Wholesale (UJW) production application was executed. The audit spanned Git version control history, application source code, database migrations and triggers, transactional isolation boundaries, RBAC authorization matrices, AWS production deployment infrastructure, CI/CD automation pipelines, and cross-role visual presentation layers.

### Forensic Investigation Verdicts:
1. **Git Baseline Integrity (`CONFIRMED`):** Local `main` is clean and synchronized with `origin/main` at commit `cee76b8`. A total of 288 commits have been authored across 6 distinct implementation waves. Branch `origin/develop` lags 16 commits behind `main`. Zero `git revert` commits exist across history; all rollbacks use forward-correcting domain adjustments in compliance with `RULE-DOM-001` and `RULE-ACC-001`.
2. **Super Admin Account Deletion HTTP 500 (`CONFIRMED DEFECT`):** The production 500 error on user deletion is caused by non-existent column queries in `UserLifecycleService::hasHistoricalReferences()` (`orders.creator_id`, `customers.created_by`, `deliveries.assigned_by`). PostgreSQL rejects the query immediately with `SQLSTATE[42703]: Undefined column: 7 ERROR: column "creator_id" does not exist`. Furthermore, 9 secondary tables with `restrictOnDelete` foreign keys are omitted, triggering `SQLSTATE[23503]` on hard delete.
3. **Inertia Modal Protocol Crash (`CONFIRMED DEFECT`):** Controllers in `UserLifecycleController`, `RoleAssignmentController`, and `AdminInvoiceController` check `if ($request->wantsJson())` without verifying `! $request->header('X-Inertia')`. When web requests are submitted via Inertia Axios mutations, the server responds with a 200/201 JSON payload instead of an HTTP 302 redirect, crashing the frontend modal with an unexpected response error.
4. **Order Adjustment Framework & PostgreSQL Locking (`CONFIRMED RESOLVED`):** The historical HTTP 500 error on `POST /admin/payments/cash` was caused by `Payment::lockForUpdate()->sum('amount')`, which executed `FOR UPDATE` on an SQL aggregate function (`SQLSTATE[0A000]`). This was permanently resolved in `CHANGE-041` (commit `a90541a`). The 5-level pessimistic locking hierarchy (`orders` $\to$ `order_items` $\to$ `order_item_allocations` $\to$ `order_adjustments` $\to$ `inventory_balances`) is intact.
5. **Invoice PDF Generation & Order Completion (`CONFIRMED RESOLVED`):** Commit `cee76b8` introduced a pure PHP vector graphics `%PDF-1.4` raw stream fallback engine (`renderCompliantFallbackPdf`) in `InvoicePdfService.php` that prevents PDF download crashes when Chromium is absent. In `OrderWorkflowService.php`, delivered quantity rollups from discrete allocations and self-healing evaluation hooks in `show()` resolve the condition where delivered orders were previously stranded in `PROCESSING`. **RULE-DOC-001 is strictly honored**: zero product images appear on invoices.
6. **Product Images Container Defect (`CONFIRMED DEFECT`):** In `ProductOrderCard.tsx`, the container uses `aspect-[16/10]` with `object-cover`. Because wholesale packaging is tall and portrait-oriented (0.56:1), the browser zooms in 2.85x, clipping 65% of the product box and cutting off logos, flavor names, nicotine warnings, and screen displays. Furthermore, product images are missing from Cart, Order Review, Admin Show, Warehouse Fulfillment, and Delivery Driver portals.
7. **CI/CD Quality Gate & AWS S3 Readiness (`CONFIRMED DEFECT`):** In commit `8c9e39c`, production deployment was decoupled from the CI quality gate, allowing code to deploy to EC2 before CI suites finish. In `ReadyCheckController.php`, commit `c14c95a` replaced static S3 key checks with `! empty($bucket)` to permit IAM role authentication, but omitted any live S3 bucket network probe.

---

## 2. Specialized Forensic Sub-Audits Reference Matrix

The master investigation is supported by 6 specialized forensic sub-audits authored by autonomous read-only specialists:

| Subsystem Audit Document | Primary Scope | Auditor Specialist | Status |
|---|---|---|---|
| [`docs/UJW_GIT_HISTORY_AND_REGRESSION_AUDIT.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_GIT_HISTORY_AND_REGRESSION_AUDIT.md) | Commit `cee76b8`, 288-commit history, PR #1, `ReadyCheckController` evolution (`487873f` vs `c14c95a`), OIDC deployment history | Git History & Architecture Specialist | **CONFIRMED** |
| [`docs/UJW_INVOICE_AND_ORDER_LIFECYCLE_AUDIT.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_INVOICE_AND_ORDER_LIFECYCLE_AUDIT.md) | `InvoicePdfService`, vector `%PDF-1.4` fallback, order completion invariants, allocation rollups, `AdminInvoiceController` | Laravel Backend Specialist | **CONFIRMED** |
| [`docs/UJW_RBAC_ACCOUNT_MANAGEMENT_AUDIT.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_RBAC_ACCOUNT_MANAGEMENT_AUDIT.md) | Super Admin deletion, dual-mode retirement, schema mismatches, route middleware vs service gates, MFA first-login gate | Security & RBAC Specialist | **CONFIRMED** |
| [`docs/UJW_AWS_PRODUCTION_CICD_AUDIT.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_AWS_PRODUCTION_CICD_AUDIT.md) | GitHub Actions OIDC, SSM RunShellScript, EC2 deployment script, CI test suite decoupling, S3 readiness check | AWS & DevOps Specialist | **CONFIRMED** |
| [`docs/UJW_PRODUCT_IMAGE_CROSS_ROLE_AUDIT.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_PRODUCT_IMAGE_CROSS_ROLE_AUDIT.md) | Product image S3 architecture, presigned URLs, Reference A mobile layout, Reference B container cropping, cross-role visibility | React & QA Specialist | **CONFIRMED** |
| [`docs/UJW_500_400_ROOT_CAUSE_REGISTER.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_500_400_ROOT_CAUSE_REGISTER.md) | Complete taxonomy of HTTP 500, 503, 409, 422, 403, and 404 conditions across all application controllers | Forensic Quality Assurance Lead | **CONFIRMED** |

---

## 3. Comprehensive Domain Analysis

### 3.1. Git History & Baseline Reconstruction
- **Current Baseline:** Commit `cee76b8f7f389fb60b15ab40c47125dff7b727d8` on branch `main`.
- **Working Tree:** Completely clean (`nothing to commit, working tree clean`).
- **Synchronization:** Up to date with `origin/main`. Branch `origin/develop` is at `0550d90`, 16 commits behind `main`.
- **Six Changed Files in `cee76b8`:**
  1. `AdminOrderController.php`: Added auto-evaluation hook in `show()` ensuring orders with delivered allocations and verified payments complete automatically upon inspection.
  2. `SalesmanOrderController.php`: Added mirror auto-evaluation hook in salesman `show()`.
  3. `DeliveryWorkflowService.php`: Reconciled line-level delivered quantities from `OrderItemAllocation` where status is `DELIVERED`.
  4. `InvoicePdfService.php`: Upgraded to layout version `v2`, added `%PDF-1.4` raw stream fallback generator, and wrapped S3 archival in non-blocking try/catch.
  5. `OrderWorkflowService.php`: Synchronized allocation rollups into `evaluateAndCompleteOrder()` under row locks.
  6. `deploy-production.sh`: Added `sudo systemctl reload php8.4-fpm` to flush OPcache upon code checkout.
- **Historical Relationship of `487873f` and `c14c95a`:**
  - `487873f` (07:43:59): Switched deployment readiness probe to `https://uniquejerseywholesale.com/ready`. Because `ReadyCheckController` checked for static AWS credentials in `config('filesystems.disks.s3.key')`, EC2 IAM role authentication failed, returning HTTP 503 and breaking deployment.
  - `c14c95a` (07:55:35): Patched `ReadyCheckController.php` to verify `! empty($bucket)`, allowing deployments to succeed using EC2 Instance Profile credentials.

### 3.2. Order Adjustment Framework & PostgreSQL Invariants
- **Schema & Migrations:** Migration `2026_09_24_000001` (committed as `5d0a77b` on Oct 6, 2026) added quantity increase support (`order_items.increased_quantity`, `order_adjustments.projected_*_addition`, `order_adjustment_items.action_type`).
- **Quantity Conservation Invariants:**
  - `RULE-DOM-001` & `RULE-ALLOC-001`: Original `ordered_quantity` is immutable.
  - `RULE-ALLOC-002`: $\text{fulfillable\_quantity} = \max(0, (\text{ordered\_quantity} + \text{increased\_quantity}) - \text{cancelled\_quantity})$.
  - `RULE-ALLOC-003`: Headroom tracking cleanly segregates unallocated cancellations (Case A) from active warehouse allocation encroachments (Case B).
- **Concurrency & Deadlock Prevention:** Deterministic 5-level pessimistic row-locking sequence inside `DB::transaction(..., 3)`.
- **PostgreSQL Aggregate Constraint:** Audited all database queries; zero illegal aggregate `lockForUpdate()->sum()` queries remain in the codebase.

### 3.3. Invoice Engine & Financial Immutability
- **PDF Generation Resilience:** Headless Chromium binary path discovery covers both Windows and Linux paths. If Chromium is absent or fails, the pure PHP vector fallback engine produces an identical `%PDF-1.4` document stream with exact cross-reference byte offsets.
- **Financial Precision:** All financial calculations strictly utilize PHP `bcmath` string arithmetic with line-item `roundHalfUp`.
- **Double-Barreled Immutability:** Application-layer Eloquent `booted()` hooks prevent invoice deletion and restrict updates to operational settlement fields. PostgreSQL triggers `trg_protect_invoices` and `trg_protect_invoice_items` strictly prevent unauthorized updates or deletions at the kernel level.
- **RULE-DOC-001:** Verified that `invoice.blade.php` contains **zero `<img>` tags**, utilizing pure inline SVG geometry for corporate branding.

### 3.4. Security, RBAC & Account Lifecycle Architecture
- **Dual-Mode Account Deletion:**
  - When historical records exist, executes **Anonymized Retirement**: sets status to `DISABLED`, scrambles password to 40-character random hash, purges MFA and session tokens, preserves attribution ID, and logs `USER_DELETED_ANONYMIZED`.
  - When zero historical records exist, executes **Hard Deletion**: removes row from `users` table and logs `USER_HARD_DELETED`.
- **Root Cause of Deletion HTTP 500:**
  In `UserLifecycleService::hasHistoricalReferences()`:
  - `Order::where('creator_id', ...)` $\to$ column does not exist (`created_by`).
  - `Customer::where('created_by', ...)` $\to$ column does not exist.
  - `Delivery::where('assigned_by', ...)` $\to$ column does not exist (`driver_id`, `created_by`, `updated_by`).
  PostgreSQL aborts with `SQLSTATE[42703]: Undefined column: 7`.
- **Missing Foreign Key Inspections:** `hasHistoricalReferences()` fails to check 9 tables with `restrictOnDelete` foreign keys (`order_adjustments`, `inventory_movements`, `stock_exceptions`, `inventory_adjustments`, `credit_notes`, `refund_requests`, `receivable_transactions`, `supplier_bills`, `supplier_payments`), risking `SQLSTATE[23503]` on hard deletion.
- **ADMIN vs SUPER_ADMIN Permissions:** Canonical permissions total 56. `UserRole::ADMIN` has 50 permissions and does **NOT** possess `Permission::USER_DELETE`. Only `SUPER_ADMIN` has user deletion authority.
- **MFA Enforcement:** `auth:provision-client-admin` is safe and idempotent. All privileged roles (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`) are gated on first login by `MfaPolicy` and `LoginRequest`, mandating TOTP enrollment before dashboard access.

### 3.5. AWS Production Deployment & CI/CD Pipelines
- **Deployment Architecture:** GitHub Actions utilizes OIDC (`aws-actions/configure-aws-credentials@v6`) assuming IAM role `arn:aws:iam::122979784839:role/GitHubActions-UJW-Production-Deploy` and targeting EC2 `i-04b5a0903d590e029` via AWS SSM `AWS-RunShellScript`.
- **SSM Parameter Safety:** Deployment commands are passed via temporary JSON files (`--parameters "file://${PARAMS_FILE}"`) to avoid quoting failures.
- **OPcache & Worker Lifecycle:** `deploy-production.sh` executes `sudo systemctl reload php8.4-fpm`, flushing OPcache and restarting worker processes on release.
- **CI/CD Quality Gate Disconnect:** In commit `8c9e39c`, production deployment was decoupled into a standalone workflow triggered on `push: branches: [main]`, bypassing CI test verification. Furthermore, `ci.yml` runs only 29 test files, leaving 175 test files (~1,615 tests) unexecuted in CI.

### 3.6. React Frontend, Product Images & Playwright QA
- **S3 Image Architecture:** Presigned GET URLs with 15-minute TTL generated by `ProductImageService` on private S3 disk. Authoritative binary inspection validates JPEG/PNG/WebP and rejects SVG/XML to prevent Stored XSS.
- **Aspect Ratio & Container Defect (Reference B):** In `ProductOrderCard.tsx`, the `aspect-[16/10]` container combined with `object-cover` zooms in 2.85x, clipping 65% of portrait packaging. Replacing with `aspect-square object-contain p-3` ensures 100% packaging visibility.
- **Reference A Mobile Analysis:** Reference A (`kriaanj.com`) demonstrates an ultra-dense tabular row layout (`Image` | `Flavor + UPC` | `Price/Login` | `Quantity Stepper`) displaying 6–8 products per screenfold with zero cropping.
- **Cross-Role Image Gaps:** Product images are absent from Cart, Order Review, Admin Show, Warehouse Picking/Packing, and Delivery Handover. Eager loading `primaryImage` in operational controllers eliminates mispicks and fulfillment errors.

---

## 4. Test Execution & Evidence Verification Matrix

All diagnostic executions were conducted under strictly non-destructive read-only constraints:

```
========================================================================================
EVIDENCE VERIFICATION MATRIX
========================================================================================
Test Suite / Diagnostic Target           Result            Assertions  Duration  Status
----------------------------------------------------------------------------------------
Adjustment Domain Tests                  152/152 Passed    1,044       219.3s    CONFIRMED
Invoice Domain Tests                     60/60 Passed      325         38.8s     CONFIRMED
Order Lifecycle E2E Tests                10/10 Passed      89          9.2s      CONFIRMED
Prompt2 Targeted Remediation Test        9/9 Passed        47          11.1s     CONFIRMED
Product Image Backend Tests              24/24 Passed      76          18.4s     CONFIRMED
RBAC Authorization Tests                 12/12 Passed      66          25.3s     CONFIRMED
Inventory Concurrency Tests              7/7 Passed        61          8.1s      CONFIRMED
Order Balance Payment Tests              11/11 Passed      42          6.5s      CONFIRMED
Live PostgreSQL Column Diagnostic        SQLSTATE[42703]   N/A         N/A       CONFIRMED
Live PostgreSQL Assigned_by Diagnostic   SQLSTATE[42703]   N/A         N/A       CONFIRMED
========================================================================================
```

---

## 5. Architectural Assurance & Phase Gate Certification

Phase 1 Forensic Audit is formally complete. The system exhibits high underlying architectural discipline, strict database constraints, robust arbitrary-precision financial math, and strong multi-tenant scoping. The defects identified are isolated, deterministic, and fully documented in [`docs/UJW_500_400_ROOT_CAUSE_REGISTER.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_500_400_ROOT_CAUSE_REGISTER.md).

No further investigation is required. The system is ready for Phase 2 Implementation Planning.

