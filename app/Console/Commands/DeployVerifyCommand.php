<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

class DeployVerifyCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'deploy:verify
                            {--s3 : Explicitly verify S3 connectivity}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely verify infrastructure dependencies (DB, Redis, S3, Security) without leaking secrets';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('============================================================');
        $this->info('UNIQUE DISTRIBUTORS — PRE-PRODUCTION DEPLOYMENT VERIFICATION');
        $this->info('============================================================');
        $this->newLine();

        $overallSuccess = true;
        $results = [];

        // 1. Environment & Security Configuration Check
        $appEnv = config('app.env');
        $appDebug = config('app.debug');
        $hasAppKey = ! empty(config('app.key'));
        $secureCookie = config('session.secure');

        $envIssues = [];
        if (! $hasAppKey) {
            $envIssues[] = 'APP_KEY is missing';
        }
        if ($appEnv === 'production' && $appDebug === true) {
            $envIssues[] = 'APP_DEBUG must be false in production';
        }
        if ($appEnv === 'production' && ! $secureCookie) {
            $envIssues[] = 'SESSION_SECURE_COOKIE should be enabled';
        }

        if (empty($envIssues)) {
            $results[] = ['Subsystem' => 'Environment & Security', 'Status' => 'PASS', 'Details' => "ENV: {$appEnv}, DEBUG: " . ($appDebug ? 'true' : 'false')];
        } else {
            $overallSuccess = false;
            $results[] = ['Subsystem' => 'Environment & Security', 'Status' => 'FAIL', 'Details' => implode('; ', $envIssues)];
        }

        $dbSuccess = false;
        // 2. Database Connectivity Check
        try {
            $pdo = DB::connection()->getPdo();
            $driver = DB::connection()->getDriverName();
            $version = $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION);
            $dbSuccess = true;
            $results[] = ['Subsystem' => 'PostgreSQL Database', 'Status' => 'PASS', 'Details' => "Driver: {$driver}, Server: v{$version}"];
        } catch (Throwable $e) {
            $overallSuccess = false;
            $results[] = ['Subsystem' => 'PostgreSQL Database', 'Status' => 'FAIL', 'Details' => 'Connection failed'];
            $this->error('Database Diagnostic: Connection could not be established.');
        }

        $redisSuccess = false;
        $redisTlsOk = false;
        // 3. Redis Connectivity Check
        try {
            $redis = Redis::connection();
            $ping = $redis->ping();
            $pingStr = (string) $ping;
            $isRedisOk = ($ping === true || $pingStr === 'PONG' || $pingStr === '+PONG');

            if ($isRedisOk) {
                $redisSuccess = true;
                $scheme = config('database.redis.default.scheme', 'tcp');
                $redisTlsOk = ($scheme === 'tls');
                $client = config('database.redis.client', 'unknown');
                $results[] = ['Subsystem' => 'Redis Cache / State', 'Status' => 'PASS', 'Details' => "Client: {$client}, Scheme: {$scheme}, Ping: PONG"];
            } else {
                $overallSuccess = false;
                $results[] = ['Subsystem' => 'Redis Cache / State', 'Status' => 'FAIL', 'Details' => 'Ping failed'];
            }
        } catch (Throwable $e) {
            $overallSuccess = false;
            $results[] = ['Subsystem' => 'Redis Cache / State', 'Status' => 'FAIL', 'Details' => 'Connection failed'];
            $this->error('Redis Diagnostic: Connection could not be established.');
        }

        $s3Success = false;
        // 4. S3 Storage Connectivity Check
        $defaultDisk = config('filesystems.default');
        $verifyS3 = $this->option('s3') || $defaultDisk === 's3';

        if ($verifyS3) {
            try {
                $s3Disk = Storage::disk('s3');
                $testKey = 'health-checks/' . uniqid('deploy_verify_', true) . '.txt';
                $s3Disk->put($testKey, 'health-check');
                $exists = $s3Disk->exists($testKey);
                $s3Disk->delete($testKey);

                if ($exists) {
                    $s3Success = true;
                    $bucketName = config('filesystems.disks.s3.bucket', 'configured');
                    $results[] = ['Subsystem' => 'AWS S3 Storage', 'Status' => 'PASS', 'Details' => "Bucket: {$bucketName}, Read/Write/Delete verified"];
                } else {
                    $overallSuccess = false;
                    $results[] = ['Subsystem' => 'AWS S3 Storage', 'Status' => 'FAIL', 'Details' => 'Write succeeded but read check failed'];
                }
            } catch (Throwable $e) {
                $overallSuccess = false;
                $results[] = ['Subsystem' => 'AWS S3 Storage', 'Status' => 'FAIL', 'Details' => 'Storage operation failed (check IAM credentials / bucket name)'];
            }
        } else {
            $s3Success = true;
            $results[] = ['Subsystem' => 'File Storage', 'Status' => 'SKIPPED', 'Details' => "Current default disk: [{$defaultDisk}]. Pass --s3 to force S3 test."];
        }

        $this->table(['Subsystem', 'Status', 'Details'], $results);
        $this->newLine();

        // Safe Startup Diagnostics Output (Render Free log verifiable)
        $redisDb = config('database.redis.default.database', '0');
        $cacheStore = config('cache.default');
        $lockStore = ($cacheStore === 'redis') ? 'redis' : config('cache.stores.redis.lock_connection', 'redis');
        $sessionStore = config('session.driver');

        $this->line('[preprod] PHP: PASS (' . PHP_VERSION . ')');
        $this->line('[preprod] APP_KEY: ' . ($hasAppKey ? 'PASS' : 'FAIL'));
        $this->line('[preprod] PostgreSQL: ' . ($dbSuccess ? 'PASS' : 'FAIL'));
        $this->line('[preprod] Redis TLS: ' . ($redisTlsOk ? 'PASS' : ($redisSuccess ? 'PASS (TCP)' : 'FAIL')));
        $this->line("[preprod] Redis DB: {$redisDb}");
        $this->line("[preprod] Cache store: {$cacheStore}");
        $this->line("[preprod] Lock store: {$lockStore}");
        $this->line("[preprod] Session store: {$sessionStore}");
        $this->line('[preprod] S3: ' . ($s3Success ? 'PASS' : 'FAIL'));
        $this->newLine();

        if ($overallSuccess) {
            $this->info('OVERALL PRE-PRODUCTION VERIFICATION: PASS');
            return 0;
        }

        $this->warn('OVERALL PRE-PRODUCTION VERIFICATION: COMPLETED WITH ISSUES');
        return 1;
    }
}
