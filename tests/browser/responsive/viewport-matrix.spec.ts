import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { VIEWPORT_MATRIX } from '../viewports';
import { safeGoto } from '../helpers/diagnostics';

test.describe('Responsive Viewport Matrix Verification', () => {
    test('Verifies no horizontal overflow across 11 breakpoints', async ({ page, context }) => {
        await context.clearCookies();
        await loginAs(page, 'ADMIN');

        const testBreakpoints = Object.values(VIEWPORT_MATRIX);

        await safeGoto(page, '/dashboard');
        await page.waitForLoadState('domcontentloaded');

        for (const bp of testBreakpoints) {
            await page.setViewportSize({ width: bp.width, height: bp.height });
            await page.waitForTimeout(150);

            // Assert no unintentional horizontal scrolling
            const isOverflowing = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth + 2;
            });
            expect(isOverflowing).toBeFalsy();
        }

        await logout(page);
    });
});
