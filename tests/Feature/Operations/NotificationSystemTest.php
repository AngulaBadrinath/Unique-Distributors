<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use App\DTOs\Order\CreateOrderDTO;
use App\DTOs\Order\CreateOrderItemDTO;
use App\Enums\AccountStatus;
use App\Enums\CustomerStatus;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\InAppNotification;
use App\Models\InventoryBalance;
use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Delivery\DeliveryAssignmentService;
use App\Services\Notification\NotificationService;
use App\Services\Order\OrderService;
use App\Services\Order\OrderWorkflowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class NotificationSystemTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $salesman;
    private User $otherSalesman;
    private User $warehouseManager;
    private User $driver;
    private Customer $customer;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create([
            'name' => 'Admin User',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->salesman = User::factory()->salesman()->create([
            'name' => 'Sam Salesman',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->otherSalesman = User::factory()->salesman()->create([
            'name' => 'Oliver Other',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->warehouseManager = User::factory()->warehouseManager()->create([
            'name' => 'Walter Warehouse',
            'status' => AccountStatus::ACTIVE,
        ]);

        $this->driver = User::factory()->deliveryPartner()->create([
            'name' => 'Dan Driver',
            'status' => AccountStatus::ACTIVE,
        ]);

        Warehouse::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Hub',
                'address_line1' => '100 Hub St',
                'city' => 'City',
                'state' => 'NY',
                'postal_code' => '10001',
                'country_code' => 'USA',
                'is_active' => true,
                'is_default' => true,
            ]
        );

        $this->customer = Customer::create([
            'salesman_id' => $this->salesman->id,
            'name' => 'Apex Retailers',
            'code' => 'CUST-APX-01',
            'contact_name' => 'Arthur Apex',
            'phone' => '555-1234',
            'status' => CustomerStatus::ACTIVE,
            'billing_address_line1' => '100 Retail Ave',
            'billing_city' => 'New York',
            'billing_state' => 'NY',
            'billing_postal_code' => '10001',
            'shipping_address_line1' => '100 Retail Ave',
            'shipping_city' => 'New York',
            'shipping_state' => 'NY',
            'shipping_postal_code' => '10001',
            'credit_limit' => 50000.00,
            'payment_terms' => 'NET_30',
        ]);

        $taxProfile = TaxProfile::create([
            'code' => 'TAX-STD',
            'name' => 'Standard Rate',
            'rate' => 0.05,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'sku' => 'SKU-NOTIF-01',
            'name' => 'Premium Coffee Blend 1kg',
            'unit' => 'BAG',
            'cost_price' => 8.00,
            'default_selling_price' => 15.00,
            'mrp' => 20.00,
            'minimum_allowed_price' => 12.00,
            'tax_profile_id' => $taxProfile->id,
            'status' => 'ACTIVE',
        ]);

        $warehouse = Warehouse::where('code', 'MAIN')->first();
        InventoryBalance::updateOrCreate(
            [
                'product_id' => $this->product->id,
                'warehouse_id' => $warehouse->id,
            ],
            [
                'on_hand_quantity' => 1000,
                'reserved_quantity' => 0,
                'available_quantity' => 1000,
                'damaged_quantity' => 0,
            ]
        );
    }

    public function test_guest_cannot_access_notification_endpoints(): void
    {
        $this->getJson('/notifications/feed')->assertUnauthorized();
        $this->getJson('/notifications/unread-count')->assertUnauthorized();
        $this->postJson('/notifications/read-all')->assertUnauthorized();
        $this->postJson('/notifications/1/read')->assertUnauthorized();
    }

    public function test_user_receives_in_app_notification_feed_with_unread_count(): void
    {
        // Create 2 unread notifications and 1 read notification for salesman
        InAppNotification::create([
            'user_id' => $this->salesman->id,
            'type' => 'TEST_NOTIF_1',
            'category' => 'ORDERS',
            'title' => 'Test Notification 1',
            'message' => 'Message 1',
            'severity' => 'INFO',
            'action_url' => '/salesman/orders/1',
            'is_read' => false,
        ]);

        InAppNotification::create([
            'user_id' => $this->salesman->id,
            'type' => 'TEST_NOTIF_2',
            'category' => 'ORDERS',
            'title' => 'Test Notification 2',
            'message' => 'Message 2',
            'severity' => 'SUCCESS',
            'action_url' => '/salesman/orders/2',
            'is_read' => false,
        ]);

        InAppNotification::create([
            'user_id' => $this->salesman->id,
            'type' => 'TEST_NOTIF_READ',
            'category' => 'ORDERS',
            'title' => 'Test Read',
            'message' => 'Read Message',
            'severity' => 'INFO',
            'is_read' => true,
            'read_at' => now(),
        ]);

        // Query feed as salesman
        $response = $this->actingAs($this->salesman)->getJson('/notifications/feed');

        $response->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonCount(3, 'notifications');

        // Verify unread count endpoint
        $countResponse = $this->actingAs($this->salesman)->getJson('/notifications/unread-count');
        $countResponse->assertOk()
            ->assertJson(['unread_count' => 2]);
    }

    public function test_user_can_mark_single_notification_as_read(): void
    {
        $notif = InAppNotification::create([
            'user_id' => $this->salesman->id,
            'type' => 'TEST_NOTIF',
            'category' => 'ORDERS',
            'title' => 'Unread Notice',
            'message' => 'Unread message content',
            'severity' => 'INFO',
            'is_read' => false,
        ]);

        $response = $this->actingAs($this->salesman)->postJson("/notifications/{$notif->id}/read");

        $response->assertOk()
            ->assertJson(['success' => true]);

        $this->assertTrue($notif->fresh()->is_read);
        $this->assertNotNull($notif->fresh()->read_at);
    }

    public function test_user_cannot_mark_another_users_notification_as_read(): void
    {
        $notif = InAppNotification::create([
            'user_id' => $this->salesman->id,
            'type' => 'TEST_NOTIF',
            'category' => 'ORDERS',
            'title' => 'Private Salesman Notice',
            'message' => 'Private message content',
            'severity' => 'INFO',
            'is_read' => false,
        ]);

        // Other salesman attempts to mark it as read (Anti-IDOR)
        $response = $this->actingAs($this->otherSalesman)->postJson("/notifications/{$notif->id}/read");

        $response->assertNotFound();
        $this->assertFalse($notif->fresh()->is_read);
    }

    public function test_user_can_mark_all_notifications_as_read(): void
    {
        InAppNotification::create([
            'user_id' => $this->salesman->id,
            'type' => 'TEST_1',
            'category' => 'ORDERS',
            'title' => 'Notice 1',
            'message' => 'Msg 1',
            'severity' => 'INFO',
            'is_read' => false,
        ]);

        InAppNotification::create([
            'user_id' => $this->salesman->id,
            'type' => 'TEST_2',
            'category' => 'DELIVERY',
            'title' => 'Notice 2',
            'message' => 'Msg 2',
            'severity' => 'INFO',
            'is_read' => false,
        ]);

        // Other user's unread notification must remain untouched
        $otherNotif = InAppNotification::create([
            'user_id' => $this->otherSalesman->id,
            'type' => 'OTHER_1',
            'category' => 'ORDERS',
            'title' => 'Other Notice',
            'message' => 'Other Msg',
            'severity' => 'INFO',
            'is_read' => false,
        ]);

        $response = $this->actingAs($this->salesman)->postJson('/notifications/read-all');

        $response->assertOk()
            ->assertJson(['success' => true]);

        $this->assertEquals(0, InAppNotification::where('user_id', $this->salesman->id)->unread()->count());
        $this->assertEquals(1, InAppNotification::where('user_id', $this->otherSalesman->id)->unread()->count());
    }

    public function test_notification_deduplication_prevents_duplicate_records(): void
    {
        $notificationService = app(NotificationService::class);

        $notif1 = $notificationService->send(
            recipient: $this->salesman,
            type: 'ORDER_SUBMITTED',
            category: 'ORDERS',
            title: 'Order Submitted: ORD-100',
            message: 'Order ORD-100 was submitted.',
            severity: 'INFO',
            deduplicationKey: 'order_submitted:100:user:' . $this->salesman->id
        );

        $this->assertNotNull($notif1);

        // Attempt second identical send with same deduplication key
        $notif2 = $notificationService->send(
            recipient: $this->salesman,
            type: 'ORDER_SUBMITTED',
            category: 'ORDERS',
            title: 'Order Submitted: ORD-100 (Duplicate)',
            message: 'Order ORD-100 was submitted.',
            severity: 'INFO',
            deduplicationKey: 'order_submitted:100:user:' . $this->salesman->id
        );

        // Must return existing record, not insert a second row
        $this->assertEquals($notif1->id, $notif2->id);
        $this->assertEquals(1, InAppNotification::where('user_id', $this->salesman->id)->count());
    }

    public function test_disabled_preference_suppresses_notification(): void
    {
        $notificationService = app(NotificationService::class);

        // Disable 'DELIVERY' category for salesman
        NotificationPreference::updateOrCreate(
            ['user_id' => $this->salesman->id, 'category' => 'DELIVERY'],
            ['is_enabled' => false]
        );

        $result = $notificationService->send(
            recipient: $this->salesman,
            type: 'DELIVERY_ASSIGNED',
            category: 'DELIVERY',
            title: 'Delivery Assigned',
            message: 'A driver was assigned.'
        );

        $this->assertNull($result);
        $this->assertEquals(0, InAppNotification::where('user_id', $this->salesman->id)->where('category', 'DELIVERY')->count());
    }

    public function test_order_submission_generates_notifications_for_admins_and_warehouse(): void
    {
        $orderService = app(OrderService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->product->id,
                    quantity: 10,
                    unitPrice: '15.00'
                ),
            ],
            notes: 'Urgent delivery required',
            idempotencyKey: 'NOTIF-ORDER-SUBMIT-01'
        );

        $order = $orderService->createOrder($this->salesman, $dto);

        $this->assertNotNull($order);
        $this->assertEquals(OrderStatus::SUBMITTED, $order->status);

        // Verify Admin received notification
        $adminNotif = InAppNotification::where('user_id', $this->admin->id)
            ->where('category', 'ORDERS')
            ->first();

        $this->assertNotNull($adminNotif);
        $this->assertStringContainsString($order->order_number, $adminNotif->title);
        $this->assertEquals("/admin/orders/{$order->id}", $adminNotif->action_url);

        // Verify Warehouse Manager received notification
        $whNotif = InAppNotification::where('user_id', $this->warehouseManager->id)
            ->where('category', 'ORDERS')
            ->first();

        $this->assertNotNull($whNotif);
        $this->assertStringContainsString($order->order_number, $whNotif->title);
    }

    public function test_order_approval_generates_notifications_for_salesman_and_warehouse(): void
    {
        $orderService = app(OrderService::class);
        $workflowService = app(OrderWorkflowService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->product->id,
                    quantity: 5,
                    unitPrice: '15.00'
                ),
            ],
            notes: 'Approval test order',
            idempotencyKey: 'NOTIF-ORDER-APPROVE-01'
        );

        $order = $orderService->createOrder($this->salesman, $dto);

        // Approve order as admin
        $approvedOrder = $workflowService->approveOrder($order, $this->admin);

        $this->assertEquals(OrderStatus::APPROVED, $approvedOrder->status);

        // Verify Salesman received notification
        $salesmanNotif = InAppNotification::where('user_id', $this->salesman->id)
            ->where('notification_type', 'ORDER_APPROVED')
            ->first();

        $this->assertNotNull($salesmanNotif);
        $this->assertStringContainsString($order->order_number, $salesmanNotif->title);
        $this->assertEquals("/salesman/orders/{$order->id}", $salesmanNotif->action_url);

        // Verify Warehouse Manager received ready-for-fulfillment notification
        $whNotif = InAppNotification::where('user_id', $this->warehouseManager->id)
            ->where('notification_type', 'ORDER_READY_FOR_FULFILLMENT')
            ->first();

        $this->assertNotNull($whNotif);
        $this->assertStringContainsString($order->order_number, $whNotif->title);
    }

    public function test_delivery_assignment_generates_notification_for_driver(): void
    {
        $orderService = app(OrderService::class);
        $workflowService = app(OrderWorkflowService::class);
        $assignmentService = app(DeliveryAssignmentService::class);

        $dto = new CreateOrderDTO(
            customerId: $this->customer->id,
            items: [
                new CreateOrderItemDTO(
                    productId: $this->product->id,
                    quantity: 2,
                    unitPrice: '15.00'
                ),
            ],
            notes: 'Delivery test order',
            idempotencyKey: 'NOTIF-ORDER-DELIVERY-01'
        );

        $order = $orderService->createOrder($this->salesman, $dto);
        $approvedOrder = $workflowService->approveOrder($order, $this->admin);

        // Assign delivery to driver
        $delivery = $assignmentService->assignOrder(
            order: $approvedOrder,
            driver: $this->driver,
            actor: $this->admin,
            data: ['scheduled_date' => Carbon::today()->toDateString()]
        );

        $this->assertNotNull($delivery);

        // Verify driver received notification
        $driverNotif = InAppNotification::where('user_id', $this->driver->id)
            ->where('notification_type', 'DELIVERY_ASSIGNED')
            ->first();

        $this->assertNotNull($driverNotif);
        $this->assertStringContainsString($delivery->delivery_number, $driverNotif->title);
        $this->assertEquals("/delivery/{$delivery->id}", $driverNotif->action_url);
    }
}
