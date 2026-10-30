# UJW Master Implementation Plan: Phase 2 Execution Roadmap

**Document ID:** `UJW_MASTER_IMPLEMENTATION_PLAN.md`  
**Project:** Unique Jersey Wholesale (UJW) / Wholesale Distribution Management System  
**Prepared By:** Principal Software Architect, Senior Laravel/React Engineer, DevOps & QA Lead  
**Operating Context:** Transition from Phase 1 Audit to Phase 2 Implementation (Pending User Authorization)  
**Target Git Branch:** `feature/ujw-master-remediation-20261030` branched from `main` (`cee76b8`)  
**Technology Stack:** Laravel 13, PHP 8.4/8.5, Inertia.js, React 19, TypeScript, PostgreSQL 17, AWS, Playwright  
**Status:** Ready for Execution (Awaiting User "Proceed" Command for GOD PROMPT 2)

---

## 1. Implementation Philosophy & Operating Directives

Phase 2 will transition the project from read-only audit to verified, surgical implementation. All changes must adhere strictly to the **Repository AI Engineering Constitution ([`AGENTS.md`](file:///f:/Wholesale%20Distribution%20Management%20System/AGENTS.md))**:

1. **Zero Unrelated Refactoring:** Every modified line must map directly to an identified defect in [`docs/UJW_500_400_ROOT_CAUSE_REGISTER.md`](file:///f:/Wholesale%20Distribution%20Management%20System/docs/UJW_500_400_ROOT_CAUSE_REGISTER.md).
2. **Hard Business Invariants Enforcement:**
   - `RULE-DOM-001` & `RULE-ALLOC-001`: Original `ordered_quantity` is immutable.
   - `RULE-DOC-001`: **Product images must NEVER appear on invoices.**
   - `RULE-SEC-001` & `RULE-SEC-002`: Zero client trust; full authorization and calculations enforced server-side.
   - `CHANGE-040`: Dual-response controllers must check `if ($request->wantsJson() && ! $request->header('X-Inertia'))`.
   - `CHANGE-041`: Never execute `FOR UPDATE` on SQL aggregate queries under PostgreSQL.
3. **Search-Before-Create:** Reuse existing services (`SessionRevocationService`, `ResourceScopeService`, `ProductImageService`, `TaxCalculationService`) rather than inventing ad-hoc abstractions.
4. **Comprehensive Automated Verification:** Every remediation workstream must include automated tests that pass in both SQLite (local CI) and live PostgreSQL environments.

---

## 2. Workstream Breakdown & Phased Execution Sequencing

```
+---------------------------------------------------------------------------------------+
| PHASE 2 REMEDIATION SEQUENCE                                                          |
+---------------------------------------------------------------------------------------+
| Step 1: Workstream 1 (P0) - Super Admin Deletion Schema & Inertia Dual-Response Fixes |
| Step 2: Workstream 2 (P0) - Invoice Controller Inertia Protocol & Blade Null Safety  |
| Step 3: Workstream 3 (P1) - Product Images Container Sizing & Cross-Role Visibility   |
| Step 4: Workstream 4 (P1) - AWS S3 Live Readiness Probe & CI/CD Gate Re-coupling     |
| Step 5: Verification & Quality Assurance Gate (Automated Tests + Playwright)         |
+---------------------------------------------------------------------------------------+
```

---

### Workstream 1: Super Admin User Lifecycle & PostgreSQL Schema Remediation (P0)

#### Objectives:
Eliminate the HTTP 500 error on user deletion, prevent foreign key constraint crashes on secondary tables, and eliminate the Inertia modal crash on status/role mutations.

#### Target Files & Remediation Blueprint:
1. **[`app/Services/Auth/UserLifecycleService.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L250-L270):**
   - In `hasHistoricalReferences(int $userId)`:
     - Replace `Order::where('creator_id', $userId)` with `Order::where('created_by', $userId)`.
     - Remove `Customer::where('created_by', $userId)` (customers only has `salesman_id`).
     - Replace `Delivery::where('assigned_by', $userId)` with `Delivery::where('created_by', $userId)->orWhere('updated_by', $userId)`.
     - Add existence checks for all 9 secondary tables with `restrictOnDelete` foreign keys:
       - `OrderAdjustment::where('requested_by', $userId)->orWhere('reviewed_by', $userId)->exists()`
       - `InventoryMovement::where('actor_id', $userId)->exists()`
       - `StockException::where('reported_by', $userId)->orWhere('resolved_by', $userId)->exists()`
       - `InventoryAdjustment::where('actor_id', $userId)->exists()`
       - `ReturnRequest::where('created_by', $userId)->orWhere('reviewed_by', $userId)->exists()`
       - `CreditNote::where('issued_by', $userId)->exists()`
       - `RefundRequest::where('requested_by', $userId)->orWhere('processed_by', $userId)->exists()`
       - `ReceivableTransaction::where('created_by', $userId)->exists()`
       - `SupplierBill::where('created_by', $userId)->exists()`
   - Refactor `revokeUserSessions(int $userId)` to inject `SessionRevocationService::revokeAllSessions()`.
2. **[`app/Http/Controllers/Security/UserLifecycleController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/UserLifecycleController.php#L43, #L78):**
   - In `updateStatus` (line 43) and `destroy` (line 78), replace:
     ```php
     if ($request->wantsJson())
     ```
     with:
     ```php
     if ($request->wantsJson() && ! $request->header('X-Inertia'))
     ```
3. **[`app/Http/Controllers/Security/RoleAssignmentController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/RoleAssignmentController.php#L45):**
   - In `update` (line 45), replace `if ($request->wantsJson())` with `if ($request->wantsJson() && ! $request->header('X-Inertia'))`.
4. **[`routes/web.php`](file:///f:/Wholesale%20Distribution%20Management%20System/routes/web.php#L95-L104):**
   - Align route-level middleware:
     - Protect `DELETE /security/users/{user}` with `permission:user.delete`.
     - Protect `PUT /security/users/{user}/status` with `permission:user.suspend,user.update`.
5. **[`app/Policies/UserPolicy.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Policies/UserPolicy.php#L68-L71):**
   - Update `delete(User $user, User $target)`:
     ```php
     public function delete(User $user, User $target): bool
     {
         return $this->permissionService->has($user, Permission::USER_DELETE);
     }
     ```
   - In `UserLifecycleController@destroy`, invoke `$this->authorize('delete', $user)`.

---

### Workstream 2: Invoice Controller Inertia Protocol & Blade Template Safety (P0)

#### Objectives:
Eliminate the client modal crash when staff click "Generate Invoice", and prevent any potential null reference exceptions on invoice templates.

#### Target Files & Remediation Blueprint:
1. **[`app/Http/Controllers/Admin/AdminInvoiceController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminInvoiceController.php#L109):**
   - In `generate()` (line 109), change:
     ```php
     if ($request->wantsJson()) {
     ```
     to:
     ```php
     if ($request->wantsJson() && ! $request->header('X-Inertia')) {
     ```
   - Standardizes response branching: API requests receive 201 JSON; browser Inertia clicks receive an HTTP 302 redirect to `route('admin.invoices.show', $invoice)`.
2. **[`resources/views/documents/invoice.blade.php`](file:///f:/Wholesale%20Distribution%20Management%20System/resources/views/documents/invoice.blade.php#L688):**
   - Change line 688 to:
     ```php
     {{ $payment->payment_method?->label() ?? 'Payment' }}
     ```
   - Defensive null-safe property access matching `InvoicePdfService.php:374`.
3. **Verify RULE-DOC-001 Invariant:**
   - Confirm zero `<img>` tags on invoice items table in both Blade template and PDF generator.

---

### Workstream 3: Product Image Sizing, Reference A Layout & Cross-Role Visibility (P1)

#### Objectives:
Eliminate the 65% image clipping on wholesale product cards, provide an ultra-dense mobile list view mirroring Reference A, and make product images visible to warehouse pickers and delivery drivers to eliminate operational mispicks.

#### Target Files & Remediation Blueprint:
1. **[`resources/js/Components/Salesman/ProductOrderCard.tsx`](file:///f:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/ProductOrderCard.tsx#L107-L125):**
   - Change image container from `aspect-[16/10]` to `aspect-square bg-muted/20 p-2.5 flex items-center justify-center`.
   - Change `img` class from `object-cover w-full h-full` to `object-contain max-h-full max-w-full drop-shadow-sm`.
   - Add UPC display below SKU:
     ```tsx
     <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
         <span>SKU: {product.sku}</span>
         {product.barcode && <span>• UPC: {product.barcode}</span>}
     </div>
     ```
2. **Reference A Mobile Catalog View Mode:**
   - In `resources/js/Components/Salesman/ProductOrderCard.tsx` or a new component `resources/js/Components/Salesman/MobileProductRow.tsx`:
     - Render compact 4-column row for mobile (<640px):
       - Column 1: `w-12 h-12 object-contain p-1 rounded-md border bg-white`
       - Column 2: Product Name (bold) + `UPC: {product.barcode || product.sku}`
       - Column 3: Price / Wholesale Tier
       - Column 4: Compact Quantity Stepper (`[-] qty [+]`)
3. **TypeScript Types ([`resources/js/types/order.ts`](file:///f:/Wholesale%20Distribution%20Management%20System/resources/js/types/order.ts#L59-L88)):**
   - Add `barcode?: string | null;` and `barcode_type?: string | null;` to `CatalogProduct`.
4. **Order Cart & Review Thumbnails:**
   - In [`resources/js/Components/Salesman/CartDrawer.tsx`](file:///f:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/CartDrawer.tsx): Add `w-10 h-10 object-contain rounded border p-0.5 bg-white` thumbnail next to each cart item.
   - In [`resources/js/Components/Salesman/OrderReviewLineCard.tsx`](file:///f:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/OrderReviewLineCard.tsx) and [`OrderReviewStep.tsx`](file:///f:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/OrderReviewStep.tsx): Add compact image thumbnail column.
5. **Cross-Role Backend Controllers (Serialize Images):**
   - In [`app/Http/Controllers/Admin/AdminOrderController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminOrderController.php): Eager load `items.product.primaryImage` in `show()` and `review()`.
   - In [`app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php): Eager load `items.product.primaryImage` in `show()` so warehouse pickers visually verify items during allocation.
   - In [`app/Http/Controllers/Delivery/DeliveryPartnerController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Delivery/DeliveryPartnerController.php): Eager load `items.product.primaryImage` in `show()` so drivers inspect items at customer drop-off.

---

### Workstream 4: AWS Production Health Probes & CI/CD Quality Gate (P1)

#### Objectives:
Prevent silent S3 credential failures on EC2, restore the CI automated test gate before production deployment, and fix stale permission test assertions.

#### Target Files & Remediation Blueprint:
1. **[`app/Http/Controllers/Health/ReadyCheckController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Health/ReadyCheckController.php#L66-L85):**
   - Upgrade S3 storage health check to perform an actual non-destructive probe:
     ```php
     try {
         Storage::disk('s3')->has('_healthcheck');
         $checks['storage'] = ['status' => 'healthy', 'driver' => 's3'];
     } catch (\Throwable $e) {
         $checks['storage'] = ['status' => 'degraded', 'error' => $e->getMessage()];
         $isReady = false;
     }
     ```
   - Guarantees that if EC2 instance profile tokens expire or bucket permissions are detached, `/ready` reports HTTP 503 and deployment safely halts.
2. **[`.github/workflows/deploy-production.yml`](file:///f:/Wholesale%20Distribution%20Management%20System/.github/workflows/deploy-production.yml):**
   - Re-couple deployment to CI by adding `needs: [test]` or executing the domain test suite prior to triggering SSM execution on EC2.
3. **[`tests/Feature/Auth/PermissionRegistryTest.php`](file:///f:/Wholesale%20Distribution%20Management%20System/tests/Feature/Auth/PermissionRegistryTest.php):**
   - Update expected canonical permission count from 55 to 56 (reflecting `USER_DELETE`).
   - Update expected salesman permission count from 14 to 15 (reflecting `CUSTOMER_CREATE` and `INVOICE_DOWNLOAD`).

---

## 3. Comprehensive File Modification Manifest

| Workstream | File Path | Target Lines | Planned Modification Summary |
|---|---|---|---|
| **WS-1** | `app/Services/Auth/UserLifecycleService.php` | 250–270 | Correct `creator_id` $\to$ `created_by`, remove `customers.created_by`, fix `deliveries.assigned_by`, add all 9 foreign key tables. Inject `SessionRevocationService`. |
| **WS-1** | `app/Http/Controllers/Security/UserLifecycleController.php` | 43, 78 | Add `&& ! $request->header('X-Inertia')` to `updateStatus` and `destroy`. |
| **WS-1** | `app/Http/Controllers/Security/RoleAssignmentController.php` | 45 | Add `&& ! $request->header('X-Inertia')` to `update`. |
| **WS-1** | `routes/web.php` | 95–104 | Protect `users.destroy` with `permission:user.delete`. |
| **WS-1** | `app/Policies/UserPolicy.php` | 68–71 | Wire `delete()` to `Permission::USER_DELETE`. |
| **WS-2** | `app/Http/Controllers/Admin/AdminInvoiceController.php` | 109 | Add `&& ! $request->header('X-Inertia')` to `generate()`. |
| **WS-2** | `resources/views/documents/invoice.blade.php` | 688 | Null-safe `payment_method?->label() ?? 'Payment'`. |
| **WS-3** | `resources/js/Components/Salesman/ProductOrderCard.tsx` | 107–125 | Change `aspect-[16/10]` to `aspect-square`, `object-cover` $\to$ `object-contain`. Display barcode/UPC. |
| **WS-3** | `resources/js/types/order.ts` | 59–88 | Add `barcode` and `barcode_type` to `CatalogProduct`. |
| **WS-3** | `resources/js/Components/Salesman/CartDrawer.tsx` | 70–115 | Add `w-10 h-10 object-contain` product thumbnail. |
| **WS-3** | `resources/js/Components/Salesman/OrderReviewLineCard.tsx` | 23–55 | Add product image thumbnail. |
| **WS-3** | `app/Http/Controllers/Admin/AdminOrderController.php` | 382, 712 | Eager load `items.product.primaryImage` in `show()` and `review()`. |
| **WS-3** | `app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php` | 101–124 | Eager load `items.product.primaryImage` in `show()`. |
| **WS-3** | `app/Http/Controllers/Delivery/DeliveryPartnerController.php` | 121 | Eager load `items.product.primaryImage` in `show()`. |
| **WS-4** | `app/Http/Controllers/Health/ReadyCheckController.php` | 66–85 | Add live S3 probe `Storage::disk('s3')->has('_healthcheck')`. |
| **WS-4** | `.github/workflows/deploy-production.yml` | 1–40 | Add automated test dependency prior to EC2 SSM deploy. |
| **WS-4** | `tests/Feature/Auth/PermissionRegistryTest.php` | 20–80 | Update canonical permissions to 56 and salesman to 15. |

---

## 4. Verification Protocol & Definition of Done

Upon receiving authorization to execute GOD PROMPT 2:
1. **Branch Creation:** Create isolated feature branch `feature/ujw-master-remediation-20261030`.
2. **Execute Workstreams 1 through 4** in strict sequence.
3. **Run Targeted Automated Test Suite:**
   - `php artisan test tests/Feature/Prompt2TargetedRemediationTest.php` (All 9 tests must pass).
   - `php artisan test tests/Feature/Auth/PermissionRegistryTest.php` (All tests must pass).
   - `php artisan test tests/Feature/Document/InvoiceGenerationTest.php` (All tests must pass).
   - `php artisan test tests/Feature/Adjustment` (All tests must pass).
   - Run live PostgreSQL schema test verifying `hasHistoricalReferences()` succeeds against Neon DB without `SQLSTATE[42703]`.
4. **Browser QA Verification (Playwright):**
   - Run Playwright cross-role journeys verifying `aspect-square object-contain` rendering on mobile and desktop viewports.
   - Assert zero images on invoice print views (`RULE-DOC-001`).
5. **Git Hygiene & Clean Diff:**
   - Execute anti-dead-code protocol (`git status`, remove untracked files, check `git diff`).
   - Create clean, atomic commit: `fix(core): resolve user deletion schema, inertia protocol, and product image cropping [UJW-AUDIT-20261030]`.

---

## 5. Formal Stop Condition (Phase 1 Complete)

> [!IMPORTANT]
> **PHASE 1 IS STRICTLY AUDIT-ONLY.**  
> In compliance with user instructions and [`AGENTS.md`](file:///f:/Wholesale%20Distribution%20Management%20System/AGENTS.md), the agent has completed all investigative analysis, verified root causes, and authored all 8 master audit documents.  
> **NO APPLICATION CODE, MIGRATIONS, OR INFRASTRUCTURE HAVE BEEN MODIFIED.**  
> The agent now stops and awaits explicit user authorization to execute Phase 2 (GOD PROMPT 2).

