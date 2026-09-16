<?php

namespace App\Services\Auth;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class PermissionService
{
    /**
     * Authoritative, code-defined Role → Permission mapping.
     *
     * @var array<string, array<int, Permission>>
     */
    protected static ?array $rolePermissions = null;

    /**
     * Determine whether the user possesses the given permission.
     *
     * Enforces default deny:
     * - User must be authenticated and active.
     * - User must hold an authoritative UserRole.
     * - Permission must be registered and explicitly mapped.
     */
    /**
     * Alias for has() to maintain expressive syntactic parity.
     */
    public function hasPermission(User $user, Permission|string $permission): bool
    {
        return $this->has($user, $permission);
    }

    public function has(User $user, Permission|string $permission): bool
    {
        // 1. Unauthenticated or non-persisted user check
        if (! $user->exists || ! $user->id) {
            return false;
        }

        // 2. Account lifecycle gate: only ACTIVE users possess effective permissions
        $isActive = ($user->status instanceof AccountStatus)
            ? $user->status === AccountStatus::ACTIVE
            : $user->status === AccountStatus::ACTIVE->value;

        if (! $isActive) {
            return false;
        }

        // 3. User must have an authoritative role assigned
        if (! $user->role instanceof UserRole) {
            return false;
        }

        // 4. Resolve permission code safely (fail closed on unknown string)
        $resolvedPermission = $permission instanceof Permission
            ? $permission
            : Permission::tryFrom($permission);

        if ($resolvedPermission === null) {
            return false;
        }

        // 5. Evaluate role permission membership
        $rolePermissions = $this->getPermissionsForRole($user->role);

        return in_array($resolvedPermission, $rolePermissions, true);
    }

    /**
     * Determine whether the user possesses ANY of the given permissions.
     *
     * @param  array<int, Permission|string>  $permissions
     */
    public function hasAny(User $user, array $permissions): bool
    {
        if (empty($permissions)) {
            return false;
        }

        foreach ($permissions as $permission) {
            if ($this->has($user, $permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determine whether the user possesses ALL of the given permissions.
     *
     * @param  array<int, Permission|string>  $permissions
     */
    public function hasAll(User $user, array $permissions): bool
    {
        if (empty($permissions)) {
            return false;
        }

        foreach ($permissions as $permission) {
            if (! $this->has($user, $permission)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Authorize that the user possesses the given permission, or throw AuthorizationException.
     *
     * @throws AuthorizationException
     */
    public function authorize(User $user, Permission|string $permission): void
    {
        if (! $this->has($user, $permission)) {
            $code = $permission instanceof Permission ? $permission->value : (string) $permission;
            throw new AuthorizationException("This action is unauthorized. Required permission: {$code}");
        }
    }

    /**
     * Get all permissions granted to a canonical role.
     *
     * @return array<int, Permission>
     */
    public function getPermissionsForRole(UserRole $role): array
    {
        $this->ensureMappingsLoaded();

        return self::$rolePermissions[$role->value] ?? [];
    }

    /**
     * Get all active permission codes granted to the user as string array for safe frontend UX.
     *
     * @return array<int, string>
     */
    public function getPermissionsForUser(User $user): array
    {
        if (! $user->exists || ! $user->id) {
            return [];
        }

        $isActive = ($user->status instanceof AccountStatus)
            ? $user->status === AccountStatus::ACTIVE
            : $user->status === AccountStatus::ACTIVE->value;

        if (! $isActive || ! $user->role instanceof UserRole) {
            return [];
        }

        return array_map(
            fn (Permission $p) => $p->value,
            $this->getPermissionsForRole($user->role)
        );
    }

    /**
     * Load authoritative role to permission mappings into memory once.
     */
    protected function ensureMappingsLoaded(): void
    {
        if (self::$rolePermissions !== null) {
            return;
        }

        self::$rolePermissions = [
            // SUPER_ADMIN: Full system authority (all 48 permissions)
            UserRole::SUPER_ADMIN->value => Permission::cases(),

            // ADMIN: Operational administration across all business surfaces (40 permissions)
            UserRole::ADMIN->value => [
                // Customer
                Permission::CUSTOMER_VIEW,
                Permission::CUSTOMER_CREATE,
                Permission::CUSTOMER_UPDATE,

                // Product
                Permission::PRODUCT_VIEW,
                Permission::PRODUCT_CREATE,
                Permission::PRODUCT_UPDATE,
                Permission::PRODUCT_PRICE_UPDATE,
                Permission::PRODUCT_TAX_UPDATE,

                // Pricing
                Permission::PRICING_OVERRIDE,

                // Order
                Permission::ORDER_VIEW,
                Permission::ORDER_CREATE,
                Permission::ORDER_SUBMIT,
                Permission::ORDER_APPROVE,
                Permission::ORDER_REJECT,
                Permission::ORDER_CANCEL,

                // Order Adjustments
                Permission::ORDER_ADJUST_REQUEST,
                Permission::ORDER_ADJUST_REVIEW,
                Permission::ORDER_ADJUST_APPROVE,
                Permission::ORDER_ADJUST_APPLY,
                Permission::ORDER_ADJUST_REVERSE,

                // Payment
                Permission::PAYMENT_VIEW,
                Permission::PAYMENT_CREATE,
                Permission::PAYMENT_VERIFY,

                // Inventory
                Permission::INVENTORY_VIEW,
                Permission::INVENTORY_ADJUST,

                // Delivery
                Permission::DELIVERY_VIEW,
                Permission::DELIVERY_ASSIGN,
                Permission::DELIVERY_UPDATE,

                // Return
                Permission::RETURN_REQUEST,
                Permission::RETURN_REVIEW,
                Permission::RETURN_APPROVE,

                // Credit & Refund
                Permission::CREDIT_VIEW,
                Permission::CREDIT_CREATE,
                Permission::REFUND_VIEW,
                Permission::REFUND_REQUEST,
                Permission::REFUND_APPROVE,

                // Invoice
                Permission::INVOICE_VIEW,
                Permission::INVOICE_PRINT,
                Permission::INVOICE_DOWNLOAD,

                // Accounts Receivable
                Permission::RECEIVABLE_VIEW,

                // Accounts Payable
                Permission::PAYABLE_VIEW,
                Permission::PAYABLE_MANAGE,

                // Accounting
                Permission::ACCOUNTING_VIEW,

                // User Administration
                Permission::USER_VIEW,
                Permission::USER_CREATE,
                Permission::USER_UPDATE,
                Permission::USER_SUSPEND,

                // Audit & Security
                Permission::AUDIT_VIEW,
                Permission::AUDIT_SECURITY_VIEW,

                // Role Management
                Permission::ROLE_MANAGE,
            ],

            // ACCOUNTANT: Financial, ledger, payment verification, and credit operations (22 permissions)
            UserRole::ACCOUNTANT->value => [
                Permission::CUSTOMER_VIEW,
                Permission::ORDER_VIEW,
                Permission::ORDER_ADJUST_REVIEW,
                Permission::RETURN_REVIEW,
                Permission::PAYMENT_VIEW,
                Permission::PAYMENT_CREATE,
                Permission::PAYMENT_VERIFY,
                Permission::PAYMENT_REVERSE,
                Permission::CREDIT_VIEW,
                Permission::CREDIT_CREATE,
                Permission::REFUND_VIEW,
                Permission::REFUND_REQUEST,
                Permission::REFUND_APPROVE,
                Permission::INVOICE_VIEW,
                Permission::INVOICE_PRINT,
                Permission::INVOICE_DOWNLOAD,
                Permission::RECEIVABLE_VIEW,
                Permission::PAYABLE_VIEW,
                Permission::PAYABLE_MANAGE,
                Permission::ACCOUNTING_VIEW,
                Permission::ACCOUNTING_POST,
                Permission::ACCOUNTING_REVERSE,
            ],

            // SALESMAN: Field sales, customer portfolio, order entry, and collection receipt (13 permissions)
            UserRole::SALESMAN->value => [
                Permission::CUSTOMER_VIEW,
                Permission::PRODUCT_VIEW,
                Permission::ORDER_VIEW,
                Permission::ORDER_CREATE,
                Permission::ORDER_SUBMIT,
                Permission::ORDER_ADJUST_REQUEST,
                Permission::RETURN_REQUEST,
                Permission::REFUND_REQUEST,
                Permission::PAYMENT_VIEW,
                Permission::PAYMENT_CREATE,
                Permission::INVOICE_VIEW,
                Permission::INVOICE_PRINT,
                Permission::RECEIVABLE_VIEW,
            ],

            // WAREHOUSE_MANAGER: Stock levels, fulfillment, picking, and warehouse exceptions (8 permissions)
            UserRole::WAREHOUSE_MANAGER->value => [
                Permission::PRODUCT_VIEW,
                Permission::ORDER_VIEW,
                Permission::INVENTORY_VIEW,
                Permission::INVENTORY_ADJUST,
                Permission::INVENTORY_EXCEPTION_REPORT,
                Permission::ORDER_ADJUST_REQUEST,
                Permission::DELIVERY_VIEW,
                Permission::RETURN_REVIEW,
            ],

            // DELIVERY_PARTNER: Logistics dispatch, assigned delivery execution, and proof of delivery (3 permissions)
            UserRole::DELIVERY_PARTNER->value => [
                Permission::DELIVERY_VIEW,
                Permission::DELIVERY_UPDATE,
                Permission::ORDER_VIEW,
            ],
        ];
    }
}
