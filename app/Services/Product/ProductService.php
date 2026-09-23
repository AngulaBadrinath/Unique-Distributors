<?php

namespace App\Services\Product;

use App\DTOs\Product\ProductData;
use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Models\Product;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Pricing\PriceBoundaryService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ProductService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected ProductImageService $productImageService,
        protected PriceBoundaryService $priceBoundaryService
    ) {}

    /**
     * Retrieve paginated, searchable, filterable product list.
     * Mask sensitive cost_price for non-administrative roles.
     *
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = [], int $perPage = 15, ?User $actor = null): LengthAwarePaginator
    {
        $query = Product::query()->with(['category:id,name,code', 'primaryImage', 'taxProfile']);

        // 1. Search filter across SKU, name, description
        if (! empty($filters['search'])) {
            $query->search((string) $filters['search']);
        }

        // 2. Lifecycle Status filter
        if (! empty($filters['status'])) {
            $query->filterByStatus((string) $filters['status']);
        }

        // 3. Category filter
        if (! empty($filters['category_id'])) {
            $query->filterByCategory($filters['category_id']);
        }

        // 4. Sorting (allow-listed fields only)
        $allowedSorts = ['name', 'sku', 'default_selling_price', 'mrp', 'status', 'created_at'];
        $sortBy = in_array($filters['sort_by'] ?? null, $allowedSorts, true) ? $filters['sort_by'] : 'name';
        $sortOrder = strtolower((string) ($filters['sort_order'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';

        $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage)->withQueryString();

        // 5. Transform collection to shape sensitive fields based on actor role
        $paginator->through(fn (Product $product) => $this->formatProduct($product, $actor));

        return $paginator;
    }

    /**
     * Retrieve active categories for selection dropdowns with hierarchy paths.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getActiveCategories(): array
    {
        return \App\Models\Category::active()
            ->orderBy('sort_order', 'asc')
            ->orderBy('name', 'asc')
            ->get()
            ->map(fn (\App\Models\Category $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
                'hierarchy_path' => $c->getHierarchyPath(),
            ])
            ->values()
            ->toArray();
    }

    /**
     * Retrieve product by ID formatted for presentation.
     */
    public function findById(int $id, ?User $actor = null): array
    {
        /** @var Product $product */
        $product = Product::with(['category:id,name,code', 'images', 'taxProfile'])->findOrFail($id);

        return $this->formatProduct($product, $actor);
    }

    /**
     * Format product model into structured presentation array with sensitive cost masking.
     *
     * @return array<string, mixed>
     */
    public function formatProduct(Product $product, ?User $actor = null): array
    {
        $product->loadMissing(['category:id,name,code', 'primaryImage', 'images']);

        $isAdmin = $actor && in_array($actor->role, [UserRole::SUPER_ADMIN, UserRole::ADMIN], true);

        return [
            'id' => $product->id,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'barcode_type' => $product->barcode_type,
            'name' => $product->name,
            'description' => $product->description,
            'category_id' => $product->category_id,
            'category' => $product->category ? [
                'id' => $product->category->id,
                'name' => $product->category->name,
                'code' => $product->category->code,
            ] : null,
            'unit' => $product->unit,
            'status' => $product->status instanceof ProductStatus ? $product->status->value : (string) $product->status,
            'status_label' => $product->status instanceof ProductStatus ? $product->status->label() : (string) $product->status,
            'status_badge_variant' => $product->status instanceof ProductStatus ? $product->status->badgeVariant() : 'secondary',
            'cost_price' => $isAdmin ? ($product->cost_price !== null ? (float) $product->cost_price : null) : null,
            'minimum_allowed_price' => (float) $product->minimum_allowed_price,
            'default_selling_price' => (float) $product->default_selling_price,
            'mrp' => (float) $product->mrp,
            'can_order' => $product->canOrder(),
            'tax_profile_id' => $product->tax_profile_id,
            'tax_profile' => $product->taxProfile ? [
                'id' => $product->taxProfile->id,
                'name' => $product->taxProfile->name,
                'code' => $product->taxProfile->code,
                'rate' => (string) $product->taxProfile->rate,
                'formatted_rate' => rtrim(rtrim((string) $product->taxProfile->rate, '0'), '.').'%',
                'status' => $product->taxProfile->status instanceof \App\Enums\TaxProfileStatus ? $product->taxProfile->status->value : (string) $product->taxProfile->status,
            ] : null,
            'primary_image_url' => $product->primaryImage ? $this->productImageService->getTemporaryUrl($product->primaryImage) : null,
            'images' => $product->relationLoaded('images')
                ? $product->images->map(fn ($img) => $this->productImageService->formatImage($img))->values()->all()
                : [],
            'created_at' => $product->created_at?->toIso8601String(),
            'updated_at' => $product->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Retrieve active tax profiles for selection dropdowns.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getActiveTaxProfiles(): array
    {
        return \App\Models\TaxProfile::query()
            ->active()
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'code', 'rate'])
            ->map(fn (\App\Models\TaxProfile $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'code' => $p->code,
                'rate' => (string) $p->rate,
                'formatted_rate' => rtrim(rtrim((string) $p->rate, '0'), '.').'%',
            ])
            ->values()
            ->toArray();
    }

    /**
     * Generate the next deterministic sequential SKU.
     */
    public function generateNextSku(): string
    {
        $maxNum = 0;
        $skus = Product::query()->whereNotNull('sku')->pluck('sku');

        foreach ($skus as $sku) {
            if (preg_match('/^PROD-(\d+)$/i', trim($sku), $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        if ($maxNum === 0) {
            $maxId = (int) Product::max('id');
            $maxNum = $maxId;
        }

        return sprintf('PROD-%05d', $maxNum + 1);
    }

    /**
     * Validate authoritative commercial pricing hierarchy.
     *
     * Invariant:
     * 0 <= cost_price
     * 0 < minimum_allowed_price <= default_selling_price <= mrp
     *
     * @throws ValidationException
     */
    public function validatePricingHierarchy(mixed $costPrice, mixed $minPrice, mixed $defaultPrice, mixed $mrp): void
    {
        $this->priceBoundaryService->validateProductMasterPricing(
            $costPrice,
            $minPrice,
            $defaultPrice,
            $mrp
        );
    }

    /**
     * Create a new product master record.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function create(ProductData $data, User $actor, ?string $ip = null): Product
    {
        $this->ensureActorIsActiveAndAuthorized($actor, Permission::PRODUCT_CREATE);

        $this->validatePricingHierarchy(
            $data->cost_price,
            $data->minimum_allowed_price,
            $data->default_selling_price,
            $data->mrp
        );

        return DB::transaction(function () use ($data, $actor, $ip) {
            $attributes = $data->toArray();

            // Auto-generate SKU if omitted
            if (empty($attributes['sku'])) {
                $attributes['sku'] = $this->generateNextSku();
            } else {
                $attributes['sku'] = strtoupper(trim((string) $attributes['sku']));
            }

            // Validate active category assignment
            if ($data->category_id !== null) {
                $category = \App\Models\Category::find($data->category_id);
                if (! $category || ! $category->isActive()) {
                    throw ValidationException::withMessages([
                        'category_id' => 'The selected category is inactive and cannot be assigned to new products.',
                    ]);
                }
            }

            // Validate active tax profile assignment
            if ($data->tax_profile_id !== null) {
                $taxProfile = \App\Models\TaxProfile::find($data->tax_profile_id);
                if (! $taxProfile || ! $taxProfile->isActive()) {
                    throw ValidationException::withMessages([
                        'tax_profile_id' => 'The selected tax profile is inactive or invalid.',
                    ]);
                }
            }

            // Check SKU uniqueness defensively
            if (Product::where('sku', $attributes['sku'])->exists()) {
                throw ValidationException::withMessages([
                    'sku' => 'The product SKU has already been taken.',
                ]);
            }

            $product = Product::create($attributes);

            Log::info('Product master record created', [
                'event' => 'audit.product_event',
                'action' => 'PRODUCT_CREATED',
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'product_id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'unit' => $product->unit,
                'cost_price' => $product->cost_price,
                'minimum_allowed_price' => $product->minimum_allowed_price,
                'default_selling_price' => $product->default_selling_price,
                'mrp' => $product->mrp,
                'status' => $product->status?->value ?? (string) $product->status,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            return $product->load('category:id,name,code');
        });
    }

    /**
     * Update an existing product master record.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function update(Product $product, ProductData $data, User $actor, ?string $ip = null): Product
    {
        $this->ensureActorIsActiveAndAuthorized($actor, Permission::PRODUCT_UPDATE);

        return DB::transaction(function () use ($product, $data, $actor, $ip) {
            /** @var Product $lockedProduct */
            $lockedProduct = Product::query()
                ->where('id', $product->id)
                ->lockForUpdate()
                ->firstOrFail();

            // 1. Resulting-state pricing resolution & authoritative validation
            $resultingCost = $data->cost_price;
            $resultingMin = $data->minimum_allowed_price;
            $resultingDefault = $data->default_selling_price;
            $resultingMrp = $data->mrp;

            $this->validatePricingHierarchy(
                $resultingCost,
                $resultingMin,
                $resultingDefault,
                $resultingMrp
            );

            $newSku = strtoupper(trim($data->sku));

            // Check SKU uniqueness if changed
            if ($newSku !== $lockedProduct->sku && Product::where('sku', $newSku)->where('id', '!=', $lockedProduct->id)->exists()) {
                throw ValidationException::withMessages([
                    'sku' => 'The product SKU has already been taken.',
                ]);
            }

            // Validate active category if category is being changed
            if ($data->category_id !== null && $data->category_id !== $lockedProduct->category_id) {
                $category = \App\Models\Category::find($data->category_id);
                if (! $category || ! $category->isActive()) {
                    throw ValidationException::withMessages([
                        'category_id' => 'The selected category is inactive and cannot be assigned.',
                    ]);
                }
            }

            // Validate active tax profile if tax profile is being changed
            $taxProfileChanged = ($data->tax_profile_id !== $lockedProduct->tax_profile_id);
            if ($taxProfileChanged) {
                // If tax profile assignment changed, verify actor possesses PRODUCT_TAX_UPDATE
                $this->ensureActorIsActiveAndAuthorized($actor, Permission::PRODUCT_TAX_UPDATE);

                if ($data->tax_profile_id !== null) {
                    $taxProfile = \App\Models\TaxProfile::find($data->tax_profile_id);
                    if (! $taxProfile || ! $taxProfile->isActive()) {
                        throw ValidationException::withMessages([
                            'tax_profile_id' => 'The selected tax profile is inactive and cannot be assigned.',
                        ]);
                    }
                }
            }

            $previousPrices = [
                'cost_price' => PriceBoundaryService::normalize((string) $lockedProduct->cost_price, 'cost_price'),
                'minimum_allowed_price' => PriceBoundaryService::normalize((string) $lockedProduct->minimum_allowed_price, 'minimum_allowed_price'),
                'default_selling_price' => PriceBoundaryService::normalize((string) $lockedProduct->default_selling_price, 'default_selling_price'),
                'mrp' => PriceBoundaryService::normalize((string) $lockedProduct->mrp, 'mrp'),
            ];

            $newPrices = [
                'cost_price' => $resultingCost,
                'minimum_allowed_price' => $resultingMin,
                'default_selling_price' => $resultingDefault,
                'mrp' => $resultingMrp,
            ];

            $pricingChanged = ($previousPrices !== $newPrices);

            // If pricing changed, verify actor possesses PRODUCT_PRICE_UPDATE
            if ($pricingChanged) {
                $this->ensureActorIsActiveAndAuthorized($actor, Permission::PRODUCT_PRICE_UPDATE);
            }

            // Check if status changed
            $previousStatus = $lockedProduct->status;
            $newStatus = $data->status instanceof ProductStatus ? $data->status : ProductStatus::tryFrom((string) $data->status);

            $statusChanged = ($newStatus && $newStatus !== $previousStatus);

            if ($statusChanged && $newStatus) {
                if (! $previousStatus->canTransitionTo($newStatus)) {
                    throw ValidationException::withMessages([
                        'status' => "Cannot transition product status from {$previousStatus->label()} to {$newStatus->label()}.",
                    ]);
                }
            }

            $original = $lockedProduct->only(array_keys($data->toArray()));
            $newValues = $data->toArray();
            $newValues['sku'] = $newSku;

            $changedFields = [];
            foreach ($newValues as $key => $val) {
                if (($original[$key] ?? null) != $val) {
                    $changedFields[] = $key;
                }
            }

            $lockedProduct->fill($newValues);
            $lockedProduct->save();

            Log::info('Product master record updated', [
                'event' => 'audit.product_event',
                'action' => 'PRODUCT_UPDATED',
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'product_id' => $lockedProduct->id,
                'sku' => $lockedProduct->sku,
                'changed_fields' => $changedFields,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            if ($pricingChanged) {
                Log::info('Product commercial pricing updated', [
                    'event' => 'audit.product_event',
                    'action' => 'PRODUCT_PRICING_UPDATED',
                    'actor_id' => $actor->id,
                    'actor_email' => $actor->email,
                    'actor_role' => $actor->role?->value,
                    'product_id' => $lockedProduct->id,
                    'sku' => $lockedProduct->sku,
                    'previous_prices' => $previousPrices,
                    'new_prices' => $newPrices,
                    'ip_address' => $ip,
                    'timestamp' => now()->toIso8601String(),
                ]);
            }

            if ($taxProfileChanged) {
                Log::info('Product tax profile assignment updated', [
                    'event' => 'audit.product_event',
                    'action' => 'PRODUCT_TAX_PROFILE_CHANGED',
                    'actor_id' => $actor->id,
                    'actor_email' => $actor->email,
                    'actor_role' => $actor->role?->value,
                    'product_id' => $lockedProduct->id,
                    'sku' => $lockedProduct->sku,
                    'previous_tax_profile_id' => $original['tax_profile_id'] ?? null,
                    'new_tax_profile_id' => $data->tax_profile_id,
                    'ip_address' => $ip,
                    'timestamp' => now()->toIso8601String(),
                ]);
            }

            if ($statusChanged && $newStatus) {
                $statusAction = ($newStatus === ProductStatus::ACTIVE) ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED';
                Log::info("Product status transitioned: {$statusAction}", [
                    'event' => 'audit.product_event',
                    'action' => $statusAction,
                    'actor_id' => $actor->id,
                    'actor_email' => $actor->email,
                    'actor_role' => $actor->role?->value,
                    'product_id' => $lockedProduct->id,
                    'sku' => $lockedProduct->sku,
                    'previous_status' => $previousStatus?->value ?? (string) $previousStatus,
                    'new_status' => $newStatus->value,
                    'reason' => 'Updated via general product master edit',
                    'ip_address' => $ip,
                    'timestamp' => now()->toIso8601String(),
                ]);
            }

            return $lockedProduct->load('category:id,name,code');
        });
    }


    /**
     * Transition product lifecycle status.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function updateStatus(
        Product $product,
        ProductStatus $newStatus,
        User $actor,
        ?string $reason = null,
        ?string $ip = null
    ): Product {
        $this->ensureActorIsActiveAndAuthorized($actor, Permission::PRODUCT_UPDATE);

        return DB::transaction(function () use ($product, $newStatus, $actor, $reason, $ip) {
            /** @var Product $lockedProduct */
            $lockedProduct = Product::query()
                ->where('id', $product->id)
                ->lockForUpdate()
                ->firstOrFail();

            $previousStatus = $lockedProduct->status;

            // No-op check: identical status returns without duplicate writes or audits
            if ($previousStatus === $newStatus) {
                return $lockedProduct;
            }

            if (! $previousStatus->canTransitionTo($newStatus)) {
                throw ValidationException::withMessages([
                    'status' => "Cannot transition product status from {$previousStatus->label()} to {$newStatus->label()}.",
                ]);
            }

            $action = ($newStatus === ProductStatus::ACTIVE) ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED';

            $lockedProduct->status = $newStatus;
            $lockedProduct->save();

            Log::info("Product status transitioned: {$action}", [
                'event' => 'audit.product_event',
                'action' => $action,
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'product_id' => $lockedProduct->id,
                'sku' => $lockedProduct->sku,
                'previous_status' => $previousStatus?->value ?? (string) $previousStatus,
                'new_status' => $newStatus->value,
                'reason' => $reason,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            return $lockedProduct;
        });
    }

    /**
     * Ensure actor has an active account status and required permission.
     *
     * @throws AuthorizationException
     */
    protected function ensureActorIsActiveAndAuthorized(User $actor, Permission $permission): void
    {
        $isActive = ($actor->status instanceof AccountStatus)
            ? $actor->status === AccountStatus::ACTIVE
            : $actor->status === AccountStatus::ACTIVE->value;

        if (! $isActive) {
            throw new AuthorizationException('Inactive accounts are not authorized to perform product operations.');
        }

        $this->permissionService->authorize($actor, $permission);
    }
}
