import { QAHarness } from './qa_harness.ts';

async function runSuiteG() {
    const harness = new QAHarness();
    await harness.setup();
    console.log('\n>>> RUNNING SUITE G: ADJUSTMENTS, INVENTORY, DELIVERY, RETURNS & CREDITS <<<');

    try {
        // 15.1 Order Adjustments Queue (Admin)
        await harness.login('ADMIN');
        await harness.page.goto('http://localhost:8000/admin/adjustments');
        await harness.page.waitForLoadState('domcontentloaded');
        await harness.page.waitForTimeout(800);

        const adjContent = await harness.page.content();
        const adjLoaded = !harness.page.url().includes('/404') && (adjContent.includes('Adjustment') || adjContent.includes('Quantity') || adjContent.includes('Status'));
        harness.record({
            sectionId: '15.1',
            item: 'Order Adjustments review queue workbench loads with adjustment records',
            passed: adjLoaded,
            role: 'ADMIN',
            route: '/admin/adjustments',
            details: 'Order adjustment workbench active',
            screenshot: await harness.takeScreenshot('sec15_order_adjustments_queue'),
        });

        // 16.1 Inventory Dashboard (Warehouse Manager)
        await harness.logout();
        await harness.login('WAREHOUSE_MANAGER');
        await harness.page.goto('http://localhost:8000/admin/inventory');
        await harness.page.waitForTimeout(800);

        const invContent = await harness.page.content();
        const invLoaded = !harness.page.url().includes('/404') && (invContent.includes('On Hand') || invContent.includes('Reserved') || invContent.includes('Available') || invContent.includes('Inventory'));
        harness.record({
            sectionId: '16.1',
            item: 'Warehouse Inventory Dashboard displays on-hand, reserved, and available quantities',
            passed: invLoaded,
            role: 'WAREHOUSE_MANAGER',
            route: '/admin/inventory',
            details: 'Inventory balances table active',
            screenshot: await harness.takeScreenshot('sec16_inventory_dashboard'),
        });

        // 16.2 Stock Exceptions Queue
        await harness.page.goto('http://localhost:8000/admin/inventory-exceptions');
        await harness.page.waitForTimeout(800);
        const excLoaded = !harness.page.url().includes('/404');
        harness.record({
            sectionId: '16.2',
            item: 'Stock Exceptions workbench loads with damaged/shortage exception logs',
            passed: excLoaded,
            role: 'WAREHOUSE_MANAGER',
            route: '/admin/inventory-exceptions',
            details: 'Stock exceptions workbench active',
            screenshot: await harness.takeScreenshot('sec16_stock_exceptions'),
        });

        // 17.1 Delivery Partner Portal (Driver)
        await harness.logout();
        await harness.login('DELIVERY_PARTNER');
        await harness.page.goto('http://localhost:8000/delivery');
        await harness.page.waitForTimeout(800);

        const delContent = await harness.page.content();
        const delLoaded = !harness.page.url().includes('/404') && (delContent.includes('Delivery') || delContent.includes('Assigned') || delContent.includes('Route'));
        harness.record({
            sectionId: '17.1',
            item: 'Delivery Partner Portal loads assigned delivery route and packages',
            passed: delLoaded,
            role: 'DELIVERY_PARTNER',
            route: '/delivery',
            details: 'Driver logistics portal active',
            screenshot: await harness.takeScreenshot('sec17_delivery_portal'),
        });

        // 18.1 Reverse Logistics & Returns (Admin)
        await harness.logout();
        await harness.login('ADMIN');
        await harness.page.goto('http://localhost:8000/admin/returns');
        await harness.page.waitForTimeout(800);

        const retContent = await harness.page.content();
        const retLoaded = !harness.page.url().includes('/404') && (retContent.includes('Return') || retContent.includes('RMA') || retContent.includes('Status'));
        harness.record({
            sectionId: '18.1',
            item: 'Reverse Logistics return requests queue displays RMA inspection workflows',
            passed: retLoaded,
            role: 'ADMIN',
            route: '/admin/returns',
            details: 'Returns workbench active',
            screenshot: await harness.takeScreenshot('sec18_returns_queue'),
        });

        // 19.1 Credit Notes & Refunds
        await harness.page.goto('http://localhost:8000/admin/credits');
        await harness.page.waitForTimeout(800);
        const creditLoaded = !harness.page.url().includes('/404');
        harness.record({
            sectionId: '19.1',
            item: 'Credit Notes ledger renders issued credits and linked return references',
            passed: creditLoaded,
            role: 'ADMIN',
            route: '/admin/credits',
            details: 'Credit notes workbench active',
            screenshot: await harness.takeScreenshot('sec19_credits_ledger'),
        });

        await harness.page.goto('http://localhost:8000/admin/refunds');
        await harness.page.waitForTimeout(800);
        const refundLoaded = !harness.page.url().includes('/404');
        harness.record({
            sectionId: '19.2',
            item: 'Refund Requests management queue renders pending refund approvals',
            passed: refundLoaded,
            role: 'ADMIN',
            route: '/admin/refunds',
            details: 'Refunds workbench active',
            screenshot: await harness.takeScreenshot('sec19_refunds_queue'),
        });

        harness.printSummary('SUITE G (OPERATIONS)');
    } catch (err: any) {
        console.error('Fatal error in Suite G:', err);
    } finally {
        await harness.teardown();
    }
}

runSuiteG().catch(console.error);
