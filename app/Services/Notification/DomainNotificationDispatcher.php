<?php

declare(strict_types=1);

namespace App\Services\Notification;

use App\Enums\UserRole;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class DomainNotificationDispatcher
{
    public function __construct(
        protected NotificationService $notificationService
    ) {}

    /**
     * Notify Admins & Warehouse when a salesman submits an order.
     */
    public function notifyOrderSubmitted(Order $order): void
    {
        $salesmanName = $order->salesman?->name ?? 'Sales Representative';
        $customerName = $order->customer?->name ?? 'Customer';
        $grandTotal = number_format((float) $order->grand_total, 2);

        // 1. Notify Admins
        $this->notificationService->notifyRole(
            role: UserRole::ADMIN,
            type: 'ORDER_SUBMITTED',
            category: 'ORDERS',
            title: "New Order Submitted: {$order->order_number}",
            message: "{$salesmanName} submitted order {$order->order_number} for {$customerName} (\${$grandTotal}). Review required.",
            severity: 'INFO',
            actionUrl: "/admin/orders/{$order->id}",
            metadata: [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'customer_id' => $order->customer_id,
            ],
            deduplicationPrefix: "order_submitted:order:{$order->id}"
        );

        // 2. Notify Warehouse Managers
        $this->notificationService->notifyRole(
            role: UserRole::WAREHOUSE_MANAGER,
            type: 'ORDER_SUBMITTED',
            category: 'ORDERS',
            title: "New Order in Queue: {$order->order_number}",
            message: "New order {$order->order_number} submitted for {$customerName} (\${$grandTotal}).",
            severity: 'INFO',
            actionUrl: "/admin/orders/{$order->id}",
            metadata: [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
            deduplicationPrefix: "order_submitted_wh:order:{$order->id}"
        );
    }

    /**
     * Notify Salesman & Warehouse when an order is approved.
     */
    public function notifyOrderApproved(Order $order): void
    {
        $customerName = $order->customer?->name ?? 'Customer';

        // 1. Notify Salesman
        if ($order->salesman && $order->salesman->isActive()) {
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'ORDER_APPROVED',
                category: 'ORDERS',
                title: "Order Approved: {$order->order_number}",
                message: "Your order {$order->order_number} for {$customerName} has been approved and inventory reserved.",
                severity: 'SUCCESS',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                ],
                deduplicationKey: "order_approved:order:{$order->id}:salesman:{$order->salesman_id}"
            );
        }

        // 2. Notify Warehouse Managers to begin fulfillment
        $this->notificationService->notifyRole(
            role: UserRole::WAREHOUSE_MANAGER,
            type: 'ORDER_READY_FOR_FULFILLMENT',
            category: 'ORDERS',
            title: "Fulfillment Required: {$order->order_number}",
            message: "Order {$order->order_number} for {$customerName} is approved and ready for picking/packing.",
            severity: 'INFO',
            actionUrl: "/admin/warehouse/fulfillment/{$order->id}",
            metadata: [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
            deduplicationPrefix: "order_ready_wh:order:{$order->id}"
        );
    }

    /**
     * Notify Salesman when an order is rejected.
     */
    public function notifyOrderRejected(Order $order, string $reason): void
    {
        if ($order->salesman && $order->salesman->isActive()) {
            $customerName = $order->customer?->name ?? 'Customer';
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'ORDER_REJECTED',
                category: 'ORDERS',
                title: "Order Rejected: {$order->order_number}",
                message: "Order {$order->order_number} for {$customerName} was rejected. Reason: {$reason}",
                severity: 'CRITICAL',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'reason' => $reason,
                ],
                deduplicationKey: "order_rejected:order:{$order->id}"
            );
        }
    }

    /**
     * Notify Salesman & Admins when an order is cancelled.
     */
    public function notifyOrderCancelled(Order $order, string $reason): void
    {
        if ($order->salesman && $order->salesman->isActive()) {
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'ORDER_CANCELLED',
                category: 'ORDERS',
                title: "Order Cancelled: {$order->order_number}",
                message: "Order {$order->order_number} has been cancelled. Reason: {$reason}",
                severity: 'WARNING',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'reason' => $reason,
                ],
                deduplicationKey: "order_cancelled:order:{$order->id}"
            );
        }
    }

    /**
     * Notify Admins & Salesman when an order is dispatched from warehouse.
     */
    public function notifyOrderDispatched(Order $order, ?Delivery $delivery = null): void
    {
        $customerName = $order->customer?->name ?? 'Customer';
        $deliveryNum = $delivery?->delivery_number ?? 'Downstream delivery';

        // 1. Notify Admins
        $this->notificationService->notifyRole(
            role: UserRole::ADMIN,
            type: 'ORDER_DISPATCHED',
            category: 'DELIVERY',
            title: "Order Dispatched: {$order->order_number}",
            message: "Order {$order->order_number} ({$customerName}) dispatched. {$deliveryNum} in pending driver assignment queue.",
            severity: 'INFO',
            actionUrl: '/admin/deliveries?tab=pending',
            metadata: [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'delivery_id' => $delivery?->id,
            ],
            deduplicationPrefix: "order_dispatched:order:{$order->id}"
        );

        // 2. Notify Salesman
        if ($order->salesman && $order->salesman->isActive()) {
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'ORDER_DISPATCHED',
                category: 'DELIVERY',
                title: "Order Dispatched: {$order->order_number}",
                message: "Order {$order->order_number} for {$customerName} has been packed and dispatched from warehouse.",
                severity: 'INFO',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                ],
                deduplicationKey: "order_dispatched_salesman:order:{$order->id}"
            );
        }
    }

    /**
     * Notify Driver & Salesman when a delivery mission is assigned.
     */
    public function notifyDeliveryAssigned(Delivery $delivery): void
    {
        $driver = $delivery->driver;
        $order = $delivery->order;
        $customerName = $delivery->customer?->name ?? 'Customer';

        // 1. Notify Assigned Driver
        if ($driver && $driver->isActive()) {
            $this->notificationService->send(
                recipient: $driver,
                type: 'DELIVERY_ASSIGNED',
                category: 'DELIVERY',
                title: "New Delivery Mission: {$delivery->delivery_number}",
                message: "Delivery {$delivery->delivery_number} assigned for {$customerName}. Scheduled: {$delivery->scheduled_date}.",
                severity: 'INFO',
                actionUrl: "/delivery/{$delivery->id}",
                metadata: [
                    'delivery_id' => $delivery->id,
                    'delivery_number' => $delivery->delivery_number,
                    'scheduled_date' => (string) $delivery->scheduled_date,
                ],
                deduplicationKey: "delivery_assigned:deliv:{$delivery->id}:driver:{$driver->id}"
            );
        }

        // 2. Notify Salesman
        if ($order?->salesman && $order->salesman->isActive()) {
            $driverName = $driver?->name ?? 'Delivery Partner';
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'DELIVERY_ASSIGNED',
                category: 'DELIVERY',
                title: "Driver Assigned: {$delivery->delivery_number}",
                message: "Delivery for order {$order->order_number} ({$customerName}) assigned to driver {$driverName}.",
                severity: 'INFO',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'delivery_id' => $delivery->id,
                    'order_id' => $order->id,
                ],
                deduplicationKey: "delivery_assigned_salesman:deliv:{$delivery->id}"
            );
        }
    }

    /**
     * Notify Salesman when a delivery starts out for delivery.
     */
    public function notifyDeliveryOutForDelivery(Delivery $delivery): void
    {
        $order = $delivery->order;
        $driverName = $delivery->driver?->name ?? 'Delivery Driver';
        $customerName = $delivery->customer?->name ?? 'Customer';

        if ($order?->salesman && $order->salesman->isActive()) {
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'DELIVERY_OUT_FOR_DELIVERY',
                category: 'DELIVERY',
                title: "Out For Delivery: {$order->order_number}",
                message: "Driver {$driverName} is out for delivery for order {$order->order_number} ({$customerName}).",
                severity: 'INFO',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'delivery_id' => $delivery->id,
                    'order_id' => $order->id,
                ],
                deduplicationKey: "delivery_out:deliv:{$delivery->id}"
            );
        }
    }

    /**
     * Notify Salesman, Admin & Accountant when a delivery completes with POD.
     */
    public function notifyDeliveryCompleted(Delivery $delivery): void
    {
        $order = $delivery->order;
        $recipientName = $delivery->recipient_name ?? 'Recipient';
        $customerName = $delivery->customer?->name ?? 'Customer';

        // 1. Notify Salesman
        if ($order?->salesman && $order->salesman->isActive()) {
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'DELIVERY_COMPLETED',
                category: 'DELIVERY',
                title: "Delivered: {$order->order_number}",
                message: "Order {$order->order_number} ({$customerName}) was successfully delivered to {$recipientName}.",
                severity: 'SUCCESS',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'delivery_id' => $delivery->id,
                    'order_id' => $order->id,
                    'recipient_name' => $recipientName,
                ],
                deduplicationKey: "delivery_comp_salesman:deliv:{$delivery->id}"
            );
        }

        // 2. Notify Admins
        $this->notificationService->notifyRole(
            role: UserRole::ADMIN,
            type: 'DELIVERY_COMPLETED',
            category: 'DELIVERY',
            title: "Delivery Completed: {$delivery->delivery_number}",
            message: "Delivery {$delivery->delivery_number} for {$customerName} completed. Received by {$recipientName}.",
            severity: 'SUCCESS',
            actionUrl: "/admin/deliveries/{$delivery->id}",
            metadata: [
                'delivery_id' => $delivery->id,
                'order_id' => $order?->id,
            ],
            deduplicationPrefix: "delivery_comp_admin:deliv:{$delivery->id}"
        );
    }

    /**
     * Notify Admin & Salesman when a delivery fails.
     */
    public function notifyDeliveryFailed(Delivery $delivery, string $reason): void
    {
        $order = $delivery->order;
        $customerName = $delivery->customer?->name ?? 'Customer';

        // 1. Notify Admins
        $this->notificationService->notifyRole(
            role: UserRole::ADMIN,
            type: 'DELIVERY_FAILED',
            category: 'DELIVERY',
            title: "Delivery Failed: {$delivery->delivery_number}",
            message: "Delivery {$delivery->delivery_number} ({$customerName}) failed. Reason: {$reason}. Action required.",
            severity: 'WARNING',
            actionUrl: "/admin/deliveries/{$delivery->id}",
            metadata: [
                'delivery_id' => $delivery->id,
                'order_id' => $order?->id,
                'reason' => $reason,
            ],
            deduplicationPrefix: "delivery_failed_admin:deliv:{$delivery->id}"
        );

        // 2. Notify Salesman
        if ($order?->salesman && $order->salesman->isActive()) {
            $this->notificationService->send(
                recipient: $order->salesman,
                type: 'DELIVERY_FAILED',
                category: 'DELIVERY',
                title: "Delivery Failed: {$order->order_number}",
                message: "Delivery attempt for order {$order->order_number} ({$customerName}) failed. Reason: {$reason}.",
                severity: 'WARNING',
                actionUrl: "/salesman/orders/{$order->id}",
                metadata: [
                    'delivery_id' => $delivery->id,
                    'order_id' => $order->id,
                    'reason' => $reason,
                ],
                deduplicationKey: "delivery_failed_salesman:deliv:{$delivery->id}"
            );
        }
    }

    /**
     * Notify Accountants & Admins when a payment is submitted.
     */
    public function notifyPaymentRecorded(Payment $payment): void
    {
        $customerName = $payment->customer?->name ?? 'Customer';
        $recordedByName = $payment->recordedBy?->name ?? 'Sales Representative';
        $amount = number_format((float) $payment->amount, 2);
        $methodLabel = $payment->payment_method ? $payment->payment_method->label() : 'Payment';

        $this->notificationService->notifyRole(
            role: UserRole::ACCOUNTANT,
            type: 'PAYMENT_RECORDED',
            category: 'PAYMENTS',
            title: "Payment Recorded: {$payment->payment_number}",
            message: "{$recordedByName} recorded {$methodLabel} payment of \${$amount} for {$customerName}. Verification pending.",
            severity: 'INFO',
            actionUrl: '/admin/payments',
            metadata: [
                'payment_id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'amount' => $payment->amount,
            ],
            deduplicationPrefix: "pay_rec_acct:pay:{$payment->id}"
        );
    }

    /**
     * Notify Salesman when a payment is verified.
     */
    public function notifyPaymentVerified(Payment $payment): void
    {
        $recipient = $payment->recordedBy ?? $payment->order?->salesman;
        if ($recipient && $recipient->isActive()) {
            $amount = number_format((float) $payment->amount, 2);
            $customerName = $payment->customer?->name ?? 'Customer';
            $this->notificationService->send(
                recipient: $recipient,
                type: 'PAYMENT_VERIFIED',
                category: 'PAYMENTS',
                title: "Payment Verified: {$payment->payment_number}",
                message: "Payment {$payment->payment_number} (\${$amount}) for {$customerName} has been verified.",
                severity: 'SUCCESS',
                actionUrl: $payment->order_id ? "/salesman/orders/{$payment->order_id}" : '/salesman/payments',
                metadata: [
                    'payment_id' => $payment->id,
                    'payment_number' => $payment->payment_number,
                ],
                deduplicationKey: "pay_ver:pay:{$payment->id}"
            );
        }
    }

    /**
     * Notify Salesman when a payment is rejected.
     */
    public function notifyPaymentRejected(Payment $payment, string $reason): void
    {
        $recipient = $payment->recordedBy ?? $payment->order?->salesman;
        if ($recipient && $recipient->isActive()) {
            $amount = number_format((float) $payment->amount, 2);
            $this->notificationService->send(
                recipient: $recipient,
                type: 'PAYMENT_REJECTED',
                category: 'PAYMENTS',
                title: "Payment Rejected: {$payment->payment_number}",
                message: "Payment {$payment->payment_number} (\${$amount}) was rejected. Reason: {$reason}",
                severity: 'CRITICAL',
                actionUrl: $payment->order_id ? "/salesman/orders/{$payment->order_id}" : '/salesman/payments',
                metadata: [
                    'payment_id' => $payment->id,
                    'payment_number' => $payment->payment_number,
                    'reason' => $reason,
                ],
                deduplicationKey: "pay_rej:pay:{$payment->id}"
            );
        }
    }
}
