<?php

namespace App\Http\Controllers\Security;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Security\UpdateUserRoleRequest;
use App\Models\User;
use App\Services\Auth\RoleAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RoleAssignmentController extends Controller
{
    /**
     * Display role management and assignment overview.
     */
    public function index(Request $request): Response
    {
        $actor = $request->user();

        if (! $actor->canPermission(\App\Enums\Permission::ROLE_MANAGE)) {
            abort(403, 'You do not have permission to access role management.');
        }

        $users = User::query()
            ->select(['id', 'name', 'email', 'role', 'status', 'created_at'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value,
                'role_label' => $user->role?->label(),
                'status' => $user->status instanceof \App\Enums\AccountStatus ? $user->status->value : $user->status,
                'created_at' => $user->created_at?->toIso8601String(),
            ]);

        $availableRoles = collect(UserRole::cases())->map(fn (UserRole $role) => [
            'value' => $role->value,
            'label' => $role->label(),
            'description' => $role->description(),
            'is_privileged' => $role->isPrivileged(),
        ]);

        return Inertia::render('Security/Roles/Index', [
            'users' => $users,
            'availableRoles' => $availableRoles,
            'canAssignSuperAdmin' => $actor->isSuperAdmin(),
            'canDeleteUser' => $actor->canPermission(\App\Enums\Permission::USER_DELETE),
            'currentUser' => [
                'id' => $actor->id,
                'role' => $actor->role?->value,
            ],
        ]);
    }

    /**
     * Update the assigned role for the specified user.
     */
    public function update(
        UpdateUserRoleRequest $request,
        User $user,
        RoleAssignmentService $roleAssignmentService
    ): RedirectResponse|JsonResponse {
        $actor = $request->user();
        $newRole = UserRole::from($request->validated('role'));
        $reason = $request->validated('reason');

        $updatedUser = $roleAssignmentService->assignRole(
            actor: $actor,
            target: $user,
            newRole: $newRole,
            reason: $reason,
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'User role updated successfully.',
                'user' => [
                    'id' => $updatedUser->id,
                    'name' => $updatedUser->name,
                    'email' => $updatedUser->email,
                    'role' => $updatedUser->role?->value,
                ],
            ]);
        }

        return redirect()->back()->with('status', 'User role updated successfully.');
    }
}
