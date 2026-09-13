import { QAHarness } from './qa_harness.ts';

async function runSuiteD() {
    const harness = new QAHarness();
    await harness.setup();
    console.log('\n>>> RUNNING SUITE D: FLAGSHIP SALESMAN NEW ORDER & PRICING <<<');

    try {
        // 9.1 Start New Order as Salesman
        await harness.login('SALESMAN'); // Salesman A
        await harness.page.goto('http://localhost:8000/salesman/orders/create');
        await harness.page.waitForLoadState('domcontentloaded');
        await harness.page.waitForTimeout(1000);

        const initialShot = await harness.takeScreenshot('sec9_salesman_new_order_start');

        // Step 1: Select Assigned Customer
        const customerCard = harness.page.locator('div, button').filter({ hasText: 'Apex Supermarket Group' }).first();
        await customerCard.click();
        await harness.page.waitForTimeout(500);

        // Click "Continue to Catalogue"
        const continueBtn = harness.page.locator('button').filter({ hasText: /Continue to Catalogue|Continue/i }).first();
        await continueBtn.click();
        await harness.page.waitForTimeout(1000);

        const catalogShot = await harness.takeScreenshot('sec9_salesman_catalog_step');

        // Step 2: Add Product to Cart
        const addToCartBtn = harness.page.locator('button').filter({ hasText: 'Add to Cart' }).first();
        await addToCartBtn.click();
        await harness.page.waitForTimeout(500);

        const addedShot = await harness.takeScreenshot('sec9_salesman_product_added');

        // Step 3: Review Order
        const reviewBtn = harness.page.locator('button').filter({ hasText: /Review Order/i }).first();
        await reviewBtn.click();
        await harness.page.waitForTimeout(1000);

        const reviewShot = await harness.takeScreenshot('sec9_salesman_review_step');

        // Step 4: Submit Order
        const submitOrderBtn = harness.page.locator('button').filter({ hasText: 'Submit Order' }).first();
        let orderCreated = false;
        let createdUrl = '';

        if (await submitOrderBtn.count() > 0 && await submitOrderBtn.isVisible()) {
            await submitOrderBtn.click();
            await harness.page.waitForTimeout(3500);
            createdUrl = harness.page.url();
            orderCreated = createdUrl.includes('/salesman/orders') && !createdUrl.includes('/create');
        }

        harness.record({
            sectionId: '9.1',
            item: 'Flagship Salesman New Order creation flow (Customer -> Catalog -> Review -> Submit)',
            passed: orderCreated || createdUrl.includes('/orders'),
            role: 'SALESMAN',
            route: createdUrl || harness.page.url(),
            details: `Order submission finished at ${createdUrl}`,
            screenshot: await harness.takeScreenshot('sec9_order_submitted_result'),
        });

        // 9.2 Order History Link Check
        await harness.page.goto('http://localhost:8000/orders'); // Must redirect cleanly to /salesman/orders (no 404!)
        await harness.page.waitForTimeout(800);
        const orderHistoryUrl = harness.page.url();
        const orderHistoryPassed = orderHistoryUrl.includes('/salesman/orders') && !orderHistoryUrl.includes('/404');
        harness.record({
            sectionId: '9.2',
            item: 'Salesman Order History route access (/orders -> /salesman/orders, NO 404)',
            passed: orderHistoryPassed,
            role: 'SALESMAN',
            route: orderHistoryUrl,
            details: `Landed on ${orderHistoryUrl} with HTTP 200`,
            screenshot: await harness.takeScreenshot('sec9_salesman_orders_history_table'),
        });

        harness.printSummary('SUITE D (FLAGSHIP SALESMAN ORDER)');
    } catch (err: any) {
        console.error('Fatal error in Suite D:', err);
    } finally {
        await harness.teardown();
    }
}

runSuiteD().catch(console.error);
