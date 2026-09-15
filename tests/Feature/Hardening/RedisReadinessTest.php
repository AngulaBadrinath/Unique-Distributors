<?php

namespace Tests\Feature\Hardening;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Redis;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class RedisReadinessTest extends TestCase
{
    /**
     * 1. Test that Redis configuration sets tls scheme for rediss:// URLs and defaults to DB 0 (Upstash compatible).
     */
    public function test_redis_configuration_resolves_tls_scheme_for_rediss_urls(): void
    {
        // Assert current configuration defaults
        $defaultConfig = config('database.redis.default');
        $cacheConfig = config('database.redis.cache');

        $this->assertEquals('0', (string) $defaultConfig['database']);
        $this->assertEquals('0', (string) $cacheConfig['database']);

        // Assert rediss:// URL resolves scheme to tls
        if (! empty($defaultConfig['url']) && str_starts_with((string) $defaultConfig['url'], 'rediss://')) {
            $this->assertEquals('tls', $defaultConfig['scheme']);
            $this->assertEquals('tls', $cacheConfig['scheme']);
        }
    }

    /**
     * 2. Test that Redis connectivity failure produces controlled readiness 503.
     */
    public function test_redis_connectivity_failure_produces_controlled_readiness_503(): void
    {
        $mockConnection = Mockery::mock();
        $mockConnection->shouldReceive('ping')
            ->andThrow(new \RuntimeException('Connection refused / TLS handshake error'));

        Redis::shouldReceive('connection')
            ->withNoArgs()
            ->andReturn($mockConnection);

        $response = $this->getJson('/ready');

        $response->assertStatus(503);
        $response->assertJson([
            'status' => 'not_ready',
            'dependencies' => [
                'redis' => [
                    'status' => 'unavailable',
                    'message' => 'Redis connection unavailable',
                ],
            ],
        ]);
    }

    /**
     * 3. Test that Redis connectivity success produces readiness 200.
     */
    public function test_redis_connectivity_success_produces_readiness_200(): void
    {
        // Mock Redis ping to return PONG
        $mockConnection = Mockery::mock();
        $mockConnection->shouldReceive('ping')
            ->andReturn('PONG');

        Redis::shouldReceive('connection')
            ->withNoArgs()
            ->andReturn($mockConnection);

        // Ensure storage check passes if s3 is configured in environment
        Config::set('filesystems.default', 'local');

        $response = $this->getJson('/ready');

        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'ready',
            'dependencies' => [
                'database' => [
                    'status' => 'ready',
                ],
                'redis' => [
                    'status' => 'ready',
                ],
                'storage' => [
                    'status' => 'ready',
                ],
            ],
        ]);
    }

    /**
     * 4. Test that missing Redis is treated as a real deployment dependency failure.
     */
    public function test_missing_redis_is_treated_as_deployment_readiness_failure(): void
    {
        $mockConnection = Mockery::mock();
        $mockConnection->shouldReceive('ping')
            ->andReturn(false); // Returns unsuccessful ping status

        Redis::shouldReceive('connection')
            ->withNoArgs()
            ->andReturn($mockConnection);

        $response = $this->getJson('/ready');

        $response->assertStatus(503);
        $response->assertJson([
            'status' => 'not_ready',
            'dependencies' => [
                'redis' => [
                    'status' => 'unavailable',
                ],
            ],
        ]);
    }

    /**
     * 5. Test that login/session initialization does not crash when Redis is properly configured.
     */
    public function test_login_renders_successfully_with_redis_session_configuration(): void
    {
        // Live Upstash Redis connection is configured in the environment
        Config::set('session.driver', 'redis');

        $response = $this->get('/login');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Login')
        );
    }
}
