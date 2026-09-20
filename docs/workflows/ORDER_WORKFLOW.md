# Order Lifecycle Workflow Specification

## 1. Workflow Overview & Purpose
The **Order Lifecycle Workflow** governs the complete lifecycle of wholesale sales orders from field salesman cart draft, price validation, and idempotency protection through operational admin review, multi-warehouse stock reservation, commercial invoice issuance, and post-submission adjustments.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `SALESMAN`, `ADMIN`, `WAREHOUSE_MANAGER`, `ACCOUNTANT`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/salesman/orders` | `salesman.orders.index` | `SalesmanOrderController@index` | `auth`, `account.active`, `role:salesman` |
| `GET` | `/salesman/orders/create` | `salesman.orders.create` | `SalesmanOrderController@create` | `auth`, `account.active`, `role:salesman` |
| `POST` | `/salesman/orders` | `salesman.orders.store` | `SalesmanOrderController@store` | `auth`, `account.active`, `role:salesman` |
| `GET` | `/salesman/orders/{order}` | `salesman.orders.show` | `SalesmanOrderController@show` | `auth`, `account.active`, `role:salesman` |
| `POST` | `/salesman/orders/{order}/cancel` | `salesman.orders.cancel` | `SalesmanOrderController@cancel` | `auth`, `account.active`, `role:salesman` |
| `GET` | `/admin/orders` | `admin.orders.index` | `AdminOrderController@index` | `auth`, `account.active`, `permission:order.view` |
| `GET` | `/admin/orders/{order}` | `admin.orders.show` | `AdminOrderController@show` | `auth`, `account.active`, `permission:order.view` |
| `POST` | `/admin/orders/{order}/approve` | `admin.orders.approve` | `AdminOrderController@approve` | `auth`, `account.active`, `permission:order.approve` |
| `POST` | `/admin/orders/{order}/reject` | `admin.orders.reject` | `AdminOrderController@reject` | `auth`, `account.active`, `permission:order.reject` |
| `POST` | `/admin/orders/{order}/cancel` | `admin.orders.cancel` | `AdminOrderController@cancel` | `auth`, `account.active`, `permission:order.cancel` |
| `POST` | `/admin/order-adjustments/{order}/apply` | `admin.order-adjustments.apply` | `AdminOrderAdjustmentController@apply` | `auth`, `account.active`, `permission:order.adjust` |

### Frontend UI Pages
- Salesman Order Entry: `resources/js/Pages/Salesman/Orders/Create.tsx`
- Salesman Order Details: `resources/js/Pages/Salesman/Orders/Show.tsx`
- Admin Order Control Center: `resources/js/Pages/Admin/Orders/Index.tsx`
- Admin Order Detail & Operational Cards: `resources/js/Pages/Admin/Orders/Show.tsx`, `resources/js/Pages/Admin/Orders/Partials/OrderDetailOperationalCards.tsx`

---

## 3. Step-by-Step Execution Sequence

### A. Order Creation & Submission (`OrderService::createOrder`)
1. **Permission Check:** `permissionService->authorize($actor, Permission::ORDER_CREATE)` and `ORDER_SUBMIT`.
2. **Payload Validation:** Enforces non-empty item array, positive integer quantities, and valid customer ID (`CreateOrderDTO`).
3. **Idempotency Gate:** Checks `idempotency_key` via `Order::where('idempotency_key', $dto->idempotencyKey)->lockForUpdate()->first()`.
   - If key exists with matching payload hash: Returns existing order record (Fast Replay).
   - If key exists with mismatched payload: Throws `ConflictHttpException`.
4. **Customer Scope & Status Validation:**
   - Enforces salesman customer assignment (`Customer::forUser($actor)->where('id', $dto->customerId)->lockForUpdate()->firstOrFail()`).
   - Asserts customer status is `ACTIVE` (`$customer->ensureCanPlaceOrders()`). If `ON_HOLD` or `INACTIVE`, throws `ValidationException`.
5. **Item Price Boundary & Snapshotting (RULE-PRI-001 & RULE-PRI-002):**
   - Locks target product master rows in ascending ID sequence.
   - Asserts product status is `ACTIVE`.
   - Validates unit price against boundaries: `minimum_allowed_price <= actual_price <= mrp`. If out of bounds without authorized override, throws `ValidationException`.
   - Fetches product's active `TaxProfile` and computes line item tax breakdown via `TaxCalculationService`.
   - Snapshots immutable values: `unit_price`, `tax_profile_id`, `tax_rate`, `taxable_amount`, `tax_amount`, `subtotal`, `line_total`.
6. **Order Header Generation:**
   - Generates sequential order number (`ORD-YYYY-MM-XXXX`) via `OrderNumberGenerator`.
   - Calculates totals: `subtotal = sum(taxable_amount)`, `tax_total = sum(tax_amount)`, `grand_total = subtotal + tax_total`.
   - Sets independent dimension statuses:
     - `status = OrderStatus::SUBMITTED`
     - `fulfillment_status = FulfillmentStatus::UNALLOCATED`
     - `payment_status = PaymentStatus::UNPAID`
     - `delivery_status = DeliveryStatus::PENDING_ASSIGNMENT`
     - `adjustment_status = AdjustmentStatus::NONE`
7. **Notification Dispatch:** Calls `DomainNotificationDispatcher->notifyOrderSubmitted($order)` to alert Admins and Warehouse Managers.

### B. Order Approval & Stock Reservation (`OrderWorkflowService::approveOrder`)
1. **Authorization:** Checks `Permission::ORDER_APPROVE`. Explicitly blocks salesmen (`throw new AuthorizationException`).
2. **Pessimistic Locking Hierarchy:**
   `Order` $\rightarrow$ `Customer` $\rightarrow$ `OrderItems` (asc ID) $\rightarrow$ `InventoryBalances` (asc ID).
3. **State Precondition Validation:**
   - Order must be in `SUBMITTED` or `PENDING_APPROVAL`.
   - Fulfillment status must be `UNALLOCATED`.
   - Customer must be `ACTIVE`.
4. **Stock Reservation (RULE-INV-001):**
   - For each line item, checks `available_quantity >= requested_quantity` on `InventoryBalance`.
   - Atomically increments `reserved_quantity` and decrements `available_quantity`.
   - Creates `OrderItemAllocation` with status `ALLOCATED` and `warehouse_id`.
5. **Order State Update:** Sets `status = OrderStatus::APPROVED`, `fulfillment_status = FulfillmentStatus::ALLOCATED`.
6. **Commercial Invoice Handshake:** Automatically triggers `InvoiceGeneratorService::generateForOrder($lockedOrder, $actor)` to issue the commercial invoice and post trade receivables.
7. **Notification Dispatch:** Calls `DomainNotificationDispatcher->notifyOrderApproved($approvedOrder)`.

### C. Post-Submission Adjustments (`OrderAdjustmentService::applyAdjustment`)
1. **Rule Enforcement (RULE-ORD-002 & RULE-DOM-001):** Original `ordered_quantity` on `OrderItem` is NEVER modified.
2. **Adjustment Tracking:** Creates `OrderAdjustment` and child `OrderAdjustmentItem` records.
3. **Delta Allocation & Tax Recalculation:**
   - Adjusts reserved inventory balances up or down based on quantity deltas.
   - Recalculates order subtotal, tax breakdown, and grand total.
   - Synchronizes downstream invoice balance due and Accounts Receivable ledger.

---

## 4. State Lifecycle & Transitions

| Current Status | Event / Trigger | Target Status | Preconditions | Postconditions & Side Effects |
|---|---|---|---|---|
| `DRAFT` | Submit Order | `SUBMITTED` | Items valid, Price bounds valid, Customer active | Order stored; Admin notified; Idempotency locked |
| `SUBMITTED` | Approve Order | `APPROVED` | Stock available, Customer active | Stock reserved; Invoice generated; GL AR posted |
| `SUBMITTED` | Reject Order | `REJECTED` | Reason provided, Admin authorized | Order closed; Reason logged; Salesman notified |
| `SUBMITTED` | Cancel Order | `CANCELLED` | Pre-approval cancellation | Order closed; No inventory impact |
| `APPROVED` | Start Picking | `PROCESSING` | Warehouse picks items | Fulfillment becomes `PICKED`; WMS active |
| `APPROVED` | Cancel Order | `CANCELLED` | Admin cancellation | Reserved stock released; Invoice voided/adjusted |
| `PROCESSING` | Delivery Completed | `COMPLETED` | POD signed, Physical stock out | Order closed; COGS posted; Ledger finalized |

---

## 5. Branching & Business Logic Constraints

1. **Independent Dimension Invariant (RULE-ORD-003):** Order status, fulfillment status, payment status, and delivery status operate as independent state dimensions.
2. **Zero Client Trust (RULE-SEC-002):** Grand total, line totals, and tax amounts sent in the client request are ignored. The server re-evaluates all prices and totals from source product masters and tax profiles.
3. **Credit Limit Warning/Block:** If `order_total > customer_credit_limit - current_receivables`, flags credit warning and routes to `PENDING_APPROVAL`.

---

## 6. Database & Concurrency Boundaries

```text
DB::transaction(function () {
    1. SELECT * FROM orders WHERE id = ? FOR UPDATE;
    2. SELECT * FROM customers WHERE id = ? FOR UPDATE;
    3. SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC FOR UPDATE;
    4. SELECT * FROM inventory_balances WHERE id IN (?) ORDER BY id ASC FOR UPDATE;
    ... mutations ...
});
```

---

## 7. Source Code Traceability Index
- `app/Services/Order/OrderService.php`
- `app/Services/Order/OrderWorkflowService.php`
- `app/Services/Order/OrderNumberGenerator.php`
- `app/Services/Adjustment/OrderAdjustmentService.php`
- `app/Http/Controllers/Salesman/SalesmanOrderController.php`
- `app/Http/Controllers/Admin/AdminOrderController.php`
- `app/Http/Controllers/Admin/AdminOrderAdjustmentController.php`
- `app/Models/Order.php`
- `app/Models/OrderItem.php`
- `app/Models/OrderItemAllocation.php`
- `app/Models/OrderAdjustment.php`
- `app/Policies/OrderPolicy.php`
- `app/Policies/OrderAdjustmentPolicy.php`
