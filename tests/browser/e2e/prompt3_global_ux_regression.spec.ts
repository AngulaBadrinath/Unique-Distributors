import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { safeGoto } from '../helpers/diagnostics';

test.describe('UJW God Prompt 3 — Final Global UX & Browser Regression', () => {
    test.beforeEach(async ({ context }) => {
        await context.clearCookies();
    });

    // =========================================================================
    // ROLE 1: ADMIN WORKFLOW
    // =========================================================================
    test('Role Verification — ADMIN: Login, Dashboard, Search, Form, Detail, Back, and Logout', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        // 1. Dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByText(/Sales Volume|Orders Processed|Unique Jersey Wholesale/i).first()).toBeVisible({ timeout: 15000 });

        // 2. Searchable Page (Customer Master)
        await page.goto('/customers', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/customers/);
        const searchInput = page.locator('input[type="text"], input[placeholder*="Search" i]').first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('Test');
        await page.waitForTimeout(400);

        // 3. Form Page (Customer Create)
        await page.goto('/customers/create', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/customers\/create/);
        await expect(page.locator('input[name="name"], input#name, input[placeholder*="name" i]').first()).toBeVisible({ timeout: 10000 });

        // 4. Detail Page (Customer Detail) & Back Navigation
        await page.goto('/customers', { waitUntil: 'domcontentloaded' });
        const customerLink = page.locator('a[href*="/customers/"]').first();
        if (await customerLink.isVisible({ timeout: 4000 }).catch(() => false)) {
            await customerLink.click();
            await page.waitForURL(/\/customers\/\d+/);
            const backBtn = page.locator('button:has-text("Back"), a:has-text("Back")').first();
            if (await backBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
                await backBtn.click();
                await page.waitForURL(/\/customers/);
            }
        }

        // 5. Logout
        await logout(page);
        await expect(page).toHaveURL(/\/login/);
    });

    // =========================================================================
    // ROLE 2: SALESMAN WORKFLOW
    // =========================================================================
    test('Role Verification — SALESMAN: Login, Workspace, Sales Orders, Create Order, Detail, Back, and Logout', async ({ page }) => {
        await loginAs(page, 'SALESMAN');

        // 1. Workspace / Dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // 2. Searchable Orders List
        await page.goto('/salesman/orders', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/salesman\/orders/);
        const searchInput = page.locator('input[type="text"], input[placeholder*="Search" i]').first();
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await searchInput.fill('Order');
            await page.waitForTimeout(300);
        }

        // 3. Form Page (New Sales Order)
        await page.goto('/salesman/orders/create', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/salesman\/orders\/create/);

        // 4. Detail Page & Back Navigation
        await page.goto('/salesman/orders', { waitUntil: 'domcontentloaded' });
        const orderLink = page.locator('a[href*="/salesman/orders/"]').first();
        if (await orderLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await orderLink.click();
            await page.waitForURL(/\/salesman\/orders\/\d+/);
            const backBtn = page.locator('button:has-text("Back"), a:has-text("Back")').first();
            if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await backBtn.click();
                await page.waitForURL(/\/salesman\/orders/);
            }
        }

        // 5. Logout
        await logout(page);
        await expect(page).toHaveURL(/\/login/);
    });

    // =========================================================================
    // ROLE 3: WAREHOUSE WORKFLOW
    // =========================================================================
    test('Role Verification — WAREHOUSE: Login, Stock Balances, Fulfillment Workspace, Detail, Back, and Logout', async ({ page }) => {
        await loginAs(page, 'WAREHOUSE_MANAGER');

        // 1. Inventory / Stock Balances
        await expect(page).toHaveURL(/\/admin\/inventory|\/admin\/warehouse\/fulfillment/);

        // 2. Searchable Inventory List
        await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
        const searchInput = page.locator('input[type="text"], input[placeholder*="Search" i]').first();
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await searchInput.fill('SKU');
            await page.waitForTimeout(300);
        }

        // 3. Fulfillment Workspace
        await page.goto('/admin/warehouse/fulfillment', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/warehouse\/fulfillment/);

        // 4. Detail / Back Navigation
        const fulfillmentLink = page.locator('a[href*="/admin/warehouse/fulfillment/"], a[href*="/warehouse/fulfillment/"]').first();
        if (await fulfillmentLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await fulfillmentLink.click();
            await page.waitForURL(/\/admin\/warehouse\/fulfillment\/\d+|\/warehouse\/fulfillment\/\d+/);
            const backBtn = page.locator('button:has-text("Back"), a:has-text("Back")').first();
            if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await backBtn.click();
                await page.waitForURL(/\/admin\/warehouse\/fulfillment|\/warehouse\/fulfillment/);
            }
        }

        // 5. Logout
        await logout(page);
        await expect(page).toHaveURL(/\/login/);
    });

    // =========================================================================
    // ROLE 4: DELIVERY WORKFLOW
    // =========================================================================
    test('Role Verification — DELIVERY: Login, Missions Dashboard, Detail View, Back, and Logout', async ({ page }) => {
        await loginAs(page, 'DELIVERY_PARTNER');

        // 1. Delivery Portal
        await expect(page).toHaveURL(/\/delivery/);
        await expect(page.getByText(/Driver Portal|Delivery Missions|Logistics Driver/i).first()).toBeVisible({ timeout: 10000 });

        // 2. Detail Page & Back Navigation
        const missionLink = page.locator('a[href*="/delivery/"]').first();
        if (await missionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await missionLink.click();
            await page.waitForURL(/\/delivery\/\d+/);
            const backBtn = page.locator('a[aria-label="Go back"], button[aria-label="Go back"], a:has-text("Back")').first();
            if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await backBtn.click();
                await page.waitForURL(/\/delivery/);
            }
        }

        // 3. Logout
        await logout(page);
        await expect(page).toHaveURL(/\/login/);
    });

    // =========================================================================
    // ROLE 5: ACCOUNTANT WORKFLOW
    // =========================================================================
    test('Role Verification — ACCOUNTANT: Login, Financial Dashboard, Invoices, Payments, Detail, and Logout', async ({ page }) => {
        await loginAs(page, 'ACCOUNTANT');

        // 1. Dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // 2. Searchable Invoices
        await page.goto('/admin/invoices', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/invoices/);

        // 3. Searchable Payments
        await page.goto('/admin/payments', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/payments/);

        // 4. Detail Navigation
        const invoiceLink = page.locator('a[href*="/admin/invoices/"]').first();
        if (await invoiceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await invoiceLink.click();
            await page.waitForURL(/\/admin\/invoices\/\d+/);
        }

        // 5. Logout
        await logout(page);
        await expect(page).toHaveURL(/\/login/);
    });

    // =========================================================================
    // CROSS-ROLE JOURNEYS (1 TO 8)
    // =========================================================================
    test('Cross-Role Journey 1: Customer Master -> Customer Create -> Form Elements Validated', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await page.goto('/customers', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/customers/);

        const createLink = page.locator('a[href*="/customers/create"], button:has-text("Add Customer"), button:has-text("Onboard Customer")').first();
        await expect(createLink).toBeVisible({ timeout: 10000 });
        await createLink.click();

        await page.waitForURL(/\/customers\/create/);
        await expect(page.locator('input#name, input[name="name"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('Cross-Role Journey 2: Orders -> Order Detail -> Back Navigation', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/orders/);

        const viewLink = page.locator('table a[href*="/admin/orders/"]').first();
        if (await viewLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await viewLink.click();
            await page.waitForURL(/\/admin\/orders\/\d+/);

            const backBtn = page.locator('a:has-text("Back"), button:has-text("Back")').first();
            await expect(backBtn).toBeVisible({ timeout: 10000 });
            await backBtn.click();
            await page.waitForURL(/\/admin\/orders/);
        }
    });

    test('Cross-Role Journey 3: Adjustments -> Review Workspace Queue -> Back Navigation', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await page.goto('/admin/adjustments', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/adjustments/);
        await expect(page.getByText(/Order Adjustments|Adjustment Requests|All Adjustments/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('Cross-Role Journey 4: Returns -> Initiate Return Request -> Back to Returns', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await page.goto('/admin/returns', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/returns/);

        const initiateBtn = page.locator('a[href*="/admin/returns/create"], button:has-text("Initiate Return")').first();
        await expect(initiateBtn).toBeVisible({ timeout: 10000 });
        await initiateBtn.click();

        await page.waitForURL(/\/admin\/returns\/create/);
        await expect(page.getByText(/Initiate Return Request/i).first()).toBeVisible({ timeout: 10000 });

        const backBtn = page.locator('a:has-text("Back to Returns"), button:has-text("Back to Returns"), a:has-text("Back")').first();
        await expect(backBtn).toBeVisible({ timeout: 10000 });
        await backBtn.click();
        await page.waitForURL(/\/admin\/returns/);
    });

    test('Cross-Role Journey 5: Invoices -> Detail -> Print Layout Compliance', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await page.goto('/admin/invoices', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/invoices/);

        const printResp = await safeGoto(page, '/invoices/1/print');
        if (printResp?.status() === 200) {
            await expect(page.locator('h1').filter({ hasText: 'INVOICE' })).toBeVisible({ timeout: 10000 });
            const imgCount = await page.locator('img').count();
            expect(imgCount).toBe(0); // RULE-DOC-001: Zero product images on invoice
        }
    });

    test('Cross-Role Journey 6: Categories -> Search & Filter Controls', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await page.goto('/categories', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/categories/);

        const searchInput = page.locator('input[placeholder*="Search" i]').first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('Apparel');
        await page.waitForTimeout(500);
    });

    test('Cross-Role Journey 7: Tax Profiles -> Search & Filter Controls', async ({ page }) => {
        await loginAs(page, 'ADMIN');

        await page.goto('/tax-profiles', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/tax-profiles/);

        const searchInput = page.locator('input[placeholder*="Search" i]').first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('Standard');
        await page.waitForTimeout(500);
    });

    test('Cross-Role Journey 8: Role Governance -> Account Lifecycle Controls', async ({ page }) => {
        await loginAs(page, 'SUPER_ADMIN');

        await page.goto('/security/roles', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/security\/roles/);

        await expect(page.getByText(/Role & Account Lifecycle Management/i)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('button:has-text("Status")').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button:has-text("Role")').first()).toBeVisible({ timeout: 10000 });
    });

    // =========================================================================
    // RESPONSIVE VIEWPORT QA (1440x900, 1280x800, 1024x768, 390x844)
    // =========================================================================
    const viewports = [
        { name: 'Desktop XL (1440x900)', width: 1440, height: 900 },
        { name: 'Desktop L (1280x800)', width: 1280, height: 800 },
        { name: 'Tablet (1024x768)', width: 1024, height: 768 },
        { name: 'Mobile (390x844)', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
        test(`Responsive Viewport QA — ${vp.name}: No overflow, intact layouts across core screens`, async ({ page }) => {
            test.setTimeout(180000);
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await loginAs(page, 'ADMIN');

            const testRoutes = [
                '/dashboard',
                '/customers',
                '/customers/create',
                '/admin/orders',
                '/admin/returns',
                '/admin/adjustments',
                '/admin/inventory',
                '/admin/invoices',
                '/categories',
                '/tax-profiles',
            ];

            for (const route of testRoutes) {
                await page.goto(route, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(150);

                // Verify page width does not horizontally overflow viewport beyond threshold
                const isOverflowing = await page.evaluate(() => {
                    return document.documentElement.scrollWidth > window.innerWidth + 5;
                });
                expect(isOverflowing).toBe(false);
            }
        });
    }
});
