# UJW Forensic Security Audit: RBAC, Account Lifecycle & Authorization Architecture

**Document Version:** 1.0  
**Audit Target:** Unique Distributors (UJW) Wholesale Distribution Management System  
**Audit Scope:** Super Admin Account Management, Account Lifecycle & Deletion, Invariant Protection, Role/Permission Mapping, Route/Middleware Authorization, IDOR & Scoping, Provisioning, MFA Enforcement, and Root Cause Analysis of HTTP 500/400 Errors.  
**Auditor:** UJW Forensic Auditor Specialist  
**Git Branch / Commit:** `main` @ `cee76b8`  
**Execution Mode:** STRICTLY AUDIT-ONLY (No code, schema, data, or configuration mutations)

---

## Executive Summary

A comprehensive forensic audit of the Security, Roles, and Account Management subsystems in the UJW Wholesale Distribution Management System has been conducted. 

### Key Findings Summary:
1. **Critical PostgreSQL Schema Mismatches in User Deletion (HTTP 500 Root Cause):** [CONFIRMED]
   `UserLifecycleService::hasHistoricalReferences()` contains three non-existent column queries (`orders.creator_id`, `customers.created_by`, `deliveries.assigned_by`). When executed against PostgreSQL (NeonDB), these queries trigger `SQLSTATE[42703]: Undefined column: 7 ERROR: column "creator_id" does not exist`, crashing user deletion with an HTTP 500 error for every user.
2. **PostgreSQL Foreign Key Violation on Hard Delete (Secondary HTTP 500 Root Cause):** [CONFIRMED]
   `hasHistoricalReferences()` omits checks on tables where foreign keys are configured with `restrictOnDelete` (`order_adjustments`, `inventory_movements`, `stock_exceptions`, `inventory_adjustments`, `credit_notes`, `refund_requests`, `receivable_transactions`, `suppliers_and_payables`). If a user has records only in these tables, the system attempts `$target->delete()`, triggering `SQLSTATE[23503]: foreign key constraint violation` (HTTP 500).
3. **Route Middleware vs Service Authorization Divergence:** [CONFIRMED]
   `DELETE /security/users/{user}` is mounted under `Route::middleware('permission:role.manage')`. Because `ADMIN` possesses `role.manage`, an Administrator can pass the route-level middleware. While `UserLifecycleService::deleteUser()` correctly gates execution with `USER_DELETE` (throwing `AuthorizationException` 403), the route middleware is coarsely defined. Additionally, `UserPolicy::delete()` unconditionally returns `false` to prevent deletion, but is completely bypassed by `UserLifecycleController`.
4. **ADMIN Role Exclusion from USER_DELETE:** [CONFIRMED]
   `UserRole::ADMIN` has 50 permissions and does NOT have `Permission::USER_DELETE`. Only `UserRole::SUPER_ADMIN` possesses `Permission::USER_DELETE`.
5. **Protection Invariants Enforcement:** [CONFIRMED]
   Self-deletion prevention, last active Super Admin protection, 10-character minimum reason, and explicit confirmation are all enforced server-side.
6. **Client Super Admin Provisioning & MFA Enforcement:** [CONFIRMED]
   `auth:provision-client-admin` is safe, idempotent, and provisions the user without pre-confirmed MFA. Upon first login, `MfaPolicy` and `LoginRequest` detect the missing enrollment and mandate TOTP registration via `mfa.challenge` before granting dashboard access. Privileged roles are barred from disabling MFA.
7. **Permission Registry Test Drift:** [CONFIRMED]
   4 test failures in `PermissionRegistryTest.php` were identified, stemming from undocumented test drift after commits `5d0a77b` (added `USER_DELETE` to registry, bringing count to 56) and `29d846e`/`5d0a77b` (added `CUSTOMER_CREATE` and `INVOICE_DOWNLOAD` to `SALESMAN`, bringing count to 15).

---

## Detailed Audit Findings

```
========================================================================================
AUDIT MATRIX & CONFIDENCE CLASSIFICATION
========================================================================================
Target Subsystem                           Finding Status          Confidence
----------------------------------------------------------------------------------------
1. Super Admin Account Management          Architecturally Sound   CONFIRMED
2. Account Deletion Architecture           Dual-mode (Retire/Hard) CONFIRMED
3. Undefined DB Columns in deleteUser      Defect (Causes HTTP 500)CONFIRMED
4. Missing FK Checks in deleteUser         Defect (Causes HTTP 500)CONFIRMED
5. Protection Invariants (Self/Last/Reason)Fully Enforced          CONFIRMED
6. UserRole & Permission Mapping           6 Roles / 56 Perms      CONFIRMED
7. ADMIN Lacks USER_DELETE                 Strictly Enforced       CONFIRMED
8. Route vs Controller/Service Auth        Middleware Coarse Gate  CONFIRMED
9. UserPolicy Bypass                       Policy Unused by Ctrler CONFIRMED
10. IDOR Defenses & Salesman Scoping       Strictly Isolated       CONFIRMED
11. Session Revocation on Security Events  Active & Functional     CONFIRMED
12. Client Provisioning Command            Idempotent & Secure     CONFIRMED
13. Mandatory MFA for Privileged Roles     Full First-Login Gate   CONFIRMED
14. Permission Registry Test Failures      Stale Test Assertions   CONFIRMED
========================================================================================
```

---

### Section 1: Super Admin Account Management

#### Code References:
- [UserLifecycleController.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/UserLifecycleController.php#L16-L84)
- [UserLifecycleService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L24-L271)
- [RoleAssignmentController.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/RoleAssignmentController.php#L16-L96)
- [RoleAssignmentService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/RoleAssignmentService.php#L13-L118)

#### Findings:
1. **Account Status Transitions:**
   - Handled via `UserLifecycleController@updateStatus` invoking `UserLifecycleService::updateStatus()`.
   - Supports transitions between `ACTIVE`, `SUSPENDED`, `DISABLED`, and `INVITED`.
   - Validates status against `AccountStatus` enum via `Rule::enum(AccountStatus::class)`.
   - Authorization requires `USER_SUSPEND` or `USER_UPDATE` or `isSuperAdmin()`.
   - Non-Super Admin actors cannot modify a Super Admin account (`AuthorizationException` 403).
   - Changing status to `SUSPENDED` or `DISABLED` automatically triggers session revocation.
2. **Account Deletion:**
   - Handled via `UserLifecycleController@destroy` invoking `UserLifecycleService::deleteUser()`.
   - Dual-response supported: returns JSON payload when `$request->wantsJson()`, or redirects to `route('roles.index')` with flash message.
   - Enforces strict server-side authorization: requires `canPermission(Permission::USER_DELETE)` or `isSuperAdmin()`.

---

### Section 2: Account Deletion Requirement (Soft vs Hard vs Anonymized Retirement)

#### Code References:
- [User.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Models/User.php#L17-L39)
- [0001_01_01_000000_create_users_table.php](file:///F:/Wholesale%20Distribution%20Management%20System/database/migrations/0001_01_01_000000_create_users_table.php#L14-L22)
- [UserLifecycleService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L173-L245)

#### Analysis:
1. **Model & Schema State:**
   The `User` model does **NOT** use the `Illuminate\Database\Eloquent\SoftDeletes` trait, and the `users` table migration contains no `deleted_at` timestamp.
2. **Implemented Deletion Pattern: Dual-Mode Deletion Architecture:**
   When `UserLifecycleService::deleteUser` is executed, it invokes `hasHistoricalReferences($target->id)`:
   - **Mode A: Anonymized Retirement (`mode: 'anonymized_disabled'`)**
     Triggered when the user is associated with historical business transactions.
     - Status updated to `AccountStatus::DISABLED`.
     - Password overwritten with a 40-character cryptographically random hash (`Hash::make(Str::random(40))`).
     - Session and security tokens purged: `remember_token = null`, `two_factor_secret = null`, `two_factor_recovery_codes = null`, `two_factor_confirmed_at = null`, `email_verified_at = null`.
     - Preserves the database row and primary key ID so historical transactions (`orders.salesman_id`, `payments.recorded_by`, `invoices.created_by`, `audit_logs.actor_id`) maintain referential integrity without broken relations or foreign key violations.
     - Logs `USER_DELETED_ANONYMIZED` to the security audit trail.
   - **Mode B: Hard Deletion (`mode: 'hard_deleted'`)**
     Triggered when no historical business records exist for the user.
     - Executes `$target->delete()`, removing the row from the `users` table.
     - Logs `USER_HARD_DELETED` to the security audit trail.

---

### Section 3: Root Cause Analysis of HTTP 500 & 400 Errors

#### Finding 3.1: Critical Schema Mismatches in `hasHistoricalReferences` (HTTP 500)
**Confidence: CONFIRMED**

In [UserLifecycleService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L250-L258):
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

A live PostgreSQL diagnostic execution against the database revealed:
1. `Order::query()->where('creator_id', 1)->exists()`
   - **Actual schema:** Migration `2026_09_05_000008_create_orders_table.php:27` defines column as `created_by`, NOT `creator_id`.
   - **PostgreSQL Output:** `SQLSTATE[42703]: Undefined column: 7 ERROR: column "creator_id" does not exist`
2. `Customer::query()->where('created_by', 1)->exists()`
   - **Actual schema:** Migration `2026_09_04_000005_create_customers_table.php` and `2026_09_04_000006_add_salesman_id_to_customers_table.php` define `salesman_id`, but NO `created_by` column exists.
   - **PostgreSQL Output:** `SQLSTATE[42703]: Undefined column: 7 ERROR: column "created_by" does not exist`
3. `Delivery::query()->where('assigned_by', 1)->exists()`
   - **Actual schema:** Migration `2026_09_06_000008_create_deliveries_table.php:26-61` defines `driver_id`, `created_by`, and `updated_by`. Column `assigned_by` does NOT exist.
   - **PostgreSQL Output:** `SQLSTATE[42703]: Undefined column: 7 ERROR: column "assigned_by" does not exist`

**Consequence:** Because `Order::query()->where('creator_id', ...)` is the very first query evaluated, **every single user deletion attempt in production throws a `QueryException` and terminates with HTTP 500.**

#### Finding 3.2: Incomplete Historical Reference Coverage (HTTP 500)
**Confidence: CONFIRMED**

The following database tables contain foreign keys referencing `users(id)` with `restrictOnDelete()`:
- `order_adjustments` (`requested_by`)
- `inventory_movements` (`actor_id`)
- `stock_exceptions` (`reported_by`)
- `inventory_adjustments` (`actor_id`)
- `return_requests` (`created_by`, `actor_id`)
- `credit_notes` (`issued_by`)
- `refund_requests` (`requested_by`, `processed_by`)
- `receivable_transactions` (`created_by`)
- `supplier_bills` & `supplier_payments` (`created_by`, `posted_by`, `reversed_by`)

None of these relations are inspected in `hasHistoricalReferences()`. If an Accountant or Warehouse Manager who has never created an order or payment is deleted, `hasHistoricalReferences()` evaluates to `false` and executes `$target->delete()`. PostgreSQL then aborts the transaction with `SQLSTATE[23503]: Foreign key violation`, resulting in an HTTP 500 error.

#### Finding 3.3: Validation & Exception Mapping (HTTP 400 / 422)
**Confidence: CONFIRMED**

Reported 400/422 issues arise from the following conditions:
- **`confirm` Parameter:** In `UserLifecycleController@destroy`, the validation rule is `['required', 'boolean', 'accepted']`. If an API client passes boolean `false`, integer `0`, or omits it, Laravel returns HTTP 422 Unprocessable Entity.
- **`reason` Length:** Validation requires `min:10` characters. Submitting brief reasons (e.g., "Terminated") returns HTTP 422.
- **Recovery Codes API:** In `TwoFactorAuthenticationController::regenerateRecoveryCodes`, attempting to regenerate recovery codes when MFA is not active produces `abort(400, 'Two-factor authentication must be enabled to regenerate recovery codes.')`.
- **Throttling Responses in Web Requests:** In `AuthenticationTest`, `LoginRequest::ensureIsNotRateLimited` throws `ValidationException::withMessages(...)->status(429)`. When requested via standard web form (without `expectsJson()`), Laravel converts the 429 ValidationException into a 302 redirect back with error messages in session, causing tests asserting HTTP 429 to fail unless requested via JSON.

---

### Section 4: Protection Invariants

| Invariant | Implementation File & Lines | Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **Self-Deletion Prevention** | [UserLifecycleService.php#L134-L138](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L134-L138) | `ValidationException` on `user` field | **CONFIRMED** |
| **Self-Suspension Prevention** | [UserLifecycleService.php#L54-L58](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L54-L58) | `ValidationException` on `status` field | **CONFIRMED** |
| **Self-Role Modification** | [RoleAssignmentService.php#L74-L76](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/RoleAssignmentService.php#L74-L76) | `AuthorizationException` (403) | **CONFIRMED** |
| **Last Super Admin Deletion** | [UserLifecycleService.php#L141-L153](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L141-L153) | Query counts other active Super Admins; throws `ValidationException` if count === 0 | **CONFIRMED** |
| **Last Super Admin Deactivation** | [UserLifecycleService.php#L60-L73](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L60-L73) | Checks remaining active Super Admins before allowing SUSPENDED/DISABLED | **CONFIRMED** |
| **Last Super Admin Demotion** | [RoleAssignmentService.php#L58-L71](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/RoleAssignmentService.php#L58-L71) | Uses `lockForUpdate()` on other Super Admins; throws `ValidationException` if count < 1 | **CONFIRMED** |
| **Min 10-Char Reason** | [UserLifecycleController.php#L64](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/UserLifecycleController.php#L64), [UserLifecycleService.php#L163-L167](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L163-L167) | Controller rule `'min:10'` + Service validation check `strlen(trim($reason)) < 10` | **CONFIRMED** |
| **Explicit Confirmation** | [UserLifecycleController.php#L65](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/UserLifecycleController.php#L65), [UserLifecycleService.php#L156-L160](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L156-L160) | Controller rule `'accepted'` + Service check `if (!$confirm)` | **CONFIRMED** |

---

### Section 5: Role and Permission Mapping

#### 1. Roles (`UserRole` Enum)
Defined in [UserRole.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Enums/UserRole.php#L5-L13). Exactly 6 canonical roles:
1. `SUPER_ADMIN` (Privileged)
2. `ADMIN` (Privileged)
3. `ACCOUNTANT` (Privileged)
4. `SALESMAN`
5. `WAREHOUSE_MANAGER`
6. `DELIVERY_PARTNER`

#### 2. Canonical Permissions (`Permission` Enum)
Defined in [Permission.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Enums/Permission.php#L5-L100). Exactly **56 canonical permissions** grouped by module:
- `customer`: 3 (`view`, `create`, `update`)
- `product`: 5 (`view`, `create`, `update`, `price.update`, `tax.update`)
- `pricing`: 1 (`override`)
- `order`: 6 (`view`, `create`, `submit`, `approve`, `reject`, `cancel`)
- `order_adjust`: 5 (`adjust.request`, `adjust.review`, `adjust.approve`, `adjust.apply`, `adjust.reverse`)
- `payment`: 4 (`view`, `create`, `verify`, `reverse`)
- `inventory`: 3 (`view`, `adjust`, `exception.report`)
- `delivery`: 3 (`view`, `assign`, `update`)
- `return`: 3 (`request`, `review`, `approve`)
- `credit`: 2 (`view`, `create`)
- `refund`: 3 (`view`, `request`, `approve`)
- `invoice`: 3 (`view`, `print`, `download`)
- `receivable`: 1 (`view`)
- `payable`: 2 (`view`, `manage`)
- `accounting`: 3 (`view`, `post`, `reverse`)
- `user`: 5 (`view`, `create`, `update`, `suspend`, `delete`)
- `audit`: 2 (`view`, `security.view`)
- `role`: 1 (`manage`)
- `permission`: 1 (`manage`)

#### 3. Role-to-Permission Mapping in `PermissionService`
Defined in [PermissionService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/PermissionService.php#L171-L325):
- `SUPER_ADMIN`: 56 permissions (`Permission::cases()`).
- `ADMIN`: 50 permissions.
  - **Verification: Does ADMIN have `USER_DELETE`?**
    **CONFIRMED: ADMIN DOES NOT HAVE `USER_DELETE`.**
    In `PermissionService.php:249-253`, the granted user administration permissions for `ADMIN` are strictly:
    `Permission::USER_VIEW`, `Permission::USER_CREATE`, `Permission::USER_UPDATE`, and `Permission::USER_SUSPEND`.
    `Permission::USER_DELETE` is explicitly excluded from `ADMIN`.
  - Excluded from `ADMIN`: `permission.manage`, `payment.reverse`, `accounting.post`, `accounting.reverse`, `inventory.exception.report`, `user.delete`.
- `ACCOUNTANT`: 22 permissions.
- `SALESMAN`: 15 permissions.
- `WAREHOUSE_MANAGER`: 8 permissions.
- `DELIVERY_PARTNER`: 3 permissions.

---

### Section 6: Middleware & Policies Architecture

#### 1. Route Middleware Configuration
In [routes/web.php](file:///F:/Wholesale%20Distribution%20Management%20System/routes/web.php#L95-L104):
```php
Route::middleware('permission:role.manage')->group(function () {
    Route::get('/security/roles', [\App\Http\Controllers\Security\RoleAssignmentController::class, 'index'])->name('roles.index');
    Route::put('/security/users/{user}/role', [\App\Http\Controllers\Security\RoleAssignmentController::class, 'update'])->name('users.role.update');
    Route::put('/security/users/{user}/status', [\App\Http\Controllers\Security\UserLifecycleController::class, 'updateStatus'])->name('users.status.update');
    Route::delete('/security/users/{user}', [\App\Http\Controllers\Security\UserLifecycleController::class, 'destroy'])->name('users.destroy');
});
```

#### 2. Architectural Analysis: Route vs Controller/Service Authorization Gates
- **Coarse Route Filter:** All four security routes are protected exclusively by `permission:role.manage`. Because `ADMIN` possesses `role.manage`, an Administrator can pass the route middleware to reach `DELETE /security/users/{user}`.
- **Service Enforcement:** The authorization check is deferred to `UserLifecycleService::deleteUser()` (line 129):
  `if (! $actor->canPermission(Permission::USER_DELETE) && ! $actor->isSuperAdmin())`
  This correctly throws `AuthorizationException` (403 Forbidden) when an Admin attempts the deletion.
- **Policy Disconnect:** [UserPolicy.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Policies/UserPolicy.php#L68-L71) defines:
  ```php
  public function delete(User $user, User $target): bool
  {
      return false;
  }
  ```
  `UserPolicy::delete()` was written to unconditionally forbid deletions, but neither `UserLifecycleController` nor `RoleAssignmentController` ever calls `$this->authorize()` or `Gate::authorize()`. Laravel Policies are completely bypassed in favor of direct service-layer validation.

---

### Section 7: Direct API Authorization, IDOR Defenses & Session Revocation

#### 1. IDOR Defenses & Resource Scoping
[ResourceScopeService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/ResourceScopeService.php) enforces comprehensive multi-tenant isolation within the monolith:
- **Salesman Scoping:**
  - Salesmen are restricted to their assigned portfolio across `Customer`, `Order`, `Delivery`, `ReturnRequest`, `Payment`, `Invoice`, `OrderAdjustment`, `CreditNote`, `RefundRequest`, and `ReceivableTransaction`.
  - Scoping is enforced both at the individual record level (`canAccessCustomer`, `canAccessOrder`, `canAccessInvoice`) and query level (`scopeCustomers`, `scopeOrders`, `scopeInvoices`, etc.).
- **Nested Resource Ownership Verification:**
  To prevent IDOR attacks via manipulated child identifiers, `ResourceScopeService` explicitly verifies child-to-parent lineage:
  - `verifyOrderItemOwnership(OrderItem $item, Order $order)`
  - `verifyDeliveryItemOwnership(DeliveryItem $item, Delivery $delivery)`
  - `verifyReturnItemOwnership(ReturnItem $item, ReturnRequest $returnRequest)`
  - `verifyInvoiceItemOwnership(InvoiceItem $item, Invoice $invoice)`
  - `verifyCreditNoteItemOwnership(CreditNoteItem $item, CreditNote $creditNote)`
  - `verifyOrderAdjustmentOwnership(OrderAdjustment $adjustment, Order $order)`

#### 2. Privilege Escalation Defenses
Enforced in [RoleAssignmentService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/RoleAssignmentService.php):
- Only `SUPER_ADMIN` and `ADMIN` can assign roles.
- `ADMIN` cannot grant the `SUPER_ADMIN` role (lines 84-86).
- `ADMIN` cannot modify an existing `SUPER_ADMIN` (lines 79-81).
- Self-role modification is rejected (lines 74-76).
- The last remaining `SUPER_ADMIN` cannot be demoted (lines 58-71).

#### 3. Session Revocation
- [SessionRevocationService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/SessionRevocationService.php) directly manages active browser sessions in the `sessions` table.
- When a user's role is updated, `RoleAssignmentService` invokes `revokeUserSessionsForSecurityEvent($lockedTarget, 'role_changed')`, instantly terminating stale sessions and forcing re-authentication.
- In `UserLifecycleService`, suspending, disabling, or deleting an account immediately purges all active session rows for the target user.

---

### Section 8: Client Super Admin Provisioning & MFA Enforcement

#### 1. CLI Provisioning Command
Implementation: [ProvisionClientSuperAdminCommand.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Console/Commands/ProvisionClientSuperAdminCommand.php)
- **Signature:** `php artisan auth:provision-client-admin {--email=...} {--name=...} {--password=...}`
- **Idempotency:** Checks if an account with the specified email exists. If present, it logs a warning, renders an attribute inspection table, and exits with code 0 without mutating the password, status, or MFA secret.
- **Credential Generation:** If `--password` is omitted, generates a 24-character cryptographically secure password (`Str::password(24, letters: true, numbers: true, symbols: true, spaces: false)`).
- **Security Audit:** Logs `USER_PROVISIONED` to `auth.security_event`. Never logs plaintext passwords, hashes, or credentials.

#### 2. Mandatory MFA Enforcement Architecture
- In `ProvisionClientSuperAdminCommand:66-73`, the user is provisioned with `role = UserRole::SUPER_ADMIN`, but `two_factor_secret` and `two_factor_confirmed_at` are `null`.
- In [MfaPolicy.php#L19-L26](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/MfaPolicy.php#L19-L26), `isMfaRequired()` returns `true` for all privileged roles (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`).
- During initial login in [LoginRequest.php#L85-L109](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Requests/Auth/LoginRequest.php#L85-L109):
  1. Password validation passes.
  2. `$user->requiresMfa()` evaluates to `true`, and `$user->hasMfaEnabled()` evaluates to `false`.
  3. `LoginRequest` halts standard authentication and sets session key `mfa.challenge` with `requires_setup => true`.
  4. User is redirected to `GET /login/mfa`.
- In [MfaChallengeController.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Auth/MfaChallengeController.php):
  1. `create()` generates a temporary setup secret, SVG QR code, and manual key.
  2. `store()` requires a valid 6-digit TOTP code matching the setup secret.
  3. Upon successful code verification, `two_factor_secret` and `two_factor_confirmed_at` are persisted to the database, 8 recovery codes are generated, and the session is authenticated.
- In [TwoFactorAuthenticationController.php#L171-L173](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/TwoFactorAuthenticationController.php#L171-L173):
  `canDisableMfa()` returns `false` for privileged users. Any attempt to disable MFA returns `abort(403)`.

---

### Section 9: Test Suite Execution & Discrepancies

#### 1. Executed Test Results:
- `php artisan test --filter=RbacAuthorizationTest`: **12 / 12 PASSED** (66 assertions, 25.3s)
- `php artisan test tests/Feature/Prompt2TargetedRemediationTest.php`: **9 / 9 PASSED** (47 assertions, 11.1s)
- `php artisan test tests/Feature/Auth`: **210 / 216 PASSED, 6 FAILED** (1230 assertions, 169.6s)

#### 2. Root Cause of Test Failures in `tests/Feature/Auth`:
1. `PermissionRegistryTest::test_exactly_48_canonical_permission_codes_exist` & `test_super_admin_has_all_48_permissions`
   - **Failure:** Expected 55 permissions; actual size was 56.
   - **Cause:** Commit `5d0a77bfa9aec2f5cc451ba5f08b030976df6160` introduced `Permission::USER_DELETE`, increasing total canonical permissions from 55 to 56. The test assertion was never updated.
2. `PermissionRegistryTest::test_salesman_has_exactly_the_intended_11_permissions` & `test_frontend_capability_sharing_exposes_safe_permissions`
   - **Failure:** Expected 14 permissions; actual size was 15.
   - **Cause:** Commits `29d846effb4d36520ee3c37656483e9a135a5706` and `5d0a77bfa9aec2f5cc451ba5f08b030976df6160` added `CUSTOMER_CREATE` and `INVOICE_DOWNLOAD` to `UserRole::SALESMAN`, increasing total permissions from 13 to 15. The test assertion was never updated.
3. `AuthenticationTest::test_login_attempts_are_rate_limited` & `test_throttling_cannot_be_bypassed_by_input_casing`
   - **Failure:** Expected HTTP 429; received HTTP 302.
   - **Cause:** `LoginRequest` throws `ValidationException::withMessages(...)->status(429)`. Under standard web requests, Laravel converts validation exceptions into HTTP 302 redirects back to the previous page. The test does not send an `Accept: application/json` header, causing status 302 to be received instead of 429.

---

## Actionable Remediation Recommendations (For Phase 2 Implementation)

The following targeted remediations are recommended for Phase 2:

1. **Fix Schema Mismatch in `UserLifecycleService::hasHistoricalReferences`:**
   Update lines 250-258 in [UserLifecycleService.php](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Auth/UserLifecycleService.php#L250-L258):
   - Replace `Order::where('creator_id', $userId)` with `Order::where('created_by', $userId)`.
   - Remove `Customer::where('created_by', $userId)` (only check `salesman_id`).
   - Replace `Delivery::where('assigned_by', $userId)` with `Delivery::where('created_by', $userId)->orWhere('updated_by', $userId)`.
   - Add existence checks for all remaining `restrictOnDelete` tables (`order_adjustments`, `inventory_movements`, `stock_exceptions`, `inventory_adjustments`, `credit_notes`, `refund_requests`, `receivable_transactions`, `supplier_bills`, `supplier_payments`).
2. **Align Route Middleware on User Lifecycle Routes:**
   In [routes/web.php](file:///F:/Wholesale%20Distribution%20Management%20System/routes/web.php#L95-L104):
   - Protect `DELETE /security/users/{user}` with `permission:user.delete` rather than `permission:role.manage`.
   - Protect `PUT /security/users/{user}/status` with `permission:user.suspend,user.update`.
3. **Synchronize `UserPolicy`:**
   Update `UserPolicy::delete()` to check `$this->permissionService->has($user, Permission::USER_DELETE)` instead of returning `false` unconditionally, and invoke `$this->authorize('delete', $user)` inside `UserLifecycleController@destroy`.
4. **Update `PermissionRegistryTest` Assertions:**
   Update `PermissionRegistryTest.php` to reflect the 56 canonical permissions and 15 salesman permissions.
5. **Session Revocation Service Consistency:**
   Refactor `UserLifecycleService::revokeUserSessions` to inject and use `SessionRevocationService::revokeAllSessions()`, consolidating session deletion and audit event logging.

---

*Report submitted by UJW Forensic Auditor Specialist in accordance with Phase 1 Operating Constraints.*

