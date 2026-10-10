# Field sales workspace

Sales Executive opens `/sales-executive`. Separate modules cover assigned customers and territories, visits and follow-ups, taking orders, fulfilment tracking, outstanding invoices, collection submissions, return requests, and monthly performance. Attendance, leave, and messaging use the existing staff modules.

Sales Manager opens `/sales-management` by default. Admin and SuperAdmin also have a Sales team workspace link. Managers assign active customers to executives in their own branch, set monthly targets and discount limits, and approve or reject orders and returns with a required review note. Accountant opens the same management page from Verify sales collections; only accountants can accept collections.

## Order and payment behaviour

- The catalogue includes all active products, including products without inventory. Branch availability excludes expired, depleted, quarantined, and returned batches and accounts for sales unit multipliers.
- Executive submissions never reserve stock or post payments. Managers approve the requested discount and credit; prices, ordering rules, addresses, customer assignments, credit limits, and available stock are checked again inside a serializable transaction.
- Approval creates the existing pharmacy order and FEFO reservations. Ordinary orders enter `PENDING`; prescription products enter `PRESCRIPTION_VERIFICATION`. Pharmacists and riders continue the existing fulfilment flow. Executives cannot advance order status.
- Price or delivery charge changes require a new request. Credit includes unpaid invoices and approved credit orders awaiting invoicing. Delivery zone minimums and delivery fees follow the existing branch/address rules.
- Collection proof can be a reference, link, or uploaded receipt image. Stored receipt downloads require an active staff account and access to the collection record. Accountant verification applies the collection to oldest outstanding branch invoices and adds the existing payment and ledger records atomically. Overpayments are rejected for correction.
- Manager-approved returns restore only the original sold batches and cannot exceed unreturned quantities. Expired/damaged returns quarantine their batches. Credit returns use the price after the original order discount. Confirmed returns reduce monthly achieved sales.
- Review decisions are final for each request; repeated approval cannot duplicate stock or financial effects. Executives have no direct access to the commercial sales/purchase workspace, even with older tokens containing broad permissions. New endpoints check current staff roles, active status, and branch assignment against the database.

## Storage and rollout

Migration `20261010051327_FieldSalesWorkspace` adds `SalesCustomerAssignments`, `SalesExecutiveTargets`, and `SalesFieldRecords`. Existing customer, order, invoice, inventory, return, payment, and ledger tables remain the operational records. Each request stores its executive, branch, customer, submission identifier, pricing details, review decision, and resulting record identifier.

Managers must assign customers before an executive can submit visits, orders, or collections. Existing product/category assignments remain available in the original administration screen; they do not grant access to another executive's orders.

## Verification

`frontend/scripts/verify-field-sales.mjs` uses isolated temporary records against a diagnostic backend with a separate signing key. It checks customer and branch scope, targets, visits, catalogue activity and availability, request replay, stock rollback, manager/accountant separation, repeat approval, original-batch returns, credit limits, discounts, sales unit conversion, pharmacist cancellation, expiry, prescription review, private receipt uploads, and stale roles.

`frontend/scripts/verify-field-sales-browser.mjs` opens all executive modules, submits an order and approves it through the manager interface, checks accountant separation, and verifies the mobile order page does not overflow. Set `SALES_TEST_UI_URL` to choose the development or production frontend. Test fixtures and screenshots stay under ignored `.tmp-sales-audit`; cleanup removes only fixture records and the test receipt image.

Verified locally on 2026-10-10: backend release build, production Next build, targeted ESLint checks, migration/model consistency, isolated API tests, development browser tests, and production browser tests through the frontend proxy with real temporary staff logins. The local frontend/backend containers were updated and all five application services were healthy. Temporary accounts, orders, payments, return records, stock, and the uploaded test receipt were removed after verification.
