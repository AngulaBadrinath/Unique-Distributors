# FORENSIC AUDIT REPORT: React Frontend, Product Images Across Roles, and QA Analysis
**Document ID:** `UJW_PRODUCT_IMAGE_CROSS_ROLE_AUDIT.md`  
**Auditor:** UJW Forensic Auditor Specialist  
**Target Git Head:** `cee76b8` (`fix: correct invoice pdf caching and order completion state`)  
**Operating Constraint:** Phase 1 Strict Read-Only Audit (Zero code or schema mutations performed)  
**Recipient:** Lead Architect (`8bba013c-8649-4317-907e-62cd0fe4a2db`)

---

## 1. Executive Summary

A comprehensive forensic audit of the UJW Wholesale Distribution Management System was conducted across the React frontend, Laravel backend, data architecture, cross-role visibility matrices, and automated Playwright QA suites.

### Key Audit Verdicts:
1. **Product Image Data Architecture (CONFIRMED):** Product images are structured via `Product` (`hasMany` images, `hasOne` primaryImage) and `ProductImage` models. S3 private storage is enforced with authoritative magic-byte inspection (JPEG/PNG/WebP; SVG prohibited) and presigned temporary URLs (15-min TTL).
2. **Missing Product Images in Orders & Carts (CONFIRMED):** Product images are **missing** from `CartDrawer.tsx`, `OrderReviewLineCard.tsx`, `OrderReviewStep.tsx`, `OrderSummaryPanel.tsx`, and all order item detail views across Admin, Salesman, Warehouse, and Delivery. In the database, the `order_items` table does not snapshot image keys.
3. **Reference A vs. Current UI (CONFIRMED):** Reference A (`kriaanj.com` mobile wholesale) uses an ultra-dense, mobile-optimized tabular row layout (`Image` | `Flavor + UPC` | `Price/Login` | `Quantity Stepper`) where product images are cleanly contained in square white bounding boxes with zero cropping.
4. **Reference B Aspect Ratio Defect (CONFIRMED):** In `ProductOrderCard.tsx`, container `aspect-[16/10]` (1.6:1 landscape) combined with `object-cover` severely crops vertical/portrait wholesale packaging (cutting off 50%–70% of the image height, eliminating top logos, flavor text, warning labels, and device screens).
5. **Role Visibility & Invariant Invoicing (CONFIRMED):** Product images are only rendered in the Product Master (`/products`) and the Salesman Order Builder catalog. They are completely absent in Admin review/detail, Warehouse picking/packing, and Delivery handover. Crucially, **RULE-DOC-001 is strictly honored**: printed and PDF invoices contain zero `<img>` tags.
6. **Playwright QA Coverage (CONFIRMED):** Existing E2E tests (`prompt3_global_ux_regression.spec.ts`) verify cross-role workflows and enforce zero images on invoices, but entirely omit browser assertions for product image rendering, broken image fallbacks, and aspect ratio containment. Backend tests (`ProductImageTest.php`) pass 24/24.

---

## 2. Product Image Data Architecture

### 2.1 Schema & Migrations
- **Table Definition:** [`database/migrations/2026_09_05_000003_create_product_images_table.php`](file:///F:/Wholesale%20Distribution%20Management%20System/database/migrations/2026_09_05_000003_create_product_images_table.php#L14-L27)
  ```php
  Schema::create('product_images', function (Blueprint $table) {
      $table->id();
      $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
      $table->string('object_key', 500)->unique();
      $table->string('original_filename', 255);
      $table->string('mime_type', 100);
      $table->unsignedBigInteger('size_bytes');
      $table->boolean('is_primary')->default(false);
      $table->unsignedSmallInteger('sort_order')->default(0);
      $table->timestamps();

      $table->index(['product_id', 'is_primary'], 'product_images_product_primary_idx');
      $table->index(['product_id', 'sort_order'], 'product_images_product_sort_idx');
  });
  ```
- **Barcode Migration:** [`database/migrations/2026_09_23_000001_add_barcode_to_products_table.php`](file:///F:/Wholesale%20Distribution%20Management%20System/database/migrations/2026_09_23_000001_add_barcode_to_products_table.php#L14-L17) adds `barcode` (`varchar(100)`, unique) and `barcode_type` (`varchar(30)`).

### 2.2 Eloquent Models
- **`App\Models\Product`** ([`app/Models/Product.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Models/Product.php#L89-L106)):
  - `images()` (lines 93-96): `hasMany(ProductImage::class, 'product_id')->orderBy('sort_order', 'asc')->orderBy('id', 'asc')`.
  - `primaryImage()` (lines 103-106): `hasOne(ProductImage::class, 'product_id')->where('is_primary', true)`.
- **`App\Models\ProductImage`** ([`app/Models/ProductImage.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Models/ProductImage.php#L9-L49)):
  - Defines `product_id`, `object_key`, `original_filename`, `mime_type`, `size_bytes`, `is_primary`, `sort_order`.
  - Casts `is_primary` to `boolean` and `size_bytes` to `integer`.
  - Lacks an accessor (`url` or `temporary_url`), making it fully dependent on `ProductImageService`.

### 2.3 Storage Paths, S3 Bucket Architecture & Security
- **Service:** [`App\Services\Product\ProductImageService`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Product/ProductImageService.php#L55-L140)
  - **Storage Key Convention:** Scoped directory `products/{product_id}/{uuid}.{ext}` (e.g., `products/14/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`).
  - **Storage Security:** Managed by `StorageManagerService` on private S3 disk (`'s3'`). Direct public bucket access is prohibited.
  - **Magic-Byte Binary Inspection:** Uses PHP `finfo` and `getimagesize()` to inspect uploaded binary headers (JPEG `\xFF\xD8\xFF`, PNG, WebP). Strictly rejects SVG/XML uploads to prevent Stored XSS.
  - **Compensating Transactions:** S3 objects are deleted if database insertion fails ([lines 135-139](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Product/ProductImageService.php#L135-L139)).
  - **URL Generation:** `getTemporaryUrl(ProductImage $image, int $expirationMinutes = 15)` generates an AWS S3 presigned GET URL valid for 15 minutes.
- **Finding / Risk:** Because S3 presigned URLs expire in 15 minutes, any serialized `primary_image_url` cached in local storage or on stale client pages will return HTTP `403 Forbidden` (`Request has expired`) once the 15-minute window elapses.

---

## 3. Image Serialization in API Resources, Controllers & Order Snapshots

### 3.1 Where Images Are Serialized
1. **`App\Services\Product\ProductService::formatProduct()`** ([lines 140-143](file:///F:/Wholesale%20Distribution%20Management%20System/app/Services/Product/ProductService.php#L140-L143)):
   ```php
   'primary_image_url' => $product->primaryImage ? $this->productImageService->getTemporaryUrl($product->primaryImage) : null,
   'images' => $product->relationLoaded('images')
       ? $product->images->map(fn ($img) => $this->productImageService->formatImage($img))->values()->all()
       : [],
   ```
2. **`App\Http\Controllers\Salesman\SalesmanOrderController::editDraft()`** ([line 384](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Salesman/SalesmanOrderController.php#L384)):
   Passes `primary_image_url` when hydrating draft line items from the database.

### 3.2 Where Images Are Completely Missing
1. **Client-Side Cart Drawer:** [`resources/js/Components/Salesman/CartDrawer.tsx`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/CartDrawer.tsx#L70-L115) renders lines with name, SKU, price, quantity stepper, and trash icon. **No thumbnail image is rendered.**
2. **Order Summary Side Panel:** [`resources/js/Components/Salesman/OrderSummaryPanel.tsx`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/OrderSummaryPanel.tsx#L85-L123) renders text-only product lines.
3. **Order Review Step & Cards:**
   - [`OrderReviewLineCard.tsx`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/OrderReviewLineCard.tsx#L23-L55): Zero image tags.
   - [`OrderReviewStep.tsx`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/OrderReviewStep.tsx#L240-L305): Table columns are `Product | Unit Price | Qty | Taxable | Tax | Tax Amount | Total | Actions`. **No image column exists.**
4. **Order Items Table Snapshot Schema:** [`database/migrations/2026_09_05_000009_create_order_items_table.php`](file:///F:/Wholesale%20Distribution%20Management%20System/database/migrations/2026_09_05_000009_create_order_items_table.php#L22-L26) snapshots only `product_name_snapshot`, `sku_snapshot`, and `unit_snapshot`. **It does not snapshot `image_object_key` or image metadata.**
5. **Admin Order Detail Workspace:** [`app/Http/Controllers/Admin/AdminOrderController.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminOrderController.php#L382, #L522-L527) loads `'items.product:id,sku,name,status,default_selling_price,mrp'`, omitting `primaryImage`. No image is sent to `Admin/Orders/Show`.
6. **Admin Order Review Workspace:** [`app/Http/Controllers/Admin/AdminOrderController.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminOrderController.php#L712, #L820-L827) loads product info without images. The review workspace is text-only.
7. **Salesman Order Detail:** [`app/Http/Controllers/Salesman/SalesmanOrderController.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Salesman/SalesmanOrderController.php#L586, #L658-L683) does not load the product relation on items. `Salesman/Orders/Show` displays no product images.
8. **Warehouse Fulfillment Workspace:** [`app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php#L101-L124) loads `items.product`, but strips everything except `product_id`, `product_name`, `sku`, `unit`. **Warehouse workers pick and pack without image verification.**
9. **Delivery Partner Mobile Mission:** [`app/Http/Controllers/Delivery/DeliveryPartnerController.php`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Delivery/DeliveryPartnerController.php#L121) loads `items.product:id,name,sku,unit`. **Drivers have no visual image to confirm packages during delivery.**

---

## 4. Inspection of Reference A (`kriaanj.com` Mobile Reference)

**File Inspected:** `C:\Users\Badri\Downloads\WhatsApp Image 2026-10-28 at 7.55.21 PM.jpeg`  
**Platform / Brand:** Kriaa Wholesale mobile portal (`kriaanj.com`)

### Detailed Breakdown of Reference A:
```
+-----------------------------------------------------------+
| [=]                     (KRIAA LOGO)              [O] [0] |
+-----------------------------------------------------------+
| [ Search product or category...                         ] |
+-----------------------------------------------------------+
| Image    | Flavor               | Price      | Qty        |
+----------+----------------------+------------+------------+
| [Thumb]  | Blue Razz Icy        | Login      | [-]  0 [+] |
|          | UPC:4897136541578    |            |            |
+----------+----------------------+------------+------------+
| [Thumb]  | Blueberry Watermelon | Login      | [-]  0 [+] |
|          | UPC:4897136541578    |            |            |
+----------+----------------------+------------+------------+
| [Thumb]  | Frozen StrawBerry    | Login      | [-]  0 [+] |
|          | UPC:4897136541639    |            |            |
+-----------------------------------------------------------+
```
1. **Vertical Density:** Extremely high data density. Displays 6–8 distinct products per mobile screenfold without requiring full-screen card scrolling.
2. **Image Container:** Centered thumbnail (`~48x48px` to `~56x56px`) enclosed in a rounded, bordered white box. Uses `object-contain` with padding, ensuring tall rectangular packaging (vape bars, bottles) is 100% visible with zero cropping of boxes or devices.
3. **Product & Barcode Grouping:** Product flavor/variant name in bold typography, immediately paired below with the machine-readable UPC barcode (`UPC: 4897136541578`). In wholesale distribution, salesmen and store owners identify items primarily by barcode and flavor.
4. **Wholesale Gated State ("Login"):** Replaces the price with an actionable "Login" label for unauthenticated or non-approved accounts.
5. **Inline Quantity Control:** Accessible minus/plus stepper with direct numeric value, allowing rapid order assembly directly in the mobile list.
6. **Alternating Zebra-Striping:** Soft mint (`#F0FDF4`) and white rows provide visual separation across small touch screens.

---

## 5. Inspection of Reference B (`ProductOrderCard.tsx` Container Issue)

**File Inspected:** [`resources/js/Components/Salesman/ProductOrderCard.tsx`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/ProductOrderCard.tsx#L107-L120)

### 5.1 Defect Mechanism
Lines 107–114 contain:
```tsx
<div className="relative aspect-[16/10] bg-muted/40 flex items-center justify-center overflow-hidden border-b border-border/70">
    {product.primary_image_url ? (
        <img
            src={product.primary_image_url}
            alt={product.name}
            className="object-cover w-full h-full"
            loading="lazy"
        />
    ) : ( ... )}
```

### 5.2 Mathematical & Visual Failure Analysis
1. **Aspect Ratio Conflict:**
   - Container has an aspect ratio of `16/10` = **1.60** (landscape, wide).
   - Standard consumer wholesale products (vapes, bottles, boxes) have aspect ratios between `1:1` (1.0) and `9:16` (**0.56**, tall portrait).
2. **`object-cover` Behavior:**
   - Under `object-cover`, the browser scales the image so that the container is entirely filled along both axes.
   - For a 9:16 portrait image inside a 16:10 container:
     $$\text{Zoom Factor} = \frac{1.60}{0.56} \approx 2.85\times$$
   - The top and bottom **65% of the product image is clipped off by `overflow-hidden`**.
3. **Real-World Impact:**
   - Top of packaging (brand logo, series name) is cut off.
   - Bottom of packaging (nicotine warning, flavor name, e-liquid capacity) is cut off.
   - Device LED indicator screen is cropped out.
   - Salesmen cannot visually differentiate between variants of the same product series because only the blank midsection of the box is visible.
4. **Missing Barcode:**
   - Line 123 displays `{product.sku}`. Although `barcode` exists on the Product model, it is not present in the TypeScript `CatalogProduct` interface ([`resources/js/types/order.ts#L59-L88`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/types/order.ts#L59-L88)) and is omitted from the card.

---

## 6. Cross-Role Product Image Visibility Matrix & Invariants

| Role | Route / Page | Image Status | Technical Code Reference | Compliance & Usability Impact |
|---|---|---|---|---|
| **Admin** | `/products` (Index) | **PRESENT** (Clipped) | [`Pages/Product/Index.tsx#L361-L367`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Pages/Product/Index.tsx#L361-L367) | Rendered with `h-10 w-10 object-cover`. Suffers from center-zoom cropping on portrait packaging. |
| **Admin** | `/admin/orders/{id}` | **MISSING** | [`AdminOrderController.php#L382, #L522`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminOrderController.php#L382) | Admin cannot inspect product packaging during dispute handling or allocation. |
| **Admin** | `/admin/orders/{id}/review` | **MISSING** | [`AdminOrderController.php#L712, #L820`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Admin/AdminOrderController.php#L712) | Approving admin cannot visually verify items during order approval. |
| **Salesman** | `/salesman/orders/create` (Catalog) | **PRESENT** (Distorted) | [`ProductOrderCard.tsx#L107-L115`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/ProductOrderCard.tsx#L107-L115) | Severely cropped by `aspect-[16/10] object-cover`. |
| **Salesman** | `/salesman/orders/create` (Cart Drawer) | **MISSING** | [`CartDrawer.tsx#L70-L115`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/CartDrawer.tsx#L70-L115) | Salesman cannot visually confirm cart items prior to checkout. |
| **Salesman** | `/salesman/orders/create` (Review Step) | **MISSING** | [`OrderReviewStep.tsx#L240-L305`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/js/Components/Salesman/OrderReviewStep.tsx#L240-L305) | Final order review table and cards have zero image thumbnails. |
| **Salesman** | `/salesman/orders/{id}` | **MISSING** | [`SalesmanOrderController.php#L586, #L658`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Salesman/SalesmanOrderController.php#L586) | Salesman cannot view product images on placed orders. |
| **Warehouse** | `/admin/warehouse/fulfillment/{id}` | **MISSING** | [`WarehouseFulfillmentController.php#L101-L124`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php#L101-L124) | **High operational risk:** Pickers and packers have no visual images to prevent mispicks. |
| **Delivery** | `/delivery/{id}` | **MISSING** | [`DeliveryPartnerController.php#L121`](file:///F:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/Delivery/DeliveryPartnerController.php#L121) | Driver mobile view lacks thumbnails for delivery handover verification. |
| **Accountant** | `/admin/invoices`, `/admin/payments` | **MISSING** | Standard accounting views | Financial ledger views omit product images (appropriate for financial analysis). |
| **Customer** | Wholesale Portal | **NOT IMPLEMENTED** | N/A | B2B orders currently entered exclusively through Sales Representatives. |
| **All Roles** | `/invoices/{id}/print` & PDF | **STRICTLY FORBIDDEN** | [`resources/views/documents/invoice.blade.php#L526, #L648-L672`](file:///F:/Wholesale%20Distribution%20Management%20System/resources/views/documents/invoice.blade.php#L526) | **CONFIRMED COMPLIANT WITH RULE-DOC-001.** Uses pure vector SVG branding, 0 `<img>` tags on invoice items table. |

---

## 7. Quality Assurance & Existing Playwright Regression Tests

### 7.1 Playwright E2E UX Regression Suite
- **File:** [`tests/browser/e2e/prompt3_global_ux_regression.spec.ts`](file:///F:/Wholesale%20Distribution%20Management%20System/tests/browser/e2e/prompt3_global_ux_regression.spec.ts)
- **Role Journeys Covered:**
  - ADMIN login, navigation, customer CRUD, back button (lines 13-49).
  - SALESMAN order history and draft creation (lines 54-89).
  - WAREHOUSE stock balances and fulfillment workspace (lines 94-127).
  - DELIVERY driver mission portal and detail (lines 132-154).
  - ACCOUNTANT invoices and payments workspace (lines 159-183).
- **Rule Verification:** Lines 247–259 explicitly enforce `RULE-DOC-001`:
  ```ts
  test('Cross-Role Journey 5: Invoices -> Detail -> Print Layout Compliance', async ({ page }) => {
      await loginAs(page, 'ADMIN');
      await page.goto('/admin/invoices', { waitUntil: 'domcontentloaded' });
      const printResp = await safeGoto(page, '/invoices/1/print');
      if (printResp?.status() === 200) {
          await expect(page.locator('h1').filter({ hasText: 'INVOICE' })).toBeVisible({ timeout: 10000 });
          const imgCount = await page.locator('img').count();
          expect(imgCount).toBe(0); // RULE-DOC-001: Zero product images on invoice
      }
  });
  ```
- **Responsive Viewports Tested:** Lines 299–336 test `1440x900`, `1280x800`, `1024x768`, and `390x844` for horizontal scroll overflow.
- **QA Test Gaps Identified:**
  1. No test verifies whether product images in `/products` or `/salesman/orders/create` successfully load without HTTP 403 or broken image icons.
  2. No test asserts `naturalWidth > 0` on rendered product `<img>` tags.
  3. No test verifies that fallback `<Package />` icons appear when `primary_image_url` is null.
  4. No visual regression test captures image container boundary fitting.

### 7.2 Backend PHPUnit Test Suite
- **File:** [`tests/Feature/Product/ProductImageTest.php`](file:///F:/Wholesale%20Distribution%20Management%20System/tests/Feature/Product/ProductImageTest.php)
- **Execution Result:** **24 passed, 76 assertions, 0 failures (duration 18.38s)**.
- Covers permissions (`PROD-IMG-001..005`), magic byte validation (`PROD-IMG-006..010`), MIME extension mapping, S3 compensating rollback on failure, primary image toggling, and presigned temporary URL formatting.

---

## 8. Architectural Recommendations (For Phase 2 Implementation)

When authorized to transition from Phase 1 Audit to Phase 2 Implementation, execute the following targeted remediations:

1. **Fix Image Container in `ProductOrderCard.tsx`:**
   - Change `aspect-[16/10]` to `aspect-square` (or `aspect-[4/3]`).
   - Replace `object-cover` with `object-contain p-3` on a neutral background (`bg-muted/20 dark:bg-muted/10`). This guarantees 100% of the product box, branding, and flavor text remains visible without clipping.
2. **Implement Reference A Compact Mobile List View:**
   - Add a responsive list/table view mode for mobile (`<640px`) mirroring Reference A:
     - 4 compact columns: `Image` (`w-12 h-12 object-contain rounded-md border p-0.5 bg-white`) | `Name + UPC/Barcode` | `Price` | `QuantityStepper (sm)`.
     - Expose `barcode` on the `CatalogProduct` frontend type and display `UPC: {product.barcode || product.sku}`.
3. **Add Product Thumbnails to Cart & Review Components:**
   - In `CartDrawer.tsx`, add a `w-10 h-10 object-contain rounded border` thumbnail next to each item name.
   - In `OrderReviewLineCard.tsx` and `OrderReviewStep.tsx`, include a compact product thumbnail column so salesmen can visually verify items before submission.
4. **Serialize Product Images in Operational Workspaces:**
   - In `AdminOrderController::show` and `review`, eager load `items.product.primaryImage` and map `primary_image_url` into the line item data.
   - In `WarehouseFulfillmentController::show`, eager load `items.product.primaryImage` and map `primary_image_url` so warehouse workers can visually match items during picking and packing.
   - In `DeliveryPartnerController::show`, eager load `items.product.primaryImage` and map `primary_image_url` so drivers can inspect items during drop-off.
5. **Add Playwright Automated Image Integrity Tests:**
   - Add an automated test suite verifying that on `/products` and `/salesman/orders/create`:
     - Every product image loads with `naturalWidth > 0`.
     - When `primary_image_url` is null, the `<Package />` placeholder renders.
     - Presigned URLs do not return HTTP 403.
     - Re-assert `RULE-DOC-001` to ensure invoices remain strictly free of product images.

---
*Report completed under Phase 1 Audit-Only Mandate.*

