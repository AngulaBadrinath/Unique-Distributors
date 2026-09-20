# Accounting, General Ledger & Financial Workflow Specification

## 1. Workflow Overview & Purpose
The **Accounting & General Ledger Workflow** provides authoritative, double-entry financial accounting. Commercial operations automatically map to balanced `JournalEntry` and `JournalLine` records, update Accounts Receivable (AR) and Accounts Payable (AP) subledgers, and feed the Trial Balance, Profit & Loss, and Balance Sheet statements.

- **Implementation Status:** `[IMPLEMENTED]`
- **Primary Roles:** `ACCOUNTANT`, `ADMIN`

---

## 2. Architecture & Entry Points

### HTTP Routes & Endpoints
| HTTP Method | URI | Route Name | Controller Action | Middleware Stack |
|---|---|---|---|---|
| `GET` | `/admin/accounting/accounts` | `admin.accounting.accounts.index` | `AdminAccountingController@accounts` | `auth`, `account.active`, `permission:accounting.view` |
| `GET` | `/admin/accounting/journals` | `admin.accounting.journals.index` | `AdminAccountingController@journals` | `auth`, `account.active`, `permission:accounting.view` |
| `GET` | `/admin/accounting/journals/{journal}` | `admin.accounting.journals.show` | `AdminAccountingController@showJournal` | `auth`, `account.active`, `permission:accounting.view` |
| `GET` | `/admin/receivables` | `admin.receivables.index` | `AdminReceivableController@index` | `auth`, `account.active`, `permission:receivable.view` |
| `GET` | `/admin/receivables/aging` | `admin.receivables.aging` | `AdminReceivableController@aging` | `auth`, `account.active`, `permission:receivable.view` |
| `GET` | `/admin/payables` | `admin.payables.index` | `AdminPayableController@index` | `auth`, `account.active`, `permission:payable.view` |
| `GET` | `/admin/credit-notes` | `admin.credit-notes.index` | `AdminCreditNoteController@index` | `auth`, `account.active`, `permission:credit_note.view` |
| `GET` | `/admin/reports/financial` | `admin.reports.financial` | `AdminReportingController@financial` | `auth`, `account.active`, `permission:reporting.view` |

### Frontend UI Pages
- Chart of Accounts: `resources/js/Pages/Admin/Accounting/Accounts.tsx`
- General Ledger Journal Ledger: `resources/js/Pages/Admin/Accounting/Journals.tsx`
- Accounts Receivable Hub: `resources/js/Pages/Admin/Receivables/Index.tsx`
- AR Aging Analysis: `resources/js/Pages/Admin/Receivables/Aging.tsx`
- Accounts Payable Hub: `resources/js/Pages/Admin/Payables/Index.tsx`
- Financial Statements: `resources/js/Pages/Admin/Reports/FinancialReport.tsx`

---

## 3. Standard Chart of Accounts (COA) Mapping

| Code | Account Name | Account Type | Normal Balance | Description |
|---|---|---|---|---|
| **1010** | Cash on Hand | ASSET | DEBIT | Undeposited cash collections from field salesmen |
| **1020** | Operating Bank Account | ASSET | DEBIT | Primary commercial bank clearing account |
| **1100** | Accounts Receivable | ASSET | DEBIT | Trade receivables owed by wholesale customers |
| **1200** | Inventory Asset | ASSET | DEBIT | Physical inventory value held in warehouses |
| **2010** | Accounts Payable | LIABILITY | CREDIT | Trade payables owed to suppliers |
| **2100** | Sales Tax Payable | LIABILITY | CREDIT | Output sales tax collected from customers |
| **3010** | Retained Earnings | EQUITY | CREDIT | Accumulated net operational earnings |
| **4010** | Wholesale Sales Revenue | REVENUE | CREDIT | Revenue recognized on commercial invoice issuance |
| **4020** | Sales Discounts | CONTRA-REVENUE | DEBIT | Order adjustment discounts & price allowances |
| **4030** | Sales Returns & Allowances | CONTRA-REVENUE | DEBIT | Credit notes issued against customer returns |
| **5010** | Cost of Goods Sold (COGS) | EXPENSE | DEBIT | Physical cost of inventory delivered to customers |
| **5020** | Inventory Shrinkage & Loss | EXPENSE | DEBIT | Write-offs from damaged or missing stock |

---

## 4. Double-Entry Posting Rules & Transactions

### A. Invoice Issuance (`JournalMappingService::postInvoiceIssued`)
```text
DEBIT  1100 Accounts Receivable        $4,537.50
CREDIT 4010 Wholesale Sales Revenue               $4,125.00
CREDIT 2100 Sales Tax Payable                       $412.50
```

### B. Delivery Completion & COGS (`JournalMappingService::postOrderDeliveredCogs`)
```text
DEBIT  5010 Cost of Goods Sold (COGS)  $2,850.00
CREDIT 1200 Inventory Asset                       $2,850.00
```

### C. Payment Receipt Verification (`JournalMappingService::postPaymentReceipt`)
```text
DEBIT  1010 Cash on Hand / 1020 Bank   $4,537.50
CREDIT 1100 Accounts Receivable                   $4,537.50
```

### D. Cheque Reversal / NSF (`JournalMappingService::postPaymentReversal`)
```text
DEBIT  1100 Accounts Receivable        $4,537.50
CREDIT 1020 Operating Bank Account                $4,537.50
```

### E. Credit Note Issuance (`JournalMappingService::postCreditNoteIssued`)
```text
DEBIT  4030 Sales Returns & Allowances   $345.00
DEBIT  2100 Sales Tax Payable             $34.50
CREDIT 1100 Accounts Receivable                     $379.50
```

---

## 5. Invariants & Immutability Guarantees

1. **Strict Balance Assertion (RULE-ACC-001):**
   ```php
   if (bccomp($totalDebit, $totalCredit, 2) !== 0) {
       throw new UnbalancedJournalException("Debit ({$totalDebit}) does not equal Credit ({$totalCredit})");
   }
   ```
2. **Accounting Immutability:** Posted journals are NEVER edited or deleted. Corrections are executed via reversing entries (`JournalReversalService`) and correcting journal entries.
3. **Subledger Reconciliation:** Accounts Receivable and Accounts Payable subledgers must reconcile with `1100` and `2010` GL account balances at all times.

---

## 6. Source Code Traceability Index
- `app/Services/Accounting/AccountService.php`
- `app/Services/Accounting/GeneralLedgerService.php`
- `app/Services/Accounting/JournalService.php`
- `app/Services/Accounting/JournalMappingService.php`
- `app/Services/Accounting/JournalReversalService.php`
- `app/Services/Accounting/TrialBalanceService.php`
- `app/Services/Accounting/ProfitAndLossService.php`
- `app/Services/Accounting/BalanceSheetService.php`
- `app/Services/Receivable/ReceivableLedgerService.php`
- `app/Services/Receivable/ReceivableAgingService.php`
- `app/Services/Payable/PayableLedgerService.php`
- `app/Services/Credit/CreditNoteService.php`
- `app/Http/Controllers/Admin/AdminAccountingController.php`
- `app/Models/Account.php`
- `app/Models/JournalEntry.php`
- `app/Models/JournalLine.php`
- `app/Models/ReceivableTransaction.php`
- `app/Models/PayableTransaction.php`
- `app/Models/CreditNote.php`
- `app/Policies/AccountPolicy.php`
- `app/Policies/JournalEntryPolicy.php`
