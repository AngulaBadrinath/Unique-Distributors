<?php

declare(strict_types=1);

namespace App\Http\Controllers\Security;

use App\Enums\AccountStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\UserLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserLifecycleController extends Controller
{
    public function __construct(
        protected UserLifecycleService $lifecycleService
    ) {}

    /**
     * Update user account lifecycle status (Activate, Suspend, Disable, Reactivate).
     */
    public function updateStatus(Request $request, User $user): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::enum(AccountStatus::class)],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $actor = $request->user();
        $newStatus = AccountStatus::from($validated['status']);

        $updatedUser = $this->lifecycleService->updateStatus(
            actor: $actor,
            target: $user,
            newStatus: $newStatus,
            reason: $validated['reason'] ?? null,
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => "User account status updated to {$newStatus->value}.",
                'user' => [
                    'id' => $updatedUser->id,
                    'name' => $updatedUser->name,
                    'email' => $updatedUser->email,
                    'status' => $updatedUser->status instanceof AccountStatus ? $updatedUser->status->value : $updatedUser->status,
                ],
            ]);
        }

        return redirect()->back()->with('status', "User account status updated to {$newStatus->value}.");
    }

    /**
     * Permanently delete or safely retire a user account (Super Admin only).
     */
    public function destroy(Request $request, User $user): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'confirm' => ['required', 'boolean', 'accepted'],
        ]);

        $actor = $request->user();

        $result = $this->lifecycleService->deleteUser(
            actor: $actor,
            target: $user,
            reason: $validated['reason'],
            confirm: (bool) $validated['confirm'],
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json($result);
        }

        return redirect()->route('roles.index')->with('status', $result['message']);
    }
}
