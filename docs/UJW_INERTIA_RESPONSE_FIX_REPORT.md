# UJW Inertia Response Fix Report

**Document Version:** 1.0  
**Date:** October 30, 2026  
**Status:** IMPLEMENTED & VERIFIED  
**Target File(s):**
- [UserLifecycleController.php](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/UserLifecycleController.php)
- [RoleAssignmentController.php](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Security/RoleAssignmentController.php)
- [AdminInvoiceController.php](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminInvoiceController.php)

---

## 1. Executive Summary

Inertia.js relies on standard HTTP redirects (302/303) following POST, PUT, and DELETE mutations to update page props without full reloads. When Axios makes Inertia requests, it includes `Accept: text/html, application/xhtml+xml` along with `X-Inertia: true`. However, standard AJAX requests or certain browser configurations may send `Accept: application/json`. 

In previous implementations, controllers used:
```php
if ($request->wantsJson()) {
    return response()->json(...);
}
```
Because `$request->wantsJson()` is true whenever `Accept: application/json` is sent, controllers were returning raw JSON responses instead of Inertia redirects. This caused Inertia client modals to receive raw JSON payloads, breaking the modal state and failing to refresh the underlying UI props.

---

## 2. Remediation Contract (`CHANGE-040`)

To strictly preserve Inertia lifecycle contracts while supporting headless API clients, all mutation controllers were refactored to require:
```php
if ($request->wantsJson() && ! $request->header('X-Inertia')) {
    return response()->json(...);
}

return redirect()->...;
```

### 2.1 Controllers Updated

1. **`UserLifecycleController::updateStatus()`** (lines 44–54):
   - Only returns JSON when `$request->header('X-Inertia')` is false.
   - For Inertia requests, issues `redirect()->back()->with('status', ...)` to properly refresh user tables and dismiss modals.

2. **`UserLifecycleController::destroy()`** (lines 81–85):
   - For Inertia requests, issues `redirect()->route('roles.index')->with('status', ...)` with HTTP 303 compatibility.
   - Programmatic JSON clients receive the structured status response.

3. **`RoleAssignmentController::update()`** (lines 89–95):
   - Added `&& ! $request->header('X-Inertia')` to ensure role changes properly reload user role badges without throwing modal errors.

4. **`AdminInvoiceController::generate()`** (lines 109–115):
   - Added `&& ! $request->header('X-Inertia')` to allow invoice generation from the order management interface to redirect and expose the newly created invoice download URL in Inertia page props.

---

## 3. Verification

- Tested via `tests/Feature/Security/UserLifecyclePostgresConstraintTest.php`:
  - `test_inertia_requests_receive_redirect_not_plain_json`: Sent `X-Inertia: true` and verified HTTP 302/303 redirect with flash message, confirming no raw JSON was served.
  - `test_json_api_requests_receive_json_response`: Sent pure `Accept: application/json` and verified HTTP 200 JSON payload.
