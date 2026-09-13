# Permanent Parallel Automated Testing Architecture & Governance Specification
## Wholesale Distribution Management System — Unique Distributors

**Document Version:** 1.0  
**Effective Date:** September 12, 2026  
**Audience:** Antigravity AI Agent, Principal Software Architects, QA Engineers, DevOps Engineers  
**Core Directive:** Deterministic, Sharded Parallel Test Automation with Zero False Passes

---

## 1. System Overview & Architectural Model

The Unique Distributors Parallel Automated Testing Platform provides high-throughput, repeatable, and machine-verifiable quality assurance across the entire enterprise modular monolith.

```text
                             Antigravity / Gemini Orchestrator
                                           ↓
                      Central Test Plan & Shard Allocator
                                           ↓
 ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
 │                                         │                                         │
 ▼                                         ▼                                         ▼
[Worker Group 1: Backend]     [Worker Group 2: Playwright]       [Worker Group 3: Financial/Visual]
- Domain Invariants (PHPUnit) - Shard 1: Auth & Catalog (Chrome) - Golden Scenario (PostgreSQL)
- API & Security Matrix       - Shard 2: Orders & Payments       - Visual Baselines
- Database Foreign Keys       - Shard 3: AR/AP & Delivery        - Responsive Matrix (12 Viewports)
- In-Memory SQLite Isolation  - Shard 4: Security & Reports      - Keyboard Accessibility
 └─────────────────────────────────────────┼─────────────────────────────────────────┘
                                           ↓
                               Machine-Readable Outputs
                    (JUnit, Playwright JSON, PostgreSQL Logs)
                                           ↓
                         Central Result Aggregator Engine
                      (`scripts/aggregate-parallel-results.js`)
                                           ↓
 ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
 │                                         │                                         │
 ▼                                         ▼                                         ▼
[`final-results.json`]             [`coverage-summary.json`]           [`failures.json`]
(Authoritative Full Contract)     (909/909 Coverage Check)           (Failed Tests for Triage)
                                           ↓
                             Authoritative Coverage Gate
                         (`scripts/validate-coverage-gate.js`)
                                           ↓
                              AI Failure Triage Engine
                            (`scripts/ai-failure-triage.js`)
                                           ↓
                             Targeted Failure Rerun Loop
                            (`scripts/rerun-failed-tests.js`)
```

---

## 2. Multi-Layer Parallelism & Worker Strategy

### A. Backend Layer Parallelism
- **Authoritative Database:** PostgreSQL 18.
- **Worker Isolation:** Backend unit/domain tests use SQLite `:memory:` with separate connection handles per test case, guaranteeing zero race conditions or row-lock contention.
- **Database Invariant & Accounting Tests:** Dedicated PostgreSQL connection (`wdms_test`) executing strictly within isolated transactions with automatic rollback (`RefreshDatabase` / `DatabaseTransactions`).

### B. Playwright Headless Browser Sharding
- **Workers:** 4 headless parallel worker processes (`workers: 4`, `fullyParallel: true`).
- **Browser Identity:** Official Google Chrome (v152.0.7977.83) in headless execution mode.
- **Zero Human-Facing Chaos:** Prohibits multiple visible Chrome windows or competing MCP browser controllers. MCP remains an interactive diagnostic inspector.
- **Shard Allocation:**
  - **Shard 1 (1/4):** Authentication, Role Boundaries, Global Shell, Customer Management, Product Master, Pricing Rules.
  - **Shard 2 (2/4):** Salesman Order Creation, Admin Order Processing, Order Adjustments, Payment Lifecycle, JPEG Evidence Verification.
  - **Shard 3 (3/4):** Accounts Receivable Aging, Customer Statements, Accounts Payable, Logistics & Dispatch, Driver Portal, RMA & Returns, Credit Notes, Refunds.
  - **Shard 4 (4/4):** Security Anti-IDOR Matrix, General Ledger Postings, Trial Balance, P&L, Balance Sheet, Invoices (RULE-DOC-001), 12-Viewport Responsive Matrix, WCAG 2.1 AA Keyboard Focus, Visual Baselines.

---

## 3. Data, Session & Storage Isolation

### A. Redis Isolation
- Test cache, queues, and locks utilize distinct worker namespaces:
  - Cache Prefix: `wdms_test_worker_{WORKER_ID}:`
  - Lock Prefix: `wdms_test_lock_{WORKER_ID}:`

### B. File & S3 Storage Isolation
- File uploads (Payment Cheque JPEGs, Proof of Delivery, RMA photos, Invoice PDFs) utilize dedicated sandboxed test directories:
  - Disk: `local` / `s3_test`
  - Root: `storage/framework/testing/worker_{WORKER_ID}/`
  - Automatic teardown and cleanup upon test worker completion.

### C. Authentication State Isolation
- Role storage states (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`, `SALESMAN`, `WAREHOUSE_MANAGER`, `DELIVERY_PARTNER`) are isolated per worker context, eliminating cookie collision and session clobbering.

---

## 4. Machine-Readable Result Contract & Artifacts

Every test execution emits records adhering to the universal contract:

```typescript
interface TestResultContract {
    runId: string;
    gitSha: string;
    workerId: string;
    shardId: string;
    testId: string;
    checklistId: string;
    domain: string;
    layer: string;
    status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_TESTED' | 'PARTIAL' | 'NOT_APPLICABLE';
    duration: number;
    expected: string;
    actual: string;
    evidence: string[];
    browser: string;
    viewport: string;
    role: string;
    failureClass: string | null;
}
```

### Standardized Artifact Hierarchy (`artifacts/test-results/`)
- **`final-results.json`**: Complete machine-readable ledger of all 999 enumerated items.
- **`coverage-summary.json`**: Real-time coverage metrics and checklist status counts.
- **`failures.json`**: List of all failing items consumed by AI Triage and targeted rerun.
- **`flaky.json`**: Audit trail of intermittent tests requiring investigation.
- **`performance.json`**: Execution durations by worker, shard, and test suite.
- **`ai-triage-report.json` & `.md`**: Structured root-cause diagnoses and healing assessments.

---

## 5. AI Failure Triage & No-False-Healing Invariant

The AI diagnostic engine processes only actionable test failures to minimize overhead and prevent accidental business logic drift.

### Failure Classification Taxonomy
1. `APPLICATION_BUG`: Real software defect in controllers, services, or models.
2. `TEST_BUG`: Malformed test setup or incorrect assertion syntax.
3. `SELECTOR_BUG`: Stale or changed DOM locator.
4. `FIXTURE_BUG`: Missing seed record or incorrect test data factory.
5. `ENVIRONMENT_BUG`: Network, port, or service container timeout.
6. `VISUAL_REGRESSION`: Unapproved UI styling or layout deviation.
7. `ACCESSIBILITY_REGRESSION`: Contrast violation or broken focus indicator.
8. `SECURITY_FAILURE`: Role permission bypass or IDOR leakage.
9. `DATA_INTEGRITY_FAILURE`: Foreign key violation or orphaned record.
10. `FINANCIAL_FAILURE`: Imbalance in Trial Balance, P&L, Balance Sheet, or AR math.
11. `CONCURRENCY_FAILURE`: Race condition or duplicate transaction creation.
12. `FLAKY`: Non-deterministic pass/fail requiring harness stabilization.
13. `UNKNOWN`: Unclassified anomaly (Strictly fail-closed).

### Non-Negotiable No-False-Healing Policy
- **Authoritative Financial Invariants:** Auto-relaxing financial expectations, rounding equations, or GL debits/credits is **STRICTLY PROHIBITED**.
- **Authoritative Security Rules:** Auto-relaxing HTTP 403 Forbidden expectations to HTTP 200 is **STRICTLY PROHIBITED**.
- **Visual Baselines:** Auto-updating visual baselines upon comparison failure is **STRICTLY PROHIBITED**. Baselines may only be updated via explicit client change orders.

---

## 6. One-Command CLI & Release Pipeline

| Command | Purpose |
|---|---|
| `npm run test:parallel` | Executes backend suites and 4 Playwright shards in parallel; aggregates all machine results. |
| `npm run test:coverage` | Enforces the 909/909 coverage guard; fails CI if any item is unchecked or unmapped. |
| `npm run test:failed` | Re-runs only the failures recorded in `artifacts/test-results/failures.json`. |
| `npm run test:report` | Outputs human-readable terminal test execution and coverage dashboard. |
| `npm run test:release` | Full release verification gate: TypeScript type check, Vite build, parallel tests, 909/909 coverage gate, and AI health check. |

---

## 7. CI/CD Matrix (`.github/workflows/ci.yml`)

The GitHub Actions CI pipeline executes:
1. **Backend Job:** PHP 8.5, PostgreSQL 18, Redis 7 executing Domain, API, and DB invariant suites.
2. **Frontend Job:** Node 22 TypeScript static analysis and Vite production build.
3. **Playwright Shards Job:** 4-way parallel matrix (`--shard=1/4`, `2/4`, `3/4`, `4/4`) with automated PostgreSQL and web server startup.
4. **Release Quality Gate Job:** Aggregates shard results, validates the 909/909 coverage gate, and enforces zero unresolved failures.
