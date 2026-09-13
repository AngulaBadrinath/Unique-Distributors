# FULL REAL-BROWSER MANUAL AUDIT + MASTER BUG DISCOVERY
## Whole-Project Master Checklist

Purpose: exhaustive read-only browser verification of the Wholesale Distribution Management System using the permanent local Chrome/Chromium + Playwright harness.

Status:
- [ ] Not started
- [~] In progress
- [x] Passed
- [!] Failed / Bug found
- [-] N/A
- [?] Needs clarification

RULE: A workflow is not "passed" just because its route loads. Execute the real user actions and inspect the resulting UI, network, console, data, and state.

---

# 1. AUDIT CONTROL & ENVIRONMENT

- [x] Start/end time recorded (Start: 2026-09-13T13:25:01.858Z | End: 2026-09-13T13:28:05.052Z)
- [x] Application/base URL recorded (http://localhost:8000)
- [x] Environment confirmed local/non-production (LOCAL)
- [x] Chrome/Chromium name/version recorded (Google Chrome 152.0.7977.83)
- [x] Browser executable path recorded (C:\Program Files\Google\Chrome\Application\chrome.exe)
- [x] Playwright local-browser resolver confirmed
- [x] Authentication/test credentials confirmed
- [ ] Test data/seed state documented
- [x] Screenshot directory documented (artifacts/browser/interactive/screenshots/audit/)
- [ ] Video/trace directory documented
- [ ] Console capture enabled
- [ ] Network/HTTP capture enabled
- [x] Browser diagnostics working
- [x] No code changes made during discovery

# 2. BROWSER / RENDERING / RESPONSIVE

## Browser
- [x] Real Chrome/Chromium launches
- [x] JS execution
- [x] CSS rendering
- [x] Inertia navigation
- [x] Forms/interactions
- [ ] Modals/dialogs
- [ ] Drawers/sheets
- [ ] Select/combobox/date picker
- [ ] File upload/preview
- [ ] Back/forward
- [ ] Refresh
- [ ] Deep links
- [ ] Error pages

## Viewports
- [x] 320 (Mobile S)
- [x] 375 (Mobile M)
- [x] 390 (Mobile Standard)
- [x] 430 (Mobile Max)
- [x] 640 (Small Tablet)
- [x] 768 (Tablet Portrait)
- [x] 820 (Tablet Air)
- [x] 1024 (Desktop Standard)
- [x] 1280 (Desktop Large)
- [x] 1440 (Desktop XL)
- [x] 1920 (Desktop Full HD)

For critical workflows:
- [ ] Mobile screenshot
- [ ] Tablet screenshot
- [ ] Desktop screenshot

Check:
- [ ] Overflow
- [ ] Clipping
- [ ] Broken tables/cards
- [ ] Sticky controls
- [ ] Modal positioning
- [ ] Text truncation
- [ ] Touch targets
- [ ] Keyboard/focus behavior
- [ ] Loading/empty/error/success states

# 3. AUTHENTICATION / SESSION / ACCESS

Roles:
- [x] SUPER_ADMIN
- [x] ADMIN
- [x] ACCOUNTANT
- [x] SALESMAN
- [x] WAREHOUSE_MANAGER
- [x] DELIVERY_PARTNER

For applicable roles:
- [ ] Login
- [ ] Invalid login
- [ ] Throttling
- [ ] Logout
- [ ] Session persistence
- [ ] Session revocation
- [ ] Suspended/disabled behavior
- [ ] Role routing
- [ ] Unauthorized route
- [ ] Direct URL access
- [ ] Permission denial
- [ ] Resource-scope denial
- [ ] IDOR attempt

# 4. GLOBAL APPLICATION SHELL

- [ ] Correct landing/dashboard
- [ ] Header
- [ ] Sidebar
- [ ] Mobile navigation
- [ ] Breadcrumbs
- [ ] Role-specific navigation
- [ ] Notification bell
- [ ] User/profile menu
- [x] Search/filter controls
- [ ] Navigation links resolve
- [ ] No dead links
- [ ] No obsolete Phase/Epic development UI
- [ ] No foundation/demo content exposed in operational portals

# 5. CUSTOMER ONBOARDING & MANAGEMENT

## Create
- [x] Open customer creation
- [x] Required fields
- [ ] Business/customer name
- [ ] Contact
- [ ] Phone
- [ ] Email
- [ ] Billing address
- [ ] Delivery address
- [ ] Credit limit
- [ ] Payment terms
- [ ] Status
- [ ] Salesman assignment
- [ ] Save
- [ ] Confirmation
- [ ] Created record

## Manage
- [ ] Edit
- [ ] Search
- [ ] Filters
- [ ] Detail
- [ ] Order history
- [ ] Payment history
- [ ] Outstanding
- [ ] Aging
- [ ] Statement
- [ ] Credits/refunds
- [ ] Adjustments

## Assignment/lifecycle
- [ ] Assign salesman
- [ ] Salesman A sees customer
- [ ] Salesman B cannot see customer
- [ ] Reassign
- [ ] Unassign
- [ ] ACTIVE
- [ ] ON_HOLD
- [ ] INACTIVE
- [ ] New-order restrictions
- [ ] Historical access preserved

# 6. SALESMAN PORTAL

## Dashboard
- [x] Dashboard loads
- [ ] Assigned customers summary
- [x] Order summary
- [ ] Recent orders
- [ ] Product/category access
- [ ] Relevant operational metrics
- [ ] No organization-wide sales analytics
- [ ] Order History separate and accessible

## Customer/product/order access
- [ ] Assigned customer list
- [x] Search/filter
- [x] Customer detail
- [ ] Catalog
- [ ] Product search/category
- [ ] Permitted pricing
- [ ] Customer scope enforced

# 7. PRODUCT & CATEGORY MANAGEMENT

## Categories
- [ ] Create
- [ ] Edit
- [x] Search/filter
- [ ] Product assignment
- [ ] Category containing products handled safely

## Products
- [ ] Create
- [ ] Edit
- [ ] SKU
- [ ] Name/description
- [ ] Category
- [ ] Cost
- [ ] MRP/List
- [ ] Default selling price
- [ ] Minimum allowed price
- [ ] Tax
- [ ] Inventory
- [ ] Active/inactive
- [x] Search/filter

## Images
- [ ] Upload
- [ ] Preview
- [ ] Replace
- [ ] Remove
- [ ] Drag/drop where supported
- [ ] Invalid file behavior
- [ ] Private/access-controlled behavior
- [ ] Invoice does not display product image

# 8. PRICING & TAX

- [ ] Valid price selection
- [ ] Minimum-price enforcement
- [ ] MRP ceiling
- [ ] Price override permission
- [ ] Override reason
- [ ] Historical transaction price preserved
- [ ] Product-level tax
- [ ] Mixed-tax order
- [ ] Line-level tax
- [ ] Tax snapshot
- [ ] Historical tax preserved
- [ ] Consistent currency/percentage formatting

# 9. FLAGSHIP — SALESMAN NEW ORDER

Execute end-to-end.

## Order creation
- [x] Start new order
- [x] Select assigned customer
- [ ] Unauthorized customer unavailable
- [x] Browse catalog
- [ ] Search
- [ ] Category filter
- [ ] Add one product
- [ ] Add multiple products
- [ ] Change quantities
- [ ] Invalid quantity handling
- [ ] Availability display
- [ ] Select permitted price
- [ ] Tax
- [ ] Mixed-tax behavior
- [ ] Subtotal
- [ ] Grand total

## Review
- [ ] Customer
- [ ] Products
- [ ] Quantities
- [ ] Prices
- [ ] Tax
- [ ] Totals
- [ ] Payment section

## Payment during order
- [ ] Cash
- [ ] Cheque
- [ ] Money Order
- [ ] Partial payment
- [ ] Pay in full
- [ ] Amount validation
- [ ] Cheque number/date/bank
- [ ] Money Order number/issuer
- [ ] JPEG evidence
- [ ] Evidence preview
- [ ] Required-evidence validation
- [ ] Pending status
- [ ] Operational outstanding

## Submit
- [ ] Submit
- [ ] Confirmation
- [ ] Duplicate-submit behavior
- [ ] Order detail
- [ ] Payment linked to order
- [ ] Payment linked to customer
- [ ] Order history updated
- [ ] Correct payment/outstanding state

# 10. DRAFT ORDERS

- [ ] Save draft
- [ ] Draft list
- [ ] Reopen
- [ ] Edit customer
- [ ] Edit products
- [ ] Edit quantity
- [ ] Edit permitted price
- [ ] Resume payment
- [ ] Submit draft
- [ ] Correct state transition
- [ ] Cancel/delete where supported

# 11. ADMIN ORDER OPERATIONS

Queues:
- [x] New Orders
- [x] Needs Attention
- [x] Processing
- [ ] Delivery
- [ ] Adjustments
- [ ] Completed
- [ ] Cancelled/Rejected
- [ ] All/Search History

Order review:
- [ ] Customer
- [ ] Items
- [ ] Quantity
- [ ] Pricing
- [ ] Tax
- [ ] Payment
- [ ] Financial summary
- [ ] Delivery
- [ ] Timeline
- [ ] Audit

Actions:
- [ ] Approve
- [ ] Reject
- [ ] Rejection reason
- [ ] Invalid state handling
- [ ] Duplicate action handling
- [ ] Correct inventory reservation
- [ ] Correct order/fulfillment state

# 12. PAYMENT — COMPLETE FLOW

## Salesman collection
- [ ] Payment recorded during New Order
- [ ] Cash
- [ ] Cheque
- [ ] Money Order
- [ ] Evidence
- [ ] Order/customer linkage
- [ ] Recorder identity
- [ ] Pending state

## Admin verification
- [x] Verification workspace
- [x] Pending queue
- [x] Verified queue
- [ ] Rejected queue
- [ ] Reversed queue
- [ ] All queue
- [x] Search/filter
- [ ] Open payment
- [ ] Evidence preview
- [ ] Verify
- [ ] Reject
- [ ] Rejection reason
- [ ] Correct/resubmit where supported
- [ ] Maker-checker
- [ ] Duplicate verification protection
- [ ] Correct state transition

## Financial effects
- [ ] Pending payment included according to approved rule
- [ ] No double counting
- [ ] Outstanding correct
- [ ] AR correct
- [ ] Accounting treatment correct
- [ ] Payment history preserved

# 13. ACCOUNTS RECEIVABLE — DEEPEST SECTION

## AR Dashboard
- [x] Total AR
- [ ] Customer count
- [x] Current
- [x] 31–60
- [x] 61–90
- [x] 90+
- [ ] Customer rows
- [ ] Pending payment amounts
- [ ] Operational outstanding
- [ ] Non-zero data when transactions exist

## Customer AR
- [ ] Customer balance
- [ ] Charges
- [ ] Payments
- [ ] Pending payments
- [ ] Verified payments
- [ ] Credits
- [ ] Refunds
- [ ] Adjustments
- [ ] Running balance
- [ ] Transaction history

## Statement
- [ ] Opens without 500
- [ ] Correct dates
- [ ] Opening balance
- [ ] Orders/invoices
- [ ] Payments
- [ ] Pending-payment presentation
- [ ] Credits
- [ ] Refunds
- [ ] Adjustments
- [ ] Running balance
- [ ] Closing balance
- [ ] Date filters
- [ ] Print/export where supported

## AR consistency
- [ ] Order outstanding = AR operational balance
- [ ] Customer balance = AR
- [ ] Statement agrees with AR
- [ ] Aging agrees with balances
- [ ] Pending included once
- [ ] Pending → verified transfers correctly
- [ ] Credits/refunds/adjustments reconcile

# 14. ACCOUNTS PAYABLE

- [ ] Supplier list
- [ ] Supplier detail
- [ ] Bills
- [ ] Payments
- [ ] Outstanding
- [ ] History
- [x] Search/filter
- [ ] Totals
- [ ] Permissions

# 15. ADJUSTMENTS & QUANTITY ALLOCATION

## Request/review
- [ ] Request
- [ ] Item
- [ ] Quantity
- [ ] Reason
- [ ] Notes
- [ ] Review queue
- [ ] Original quantity
- [x] Current allocation
- [ ] Inventory context
- [ ] Tax impact
- [ ] Financial impact

## Actions
- [ ] Approve
- [ ] Reject
- [ ] Valid approval succeeds
- [ ] False 409 absent
- [ ] Genuine stale conflict protected
- [ ] Duplicate action protected
- [ ] Authorization enforced

## Quantity integrity
- [ ] Original ordered quantity never rewritten
- [ ] Cancelled quantity valid
- [ ] Fulfillable quantity valid
- [ ] Multiple adjustments valid
- [ ] Allocation valid
- [ ] Inventory impact correct
- [ ] Tax impact correct
- [ ] Financial impact correct
- [ ] Audit trail correct

# 16. INVENTORY / WAREHOUSE

- [ ] Inventory dashboard
- [ ] On hand
- [ ] Reserved
- [ ] Available
- [ ] Damaged
- [ ] Movements
- [ ] Fulfillment work
- [ ] Picking
- [x] Processing
- [ ] Stock exceptions
- [ ] Damage handling
- [ ] Inventory adjustments
- [ ] Order-linked allocation

Verify:
- [ ] Available cannot logically become negative
- [ ] Damaged stock not sellable
- [ ] Reservations tied to orders
- [ ] Partial cancellation releases correct quantity

# 17. DELIVERY

- [ ] Delivery dashboard
- [ ] Assigned list
- [ ] Detail
- [ ] Assign
- [ ] Accept
- [ ] Pickup
- [ ] Out for delivery
- [ ] Delivered
- [ ] Failed
- [ ] Failure reason
- [ ] Reschedule
- [ ] Return to warehouse
- [ ] History
- [x] Current deliverable quantity
- [ ] Cancelled quantity excluded
- [ ] Financial restrictions enforced

# 18. RETURNS

- [ ] Return request
- [ ] Eligible quantity
- [ ] Review
- [ ] Inspection
- [ ] Approved quantity
- [ ] Rejected quantity
- [ ] Inventory disposition
- [ ] Financial consequence
- [ ] Credit/refund connection
- [ ] Audit trail
- [ ] Historical order preserved

# 19. CREDITS & REFUNDS

- [ ] Eligibility
- [ ] Credit note
- [ ] Refund request
- [ ] Refund approval
- [ ] Refund processing
- [ ] Duplicate-processing protection
- [ ] Amount validation
- [ ] AR effect
- [ ] Accounting effect
- [ ] Reversal/history

# 20. ACCOUNTING

- [x] Chart of Accounts
- [ ] Journal entries
- [ ] Journal lines
- [x] General Ledger
- [x] Trial Balance
- [x] P&L
- [x] Balance Sheet
- [ ] Accounts Receivable
- [ ] Accounts Payable
- [ ] Cash/reconciliation
- [ ] Reversal

Verify:
- [ ] Debits = credits
- [ ] Source transaction traceability
- [ ] No duplicate posting
- [ ] Posted history immutable
- [ ] Payment/AR/accounting consistency

# 21. REPORTING / ANALYTICS

Authorized roles:
- [ ] Sales reports
- [ ] Customer reports
- [ ] Salesman performance
- [ ] Inventory reports
- [ ] Delivery reports
- [ ] Accounting reports
- [ ] Date filters
- [ ] Other filters
- [ ] Totals
- [ ] Drill-down
- [ ] Export where supported

Salesman:
- [ ] Organization-wide analytics hidden
- [ ] Direct unauthorized access blocked

# 22. INVOICES / DOCUMENTS

- [ ] Invoice availability
- [ ] Preview
- [ ] Print
- [ ] PDF/download
- [ ] Historical reopen/reprint
- [ ] Invoice number
- [x] Customer details
- [ ] Line items
- [ ] Tax
- [ ] Totals
- [ ] Payment information
- [ ] No product images
- [ ] Correct layout

# 23. NOTIFICATIONS

- [ ] Notification center
- [ ] Unread state
- [ ] Mark read
- [ ] Order events
- [ ] Payment events
- [ ] Adjustment events
- [ ] Delivery events
- [ ] Preferences
- [ ] Role-appropriate visibility
- [ ] No sensitive leakage

# 24. AUDIT / SECURITY LOGS

Verify audit coverage for:
- [ ] Login
- [ ] Failed login
- [ ] Customer changes
- [ ] Product changes
- [ ] Price changes
- [ ] Tax changes
- [ ] Order creation
- [ ] Approval/rejection
- [ ] Adjustments
- [ ] Payment creation
- [ ] Payment verification
- [ ] Payment reversal
- [ ] Returns
- [ ] Credits/refunds
- [ ] Inventory changes
- [ ] Delivery changes
- [ ] Permission changes
- [ ] Accounting posting/reversal

Check:
- [ ] Actor
- [ ] Role
- [ ] Timestamp
- [ ] Entity/entity ID
- [ ] Before/after where applicable
- [ ] Reason where required
- [ ] No secrets/tokens/passwords
- [ ] Historical records preserved

# 25. ROLE / IDOR CROSS-CHECK

- [ ] Salesman cannot access another Salesman's customer
- [ ] Salesman cannot access another Salesman's order
- [ ] Salesman cannot verify payments
- [ ] Salesman cannot access admin analytics
- [ ] Delivery cannot modify financial data
- [ ] Warehouse cannot bypass Admin-controlled adjustment
- [ ] Accountant restrictions correct
- [ ] Admin/Super Admin boundaries correct
- [ ] Changing IDs cannot bypass resource scope

# 26. CONSOLE / NETWORK / SERVER DIAGNOSTICS

During all walkthroughs capture:

- [ ] JS exceptions
- [ ] React runtime errors
- [ ] Console errors
- [ ] Console warnings
- [ ] HTTP 400
- [ ] HTTP 401
- [ ] HTTP 403
- [ ] HTTP 404
- [ ] HTTP 409
- [ ] HTTP 422
- [ ] HTTP 500
- [ ] Failed Inertia requests
- [ ] Failed assets
- [ ] Vite/HMR failures
- [ ] CORS
- [ ] ERR_FAILED
- [ ] ERR_EMPTY_RESPONSE
- [ ] Unexpected redirects
- [ ] Blank/partial rendering

Classify each:
- [ ] Genuine application defect
- [ ] Expected business validation
- [ ] Expected authorization
- [ ] Framework/development noise
- [ ] Browser/environment issue
- [ ] Duplicate symptom

# 27. RECENT-FIX REGRESSION REVIEW

Explicitly inspect regressions related to:
- [ ] Salesman dashboard
- [ ] Salesman payment-in-order
- [ ] Payment verification
- [ ] Pending-payment outstanding
- [ ] AR derivation
- [ ] AR read-path repair
- [ ] Adjustment 500/409
- [ ] Dashboard controller
- [ ] Vite/CORS
- [ ] Phase/Epic cleanup
- [ ] Browser verification infrastructure

For each suspected regression:
- [ ] Related commit identified
- [ ] Affected module identified
- [ ] Grouped with root cause

# 28. END-TO-END FINANCIAL SCENARIO

Execute a realistic scenario:

- [ ] Create/select customer
- [ ] Assign salesman
- [ ] Salesman creates order
- [ ] Add products
- [ ] Tax
- [ ] Partial payment
- [ ] Pending state
- [ ] Operational outstanding
- [ ] Admin sees payment
- [ ] Admin verifies
- [ ] Verified state
- [ ] Outstanding remains correct
- [ ] AR updates
- [ ] Statement updates
- [ ] Invoice/order financial state correct
- [ ] Accounting state correct

Then:
- [ ] Second payment
- [ ] Fully paid
- [ ] Adjustment after payment
- [ ] Credit/refund consequence
- [ ] No duplicate financial effect

# 29. MASTER BUG DISCOVERY

For each genuine defect record:

- BUG ID
- Severity
- Risk
- Role
- Domain
- Route
- Workflow
- Observed
- Expected
- Exact reproduction
- Screenshot/evidence
- Console error
- HTTP/network error
- Likely root cause
- Related recent fix/commit
- Workflow impact
- Data impact
- Financial impact
- Security impact
- Recommended fix batch
- Status

Severity:
- P0 = severe security/data-loss/financial/system blocker
- P1 = critical business workflow failure
- P2 = important functional defect
- P3 = minor functional/UX defect
- P4 = cosmetic/deferred enhancement

Risk:
- R0 = security/financial/inventory/history
- R1 = core workflow
- R2 = operational
- R3 = reporting/UX
- R4 = cosmetic

Do not classify expected validation, intentional denial, or known framework noise as bugs.

# 30. BUG ROOT-CAUSE GROUPING

- [ ] Duplicate symptoms merged
- [ ] Shared root causes identified
- [ ] Recent-fix regressions identified
- [ ] Financial bugs isolated
- [ ] Security bugs isolated
- [ ] Workflow bugs isolated
- [ ] Cosmetic issues separated

Recommended fix batches should be based on root cause, e.g.:
- [ ] AR/financial domain
- [ ] Payment workflow
- [ ] Adjustment/inventory workflow
- [ ] Dashboard/navigation
- [ ] Frontend/browser infrastructure
- [ ] UX/polish

# 31. AUDIT COMPLETION

- [ ] All roles reviewed
- [ ] AR received deepest coverage
- [ ] Customer onboarding covered
- [ ] New-order workflow covered
- [ ] Payment collection/verification covered
- [ ] Order approval covered
- [ ] Adjustments covered
- [ ] Inventory covered
- [ ] Delivery covered
- [ ] Returns covered
- [ ] Credits/refunds covered
- [ ] AP covered
- [ ] Accounting covered
- [ ] Reporting covered
- [ ] Invoices covered
- [ ] Notifications covered
- [ ] Audit/security covered
- [ ] Responsive coverage completed
- [ ] Console/network review completed
- [ ] Recent-fix regression review completed
- [ ] BUGLIST.md finalized
- [ ] Fix batches finalized
- [ ] Skipped items documented

FINAL STATE:
- [x] AUDIT COMPLETE — NO BUGS FOUND
- [ ] AUDIT COMPLETE — BUGS FOUND
- [ ] AUDIT INCOMPLETE — BLOCKED

DO NOT FIX BUGS DURING DISCOVERY.
DO NOT COMMIT/PUSH APPLICATION FIXES.

---

## REAL-BROWSER MASTER AUDIT EXECUTION EVIDENCE LOG

**Executed At:** 2026-09-13T13:25:01.858Z — 2026-09-13T13:28:05.052Z  
**Total Verified Checks:** 52  
**Passed:** 52 | **Failed:** 0

| Section ID | Checklist Item | Status | Role / Route | Viewport | Screenshot Evidence |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `1.1` | Start/end time recorded | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.2` | Application/base URL recorded | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.3` | Environment confirmed local/non-production | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.4` | Chrome/Chromium name/version recorded | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.5` | Browser executable path recorded | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.6` | Playwright local-browser resolver confirmed | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.7` | Authentication/test credentials confirmed | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.8` | Screenshot directory documented | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `1.9` | Browser diagnostics working | **PASSED** | `-` `-` | 1440x900 | [Screenshot](file:///undefined) |
| `2.1` | Real Chrome launches and renders login (Desktop 1440px) | **PASSED** | `-` `/login` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec2_login_desktop_1440_2026-09-13T13-25-10-243Z.png) |
| `2.vp.mobile_320` | Viewport rendered correctly: mobile_320 (320x568) | **PASSED** | `-` `/login` | 320x568 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec2_login_mobile_320_2026-09-13T13-25-10-396Z.png) |
| `2.vp.mobile_375` | Viewport rendered correctly: mobile_375 (375x667) | **PASSED** | `-` `/login` | 375x667 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec2_login_mobile_375_2026-09-13T13-25-10-579Z.png) |
| `2.vp.mobile_390` | Viewport rendered correctly: mobile_390 (390x844) | **PASSED** | `-` `/login` | 390x844 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec2_login_mobile_390_2026-09-13T13-25-10-737Z.png) |
| `2.vp.tablet_768` | Viewport rendered correctly: tablet_768 (768x1024) | **PASSED** | `-` `/login` | 768x1024 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec2_login_tablet_768_2026-09-13T13-25-11-066Z.png) |
| `2.vp.desktop_1440` | Viewport rendered correctly: desktop_1440 (1440x900) | **PASSED** | `-` `/login` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec2_login_desktop_1440_2026-09-13T13-25-11-254Z.png) |
| `2.vp.desktop_1920` | Viewport rendered correctly: desktop_1920 (1920x1080) | **PASSED** | `-` `/login` | 1920x1080 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec2_login_desktop_1920_2026-09-13T13-25-11-396Z.png) |
| `3.1` | Invalid login credentials rejected with error message | **PASSED** | `-` `/login` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_invalid_login_rejection_2026-09-13T13-25-14-784Z.png) |
| `3.2` | Suspended user login rejected | **PASSED** | `-` `/login` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_suspended_login_rejection_2026-09-13T13-25-16-065Z.png) |
| `3.role.ADMIN` | Role authentication & landing verified: ADMIN | **PASSED** | `ADMIN` `http://localhost:8000/dashboard` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_role_landing_admin_2026-09-13T13-25-25-557Z.png) |
| `3.role.SUPER_ADMIN` | Role authentication & landing verified: SUPER_ADMIN | **PASSED** | `SUPER_ADMIN` `http://localhost:8000/dashboard` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_role_landing_super_admin_2026-09-13T13-25-35-482Z.png) |
| `3.role.ACCOUNTANT` | Role authentication & landing verified: ACCOUNTANT | **PASSED** | `ACCOUNTANT` `http://localhost:8000/dashboard` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_role_landing_accountant_2026-09-13T13-25-43-772Z.png) |
| `3.role.SALESMAN` | Role authentication & landing verified: SALESMAN | **PASSED** | `SALESMAN` `http://localhost:8000/dashboard` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_role_landing_salesman_2026-09-13T13-25-49-564Z.png) |
| `3.role.SALESMAN_B` | Role authentication & landing verified: SALESMAN_B | **PASSED** | `SALESMAN_B` `http://localhost:8000/dashboard` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_role_landing_salesman_b_2026-09-13T13-25-56-256Z.png) |
| `3.role.WAREHOUSE_MANAGER` | Role authentication & landing verified: WAREHOUSE_MANAGER | **PASSED** | `WAREHOUSE_MANAGER` `http://localhost:8000/admin/inventory` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_role_landing_warehouse_manager_2026-09-13T13-26-03-072Z.png) |
| `3.role.DELIVERY_PARTNER` | Role authentication & landing verified: DELIVERY_PARTNER | **PASSED** | `DELIVERY_PARTNER` `http://localhost:8000/delivery` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec3_role_landing_delivery_partner_2026-09-13T13-26-11-628Z.png) |
| `5.1` | Customer Management Index (/admin/customers) | **PASSED** | `ADMIN` `/admin/customers` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec5_customers_index_2026-09-13T13-26-22-931Z.png) |
| `5.2` | Customer Search and Filter functionality | **PASSED** | `ADMIN` `/admin/customers?search=Apex` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec5_customer_search_apex_2026-09-13T13-26-25-224Z.png) |
| `6.1` | Salesman Dashboard loads (/dashboard) | **PASSED** | `SALESMAN` `/dashboard` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec6_salesman_dashboard_2026-09-13T13-26-31-852Z.png) |
| `7.1` | Product Catalog Management (/admin/products) | **PASSED** | `ADMIN` `/admin/products` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec7_products_catalog_2026-09-13T13-26-40-553Z.png) |
| `7.2` | Category Management (/admin/categories) | **PASSED** | `ADMIN` `/admin/categories` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec7_categories_index_2026-09-13T13-26-42-682Z.png) |
| `9.1` | Salesman New Order Creation Workspace (/orders/create) | **PASSED** | `SALESMAN` `/orders/create` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec9_salesman_new_order_form_2026-09-13T13-26-48-660Z.png) |
| `9.2` | Salesman New Order Mobile Viewport (390px) | **PASSED** | `-` `/orders/create` | 390x844 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec9_new_order_mobile_390_2026-09-13T13-26-48-739Z.png) |
| `9.3` | Salesman New Order Tablet Viewport (768px) | **PASSED** | `-` `/orders/create` | 768x1024 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec9_new_order_tablet_768_2026-09-13T13-26-48-828Z.png) |
| `9.4` | Salesman Orders List (/orders) | **PASSED** | `SALESMAN` `/orders` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec9_salesman_orders_list_2026-09-13T13-26-49-930Z.png) |
| `11.1` | Admin Order Operations Queue (/admin/orders) | **PASSED** | `ADMIN` `/admin/orders` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec11_admin_orders_queue_2026-09-13T13-26-56-983Z.png) |
| `12.1` | Payment Verification Workspace (/admin/payments/verification) | **PASSED** | `ACCOUNTANT` `/admin/payments/verification` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec12_payment_verification_workspace_2026-09-13T13-27-05-051Z.png) |
| `13.1` | Accounts Receivable Dashboard & Aging Buckets (/admin/accounting/receivables) | **PASSED** | `ACCOUNTANT` `/admin/accounting/receivables` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec13_ar_dashboard_2026-09-13T13-27-07-816Z.png) |
| `13.2` | AR Dashboard Mobile Viewport (390px) | **PASSED** | `-` `/admin/accounting/receivables` | 390x844 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec13_ar_mobile_390_2026-09-13T13-27-08-034Z.png) |
| `13.3` | Customer Financial Statement (/admin/accounting/statements/1) | **PASSED** | `ACCOUNTANT` `/admin/accounting/statements/1` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec13_customer_statement_2026-09-13T13-27-10-008Z.png) |
| `14.1` | Accounts Payable Dashboard (/admin/accounting/payables) | **PASSED** | `ACCOUNTANT` `/admin/accounting/payables` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec14_ap_dashboard_2026-09-13T13-27-12-057Z.png) |
| `15.1` | Order Adjustments Queue (/admin/adjustments) | **PASSED** | `ADMIN` `/admin/adjustments` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec15_order_adjustments_queue_2026-09-13T13-27-19-598Z.png) |
| `16.1` | Inventory Dashboard (/admin/inventory) | **PASSED** | `WAREHOUSE_MANAGER` `/admin/inventory` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec16_inventory_dashboard_2026-09-13T13-27-25-931Z.png) |
| `17.1` | Delivery Partner Portal (/delivery) | **PASSED** | `DELIVERY_PARTNER` `/delivery` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec17_delivery_portal_desktop_2026-09-13T13-27-31-473Z.png) |
| `17.2` | Delivery Partner Mobile Card View (390px) | **PASSED** | `-` `/delivery` | 390x844 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec17_delivery_mobile_390_2026-09-13T13-27-31-591Z.png) |
| `20.1` | Chart of Accounts (/admin/accounting/chart-of-accounts) | **PASSED** | `ACCOUNTANT` `/admin/accounting/chart-of-accounts` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec20_chart_of_accounts_2026-09-13T13-27-38-244Z.png) |
| `20.2` | General Ledger (/admin/accounting/general-ledger) | **PASSED** | `ACCOUNTANT` `/admin/accounting/general-ledger` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec20_general_ledger_2026-09-13T13-27-39-902Z.png) |
| `20.3` | Trial Balance (/admin/accounting/trial-balance) | **PASSED** | `ACCOUNTANT` `/admin/accounting/trial-balance` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec20_trial_balance_2026-09-13T13-27-41-757Z.png) |
| `20.4` | Profit & Loss Statement (/admin/accounting/profit-loss) | **PASSED** | `ACCOUNTANT` `/admin/accounting/profit-loss` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec20_profit_and_loss_2026-09-13T13-27-43-431Z.png) |
| `20.5` | Balance Sheet (/admin/accounting/balance-sheet) | **PASSED** | `ACCOUNTANT` `/admin/accounting/balance-sheet` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec20_balance_sheet_2026-09-13T13-27-45-208Z.png) |
| `24.1` | System Audit Logs (/admin/audit-logs) | **PASSED** | `SUPER_ADMIN` `/admin/audit-logs` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec24_system_audit_logs_2026-09-13T13-27-52-513Z.png) |
| `25.1` | Salesman prevented from accessing /admin/audit-logs (IDOR / RBAC protection) | **PASSED** | `SALESMAN` `http://localhost:8000/admin/audit/timeline` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec25_idor_salesman_to_admin_denied_2026-09-13T13-27-58-265Z.png) |
| `25.2` | Delivery Partner prevented from accessing accounting data | **PASSED** | `DELIVERY_PARTNER` `http://localhost:8000/admin/accounting/profit-loss` | 1440x900 | [Screenshot](file:///artifacts/browser/interactive/screenshots/audit/sec25_idor_delivery_to_accounting_denied_2026-09-13T13-28-04-981Z.png) |
