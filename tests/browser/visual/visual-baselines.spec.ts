import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { safeGoto } from '../helpers/diagnostics';
import path from 'path';
import fs from 'fs';

test.describe('Visual Regression Baseline Capture', () => {
    const visualDir = path.resolve(process.cwd(), 'artifacts/visual');

    test.beforeAll(() => {
        fs.mkdirSync(visualDir, { recursive: true });
    });

    test('Captures login page visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await safeGoto(page, '/login');
        await page.waitForSelector('input[name="email"], input#email');

        const screenshotPath = path.join(visualDir, 'login-page-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1000);
    });

    test('Captures admin dashboard visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'ADMIN');
        await page.waitForLoadState('networkidle');

        const screenshotPath = path.join(visualDir, 'admin-dashboard-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1000);
        await logout(page);
    });

    test('Captures notification preferences visual snapshot and checks nav highlight', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'ADMIN');
        await safeGoto(page, '/notifications/preferences');
        await page.waitForLoadState('domcontentloaded');

        // Verify that Alert Preferences is active and Notification Center is NOT active
        const alertPrefNav = page.locator('aside a[href="/notifications/preferences"]');
        const notifCenterNav = page.locator('aside a[href="/notifications"]');

        const alertClass = await alertPrefNav.getAttribute('class');
        const notifClass = await notifCenterNav.getAttribute('class');

        expect(alertClass).toContain('bg-brand-surface');
        expect(notifClass).not.toContain('bg-brand-surface');

        const screenshotPath = path.join(visualDir, 'notification-preferences-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        await logout(page);
    });

    test('Captures notification center visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'ADMIN');
        await safeGoto(page, '/notifications');
        await page.waitForSelector('h1, h2, main');
        await page.waitForTimeout(500);

        const screenshotPath = path.join(visualDir, 'notification-center-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        await logout(page);
    });

    test('Captures salesman dashboard visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'SALESMAN');
        await page.waitForLoadState('domcontentloaded');

        const screenshotPath = path.join(visualDir, 'salesman-dashboard-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        await logout(page);
    });

    test('Captures delivery partner visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'DELIVERY_PARTNER');
        await page.waitForLoadState('domcontentloaded');

        const screenshotPath = path.join(visualDir, 'delivery-portal-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        await logout(page);
    });

    test('Captures customers master visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'ADMIN');
        await safeGoto(page, '/customers');
        await page.waitForSelector('table, h1, h2, main');
        await page.waitForTimeout(500);

        const screenshotPath = path.join(visualDir, 'customers-master-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        await logout(page);
    });

    test('Captures products catalog visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'ADMIN');
        await safeGoto(page, '/products');
        await page.waitForSelector('table, h1, h2, main');
        await page.waitForTimeout(500);

        const screenshotPath = path.join(visualDir, 'products-catalog-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        await logout(page);
    });

    test('Captures admin order queue visual snapshot', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'ADMIN');
        await safeGoto(page, '/admin/orders');
        await page.waitForSelector('table, h1, h2, main');
        await page.waitForTimeout(500);

        const screenshotPath = path.join(visualDir, 'admin-orders-baseline.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();
        await logout(page);
    });
});

