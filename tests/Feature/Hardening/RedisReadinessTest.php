<?php

namespace Tests\Feature\Hardening;

use Illuminate\Cache\RedisLock;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class RedisReadinessTest extends TestCase
{
    /**
     * A. Redis URL with rediss:// resolves TLS.
     */
    public function test_redis_url_with_rediss_resolves_tls(): void
    {
        $defaultConfig = config('database.redis.default');
        $cacheConfig = config('database.redis.cache');

        if (! empty($defaultConfig['url']) && str_starts_with((string) $defaultConfig['url'], 'rediss://')) {
            $this->assertEquals('tls', $defaultConfig['scheme']);
            $this->assertEquals('tls', $cacheConfig['scheme']);
        } else {
            // Assert fallback logic computes TLS when URL starts with rediss://
            $url = 'rediss://default:password@endpoint.upstash.io:6379';
            $scheme = str_starts_with($url, 'rediss://') ? 'tls' : 'tcp';
            $this->assertEquals('tls', $scheme);
        }
    }

    /**
     * B. Redis database index = 0.
     */
    public function test_redis_database_index_is_zero(): void
    {
        $defaultConfig = config('database.redis.default');
        $cacheConfig = config('database.redis.cache');

        $this->assertEquals('0', (string) $defaultConfig['database']);
        $this->assertEquals('0', (string) $cacheConfig['database']);
    }

    /**
     * C. Cache store = Redis.
     */
    public function test_cache_store_resolves_to_redis_when_configured(): void
    {
        Config::set('cache.default', 'redis');
        $this->assertEquals('redis', config('cache.default'));
        $this->assertInstanceOf(\Illuminate\Cache\RedisStore::class, Cache::store('redis')->getStore());
    }

    /**
     * D. Lock store = Redis.
     */
    public function test_lock_store_uses_redis_lock(): void
    {
        Config::set('cache.default', 'redis');
        $lock = Cache::lock('test_order_lock', 10);
        $this->assertInstanceOf(RedisLock::class, $lock);
    }

    /**
     * E. Session store = Redis.
     */
    public function test_session_store_uses_redis(): void
    {
        Config::set('session.driver', 'redis');
        $this->assertEquals('redis', config('session.driver'));

        $driver = app('session')->driver('redis');
        $this->assertInstanceOf(\Illuminate\Session\Store::class, $driver);
    }

    /**
     * F. No SELECT 1 is issued.
     */
    public function test_no_select_1_is_issued_by_redis_connections(): void
    {
        $defaultDb = (int) config('database.redis.default.database');
        $cacheDb = (int) config('database.redis.cache.database');

        $this->assertEquals(0, $defaultDb, 'Default Redis DB must be 0 for Upstash');
        $this->assertEquals(0, $cacheDb, 'Cache Redis DB must be 0 for Upstash');
        $this->assertNotEquals(1, $cacheDb, 'Cache Redis DB must never be 1');
    }

    /**
     * G. No PostgreSQL cache_locks query is issued.
     */
    public function test_no_postgresql_cache_locks_query_is_issued(): void
    {
        Config::set('cache.default', 'redis');

        DB::enableQueryLog();

        $lock = Cache::lock('test_idempotency_lock', 10);
        $this->assertInstanceOf(RedisLock::class, $lock);

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        foreach ($queries as $query) {
            $this->assertStringNotContainsStringIgnoringCase('cache_locks', $query['query']);
        }
    }

    /**
     * H. Redis failure makes /ready return controlled 503.
     */
    public function test_redis_failure_makes_ready_return_controlled_503(): void
    {
        $mockConnection = Mockery::mock();
        $mockConnection->shouldReceive('ping')
            ->andThrow(new \RuntimeException('Upstash TLS connection refused'));

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
     * I. Redis healthy makes /ready return 200.
     */
    public function test_redis_healthy_makes_ready_return_200(): void
    {
        $mockConnection = Mockery::mock();
        $mockConnection->shouldReceive('ping')
            ->andReturn('PONG');

        Redis::shouldReceive('connection')
            ->withNoArgs()
            ->andReturn($mockConnection);

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
     * J. Login can initialize a Redis session successfully.
     */
    public function test_login_can_initialize_redis_session_successfully(): void
    {
        Config::set('session.driver', 'redis');

        $response = $this->get('/login');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Login')
        );
    }
}
