export interface User {
    id: number;
    name: string;
    email: string;
    role?: string;
    status?: string;
    permissions?: string[];
    created_at?: string;
}

export interface ApplicationIdentity {
    name: string;
    company_name: string;
    tagline: string;
    support_email: string;
    support_phone: string;
    logo_path: string;
    favicon_path: string;
    footer_text: string;
}

export interface CompanyInformation {
    id: number;
    legal_name: string;
    dba_name: string | null;
    display_name: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    formatted_address: string;
    phone: string;
    email: string;
    website: string | null;
    tax_id: string | null;
    state_tax_id: string | null;
    currency: string;
    timezone: string;
    invoice_footer_note: string | null;
    is_title_locked?: boolean;
    updated_at: string | null;
}

export interface SharedProps {
    appName: string;
    identity: ApplicationIdentity;
    company?: CompanyInformation;
    auth: {
        user: User | null;
    };
    flash: {
        success: string | null;
        error: string | null;
    };
    [key: string]: unknown;
}

export interface SessionRecord {
    id: string;
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    browser: string;
    platform: string;
    ip_address: string;
    last_active: string;
    last_active_human: string;
    is_current: boolean;
}

export interface ManagedUser {
    id: number;
    name: string;
    email: string;
    role: string | null;
    role_label?: string;
    status: string;
    created_at?: string;
}

export interface RoleOption {
    value: string;
    label: string;
    description: string;
    is_privileged: boolean;
}

export type CustomerStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
export type PaymentTerms = 'NET_30' | 'NET_15' | 'NET_60' | 'COD' | 'DUE_ON_RECEIPT';

export interface EligibleSalesman {
    id: number;
    name: string;
    email: string;
    status: string;
    role?: string;
}

export interface CustomerAgingSummary {
    current: number | null;
    days_1_30: number | null;
    days_31_60: number | null;
    days_61_90: number | null;
    days_90_plus: number | null;
}

export interface CustomerFinancialSummary {
    status: 'DEFERRED' | 'AVAILABLE';
    is_authoritative: boolean;
    credit_limit: number;
    outstanding_balance: number | null;
    available_credit: number | null;
    credit_utilization_pct: number | null;
    aging: CustomerAgingSummary;
    source_notice: string;
}

export interface Customer {
    id: number;
    code: string;
    name: string;
    contact_name: string;
    email: string | null;
    phone: string;
    salesman_id: number | null;
    salesman?: EligibleSalesman | null;
    billing_address_line1: string;
    billing_address_line2: string | null;
    billing_city: string;
    billing_state: string;
    billing_postal_code: string;
    billing_country: string;
    formatted_billing_address?: string;
    shipping_address_line1: string | null;
    shipping_address_line2: string | null;
    shipping_city: string | null;
    shipping_state: string | null;
    shipping_postal_code: string | null;
    shipping_country: string;
    formatted_shipping_address?: string;
    tax_id: string | null;
    credit_limit: number;
    payment_terms: string;
    payment_terms_label?: string;
    status: CustomerStatus;
    status_label?: string;
    status_badge_variant?: string;
    can_order?: boolean;
    notes: string | null;
    financial_summary?: CustomerFinancialSummary;
    created_at?: string;
    updated_at?: string;
}

export interface CustomerStatusOption {
    value: CustomerStatus;
    label: string;
    badgeVariant?: string;
}

export interface PaymentTermsOption {
    value: PaymentTerms;
    label: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    first_page_url: string;
    from: number | null;
    last_page: number;
    last_page_url: string;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number | null;
    total: number;
}

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface Category {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    parent_id?: number | null;
    parent?: {
        id: number;
        name: string;
        code: string;
    } | null;
    sort_order: number;
    status: CategoryStatus;
    status_label?: string;
    status_badge_variant?: string;
    products_count?: number;
    children_count?: number;
    hierarchy_path?: string;
    can_delete?: boolean;
    children?: Category[];
    created_at?: string;
    updated_at?: string;
}

export interface CategoryStatusOption {
    value: CategoryStatus;
    label: string;
    badgeVariant?: string;
}

export interface CategorySelectOption {
    id: number;
    code: string;
    name: string;
    hierarchy_path: string;
    depth: number;
    status: string;
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductImage {
    id: number;
    product_id: number;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
    is_primary: boolean;
    sort_order: number;
    url?: string | null;
    created_at?: string;
}

export type TaxProfileStatus = 'ACTIVE' | 'INACTIVE';

export interface TaxProfile {
    id: number;
    name: string;
    code: string;
    rate: string;
    description: string | null;
    status: TaxProfileStatus;
    status_label?: string;
    status_badge_variant?: string;
    products_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface TaxProfileSelectOption {
    id: number;
    code: string;
    name: string;
    rate: string;
    status: string;
}

export interface TaxProfileStatusOption {
    value: TaxProfileStatus;
    label: string;
    badgeVariant?: string;
}

export interface Product {
    id: number;
    sku: string;
    barcode?: string | null;
    barcode_type?: string | null;
    name: string;
    description: string | null;
    category_id: number | null;
    category?: Category | null;
    unit: string;
    status: ProductStatus;
    status_label?: string;
    status_badge_variant?: string;
    can_order?: boolean;
    cost_price: number | string | null;
    minimum_allowed_price: number | string;
    default_selling_price: number | string;
    mrp: number | string;
    tax_profile_id: number | null;
    tax_profile?: TaxProfile | null;
    primary_image_url?: string | null;
    images?: ProductImage[];
    created_at?: string;
    updated_at?: string;
}

export interface ProductStatusOption {
    value: ProductStatus;
    label: string;
    badgeVariant?: string;
}

export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & SharedProps;

