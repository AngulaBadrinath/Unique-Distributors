<?php

namespace App\Http\Controllers\Notification;

use App\Http\Controllers\Controller;
use App\Models\InAppNotification;
use App\Services\Notification\NotificationPreferenceService;
use App\Services\Notification\NotificationService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class NotificationController extends Controller
{
    public function __construct(
        protected NotificationService $notificationService,
        protected NotificationPreferenceService $preferenceService
    ) {}

    /**
     * Display the full notification center page.
     */
    public function index(Request $request): InertiaResponse|JsonResponse
    {
        $user = $request->user();
        $filters = $request->only(['is_read', 'category', 'severity', 'search', 'per_page']);

        $notifications = $this->notificationService->getNotificationsForUser($user, $filters);
        $unreadCount = $this->notificationService->getUnreadCount($user);

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'notifications' => $notifications,
                'unread_count' => $unreadCount,
            ]);
        }

        return Inertia::render('Notifications/Index', [
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
            'filters' => $filters,
            'categories' => NotificationPreferenceService::ALL_CATEGORIES,
        ]);
    }

    /**
     * Lightweight JSON feed for top-navigation popover.
     */
    public function feed(Request $request): JsonResponse
    {
        $user = $request->user();
        $unreadCount = $this->notificationService->getUnreadCount($user);
        $notifications = $this->notificationService->getNotificationsForUser($user, ['per_page' => 10]);

        return response()->json([
            'unread_count' => $unreadCount,
            'notifications' => $notifications->items(),
        ]);
    }

    /**
     * Get unread count.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = $this->notificationService->getUnreadCount($user);

        return response()->json([
            'unread_count' => $count,
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(Request $request, int|string $id): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        try {
            $notification = $this->notificationService->markAsRead($user, $id);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Notification marked as read.',
                    'notification' => $notification,
                    'unread_count' => $this->notificationService->getUnreadCount($user),
                ]);
            }

            return back()->with('success', 'Notification marked as read.');
        } catch (DomainException $e) {
            if ($request->wantsJson()) {
                return response()->json(['message' => $e->getMessage()], 404);
            }

            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        $updatedCount = $this->notificationService->markAllAsRead($user);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'All notifications marked as read.',
                'updated_count' => $updatedCount,
                'unread_count' => 0,
            ]);
        }

        return back()->with('success', 'All notifications marked as read.');
    }

    /**
     * Delete a single notification.
     */
    public function destroy(Request $request, int|string $id): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        try {
            $this->notificationService->deleteNotification($user, $id);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Notification deleted.',
                    'unread_count' => $this->notificationService->getUnreadCount($user),
                ]);
            }

            return back()->with('success', 'Notification deleted.');
        } catch (DomainException $e) {
            if ($request->wantsJson()) {
                return response()->json(['message' => $e->getMessage()], 404);
            }

            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Display notification preferences management view.
     */
    public function preferences(Request $request): InertiaResponse|JsonResponse
    {
        $user = $request->user();
        $preferences = $this->preferenceService->getUserPreferences($user);

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'preferences' => $preferences,
            ]);
        }

        return Inertia::render('Notifications/Preferences', [
            'preferences' => $preferences,
        ]);
    }

    /**
     * Update notification preferences.
     */
    public function updatePreferences(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        $request->validate([
            'preferences' => 'required|array',
            'preferences.*' => 'boolean',
        ]);

        try {
            $updated = $this->preferenceService->updatePreferences($user, $request->input('preferences'));

            if ($request->wantsJson()) {
                return response()->json([
                    'message' => 'Notification preferences updated successfully.',
                    'preferences' => $updated,
                ]);
            }

            return back()->with('success', 'Notification preferences updated successfully.');
        } catch (DomainException $e) {
            if ($request->wantsJson()) {
                return response()->json(['message' => $e->getMessage()], 422);
            }

            return back()->with('error', $e->getMessage());
        }
    }
}
