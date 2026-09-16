<?php

namespace App\Services\Delivery;

use App\Enums\AccountStatus;
use App\Enums\DeliveryStatus;
use App\Enums\UserRole;
use App\Models\Delivery;
use App\Models\User;
use App\Services\Auth\SessionRevocationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class DeliveryPartnerService
{
    public function __construct(
        protected SessionRevocationService $sessionRevocationService
    ) {}

    /**
     * Retrieve a paginated list of delivery partner accounts with search and status filtering.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = User::query()
            ->where('role', UserRole::DELIVERY_PARTNER->value)
            ->withCount('assignedDeliveries');

        // Text search across name and email
        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $isPgsql = $query->getConnection()->getDriverName() === 'pgsql';
            $like = $isPgsql ? 'ilike' : 'like';

            $query->where(function ($q) use ($search, $like) {
                $q->where('name', $like, "%{$search}%")
                    ->orWhere('email', $like, "%{$search}%");
            });
        }

        // Status filter
        if (! empty($filters['status'])) {
            $status = AccountStatus::tryFrom(strtoupper((string) $filters['status']));
            if ($status !== null) {
                $query->where('status', $status->value);
            }
        }

        // Sorting
        $sortField = $filters['sort'] ?? 'name';
        $direction = strtolower($filters['direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        $allowedSorts = ['name', 'email', 'status', 'created_at', 'assigned_deliveries_count'];
        if (in_array($sortField, $allowedSorts, true)) {
            $query->orderBy($sortField, $direction);
        } else {
            $query->orderBy('name', 'asc');
        }

        return $query->paginate($perPage)->withQueryString();
    }

    /**
     * Authoritatively provision a new delivery partner account.
     * Role is strictly forced to UserRole::DELIVERY_PARTNER on the server.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws AuthorizationException
     */
    public function createDeliveryPartner(User $actor, array $data): User
    {
        if (! $actor->exists || ! $actor->id || ! $actor->isActive()) {
            throw new AuthorizationException('Actor must be an active, authenticated user.');
        }

        $initialStatus = isset($data['status'])
            ? AccountStatus::tryFrom(strtoupper((string) $data['status'])) ?? AccountStatus::ACTIVE
            : AccountStatus::ACTIVE;

        if (! in_array($initialStatus, [AccountStatus::ACTIVE, AccountStatus::INVITED], true)) {
            $initialStatus = AccountStatus::ACTIVE;
        }

        return DB::transaction(function () use ($actor, $data, $initialStatus) {
            $user = new User();
            $user->name = trim((string) $data['name']);
            $user->email = strtolower(trim((string) $data['email']));
            $user->password = Hash::make((string) $data['password']);
            $user->role = UserRole::DELIVERY_PARTNER;
            $user->status = $initialStatus;
            $user->save();

            Log::info('auth.delivery_partner_event', [
                'action' => 'DELIVERY_PARTNER_CREATED',
                'actor_id' => $actor->id,
                'delivery_partner_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'initial_status' => $user->status->value,
                'timestamp' => now()->toIso8601String(),
            ]);

            return $user;
        });
    }

    /**
     * Update an existing delivery partner's profile fields (name and email).
     *
     * @param  array<string, mixed>  $data
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function updateDeliveryPartner(User $actor, User $driver, array $data): User
    {
        if (! $actor->exists || ! $actor->id || ! $actor->isActive()) {
            throw new AuthorizationException('Actor must be an active, authenticated user.');
        }

        if ($driver->role !== UserRole::DELIVERY_PARTNER) {
            throw ValidationException::withMessages([
                'user' => ['Only delivery partner accounts can be managed through this service.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $driver, $data) {
            /** @var User $lockedDriver */
            $lockedDriver = User::where('id', $driver->id)->lockForUpdate()->firstOrFail();

            if ($lockedDriver->role !== UserRole::DELIVERY_PARTNER) {
                throw new AuthorizationException('Target user is not a delivery partner.');
            }

            $changed = [];

            if (isset($data['name'])) {
                $newName = trim((string) $data['name']);
                if ($lockedDriver->name !== $newName) {
                    $lockedDriver->name = $newName;
                    $changed[] = 'name';
                }
            }

            if (isset($data['email'])) {
                $newEmail = strtolower(trim((string) $data['email']));
                if ($lockedDriver->email !== $newEmail) {
                    $lockedDriver->email = $newEmail;
                    $changed[] = 'email';
                }
            }

            if (! empty($changed)) {
                $lockedDriver->save();

                Log::info('auth.delivery_partner_event', [
                    'action' => 'DELIVERY_PARTNER_UPDATED',
                    'actor_id' => $actor->id,
                    'delivery_partner_id' => $lockedDriver->id,
                    'changed_fields' => $changed,
                    'timestamp' => now()->toIso8601String(),
                ]);
            }

            return $lockedDriver;
        });
    }

    /**
     * Authoritatively transition a delivery partner account's lifecycle state.
     * Pessimistic row locking, no-op suppression, and immediate session revocation on suspension/disablement.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function updateStatus(
        User $actor,
        User $driver,
        AccountStatus $newStatus,
        ?string $reason = null
    ): User {
        if (! $actor->exists || ! $actor->id || ! $actor->isActive()) {
            throw new AuthorizationException('Actor must be an active, authenticated user.');
        }

        if ($actor->id === $driver->id) {
            throw new AuthorizationException('Administrators cannot alter the status of their own account.');
        }

        if ($driver->role !== UserRole::DELIVERY_PARTNER) {
            throw ValidationException::withMessages([
                'user' => ['Only delivery partner accounts can be managed through this service.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $driver, $newStatus, $reason) {
            /** @var User $lockedDriver */
            $lockedDriver = User::where('id', $driver->id)->lockForUpdate()->firstOrFail();

            if ($lockedDriver->role !== UserRole::DELIVERY_PARTNER) {
                throw new AuthorizationException('Target user is not a delivery partner.');
            }

            $previousStatus = $lockedDriver->status;

            if ($previousStatus === $newStatus) {
                return $lockedDriver;
            }

            $action = match ($newStatus) {
                AccountStatus::ACTIVE => 'DELIVERY_PARTNER_ACTIVATED',
                AccountStatus::SUSPENDED => 'DELIVERY_PARTNER_SUSPENDED',
                AccountStatus::DISABLED => 'DELIVERY_PARTNER_DISABLED',
                AccountStatus::INVITED => 'DELIVERY_PARTNER_INVITED',
            };

            $lockedDriver->status = $newStatus;
            $lockedDriver->save();

            // Immediate session revocation on suspension or deactivation
            if (in_array($newStatus, [AccountStatus::SUSPENDED, AccountStatus::DISABLED], true)) {
                $this->sessionRevocationService->revokeUserSessionsForSecurityEvent(
                    $lockedDriver,
                    'account_status_changed'
                );
            }

            Log::info('auth.delivery_partner_event', [
                'action' => $action,
                'actor_id' => $actor->id,
                'delivery_partner_id' => $lockedDriver->id,
                'previous_status' => $previousStatus instanceof AccountStatus ? $previousStatus->value : (string) $previousStatus,
                'new_status' => $newStatus->value,
                'reason' => $reason,
                'timestamp' => now()->toIso8601String(),
            ]);

            return $lockedDriver;
        });
    }

    /**
     * Retrieve complete delivery partner profile data including assigned deliveries summary.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function getProfile(User $driver): array
    {
        if ($driver->role !== UserRole::DELIVERY_PARTNER) {
            throw ValidationException::withMessages([
                'user' => ['Target user is not a delivery partner account.'],
            ]);
        }

        $deliveriesQuery = Delivery::where('driver_id', $driver->id);

        $counts = [
            'total_assigned' => (clone $deliveriesQuery)->count(),
            'pending_pickup' => (clone $deliveriesQuery)->where('status', DeliveryStatus::ASSIGNED->value)->count(),
            'in_transit' => (clone $deliveriesQuery)->whereIn('status', [
                DeliveryStatus::PICKED_UP->value,
                DeliveryStatus::OUT_FOR_DELIVERY->value,
            ])->count(),
            'delivered' => (clone $deliveriesQuery)->where('status', DeliveryStatus::DELIVERED->value)->count(),
            'failed' => (clone $deliveriesQuery)->where('status', DeliveryStatus::FAILED->value)->count(),
            'returned' => (clone $deliveriesQuery)->where('status', DeliveryStatus::RETURNED_TO_WAREHOUSE->value)->count(),
        ];

        $recentDeliveries = Delivery::where('driver_id', $driver->id)
            ->with(['order:id,order_number,status,fulfillment_status', 'customer:id,name,phone,shipping_city,shipping_state'])
            ->orderBy('id', 'desc')
            ->limit(10)
            ->get()
            ->map(fn (Delivery $del) => [
                'id' => $del->id,
                'delivery_number' => $del->delivery_number,
                'order_number' => $del->order?->order_number,
                'customer_name' => $del->customer?->name,
                'customer_location' => $del->delivery_city . ', ' . $del->delivery_state,
                'status' => $del->status instanceof DeliveryStatus ? $del->status->value : (string) $del->status,
                'scheduled_date' => $del->scheduled_date?->toDateString(),
                'delivered_at' => $del->delivered_at?->toIso8601String(),
            ]);

        return [
            'driver' => [
                'id' => $driver->id,
                'name' => $driver->name,
                'email' => $driver->email,
                'status' => $driver->status instanceof AccountStatus ? $driver->status->value : (string) $driver->status,
                'status_label' => $driver->status instanceof AccountStatus ? $driver->status->label() : (string) $driver->status,
                'can_authenticate' => $driver->canAuthenticate(),
                'can_be_assigned' => $driver->canBeAssignedAsDeliveryDriver(),
                'created_at' => $driver->created_at?->toIso8601String(),
                'updated_at' => $driver->updated_at?->toIso8601String(),
            ],
            'counts' => $counts,
            'recent_deliveries' => $recentDeliveries,
        ];
    }
}
