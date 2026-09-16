<?php

namespace Database\Seeders;

use App\Enums\AccountStatus;
use App\Enums\CategoryStatus;
use App\Enums\TaxProfileStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PreproductionSeeder extends Seeder
{
    /**
     * Run the safe, non-destructive pre-production base seeds.
     */
    public function run(): void
    {
        // 1. Resolve or Seed Default Warehouse
        $warehouse = Warehouse::where('is_default', true)->first();
        if (! $warehouse) {
            Warehouse::create([
                'code' => 'WH-MAIN',
                'name' => 'Primary Distribution Facility',
                'address_line1' => '100 Distribution Way',
                'city' => 'Metropolis',
                'state' => 'NY',
                'postal_code' => '10001',
                'country_code' => 'US',
                'contact_name' => 'Operations Manager',
                'contact_phone' => '+1 (555) 010-2000',
                'contact_email' => 'operations@uniquedistributors.com',
                'is_active' => true,
                'is_default' => true,
            ]);
        }

        // 2. Seed Base Tax Profiles
        TaxProfile::updateOrCreate(
            ['code' => 'TAX-STD-10'],
            [
                'name' => 'Standard Wholesale Tax (10%)',
                'rate' => 10.0000,
                'description' => 'Standard rate applicable to general wholesale lines.',
                'status' => TaxProfileStatus::ACTIVE,
            ]
        );

        TaxProfile::updateOrCreate(
            ['code' => 'TAX-RED-5'],
            [
                'name' => 'Reduced Rate Concession (5%)',
                'rate' => 5.0000,
                'description' => 'Reduced rate for essential goods.',
                'status' => TaxProfileStatus::ACTIVE,
            ]
        );

        TaxProfile::updateOrCreate(
            ['code' => 'TAX-ZERO-0'],
            [
                'name' => 'Tax Exempt / Zero Rate (0%)',
                'rate' => 0.0000,
                'description' => 'Exempt line items and inter-state tax-exempt wholesale.',
                'status' => TaxProfileStatus::ACTIVE,
            ]
        );

        // 3. Seed Standard Product Categories
        $baseCategories = [
            ['name' => 'Beverages', 'code' => 'CAT-BEV', 'description' => 'Commercial soft drinks, mineral waters, juices'],
            ['name' => 'Dry Groceries', 'code' => 'CAT-DRY', 'description' => 'Bulk grains, flours, sugars, staple dry ingredients'],
            ['name' => 'Canned Goods', 'code' => 'CAT-CAN', 'description' => 'Preserved fruits, vegetables, pulses'],
            ['name' => 'Confectionery', 'code' => 'CAT-CONF', 'description' => 'Snacks, chocolates, bulk sweets'],
        ];

        foreach ($baseCategories as $cat) {
            Category::updateOrCreate(
                ['code' => $cat['code']],
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'status' => CategoryStatus::ACTIVE,
                ]
            );
        }

        // 4. Seed Initial Pre-Production Administrator
        $adminEmail = env('PREPROD_ADMIN_EMAIL', 'admin@uniquedistributors.com');
        $adminPassword = env('PREPROD_ADMIN_PASSWORD', 'AdminSecure2026!');

        User::updateOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'Pre-Production Super Administrator',
                'password' => Hash::make($adminPassword),
                'role' => UserRole::SUPER_ADMIN,
                'status' => AccountStatus::ACTIVE,
                'email_verified_at' => now(),
            ]
        );

        // 4b. Seed Client Super Administrator (Independent Client Account)
        $clientAdminEmail = env('PREPROD_CLIENT_ADMIN_EMAIL', 'client.admin@uniquedistributors.com');
        $clientAdminPassword = env('PREPROD_CLIENT_ADMIN_PASSWORD', 'ClientAdminSecure2026!');

        User::firstOrCreate(
            ['email' => $clientAdminEmail],
            [
                'name' => 'Client Super Administrator',
                'password' => Hash::make($clientAdminPassword),
                'role' => UserRole::SUPER_ADMIN,
                'status' => AccountStatus::ACTIVE,
                'email_verified_at' => now(),
            ]
        );

        // 5. Seed Initial Pre-Production Sales Representative (Standard Non-Privileged Flow)
        $salesmanEmail = env('PREPROD_SALESMAN_EMAIL', 'salesman@uniquedistributors.com');
        $salesmanPassword = env('PREPROD_SALESMAN_PASSWORD', 'SalesmanSecure2026!');

        User::updateOrCreate(
            ['email' => $salesmanEmail],
            [
                'name' => 'Pre-Production Sales Representative',
                'password' => Hash::make($salesmanPassword),
                'role' => UserRole::SALESMAN,
                'status' => AccountStatus::ACTIVE,
                'email_verified_at' => now(),
            ]
        );

        // 6. Seed QA Manual Test Accounts (Documented in docs/MANUAL_TEST_CREDENTIALS.md)
        $qaPassword = env('PREPROD_QA_PASSWORD', 'Password123!');

        $qaAccounts = [
            [
                'email' => 'superadmin.qa@example.test',
                'name' => 'Super Administrator (QA)',
                'role' => UserRole::SUPER_ADMIN,
                'status' => AccountStatus::ACTIVE,
            ],
            [
                'email' => 'admin.qa@example.test',
                'name' => 'Operations Administrator (QA)',
                'role' => UserRole::ADMIN,
                'status' => AccountStatus::ACTIVE,
            ],
            [
                'email' => 'accountant.qa@example.test',
                'name' => 'Senior Accountant (QA)',
                'role' => UserRole::ACCOUNTANT,
                'status' => AccountStatus::ACTIVE,
            ],
            [
                'email' => 'salesman.a@example.test',
                'name' => 'Sales Executive A (North)',
                'role' => UserRole::SALESMAN,
                'status' => AccountStatus::ACTIVE,
            ],
            [
                'email' => 'salesman.b@example.test',
                'name' => 'Sales Executive B (South)',
                'role' => UserRole::SALESMAN,
                'status' => AccountStatus::ACTIVE,
            ],
            [
                'email' => 'warehouse.qa@example.test',
                'name' => 'Warehouse Dispatch Manager (QA)',
                'role' => UserRole::WAREHOUSE_MANAGER,
                'status' => AccountStatus::ACTIVE,
            ],
            [
                'email' => 'driver.qa@example.test',
                'name' => 'Delivery Driver Partner (QA)',
                'role' => UserRole::DELIVERY_PARTNER,
                'status' => AccountStatus::ACTIVE,
            ],
            [
                'email' => 'suspended.qa@example.test',
                'name' => 'Terminated Representative (QA)',
                'role' => UserRole::SALESMAN,
                'status' => AccountStatus::SUSPENDED,
            ],
        ];

        foreach ($qaAccounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => Hash::make($qaPassword),
                    'role' => $account['role'],
                    'status' => $account['status'],
                    'email_verified_at' => now(),
                ]
            );
        }
    }
}
