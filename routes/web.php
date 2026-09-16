<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\SessionManagementController;
use App\Http\Controllers\HealthCheckController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public routes
Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return redirect()->route('login');
})->name('home');

// Guest authentication routes
Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])
        ->middleware('throttle:login')
        ->name('login.store');

    Route::get('/login/mfa', [\App\Http\Controllers\Auth\MfaChallengeController::class, 'create'])->name('mfa.challenge');
    Route::post('/login/mfa', [\App\Http\Controllers\Auth\MfaChallengeController::class, 'store'])
        ->middleware('throttle:mfa')
        ->name('mfa.challenge.store');

    Route::get('/forgot-password', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])
        ->middleware('throttle:password-reset')
        ->name('password.email');

    Route::get('/reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('password.store');
});

// Authenticated routes with active account enforcement
Route::middleware(['auth', 'account.active'])->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
    Route::get('/dashboard', \App\Http\Controllers\DashboardController::class)->name('dashboard');

    // Backward compatibility redirects for legacy create routes (DEAD-002)
    Route::redirect('/customers-create', '/customers/create', 301);
    Route::redirect('/salesmen-create', '/salesmen/create', 301);
    Route::redirect('/products-create', '/products/create', 301);
    Route::redirect('/categories-create', '/categories/create', 301);
    Route::redirect('/tax-profiles-create', '/tax-profiles/create', 301);
    Route::redirect('/orders', '/salesman/orders', 301);
    Route::redirect('/orders/create', '/salesman/orders/create', 301);
    Route::redirect('/admin/customers', '/customers', 301);
    Route::redirect('/admin/products', '/products', 301);
    Route::redirect('/admin/categories', '/categories', 301);
    Route::redirect('/admin/payments/verification', '/admin/payments', 301);
    Route::redirect('/admin/accounting/receivables', '/admin/receivables', 301);
    Route::redirect('/admin/accounting/payables', '/admin/payables', 301);
    Route::redirect('/admin/accounting/chart-of-accounts', '/admin/accounting/accounts', 301);
    Route::redirect('/admin/audit-logs', '/admin/audit/timeline', 301);
    Route::get('/admin/accounting/statements/{id}', fn($id) => redirect("/admin/receivables/{$id}/statement", 301));

    // Active session tracking and revocation
    Route::get('/security/sessions', [SessionManagementController::class, 'index'])->name('sessions.index');
    Route::post('/security/sessions/{id}/revoke', [SessionManagementController::class, 'destroy'])->name('sessions.revoke');
    Route::post('/security/sessions/revoke-others', [SessionManagementController::class, 'destroyOthers'])->name('sessions.revoke-others');
    Route::post('/security/sessions/revoke-all', [SessionManagementController::class, 'destroyAll'])->name('sessions.revoke-all');

    // Multi-factor authentication settings
    Route::get('/security/mfa', [\App\Http\Controllers\Security\TwoFactorAuthenticationController::class, 'index'])->name('mfa.index');
    Route::post('/security/mfa/enable', [\App\Http\Controllers\Security\TwoFactorAuthenticationController::class, 'enable'])->name('mfa.enable');
    Route::post('/security/mfa/confirm', [\App\Http\Controllers\Security\TwoFactorAuthenticationController::class, 'confirm'])->name('mfa.confirm');
    Route::delete('/security/mfa', [\App\Http\Controllers\Security\TwoFactorAuthenticationController::class, 'disable'])->name('mfa.disable');
    Route::post('/security/mfa/recovery-codes', [\App\Http\Controllers\Security\TwoFactorAuthenticationController::class, 'regenerateRecoveryCodes'])->name('mfa.recovery-codes');

    // In-App Notification Center & Popover Feed (FEAT-NOTIF-001)
    Route::get('/notifications', [\App\Http\Controllers\Notification\NotificationController::class, 'index'])->name('notifications.index');
    Route::get('/notifications/feed', [\App\Http\Controllers\Notification\NotificationController::class, 'feed'])->name('notifications.feed');
    Route::get('/notifications/unread-count', [\App\Http\Controllers\Notification\NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
    Route::post('/notifications/read-all', [\App\Http\Controllers\Notification\NotificationController::class, 'markAllAsRead'])->name('notifications.read-all');
    Route::post('/notifications/{id}/read', [\App\Http\Controllers\Notification\NotificationController::class, 'markAsRead'])->whereNumber('id')->name('notifications.read');
    Route::delete('/notifications/{id}', [\App\Http\Controllers\Notification\NotificationController::class, 'destroy'])->whereNumber('id')->name('notifications.destroy');
    Route::get('/notifications/preferences', [\App\Http\Controllers\Notification\NotificationController::class, 'preferences'])->name('notifications.preferences');
    Route::put('/notifications/preferences', [\App\Http\Controllers\Notification\NotificationController::class, 'updatePreferences'])->name('notifications.preferences.update');
    Route::post('/notifications/preferences', [\App\Http\Controllers\Notification\NotificationController::class, 'updatePreferences'])->name('notifications.preferences.post');

    // System & Role management (requires role.manage permission)
    Route::middleware('permission:role.manage')->group(function () {
        Route::get('/security/roles', [\App\Http\Controllers\Security\RoleAssignmentController::class, 'index'])->name('roles.index');
        Route::put('/security/users/{user}/role', [\App\Http\Controllers\Security\RoleAssignmentController::class, 'update'])->name('users.role.update');

        // Company Information Settings
        Route::get('/system/company', [\App\Http\Controllers\System\CompanyInformationController::class, 'index'])->name('system.company.index');
        Route::put('/system/company', [\App\Http\Controllers\System\CompanyInformationController::class, 'update'])->name('system.company.update');
    });

    // Customer Management
    Route::middleware('permission:customer.view')->group(function () {
        Route::get('/customers', [\App\Http\Controllers\Customer\CustomerController::class, 'index'])->name('customers.index');
        Route::get('/customers/{customer}', [\App\Http\Controllers\Customer\CustomerController::class, 'show'])->whereNumber('customer')->name('customers.show');
    });

    Route::middleware('permission:customer.create')->group(function () {
        Route::get('/customers/create', [\App\Http\Controllers\Customer\CustomerController::class, 'create'])->name('customers.create');
        Route::post('/customers', [\App\Http\Controllers\Customer\CustomerController::class, 'store'])->name('customers.store');
    });

    Route::middleware('permission:customer.update')->group(function () {
        Route::get('/customers/{customer}/edit', [\App\Http\Controllers\Customer\CustomerController::class, 'edit'])->whereNumber('customer')->name('customers.edit');
        Route::put('/customers/{customer}', [\App\Http\Controllers\Customer\CustomerController::class, 'update'])->whereNumber('customer')->name('customers.update');
        Route::patch('/customers/{customer}/status', [\App\Http\Controllers\Customer\CustomerController::class, 'updateStatus'])->whereNumber('customer')->name('customers.status');
        Route::patch('/customers/{customer}/assign', [\App\Http\Controllers\Customer\CustomerController::class, 'assignSalesman'])->whereNumber('customer')->name('customers.assign');
    });

    // Salesman Management
    Route::middleware('permission:user.view')->group(function () {
        Route::get('/salesmen', [\App\Http\Controllers\Salesman\SalesmanController::class, 'index'])->name('salesmen.index');
        Route::get('/salesmen/{salesman}', [\App\Http\Controllers\Salesman\SalesmanController::class, 'show'])->whereNumber('salesman')->name('salesmen.show');
    });

    Route::middleware('permission:user.create')->group(function () {
        Route::get('/salesmen/create', [\App\Http\Controllers\Salesman\SalesmanController::class, 'create'])->name('salesmen.create');
        Route::post('/salesmen', [\App\Http\Controllers\Salesman\SalesmanController::class, 'store'])->name('salesmen.store');
    });

    Route::middleware('permission:user.update')->group(function () {
        Route::get('/salesmen/{salesman}/edit', [\App\Http\Controllers\Salesman\SalesmanController::class, 'edit'])->whereNumber('salesman')->name('salesmen.edit');
        Route::put('/salesmen/{salesman}', [\App\Http\Controllers\Salesman\SalesmanController::class, 'update'])->whereNumber('salesman')->name('salesmen.update');
        Route::patch('/salesmen/{salesman}/status', [\App\Http\Controllers\Salesman\SalesmanController::class, 'updateStatus'])->whereNumber('salesman')->name('salesmen.status');
    });

    // Delivery Partner Management (FEAT-DEL-009)
    Route::middleware('permission:user.view')->group(function () {
        Route::get('/admin/delivery-partners', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'index'])->name('admin.delivery-partners.index');
        Route::get('/delivery-partners', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'index'])->name('delivery-partners.index');
        Route::get('/admin/delivery-partners/{driver}', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'show'])->whereNumber('driver')->name('admin.delivery-partners.show');
        Route::get('/delivery-partners/{driver}', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'show'])->whereNumber('driver')->name('delivery-partners.show');
    });

    Route::middleware('permission:user.create')->group(function () {
        Route::get('/admin/delivery-partners/create', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'create'])->name('admin.delivery-partners.create');
        Route::get('/delivery-partners/create', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'create'])->name('delivery-partners.create');
        Route::post('/admin/delivery-partners', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'store'])->name('admin.delivery-partners.store');
        Route::post('/delivery-partners', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'store'])->name('delivery-partners.store');
    });

    Route::middleware('permission:user.update')->group(function () {
        Route::get('/admin/delivery-partners/{driver}/edit', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'edit'])->whereNumber('driver')->name('admin.delivery-partners.edit');
        Route::get('/delivery-partners/{driver}/edit', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'edit'])->whereNumber('driver')->name('delivery-partners.edit');
        Route::put('/admin/delivery-partners/{driver}', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'update'])->whereNumber('driver')->name('admin.delivery-partners.update');
        Route::put('/delivery-partners/{driver}', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'update'])->whereNumber('driver')->name('delivery-partners.update');
        Route::patch('/admin/delivery-partners/{driver}/status', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'updateStatus'])->whereNumber('driver')->name('admin.delivery-partners.status');
        Route::patch('/delivery-partners/{driver}/status', [\App\Http\Controllers\Admin\DeliveryPartnerManagementController::class, 'updateStatus'])->whereNumber('driver')->name('delivery-partners.status');
    });

    // Product Management
    Route::middleware('permission:product.view')->group(function () {
        Route::get('/products', [\App\Http\Controllers\Product\ProductController::class, 'index'])->name('products.index');
        Route::get('/products/{product}', [\App\Http\Controllers\Product\ProductController::class, 'show'])->whereNumber('product')->name('products.show');

        // Category Viewing
        Route::get('/categories', [\App\Http\Controllers\Category\CategoryController::class, 'index'])->name('categories.index');
        Route::get('/categories/{category}', [\App\Http\Controllers\Category\CategoryController::class, 'show'])->whereNumber('category')->name('categories.show');
    });

    Route::middleware('permission:product.create')->group(function () {
        Route::get('/products/create', [\App\Http\Controllers\Product\ProductController::class, 'create'])->name('products.create');
        Route::post('/products', [\App\Http\Controllers\Product\ProductController::class, 'store'])->name('products.store');

        // Category Creation
        Route::get('/categories/create', [\App\Http\Controllers\Category\CategoryController::class, 'create'])->name('categories.create');
        Route::post('/categories', [\App\Http\Controllers\Category\CategoryController::class, 'store'])->name('categories.store');
    });

    Route::middleware('permission:product.update')->group(function () {
        Route::get('/products/{product}/edit', [\App\Http\Controllers\Product\ProductController::class, 'edit'])->name('products.edit');
        Route::put('/products/{product}', [\App\Http\Controllers\Product\ProductController::class, 'update'])->name('products.update');
        Route::patch('/products/{product}/status', [\App\Http\Controllers\Product\ProductController::class, 'updateStatus'])->name('products.status');

        // Product Image Management
        Route::post('/products/{product}/images', [\App\Http\Controllers\Product\ProductImageController::class, 'store'])->name('products.images.store');
        Route::patch('/products/{product}/images/{image}/primary', [\App\Http\Controllers\Product\ProductImageController::class, 'setPrimary'])->name('products.images.primary');
        Route::delete('/products/{product}/images/{image}', [\App\Http\Controllers\Product\ProductImageController::class, 'destroy'])->name('products.images.destroy');

        // Category Management & Lifecycle
        Route::get('/categories/{category}/edit', [\App\Http\Controllers\Category\CategoryController::class, 'edit'])->whereNumber('category')->name('categories.edit');
        Route::put('/categories/{category}', [\App\Http\Controllers\Category\CategoryController::class, 'update'])->whereNumber('category')->name('categories.update');
        Route::match(['put', 'patch'], '/categories/{category}/status', [\App\Http\Controllers\Category\CategoryController::class, 'updateStatus'])->whereNumber('category')->name('categories.status');
        Route::delete('/categories/{category}', [\App\Http\Controllers\Category\CategoryController::class, 'destroy'])->whereNumber('category')->name('categories.destroy');
    });

    // Tax Profile Management
    Route::middleware('permission:product.tax.update')->group(function () {
        Route::get('/tax-profiles', [\App\Http\Controllers\Tax\TaxProfileController::class, 'index'])->name('tax-profiles.index');
        Route::get('/tax-profiles/create', [\App\Http\Controllers\Tax\TaxProfileController::class, 'create'])->name('tax-profiles.create');
        Route::post('/tax-profiles', [\App\Http\Controllers\Tax\TaxProfileController::class, 'store'])->name('tax-profiles.store');
        Route::get('/tax-profiles/{tax_profile}/edit', [\App\Http\Controllers\Tax\TaxProfileController::class, 'edit'])->whereNumber('tax_profile')->name('tax-profiles.edit');
        Route::put('/tax-profiles/{tax_profile}', [\App\Http\Controllers\Tax\TaxProfileController::class, 'update'])->whereNumber('tax_profile')->name('tax-profiles.update');
        Route::delete('/tax-profiles/{tax_profile}', [\App\Http\Controllers\Tax\TaxProfileController::class, 'destroy'])->whereNumber('tax_profile')->name('tax-profiles.destroy');
    });

    // Salesman Ordering & Drafts
    Route::middleware('permission:order.create')->group(function () {
        Route::get('/salesman/orders/create', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'create'])->name('salesman.orders.create');
        Route::get('/salesman/orders/drafts', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'drafts'])->name('salesman.orders.drafts');
        Route::get('/salesman/orders/drafts/{order}/edit', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'editDraft'])->whereNumber('order')->name('salesman.orders.drafts.edit');

        // Order & Draft Mutations (Throttled per SEC-002)
        Route::middleware('throttle:orders')->group(function () {
            Route::post('/salesman/orders', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'store'])->name('salesman.orders.store');
            Route::post('/salesman/orders/drafts', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'saveDraft'])->name('salesman.orders.drafts.store');
            Route::put('/salesman/orders/drafts/{order}', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'saveDraft'])->whereNumber('order')->name('salesman.orders.drafts.update');
            Route::post('/salesman/orders/drafts/{order}/submit', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'submitDraft'])->whereNumber('order')->name('salesman.orders.drafts.submit');
            Route::delete('/salesman/orders/drafts/{order}', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'discardDraft'])->whereNumber('order')->name('salesman.orders.drafts.destroy');
        });
    });

    Route::middleware('permission:order.view')->group(function () {
        // Salesman Orders
        Route::get('/salesman/orders', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'index'])->name('salesman.orders.index');
        Route::get('/salesman/orders/{order}', [\App\Http\Controllers\Salesman\SalesmanOrderController::class, 'show'])->whereNumber('order')->name('salesman.orders.show');

        // Admin Operational Order Queues & Review Workspace
        Route::get('/admin/orders', [\App\Http\Controllers\Admin\AdminOrderController::class, 'index'])->name('admin.orders.index');
        Route::get('/admin/orders/{order}', [\App\Http\Controllers\Admin\AdminOrderController::class, 'show'])->whereNumber('order')->name('admin.orders.show');
        Route::get('/admin/orders/{order}/review', [\App\Http\Controllers\Admin\AdminOrderController::class, 'review'])->whereNumber('order')->name('admin.orders.review');
    });

    // Authoritative Admin Order Approval Workflow
    Route::middleware(['permission:order.approve', 'throttle:orders'])->group(function () {
        Route::post('/admin/orders/{order}/approve', [\App\Http\Controllers\Admin\AdminOrderController::class, 'approve'])
            ->whereNumber('order')
            ->name('admin.orders.approve');
    });

    // Authoritative Admin Order Rejection Workflow
    Route::middleware(['permission:order.reject', 'throttle:orders'])->group(function () {
        Route::post('/admin/orders/{order}/reject', [\App\Http\Controllers\Admin\AdminOrderController::class, 'reject'])
            ->whereNumber('order')
            ->name('admin.orders.reject');
    });

    // Authoritative Order Adjustment Request & Withdrawal Workflows (FEAT-ADJ-001)
    Route::middleware(['permission:order.adjust.request', 'throttle:orders'])->group(function () {
        Route::post('/orders/{order}/adjustments', [\App\Http\Controllers\Order\OrderAdjustmentRequestController::class, 'store'])
            ->whereNumber('order')
            ->name('orders.adjustments.store');

        Route::post('/orders/{order}/adjustments/{adjustment}/withdraw', [\App\Http\Controllers\Order\OrderAdjustmentRequestController::class, 'withdraw'])
            ->whereNumber('order')
            ->whereNumber('adjustment')
            ->name('orders.adjustments.withdraw');
    });

    // Administrative Adjustment Review Workspace & Queue (FEAT-ADJ-002)
    Route::middleware('permission:order.adjust.review')->group(function () {
        Route::get('/admin/adjustments', [\App\Http\Controllers\Admin\AdminOrderAdjustmentController::class, 'index'])
            ->name('admin.adjustments.index');

        Route::get('/admin/orders/{order}/adjustments/{adjustment}/review', [\App\Http\Controllers\Admin\AdminOrderAdjustmentController::class, 'review'])
            ->whereNumber('order')
            ->whereNumber('adjustment')
            ->name('admin.orders.adjustments.review');
    });

    // Administrative Adjustment Approval & Rejection Engine (FEAT-ADJ-003)
    Route::middleware(['permission:order.adjust.approve', 'throttle:orders'])->group(function () {
        Route::post('/admin/orders/{order}/adjustments/{adjustment}/approve', [\App\Http\Controllers\Admin\AdminOrderAdjustmentController::class, 'approve'])
            ->whereNumber('order')
            ->whereNumber('adjustment')
            ->name('admin.orders.adjustments.approve');

        Route::post('/admin/orders/{order}/adjustments/{adjustment}/reject', [\App\Http\Controllers\Admin\AdminOrderAdjustmentController::class, 'reject'])
            ->whereNumber('order')
            ->whereNumber('adjustment')
            ->name('admin.orders.adjustments.reject');
    });

    // Authoritative Order Adjustment Application Engine (FEAT-ADJ-004)
    Route::middleware(['permission:order.adjust.apply', 'throttle:orders'])->group(function () {
        Route::post('/admin/orders/{order}/adjustments/{adjustment}/apply', [\App\Http\Controllers\Admin\AdminOrderAdjustmentController::class, 'apply'])
            ->whereNumber('order')
            ->whereNumber('adjustment')
            ->name('admin.orders.adjustments.apply');
    });

    // Authoritative Order Adjustment Reversal Engine (FEAT-ADJ-005)
    Route::middleware(['permission:order.adjust.reverse', 'throttle:orders'])->group(function () {
        Route::post('/admin/orders/{order}/adjustments/{adjustment}/reverse', [\App\Http\Controllers\Admin\AdminOrderAdjustmentController::class, 'reverse'])
            ->whereNumber('order')
            ->whereNumber('adjustment')
            ->name('admin.orders.adjustments.reverse');
    });

    // Physical Inventory Foundation & Operational Workspace (FEAT-INV-001 / FEAT-INV-002)
    Route::middleware('permission:inventory.view')->group(function () {
        Route::get('/admin/inventory', [\App\Http\Controllers\Admin\AdminInventoryController::class, 'index'])
            ->name('admin.inventory.index');
        Route::get('/admin/inventory/{inventoryBalance}', [\App\Http\Controllers\Admin\AdminInventoryController::class, 'show'])
            ->whereNumber('inventoryBalance')
            ->name('admin.inventory.show');
        Route::get('/admin/inventory-exceptions', [\App\Http\Controllers\Admin\AdminStockExceptionController::class, 'index'])
            ->name('admin.inventory.exceptions.index');

        // Warehouse Operational Fulfillment & Dispatch Workspace (FEAT-FUL-001)
        Route::get('/admin/warehouse/fulfillment', [\App\Http\Controllers\Warehouse\WarehouseFulfillmentController::class, 'index'])
            ->name('admin.warehouse.fulfillment.index');
        Route::get('/warehouse/fulfillment', [\App\Http\Controllers\Warehouse\WarehouseFulfillmentController::class, 'index'])
            ->name('warehouse.fulfillment.index');
        Route::get('/admin/warehouse/fulfillment/{order}', [\App\Http\Controllers\Warehouse\WarehouseFulfillmentController::class, 'show'])
            ->whereNumber('order')
            ->name('admin.warehouse.fulfillment.show');
        Route::get('/warehouse/fulfillment/{order}', [\App\Http\Controllers\Warehouse\WarehouseFulfillmentController::class, 'show'])
            ->whereNumber('order')
            ->name('warehouse.fulfillment.show');
        Route::post('/admin/warehouse/fulfillment/{order}/pick', [\App\Http\Controllers\Warehouse\WarehouseFulfillmentController::class, 'pick'])
            ->whereNumber('order')
            ->name('admin.warehouse.fulfillment.pick');
        Route::post('/admin/warehouse/fulfillment/{order}/pack', [\App\Http\Controllers\Warehouse\WarehouseFulfillmentController::class, 'pack'])
            ->whereNumber('order')
            ->name('admin.warehouse.fulfillment.pack');
        Route::post('/admin/warehouse/fulfillment/{order}/dispatch', [\App\Http\Controllers\Warehouse\WarehouseFulfillmentController::class, 'dispatch'])
            ->whereNumber('order')
            ->name('admin.warehouse.fulfillment.dispatch');
    });

    // Warehouse Stock Exception Reporting & Damage Quarantine (FEAT-INV-005)
    Route::middleware(['permission:inventory.exception.report,inventory.adjust', 'throttle:inventory'])->group(function () {
        Route::post('/admin/inventory-exceptions', [\App\Http\Controllers\Admin\AdminStockExceptionController::class, 'store'])
            ->name('admin.inventory.exceptions.store');
    });

    // Direct Physical Inventory Adjustments & Exception Resolution (FEAT-INV-005 / FEAT-INV-006)
    Route::middleware(['permission:inventory.adjust', 'throttle:inventory'])->group(function () {
        Route::post('/admin/inventory-adjustments', [\App\Http\Controllers\Admin\AdminInventoryAdjustmentController::class, 'store'])
            ->name('admin.inventory.adjustments.store');

        Route::post('/admin/inventory-exceptions/{stockException}/resolve', [\App\Http\Controllers\Admin\AdminStockExceptionController::class, 'resolve'])
            ->whereNumber('stockException')
            ->name('admin.inventory.exceptions.resolve');

        Route::post('/admin/inventory-exceptions/{stockException}/dismiss', [\App\Http\Controllers\Admin\AdminStockExceptionController::class, 'dismiss'])
            ->whereNumber('stockException')
            ->name('admin.inventory.exceptions.dismiss');
    });

    // Payment Verification Workspace (FEAT-PAY-007)
    Route::middleware('permission:payment.verify')->group(function () {
        Route::get('/admin/payments', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'index'])
            ->name('admin.payments.index');
    });

    // Payments & Payment Evidence Preview (FEAT-PAY-005 / FEAT-PAY-006)
    Route::middleware('permission:payment.view')->group(function () {
        Route::get('/admin/payments/{payment}/evidence-url', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'evidenceUrl'])
            ->whereNumber('payment')
            ->name('admin.payments.evidence.url');

        Route::get('/admin/payments/{payment}/evidence-stream', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'streamEvidence'])
            ->whereNumber('payment')
            ->name('admin.payments.evidence.stream');
    });

    // Payment Entry Routes (FEAT-PAY-002, FEAT-PAY-003, FEAT-PAY-004)
    Route::middleware(['permission:payment.create', 'throttle:payments'])->group(function () {
        // Cash Payment Entry (FEAT-PAY-002)
        Route::post('/admin/payments/cash', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'storeCash'])
            ->name('admin.payments.cash.store');
        Route::post('/salesman/payments/cash', [\App\Http\Controllers\Salesman\SalesmanPaymentController::class, 'storeCash'])
            ->name('salesman.payments.cash.store');

        // Cheque Payment Entry (FEAT-PAY-003)
        Route::post('/admin/payments/cheque', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'storeCheque'])
            ->name('admin.payments.cheque.store');
        Route::post('/salesman/payments/cheque', [\App\Http\Controllers\Salesman\SalesmanPaymentController::class, 'storeCheque'])
            ->name('salesman.payments.cheque.store');

        // Money Order Payment Entry (FEAT-PAY-004)
        Route::post('/admin/payments/money-order', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'storeMoneyOrder'])
            ->name('admin.payments.money-order.store');
        Route::post('/salesman/payments/money-order', [\App\Http\Controllers\Salesman\SalesmanPaymentController::class, 'storeMoneyOrder'])
            ->name('salesman.payments.money-order.store');

        // Payment Correction / Resubmission (FEAT-PAY-008)
        Route::post('/admin/payments/{payment}/correct', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'correct'])
            ->whereNumber('payment')
            ->name('admin.payments.correct');
        Route::post('/salesman/payments/{payment}/correct', [\App\Http\Controllers\Salesman\SalesmanPaymentController::class, 'correct'])
            ->whereNumber('payment')
            ->name('salesman.payments.correct');
    });

    // Payment Verification & Rejection Engine (FEAT-PAY-007 / FEAT-PAY-008)
    Route::middleware(['permission:payment.verify', 'throttle:payment-verification'])->group(function () {
        Route::post('/admin/payments/{payment}/verify', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'verify'])
            ->whereNumber('payment')
            ->name('admin.payments.verify');

        Route::post('/admin/payments/{payment}/reject', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'reject'])
            ->whereNumber('payment')
            ->name('admin.payments.reject');
    });

    // Payment Reversal & Bounced Cheque Engine (FEAT-PAY-009)
    Route::middleware(['permission:payment.reverse', 'throttle:payments'])->group(function () {
        Route::post('/admin/payments/{payment}/reverse', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'reverse'])
            ->whereNumber('payment')
            ->name('admin.payments.reverse');
    });

    // Delivery & Logistics Operations (FEAT-DEL-001 through FEAT-DEL-008)
    Route::middleware('permission:delivery.view')->group(function () {
        Route::get('/admin/deliveries', [\App\Http\Controllers\Admin\AdminDeliveryController::class, 'index'])
            ->name('admin.deliveries.index');
        Route::get('/delivery', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'index'])
            ->name('delivery.index');
        Route::get('/delivery/today', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'index'])
            ->name('delivery.today');
        Route::get('/delivery/{delivery}', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'show'])
            ->whereNumber('delivery')
            ->name('delivery.show');
        Route::get('/delivery/{delivery}/history', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'history'])
            ->whereNumber('delivery')
            ->name('delivery.history');
    });

    Route::middleware('permission:delivery.assign')->group(function () {
        Route::post('/admin/deliveries/assign', [\App\Http\Controllers\Admin\AdminDeliveryController::class, 'assign'])
            ->name('admin.deliveries.assign');
        Route::post('/admin/orders/{order}/delivery/assign', [\App\Http\Controllers\Admin\AdminDeliveryController::class, 'assign'])
            ->whereNumber('order')
            ->name('admin.orders.delivery.assign');
    });

    Route::middleware(['permission:delivery.update', 'throttle:deliveries'])->group(function () {
        Route::post('/delivery/{delivery}/pickup', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'pickup'])
            ->whereNumber('delivery')
            ->name('delivery.pickup');
        Route::post('/delivery/{delivery}/start-route', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'startRoute'])
            ->whereNumber('delivery')
            ->name('delivery.start-route');
        Route::post('/delivery/{delivery}/complete', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'complete'])
            ->whereNumber('delivery')
            ->name('delivery.complete');
        Route::post('/delivery/{delivery}/fail', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'fail'])
            ->whereNumber('delivery')
            ->name('delivery.fail');
        Route::post('/delivery/{delivery}/reschedule', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'reschedule'])
            ->whereNumber('delivery')
            ->name('delivery.reschedule');
        Route::post('/delivery/{delivery}/return-to-warehouse', [\App\Http\Controllers\Delivery\DeliveryPartnerController::class, 'returnToWarehouse'])
            ->whereNumber('delivery')
            ->name('delivery.return-warehouse');
    });

    // Invoices & Documents (FEAT-DOC-001 through FEAT-DOC-004)
    Route::middleware('permission:invoice.view')->group(function () {
        Route::get('/admin/invoices', [\App\Http\Controllers\Admin\AdminInvoiceController::class, 'index'])
            ->name('admin.invoices.index');
        Route::get('/admin/invoices/{invoice}', [\App\Http\Controllers\Admin\AdminInvoiceController::class, 'show'])
            ->whereNumber('invoice')
            ->name('admin.invoices.show');

        // Salesman scoped invoices
        Route::get('/salesman/invoices', [\App\Http\Controllers\Salesman\SalesmanInvoiceController::class, 'index'])
            ->name('salesman.invoices.index');
        Route::get('/salesman/invoices/{invoice}', [\App\Http\Controllers\Salesman\SalesmanInvoiceController::class, 'show'])
            ->whereNumber('invoice')
            ->name('salesman.invoices.show');
    });

    Route::middleware(['permission:order.approve', 'throttle:invoice-pdf'])->group(function () {
        Route::post('/admin/orders/{order}/invoice', [\App\Http\Controllers\Admin\AdminInvoiceController::class, 'generate'])
            ->whereNumber('order')
            ->name('admin.orders.invoice.generate');
    });

    Route::middleware('permission:invoice.print')->group(function () {
        Route::get('/invoices/{invoice}/print', [\App\Http\Controllers\Invoices\InvoicePrintController::class, 'show'])
            ->whereNumber('invoice')
            ->name('invoices.print');
    });

    Route::middleware(['permission:invoice.download', 'throttle:invoice-pdf'])->group(function () {
        Route::get('/invoices/{invoice}/pdf', [\App\Http\Controllers\Invoices\InvoicePdfController::class, 'download'])
            ->whereNumber('invoice')
            ->name('invoices.pdf');
    });

    // Returns & Warehouse Return Operations (FEAT-RET-001 through FEAT-RET-004)
    Route::middleware('permission:return.review')->group(function () {
        Route::get('/admin/returns', [\App\Http\Controllers\Admin\AdminReturnController::class, 'index'])
            ->name('admin.returns.index');
        Route::get('/admin/returns/{returnRequest}', [\App\Http\Controllers\Admin\AdminReturnController::class, 'show'])
            ->whereNumber('returnRequest')
            ->name('admin.returns.show');
        Route::get('/admin/orders/{order}/returnable-items', [\App\Http\Controllers\Admin\AdminReturnController::class, 'getReturnableItems'])
            ->whereNumber('order')
            ->name('admin.orders.returnable-items');
        Route::post('/admin/returns/{returnRequest}/inspect', [\App\Http\Controllers\Admin\AdminReturnInspectionController::class, 'store'])
            ->whereNumber('returnRequest')
            ->name('admin.returns.inspect');
    });

    Route::middleware('permission:return.request')->group(function () {
        Route::get('/admin/returns/create', [\App\Http\Controllers\Admin\AdminReturnController::class, 'create'])
            ->name('admin.returns.create');
        Route::post('/admin/returns', [\App\Http\Controllers\Admin\AdminReturnController::class, 'store'])
            ->name('admin.returns.store');
        Route::post('/admin/returns/{returnRequest}/cancel', [\App\Http\Controllers\Admin\AdminReturnWorkflowController::class, 'cancel'])
            ->whereNumber('returnRequest')
            ->name('admin.returns.cancel');

        // Salesman scoped return routes
        Route::get('/salesman/returns', [\App\Http\Controllers\Salesman\SalesmanReturnController::class, 'index'])
            ->name('salesman.returns.index');
        Route::get('/salesman/returns/create', [\App\Http\Controllers\Salesman\SalesmanReturnController::class, 'create'])
            ->name('salesman.returns.create');
        Route::post('/salesman/returns', [\App\Http\Controllers\Salesman\SalesmanReturnController::class, 'store'])
            ->name('salesman.returns.store');
        Route::get('/salesman/returns/{returnRequest}', [\App\Http\Controllers\Salesman\SalesmanReturnController::class, 'show'])
            ->whereNumber('returnRequest')
            ->name('salesman.returns.show');
    });

    Route::middleware('permission:return.approve')->group(function () {
        Route::post('/admin/returns/{returnRequest}/approve', [\App\Http\Controllers\Admin\AdminReturnWorkflowController::class, 'approve'])
            ->whereNumber('returnRequest')
            ->name('admin.returns.approve');
        Route::post('/admin/returns/{returnRequest}/reject', [\App\Http\Controllers\Admin\AdminReturnWorkflowController::class, 'reject'])
            ->whereNumber('returnRequest')
            ->name('admin.returns.reject');
    });

    // Credit Note Routes (SEC-001 Defense-in-Depth)
    Route::middleware('permission:credit.view')->group(function () {
        Route::get('/admin/credits', [\App\Http\Controllers\Admin\AdminCreditNoteController::class, 'index'])
            ->name('admin.credits.index');
        Route::get('/admin/credits/{id}', [\App\Http\Controllers\Admin\AdminCreditNoteController::class, 'show'])
            ->whereNumber('id')
            ->name('admin.credits.show');
        Route::get('/admin/returns/{returnRequest}/credit-eligibility', [\App\Http\Controllers\Admin\AdminCreditNoteController::class, 'calculateEligibility'])
            ->whereNumber('returnRequest')
            ->name('admin.returns.credit-eligibility');
    });

    Route::middleware('permission:credit.create')->group(function () {
        Route::post('/admin/credits', [\App\Http\Controllers\Admin\AdminCreditNoteController::class, 'store'])
            ->name('admin.credits.store');
    });

    // Refund Routes (SEC-001 Defense-in-Depth)
    Route::middleware('permission:refund.view')->group(function () {
        Route::get('/admin/refunds', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'index'])
            ->name('admin.refunds.index');
        Route::get('/admin/refunds/{id}', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'show'])
            ->whereNumber('id')
            ->name('admin.refunds.show');
    });

    Route::middleware('permission:refund.request')->group(function () {
        Route::post('/admin/refunds', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'store'])
            ->name('admin.refunds.store');
        Route::post('/admin/refunds/{id}/cancel', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'cancel'])
            ->whereNumber('id')
            ->name('admin.refunds.cancel');
    });

    Route::middleware('permission:refund.approve')->group(function () {
        Route::post('/admin/refunds/{id}/review', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'review'])
            ->whereNumber('id')
            ->name('admin.refunds.review');
        Route::post('/admin/refunds/{id}/approve', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'approve'])
            ->whereNumber('id')
            ->name('admin.refunds.approve');
        Route::post('/admin/refunds/{id}/reject', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'reject'])
            ->whereNumber('id')
            ->name('admin.refunds.reject');
        Route::post('/admin/refunds/{id}/process', [\App\Http\Controllers\Admin\AdminRefundRequestController::class, 'process'])
            ->whereNumber('id')
            ->name('admin.refunds.process');
    });

    // Accounts Receivable Ledger, Aging, and Statements (FEAT-AR-001 through FEAT-AR-003)
    Route::middleware('permission:receivable.view')->group(function () {
        Route::get('/admin/receivables', [\App\Http\Controllers\Admin\AdminReceivableController::class, 'index'])
            ->name('admin.receivables.index');
        Route::get('/admin/receivables/{id}', [\App\Http\Controllers\Admin\AdminReceivableController::class, 'show'])
            ->whereNumber('id')
            ->name('admin.receivables.show');
        Route::get('/admin/receivables/{id}/statement', [\App\Http\Controllers\Admin\AdminReceivableController::class, 'statement'])
            ->whereNumber('id')
            ->name('admin.receivables.statement');
    });

    // Accounts Payable Sub-Ledger, Bills, and Payments (FEAT-AP-001)
    Route::middleware('permission:payable.view')->group(function () {
        Route::get('/admin/payables', [\App\Http\Controllers\Admin\AdminPayableController::class, 'index'])
            ->name('admin.payables.index');
        Route::get('/admin/payables/{id}', [\App\Http\Controllers\Admin\AdminPayableController::class, 'show'])
            ->whereNumber('id')
            ->name('admin.payables.show');
    });

    Route::middleware('permission:payable.manage')->group(function () {
        Route::post('/admin/payables/suppliers', [\App\Http\Controllers\Admin\AdminPayableController::class, 'storeSupplier'])
            ->name('admin.payables.suppliers.store');
        Route::post('/admin/payables/bills', [\App\Http\Controllers\Admin\AdminPayableController::class, 'storeBill'])
            ->name('admin.payables.bills.store');
        Route::post('/admin/payables/bills/{id}/post', [\App\Http\Controllers\Admin\AdminPayableController::class, 'postBill'])
            ->whereNumber('id')
            ->name('admin.payables.bills.post');
        Route::post('/admin/payables/payments', [\App\Http\Controllers\Admin\AdminPayableController::class, 'storePayment'])
            ->name('admin.payables.payments.store');
        Route::post('/admin/payables/payments/{id}/reverse', [\App\Http\Controllers\Admin\AdminPayableController::class, 'reversePayment'])
            ->whereNumber('id')
            ->name('admin.payables.payments.reverse');
    });

    // General Ledger Accounting (FEAT-ACC-001 through FEAT-ACC-009)
    Route::middleware('permission:accounting.view')->group(function () {
        Route::get('/admin/accounting', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'index'])
            ->name('admin.accounting.index');
        Route::get('/admin/accounting/accounts', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'accounts'])
            ->name('admin.accounting.accounts');
        Route::get('/admin/accounting/journals', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'journals'])
            ->name('admin.accounting.journals');
        Route::get('/admin/accounting/journals/{id}', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'showJournal'])
            ->whereNumber('id')
            ->name('admin.accounting.journals.show');
        Route::get('/admin/accounting/general-ledger', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'generalLedger'])
            ->name('admin.accounting.general-ledger');
        Route::get('/admin/accounting/trial-balance', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'trialBalance'])
            ->name('admin.accounting.trial-balance');
        Route::get('/admin/accounting/profit-loss', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'profitLoss'])
            ->name('admin.accounting.profit-loss');
        Route::get('/admin/accounting/balance-sheet', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'balanceSheet'])
            ->name('admin.accounting.balance-sheet');
        Route::get('/admin/accounting/reconciliation', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'reconciliation'])
            ->name('admin.accounting.reconciliation');
    });

    Route::middleware('permission:accounting.post')->group(function () {
        Route::post('/admin/accounting/accounts', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'storeAccount'])
            ->name('admin.accounting.accounts.store');
        Route::put('/admin/accounting/accounts/{account}', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'updateAccount'])
            ->whereNumber('account')
            ->name('admin.accounting.accounts.update');
        Route::delete('/admin/accounting/accounts/{account}', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'deleteAccount'])
            ->whereNumber('account')
            ->name('admin.accounting.accounts.destroy');
        Route::post('/admin/accounting/journals', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'storeManualJournal'])
            ->name('admin.accounting.journals.store');
        Route::post('/admin/accounting/reconciliation', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'storeReconciliation'])
            ->name('admin.accounting.reconciliation.store');
        Route::post('/admin/accounting/reconciliation/{reconciliation}/finalize', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'finalizeReconciliation'])
            ->whereNumber('reconciliation')
            ->name('admin.accounting.reconciliation.finalize');
        Route::post('/admin/accounting/reconciliation/{reconciliation}/adjustment', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'storeAdjustment'])
            ->whereNumber('reconciliation')
            ->name('admin.accounting.reconciliation.adjustment');
        Route::post('/admin/accounting/sync-events', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'syncEvents'])
            ->name('admin.accounting.sync-events');
    });

    Route::middleware('permission:accounting.reverse')->group(function () {
        Route::post('/admin/accounting/journals/{journal}/reverse', [\App\Http\Controllers\Admin\AdminAccountingController::class, 'reverseJournal'])
            ->whereNumber('journal')
            ->name('admin.accounting.journals.reverse');
    });

    // Reporting & Analytics (FEAT-REP-001 through FEAT-REP-006)
    Route::middleware('throttle:reports')->group(function () {
        Route::get('/admin/reports', [\App\Http\Controllers\Admin\AdminReportingController::class, 'index'])
            ->name('admin.reports.index');

        Route::middleware('permission:order.view')->group(function () {
            Route::get('/admin/reports/sales', [\App\Http\Controllers\Admin\AdminReportingController::class, 'sales'])
                ->name('admin.reports.sales');
        });

        Route::middleware('permission:customer.view')->group(function () {
            Route::get('/admin/reports/customers', [\App\Http\Controllers\Admin\AdminReportingController::class, 'customers'])
                ->name('admin.reports.customers');
        });

        Route::get('/admin/reports/salesmen', [\App\Http\Controllers\Admin\AdminReportingController::class, 'salesmen'])
            ->name('admin.reports.salesmen');

        Route::middleware('permission:inventory.view')->group(function () {
            Route::get('/admin/reports/inventory', [\App\Http\Controllers\Admin\AdminReportingController::class, 'inventory'])
                ->name('admin.reports.inventory');
        });

        Route::middleware('permission:delivery.view')->group(function () {
            Route::get('/admin/reports/delivery', [\App\Http\Controllers\Admin\AdminReportingController::class, 'delivery'])
                ->name('admin.reports.delivery');
        });

        Route::middleware('permission:accounting.view')->group(function () {
            Route::get('/admin/reports/financial', [\App\Http\Controllers\Admin\AdminReportingController::class, 'financial'])
                ->name('admin.reports.financial');
        });
    });

    // In-App Operational Notifications (User-scoped)
    Route::get('/notifications', [\App\Http\Controllers\Notification\NotificationController::class, 'index'])
        ->name('notifications.index');
    Route::get('/notifications/feed', [\App\Http\Controllers\Notification\NotificationController::class, 'feed'])
        ->name('notifications.feed');
    Route::get('/notifications/unread-count', [\App\Http\Controllers\Notification\NotificationController::class, 'unreadCount'])
        ->name('notifications.unread-count');
    Route::post('/notifications/{id}/read', [\App\Http\Controllers\Notification\NotificationController::class, 'markAsRead'])
        ->whereNumber('id')
        ->name('notifications.read');
    Route::post('/notifications/read-all', [\App\Http\Controllers\Notification\NotificationController::class, 'markAllAsRead'])
        ->name('notifications.read-all');
    Route::delete('/notifications/{id}', [\App\Http\Controllers\Notification\NotificationController::class, 'destroy'])
        ->whereNumber('id')
        ->name('notifications.destroy');
    Route::get('/notifications/preferences', [\App\Http\Controllers\Notification\NotificationController::class, 'preferences'])
        ->name('notifications.preferences');
    Route::put('/notifications/preferences', [\App\Http\Controllers\Notification\NotificationController::class, 'updatePreferences'])
        ->name('notifications.preferences.update');

    // Business Audit Logs & User Activity Timeline
    Route::middleware('permission:audit.view')->group(function () {
        Route::get('/admin/audit/timeline', [\App\Http\Controllers\Admin\AdminAuditController::class, 'timeline'])
            ->name('admin.audit.timeline');
        Route::get('/admin/audit/entities/{entityType}/{entityId}', [\App\Http\Controllers\Admin\AdminAuditController::class, 'entityHistory'])
            ->name('admin.audit.entity-history');
    });

    // Security Logs
    Route::middleware('permission:audit.security.view')->group(function () {
        Route::get('/admin/audit/security', [\App\Http\Controllers\Admin\AdminAuditController::class, 'security'])
            ->name('admin.audit.security');
    });
});





