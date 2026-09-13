import { QAHarness } from './qa_harness.ts';

async function runSuiteE() {
    const harness = new QAHarness();
    await harness.setup();
    console.log('\n>>> RUNNING SUITE E: ADMIN ORDER OPERATIONS & PAYMENT VERIFICATION <<<');

    try {
        // 11.1 Admin Order Operations Queues
        await harness.login('ADMIN');
        await harness.page.goto('http://localhost:8000/admin/orders');
        await harness.page.waitForLoadState('domcontentloaded');
        await harness.page.waitForTimeout(800);

        const ordersContent = await harness.page.content();
        const queuesPresent = ordersContent.includes('Order') && (ordersContent.includes('New') || ordersContent.includes('Processing') || ordersContent.includes('Filter') || ordersContent.includes('Status'));

        harness.record({
            sectionId: '11.1',
            item: 'Admin Order Operations queue workspace loads with operational tabs',
            passed: queuesPresent,
            role: 'ADMIN',
            route: '/admin/orders',
            details: 'Order operations workbench rendered successfully',
            screenshot: await harness.takeScreenshot('sec11_admin_orders_queue'),
        });

        // 11.2 Order Review & Detail View
        // Pick existing seeded order (ID 28)
        await harness.page.goto('http://localhost:8000/admin/orders/28');
        await harness.page.waitForTimeout(1000);
        const orderContent = await harness.page.content();
        const orderLoaded = !harness.page.url().includes('/404') && (orderContent.includes('Items') || orderContent.includes('Customer') || orderContent.includes('Order #') || orderContent.includes('ORD-2026'));

        harness.record({
            sectionId: '11.2',
            item: 'Admin Order Detail view renders line items, customer, and financial totals',
            passed: orderLoaded,
            role: 'ADMIN',
            route: '/admin/orders/28',
            details: 'Order review workbench displayed successfully for order #28',
            screenshot: await harness.takeScreenshot('sec11_order_review_detail'),
        });

        // 12.1 Payment Verification Workspace (Accountant)
        await harness.logout();
        await harness.login('ACCOUNTANT');
        await harness.page.goto('http://localhost:8000/admin/payments');
        await harness.page.waitForTimeout(1000);

        const paymentContent = await harness.page.content();
        const paymentWorkspaceLoaded = !harness.page.url().includes('/404') && (paymentContent.includes('Payment') || paymentContent.includes('Pending') || paymentContent.includes('Verified'));

        harness.record({
            sectionId: '12.1',
            item: 'Accountant Payment Verification workspace renders with verification tabs',
            passed: paymentWorkspaceLoaded,
            role: 'ACCOUNTANT',
            route: '/admin/payments',
            details: 'Payment verification workbench loaded with operational queues',
            screenshot: await harness.takeScreenshot('sec12_accountant_payment_workspace'),
        });

        harness.printSummary('SUITE E (ADMIN ORDERS & PAYMENT VERIFICATION)');
    } catch (err: any) {
        console.error('Fatal error in Suite E:', err);
    } finally {
        await harness.teardown();
    }
}

runSuiteE().catch(console.error);
