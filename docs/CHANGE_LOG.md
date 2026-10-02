# CHANGE_LOG.md — Controlled Change Management & Audit

## Wholesale Distribution Management System

**Document Version:** 1.0  
**Effective Date:** September 2026  
**Status:** Authoritative Change Registry  
**Protocol:** No client-requested business or architectural change may be implemented directly in code without passing through the formal **Change Impact Assessment Procedure** documented below.

---

## 1. Change Impact Assessment Procedure

When a new business requirement, client change request, or technical modification arrives, the developer/agent must execute this protocol:

```text
1. Record the Request (Assign CHANGE-XXX)
       ↓
2. Identify Affected Specifications (PRD, Technical Architecture, Security, Frontend)
       ↓
3. Assess Domain Impacts:
   - Order & Allocation Impact
   - Inventory & Warehouse Impact
   - Pricing & Tax Impact
   - Payment & Evidence Impact
   - Accounting & General Ledger Impact
       ↓
4. Assess Non-Functional Impacts:
   - Security, Authorization & Audit Impact
   - Database Migration & Schema Impact
   - Performance & Concurrency Impact
   - Automated Testing & QA Impact
       ↓
5. Classify Scope & Versioning:
   - Is this within V1 scope, a new build phase, or deferred to future releases?
       ↓
6. Formal Approval & Document Synchronization:
   - Update PRD, Architecture, Security, or Frontend docs first
   - Create or update tickets in Feature Ticket List
       ↓
7. Implementation & Verification
```

---

## 2. Change Register

### CHANGE-040: Production Inertia Response Contract Fix for Order Adjustments
- **Change ID:** `CHANGE-040`
- **Date:** October 2, 2026
- **Requested By:** Production Incident Response & Release Engineer
- **Observed Production Error:** "All Inertia requests must receive a valid Inertia response, however a plain JSON response was received." on `/admin/orders/11`.
- **Root Cause:**
  - `OrderAdjustmentRequestController::store()` and `withdraw()` evaluated `$request->ajax()` to `true` for Inertia requests due to `X-Requested-With: XMLHttpRequest`, causing the controller to return a 201/200 plain JSON payload to Inertia rather than an HTTP 302 redirect with session flash data.
  - In `AdminOrderAdjustmentController.php`, unhandled property access on potentially null requester objects and raw enum accesses risked 500 Application Error responses.
- **Resolution:**
  - Corrected the response contract in `OrderAdjustmentRequestController::store()` and `withdraw()` to `if ($request->wantsJson() && ! $request->header('X-Inertia'))`. Inertia requests now authoritatively receive `redirect()->back()->with('success', ...)` preserving the Inertia protocol, closing the modal, refreshing page data, and rendering flash messages without raw JSON dumps or client-side protocol errors.
  - Harmonized `SalesmanOrderController::saveDraft()` with the same `if ($request->wantsJson() && ! $request->header('X-Inertia'))` contract pattern.
  - Hardened `AdminOrderAdjustmentController`, `AdminOrderController`, and `SalesmanOrderController` against null requester references and ensured robust handling of `status`, `reason_code`, and `payment_terms` across view models.
  - Added `preserveScroll: true` to `RequestAdjustmentModal.tsx` and `PendingAdjustmentBanner.tsx`.
  - Added focused regression tests in `OrderAdjustmentRequestTest.php` covering the Inertia HTTP 302 redirect response contract.
- **Impacted Components:**
  - `app/Http/Controllers/Order/OrderAdjustmentRequestController.php`
  - `app/Http/Controllers/Admin/AdminOrderAdjustmentController.php`
  - `app/Http/Controllers/Admin/AdminOrderController.php`
  - `app/Http/Controllers/Salesman/SalesmanOrderController.php`
  - `resources/js/Pages/Admin/Orders/Partials/RequestAdjustmentModal.tsx`
  - `resources/js/Pages/Admin/Orders/Partials/PendingAdjustmentBanner.tsx`
  - `tests/Feature/Adjustment/OrderAdjustmentRequestTest.php`

### CHANGE-039: Complete Quality Assurance, Security & Deployment Baselines (QA-006..010, TECH-QA-001, DEPLOY-001..005)
- **Change ID:** `CHANGE-039`
- **Date:** October 2, 2026
- **Requested By:** Principal Software Architect & Release Engineer
- **Request:** Implement and integrate all remaining backlog tickets:
  1. `QA-006`: `QA006PaymentEvidenceSecurityTest.php` (Magic-byte validation, binary disguise rejection, 5MB boundary, unguessable private UUID path, 15m presigned URL TTL, cross-salesman anti-IDOR checks, and role authorization).
  2. `QA-007`: `QA007PaymentRefundIntegrityTest.php` (Overpayment prevention, verification maker-checker segregation, rejection with mandatory reason, reversal & receivable restoration, refund credit ceiling, refund maker-checker, and double-refund prevention).
  3. `QA-008`: `QA008AccountingIntegrityTest.php` (Double-entry balancing enforcement, unbalanced/single-line rejection, journal immutability, reversal lineage, Trial Balance equilibrium, Balance Sheet equation equilibrium, and P&L reconciliation).
  4. `QA-009`: `QA009ResponsiveRegressionTest.php` (Responsive view model payloads across Admin, Salesman, Delivery, and Accounting workspaces).
  5. `QA-010`: `QA010AccessibilityBaselineTest.php` (WCAG 2.1 AA error bag serialization, dual-encoding status labels, and accessible landmarks).
  6. `TECH-QA-001`: `TechQA001PerformanceBaselineTest.php` (Bounded 25/page pagination, and constant query budget / N+1 prevention).
  7. `DEPLOY-001`..`DEPLOY-005`: Staging & production configuration, CI/CD pipeline, automated PostgreSQL backup & restore scripts (`scripts/backup-database.sh`, `scripts/restore-database.sh`), and production security hardening checklist.
- **Reason:** Satisfy 100% of the 128-ticket roadmap specification baseline.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P0` (Master Backlog Completion)
- **Approved By:** Lead Architect / Project Governance
- **Implementation Status:** Test coverage and deployment scripts implemented; execution deferred to verification phase.

---

### CHANGE-038: Master Inventory Concurrency & Race-Condition Test Suite (QA-005)
- **Change ID:** `CHANGE-038`
- **Date:** October 2, 2026
- **Requested By:** Principal Software Architect / Quality Assurance Lead
- **Request:** Implement `QA005InventoryConcurrencyTest.php` covering competing orders for scarce physical inventory, multi-product ascending lock ordering deadlock prevention, stock exception damage quarantine isolation, allocation release and re-reservation, atomic reservation failure rollback isolation, mathematical inventory balance conservation, authorized balance adjustment serialization, and double-release guards.
- **Reason:** Guarantee inventory consistency, prevent over-allocation races, eliminate deadlocks under reverse item orderings, and verify rollback boundaries under peak concurrent ordering.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P1` (Operational Concurrency Quality Gate)
- **Affected PRD Requirements:** PRD §17, §18, §19, §38.
- **Affected Architecture:** Technical Architecture §22, §23, §24.
- **Affected Security:** Permission enforcement across `Permission::INVENTORY_ADJUST`, `Permission::INVENTORY_EXCEPTION_REPORT`, and `Permission::ORDER_APPROVE`.
- **Affected Tickets:** `QA-005`.
- **Inventory Impact:** Formal verification of physical stock invariants `on_hand == reserved + available + damaged` under high concurrency.
- **Testing Impact:** 7 new automated tests with 61 assertions in `QA005InventoryConcurrencyTest.php`. Full QA suite passing 35/35 tests, Inventory suite passing 107/107 tests.
- **Approved By:** Lead Architect
- **Implementation Status:** Verified complete; 100% tests passing.

---

### CHANGE-001: Baseline Specification Freeze & Project Operating System Initialization
- **Change ID:** `CHANGE-001`
- **Date:** September 4, 2026
- **Requested By:** Project Architect & Solo Developer
- **Request:** Establish the foundational five authoritative specifications (PRD, Architecture, Security & Access, Frontend Specification, Feature Tickets) and institute the comprehensive Project Operating System governance layer (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and all `docs/*` control files).
- **Reason:** Prevent architectural drift, eliminate unverified AI assumptions, guarantee non-destructive historical data models, and provide a deterministic, auditable engineering process for long-term development.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Critical Prerequisite)
- **Affected PRD Requirements:** Documents 01 through 05 established as baseline v1.0.
- **Affected Architecture:** All sections of Technical Architecture established.
- **Affected Security:** Strict server-side zero-trust security architecture established.
- **Affected Frontend:** "Premium B2B Commerce × Modern SaaS ERP" design direction locked.
- **Affected Tickets:** All tickets (`TECH-FOUND-001` through `DEPLOY-005`).
- **Inventory Impact:** Formalized 4-tier stock representation (`on_hand`, `reserved`, `available`, `damaged`) and pessimistic locking.
- **Order Impact:** Locked non-destructive quantity allocation and explicit order adjustment framework.
- **Payment Impact:** Locked V1 payment methods (`CASH`, `CHEQUE`, `MONEY_ORDER`) with mandatory JPEG evidence.
- **Tax Impact:** Locked product-specific line-level tax calculation and transaction snapshots.
- **Accounting Impact:** Locked immutable double-entry general ledger journal posting.
- **Data Migration Impact:** Clean slate; zero legacy migrations.
- **Testing Impact:** Established 11 QA test suites and cross-feature edge case register (`EDGE-001` through `EDGE-025`).
- **Deployment Impact:** Baseline AWS architecture (EC2, RDS PostgreSQL, ElastiCache, S3, Route 53) specified.
- **Approved By:** Lead Architect / Project Governance
- **Implementation Status:** Verified complete; control layer active.
- **Release/Commit Reference:** Initial commit baseline.

---

### CHANGE-002: Authoritative Price Boundary Constraint Enforcement & Decimal Hardening
- **Change ID:** `CHANGE-002`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Establish server-side price boundary enforcement (`0 <= cost_price`, `0 < min <= default <= mrp`), eliminate float casting in favor of exact 2-decimal BCMath arithmetic strings via `PriceBoundaryService`, add PostgreSQL `products_pricing_hierarchy_check` constraint, enforce resulting-state validation on updates, and create reusable domain method `validateOrderUnitPrice()` for future Phase 05 Orders.
- **Reason:** Eliminate float-precision rounding anomalies in financial data, enforce defense-in-depth database constraints, and provide reusable domain authority for order lines.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P1` (Commerce Spine Prerequisite)
- **Affected PRD Requirements:** PRD §9.1, §9.2, §10.1.
- **Affected Architecture:** Technical Architecture §18, §19, §23.
- **Affected Security:** Permission `product.price.update` strictly enforced on price mutations.
- **Affected Frontend:** Product Create/Edit forms with step="0.01" and real-time visual hierarchy feedback.
- **Affected Tickets:** `FEAT-PRICE-001`.
- **Inventory Impact:** None.
- **Order Impact:** Reusable order line unit price boundary validator (`validateOrderUnitPrice`) established for Phase 05.
- **Payment Impact:** None.
- **Tax Impact:** None.
- **Accounting Impact:** Preserves accurate, non-floating-point financial base prices.
- **Data Migration Impact:** Added PostgreSQL CHECK constraint `products_pricing_hierarchy_check` via migration `2026_09_05_000005_add_pricing_hierarchy_check_to_products_table.php`.
- **Testing Impact:** Added `PriceBoundaryServiceTest` (24 unit tests) and `ProductPriceBoundaryTest` (17 feature tests). Total suite at 492 tests passing.
- **Deployment Impact:** Verified BCMath extension availability in PHP runtime.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-PRICE-001`.

---

### CHANGE-003: Authorized Price Override Engine & Permission Registry Expansion
- **Change ID:** `CHANGE-003`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Establish the server-side price override domain engine (`PricingOverrideService`) to evaluate and authorize selling price exceptions outside normal boundaries (`minimum_allowed_price <= price <= mrp`) with mandatory reason capture (5-500 chars), strict BCMath decimal math, registration of `Permission::PRICING_OVERRIDE = 'pricing.override'` (expanding registry to 48 canonical codes mapped to `SUPER_ADMIN` and `ADMIN`), readonly DTO `PriceOverrideDecision`, non-zero/non-negative invariant enforcement ($> 0.00$), structured audit logging (`PRODUCT_PRICE_OVERRIDE_AUTHORIZED`), and security warning emission for unauthorized attempts.
- **Reason:** Enable commercial flexibility for strategic discounts and expedited surcharges while protecting Product Master immutability, ensuring zero client trust, and preserving complete financial auditability.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P1` (Commerce Spine Prerequisite)
- **Affected PRD Requirements:** PRD §9.1, §9.2, §10.1, §10.2.
- **Affected Architecture:** Technical Architecture §18, §19, §23.
- **Affected Security:** Registered `pricing.override` in `Permission` enum; mapped exclusively to `SUPER_ADMIN` (48 permissions) and `ADMIN` (40 permissions); rejected unauthorized roles (Salesman, Warehouse Manager, Accountant, Delivery Partner) with 403.
- **Affected Frontend:** None in this ticket; ready for future Phase 05 Order placement UI integration.
- **Affected Tickets:** `FEAT-PRICE-002`.
- **Inventory Impact:** None.
- **Order Impact:** Reusable price override evaluation and authorization engine (`PricingOverrideService`) established for Phase 05 Order workflows.
- **Payment Impact:** None.
- **Tax Impact:** None.
- **Accounting Impact:** Preserves immutable Product Master prices while providing auditable prospective transaction override context.
- **Data Migration Impact:** None. Product Master `products_pricing_hierarchy_check` PostgreSQL CHECK constraint remains unmodified and un-weakened.
- **Testing Impact:** Added `PricingOverrideServiceTest` (18 unit tests) and `PriceOverrideIntegrationTest` (9 feature tests). Total suite at 521 tests passing (3,127 assertions).
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-PRICE-002`.

### CHANGE-004: Product-Specific Tax Profile Engine & Order-Line Snapshot Contract
- **Change ID:** `CHANGE-004`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Establish the product-specific tax profile domain engine (`tax_profiles` table, `TaxProfile` model, `TaxProfileStatus` enum), authoritative calculation engine (`TaxCalculationService`) using exact decimal BCMath arithmetic with deterministic `ROUND_HALF_UP` rounding, header tax sum of rounded line taxes invariant, transaction snapshot contract DTOs (`TaxSnapshotData`, `TaxCalculationResult`), Product Master integration (`products.tax_profile_id` FK with `ON DELETE RESTRICT`), active-only assignment guards, non-destructive deactivation, RBAC protection via `Permission::PRODUCT_TAX_UPDATE`, structured audit logging, and responsive frontend UI (Tax Profile Index/Create/Edit and Product Create/Edit/Show selectors).
- **Reason:** Provide product-specific tax configuration with zero float financial authority, protect historical transaction integrity, ensure invoice line-tax reconcilability without half-cent rounding errors, and prepare the commerce spine for future Phase 03/05 Order workflows.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P1` (Commerce Spine Prerequisite)
- **Affected PRD Requirements:** PRD §11.1, §11.2, §11.3, §11.4, §11.5.
- **Affected Architecture:** Technical Architecture §20, §23.
- **Affected Security:** Permission `product.tax.update` enforced on Tax Profile CRUD and Product tax profile assignments; unauthorized roles rejected with 403.
- **Affected Frontend:** Created Tax Profile Index/Create/Edit pages (`resources/js/Pages/TaxProfile/*`), updated Product Create/Edit/Show pages with tax profile selectors and displays, and updated sidebar navigation.
- **Affected Tickets:** `FEAT-TAX-001`.
- **Inventory Impact:** None.
- **Order Impact:** Reusable calculation engine (`TaxCalculationService`) and immutable snapshot contract (`TaxSnapshotData`) established for Phase 03/05 Order creation.
- **Payment Impact:** None.
- **Tax Impact:** Comprehensive product-specific tax engine with line-level `ROUND_HALF_UP` rounding and header sum of rounded line taxes established.
- **Accounting Impact:** Guarantees future invoices and tax journals reconcile exactly with line-level tax amounts without rounding discrepancies.
- **Data Migration Impact:** Created `tax_profiles` table (`2026_09_05_000006_create_tax_profiles_table.php`) and added foreign key `fk_products_tax_profile_id` on `products.tax_profile_id` (`2026_09_05_000007_add_foreign_key_to_products_tax_profile_id.php`).
- **Testing Impact:** Added `TaxCalculationServiceTest` (18 unit tests), `TaxProfileManagementTest` (7 feature tests), and `ProductTaxIntegrationTest` (5 feature tests). Total suite at 551 tests passing (3,247 assertions).
- **Deployment Impact:** Verified BCMath extension availability.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-TAX-001`.

### CHANGE-004: FEAT-ORD-001 Salesman Order Creation Flow
- **Change ID:** `CHANGE-004`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the flagship Salesman Order Creation workflow, including customer selection with server-side salesman scoping, product catalogue browsing with signed S3 images, ephemeral cart with LocalStorage draft persistence, boundary pricing enforcement, BCMath line tax calculation (`ROUND_HALF_UP`), historical line snapshots, PostgreSQL sequence-backed `ORD-YYYY-XXXXXX` numbering, unique idempotency token with canonical fingerprint replay conflict safety, atomic `DB::transaction` checkout with deterministic ascending product locking (`SELECT FOR UPDATE`), and structured `ORDER_CREATED` audit event emission.
- **Reason:** Provide the core transactional order intake spine for salesman operations without client trust or downstream workflow entanglement.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD §12 (Order Workflow), §25.1 (Salesman Ordering), §25.2 (Pricing Boundaries), §32 (Audit).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §5.2 (Historical Snapshots), §8.2 (Idempotency).
- **Affected Security:** Zero client trust for prices/taxes/totals, customer salesman scoping, authenticated actor derivation.
- **Affected Frontend:** Salesman Order Builder (`Create.tsx`, `Show.tsx`) across Desktop (1024-1920px), Tablet (768-1023px), and Mobile (320-430px).
- **Affected Tickets:** `FEAT-ORD-001` completed.
- **Inventory Impact:** Stock reservation and decrements explicitly out of scope and deferred to Phase 06.
- **Order Impact:** Initial order lifecycle state established (`status = SUBMITTED`, `fulfillment_status = UNALLOCATED`, `payment_status = UNPAID`, `delivery_status = PENDING_ASSIGNMENT`, `adjustment_status = NONE`).
- **Payment Impact:** Payments deferred to Phase 07.
- **Tax Impact:** Integrated authoritative `TaxCalculationService::calculateLineTax()` for snapshotting.
- **Accounting Impact:** Immutable transaction records created; GL posting deferred to Phase 09.
- **Data Migration Impact:** Created `orders` (`2026_09_05_000008_create_orders_table.php`) and `order_items` (`2026_09_05_000009_create_order_items_table.php`) tables with PostgreSQL sequence `order_number_seq` and check constraints.
- **Testing Impact:** Added 23 comprehensive feature tests (`SalesmanOrderCreationTest.php`). Full suite at 575 tests (3,391 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-001`.

### CHANGE-005: FEAT-ORD-002 Draft Order Persistence & Resumption
- **Change ID:** `CHANGE-005`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement persistent working order drafts using the single `orders` and `order_items` aggregate with `orders.status = DRAFT`, nullable `order_number`, auto-generated UUID `draft_token`, and optimistic version locking (`version`). Support draft creation, line item/quantity/price synchronization, customer selection, draft discard with item cleanup, draft listing (`GET /salesman/orders/drafts`) with search and pagination, draft resumption (`GET /salesman/orders/drafts/{order}/edit`) into the 3-step Order Builder, stale master data warning banners, and atomic draft submission (`DRAFT -> SUBMITTED`) with full re-validation of pricing boundaries, lock-for-update product re-reading, exact line-level tax recalculation (`ROUND_HALF_UP`), and sequential `ORD-YYYY-XXXXXX` assignment.
- **Reason:** Allow salesmen to prepare, pause, resume, and modify incomplete orders across devices without consuming formal order numbers or triggering premature downstream workflows.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD §12 (Order Workflow), §25.1 (Salesman Ordering), §25.4 (Draft Order Management).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §5.2 (Historical Snapshots), §8.2 (Concurrency & Optimistic Locking).
- **Affected Security:** Strict salesman scoping, authenticated actor derivation, zero client trust for draft totals/taxes, IDOR protection across draft endpoints.
- **Affected Frontend:** Drafts List (`Drafts.tsx`), Discard Confirmation Modal (`DiscardDraftModal.tsx`), Order Builder Draft Resumption & Autosave (`Create.tsx`), Sidebar Navigation (`AppLayout.tsx`).
- **Affected Tickets:** `FEAT-ORD-002` completed.
- **Inventory Impact:** Zero inventory reservation or decrement on draft save/update/discard; stock reserved only at downstream fulfillment.
- **Order Impact:** Single aggregate `status = DRAFT`, mutable working items, transitions to `status = SUBMITTED` on submit with formal order number.
- **Payment Impact:** Zero payment interaction on drafts.
- **Tax Impact:** Draft tax totals are preview-only; recalculated authoritatively on final submission via `TaxCalculationService`.
- **Accounting Impact:** Zero GL impact on drafts.
- **Data Migration Impact:** Added migration `2026_09_05_000010_update_orders_table_for_drafts.php` making `order_number` nullable, adding `draft_token` UUID NOT NULL UNIQUE, `version` integer NOT NULL DEFAULT 1, and composite index `(salesman_id, status, updated_at)`.
- **Testing Impact:** Added 15 comprehensive feature tests (`DraftOrderPersistenceTest.php`). Full suite at 590 tests (3,487 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-002`.

### CHANGE-006: FEAT-ORD-003 Order Line Quantity Stepper & Validation Controls
- **Change ID:** `CHANGE-006`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement a unified, accessible, and robust quantity stepper component (`QuantityStepper.tsx`) across all three Order Builder surfaces: Product Catalogue Cards (`ProductOrderCard.tsx`), Quick Cart Drawer (`CartDrawer.tsx`), and Order Review & Confirmation Table (`OrderReviewStep.tsx`). Enforce positive integer domain bounds ($1 \le \text{quantity} \le 999,999$) with boundary disable states (`[-]` disabled at 1, `[+]` disabled at 999,999), intermediate typing buffer, Enter/blur normalization, $\ge 44\text{px}$ touch targets, and full ARIA semantics. Decouple quantity decrement from line removal (preserves explicit deletion via trash/remove controls). Integrate with 2-second debounced draft autosave and server-side FormRequest and Service layer validation.
- **Reason:** Provide seamless, ergonomic, and error-resistant quantity modification for salesmen across desktop, tablet, and mobile devices without risking invalid quantities or premature row deletions.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD §12 (Order Workflow), §25.1 (Salesman Ordering), §25.3 (Line Quantity Validation).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §8.2 (Concurrency & Idempotency).
- **Affected Security:** Zero client trust; server-side FormRequest (`CreateOrderRequest`, `SaveOrderDraftRequest`) and `OrderService` enforce strict positive integer validation ($1 \le \text{quantity} \le 999,999$).
- **Affected Frontend:** `QuantityStepper.tsx`, `ProductOrderCard.tsx`, `CartDrawer.tsx`, `OrderReviewStep.tsx`, `Create.tsx`.
- **Affected Tickets:** `FEAT-ORD-003` completed.
- **Inventory Impact:** Zero inventory reservation or decrement; stock allocated downstream.
- **Order Impact:** Mutable line item quantity in draft and ephemeral cart; transitions to immutable snapshot on final order submission.
- **Payment Impact:** None.
- **Tax Impact:** Live UI preview recalculated; authoritative line taxes and totals computed via `TaxCalculationService`.
- **Accounting Impact:** None.
- **Data Migration Impact:** None (schema already supports integer quantities).
- **Testing Impact:** Added 10 comprehensive feature tests (`OrderQuantityValidationTest.php`). Full suite at 600 tests (3,539 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-003`.

### CHANGE-007: FEAT-ORD-004 Order Review, Line Tax Breakdown & Financial Summary
- **Change ID:** `CHANGE-007`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Upgrade the Salesman Order Builder review step (`OrderReviewStep.tsx`) into a production-grade pre-submission financial review workspace. Expose transparent, line-by-line financial visibility: Product Name, SKU, Unit, Quantity Stepper, Unit Price, Taxable Amount, Tax Profile Code & Rate (e.g., `STD-825 (8.25%)` / `EXEMPT-0 (0.00%)`), Line Tax Amount, Line Total, and explicit Remove action. Provide structured Financial Summary (Subtotal / Taxable Amount, Estimated Line Taxes, Grand Total) with server-authoritative notice. Implement centralized client preview utilities (`financial.ts`) adhering to `ROUND_HALF_UP` parity without claiming binary-float authority. Implement mobile-tailored review card component (`OrderReviewLineCard.tsx`) with $\ge 44\text{px}$ touch targets to prevent broken horizontal scrolling on screens $\le 430\text{px}$. Maintain zero client financial authority (server BCMath and `OrderService` remain authoritative).
- **Reason:** Guarantee full commercial and tax transparency for wholesale salesmen prior to order submission, ensure mathematical parity between client previews and server transactions, and provide an accessible, responsive B2B review experience.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD §11 (Product-Specific Tax), §12 (Ordering Workflow), §25.1 (Salesman Order Builder), §25.3 (Order Review & Financials).
- **Affected Architecture:** Technical Architecture §5.1 (Order & Line Item Snapshot Model), §8.2 (Concurrency & Idempotency), §23 (Tax Calculation Engine).
- **Affected Security:** Zero client trust (`RULE-SEC-002`); cost price (`cost_price`) hidden from salesman view; salesman customer scoping enforced; price boundary validation enforced ($0 < \text{min} \le \text{price} \le \text{mrp}$).
- **Affected Frontend:** `financial.ts`, `OrderReviewStep.tsx`, `OrderReviewLineCard.tsx`, `order.ts`, `Create.tsx`.
- **Affected Tickets:** `FEAT-ORD-004` completed.
- **Inventory Impact:** None (stock reserved post-approval downstream).
- **Order Impact:** Live preview of line taxes and totals; immutable historical snapshots persisted in `order_items` upon submission.
- **Payment Impact:** None.
- **Tax Impact:** Multi-line mixed tax rates calculated per line using BCMath `ROUND_HALF_UP`; order tax total equals exact sum of rounded line taxes ($\sum \text{line\_tax\_amount}$).
- **Accounting Impact:** None.
- **Data Migration Impact:** None (existing schema fully supports all snapshot fields).
- **Testing Impact:** Added 7 comprehensive feature tests (`OrderReviewFinancialSummaryTest.php`). Full suite at 607 tests (3,637 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
### CHANGE-008: FEAT-ORD-005 Order Submission Idempotency Enforcement
- **Change ID:** `CHANGE-008`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Harden order submission across direct order placement (`POST /salesman/orders`) and draft submission (`POST /salesman/orders/drafts/{id}/submit`) with dual-layer concurrency protection: advisory non-blocking Redis/cache lock (`Cache::lock("order_submission:{$actor->id}:{$idempotencyKey}", 10)`) with graceful fallback, authoritative PostgreSQL `UNIQUE(idempotency_key)` constraint backstop, and a specialized race collision recovery handler. On unique constraint collision (SQLSTATE `23505`), ensure transaction rollback, perform fresh committed read of the winner order, verify actor ownership (403 Forbidden for cross-salesman access), evaluate canonical fingerprint match (`doesOrderMatchDto`), return existing order on exact match (200/302), and throw HTTP 409 Conflict on payload mismatch. Enforce draft submission lock-for-update synchronization, sequence order number generation strictly on winning commits, and structured audit log uniqueness (exactly ONE `ORDER_CREATED` event per logical order; `ORDER_IDEMPOTENT_REPLAY` and `ORDER_IDEMPOTENCY_CONFLICT` on replays and conflicts).
- **Reason:** Guarantee absolute correctness and eliminate duplicate order placement, duplicate order numbering, duplicate `ORDER_CREATED` audit events, and 500 error crashes during concurrent submissions or rapid client retries under peak or degraded network conditions.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD §12 (Ordering Workflow), §25.1 (Salesman Ordering), §25.3 (Order Submission & Idempotency).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §8.2 (Concurrency & Idempotency Architecture), §18 (Database & Transaction Integrity).
- **Affected Security:** Zero client trust (`RULE-SEC-002`); salesman scoping enforced; cross-salesman key reuse blocked with HTTP 403 without data leakage (`RULE-SEC-003`); IDOR prevention; PostgreSQL row locks (`SELECT FOR UPDATE`).
- **Affected Frontend:** `Create.tsx` (stable idempotency key state, disabled submission button, localStorage cleanup on confirmed commit).
- **Affected Tickets:** `FEAT-ORD-005` completed.
- **Inventory Impact:** Zero duplicate reservations or allocations.
- **Order Impact:** Single canonical order identity (`idempotency_key`), single sequence order number (`ORD-YYYY-XXXXXX`), exact replay returns existing order without mutation.
- **Payment Impact:** None.
- **Tax Impact:** None; line taxes snapshotted once upon winning transaction commit.
- **Accounting Impact:** None.
- **Data Migration Impact:** None (schema `orders.idempotency_key` is already `VARCHAR(64) UNIQUE NOT NULL`).
- **Testing Impact:** Added 17 comprehensive feature tests in `OrderSubmissionIdempotencyTest.php`. Full test suite at 624 tests (3,705 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-005`.

### CHANGE-009: FEAT-ORD-006 Salesman Order History & Multi-State Timeline
- **Change ID:** `CHANGE-009`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the flagship Salesman Order History Workspace (`GET /salesman/orders`) and enrich the Order Detail view (`GET /salesman/orders/{order}`) with an authentic, non-fabricated Multi-State Timeline. The workspace enforces 100% server-authoritative scoping (`orders.salesman_id = authenticated_actor.id` for Salesmen; Admin/Super Admin/Accountant global visibility), multi-column search (`order_number`, customer `name`, customer `code`), independent status dimension filtering (`status`, `fulfillment_status`, `payment_status`, `delivery_status`), date range filtering (`date_from`, `date_to`), bounded server-side pagination (15 items/page with query string preservation), and deterministic ordering (`submitted_at DESC, id DESC`). Draft orders are strictly excluded from history to preserve separation in `/salesman/orders/drafts`. Order detail view embeds `OrderTimeline` rendering verifiable milestones (`created`, `submitted`, `approved`, `cancelled`, `completed`) with exact persisted database timestamps and recorded actor identities, paired with the live workflow status snapshot across all 5 independent dimensions (`OrderStatusBadge`), without synthesizing fake intermediate transition timestamps.
- **Reason:** Provide sales representatives with an auditable, high-density, accessible, and responsive workspace to track customer orders across their entire lifecycle, while preserving zero-trust security and eliminating data leakage.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P1`
- **Affected PRD Requirements:** PRD §12 (Ordering Workflow), §25.1 (Salesman Ordering & Order History).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §5.6 (Multi-Dimension Status Model), §18 (Database & Transaction Integrity).
- **Affected Security:** Zero client trust (`RULE-SEC-002`); salesman scoping enforced (`RULE-ORD-003`); direct IDOR blocked with HTTP 403 Forbidden (`RULE-SEC-003`); zero exposure of `cost_price` (`RULE-PRI-001`).
- **Affected Frontend:** `resources/js/Pages/Salesman/Orders/Index.tsx`, `resources/js/Pages/Salesman/Orders/Partials/*` (`OrderHistoryFilters.tsx`, `OrderHistoryTable.tsx`, `OrderHistoryCard.tsx`, `OrderStatusBadge.tsx`, `OrderTimeline.tsx`), `Show.tsx`, `AppLayout.tsx`, `order.ts`.
- **Affected Tickets:** `FEAT-ORD-006` completed.
- **Inventory Impact:** None.
- **Order Impact:** Standardized order history query and authentic milestone timeline model.
- **Payment Impact:** Payment status dimension displayed accurately as live snapshot.
- **Tax Impact:** None; line tax snapshots displayed immutably.
- **Accounting Impact:** None.
- **Data Migration Impact:** None (existing table indexes and columns fully support all query paths).
- **Testing Impact:** Added 22 comprehensive feature tests in `SalesmanOrderHistoryTest.php`. Full test suite at 646 tests (3,962 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-006`.

---

### CHANGE-010: FEAT-ORD-010 Admin Order Queue Framework
- **Change ID:** `CHANGE-010`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the flagship Admin Order Queue Workspace (`GET /admin/orders`) and authorization-safe detail inspection route (`GET /admin/orders/{order}`) across 8 operational queues: `New Orders`, `Needs Attention`, `Processing`, `Delivery`, `Adjustments`, `Completed`, `Cancelled`, and `All Orders`. Enforce 100% server-authoritative RBAC (`order.view` permission; `ADMIN`, `SUPER_ADMIN`, and `ACCOUNTANT` granted access; `SALESMAN` strictly denied with HTTP 403 Forbidden). Draft orders (`status = DRAFT`) are strictly excluded from all queues. Compute live queue badge counts in a single consolidated SQL aggregation query. Support multi-column parameterized search (`order_number`, customer `name`, customer `code`, salesman `name`), independent status dimension filtering (`status`, `fulfillment_status`, `payment_status`, `delivery_status`, `adjustment_status`), salesman and customer filtering, date range filtering (`date_from`, `date_to`), allowlisted sorting (`submitted_at`, `order_number`, `customer_name`, `grand_total`, `status`), and bounded 25/page pagination with query string preservation. Enforce zero leakage of sensitive data (`cost_price`, private S3 payment evidence photos/URLs). Provide responsive desktop dense table, tablet layout, and mobile cards ($\ge 44\text{px}$ touch targets, zero horizontal scrolling) adhering to WCAG 2.1 AA.
- **Reason:** Provide operations, logistics, customer service, and accounting with an auditable, high-density, real-time command center to monitor orders across all operational stages from placement to delivery and payment.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD §12 (Ordering Workflow), §25.2 (Admin Order Operations), §25.3 (Operational Queues).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §5.6 (Multi-Dimension Status Model), §18 (Database & Transaction Integrity).
- **Affected Security:** Zero client trust (`RULE-SEC-001`, `RULE-SEC-002`); permission `order.view` verified; Salesman role denied from Admin routes with 403 Forbidden; zero exposure of `cost_price` or private cheque/money-order payment evidence (`RULE-PRI-001`, `RULE-PAY-002`).
- **Affected Frontend:** `resources/js/Pages/Admin/Orders/Index.tsx`, `resources/js/Pages/Admin/Orders/Partials/*` (`AdminOrderQueueTabs.tsx`, `AdminOrderQueueFilters.tsx`, `AdminOrderQueueTable.tsx`, `AdminOrderQueueCard.tsx`), `resources/js/types/order.ts`, `resources/js/Pages/Salesman/Orders/Show.tsx`, `resources/js/Layouts/AppLayout.tsx`.
- **Affected Tickets:** `FEAT-ORD-010` completed.
- **Inventory Impact:** None (reservation deferred to FEAT-ORD-012/FEAT-INV-003).
- **Order Impact:** Standardized 8-partition operational queue engine over the single PostgreSQL order source of truth.
- **Payment Impact:** Payment status monitored across all queues; private payment evidence withheld from queue payload.
- **Tax Impact:** None; line tax snapshots displayed immutably.
- **Accounting Impact:** Accountant granted read-only operational visibility via `order.view`.
- **Data Migration Impact:** None (existing table schema and indexes fully support all query paths).
- **Testing Impact:** Added 29 comprehensive automated tests in `AdminOrderQueueTest.php`. Full test suite at 675 tests (4,270 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-010`.

---

### CHANGE-011: FEAT-ORD-011 New Order Review Workspace
- **Change ID:** `CHANGE-011`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the dedicated New Order Review Workspace (`GET /admin/orders/{order}/review`) for administrative evaluation and readiness inspection of orders in reviewable states (`SUBMITTED`, `PENDING_APPROVAL`). Strictly enforce read-only boundary (no approval, rejection, hold mutation, inventory reservation, or payment verification state transitions). Enforce server-authoritative RBAC (`order.view` permission; `ADMIN` and `SUPER_ADMIN` granted readiness capabilities; `ACCOUNTANT` granted read-only access with `can.approve = false`, `can.reject = false`; `SALESMAN` strictly denied with HTTP 403 Forbidden). Fail-closed draft isolation returns HTTP 404 Not Found for drafts (`status = DRAFT`). Post-review orders (`APPROVED`, `COMPLETED`, `CANCELLED`, `REJECTED`) redirect to `/admin/orders/{order}` with informative notification. Implement bounded eager loading strictly omitting `cost_price` and private payment evidence. Derive deterministic review warnings server-side (`CUSTOMER_ON_HOLD` [blocker], `CUSTOMER_INACTIVE` [blocker], `CREDIT_LIMIT_EXCEEDED` [warning], `PRICE_OVERRIDE_PRESENT` [notice], `AGING_ORDER` [warning > 24h], `PRODUCT_INACTIVE` [blocker]). Separate historical order-time snapshots (`unit_price`, `ordered_quantity`, line tax snapshot, override metadata) from contextual catalog master properties. Render independent 5 status dimensions (`order`, `fulfillment`, `payment`, `delivery`, `adjustment`). Provide responsive 12-column desktop command layout, adaptive tablet views, and purpose-built mobile cards with >=44px touch targets.
- **Reason:** Provide administrators with an authoritative, risk-free pre-approval evaluation cockpit to audit line items, customer credit, authorized pricing overrides, and operational warnings before committing state mutations.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD §12 (Ordering Workflow), §25.2 (Admin Order Operations), §25.4 (New Order Review Workspace).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §5.6 (Multi-Dimension Status Model), §18 (Database & Transaction Integrity).
- **Affected Security:** Strict server-side zero-trust security architecture (`RULE-SEC-001`, `RULE-SEC-002`); permission `order.view` verified; Salesman role denied from Admin routes with 403 Forbidden; zero exposure of `cost_price`, purchase cost, or private payment evidence photos/keys (`RULE-PRI-001`, `RULE-PAY-002`).
- **Affected Frontend:** `resources/js/Pages/Admin/Orders/Review.tsx`, `resources/js/Pages/Admin/Orders/Partials/*` (`ReviewActionHeader.tsx`, `ReviewAlerts.tsx`, `ReviewCustomerCard.tsx`, `ReviewItemsTable.tsx`, `ReviewItemsCards.tsx`, `ReviewFinancialSummary.tsx`), `resources/js/types/order.ts`, `resources/js/Pages/Admin/Orders/Partials/AdminOrderQueueTable.tsx`, `resources/js/Pages/Admin/Orders/Partials/AdminOrderQueueCard.tsx`, `resources/js/Pages/Salesman/Orders/Show.tsx`.
- **Affected Tickets:** `FEAT-ORD-011` completed.
- **Inventory Impact:** None (reservation deferred to FEAT-ORD-012/FEAT-INV-003).
- **Order Impact:** Standardized pre-approval review evaluation cockpit with fail-closed draft 404 isolation and post-review redirection.
- **Payment Impact:** None; high-level payment status rendered read-only; payment evidence withheld.
- **Tax Impact:** None; line tax snapshots displayed immutably; multi-line tax profiles aggregated deterministically.
- **Accounting Impact:** Accountant granted read-only operational evaluation visibility via `order.view`.
- **Data Migration Impact:** None (existing schema and snapshots fully support review workspace).
- **Testing Impact:** Added 26 comprehensive automated tests in `AdminOrderReviewTest.php`. Full test suite at 701 tests (4,557 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-011`.

---

### CHANGE-012: FEAT-ORD-012 Order Approval / Rejection Workflow with Audit
- **Change ID:** `CHANGE-012`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement authoritative order approval and rejection mutations (`POST /admin/orders/{order}/approve`, `POST /admin/orders/{order}/reject`) governed by `OrderWorkflowService`. Enforce pessimistic locking via PostgreSQL row locking (`lockForUpdate()`) using deterministic lock hierarchy (Order -> Customer -> Order Items ordered by ID). Revalidate customer state (`ACTIVE` allowed, `ON_HOLD` / `INACTIVE` rejected with 422), product states (`ACTIVE` allowed, `INACTIVE` rejected with 422), and reviewable order states (`SUBMITTED`, `PENDING_APPROVAL`). On approval: establish order-level reservation (`fulfillment_status = RESERVED`, `reserved_quantity = fulfillableQuantity()`), transition `status = APPROVED`, record `approved_at` and `approved_by`. On rejection: validate mandatory trimmed reason (5-1000 chars), transition `status = REJECTED`, record `cancelled_at`, `cancelled_by`, and `cancellation_reason` in existing schema. Enforce RBAC: `permission:order.approve` and `permission:order.reject` for `ADMIN` and `SUPER_ADMIN`; strictly deny `ACCOUNTANT` (403), `SALESMAN` (403), `WAREHOUSE_MANAGER` (403), and `DELIVERY_PARTNER` (403). Ensure conflict detection (409 Conflict on stale/duplicate mutations). Emit structured post-commit application observability events (`commerce.order_event`) preserving separation between PostgreSQL transactions and application logging. Update `Review.tsx` Action Readiness Deck with accessible approval and rejection modals, soft warning confirmations, and real-time validation.
- **Reason:** Provide administrators with safe, auditable, and authoritative order approval and rejection capabilities while preventing concurrency races, duplicate mutations, and unverified inventory assumptions.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Critical Business Mutation)
- **Affected PRD Requirements:** PRD §12 (Ordering Workflow), §13 (Order Lifecycle & Invariants), §25.2 (Admin Order Operations).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §5.6 (Multi-Dimension Status Model), §18 (Database & Transaction Integrity), §20 (Concurrency & Locking).
- **Affected Security:** Strict server-side zero-trust security architecture (`RULE-SEC-001`, `RULE-SEC-002`, `RULE-SEC-003`); direct manipulation of order ID prevented by route model binding, authentication, account status verification, and permission checks; non-admin roles denied with 403 Forbidden; zero exposure of `cost_price` or payment evidence.
- **Affected Frontend:** `resources/js/Pages/Admin/Orders/Review.tsx`, `resources/js/Pages/Admin/Orders/Partials/ApproveOrderModal.tsx`, `resources/js/Pages/Admin/Orders/Partials/RejectOrderModal.tsx`.
- **Affected Tickets:** `FEAT-ORD-012` completed.
- **Inventory Impact:** Order-level quantity reservation established (`orders.fulfillment_status = RESERVED`, `order_items.reserved_quantity = fulfillableQuantity()`). Physical stock ledger reservation (balances, movements, warehouse allocations) deferred to Phase 06 (`FEAT-INV-001..004`).
- **Order Impact:** Order transitions to `APPROVED` or `REJECTED` with audit trails (`approved_at`/`approved_by` or `cancelled_at`/`cancelled_by`/`cancellation_reason`). Lines and historical financial values preserved immutably.
- **Payment Impact:** None; payment status remains independent dimension (`UNPAID`).
- **Tax Impact:** None; line item tax snapshots immutable.
- **Accounting Impact:** No direct general ledger postings (financial settlement and invoice posting deferred to Phase 07).
- **Data Migration Impact:** None (zero schema migrations required; existing columns used).
- **Testing Impact:** Added 33 comprehensive automated tests in `AdminOrderApprovalTest.php` (17 tests) and `AdminOrderRejectionTest.php` (16 tests). Full test suite at 734 tests (4,687 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-012`.

---

### CHANGE-013: FEAT-ORD-013 Order Detail Master Workspace
- **Change ID:** `CHANGE-013`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Upgrade canonical administrative order detail workspace at `GET /admin/orders/{order}` (`admin.orders.show`) into a read-oriented operational inspection command center. Replace the temporary salesman-rendered view with `resources/js/Pages/Admin/Orders/Show.tsx` and modular partials (`OrderDetailHeader.tsx`, `OrderDetailCustomerCard.tsx`, `OrderDetailItemsTable.tsx`, `OrderDetailItemsCards.tsx`, `OrderDetailFinancialSummary.tsx`, `OrderDetailOperationalCards.tsx`). Enforce strict read-only boundary (zero approval, rejection, cancellation, adjustment, payment, delivery, or inventory mutations inside detail page; reviewable orders provide contextual CTA to dedicated review workspace). Support all 8 current lifecycle states (`DRAFT`, `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `COMPLETED`, `CANCELLED`, `REJECTED`) and preserve 5 independent status dimensions (`order`, `fulfillment`, `payment`, `delivery`, `adjustment`). Present immutable historical order-time snapshots (`product_name_snapshot`, `sku_snapshot`, `unit_snapshot`, `unit_price`, line totals, tax profiles) while visually distinguishing contextual current master data. Enforce quantity conservation tracking (`ordered`, `cancelled`, `reserved`, `fulfillable`, `picked`, `dispatched`, `delivered`, `returned`). Provide customer commercial context with formatted current account addresses explicitly labeled. Exclude all sensitive data (`cost_price`, purchase cost, private payment evidence, S3 object keys, presigned URLs, credentials). Enforce safe internal `backUrl` query parameter sanitization (blocking external hosts, protocol-relative URLs, and javascript: schemes). Implement strict server-side RBAC: `ADMIN` and `SUPER_ADMIN` have full detail access, `ACCOUNTANT` has read-only access, while `SALESMAN`, `WAREHOUSE_MANAGER`, and `DELIVERY_PARTNER` are strictly blocked with 403 Forbidden.
- **Reason:** Provide administrators and accountants with a unified, high-density, auditable operational inspection surface for reviewing orders, financial snapshots, quantity allocations, and lifecycle status across all order stages.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Foundational Operational Surface)
- **Affected PRD Requirements:** PRD §12 (Ordering Workflow), §13 (Order Lifecycle & Invariants), §25.1 (Admin Order Detail Workspace), §25.2 (Admin Order Operations).
- **Affected Architecture:** Technical Architecture §5.1 (Ordering Domain Model), §5.6 (Multi-Dimension Status Model), §17 (Security Architecture & Zero Trust), §23 (Data Contracts & DTOs).
- **Affected Security:** Strict server-side zero-trust security architecture (`RULE-SEC-001`, `RULE-SEC-002`, `RULE-SEC-003`); direct IDOR protection via route model binding, authentication, account status validation, and role scoping; non-admin roles denied with 403 Forbidden; zero exposure of `cost_price` or payment evidence; safe `backUrl` sanitization preventing open redirects.
- **Affected Frontend:** `resources/js/Pages/Admin/Orders/Show.tsx`, `resources/js/Pages/Admin/Orders/Partials/OrderDetailHeader.tsx`, `resources/js/Pages/Admin/Orders/Partials/OrderDetailCustomerCard.tsx`, `resources/js/Pages/Admin/Orders/Partials/OrderDetailItemsTable.tsx`, `resources/js/Pages/Admin/Orders/Partials/OrderDetailItemsCards.tsx`, `resources/js/Pages/Admin/Orders/Partials/OrderDetailFinancialSummary.tsx`, `resources/js/Pages/Admin/Orders/Partials/OrderDetailOperationalCards.tsx`, `resources/js/types/order.ts`.
- **Affected Tickets:** `FEAT-ORD-013` completed.
- **Inventory Impact:** Read-only inspection of order-level quantity reservations; physical warehouse inventory allocation and stock balance ledgers deferred to Phase 06 (`FEAT-INV-001..004`).
- **Order Impact:** Canonical administrative inspection surface established across all 8 lifecycle states. Original line quantities, pricing snapshots, and tax profiles preserved immutably.
- **Payment Impact:** Read-only inspection of payment status and terms; payment capture, cheque/money order verification, and evidence preview deferred to Phase 07 (`FEAT-PAY-001..006`).
- **Tax Impact:** Read-only multi-line tax profile breakdown aggregated from immutable order item snapshots.
- **Accounting Impact:** Financial breakdown inspection; double-entry general ledger journal posting deferred to Phase 09.
- **Data Migration Impact:** None (zero schema migrations required; existing schema fully satisfies requirements).
- **Testing Impact:** Added 20 comprehensive automated feature tests in `AdminOrderDetailTest.php` (247 assertions). Full test suite at 754 tests (753 passed, 4,934 assertions, 1 skipped) passing 100%.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ORD-013`.

---

### CHANGE-014: FEAT-ALLOC-001 Order Item Quantity Allocation Model
- **Change ID:** `CHANGE-014`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement canonical Order Item Quantity Allocation model and persistence architecture for Phase 06 (`Operations: Allocation, Adjustments & Inventory`). Create dedicated `order_item_allocations` table and `App\Models\OrderItemAllocation` model while preserving existing denormalized operational rollups on `order_items`. Integrate canonical baseline allocation creation into `OrderWorkflowService::approveOrder()` inside existing atomic transactions without double-counting reservations. Provide `App\Services\Allocation\OrderAllocationService` with deterministic lock ordering (Order -> OrderItems ASC -> OrderItemAllocations ASC), cross-row conservation enforcement ($\sum \text{allocated} \le \text{fulfillable}$), unallocated calculations, and safe backfill for historical approved orders.
- **Reason:** Core operational capability to support partial allocations, post-order adjustments, and fulfillment tracking without mutating original commercial order quantities, price snapshots, or tax snapshots.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Phase 06 Foundation)
- **Affected PRD Requirements:** §13 (Order Processing & Reservation Invariants), §14 (Adjustments & Non-Destructive Quantity Conservation), §39.2 (Central Distribution Warehouse).
- **Affected Architecture:** §14 (Allocation & Operational Models), §15 (Order State Machine & Reservation Lifecycle), §18 (Pessimistic Row Locking Architecture).
- **Affected Security:** Strict server authority; all calculations server-side; zero public CRUD endpoints; RBAC-gated inspection; structured post-commit observability (`commerce.allocation_event`) excluding secrets and cost prices.
- **Affected Frontend:** Admin Order Detail (`OrderDetailItemsTable.tsx`, `OrderDetailItemsCards.tsx`, `order.ts`) enriched with discrete allocation data, allocated/unallocated metrics, and allocation summary.
- **Affected Tickets:** `FEAT-ALLOC-001` completed. Unlocks `FEAT-ALLOC-002` and Phase 06 adjustment workflows.
- **Inventory Impact:** Operational order allocation model established; physical warehouse inventory balances and stock movement ledgers deferred to `FEAT-INV-001..004`.
- **Order Impact:** Orders in `APPROVED` and `PROCESSING` states support allocations; `DRAFT`, `SUBMITTED`, `REJECTED`, `CANCELLED`, `COMPLETED` strictly blocked. Baseline allocations created atomically upon order approval.
- **Payment Impact:** None; financial immutability strictly preserved.
- **Tax Impact:** None; tax snapshots and totals remain immutable.
- **Accounting Impact:** None; financial balances and GL lines untouched.
- **Data Migration Impact:** Added migration `2026_09_05_000011_create_order_item_allocations_table.php` with foreign keys to `orders`, `order_items`, `products`, `users`, indexes, and row-local PostgreSQL CHECK constraints.
- **Testing Impact:** Added 19 comprehensive feature tests in `OrderItemAllocationModelTest.php` (123 assertions). Full test suite at 773 tests (771 passed, 5,057 assertions, 2 skipped) passing 100%. Clean TypeScript and Vite builds.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ALLOC-001`.

---

### CHANGE-015: FEAT-ALLOC-002 Allocation Validation & Mathematical Constraints
- **Change ID:** `CHANGE-015`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Harden mathematical conservation laws and domain validation constraints on quantity allocation (`FEAT-ALLOC-002`). Implement strict conservation law ($\text{ordered} = \text{cancelled} + \text{fulfillable}$), active allocation sum conservation ($\sum \text{allocated}_{\text{active}} \le \text{fulfillable}$), unallocated capacity calculation ($\max(0, \text{fulfillable} - \sum \text{allocated}_{\text{active}})$), and strict fulfillment progression constraints ($0 \le \text{returned} \le \text{delivered} \le \text{dispatched} \le \text{picked} \le \text{allocated}$ and $0 \le \text{reserved} \le \text{allocated}$). Tighten PostgreSQL database CHECK constraints on `order_item_allocations` (`dispatched <= picked` and `delivered <= dispatched`). Provide non-destructive soft-state operations for releasing and cancelling allocations with unallocated restoration. Provide centralized authoritative rollup synchronization from allocation rows to `order_items`. Implement collision-free sequence generation by deriving max integer suffix under row locks. Introduce pre-adjustment reduction capacity check `canReduceFulfillableQuantity()`.
- **Reason:** Guarantee mathematical correctness and prevent data drift, race conditions, over-allocation, and financial mutation across all future picking, packing, dispatching, and order adjustment workflows.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (High/Critical Data Integrity)
- **Affected PRD Requirements:** §13 (Order Processing & Reservation Invariants), §14 (Adjustments & Non-Destructive Quantity Conservation), §39.2 (Central Distribution Warehouse).
- **Affected Architecture:** §14 (Allocation & Operational Models), §15 (Order State Machine & Reservation Lifecycle), §18 (Pessimistic Row Locking Architecture).
- **Affected Security:** Zero client authority; server-enforced validation via `OrderAllocationValidationService`; optimistic and pessimistic locking; structured post-commit observability (`commerce.allocation_event`).
- **Affected Frontend:** Admin Order Detail projection and summary compatibility preserved without UI breakage.
- **Affected Tickets:** `FEAT-ALLOC-002` completed. Unlocks `UI-003` and Phase 06 adjustment workflows (`FEAT-ADJ-001+`).
- **Inventory Impact:** Mathematical boundaries locked; physical inventory balances and warehouse ledgers deferred to `FEAT-INV-001..004`.
- **Order Impact:** Order lifecycle restrictions strictly enforced (`APPROVED`/`PROCESSING` allowed; `DRAFT`/`SUBMITTED`/`REJECTED`/`CANCELLED`/`COMPLETED` blocked 409).
- **Payment Impact:** None; financial immutability strictly preserved.
- **Tax Impact:** None; tax snapshots and totals remain immutable.
- **Accounting Impact:** None; general ledger lines and balances untouched.
- **Data Migration Impact:** Added migration `2026_09_05_000012_tighten_order_item_allocations_progression_constraints.php` with PostgreSQL CHECK constraints for `dispatched <= picked` and `delivered <= dispatched`.
- **Testing Impact:** Added 25 comprehensive feature tests across `AllocationValidationTest.php` and `AllocationConcurrencyTest.php`. Full test suite at 798 tests (795 passed, 5,161 assertions, 3 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ALLOC-002`.

### CHANGE-016: FEAT-ADJ-001 Order Adjustment Request Flow
- **Change ID:** `CHANGE-016`
- **Date:** September 5, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the authoritative post-submission order adjustment request flow (`FEAT-ADJ-001`). Allow authorized roles (`SUPER_ADMIN`, `ADMIN`, `SALESMAN`, `WAREHOUSE_MANAGER`) to initiate non-destructive quantity reduction requests on orders in `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING` statuses. Enforce non-destructive transactional history (`order_adjustment_items.adjustment_id -> order_adjustments` uses `restrictOnDelete()`). Enforce single open request per order via PostgreSQL partial unique index `idx_order_adjustments_single_open` and row locking. Classify line reductions into Case A (unallocated only) and Case B (allocation-impacting with `affected_allocation_quantity`). Persist immutable request snapshots, compute financial projections using BCMath and `TaxCalculationService::roundHalfUp` without mutating baseline order/item financials or inventory allocations. Support deterministic idempotency replay (same payload => replay; conflicting payload => 409). Provide requester cancellation/withdrawal restoring `orders.adjustment_status = 'NONE'`. Implement responsive Request Adjustment modal and Pending Adjustment banner.
- **Reason:** Guarantee commercial history preservation (`RULE-DOM-001`, `RULE-ORD-002`), allocation conservation, and transactional concurrency safety for wholesale order modifications before administrative approval.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (High/Critical Transactional Workflow)
- **Affected PRD Requirements:** §14 (Order Adjustment Framework & Non-Destructive History), §15 (Single Open Request Invariant), §16 (Snapshot Immutability).
- **Affected Architecture:** §14 (Allocations & Adjustments), §15 (Order State Machine & Adjustment Status), §18 (Deterministic Lock Hierarchy: Order -> Items ASC -> Allocations ASC -> Adjustments).
- **Affected Security:** Strict server-side RBAC (`Permission::ORDER_ADJUST_REQUEST`); resource scoping (Salesmen restricted to assigned accounts; Warehouse Managers restricted to approved/processing orders); withdrawal authorization; structured post-commit event logging (`commerce.order_adjustment_event`).
- **Affected Frontend:** `RequestAdjustmentModal.tsx`, `PendingAdjustmentBanner.tsx`, `OrderDetailHeader.tsx`, `Admin/Orders/Show.tsx`, `Salesman/Orders/Show.tsx`.
- **Affected Tickets:** `FEAT-ADJ-001` completed. Unlocks `FEAT-ADJ-002: Adjustment Review Workspace`.
- **Inventory Impact:** Zero physical inventory or allocation mutation during request creation or withdrawal (`releaseAllocation`/`cancelAllocation` strictly not invoked).
- **Order Impact:** Orders update `adjustment_status = 'REQUESTED'` upon submission and reset to `NONE` (or `APPLIED`) upon withdrawal. Financial totals and line item quantities remain 100% unmutated.
- **Payment Impact:** None; actual credit notes and invoice adjustments deferred to `FEAT-ADJ-004`.
- **Tax Impact:** Projected tax reduction calculated using authoritative rounding semantics; original order tax totals remain permanently immutable.
- **Accounting Impact:** None; general ledger adjustments strictly deferred to adjustment application in `FEAT-ADJ-004`.
- **Data Migration Impact:** Added migration `2026_09_05_000013_create_order_adjustments_tables.php` creating `order_adjustments` and `order_adjustment_items` with PostgreSQL partial unique index and check constraints.
- **Testing Impact:** Added 30 automated tests across `OrderAdjustmentRequestTest.php`, `OrderAdjustmentConcurrencyTest.php`, and `OrderAdjustmentPostgresConstraintTest.php`. Full test suite at 828 tests (821 passed, 5,260 assertions, 7 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ADJ-001`.

### CHANGE-017: FEAT-ADJ-002 Administrative Adjustment Review Workspace
- **Change ID:** `CHANGE-017`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the dedicated Administrative Adjustment Review Workspace and Queue (`FEAT-ADJ-002`). Establish dual-entry navigation via `/admin/adjustments` (dedicated review queue with status/impact/reason filters, search, and allowlisted sorting) and `/admin/orders/{order}/adjustments/{adjustment}/review` (dedicated detail review workspace). Maintain strict read-only boundary (no approval, rejection, application, reversal, or financial mutation). Enforce canonical active allocation definition (excluding both `CANCELLED` and `RELEASED` states) and progression math without picked+dispatched double counting (`returned <= delivered <= dispatched <= picked <= allocated`). Deliver pure `OrderAdjustmentReviewService` to separate immutable historical request snapshots from live order state evaluations and detect discrepancies/stale states (`READY`, `WARNING_ALLOCATION`, `WARNING_PICKED_ENCROACHMENT`, `STALE`, `CONFLICTED`, `INELIGIBLE_LIFECYCLE`, `TERMINAL_REQUEST`). Resolve Option A reviewer permissions denying Warehouse Managers, Salesmen, and Delivery Partners while authorizing Super Admin, Admin, and Accountant under `Permission::ORDER_ADJUST_REVIEW`.
- **Reason:** Provide administrators and accountants with authoritative, non-destructive situational awareness over pending order quantity adjustments prior to executing atomic mutations.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (High/Critical Review Workflow)
- **Affected PRD Requirements:** §14 (Adjustment Review), §15 (Snapshot Fidelity vs Live Evaluation), §16 (Allocation Impact Inspection).
- **Affected Architecture:** §14 (Review DTOs & Services), §15 (Stale State Resolution), §18 (Dual-Entry Routing & Anti-IDOR Scope Validation).
- **Affected Security:** Route protection via `permission:order.adjust.review`; strict IDOR validation (`adjustment->order_id === order->id`); role authorization for Super Admin, Admin, and Accountant; complete denial of Salesman, Warehouse Manager (Option A), and Delivery Partner; zero audit noise for normal page viewing.
- **Affected Frontend:** `resources/js/Pages/Admin/Adjustments/Index.tsx`, `resources/js/Pages/Admin/Adjustments/Review.tsx`, `resources/js/Layouts/AppLayout.tsx`, `resources/js/Pages/Admin/Orders/Partials/PendingAdjustmentBanner.tsx`, `resources/js/types/order.ts`.
- **Affected Tickets:** `FEAT-ADJ-002` completed. Unlocks `FEAT-ADJ-003: Adjustment Approval / Rejection Workflow`.
- **Inventory Impact:** Zero inventory or allocation modification (`releaseAllocation`/`cancelAllocation` strictly not invoked).
- **Order Impact:** Zero order, item, or total mutation. Pure read-only inspection.
- **Payment Impact:** None.
- **Tax Impact:** Stored request snapshots displayed unchanged; live evaluation re-runs authoritative `TaxCalculationService::normalizeRate` and `roundHalfUp` without mutating order snapshots.
- **Accounting Impact:** None.
- **Data Migration Impact:** Zero database schema modifications (22 existing migration files unchanged).
- **Testing Impact:** Added 26 automated tests across `AdminAdjustmentQueueTest.php`, `AdminAdjustmentReviewDetailTest.php`, `AdminAdjustmentStaleStateTest.php`, and `AdminAdjustmentSecurityTest.php`. Full repository test suite at 854 tests (847 passed, 5,538 assertions, 7 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ADJ-002`.

---

### CHANGE-018: Adjustment Approval & Rejection Engine (FEAT-ADJ-003)
- **Change ID:** `CHANGE-018`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the authoritative dual-control **Adjustment Approval & Rejection Engine** (`FEAT-ADJ-003`). Establish deterministic deadlock-free row locking (`orders -> order_items ASC -> order_item_allocations ASC -> order_adjustments`), strict maker-checker segregation of duties preventing administrators from self-approving or self-rejecting requests they submitted, Super Admin emergency override requiring explicit 10-1000 character justification and dedicated `ADJUSTMENT_EMERGENCY_OVERRIDE` audit event, live state revalidation under lock (rejecting stale versions, fulfillable quantity conflicts, picking encroachments, and terminal states with 409 Conflict), deterministic duplicate decision semantics (guarded transitions returning 409 on subsequent attempts rather than idempotent replays), Case B allocation impact mandatory acknowledgment (`acknowledge_allocation_impact: true`), order `adjustment_status` maintenance (`REQUESTED` on approved, `NONE` on rejected unless earlier adjustment was `APPLIED`), strict read/decision-only boundary preserving quantities, allocations, and order financials without premature mutation (application reserved for `FEAT-ADJ-004`), accessible interactive modals (`ApproveAdjustmentModal`, `RejectAdjustmentModal`) in `Review.tsx`, and comprehensive automated testing.
- **Reason:** Guarantee transactional correctness, maker-checker compliance, allocation integrity, and financial immutability during adjustment decisioning prior to downstream execution in FEAT-ADJ-004.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (High/Critical Transactional Decision Boundary)
- **Affected PRD Requirements:** §14 (Approval & Rejection Authority), §15 (Maker-Checker Segregation), §16 (Live State Revalidation & Concurrency).
- **Affected Architecture:** §14 (Workflow Services), §15 (Lock Ordering & Deadlock Prevention), §18 (Guarded State Transitions & Dual-Control).
- **Affected Security:** Governed by `Permission::ORDER_ADJUST_APPROVE` (`order.adjust.approve`) for both approval and rejection; hard maker-checker server rejection for regular Admins; Super Admin emergency override validation; complete denial of Accountant, Salesman, Warehouse Manager, and Delivery Partner (403); structured post-commit audit logging.
- **Affected Frontend:** `resources/js/Pages/Admin/Adjustments/Review.tsx`, `resources/js/Pages/Admin/Adjustments/Partials/ApproveAdjustmentModal.tsx`, `resources/js/Pages/Admin/Adjustments/Partials/RejectAdjustmentModal.tsx`.
- **Affected Tickets:** `FEAT-ADJ-003` completed. Unlocks `FEAT-ADJ-004: Atomic Adjustment Application Engine`.
- **Inventory Impact:** Zero inventory or stock balance mutations (`inventory_movements` untouched; allocation rows preserved).
- **Order Impact:** `orders.adjustment_status` maintained as `REQUESTED` upon approval (awaiting FEAT-ADJ-004 application) and reset to `NONE` (or preserved `APPLIED`) upon rejection. Zero mutation of order quantities (`cancelled_quantity`, `reserved_quantity`) or financials (`subtotal`, `tax_total`, `grand_total`).
- **Payment Impact:** None.
- **Tax Impact:** Stored projected reductions remain immutable snapshots. Order and line tax figures remain unchanged.
- **Accounting Impact:** None.
- **Data Migration Impact:** Zero database schema modifications (22 existing migration files unchanged).
- **Testing Impact:** Added 41 automated tests across `AdminAdjustmentApprovalTest.php`, `AdminAdjustmentRejectionTest.php`, `AdminAdjustmentMakerCheckerTest.php`, and `AdminAdjustmentApprovalConcurrencyTest.php`. Full repository test suite at 895 tests (888 passed, 5,685 assertions, 7 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ADJ-003`.

### CHANGE-019: Atomic Adjustment Application Engine (FEAT-ADJ-004)
- **Change ID:** `CHANGE-019`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement the authoritative transactional **Atomic Adjustment Application Engine** (`FEAT-ADJ-004`). Establish transactional application of approved adjustments in `DB::transaction(..., 3)` enforcing canonical row lock acquisition (`orders -> order_items ASC -> order_item_allocations ASC -> order_adjustments`), live re-validation under lock (rejecting stale versions, fulfillable quantity conflicts, picked encroaching allocations, and terminal states with 409 Conflict), strict quantity conservation $\text{ordered} = \text{cancelled} + \text{fulfillable}$ (`RULE-DOM-001`), Case A unallocated reductions and Case B allocation releases, partial release mathematics preserving $0 \le \text{reserved} \le \text{allocated}$ with zero negative intermediate state ($r = \min(A, R)$), non-destructive allocation split history creating active remainder + released historical child rows with canonical sequence `ALC-{order}-{item}-{seq}` (`%02d`), deterministic release priority (`ALLOCATED` before `RESERVED`, sequence `DESC`), absolute prohibition of picked allocation release (409 Conflict), authoritative line and order financial recalculation using `TaxCalculationService` without rounding drift, immutable historical price/tax snapshots, single order version increment (+1), order `adjustment_status` transition to `APPLIED`, exactly-once application protection (409 Conflict on re-apply), Super Admin / Admin RBAC enforcement (`Permission::ORDER_ADJUST_APPLY`), accessible interactive Apply modal in `Review.tsx`, structured post-commit observability events (`ADJUSTMENT_APPLIED`, `ALLOCATION_RELEASED`, `ORDER_FINANCIALS_RECALCULATED`, `ADJUSTMENT_APPLICATION_BLOCKED`), 20 new automated feature tests across application, security, and concurrency, and direct PostgreSQL 18.6 container verification.
- **Reason:** Guarantee mathematical correctness, transactional atomicity, non-destructive history, and exactly-once execution when transforming approved adjustment requests into permanent commercial mutations.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Critical Financial & Operational Mutation Engine)
- **Affected PRD Requirements:** §14 (Approval & Application Lifecycle), §15 (Quantity Conservation), §16 (Live State Revalidation & Concurrency), §17 (Financial Recalculation).
- **Affected Architecture:** §14 (Workflow Services), §15 (Lock Ordering & Deadlock Prevention), §18 (Guarded State Transitions & Dual-Control).
- **Affected Security:** Governed by `Permission::ORDER_ADJUST_APPLY` (`order.adjust.apply`) restricted to Super Admin and Admin roles; anti-IDOR order ownership validation; complete denial of Accountant, Salesman, Warehouse Manager, and Delivery Partner (403); structured post-commit audit logging.
- **Affected Frontend:** `resources/js/Pages/Admin/Adjustments/Review.tsx`, `resources/js/Pages/Admin/Adjustments/Partials/ApplyAdjustmentModal.tsx`, `resources/js/types/order.ts`.
- **Affected Tickets:** `FEAT-ADJ-004` completed. Unlocks `FEAT-ADJ-005: Controlled Adjustment Reversals`.
- **Inventory Impact:** Zero physical warehouse inventory ledgering or bin stock movements (Phase 06 inventory deferred to `FEAT-INV-001..004`). Allocation row quantities released and preserved in non-destructive split history.
- **Order Impact:** Orders atomically mutated: `orders.version += 1`, `orders.adjustment_status = 'APPLIED'`, `orders.subtotal`, `orders.tax_total`, `orders.grand_total` recalculated authoritatively, `orders.adjustment_total` accumulates reductions. Items updated with non-destructive quantity conservation (`cancelled_quantity += R`, fulfillable reduced, `ordered_quantity` immutable).
- **Payment Impact:** None.
- **Tax Impact:** Line taxable amount, tax amount, and line totals recalculated authoritatively using `TaxCalculationService::calculateLineTax` (or `0.00` if entire line is cancelled). Historical tax snapshots (`tax_rate_snapshot`, `tax_profile_id`) preserved intact.
- **Accounting Impact:** None (GL journal entries and credit notes deferred to Phase 07/09).
- **Data Migration Impact:** Zero database schema modifications (22 existing migration files unchanged).
- **Testing Impact:** Added 20 automated tests across `AdminAdjustmentApplicationTest.php`, `AdminAdjustmentApplicationSecurityTest.php`, and `AdminAdjustmentApplicationConcurrencyTest.php`. Verified directly on live PostgreSQL 18.6 container. Full repository test suite at 915 tests (908 passed, 5,813 assertions, 7 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ADJ-004`.

---

### CHANGE-016: Adjustment Reversal Engine & Non-Destructive Forward Restoration (FEAT-ADJ-005)
- **Change ID:** `CHANGE-016`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement authoritative, atomic, and non-destructive reversal of applied order adjustments with strict LIFO order enforcement, zero fabricated reservations, historical `RELEASED` allocation immutability, and full financial and quantity restoration.
- **Reason:** Once an adjustment has been applied, customer business circumstances or warehouse restocking may require reversing the quantity reduction without corrupting historical records, violating quantity conservation, or causing rounding drift.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (High-Risk Transactional Integrity)
- **Affected PRD Requirements:** §14, §15.
- **Affected Architecture:** Technical Architecture §14, §15, §18.
- **Affected Security:** Security & Access §18, §23; RBAC `Permission::ORDER_ADJUST_REVERSE` authorized for Super Admin and Admin; maker-checker segregation enforced.
- **Affected Frontend:** `resources/js/Pages/Admin/Adjustments/Review.tsx`, `resources/js/Pages/Admin/Adjustments/Partials/ReverseAdjustmentModal.tsx`, `resources/js/types/order.ts`.
- **Affected Tickets:** `FEAT-ADJ-005` completed. Unlocks `FEAT-ADJ-006: Admin Adjustment & Exception Processing Queue`.
- **Inventory Impact:** Zero physical warehouse ledgering (Phase 06 inventory deferred to `FEAT-INV-001..004`). Forward restoration allocation records created (`ALC-{order}-{item}-{seq}`) with `allocated_quantity = affected_allocation_quantity`, `reserved_quantity = 0` (no fabricated reservation state), and warehouse code authoritatively derived from historical allocation records.
- **Order Impact:** Orders atomically mutated: `orders.version += 1`, `orders.adjustment_status = 'REVERSED'` (or `'APPLIED'` if an earlier adjustment remains applied), `orders.subtotal`, `orders.tax_total`, and `orders.grand_total` recalculated authoritatively across lines, and `orders.adjustment_total` decremented via BCMath. Items updated with non-destructive quantity conservation (`cancelled_quantity -= R`, `fulfillableQuantity()` restored, `ordered_quantity` immutable).
- **Payment Impact:** None.
- **Tax Impact:** Line taxable amount, tax amount, and line totals recalculated authoritatively using `TaxCalculationService::calculateLineTax` with historical snapshot pricing. Historical tax snapshots (`tax_rate_snapshot`, `tax_profile_id`) preserved intact.
- **Accounting Impact:** None (GL journal entries and credit notes deferred to Phase 07/09).
- **Data Migration Impact:** Migration `2026_09_06_000001_add_reversal_columns_to_order_adjustments_table.php` added nullable `reversed_by` foreign key to `users` (`nullOnDelete()`) and nullable `reversal_reason` text column.
- **Testing Impact:** Added 24 automated tests across `AdminAdjustmentReversalTest.php`, `AdminAdjustmentReversalSecurityTest.php`, and `AdminAdjustmentReversalConflictTest.php`. Verified directly against PostgreSQL 18 container. Full repository test suite at 939 tests (932 passed, 5,982 assertions, 7 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ADJ-005`.

---

### CHANGE-017: Administrative Adjustment & Exception Operational Queue (FEAT-ADJ-006)
- **Change ID:** `CHANGE-017`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect
- **Request:** Implement a dedicated administrative operational queue for pending and attention-required order adjustments (`FEAT-ADJ-006`). Extend the canonical `GET /admin/adjustments` endpoint with 7 canonical views (`attention`, `pending`, `ready_to_apply`, `applied`, `reversed`, `closed`, `all`), strict non-conflicting `READY_TO_APPLY = APPROVED AND NO ACTIVE BLOCKING CONDITION` semantics, single authoritative domain classifier `OrderAdjustmentClassifier` with priority hierarchy (`CONFLICTED` > `INELIGIBLE_LIFECYCLE` > `PICKED_ENCROACHMENT` > `STALE_VERSION`/`STALE_STATUS` > `AGING`), single-trip SQL aggregate badge counting with legacy count compatibility, multi-column search across adjustment number, order number, customer name/code, requester name/email, allowlisted sorting with deterministic `id DESC` secondary tie-breaker, bounded pagination, zero schema migrations, constant 10-query execution budget with zero N+1 scaling, strict RBAC (`Permission::ORDER_ADJUST_REVIEW`), anti-IDOR deep links, and responsive desktop dense table and mobile card UX with $\ge 44\text{px}$ touch targets.
- **Reason:** Provide administrators and operational staff with a unified, real-time triage dashboard to immediately identify, prioritize, and process adjustments requiring intervention or resolution without loading entire datasets or encountering contradictory badges.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P1` (Operational Workflows)
- **Affected PRD Requirements:** §14, §15.
- **Affected Architecture:** Technical Architecture §14, §15, §18.
- **Affected Security:** Security & Access §18, §23; RBAC `Permission::ORDER_ADJUST_REVIEW` authorized for Super Admin, Admin, and Accountant (read-only); Salesman, Warehouse Manager, and Delivery Partner denied with 403 Forbidden.
- **Affected Frontend:** `resources/js/Pages/Admin/Adjustments/Index.tsx`, `resources/js/Pages/Admin/Adjustments/Partials/AdminAdjustmentQueueTabs.tsx`, `resources/js/types/order.ts`.
- **Affected Tickets:** `FEAT-ADJ-006` completed.
- **Inventory Impact:** None. Physical warehouse stock reservation and balances deferred to Phase 06 (`FEAT-INV-001..004`).
- **Order Impact:** Read-only operational model over existing order adjustments and orders. Zero state mutations.
- **Payment Impact:** None.
- **Tax Impact:** None.
- **Accounting Impact:** None.
- **Data Migration Impact:** Zero database schema modifications (zero migrations added).
- **Testing Impact:** Added 23 targeted automated tests in `AdminAdjustmentQueueTest.php`. Full repository test suite at 952 tests (945 passed, 6,197 assertions, 7 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** None.
- **Approved By:** Principal Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** `FEAT-ADJ-006`.

### CHANGE-018: Physical Inventory Balance Foundation, Canonical Warehouse Master & Mathematical Constraints (FEAT-INV-001)
- **Change ID:** `CHANGE-018`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect
- **Request:** Establish the physical warehouse inventory foundation (`FEAT-INV-001`). Create canonical `warehouses` table seeded with default `MAIN` warehouse and partial unique default index (`2026_09_06_000002_create_warehouses_table.php`); create canonical `inventory_balances` table (`2026_09_06_000003_create_inventory_balances_table.php`) keyed on `UNIQUE (warehouse_id, product_id)` with RESTRICT foreign keys and PostgreSQL database-level CHECK constraints (`chk_inventory_balances_quantities`, `chk_inventory_balances_bounds`, `chk_inventory_balances_math`); add `Product->inventoryBalances(): HasMany` relationship; establish automatic idempotent stock initialization for new products and catalog backfill command `php artisan inventory:initialize` via `InventoryInitializationService`; implement foundational `InventoryService` providing deterministic pessimistic row-lock helper `lockBalancesForUpdate` in ascending ID order; build read-only administrative inventory workspace at `GET /admin/inventory` protected by `Permission::INVENTORY_VIEW`; provide stock status interpretation (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`), multi-column search, warehouse filtering, allowlisted sorting, bounded pagination, and responsive desktop table and mobile cards.
- **Reason:** Provide the authoritative foundation for physical warehouse stock storage, enforce mathematical stock invariants at the database boundary, and establish strict domain separation between physical inventory and commercial order allocations.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P1` (Core Operations)
- **Affected PRD Requirements:** §39.2.
- **Affected Architecture:** Technical Architecture §14, §15, §18.
- **Affected Security:** Security & Access §18, §23; RBAC `Permission::INVENTORY_VIEW` authorized for Super Admin, Admin, and Warehouse Manager; Salesman, Accountant, and Delivery Partner denied with 403 Forbidden.
- **Affected Frontend:** `resources/js/Pages/Admin/Inventory/Index.tsx`, `resources/js/types/inventory.ts`.
- **Affected Tickets:** `FEAT-INV-001` completed.
- **Inventory Impact:** Authoritative physical stock balance aggregate established with database mathematical constraints. Future stock reservation engine (`FEAT-INV-003`), movement ledgers (`FEAT-INV-004`), and manual adjustments (`FEAT-INV-006`) will operate over this foundation.
- **Order Impact:** Clear separation maintained between physical stock (`inventory_balances`) and customer fulfillment commitments (`order_item_allocations`). Zero allocation mutation.
- **Payment Impact:** None.
- **Tax Impact:** None.
- **Accounting Impact:** None.
- **Data Migration Impact:** Two new migrations: `2026_09_06_000002_create_warehouses_table.php` and `2026_09_06_000003_create_inventory_balances_table.php`.
- **Testing Impact:** Added 15 comprehensive automated tests in `InventoryFoundationTest.php` and dedicated PostgreSQL constraint test script `verify_postgres_inventory_foundation.php`. Full repository test suite at 967 tests (957 passed, 6,310 assertions, 10 skipped) passing 100%. TypeScript and Vite build clean.
- **Deployment Impact:** Run `php artisan migrate` and optional `php artisan inventory:initialize`.
- **Approved By:** Principal Software Architect
### CHANGE-015: Phase 08 Logistics, Delivery & Driver Operations Engine Implementation
- **Change ID:** `CHANGE-015`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect & Solo Developer
- **Request:** Implement complete Phase 08 delivery engine encompassing `FEAT-DEL-001` through `FEAT-DEL-008`: database schemas (`deliveries`, `delivery_items`, `delivery_events`, `delivery_failures`), assignment engine, driver mobile queue with anti-IDOR scoping, pickup confirmation with custody transfer, out-for-delivery route start, proof-of-delivery completion with physical stock relief (Model B), structured failure logging, reschedule and return-to-warehouse workflows, and administrative logistics workspace.
- **Reason:** Complete core logistics milestone enabling end-to-end delivery execution, driver mobile workflows, and physical stock relief without phantom stock or reconciliation discrepancies.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P0` (Phase 08 Section Milestone)
- **Affected PRD Requirements:** Document 01 §38.
- **Affected Architecture:** Document 02 §16.
- **Affected Security:** Document 03 §14.
- **Affected Frontend:** Document 04 §15.
- **Affected Tickets:** `FEAT-DEL-001`, `FEAT-DEL-002`, `FEAT-DEL-003`, `FEAT-DEL-004`, `FEAT-DEL-005`, `FEAT-DEL-006`, `FEAT-DEL-007`, `FEAT-DEL-008`.
- **Inventory Impact:** Strictly enforces Model B: Physical stock remains in warehouse `reserved` balance throughout driver custody until `DELIVERED`, which executes `on_hand -= Q`, `reserved -= Q`, and writes an immutable `DISPATCH` entry to `inventory_movements`. Return to warehouse resets allocation `dispatched_quantity = 0` and preserves reserved warehouse balance.
- **Order Impact:** Synchronizes order `fulfillment_status` (`DISPATCHED`, `DELIVERED`, `RESERVED`) and independent `delivery_status` dimension (`ASSIGNED`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, `RESCHEDULED`, `RETURNED_TO_WAREHOUSE`).
- **Payment Impact:** None.
- **Tax Impact:** None.
- **Accounting Impact:** Prepares clean transaction records for Phase 09 invoicing and revenue recognition upon delivery.
- **Data Migration Impact:** Migrations `2026_09_06_000008_create_deliveries_table.php`, `2026_09_06_000009_create_delivery_items_table.php`, `2026_09_06_000010_create_delivery_events_and_failures_tables.php`.
- **Testing Impact:** Added 80 automated delivery feature tests. Full test suite: 1,144 tests (1,134 passed, 7,282 assertions, 10 skipped). Frontend built cleanly with zero errors.
- **Deployment Impact:** Run `php artisan migrate`.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Commits `6b497dd`, `03a9f55`, `bb535e0`, `2ee3d7e`, `2c9e904`, `3fdb764`, `2547a8e`, `f34df41`, `760594e`.

---

### CHANGE-016: Phase 09 Invoicing, Credit Notes & Receipts (Documents & PDF Engine) Implementation
- **Change ID:** `CHANGE-016`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect & Solo Developer
- **Request:** Implement complete Phase 09 document and tax invoice engine encompassing `FEAT-DOC-001` through `FEAT-DOC-004`: database schemas (`invoices`, `invoice_items`, `invoice_number_seq`), atomic invoice generator from order snapshots, zero product images rule enforcement, responsive HTML and print CSS presentation, headless Chromium vector PDF pipeline with disk caching and binary streaming download, dual-layer immutability triggers and model event guards, and administrative index and detail workspaces.
- **Reason:** Complete core financial document milestone providing legally compliant, immutable tax invoices with exact point-in-time commercial snapshots and zero retroactive drift.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P0` (Phase 09 Section Milestone)
- **Affected PRD Requirements:** Document 01 §17.
- **Affected Architecture:** Document 02 §17.
- **Affected Security:** Document 03 §15.
- **Affected Frontend:** Document 04 §16.
- **Affected Tickets:** `FEAT-DOC-001`, `FEAT-DOC-002`, `FEAT-DOC-003`, `FEAT-DOC-004`.
- **Inventory Impact:** None. Invoices record historical financial values derived from fulfilled order snapshots without mutating stock balances.
- **Order Impact:** Orders are linked to invoices via `order_id` (1-to-1). Invoices snapshot all order line items, tax profiles, unit prices, quantities, and totals.
- **Payment Impact:** Invoices track `amount_paid`, `amount_due`, and `payment_status` as allowed operational fields without mutating commercial totals.
- **Tax Impact:** Line-level tax amounts, rates, and tax profile codes are snapshotted permanently on `invoice_items`.
- **Accounting Impact:** Provides the immutable document source for general ledger receivables and revenue recognition.
- **Data Migration Impact:** Migrations `2026_09_06_000011_create_invoices_and_invoice_items_tables.php` and `2026_09_06_000012_create_invoice_immutability_triggers.php`.
- **Testing Impact:** Added 34 automated document tests across generation, print presentation, PDF streaming, and trigger immutability. Full test suite: 1,178 tests (1,168 passed, 7,380 assertions, 10 skipped). TypeScript check and Vite build 100% clean.
- **Deployment Impact:** Run `php artisan migrate`. Ensure Chrome/Chromium executable or Node Puppeteer is available in runtime environment for vector PDF downloads.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Commits `3126b3e`, `baf8610`, `1ce50e5`, `78824c5`, `1e698e2`.

---

### CHANGE-017: Implementation of Returns & Warehouse Return Operations Section (FEAT-RET-001 through FEAT-RET-004)
- **Change ID:** `CHANGE-017`
- **Date:** September 6, 2026
- **Requested By:** Principal Software Architect & Solo Developer
- **Request:** Implement complete Phase 09.5 Returns & Reverse Logistics subsystem encompassing `FEAT-RET-001` through `FEAT-RET-004`: database schemas (`return_requests`, `return_request_items`, `return_request_events`, `return_number_seq`), server-side authoritative returnable quantity mathematics $\max(0, \text{delivered} - (\text{returned} + \text{pending}))$, warehouse physical inspection workflow with server-validated JPEG/PNG evidence, approval and disposition conservation engine ($\text{accepted\_good} + \text{accepted\_damaged} + \text{rejected} = \text{received} \le \text{requested}$), maker-checker segregation of duties (`approver != requester`), atomic physical inventory movement ledger execution (`InventoryMovementType::RETURN`, `from_state=EXTERNAL`), allocation returned quantity synchronization (`order_items.returned_quantity` and `order_item_allocations.returned_quantity`), admin/salesman controllers and Inertia/React operational interfaces (`Index.tsx`, `Create.tsx`, `Show.tsx`, `InspectReturnModal.tsx`, `ApproveReturnModal.tsx`), and strict financial boundary preservation (zero premature credit notes or GL entries).
- **Reason:** Complete core reverse-logistics milestone providing deterministic stock recovery and commercial tracking for customer merchandise returns without inventory or financial corruption.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P0` (Phase 09.5 Section Milestone)
- **Affected PRD Requirements:** Document 01 §16.
- **Affected Architecture:** Document 02 §16.5.
- **Affected Security:** Document 03 §14.5.
- **Affected Frontend:** Document 04 §15.5.
- **Affected Tickets:** `FEAT-RET-001`, `FEAT-RET-002`, `FEAT-RET-003`, `FEAT-RET-004`.
- **Inventory Impact:** Accepted good items restore warehouse physical stock (`on_hand += Q`, `available += Q`); accepted damaged items increment damaged quarantine (`on_hand += Q`, `damaged += Q`). Immutable `InventoryMovement` records written.
- **Order Impact:** Order items and item allocations track `returned_quantity += Q`, strictly bounded by `delivered_quantity`. Original `ordered_quantity` and baseline allocations preserved non-destructively.
- **Payment Impact:** None. Payments remain historically immutable.
- **Tax Impact:** Returns snapshot historical unit prices, tax rates, and line totals for credit eligibility without retroactive tax calculation drift.
- **Accounting Impact:** Prepares clean credit eligibility figures for future `FEAT-CR-001` without posting premature GL journals.
- **Data Migration Impact:** Migration `2026_09_07_000001_create_return_requests_and_items_tables.php` creating tables, foreign keys, sequence `return_number_seq`, and PostgreSQL check constraints.
- **Testing Impact:** Added 23 targeted feature and concurrency tests across return request creation, inspection, approval disposition, inventory movement, and race-condition serialization. Total test suite: 1,201 tests (1,191 passed, 7,453 assertions, 10 skipped). TypeScript check and Vite production build 100% clean.
- **Deployment Impact:** Run `php artisan migrate`.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Commits on branch `feature/SECTION-RET-001-004-returns`.

### CHANGE-018: Resource Scope Enforcement & Authorization Penetration Suite (FEAT-RBAC-003 & QA-002)
- **Change ID:** `CHANGE-018`
- **Date:** September 6, 2026
- **Requested By:** Lead Software Architect & Security Lead
- **Request:** Implement centralized cross-domain resource scoping (`ResourceScopeService`), comprehensive model policy enforcement (`CustomerPolicy`, `OrderPolicy`, `OrderAdjustmentPolicy`, `DeliveryPolicy`, `ReturnRequestPolicy`, `PaymentPolicy`, `InvoicePolicy`, `InventoryBalancePolicy`, `StockExceptionPolicy`), `Gate::before` delegation for instance scopes, fail-closed 404 anti-IDOR protection, and 42 penetration tests across Categories A through L.
- **Reason:** Guarantee zero client trust, server-side resource scoping, fail-closed 404 defense against ID enumeration, segregation of duties (maker-checker), parent-child nested resource integrity, and role boundary isolation across all 11 active domains.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P0` (Security & Authorization Prerequisite)
- **Affected PRD Requirements:** Document 01 §7.3, §38.
- **Affected Architecture:** Document 02 §7.3, §8.
- **Affected Security:** Document 03 §4, §5, §6, §7.
- **Affected Frontend:** Document 04 §4.
- **Affected Tickets:** `FEAT-RBAC-003`, `QA-002`.
- **Inventory Impact:** Stock adjustments and exceptions strictly scoped to authorized warehouse personnel; unauthorized roles blocked with 403.
- **Order Impact:** Salesmen strictly scoped to assigned orders and drafts; cross-salesman lookups fail-closed with 404 Not Found.
- **Payment Impact:** Payment viewing and recording strictly scoped; verification restricted to Accountant/Admin with maker-checker self-verification prevention.
- **Tax Impact:** None.
- **Accounting Impact:** General ledger access restricted to Accountant/Admin; operational staff denied.
- **Data Migration Impact:** None. Pure security and policy architecture.
- **Testing Impact:** Added 42 penetration tests (`tests/Feature/Auth/AuthorizationScopeTest.php`) across Categories A through L. Total test suite: 1,243 tests (1,233 passed, 7,547 assertions, 10 skipped).
- **Deployment Impact:** None.
### CHANGE-019: Customer Credits & Refunds Implementation (FEAT-CR-001 through FEAT-CR-005)
- **Change ID:** `CHANGE-019`
- **Date:** September 7, 2026
- **Requested By:** Lead Software Architect & Financial Systems Lead
- **Request:** Implement complete Phase 10 Customer Credits & Refunds domain including Credit Eligibility Calculation Engine (`CreditEligibilityService`), Credit Note Generation & Historical Immutability (`CreditNote`, `CreditNoteItem`, `CreditNoteGeneratorService`), Customer Refund Request Flow (`RefundWorkflowService`), Maker-Checker Segregation of Duties (`RefundRequestPolicy`), and Authoritative Refund Processing with Double-Refund Concurrency Prevention (`RefundProcessingTest`, `RefundConcurrencyTest`, `RefundIdempotencyTest`).
- **Reason:** Provide authoritative financial settlement mechanisms for approved merchandise returns without mutating historical invoices, preventing premature General Ledger postings, enforcing segregation of duties between requester and approver, and guaranteeing race-free balance deduction under high concurrency.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P0` (Financial Integrity Prerequisite)
- **Affected PRD Requirements:** Document 01 §23, §24, §25.
- **Affected Architecture:** Document 02 §10, §12.
- **Affected Security:** Document 03 §4, §5, §6 (Segregation of Duties).
- **Affected Frontend:** Document 04 §6 (Credits and Refunds Workspaces).
- **Affected Tickets:** `FEAT-CR-001`, `FEAT-CR-002`, `FEAT-CR-003`, `FEAT-CR-004`, `FEAT-CR-005`.
- **Inventory Impact:** Zero stock mutation (stock handled earlier in returns domain).
- **Order Impact:** Zero historical invoice mutation; originating orders linked via credit notes.
- **Payment Impact:** Disbursed refunds recorded as immutable `refund_transactions` (`RTX-YYYY-XXXXXX`) with `CASH`, `CHEQUE`, or `MONEY_ORDER` methods.
- **Tax Impact:** Credit notes snapshot line item taxable amounts and taxes at historical return snapshot time using BCMath.
- **Accounting Impact:** Credit notes and refunds prepared for authoritative GL mapping without premature unapproved journal posting.
- **Data Migration Impact:** Migrations `2026_09_06_000004_create_credit_notes_tables.php` and `2026_09_06_000005_create_refund_requests_tables.php` creating `credit_notes`, `credit_note_items`, `refund_requests`, `refund_request_events`, and `refund_transactions`.
- **Testing Impact:** Added 36 targeted automated feature, concurrency, idempotency, and PostgreSQL constraint tests across `tests/Feature/Credit/*` and `tests/Feature/Refund/*`. Total repository test suite: 1,279 tests (1,269 passed, 7,702 assertions, 10 skipped).
### CHANGE-020: Accounts Receivable Sub-Ledger, Aging & Customer Statements (FEAT-AR-001 through FEAT-AR-003)
- **Change ID:** `CHANGE-020`
- **Date:** September 7, 2026
- **Requested By:** Lead Software Architect & Financial Systems Lead
- **Request:** Implement complete Phase 11 Accounts Receivable customer sub-ledger domain including append-only immutable transaction entries (`ReceivableTransaction`, `ReceivableLedgerService`), aging exposure buckets (`ReceivableAgingService`), chronological customer statement generation (`CustomerStatementService`), invoice charge integration, verified payment and reversal integration, credit note posting, and non-double-counting refund integration.
- **Reason:** Provide an authoritative, immutable customer accounts receivable sub-ledger that separates receivable balance from available customer credit entitlement, calculates exact aging exposure based on invoice payment terms, and generates reproducible customer account statements without altering historical financial transactions.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P0` (Financial Integrity Prerequisite)
- **Affected PRD Requirements:** Document 01 §25, §26.
- **Affected Architecture:** Document 02 §10, §12.
- **Affected Security:** Document 03 §4, §5, §6 (Resource Scope & Anti-IDOR).
- **Affected Frontend:** Document 04 §6 (Accounts Receivable & Statements Workspaces).
- **Affected Tickets:** `FEAT-AR-001`, `FEAT-AR-002`, `FEAT-AR-003`.
- **Inventory Impact:** None.
- **Order Impact:** Orders linked via invoices to accounts receivable charges.
- **Payment Impact:** Verified payments post credits; payment reversals post compensating debits; unverified payments do not alter receivables.
- **Tax Impact:** Invoices snapshot tax totals onto AR debit lines at historical generation time.
- **Accounting Impact:** AR sub-ledger serves as customer-level subsidiary ledger for General Ledger integration in Phase 12.
- **Data Migration Impact:** Migration `2026_09_09_000001_create_receivable_transactions_table.php` creating `receivable_transactions`, sequence `receivable_transaction_number_seq`, and PostgreSQL immutability trigger `trg_protect_receivable_transactions`.
- **Testing Impact:** Added 26 targeted automated feature, aging, statement, concurrency, and PostgreSQL constraint tests across `tests/Feature/Receivable/*`. Total repository test suite: 1,305 tests (1,295 passed, 7,788 assertions, 10 skipped).
- **Deployment Impact:** None.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Commits on branch `feature/SECTION-AR-001-003-receivables`.

---

### CHANGE-012: Supplier Payables Foundation Sub-Ledger & Vendor Master (FEAT-AP-001)
- **Change ID:** `CHANGE-012`
- **Date:** September 7, 2026
- **Requested By:** Principal Software Architect
- **Request:** Establish the foundational accounts payable domain: `suppliers` master entity with `SUP-{00000X}` sequential codes, `supplier_bills` with draft/posted lifecycles, `supplier_payments` with partial payment and reversal workflows, and immutable `payable_transactions` sub-ledger with PostgreSQL sequence `payable_transaction_number_seq` (`AP-{YEAR}-{00000X}`).
- **Reason:** Provide an authoritative, immutable financial sub-ledger for tracking supplier liabilities, vendor bill settlements, payment reversals, and outstanding balances without prematurely expanding into full procurement or General Ledger journal postings.
- **Status:** `APPROVED & IMPLEMENTED`
- **Priority:** `P1` (Financial Core Spine)
- **Affected PRD Requirements:** Document 01 §26, §27.
- **Affected Architecture:** Document 02 §25 (Sub-Ledger Architecture).
- **Affected Security:** Document 03 §4, §5, §6 (Resource Scope, Permissions `payable.view`, `payable.manage`, and Anti-IDOR).
- **Affected Frontend:** Document 04 §6 (Accounts Payable & Vendor Workspaces).
- **Affected Tickets:** `FEAT-AP-001`.
- **Inventory Impact:** None (Strict inventory boundary: physical receipts do not automatically create financial liabilities without authoritative vendor bill).
- **Order Impact:** None (Customer sales orders isolated from supplier payables).
- **Payment Impact:** Supported supplier payment methods (`BANK_TRANSFER`, `CHEQUE`, `CASH`, `MONEY_ORDER`); payments decrease liability; reversals restore liability.
- **Tax Impact:** Supplier bills capture itemized subtotal and tax amounts with exact BCMath precision.
- **Accounting Impact:** AP sub-ledger serves as supplier-level subsidiary ledger for General Ledger integration in Phase 13.
- **Data Migration Impact:** Migration `2026_09_10_000001_create_suppliers_and_payables_tables.php` creating `suppliers`, `supplier_bills`, `supplier_payments`, `payable_transactions`, sequences `supplier_code_seq`, `supplier_bill_number_seq`, `supplier_payment_number_seq`, `payable_transaction_number_seq`, and PostgreSQL immutability trigger `trg_protect_payable_transactions`.
- **Testing Impact:** Added 27 targeted automated feature, integration, concurrency, security, and PostgreSQL constraint tests across `tests/Feature/Payable/*`. Total repository test suite: 1,332 tests (1,320 passed, 7,921 assertions, 12 skipped).
- **Deployment Impact:** None.
### CHANGE-015: Phase 14 Reporting & Analytics Implementation (FEAT-REP-001 through FEAT-REP-006)
- **Change ID:** `CHANGE-015`
- **Date:** September 7, 2026
- **Requested By:** Lead Software Architect & Solo Developer
- **Request:** Implement Phase 14 Operational Reporting and Financial Analytics covering Sales Reports (`FEAT-REP-001`), Customer Reports (`FEAT-REP-002`), Salesman Performance & Commission Reports (`FEAT-REP-003`), Inventory Reports (`FEAT-REP-004`), Delivery Performance & Turnaround Reports (`FEAT-REP-005`), and Financial Accounting Reports (`FEAT-REP-006`).
- **Reason:** Provide comprehensive, server-authoritative, read-only derived reporting workspaces across sales, customer balances/aging, salesman performance, inventory valuation/movement, delivery turnaround, and executive financial summaries with 100% mathematical reconciliation with Phase 13 General Ledger accounting services.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD Section 11 (Reporting & Analytics).
- **Affected Architecture:** Technical Architecture Section 11 (Reporting & Analytics).
- **Affected Security:** Security & Access Section 11 (Role-scoped access, ResourceScopeService enforcement, cost price masking for unauthorized roles, default-deny RBAC).
- **Affected Frontend:** Frontend Spec Section 11 (Unified Reporting Workspace in Inertia React with shadcn/ui).
- **Affected Tickets:** `FEAT-REP-001`, `FEAT-REP-002`, `FEAT-REP-003`, `FEAT-REP-004`, `FEAT-REP-005`, `FEAT-REP-006`.
- **Inventory Impact:** None (Read-only queries; strictly preserves immutable movement ledger and cost valuation).
- **Order Impact:** None (Read-only operational sales aggregations with status filters and drill-downs).
- **Payment Impact:** None (Consumes existing authoritative AR sub-ledger and payment tables).
- **Tax Impact:** None (Consumes transaction-time snapshotted tax totals).
- **Accounting Impact:** None (100% direct consumption of Phase 13 ACC services: `TrialBalanceService`, `ProfitAndLossService`, `BalanceSheetService`, `GeneralLedgerService`, `CashReconciliationService`).
- **Data Migration Impact:** Zero migrations required (pure read-only query engine).
- **Testing Impact:** Added 32 targeted automated tests across `tests/Feature/Reporting/*`. Total repository test suite: 1,403 tests (1,391 passed, 8,220 assertions, 12 skipped, 0 failures).
- **Deployment Impact:** None.
- **Approved By:** Lead Software Architect
- **Release/Commit Reference:** Commits on branch `feature/FEAT-REP-001-006-reporting`.

### CHANGE-016: Phase 15 Notifications & Auditing Implementation
- **Change ID:** `CHANGE-016`
- **Date:** September 7, 2026
- **Requested By:** Lead Software Architect & Solo Developer
- **Request:** Implement Phase 15 Notifications & Auditing (`FEAT-NOTIF-001` through `FEAT-AUD-004`), providing in-app operational action notifications, user-scoped notification preferences, structured business audit event logging, dedicated security logging, PostgreSQL/Eloquent audit immutability triggers, and a responsive user activity timeline UI.
- **Reason:** Guarantee immutable audit compliance for all commercial and security transactions, and provide a real-time operational alert mechanism for workflows and approvals.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0`
- **Affected PRD Requirements:** PRD Section 11 (Notifications & Auditing).
- **Affected Architecture:** Technical Architecture Section 11 (Audit Trail & Notification Subsystems).
- **Affected Security:** Security Document Section 8 (Audit Logging & Immutability).
- **Affected Frontend:** Frontend Specification Document 04 (Shared Header Notification Bell, Notification Center, Notification Preferences, Activity Timeline, Security Logs).
- **Affected Tickets:** `FEAT-NOTIF-001`, `FEAT-NOTIF-002`, `FEAT-AUD-001`, `FEAT-AUD-002`, `FEAT-AUD-003`, `FEAT-AUD-004`.
- **Inventory Impact:** None (Audit events logged alongside movements).
- **Order Impact:** None (Order mutations emit audit events and in-app action notifications).
- **Payment Impact:** None (Payment milestones emit audit events and notifications).
- **Tax Impact:** None.
- **Accounting Impact:** None.
- **Data Migration Impact:** 3 migrations added creating `audit_logs`, `security_logs`, `in_app_notifications`, `notification_preferences`, and PostgreSQL/SQLite immutability triggers.
- **Testing Impact:** 40 new targeted automated tests across `tests/Feature/Notification/*` and `tests/Feature/Audit/*`. Total repository test suite: 1,443 tests (1,431 passed, 8,358 assertions, 12 skipped, 0 failures).
- **Deployment Impact:** None.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Feature branch `feature/FEAT-NOTIF-AUD-001-004`.

### CHANGE-018: Phase 16 UI Foundation & Portal Shells Architecture
- **Change ID:** `CHANGE-018`
- **Date:** September 7, 2026
- **Requested By:** Principal Frontend Architect & Solo Developer
- **Request:** Implement the canonical frontend architecture for Admin Portal Shell (`UI-003`), Salesman Portal Shell (`UI-004`), Delivery Partner Portal Shell (`UI-005`), Responsive Table System (`UI-006`), and Unified Form State System (`UI-007`).
- **Reason:** Provide robust, role-isolated, accessible, and responsive user interfaces conforming strictly to Document 04 ("Premium B2B Commerce × Modern SaaS ERP") while enforcing zero client trust and operational financial safety.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Phase 16 Baseline)
- **Affected PRD Requirements:** Document 01 Section 12 (Frontend & Portal Experience).
- **Affected Architecture:** Document 02 Section 12 (Frontend Architectural Layer).
- **Affected Security:** Document 03 Section 2 & 7 (Zero Client Trust & Scoped Portal Navigation).
- **Affected Frontend:** Document 04 (Design Tokens, Responsive Breakpoint Contracts, Table System, Form State System).
- **Affected Tickets:** `UI-003`, `UI-004`, `UI-005`, `UI-006`, `UI-007`.
- **Inventory Impact:** None (Safe quantity inputs enforce bounds).
- **Order Impact:** None (Order mutations handled via safe submit primitives).
- **Payment Impact:** None (Payment forms utilize bounds and financial inputs).
- **Tax Impact:** None.
- **Accounting Impact:** None.
- **Data Migration Impact:** None.
- **Testing Impact:** `npm run type-check` (0 errors), `npm run build` (successful compilation), full PHPUnit test suite 100% passing (1,431 passed, 8,358 assertions, 0 failures).
- **Deployment Impact:** None.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Feature branch `feature/UI-003-007-portal-ux-foundation`.

### CHANGE-019: Phase 17 Flagship Responsive Order Creation & Width Matrix QA
- **Change ID:** `CHANGE-019`
- **Date:** September 7, 2026
- **Requested By:** Principal Frontend Architect & Solo Developer
- **Request:** Implement the flagship responsive Order Creation workflow (`UI-009`) across Mobile ($320\text{px}-430\text{px}$), Tablet ($768\text{px}-1023\text{px}$), and Desktop ($1024\text{px}+$ split-workspace); perform comprehensive application-wide responsive width matrix verification (`UI-010`) across 10 standard viewports; implement non-production manual testing seed infrastructure (`ManualTestingSeeder.php`), test credentials reference (`docs/MANUAL_TEST_CREDENTIALS.md`), and manual QA execution guide (`docs/MANUAL_TESTING_GUIDE.md`).
- **Reason:** Guarantee a premier, robust, and accessible ordering experience for mobile field salesmen and desktop backoffice users while providing comprehensive supporting QA infrastructure for manual and automated validation without compromising zero client trust or server authority.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Phase 17 Baseline)
- **Affected PRD Requirements:** Document 01 Section 6 (Order Lifecycle) & Section 12 (Frontend & UX).
- **Affected Architecture:** Document 02 Section 6 (Ordering Subsystem) & Section 12 (Frontend Architecture).
- **Affected Security:** Document 03 Section 2 (Zero Client Trust) & Section 7 (Territory Resource Scoping).
- **Affected Frontend:** Document 04 Section 3 (Responsive Design System) & Section 6 (Salesman Portal Flows).
- **Affected Tickets:** `UI-009`, `UI-010`.
- **Inventory Impact:** None (All allocations and reservations remain authoritatively server-calculated).
- **Order Impact:** Enhanced responsive wizard with sticky summary panel and draft persistence.
- **Payment Impact:** Preserved V1 Cash, Cheque, and Money Order evidence upload flows.
- **Tax Impact:** None (Zero client trust preview with server-authoritative recalculation).
- **Accounting Impact:** None.
- **Data Migration Impact:** None.
- **Testing Impact:** `ManualTestingSeeder.php` verified idempotent; `npm run type-check` (0 errors); `npm run build` (clean bundle in 3.60s); PHPUnit test suite 100% passing (1,431 passed, 8,358 assertions, 0 failures).
- **Deployment Impact:** Production environment guard ensures `ManualTestingSeeder` aborts if invoked in production.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Feature branch `feature/UI-009-010-responsive-order-flow`.

### CHANGE-020: Wave 1 Operational, Role, Responsive & Accessibility Hardening
- **Change ID:** `CHANGE-020`
- **Date:** September 8, 2026
- **Requested By:** Principal Product Architect & QA Lead
- **Request:** Implement Wave 1 operational, role, responsive, and input quality hardening resolving `BUG-001` (Salesman payment navigation/badge scoping), `BUG-002` (Credit Notes navigation discoverability), `BUG-004` (General Ledger & Trial Balance responsive mobile presentation `< 768px`), `BUG-005` (Price Override modal focus trap & keyboard accessibility), and `BUG-008` (Delivery POD signature smoothness via quadratic bezier canvas interpolation).
- **Reason:** Guarantee strict maker-checker segregation of duties (`RULE-PAY-004`), ensure discoverability of credit note workflows for accounting roles, eliminate mobile horizontal overflow on GL and Trial Balance financial pages, guarantee WCAG 2.1 AA keyboard accessibility, and deliver smooth high-DPI signature drawing on delivery tablets/smartphones.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Wave 1 Master Roadmap)
- **Affected PRD Requirements:** Document 01 Section 7 (Payments & Collections), Section 11 (General Ledger & Accounting), Section 12 (Frontend & UX), Section 8 (Delivery Operations).
- **Affected Architecture:** Document 02 Section 7 (Payment Architecture), Section 11 (Accounting Subsystem), Section 12 (Frontend Architecture).
- **Affected Security:** Document 03 Section 2 (Zero Client Trust), Section 3 (RBAC & Permissions), Section 7 (Resource Scoping & Anti-IDOR).
- **Affected Frontend:** Document 04 Section 3 (Design Tokens & Responsive Breakpoints), Section 4 (Component Standards & Accessibility), Section 5 (Admin Portal Layout), Section 6 (Salesman Flow), Section 8 (Delivery Flow).
- **Affected Tickets:** `BUG-001`, `BUG-002`, `BUG-004`, `BUG-005`, `BUG-008`.
- **Inventory Impact:** None.
- **Order Impact:** Enhanced price override request dialog accessibility in salesman order flow.
- **Payment Impact:** Scoped unverified badge queries to actor assigned customers; hidden admin verification hub from salesman.
- **Tax Impact:** None.
- **Accounting Impact:** Added responsive mobile breakdown for GL and Trial Balance; exposed Credit Notes in sidebar for Admin/Super Admin/Accountant.
- **Data Migration Impact:** None.
- **Release/Commit Reference:** Feature branch `feature/WAVE-1-operational-hardening-20260908`.

### CHANGE-021: Wave 2 UX, Polish & Consistency Hardening
- **Change ID:** `CHANGE-021`
- **Date:** September 8, 2026
- **Requested By:** Principal Product Architect & QA Lead
- **Request:** Implement Wave 2 UX polish, visual feedback, and consistency hardening resolving `BUG-003` (React 19 dev-mode timing warning documentation), `BUG-006` (Customer Statement quick date-range presets), `BUG-007` (Product Image uploader drag-over visual feedback), `BUG-009` (Inventory Exception and adjustment select token normalization), and `BUG-010` (Tax Profile percentage formatting consistency).
- **Reason:** Provide one-click accounting period selection for AR customer statements, eliminate dragzone highlight ambiguity during product catalog uploads, normalize select dropdown height/padding tokens across warehouse workspaces, ensure consistent tax percentage display without destroying backend precision, and document React 19 dev timing behavior.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (Wave 2 Master Roadmap)
- **Affected PRD Requirements:** Document 01 Section 7 (Accounts Receivable), Section 10 (Inventory & Warehouse Management), Section 11 (General Ledger & Accounting), Section 12 (Frontend & UX).
- **Affected Architecture:** Document 02 Section 11 (Accounting Subsystem), Section 12 (Frontend Architecture).
- **Affected Security:** Document 03 Section 2 (Zero Client Trust), Section 3 (RBAC & Permissions).
- **Affected Frontend:** Document 04 Section 3 (Design Tokens & Responsive Breakpoints), Section 4 (Component Standards), Section 5 (Admin Portal Layout), Section 7 (Product Management).
- **Affected Tickets:** `BUG-003`, `BUG-006`, `BUG-007`, `BUG-009`, `BUG-010`.
- **Inventory Impact:** None.
- **Order Impact:** None.
- **Payment Impact:** None.
- **Tax Impact:** Standardized percentage display formatting (`formatTaxPercentage`) without mutating stored `DECIMAL(7,4)` rates.
- **Accounting Impact:** Added quick preset date filters ("This Month", "Last 30 Days", "Year to Date", "All Time") to Customer Statement view.
- **Data Migration Impact:** None.
- **Testing Impact:** `Wave2UXPolishTest.php` created (3 tests, 78 assertions); full test suite passing (1,475 tests, 1,463 passed, 12 skipped, 8,637 assertions, 0 failures); `npm run type-check` (0 errors); `npm run build` (clean bundle in 2.86s).
- **Deployment Impact:** None.
- **Approved By:** Lead Software Architect
### CHANGE-022: QA Wave 1 Core Security & Commerce Hardening
- **Change ID:** `CHANGE-022`
- **Date:** September 8, 2026
- **Requested By:** Principal Product Architect & QA Lead
- **Request:** Implement and formalize dedicated E2E test suites for `QA-001` (Authentication Test Suite), `QA-003` (Order Lifecycle E2E Test Suite), and `QA-004` (Order Adjustment E2E Test Suite) against live database transactions.
- **Reason:** Guarantee end-to-end correctness of authentication flows, salesman order creation, multi-line tax snapshotting, independent Admin & Super Admin approvals, stock-insufficient blockers, non-destructive quantity adjustments, maker-checker segregation, and allocation splitting.
- **Status:** `APPROVED & COMPLETED`
- **Priority:** `P0` (QA Wave 1 Master Roadmap)
- **Affected PRD Requirements:** Document 01 Section 1 (Auth & Multi-Portal Access), Section 4 (Pricing & Taxes), Section 5 (Order Capture & Processing), Section 6 (Order Lifecycle & Approval).
- **Affected Architecture:** Document 02 Section 2 (Authentication & Session), Section 5 (Order Domain), Section 6 (Adjustment Domain).
- **Affected Security:** Document 03 Section 2 (Zero Client Trust), Section 3 (RBAC & Permissions), Section 7 (Resource Scoping & Anti-IDOR).
- **Affected Frontend:** Document 04 Section 5 (Admin Portal Layout), Section 6 (Salesman Flow).
- **Affected Tickets:** `QA-001`, `QA-003`, `QA-004`.
- **Inventory Impact:** Verified physical stock reservation and domain allocation release on order adjustments without inventory balance corruption.
- **Order Impact:** Verified draft persistence, multi-line tax snapshotting, order submission idempotency, independent Admin/Super Admin approvals, and non-destructive quantity adjustments (`ordered = cancelled + fulfillable`).
- **Payment Impact:** None.
- **Tax Impact:** Verified line-item tax snapshotting and authoritative tax recalculation on adjustments.
- **Accounting Impact:** None.
- **Data Migration Impact:** None.
- **Testing Impact:** `QA001AuthenticationTest.php` (10 tests, 31 assertions), `QA003OrderLifecycleE2ETest.php` (10 tests, 89 assertions), and `QA004OrderAdjustmentE2ETest.php` (8 tests, 78 assertions) added; full test suite passing (1,503 tests, 1,491 passed, 12 skipped, 8,835 assertions, 0 failures); `npm run type-check` (0 errors); `npm run build` (clean bundle in 3.03s).
- **Deployment Impact:** None.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Feature branch `feature/QA-WAVE-1-core-commerce-20260908`.

---

### CHANGE-032: Post-Order Balance Payment Recording & Evidence Inspection across Admin and Salesman Portals
- **Change ID:** `CHANGE-032`
- **Date:** October 2, 2026
- **Requested By:** Lead Software Architect
- **Request:** Enable salesmen and administrative personnel to record post-order balance payments (Cash, Cheque, Money Order) directly from Order Detail workspaces (`/admin/orders/{id}` and `/salesman/orders/{id}`) with aggregate row-locking overpayment protection and evidence previews.
- **Reason:** Real-world commercial distribution requires recording partial or full balance collections as customer payments arrive post-order placement, while guaranteeing zero client trust and full server-side overpayment prevention.
- **Status:** `IMPLEMENTED`
- **Priority:** `P1`
- **Affected PRD Requirements:** Section 4.5 (Payment & Financial Workflow), Section 4.6 (Salesman Portal).
- **Affected Architecture:** Section 5 (Payment Domain Services & Concurrency Locking Hierarchy).
- **Affected Security:** Section 2 (Zero Client Trust), Section 3 (RBAC & Permissions), Section 7 (Anti-IDOR Portfolio Scoping).
- **Affected Frontend:** Admin Order Show Workspace (`Admin/Orders/Show.tsx`), Salesman Order Show Workspace (`Salesman/Orders/Show.tsx`), `RecordOrderPaymentModal.tsx`.
- **Affected Tickets:** `FEAT-PAY-001`, `FEAT-PAY-002`, `FEAT-PAY-003`, `FEAT-ORD-005`.
- **Inventory Impact:** None.
- **Order Impact:** Order financial summaries reflect verified paid, pending verification, and outstanding balance in real time; order lifecycle validation prevents payments against `DRAFT`, `CANCELLED`, or `REJECTED` orders.
- **Payment Impact:** `PaymentService` enforces server-side aggregate row-locks (`lockForUpdate()`) to strictly block payment amounts exceeding remaining outstanding order balance.
- **Tax Impact:** None.
- **Accounting Impact:** Payments create immutable ledger entries upon authorized verification.
- **Data Migration Impact:** None (existing schema supports order-linked payments).
- **Testing Impact:** `OrderBalancePaymentTest.php` (7 tests, 20 assertions) added; 75 payment tests passing (207 assertions); 221 order tests passing (1,858 assertions); `npm run type-check` (0 errors); `npm run build` (clean build).
- **Deployment Impact:** None.
- **Approved By:** Lead Software Architect
- **Implementation Status:** Complete and verified.
- **Release/Commit Reference:** Feature branch `feature/post-order-balance-payments`.

---

## 3. Template for Future Change Requests

```markdown
### CHANGE-XXX: [Descriptive Title]
- **Change ID:** `CHANGE-XXX`
- **Date:** YYYY-MM-DD
- **Requested By:** [Client / Product Owner / Technical Lead]
- **Request:** [Concise description of the requested modification]
- **Reason:** [Business or technical justification]
- **Status:** [`REQUESTED` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `IMPLEMENTED`]
- **Priority:** [`P0` | `P1` | `P2` | `P3`]
- **Affected PRD Requirements:** [Sections in Document 01 affected]
- **Affected Architecture:** [Sections in Document 02 affected]
- **Affected Security:** [Sections in Document 03 affected]
- **Affected Frontend:** [Screens / components in Document 04 affected]
- **Affected Tickets:** [Existing tickets modified or new tickets created]
- **Inventory Impact:** [Impact on reservations, stock states, or movements]
- **Order Impact:** [Impact on order lifecycle, item allocations, or adjustments]
- **Payment Impact:** [Impact on payment methods, evidence, or verification]
- **Tax Impact:** [Impact on line-item tax calculation or snapshots]
- **Accounting Impact:** [Impact on chart of accounts or journal entries]
- **Data Migration Impact:** [Database schema changes, data backfill requirements]
- **Testing Impact:** [New tests or regression suites required]
- **Deployment Impact:** [Infrastructure or CI/CD adjustments required]
- **Approved By:** [Client / Architect Name]
- **Implementation Status:** [Pending / In-Progress / Complete]
- **Release/Commit Reference:** [Git commit hash or release tag]
```
