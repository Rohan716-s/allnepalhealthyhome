# Rider Take Order

This change is limited to the existing Rider order composer and its customer,
product, settings, review and creation APIs. No other role's screens or delivery
status workflow were changed.

## Existing implementation inspected

The composer lives in `frontend/components/rider-order-composer.tsx`, embedded
in its own `/delivery/take-order` module under Deliveries. It uses `DeliveryController` and the existing customers,
addresses, products, medicines, brands, inventory, pharmacy_orders, order_items,
staff_users, delivery_assignments, stock_transactions, payment configuration,
ordering configuration and delivery_zones. The live MySQL columns and existing
foreign-key relationships were checked. Customer access remains branch scoped;
prescription medicines still require the existing pharmacist-reviewed flow.

## Live catalog verification — 8 October 2026

The running Docker images were older than the source changes. The Take order
route returned 404 and delivery product search returned only 15 products for the
verification branch, omitting all 100 products sampled from the storefront.
The backend and frontend were rebuilt locally and packaged into the existing
Linux runtime images after the standard Docker rebuild failed. Runtime dependency
versions matched the frontend source. Both local containers were recreated;
database volumes were retained. Rollback image tags end in
`before-catalog-fix-20261008`.

The live API now returns all 5,904 active product IDs and none of the 16 inactive
IDs. The 100 storefront products, four trending products and one hot-deal product
were all present. Searches by name and SKU passed. Chrome tested the separate
module, selecting a branch customer, finding Retinol Face Serum and Shadow SPF
30+ Gel, disabled selection for zero branch stock, enabled selection for available
stock, and desktop/mobile layout with service workers enabled. No orders were
created by this verification. Temporary staff accounts were removed.

Production builds, TypeScript and lint passed. All five application services
were healthy; the homepage, Take order route and backend health endpoint returned
HTTP 200. Local screenshots and the live verification script are in the ignored
`.tmp-take-order-audit` directory.

## Result

Customer selection comes first. Products are hidden until a customer is selected.
Customer phone, email, saved delivery address and location link are shown.
Searches use 300 ms debounce, with stale responses
ignored. Product search supports actual name, generic name, SKU, brand and barcode
fields. Product search returns all matching active products and excludes inactive
products, including when there is no search text. Active products without inventory
in the rider's branch appear with zero available quantity. Out-of-stock and
prescription-required results are disabled; prescription products show that they
require the pharmacist-reviewed flow.

Selected products are stored independently of the current search results.
Selecting a product again increases its quantity in the same row. Quantities
can be changed with minus, plus or the numeric input; invalid quantities are
blocked with a message. Items can be removed. Changing customer or changing order
mode confirms before clearing items. Closing and reopening preserves the draft
and its selected mode. The duplicated Save controls were removed.

Review uses `POST /api/delivery/orders/preview`, sharing the creation validation,
current product prices, unit conversions and delivery charge calculation.
Preview does not save an order or reserve stock. Confirmation recalculates and
validates stock, customer/address, rider, enabled payment method and order rules.
A changed total requires another review.

Creation uses the existing `POST /api/delivery/orders`. The body includes a UUID
`requestId`; successful requests store their result in the existing
`offline_sync_receipts` table under a Rider-order owner prefix. The receipt,
order, payment entry and stock reservation commit atomically. Submissions from
the same rider serialize, and the existing serializable inventory transaction
uses the database execution strategy for retry. Repeated identical UUID requests
return the same order; different data with an already-used UUID is rejected.
The form disables submission immediately, preserves the exact pending payload
after an uncertain response, and offers a safe confirmation retry.

Orders remain normal pharmacy orders with customer, branch, items, reservation
ledger, payment transaction and delivery assignment relationships. Existing
customer price-visibility rules remain respected. No migration was needed.

## Existing business rules

The live configuration permits single and bulk ordering. Single ordering accepts
one product; bulk ordering currently requires at least 10 units per item. The
composer defaults to bulk when available and exposes the existing mode selector.
These rules are preserved, not replaced with new pricing or stock rules.

## Files changed for this task

- `frontend/components/rider-order-composer.tsx`
- `frontend/services/api.ts` — Rider order types and API functions only
- `backend/Controllers/DeliveryController.cs` — order-taking methods and imports
- `backend/Contracts/PhaseTwoContracts.cs` — Rider order request/result fields
- `frontend/scripts/verify-rider-take-order.mjs`
- `frontend/scripts/verify-rider-take-order-browser.mjs`
- This report

## Verification

The real API/MySQL suite verifies customer and product searches, invalid IDs,
null/empty/duplicate items, zero/negative quantities, stock overflow, missing
request UUID, server price calculation, delivery fee, preview without reservation,
stock/price changes after review, unit conversion, simultaneous same-key
submissions, replay, conflicting replay, two riders competing for the final stock,
inactive rider rejection, one payment entry, and visibility through Customer,
Pharmacist, Admin, SuperAdmin and Rider order APIs.

The actual browser suite verifies customer-first gating, customer contact/address,
empty searches, multiple products across searches, merged quantities, manual and
plus/minus changes, removal, customer-change cancellation and confirmation,
stock limits, out-of-stock and missing-address states, close/reopen draft retention,
failed review without creation, server-calculated review, double-click protection,
lost-response retry with the same payload, cleared state after success, and mobile
width. It captures the review screen at 390 px width for visual inspection.

Use a diagnostic API with a separate signing key, as in the preceding delivery
verification. The test scripts create unique temporary fixtures and support:

```powershell
$env:TAKE_ORDER_TEST_KEEP = '1'
node frontend/scripts/verify-rider-take-order.mjs
node frontend/scripts/verify-rider-take-order-browser.mjs
node frontend/scripts/verify-rider-take-order.mjs --cleanup
```

The default test API is localhost:5019, and the UI is localhost:3001. Tests never
use forged production tokens or change the global ordering configuration.

Final verification passed on the deployed source: backend build/publish,
frontend production build, TypeScript, focused ESLint, the API suite, the browser
suite, customer history, and existing order-report CSV export. The mobile review
screenshot was inspected. Temporary fixtures and the diagnostic container were
removed. All five application containers were healthy; `/delivery/orders` and
the API health endpoint both returned HTTP 200.
