# Delivery Logistics & Partner Workflow Specification

## 1. Workflow Overview & Purpose
The **Delivery Logistics Workflow** governs assignment, route tracking, in-transit custody, Electronic Proof of Delivery (POD) capture, physical inventory deduction (`SALE_OUT`), and automated Cost of Goods Sold (COGS) general ledger posting.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `DELIVERY_PARTNER`, `ADMIN`, `DISPATCHER`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/delivery-partner/dashboard` | `delivery-partner.dashboard` | `DeliveryPartnerController@dashboard` | `auth`, `account.active`, `role:delivery_partner` |
| `GET` | `/delivery-partner/deliveries` | `delivery-partner.deliveries.index` | `DeliveryPartnerController@index` | `auth`, `account.active`, `role:delivery_partner` |
| `GET` | `/delivery-partner/deliveries/{delivery}` | `delivery-partner.deliveries.show` | `DeliveryPartnerController@show` | `auth`, `account.active`, `role:delivery_partner` |
| `POST` | `/delivery-partner/deliveries/{delivery}/pickup` | `delivery-partner.deliveries.pickup` | `DeliveryPartnerController@pickup` | `auth`, `account.active`, `role:delivery_partner` |
| `POST` | `/delivery-partner/deliveries/{delivery}/transit` | `delivery-partner.deliveries.transit` | `DeliveryPartnerController@transit` | `auth`, `account.active`, `role:delivery_partner` |
| `POST` | `/delivery-partner/deliveries/{delivery}/complete` | `delivery-partner.deliveries.complete` | `DeliveryPartnerController@complete` | `auth`, `account.active`, `role:delivery_partner` |
| `POST` | `/delivery-partner/deliveries/{delivery}/fail` | `delivery-partner.deliveries.fail` | `DeliveryPartnerController@fail` | `auth`, `account.active`, `role:delivery_partner` |
| `POST` | `/admin/deliveries/{delivery}/assign` | `admin.deliveries.assign` | `AdminDeliveryController@assign` | `auth`, `account.active`, `permission:delivery.update` |

### Frontend UI Pages
- Delivery Partner Mobile Dashboard: `resources/js/Pages/DeliveryPartner/Dashboard.tsx`
- Active Mission & Run Sheet: `resources/js/Pages/DeliveryPartner/Deliveries/Index.tsx`
- Delivery POD & Signature Pad: `resources/js/Pages/DeliveryPartner/Deliveries/Show.tsx`
- Admin Fleet Dispatch Board: `resources/js/Pages/Admin/Deliveries/Index.tsx`

---

## 3. Step-by-Step Execution Sequence

### A. Driver Assignment (`DeliveryAssignmentService::assignDriver`)
1. **Authorization:** Checks `Permission::DELIVERY_UPDATE`.
2. **Driver Role Validation:** Asserts target user holds `UserRole::DELIVERY_PARTNER` and status `AccountStatus::ACTIVE`.
3. **Pessimistic Locking:** Locks `Delivery` and `Order`.
4. **State Transition:** Sets `driver_id = $driver->id`, `status = DeliveryStatus::ASSIGNED`.
5. **Event Logging:** Records `DeliveryEvent` (`EventType: ASSIGNED`).

### B. Warehouse Pickup Confirmation (`DeliveryWorkflowService::confirmPickup`)
1. **Actor Scoping Gate:** Asserts authenticated driver matches `delivery->driver_id` (`ResourceScopeService::canAccessDelivery`).
2. **Pessimistic Lock Hierarchy:** `Order` $\rightarrow$ `Delivery` $\rightarrow$ `OrderItemAllocations`.
3. **Custody Transition:** Sets `Delivery` status to `PICKED_UP`, `actual_pickup_at = now()`.
4. **Order State Update:** Sets Order `delivery_status = DeliveryStatus::IN_TRANSIT`, `fulfillment_status = FulfillmentStatus::DISPATCHED`.
5. **Event Logging:** Records `DeliveryEvent` (`EventType: PICKED_UP`).

### C. Out for Delivery / In-Transit (`DeliveryWorkflowService::startTransit`)
1. **Pessimistic Lock:** Locks `Delivery` and `Order`.
2. **State Transition:** Sets `Delivery` status to `OUT_FOR_DELIVERY`.
3. **Order State Update:** Sets Order `delivery_status = DeliveryStatus::OUT_FOR_DELIVERY`.
4. **Event Logging:** Records `DeliveryEvent` (`EventType: OUT_FOR_DELIVERY`).

### D. Electronic Proof of Delivery & Completion (`DeliveryWorkflowService::completeDelivery`)
1. **Evidence Validation (RULE-SEC-004):**
   - Requires recipient signature (`pod_signature`) or delivery photo (`pod_photo`).
   - Uploaded photos validated for MIME type via magic bytes (`\xFF\xD8\xFF`), sanitized, and stored in private storage.
2. **Deterministic Transaction Lock:**
   `Order` $\rightarrow$ `Delivery` $\rightarrow$ `OrderItemAllocations` $\rightarrow$ `InventoryBalances` (asc ID).
3. **Physical Stock Deduction (RULE-INV-001):**
   - For each delivered line item, calls `InventoryMovementService::recordMovement()`.
   - Decrements both `physical_quantity` and `reserved_quantity` by delivered quantity.
   - Creates `InventoryMovement` record (`movement_type = SALE_OUT`, with previous & new balance snapshots).
4. **Delivery Entity Finalization:**
   - Sets `Delivery` status to `DELIVERED`, `delivered_at = now()`.
   - Snapshots `pod_recipient_name`, `pod_signature_path`, `pod_photo_path`, and GPS geotag coordinates.
5. **Order Lifecycle Finalization:**
   - Sets Order `delivery_status = DeliveryStatus::DELIVERED`.
   - If payment is fully settled, transitions Order `status = OrderStatus::COMPLETED`.
6. **General Ledger COGS Posting (RULE-ACC-001):**
   - Calls `JournalMappingService::postOrderDeliveredCogs($lockedOrder)`.
   - Generates balanced GL journal entry:
     - **Debit:** `5010` (Cost of Goods Sold)
     - **Credit:** `1200` (Inventory Asset)
7. **Notification Dispatch:** Calls `DomainNotificationDispatcher->notifyDeliveryCompleted($lockedOrder, $lockedDelivery)`.

### E. Delivery Failure Handling (`DeliveryWorkflowService::recordFailure`)
1. **Pessimistic Lock:** Locks target `Delivery` and `Order`.
2. **Failure Reason Code:** Requires `DeliveryFailureReason` enum (`CUSTOMER_UNAVAILABLE`, `INCORRECT_ADDRESS`, `CUSTOMER_REJECTED`, `ACCESS_RESTRICTED`, `WEATHER_DELAY`, `VEHICLE_BREAKDOWN`).
3. **Failure Record:** Creates `DeliveryFailure` record with failure reason, notes, and evidence photo.
4. **Stock Retention:** Stock remains safely in `reserved_quantity` balance until redelivery is scheduled or order is officially cancelled.
5. **State Transition:** Sets `Delivery` status to `FAILED`, Order `delivery_status = DeliveryStatus::FAILED`.

---

## 4. Delivery Event Trace

```text
[DISPATCHED] ──> [ASSIGNED] ──> [PICKED_UP] ──> [OUT_FOR_DELIVERY] ──> [DELIVERED]
                                                         │
                                                         └──> [FAILED] ──> [REASSIGNED]
```

---

## 5. Source Code Traceability Index
- `app/Services/Delivery/DeliveryWorkflowService.php`
- `app/Services/Delivery/DeliveryAssignmentService.php`
- `app/Services/Delivery/DeliveryEvidenceService.php`
- `app/Services/Delivery/DeliveryNumberGenerator.php`
- `app/Http/Controllers/Delivery/DeliveryPartnerController.php`
- `app/Http/Controllers/Admin/AdminDeliveryController.php`
- `app/Http/Controllers/Admin/DeliveryPartnerManagementController.php`
- `app/Models/Delivery.php`
- `app/Models/DeliveryItem.php`
- `app/Models/DeliveryEvent.php`
- `app/Models/DeliveryFailure.php`
- `app/Policies/DeliveryPolicy.php`
