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
    if (mfaSecretCache[email]) return mfaSecretCache[email];
    try {
        const cmd = `php artisan tinker --execute="echo \\App\\Models\\User::where('email', '${email}')->value('two_factor_secret');"`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
        const secret = output.trim().replace(/[^A-Za-z0-9]/g, '');
        if (secret) mfaSecretCache[email] = secret;
        return secret;
    } catch {
        return '';
    }
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

    // Always clear session cookies to ensure fresh login and avoid guest redirection
    try {
        await page.context().clearCookies();
    } catch {}

    let gotoAttempts = 0;
    while (gotoAttempts < 4) {
        try {
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            break;
        } catch (err: any) {
            gotoAttempts++;
            if (gotoAttempts >= 4) throw err;
            await page.waitForTimeout(1000);
        }
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.locator('input[type="email"], input[name="email"]').waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForTimeout(200);

        const emailInput = page.locator('input#email, input[name="email"], input[type="email"]').first();
        const passwordInput = page.locator('input#password, input[name="password"], input[type="password"]').first();

        await emailInput.click();
        await emailInput.fill(creds.email);
        await emailInput.dispatchEvent('input');
        await emailInput.dispatchEvent('change');
        await page.waitForTimeout(100);

        await passwordInput.click();
        await passwordInput.fill(creds.password);
        await passwordInput.dispatchEvent('input');
        await passwordInput.dispatchEvent('change');
        await page.waitForTimeout(200);

        const submitBtn = page.locator('button[type="submit"]');
        await submitBtn.click();

        try {
            await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });
            break;
        } catch {
            if (attempt === 3) {
                const alertText = await page.locator('[role="alert"], .text-destructive').first().textContent().catch(() => '');
                throw new Error(`[AuthHelper] Login failed for ${role} (${creds.email}). Still on ${page.url()}. Page alert: "${alertText?.trim()}"`);
            }
            await page.waitForTimeout(1000);
        }
    }

    const currentUrl = page.url();

    if (currentUrl.includes('/login/mfa') || currentUrl.includes('/mfa')) {
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

        if (secretKey) {
            let mfaSuccess = false;
            for (let attempt = 0; attempt < 3; attempt++) {
                const totpCode = generateTOTP(secretKey);
                const mfaInput = page.locator('input#code, input[name="code"], input[type="text"]').first();
                await mfaInput.fill(totpCode);

                const mfaSubmit = page.locator('button[type="submit"]');
                await mfaSubmit.click();

                try {
                    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
                    mfaSuccess = true;
                    break;
                } catch {
                    // Check if error message appeared or still on /login/mfa
                    if (page.url().includes('/login')) {
                        await page.waitForTimeout(1500);
                    } else {
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
        await page.waitForTimeout(400);
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch {
        // Fallback
    }
}
