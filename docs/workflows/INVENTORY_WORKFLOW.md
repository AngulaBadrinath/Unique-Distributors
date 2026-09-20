# Multi-Warehouse Inventory Workflow Specification

## 1. Workflow Overview & Purpose
The **Multi-Warehouse Inventory Workflow** enforces stock integrity across warehouses, tracks physical, reserved, and available balances, executes stock reservation locks, logs immutable inventory movements, and handles damaged/missing stock exception workflows.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `WAREHOUSE_MANAGER`, `ADMIN`, `ACCOUNTANT`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/admin/inventory` | `admin.inventory.index` | `AdminInventoryController@index` | `auth`, `account.active`, `permission:inventory.view` |
| `GET` | `/admin/inventory/{inventory}` | `admin.inventory.show` | `AdminInventoryController@show` | `auth`, `account.active`, `permission:inventory.view` |
| `POST` | `/admin/inventory/adjustments` | `admin.inventory.adjustments.store` | `AdminInventoryAdjustmentController@store` | `auth`, `account.active`, `permission:inventory.adjust` |
| `GET` | `/admin/inventory/stock-exceptions` | `admin.inventory.stock-exceptions.index` | `AdminStockExceptionController@index` | `auth`, `account.active`, `permission:inventory.view` |
| `POST` | `/admin/inventory/stock-exceptions/{exception}/resolve` | `admin.inventory.stock-exceptions.resolve` | `AdminStockExceptionController@resolve` | `auth`, `account.active`, `permission:inventory.adjust` |

### Frontend UI Pages
- Multi-Warehouse Stock Ledger: `resources/js/Pages/Admin/Inventory/Index.tsx`
- Stock Movement History: `resources/js/Pages/Admin/Inventory/Movements.tsx`
- Stock Adjustment Desk: `resources/js/Pages/Admin/Inventory/Adjustments.tsx`
- Stock Exceptions Console: `resources/js/Pages/Admin/Inventory/StockExceptions.tsx`

---

## 3. Core Domain Equations & Invariants

```text
available_quantity = physical_quantity - reserved_quantity
physical_quantity >= reserved_quantity >= 0
available_quantity >= 0 (RULE-INV-001)
```

### Movement Types (`InventoryMovementType`)
- `INITIAL_STOCK`: Initial warehouse setup / count.
- `PURCHASE_RECEIPT`: Inbound supplier purchase order receipt.
- `SALE_RESERVATION`: Order approved; reserved quantity incremented.
- `SALE_OUT`: Order delivered; physical & reserved deducted.
- `SALE_RELEASE`: Order cancelled; reserved quantity returned to available.
- `RETURN_IN`: Customer RMA return restocked to inventory.
- `ADJUSTMENT_INCREASE`: Audit count surplus.
- `ADJUSTMENT_DECREASE`: Audit count shortage / shrinkage.
- `DAMAGED_WRITE_OFF`: Damaged stock removed from inventory.

---

## 4. Step-by-Step Execution Sequence

### A. Deadlock-Free Ascending ID Locking (`InventoryService::lockBalancesForUpdate`)
```php
public function lockBalancesForUpdate(int $warehouseId, array $productIds): Collection
{
    $uniqueProductIds = array_values(array_unique(array_filter($productIds)));
    sort($uniqueProductIds); // Guarantees deadlock prevention

    return InventoryBalance::query()
        ->where('warehouse_id', $warehouseId)
        ->whereIn('product_id', $uniqueProductIds)
        ->orderBy('id', 'asc')
        ->lockForUpdate()
        ->get();
}
```

### B. Stock Reservation on Order Approval (`InventoryService::reserveStock`)
1. Acquires row lock on `InventoryBalance`.
2. Asserts `available_quantity >= requested_quantity`. If insufficient, throws `InsufficientStockException`.
3. Mutates balance:
   - `reserved_quantity = reserved_quantity + requested_quantity`
   - `available_quantity = physical_quantity - reserved_quantity`
4. Creates `OrderItemAllocation` with status `ALLOCATED`.

### C. Physical Stock Out on Delivery (`InventoryMovementService::recordMovement`)
1. Triggered exclusively by `DeliveryWorkflowService::completeDelivery()`.
2. Mutates balance:
   - `physical_quantity = physical_quantity - delivered_quantity`
   - `reserved_quantity = reserved_quantity - delivered_quantity`
   - `available_quantity = physical_quantity - reserved_quantity`
3. Records `InventoryMovement`:
   - `movement_type = SALE_OUT`
   - Snapshots `previous_physical_quantity`, `new_physical_quantity`, `previous_reserved_quantity`, `new_reserved_quantity`.
   - Links `order_id`, `delivery_id`, and `user_id`.

### D. Damaged Stock & Discrepancies (`StockExceptionService`)
1. Damaged units are NEVER returned to available inventory (RULE-INV-001).
2. Creates `StockException` record (`type = DAMAGED_IN_TRANSIT` / `MISSING_IN_TRANSIT`).
3. If written off, calls `InventoryAdjustmentService` to deduct physical balance and post to General Ledger Shrinkage account (`5020`).

---

## 5. Source Code Traceability Index
- `app/Services/Inventory/InventoryService.php`
- `app/Services/Inventory/InventoryMovementService.php`
- `app/Services/Inventory/InventoryAdjustmentService.php`
- `app/Services/Inventory/StockExceptionService.php`
- `app/Http/Controllers/Admin/AdminInventoryController.php`
- `app/Http/Controllers/Admin/AdminInventoryAdjustmentController.php`
- `app/Http/Controllers/Admin/AdminStockExceptionController.php`
- `app/Models/InventoryBalance.php`
- `app/Models/InventoryMovement.php`
- `app/Models/InventoryAdjustment.php`
- `app/Models/StockException.php`
- `app/Policies/InventoryBalancePolicy.php`
