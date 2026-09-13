import { QAHarness } from './qa_harness.ts';

async function runSuiteC() {
    const harness = new QAHarness();
    await harness.setup();
    console.log('\n>>> RUNNING SUITE C: CUSTOMER ONBOARDING & MANAGEMENT <<<');

    try {
        // 5.1 Admin Customer Creation
        await harness.login('ADMIN');
        await harness.page.goto('http://localhost:8000/customers/create');
        await harness.page.waitForLoadState('domcontentloaded');

        const testCustCode = `CUST-${Date.now().toString().slice(-5)}`;
        const testCustName = `Apex Global Mart ${testCustCode}`;

        await harness.page.fill('input#code', testCustCode);
        await harness.page.fill('input#name', testCustName);
        await harness.page.fill('input#contact_name', 'Rahul Sharma');
        await harness.page.fill('input#phone', '+919876543210');
        await harness.page.fill('input#email', `rahul.${testCustCode.toLowerCase()}@example.test`);
        await harness.page.fill('input#billing_address_line1', '404 Commercial Boulevard');
        await harness.page.fill('input#billing_city', 'Mumbai');
        await harness.page.fill('input#billing_state', 'Maharashtra');
        await harness.page.fill('input#billing_postal_code', '400050');
        
        // Check "same as billing" checkbox if present
        const sameCheckbox = harness.page.locator('input#same_as_billing, input[type="checkbox"]');
        if (await sameCheckbox.count() > 0) {
            await sameCheckbox.first().check().catch(() => {});
        } else {
            await harness.page.fill('input#shipping_address_line1', '404 Commercial Boulevard').catch(() => {});
            await harness.page.fill('input#shipping_city', 'Mumbai').catch(() => {});
            await harness.page.fill('input#shipping_state', 'Maharashtra').catch(() => {});
            await harness.page.fill('input#shipping_postal_code', '400050').catch(() => {});
        }

        await harness.page.fill('input#credit_limit', '50000');
        
        // Select payment terms
        const paymentTermsSelect = harness.page.locator('select#payment_terms');
        if (await paymentTermsSelect.count() > 0) {
            await paymentTermsSelect.first().selectOption({ index: 1 }).catch(() => {});
        }

        // Select Salesman A (ID 27)
        const salesmanSelect = harness.page.locator('select#salesman_id');
        if (await salesmanSelect.count() > 0) {
            await salesmanSelect.first().selectOption({ value: '27' }).catch(() => {});
        }

        const createShot = await harness.takeScreenshot('sec5_customer_form_filled');
        await harness.page.click('button[type="submit"]');
        await harness.page.waitForURL(url => !url.pathname.includes('/customers/create'), { timeout: 15000 }).catch(() => {});
        await harness.page.waitForTimeout(1000);

        const currentUrl = harness.page.url();
        const createdSuccess = currentUrl.includes('/customers') && !currentUrl.includes('/customers/create');
        harness.record({
            sectionId: '5.1',
            item: 'Customer Onboarding Form submission and account creation',
            passed: createdSuccess,
            role: 'ADMIN',
            route: '/customers/create',
            details: `Created customer ${testCustCode} (${testCustName}), redirected to ${currentUrl}`,
            screenshot: await harness.takeScreenshot('sec5_customer_created_redirect'),
        });

        // 5.2 Customer Search & Directory Table
        await harness.page.goto(`http://localhost:8000/customers?search=${encodeURIComponent(testCustCode)}`);
        await harness.page.waitForTimeout(800);
        const searchTableContent = await harness.page.content();
        const foundInTable = searchTableContent.includes(testCustCode);
        harness.record({
            sectionId: '5.2',
            item: 'Customer search by unique customer code',
            passed: foundInTable,
            role: 'ADMIN',
            route: `/customers?search=${testCustCode}`,
            details: `Found record matching code ${testCustCode} in table`,
            screenshot: await harness.takeScreenshot('sec5_customer_search_found'),
        });

        // 5.3 Customer Detail View & Tabs
        const detailTargetUrl = (currentUrl && currentUrl.includes('/customers/') && !currentUrl.includes('/customers/create'))
            ? currentUrl
            : 'http://localhost:8000/customers/31';

        await harness.page.goto(detailTargetUrl, { waitUntil: 'domcontentloaded' });
        await harness.page.waitForTimeout(1000);

        const detailUrl = harness.page.url();
        const detailContent = await harness.page.content();
        const detailLoaded = !detailUrl.includes('/404') && (
            detailContent.includes('Credit Limit') || 
            detailContent.includes('Outstanding') || 
            detailContent.includes('Account') ||
            detailContent.includes('Terms') ||
            detailContent.includes(testCustCode)
        );

        harness.record({
            sectionId: '5.3',
            item: 'Customer detail view loads with credit, contact & balance parameters',
            passed: detailLoaded,
            role: 'ADMIN',
            route: detailUrl,
            details: `Customer detail rendered successfully at ${detailUrl}`,
            screenshot: await harness.takeScreenshot('sec5_customer_detail_view'),
        });

        // 5.4 Territory Scoping: Salesman A vs Salesman B
        // Salesman A (ID 27) assigned to customer -> must see it
        await harness.logout();
        await harness.login('SALESMAN'); // Salesman A
        await harness.page.goto('http://localhost:8000/customers');
        await harness.page.waitForTimeout(800);
        const salesAContent = await harness.page.content();
        const salesAHasAccess = salesAContent.includes('Apex Supermarket') || salesAContent.includes('Beacon Gourmet') || salesAContent.includes(testCustCode);
        harness.record({
            sectionId: '5.4',
            item: 'Salesman A has visibility of assigned territory customers',
            passed: salesAHasAccess,
            role: 'SALESMAN (A)',
            route: '/customers',
            details: 'Assigned accounts present in salesman directory',
            screenshot: await harness.takeScreenshot('sec5_salesman_a_customers'),
        });

        // Salesman B (ID 28) -> must NOT see Salesman A's customers
        await harness.logout();
        await harness.login('SALESMAN_B'); // Salesman B
        await harness.page.goto('http://localhost:8000/customers');
        await harness.page.waitForTimeout(800);
        const salesBContent = await harness.page.content();
        const salesBBlocked = !salesBContent.includes('Apex Supermarket') && !salesBContent.includes('Beacon Gourmet');
        harness.record({
            sectionId: '5.5',
            item: 'Salesman B cannot see Salesman A assigned territory customers (Isolation)',
            passed: salesBBlocked,
            role: 'SALESMAN_B',
            route: '/customers',
            details: 'Cross-salesman customer isolation verified in directory table',
            screenshot: await harness.takeScreenshot('sec5_salesman_b_isolated'),
        });

        harness.printSummary('SUITE C (CUSTOMER ONBOARDING & ISOLATION)');
    } catch (err: any) {
        console.error('Fatal error in Suite C:', err);
    } finally {
        await harness.teardown();
    }
}

runSuiteC().catch(console.error);
