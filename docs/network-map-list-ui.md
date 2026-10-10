# Network, location and reusable list UI

## Implementation

The existing React/Next.js frontend, Sonner notifications, Radix dialogs, API services, authentication and offline replay engine are reused. The location map continues to use the application's existing Web Mercator/OpenStreetMap tile renderer. No map package or API key was added.

### Network and automatic synchronization

`useNetworkStatus` derives ONLINE, OFFLINE, RECONNECTING, SYNCING, SYNC_COMPLETE and SYNC_ERROR from the existing offline engine. Browser online/offline events and API capability/reachability probes drive that engine; navigator.onLine alone does not determine server reachability.

Normal online operation has no persistent connectivity badge. OfflineRuntime automatically shows a nonblocking, dismissible Sonner notification when disconnected. Dismissal survives reload in the same tab's session and is reset after reconnecting. Recovery hides the offline notification. Successful synchronization uses a temporary success toast. Only failed saved changes expose the review control.

The existing queue synchronizes on startup, reconnect, focus, visible-tab changes and periodic retries. It retains rejected/conflicting drafts, prevents duplicate replays and emits events that refresh affected lists. Unsupported offline operations still explain that internet is required. This task does not expand the server's offline mutation allowlist.

### Map problems and fixes

The existing map was a delivery viewer, without a location-selection callback binding GPS or map clicks into the branch and checkout forms. Those forms now use LocationPicker, which reuses DeliveryTrackingMap. Browser location requests update the marker and form coordinates; clicks use the inverse Web Mercator projection with wrapped longitude. Existing saved branch coordinates initialize the map after reopening an edit page.

The picker previously included its original GPS fix when fitting the map after manual adjustment. That made its bounds keep following two points. Selection mode now follows the selected form value, so an old GPS fix does not move the map bounds on each click. Delivery tracking still fits its multiple delivery/viewer points.

The container has explicit responsive height and ResizeObserver measurement. Invalid delivery points are filtered before projection. Permission denial and location failures have friendly messages and leave manual selection available. Offline state and complete tile-loading failure show explanations while retaining form coordinates and markers. Reconnection remounts tile images. No existing reverse-geocoding service was found; addresses remain user-entered and are not overwritten with an invented address.

### Shared Save/List behavior

EntityListWorkspace owns modal visibility. EntityListPanel portals the existing list into that modal, retaining each parent's API/state, search, filters, pagination and row actions. A stable portal host preserves the mounted list between openings, so closing the modal does not reset product search or repeat the initial data fetch. The dialog itself unmounts normally, preserving normal focus and pointer behavior. ListButton appears beside existing form actions. FormSaveActions retains Save and Save & List behavior: Save keeps the editor available; successful Save & List opens the list; failed saves keep the form available. Context callbacks are stable so opening the dialog or rerendering the workspace does not reset an in-progress save intent.

CRUD pages use the same existing list implementations rather than copies of their rows. Standalone list pages, dashboards, report tables, import previews and transaction line items retain their normal layouts where those tables are the primary content or part of the transaction itself. The transporter search, refresh, loading/error/empty states and table now all live inside its list modal, with one List button beside Save. HR shift, movement and payroll forms no longer reserve an empty second column for lists moved to a modal.

## Files for this UI work

Shared network, map and list components:

- `frontend/lib/offline/network-status.ts`
- `frontend/components/offline-runtime.tsx`
- `frontend/components/offline-status.tsx`
- `frontend/components/location-picker.tsx`
- `frontend/components/delivery-tracking-map.tsx`
- `frontend/components/entity-list-panel.tsx`
- `frontend/components/form-save-actions.tsx`
- `frontend/services/api.ts` (existing successful-mutation notification)
- `frontend/app/checkout/page.tsx`
- `frontend/components/admin-shell.tsx` (embedded lists omit the application shell)
- `frontend/components/site-header.tsx`
- `frontend/components/staff-shell.tsx`

CRUD/list integrations:

- `frontend/components/admin-products-page.tsx`
- `frontend/components/admin-branches-page.tsx`
- `frontend/components/admin-staff-page.tsx`
- `frontend/components/admin-catalog-taxonomy.tsx`
- `frontend/components/admin-health-articles-page.tsx`
- `frontend/components/admin-cms-pages.tsx`
- `frontend/components/admin-coupons-page.tsx`
- `frontend/components/admin-roles-page.tsx`
- `frontend/components/admin-delivery-zones-page.tsx`
- `frontend/components/admin-delivery-slots.tsx`
- `frontend/components/admin-flash-sales-page.tsx`
- `frontend/components/admin-notification-templates-page.tsx`
- `frontend/components/admin-purchase-orders-page.tsx`
- `frontend/components/admin-hero-slides-page.tsx`
- `frontend/components/admin-logistics-management.tsx`
- `frontend/components/admin-transporter-management.tsx`
- `frontend/components/hrms-admin-page.tsx`
- `frontend/components/hrms-setup-page.tsx`
- `frontend/components/hrms-office-operations.tsx`
- `frontend/components/hrms-workforce-operations.tsx`
- `frontend/components/hrms-payroll-operations.tsx`

Verification:

- `frontend/scripts/verify-network-map-lists.mjs`
- `frontend/scripts/verify-offline-pwa.mjs`
- `docs/network-map-list-ui.md`
- `docs/offline-first.md` (offline implementation and follow-up verification)

This inventory includes the UI changes already in progress when the request was resumed; unrelated pre-existing stock, HR, delivery and backend changes remain in the working tree. No backend code, database schema or migration was changed for this UI follow-up. It reuses the previously implemented offline receipt ledger described in offline-first.md.

## Verification and practical limits

Production build and TypeScript checks passed. Backend build passed with zero warnings and errors. On this memory-constrained Windows machine, page generation with the default 11 workers exhausted system memory; rerunning with `CIRCLE_NODE_TOTAL=2` selected one worker and completed all 167 static pages. ESLint passed for the changed shared components and HR/transporter integrations.

The browser suite opens/closes lists on 24 product/catalog/content/staff/branch/transporter/HR pages. It checks that CRUD forms have no permanently visible record tables, product search survives closing/reopening without another initial fetch, actual OSM tiles load, browser GPS updates coordinates/markers, manual selection reaches the branch API payload, a saved location reloads through the existing read API, mobile map/list layouts do not overflow, Save stays on the form, Save & List opens the list, edits/deactivation refresh the list, failed validation leaves the form available, offline dismissal persists and denied GPS permissions leave a fallback. UI CRUD responses are explicit API fixtures; tile loading uses the real OSM network and browser geolocation uses Playwright's granted location fixture.

A separate real API/MySQL check verifies concurrent duplicate replay, UUID fingerprint mismatch, row-version conflicts, missing-version rejection and no receipt on validation failure. The real browser-to-MySQL test saves five temporary HR entries offline, reloads the page, reconnects, verifies five distinct committed server records and sees the open list refresh automatically. Its department records, receipts and activity logs are removed afterward. The backend runs on an isolated diagnostic port/signing key without changing the running application authentication settings.

Map tiles require internet; cached coordinates/markers do not provide a full offline basemap. Geolocation depends on browser permission and a secure context. No reverse geocoding was added. Offline changes are limited to supported operations and previously downloaded data. Server role/validation conflicts require review. Browser-storage eviction can remove unsynced drafts; backup export remains available. These checks cover representative CRUD actions and all listed form/list routes, not every possible business transaction or external integration.

The freshly built preview runs at `http://127.0.0.1:3017`. The Docker frontend on port 3001 retains its existing image until rebuilt; this task did not replace its image. C: has approximately 270 MB free, which remains a constraint for Docker rebuilds.

### Verification follow-up (8 October 2026)

Restarted the existing production build at `http://127.0.0.1:3017`. The network/map/list browser suite passed across all 24 listed routes, including saved/manual/GPS locations, mobile layouts, retained search, Save/Save & List, edit/deactivation refresh, failed validation and offline notification dismissal. The offline browser durability and production PWA suites also passed, including browser restart, conflict retention, duplicate replay protection and five offline staff entries automatically synchronized after reconnecting. API fixtures were used by these suites; no new real API/MySQL verification or source rebuild was performed in this follow-up.

Docker Desktop's Linux engine was unavailable during this check, so containers were not updated. C: now has approximately 11 GB free. The previous disk-space measurements above describe the earlier verification session.
