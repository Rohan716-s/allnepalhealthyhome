# Sales & Purchase: Account Department and Journal Voucher Section

The reference screenshots are implemented as working menus in `/sales-purchase`, `/admin/sales-purchase`, `/superadmin/sales-purchase` and the existing department workspaces. The screenshot is used as the menu specification, rather than inserted as a decorative photograph.

## Available workflows

Account-Department provides Debtor Account (invoice register and transaction ledger), Cash Receipt Edit, Draft Receipt Edit, Credit Note Edit, Debit Note Edit, their four print registers, Collection/Adjustment Register and Cash Collection.

Journal Voucher Section provides Journal Voucher Entry, Expense/Purchase Voucher Entry, Cheque Print, Payment Voucher, Receipt Voucher, Narration Edit, Post To Ledger, UnPost To Edit, Voucher Edit, Voucher Print, Show Auto-Vouchers, Journal Book, Supplier A/C Credit Entry, Supplier Debit Note, Supplier Debit Note Book and Supplier In-Complete Reconciliation Book.

All entries use persisted API/MySQL records. Save retains the editor; Save & List opens the saved register; List opens the register without saving. Registers have date, branch, type, status and search filters. Editor and list layouts work on mobile. Document printing has a saved-data preview and the browser Print/Save PDF flow. Cheque printing produces a cheque payment document containing bank, cheque number, payee and amount; it is not a bank-specific preprinted cheque alignment template.

## Financial behavior

New documents are DRAFT. Posting creates a balanced debit/credit entry in the existing journal. Invoice-linked receipts/payment vouchers update paid amounts and payment status, and create the existing customer/supplier payment records. Customer debit notes increase, and customer credit notes reduce, the linked invoice total. Supplier A/C credits increase and supplier debit notes reduce supplier payables. Customer entries also update the existing debtor ledger and credit balance. Stock quantities and original invoice VAT amounts are unchanged by these financial adjustments.

Posting and unposting use serializable MySQL transactions and the existing EF retry strategy. Revision checks reject stale saves, concurrent/repeated posting and changes to posted documents. Overpayments and reversals that would make paid amounts or invoice balances invalid are rejected. Unposting requires an audit reason, reverses the invoice and ledger effects and returns the voucher to DRAFT. The former journal/payment records are marked unposted/void; current debtor ledger effects are removed. Narration changes require a separate permission and audit reason. Financial changes are recorded in activity logs.

Sales returns/reversals and supplier returns/reversals are blocked while linked financial vouchers are posted, so their invoice bases cannot invalidate receipt/note reversals. Existing sale correction also rejects separate receipt/adjustment ledger entries. Unpost linked financial vouchers first, then perform the operational correction.

The existing accounting summary includes posted voucher journal entries and expense vouchers. It reconstructs invoice amounts before voucher notes when generating the base ledger, preventing note adjustments from being counted twice. The automatic voucher register reads existing invoices, payments, expenses and legacy journal entries; it does not create duplicate ledger postings. Supplier incomplete reconciliation lists outstanding supplier invoices. Debtor transaction ledgers show an opening balance and dated debit/credit entries with running balances.

## Roles and permissions

The role editor's new groups are **Sales & Purchase**, **Account Department** and **Journal Voucher Section**. The permission catalog includes:

- `sales_purchase.view`
- `sales_purchase.sales.view`, `sales_purchase.sales.manage`
- `sales_purchase.purchase.view`, `sales_purchase.purchase.manage`
- `sales_purchase.accounts.view`
- `sales_purchase.receipts.manage`, `sales_purchase.notes.manage`
- `sales_purchase.journal.view`, `sales_purchase.journal.manage`
- `sales_purchase.vouchers.post`, `sales_purchase.vouchers.unpost`
- `sales_purchase.vouchers.narration`, `sales_purchase.vouchers.print`

Workspace access and the relevant view permission are required alongside action permissions. For example, a cash receipt operator needs workspace view, accounts view and receipts manage; posting and printing can be assigned independently. Journal readers can view registers without editing/posting/printing. Supplier note operators need journal view and notes manage. Superadmin retains its existing bypass.

Default Admin and Accountant roles receive all new permissions. Supervisor defaults include sales/purchase operations and financial viewing/printing, without financial editing or posting. Sales roles receive sales access; Purchase/Inventory Manager receives purchase access. Explicit staff overrides remain explicit. Use Roles & Permissions or the staff editor to grant the new permissions to staff with existing overrides.

Sales/purchase transaction APIs, templates/discount lookups and financial APIs use permissions rather than requiring a fixed staff role. Current staff/role active state, branch and permission assignments are refreshed from the database for each Sales & Purchase/Accountant request, so a previously issued token cannot retain revoked financial permissions. Existing sales-executive product assignments and staff branch boundaries remain enforced. Saving an explicitly empty permission selection retains no-permission semantics.

## Deployment and verification

Apply the additive EF migration `20261008005027_SalesPurchaseFinancialVouchers`, then rebuild/restart the backend and frontend. It creates `financial_vouchers`, installs the permission catalog and adds the new default system-role permission links. Existing operational tables and records are retained. A local pre-migration database backup is stored in the ignored `.tmp-finance-audit` directory. Docker frontend builds default to one Next.js page-generation worker to limit memory use.

The verification scripts are:

- `frontend/scripts/verify-financial-vouchers.mjs`: real API/MySQL tests with uniquely named temporary branches, staff, a role, invoices and vouchers. Run against a diagnostic API on localhost:5019 with the separate signing key described in the script. `FINANCE_TEST_KEEP=1` retains fixtures for the browser suite; `--cleanup` removes only those fixtures afterward.
- `frontend/scripts/verify-financial-workspace-browser.mjs`: all reference menu items, debtor transaction ledger, real Save/Save & List, posting/unposting, print preview, cheque fields, mobile layout, read-only role actions and role permission groups. It forwards browser API requests to the diagnostic backend and blocks service workers for this financial workflow test. It does not claim to exercise offline financial posting; financial mutations require a reachable server.

Registers show the most recent 1000 matching documents; invoice selectors/registers show up to 2000 invoices. Narration supports 1000 characters and audit reasons 500. Each voucher currently has one debit account, one credit account and a common amount. Physical cheque layouts, multi-line journal splits and automatic VAT recalculation are outside these menu workflows.

Verified locally on 8 October 2026: backend compilation, frontend lint/type checks and production builds passed. The real MySQL/API suite and browser workflow suite passed, including concurrent posting, permission revocation, balances and all reference menu actions. Temporary test records were cleaned up. The migration is applied and updated Docker backend/frontend containers are running; all five compose services report healthy. `/sales-purchase` and the backend health endpoint return HTTP 200; unauthenticated financial API access returns HTTP 403. The running workspace is available at `http://localhost:3001/sales-purchase`.
