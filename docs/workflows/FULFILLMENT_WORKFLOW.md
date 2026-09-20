# Warehouse Fulfillment & WMS Workflow Specification

## 1. Workflow Overview & Purpose
The **Warehouse Fulfillment Workflow** manages physical warehouse staging, picking manifests, packing verification, and dispatch handover to the delivery logistics fleet.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `WAREHOUSE_MANAGER`, `WAREHOUSE_STAFF`, `ADMIN`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/warehouse/fulfillment` | `warehouse.fulfillment.index` | `WarehouseFulfillmentController@index` | `auth`, `account.active`, `permission:order.fulfillment` |
| `GET` | `/warehouse/fulfillment/{order}` | `warehouse.fulfillment.show` | `WarehouseFulfillmentController@show` | `auth`, `account.active`, `permission:order.fulfillment` |
| `POST` | `/warehouse/fulfillment/{order}/pick` | `warehouse.fulfillment.pick` | `WarehouseFulfillmentController@pick` | `auth`, `account.active`, `permission:order.fulfillment` |
| `POST` | `/warehouse/fulfillment/{order}/pack` | `warehouse.fulfillment.pack` | `WarehouseFulfillmentController@pack` | `auth`, `account.active`, `permission:order.fulfillment` |
| `POST` | `/warehouse/fulfillment/{order}/dispatch` | `warehouse.fulfillment.dispatch` | `WarehouseFulfillmentController@dispatch` | `auth`, `account.active`, `permission:order.fulfillment` |

### Frontend UI Pages
- Fulfillment Work Queue: `resources/js/Pages/Warehouse/Fulfillment/Index.tsx`
- Picking & Packing Manifest Details: `resources/js/Pages/Warehouse/Fulfillment/Show.tsx`

---

## 3. Step-by-Step Execution Sequence

### A. Queue Filtering & Tab Aggregation (`WarehouseFulfillmentService::paginateFulfillmentOrders`)
1. Filters orders with statuses `APPROVED` or `PROCESSING`.
2. Computes tab counter badges:
   - `all`: Total active fulfillment orders.
   - `awaiting`: Orders with `fulfillment_status = RESERVED` (Allocated, awaiting picking).
   - `in_fulfillment`: Orders with `fulfillment_status` in `[PICKED, PACKED]`.
   - `ready_dispatch`: Orders with `fulfillment_status = DISPATCHED`.

### B. Order Picking (`WarehouseFulfillmentService::pickOrder`)
1. **Authorization Gate:** Checks user active status and fulfillment permissions.
2. **Pessimistic Order Lock:** Locks `Order` where `id = ?` (`lockForUpdate()`).
3. **State Guard:** Asserts order status is not in `[DRAFT, CANCELLED, REJECTED, COMPLETED]`.
4. **Item Picking & Allocation Synchronization:**
   - Locks line items (`OrderItem`) in ascending ID sequence.
   - Updates `picked_quantity` on each item (capped at `fulfillableQuantity()`).
   - Updates `OrderItemAllocation` status to `AllocationStatus::PICKED`.
5. **Order State Update:** Sets `fulfillment_status = FulfillmentStatus::PICKED`, `status = OrderStatus::PROCESSING`.
6. **Fulfillment Audit Logging:** Logs structured `commerce.fulfillment_event` (`ORDER_PICKED`).

### C. Order Packing (`WarehouseFulfillmentService::packOrder`)
1. **Pessimistic Order Lock:** Locks target order.
2. **Pack Validation:** Ensures all line items have non-zero picked quantities.
3. **Allocation Progression:** Updates `OrderItemAllocation` status to `AllocationStatus::PACKED`.
4. **Order State Update:** Sets `fulfillment_status = FulfillmentStatus::PACKED`.
5. **Fulfillment Audit Logging:** Logs `commerce.fulfillment_event` (`ORDER_PACKED`).

### D. Order Dispatch & Delivery Handover (`WarehouseFulfillmentService::dispatchOrder`)
1. **Pessimistic Order & Customer Lock:** Locks order and associated customer.
2. **Item Dispatched Quantities:** Sets `dispatched_quantity = picked_quantity` across items and allocations (`AllocationStatus::DISPATCHED`).
3. **Order State Update:**
   - `fulfillment_status = FulfillmentStatus::DISPATCHED`
   - `delivery_status = DeliveryStatus::PENDING_ASSIGNMENT`
   - `status = OrderStatus::PROCESSING`
4. **Delivery Entity Creation:**
   - Checks if a `Delivery` record already exists for the order. If not:
   - Generates sequential delivery number (`DEL-YYYY-MM-XXXX`) via `DeliveryNumberGenerator`.
   - Snapshots shipping recipient, contact phone, and verified physical address lines.
   - Creates child `DeliveryItem` records with snapshot quantities.
   - Records initial `DeliveryEvent` (`EventType: DISPATCHED`).
5. **Notification Dispatch:** Calls `DomainNotificationDispatcher->notifyOrderDispatched($lockedOrder, $delivery)` to alert Logistics Coordinators.

---

## 4. Fulfillment State Matrix

| Action | Previous Fulfillment Status | New Fulfillment Status | Order Status | Allocation Status | Delivery Record |
|---|---|---|---|---|---|
| Approve Order | `UNALLOCATED` | `ALLOCATED` | `APPROVED` | `ALLOCATED` | None |
| Pick Items | `ALLOCATED` / `RESERVED` | `PICKED` | `PROCESSING` | `PICKED` | None |
| Pack Items | `PICKED` | `PACKED` | `PROCESSING` | `PACKED` | None |
| Dispatch Order | `PACKED` | `DISPATCHED` | `PROCESSING` | `DISPATCHED` | Created (`PENDING_ASSIGNMENT`) |

---

## 5. Concurrency & Integrity Rules
- **Physical Stock Hold:** During picking, packing, and dispatch, inventory remains in the warehouse `reserved_quantity` balance. Physical inventory is not deducted until successful delivery completion.
- **Stock Exceptions Handling:** If warehouse operators discover damaged or missing units during picking, `StockExceptionService` logs a `StockException` record and flags the line for operational adjustment.

---

## 6. Source Code Traceability Index
- `app/Services/Warehouse/WarehouseFulfillmentService.php`
- `app/Services/Allocation/OrderAllocationService.php`
- `app/Services/Allocation/OrderAllocationValidationService.php`
- `app/Services/Inventory/StockExceptionService.php`
- `app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php`
- `app/Models/OrderItemAllocation.php`
- `app/Models/Delivery.php`
- `app/Models/DeliveryItem.php`
- `app/Models/StockException.php`
