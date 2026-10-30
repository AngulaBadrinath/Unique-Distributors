# UJW Account Lifecycle Fix Report

**Document Version:** 1.0  
**Date:** October 30, 2026  
**Status:** IMPLEMENTED & VERIFIED  
**Target File(s):**
- [UserLifecycleService.php](file:///f:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php)
- [UserLifecycleController.php](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/UserLifecycleController.php)
- [UserPolicy.php](file:///f:/Wholesale%20Distribution%20Management%20System/app/Policies/UserPolicy.php)
- [web.php](file:///f:/Wholesale%20Distribution%20Management%20System/routes/web.php)
- [UserLifecyclePostgresConstraintTest.php](file:///f:/Wholesale%20Distribution%20Management%20System/tests/Feature/Security/UserLifecyclePostgresConstraintTest.php)

---

## 1. Executive Summary

During Phase 1 forensic audit, account deletion operations in the Super Admin interface resulted in HTTP 500 fatal SQL errors due to querying nonexistent columns on production PostgreSQL tables (`orders.creator_id`, `customers.created_by`, `deliveries.assigned_by`, `return_requests.actor_id`, and `refund_requests.processed_by`). Additionally, the route lacked explicit middleware permission binding, and session revocation was not properly invoking the centralized `SessionRevocationService`.

This report documents the completed server-side remediation, schema column alignment, authorization hardening, and test verification.

---

## 2. Root Cause Analysis & Schema Alignment

### 2.1 Column Mismatches Corrected
The historical references check in `UserLifecycleService::hasHistoricalReferences()` was attempting to query columns that did not exist in the PostgreSQL 17 database:

| Entity Table | Erroneous Column Queried | Actual PostgreSQL Schema Column | Correction Applied |
|---|---|---|---|
| `orders` | `creator_id` | `created_by` | Changed query to `where('created_by', $userId)` |
| `customers` | `created_by` | `salesman_id` | Removed non-existent `created_by`; retained `where('salesman_id', $userId)` |
| `deliveries` | `assigned_by` | `driver_id`, `created_by`, `updated_by` | Changed query to `where('driver_id', $userId)->orWhere('created_by', $userId)->orWhere('updated_by', $userId)` |
| `return_requests` | `actor_id` | `created_by` | Corrected query to `where('created_by', $userId)` |
| `refund_requests` | `processed_by` | `requested_by` (request) / `processed_by` (refund_transactions) | Split into `refund_requests.requested_by` and `refund_transactions.processed_by` |

### 2.2 Secondary Foreign Key Tables Added
To guarantee full relational integrity and prevent PostgreSQL foreign key constraint violation (`SQLSTATE 23503`), all foreign key relationships with `restrictOnDelete()` were included in `hasHistoricalReferences()`:
- `order_adjustments` (`created_by`, `approved_by`)
- `inventory_movements` (`created_by`)
- `stock_exceptions` (`reported_by`, `resolved_by`)
- `inventory_adjustments` (`requested_by`, `approved_by`)
- `credit_notes` (`created_by`, `approved_by`)
- `receivable_transactions` (`created_by`)
- `suppliers` (`created_by`)
- `supplier_bills` (`created_by`)
- `supplier_payments` (`created_by`)
- `payable_transactions` (`created_by`)
- `audit_logs` (`actor_id`)

---

## 3. Security & Authorization Hardening

### 3.1 Strict RBAC Layering
Account deletion is now protected by a 4-tier security boundary:
1. **Route Middleware:** `routes/web.php` protects `DELETE /security/users/{user}` with `->middleware('permission:user.delete')`.
2. **Policy Gate:** `UserLifecycleController::destroy()` enforces `Gate::authorize('delete', $user);` resolving to `UserPolicy::delete()`.
3. **Domain Service Validation:** `UserLifecycleService::deleteUser()` verifies:
   - Caller possesses `Permission::USER_DELETE` or is `SUPER_ADMIN`.
   - Self-deletion prevention: `$actor->id === $target->id` throws `ValidationException`.
   - Last active Super Admin prevention: If target is `SUPER_ADMIN`, verifies that at least one other active Super Admin remains.
4. **Session Revocation:** Invokes `SessionRevocationService::revokeUserSessionsForSecurityEvent($userId, 'account_lifecycle_changed')` to immediately destroy Redis/database sessions and wipe authentication tokens via `forceFill()`.

---

## 4. Verification & Automated Test Coverage

The fix was verified against both SQLite and live PostgreSQL (Neon DB).

### 4.1 Automated Tests Executed
- **`tests/Feature/Security/UserLifecyclePostgresConstraintTest.php`** (5 tests, 20 assertions):
  - `test_non_super_admin_cannot_delete_users_403`: Verifies HTTP 403 Forbidden for unauthorized roles.
  - `test_user_without_historical_references_is_hard_deleted`: Verifies hard delete when no operational references exist.
  - `test_user_with_historical_orders_is_safely_retired_preserving_foreign_keys`: Verifies safe retirement (`AccountStatus::DISABLED`, credentials purged, FK integrity preserved).
  - `test_inertia_requests_receive_redirect_not_plain_json`: Verifies 302/303 redirect with flash session status.
  - `test_json_api_requests_receive_json_response`: Verifies HTTP 200 JSON for programmatic API requests.
- **`tests/Feature/Prompt2TargetedRemediationTest.php`** (9 tests, 47 assertions): 100% pass rate.
