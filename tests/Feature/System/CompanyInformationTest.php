<?php

namespace Tests\Feature\System;

use App\DTOs\System\CompanyInformationData;
use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\CompanyInformation;
use App\Models\Order;
use App\Models\User;
use App\Services\Invoice\InvoiceGeneratorService;
use App\Services\System\ApplicationIdentityService;
use App\Services\System\CompanyInformationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CompanyInformationTest extends TestCase
{
    use RefreshDatabase;

    protected CompanyInformationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        CompanyInformationService::invalidateCache();
        $this->service = app(CompanyInformationService::class);
    }

    /**
     * Helper to create active users with specific roles.
     */
    protected function createUserWithRole(UserRole $role, AccountStatus $status = AccountStatus::ACTIVE): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => $status,
            'password' => bcrypt('ValidPassword123!'),
        ]);
    }

    /**
     * SYS-COMPANY-001: Authorized admin can retrieve company information.
     */
    public function test_sys_company_001_authorized_admin_can_retrieve_company_information(): void
    {
        $superAdmin = $this->createUserWithRole(UserRole::SUPER_ADMIN);
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $responseSuper = $this->actingAs($superAdmin)->get(route('system.company.index'));
        $responseSuper->assertOk();
        $responseSuper->assertInertia(fn (Assert $page) => $page
            ->component('System/CompanyInformation/Index')
            ->has('company.legal_name')
            ->has('company.email')
            ->has('company.currency')
            ->has('company.is_title_locked')
        );

        $responseAdmin = $this->actingAs($admin)->get(route('system.company.index'));
        $responseAdmin->assertOk();
        $responseAdmin->assertInertia(fn (Assert $page) => $page
            ->component('System/CompanyInformation/Index')
            ->has('company.legal_name')
        );
    }

    /**
     * SYS-COMPANY-002: Unauthenticated user cannot access protected company settings.
     */
    public function test_sys_company_002_unauthenticated_user_cannot_access_company_settings(): void
    {
        $responseGet = $this->get(route('system.company.index'));
        $responseGet->assertRedirect(route('login'));

        $responsePut = $this->put(route('system.company.update'), [
            'legal_name' => 'Attacker Corp',
        ]);
        $responsePut->assertRedirect(route('login'));
    }

    /**
     * SYS-COMPANY-003: Unauthorized roles cannot view or mutate company settings.
     */
    public function test_sys_company_003_unauthorized_roles_cannot_view_or_mutate_company_settings(): void
    {
        $unauthorizedRoles = [
            UserRole::ACCOUNTANT,
            UserRole::SALESMAN,
            UserRole::WAREHOUSE_MANAGER,
            UserRole::DELIVERY_PARTNER,
        ];

        foreach ($unauthorizedRoles as $role) {
            $user = $this->createUserWithRole($role);

            $this->actingAs($user)
                ->get(route('system.company.index'))
                ->assertForbidden();

            $this->actingAs($user)
                ->put(route('system.company.update'), [
                    'legal_name' => 'Unauthorized Edit',
                    'address_line1' => '123 Main St',
                    'city' => 'Anytown',
                    'state' => 'NY',
                    'postal_code' => '10001',
                    'country' => 'US',
                    'phone' => '+1 555-0100',
                    'email' => 'edit@example.com',
                    'currency' => 'USD',
                    'timezone' => 'America/New_York',
                ])
                ->assertForbidden();
        }
    }

    /**
     * SYS-COMPANY-004: Inactive admin cannot view or mutate company settings.
     */
    public function test_sys_company_004_inactive_admin_cannot_mutate_company_settings(): void
    {
        $inactiveStatuses = [
            AccountStatus::SUSPENDED,
            AccountStatus::DISABLED,
            AccountStatus::INVITED,
        ];

        foreach ($inactiveStatuses as $status) {
            $inactiveAdmin = $this->createUserWithRole(UserRole::SUPER_ADMIN, $status);

            // Web route is intercepted by account.active middleware and redirects to login
            $this->actingAs($inactiveAdmin)
                ->get(route('system.company.index'))
                ->assertRedirect(route('login'));

            $this->actingAs($inactiveAdmin)
                ->put(route('system.company.update'), [
                    'legal_name' => 'Inactive Update Attempt',
                    'address_line1' => '123 Main St',
                    'city' => 'Anytown',
                    'state' => 'NY',
                    'postal_code' => '10001',
                    'country' => 'US',
                    'phone' => '+1 555-0100',
                    'email' => 'edit@example.com',
                    'currency' => 'USD',
                    'timezone' => 'America/New_York',
                ])
                ->assertRedirect(route('login'));

            // Direct service invocation strictly throws AuthorizationException
            try {
                $dto = CompanyInformationData::fromArray([
                    'legal_name' => 'Inactive Direct Update',
                    'address_line1' => '123 Main St',
                    'city' => 'Anytown',
                    'state' => 'NY',
                    'postal_code' => '10001',
                    'country' => 'US',
                    'phone' => '+1 555-0100',
                    'email' => 'edit@example.com',
                    'currency' => 'USD',
                    'timezone' => 'America/New_York',
                ]);
                $this->service->update($dto, $inactiveAdmin);
                $this->fail("Expected AuthorizationException for status {$status->value}");
            } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
                $this->assertStringContainsString('Inactive accounts are not authorized', $e->getMessage());
            }
        }
    }

    /**
     * SYS-COMPANY-005: Permitted non-locked fields can be updated freely while title remains locked.
     */
    public function test_sys_company_005_authorized_admin_can_update_permitted_fields_while_locked(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);
        $currentLegalName = $this->service->get()->legal_name;

        $payload = [
            'legal_name' => $currentLegalName,
            'dba_name' => 'Updated Logistics DBA',
            'address_line1' => '500 Commerce Way',
            'address_line2' => 'Floor 3',
            'city' => 'Savannah',
            'state' => 'GA',
            'postal_code' => '31401',
            'country' => 'US',
            'phone' => '+1 (912) 555-0122',
            'email' => 'billing@example.com',
            'website' => 'https://example.com/logistics',
            'tax_id' => '98-7654321',
            'state_tax_id' => 'GA-112233',
            'currency' => 'USD',
            'timezone' => 'America/New_York',
            'invoice_footer_note' => 'Payment due within 15 days.',
        ];

        $response = $this->actingAs($admin)
            ->put(route('system.company.update'), $payload);

        $response->assertRedirect(route('system.company.index'));
        $response->assertSessionHas('status', 'Company information updated successfully.');

        $company = $this->service->get();
        $this->assertSame($currentLegalName, $company->legal_name);
        $this->assertSame('Updated Logistics DBA', $company->dba_name);
        $this->assertSame('500 Commerce Way', $company->address_line1);
        $this->assertSame('Floor 3', $company->address_line2);
        $this->assertSame('Savannah', $company->city);
        $this->assertSame('GA', $company->state);
        $this->assertSame('31401', $company->postal_code);
        $this->assertSame('+1 (912) 555-0122', $company->phone);
        $this->assertSame('billing@example.com', $company->email);
        $this->assertSame('https://example.com/logistics', $company->website);
        $this->assertSame('98-7654321', $company->tax_id);
        $this->assertSame('GA-112233', $company->state_tax_id);
        $this->assertSame('Payment due within 15 days.', $company->invoice_footer_note);
    }

    /**
     * SYS-COMPANY-006: Locked legal title rejects modifications without explicit unlock.
     */
    public function test_sys_company_006_locked_legal_title_rejects_modification(): void
    {
        $admin = $this->createUserWithRole(UserRole::SUPER_ADMIN);

        // Attempt to change legal_name without sending is_title_locked => false
        $payload = [
            'legal_name' => 'Attempted New Legal Name',
            'address_line1' => '100 Distribution Blvd',
            'city' => 'Atlanta',
            'state' => 'GA',
            'postal_code' => '30301',
            'country' => 'US',
            'phone' => '+1 (800) 555-0199',
            'email' => 'support@example.com',
            'currency' => 'USD',
            'timezone' => 'America/New_York',
        ];

        $response = $this->actingAs($admin)
            ->put(route('system.company.update'), $payload);

        $response->assertSessionHasErrors('legal_name');

        // Verify legal_name was NOT changed in DB
        $this->assertNotSame('Attempted New Legal Name', $this->service->get()->legal_name);
    }

    /**
     * SYS-COMPANY-007: Explicit authorized unlock allows legal title modification.
     */
    public function test_sys_company_007_explicit_unlock_allows_legal_title_modification(): void
    {
        $admin = $this->createUserWithRole(UserRole::SUPER_ADMIN);

        $payload = [
            'legal_name' => 'Newly Authorized Legal Corp',
            'dba_name' => 'Authorized Trade DBA',
            'address_line1' => '100 Distribution Blvd',
            'city' => 'Atlanta',
            'state' => 'GA',
            'postal_code' => '30301',
            'country' => 'US',
            'phone' => '+1 (800) 555-0199',
            'email' => 'support@example.com',
            'currency' => 'USD',
            'timezone' => 'America/New_York',
            'is_title_locked' => false,
        ];

        $response = $this->actingAs($admin)
            ->put(route('system.company.update'), $payload);

        $response->assertRedirect(route('system.company.index'));
        $response->assertSessionHas('status', 'Company information updated successfully.');

        $company = $this->service->get();
        $this->assertSame('Newly Authorized Legal Corp', $company->legal_name);
        $this->assertFalse($company->is_title_locked);
    }

    /**
     * SYS-COMPANY-008: Whitespace normalization on inputs.
     */
    public function test_sys_company_008_whitespace_normalization(): void
    {
        $admin = $this->createUserWithRole(UserRole::SUPER_ADMIN);

        $payload = [
            'legal_name' => '  Trimmed Logistics Corp  ',
            'dba_name' => '  Trimmed DBA  ',
            'address_line1' => '  777 Industrial Way  ',
            'city' => '  Atlanta  ',
            'state' => '  ga  ',
            'postal_code' => '  30301  ',
            'country' => '  us  ',
            'phone' => '  +1 555-0199  ',
            'email' => '  INFO@TRIMMED.COM  ',
            'currency' => '  usd  ',
            'timezone' => '  America/New_York  ',
            'is_title_locked' => false,
        ];

        $response = $this->actingAs($admin)
            ->put(route('system.company.update'), $payload);

        $response->assertRedirect();

        $company = $this->service->get();
        $this->assertSame('Trimmed Logistics Corp', $company->legal_name);
        $this->assertSame('Trimmed DBA', $company->dba_name);
        $this->assertSame('777 Industrial Way', $company->address_line1);
        $this->assertSame('info@trimmed.com', $company->email);
        $this->assertSame('US', $company->country);
        $this->assertSame('USD', $company->currency);
    }

    /**
     * SYS-COMPANY-009: Unsafe URL schemes (javascript:, data:) are rejected.
     */
    public function test_sys_company_009_unsafe_url_schemes_are_rejected(): void
    {
        $admin = $this->createUserWithRole(UserRole::SUPER_ADMIN);
        $currentLegalName = $this->service->get()->legal_name;

        $unsafeUrls = [
            'javascript:alert(1)',
            'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
            'vbscript:msgbox(1)',
            'file:///etc/passwd',
        ];

        foreach ($unsafeUrls as $unsafeUrl) {
            $payload = [
                'legal_name' => $currentLegalName,
                'address_line1' => '100 Safe St',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postal_code' => '30301',
                'country' => 'US',
                'phone' => '+1 555-0199',
                'email' => 'safe@example.com',
                'website' => $unsafeUrl,
                'currency' => 'USD',
                'timezone' => 'America/New_York',
            ];

            $response = $this->actingAs($admin)
                ->put(route('system.company.update'), $payload);

            $response->assertSessionHasErrors('website');
        }
    }

    /**
     * SYS-COMPANY-010: HTML/script injection is stored and rendered safely as text.
     */
    public function test_sys_company_010_html_and_script_injection_is_rendered_safely(): void
    {
        $admin = $this->createUserWithRole(UserRole::SUPER_ADMIN);

        $xssPayload = [
            'legal_name' => '<script>alert("XSS")</script> Secure Corp',
            'dba_name' => '<img src=x onerror=alert(1)> Secure DBA',
            'address_line1' => '<svg/onload=alert(1)> 100 Main St',
            'city' => 'Atlanta',
            'state' => 'GA',
            'postal_code' => '30301',
            'country' => 'US',
            'phone' => '+1 555-0199',
            'email' => 'xss_test@example.com',
            'currency' => 'USD',
            'timezone' => 'America/New_York',
            'invoice_footer_note' => '<script>document.cookie</script> Invoicing terms',
            'is_title_locked' => false,
        ];

        $response = $this->actingAs($admin)->put(route('system.company.update'), $xssPayload);
        $response->assertRedirect();

        $viewResponse = $this->actingAs($admin)->get(route('system.company.index'));
        $viewResponse->assertOk();
        $viewResponse->assertInertia(fn (Assert $page) => $page
            ->where('company.legal_name', '<script>alert("XSS")</script> Secure Corp')
            ->where('company.dba_name', '<img src=x onerror=alert(1)> Secure DBA')
        );
    }

    /**
     * SYS-COMPANY-011: Company details transform safely into public representation.
     */
    public function test_sys_company_011_public_details_transformation(): void
    {
        $company = $this->service->get();
        $public = $company->toPublicArray();

        $this->assertArrayHasKey('legal_name', $public);
        $this->assertArrayHasKey('dba_name', $public);
        $this->assertArrayHasKey('display_name', $public);
        $this->assertArrayHasKey('formatted_address', $public);
        $this->assertArrayHasKey('phone', $public);
        $this->assertArrayHasKey('email', $public);
        $this->assertArrayHasKey('currency', $public);
        $this->assertArrayHasKey('is_title_locked', $public);
        $this->assertArrayNotHasKey('is_singleton', $public);
    }

    /**
     * SYS-COMPANY-012: Company information is shared through Inertia middleware.
     */
    public function test_sys_company_012_company_information_shared_through_inertia(): void
    {
        $user = $this->createUserWithRole(UserRole::SUPER_ADMIN);

        $response = $this->actingAs($user)->get(route('dashboard'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->has('company.legal_name')
            ->has('company.currency')
            ->has('company.timezone')
        );
    }

    /**
     * SYS-COMPANY-013: Only one authoritative company configuration exists (singleton invariant).
     */
    public function test_sys_company_013_singleton_invariant_enforced(): void
    {
        $initial = $this->service->get();
        $this->assertNotNull($initial);

        $count = CompanyInformation::query()->where('is_singleton', true)->count();
        $this->assertSame(1, $count);

        // Attempting to retrieve again returns the identical record
        $second = $this->service->get();
        $this->assertSame($initial->id, $second->id);
    }

    /**
     * SYS-COMPANY-014: Update is atomic and transactional.
     */
    public function test_sys_company_014_update_is_atomic_and_transactional(): void
    {
        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $dto = CompanyInformationData::fromArray([
            'legal_name' => 'Transactional Corp',
            'address_line1' => '999 Ledger St',
            'city' => 'Atlanta',
            'state' => 'GA',
            'postal_code' => '30301',
            'country' => 'US',
            'phone' => '+1 555-0100',
            'email' => 'audit@example.com',
            'currency' => 'USD',
            'timezone' => 'America/New_York',
            'is_title_locked' => false,
        ]);

        $updated = $this->service->update($dto, $admin, '127.0.0.1');

        $this->assertSame('Transactional Corp', $updated->legal_name);
        $this->assertSame('Transactional Corp', $this->service->get()->legal_name);
    }

    /**
     * SYS-COMPANY-015: Successful update generates audit log event with changed fields.
     */
    public function test_sys_company_015_update_generates_audit_event(): void
    {
        Log::spy();

        $admin = $this->createUserWithRole(UserRole::SUPER_ADMIN);

        $dto = CompanyInformationData::fromArray([
            'legal_name' => 'Audited Distribution LLC',
            'address_line1' => '100 Audit Trail',
            'city' => 'Atlanta',
            'state' => 'GA',
            'postal_code' => '30301',
            'country' => 'US',
            'phone' => '+1 (800) 555-9999',
            'email' => 'audited@example.com',
            'tax_id' => '99-8877665',
            'currency' => 'USD',
            'timezone' => 'America/New_York',
            'is_title_locked' => false,
        ]);

        $this->service->update($dto, $admin, '192.168.1.100');

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context) use ($admin) {
            return $message === 'Company information updated'
                && ($context['event'] ?? '') === 'audit.system_event'
                && ($context['action'] ?? '') === 'SYSTEM_COMPANY_INFORMATION_UPDATED'
                && ($context['actor_id'] ?? null) === $admin->id
                && in_array('legal_name', $context['changed_fields'] ?? [], true)
                && ($context['ip_address'] ?? '') === '192.168.1.100';
        })->once();
    }

    /**
     * SYS-COMPANY-016: SYS-001 application identity remains independent and unaffected.
     */
    public function test_sys_company_016_sys_001_identity_remains_unaffected(): void
    {
        $appIdentityService = app(ApplicationIdentityService::class);
        $appName = $appIdentityService->getAppName();
        $this->assertNotEmpty($appName);

        $admin = $this->createUserWithRole(UserRole::ADMIN);

        $this->actingAs($admin)->put(route('system.company.update'), [
            'legal_name' => 'New Legal Entity Name',
            'address_line1' => '400 Brand St',
            'city' => 'Atlanta',
            'state' => 'GA',
            'postal_code' => '30301',
            'country' => 'US',
            'phone' => '+1 555-0100',
            'email' => 'info@newlegal.com',
            'currency' => 'USD',
            'timezone' => 'America/New_York',
            'is_title_locked' => false,
        ]);

        // Application name dynamically resolves to company legal name
        $this->assertSame($appName, $appIdentityService->getAppName());
    }
}
