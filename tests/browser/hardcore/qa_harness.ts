import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginAs, logout, QA_USER_CREDENTIALS, type UserRole } from '../helpers/auth.ts';

export const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts', 'browser', 'interactive', 'screenshots', 'audit');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

export interface QATestResult {
    sectionId: string;
    item: string;
    passed: boolean;
    role?: string;
    route?: string;
    viewport?: string;
    details?: string;
    screenshot?: string;
    error?: string;
}

export class QAHarness {
    public browser!: Browser;
    public context!: BrowserContext;
    public page!: Page;
    public results: QATestResult[] = [];
    public baseUrl: string = 'http://localhost:8000';

    async setup(viewport = { width: 1440, height: 900 }) {
        this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        this.context = await this.browser.newContext({
            viewport,
            ignoreHTTPSErrors: true,
        });
        this.page = await this.context.newPage();
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async takeScreenshot(name: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${name}_${timestamp}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await this.page.screenshot({ path: filepath, fullPage: false });
        return `artifacts/browser/interactive/screenshots/audit/${filename}`;
    }

    async login(role: UserRole) {
        await loginAs(this.page, role);
    }

    async logout() {
        await logout(this.page);
    }

    record(result: QATestResult) {
        this.results.push(result);
        const icon = result.passed ? '✓ PASSED' : '✗ FAILED';
        console.log(`  [${icon}] [${result.sectionId}] ${result.item} ${result.role ? `(${result.role})` : ''}`);
        if (result.details) console.log(`      ↳ ${result.details}`);
        if (result.error) console.error(`      ↳ ERROR: ${result.error}`);
        if (result.screenshot) console.log(`      ↳ Shot: ${result.screenshot}`);
    }

    printSummary(suiteName: string) {
        console.log(`\n======================================================`);
        console.log(`  ${suiteName} EXECUTION SUMMARY`);
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
        console.log(`======================================================\n`);
        return { total, passed, failed };
    }
}
