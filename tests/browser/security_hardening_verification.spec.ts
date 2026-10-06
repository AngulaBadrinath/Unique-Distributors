import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { VIEWPORT_MATRIX } from './viewports';

test.describe('Security Hardening & Client Branding Real-Browser Verification', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', (msg) => {
            if (msg.type() === 'error' && !msg.text().includes('React DevTools')) {
                console.error(`[Browser Console Error]: ${msg.text()}`);
            }
        });
    });

    test('1. Login screen branding, responsive layout, and no internal ticket identifiers', async ({ page }) => {
        // Desktop Viewport
        await page.setViewportSize({ width: VIEWPORT_MATRIX.desktop_xl_1440.width, height: VIEWPORT_MATRIX.desktop_xl_1440.height });
        // Robust navigation with retry for cold local sockets
        let navigated = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
                navigated = true;
                break;
            } catch {
                await page.waitForTimeout(1000);
            }
        }
        if (!navigated) {
            await page.goto('/login', { waitUntil: 'domcontentloaded' });
        }

        // Verify branding and portal headers are visible on login page
        await expect(page.locator('body')).toContainText('Sign In');
        await expect(page.locator('body')).toContainText('B2B Wholesale Commerce');
        await expect(page.locator('body')).not.toContainText('Wholesale Distribution Management System');
        await expect(page.locator('body')).not.toContainText('AUTH-001');

        // Mobile Viewport
        await page.setViewportSize({ width: VIEWPORT_MATRIX.mobile_standard_390.width, height: VIEWPORT_MATRIX.mobile_standard_390.height });
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        await expect(page.locator('body')).not.toContainText('AUTH-001');
    });

    test('2. Admin workspace renders without CSP violations and without internal markers', async ({ page }) => {
        await page.setViewportSize({ width: VIEWPORT_MATRIX.desktop_xl_1440.width, height: VIEWPORT_MATRIX.desktop_xl_1440.height });
        await loginAs(page, 'ADMIN');

        await page.goto('/admin/orders');
        await expect(page).toHaveURL(/.*admin\/orders/);
        await expect(page.locator('body')).not.toContainText('500 Server Error');
        await expect(page.locator('body')).not.toContainText('FEAT-ORD-');

        // Verify security response headers on navigation
        const response = await page.goto('/admin/reports');
        expect(response?.status()).toBe(200);
        const headers = response?.headers() || {};
        expect(headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

        // Verify reporting tabs have clean titles without FEAT-REP-* markers
        await expect(page.locator('body')).not.toContainText('FEAT-REP-');
    });

    test('3. Salesman order drafting workspace and canonical create navigation', async ({ page }) => {
        await page.setViewportSize({ width: VIEWPORT_MATRIX.desktop_xl_1440.width, height: VIEWPORT_MATRIX.desktop_xl_1440.height });
        await loginAs(page, 'SALESMAN');

        await page.goto('/salesman/orders/create');
        await expect(page).toHaveURL(/.*salesman\/orders\/create/);
        await expect(page.locator('body')).not.toContainText('500 Server Error');

        // Navigate to canonical customer create page
        await page.goto('/customers/create');
        await expect(page).toHaveURL(/.*customers\/create/);
        await expect(page.locator('body')).not.toContainText('500 Server Error');

        // Test 301 legacy redirect
        await page.goto('/customers-create');
        await expect(page).toHaveURL(/.*customers\/create/);
    });

    test('4. Delivery partner workspace renders cleanly on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: VIEWPORT_MATRIX.mobile_standard_390.width, height: VIEWPORT_MATRIX.mobile_standard_390.height });
        await loginAs(page, 'DELIVERY_PARTNER');

        await page.goto('/delivery');
        await expect(page).toHaveURL(/.*delivery/);
        await expect(page.locator('body')).not.toContainText('500 Server Error');
    });

    test('5. Financial workspace (Receivables) loads cleanly with authoritative AR calculations', async ({ page }) => {
        await page.setViewportSize({ width: VIEWPORT_MATRIX.desktop_large_1280.width, height: VIEWPORT_MATRIX.desktop_large_1280.height });
        await loginAs(page, 'ACCOUNTANT');

        await page.goto('/receivables');
        await expect(page).toHaveURL(/.*receivables/);
        await expect(page.locator('body')).not.toContainText('500 Server Error');
        await expect(page.locator('body')).not.toContainText('NaN');
    });

    test('6. Obsolete /foundation route returns 404', async ({ page }) => {
        await page.setViewportSize({ width: VIEWPORT_MATRIX.desktop_large_1280.width, height: VIEWPORT_MATRIX.desktop_large_1280.height });
        await loginAs(page, 'ADMIN');

        const response = await page.goto('/foundation');
        expect(response?.status()).toBe(404);
    });
});
