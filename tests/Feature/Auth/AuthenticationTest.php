<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * AUTH-001: The login screen can be rendered.
     */
    public function test_login_screen_can_be_rendered(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Login')
        );
    }

    /**
     * AUTH-002: Users can authenticate using the login screen.
     */
    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $user = User::factory()->create([
            'email' => 'alex@wdms.local',
            'password' => 'secret123',
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->post('/login', [
            'email' => 'alex@wdms.local',
            'password' => 'secret123',
        ]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect('/');
    }

    /**
     * AUTH-003: Users cannot authenticate with an invalid password.
     */
    public function test_users_cannot_authenticate_with_invalid_password(): void
    {
        User::factory()->create([
            'email' => 'alex@wdms.local',
            'password' => 'secret123',
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->post('/login', [
            'email' => 'alex@wdms.local',
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors(['email' => trans('auth.failed')]);
    }

    /**
     * AUTH-004: Authentication failure does not reveal account existence (anti-enumeration).
     */
    public function test_authentication_failure_does_not_reveal_account_existence(): void
    {
        // Existing user with wrong password
        User::factory()->create([
            'email' => 'existing@wdms.local',
            'password' => 'secret123',
            'status' => AccountStatus::ACTIVE,
        ]);

        $responseExisting = $this->post('/login', [
            'email' => 'existing@wdms.local',
            'password' => 'wrong-password',
        ]);

        // Non-existent user
        $responseNonExistent = $this->post('/login', [
            'email' => 'nonexistent@wdms.local',
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();

        // Both responses must assert the exact same error message
        $responseExisting->assertSessionHasErrors(['email' => trans('auth.failed')]);
        $responseNonExistent->assertSessionHasErrors(['email' => trans('auth.failed')]);
    }

    /**
     * AUTH-005: Login attempts are rate limited after 5 failed attempts.
     */
    public function test_login_attempts_are_rate_limited(): void
    {
        $email = 'rate-limited-' . Str::random(8) . '@wdms.local';

        for ($i = 0; $i < 5; $i++) {
            $response = $this->post('/login', [
                'email' => $email,
                'password' => 'wrong-password',
            ]);
            $response->assertSessionHasErrors('email');
        }

        // 6th attempt should be throttled
        $response = $this->post('/login', [
            'email' => $email,
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(429);

        // JSON request should return HTTP 429
        $jsonResponse = $this->postJson('/login', [
            'email' => $email,
            'password' => 'wrong-password',
        ]);

        $jsonResponse->assertStatus(429);
        $this->assertGuest();
    }

    /**
     * AUTH-006: Throttling cannot be bypassed by trivial input casing.
     */
    public function test_throttling_cannot_be_bypassed_by_input_casing(): void
    {
        $base = 'case-test-' . Str::random(8);
        $lowerEmail = strtolower($base) . '@wdms.local';
        $upperEmail = strtoupper($base) . '@WDMS.LOCAL';

        for ($i = 0; $i < 5; $i++) {
            $this->post('/login', [
                'email' => $lowerEmail,
                'password' => 'wrong-password',
            ]);
        }

        // Attempting with uppercase variation hits the same throttle key
        $response = $this->post('/login', [
            'email' => $upperEmail,
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(429);
    }

    /**
     * AUTH-007: Active user can authenticate successfully.
     */
    public function test_active_user_can_authenticate(): void
    {
        $user = User::factory()->create([
            'email' => 'active@wdms.local',
            'password' => 'secret123',
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->post('/login', [
            'email' => 'active@wdms.local',
            'password' => 'secret123',
        ]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect('/');
    }

    /**
     * AUTH-008: Suspended user cannot authenticate.
     */
    public function test_suspended_user_cannot_authenticate(): void
    {
        User::factory()->suspended()->create([
            'email' => 'suspended@wdms.local',
            'password' => 'secret123',
        ]);

        $response = $this->post('/login', [
            'email' => 'suspended@wdms.local',
            'password' => 'secret123',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors(['email' => trans('auth.unavailable')]);
    }

    /**
     * AUTH-009: Disabled user cannot authenticate.
     */
    public function test_disabled_user_cannot_authenticate(): void
    {
        User::factory()->disabled()->create([
            'email' => 'disabled@wdms.local',
            'password' => 'secret123',
        ]);

        $response = $this->post('/login', [
            'email' => 'disabled@wdms.local',
            'password' => 'secret123',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors(['email' => trans('auth.unavailable')]);
    }

    /**
     * AUTH-010: Invited user cannot authenticate before completing activation.
     */
    public function test_invited_user_cannot_authenticate(): void
    {
        User::factory()->invited()->create([
            'email' => 'invited@wdms.local',
            'password' => 'secret123',
        ]);

        $response = $this->post('/login', [
            'email' => 'invited@wdms.local',
            'password' => 'secret123',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors(['email' => trans('auth.unavailable')]);
    }

    /**
     * AUTH-011: Session ID is regenerated after successful login (session fixation protection).
     */
    public function test_session_id_is_regenerated_after_successful_login(): void
    {
        User::factory()->create([
            'email' => 'session-test@wdms.local',
            'password' => 'secret123',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->get('/login');
        $initialSessionId = session()->getId();

        $this->post('/login', [
            'email' => 'session-test@wdms.local',
            'password' => 'secret123',
        ]);

        $this->assertNotEquals($initialSessionId, session()->getId());
    }

    /**
     * AUTH-012: Users can logout, invalidating the session.
     */
    public function test_users_can_logout(): void
    {
        $user = User::factory()->create([
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/login');
    }

    /**
     * AUTH-013: Only safe identity fields are shared through Inertia; password/hash is never exposed.
     */
    public function test_safe_identity_is_shared_with_inertia(): void
    {
        $user = User::factory()->create([
            'name' => 'Jane Distribution',
            'email' => 'jane@wdms.local',
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->actingAs($user)->get('/dashboard');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->has('auth.user', fn (Assert $auth) => $auth
                ->where('id', $user->id)
                ->where('name', 'Jane Distribution')
                ->where('email', 'jane@wdms.local')
                ->where('role', null)
                ->where('status', 'ACTIVE')
                ->where('permissions', [])
                ->missing('password')
                ->missing('remember_token')
            )
        );
    }

    /**
     * AUTH-014: Unauthenticated access to protected area is redirected to login.
     */
    public function test_unauthenticated_requests_to_protected_route_are_redirected(): void
    {
        $response = $this->get('/dashboard');

        $response->assertRedirect('/login');
    }

    /**
     * AUTH-015: Active user suspended mid-session is immediately logged out on next request.
     */
    public function test_user_suspended_during_active_session_loses_access(): void
    {
        $user = User::factory()->create([
            'status' => AccountStatus::ACTIVE,
        ]);

        // User is logged in and accesses dashboard
        $response = $this->actingAs($user)->get('/dashboard');
        $response->assertStatus(200);

        // Account status changed to SUSPENDED in database
        $user->status = AccountStatus::SUSPENDED;
        $user->save();

        // Next request triggers EnsureAccountIsActive middleware
        $response = $this->get('/dashboard');

        $this->assertGuest();
        $response->assertRedirect('/login');
        $response->assertSessionHasErrors('email');
    }

    /**
     * AUTH-016: Privileged user transitions to MFA challenge during authentication.
     */
    public function test_privileged_user_transitions_to_mfa_challenge(): void
    {
        $admin = User::factory()->create([
            'email' => 'privileged-admin@wdms.local',
            'password' => 'secret123',
            'role' => \App\Enums\UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->post('/login', [
            'email' => 'privileged-admin@wdms.local',
            'password' => 'secret123',
        ]);

        $response->assertRedirect(route('mfa.challenge'));
        $this->assertTrue(session()->has('mfa.challenge'));
        $challenge = session()->get('mfa.challenge');
        $this->assertEquals($admin->id, $challenge['user_id']);
    }
}
