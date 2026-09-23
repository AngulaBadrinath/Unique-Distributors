<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Auth\PermissionService;
use App\Services\Reporting\CustomerReportService;
use App\Services\Reporting\DeliveryPerformanceReportService;
use App\Services\Reporting\FinancialReportService;
use App\Services\Reporting\InventoryReportService;
use App\Services\Reporting\SalesReportService;
use App\Services\Reporting\SalesmanPerformanceReportService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminReportingController extends Controller
{
    public function __construct(
        protected SalesReportService $salesReportService,
        protected CustomerReportService $customerReportService,
        protected SalesmanPerformanceReportService $salesmanPerformanceReportService,
        protected InventoryReportService $inventoryReportService,
        protected DeliveryPerformanceReportService $deliveryPerformanceReportService,
        protected FinancialReportService $financialReportService,
        protected PermissionService $permissionService
    ) {}

    /**
     * Ensure the requesting user is authorized for administrative organization-level reporting.
     */
    protected function authorizeReportingAccess(?User $user): void
    {
        if (! $user || in_array($user->role, [UserRole::SALESMAN, UserRole::DELIVERY_PARTNER], true)) {
            abort(403, 'You do not have permission to access administrative reports and analytics.');
        }
    }

    /**
     * Reporting Hub / Overview Dashboard.
     */
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeReportingAccess($user);

        // High-level KPI snapshots for reporting hub
        $salesSummary = $this->salesReportService->getSalesSummary([], $user);
        $deliverySummary = $this->deliveryPerformanceReportService->getDeliverySummary([], $user);
        $canViewCostPrice = $this->inventoryReportService->canViewCostPrice($user);

        return Inertia::render('Admin/Reporting/Index', [
            'salesSummary' => $salesSummary,
            'deliverySummary' => $deliverySummary,
            'canViewCostPrice' => $canViewCostPrice,
        ]);
    }

    /**
     * Sales Reports (FEAT-REP-001).
     */
    public function sales(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeReportingAccess($user);
        $filters = $request->only([
            'date_from',
            'date_to',
            'status',
            'payment_status',
            'fulfillment_status',
            'customer_id',
            'salesman_id',
        ]);

        $summary = $this->salesReportService->getSalesSummary($filters, $user);
        $dailyBreakdown = $this->salesReportService->getDailySalesBreakdown($filters, $user);
        $salesByCustomer = $this->salesReportService->getSalesByCustomer($filters, $user, 15);
        $salesByProduct = $this->salesReportService->getSalesByProduct($filters, $user, 15);
        $contributingOrders = $this->salesReportService->getContributingOrders($filters, $user, (int) $request->input('per_page', 15));

        return Inertia::render('Admin/Reporting/Sales', [
            'summary' => $summary,
            'dailyBreakdown' => $dailyBreakdown,
            'salesByCustomer' => $salesByCustomer,
            'salesByProduct' => $salesByProduct,
            'contributingOrders' => $contributingOrders,
            'filters' => $filters,
        ]);
    }

    /**
     * Customer Reports (FEAT-REP-002).
     */
    public function customers(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeReportingAccess($user);
        $filters = $request->only([
            'salesman_id',
            'status',
            'search',
            'balance_state',
            'as_of_date',
            'date_from',
            'date_to',
        ]);

        $report = $this->customerReportService->getCustomerReport($filters, $user, (int) $request->input('per_page', 20));

        return Inertia::render('Admin/Reporting/Customers', [
            'report' => $report,
            'filters' => $filters,
        ]);
    }

    /**
     * Salesman Performance Reports (FEAT-REP-003).
     */
    public function salesmen(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeReportingAccess($user);
        $this->permissionService->authorize($user, Permission::USER_VIEW);

        $filters = $request->only([
            'date_from',
            'date_to',
            'salesman_id',
        ]);

        $report = $this->salesmanPerformanceReportService->getSalesmanPerformanceReport($filters, $user);

        return Inertia::render('Admin/Reporting/Salesmen', [
            'report' => $report,
            'filters' => $filters,
        ]);
    }

    /**
     * Inventory Reports (FEAT-REP-004).
     */
    public function inventory(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeReportingAccess($user);
        $tab = $request->input('tab', 'valuation');
        $filters = $request->only([
            'warehouse_id',
            'category_id',
            'product_id',
            'movement_type',
            'stock_status',
            'search',
            'date_from',
            'date_to',
        ]);

        $valuationReport = null;
        $movementReport = null;
        $lowStockAlerts = null;

        if ($tab === 'movement') {
            $movementReport = $this->inventoryReportService->getInventoryMovementReport($filters, $user, (int) $request->input('per_page', 25));
        } elseif ($tab === 'low_stock') {
            $lowStockAlerts = $this->inventoryReportService->getLowStockAlerts($filters, $user);
        } else {
            $valuationReport = $this->inventoryReportService->getInventoryValuationReport($filters, $user, (int) $request->input('per_page', 25));
        }

        $warehouses = Warehouse::orderBy('name')->get(['id', 'name', 'code']);

        return Inertia::render('Admin/Reporting/Inventory', [
            'activeTab' => $tab,
            'valuationReport' => $valuationReport,
            'movementReport' => $movementReport,
            'lowStockAlerts' => $lowStockAlerts,
            'warehouses' => $warehouses,
            'filters' => $filters,
        ]);
    }

    /**
     * Delivery Performance Reports (FEAT-REP-005).
     */
    public function delivery(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeReportingAccess($user);
        $filters = $request->only([
            'driver_id',
            'status',
            'customer_id',
            'date_from',
            'date_to',
        ]);

        $summary = $this->deliveryPerformanceReportService->getDeliverySummary($filters, $user);
        $driverBreakdown = $this->deliveryPerformanceReportService->getDriverPerformanceBreakdown($filters, $user);
        $failureAnalysis = $this->deliveryPerformanceReportService->getDeliveryFailureAnalysis($filters, $user);
        $deliveriesList = $this->deliveryPerformanceReportService->getDeliveriesList($filters, $user, (int) $request->input('per_page', 20));

        return Inertia::render('Admin/Reporting/Delivery', [
            'summary' => $summary,
            'driverBreakdown' => $driverBreakdown,
            'failureAnalysis' => $failureAnalysis,
            'deliveriesList' => $deliveriesList,
            'filters' => $filters,
        ]);
    }

    /**
     * Financial Accounting Reports (FEAT-REP-006).
     */
    public function financial(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeReportingAccess($user);
        $tab = $request->input('tab', 'summary');
        $filters = $request->only([
            'start_date',
            'end_date',
            'as_of_date',
        ]);

        $summary = null;
        $trialBalance = null;
        $profitLoss = null;
        $balanceSheet = null;

        if ($tab === 'trial_balance') {
            $trialBalance = $this->financialReportService->getTrialBalance($filters, $user);
        } elseif ($tab === 'profit_loss') {
            $profitLoss = $this->financialReportService->getProfitAndLoss($filters, $user);
        } elseif ($tab === 'balance_sheet') {
            $balanceSheet = $this->financialReportService->getBalanceSheet($filters, $user);
        } else {
            $summary = $this->financialReportService->getFinancialSummary($filters, $user);
        }

        return Inertia::render('Admin/Reporting/Financial', [
            'activeTab' => $tab,
            'summary' => $summary,
            'trialBalance' => $trialBalance,
            'profitLoss' => $profitLoss,
            'balanceSheet' => $balanceSheet,
            'filters' => $filters,
        ]);
    }
}
