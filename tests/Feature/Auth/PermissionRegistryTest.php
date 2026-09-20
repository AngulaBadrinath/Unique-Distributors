<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Auth\RoleAssignmentService;
use App\Services\Auth\SessionRevocationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PermissionRegistryTest extends TestCase
{
    use RefreshDatabase;

    protected PermissionService $permissionService;

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database']);
        $this->permissionService = app(PermissionService::class);
    }

    /**
     * RBAC-PERM-001: Exactly 55 canonical permission codes exist.
     */
    public function test_exactly_48_canonical_permission_codes_exist(): void
    {
        $cases = Permission::cases();
        $this->assertCount(55, $cases);
        $this->assertCount(55, Permission::values());
    }

    /**
     * RBAC-PERM-002: Permission codes follow module.action convention.
     */
    public function test_permission_codes_follow_module_action_convention(): void
    {
        foreach (Permission::cases() as $permission) {
            $code = $permission->value;
            $this->assertMatchesRegularExpression(
                '/^[a-z]+(\.[a-z]+)+$/',
                $code,
                "Permission {$code} does not match module.action convention."
            );
            $this->assertNotEmpty($permission->module());
        }
    }

    /**
     * RBAC-PERM-003: Permission values are unique.
     */
    public function test_permission_values_are_unique(): void
    {
        $values = Permission::values();
        $uniqueValues = array_unique($values);
        $this->assertSame($uniqueValues, $values);
    }

    /**
     * RBAC-PERM-004: Every permission has label, description, and module metadata.
     */
    public function test_every_permission_has_metadata(): void
    {
        foreach (Permission::cases() as $permission) {
            $this->assertNotEmpty($permission->label());
            $this->assertNotEmpty($permission->description());
            $this->assertNotEmpty($permission->module());
        }

        // Test casesForModule helper
        $customerCases = Permission::casesForModule('customer');
        $this->assertCount(3, $customerCases);

        $pricingCases = Permission::casesForModule('pricing');
        $this->assertCount(1, $pricingCases);
        $this->assertSame([Permission::PRICING_OVERRIDE], $pricingCases);

        $payableCases = Permission::casesForModule('payable');
        $this->assertCount(2, $payableCases);
    }

    /**
     * RBAC-PERM-005: Role-to-permission mappings contain only valid registered permissions.
     */
    public function test_role_to_permission_mappings_contain_only_valid_registered_permissions(): void
    {
        foreach (UserRole::cases() as $role) {
            $permissions = $this->permissionService->getPermissionsForRole($role);
            foreach ($permissions as $permission) {
                $this->assertInstanceOf(
                    Permission::class,
                    $permission,
                    "Role {$role->value} contains non-Permission object."
                );
            }
        }
    }

    /**
     * RBAC-PERM-006: SUPER_ADMIN has exactly all 55 permissions.
     */
    public function test_super_admin_has_all_48_permissions(): void
    {
        $permissions = $this->permissionService->getPermissionsForRole(UserRole::SUPER_ADMIN);
        $this->assertCount(55, $permissions);
        $this->assertSame(Permission::cases(), $permissions);

        $superAdmin = User::factory()->superAdmin()->create();
        foreach (Permission::cases() as $permission) {
            $this->assertTrue(
                $this->permissionService->has($superAdmin, $permission),
                "Super Admin should possess {$permission->value}"
            );
        }
    }

    /**
     * RBAC-PERM-007: ADMIN has exactly the intended 50 permissions.
     */
    public function test_admin_has_exactly_the_intended_42_permissions(): void
    {
        $permissions = $this->permissionService->getPermissionsForRole(UserRole::ADMIN);
        $this->assertCount(50, $permissions);

        $permissionValues = array_map(fn (Permission $p) => $p->value, $permissions);

        // Required exclusions
        $this->assertNotContains(Permission::PERMISSION_MANAGE->value, $permissionValues);
        $this->assertNotContains(Permission::PAYMENT_REVERSE->value, $permissionValues);
        $this->assertNotContains(Permission::ACCOUNTING_POST->value, $permissionValues);
        $this->assertNotContains(Permission::ACCOUNTING_REVERSE->value, $permissionValues);
        $this->assertNotContains(Permission::INVENTORY_EXCEPTION_REPORT->value, $permissionValues);

        // Required inclusions
        $this->assertContains(Permission::ROLE_MANAGE->value, $permissionValues);
        $this->assertContains(Permission::ORDER_APPROVE->value, $permissionValues);
        $this->assertContains(Permission::ORDER_REJECT->value, $permissionValues);
        $this->assertContains(Permission::ORDER_ADJUST_REVERSE->value, $permissionValues);
        $this->assertContains(Permission::PAYMENT_VERIFY->value, $permissionValues);
        $this->assertContains(Permission::USER_SUSPEND->value, $permissionValues);
        $this->assertContains(Permission::PRICING_OVERRIDE->value, $permissionValues);
        $this->assertContains(Permission::RETURN_REQUEST->value, $permissionValues);
        $this->assertContains(Permission::RETURN_REVIEW->value, $permissionValues);
        $this->assertContains(Permission::RETURN_APPROVE->value, $permissionValues);
        $this->assertContains(Permission::CREDIT_VIEW->value, $permissionValues);
        $this->assertContains(Permission::CREDIT_CREATE->value, $permissionValues);
        $this->assertContains(Permission::REFUND_VIEW->value, $permissionValues);
        $this->assertContains(Permission::REFUND_REQUEST->value, $permissionValues);
        $this->assertContains(Permission::RECEIVABLE_VIEW->value, $permissionValues);
        $this->assertContains(Permission::PAYABLE_VIEW->value, $permissionValues);
        $this->assertContains(Permission::PAYABLE_MANAGE->value, $permissionValues);
    }

    /**
     * RBAC-PERM-008: ACCOUNTANT has exactly the intended 22 permissions.
     */
    public function test_accountant_has_exactly_the_intended_16_permissions(): void
    {
        $permissions = $this->permissionService->getPermissionsForRole(UserRole::ACCOUNTANT);
        $this->assertCount(22, $permissions);

        $expected = [
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
        ];

        $this->assertEqualsCanonicalizing($expected, $permissions);
    }

    /**
     * RBAC-PERM-009: SALESMAN has exactly the intended 14 permissions.
     */
    public function test_salesman_has_exactly_the_intended_11_permissions(): void
    {
        $permissions = $this->permissionService->getPermissionsForRole(UserRole::SALESMAN);
        $this->assertCount(14, $permissions);

        $expected = [
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
            Permission::INVOICE_DOWNLOAD,
            Permission::RECEIVABLE_VIEW,
        ];

        $this->assertEqualsCanonicalizing($expected, $permissions);
    }

    /**
     * RBAC-PERM-010: WAREHOUSE_MANAGER has exactly the intended 8 permissions.
     */
    public function test_warehouse_manager_has_exactly_the_intended_8_permissions(): void
    {
        $permissions = $this->permissionService->getPermissionsForRole(UserRole::WAREHOUSE_MANAGER);
        $this->assertCount(8, $permissions);

        $expected = [
            Permission::PRODUCT_VIEW,
            Permission::ORDER_VIEW,
            Permission::INVENTORY_VIEW,
            Permission::INVENTORY_ADJUST,
            Permission::INVENTORY_EXCEPTION_REPORT,
            Permission::ORDER_ADJUST_REQUEST,
            Permission::DELIVERY_VIEW,
            Permission::RETURN_REVIEW,
        ];

        $this->assertEqualsCanonicalizing($expected, $permissions);
    }

    /**
     * RBAC-PERM-011: DELIVERY_PARTNER has exactly the intended 3 permissions.
     */
    public function test_delivery_partner_has_exactly_the_intended_3_permissions(): void
    {
        $permissions = $this->permissionService->getPermissionsForRole(UserRole::DELIVERY_PARTNER);
        $this->assertCount(3, $permissions);

        $expected = [
            Permission::DELIVERY_VIEW,
            Permission::DELIVERY_UPDATE,
            Permission::ORDER_VIEW,
        ];

        $this->assertEqualsCanonicalizing($expected, $permissions);
    }

    /**
     * RBAC-PERM-012: Default deny is enforced.
     */
    public function test_default_deny_is_enforced(): void
    {
        $salesman = User::factory()->salesman()->create();

        // Salesman does not have order.approve
        $this->assertFalse($this->permissionService->has($salesman, Permission::ORDER_APPROVE));
        $this->assertFalse($this->permissionService->has($salesman, 'order.approve'));
        $this->assertFalse($salesman->hasPermission('order.approve'));
        $this->assertFalse($salesman->canPermission('order.approve'));
    }

    /**
     * RBAC-PERM-013: Unknown permission strings return false.
     */
    public function test_unknown_permission_strings_return_false(): void
    {
        $superAdmin = User::factory()->superAdmin()->create();

        $this->assertFalse($this->permissionService->has($superAdmin, 'nonexistent.permission'));
        $this->assertFalse($this->permissionService->has($superAdmin, 'admin.*'));
        $this->assertFalse($this->permissionService->has($superAdmin, ''));
        $this->assertFalse($superAdmin->hasPermission('invalid.action'));
    }

    /**
     * RBAC-PERM-014: Null role returns false for all permissions.
     */
    public function test_null_role_returns_false_for_all_permissions(): void
    {
        $userWithoutRole = User::factory()->create(['role' => null]);

        foreach (Permission::cases() as $permission) {
            $this->assertFalse($this->permissionService->has($userWithoutRole, $permission));
        }

        $this->assertSame([], $this->permissionService->getPermissionsForUser($userWithoutRole));
    }

    /**
     * RBAC-PERM-015: Inactive accounts (INVITED, SUSPENDED, DISABLED) have zero permissions.
     */
    public function test_inactive_accounts_have_zero_permissions(): void
    {
        $suspendedSuperAdmin = User::factory()->superAdmin()->suspended()->create();
        $disabledAdmin = User::factory()->admin()->disabled()->create();
        $invitedAccountant = User::factory()->accountant()->invited()->create();

        // Even with SUPER_ADMIN role, suspended user has zero effective permissions
        $this->assertFalse($this->permissionService->has($suspendedSuperAdmin, Permission::ORDER_VIEW));
        $this->assertFalse($this->permissionService->has($suspendedSuperAdmin, Permission::ROLE_MANAGE));
        $this->assertSame([], $this->permissionService->getPermissionsForUser($suspendedSuperAdmin));

        $this->assertFalse($this->permissionService->has($disabledAdmin, Permission::ORDER_VIEW));
        $this->assertSame([], $this->permissionService->getPermissionsForUser($disabledAdmin));

        $this->assertFalse($this->permissionService->has($invitedAccountant, Permission::PAYMENT_VIEW));
        $this->assertSame([], $this->permissionService->getPermissionsForUser($invitedAccountant));
    }

    /**
     * RBAC-PERM-016: Authorized permission check succeeds.
     */
    public function test_authorized_permission_check_succeeds(): void
    {
        $admin = User::factory()->admin()->create();

        $this->assertTrue($this->permissionService->has($admin, Permission::ORDER_APPROVE));
        $this->assertTrue($this->permissionService->has($admin, 'order.approve'));
        $this->assertTrue($admin->hasPermission(Permission::ORDER_APPROVE));
        $this->assertTrue($admin->canPermission('order.approve'));
    }

    /**
     * RBAC-PERM-017: Unauthorized permission authorization throws AuthorizationException.
     */
    public function test_unauthorized_permission_authorization_throws_exception(): void
    {
        $delivery = User::factory()->deliveryPartner()->create();

        $this->expectException(AuthorizationException::class);
        $this->permissionService->authorize($delivery, Permission::ORDER_CREATE);
    }

    /**
     * RBAC-PERM-018: Permission middleware rejects unauthorized access with 403.
     */
    public function test_permission_middleware_rejects_unauthorized_access(): void
    {
        $salesman = User::factory()->salesman()->create();

        // Route /security/roles is protected by permission:role.manage
        $response = $this->actingAs($salesman)->get(route('roles.index'));
        $response->assertForbidden();
    }

    /**
     * RBAC-PERM-019: Permission middleware allows authorized access.
     */
    public function test_permission_middleware_allows_authorized_access(): void
    {
        $admin = User::factory()->admin()->create();

        // Admin has role.manage
        $response = $this->actingAs($admin)->get(route('roles.index'));
        $response->assertOk();
    }

    /**
     * RBAC-PERM-020: Gate::allows works through PermissionService.
     */
    public function test_gate_allows_works_through_permission_service(): void
    {
        $accountant = User::factory()->accountant()->create();

        $this->assertTrue(Gate::forUser($accountant)->allows('payment.verify'));
        $this->assertFalse(Gate::forUser($accountant)->allows('product.price.update'));
    }

    /**
     * RBAC-PERM-021: $user->can() works through Gate integration.
     */
    public function test_user_can_works_through_gate_integration(): void
    {
        $warehouse = User::factory()->warehouseManager()->create();

        $this->assertTrue($warehouse->can('inventory.adjust'));
        $this->assertFalse($warehouse->can('customer.create'));
    }

    /**
     * RBAC-PERM-022: Dynamic role changes immediately change effective permission evaluation.
     */
    public function test_dynamic_role_changes_immediately_change_effective_permissions(): void
    {
        $admin = User::factory()->admin()->create();
        $target = User::factory()->salesman()->create();

        // Initially salesman: cannot approve orders
        $this->assertFalse($this->permissionService->has($target, Permission::ORDER_APPROVE));

        // Promote to Admin
        $roleAssignmentService = app(RoleAssignmentService::class);
        $roleAssignmentService->assignRole($admin, $target, UserRole::ADMIN, 'Promoted to Admin');

        // Fresh model has immediate admin permissions
        $freshTarget = $target->fresh();
        $this->assertTrue($this->permissionService->has($freshTarget, Permission::ORDER_APPROVE));
    }

    /**
     * RBAC-PERM-023: Role-change session invalidation from RBAC-001 remains intact.
     */
    public function test_role_change_session_invalidation_remains_intact(): void
    {
        $admin = User::factory()->admin()->create();
        $target = User::factory()->salesman()->create();

        DB::table('sessions')->insert([
            'id' => 'rbac002-test-session-1',
            'user_id' => $target->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Mozilla/5.0',
            'payload' => serialize(['test' => 'data']),
            'last_activity' => now()->timestamp,
        ]);

        $roleAssignmentService = app(RoleAssignmentService::class);
        $roleAssignmentService->assignRole($admin, $target, UserRole::ACCOUNTANT);

        $this->assertDatabaseMissing('sessions', ['id' => 'rbac002-test-session-1']);
    }

    /**
     * RBAC-PERM-024: Login regression passes.
     */
    public function test_login_regression_passes(): void
    {
        $user = User::factory()->salesman()->create([
            'password' => Hash::make('StrongPassword123!'),
        ]);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'StrongPassword123!',
        ]);

        $response->assertRedirect('/');
        $this->assertAuthenticatedAs($user);
    }

    /**
     * RBAC-PERM-025: MFA regression passes.
     */
    public function test_mfa_regression_passes(): void
    {
        $privilegedUser = User::factory()->admin()->withMfa('TESTSECRET123456')->create([
            'password' => Hash::make('StrongPassword123!'),
        ]);

        $response = $this->post('/login', [
            'email' => $privilegedUser->email,
            'password' => 'StrongPassword123!',
        ]);

        $response->assertRedirect(route('mfa.challenge'));
        $this->assertGuest();
    }

    /**
     * RBAC-PERM-026: Password reset regression passes.
     */
    public function test_password_reset_regression_passes(): void
    {
        $user = User::factory()->salesman()->create();

        $response = $this->post('/forgot-password', [
            'email' => $user->email,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('status');
    }

    /**
     * RBAC-PERM-027: Session revocation regression passes.
     */
    public function test_session_revocation_regression_passes(): void
    {
        $user = User::factory()->salesman()->create();
        $service = app(SessionRevocationService::class);

        DB::table('sessions')->insert([
            'id' => 'rbac002-session-revocation-test',
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Mozilla/5.0',
            'payload' => serialize(['test' => 'data']),
            'last_activity' => now()->timestamp,
        ]);

        $revoked = $service->revokeUserSessionsForSecurityEvent($user, 'test_revocation');
        $this->assertSame(1, $revoked);
        $this->assertDatabaseMissing('sessions', ['id' => 'rbac002-session-revocation-test']);
    }

    /**
     * RBAC-PERM-028: Frontend capability sharing exposes only safe permission data.
     */
    public function test_frontend_capability_sharing_exposes_safe_permissions(): void
    {
        $salesman = User::factory()->salesman()->create();

        $permissions = $this->permissionService->getPermissionsForUser($salesman);
        $this->assertIsArray($permissions);
        $this->assertCount(14, $permissions);
        $this->assertContains('customer.view', $permissions);
        $this->assertContains('payment.view', $permissions);
        $this->assertNotContains('order.approve', $permissions);
    }

    /**
     * RBAC-PERM-029: Frontend manipulation cannot bypass backend authorization.
     */
    public function test_frontend_manipulation_cannot_bypass_backend_authorization(): void
    {
        $salesman = User::factory()->salesman()->create();

        // Even if salesman sends request pretending to have permission or role
        $response = $this->actingAs($salesman)->put('/security/users/' . $salesman->id . '/role', [
            'role' => UserRole::ADMIN->value,
        ]);

        $response->assertForbidden();
    }

    /**
     * RBAC-PERM-030: Malformed role or permission state fails closed.
     */
    public function test_malformed_role_or_permission_state_fails_closed(): void
    {
        $user = User::factory()->create();

        // Null permission check
        $this->assertFalse($this->permissionService->has($user, ''));

        // Unpersisted user check
        $unsavedUser = new User(['role' => UserRole::SUPER_ADMIN, 'status' => AccountStatus::ACTIVE]);
        $this->assertFalse($this->permissionService->has($unsavedUser, Permission::CUSTOMER_VIEW));
    }

    /**
     * RBAC-PERM-031: PermissionService hasAny and hasAll behave correctly.
     */
    public function test_has_any_and_has_all(): void
    {
        $salesman = User::factory()->salesman()->create();

        // hasAny
        $this->assertTrue($this->permissionService->hasAny($salesman, [
            Permission::ORDER_APPROVE,
            Permission::CUSTOMER_VIEW,
        ]));
        $this->assertFalse($this->permissionService->hasAny($salesman, [
            Permission::ORDER_APPROVE,
            Permission::ACCOUNTING_POST,
        ]));
        $this->assertFalse($this->permissionService->hasAny($salesman, []));

        // hasAll
        $this->assertTrue($this->permissionService->hasAll($salesman, [
            Permission::ORDER_VIEW,
            Permission::CUSTOMER_VIEW,
        ]));
        $this->assertFalse($this->permissionService->hasAll($salesman, [
            Permission::ORDER_VIEW,
            Permission::ORDER_APPROVE,
        ]));
        $this->assertFalse($this->permissionService->hasAll($salesman, []));
    }

    /**
     * RBAC-PERM-032: No database queries are performed for in-memory permission lookups.
     */
    public function test_no_database_queries_are_performed_for_permission_lookups(): void
    {
        $admin = User::factory()->admin()->create();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $has1 = $this->permissionService->has($admin, Permission::CUSTOMER_VIEW);
        $has2 = $this->permissionService->has($admin, Permission::ORDER_APPROVE);
        $has3 = $this->permissionService->has($admin, Permission::ACCOUNTING_POST);

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertTrue($has1);
        $this->assertTrue($has2);
        $this->assertFalse($has3);
        $this->assertEmpty($queries, 'Permission lookups must be in-memory and execute zero SQL queries.');
    }

    /**
     * RBAC-PERM-033: Permission.manage is restricted exclusively to SUPER_ADMIN.
     */
    public function test_permission_manage_is_restricted_exclusively_to_super_admin(): void
    {
        $superAdmin = User::factory()->superAdmin()->create();
        $admin = User::factory()->admin()->create();
        $accountant = User::factory()->accountant()->create();

        $this->assertTrue($this->permissionService->has($superAdmin, Permission::PERMISSION_MANAGE));
        $this->assertFalse($this->permissionService->has($admin, Permission::PERMISSION_MANAGE));
        $this->assertFalse($this->permissionService->has($accountant, Permission::PERMISSION_MANAGE));
    }
}
