# In-App Domain Notification Workflow Specification

## 1. Workflow Overview & Purpose
The **In-App Domain Notification Workflow** dispatches real-time, role-scoped, deduplicated notifications across operational actors (Salesmen, Operations Admins, Warehouse Managers, Delivery Partners, and Accountants) upon critical commercial lifecycle triggers.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** All Roles (`ADMIN`, `SALESMAN`, `WAREHOUSE_MANAGER`, `WAREHOUSE_STAFF`, `DELIVERY_PARTNER`, `ACCOUNTANT`)

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/notifications` | `notifications.index` | `NotificationController@index` | `auth`, `account.active` |
| `POST` | `/notifications/{id}/read` | `notifications.read` | `NotificationController@markAsRead` | `auth`, `account.active` |
| `POST` | `/notifications/read-all` | `notifications.read-all` | `NotificationController@markAllAsRead` | `auth`, `account.active` |
| `GET` | `/notifications/preferences` | `notifications.preferences` | `NotificationController@preferences` | `auth`, `account.active` |
| `PUT` | `/notifications/preferences` | `notifications.preferences.update` | `NotificationController@updatePreferences` | `auth`, `account.active` |

### Key Classes & Entities
- Dispatcher: `App\Services\Notification\DomainNotificationDispatcher.php`
- Service: `App\Services\Notification\NotificationService.php`
- Preferences: `App\Services\Notification\NotificationPreferenceService.php`
- Model: `App\Models\InAppNotification.php`
- Model: `App\Models\NotificationPreference.php`

---

## 3. Domain Dispatching Matrix (`DomainNotificationDispatcher`)

| Commercial Event | Target Roles / Users | Notification Type | Category | Severity | Action Link |
|---|---|---|---|---|---|
| **Order Submitted** | `ADMIN`, `WAREHOUSE_MANAGER` | `ORDER_SUBMITTED` | `ORDERS` | `INFO` | `/admin/orders/{id}` |
| **Order Approved** | Order Salesman (`salesman_id`) | `ORDER_APPROVED` | `ORDERS` | `SUCCESS` | `/salesman/orders/{id}` |
| **Order Rejected** | Order Salesman (`salesman_id`) | `ORDER_REJECTED` | `ORDERS` | `WARNING` | `/salesman/orders/{id}` |
| **Order Dispatched** | Order Salesman & Delivery Lead | `ORDER_DISPATCHED` | `DELIVERY` | `INFO` | `/admin/deliveries/{id}` |
| **Delivery Assigned** | Target Driver (`driver_id`) | `DELIVERY_ASSIGNED` | `DELIVERY` | `INFO` | `/delivery-partner/deliveries/{id}` |
| **Delivery Completed** | Order Salesman & `ADMIN` | `DELIVERY_COMPLETED` | `DELIVERY` | `SUCCESS` | `/admin/orders/{id}` |
| **Delivery Failed** | `ADMIN`, `WAREHOUSE_MANAGER` | `DELIVERY_FAILED` | `DELIVERY` | `ERROR` | `/admin/deliveries/{id}` |
| **Payment Submitted** | `ACCOUNTANT`, `ADMIN` | `PAYMENT_SUBMITTED` | `PAYMENTS` | `INFO` | `/admin/payments/{id}` |
| **Payment Verified** | Order Salesman | `PAYMENT_VERIFIED` | `PAYMENTS` | `SUCCESS` | `/salesman/payments` |
| **Payment Rejected** | Order Salesman | `PAYMENT_REJECTED` | `PAYMENTS` | `ERROR` | `/salesman/payments` |
| **Return Requested** | `ADMIN`, `WAREHOUSE_MANAGER` | `RETURN_REQUESTED` | `RETURNS` | `INFO` | `/admin/returns/{id}` |
| **Stock Exception** | `WAREHOUSE_MANAGER`, `ADMIN` | `STOCK_EXCEPTION` | `INVENTORY` | `WARNING` | `/admin/inventory/stock-exceptions` |

---

## 4. Deduplication & Delivery Mechanism

1. **Deduplication Keys:** Notifications use deterministic `deduplicationPrefix` keys (e.g. `order_submitted:order:82`) with Redis/Cache throttling to avoid sending duplicate alerts on idempotent retries.
2. **Preference Filtering (`NotificationPreferenceService`):** Before storing an in-app notification, checks whether the recipient user has enabled notifications for the specific category (`ORDERS`, `DELIVERY`, `PAYMENTS`, `INVENTORY`, `RETURNS`).
3. **Optimized Read Tracking:** Unread count is cached per user and decremented atomically on `markAsRead` or `markAllAsRead`.

---

## 5. Source Code Traceability Index
- `app/Services/Notification/DomainNotificationDispatcher.php`
- `app/Services/Notification/NotificationService.php`
- `app/Services/Notification/NotificationPreferenceService.php`
- `app/Http/Controllers/Notification/NotificationController.php`
- `app/Models/InAppNotification.php`
- `app/Models/NotificationPreference.php`
