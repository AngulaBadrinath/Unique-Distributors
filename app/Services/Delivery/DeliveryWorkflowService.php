<?php

namespace App\Services\Delivery;

use App\Enums\AllocationStatus;
use App\Enums\DeliveryEventType;
use App\Enums\DeliveryFailureReason;
use App\Enums\DeliveryStatus;
use App\Enums\FulfillmentStatus;
use App\Enums\InventoryMovementType;
use App\Enums\OrderStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Delivery;
use App\Models\DeliveryEvent;
use App\Models\DeliveryFailure;
use App\Models\DeliveryItem;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderItemAllocation;
use App\Models\User;
use App\Services\Accounting\JournalMappingService;
use App\Services\Auth\PermissionService;
use App\Services\Invoices\InvoiceGeneratorService;
use App\Services\Inventory\InventoryMovementService;
use App\Services\Inventory\InventoryService;
use App\Services\Notification\DomainNotificationDispatcher;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeliveryWorkflowService
{
    public function __construct(
        protected PermissionService $permissionService,
        protected DeliveryEvidenceService $evidenceService,
        protected InventoryMovementService $movementService,
        protected JournalMappingService $journalMappingService,
        protected ?DomainNotificationDispatcher $notificationDispatcher = null,
        protected ?InvoiceGeneratorService $invoiceGeneratorService = null,
    ) {
        $this->notificationDispatcher ??= app(DomainNotificationDispatcher::class);
        $this->invoiceGeneratorService ??= app(InvoiceGeneratorService::class);
    }

    /**
     * Authoritative Warehouse Pickup Confirmation (FEAT-DEL-003).
     *
     * In Model B, pickup transitions transit custody to the driver.
     * Allocation progression: dispatched_quantity is set to picked_quantity.
     * Order fulfillment_status transitions to DISPATCHED.
     * Physical inventory remains in warehouse reserved balance until DELIVERED.
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws NotFoundHttpException
     */
    public function confirmPickup(Delivery $delivery, User $actor, array $options = []): Delivery
    {
        $this->authorizeDeliveryUpdate($delivery, $actor);

        // Deterministic Lock Hierarchy: Order -> Delivery -> OrderItemAllocations
        return DB::transaction(function () use ($delivery, $actor, $options) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $delivery->order_id)->lockForUpdate()->firstOrFail();

            /** @var Delivery $lockedDelivery */
            $lockedDelivery = Delivery::where('id', $delivery->id)->lockForUpdate()->firstOrFail();

            // Idempotency check: if already PICKED_UP, return latest delivery state cleanly
            if ($lockedDelivery->status === DeliveryStatus::PICKED_UP) {
                return $lockedDelivery->load(['items', 'order', 'customer', 'driver']);
            }

            if (! $lockedDelivery->canBePickedUp()) {
                throw new ConflictHttpException("Delivery {$lockedDelivery->delivery_number} is in '{$lockedDelivery->status->value}' status and cannot be picked up.");
            }

            $now = Carbon::now();

            // Lock and update OrderItemAllocations: synchronize dispatched_quantity = picked_quantity
            $allocations = OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            foreach ($allocations as $alloc) {
                // Invariant: 0 <= dispatched <= picked <= allocated
                if ($alloc->picked_quantity > 0) {
                    $alloc->dispatched_quantity = $alloc->picked_quantity;
                    $alloc->status = AllocationStatus::DISPATCHED;
                    $alloc->save();
                }
            }

            // Update delivery state
            $previousStatus = $lockedDelivery->status;
            $lockedDelivery->status = DeliveryStatus::PICKED_UP;
            $lockedDelivery->picked_up_at = $now;
            $lockedDelivery->updated_by = $actor->id;
            $lockedDelivery->version += 1;
            $lockedDelivery->save();

            // Record immutable event
            DeliveryEvent::create([
                'delivery_id' => $lockedDelivery->id,
                'event_type' => DeliveryEventType::PICKED_UP,
                'from_status' => $previousStatus->value,
                'to_status' => DeliveryStatus::PICKED_UP->value,
                'actor_id' => $actor->id,
                'notes' => $options['notes'] ?? 'Goods picked up from warehouse and custody accepted by driver',
                'metadata' => [
                    'picked_up_at' => $now->toIso8601String(),
                    'driver_id' => $lockedDelivery->driver_id,
                ],
                'created_at' => $now,
            ]);

            // Synchronize order fulfillment status to DISPATCHED
            $lockedOrder->fulfillment_status = FulfillmentStatus::DISPATCHED;
            $lockedOrder->delivery_status = DeliveryStatus::PICKED_UP;
            $lockedOrder->save();

            Log::info('logistics.delivery_pickup', [
                'delivery_id' => $lockedDelivery->id,
                'delivery_number' => $lockedDelivery->delivery_number,
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'driver_id' => $lockedDelivery->driver_id,
                'actor_id' => $actor->id,
                'timestamp' => $now->toIso8601String(),
            ]);

            return $lockedDelivery->load(['items', 'order', 'customer', 'driver']);
        }, 3);
    }

    /**
     * Authoritative Out-for-Delivery State Transition (FEAT-DEL-004).
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws NotFoundHttpException
     */
    public function startRoute(Delivery $delivery, User $actor, array $options = []): Delivery
    {
        $this->authorizeDeliveryUpdate($delivery, $actor);

        return DB::transaction(function () use ($delivery, $actor, $options) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $delivery->order_id)->lockForUpdate()->firstOrFail();

            /** @var Delivery $lockedDelivery */
            $lockedDelivery = Delivery::where('id', $delivery->id)->lockForUpdate()->firstOrFail();

            // Idempotency check
            if ($lockedDelivery->status === DeliveryStatus::OUT_FOR_DELIVERY) {
                return $lockedDelivery->load(['items', 'order', 'customer', 'driver']);
            }

            if (! $lockedDelivery->canStartRoute()) {
                throw new ConflictHttpException("Delivery {$lockedDelivery->delivery_number} is in '{$lockedDelivery->status->value}' status and cannot transition to out-for-delivery. It must be in 'PICKED_UP' status.");
            }

            $now = Carbon::now();
            $previousStatus = $lockedDelivery->status;

            $lockedDelivery->status = DeliveryStatus::OUT_FOR_DELIVERY;
            $lockedDelivery->out_for_delivery_at = $now;
            $lockedDelivery->updated_by = $actor->id;
            $lockedDelivery->version += 1;
            $lockedDelivery->save();

            // Record immutable event
            DeliveryEvent::create([
                'delivery_id' => $lockedDelivery->id,
                'event_type' => DeliveryEventType::OUT_FOR_DELIVERY,
                'from_status' => $previousStatus->value,
                'to_status' => DeliveryStatus::OUT_FOR_DELIVERY->value,
                'actor_id' => $actor->id,
                'notes' => $options['notes'] ?? 'Driver has departed with shipment and is en route to destination',
                'metadata' => [
                    'out_for_delivery_at' => $now->toIso8601String(),
                    'driver_id' => $lockedDelivery->driver_id,
                ],
                'created_at' => $now,
            ]);

            // Sync order delivery status
            $lockedOrder->delivery_status = DeliveryStatus::OUT_FOR_DELIVERY;
            $lockedOrder->save();

            Log::info('logistics.delivery_start_route', [
                'delivery_id' => $lockedDelivery->id,
                'delivery_number' => $lockedDelivery->delivery_number,
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'driver_id' => $lockedDelivery->driver_id,
                'actor_id' => $actor->id,
                'timestamp' => $now->toIso8601String(),
            ]);

            // Queue domain notification after transaction commit
            DB::afterCommit(function () use ($lockedDelivery) {
                $this->notificationDispatcher->notifyDeliveryOutForDelivery($lockedDelivery);
            });

            return $lockedDelivery->load(['items', 'order', 'customer', 'driver']);
        }, 3);
    }

    /**
     * Authoritative Delivery Completion and Proof of Delivery (FEAT-DEL-005).
     *
     * In Model B, physical warehouse inventory is relieved when delivery completes:
     * - on_hand -= Q, reserved -= Q
     * - Writes DISPATCH inventory movement
     * - Synchronizes OrderItemAllocation delivered_quantity
     * - Sets order fulfillment_status to DELIVERED
     *
     * @param  array{
     *     recipient_name: string,
     *     pod_notes?: string|null,
     *     pod_evidence?: UploadedFile|string|null,
     *     recipient_signature?: UploadedFile|string|null,
     * }  $data
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function completeDelivery(Delivery $delivery, User $actor, array $data): Delivery
    {
        $this->authorizeDeliveryUpdate($delivery, $actor);

        if (empty($data['recipient_name'])) {
            throw ValidationException::withMessages([
                'recipient_name' => 'Recipient name is strictly required to complete delivery.',
            ]);
        }

        // Process file uploads if present
        $podPath = null;
        if (isset($data['pod_evidence']) && $data['pod_evidence'] instanceof UploadedFile) {
            $podPath = $this->evidenceService->storePodEvidence($data['pod_evidence'], $delivery->id);
        } elseif (is_string($data['pod_evidence'] ?? null)) {
            $podPath = $data['pod_evidence'];
        }

        $signaturePath = null;
        if (isset($data['recipient_signature']) && $data['recipient_signature'] instanceof UploadedFile) {
            $signaturePath = $this->evidenceService->storeSignature($data['recipient_signature'], $delivery->id);
        } elseif (is_string($data['recipient_signature'] ?? null)) {
            $signaturePath = $data['recipient_signature'];
        }

        // Deterministic Lock Hierarchy: Order -> Delivery -> Allocations -> InventoryBalances
        return DB::transaction(function () use ($delivery, $actor, $data, $podPath, $signaturePath) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $delivery->order_id)->lockForUpdate()->firstOrFail();

            /** @var Delivery $lockedDelivery */
            $lockedDelivery = Delivery::where('id', $delivery->id)->lockForUpdate()->firstOrFail();

            // Idempotency: If already DELIVERED, return authoritative state without double-deduction
            if ($lockedDelivery->status === DeliveryStatus::DELIVERED) {
                return $lockedDelivery->load(['items', 'order', 'customer', 'driver']);
            }

            if (! $lockedDelivery->canBeCompleted()) {
                throw new ConflictHttpException("Delivery {$lockedDelivery->delivery_number} is in '{$lockedDelivery->status->value}' status and cannot be completed. It must be in 'OUT_FOR_DELIVERY' status.");
            }

            $now = Carbon::now();
            $previousStatus = $lockedDelivery->status;

            // Lock delivery items and allocations
            $deliveryItems = DeliveryItem::where('delivery_id', $lockedDelivery->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            $allocations = OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            $allocationsMap = $allocations->keyBy('id');

            foreach ($deliveryItems as $item) {
                $deliverableQty = $item->deliverable_quantity;
                $item->delivered_quantity = $deliverableQty;
                $item->save();

                /** @var OrderItemAllocation|null $alloc */
                $alloc = $item->order_item_allocation_id
                    ? ($allocationsMap[$item->order_item_allocation_id] ?? null)
                    : $allocations->where('order_item_id', $item->order_item_id)->first();

                if ($alloc) {
                    $alloc->delivered_quantity = $deliverableQty;
                    $alloc->status = AllocationStatus::DELIVERED;
                    $alloc->save();

                    // Relieve physical warehouse inventory: on_hand -= Q, reserved -= Q
                    $warehouseId = null;
                    if (! empty($alloc->warehouse_code)) {
                        $warehouseId = \App\Models\Warehouse::where('code', $alloc->warehouse_code)->value('id');
                    }
                    if (! $warehouseId) {
                        $warehouseId = \App\Models\InventoryBalance::where('product_id', $item->product_id)->value('warehouse_id')
                            ?? \App\Models\Warehouse::where('is_default', true)->value('id')
                            ?? \App\Models\Warehouse::value('id');
                    }

                    if ($warehouseId && $deliverableQty > 0) {
                        /** @var InventoryBalance|null $balance */
                        $balance = InventoryBalance::where('warehouse_id', $warehouseId)
                            ->where('product_id', $item->product_id)
                            ->lockForUpdate()
                            ->first();

                        if ($balance) {
                            $onHandBefore = $balance->on_hand_quantity;
                            $reservedBefore = $balance->reserved_quantity;
                            $availableBefore = $balance->available_quantity;
                            $damagedBefore = $balance->damaged_quantity;

                            $balance->on_hand_quantity = max(0, $balance->on_hand_quantity - $deliverableQty);
                            $balance->reserved_quantity = max(0, $balance->reserved_quantity - $deliverableQty);
                            $balance->available_quantity = max(0, $balance->on_hand_quantity - $balance->reserved_quantity);
                            $balance->version += 1;
                            $balance->save();

                            $this->movementService->recordMovement([
                                'warehouse_id' => $balance->warehouse_id,
                                'product_id' => $balance->product_id,
                                'inventory_balance_id' => $balance->id,
                                'movement_type' => InventoryMovementType::DISPATCH,
                                'from_state' => \App\Enums\InventoryStockState::RESERVED,
                                'to_state' => \App\Enums\InventoryStockState::DISPATCHED,
                                'quantity' => $deliverableQty,
                                'on_hand_before' => $onHandBefore,
                                'on_hand_after' => $balance->on_hand_quantity,
                                'reserved_before' => $reservedBefore,
                                'reserved_after' => $balance->reserved_quantity,
                                'available_before' => $availableBefore,
                                'available_after' => $balance->available_quantity,
                                'damaged_before' => $damagedBefore,
                                'damaged_after' => $damagedBefore,
                                'reference_type' => 'App\\Models\\Delivery',
                                'reference_id' => $lockedDelivery->id,
                                'reference_number' => $lockedDelivery->delivery_number,
                                'notes' => "Physical stock relieved on delivery completion to {$data['recipient_name']}",
                                'actor_id' => $actor->id,
                            ]);
                        }
                    }
                }
            }

            // Update delivery record
            $lockedDelivery->status = DeliveryStatus::DELIVERED;
            $lockedDelivery->delivered_at = $now;
            $lockedDelivery->recipient_name = $data['recipient_name'];
            if ($podPath) {
                $lockedDelivery->pod_evidence_path = $podPath;
            }
            if ($signaturePath) {
                $lockedDelivery->recipient_signature_path = $signaturePath;
            }
            if (isset($data['pod_notes'])) {
                $lockedDelivery->pod_notes = $data['pod_notes'];
            }
            $lockedDelivery->updated_by = $actor->id;
            $lockedDelivery->version += 1;
            $lockedDelivery->save();

            // Record immutable event
            DeliveryEvent::create([
                'delivery_id' => $lockedDelivery->id,
                'event_type' => DeliveryEventType::DELIVERED,
                'from_status' => $previousStatus->value,
                'to_status' => DeliveryStatus::DELIVERED->value,
                'actor_id' => $actor->id,
                'notes' => "Delivery completed successfully. Received by: {$data['recipient_name']}" . (! empty($data['pod_notes']) ? " (Notes: {$data['pod_notes']})" : ''),
                'metadata' => [
                    'recipient_name' => $data['recipient_name'],
                    'pod_evidence_path' => $podPath,
                    'recipient_signature_path' => $signaturePath,
                    'delivered_at' => $now->toIso8601String(),
                ],
                'created_at' => $now,
            ]);

            // Sync order completion
            $lockedOrder->fulfillment_status = FulfillmentStatus::DELIVERED;
            $lockedOrder->delivery_status = DeliveryStatus::DELIVERED;
            $lockedOrder->save();

            // Post authoritative COGS to General Ledger
            $this->journalMappingService->postOrderDeliveredCogs($lockedOrder, $actor);

            // Synchronize payment and settlement on invoice if applicable
            $this->invoiceGeneratorService->syncOnPaymentVerified($lockedOrder, $actor);

            Log::info('logistics.delivery_complete', [
                'delivery_id' => $lockedDelivery->id,
                'delivery_number' => $lockedDelivery->delivery_number,
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'recipient_name' => $data['recipient_name'],
                'driver_id' => $lockedDelivery->driver_id,
                'actor_id' => $actor->id,
                'timestamp' => $now->toIso8601String(),
            ]);

            // Queue domain notification after transaction commit
            DB::afterCommit(function () use ($lockedDelivery) {
                $this->notificationDispatcher->notifyDeliveryCompleted($lockedDelivery);
            });

            return $lockedDelivery->load(['items', 'order', 'customer', 'driver']);
        }, 3);
    }

    /**
     * Authoritative Delivery Failure Logging (FEAT-DEL-006).
     *
     * In Model B, recording a delivery failure transitions status to FAILED.
     * Physical warehouse inventory balance remains unchanged (still reserved in warehouse balance).
     *
     * @param  array{
     *     failure_reason: DeliveryFailureReason|string,
     *     driver_notes: string,
     * }  $data
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function recordFailure(Delivery $delivery, User $actor, array $data): Delivery
    {
        $this->authorizeDeliveryUpdate($delivery, $actor);

        if (empty($data['failure_reason'])) {
            throw ValidationException::withMessages([
                'failure_reason' => 'Authoritative failure reason is strictly required.',
            ]);
        }

        if (empty($data['driver_notes'])) {
            throw ValidationException::withMessages([
                'driver_notes' => 'Driver explanation notes are required when reporting a delivery failure.',
            ]);
        }

        $failureReason = $data['failure_reason'] instanceof DeliveryFailureReason
            ? $data['failure_reason']
            : DeliveryFailureReason::from($data['failure_reason']);

        return DB::transaction(function () use ($delivery, $actor, $failureReason, $data) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $delivery->order_id)->lockForUpdate()->firstOrFail();

            /** @var Delivery $lockedDelivery */
            $lockedDelivery = Delivery::where('id', $delivery->id)->lockForUpdate()->firstOrFail();

            // Idempotency: If already FAILED, return latest state cleanly
            if ($lockedDelivery->status === DeliveryStatus::FAILED) {
                return $lockedDelivery->load(['items', 'order', 'customer', 'driver', 'failures', 'events']);
            }

            if (! $lockedDelivery->canBeFailed()) {
                throw new ConflictHttpException("Delivery {$lockedDelivery->delivery_number} is in '{$lockedDelivery->status->value}' status and cannot be marked as failed.");
            }

            $now = Carbon::now();
            $previousStatus = $lockedDelivery->status;

            // Update delivery record
            $lockedDelivery->status = DeliveryStatus::FAILED;
            $lockedDelivery->failed_at = $now;
            $lockedDelivery->updated_by = $actor->id;
            $lockedDelivery->version += 1;
            $lockedDelivery->save();

            // Record structured failure record
            DeliveryFailure::create([
                'delivery_id' => $lockedDelivery->id,
                'failure_reason' => $failureReason,
                'driver_notes' => $data['driver_notes'],
                'driver_id' => $lockedDelivery->driver_id ?? $actor->id,
                'reported_at' => $now,
            ]);

            // Record immutable tracking event
            DeliveryEvent::create([
                'delivery_id' => $lockedDelivery->id,
                'event_type' => DeliveryEventType::FAILED,
                'from_status' => $previousStatus->value,
                'to_status' => DeliveryStatus::FAILED->value,
                'actor_id' => $actor->id,
                'notes' => "Delivery failed: {$failureReason->label()}. Notes: {$data['driver_notes']}",
                'metadata' => [
                    'failure_reason' => $failureReason->value,
                    'driver_notes' => $data['driver_notes'],
                    'reported_at' => $now->toIso8601String(),
                ],
                'created_at' => $now,
            ]);

            // Synchronize order delivery status
            $lockedOrder->delivery_status = DeliveryStatus::FAILED;
            $lockedOrder->save();

            Log::warning('logistics.delivery_failed', [
                'delivery_id' => $lockedDelivery->id,
                'delivery_number' => $lockedDelivery->delivery_number,
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'failure_reason' => $failureReason->value,
                'driver_id' => $lockedDelivery->driver_id,
                'actor_id' => $actor->id,
                'timestamp' => $now->toIso8601String(),
            ]);

            // Queue domain notification after transaction commit
            DB::afterCommit(function () use ($lockedDelivery, $failureReason, $data) {
                $this->notificationDispatcher->notifyDeliveryFailed($lockedDelivery, $failureReason->label() . ': ' . $data['driver_notes']);
            });

            return $lockedDelivery->load(['items', 'order', 'customer', 'driver', 'failures', 'events']);
        }, 3);
    }

    /**
     * Authoritative Delivery Reschedule Workflow (FEAT-DEL-007).
     *
     * @param  array{
     *     scheduled_date: string,
     *     delivery_window?: string|null,
     *     notes?: string|null,
     * }  $data
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     * @throws ValidationException
     */
    public function reschedule(Delivery $delivery, User $actor, array $data): Delivery
    {
        $this->authorizeDeliveryUpdate($delivery, $actor);

        if (empty($data['scheduled_date'])) {
            throw ValidationException::withMessages([
                'scheduled_date' => 'Rescheduled delivery date is strictly required.',
            ]);
        }

        return DB::transaction(function () use ($delivery, $actor, $data) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $delivery->order_id)->lockForUpdate()->firstOrFail();

            /** @var Delivery $lockedDelivery */
            $lockedDelivery = Delivery::where('id', $delivery->id)->lockForUpdate()->firstOrFail();

            if (! $lockedDelivery->canBeRescheduled()) {
                throw new ConflictHttpException("Delivery {$lockedDelivery->delivery_number} is in '{$lockedDelivery->status->value}' status and cannot be rescheduled.");
            }

            $now = Carbon::now();
            $previousStatus = $lockedDelivery->status;
            $newDate = Carbon::parse($data['scheduled_date']);

            $lockedDelivery->status = DeliveryStatus::RESCHEDULED;
            $lockedDelivery->scheduled_date = $newDate;
            if (! empty($data['delivery_window'])) {
                $lockedDelivery->delivery_window = $data['delivery_window'];
            }
            $lockedDelivery->updated_by = $actor->id;
            $lockedDelivery->version += 1;
            $lockedDelivery->save();

            // Record immutable event
            DeliveryEvent::create([
                'delivery_id' => $lockedDelivery->id,
                'event_type' => DeliveryEventType::RESCHEDULED,
                'from_status' => $previousStatus->value,
                'to_status' => DeliveryStatus::RESCHEDULED->value,
                'actor_id' => $actor->id,
                'notes' => "Delivery rescheduled to {$newDate->toDateString()}" . (! empty($data['notes']) ? " - {$data['notes']}" : ''),
                'metadata' => [
                    'previous_date' => $lockedDelivery->getOriginal('scheduled_date')?->toDateString(),
                    'new_scheduled_date' => $newDate->toDateString(),
                    'delivery_window' => $data['delivery_window'] ?? null,
                    'notes' => $data['notes'] ?? null,
                ],
                'created_at' => $now,
            ]);

            // Sync order delivery status
            $lockedOrder->delivery_status = DeliveryStatus::RESCHEDULED;
            $lockedOrder->save();

            Log::info('logistics.delivery_rescheduled', [
                'delivery_id' => $lockedDelivery->id,
                'delivery_number' => $lockedDelivery->delivery_number,
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'new_scheduled_date' => $newDate->toDateString(),
                'actor_id' => $actor->id,
            ]);

            return $lockedDelivery->load(['items', 'order', 'customer', 'driver', 'failures', 'events']);
        }, 3);
    }

    /**
     * Authoritative Return to Warehouse Workflow (FEAT-DEL-007).
     *
     * In Model B:
     * - Physical inventory was never deducted from warehouse balance during transit (custody was with driver).
     * - Returning custody to the warehouse resets dispatched_quantity to 0 on allocations.
     * - Stock remains safely in the warehouse reserved balance (no double restock, no double deduction).
     * - Unresolved failures are marked resolved with 'RETURNED_TO_WAREHOUSE'.
     *
     * @param  array{notes?: string|null}  $options
     *
     * @throws AuthorizationException
     * @throws ConflictHttpException
     */
    public function returnToWarehouse(Delivery $delivery, User $actor, array $options = []): Delivery
    {
        $this->authorizeDeliveryUpdate($delivery, $actor);

        // Deterministic Lock Hierarchy: Order -> Delivery -> Allocations
        return DB::transaction(function () use ($delivery, $actor, $options) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::where('id', $delivery->order_id)->lockForUpdate()->firstOrFail();

            /** @var Delivery $lockedDelivery */
            $lockedDelivery = Delivery::where('id', $delivery->id)->lockForUpdate()->firstOrFail();

            // Idempotency: If already RETURNED_TO_WAREHOUSE, return authoritative state
            if ($lockedDelivery->status === DeliveryStatus::RETURNED_TO_WAREHOUSE) {
                return $lockedDelivery->load(['items', 'order', 'customer', 'driver', 'failures', 'events']);
            }

            if (! $lockedDelivery->canBeReturnedToWarehouse()) {
                throw new ConflictHttpException("Delivery {$lockedDelivery->delivery_number} is in '{$lockedDelivery->status->value}' status and cannot be returned to warehouse.");
            }

            $now = Carbon::now();
            $previousStatus = $lockedDelivery->status;

            // Reset dispatched allocations
            $allocations = OrderItemAllocation::where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->orderBy('id', 'asc')
                ->get();

            foreach ($allocations as $alloc) {
                $alloc->dispatched_quantity = 0;
                $alloc->status = AllocationStatus::ALLOCATED;
                $alloc->save();
            }

            // Update delivery record
            $lockedDelivery->status = DeliveryStatus::RETURNED_TO_WAREHOUSE;
            $lockedDelivery->returned_at = $now;
            $lockedDelivery->updated_by = $actor->id;
            $lockedDelivery->version += 1;
            $lockedDelivery->save();

            // Mark any pending failures as resolved by warehouse return
            DeliveryFailure::where('delivery_id', $lockedDelivery->id)
                ->whereNull('resolved_at')
                ->update([
                    'resolved_at' => $now,
                    'resolution_action' => 'RETURNED_TO_WAREHOUSE',
                    'resolved_by' => $actor->id,
                ]);

            // Record immutable event
            DeliveryEvent::create([
                'delivery_id' => $lockedDelivery->id,
                'event_type' => DeliveryEventType::RETURNED_TO_WAREHOUSE,
                'from_status' => $previousStatus->value,
                'to_status' => DeliveryStatus::RETURNED_TO_WAREHOUSE->value,
                'actor_id' => $actor->id,
                'notes' => $options['notes'] ?? 'Goods safely returned to warehouse inventory custody',
                'metadata' => [
                    'returned_at' => $now->toIso8601String(),
                    'notes' => $options['notes'] ?? null,
                ],
                'created_at' => $now,
            ]);

            // Synchronize order fulfillment and delivery statuses
            $lockedOrder->fulfillment_status = FulfillmentStatus::RESERVED;
            $lockedOrder->delivery_status = DeliveryStatus::RETURNED_TO_WAREHOUSE;
            $lockedOrder->save();

            Log::info('logistics.delivery_returned_to_warehouse', [
                'delivery_id' => $lockedDelivery->id,
                'delivery_number' => $lockedDelivery->delivery_number,
                'order_id' => $lockedOrder->id,
                'order_number' => $lockedOrder->order_number,
                'actor_id' => $actor->id,
                'timestamp' => $now->toIso8601String(),
            ]);

            return $lockedDelivery->load(['items', 'order', 'customer', 'driver', 'failures', 'events']);
        }, 3);
    }

    /**
     * Authorize that the actor is either the assigned delivery driver or a privileged admin.
     *
     * @throws AuthorizationException
     * @throws NotFoundHttpException
     */
    protected function authorizeDeliveryUpdate(Delivery $delivery, User $actor): void
    {
        if (! $actor->isActive()) {
            throw new AuthorizationException('Your account is not active.');
        }

        // Fail-Closed Anti-IDOR for Delivery Partners
        if ($actor->role === UserRole::DELIVERY_PARTNER) {
            if ($delivery->driver_id !== $actor->id) {
                throw new NotFoundHttpException('Delivery mission not found.');
            }
        } else {
            // Admin / Privileged role requires delivery.update permission
            $this->permissionService->authorize($actor, Permission::DELIVERY_UPDATE);
        }
    }
}
