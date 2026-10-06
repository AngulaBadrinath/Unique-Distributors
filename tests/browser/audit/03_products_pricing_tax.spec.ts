import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { DiagnosticsCollector, safeGoto } from '../helpers/diagnostics';
import path from 'path';

test.describe('Audit Phase 4: Product Master, Categories, Pricing & Tax Invariants', () => {
    const evidenceDir = path.resolve(process.cwd(), 'artifacts/browser-audit');

    test('4.1 Categories management and product catalogue browsing', async ({ page }) => {
        const diagnostics = new DiagnosticsCollector(page);
        await loginAs(page, 'ADMIN');

        // Categories index
        const catResp = await safeGoto(page, '/categories');
        expect(catResp?.status()).toBe(200);
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '03_admin_categories_list', evidenceDir);

        // Product Catalog
        const prodResp = await safeGoto(page, '/products');
        expect(prodResp?.status()).toBe(200);
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '03_admin_products_list', evidenceDir);

        const content = await page.content();
        expect(content).toContain('BEV-ORG-001');
        expect(content).toContain('Organic Orange Juice');

        // Check Product Edit Page
        const editResp = await safeGoto(page, '/products/1/edit');
        expect([200, 404]).toContain(editResp?.status());
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '03_admin_product_18_edit', evidenceDir);

        // Tax Profiles index
        const taxResp = await safeGoto(page, '/tax-profiles');
        expect(taxResp?.status()).toBe(200);
        await page.waitForLoadState('domcontentloaded');
        await diagnostics.captureNamedScreenshot(page, '03_admin_tax_profiles', evidenceDir);

        await logout(page);
    });

    test('4.2 Field roles catalog read-only and price edit restrictions', async ({ page }) => {
        // Salesman can view products
        await loginAs(page, 'SALESMAN');
        const prodResp = await safeGoto(page, '/products');
        expect(prodResp?.status()).toBe(200);

        // Salesman CANNOT edit product
        const editResp = await safeGoto(page, '/products/1/edit');
        expect([403, 404]).toContain(editResp?.status());

        // Salesman CANNOT create or edit categories
        const catCreateResp = await safeGoto(page, '/categories/create');
        expect([403, 404]).toContain(catCreateResp?.status());

        // Salesman CANNOT access tax profiles
        const taxResp = await safeGoto(page, '/tax-profiles');
        expect([403, 404]).toContain(taxResp?.status());

        await logout(page);
    });
});
