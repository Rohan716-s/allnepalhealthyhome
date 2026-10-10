# Rider delivery flow

## Recording review and rider map update

Reviewed the 44.7-second `Screen Recording 2026-10-08 121438.mp4` supplied by the
user. The recorded order's branch and delivery address both have null latitude
and longitude. No approximate pins or changes to that order were introduced.

- Removed Stop sharing location and the map's duplicate Show my location control
  from the rider detail. GPS starts/resumes for an active delivery and stops when
  leaving it or completing/failing it. Denied permission waits for explicit retry
  rather than restarting on each order refresh.
- Added blue P/Pickup and red D/Destination address cards and matching map pins;
  the rider uses a distinct green R marker. Missing saved coordinates are
  explained beside each address. Navigation can use the address until an exact
  pin is saved. The API includes the branch pickup address independently of
  whether its coordinates have been configured.
- Map legend controls focus each available location; Fit route restores all
  points. Bounds now center on their extrema so an uneven set of locations
  cannot push an endpoint offscreen. The planned pickup-to-destination line is
  available before rider GPS begins. Lines remain direct distances.
- Isolated the map's stacking context to keep labels below the sticky header
  during scrolling. Tile loading has a status indicator and failed images are
  hidden while retaining the existing network warning and saved pins.
- Empty failure reasons now show an inline warning and focus the required field.
  GPS update times explicitly use Nepal time.

Backend and production frontend builds, TypeScript and targeted ESLint passed.
The real API suite and full browser delivery suite passed, including role
refresh, denied GPS, unavailable tiles and offline proof sync. The additional
`frontend/scripts/verify-rider-map-browser.mjs` checks auto tracking, removed
controls, marker bounds/focus/reset, header layering, missing coordinates,
address navigation, inline failure validation and mobile width. It operates only
on the isolated verification order. Screenshots and extracted recording frames
are in ignored `.tmp-rider-map-audit`.

The existing delivery dashboard, list, detail, customer tracking, staff order views,
document storage, SignalR notifications, MySQL schema, and offline queue were
inspected before making these changes.

1. **Rider UI:** Customer, address, actual instructions, status, and the next action
   remain prominent. Order items, pickup details, and optional rider notes/failure
   reporting are collapsible. Existing dashboard counters are compact.
2. **Subheadings:** Removed the repeated route description and live-tracking
   paragraph, the dashboard's redundant Today label, and the customer progress
   step that implied a new delivery still required pickup.
3. **Flow:** Assigned → Accepted → Arrived → Delivered. Existing PICKED_UP and
   OUT_FOR_DELIVERY records can continue to Arrived; their legacy endpoints remain
   available, but completion from either status is rejected until arrival.
4. **Accept:** Accept records AcceptedAt and exposes the next Arrived action.
   No proof editor is rendered at Assigned or Accepted. The API rejects rider
   document uploads before arrival.
5. **Arrived:** POST `/api/delivery/orders/{id}/arrived` validates the current
   status, saves ArrivedAt, records supplied valid coordinates in the existing
   DeliveryLocation, appends history, and publishes the existing delivery event.
6. **Completion/proof:** Delivered opens the final proof controls; Confirm delivered
   runs the existing document/geofence checks and stock transaction. Repeated
   completion is rejected. Authorized staff downloads now load the order needed
   for their branch check. Customers can read final DELIVERY_PROOF for their own
   delivered order, without receiving another user's payment or cheque documents.
7. **Map/location:** Reuses DeliveryTrackingMap, saved address/branch coordinates,
   and the existing location endpoint. Map/destination are visible before accept;
   GPS sharing can start after acceptance and continue through arrival. Denied
   access disables the watcher until explicit retry. Existing offline/tile failure
   notices and coordinate validation remain. GPS responses explicitly mark UTC
   timestamps, preventing fresh database locations being interpreted as stale.
8. **Notes:** Order.DeliveryInstructions remains the shared customer instruction.
   DeliveryAssignment.Notes remains the operational/rider note. Empty transitions
   retain an existing handoff note. No per-role note columns were added.
9. **Role visibility:** Existing customer, pharmacist, admin, superadmin and
   supervisor views/API scopes expose arrival. Staff order details show notes,
   rider, timestamps, coordinates when available, and document links. Customer
   status changes reload the whole order, including its main status and timeline.
10. **Offline/sync:** Status mutations remain online-only because the existing
    sync allowlist excludes them and completion commits stock. Proof uploads
    reuse the existing queue, server receipts, and automatic reconnect sync.
    Completion waits for queued changes. Database retries are disabled before
    early middleware resolves a context for a supported replay request, fixing
    the discovered transaction/retry conflict in proof synchronization.
11. **Changed code:**
    - backend/Models/PharmacyEntities.cs
    - backend/Contracts/PhaseTwoContracts.cs
    - backend/Controllers/DeliveryController.cs
    - backend/Controllers/OrdersController.cs
    - backend/Controllers/PharmacistController.cs
    - backend/Controllers/AdminController.cs
    - backend/Controllers/OrderDocumentsController.cs
    - backend/Program.cs
    - backend/Migrations/20261008022758_DeliveryArrival.cs and its designer
    - backend/Migrations/ApplicationDbContextModelSnapshot.cs
    - frontend/app/delivery/page.tsx
    - frontend/app/delivery/orders/page.tsx
    - frontend/app/delivery/orders/[id]/page.tsx
    - frontend/app/orders/[id]/page.tsx
    - frontend/app/pharmacist/orders/[id]/page.tsx
    - frontend/components/admin-oversight-pages.tsx
    - frontend/components/delivery-live-monitor.tsx
    - frontend/components/order-delivery-details.tsx
    - frontend/lib/delivery-refresh.ts
    - frontend/services/api.ts
    - frontend/scripts/verify-delivery-flow.mjs
    - frontend/scripts/verify-delivery-browser.mjs
12. **Database:** Migration 20261008022758_DeliveryArrival adds only nullable
    delivery_assignments.ArrivedAt. The local database has been migrated; the
    pre-migration dump is in ignored .tmp-delivery-audit/before-arrival.sql.
    Assignment resets clear timestamps so a reassigned rider does not inherit
    the previous rider's arrival. Existing statuses and records are retained.
13. **Verification:** The real API/MySQL suite tests required sequence, invalid
    transitions, duplicate/concurrent acceptance, timestamps, role/notes
    visibility, missing/invalid coordinates, final proof downloads, replay
    receipts, and one stock commit. The browser suite tests the actual flow,
    customer/staff automatic refresh, denied GPS, map tile failure, mobile width,
    and an offline proof upload followed by automatic sync. Browser GPS is
    simulated; no physical-device location accuracy is claimed.
14. **Limits:** Offline status changes are intentionally unavailable. Map tiles
    and road directions need internet; direct-distance lines are not computed
    road routes. Physical-device GPS/permission behavior needs a rider's device
    check. Existing lint warnings remain outside this change. The dependency
    reinstall reported 14 audit findings (2 moderate, 10 high, 2 critical);
    dependency upgrades were not part of the delivery change. The running
    application and database are healthy.

## Reproduce verification

Use a separate diagnostic backend on localhost:5019 with
Authentication__SigningKey=delivery-verification-local-only-separate-signing-key.
The scripts create unique temporary database fixtures and never use forged
production tokens. Apply the migration before starting the diagnostic service;
this repository gates startup migration execution behind startup seeding.

From PowerShell in the repository root:

```powershell
$env:DELIVERY_TEST_KEEP = '1'
node frontend/scripts/verify-delivery-flow.mjs
node frontend/scripts/verify-delivery-browser.mjs
node frontend/scripts/verify-delivery-flow.mjs --cleanup
```

The default browser URL is localhost:3001. Override DELIVERY_TEST_UI_URL or
DELIVERY_TEST_API_URL when using different local ports. Screenshots and fixture
session data remain in ignored .tmp-delivery-audit. Cleanup only removes records
belonging to that suite's generated UUIDs and its generated document files.

## Final local verification

The final backend build and frontend production build passed. TypeScript passed;
ESLint reported no errors, and the delivery verification scripts passed lint.
All 37 staff login/navigation checks passed, including stalled redirect recovery.
The API/MySQL suite and browser suite both passed against the final deployment.
The browser suite verified Customer, Pharmacist, Admin and SuperAdmin updates,
as well as the mobile rider sequence, denied GPS, unavailable map tiles and
one offline proof upload automatically synchronized after reconnecting.
Temporary records and uploaded files were removed, and the diagnostic API
container was removed. All five application services were healthy, with HTTP
200 from localhost:3001/delivery and localhost:5000/healthz.

Docker Desktop's build-cache database failed during the final rebuild. Its
damaged cache database was preserved before repair; MySQL and application
storage were retained. The backend used an isolated builder. To avoid another
cache rebuild on the nearly full C: disk, the frontend used the verified D:
production build and a clean Linux npm dependency install, packaged into the
local frontend image. A downloadable npm cache was cleared to recover space.
The damaged default builder's cache records were subsequently cleared with
Docker's cache prune command. Docker system df then passed and reported zero
build cache. Application volumes were retained. The source Dockerfiles remain
the standard rebuild path.
