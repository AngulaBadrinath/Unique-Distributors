<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Services\Auth\MfaPolicy;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'status', 'role', 'two_factor_secret', 'two_factor_confirmed_at', 'email_verified_at'])]
#[Hidden(['password', 'remember_token', 'two_factor_secret'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'status' => AccountStatus::class,
            'role' => UserRole::class,
            'two_factor_secret' => 'encrypted',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /**
     * Determine whether the account is currently permitted to authenticate.
     */
    public function canAuthenticate(): bool
    {
        return $this->status instanceof AccountStatus && $this->status->canAuthenticate();
    }

    /**
     * Check if account is active.
     */
    public function isActive(): bool
    {
        return $this->status === AccountStatus::ACTIVE;
    }

    /**
     * Check if account is suspended.
     */
    public function isSuspended(): bool
    {
        return $this->status === AccountStatus::SUSPENDED;
    }

    /**
     * Check if account is disabled.
     */
    public function isDisabled(): bool
    {
        return $this->status === AccountStatus::DISABLED;
    }

    /**
     * Check if account is in invited state.
     */
    public function isInvited(): bool
    {
        return $this->status === AccountStatus::INVITED;
    }

    /**
     * Send the password reset notification.
     *
     * @param  string  $token
     */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new \App\Notifications\Auth\ResetPasswordNotification($token));
    }

    /**
     * Get the two factor recovery codes for the user.
     */
    public function recoveryCodes(): HasMany
    {
        return $this->hasMany(TwoFactorRecoveryCode::class);
    }

    /**
     * Determine whether the user has confirmed Multi-Factor Authentication.
     */
    public function hasMfaEnabled(): bool
    {
        return $this->two_factor_confirmed_at !== null && ! empty($this->two_factor_secret);
    }

    /**
     * Determine whether Multi-Factor Authentication is required for the user by policy.
     */
    public function requiresMfa(): bool
    {
        return app(MfaPolicy::class)->isMfaRequired($this);
    }

    /**
     * Determine whether the user possesses a privileged administrative or financial role.
     */
    public function isPrivileged(): bool
    {
        return $this->role instanceof UserRole && $this->role->isPrivileged();
    }

    /**
     * Determine whether the user possesses a specific role.
     */
    public function hasRole(UserRole|string $role): bool
    {
        if ($this->role === null) {
            return false;
        }

        $roleValue = $role instanceof UserRole ? $role->value : $role;

        return $this->role->value === $roleValue;
    }

    /**
     * Determine whether the user is a Super Administrator.
     */
    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SUPER_ADMIN;
    }

    /**
     * Determine whether the user is an Administrator.
     */
    public function isAdmin(): bool
    {
        return $this->role === UserRole::ADMIN;
    }

    /**
     * Determine whether the user is an Accountant.
     */
    public function isAccountant(): bool
    {
        return $this->role === UserRole::ACCOUNTANT;
    }

    /**
     * Determine whether the user is a Sales Representative.
     */
    public function isSalesman(): bool
    {
        return $this->role === UserRole::SALESMAN;
    }

    /**
     * Determine whether the user is a Warehouse Manager.
     */
    public function isWarehouseManager(): bool
    {
        return $this->role === UserRole::WAREHOUSE_MANAGER;
    }

    /**
     * Determine whether the user is a Delivery Partner.
     */
    public function isDeliveryPartner(): bool
    {
        return $this->role === UserRole::DELIVERY_PARTNER;
    }

    /**
     * Determine whether the user possesses the specified permission.
     */
    public function hasPermission(\App\Enums\Permission|string $permission): bool
    {
        return app(\App\Services\Auth\PermissionService::class)->has($this, $permission);
    }

    /**
     * Determine whether the user can perform an action protected by the specified permission.
     */
    public function canPermission(\App\Enums\Permission|string $permission): bool
    {
        return $this->hasPermission($permission);
    }

    /**
     * Get the customer accounts assigned to this salesman.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<\App\Models\Customer, $this>
     */
    public function assignedCustomers(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(\App\Models\Customer::class, 'salesman_id');
    }

    /**
     * Get the deliveries assigned to this delivery partner.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<\App\Models\Delivery, $this>
     */
    public function assignedDeliveries(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(\App\Models\Delivery::class, 'driver_id');
    }

    /**
     * Determine whether the user is eligible to be assigned as a salesman.
     */
    public function canBeAssignedAsSalesman(): bool
    {
        return $this->role === UserRole::SALESMAN && $this->isActive();
    }

    /**
     * Determine whether the user is eligible to be assigned as a delivery driver.
     */
    public function canBeAssignedAsDeliveryDriver(): bool
    {
        return $this->role === UserRole::DELIVERY_PARTNER && $this->isActive();
    }
}
