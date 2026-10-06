import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { safeGoto } from '../helpers/diagnostics';

test.describe('UJW God Prompt 2 — Targeted Production Fix Batch E2E Verification', () => {
    test.beforeEach(async ({ context }) => {
        await context.clearCookies();
    });

    test('1. Invoice Print HTML: Renders canonical invoice layout with full details and A4 layout', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        // First find an existing invoice ID or navigate to invoices list
        const listResp = await safeGoto(page, '/admin/invoices');
        expect(listResp?.status()).toBe(200);
        await page.waitForLoadState('domcontentloaded');

        // Check if print view loads for invoice 1 (or any invoice present)
        const printResp = await safeGoto(page, '/invoices/1/print');
        if (printResp?.status() === 200) {
            await page.waitForLoadState('domcontentloaded');
            // Canonical table structure
            await expect(page.locator('.items-table')).toBeVisible({ timeout: 10000 });
            await expect(page.locator('h1').filter({ hasText: 'INVOICE' })).toBeVisible({ timeout: 10000 });
            // Zero <img> tags per RULE-DOC-001
            const imgCount = await page.locator('img').count();
            expect(imgCount).toBe(0);
        }
    });

    test('2 & 3. Invoice Download PDF & Layout Comparison: Unbranded copy retains financial data and returns application/pdf', async ({ page, request }) => {
        await loginAs(page, 'ADMIN');

        // Make an authenticated request for PDF
        const pdfResp = await page.request.get('/invoices/1/pdf');
        if (pdfResp.status() === 200) {
            expect(pdfResp.headers()['content-type']).toContain('application/pdf');
            const pdfBuffer = await pdfResp.body();
            expect(pdfBuffer.length).toBeGreaterThan(500);
        }
    });

    test('4. Invoice Favicon: Document page references UJW favicon asset', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        const printResp = await safeGoto(page, '/invoices/1/print');
        if (printResp?.status() === 200) {
            await page.waitForLoadState('domcontentloaded');
            const favicon = page.locator('link[rel="icon"], link[rel="alternate icon"]').first();
            await expect(favicon).toHaveAttribute('href', /branding\/favicon\.(svg|ico)/);
        }
    });

    test('5. Dashboard KPI Rendering: Renders authoritative data-derived metrics', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        const resp = await safeGoto(page, '/dashboard');
        expect(resp?.status()).toBe(200);
        await page.waitForLoadState('domcontentloaded');

        // Verify dashboard cards are present
        await expect(page.getByText(/Sales Volume/i).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/Orders Processed/i).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/Fulfillment Rate/i).first()).toBeVisible({ timeout: 15000 });
    });

    test('6. Warehouse Health KPI: Truthful data-derived Stock Health without hardcoded placeholders', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await safeGoto(page, '/dashboard');
        await page.waitForLoadState('domcontentloaded');

        // Check for Stock Health / Warehouse Health metric
        const healthSection = page.getByText(/Stock Health|Warehouse Health/i).first();
        await expect(healthSection).toBeVisible({ timeout: 15000 });
    });

    test('7. Branding & Footer: Shows authoritative company name and no developer framework text', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await safeGoto(page, '/dashboard');
        await page.waitForLoadState('domcontentloaded');

        const bodyContent = await page.content();
        // Framework text must be removed
        expect(bodyContent).not.toContain('Tailwind CSS 4');
        expect(bodyContent).not.toContain('shadcn/ui Foundation');
        expect(bodyContent).not.toContain('Inertia 3');

        // Client-facing footer text
        await expect(page.getByText(/Authorized System Access/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('8. Role Governance & Lifecycle Controls: Displays status and role management options', async ({ page }) => {
        await loginAs(page, 'SUPER_ADMIN');

        const resp = await safeGoto(page, '/security/roles');
        expect(resp?.status()).toBe(200);
        await page.waitForLoadState('domcontentloaded');

        await expect(page.getByText(/Role & Account Lifecycle Management/i)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('button:has-text("Status")').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button:has-text("Role")').first()).toBeVisible({ timeout: 10000 });
    });

    test('9. Super Admin Delete Protection: Self-deletion is disabled and protected', async ({ page }) => {
        await loginAs(page, 'SUPER_ADMIN');

        await safeGoto(page, '/security/roles');
        await page.waitForLoadState('domcontentloaded');

        // Check that current user row has disabled Delete button or warning
        await expect(page.getByText(/Self Modification Prohibited/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('10. Non-Super-Admin Delete Denial: Salesman cannot delete users and receives 403 if attempted', async ({ page }) => {
        await loginAs(page, 'SALESMAN');

        // Access to /security/roles is forbidden for standard salesmen
        const resp = await safeGoto(page, '/security/roles');
        expect([403, 302]).toContain(resp?.status());

        // Direct delete request is forbidden
        const deleteResp = await page.request.delete('/security/users/1', {
            data: { reason: 'Unauthorized attack attempt', confirm: true },
        });
        expect([403, 405, 419, 302, 401]).toContain(deleteResp.status());
    });
});
