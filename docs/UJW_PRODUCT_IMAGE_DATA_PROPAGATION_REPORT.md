# UJW PRODUCT IMAGE DATA PROPAGATION REPORT

**Project:** Unique Jersey Wholesale (UJW)  
**Report Date:** October 30, 2026  
**Document Reference:** `docs/UJW_PRODUCT_IMAGE_DATA_PROPAGATION_REPORT.md`  

---

## 1. Architecture Overview

Product images in UJW are stored securely in a private AWS S3 bucket. Access is governed by temporary, time-limited presigned URLs generated server-side by `ProductImageService` via `StorageManagerService`.

To prevent N+1 query bottlenecks and ensure immediate, robust thumbnail availability across all operational roles, image URLs must be efficiently eager-loaded at the query boundary and propagated consistently through Eloquent models and Inertia responses.

```
[Private S3 Bucket]
       ▲
       │ Presigned temporary URL (15 min)
       │
[StorageManagerService] ◄── [ProductImageService]
                                     ▲
                                     │ getPrimaryImageUrlAttribute()
                             [Product Model]
                               ▲          ▲
                               │          │
                       [OrderItem]   [DeliveryItem]
                               ▲          ▲
                               │          │
                 [Controllers: Admin / Salesman / Warehouse / Delivery]
                               │
                               ▼
                       [Inertia Response]
                               │
                               ▼
                       [React Components: ProductThumbnail]
```

---

## 2. Model & Database Layer

### A. `Product` Model (`app/Models/Product.php`)
- **Relationship:** `primaryImage(): HasOne` where `is_primary = true`.
- **Accessor:** `getPrimaryImageUrlAttribute(): ?string`
- **Serialization:** Appended via `$appends = ['primary_image_url']`.
- **Behavior:** When the `primaryImage` relationship is loaded, calls `app(ProductImageService::class)->getTemporaryUrl($this->primaryImage)`. If not loaded or on failure, returns `null` safely without throwing an exception.

### B. `OrderItem` Model (`app/Models/OrderItem.php`)
- **Relationship:** `product(): BelongsTo`.
- **Accessor:**
  ```php
  protected $appends = [
      'primary_image_url',
  ];

  public function getPrimaryImageUrlAttribute(): ?string
  {
      if ($this->relationLoaded('product') && $this->product) {
          return $this->product->primary_image_url;
      }

      return null;
  }
  ```

### C. `DeliveryItem` Model (`app/Models/DeliveryItem.php`)
- **Relationship:** `product(): BelongsTo`.
- **Accessor:**
  ```php
  protected $appends = [
      'primary_image_url',
  ];

  public function getPrimaryImageUrlAttribute(): ?string
  {
      if ($this->relationLoaded('product') && $this->product) {
          return $this->product->primary_image_url;
      }

      return null;
  }
  ```

---

## 3. Controller Eager-Loading & Data Mapping

### A. Salesman Order Controller (`app/Http/Controllers/Salesman/SalesmanOrderController.php`)
1. **Catalog & Cart (`create()`):**
   - Query: `Product::query()->with(['primaryImage', 'taxProfile'])->where('is_active', true)`
   - Output: `CatalogProduct` objects with `primary_image_url`.
   - Frontend: `OrderSummaryPanel.tsx`, `ProductOrderCard.tsx`, `CartDrawer.tsx`, `OrderReviewStep.tsx`.
2. **Order Details (`show()`):**
   - Eager-load: `items.product.primaryImage`.
   - Map:
     ```php
     'items' => $order->items->map(fn (OrderItem $item) => [
         'id' => $item->id,
         'product_id' => $item->product_id,
         'product_name' => $item->product_name_snapshot,
         'sku' => $item->sku_snapshot,
         'unit' => $item->unit_snapshot,
         'primary_image_url' => $item->primary_image_url,
         ...
     ]),
     ```

### B. Admin Order Controller (`app/Http/Controllers/Admin/AdminOrderController.php`)
1. **Order Details (`show()`):**
   - Eager-load: `items.product.primaryImage`.
   - Item Payload:
     ```php
     'primary_image_url' => $catalogProduct?->primary_image_url,
     'catalog_product' => $catalogProduct ? [
         'status' => $catalogProduct->status->value,
         'is_active' => $catalogProduct->status === ProductStatus::ACTIVE,
         'default_selling_price' => (string) $catalogProduct->default_selling_price,
         'mrp' => (string) $catalogProduct->mrp,
         'primary_image_url' => $catalogProduct->primary_image_url,
     ] : null,
     ```
2. **Order Review (`review()`):**
   - Eager-load: `items.product.primaryImage`.
   - Item Payload: exposes `'primary_image_url' => $catalogProduct?->primary_image_url` directly on each review item.

### C. Admin Order Adjustment Controller (`app/Http/Controllers/Admin/AdminOrderAdjustmentController.php`)
- **Review Endpoint (`review()`):**
  - Eager-load: `items.orderItem.allocations`, `items.orderItem.product.primaryImage`.
  - Service: `OrderAdjustmentReviewService` sets `primaryImageUrl: $orderItem->primary_image_url` on `OrderAdjustmentItemReviewDTO`.
  - Inertia Payload: `reviewData.line_evaluations.*.primary_image_url`.

### D. Warehouse Fulfillment Controller (`app/Http/Controllers/Warehouse/WarehouseFulfillmentController.php`)
- **Picking View (`show()`):**
  - Eager-load: `items.product.primaryImage`.
  - Item Payload: `'primary_image_url' => $item->product?->primary_image_url`.

### E. Delivery Partner Controller (`app/Http/Controllers/Delivery/DeliveryPartnerController.php`)
- **Driver Manifest (`show()`):**
  - Eager-load: `items.product.primaryImage`.
  - Item Payload: automatically serialized via `DeliveryItem` accessor `primary_image_url`.

---

## 4. TypeScript Interface Alignment

All TypeScript definitions in `resources/js/types/order.ts` have been synchronized:

```typescript
// Salesman & General Order Item
export interface OrderItemDetail {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    primary_image_url?: string | null;
    unit: string;
    ordered_quantity: number;
    ...
}

// Admin Order Detail Item
export interface AdminOrderDetailItem {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    primary_image_url?: string | null;
    catalog_product: {
        status: string;
        is_active: boolean;
        primary_image_url?: string | null;
        ...
    } | null;
    ...
}

// Admin Order Review Item
export interface AdminOrderReviewItem {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    primary_image_url?: string | null;
    catalog_product: {
        name?: string;
        status: string;
        primary_image_url?: string | null;
        ...
    } | null;
    ...
}

// Order Adjustment Item Review Data
export interface OrderAdjustmentItemReviewData {
    adjustment_item_id: number;
    order_item_id: number;
    product_id: number;
    product_name: string;
    sku: string;
    primary_image_url?: string | null;
    ...
}
```

---

## 5. Security & Isolation Invariants

1. **RULE-SEC-004 (Private Cloud Storage):**
   - Image keys are never exposed as public URLs.
   - All presigned URLs carry signature expiry (15-minute maximum TTL) and require authenticated sessions.
2. **RULE-DOC-001 (Invoice Document Isolation):**
   - Invoices generated via `InvoiceGeneratorService` and rendered via `InvoicePdfService` strictly exclude product images.
   - Tested and verified: zero `<img>` tags or thumbnail references in invoice HTML and PDF output.

