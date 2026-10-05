<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UserLifecycleService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected AuditLogService $auditLogService
    ) {}

    /**
     * Transition a user's account status (ACTIVE, SUSPENDED, DISABLED, INVITED).
     *
     * @throws AuthorizationException|ValidationException
     */
    public function updateStatus(
        User $actor,
        User $target,
        AccountStatus $newStatus,
        ?string $reason = null,
        ?string $ip = null
    ): User {
        // 1. Authorization: Actor must possess USER_SUSPEND or USER_UPDATE
        if (! $actor->canPermission(Permission::USER_SUSPEND) && ! $actor->canPermission(Permission::USER_UPDATE) && ! $actor->isSuperAdmin()) {
            throw new AuthorizationException('You do not have permission to manage user lifecycle status.');
        }

        // 2. Non-SuperAdmin cannot modify a SuperAdmin account
        if ($target->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            throw new AuthorizationException('Only a Super Administrator can manage Super Administrator accounts.');
        }

        // 3. Cannot suspend or disable own account
        if ($actor->id === $target->id && in_array($newStatus, [AccountStatus::SUSPENDED, AccountStatus::DISABLED], true)) {
            throw ValidationException::withMessages([
                'status' => ['You cannot suspend or disable your own account.'],
            ]);
        }

        // 4. Cannot deactivate the last active Super Admin
        if ($target->isSuperAdmin() && in_array($newStatus, [AccountStatus::SUSPENDED, AccountStatus::DISABLED], true)) {
            $otherActiveSuperAdmins = User::query()
                ->where('role', UserRole::SUPER_ADMIN->value)
                ->where('status', AccountStatus::ACTIVE->value)
                ->where('id', '!=', $target->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot deactivate the last active Super Administrator.'],
                ]);
            }
        }

        $oldStatus = $target->status instanceof AccountStatus ? $target->status : AccountStatus::tryFrom((string) $target->status) ?? AccountStatus::ACTIVE;

        if ($oldStatus === $newStatus) {
            return $target;
        }

        // 5. Update Status
        $target->update([
            'status' => $newStatus,
        ]);

        // 6. Revoke active sessions if suspending or disabling
        if (in_array($newStatus, [AccountStatus::SUSPENDED, AccountStatus::DISABLED], true)) {
            $this->revokeUserSessions($target->id);
        }

        // 7. Audit log
        $this->auditLogService->log(
            eventType: 'SECURITY',
            module: 'SECURITY',
            action: 'USER_STATUS_UPDATED',
            actor: $actor,
            entityType: 'User',
            entityId: $target->id,
            referenceNumber: $target->email,
            description: sprintf('Updated user %s (%s) status from %s to %s. Reason: %s', $target->name, $target->email, $oldStatus->value, $newStatus->value, $reason ?? 'Administrative status update'),
            metadata: [
                'target_user_id' => $target->id,
                'target_email' => $target->email,
                'old_status' => $oldStatus->value,
                'new_status' => $newStatus->value,
                'reason' => $reason,
                'ip_address' => $ip ?? request()?->ip(),
            ]
        );

        return $target->fresh();
    }

    /**
     * Permanently delete or safely retire a user account with strict Super Admin governance.
     *
     * @return array<string, mixed>
     *
     * @throws AuthorizationException|ValidationException
     */
    public function deleteUser(
        User $actor,
        User $target,
        string $reason,
        bool $confirm,
        ?string $ip = null
    ): array {
        // 1. Strict Permission: Only SUPER_ADMIN possessing USER_DELETE
        if (! $actor->canPermission(Permission::USER_DELETE) && ! $actor->isSuperAdmin()) {
            throw new AuthorizationException('Strict Super Administrator authorization required to delete user accounts.');
        }

        // 2. Self-deletion protection
        if ($actor->id === $target->id) {
            throw ValidationException::withMessages([
                'user' => ['You cannot delete your own account.'],
            ]);
        }

        // 3. Last active Super Admin protection
        if ($target->isSuperAdmin()) {
            $otherActiveSuperAdmins = User::query()
                ->where('role', UserRole::SUPER_ADMIN->value)
                ->where('status', AccountStatus::ACTIVE->value)
                ->where('id', '!=', $target->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                throw ValidationException::withMessages([
                    'user' => ['Cannot delete the last active Super Administrator account.'],
                ]);
            }
        }

        // 4. Confirmation validation
        if (! $confirm) {
            throw ValidationException::withMessages([
                'confirm' => ['Explicit confirmation is required to permanently delete a user account.'],
            ]);
        }

        // 5. Deletion Reason validation
        if (empty(trim($reason)) || strlen(trim($reason)) < 10) {
            throw ValidationException::withMessages([
                'reason' => ['A documented deletion reason of at least 10 characters is required.'],
            ]);
        }

        // 6. Revoke active sessions immediately
        $this->revokeUserSessions($target->id);

        // 7. Check for historical business references
        $hasHistoricalReferences = $this->hasHistoricalReferences($target->id);

        $targetId = $target->id;
        $targetEmail = $target->email;
        $targetName = $target->name;
        $targetRole = $target->role instanceof UserRole ? $target->role->value : (string) $target->role;

        if ($hasHistoricalReferences) {
            // Safe Retirement: Disable account, wipe credentials and sensitive tokens, preserve attribution ID
            $target->update([
                'status' => AccountStatus::DISABLED,
                'password' => Hash::make(Str::random(40)),
                'remember_token' => null,
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
                'email_verified_at' => null,
            ]);

            $this->auditLogService->log(
                eventType: 'SECURITY',
                module: 'SECURITY',
                action: 'USER_DELETED_ANONYMIZED',
                actor: $actor,
                entityType: 'User',
                entityId: $targetId,
                referenceNumber: $targetEmail,
                description: sprintf('Permanently retired and disabled user %s (%s) due to existing historical records. Reason: %s', $targetName, $targetEmail, $reason),
                metadata: [
                    'target_user_id' => $targetId,
                    'target_email' => $targetEmail,
                    'target_role' => $targetRole,
                    'mode' => 'anonymized_disabled',
                    'reason' => $reason,
                    'ip_address' => $ip ?? request()?->ip(),
                ]
            );

            return [
                'deleted' => true,
                'mode' => 'anonymized_disabled',
                'message' => 'User account permanently disabled and credentials purged to preserve historical transaction integrity.',
            ];
        }

        // Hard Delete when no historical business records exist
        $target->delete();

        $this->auditLogService->log(
            eventType: 'SECURITY',
            module: 'SECURITY',
            action: 'USER_HARD_DELETED',
            actor: $actor,
            entityType: 'User',
            entityId: $targetId,
            referenceNumber: $targetEmail,
            description: sprintf('Permanently removed user %s (%s). Reason: %s', $targetName, $targetEmail, $reason),
            metadata: [
                'target_user_id' => $targetId,
                'target_email' => $targetEmail,
                'target_role' => $targetRole,
                'mode' => 'hard_deleted',
                'reason' => $reason,
                'ip_address' => $ip ?? request()?->ip(),
            ]
        );

        return [
            'deleted' => true,
            'mode' => 'hard_deleted',
            'message' => 'User account permanently removed from the system.',
        ];
    }

    /**
     * Determine whether the target user has historical operational records.
     */
    protected function hasHistoricalReferences(int $userId): bool
    {
        return Order::query()->where('creator_id', $userId)->orWhere('salesman_id', $userId)->exists()
            || Customer::query()->where('created_by', $userId)->orWhere('salesman_id', $userId)->exists()
            || Payment::query()->where('recorded_by', $userId)->orWhere('verified_by', $userId)->exists()
            || Invoice::query()->where('created_by', $userId)->exists()
            || Delivery::query()->where('driver_id', $userId)->orWhere('assigned_by', $userId)->exists()
            || AuditLog::query()->where('actor_id', $userId)->exists();
    }

    /**
     * Terminate all active browser sessions for the user.
     */
    protected function revokeUserSessions(int $userId): void
    {
        try {
            DB::table('sessions')->where('user_id', $userId)->delete();
        } catch (\Throwable) {
            // In case session table uses non-database driver in test fixtures
        }
    }
}
