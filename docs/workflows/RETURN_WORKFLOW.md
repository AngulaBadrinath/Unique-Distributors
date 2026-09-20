# Customer Returns & RMA Workflow Specification

## 1. Workflow Overview & Purpose
The **Customer Returns & RMA Workflow** manages return authorizations (RMA), warehouse physical inspection, inventory disposition (Restock vs. Scrap/Damage), Credit Note generation, customer balance adjustments, and General Ledger contra-revenue accounting.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `SALESMAN`, `WAREHOUSE_MANAGER`, `ADMIN`, `ACCOUNTANT`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/salesman/returns` | `salesman.returns.index` | `SalesmanReturnController@index` | `auth`, `account.active`, `role:salesman` |
| `POST` | `/salesman/returns` | `salesman.returns.store` | `SalesmanReturnController@store` | `auth`, `account.active`, `role:salesman` |
| `GET` | `/admin/returns` | `admin.returns.index` | `AdminReturnController@index` | `auth`, `account.active`, `permission:return.view` |
| `GET` | `/admin/returns/{return}` | `admin.returns.show` | `AdminReturnController@show` | `auth`, `account.active`, `permission:return.view` |
| `POST` | `/admin/returns/{return}/inspect` | `admin.returns.inspect` | `AdminReturnInspectionController@store` | `auth`, `account.active`, `permission:return.inspect` |
| `POST` | `/admin/returns/{return}/process` | `admin.returns.process` | `AdminReturnWorkflowController@process` | `auth`, `account.active`, `permission:return.process` |

---

## 3. Step-by-Step Execution Sequence

### A. Return Request Creation (`ReturnRequestService::createReturnRequest`)
1. **Delivered Order Gate:** Asserts target order is delivered.
2. **Quantity Bounds:** Asserts requested return quantity does not exceed delivered quantity minus previously returned quantities.
3. **Evidence Upload:** Validates reason code (`DAMAGED_IN_TRANSIT`, `EXPIRED`, `WRONG_ITEM`, `CUSTOMER_OVERSTOCK`, `QUALITY_DEFECT`) and JPEG evidence.
4. **Entity Generation:** Generates sequential RMA number (`RET-YYYY-MM-XXXX`) via `ReturnNumberGenerator`. Sets status to `SUBMITTED`.

### B. Warehouse RMA Inspection (`ReturnInspectionService::completeInspection`)
1. **Inspection Desk:** Warehouse QA inspects physical units.
2. **Item Disposition Classification:**
   - **RESTOCK:** Units in resalable condition. Calls `ReturnInventoryService::restock()` $\rightarrow$ increments physical and available inventory with movement type `RETURN_IN`.
   - **SCRAP / DAMAGED:** Unresalable units. Logged as damaged stock movements (`DAMAGED_WRITE_OFF`) and excluded from available inventory.
3. **Status Update:** Sets `ReturnRequest` status to `INSPECTED` / `APPROVED`.

### C. Credit Note Generation & Accounting (`CreditNoteService::createCreditNote`)
1. **Credit Note Generation:** Generates sequential number (`CN-YYYY-MM-XXXX`) via `CreditNoteNumberGenerator`.
2. **Accounts Receivable Subledger:** Records credit transaction against customer trade receivable.
3. **General Ledger Journal Posting (RULE-ACC-001):**
   - Calls `JournalMappingService::postCreditNoteIssued($creditNote)`.
   - Balanced Journal Entry:
     - **Debit:** `4030` (Sales Returns & Allowances)
     - **Debit:** `2100` (Sales Tax Payable)
     - **Credit:** `1100` (Accounts Receivable)

---

## 4. Source Code Traceability Index
- `app/Services/Return/ReturnRequestService.php`
- `app/Services/Return/ReturnInspectionService.php`
- `app/Services/Return/ReturnInventoryService.php`
- `app/Services/Return/ReturnWorkflowService.php`
- `app/Services/Credit/CreditNoteService.php`
- `app/Http/Controllers/Salesman/SalesmanReturnController.php`
- `app/Http/Controllers/Admin/AdminReturnController.php`
- `app/Http/Controllers/Admin/AdminReturnInspectionController.php`
- `app/Http/Controllers/Admin/AdminReturnWorkflowController.php`
- `app/Models/ReturnRequest.php`
- `app/Models/ReturnRequestItem.php`
- `app/Models/CreditNote.php`
- `app/Policies/ReturnRequestPolicy.php`
- `app/Policies/CreditNotePolicy.php`
