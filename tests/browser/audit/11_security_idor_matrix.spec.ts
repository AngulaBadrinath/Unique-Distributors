import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { safeGoto } from '../helpers/diagnostics';

test.describe('Audit Phase 12: Security, Authorization & Anti-IDOR Abuse Matrix', () => {

    test('12.1 Unauthenticated guests redirected to login on protected routes', async ({ page }) => {
        const protectedRoutes = [
            '/dashboard',
            '/admin/orders',
            '/admin/receivables',
            '/admin/payments',
            '/admin/inventory',
            '/salesman/orders/create',
            '/delivery',
            '/security/roles',
        ];

        for (const route of protectedRoutes) {
            await safeGoto(page, route);
            expect(page.url()).toContain('/login');
        }
    });

    test('12.2 Privilege separation across specialized roles', async ({ page }) => {
        test.setTimeout(90000);
        // 1. Warehouse Supervisor cannot touch financial accounting or tax profiles
        await loginAs(page, 'WAREHOUSE_MANAGER');
        const glResp = await safeGoto(page, '/admin/accounting/general-ledger');
        expect([403, 404]).toContain(glResp?.status());

        const taxResp = await safeGoto(page, '/tax-profiles');
        expect([403, 404]).toContain(taxResp?.status());
        await logout(page);

        // 2. Delivery Partner cannot touch payments hub, but exposes BUG-013 on /admin/orders
        await loginAs(page, 'DELIVERY_PARTNER');
        const payResp = await safeGoto(page, '/admin/payments');
        expect([403, 404]).toContain(payResp?.status());

        // Documents BUG-013 fix: Delivery Partner is strictly rejected with 403 on /admin/orders
        const ordersResp = await safeGoto(page, '/admin/orders');
        expect([403, 404]).toContain(ordersResp?.status());
        await logout(page);

        // 3. Accountant cannot alter product master pricing boundaries
        await loginAs(page, 'ACCOUNTANT');
        const prodEditResp = await safeGoto(page, '/products/1/edit');
        expect([403, 404]).toContain(prodEditResp?.status());
        await logout(page);
    });
});
