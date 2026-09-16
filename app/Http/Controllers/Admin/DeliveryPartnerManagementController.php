<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\DeliveryPartner\StoreDeliveryPartnerRequest;
use App\Http\Requests\DeliveryPartner\UpdateDeliveryPartnerRequest;
use App\Http\Requests\DeliveryPartner\UpdateDeliveryPartnerStatusRequest;
use App\Models\User;
use App\Services\Delivery\DeliveryPartnerService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryPartnerManagementController extends Controller
{
    public function __construct(
        protected DeliveryPartnerService $deliveryPartnerService
    ) {}

    /**
     * Display a paginated listing of delivery partner accounts.
     */
    public function index(Request $request): Response
    {
        $actor = $request->user();

        if (! $actor->canPermission(Permission::USER_VIEW)) {
            abort(403, 'You do not have permission to view delivery partners.');
        }

        $filters = $request->only(['search', 'status', 'sort', 'direction']);
        $paginator = $this->deliveryPartnerService->paginate($filters);

        $deliveryPartners = $paginator->through(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status instanceof AccountStatus ? $user->status->value : $user->status,
            'status_label' => $user->status instanceof AccountStatus ? $user->status->label() : (string) $user->status,
            'can_authenticate' => $user->canAuthenticate(),
            'can_be_assigned' => $user->canBeAssignedAsDeliveryDriver(),
            'assigned_deliveries_count' => $user->assigned_deliveries_count ?? 0,
            'created_at' => $user->created_at?->toIso8601String(),
        ]);

        $statuses = collect(AccountStatus::cases())->map(fn (AccountStatus $s) => [
            'value' => $s->value,
            'label' => $s->label(),
            'description' => $s->description(),
        ]);

        return Inertia::render('Admin/DeliveryPartners/Index', [
            'deliveryPartners' => $deliveryPartners,
            'filters' => $filters,
            'statuses' => $statuses,
        ]);
    }

    /**
     * Show the form for provisioning a new delivery partner account.
     */
    public function create(Request $request): Response
    {
        $actor = $request->user();

        if (! $actor->canPermission(Permission::USER_CREATE)) {
            abort(403, 'You do not have permission to provision delivery partner accounts.');
        }

        $statuses = collect([AccountStatus::ACTIVE, AccountStatus::INVITED])->map(fn (AccountStatus $s) => [
            'value' => $s->value,
            'label' => $s->label(),
            'description' => $s->description(),
        ]);

        return Inertia::render('Admin/DeliveryPartners/Create', [
            'statuses' => $statuses,
        ]);
    }

    /**
     * Store a newly provisioned delivery partner account.
     */
    public function store(StoreDeliveryPartnerRequest $request): RedirectResponse
    {
        $actor = $request->user();

        $driver = $this->deliveryPartnerService->createDeliveryPartner($actor, $request->validated());

        return redirect()->route('admin.delivery-partners.show', $driver->id)
            ->with('status', "Delivery partner account for {$driver->name} was provisioned successfully.");
    }

    /**
     * Display the specified delivery partner profile and performance metrics.
     */
    public function show(Request $request, User $driver): Response
    {
        $actor = $request->user();

        if (! $actor->canPermission(Permission::USER_VIEW)) {
            abort(403, 'You do not have permission to view this delivery partner.');
        }

        if ($driver->role !== UserRole::DELIVERY_PARTNER) {
            abort(404, 'Delivery partner account not found.');
        }

        $profileData = $this->deliveryPartnerService->getProfile($driver);

        $statuses = collect(AccountStatus::cases())->map(fn (AccountStatus $s) => [
            'value' => $s->value,
            'label' => $s->label(),
            'description' => $s->description(),
            'can_transition' => $driver->status instanceof AccountStatus ? $driver->status->canTransitionTo($s) : false,
        ]);

        return Inertia::render('Admin/DeliveryPartners/Show', [
            'driver' => $profileData['driver'],
            'counts' => $profileData['counts'],
            'recent_deliveries' => $profileData['recent_deliveries'],
            'statuses' => $statuses,
            'canEdit' => $actor->canPermission(Permission::USER_UPDATE),
            'canSuspend' => $actor->canPermission(Permission::USER_SUSPEND) && $actor->id !== $driver->id,
        ]);
    }

    /**
     * Show the form for editing the specified delivery partner profile.
     */
    public function edit(Request $request, User $driver): Response
    {
        $actor = $request->user();

        if (! $actor->canPermission(Permission::USER_UPDATE)) {
            abort(403, 'You do not have permission to edit this delivery partner.');
        }

        if ($driver->role !== UserRole::DELIVERY_PARTNER) {
            abort(404, 'Delivery partner account not found.');
        }

        return Inertia::render('Admin/DeliveryPartners/Edit', [
            'driver' => [
                'id' => $driver->id,
                'name' => $driver->name,
                'email' => $driver->email,
                'status' => $driver->status instanceof AccountStatus ? $driver->status->value : (string) $driver->status,
                'created_at' => $driver->created_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Update the specified delivery partner profile in storage.
     */
    public function update(UpdateDeliveryPartnerRequest $request, User $driver): RedirectResponse
    {
        $actor = $request->user();

        $this->deliveryPartnerService->updateDeliveryPartner($actor, $driver, $request->validated());

        return redirect()->route('admin.delivery-partners.show', $driver->id)
            ->with('status', "Delivery partner profile for {$driver->name} was updated successfully.");
    }

    /**
     * Update the lifecycle status of a delivery partner account.
     */
    public function updateStatus(UpdateDeliveryPartnerStatusRequest $request, User $driver): RedirectResponse
    {
        $actor = $request->user();
        $targetStatus = AccountStatus::from($request->validated('status'));
        $reason = $request->validated('reason');

        $this->deliveryPartnerService->updateStatus($actor, $driver, $targetStatus, $reason);

        $actionLabel = match ($targetStatus) {
            AccountStatus::ACTIVE => 'activated',
            AccountStatus::SUSPENDED => 'suspended',
            AccountStatus::DISABLED => 'disabled',
            AccountStatus::INVITED => 'placed in invited state',
        };

        return redirect()->route('admin.delivery-partners.show', $driver->id)
            ->with('status', "Delivery partner account for {$driver->name} was {$actionLabel} successfully.");
    }
}
