<?php

namespace App\Console\Commands;

use App\Services\Demo\DemoDataGeneratorService;
use Database\Seeders\ManualTestingSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\App;

class DemoDataSeedCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'demo:seed
                            {--fresh : Refresh database migrations before seeding}
                            {--with-images : Generate and upload synthetic product images and operational evidence}
                            {--disk=s3 : Target storage disk for demo assets (s3 or local)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Seed pre-production / testing demo data with synthetic catalogue, accounts, and storage assets';

    /**
     * Execute the console command.
     */
    public function handle(DemoDataGeneratorService $demoGenerator): int
    {
        // 1. Mandatory Environment Safety Guard
        if (App::environment('production')) {
            $this->error('CRITICAL SAFETY VIOLATION: demo:seed is strictly prohibited in production environments.');

            return 1;
        }

        $this->info('Starting Wholesale Distribution Demo Data Seeding...');

        if ($this->option('fresh')) {
            $this->warn('Running migrate:fresh...');
            $this->call('migrate:fresh', ['--force' => true]);
        }

        $this->info('Running ManualTestingSeeder...');
        $this->call('db:seed', [
            '--class' => ManualTestingSeeder::class,
            '--force' => true,
        ]);

        if ($this->option('with-images')) {
            $disk = $this->option('disk') ?: 's3';
            $this->info("Generating and uploading synthetic catalogue images to disk [{$disk}]...");
            $imgCount = $demoGenerator->seedProductImages($disk);
            $this->info("Seeded {$imgCount} product catalogue images.");

            $this->info("Generating operational evidence (payments, deliveries) to disk [{$disk}]...");
            $evCounts = $demoGenerator->seedOperationalEvidence($disk);
            $this->info("Seeded {$evCounts['payments']} payment evidence objects and {$evCounts['deliveries']} delivery signatures/PODs.");
        }

        $this->info('Wholesale Distribution demo dataset successfully prepared.');

        return 0;
    }
}
