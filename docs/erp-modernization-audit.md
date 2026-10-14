# ERP modernization audit — first verified batch

Review date: 2026-10-14 (Asia/Katmandu). Starting commit: `a1c3485`, branch `main`, clean working tree. This is a partial source audit and corrective batch, not certification or completion of the requested ERP modernization.

## Architecture and inspection scope

The repository has 747 tracked files, 251 Next.js page files, 496 HTTP action attributes in backend controllers, and 122 EF DbSet declarations. These are source inventory counts, not proof that each workflow works. Next.js 16.3.4, React 19.2.8, TypeScript and Tailwind serve the frontend. ASP.NET Core targets .NET 10; EF Core and Pomelo 9 use MySQL. ManualBearer authentication, staff permissions, branch claims, SignalR messaging/notifications, EF migrations and Docker Compose are established integrations and retained.

Inspected architecture/configuration, entity definitions, finance contracts, AccountantController, account setup, financial voucher posting/reversal, finance authorization middleware, inventory availability and offline transaction middleware; inventoried controllers, migrations, page files and existing verification scripts. Customer pharmacy, prescriptions, commerce, field sales, inventory, delivery, administration, HRMS, messaging and offline support exist. Their complete end-to-end audit remains pending.

The existing `/sales-purchase` and Accountant modules share operational invoices and journals. Vouchers already use serializable transactions, revisions and explicit post/unpost actions. Existing documentation and test scripts describe previous verification; those results were not re-established in this run.

## Changes in this batch

- Accountant supplier settlements now debit Accounts Payable and credit Cash/Bank. Customer settlements debit the applicable money account and credit Accounts Receivable. Outgoing cheques credit Bank; incoming cheques debit Cheques in Hand.
- Accounting summary CashBalance uses the generated Cash trial-balance row instead of counting bank receipts as cash or omitting supplier cash outflows. This is the legacy summary's selected-range cash calculation, not a newly implemented complete cash book or all-time balance.
- Accountant dashboard net settlement inflows now deduct cleared supplier payments before expenses. This remains an operational dashboard metric, not a standards-compliant cash flow statement.
- Customer overdue calculation excludes invoice-linked ledger debits from its additional standalone debit subtotal. Invoice balances already include invoice-linked adjustments.

No tax rate, original transaction, stock quantity, permission policy or database schema was changed. The summary remains reconstructed from operational records and existing journals. It is not an immutable posted general ledger. The payment posting helper rejects unsupported methods and nonpositive amounts rather than silently treating them as bank settlements.

## Validation and deployment

`dotnet run --project tools/accounting-regression/accounting-regression.csproj`: 13 checks passed. Covers all three supported settlement methods in both directions, partial receivable/payable settlements, cash reconciliation, scenario debit/credit equality and invalid inputs. Uses no database and changes no business records. It exercises the production payment mapping helper, not HTTP endpoints, SQL isolation, stock, tax or whole-system reconciliation.

`dotnet build backend/backend.csproj --no-restore -o .tmp-erp-accounting-check`: passed with zero warnings and errors. `git diff --check`: passed. No frontend changes; no browser viewport tests or frontend build were performed in this batch.

MySQL/API/browser verification is blocked: `docker compose ps --format json` cannot connect to `dockerDesktopLinuxEngine` because its named pipe is absent. Start Docker Desktop with the Linux engine and run `docker compose ps` to establish service availability. Use a separate test database and signing key before running integration suites. Existing finance scripts directly insert/delete fixtures in the configured MySQL database; do not run them against business data merely to obtain test results.

No migration or rollback migration is required. Deploy by rebuilding the backend through the established deployment process. Existing historical summaries will reflect corrected calculation directions; persisted historical transactions remain unchanged. Roll back the corrective commit if necessary, with no data restoration required. Before future schema work, take an encrypted MySQL backup and verify restoration into an isolated database; migrations/seeding must remain disabled on production startup until reviewed.

## Prioritized outstanding implementation and acceptance checklist

1. **Posted accounting model:** add company/branch-aware account mappings, journal headers/lines, exact decimal balancing, unique source/idempotency keys, approval states and append-only reversals. Migrate legacy records with reconciliation, not fabricated balancing entries. Retain source references and historical tax snapshots.
2. **Transaction integrity:** Accountant payment read/modify/write does not currently have the voucher workflow's explicit serializable transaction or request idempotency. Test concurrent partial payments, payment retries and mixed voucher/legacy payments against isolated MySQL before changing it. Unify invoice, payment, return, inventory and COGS posting atomically.
3. **Account setup:** enforce valid account types and parent compatibility, prevent existing cyclic parent chains, and restrict renaming/reclassification of used accounts. Current journal accounts are strings rather than chart-account foreign keys.
4. **Period controls:** introduce configured BS fiscal years/periods, locks/reopening and tested canonical date rules. Verify the existing converter's supported range; reject unsupported dates rather than extrapolate to 3000 BS.
5. **Taxes and compliance:** complete the regulatory evidence matrix in `nepal-accounting-research.md`, obtain entity/product applicability and implement effective-dated tax treatment, TDS and invoice requirements. Existing default VAT values do not establish product applicability or legal compliance.
6. **Reconciliation/reports:** replace reconstructed financial statements with posted-ledger reports; reconcile stock valuation/COGS, returns, opening balances, receivables/payables, profit and balance sheet. Invoice adjustments after a report cutoff, void transactions and historical as-of balances need explicit tests. Current report labels alone do not prove accounting correctness.
7. **Full module audit:** test every role and CRUD path, prescription/media handling, delivery settlement, payroll posting, settings persistence and branch isolation. Verify current role revocation for non-finance endpoints as well as finance endpoints. No new security guarantees are made by this batch.
8. **UI and production:** verify representative routes at 360, 390, 768, 1024 and 1440px, accessibility and errors; inspect all remaining pages; run regression/build checks, profiling, backup restoration and deployment smoke tests.

These items remain incomplete. Docker availability blocks database verification, but does not account for all remaining development work. No claim is made that the project is production-ready or that all twelve requested phases are finished.
