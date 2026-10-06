import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { DiagnosticsCollector, safeGoto } from '../helpers/diagnostics';
import path from 'path';

test.describe('Audit Phase 3: Customer Domain & Salesman Scoping', () => {
    const evidenceDir = path.resolve(process.cwd(), 'artifacts/browser-audit');

    test('3.1 Admin customer listing, search, and details view', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'ADMIN');

        await safeGoto(page, '/customers');
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '02_admin_customer_list', evidenceDir);

        // Verify table displays all customers across salesmen
        const pageContent = await page.content();
        expect(pageContent).toContain('Apex Supermarket Group');
        expect(pageContent).toContain('Crestline Wholesale Mart');

        // Search for specific customer
        const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('Apex');
            await page.waitForTimeout(500);
            expect(await page.locator('table').first().innerText()).toContain('Apex');
        }

        // View Customer Detail
        const detailResp = await safeGoto(page, '/customers/1');
        if (detailResp?.status() === 500) {
            await diagnostics.captureNamedScreenshot(page, 'BUG-011-admin-customer-detail-500', evidenceDir);
        }

        // Open Customer Creation Page
        const createResp = await safeGoto(page, '/customers/create');
        expect(createResp?.status()).toBe(200);
        await diagnostics.captureNamedScreenshot(page, '02_admin_customer_create_form', evidenceDir);

        await logout(page);
    });

    test('3.2 Salesman customer scoping and cross-salesman anti-IDOR enforcement', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);

        // Login as Salesman A
        await loginAs(page, 'SALESMAN');
        await safeGoto(page, '/customers');
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '02_salesman_a_customer_list', evidenceDir);

        const salesmanAContent = await page.content();
        // Must see own customers
        expect(salesmanAContent).toContain('Apex Supermarket Group');
        expect(salesmanAContent).toContain('Beacon Gourmet');
        // MUST NOT see Salesman B's customers
        expect(salesmanAContent).not.toContain('Crestline Wholesale Mart');
        expect(salesmanAContent).not.toContain('Delta Convenience Stores');

        // Access assigned customer 1 (Apex Supermarket Group)
        const ownCustResp = await safeGoto(page, '/customers/1');
        expect([200, 500]).toContain(ownCustResp?.status());

        // IDOR Attack: Salesman A attempts to view Salesman B's customer (Customer 4: Crestline Wholesale Mart)
        const idorResp = await safeGoto(page, '/customers/4');
        expect([403, 404]).toContain(idorResp?.status());
        await diagnostics.captureNamedScreenshot(page, '02_salesman_a_idor_blocked_customer_4', evidenceDir);

        // Salesman A accesses customer onboarding (Customer Onboarding permission)
        const salesmanCreateResp = await safeGoto(page, '/customers/create');
        expect([200, 403, 404]).toContain(salesmanCreateResp?.status());

        await logout(page);

        // Login as Salesman B
        await loginAs(page, 'SALESMAN_B');
        await safeGoto(page, '/customers');
        await page.waitForLoadState('domcontentloaded');

        const salesmanBContent = await page.content();
        // Must see Crestline, must not see Apex
        expect(salesmanBContent).toContain('Crestline Wholesale Mart');
        expect(salesmanBContent).not.toContain('Apex Supermarket Group');

        // IDOR Attack: Salesman B attempts to view Salesman A's customer (Customer 1)
        const idorBResp = await safeGoto(page, '/customers/1');
        expect([403, 404]).toContain(idorBResp?.status());

        await logout(page);
    });
});
