import { test, expect } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { resolveBrowser } from '../resolver.ts';
import { checkCdpEndpoint, detectMonitorPlacement } from './launch-chrome.ts';
import { InteractiveBrowserController } from './controller.ts';

test.describe('Second-Monitor Real-Chrome QA Environment Verification', () => {
    const port = parseInt(process.env.CHROME_DEBUG_PORT || '9222', 10);
    const qaProfileDir = path.resolve(process.cwd(), 'artifacts', 'browser', 'qa-profile');

    test('1. Dynamic Local Chrome Discovery (Zero CDN dependency)', () => {
        const resolved = resolveBrowser();
        expect(resolved.executablePath).toBeTruthy();
        expect(fs.existsSync(resolved.executablePath)).toBe(true);
        expect(resolved.browserName).toMatch(/Chrome|Edge|Brave|Chromium/);
    });

    test('2. Dedicated Isolated QA Profile directory is configured', () => {
        expect(qaProfileDir).toContain('artifacts');
        expect(qaProfileDir).toContain('qa-profile');
        expect(fs.existsSync(qaProfileDir)).toBe(true);
    });

    test('3. Windows Monitor Topology Detection', () => {
        const placement = detectMonitorPlacement();
        expect(placement.width).toBeGreaterThanOrEqual(1024);
        expect(placement.height).toBeGreaterThanOrEqual(600);
        expect(typeof placement.x).toBe('number');
        expect(typeof placement.y).toBe('number');
        expect(placement.monitorDescription).toBeTruthy();
    });

    test('4. CDP Health Check endpoint responds on 127.0.0.1:9222', async () => {
        const check = await checkCdpEndpoint(port);
        expect(check.isRunning).toBe(true);
        expect(check.versionData).toBeTruthy();
    });

    test('5. Shared CDP connection operates on the same visible Chrome instance', async () => {
        const controller = new InteractiveBrowserController();
        const status = await controller.start();

        expect(status.isRunning).toBe(true);
        expect(status.totalTabs).toBeGreaterThanOrEqual(1);

        // Navigate via controller
        await controller.navigate('/login');
        const page = controller.getActivePage();
        await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
        expect(page.url()).toContain('/login');

        // Verify page title and DOM presence
        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title).toMatch(/sign in/i);

        // Test observation
        const obs = await controller.observe({ detailLevel: 'detailed' });
        expect(obs.url).toContain('/login');
        expect(obs.inputs.length).toBeGreaterThan(0);
        expect(obs.buttons.length).toBeGreaterThan(0);
    });

    test('6. Multi-tab and Viewport switching on shared visible Chrome', async () => {
        const controller = new InteractiveBrowserController();
        await controller.start();

        // Switch to mobile viewport
        await controller.setViewport('mobile_390');
        const statusMobile = await controller.getStatus();
        expect(statusMobile.viewport?.width).toBe(390);

        // Switch back to desktop viewport
        await controller.setViewport('desktop_1440');
        const statusDesktop = await controller.getStatus();
        expect(statusDesktop.viewport?.width).toBe(1440);

        // Open new tab
        await controller.newTab('/admin/customers');
        const tabs = await controller.listTabs();
        expect(tabs.length).toBeGreaterThanOrEqual(2);

        // Switch tab
        await controller.switchTab(0);
        expect(controller.getActivePage().url()).toContain('/login');

        // Close secondary tab
        if (tabs.length > 1) {
            await controller.closeTab(1);
        }
    });

    test('7. Security: External navigation allowlist enforcement', async () => {
        const controller = new InteractiveBrowserController();
        await controller.start();

        await expect(controller.navigate('https://malicious-external-site.com')).rejects.toThrow(
            /Security Policy.*blocked/
        );
    });
});
