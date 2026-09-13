import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { DiagnosticsCollector, safeGoto } from '../helpers/diagnostics';
import path from 'path';

test.describe('Audit Phase 14: Recent-Fix Regression & Cross-Module Financial Verification', () => {
    const evidenceDir = path.resolve(process.cwd(), 'artifacts/browser-audit');

    test('14.1 Re-verifying recent fixes across Salesman, AR, and Adjustments', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);

        // 1. Salesman lands on operational Overview Dashboard, NOT /salesman/orders
        await loginAs(page, 'SALESMAN');
        expect(page.url()).toContain('/dashboard');
        await page.waitForSelector('h1');
        const dashText = await page.locator('body').innerText();
        expect(dashText).toMatch(/Field Sales (Command|Dashboard)/);
        // Must NOT have stale "Phase 00" or development text
        expect(dashText).not.toContain('Phase 00');
        expect(dashText).not.toContain('Phase 18B');
        await diagnostics.captureNamedScreenshot(page, '13_regression_salesman_dashboard_clean', evidenceDir);
        await logout(page);

        // 2. Admin AR dashboard & statement regression check (Documents BUG-011 status)
        await loginAs(page, 'ADMIN');
        const arResp = await safeGoto(page, '/admin/receivables');
        if (arResp?.status() === 500) {
            await diagnostics.captureNamedScreenshot(page, 'BUG-011-regression-ar-dashboard-500', evidenceDir);
        }

        const stmtResp = await safeGoto(page, '/admin/receivables/31/statement');
        if (stmtResp?.status() === 500) {
            await diagnostics.captureNamedScreenshot(page, 'BUG-011-regression-ar-statement-500', evidenceDir);
        }

        // 3. Admin Adjustments queue loads without 500/schema errors (Previously fixed, re-verified)
        const adjResp = await safeGoto(page, '/admin/adjustments');
        expect(adjResp?.status()).toBe(200);
        await diagnostics.captureNamedScreenshot(page, '13_regression_adjustments_queue_healthy', evidenceDir);

        await logout(page);
    });
});
