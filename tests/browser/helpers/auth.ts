import type { Page } from '@playwright/test';
import { execSync } from 'child_process';
import { generateTOTP } from './totp.ts';

export type UserRole =
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'ACCOUNTANT'
    | 'SALESMAN'
    | 'SALESMAN_B'
    | 'WAREHOUSE_MANAGER'
    | 'DELIVERY_PARTNER'
    | 'SUSPENDED';

export interface UserCredential {
    email: string;
    password: string;
    expectedDashboardRoute: string;
    label: string;
}

export const QA_USER_CREDENTIALS: Record<UserRole, UserCredential> = {
    SUPER_ADMIN: {
        email: 'superadmin.qa@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/dashboard',
        label: 'Super Administrator',
    },
    ADMIN: {
        email: 'admin.qa@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/dashboard',
        label: 'Operations Admin',
    },
    ACCOUNTANT: {
        email: 'accountant.qa@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/dashboard',
        label: 'Finance Accountant',
    },
    SALESMAN: {
        email: 'salesman.a@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/dashboard',
        label: 'Sales Representative North',
    },
    SALESMAN_B: {
        email: 'salesman.b@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/dashboard',
        label: 'Sales Representative South',
    },
    WAREHOUSE_MANAGER: {
        email: 'warehouse.qa@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/admin/inventory',
        label: 'Warehouse Supervisor',
    },
    DELIVERY_PARTNER: {
        email: 'driver.qa@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/delivery',
        label: 'Logistics Driver',
    },
    SUSPENDED: {
        email: 'suspended.qa@example.test',
        password: 'Password123!',
        expectedDashboardRoute: '/login',
        label: 'Suspended Staff',
    },
};

const mfaSecretCache: Record<string, string> = {};

/**
 * Retrieve the TOTP secret for a user if already enrolled in the local database.
 */
function getStoredUserMfaSecret(email: string): string {
    if (mfaSecretCache[email]) {
        return mfaSecretCache[email];
    }
    try {
        const cmd = `php artisan tinker --execute="echo \\App\\Models\\User::where('email', '${email}')->first()?->two_factor_secret;"`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
        const secret = output.trim().replace(/[^A-Za-z0-9]/g, '');
        if (secret) {
            mfaSecretCache[email] = secret;
            return secret;
        }
    } catch {
        // ignore and fallback
    }
    return '';
}

/**
 * Authenticate as a specific project role via the real web login form.
 * Automatically completes MFA challenge if required for privileged roles.
 */
export async function loginAs(page: Page, role: UserRole): Promise<void> {
    const creds = QA_USER_CREDENTIALS[role];
    if (!creds) {
        throw new Error(`[AuthHelper] Unknown user role: "${role}"`);
    }

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8000';
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;

    console.log(`[loginAs] Logging in as ${role} (${creds.email}) at ${loginUrl}`);

    // Always clear session cookies to ensure fresh login and avoid guest redirection
    try {
        await page.context().clearCookies();
        await page.evaluate(() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch {}
        });
    } catch {}

    console.log(`[loginAs] Navigating to ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log(`[loginAs] At ${page.url()}`);

    const emailInput = page.locator('input#email, input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('input#password, input[name="password"], input[type="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    console.log(`[loginAs] Filling credentials`);
    await emailInput.fill(creds.email);
    await passwordInput.fill(creds.password);

    const submitBtn = page.locator('button[type="submit"]');
    console.log(`[loginAs] Clicking submit button`);
    await submitBtn.click();

    console.log(`[loginAs] Waiting for navigation away from /login`);
    await page.waitForURL((url) => !url.pathname.endsWith('/login') || url.pathname.includes('/mfa') || url.pathname.includes('/dashboard') || url.pathname.includes('/admin') || url.pathname.includes('/salesman'), { timeout: 30000 });
    console.log(`[loginAs] After submit, current URL is ${page.url()}`);

    const currentUrl = page.url();
    console.log(`[loginAs] Checking if MFA is required: ${currentUrl}`);

    if (currentUrl.includes('/login/mfa') || currentUrl.includes('/mfa')) {
        console.log(`[loginAs] Entering MFA handler for ${creds.email}`);
        // Step 1: Check for manual key in Inertia props (initial enrollment)
        let secretKey = await page.evaluate(() => {
            try {
                const el = document.getElementById('app') || document.querySelector('[data-page]');
                if (el && el.getAttribute('data-page')) {
                    const data = JSON.parse(el.getAttribute('data-page') || '{}');
                    return (data?.props?.manual_key || '').replace(/[^A-Za-z0-9]/g, '');
                }
            } catch {}
            return '';
        });

        // Step 2: Fallback to DOM span if visible
        if (!secretKey) {
            const manualKeySpan = page.locator('.font-mono').first();
            if (await manualKeySpan.isVisible().catch(() => false)) {
                const text = await manualKeySpan.innerText();
                if (text && text.length >= 16) {
                    secretKey = text.replace(/[^A-Za-z0-9]/g, '');
                }
            }
        }

        // Step 3: If challenge on already enrolled account, fetch from local DB
        if (!secretKey) {
            secretKey = getStoredUserMfaSecret(creds.email);
        }

        console.log(`[loginAs] Resolved secretKey: "${secretKey ? 'EXISTS' : 'EMPTY'}"`);

        if (secretKey) {
            let mfaSuccess = false;
            for (let attempt = 0; attempt < 3; attempt++) {
                const totpCode = generateTOTP(secretKey);
                console.log(`[loginAs] Generated TOTP code: ${totpCode} (attempt ${attempt + 1})`);
                const mfaInput = page.locator('input#code, input[type="text"]').first();
                await mfaInput.waitFor({ state: 'visible', timeout: 10000 });
                await mfaInput.click();
                await mfaInput.fill(totpCode);
                await page.waitForTimeout(200);

                const mfaSubmit = page.locator('button[type="submit"]');
                console.log(`[loginAs] Clicking MFA submit button`);
                try {
                    await mfaSubmit.click({ timeout: 6000 });
                } catch {
                    await mfaInput.press('Enter').catch(() => {});
                }

                console.log(`[loginAs] Waiting for navigation after MFA submit`);
                try {
                    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
                    mfaSuccess = true;
                    console.log(`[loginAs] MFA success! Current URL is ${page.url()}`);
                    break;
                } catch (e: any) {
                    console.log(`[loginAs] MFA attempt ${attempt + 1} timed out or failed. URL: ${page.url()}`);
                    if (page.url().includes('/login/mfa')) {
                        await page.waitForTimeout(1000);
                    } else if (!page.url().includes('/login')) {
                        mfaSuccess = true;
                        break;
                    }
                }
            }
        }
    }

    // Verify successful authentication
    const finalUrl = page.url();
    if (finalUrl.includes('/login')) {
        throw new Error(`[AuthHelper] Login failed for ${role} (${creds.email}). Still on ${finalUrl}`);
    }
}

/**
 * Log out the current session.
 */
export async function logout(page: Page): Promise<void> {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8000';
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;
    try {
        await page.context().clearCookies();
        await page.evaluate(() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch {}
        });
        await page.waitForTimeout(400);
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        if (!page.url().includes('/login')) {
            await page.context().clearCookies();
            await page.waitForTimeout(600);
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
    } catch {
        // Fallback
    }
}
