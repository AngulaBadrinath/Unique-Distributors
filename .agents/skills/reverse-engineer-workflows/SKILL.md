---
name: reverse-engineer-workflows
description: >-
  Precisely reverse-engineer the existing codebase into comprehensive workflow documentation and Mermaid diagrams based strictly on implemented source code.
---

# Reverse Engineer Workflows Skill

## 1. Purpose & Scope

The `reverse-engineer-workflows` skill inspects the active codebase and reconstructs the authoritative, implemented business and operational workflows from source code into structured Markdown documentation and deterministic Mermaid diagrams.

### Operating Rules
1. **Code is the Sole Source of Truth:** Document exclusively what is implemented in code. Never infer or invent missing steps based on assumptions, PRDs, or generic domain standards.
2. **Implementation Status Classification:** Every workflow step, transition, or branching point must be explicitly tagged:
   - `[IMPLEMENTED]`: Supported by concrete, active backend code and verified call chains.
   - `[PARTIAL]`: Implemented in some layers (e.g., UI exists or route exists) but incomplete in domain service or persistence.
   - `[UNREFERENCED]`: Code/method exists but is orphaned or uncalled by any active route/controller.
   - `[UNKNOWN / TBD]`: Ambiguity in source logic or unhandled branch.
3. **Exact Class & Method References:** Document exact namespaces, class names, file paths, and method signatures for every controller action, domain service, model event, and policy check.
4. **Transaction & Concurrency Isolation:** Record exact database transaction boundaries (`DB::transaction`), pessimistic locking mechanisms (`lockForUpdate`, ordered ID locking), idempotency keys, and advisory locks.
5. **No Speculative Solutions:** Do not suggest code refactoring or "fix" discrepancies during reverse engineering; accurately document the system as it exists.

---

## 2. Reverse-Engineering Execution Protocol

When invoked via `/reverse-engineer-workflows`, execute the following systematic 5-phase analysis:

### Phase 1: Entry Point & Route Traversal
- Map route definitions (`routes/web.php`, `routes/api.php`) with their HTTP methods, URIs, route names, and attached middleware stacks (`auth`, `account.active`, `throttle`, custom permissions).
- Identify the matching controller and method.
- Check associated Form Requests (`app/Http/Requests/`) for validation rules, custom authorizations, and sanitized payload DTOs.

### Phase 2: Domain Logic & Call Chain Resolution
- Trace execution from Controller into Application Services and Domain Actions (`app/Services/`).
- Identify domain invariants, parameter validation, price/boundary checks, and role/permission enforcement (`PermissionService`, `ResourceScopeService`).
- Follow all nested service calls (e.g., `OrderService` calling `TaxCalculationService`, `InvoiceGeneratorService`, `DomainNotificationDispatcher`).

### Phase 3: Transaction & Persistence Boundaries
- Identify `DB::transaction()` blocks, retry counts, and isolation levels.
- Check row locking strategies (`lockForUpdate()`, deterministic ascending ID sorting to prevent deadlocks).
- Record database mutations (inserts, updates, soft deletes) across all participating models.

### Phase 4: Side Effects, Events, & Asynchronous Boundaries
- Document state machine transitions (e.g., `OrderStatus`, `FulfillmentStatus`, `PaymentStatus`, `DeliveryStatus`).
- Identify dispatched events, queue jobs, database notifications (`InAppNotification`), audit logging (`AuditLogService`), and security logs (`SecurityLogService`).
- Identify cross-domain integrations (e.g., Delivery completion triggering Inventory movements and General Ledger COGS postings).

### Phase 5: Failure & Rejection Paths
- Identify every conditional branch that throws `ValidationException`, `AuthorizationException`, `ConflictHttpException`, or custom domain exceptions.
- Record idempotency replay behavior and rollbacks.

---

## 3. Workflow Documentation Standards

Every domain workflow document in `docs/workflows/` must follow this uniform structure:

```markdown
# [DOMAIN] Workflow Specification

## 1. Workflow Overview & Purpose
- Business objective
- Implementation status
- Participating roles & actors

## 2. Architecture & Entry Points
- HTTP Routes, Methods, and Middlewares
- Frontend Pages / UI Entry Points
- Form Requests & Validation DTOs

## 3. Step-by-Step Execution Sequence
- Chronological, end-to-end execution chain with code references (`Class::method`)

## 4. State Lifecycle & Transitions
- Table of status transitions, triggers, preconditions, and postconditions

## 5. Branching & Business Logic Constraints
- Rules, boundaries, calculation formulas, and validation guards

## 6. Authorization & Resource Scoping
- Permissions required (`Permission::*`)
- Resource access scoping rules (`ResourceScopeService`)

## 7. Database & Concurrency Boundaries
- Transaction blocks (`DB::transaction`)
- Locking hierarchy (lock order)
- Idempotency guarantees

## 8. Side Effects & Cross-Domain Handshakes
- Invoicing triggers
- Inventory movements
- General Ledger postings
- In-app & external notifications

## 9. Failure, Rejection & Cancellation Paths
- Rejection codes, rollback behavior, exception responses

## 10. Source Code Traceability Index
- Full list of linked files and classes
```

---

## 4. Mermaid Diagram Standards

Store deterministic, clean Mermaid files in `docs/workflows/diagrams/`:
- **State Workflows:** Use `stateDiagram-v2` for lifecycle status progression.
- **Transactional Call Chains:** Use `sequenceDiagram` for request -> controller -> service -> database -> event ordering.
- **Cross-Domain Master Workflows:** Use `flowchart TD` or `flowchart LR` with distinct subgraphs per operational domain.
