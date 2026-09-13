import { QAHarness } from './qa_harness.ts';
import { QA_USER_CREDENTIALS, type UserRole } from '../helpers/auth.ts';

async function runSuiteB() {
    const harness = new QAHarness();
    await harness.setup();
    console.log('\n>>> RUNNING SUITE B: AUTHENTICATION, SESSIONS & IDOR ISOLATION <<<');

    try {
        // 3.1 Invalid login credentials
        await harness.page.goto('http://localhost:8000/login');
        await harness.page.fill('input[type="email"]', 'bad.user@example.test');
        await harness.page.fill('input[type="password"]', 'WrongPass123!');
        await harness.page.click('button[type="submit"]');
        await harness.page.waitForTimeout(1500);
        const onLogin = harness.page.url().includes('/login');
        const alertMsg = await harness.page.locator('[role="alert"], .text-destructive, span:has-text("These credentials")').first().textContent().catch(() => '');
        const loginRejected = onLogin && (alertMsg !== '' || (await harness.page.content()).includes('credentials do not match') || (await harness.page.content()).includes('Authentication Notice'));
        harness.record({
            sectionId: '3.1',
            item: 'Invalid login credentials rejected with error message',
            passed: loginRejected,
            details: `Remained on /login with alert detected: "${alertMsg?.trim() || 'Notice banner detected'}"`,
            screenshot: await harness.takeScreenshot('sec3_invalid_login'),
        });

        // 3.2 Suspended user login rejection
        await harness.page.fill('input[type="email"]', 'suspended.qa@example.test');
        await harness.page.fill('input[type="password"]', 'Password123!');
        await harness.page.click('button[type="submit"]');
        await harness.page.waitForTimeout(1000);
        const suspendedBlocked = harness.page.url().includes('/login');
        harness.record({
            sectionId: '3.2',
            item: 'Suspended user login rejected',
            passed: suspendedBlocked,
            details: 'Suspended account prevented from logging in',
            screenshot: await harness.takeScreenshot('sec3_suspended_login'),
        });

        // 3.3 Role authentication & landing
        const rolesToTest: UserRole[] = [
            'SUPER_ADMIN',
            'ADMIN',
            'ACCOUNTANT',
            'SALESMAN',
            'SALESMAN_B',
            'WAREHOUSE_MANAGER',
            'DELIVERY_PARTNER',
        ];

        for (const role of rolesToTest) {
            await harness.logout();
            await harness.login(role);
            const currentUrl = harness.page.url();
            const creds = QA_USER_CREDENTIALS[role];
            const passed = currentUrl.includes(creds.expectedDashboardRoute);
            harness.record({
                sectionId: `3.role.${role}`,
                item: `Role authentication & landing verified: ${role}`,
                passed,
                role,
                route: currentUrl,
                details: `Landed on expected route: ${currentUrl}`,
                screenshot: await harness.takeScreenshot(`sec3_role_${role.toLowerCase()}`),
            });
        }

        // 25.1 IDOR: Salesman cannot access /admin/audit/timeline
        await harness.logout();
        await harness.login('SALESMAN');
        const adminAuditResp = await harness.page.goto('http://localhost:8000/admin/audit/timeline');
        const auditStatus = adminAuditResp?.status();
        const auditForbidden = auditStatus === 403 || harness.page.url().includes('/dashboard') || harness.page.url().includes('/403');
        harness.record({
            sectionId: '25.1',
            item: 'Salesman cannot access admin audit timeline (IDOR / Scope)',
            passed: auditForbidden,
            role: 'SALESMAN',
            route: '/admin/audit/timeline',
            details: `Response status: ${auditStatus}, Final URL: ${harness.page.url()}`,
            screenshot: await harness.takeScreenshot('sec25_salesman_audit_denied'),
        });

        // 25.2 IDOR: Salesman cannot access payment verification
        const paymentVerifyResp = await harness.page.goto('http://localhost:8000/admin/payments');
        const paymentVerifyStatus = paymentVerifyResp?.status();
        const paymentForbidden = paymentVerifyStatus === 403 || harness.page.url().includes('/dashboard') || harness.page.url().includes('/403');
        harness.record({
            sectionId: '25.2',
            item: 'Salesman cannot access payment verification workspace',
            passed: paymentForbidden,
            role: 'SALESMAN',
            route: '/admin/payments',
            details: `Response status: ${paymentVerifyStatus}, Final URL: ${harness.page.url()}`,
            screenshot: await harness.takeScreenshot('sec25_salesman_payment_verify_denied'),
        });

        // 25.3 IDOR: Salesman A cannot access Salesman B customer
        // Salesman A assigned customers: 31, 32, 33. Salesman B customer: 34 (Crestline)
        const unassignedCustResp = await harness.page.goto('http://localhost:8000/customers/34');
        const unassignedCustStatus = unassignedCustResp?.status();
        const custForbidden = unassignedCustStatus === 403 || unassignedCustStatus === 404 || harness.page.url().includes('/customers') && !harness.page.url().includes('/customers/34');
        harness.record({
            sectionId: '25.3',
            item: 'Salesman cannot access unassigned customer details (IDOR)',
            passed: custForbidden,
            role: 'SALESMAN',
            route: '/customers/34',
            details: `Response status: ${unassignedCustStatus}, Final URL: ${harness.page.url()}`,
            screenshot: await harness.takeScreenshot('sec25_salesman_unassigned_cust_denied'),
        });

        await harness.logout();
        await harness.login('DELIVERY_PARTNER');
        await harness.page.waitForTimeout(800);
        const deliveryAccResp = await harness.page.goto('http://localhost:8000/admin/accounting/profit-loss', { waitUntil: 'domcontentloaded' });
        const deliveryAccStatus = deliveryAccResp?.status();
        const deliveryAccForbidden = deliveryAccStatus === 403 || harness.page.url().includes('/delivery') || harness.page.url().includes('/403');
        harness.record({
            sectionId: '25.4',
            item: 'Delivery Partner cannot access financial P&L accounting (IDOR)',
            passed: deliveryAccForbidden,
            role: 'DELIVERY_PARTNER',
            route: '/admin/accounting/profit-loss',
            details: `Response status: ${deliveryAccStatus}, Final URL: ${harness.page.url()}`,
            screenshot: await harness.takeScreenshot('sec25_delivery_accounting_denied'),
        });

        harness.printSummary('SUITE B (AUTH & ISOLATION)');
    } catch (err: any) {
        console.error('Fatal error in Suite B:', err);
    } finally {
        await harness.teardown();
    }
}

runSuiteB().catch(console.error);
