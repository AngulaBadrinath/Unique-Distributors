import { QAHarness } from './qa_harness.ts';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function main() {
    console.log('================================================================');
    console.log('  STARTING LIVE REAL-BROWSER MASTER PLAYWRIGHT AUDIT EXECUTION  ');
    console.log('================================================================\n');

    const startTime = new Date().toISOString();

    const suites = [
        { name: 'Suite A: Shell, Viewports & Error Pages', file: 'tests/browser/hardcore/suite_a_shell_responsive.ts' },
        { name: 'Suite B: Auth, Invalidation & RBAC Isolation', file: 'tests/browser/hardcore/suite_b_auth_and_isolation.ts' },
        { name: 'Suite C: Customer Onboarding & Management', file: 'tests/browser/hardcore/suite_c_customer_mgmt.ts' },
        { name: 'Suite D: Flagship Salesman Order Wizard', file: 'tests/browser/hardcore/suite_d_order_and_payment.ts' },
        { name: 'Suite E: Admin Orders Queue & Verification', file: 'tests/browser/hardcore/suite_e_admin_orders_and_verification.ts' },
        { name: 'Suite F: Receivables, Payables, GL & Financial Statements', file: 'tests/browser/hardcore/suite_f_receivables_payables_gl.ts' },
        { name: 'Suite G: Adjustments, Inventory, Delivery & Returns', file: 'tests/browser/hardcore/suite_g_operations.ts' },
        { name: 'Suite H: Invoices, Reports, Notifications & Security Timeline', file: 'tests/browser/hardcore/suite_h_invoices_reports_notifications.ts' },
    ];

    let allPassed = true;
    for (const suite of suites) {
        console.log(`\n>>> EXECUTING ${suite.name}...`);
        try {
            const output = execSync(`npx tsx "${suite.file}"`, {
                cwd: process.cwd(),
                stdio: 'inherit',
                env: { ...process.env, NODE_OPTIONS: '--no-warnings' }
            });
        } catch (err: any) {
            console.error(`FAILED executing ${suite.name}:`, err.message);
            allPassed = false;
            throw err;
        }
    }

    const endTime = new Date().toISOString();
    console.log('\n================================================================');
    console.log(`  ALL SUITES EXECUTED SUCCESSFULLY!`);
    console.log(`  Start Time: ${startTime} | End Time: ${endTime}`);
    console.log('================================================================\n');
}

main().catch(err => {
    console.error('Master audit execution aborted due to error:', err);
    process.exit(1);
});
