import { test, expect } from '@playwright/test';
import { loginAs, logout, QA_USER_CREDENTIALS } from '../helpers/auth';
import { DiagnosticsCollector } from '../helpers/diagnostics';
import path from 'path';

test.describe('Audit Phase 1 & 2: Authentication, Shell, and Role Boundaries', () => {
    const evidenceDir = path.resolve(process.cwd(), 'artifacts/browser-audit');

    test('1.1 Invalid login and suspended account rejection', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);

        // 1. Invalid credentials
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');
        await page.fill('input[type="email"]', 'invalid.user@example.test');
        await page.fill('input[type="password"]', 'WrongPassword123!');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/login');
        const errorMsg = await page.locator('[role="alert"], .text-destructive, .text-red-500').first().textContent().catch(() => '');

        // 2. Suspended account
        await page.goto('/login');
        await page.fill('input[type="email"]', QA_USER_CREDENTIALS.SUSPENDED.email);
        await page.fill('input[type="password"]', QA_USER_CREDENTIALS.SUSPENDED.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/login');
        await diagnostics.captureNamedScreenshot(page, '01_auth_suspended_rejection', evidenceDir);
    });

    test('1.2 Salesman login and operational shell', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'SALESMAN');
        expect(page.url()).toContain('/dashboard');
        await diagnostics.captureNamedScreenshot(page, '01_shell_salesman_dashboard', evidenceDir);

        const salesmanNavText = await page.locator('aside, nav').first().innerText();
        expect(salesmanNavText).toContain('Customer Master');
        expect(salesmanNavText).toContain('Product Catalog');
        expect(salesmanNavText).toContain('New Sales Order');
        expect(salesmanNavText).not.toContain('Company Information');
        expect(salesmanNavText).not.toContain('Sales Rep Performance');
        await logout(page);
    });

    test('1.3 Warehouse Manager login and inventory shell', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'WAREHOUSE_MANAGER');
        expect(page.url()).toMatch(/\/(admin\/inventory|dashboard)/);
        await diagnostics.captureNamedScreenshot(page, '01_shell_warehouse_inventory', evidenceDir);

        const warehouseNavText = await page.locator('aside, nav').first().innerText();
        expect(warehouseNavText).toContain('Stock Balances');
        expect(warehouseNavText).not.toContain('General Ledger');
        expect(warehouseNavText).not.toContain('Profit & Loss');
        await logout(page);
    });

    test('1.4 Delivery Partner login and delivery shell', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'DELIVERY_PARTNER');
        expect(page.url()).toContain('/delivery');
        await diagnostics.captureNamedScreenshot(page, '01_shell_delivery_today', evidenceDir);
        await logout(page);
    });

    test('1.5 Accountant login and financial shell', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'ACCOUNTANT');
        expect(page.url()).toContain('/dashboard');
        await diagnostics.captureNamedScreenshot(page, '01_shell_accountant_dashboard', evidenceDir);

        const acctNavText = await page.locator('aside, nav').first().innerText();
        expect(acctNavText).toContain('General Ledger');
        expect(acctNavText).toContain('Accounts Receivable');
        expect(acctNavText).toContain('Accounts Payable');
        await logout(page);
    });

    test('1.6 Admin login and operations shell', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'ADMIN');
        expect(page.url()).toContain('/dashboard');
        await diagnostics.captureNamedScreenshot(page, '01_shell_admin_dashboard', evidenceDir);

        const adminNavText = await page.locator('aside, nav').first().innerText();
        expect(adminNavText).toContain('Order Processing');
        expect(adminNavText).toContain('Order Adjustments');
        expect(adminNavText).toContain('Stock Balances');
        expect(adminNavText).toContain('Payment Verification');
        await logout(page);
    });

    test('1.7 Field roles blocked from unauthorized administrative workspaces', async ({ page }) => {
        // Salesman direct access to /system/company and /security/roles
        await loginAs(page, 'SALESMAN');
        const companyResp = await page.goto('/system/company');
        expect([403, 404].includes(companyResp?.status() || 0)).toBeTruthy();

        const rolesResp = await page.goto('/security/roles');
        expect([403, 404].includes(rolesResp?.status() || 0)).toBeTruthy();

        const adminOrdersResp = await page.goto('/admin/orders');
        expect([403, 404].includes(adminOrdersResp?.status() || 0)).toBeTruthy();
        await logout(page);

        // Delivery partner direct access to /admin/payments and /admin/inventory
        await loginAs(page, 'DELIVERY_PARTNER');
        const payResp = await page.goto('/admin/payments');
        expect([403, 404].includes(payResp?.status() || 0)).toBeTruthy();

        const invResp = await page.goto('/admin/inventory');
        expect([403, 404].includes(invResp?.status() || 0)).toBeTruthy();
        await logout(page);
    });
});
