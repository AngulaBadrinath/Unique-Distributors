<?php

namespace App\Enums;

enum Permission: string
{
    // Customer
    case CUSTOMER_VIEW = 'customer.view';
    case CUSTOMER_CREATE = 'customer.create';
    case CUSTOMER_UPDATE = 'customer.update';

    // Product
    case PRODUCT_VIEW = 'product.view';
    case PRODUCT_CREATE = 'product.create';
    case PRODUCT_UPDATE = 'product.update';
    case PRODUCT_PRICE_UPDATE = 'product.price.update';
    case PRODUCT_TAX_UPDATE = 'product.tax.update';

    // Pricing
    case PRICING_OVERRIDE = 'pricing.override';

    // Order
    case ORDER_VIEW = 'order.view';
    case ORDER_CREATE = 'order.create';
    case ORDER_SUBMIT = 'order.submit';
    case ORDER_APPROVE = 'order.approve';
    case ORDER_REJECT = 'order.reject';
    case ORDER_CANCEL = 'order.cancel';

    // Order Adjustments
    case ORDER_ADJUST_REQUEST = 'order.adjust.request';
    case ORDER_ADJUST_REVIEW = 'order.adjust.review';
    case ORDER_ADJUST_APPROVE = 'order.adjust.approve';
    case ORDER_ADJUST_APPLY = 'order.adjust.apply';
    case ORDER_ADJUST_REVERSE = 'order.adjust.reverse';

    // Payment
    case PAYMENT_VIEW = 'payment.view';
    case PAYMENT_CREATE = 'payment.create';
    case PAYMENT_VERIFY = 'payment.verify';
    case PAYMENT_REVERSE = 'payment.reverse';

    // Inventory
    case INVENTORY_VIEW = 'inventory.view';
    case INVENTORY_ADJUST = 'inventory.adjust';
    case INVENTORY_EXCEPTION_REPORT = 'inventory.exception.report';

    // Delivery
    case DELIVERY_VIEW = 'delivery.view';
    case DELIVERY_ASSIGN = 'delivery.assign';
    case DELIVERY_UPDATE = 'delivery.update';

    // Return
    case RETURN_REQUEST = 'return.request';
    case RETURN_REVIEW = 'return.review';
    case RETURN_APPROVE = 'return.approve';

    // Credit
    case CREDIT_VIEW = 'credit.view';
    case CREDIT_CREATE = 'credit.create';

    // Refund
    case REFUND_VIEW = 'refund.view';
    case REFUND_REQUEST = 'refund.request';
    case REFUND_APPROVE = 'refund.approve';

    // Invoice
    case INVOICE_VIEW = 'invoice.view';
    case INVOICE_PRINT = 'invoice.print';
    case INVOICE_DOWNLOAD = 'invoice.download';

    // Accounts Receivable
    case RECEIVABLE_VIEW = 'receivable.view';

    // Accounts Payable
    case PAYABLE_VIEW = 'payable.view';
    case PAYABLE_MANAGE = 'payable.manage';

    // Accounting
    case ACCOUNTING_VIEW = 'accounting.view';
    case ACCOUNTING_POST = 'accounting.post';
    case ACCOUNTING_REVERSE = 'accounting.reverse';

    // User Administration
    case USER_VIEW = 'user.view';
    case USER_CREATE = 'user.create';
    case USER_UPDATE = 'user.update';
    case USER_SUSPEND = 'user.suspend';
    case USER_DELETE = 'user.delete';

    // Audit & Security Logging
    case AUDIT_VIEW = 'audit.view';
    case AUDIT_SECURITY_VIEW = 'audit.security.view';

    // Role Management
    case ROLE_MANAGE = 'role.manage';

    // Permission Management
    case PERMISSION_MANAGE = 'permission.manage';

    /**
     * Get the human-readable label for this permission.
     */
    public function label(): string
    {
        return match ($this) {
            self::CUSTOMER_VIEW => 'View Customers',
            self::CUSTOMER_CREATE => 'Create Customers',
            self::CUSTOMER_UPDATE => 'Update Customers',

            self::PRODUCT_VIEW => 'View Products',
            self::PRODUCT_CREATE => 'Create Products',
            self::PRODUCT_UPDATE => 'Update Products',
            self::PRODUCT_PRICE_UPDATE => 'Update Product Prices',
            self::PRODUCT_TAX_UPDATE => 'Update Product Tax Profiles',

            self::PRICING_OVERRIDE => 'Authorized Price Override',

            self::ORDER_VIEW => 'View Orders',
            self::ORDER_CREATE => 'Create Orders',
            self::ORDER_SUBMIT => 'Submit Orders',
            self::ORDER_APPROVE => 'Approve Orders',
            self::ORDER_REJECT => 'Reject Orders',
            self::ORDER_CANCEL => 'Cancel Orders',

            self::ORDER_ADJUST_REQUEST => 'Request Order Adjustments',
            self::ORDER_ADJUST_REVIEW => 'Review Order Adjustments',
            self::ORDER_ADJUST_APPROVE => 'Approve Order Adjustments',
            self::ORDER_ADJUST_APPLY => 'Apply Order Adjustments',
            self::ORDER_ADJUST_REVERSE => 'Reverse Order Adjustments',

            self::PAYMENT_VIEW => 'View Payments',
            self::PAYMENT_CREATE => 'Record Payments',
            self::PAYMENT_VERIFY => 'Verify Payments',
            self::PAYMENT_REVERSE => 'Reverse Payments',

            self::INVENTORY_VIEW => 'View Inventory Balances',
            self::INVENTORY_ADJUST => 'Adjust Inventory Stock',
            self::INVENTORY_EXCEPTION_REPORT => 'Report Inventory Exceptions',

            self::DELIVERY_VIEW => 'View Deliveries',
            self::DELIVERY_ASSIGN => 'Assign Deliveries',
            self::DELIVERY_UPDATE => 'Update Delivery Status',

            self::RETURN_REQUEST => 'Request Returns',
            self::RETURN_REVIEW => 'Review Returns',
            self::RETURN_APPROVE => 'Approve Returns',

            self::CREDIT_VIEW => 'View Credit Notes',
            self::CREDIT_CREATE => 'Create Credit Notes',

            self::REFUND_VIEW => 'View Refunds',
            self::REFUND_REQUEST => 'Request Refunds',
            self::REFUND_APPROVE => 'Approve Refunds',

            self::INVOICE_VIEW => 'View Invoices',
            self::INVOICE_PRINT => 'Print Invoices',
            self::INVOICE_DOWNLOAD => 'Download Invoices',

            self::RECEIVABLE_VIEW => 'View Accounts Receivable',

            self::PAYABLE_VIEW => 'View Accounts Payable',
            self::PAYABLE_MANAGE => 'Manage Accounts Payable',

            self::ACCOUNTING_VIEW => 'View General Ledger',
            self::ACCOUNTING_POST => 'Post Journal Entries',
            self::ACCOUNTING_REVERSE => 'Reverse Journal Entries',

            self::USER_VIEW => 'View System Users',
            self::USER_CREATE => 'Create System Users',
            self::USER_UPDATE => 'Update System Users',
            self::USER_SUSPEND => 'Suspend System Users',
            self::USER_DELETE => 'Permanently Delete System Users',

            self::AUDIT_VIEW => 'View Business Audit Logs',
            self::AUDIT_SECURITY_VIEW => 'View Security Event Logs',

            self::ROLE_MANAGE => 'Manage User Roles',
            self::PERMISSION_MANAGE => 'Manage Permission Registry',
        };
    }

    /**
     * Get the semantic description for this permission.
     */
    public function description(): string
    {
        return match ($this) {
            self::CUSTOMER_VIEW => 'Access and browse customer master directory and profile records.',
            self::CUSTOMER_CREATE => 'Onboard and register new customer accounts.',
            self::CUSTOMER_UPDATE => 'Modify customer details, credit terms, and profile metadata.',

            self::PRODUCT_VIEW => 'Browse product catalog, SKUs, inventory status, and base prices.',
            self::PRODUCT_CREATE => 'Define and register new products in the master catalog.',
            self::PRODUCT_UPDATE => 'Edit product metadata, descriptions, units of measure, and categories.',
            self::PRODUCT_PRICE_UPDATE => 'Authoritatively modify base prices, price tiers, and list prices.',
            self::PRODUCT_TAX_UPDATE => 'Assign and update product tax categories and tax profiles.',

            self::PRICING_OVERRIDE => 'Authorize unit prices below minimum allowed price or above MRP for transactions.',

            self::ORDER_VIEW => 'Inspect orders, order lines, fulfillment status, and history.',
            self::ORDER_CREATE => 'Draft new sales orders with selected customer and products.',
            self::ORDER_SUBMIT => 'Formally submit drafted orders for operational processing.',
            self::ORDER_APPROVE => 'Review and authoritatively approve submitted orders.',
            self::ORDER_REJECT => 'Reject submitted orders with documented operational reason.',
            self::ORDER_CANCEL => 'Cancel active or draft orders before dispatch.',

            self::ORDER_ADJUST_REQUEST => 'Initiate non-destructive post-submission order adjustment requests.',
            self::ORDER_ADJUST_REVIEW => 'Evaluate requested order adjustments and financial impact.',
            self::ORDER_ADJUST_APPROVE => 'Authorize pending order adjustments.',
            self::ORDER_ADJUST_APPLY => 'Atomically apply authorized adjustments to allocations and line totals.',
            self::ORDER_ADJUST_REVERSE => 'Reverse applied adjustments with offsetting audit records.',

            self::PAYMENT_VIEW => 'Inspect recorded payments, transactions, and payment history.',
            self::PAYMENT_CREATE => 'Record incoming cash, cheque, and money order collections.',
            self::PAYMENT_VERIFY => 'Validate and reconcile collected payments against bank records.',
            self::PAYMENT_REVERSE => 'Reverse dishonored or erroneous payment entries.',

            self::INVENTORY_VIEW => 'Monitor warehouse stock levels: on-hand, reserved, and available.',
            self::INVENTORY_ADJUST => 'Post manual stock adjustments and write-offs with audit justifications.',
            self::INVENTORY_EXCEPTION_REPORT => 'Flag damaged, missing, or quarantine stock exceptions.',

            self::DELIVERY_VIEW => 'Review delivery queues, trip manifests, and delivery status.',
            self::DELIVERY_ASSIGN => 'Assign orders and delivery batches to delivery drivers.',
            self::DELIVERY_UPDATE => 'Record dispatch status, delivery milestones, and proof of delivery.',

            self::RETURN_REQUEST => 'Initiate product return requests for damaged or rejected goods.',
            self::RETURN_REVIEW => 'Inspect returned items and verify reported physical condition.',
            self::RETURN_APPROVE => 'Authorize inspected product returns for inventory or credit processing.',

            self::CREDIT_VIEW => 'Access and browse customer credit notes, line calculations, and adjustments.',
            self::CREDIT_CREATE => 'Issue authoritative customer credit notes for returns or billing corrections.',

            self::REFUND_VIEW => 'Access and browse customer refund requests and processing lifecycles.',
            self::REFUND_REQUEST => 'Submit formal refund requests for customer overpayments or returned balances.',
            self::REFUND_APPROVE => 'Review and authoritatively disburse approved customer refunds.',

            self::INVOICE_VIEW => 'Access historical, snapshot-based customer invoices.',
            self::INVOICE_PRINT => 'Format and print clean financial invoices without catalog images.',
            self::INVOICE_DOWNLOAD => 'Export invoice documents as secure, immutable PDF files.',

            self::RECEIVABLE_VIEW => 'Access and browse accounts receivable customer ledgers, aging buckets, and statements.',

            self::PAYABLE_VIEW => 'Access and browse accounts payable supplier ledgers, bills, and payments.',
            self::PAYABLE_MANAGE => 'Create and manage suppliers, supplier bills, supplier payments, and reversals.',

            self::ACCOUNTING_VIEW => 'Inspect the double-entry chart of accounts and general ledger journals.',
            self::ACCOUNTING_POST => 'Post balanced double-entry accounting journals to the general ledger.',
            self::ACCOUNTING_REVERSE => 'Post controlled reversing entries for posted ledger transactions.',

            self::USER_VIEW => 'Inspect staff user accounts, directory profiles, and account statuses.',
            self::USER_CREATE => 'Create staff user identities and trigger activation invitations.',
            self::USER_UPDATE => 'Modify staff user profiles, contact information, and account settings.',
            self::USER_SUSPEND => 'Suspend or disable system user accounts to revoke platform access.',
            self::USER_DELETE => 'Permanently delete or safely retire system user identities (Super Admin only).',

            self::AUDIT_VIEW => 'Inspect business audit trail events, timeline, and entity change history.',
            self::AUDIT_SECURITY_VIEW => 'Inspect sensitive security events, authentication logs, and access failures.',

            self::ROLE_MANAGE => 'Assign, change, and review primary user roles across the organization.',
            self::PERMISSION_MANAGE => 'Govern system-wide permission registries and security policy definitions.',
        };
    }

    /**
     * Get the primary module identifier for grouping and filtering.
     */
    public function module(): string
    {
        $parts = explode('.', $this->value);

        return $parts[0];
    }

    /**
     * Get all backed string values for validation and introspection.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Get all permission cases belonging to a specific module.
     *
     * @return array<int, self>
     */
    public static function casesForModule(string $module): array
    {
        return array_values(array_filter(
            self::cases(),
            fn (self $permission) => $permission->module() === $module
        ));
    }
}
