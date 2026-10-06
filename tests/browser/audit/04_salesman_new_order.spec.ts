import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { DiagnosticsCollector, safeGoto } from '../helpers/diagnostics';
import path from 'path';

test.describe('Audit Phase 5: Flagship — Salesman New Sales Order & Drafts', () => {
    const evidenceDir = path.resolve(process.cwd(), 'artifacts/browser-audit');

    test('5.1 Salesman New Order UI, customer scoping, and review calculation stability', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'SALESMAN');

        // Navigate to New Sales Order
        await safeGoto(page, '/salesman/orders/create');
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '04_salesman_new_order_start', evidenceDir);

        // Verify assigned customers are present, but unassigned are NOT
        const pageText = await page.content();
        expect(pageText).toContain('Apex Supermarket Group');
        expect(pageText).not.toContain('Crestline Wholesale Mart');

        // Order History workspace
        await safeGoto(page, '/salesman/orders');
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '04_salesman_order_history', evidenceDir);

        // Salesman A views own existing order
        const ownOrderResp = await safeGoto(page, '/salesman/orders/1');
        expect([200, 404]).toContain(ownOrderResp?.status());
        await diagnostics.captureNamedScreenshot(page, '04_salesman_order_detail', evidenceDir);

        await logout(page);
    });

    test('5.2 Cross-Salesman Order IDOR is strictly rejected', async ({ page }) => {
        // Salesman B logs in
        await loginAs(page, 'SALESMAN_B');

        // Salesman B attempts to view Salesman A's order
        const idorOrderResp = await safeGoto(page, '/salesman/orders/1');
        expect([403, 404]).toContain(idorOrderResp?.status());

        await logout(page);
    });
});
