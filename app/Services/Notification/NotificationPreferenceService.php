<?php

namespace App\Services\Notification;

use App\Models\NotificationPreference;
use App\Models\User;
use DomainException;
use Illuminate\Support\Facades\DB;

class NotificationPreferenceService
{
    /**
     * User-configurable notification categories.
     */
    public const CONFIGURABLE_CATEGORIES = [
        'ORDERS',
        'PAYMENTS',
        'INVENTORY',
        'DELIVERY',
        'RETURNS',
    ];

    /**
     * Mandatory, non-disableable notification categories.
     */
    public const MANDATORY_CATEGORIES = [
        'SECURITY',
        'SYSTEM',
    ];

    /**
     * All recognized notification categories.
     */
    public const ALL_CATEGORIES = [
        'ORDERS',
        'PAYMENTS',
        'INVENTORY',
        'DELIVERY',
        'RETURNS',
        'SECURITY',
        'SYSTEM',
    ];

    /**
     * Get aggregated notification preferences for a user, including default states and mandatory flags.
     *
     * @return array<int, array{category: string, is_in_app_enabled: bool, is_mandatory: bool, label: string, description: string}>
     */
    public function getUserPreferences(User $user): array
    {
        $existing = NotificationPreference::where('user_id', $user->id)
            ->get()
            ->keyBy('category');

        $result = [];

        foreach (self::ALL_CATEGORIES as $category) {
            $isMandatory = in_array($category, self::MANDATORY_CATEGORIES, true);
            $prefRecord = $existing->get($category);

            // Mandatory categories are ALWAYS enabled. Configurable categories default to true if no preference record.
            $isEnabled = $isMandatory ? true : ($prefRecord ? (bool) $prefRecord->is_in_app_enabled : true);

            $result[] = [
                'category' => $category,
                'is_in_app_enabled' => $isEnabled,
                'is_mandatory' => $isMandatory,
                'label' => $this->getCategoryLabel($category),
                'description' => $this->getCategoryDescription($category),
            ];
        }

        return $result;
    }

    /**
     * Update notification preferences for a user.
     *
     * @param  array<string, bool|int>  $categorySettings  Map of category => is_in_app_enabled
     * @return array<int, array{category: string, is_in_app_enabled: bool, is_mandatory: bool, label: string, description: string}>
     *
     * @throws DomainException if attempting to disable a mandatory category
     */
    public function updatePreferences(User $user, array $categorySettings): array
    {
        return DB::transaction(function () use ($user, $categorySettings) {
            foreach ($categorySettings as $category => $enabled) {
                $categoryUpper = strtoupper(trim((string) $category));

                if (! in_array($categoryUpper, self::ALL_CATEGORIES, true)) {
                    throw new DomainException("Invalid notification category: '{$category}'");
                }

                $boolEnabled = (bool) $enabled;

                if (in_array($categoryUpper, self::MANDATORY_CATEGORIES, true)) {
                    if (! $boolEnabled) {
                        throw new DomainException("Category '{$categoryUpper}' is mandatory and cannot be disabled.");
                    }
                    // Mandatory categories are always true, skip saving or save as true
                    continue;
                }

                NotificationPreference::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'category' => $categoryUpper,
                    ],
                    [
                        'is_enabled' => $boolEnabled,
                    ]
                );
            }

            return $this->getUserPreferences($user);
        });
    }

    /**
     * Determine whether in-app notification is enabled for a user in a given category.
     */
    public function isNotificationEnabled(User $user, string $category, string $channel = 'in_app'): bool
    {
        $categoryUpper = strtoupper(trim($category));

        // 1. Mandatory categories can never be suppressed by preferences
        if (in_array($categoryUpper, self::MANDATORY_CATEGORIES, true)) {
            return true;
        }

        // 2. Query stored preference
        $pref = NotificationPreference::where('user_id', $user->id)
            ->where('category', $categoryUpper)
            ->first();

        if ($pref === null) {
            return true; // Default opt-in
        }

        return (bool) $pref->is_enabled;
    }

    /**
     * Get human-readable label for a category.
     */
    public function getCategoryLabel(string $category): string
    {
        return match (strtoupper($category)) {
            'ORDERS' => 'Orders & Adjustments',
            'PAYMENTS' => 'Payments & Settlements',
            'INVENTORY' => 'Inventory & Stock Alerts',
            'DELIVERY' => 'Delivery & Dispatch',
            'RETURNS' => 'Returns & Refunds',
            'SECURITY' => 'Security & Access Alerts',
            'SYSTEM' => 'System & Critical Maintenance',
            default => ucfirst(strtolower($category)),
        };
    }

    /**
     * Get semantic description for a category.
     */
    public function getCategoryDescription(string $category): string
    {
        return match (strtoupper($category)) {
            'ORDERS' => 'Notifications for orders requiring review, approval, rejection, or adjustment requests.',
            'PAYMENTS' => 'Notifications for collected payments, verification milestones, and dishonored cheques.',
            'INVENTORY' => 'Alerts for critical low stock, damage reports, and warehouse discrepancies.',
            'DELIVERY' => 'Updates on driver assignment, delivery dispatch, POD confirmation, and delivery failures.',
            'RETURNS' => 'Notifications for customer return requests, physical inspections, and credit note issuance.',
            'SECURITY' => 'Mandatory alerts for password changes, suspicious logins, privilege updates, and session events.',
            'SYSTEM' => 'Mandatory system announcements, maintenance windows, and database integrity notices.',
            default => 'Notifications for ' . strtolower($category) . '.',
        };
    }
}
