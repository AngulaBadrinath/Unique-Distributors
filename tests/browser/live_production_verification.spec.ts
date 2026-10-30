import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import fs from 'fs';
import path from 'path';

test.describe('Live Production Verification — https://uniquejerseywholesale.com', () => {
    test.beforeAll(async () => {
        const screenshotDir = path.resolve('artifacts/screenshots/live_production');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
    });

    test('01 — Public Health & Readiness Endpoints Return 200 Ready', async ({ request }) => {
        const healthRes = await request.get('https://uniquejerseywholesale.com/health');
        expect(healthRes.status()).toBe(200);
        const healthJson = await healthRes.json();
        expect(healthJson.status).toBe('healthy');
        expect(healthJson.application.environment).toBe('production');

        const readyRes = await request.get('https://uniquejerseywholesale.com/ready');
        expect(readyRes.status()).toBe(200);
        const readyJson = await readyRes.json();
        expect(readyJson.status).toBe('ready');
        expect(readyJson.dependencies.database.status).toBe('ready');
        expect(readyJson.dependencies.redis.status).toBe('ready');
        expect(readyJson.dependencies.storage.status).toBe('ready');
        expect(readyJson.dependencies.storage.disk).toBe('s3');
    });

    test('02 — Production Login Page Visual & Responsive Verification', async ({ page }) => {
        // Desktop Viewport (1440x900)
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('https://uniquejerseywholesale.com/login', { waitUntil: 'networkidle' });
        await expect(page.locator('#app')).toBeVisible();
        await page.screenshot({ path: 'artifacts/screenshots/live_production/01_desktop_login.png' });

        // Mobile Viewport (390x844 - iPhone 14)
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('https://uniquejerseywholesale.com/login', { waitUntil: 'networkidle' });
        await expect(page.locator('#app')).toBeVisible();
        await page.screenshot({ path: 'artifacts/screenshots/live_production/02_mobile_login.png' });
    });

    test('03 — Salesman Catalog Uncropped Packaging & Barcode Verification', async ({ page }) => {
        // Desktop Viewport (1440x900)
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs(page, 'SALESMAN');

        // Navigate to order creation / catalog
        await page.goto('https://uniquejerseywholesale.com/salesman/orders/create', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL(/.*salesman\/orders\/create/);

        // Capture Desktop Catalog with square containers and UPC barcodes
        await page.screenshot({ path: 'artifacts/screenshots/live_production/03_desktop_catalog.png', fullPage: false });

        // Mobile Viewport (390x844 - Reference A compact list view)
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'artifacts/screenshots/live_production/04_mobile_catalog_compact.png', fullPage: false });
    });

    test('04 — Admin Portal Orders & Cross-Role View Verification', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs(page, 'ADMIN');

        await page.goto('https://uniquejerseywholesale.com/admin/orders', { waitUntil: 'networkidle' });
        await expect(page.locator('body')).not.toContainText('500 Server Error');
        await page.screenshot({ path: 'artifacts/screenshots/live_production/05_admin_orders.png' });
    });
});
