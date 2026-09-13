# PROJECT_CHECKLIST.md — Master Completion Checklist

## Wholesale Distribution Management System

**Document Version:** 1.0  
**Last Updated:** September 4, 2026  
**Status Legend:**
- `[ ]` Not started
- `[~]` In progress
- `[x]` Verified complete (Satisfies acceptance criteria, tests passed, reviewed)
- `[!]` Blocked (Requires resolution of dependency or open decision)

---

## 1. PROJECT OPERATING SYSTEM & GOVERNANCE

### Authoritative Specifications
- [x] Document 01 — Product Requirements Document (`PRD v1.0`)
- [x] Document 02 — Technical Architecture Document (`TAD v1.0`)
- [x] Document 03 — Security & Access Document (`SAD v1.0`)
- [x] Document 04 — Frontend Specification (`UX v1.0`)
- [x] Document 05 — Feature Ticket List (`Backlog v1.0`)

### Control & Governance Layer
- [x] `AGENTS.md` (AI Engineering Constitution)
- [x] `CLAUDE.md` (Claude Adapter)
- [x] `GEMINI.md` (Gemini Adapter)
- [x] `docs/AI_CONTEXT.md` (High-Signal Project Snapshot)
- [x] `docs/PROJECT_RULES.md` (Software & Business Rules Constitution)
- [x] `docs/DEVELOPMENT_FLOW.md` (Canonical Execution Workflow)
- [x] `docs/BUILD_PHASES.md` (Authoritative Implementation Roadmap)
- [x] `docs/PROJECT_CHECKLIST.md` (Master Completion Checklist)
- [x] `docs/PROJECT_STATUS.md` (Living Project Status)
- [x] `docs/DECISION_LOG.md` (Durable Architectural Decision Memory)
- [x] `docs/CHANGE_LOG.md` (Change Impact Assessment & Log)
- [x] `docs/TEST_MATRIX.md` (Master Test Coverage Matrix)
- [x] `docs/reports/PHASE_REPORT_TEMPLATE.md` (Standard Phase Completion Template)

---

## 2. FOUNDATION & ARCHITECTURE

- [x] `TECH-FOUND-001`: Repository & Laravel 13 / React 19 / Inertia 3 / Vite Bootstrap
- [x] `TECH-FOUND-002`: PostgreSQL 18 Database Connectivity, Migrations & Testing Setup
- [x] `TECH-FOUND-003`: Global Error Handling & Secure Structured Logging Foundation
- [x] `TECH-FOUND-004`: Redis Cache & Queue Infrastructure Setup

---

## 3. IDENTITY, AUTHENTICATION & ACCESS CONTROL (AUTH & RBAC)

### Authentication
- [x] `FEAT-AUTH-001`: Centralized Multi-Portal Login & Throttling
- [x] `FEAT-AUTH-002`: Logout & Session Revocation
- [x] `FEAT-AUTH-003`: Secure Password Reset Flow
- [x] `FEAT-AUTH-004`: Privileged Multi-Factor Authentication (MFA)

### Roles & Permissions
- [x] `FEAT-RBAC-001`: Role Model (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`, `SALESMAN`, `WAREHOUSE_MANAGER`, `DELIVERY_PARTNER`)
- [x] `FEAT-RBAC-002`: Server-Side Permission Registry (`module.action` default-deny)
- [x] `FEAT-RBAC-003`: Resource Scope Enforcement (Centralized `ResourceScopeService`, model policies, scoped query builders, fail-closed 404 anti-IDOR enforcement)

---

## 4. SYSTEM & MASTER DATA MANAGEMENT

### System Configuration
- [x] `FEAT-SYS-001`: Configurable Application Identity (Metadata, dynamic product title)
- [x] `FEAT-SYS-002`: Company Settings & Branding Profile

### Customer Management
- [x] `FEAT-CUS-001`: Customer CRUD Operations
- [x] `FEAT-CUS-002`: Customer Assignment & Scoping to Salesmen
- [x] `FEAT-CUS-003`: Customer Profile, Outstanding Balance & Credit Limit View
- [x] `FEAT-CUS-004`: Customer Lifecycle Controls (`ACTIVE`, `ON_HOLD`, `INACTIVE`)

### Salesman Management
- [x] `FEAT-SLM-001`: Salesman Account Management & Lifecycle
- [x] `FEAT-SLM-002`: Salesman Scoped Customer Access Enforcement

### Product & Category Management
- [x] `FEAT-PROD-001`: Product Master CRUD (SKU, cost, default selling, minimum price, MRP)
- [x] `FEAT-PROD-002`: Product Image Upload & Storage (Private S3)
- [x] `FEAT-PROD-003`: Product Lifecycle Controls (`ACTIVE`, `INACTIVE`)
- [x] `FEAT-CAT-001`: Product Category Management & Hierarchy

---

## 5. COMMERCE: PRICING & PRODUCT-SPECIFIC TAX

### Pricing
- [x] `FEAT-PRICE-001`: Price Boundary Constraint Enforcement (`min_price <= order_price <= mrp`)
- [x] `FEAT-PRICE-002`: Authorized Price Override Engine with Auditing

### Product-Specific Tax
- [x] `FEAT-TAX-001`: Product-Specific Tax Profile Engine & Order-Line Snapshot

---

## 6. ORDERING WORKFLOWS

### Salesman Ordering
- [x] `FEAT-ORD-001`: Salesman Order Creation Flow (Customer select, catalogue browse, add to cart)
- [x] `FEAT-ORD-002`: Draft Order Persistence & Resumption
- [x] `FEAT-ORD-003`: Order Line Quantity Stepper & Validation Controls
- [x] `FEAT-ORD-004`: Order Review, Line Tax Breakdown & Financial Summary
- [x] `FEAT-ORD-005`: Order Submission Idempotency Enforcement
- [x] `FEAT-ORD-006`: Salesman Order History & Multi-State Timeline

### Admin Order Operations
- [x] `FEAT-ORD-010`: Admin Operational Order Queues (`New Orders`, `Needs Attention`, `Processing`, `Delivery`, `Adjustments`, `Completed`, `Cancelled`, `All Orders`)
- [x] `FEAT-ORD-011`: New Order Review Workspace
- [x] `FEAT-ORD-012`: Order Approval / Rejection Workflow with Audit
- [x] `FEAT-ORD-013`: Order Detail Master Workspace

---

## 7. OPERATIONS: ALLOCATION, ADJUSTMENTS & INVENTORY

### Quantity Allocation
- [x] `FEAT-ALLOC-001`: Order Item Quantity Allocation Model (`ordered`, `cancelled`, `reserved`, `delivered`, `returned`)
- [x] `FEAT-ALLOC-002`: Quantity Conservation & Allocation Validation Constraints

### Order Adjustments
- [x] `FEAT-ADJ-001`: Order Adjustment Request Flow (Salesman / Warehouse exception)
- [x] `FEAT-ADJ-002`: Adjustment Review Workspace with Real-Time Financial & Tax Impact Preview
- [x] `FEAT-ADJ-003`: Adjustment Approval / Rejection Workflow (Authoritative decision boundary, deterministic lock ordering, maker-checker segregation, Super Admin emergency override, Case B allocation acknowledgment, zero application mutations, 41 automated tests)
- [x] `FEAT-ADJ-004`: Atomic Adjustment Application Engine (Authoritative transactional execution engine, deterministic row locking, Case A unallocated reductions and Case B allocation releases, partial release mathematics, non-destructive allocation split history, authoritative line/order financial recalculation, 20 automated tests)
- [x] `FEAT-ADJ-005`: Controlled Adjustment Reversals (Authoritative reversal engine, strictly APPLIED -> REVERSED state machine, canonical deadlock-free row locks orders -> items -> allocations -> adjustments, strict deterministic LIFO reversal order enforcement, Case A unallocated restoration, Case B non-destructive forward restoration allocation with zero reservation fabrication, immutable historical RELEASED preservation, authoritative line & order financial recalculation, version increment +1, maker-checker segregation & Super Admin emergency override, anti-IDOR checks, accessible ReverseAdjustmentModal, 24 targeted automated tests across core, security, and concurrency suites, 932 full repository tests passing, PostgreSQL 18 verified)
- [x] `FEAT-ADJ-006`: Admin Adjustment & Exception Processing Queue (Dedicated operational queue at `GET /admin/adjustments`, 7 canonical views [`attention`, `pending`, `ready_to_apply`, `applied`, `reversed`, `closed`, `all`], strict `READY_TO_APPLY` non-conflicting semantics excluding blocked records, single authoritative domain classifier `OrderAdjustmentClassifier` with priority precedence `CONFLICTED` > `INELIGIBLE_LIFECYCLE` > `PICKED_ENCROACHMENT` > `STALE_VERSION`/`STALE_STATUS` > `AGING` [>24h], single SQL aggregate badge query with zero duplicate counts, multi-column search, allowlisted sort with `id DESC` tie-breaker, bounded pagination, zero schema migrations, constant 10-query budget with zero N+1 scaling, strict RBAC, anti-IDOR deep links, responsive table/card layout, 23 new automated tests, 945 full repository tests passing 100%)

### Inventory & Warehouse
- [x] `FEAT-INV-001`: Inventory Item & Stock Balance Foundations (Canonical `warehouses` table with default `MAIN` and partial unique default index, canonical `inventory_balances` table keyed on `UNIQUE (warehouse_id, product_id)` with RESTRICT foreign keys, PostgreSQL CHECK constraints enforcing non-negativity, bounds `reserved + damaged <= on_hand`, and formula `available = on_hand - reserved - damaged`, Product `inventoryBalances()` HasMany relation, idempotent automatic stock initialization on product creation, idempotent catalog backfill via `php artisan inventory:initialize` and `InventoryInitializationService`, deterministic row lock helper `InventoryService::lockBalancesForUpdate` ordered by ID ASC, read-only administrative workspace `GET /admin/inventory` protected by `Permission::INVENTORY_VIEW`, stock status indicators `IN_STOCK`/`LOW_STOCK`/`OUT_OF_STOCK`, multi-column search, bounded pagination, 15 comprehensive automated tests, 967 full repository tests passing 100%, PostgreSQL 18 verified)
- [x] `FEAT-INV-002`: Four-Tier Stock Representation (`On Hand`, `Reserved`, `Available`, `Damaged`) (Strict multi-tier physical stock representation, dedicated detail workspace at `GET /admin/inventory/{inventoryBalance}`, commercial coverage analytics, composition proportions, active order commitments table, responsive UI)
- [x] `FEAT-INV-003`: Pessimistic Locking Stock Reservation Engine (`SELECT FOR UPDATE`) (Authoritative physical stock reservation engine inside `StockReservationService`, atomic order approval reservation and rejection release, deterministic ascending lock ordering, strict `InsufficientStockException`, 14 comprehensive tests)
- [x] `FEAT-INV-004`: Immutable Stock Movement History Ledger (Canonical `inventory_movements` table with database and model-level mutation blocks preventing UPDATE/DELETE, authoritative `recordMovement()`, physical snapshot tracking, dedicated movement history table in Show.tsx, 10 comprehensive tests)
- [x] `FEAT-INV-005`: Warehouse Stock Exception Reporting Flow (Dedicated stock exception reporting and review queue at `GET /admin/inventory-exceptions`, automatic quarantine of damaged goods from `AVAILABLE` or `RESERVED` to `DAMAGED`, authoritative resolution and dismissal with optional quarantine reversion, strict RBAC, 6 comprehensive tests)
- [x] `FEAT-INV-006`: Authorized Inventory Balance Adjustments (Authorized direct physical stock adjustment engine for `INCREASE_ON_HAND`, `DECREASE_ON_HAND`, `TRANSFER_TO_DAMAGED`, `DAMAGE_DISPOSAL`, optimistic concurrency version check + pessimistic row lock, movement ledger link, direct modal in Show.tsx, 12 comprehensive tests)

---

## 8. FINANCIAL TRANSACTIONS & DOCUMENTS

### Payments & Payment Evidence
- [x] `FEAT-PAY-001`: Payment Entity & Multi-Method Domain Model (`CASH`, `CHEQUE`, `MONEY_ORDER`)
- [x] `FEAT-PAY-002`: Cash Payment Entry Flow
- [x] `FEAT-PAY-003`: Cheque Payment Entry Flow
- [x] `FEAT-PAY-004`: Money Order Payment Entry Flow
- [x] `FEAT-PAY-005`: Payment Evidence Upload & Server-Side JPEG Magic-Byte Verification
- [x] `FEAT-PAY-006`: Payment Evidence Preview with Secure Presigned URLs
- [x] `FEAT-PAY-007`: Payment Verification & Reconciliation Workflow
- [x] `FEAT-PAY-008`: Payment Rejection & Correction Flow
- [x] `FEAT-PAY-009`: Payment Reversal & Bounced Cheque Operational Flow

### Invoices & Documents
- [x] `FEAT-DOC-001`: Invoice Generation Engine from Historical Line Snapshots
- [x] `FEAT-DOC-002`: Invoice Print & HTML Presentation (Strictly NO product images)
- [x] `FEAT-DOC-003`: Server-Side Invoice PDF Download Pipeline
- [x] `FEAT-DOC-004`: Historical Document Immutability Protection

---

## 9. LOGISTICS, RETURNS & CREDITS

### Delivery Operations
- [x] `FEAT-DEL-001`: Delivery Assignment Engine & Driver Work Allocation
- [x] `FEAT-DEL-002`: Delivery Partner Mobile Assigned Queue
- [x] `FEAT-DEL-003`: Warehouse Pickup Confirmation
- [x] `FEAT-DEL-004`: Out-for-Delivery State Transition
- [x] `FEAT-DEL-005`: Delivery Completion & Proof of Delivery
- [x] `FEAT-DEL-006`: Delivery Failure Logging with Structured Reason Codes
- [x] `FEAT-DEL-007`: Delivery Reschedule & Return-to-Warehouse Workflow
- [x] `FEAT-DEL-008`: Delivery History & Tracking Audit

### Returns
- [x] `FEAT-RET-001`: Return Request Creation (Linked to delivered orders)
- [x] `FEAT-RET-002`: Return Review & Warehouse Physical Inspection
- [x] `FEAT-RET-003`: Return Approval & Good/Damaged Stock Disposition
- [x] `FEAT-RET-004`: Return Inventory Movement Ledger Execution

### Credits & Refunds
- [x] `FEAT-CR-001`: Customer Credit Eligibility Calculation Engine
- [x] `FEAT-CR-002`: Credit Note Generation (`CR-XXXXXX`)
- [x] `FEAT-CR-003`: Customer Refund Request Flow
- [x] `FEAT-CR-004`: Refund Approval Workflow (Segregation of duties)
- [x] `FEAT-CR-005`: Refund Processing & Double-Refund Prevention

---

## 10. FINANCE, RECEIVABLES & GENERAL LEDGER ACCOUNTING

### Receivables & Payables
- [x] `FEAT-AR-001`: Customer Receivable Transaction Ledger (Append-only immutable AR ledger, PostgreSQL sequence AR-{YYYY}-{SEQ}, duplicate posting prevention, invoice charge, verified payment, payment reversal, and credit note integration, refund non-double-counting, 26 targeted automated tests)
- [x] `FEAT-AR-002`: Accounts Receivable Aging Buckets (0-30, 31-60, 61-90, 90+ days past authoritative Invoice::due_date, fully/partially paid invoice accounting, customer credit balance separation)
- [x] `FEAT-AR-003`: Chronological Customer Statement Generation (Statement date filtering, opening balance aggregation, deterministic transaction_date/id order, running balance reconciliation, available credit summary, print stylesheet)
- [x] `FEAT-AP-001`: Supplier Payables Foundation (Immutable accounts payable ledger `payable_transactions`, PostgreSQL sequences `AP-{YYYY}-{SEQ}`, `SUP-{SEQ}`, `BILL-{YYYY}-{SEQ}`, `SP-{YYYY}-{SEQ}`, draft/posted supplier bills, partial payments, overpayment rejection, payment reversals with restored liabilities, DB immutability triggers, RBAC-003 scoping, Admin UI workspaces, 27 targeted automated tests)

### Accounting Foundations
- [x] `FEAT-ACC-001`: Standard Chart of Accounts Setup (Hierarchical accounts table, 17 standard GAAP accounts seeded, cycle detection, system account protection, normal balance types, AccountService, 9 targeted tests)
- [x] `FEAT-ACC-002`: Double-Entry Journal Entry Foundation (PostgreSQL sequence `JE-{YYYY}-{SEQ}`, `journal_entries`, `journal_lines`, double-entry constraint SUM(debit)=SUM(credit), DB trigger immutability protection, JournalService, 6 targeted tests)
- [x] `FEAT-ACC-003`: Business Event-to-Journal Automated Mapping Engine (Deterministic automated posting from Invoices, Payments, Reversals, Credit Notes, Refunds, Supplier Bills, Supplier Payments, COGS, Stock Adjustments, sync unposted events, JournalMappingService, 5 targeted tests)
- [x] `FEAT-ACC-004`: General Ledger Inquiry & Drill-Down (Account statement generation, opening balance calculation, running balances, date filtering, pagination, GeneralLedgerService, 2 targeted tests)
- [x] `FEAT-ACC-005`: Trial Balance Report Generation (Debit/credit equality verification, category breakdowns, net balances, TrialBalanceService, 1 targeted test)
- [x] `FEAT-ACC-006`: Profit & Loss (Income Statement) Report Generation (Operating revenue, contra-revenue discounts, COGS, gross profit, operating expenses, net income, ProfitAndLossService, 1 targeted test)
- [x] `FEAT-ACC-007`: Balance Sheet Report Generation (Assets, liabilities, equity, current net earnings, Assets = Liabilities + Equity verification, BalanceSheetService, 1 targeted test)
- [x] `FEAT-ACC-008`: Controlled Accounting Reversals (Journal entry immutability, equal & opposite offsetting entries, audit lineage, single reversal constraint, JournalReversalService, 2 targeted tests)
- [x] `FEAT-ACC-009`: Cash Collection Shift Reconciliation (GL Cash vs operational verified receipts & disbursements, discrepancy detection, reconciliation sessions, CashReconciliationService, 2 targeted tests)

---

## 11. REPORTING, NOTIFICATIONS & AUDITING

### Reporting & Analytics
- [x] `FEAT-REP-001`: Sales Reports (Daily, periodic, by customer, by product)
- [x] `FEAT-REP-002`: Customer Reports (Balances, purchase frequency, aging)
- [x] `FEAT-REP-003`: Salesman Performance & Commission Reports
- [x] `FEAT-REP-004`: Inventory Reports (Valuation, movement, low stock alerts)
- [x] `FEAT-REP-005`: Delivery Performance & Turnaround Reports
- [x] `FEAT-REP-006`: Financial Accounting Reports

### Notifications & Auditing
- [x] `FEAT-NOTIF-001`: In-App Operational Action Notifications (User-scoped action alerts, deterministic deduplication, read state, role broadcasts, popover feed, deep-link actions, 6 targeted tests)
- [x] `FEAT-NOTIF-002`: Notification Preferences Architecture (User-configurable categories: ORDERS, PAYMENTS, INVENTORY, DELIVERY, RETURNS; mandatory non-disableable categories: SECURITY, SYSTEM; preference query & updates, 6 targeted tests)
- [x] `FEAT-AUD-001`: Business Audit Event Logger (Append-only `audit_logs` table, AuditLogService, recursive sensitive metadata scrubbing, entity audit history, 3 targeted tests)
- [x] `FEAT-AUD-002`: Security Event Logging Channel (Dedicated `security_logs` table, SecurityLogService, severity classification, context secret redaction, external log integration, 3 targeted tests)
- [x] `FEAT-AUD-003`: Audit Table Immutability Enforcement (Eloquent updating/deleting DomainException guards, PostgreSQL triggers `trg_protect_audit_logs` & `trg_protect_security_logs`, SQLite compatibility triggers, 8 targeted tests)
- [x] `FEAT-AUD-004`: User Activity Timeline UI (Responsive Activity Timeline, hybrid dense table & mobile vertical timeline, module color badges, date/search/actor filters, sanitized JSON context modal, security logs dashboard, 4 targeted tests)

---

## 12. DESIGN SYSTEM & USER INTERFACES

### Historical Foundation (SUPERSEDED / RETIRED)
- [x] `UI-001`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Design Tokens Implementation (Legacy foundation retired)
- [x] `UI-002`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Core shadcn/ui Component Library Tailoring (Rebuilt with semantic token primitives)
- [x] `UI-003`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Admin Portal Shell (Rebuilt with Zero Black anchor & Ghost Green active navigation)
- [x] `UI-004`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Salesman Portal Shell (Rebuilt with Zero Black dock & Ghost Green active states)
- [x] `UI-005`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Delivery Partner Portal Shell (Rebuilt with Zero Black shell & Ghost Green indicators)
- [x] `UI-006`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Responsive Table System (Rebuilt with structured neutral canvas & Ghost Green selection)
- [x] `UI-007`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Unified Form State System (Rebuilt with Quantum Blue focus rings & semantic validation)
- [x] `UI-008`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Payment Evidence Upload & Preview UI Component (Migrated to unified visual system)
- [x] `UI-009`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Order Creation Mobile/Tablet Flow (Migrated to unified visual system)
- [x] `UI-010`: [SUPERSEDED — REBUILT UNDER NEW VISUAL SYSTEM] Responsive QA Width Matrix Verification (Preserved across 320px–1920px under new visual system)

### Authoritative Unified Design System Foundation (ACTIVE)
- [x] `UI-FOUND-V2`: Ground-Up Presentation Rebuild (Level 1: Zero Black `#050505`, Level 2: Ghost Green `#D7FFE0` / `#063312`, Level 3: Selective Quantum Blue `#2457FF`, Level 4: Structured Neutral Canvas `#F8F9FA`, Invariant Business Semantic Statuses)
- [x] `UI-SHELL-V2`: Unified Multi-Portal Shell Architecture (Admin, Salesman, Delivery, Warehouse, Accountant, Super Admin)
- [x] `UI-PRIMITIVES-V2`: Semantic Component Library (Buttons, Badges, Cards, Inputs, Tables, Modals, Badges, Tabs)

---

## 13. QUALITY ASSURANCE, SECURITY & PERFORMANCE

- [x] `QA-001`: Authentication Test Suite (10 tests in QA001AuthenticationTest.php, valid login, anti-enumeration, rate throttling, logout, session revocation, single-use password reset, suspended accounts, portal isolation, zero credential leakage)
- [x] `QA-002`: Authorization & IDOR Penetration Test Suite (42 penetration tests, Categories A through L, 100% passing)
- [x] `QA-003`: Order Lifecycle E2E Test Suite (10 tests in QA003OrderLifecycleE2ETest.php, salesman customer scoping, draft lifecycle, pricing boundaries, multi-line tax snapshotting, submission idempotency, independent Admin & Super Admin approval, stock-insufficient blockers, role authorization, zero cost-price leakage)
- [x] `QA-004`: Order Adjustment E2E Test Suite (8 tests in QA004OrderAdjustmentE2ETest.php, salesman request flow, over-reduction validation, maker-checker segregation, Case A unallocated reduction, Case B allocation split & release, duplicate apply idempotency, reversal engine, stale version detection)
- [ ] `QA-005`: Inventory Concurrency & Race-Condition Test Suite
- [ ] `QA-006`: Payment Evidence Storage Security Test Suite
- [ ] `QA-007`: Payment & Refund Financial Integrity Test Suite
- [ ] `QA-008`: General Ledger Accounting Integrity Test Suite
- [ ] `QA-009`: Responsive Layout Regression Test Suite
- [ ] `QA-010`: Accessibility Baseline Audit (WCAG 2.1 AA)
- [ ] `TECH-QA-001`: Database Query Optimization & Pagination Performance Baseline

---

## 14. DEPLOYMENT & PRODUCTION READINESS

- [ ] `DEPLOY-001`: Staging Environment Configuration
- [ ] `DEPLOY-002`: Production AWS Infrastructure Baseline (EC2, RDS PostgreSQL, ElastiCache, S3)
- [x] `DEPLOY-003`: GitHub Actions CI/CD Pipeline Configuration (Foundation CI pipeline implemented)
- [ ] `DEPLOY-004`: Disaster Recovery, Automated Backups & Restore Verification
- [ ] `DEPLOY-005`: Production Security Hardening Checklist (HTTPS, SSL Labs A+, least privilege)

---

## 15. ROADMAP HARDENING PASSES

### Wave 1: Operational, Role, Responsive & Accessibility Hardening
- [x] `BUG-001`: Payment Navigation & Scoped Badge Count (Salesman maker-checker isolation, user-scoped query counts)
- [x] `BUG-002`: Credit Notes Navigation Discoverability (Sidebar link for Admin/Super Admin/Accountant, Enum options method)
- [x] `BUG-004`: GL & Trial Balance Mobile Presentation (Responsive stacked cards `< 768px`, desktop table preserved)
- [x] `BUG-005`: Price Override Modal Accessibility (WCAG 2.1 AA focus trap, autoFocus, Tab cycle, Escape dismiss, focus return)
- [x] `BUG-008`: Delivery Signature Canvas Smoothness (Quadratic bezier curve midpoint interpolation, high-DPI scaling)

### Wave 2: UX, Polish & Consistency Hardening
- [x] `BUG-003`: React 19 Dev Timing Warning Guidance (Documented dev-mode performance timing in AI_CONTEXT.md)
- [x] `BUG-006`: Customer Statement Quick Date Range Presets (One-click presets helper and responsive pill filters)
- [x] `BUG-007`: Product Image Uploader Drag-Over Feedback (Dynamic border-primary/bg-primary/5 visual state)
- [x] `BUG-009`: Inventory Exception & Adjustment Select Normalization (Normalized h-9/px-3/py-1 select tokens)
- [x] `BUG-010`: Tax Profile Percentage Display Formatting (formatTaxPercentage helper preserving DECIMAL(7,4) precision)


