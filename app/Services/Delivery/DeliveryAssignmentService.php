<?php

namespace App\Services\Delivery;

use App\Enums\AllocationStatus;
use App\Enums\DeliveryEventType;
use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\DeliveryEvent;
use App\Models\DeliveryItem;
use App\Models\Order;
use App\Models\OrderItemAllocation;
use App\Models\User;
use App\Services\Auth\PermissionService;
use App\Services\Notification\DomainNotificationDispatcher;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class DeliveryAssignmentService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected DeliveryNumberGenerator $numberGenerator,
        protected ?DomainNotificationDispatcher $notificationDispatcher = null,
    ) {
        $this->notificationDispatcher ??= app(DomainNotificationDispatcher::class);
    }

    /**
     * Authoritatively assign an eligible order to an active delivery partner.
     *
     * @param  array{
     *     scheduled_date?: string,
     *     delivery_window?: string|null,
     *     driver_instructions?: string|null,
     *     delivery_contact_name?: string|null,
     *     delivery_contact_phone?: string|null,
     *     delivery_address_line1?: string|null,
     *     delivery_address_line2?: string|null,
     *     delivery_city?: string|null,
     *     delivery_state?: string|null,
     *     delivery_postal_code?: string|null,
     *     delivery_country_code?: string|null,
     * }  $data
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function assignOrder(Order $order, User $driver, User $actor, array $data = []): Delivery
    {
        // 1. Authorization checks
        $this->permissionService->authorize($actor, Permission::DELIVERY_ASSIGN);

        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        if (! $driver->canBeAssignedAsDeliveryDriver()) {
            throw ValidationException::withMessages([
                'driver_id' => 'The selected driver is not active or does not hold the Delivery Partner role.',
            ]);
        }

        $scheduledDate = isset($data['scheduled_date'])
            ? Carbon::parse($data['scheduled_date'])->toDateString()
            : Carbon::today()->toDateString();

        // 2. Transaction with deterministic pessimistic row locking:
        // Order -> Deliveries for Order -> Customer -> Driver
        return DB::transaction(function () use ($order, $driver, $actor, $data, $scheduledDate) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            // Revalidate order eligibility
            if (in_array($lockedOrder->status, [OrderStatus::DRAFT, OrderStatus::CANCELLED, OrderStatus::REJECTED, OrderStatus::COMPLETED], true)) {
                $statusLabel = $lockedOrder->status instanceof OrderStatus ? $lockedOrder->status->label() : (string) $lockedOrder->status;
                throw new ConflictHttpException("Order {$lockedOrder->order_number} is in '{$statusLabel}' status and cannot be assigned for delivery.");
            }

            // Lock customer and revalidate commercial state
            /** @var Customer $lockedCustomer */
            $lockedCustomer = Customer::where('id', $lockedOrder->customer_id)->lockForUpdate()->firstOrFail();
            $lockedCustomer->ensureCanPlaceOrders();

            // Re-read active allocations to determine fulfillable/deliverable items
            $allocations = OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->whereIn('status', [
                    AllocationStatus::ALLOCATED,
                    AllocationStatus::RESERVED,
                    AllocationStatus::PICKED,
                    AllocationStatus::PACKED,
                    AllocationStatus::DISPATCHED,
                ])
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->with(['orderItem', 'product'])
                ->get();

            if ($allocations->isEmpty()) {
                throw ValidationException::withMessages([
                    'order' => "Order {$lockedOrder->order_number} does not have active allocations to deliver.",
                ]);
            }

            // Address snapshot (use custom override or fallback to customer shipping address)
            $contactName = $data['delivery_contact_name'] ?? $lockedCustomer->contact_name ?? $lockedCustomer->name;
            $contactPhone = $data['delivery_contact_phone'] ?? $lockedCustomer->phone;
            $addressLine1 = $data['delivery_address_line1'] ?? $lockedCustomer->shipping_address_line1 ?? $lockedCustomer->billing_address_line1;
            $addressLine2 = $data['delivery_address_line2'] ?? $lockedCustomer->shipping_address_line2 ?? $lockedCustomer->billing_address_line2;
            $city = $data['delivery_city'] ?? $lockedCustomer->shipping_city ?? $lockedCustomer->billing_city;
            $state = $data['delivery_state'] ?? $lockedCustomer->shipping_state ?? $lockedCustomer->billing_state;
            $postalCode = $data['delivery_postal_code'] ?? $lockedCustomer->shipping_postal_code ?? $lockedCustomer->billing_postal_code;
            $countryCode = $data['delivery_country_code'] ?? $lockedCustomer->shipping_country ?? $lockedCustomer->billing_country ?? 'USA';

            if (empty($addressLine1) || empty($city) || empty($state) || empty($postalCode)) {
                throw ValidationException::withMessages([
                    'address' => 'Valid delivery address (street, city, state, postal code) is required to assign delivery.',
                ]);
            }

            // Check if there is an existing un-dispatched delivery for this order to reassign
            /** @var Delivery|null $existingDelivery */
            $existingDelivery = Delivery::where('order_id', $lockedOrder->id)
                ->whereIn('status', [
                    DeliveryStatus::PENDING_ASSIGNMENT->value,
                    DeliveryStatus::ASSIGNED->value,
                    DeliveryStatus::RESCHEDULED->value,
                    DeliveryStatus::RETURNED_TO_WAREHOUSE->value,
                ])
                ->lockForUpdate()
                ->first();

            $isReassignment = false;
            $previousDriverId = null;

            if ($existingDelivery) {
                $isReassignment = true;
                $previousDriverId = $existingDelivery->driver_id;
                $previousStatus = $existingDelivery->status;

                $existingDelivery->driver_id = $driver->id;
                $existingDelivery->status = DeliveryStatus::ASSIGNED;
                $existingDelivery->scheduled_date = $scheduledDate;
                $existingDelivery->delivery_window = $data['delivery_window'] ?? $existingDelivery->delivery_window;
                $existingDelivery->driver_instructions = $data['driver_instructions'] ?? $existingDelivery->driver_instructions;
                $existingDelivery->assigned_at = Carbon::now();
                $existingDelivery->updated_by = $actor->id;
                $existingDelivery->version += 1;
                $existingDelivery->save();

                $delivery = $existingDelivery;

                // Record event
                DeliveryEvent::create([
                    'delivery_id' => $delivery->id,
                    'event_type' => $previousDriverId ? DeliveryEventType::REASSIGNED : DeliveryEventType::ASSIGNED,
                    'from_status' => $previousStatus instanceof DeliveryStatus ? $previousStatus->value : (string) $previousStatus,
                    'to_status' => DeliveryStatus::ASSIGNED->value,
                    'actor_id' => $actor->id,
                    'notes' => $isReassignment && $previousDriverId !== $driver->id
                        ? "Reassigned from driver #{$previousDriverId} to driver {$driver->name} (#{$driver->id})"
                        : "Assigned to driver {$driver->name} (#{$driver->id})",
                    'metadata' => [
                        'driver_id' => $driver->id,
                        'driver_name' => $driver->name,
                        'scheduled_date' => $scheduledDate,
                    ],
                    'created_at' => Carbon::now(),
                ]);
            } else {
                // Create brand new delivery
                $deliveryNumber = $this->numberGenerator->generate();

                $delivery = Delivery::create([
                    'delivery_number' => $deliveryNumber,
                    'order_id' => $lockedOrder->id,
                    'customer_id' => $lockedCustomer->id,
                    'driver_id' => $driver->id,
                    'status' => DeliveryStatus::ASSIGNED,
                    'delivery_contact_name' => $contactName,
                    'delivery_contact_phone' => $contactPhone,
                    'delivery_address_line1' => $addressLine1,
                    'delivery_address_line2' => $addressLine2,
                    'delivery_city' => $city,
                    'delivery_state' => $state,
                    'delivery_postal_code' => $postalCode,
                    'delivery_country_code' => $countryCode,
                    'scheduled_date' => $scheduledDate,
                    'delivery_window' => $data['delivery_window'] ?? 'STANDARD',
                    'driver_instructions' => $data['driver_instructions'] ?? null,
                    'assigned_at' => Carbon::now(),
                    'created_by' => $actor->id,
                    'updated_by' => $actor->id,
                ]);

                // Snapshot deliverable items from active allocations
                foreach ($allocations as $alloc) {
                    $deliverableQty = $alloc->allocated_quantity;
                    if ($deliverableQty <= 0) {
                        continue;
                    }

                    DeliveryItem::create([
                        'delivery_id' => $delivery->id,
                        'order_item_id' => $alloc->order_item_id,
                        'order_item_allocation_id' => $alloc->id,
                        'product_id' => $alloc->product_id,
                        'product_name_snapshot' => $alloc->orderItem?->product_name_snapshot ?? $alloc->product?->name ?? 'Product',
                        'sku_snapshot' => $alloc->orderItem?->sku_snapshot ?? $alloc->product?->sku ?? 'SKU',
                        'deliverable_quantity' => $deliverableQty,
                        'delivered_quantity' => 0,
                        'returned_quantity' => 0,
                    ]);
                }

                // Record initial events
                DeliveryEvent::create([
                    'delivery_id' => $delivery->id,
                    'event_type' => DeliveryEventType::CREATED,
                    'from_status' => null,
                    'to_status' => DeliveryStatus::PENDING_ASSIGNMENT->value,
                    'actor_id' => $actor->id,
                    'notes' => 'Delivery mission created for order ' . $lockedOrder->order_number,
                    'metadata' => ['order_number' => $lockedOrder->order_number],
                    'created_at' => Carbon::now(),
                ]);

                DeliveryEvent::create([
                    'delivery_id' => $delivery->id,
                    'event_type' => DeliveryEventType::ASSIGNED,
                    'from_status' => DeliveryStatus::PENDING_ASSIGNMENT->value,
                    'to_status' => DeliveryStatus::ASSIGNED->value,
                    'actor_id' => $actor->id,
                    'notes' => "Assigned to driver {$driver->name} (#{$driver->id}) for {$scheduledDate}",
                    'metadata' => [
                        'driver_id' => $driver->id,
                        'driver_name' => $driver->name,
                        'scheduled_date' => $scheduledDate,
                    ],
                    'created_at' => Carbon::now(),
                ]);
            }

            // Sync order delivery status
            $lockedOrder->delivery_status = DeliveryStatus::ASSIGNED;
            $lockedOrder->save();

            Log::info('logistics.delivery_event', [
                'action' => $isReassignment ? 'DELIVERY_REASSIGNED' : 'DELIVERY_ASSIGNED',
                'delivery_id' => $delivery->id,
                'delivery_number' => $delivery->delivery_number,
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'driver_id' => $driver->id,
                'driver_name' => $driver->name,
                'actor_id' => $actor->id,
                'scheduled_date' => $scheduledDate,
                'timestamp' => Carbon::now()->toIso8601String(),
            ]);

            // Queue domain notification after transaction commit
            DB::afterCommit(function () use ($delivery) {
                $this->notificationDispatcher->notifyDeliveryAssigned($delivery);
            });

            return $delivery->load(['items', 'driver', 'customer', 'order']);
        }, 3);
    }
}
