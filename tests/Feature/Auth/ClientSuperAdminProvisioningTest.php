<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\User;
use App\Services\Auth\PermissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ClientSuperAdminProvisioningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    public function test_client_super_admin_can_be_provisioned_successfully(): void
    {
        $exitCode = Artisan::call('auth:provision-client-admin', [
            '--email' => 'client.admin@uniquedistributors.com',
            '--name' => 'Client Super Administrator',
            '--password' => 'TestClientPassword2026!',
        ]);

        $this->assertSame(0, $exitCode);

        $user = User::where('email', 'client.admin@uniquedistributors.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('Client Super Administrator', $user->name);
        $this->assertSame(UserRole::SUPER_ADMIN, $user->role);
        $this->assertSame(AccountStatus::ACTIVE, $user->status);
        $this->assertTrue(Hash::check('TestClientPassword2026!', $user->password));
        $this->assertNotNull($user->email_verified_at);
        $this->assertFalse($user->hasMfaEnabled());
        $this->assertTrue($user->requiresMfa());
    }

    public function test_duplicate_provisioning_is_safe_and_idempotent(): void
    {
        // 1. Initial creation
        Artisan::call('auth:provision-client-admin', [
            '--email' => 'client.admin@uniquedistributors.com',
            '--name' => 'Client Super Administrator',
            '--password' => 'TestClientPassword2026!',
        ]);

        $initialUser = User::where('email', 'client.admin@uniquedistributors.com')->first();
        $initialPasswordHash = $initialUser->password;

        // 2. Duplicate attempt with different password
        $exitCode = Artisan::call('auth:provision-client-admin', [
            '--email' => 'client.admin@uniquedistributors.com',
            '--name' => 'Client Super Administrator',
            '--password' => 'AttemptedNewPassword999!',
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertSame(1, User::where('email', 'client.admin@uniquedistributors.com')->count());

        $freshUser = User::where('email', 'client.admin@uniquedistributors.com')->first();
        $this->assertSame($initialPasswordHash, $freshUser->password);
        $this->assertTrue(Hash::check('TestClientPassword2026!', $freshUser->password));
    }

    public function test_client_super_admin_authenticates_via_login_flow(): void
    {
        $user = User::create([
            'name' => 'Client Super Administrator',
            'email' => 'client.admin@uniquedistributors.com',
            'password' => Hash::make('ClientSecureAuth2026!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        $this->assertTrue(Auth::validate([
            'email' => 'client.admin@uniquedistributors.com',
            'password' => 'ClientSecureAuth2026!',
        ]));

        // Post login initiation
        $response = $this->post('/login', [
            'email' => 'client.admin@uniquedistributors.com',
            'password' => 'ClientSecureAuth2026!',
        ]);

        // Privileged super admin without enrolled 2FA is directed to MFA setup / challenge
        $response->assertRedirect(route('mfa.challenge'));
        $this->assertTrue(session()->has('mfa.challenge'));
        $challenge = session('mfa.challenge');
        $this->assertSame($user->id, $challenge['user_id']);
        $this->assertTrue($challenge['requires_setup']);
    }

    public function test_client_super_admin_has_full_rbac_permissions(): void
    {
        $user = User::create([
            'name' => 'Client Super Administrator',
            'email' => 'client.admin@uniquedistributors.com',
            'password' => Hash::make('ClientSecureAuth2026!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        $permissionService = app(PermissionService::class);
        $permissions = $permissionService->getPermissionsForRole($user->role);

        // Super admin possesses all canonical permissions
        $this->assertCount(count(Permission::cases()), $permissions);
        $this->assertTrue($permissionService->has($user, Permission::ROLE_MANAGE));
        $this->assertTrue($permissionService->has($user, Permission::ORDER_APPROVE));
        $this->assertTrue($permissionService->has($user, Permission::ACCOUNTING_VIEW));
    }

    public function test_existing_developer_super_admin_remains_independent_and_unaltered(): void
    {
        // Existing Developer Super Admin with confirmed MFA
        $devSuperAdmin = User::create([
            'name' => 'Developer Super Administrator',
            'email' => 'superadmin.qa@example.test',
            'password' => Hash::make('DevPassword123!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'two_factor_secret' => 'EXISTING_MFA_SECRET_TOKEN',
            'two_factor_confirmed_at' => now(),
            'email_verified_at' => now(),
        ]);

        // Provision Client Super Admin
        Artisan::call('auth:provision-client-admin', [
            '--email' => 'client.admin@uniquedistributors.com',
            '--name' => 'Client Super Administrator',
            '--password' => 'ClientUniquePassword2026!',
        ]);

        $clientSuperAdmin = User::where('email', 'client.admin@uniquedistributors.com')->first();
        $this->assertNotNull($clientSuperAdmin);

        // Verify Developer Super Admin was NOT modified in any way
        $devSuperAdminFresh = $devSuperAdmin->fresh();
        $this->assertSame('superadmin.qa@example.test', $devSuperAdminFresh->email);
        $this->assertSame('EXISTING_MFA_SECRET_TOKEN', $devSuperAdminFresh->two_factor_secret);
        $this->assertNotNull($devSuperAdminFresh->two_factor_confirmed_at);
        $this->assertTrue($devSuperAdminFresh->hasMfaEnabled());
        $this->assertTrue(Hash::check('DevPassword123!', $devSuperAdminFresh->password));

        // Verify Client Super Admin has completely independent empty MFA state
        $this->assertNull($clientSuperAdmin->two_factor_secret);
        $this->assertNull($clientSuperAdmin->two_factor_confirmed_at);
        $this->assertFalse($clientSuperAdmin->hasMfaEnabled());
    }
}
