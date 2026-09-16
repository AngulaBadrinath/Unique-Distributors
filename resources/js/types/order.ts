export type OrderStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REJECTED';

export type FulfillmentStatus =
    | 'UNALLOCATED'
    | 'RESERVED'
    | 'PICKED'
    | 'PACKED'
    | 'DISPATCHED'
    | 'DELIVERED'
    | 'PARTIALLY_DELIVERED'
    | 'RETURNED';

export type PaymentStatus =
    | 'UNPAID'
    | 'PARTIALLY_PAID'
    | 'PAID'
    | 'OVERPAID'
    | 'REFUNDED';

export type DeliveryStatus =
    | 'PENDING_ASSIGNMENT'
    | 'ASSIGNED'
    | 'ACCEPTED'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'FAILED';

export type AdjustmentStatus =
    | 'NONE'
    | 'REQUESTED'
    | 'APPLIED'
    | 'REVERSED';

export interface CustomerSummary {
    id: number;
    code: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    credit_limit: number;
    payment_terms: string | null;
    payment_terms_label: string | null;
    status: string;
    status_label: string;
    billing_address: string;
    shipping_address: string;
}

export interface CatalogProduct {
    id: number;
    sku: string;
    name: string;
    description: string | null;
    category_id: number | null;
    category: {
        id: number;
        name: string;
        code: string;
    } | null;
    unit: string;
    status: string;
    status_label: string;
    minimum_allowed_price: number;
    default_selling_price: number;
    mrp: number;
    can_order: boolean;
    tax_profile_id: number | null;
    tax_profile: {
        id: number;
        name: string;
        code: string;
        rate: string;
        formatted_rate: string;
        status: string;
        is_exempt?: boolean;
    } | null;
    primary_image_url: string | null;
}

export interface CartLineItem {
    product: CatalogProduct;
    quantity: number;
    unit_price: string;
    is_custom_price: boolean;
}

export interface OrderItemDetail {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    unit: string;
    ordered_quantity: number;
    cancelled_quantity?: number;
    reserved_quantity?: number;
    fulfillable_quantity: number;
    allocated_quantity?: number;
    unallocated_quantity?: number;
    picked_quantity?: number;
    dispatched_quantity?: number;
    delivered_quantity?: number;
    returned_quantity?: number;
    unit_price: string;
    is_price_overridden: boolean;
    tax_profile_code: string | null;
    tax_profile_name: string | null;
    tax_rate: string;
    formatted_tax_rate: string;
    taxable_amount: string;
    tax_amount: string;
    line_total: string;
}

export interface OrderTimelineEvent {
    id: string;
    title: string;
    description: string | null;
    timestamp: string | null;
    actor_name: string | null;
    status: 'completed' | 'current' | 'pending' | 'cancelled';
    badge_label?: string | null;
    badge_variant?: string | null;
    icon: 'created' | 'submitted' | 'approved' | 'processing' | 'completed' | 'cancelled' | 'fulfillment' | 'payment' | 'delivery';
}

export interface OrderDetail {
    id: number;
    order_number: string;
    idempotency_key: string;
    draft_token?: string | null;
    status: OrderStatus;
    status_label: string;
    status_badge_variant: string;
    fulfillment_status: FulfillmentStatus | null;
    fulfillment_status_label: string | null;
    fulfillment_badge_variant: string | null;
    payment_status: PaymentStatus | null;
    payment_status_label: string | null;
    payment_badge_variant: string | null;
    delivery_status: DeliveryStatus | null;
    delivery_status_label: string | null;
    delivery_badge_variant: string | null;
    adjustment_status?: AdjustmentStatus | null;
    adjustment_status_label?: string | null;
    adjustment_badge_variant?: string | null;
    currency: string;
    subtotal: string;
    tax_total: string;
    adjustment_total: string;
    grand_total: string;
    notes: string | null;
    submitted_at: string | null;
    approved_at?: string | null;
    approver?: {
        id: number;
        name: string;
    } | null;
    cancelled_at?: string | null;
    canceller?: {
        id: number;
        name: string;
    } | null;
    cancellation_reason?: string | null;
    completed_at?: string | null;
    created_at: string;
    customer: {
        id: number;
        code: string;
        name: string;
        contact_name: string | null;
        email: string | null;
        phone: string | null;
        billing_address: string;
        shipping_address: string;
        payment_terms: string | null;
    };
    salesman: {
        id: number;
        name: string;
        email: string;
    };
    items: OrderItemDetail[];
    payments?: OrderPaymentDetail[];
    financial_summary?: OrderFinancialSummary;
    timeline?: OrderTimelineEvent[];
    active_adjustment?: ActiveAdjustmentData | null;
    invoice?: {
        id: number;
        invoice_number: string;
        status: string;
        payment_status?: string;
        amount_paid?: string;
        amount_due?: string;
        grand_total?: string;
    } | null;
    can?: {
        request_adjustment?: boolean;
    };
}

export interface OrderPaymentDetail {
    id: number;
    payment_number: string;
    payment_method: 'CASH' | 'CHEQUE' | 'MONEY_ORDER';
    payment_method_label: string;
    status: string;
    status_label: string;
    status_badge_variant: string;
    amount: string;
    payment_date: string;
    bank_name?: string | null;
    cheque_number?: string | null;
    cheque_date?: string | null;
    issuer_name?: string | null;
    money_order_number?: string | null;
    receipt_reference?: string | null;
    notes?: string | null;
    has_evidence: boolean;
    evidence_original_name?: string | null;
    evidence_mime_type?: string | null;
    recorded_by?: string | null;
    verified_by?: string | null;
    created_at: string;
}

export interface OrderFinancialSummary {
    subtotal: string;
    tax_total: string;
    adjustment_total: string;
    grand_total: string;
    verified_payments_total: string;
    pending_payments_total: string;
    outstanding_balance: string;
}

export interface OrderHistoryItem {
    id: number;
    order_number: string;
    idempotency_key: string;
    customer: {
        id: number;
        code: string;
        name: string;
        contact_name: string | null;
        phone: string | null;
    };
    status: OrderStatus;
    status_label: string;
    status_badge_variant: string;
    fulfillment_status: FulfillmentStatus | null;
    fulfillment_status_label: string | null;
    fulfillment_badge_variant: string | null;
    payment_status: PaymentStatus | null;
    payment_status_label: string | null;
    payment_badge_variant: string | null;
    delivery_status: DeliveryStatus | null;
    delivery_status_label: string | null;
    delivery_badge_variant: string | null;
    adjustment_status: AdjustmentStatus | null;
    adjustment_status_label: string | null;
    adjustment_badge_variant: string | null;
    currency: string;
    subtotal: string;
    tax_total: string;
    adjustment_total: string;
    grand_total: string;
    item_count: number;
    submitted_at: string | null;
    created_at: string;
}

export interface OrderHistoryFilters {
    search?: string;
    status?: string;
    fulfillment_status?: string;
    payment_status?: string;
    delivery_status?: string;
    date_from?: string;
    date_to?: string;
}

export interface AdminOrderQueueCounts {
    new: number;
    attention: number;
    processing: number;
    delivery: number;
    adjustments: number;
    completed: number;
    cancelled: number;
    all: number;
}

export interface AdminOrderQueueItem {
    id: number;
    order_number: string;
    customer: {
        id: number;
        code: string;
        name: string;
        status: string;
        phone: string | null;
    } | null;
    salesman: {
        id: number;
        name: string;
        email: string;
    } | null;
    status: OrderStatus;
    status_label: string;
    status_badge_variant: string;
    fulfillment_status: FulfillmentStatus | null;
    fulfillment_status_label: string | null;
    fulfillment_badge_variant: string | null;
    payment_status: PaymentStatus | null;
    payment_status_label: string | null;
    payment_badge_variant: string | null;
    delivery_status: DeliveryStatus | null;
    delivery_status_label: string | null;
    delivery_badge_variant: string | null;
    adjustment_status: AdjustmentStatus | null;
    adjustment_status_label: string | null;
    adjustment_badge_variant: string | null;
    item_count: number;
    currency: string;
    grand_total: string;
    submitted_at: string | null;
    submitted_at_formatted: string | null;
    submitted_at_relative: string | null;
    created_at: string;
    attention_flags: string[];
    notes: string | null;
}

export interface AdminOrderQueueFilters {
    queue: string;
    search?: string;
    status?: string;
    fulfillment_status?: string;
    payment_status?: string;
    delivery_status?: string;
    adjustment_status?: string;
    salesman_id?: string | number;
    customer_id?: string | number;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_direction?: string;
    per_page?: number;
}

export interface OrderDraftSummary {
    id: number;
    draft_token: string;
    version: number;
    idempotency_key: string;
    customer: {
        id: number;
        code: string;
        name: string;
        contact_name: string | null;
        phone: string | null;
        status: string;
        status_label: string;
    };
    item_count: number;
    subtotal: string;
    tax_total: string;
    grand_total: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface InitialDraftData {
    id: number;
    draft_token: string;
    version: number;
    idempotency_key: string;
    customer_id: number;
    notes: string;
    subtotal: string;
    tax_total: string;
    grand_total: string;
    customer_status: string;
    customer_is_active: boolean;
    items: Array<{
        id: number;
        product_id: number;
        quantity: number;
        unit_price: string;
        is_custom_price: boolean;
        product: CatalogProduct | null;
    }>;
}

export interface LineFinancialPreview {
    product: CatalogProduct;
    quantity: number;
    unitPrice: string;
    isCustomPrice: boolean;
    taxableAmount: string;
    taxProfileCode: string;
    taxProfileName: string;
    taxRate: string;
    formattedTaxRate: string;
    isExempt: boolean;
    taxAmount: string;
    lineTotal: string;
}

export interface OrderFinancialPreview {
    lines: LineFinancialPreview[];
    itemCount: number;
    totalUnits: number;
    subtotal: string;
    taxTotal: string;
    adjustmentTotal: string;
    grandTotal: string;
    numericSubtotal: number;
    numericTaxTotal: number;
    numericGrandTotal: number;
}

export interface ReviewWarning {
    code: 'CUSTOMER_ON_HOLD' | 'CUSTOMER_INACTIVE' | 'CREDIT_LIMIT_EXCEEDED' | 'PRICE_OVERRIDE_PRESENT' | 'AGING_ORDER' | 'PRODUCT_INACTIVE';
    severity: 'blocker' | 'warning' | 'info';
    title: string;
    description: string;
    action_text?: string;
    action_url?: string;
}

export interface AdminOrderReviewItem {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    unit: string;
    ordered_quantity: number;
    cancelled_quantity: number;
    unit_price: string;
    is_price_overridden: boolean;
    price_override_reason: string | null;
    price_override_approver: {
        id: number;
        name: string;
    } | null;
    tax_profile_code: string;
    tax_profile_name: string;
    tax_rate: string;
    formatted_tax_rate: string;
    taxable_amount: string;
    tax_amount: string;
    line_total: string;
    catalog_product: {
        name?: string;
        status: string;
        is_active: boolean;
        minimum_allowed_price: string;
        mrp: string;
        default_selling_price?: string;
    } | null;
}

export interface AdminOrderReviewData {
    order: {
        id: number;
        order_number: string;
        status: OrderStatus;
        status_label: string;
        status_badge_variant: string;
        fulfillment_status: FulfillmentStatus | null;
        fulfillment_status_label: string | null;
        fulfillment_badge_variant: string | null;
        payment_status: PaymentStatus | null;
        payment_status_label: string | null;
        payment_badge_variant: string | null;
        delivery_status: DeliveryStatus | null;
        delivery_status_label: string | null;
        delivery_badge_variant: string | null;
        adjustment_status: AdjustmentStatus | null;
        adjustment_status_label: string | null;
        adjustment_badge_variant: string | null;
        currency: string;
        subtotal: string;
        tax_total: string;
        adjustment_total: string;
        grand_total: string;
        notes: string | null;
        submitted_at: string | null;
        submitted_at_formatted: string | null;
        submitted_at_relative: string | null;
        created_at: string;
        is_reviewable: boolean;
    };
    customer: {
        id: number;
        code: string;
        name: string;
        contact_name: string | null;
        email: string | null;
        phone: string | null;
        billing_address: string;
        shipping_address: string;
        tax_id: string | null;
        credit_limit: number;
        payment_terms: string | null;
        status: string;
        status_label: string;
        is_on_hold: boolean;
        is_active: boolean;
    };
    salesman: {
        id: number;
        name: string;
        email: string;
    };
    items: AdminOrderReviewItem[];
    tax_breakdown: Array<{
        code: string;
        name: string;
        rate: string;
        formatted_rate: string;
        taxable_amount: string;
        tax_amount: string;
    }>;
    warnings: ReviewWarning[];
    has_blockers: boolean;
    timeline: OrderTimelineEvent[];
    can: {
        approve: boolean;
        reject: boolean;
    };
}

export type AllocationStatus =
    | 'ALLOCATED'
    | 'RESERVED'
    | 'PICKED'
    | 'PACKED'
    | 'DISPATCHED'
    | 'DELIVERED'
    | 'PARTIALLY_DELIVERED'
    | 'CANCELLED'
    | 'RELEASED';

export interface OrderItemAllocationData {
    id: number;
    allocation_number: string;
    allocated_quantity: number;
    reserved_quantity: number;
    picked_quantity: number;
    dispatched_quantity: number;
    delivered_quantity: number;
    returned_quantity: number;
    status: AllocationStatus;
    status_label: string;
    status_badge_variant: string;
    warehouse_code: string;
    allocated_at: string | null;
    notes: string | null;
}

export interface AdminOrderDetailItem {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    unit: string;
    ordered_quantity: number;
    cancelled_quantity: number;
    reserved_quantity: number;
    fulfillable_quantity: number;
    allocated_quantity?: number;
    unallocated_quantity?: number;
    picked_quantity: number;
    dispatched_quantity: number;
    delivered_quantity: number;
    returned_quantity: number;
    unit_price: string;
    is_price_overridden: boolean;
    price_override_reason: string | null;
    price_override_approver: {
        id: number;
        name: string;
    } | null;
    tax_profile_code: string;
    tax_profile_name: string;
    tax_rate: string;
    formatted_tax_rate: string;
    taxable_amount: string;
    tax_amount: string;
    line_total: string;
    catalog_product: {
        status: string;
        is_active: boolean;
        default_selling_price?: string;
        mrp?: string;
    } | null;
    allocations?: OrderItemAllocationData[];
}

export interface AdminOrderDetailData {
    order: {
        id: number;
        order_number: string;
        version: number;
        status: OrderStatus;
        status_label: string;
        status_badge_variant: string;
        fulfillment_status: FulfillmentStatus | null;
        fulfillment_status_label: string | null;
        fulfillment_badge_variant: string | null;
        payment_status: PaymentStatus | null;
        payment_status_label: string | null;
        payment_badge_variant: string | null;
        delivery_status: DeliveryStatus | null;
        delivery_status_label: string | null;
        delivery_badge_variant: string | null;
        adjustment_status: AdjustmentStatus | null;
        adjustment_status_label: string | null;
        adjustment_badge_variant: string | null;
        currency: string;
        subtotal: string;
        tax_total: string;
        adjustment_total: string;
        grand_total: string;
        notes: string | null;
        submitted_at: string | null;
        submitted_at_formatted: string | null;
        approved_at: string | null;
        approver: {
            id: number;
            name: string;
        } | null;
        cancelled_at: string | null;
        canceller: {
            id: number;
            name: string;
        } | null;
        cancellation_reason: string | null;
        completed_at: string | null;
        created_at: string;
        is_reviewable: boolean;
        invoice?: {
            id: number;
            invoice_number: string;
            status: string;
        } | null;
    };
    customer: {
        id: number;
        code: string;
        name: string;
        contact_name: string | null;
        email: string | null;
        phone: string | null;
        billing_address: string;
        shipping_address: string;
        payment_terms: string | null;
        credit_limit: number;
        status: string;
        status_label: string;
        is_active: boolean;
    };
    salesman: {
        id: number;
        name: string;
        email: string;
    };
    creator: {
        id: number;
        name: string;
    } | null;
    items: AdminOrderDetailItem[];
    tax_breakdown: Array<{
        code: string;
        name: string;
        rate: string;
        formatted_rate: string;
        taxable_amount: string;
        tax_amount: string;
    }>;
    fulfillment_summary: {
        total_ordered: number;
        total_reserved: number;
        total_fulfillable: number;
        total_cancelled: number;
        total_picked: number;
        total_dispatched: number;
        total_delivered: number;
        total_returned: number;
    };
    allocation_summary?: {
        total_allocated_units: number;
        total_fulfillable_units: number;
        total_unallocated_units: number;
        allocations_count: number;
        has_allocations: boolean;
    };
    timeline: OrderTimelineEvent[];
    active_adjustment?: ActiveAdjustmentData | null;
    can: {
        review: boolean;
        print: boolean;
        request_adjustment?: boolean;
    };
    backUrl: string;
    backLabel: string;
}

export type AdjustmentReasonCode =
    | 'CUSTOMER_REQUEST'
    | 'WAREHOUSE_DAMAGE'
    | 'STOCKOUT_DEFECT'
    | 'PRICING_DISPUTE'
    | 'OTHER';

export interface OrderAdjustmentItemData {
    order_item_id: number;
    product_name: string;
    sku: string;
    requested_quantity_reduction: number;
    affected_allocation_quantity: number;
    is_case_b: boolean;
    projected_line_total_reduction: string;
}

export interface ActiveAdjustmentData {
    id: number;
    adjustment_number: string;
    status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED' | 'REVERSED';
    status_label: string;
    reason_code: AdjustmentReasonCode;
    reason_label: string;
    notes: string | null;
    requested_by: string | null;
    requested_by_id: number;
    requested_at: string | null;
    can_withdraw: boolean;
    projected_subtotal_reduction: string;
    projected_tax_reduction: string;
    projected_grand_total_reduction: string;
    items: OrderAdjustmentItemData[];
}

export interface OrderAdjustmentQueueItem {
    id: number;
    adjustment_number: string;
    order_id: number;
    order_number: string;
    order_status: string;
    order_status_label: string;
    customer_name: string;
    customer_code: string;
    requester_name: string;
    requester_email: string;
    requester_role: string;
    reason_code: string;
    reason_label: string;
    status: string;
    status_label: string;
    badge_variant: string;
    impact_case: 'CASE_A' | 'CASE_B';
    affected_allocation_quantity: number;
    items_count: number;
    projected_grand_total_reduction: string;
    requested_at: string | null;
    requested_at_formatted: string | null;
    age_hours: number;
    age_relative: string;
    is_aging: boolean;
    attention_flags: string[];
    needs_attention: boolean;
    primary_exception: string | null;
    has_blocker: boolean;
    is_ready_to_apply: boolean;
    is_terminal: boolean;
    can: {
        review: boolean;
        approve: boolean;
        apply: boolean;
        reverse: boolean;
    };
}

export interface OrderAdjustmentQueueCounts {
    attention: number;
    pending: number;
    ready_to_apply: number;
    applied: number;
    reversed: number;
    closed: number;
    all: number;
    case_b: number;
}

export interface OrderAdjustmentQueueFilters {
    queue: 'attention' | 'pending' | 'ready_to_apply' | 'applied' | 'reversed' | 'closed' | 'all';
    exception_type?: string;
    search?: string;
    status?: string;
    impact_case?: string;
    reason_code?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_direction?: string;
    per_page?: number;
}

export interface OrderAdjustmentAllocationDetail {
    id: number;
    allocation_number: string;
    warehouse_code: string | null;
    status: string;
    status_label: string;
    badge_variant: string;
    allocated_quantity: number;
    reserved_quantity: number;
    picked_quantity: number;
    dispatched_quantity: number;
    delivered_quantity: number;
    returned_quantity: number;
    unpicked_quantity: number;
}

export interface OrderAdjustmentItemReviewData {
    adjustment_item_id: number;
    order_item_id: number;
    product_id: number;
    product_name: string;
    sku: string;
    unit_price_snapshot: string;
    tax_rate_snapshot: string;
    ordered_quantity_snapshot: number;
    fulfillable_quantity_snapshot: number;
    allocated_quantity_snapshot: number;
    unallocated_quantity_snapshot: number;
    requested_quantity_reduction: number;
    snapshot_affected_allocation_quantity: number;
    current_ordered_quantity: number;
    current_cancelled_quantity: number;
    current_fulfillable_quantity: number;
    current_allocated_quantity: number;
    current_unallocated_quantity: number;
    current_affected_allocation_quantity: number;
    snapshot_case: 'CASE_A' | 'CASE_B';
    current_case: 'CASE_A' | 'CASE_B';
    case_changed: boolean;
    is_conflicted: boolean;
    conflict_reason: string | null;
    unpicked_allocated_quantity: number;
    encroaches_on_picked: boolean;
    allocations: OrderAdjustmentAllocationDetail[];
    financial_snapshot: {
        taxable_amount_reduction: string;
        tax_amount_reduction: string;
        line_total_reduction: string;
    };
    live_financial_preview: {
        taxable_amount_reduction: string;
        tax_amount_reduction: string;
        line_total_reduction: string;
    };
}

export interface OrderAdjustmentReviewEvaluation {
    adjustment_id: number;
    adjustment_number: string;
    order_id: number;
    order_number: string;
    order_version_snapshot: number;
    current_order_version: number;
    order_status_snapshot: string;
    current_order_status: string;
    is_stale: boolean;
    stale_reasons: string[];
    evaluation_status: 'READY' | 'WARNING_ALLOCATION' | 'WARNING_PICKED_ENCROACHMENT' | 'STALE' | 'CONFLICTED' | 'INELIGIBLE_LIFECYCLE' | 'TERMINAL_REQUEST';
    has_allocation_impact: boolean;
    total_affected_allocation_quantity: number;
    total_unpicked_affected_quantity: number;
    encroaches_on_picked: boolean;
    line_evaluations: OrderAdjustmentItemReviewData[];
    request_financial_snapshot: {
        subtotal_reduction: string;
        tax_reduction: string;
        grand_total_reduction: string;
    };
    live_financial_preview: {
        subtotal_reduction: string;
        tax_reduction: string;
        grand_total_reduction: string;
    };
    financial_discrepancy: boolean;
}

export interface OrderAdjustmentReviewDetailData {
    id: number;
    adjustment_number: string;
    order_id: number;
    order_number: string;
    order_version_snapshot: number;
    current_order_version: number;
    order_status_snapshot: string;
    current_order_status: string;
    current_order_status_label: string;
    status: string;
    status_label: string;
    badge_variant: string;
    reason_code: string;
    reason_label: string;
    notes: string | null;
    requested_by: {
        id: number | null;
        name: string;
        email: string;
        role: string;
        role_label: string;
    };
    requested_at: string | null;
    requested_at_formatted: string | null;
    reviewed_by: {
        id: number;
        name: string;
    } | null;
    reviewed_at: string | null;
    applied_by?: {
        id: number;
        name: string;
    } | null;
    applied_at?: string | null;
    applied_at_formatted?: string | null;
    rejection_reason: string | null;
    cancelled_by: {
        id: number;
        name: string;
    } | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    reversed_by?: {
        id: number;
        name: string;
    } | null;
    reversed_at?: string | null;
    reversed_at_formatted?: string | null;
    reversal_reason?: string | null;
    customer: {
        id: number;
        code: string;
        name: string;
        credit_limit: string;
        payment_terms: string;
    };
    current_order_totals: {
        subtotal: string;
        tax_total: string;
        grand_total: string;
    };
    order_snapshot_totals: {
        subtotal: string;
        tax_total: string;
        grand_total: string;
    };
    projected_reductions: {
        subtotal: string;
        tax_total: string;
        grand_total: string;
    };
}



