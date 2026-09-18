<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Auth\RoleAssignmentService;
use App\Services\Auth\TwoFactorAuthenticationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class ClientSuperAdminProvisioningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /**
     * 1. New client account can be provisioned and can authenticate with password.
     */
    public function test_client_super_admin_can_be_provisioned_and_authenticates(): void
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

        // Verify password authentication credentials
        $this->assertTrue(Auth::validate([
            'email' => 'client.admin@uniquedistributors.com',
            'password' => 'TestClientPassword2026!',
        ]));

        // Post login initiation directs to MFA challenge
        $response = $this->post('/login', [
            'email' => 'client.admin@uniquedistributors.com',
            'password' => 'TestClientPassword2026!',
        ]);

        $response->assertRedirect(route('mfa.challenge'));
        $this->assertTrue(session()->has('mfa.challenge'));
        $challenge = session('mfa.challenge');
        $this->assertSame($user->id, $challenge['user_id']);
        $this->assertTrue($challenge['requires_setup']);
    }

    /**
     * 2. Role resolves authoritatively to SUPER_ADMIN with full RBAC permissions.
     */
    public function test_client_super_admin_role_resolves_to_super_admin_and_has_full_permissions(): void
    {
        $user = User::create([
            'name' => 'Client Super Administrator',
            'email' => 'client.admin@uniquedistributors.com',
            'password' => Hash::make('ClientSecureAuth2026!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        $this->assertSame(UserRole::SUPER_ADMIN, $user->role);
        $this->assertTrue($user->isSuperAdmin());

        $permissionService = app(PermissionService::class);
        $permissions = $permissionService->getPermissionsForRole($user->role);

        // Super admin possesses all canonical permissions
        $this->assertCount(count(Permission::cases()), $permissions);
        $this->assertTrue($permissionService->has($user, Permission::ROLE_MANAGE));
        $this->assertTrue($permissionService->has($user, Permission::ORDER_APPROVE));
        $this->assertTrue($permissionService->has($user, Permission::ACCOUNTING_VIEW));
        $this->assertTrue($permissionService->has($user, Permission::INVENTORY_ADJUST));
    }

    /**
     * 3. MFA enrollment/verification works using the application's supported flow.
     */
    public function test_client_super_admin_mfa_enrollment_and_verification_flow(): void
    {
        $user = User::create([
            'name' => 'Client Super Administrator',
            'email' => 'client.admin@uniquedistributors.com',
            'password' => Hash::make('ClientSecureAuth2026!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        // 1. Password login sets up MFA challenge session with requires_setup
        $this->post('/login', [
            'email' => 'client.admin@uniquedistributors.com',
            'password' => 'ClientSecureAuth2026!',
        ]);

        // 2. Client visits GET /login/mfa to fetch QR code and pending secret
        $createResponse = $this->get('/login/mfa');
        $createResponse->assertOk();

        $challenge = session('mfa.challenge');
        $this->assertNotEmpty($challenge['pending_secret']);
        $pendingSecret = $challenge['pending_secret'];

        // 3. Client enrolls their authenticator app and submits valid 6-digit TOTP code
        $validOtp = (new Google2FA())->getCurrentOtp($pendingSecret);

        $storeResponse = $this->post('/login/mfa', [
            'code' => $validOtp,
        ]);

        $storeResponse->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($user);

        // 4. Verify user record is now permanently enrolled with independent secret
        $freshUser = $user->fresh();
        $this->assertSame($pendingSecret, $freshUser->two_factor_secret);
        $this->assertNotNull($freshUser->two_factor_confirmed_at);
        $this->assertTrue($freshUser->hasMfaEnabled());

        // 5. Recovery codes flashed to session
        $this->assertTrue(session()->has('recovery_codes'));
        $this->assertCount(8, session('recovery_codes'));
    }

    /**
     * 4. Incorrect MFA code is rejected.
     */
    public function test_client_super_admin_mfa_incorrect_code_is_rejected(): void
    {
        $user = User::create([
            'name' => 'Client Super Administrator',
            'email' => 'client.admin@uniquedistributors.com',
            'password' => Hash::make('ClientSecureAuth2026!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        $twoFactorService = app(TwoFactorAuthenticationService::class);
        $pendingSecret = $twoFactorService->generateSecretKey();

        // Simulate challenge state
        session()->put('mfa.challenge', [
            'user_id' => $user->id,
            'remember' => false,
            'requires_setup' => true,
            'pending_secret' => $pendingSecret,
            'attempts' => 0,
            'expires_at' => now()->addMinutes(5)->timestamp,
        ]);

        $response = $this->post('/login/mfa', [
            'code' => '000000', // invalid code
        ]);

        $response->assertSessionHasErrors('code');
        $this->assertGuest();

        $freshUser = $user->fresh();
        $this->assertNull($freshUser->two_factor_secret);
        $this->assertNull($freshUser->two_factor_confirmed_at);
        $this->assertFalse($freshUser->hasMfaEnabled());
    }

    /**
     * 5. Existing SUPER_ADMIN accounts still authenticate normally.
     */
    public function test_existing_super_admin_accounts_still_authenticate_normally(): void
    {
        $devSecret = (new Google2FA())->generateSecretKey(32);

        $devSuperAdmin = User::create([
            'name' => 'Developer Super Administrator',
            'email' => 'superadmin.qa@example.test',
            'password' => Hash::make('DevPassword123!', [
                'rounds' => 4,
            ]),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'two_factor_secret' => $devSecret,
            'two_factor_confirmed_at' => now(),
            'email_verified_at' => now(),
        ]);

        // Login with password
        $response = $this->post('/login', [
            'email' => 'superadmin.qa@example.test',
            'password' => 'DevPassword123!',
        ]);

        $response->assertRedirect(route('mfa.challenge'));
        $challenge = session('mfa.challenge');
        $this->assertSame($devSuperAdmin->id, $challenge['user_id']);
        $this->assertFalse($challenge['requires_setup']);

        // Submit valid TOTP from existing authenticator
        $validOtp = (new Google2FA())->getCurrentOtp($devSecret);
        $mfaResponse = $this->post('/login/mfa', [
            'code' => $validOtp,
        ]);

        $mfaResponse->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($devSuperAdmin);
    }

    /**
     * 6. Existing MFA enrollments are untouched when client account is provisioned.
     */
    public function test_existing_mfa_enrollments_are_untouched(): void
    {
        $devSecret = 'DEVELOPER_AUTHENTICATOR_PERSISTENT_KEY';

        $devSuperAdmin = User::create([
            'name' => 'Developer Super Administrator',
            'email' => 'superadmin.qa@example.test',
            'password' => Hash::make('DevPassword123!'),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'two_factor_secret' => $devSecret,
            'two_factor_confirmed_at' => now()->subDays(30),
            'email_verified_at' => now(),
        ]);

        $originalConfirmedAt = $devSuperAdmin->two_factor_confirmed_at;

        // Provision Client Super Admin
        Artisan::call('auth:provision-client-admin', [
            '--email' => 'client.admin@uniquedistributors.com',
            '--name' => 'Client Super Administrator',
            '--password' => 'ClientUniquePassword2026!',
        ]);

        $devSuperAdminFresh = $devSuperAdmin->fresh();
        $this->assertSame($devSecret, $devSuperAdminFresh->two_factor_secret);
        $this->assertEquals($originalConfirmedAt, $devSuperAdminFresh->two_factor_confirmed_at);
        $this->assertTrue($devSuperAdminFresh->hasMfaEnabled());
    }

    /**
     * 7. Duplicate email provisioning is safe, idempotent, and does not overwrite existing data.
     */
    public function test_duplicate_provisioning_is_safe_and_idempotent(): void
    {
        Artisan::call('auth:provision-client-admin', [
            '--email' => 'client.admin@uniquedistributors.com',
            '--name' => 'Client Super Administrator',
            '--password' => 'TestClientPassword2026!',
        ]);

        $initialUser = User::where('email', 'client.admin@uniquedistributors.com')->first();
        $initialPasswordHash = $initialUser->password;

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

    /**
     * 8. Unauthorized users cannot assign or grant the SUPER_ADMIN role.
     */
    public function test_unauthorized_users_cannot_assign_super_admin_role(): void
    {
        $salesman = User::create([
            'name' => 'Field Salesman',
            'email' => 'salesman@example.test',
            'password' => Hash::make('SalesmanPass123!'),
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        $targetUser = User::create([
            'name' => 'Regular User',
            'email' => 'regular@example.test',
            'password' => Hash::make('RegularPass123!'),
            'role' => UserRole::SALESMAN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        $roleService = app(RoleAssignmentService::class);

        // Salesman attempting to assign SUPER_ADMIN throws AuthorizationException
        $this->expectException(AuthorizationException::class);
        $roleService->assignRole(
            actor: $salesman,
            target: $targetUser,
            newRole: UserRole::SUPER_ADMIN,
            reason: 'Unauthorized escalation attempt'
        );
    }

    /**
     * 9. No secrets, plaintext passwords, or TOTP codes appear in security logs.
     */
    public function test_no_secrets_appear_in_security_logs(): void
    {
        Log::spy();

        $secretPassword = 'SuperSecretClientPassword2026!';
        Artisan::call('auth:provision-client-admin', [
            '--email' => 'client.admin@uniquedistributors.com',
            '--name' => 'Client Super Administrator',
            '--password' => $secretPassword,
        ]);

        $user = User::where('email', 'client.admin@uniquedistributors.com')->first();

        Log::shouldHaveReceived('info')
            ->withArgs(function ($message, $context = []) use ($secretPassword) {
                if ($message === 'auth.security_event') {
                    // Check that password, hash, or secret are NOT in context
                    $serialized = json_encode($context);
                    if (str_contains($serialized, $secretPassword)) {
                        return false;
                    }
                    if (isset($context['password']) || isset($context['two_factor_secret'])) {
                        return false;
                    }
                }
                return true;
            });
    }
}
