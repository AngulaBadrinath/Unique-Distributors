<?php

namespace App\Services\System;

use App\DTOs\System\CompanyInformationData;
use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Models\CompanyInformation;
use App\Models\User;
use App\Services\Auth\PermissionService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CompanyInformationService
{
    /**
     * Request-local memory cache.
     */
    protected static ?CompanyInformation $cachedInstance = null;

    public function __construct(
        protected PermissionService $permissionService
    ) {}

    /**
     * Retrieve the authoritative singleton CompanyInformation instance.
     */
    public function get(): CompanyInformation
    {
        if (self::$cachedInstance !== null) {
            return self::$cachedInstance;
        }

        try {
            /** @var CompanyInformation|null $instance */
            $instance = CompanyInformation::query()
                ->where('is_singleton', true)
                ->first();

            if (! $instance) {
                $instance = CompanyInformation::create([
                    'legal_name' => 'Unique Distributors Inc.',
                    'dba_name' => 'Unique Distributors',
                    'address_line1' => '100 Distribution Blvd',
                    'address_line2' => 'Suite 400',
                    'city' => 'Atlanta',
                    'state' => 'GA',
                    'postal_code' => '30301',
                    'country' => 'US',
                    'phone' => '+1 (800) 555-0199',
                    'email' => 'support@example.com',
                    'website' => 'https://example.com',
                    'tax_id' => '12-3456789',
                    'state_tax_id' => 'GA-987654',
                    'currency' => 'USD',
                    'timezone' => 'America/New_York',
                    'invoice_footer_note' => 'Thank you for your business. Invoices are payable within 30 days.',
                    'is_singleton' => true,
                ]);
            }

            self::$cachedInstance = $instance;

            return $instance;
        } catch (\Throwable $e) {
            Log::warning('CompanyInformationService: database unavailable, falling back to default identity', [
                'error' => $e->getMessage(),
            ]);

            return new CompanyInformation([
                'legal_name' => 'Unique Distributors Inc.',
                'dba_name' => 'Unique Distributors',
                'address_line1' => '100 Distribution Blvd',
                'address_line2' => 'Suite 400',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country' => 'US',
                'phone' => '+1 (800) 555-0199',
                'email' => 'support@example.com',
                'website' => 'https://example.com',
                'tax_id' => '12-3456789',
                'state_tax_id' => 'GA-987654',
                'currency' => 'USD',
                'timezone' => 'America/New_York',
                'invoice_footer_note' => 'Thank you for your business. Invoices are payable within 30 days.',
                'is_singleton' => true,
            ]);
        }
    }

    /**
     * Clear request-local memory cache.
     */
    public static function clearCache(): void
    {
        self::$cachedInstance = null;
    }

    /**
     * Retrieve safe public company information for frontend presentation.
     *
     * @return array<string, mixed>
     */
    public function getPublicDetails(): array
    {
        return $this->get()->toPublicArray();
    }

    /**
     * Update the authoritative company information atomically.
     *
     * @throws AuthorizationException
     */
    public function update(CompanyInformationData $data, User $actor, ?string $ip = null): CompanyInformation
    {
        // 1. Account state validation: only active users may execute mutations
        $isActive = ($actor->status instanceof AccountStatus)
            ? $actor->status === AccountStatus::ACTIVE
            : $actor->status === AccountStatus::ACTIVE->value;

        if (! $isActive) {
            throw new AuthorizationException('Inactive accounts are not authorized to update company information.');
        }

        // 2. Authorization check: requires role.manage permission
        $this->permissionService->authorize($actor, Permission::ROLE_MANAGE);

        // 3. Atomic persistence with row lock
        return DB::transaction(function () use ($data, $actor, $ip) {
            /** @var CompanyInformation $record */
            $record = CompanyInformation::query()
                ->where('is_singleton', true)
                ->lockForUpdate()
                ->firstOrFail();

            $original = $record->only([
                'legal_name', 'dba_name', 'address_line1', 'address_line2',
                'city', 'state', 'postal_code', 'country', 'phone', 'email',
                'website', 'tax_id', 'state_tax_id', 'currency', 'timezone',
                'invoice_footer_note',
            ]);

            $newValues = $data->toArray();
            $changedFields = [];

            foreach ($newValues as $key => $val) {
                if (($original[$key] ?? null) !== $val) {
                    $changedFields[] = $key;
                }
            }

            $record->fill($newValues);
            $record->save();

            // 4. Invalidate request cache
            self::invalidateCache();
            self::$cachedInstance = $record;

            // 5. Audit logging
            Log::info('Company information updated', [
                'event' => 'audit.system_event',
                'action' => 'SYSTEM_COMPANY_INFORMATION_UPDATED',
                'actor_id' => $actor->id,
                'actor_email' => $actor->email,
                'actor_role' => $actor->role?->value,
                'changed_fields' => $changedFields,
                'ip_address' => $ip,
                'timestamp' => now()->toIso8601String(),
            ]);

            return $record;
        });
    }

    /**
     * Invalidate static memory cache.
     */
    public static function invalidateCache(): void
    {
        self::$cachedInstance = null;
    }
}
