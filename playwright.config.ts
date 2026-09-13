import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { resolveBrowser } from './tests/browser/resolver';

// Resolve local real browser with zero CDN dependency
let resolvedBrowser;
try {
    resolvedBrowser = resolveBrowser();
    console.log(`[Playwright Config] Using local browser: ${resolvedBrowser.browserName} (${resolvedBrowser.version}) at ${resolvedBrowser.executablePath}`);
} catch (err: any) {
    console.warn(`[Playwright Config] Browser resolution warning: ${err.message}`);
}

const isHeaded = process.env.HEADED === 'true' || process.env.HEADLESS === 'false';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8000';

export default defineConfig({
    testDir: './tests/browser',
    timeout: 45000,
    expect: {
        timeout: 10000,
    },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : (process.env.WORKERS ? parseInt(process.env.WORKERS) : 2),
    reporter: [
        ['list'],
        ['html', { outputFolder: 'artifacts/browser/playwright-report', open: 'never' }],
        ['json', { outputFile: 'artifacts/test-results/playwright-results.json' }],
        ['junit', { outputFile: 'artifacts/test-results/playwright-junit.xml' }],
    ],
    outputDir: 'artifacts/browser/test-results',
    use: {
        baseURL,
        launchOptions: {
            executablePath: resolvedBrowser?.executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        },
        headless: !isHeaded,
        viewport: { width: 1440, height: 900 },
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    projects: [
        {
            name: 'audit-e2e',
            testMatch: /tests\/browser\/audit\/.*\.spec\.ts/,
            use: {
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: 'responsive',
            testMatch: /tests\/browser\/responsive\/.*\.spec\.ts/,
            use: {
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: 'security',
            testMatch: /tests\/browser\/security\/.*\.spec\.ts/,
            use: {
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: 'visual',
            testMatch: /tests\/browser\/visual\/.*\.spec\.ts/,
            use: {
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
});
