# AI_CONTEXT.md — High-Signal Project Snapshot

## Wholesale Distribution Management System

**Document Version:** 1.0  
**Last Verified:** September 4, 2026  
**Purpose:** Compact, high-signal operational snapshot for rapid AI agent orientation.

---

## 1. Project Overview

- **Project Name:** Wholesale Distribution Management System (Working title; configurable/replaceable)
- **Domain:** B2B Wholesale Distribution, ERP, Logistics & Financial Accounting
- **Initial Scale:** 500–700 wholesale customers, scaling to thousands
- **Currency:** USD ($)
- **Primary Market:** United States
- **Target Audience:** Solo Full-Stack Developer + AI Coding Agents (Antigravity/Claude/Gemini)

---

## 2. Core Architecture Baseline

- **Architecture Style:** Modular Monolith (Shared Transactional Core)
- **Backend Framework:** Laravel 13 (PHP 8.5)
- **Frontend Framework:** React 19.2 + TypeScript + Inertia 3
- **Styling & UI:** Tailwind CSS 4 + shadcn/ui + Vite
- **Primary Database:** PostgreSQL 18 (Authoritative transactional source of truth)
- **Cache / Queues:** Redis (ElastiCache in production)
- **File / Object Storage:** Amazon S3 (Private storage with short-lived presigned URLs)
- **Document / PDF Rendering:** Chromium-based PDF renderer (e.g. Browsershot / Puppeteer)
- **Observability & Error Tracking:** Sentry + AWS CloudWatch
- **Infrastructure:** AWS EC2 (initially) / Docker Compose (local development)

---

## 3. Application Surfaces & Portals

The system provides three dedicated user portals and two operational role scopes over **ONE shared transaction core**:

1. **Admin Portal (`/admin/*`):** Operational Control Center for reviewing orders, approving adjustments, managing inventory exceptions, coordinating delivery, and reconciling payments.
2. **Salesman Portal (`/salesman/*`):** Mobile-first sales workspace for catalog browsing, price selection within allowed ranges, order creation, payment recording, and evidence upload.
3. **Delivery Partner Portal (`/delivery/*`):** Task-first logistics workspace for assigned delivery acceptance, pickup, out-for-delivery, proof of delivery, and failure reporting.
4. **Warehouse Manager (Operational Scope):** Stock fulfillment, reservation confirmation, physical stock exceptions, and inventory movement logging.
5. **Accountant (Permissioned Scope):** Payment verification, receivable aging, credit notes, refunds, and double-entry general ledger journal posting.

---

## 4. End-to-End Operational Workflow

```text
Salesman (Order Creation)
   ↓
Admin (Review & Approval)
   ↓
Warehouse (Stock Reservation & Exception Handling)
   ↓
Delivery (Assignment, Dispatch & Proof of Delivery)
   ↓
Customer (Fulfillment, Invoicing & Receivables)
```

Independent transaction streams proceed in parallel:
- **Payments:** Recorded at any phase (Pre-pay, Cash on Delivery, Terms).
- **Invoices:** Rendered on demand from immutable historical line snapshots (NO product images).
- **Adjustments:** Handled via explicit non-destructive adjustment records.

---

## 5. Core Domains & Responsibilities

| Domain | Key Entities & Responsibilities |
|---|---|
| **Identity & Access** | `users`, `roles`, `permissions`, `sessions` (RBAC, MFA, resource scoping) |
| **Customers** | `customers`, credit limits, payment terms, assigned salesmen, outstanding balances |
| **Salesmen** | `salesmen`, customer assignment scoping, commission tracking |
| **Products & Categories** | `products`, `categories`, cost price, list price (MRP), default selling price, minimum price |
| **Pricing & Tax** | Price boundaries (`min <= price <= mrp`), product-specific tax profiles, line-item tax snapshots |
| **Orders** | `orders`, `order_items`, independent lifecycle states (order, fulfillment, payment, delivery) |
| **Allocations & Adjustments** | `order_item_allocations`, `order_adjustments`, partial cancellation without destroying original qty |
| **Inventory & Warehouse** | `inventory_balances` (on hand, reserved, available, damaged), `inventory_movements` ledger |
| **Payments** | `payments` (Cash, Cheque, Money Order), `payment_evidence` (JPEG only, private S3) |
| **Invoices / Documents** | `invoices`, `invoice_items`, server-side PDF generation, strictly NO product images |
| **Delivery** | `delivery_assignments`, assigned driver queue, delivery attempts, failure logging |
| **Returns & Credits** | `returns`, inspection, accepted/rejected quantities, `credit_notes`, refund approval |
| **Receivables & Payables** | Customer statements, 0-30/31-60/61-90/90+ day aging, supplier billing |
| **Accounting** | Chart of accounts, `journal_entries`, `journal_lines`, double-entry immutability |
| **Audit & Activity** | Immutable business audit log (`audit_logs`) and security log |

---

## 6. Critical Business Invariants (Top Rules)

1. **RULE-DOM-001 (Non-Destructive Quantities):** Never overwrite `ordered_quantity` when cancelling, adjusting, or returning items.
2. **RULE-ORD-002 (Order Adjustments):** Post-order modifications require explicit `order_adjustments` records.
3. **RULE-PRI-001 & RULE-TAX-002 (Immutable Snapshots):** Historical order line price and tax snapshots are permanently preserved.
4. **RULE-PRI-002 (Price Bounds):** `minimum_allowed_price <= actual_order_price <= mrp/list_price` enforced server-side.
5. **RULE-TAX-001 (Product-Specific Tax):** Tax is line-item specific; multiple rates and exemptions exist within a single order.
6. **RULE-PAY-001 (Payment Methods):** V1 supports Cash, Cheque, and Money Order only.
7. **RULE-PAY-002 (Payment Evidence):** Cheque and Money Order require mandatory JPEG uploads stored privately in S3.
8. **RULE-DOC-001 (Invoice Images):** **Product images must NEVER appear on invoices.**
9. **RULE-INV-001 (Transactional Reservation):** Inventory reservations use row-level locking (`SELECT FOR UPDATE`); available stock cannot be negative.
10. **RULE-ACC-001 (Accounting Immutability):** Posted general ledger entries are never deleted; corrections use reversing journals.
11. **RULE-SEC-001 (Server Authority):** The frontend is never a security boundary. All validations and permissions are server-enforced.

---

## 7. Current Project Status (Actual Repository State)

- **Completed Tickets:** **128 / 128** (**100.0%**)
- **Active Milestone Gate:** Full Roadmap Implementation Complete (Master Quality Assurance, Security & Production Readiness)
- **Automated Tests:** 1,644 tests, 9,729 assertions passing + full QA test suites (QA-001..010, TECH-QA-001) implemented
- **Current Active Ticket:** `ALL 128 BACKLOG TICKETS COMPLETE`
- **Pending Milestones:** Full verification & staging deployment gates

---

## 8. Frontend Engineering & Developer Tooling Notes

### React 19 Development-Mode `startTime` Performance Warning (`BUG-003`)
- **Symptom:** Browser console may intermittently show `Cannot read properties of undefined (reading 'startTime')` during rapid multi-tab navigation or Vite HMR re-renders in local development.
- **Root Cause & Origin:** React 19 development bundle (`react-dom-client.development.js`) internal performance timing instrumentation attempting to access `performance.getEntriesByName` timing markers.
- **Production Status:** Completely eliminated and stripped in production builds (`npm run build`). Production bundles are 100% unaffected.
- **Diagnostic Triage:**
  - *Dev Noise (Ignore):* Call stack originates inside `react-dom-client.development.js` or React scheduler timing hooks with no broken component state or application failure.
  - *Real Defect (Investigate):* TypeError points to an application file in `resources/js/*`, causes an ErrorBoundary trigger, or reproduces in a production build (`npm run build`).

### Inertia Mutation HTTP Response Contract (`CHANGE-040`)
- **Core Rule:** Every Inertia mutation (`router.post`, `router.put`, `router.patch`, `router.delete`, `useForm().post`, etc.) MUST receive an Inertia-compatible response (such as `redirect()->back()->with('success', ...)` or redirect to a route).
- **Anti-Pattern:** Never return `response()->json(...)` when `$request->header('X-Inertia')` is present. Doing so causes Inertia's client-side modal error: *"All Inertia requests must receive a valid Inertia response, however a plain JSON response was received."*
- **Standard Controller Guard:** To support dual Inertia and API access, use `if ($request->wantsJson() && ! $request->header('X-Inertia'))` for JSON responses, defaulting to redirects for web/Inertia requests.




