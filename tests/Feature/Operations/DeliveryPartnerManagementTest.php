<?php

namespace Tests\Feature\Operations;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DeliveryPartnerManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_delivery_partners_list(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->deliveryPartner()->count(3)->create();

        $response = $this->actingAs($admin)
            ->get('/admin/delivery-partners');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/DeliveryPartners/Index')
            ->has('deliveryPartners.data', 3)
            ->has('statuses')
        );
    }

    public function test_salesman_and_delivery_partner_cannot_view_delivery_partners_list(): void
    {
        $salesman = User::factory()->salesman()->create();
        $driver = User::factory()->deliveryPartner()->create();

        $this->actingAs($salesman)
            ->get('/admin/delivery-partners')
            ->assertForbidden();

        $this->actingAs($driver)
            ->get('/admin/delivery-partners')
            ->assertForbidden();
    }

    public function test_admin_can_provision_new_delivery_partner(): void
    {
        $admin = User::factory()->admin()->create();

        $payload = [
            'name' => 'Fast Driver Dave',
            'email' => 'dave.driver@uniquedistributors.test',
            'password' => 'SecurePass123!',
            'status' => AccountStatus::ACTIVE->value,
        ];

        $response = $this->actingAs($admin)
            ->post('/admin/delivery-partners', $payload);

        $createdUser = User::where('email', 'dave.driver@uniquedistributors.test')->first();
        $this->assertNotNull($createdUser);
        $this->assertSame(UserRole::DELIVERY_PARTNER, $createdUser->role);
        $this->assertSame(AccountStatus::ACTIVE, $createdUser->status);
        $this->assertTrue(Hash::check('SecurePass123!', $createdUser->password));

        $response->assertRedirect(route('admin.delivery-partners.show', $createdUser->id));
    }

    public function test_duplicate_email_is_rejected(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->create(['email' => 'existing.driver@uniquedistributors.test']);

        $response = $this->actingAs($admin)
            ->post('/admin/delivery-partners', [
                'name' => 'Duplicate Driver',
                'email' => 'existing.driver@uniquedistributors.test',
                'password' => 'SecurePass123!',
                'status' => AccountStatus::ACTIVE->value,
            ]);

        $response->assertSessionHasErrors(['email']);
    }

    public function test_admin_can_view_delivery_partner_profile(): void
    {
        $admin = User::factory()->admin()->create();
        $driver = User::factory()->deliveryPartner()->create([
            'name' => 'Alex Express',
            'email' => 'alex.express@uniquedistributors.test',
        ]);

        $response = $this->actingAs($admin)
            ->get("/admin/delivery-partners/{$driver->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/DeliveryPartners/Show')
            ->where('driver.id', $driver->id)
            ->where('driver.name', 'Alex Express')
            ->has('counts')
            ->has('recent_deliveries')
        );
    }

    public function test_admin_can_update_delivery_partner_profile(): void
    {
        $admin = User::factory()->admin()->create();
        $driver = User::factory()->deliveryPartner()->create([
            'name' => 'Old Driver Name',
            'email' => 'old.driver@uniquedistributors.test',
        ]);

        $response = $this->actingAs($admin)
            ->put("/admin/delivery-partners/{$driver->id}", [
                'name' => 'New Driver Name',
                'email' => 'new.driver@uniquedistributors.test',
            ]);

        $response->assertRedirect(route('admin.delivery-partners.show', $driver->id));

        $driver->refresh();
        $this->assertSame('New Driver Name', $driver->name);
        $this->assertSame('new.driver@uniquedistributors.test', $driver->email);
    }

    public function test_admin_can_suspend_and_reactivate_delivery_partner(): void
    {
        $admin = User::factory()->admin()->create();
        $driver = User::factory()->deliveryPartner()->create(['status' => AccountStatus::ACTIVE]);

        // Suspend
        $response = $this->actingAs($admin)
            ->patch("/admin/delivery-partners/{$driver->id}/status", [
                'status' => AccountStatus::SUSPENDED->value,
                'reason' => 'Driver vehicle undergoing maintenance.',
            ]);

        $response->assertRedirect(route('admin.delivery-partners.show', $driver->id));
        $driver->refresh();
        $this->assertSame(AccountStatus::SUSPENDED, $driver->status);
        $this->assertFalse($driver->canBeAssignedAsDeliveryDriver());

        // Reactivate
        $response = $this->actingAs($admin)
            ->patch("/admin/delivery-partners/{$driver->id}/status", [
                'status' => AccountStatus::ACTIVE->value,
                'reason' => 'Maintenance completed, back on duty.',
            ]);

        $response->assertRedirect(route('admin.delivery-partners.show', $driver->id));
        $driver->refresh();
        $this->assertSame(AccountStatus::ACTIVE, $driver->status);
        $this->assertTrue($driver->canBeAssignedAsDeliveryDriver());
    }
}
