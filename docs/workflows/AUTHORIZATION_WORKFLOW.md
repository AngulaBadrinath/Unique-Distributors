# Authorization & Security Workflow Specification

## 1. Workflow Overview & Purpose
The **Authorization & Security Workflow** enforces code-defined Role-Based Access Control (RBAC), multi-tenant resource scoping (anti-IDOR), Two-Factor Authentication (TOTP MFA), session revocation, and immutable security/audit logging.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** All Roles (`ADMIN`, `SALESMAN`, `WAREHOUSE_MANAGER`, `WAREHOUSE_STAFF`, `DELIVERY_PARTNER`, `ACCOUNTANT`)

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `POST` | `/login` | `login.store` | `AuthenticatedSessionController@store` | `guest`, `throttle:login` |
| `GET` | `/login/mfa` | `mfa.challenge` | `MfaChallengeController@create` | `guest` |
| `POST` | `/login/mfa` | `mfa.challenge.store` | `MfaChallengeController@store` | `guest`, `throttle:mfa` |
| `POST` | `/admin/security/mfa/enable` | `admin.security.mfa.enable` | `TwoFactorAuthenticationController@enable` | `auth`, `account.active` |
| `POST` | `/admin/security/mfa/confirm` | `admin.security.mfa.confirm` | `TwoFactorAuthenticationController@confirm` | `auth`, `account.active` |
| `POST` | `/admin/security/roles/assign` | `admin.security.roles.assign` | `RoleAssignmentController@assign` | `auth`, `account.active`, `permission:user.manage` |
| `POST` | `/admin/security/sessions/{session}/revoke` | `admin.security.sessions.revoke` | `SessionManagementController@revoke` | `auth`, `account.active`, `permission:user.manage` |
| `GET` | `/admin/audit-logs` | `admin.audit-logs.index` | `AdminAuditController@index` | `auth`, `account.active`, `permission:audit.view` |

---

## 3. Authoritative Role Permission Matrix (`PermissionService`)

| Role | Authoritative Scope & Responsibilities | Assigned Permissions |
|---|---|---|
| `ADMIN` | Superuser / Complete Operational Control | All `Permission::*` (50+ permissions) |
| `SALESMAN` | Field Sales & Assigned Customer Accounts | `CUSTOMER_VIEW`, `PRODUCT_VIEW`, `ORDER_CREATE`, `ORDER_SUBMIT`, `ORDER_VIEW`, `ORDER_CANCEL`, `PAYMENT_CREATE`, `PAYMENT_VIEW`, `INVOICE_VIEW`, `INVOICE_PRINT`, `INVOICE_DOWNLOAD`, `RECEIVABLE_VIEW`, `RETURN_CREATE`, `RETURN_VIEW` |
| `WAREHOUSE_MANAGER` | WMS, Staging, Inventory & Exceptions | `PRODUCT_VIEW`, `ORDER_VIEW`, `ORDER_FULFILLMENT`, `INVENTORY_VIEW`, `INVENTORY_ADJUST`, `DELIVERY_VIEW`, `RETURN_VIEW`, `RETURN_INSPECT`, `STOCK_EXCEPTION_MANAGE` |
| `WAREHOUSE_STAFF` | Picking & Packing Task Execution | `PRODUCT_VIEW`, `ORDER_VIEW`, `ORDER_FULFILLMENT`, `INVENTORY_VIEW` |
| `DELIVERY_PARTNER` | Assigned Delivery Missions & POD Signatures | `DELIVERY_VIEW`, `DELIVERY_UPDATE`, `DELIVERY_POD_SIGN`, `ORDER_VIEW` |
| `ACCOUNTANT` | General Ledger, AR, AP, Payments & Invoices | `INVOICE_VIEW`, `INVOICE_PRINT`, `INVOICE_DOWNLOAD`, `PAYMENT_VIEW`, `PAYMENT_VERIFY`, `PAYMENT_REVERSE`, `RECEIVABLE_VIEW`, `PAYABLE_VIEW`, `PAYABLE_MANAGE`, `ACCOUNTING_VIEW`, `ACCOUNTING_POST`, `CREDIT_NOTE_MANAGE`, `REPORTING_VIEW` |

---

## 4. Resource-Level Scoping Rules (`ResourceScopeService`)

1. **Salesman Customer Isolation (RULE-SEC-003):**
   ```php
   // Salesmen can ONLY query or mutate customers where customer.salesman_id == auth.user.id
   Customer::forUser($salesman)->where('id', $customerId)->first();
   ```
2. **Salesman Order Isolation:**
   ```php
   // Salesmen can ONLY view or submit orders where order.salesman_id == auth.user.id
   Order::forUser($salesman)->where('id', $orderId)->first();
   ```
3. **Delivery Driver Mission Isolation:**
   ```php
   // Drivers can ONLY view or update deliveries where delivery.driver_id == auth.user.id
   Delivery::forUser($driver)->where('id', $deliveryId)->first();
   ```
4. **Active Account Gate:** All endpoints protected by `account.active` middleware. Inactive, suspended, or terminated accounts fail closed (HTTP 403 / 401).

---

## 5. Multi-Factor Authentication (MFA) Protocol

```text
[Email + Password Auth] ──> Valid?
                               │
                               ├── MFA Enabled? ──> Yes ──> [Redirect /login/mfa Challenge]
                               │                                       │
                               │                                 TOTP Code / Recovery Code?
                               │                                       ├── Valid ──> [Issue Full Session Token]
                               │                                       └── Invalid ──> [Increment Throttle & Deny]
                               │
                               └── No ──> [Issue Full Session Token]
```

---

## 6. Source Code Traceability Index
- `app/Services/Auth/PermissionService.php`
- `app/Services/Auth/ResourceScopeService.php`
- `app/Services/Auth/TwoFactorAuthenticationService.php`
- `app/Services/Auth/SessionRevocationService.php`
- `app/Services/Auth/RoleAssignmentService.php`
- `app/Services/Audit/AuditLogService.php`
- `app/Services/Audit/SecurityLogService.php`
- `app/Http/Controllers/Auth/AuthenticatedSessionController.php`
- `app/Http/Controllers/Auth/MfaChallengeController.php`
- `app/Http/Controllers/Security/TwoFactorAuthenticationController.php`
- `app/Http/Controllers/Security/RoleAssignmentController.php`
- `app/Http/Controllers/Auth/SessionManagementController.php`
- `app/Http/Controllers/Admin/AdminAuditController.php`
- `app/Models/User.php`
- `app/Models/AuditLog.php`
- `app/Models/SecurityLog.php`
- `app/Enums/Permission.php`
- `app/Enums/UserRole.php`
