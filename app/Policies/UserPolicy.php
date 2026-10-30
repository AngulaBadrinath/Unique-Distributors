<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;
use App\Services\Auth\PermissionService;

class UserPolicy
{
    public function __construct(
        protected PermissionService $permissionService
    ) {}

    /**
     * Determine whether the user can view any user listings.
     */
    public function viewAny(User $user): bool
    {
        return $this->permissionService->has($user, Permission::USER_VIEW);
    }

    /**
     * Determine whether the user can view the specific user.
     */
    public function view(User $user, User $target): bool
    {
        if ($user->id === $target->id) {
            return true;
        }

        return $this->permissionService->has($user, Permission::USER_VIEW);
    }

    /**
     * Determine whether the user can create new users.
     */
    public function create(User $user): bool
    {
        return $this->permissionService->has($user, Permission::USER_CREATE);
    }

    /**
     * Determine whether the user can update the user.
     */
    public function update(User $user, User $target): bool
    {
        return $this->permissionService->has($user, Permission::USER_UPDATE);
    }

    /**
     * Determine whether the user can suspend or alter the lifecycle state of the user.
     * Self-suspension is strictly prohibited.
     */
    public function suspend(User $user, User $target): bool
    {
        if ($user->id === $target->id) {
            return false;
        }

        return $this->permissionService->has($user, Permission::USER_SUSPEND);
    }

    /**
     * Determine whether the user can delete the target user.
     * Requires USER_DELETE permission (Super Admin only).
     * Domain validation (self-deletion and last active admin) is enforced by UserLifecycleService.
     */
    public function delete(User $user, User $target): bool
    {
        return $this->permissionService->has($user, Permission::USER_DELETE);
    }
}
