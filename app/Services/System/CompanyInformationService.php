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
use Illuminate\Validation\ValidationException;

class CompanyInformationService
{
    /**
     * Request-scoped singleton cache.
     */
    protected static ?CompanyInformation $cachedInstance = null;

    public function __construct(
        protected PermissionService $permissionService
    ) {}

    /**
     * Retrieve the authoritative company singleton.
     * Guaranteed to return a valid instance.
     */
    public function get(): CompanyInformation
    {
        if (self::$cachedInstance !== null) {
            return self::$cachedInstance;
        }

        try {
            $record = CompanyInformation::query()
                ->where('is_singleton', true)
                ->first();

            if ($record) {
                self::$cachedInstance = $record;

                return $record;
            }

            // If table exists but empty, self-heal with authoritative defaults
            $created = CompanyInformation::create([
                'legal_name' => 'Unique Jersey Wholesale',
                'dba_name' => 'Wholesale Distribution',
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
                'is_title_locked' => true,
            ]);

            self::$cachedInstance = $created;

            return $created;
        } catch (\Throwable $e) {
            Log::warning('CompanyInformationService: database unavailable, falling back to default identity', [
                'error' => $e->getMessage(),
            ]);

            return new CompanyInformation([
                'legal_name' => 'Unique Jersey Wholesale',
                'dba_name' => 'Wholesale Distribution',
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
                'is_title_locked' => true,
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
     * @throws AuthorizationException|ValidationException
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
                'invoice_footer_note', 'is_title_locked',
            ]);

            // Server-authoritative Title Lock enforcement
            $currentLocked = (bool) ($record->is_title_locked ?? true);
            $isTitleChanged = $record->legal_name !== $data->legal_name;

            if ($currentLocked && $isTitleChanged) {
                // If title is currently locked, it can only be changed if the request explicitly unlocks it (is_title_locked === false)
                if ($data->is_title_locked !== false) {
                    throw ValidationException::withMessages([
                        'legal_name' => 'The legal entity title is currently locked against accidental changes. You must unlock the title before editing it.',
                    ]);
                }
            }

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
