<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ReadyCheckController extends Controller
{
    /**
     * Perform deep infrastructure readiness diagnostics (PostgreSQL, Redis, S3).
     * Returns 200 when all essential dependencies are reachable; 503 when degraded.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $status = 'ready';
        $dependencies = [];

        // 1. PostgreSQL Database Readiness
        try {
            DB::connection()->getPdo();
            $driver = DB::connection()->getDriverName();
            $dependencies['database'] = [
                'status' => 'ready',
                'driver' => $driver,
            ];
        } catch (Throwable $e) {
            $status = 'not_ready';
            $dependencies['database'] = [
                'status' => 'unavailable',
                'message' => 'Database connection unavailable',
            ];
            Log::warning('Readiness check: Database connection unavailable', ['error' => $e->getMessage()]);
        }

        // 2. Redis Cache & Session Store Readiness
        try {
            $redis = Redis::connection();
            $ping = (string) $redis->ping();
            $isRedisOk = ($ping === 'PONG' || $ping === '+PONG' || $ping === '1');

            $dependencies['redis'] = [
                'status' => $isRedisOk ? 'ready' : 'unavailable',
            ];

            if (! $isRedisOk) {
                $status = 'not_ready';
            }
        } catch (Throwable $e) {
            $status = 'not_ready';
            $dependencies['redis'] = [
                'status' => 'unavailable',
                'message' => 'Redis connection unavailable',
            ];
            Log::warning('Readiness check: Redis connection unavailable', ['error' => $e->getMessage()]);
        }

        // 3. AWS S3 Storage Readiness (if s3 is default filesystem)
        $defaultDisk = config('filesystems.default');
        if ($defaultDisk === 's3') {
            try {
                $bucket = config('filesystems.disks.s3.bucket');
                $isConfigured = ! empty(config('filesystems.disks.s3.key')) && ! empty($bucket);

                $dependencies['storage'] = [
                    'status' => $isConfigured ? 'ready' : 'degraded',
                    'disk' => 's3',
                ];

                if (! $isConfigured) {
                    $status = 'not_ready';
                }
            } catch (Throwable $e) {
                $status = 'not_ready';
                $dependencies['storage'] = [
                    'status' => 'unavailable',
                    'message' => 'Storage configuration error',
                ];
                Log::warning('Readiness check: Storage check failed', ['error' => $e->getMessage()]);
            }
        } else {
            $dependencies['storage'] = [
                'status' => 'ready',
                'disk' => $defaultDisk,
            ];
        }

        $httpCode = ($status === 'ready') ? 200 : 503;

        return response()->json([
            'status' => $status,
            'timestamp' => now()->toIso8601String(),
            'dependencies' => $dependencies,
        ], $httpCode);
    }
}
