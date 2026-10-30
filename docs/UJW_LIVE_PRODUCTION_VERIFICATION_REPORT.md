# UJW LIVE PRODUCTION VERIFICATION REPORT

**Project:** Unique Jersey Wholesale (UJW)  
**Production URL:** https://uniquejerseywholesale.com  
**Target AWS Instance:** EC2 `i-04b5a0903d590e029` (Account `122979784839`, Region `us-east-1`)  
**Target Branch:** `fix/ujw-cross-role-product-image-visibility-20261030`  
**Deploy Workflow:** GitHub Actions SSM Dispatch (`.github/workflows/deploy-production.yml`)  
**Report Date:** October 30, 2026  

---

## 1. Release Verification Matrix

| Area | Checkpoint | Verification Method | Status |
|---|---|---|---|
| **TypeScript Type Safety** | 0 compilation errors across all interfaces and components | `npm run type-check` | **VERIFIED (PASS)** |
| **Vite Bundle Build** | Clean build with assets generated for all routes and chunks | `npm run build` | **VERIFIED (PASS)** |
| **Model Image Propagation** | `OrderItem` & `DeliveryItem` accessors return presigned S3 URLs | `CrossRoleProductImagePropagationTest` | **VERIFIED (PASS)** |
| **Salesman Order Show** | `primary_image_url` mapped on line items | `CrossRoleProductImagePropagationTest` | **VERIFIED (PASS)** |
| **Admin Order Show & Review** | `primary_image_url` mapped in `orderData` & `reviewData` | `CrossRoleProductImagePropagationTest` | **VERIFIED (PASS)** |
| **Warehouse Fulfillment** | `primary_image_url` mapped on picking list items | `CrossRoleProductImagePropagationTest` | **VERIFIED (PASS)** |
| **Delivery Driver Show** | `primary_image_url` mapped on manifest items | `CrossRoleProductImagePropagationTest` | **VERIFIED (PASS)** |
| **RULE-DOC-001 Invariant** | Strictly ZERO product images in Invoice HTML and PDF | `CrossRoleProductImagePropagationTest` & `InvoiceGenerationTest` | **VERIFIED (PASS)** |
| **Financial Invariant** | Order calculations & adjustment reductions preserved | `AdminAdjustmentApplicationTest` | **VERIFIED (PASS)** |
| **Non-Destructive History** | `ordered_quantity` conserved on all line items | Automated test suite | **VERIFIED (PASS)** |

---

## 2. Live Verification Procedures on Production Domain

Upon merge into `main` and automated deployment to EC2 via AWS SSM, the following visual checks must be validated against `https://uniquejerseywholesale.com`:

### Check 1: Salesman Order Creation Cart & Side Panel
- **URL:** `https://uniquejerseywholesale.com/salesman/orders/create`
- **Steps:**
  1. Log in as an authorized Sales representative (`sales@uniquejerseywholesale.com`).
  2. Select an active customer from the portfolio dropdown.
  3. Search or filter for a catalog product (e.g., `7 LIVES II CR-4CT`).
  4. Verify the product card displays the uncropped primary thumbnail.
  5. Add 3 units to the cart ($270.00 each).
  6. On desktop (>= 1024px), inspect the right-side **Order Summary Panel**:
     - Verify the product thumbnail renders immediately to the left of `7 LIVES II CR-4CT`.
     - Verify line pricing shows `3 × $270.00` and line total `$810.00`.
  7. On mobile (< 1024px), open the Cart Drawer and verify the thumbnail renders cleanly beside the quantity stepper.

### Check 2: Salesman Order Details
- **URL:** `https://uniquejerseywholesale.com/salesman/orders/{id}`
- **Steps:**
  1. Open a committed order.
  2. Inspect the "Committed Order Items" table.
  3. Verify the product thumbnail is visible in column 1 (`Product / SKU`).

### Check 3: Admin Order Details & Review
- **URL:** `https://uniquejerseywholesale.com/admin/orders/{id}` and `.../review`
- **Steps:**
  1. Log in as an Administrator.
  2. Open an order in `SUBMITTED` or `APPROVED` status.
  3. Verify product thumbnails appear in the "Line Items & Allocations" table and review queue.
  4. Open the "Request Adjustment" modal and verify thumbnails display beside items.

### Check 4: Warehouse Fulfillment Picking
- **URL:** `https://uniquejerseywholesale.com/warehouse/fulfillment/{id}`
- **Steps:**
  1. Log in as Warehouse Manager.
  2. Open an allocated order for picking.
  3. Verify product thumbnails display in column 1 of the picking table.

### Check 5: Delivery Partner Manifest
- **URL:** `https://uniquejerseywholesale.com/delivery/{id}`
- **Steps:**
  1. Log in as Delivery Partner on mobile viewport.
  2. Open an assigned delivery mission.
  3. Verify product thumbnails display in the "Items Manifest" card.

### Check 6: Invoice Document Isolation (RULE-DOC-001)
- **URL:** `https://uniquejerseywholesale.com/admin/invoices/{id}` and PDF download
- **Steps:**
  1. Open any generated invoice.
  2. Inspect invoice items table in HTML view and download PDF.
  3. Confirm that **NO** product thumbnails or image tags are present.

---

## 3. Deployment Audit Trail

- **Branch:** `fix/ujw-cross-role-product-image-visibility-20261030`
- **Merge Target:** `main`
- **Automated Workflow:** `.github/workflows/deploy-production.yml`
- **Deploy Command:** Fast-forward merge of hotfix branch into `main` and push to remote `origin/main`.
- **Target Server:** AWS EC2 Production (`i-04b5a0903d590e029`), Ubuntu 24.04, PHP 8.4-FPM, Nginx, PostgreSQL 17.
- **Rollback Plan:** Git revert commit or fast-forward reset to previous release commit `beb07a73682be46387f61a9354fe80de2b8d05b8`.
