<?php

namespace App\Providers;

use App\Enums\Permission;
use App\Models\Category;
use App\Models\CreditNote;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\InventoryBalance;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderAdjustment;
use App\Models\PayableTransaction;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReceivableTransaction;
use App\Models\RefundRequest;
use App\Models\RefundTransaction;
use App\Models\ReturnRequest;
use App\Models\StockException;
use App\Models\Supplier;
use App\Models\SupplierBill;
use App\Models\SupplierPayment;
use App\Models\User;
use App\Policies\CategoryPolicy;
use App\Policies\CreditNotePolicy;
use App\Policies\CustomerPolicy;
use App\Policies\DeliveryPolicy;
use App\Policies\InventoryBalancePolicy;
use App\Policies\InvoicePolicy;
use App\Policies\OrderAdjustmentPolicy;
use App\Policies\OrderPolicy;
use App\Policies\PayableTransactionPolicy;
use App\Policies\PaymentPolicy;
use App\Policies\ProductPolicy;
use App\Policies\ReceivableTransactionPolicy;
use App\Policies\RefundRequestPolicy;
use App\Policies\RefundTransactionPolicy;
use App\Policies\ReturnRequestPolicy;
use App\Policies\StockExceptionPolicy;
use App\Policies\SupplierBillPolicy;
use App\Policies\SupplierPaymentPolicy;
use App\Policies\SupplierPolicy;
use App\Policies\UserPolicy;
use App\Services\Auth\PermissionService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Register Model -> Policy mappings
        Gate::policy(Customer::class, CustomerPolicy::class);
        Gate::policy(Order::class, OrderPolicy::class);
        Gate::policy(OrderAdjustment::class, OrderAdjustmentPolicy::class);
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(Delivery::class, DeliveryPolicy::class);
        Gate::policy(ReturnRequest::class, ReturnRequestPolicy::class);
        Gate::policy(Payment::class, PaymentPolicy::class);
        Gate::policy(CreditNote::class, CreditNotePolicy::class);
        Gate::policy(RefundRequest::class, RefundRequestPolicy::class);
        Gate::policy(RefundTransaction::class, RefundTransactionPolicy::class);
        Gate::policy(ReceivableTransaction::class, ReceivableTransactionPolicy::class);
        Gate::policy(InventoryBalance::class, InventoryBalancePolicy::class);
        Gate::policy(StockException::class, StockExceptionPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Product::class, ProductPolicy::class);
        Gate::policy(Category::class, CategoryPolicy::class);
        Gate::policy(Supplier::class, SupplierPolicy::class);
        Gate::policy(SupplierBill::class, SupplierBillPolicy::class);
        Gate::policy(SupplierPayment::class, SupplierPaymentPolicy::class);
        Gate::policy(PayableTransaction::class, PayableTransactionPolicy::class);

        // Register authoritative Gate::before resolver for canonical Permission enum values
        Gate::before(function (User $user, string $ability, array $arguments = []) {
            $permission = Permission::tryFrom($ability);

            if ($permission !== null) {
                $hasPermission = app(PermissionService::class)->has($user, $permission);

                if (! $hasPermission) {
                    return false; // Fail closed if user lacks baseline permission
                }

                // When arguments (models / resources) are provided, return null to delegate
                // to the registered model policy for fine-grained resource scope evaluation.
                if (! empty($arguments)) {
                    return null;
                }

                return true;
            }

            return null;
        });

        RateLimiter::for('login', function (Request $request) {
            $email = $request->input('email');
            $key = $email ? Str::transliterate(Str::lower(trim((string) $email))).'|'.$request->ip() : $request->ip();

            if (app()->environment('local', 'testing')) {
                return Limit::perMinute(100)->by($key);
            }

            return Limit::perMinute(5)->by($key);
        });

        RateLimiter::for('mfa', function (Request $request) {
            $challenge = $request->session()->get('mfa.challenge');
            $userId = is_array($challenge) && ! empty($challenge['user_id'])
                ? (string) $challenge['user_id']
                : 'anon';

            if (app()->environment('local', 'testing')) {
                return Limit::perMinute(100)->by('mfa:'.$userId.'|'.$request->ip());
            }

            return Limit::perMinute(5)->by('mfa:'.$userId.'|'.$request->ip());
        });

        RateLimiter::for('password-reset', function (Request $request) {
            $email = $request->input('email');
            $key = $email ? strtolower(trim((string) $email)).'|'.$request->ip() : $request->ip();

            return Limit::perMinutes(10, 3)->by($key);
        });

        RateLimiter::for('orders', function (Request $request) {
            $userId = optional($request->user())->id;

            return Limit::perMinute(30)->by($userId ? (string) $userId : $request->ip());
        });

        RateLimiter::for('payments', function (Request $request) {
            $userId = optional($request->user())->id;

            return Limit::perMinute(20)->by($userId ? (string) $userId : $request->ip());
        });

        RateLimiter::for('payment-verification', function (Request $request) {
            $userId = optional($request->user())->id;

            return Limit::perMinute(30)->by($userId ? (string) $userId : $request->ip());
        });

        RateLimiter::for('inventory', function (Request $request) {
            $userId = optional($request->user())->id;

            return Limit::perMinute(20)->by($userId ? (string) $userId : $request->ip());
        });

        RateLimiter::for('deliveries', function (Request $request) {
            $userId = optional($request->user())->id;

            return Limit::perMinute(15)->by($userId ? (string) $userId : $request->ip());
        });

        RateLimiter::for('invoice-pdf', function (Request $request) {
            $userId = optional($request->user())->id;

            return Limit::perMinute(15)->by($userId ? (string) $userId : $request->ip());
        });

        RateLimiter::for('reports', function (Request $request) {
            $userId = optional($request->user())->id;

            return Limit::perMinute(30)->by($userId ? (string) $userId : $request->ip());
        });
    }
}
