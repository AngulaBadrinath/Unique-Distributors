<?php

namespace Tests\Support;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    /**
     * Authenticate as a specific role user.
     */
    protected function authenticateRole(string|\App\Enums\UserRole $role): User
    {
        $roleEnum = is_string($role) ? \App\Enums\UserRole::tryFrom($role) ?? \App\Enums\UserRole::from($role) : $role;
        $user = User::factory()->create([
            'role' => $roleEnum,
            'status' => \App\Enums\AccountStatus::ACTIVE,
        ]);

        $this->actingAs($user);

        return $user;
    }

    /**
     * Assert route is strictly protected against unauthenticated guests.
     */
    protected function assertGuestRedirected(string $uri, string $method = 'GET', array $data = []): void
    {
        $response = $this->json($method, $uri, $data);
        $this->assertTrue(
            $response->status() === 401 || $response->isRedirect('/login') || $response->status() === 302,
            "Failed asserting that {$method} {$uri} redirected or returned 401. Received status: {$response->status()}"
        );
    }

    /**
     * Assert route returns 403 Forbidden for unauthorized role.
     */
    protected function assertRoleForbidden(User $user, string $method, string $uri, array $data = []): void
    {
        $response = $this->actingAs($user)->json($method, $uri, $data);
        $response->assertForbidden();
    }
}
