# Offline-first implementation

The existing Next.js 16 / React 19 frontend, ASP.NET Core 10 API, EF Core 9 / MySQL database, bearer authentication, routes, roles and controller validations are retained. No alternate app or runtime database library was introduced. Earlier stock, HRMS and delivery-map fixes remain intact.

## Supported operations and cached data

| Feature | Offline behavior |
| --- | --- |
| Customer cart | Add, set quantity, remove item, clear; queue edits against a downloaded cart version. Last downloaded stock limits local quantities; server stock changes require review. This does not reserve stock. |
| Wishlist | Add/remove a downloaded product; native idempotent commands. |
| Leave | Create own request; existing authorized managers may create for staff, update or delete. Approval/rejection decisions require internet. |
| HR setup | Create/update/deactivate existing setup registers, subject to the existing `hr_settings.manage` permission. |
| Office operations | Create/update existing registers, subject to `hrms.manage`. |
| Order documents | Customer payment proof and assigned-rider documents; blobs and metadata survive reload. Maximum complete offline upload is 5 MiB. Larger files retain the existing online upload flow. |
| Cached reads | Downloaded catalogs/site content, cart/wishlist, HR dashboard/attendance/settings/shifts/leave/setup/office, sanitized staff directory, branch/catalog/inventory lists, customer and rider orders, document metadata, rider requirements, sidebar configuration. Exact query variants must have been downloaded. |
| Operations requiring internet | Sign-in/password changes, checkout, order placement, payments, stock/catalog administration, prescription workflows, purchase/financial/payroll records, attendance punches/GPS, leave decisions, messages, integration configuration, other unsupported mutations and progress-based uploads. Their existing online paths are unchanged. |

Cache policies are explicit allowlists in `frontend/lib/offline/policy.ts`, mirrored by the server mutation policy. Credentials, password fields, integration keys, employee HR profiles and live rider/check-in coordinates are removed from persisted read data. API responses, hubs and private file endpoints are never stored in service-worker CacheStorage, except unauthenticated image responses from the public `/api/site/media/{id}` endpoint. This separate cache holds at most 300 images, retries the network first, and removes cached images when the server returns 403 or 404. Private images, videos and third-party map tiles are not cached.

## Data and synchronization

IndexedDB `anhh-offline-v1` contains `cache`, `records`, `queue`, `mappings` and `meta`. Records retain local UUID, eventual server ID, local/server timestamps, pending/deleted state and local response. Queue rows retain operation UUID, method/path/payload (including blobs), dependency, baseline version, sequence, retry count, last error and retry time. No passwords or copies of bearer tokens are stored in this database.

Every supported mutation first commits its operation and optimistic local record in one strict IndexedDB transaction. Reads merge pending records/tombstones over server snapshots. UUID mappings rewrite dependent URLs and carry the confirmed server version into subsequent operations. Confirmed operations are removed only after the local mapping/cache update commits. Failed or conflicting edits and their files remain saved. Choosing the server version retains a discarded draft for backup export.

Automatic synchronization runs on startup, online events, focus, visible-tab changes, 15-second recovery/retry checks and service-worker messages; Sync Now is a backup. BroadcastChannel refreshes other tabs. Web Locks prevent simultaneous writers/replayers across tabs; transactional expiring leases support browsers without Web Locks. Leases are checked before committing queue work after a delayed response. Dependencies preserve order for each record while independent failures can proceed. At most 50 attempted operations run per pass, with exponential backoff up to five minutes plus jitter. Failed dependencies do not starve later independent work.

The queue reuses existing controller endpoints rather than a duplicate business layer or generic batch endpoint. Heterogeneous JSON and multipart operations have individual transaction/permission boundaries, independent retries and dependent versions; bounded passes avoid unbounded batches. Native controller validation and business rules remain authoritative.

## Server/database changes

* Additive MySQL table `offline_sync_receipts`, with unique `(Owner, OperationId)`, request fingerprint, original status/body and creation timestamp. This is a middleware-owned raw SQL ledger, so the domain EF model and its snapshot are unchanged.
* Migration `20261007000000_OfflineSyncReceipts` or the equivalent additive installer `docs/offline-sync.sql`. The SQL was applied to this local database; existing tables/data were retained. It is safe for a later normal migration to create the already-existing table.
* `GET /api/offline/capabilities`: advertises protocol version, table readiness and upload limit. Older backends keep ordinary online behavior; offline writes activate only after a successful capability check.
* `X-Offline-Operation`: UUID attached only to explicitly supported writes. `X-Offline-Base-Version`: the downloaded cart hash or row `updatedAt` for guarded edits. Successful receipt replays return `X-Offline-Replayed: true`.
* The middleware rechecks active actors, current roles/permissions and document ownership/assignment, fingerprints method/path/payload (multipart boundaries excluded), serializes duplicate operations using a MySQL named lock and runs the existing controller plus receipt in one database transaction. Receipt insertion and business changes commit together. A response lost after commit can be safely replayed. A UUID reused with different content is rejected.
* Row locks and downloaded versions reject stale HR updates/deletions and stale cart changes with 409; missing baselines return 428. Changed cart stock is flagged rather than silently limiting a replayed quantity. Wishlist commands and new document uploads use their native semantics. Creation uniqueness/validation errors remain available for review.
* Cart responses add optional `syncVersion`; leave responses add optional `updatedAt`. Existing clients can ignore these fields.
* Ordinary EF request retry behavior is retained. Only replay requests disable automatic EF retries because MVC invocation must not be replayed inside a database execution strategy.

Keep the receipt ledger in database backups. Do not purge UUID receipts while an old client can retry them; deleting receipts could remove duplicate protection. Receipt rows intentionally have no automatic expiry.

## Deployment and manual testing

1. Deploy/restart the updated backend and apply the additive receipt migration/SQL on each target database. Verify `/api/offline/capabilities` returns `offlineWritesEnabled: true`.
2. Build with `cd frontend; npm run build`, then start the normal production server. The build also generates the ignored `public/offline-assets.json` manifest for shared dynamic chunks, CSS and fonts. Docker already copies the generated public assets. Publish with HTTPS (localhost is supported).
3. Open each required page online once; let the service worker finish installing and downloading shared assets. Normal `next dev` deliberately does not register a service worker; set `NEXT_PUBLIC_OFFLINE_DEV=1` only for an isolated development test, and generate the asset manifest from a production build if testing its shell cache.
4. Sign in, open HRMS ? HR setup ? Departments and download the list. In browser DevTools ? Network, choose Offline (do not enable Application ? Service Workers ? Bypass for network).
5. Create five entries, edit/deactivate a supported entry, refresh and close/reopen the browser. Rows and pending count should remain. Restore Online without clicking Sync Now: all five should appear once on the server and confirmed queue rows should disappear.
6. For delete, use an authorized manager's leave management UI. For documents, use an existing unpaid customer's order or assigned rider order. Queue a file below 5 MiB, reload, inspect/download the local proof and reconnect.
7. Interrupt a request after server commit, retry it with the same operation UUID, and verify a single row. Change a cached row from another device before replay: Sync Failed should expose the retained local draft and Compare server version. Retry explicitly after comparison or use the server version; export local backup when needed.
8. Try first-time login offline, an expired session, an unsupported financial action and a file over 5 MiB: each should explain that internet is needed, without pretending a local save succeeded.

Automated browser tests (install Playwright separately for test tooling, or point `PLAYWRIGHT_MODULE_PATH` at its module):

```
node frontend/scripts/verify-offline-browser.mjs
# With the production frontend running at 127.0.0.1:3017:
node frontend/scripts/verify-offline-pwa.mjs
```

Set `OFFLINE_TEST_DISABLE_WEB_LOCKS=1` to exercise the transactional lease fallback (also verified). Set `CHROME_PATH` for a different Chrome installation, `OFFLINE_TEST_URL` for another local production URL, and `OFFLINE_TEST_PROFILE` for a dedicated disposable test profile. The durability test bundles the real TypeScript offline engine and runs it against an explicit in-memory API fixture in a real browser with native IndexedDB; it does not test a fake storage implementation. The PWA test uses real production pages/service worker and explicit API fixtures, including the existing staff form. Site configuration is explicitly mocked too, so these browser scenarios can run independently of backend availability. Its catalog screenshot is saved under `.tmp-offline-audit/offline-products.png`. Real API/MySQL checks separately used unique temporary department records and cleaned their rows, activity logs and receipts afterward; diagnostic tokens were restricted to an isolated backend signing key/port.

## Verification performed

* Browser durability: online confirmation; five offline UUID creates; offline cached reads; refresh; browser close/reopen; reconnect; dependent create?update?delete; simulated disconnect after commit; two retries without duplication; partial rejection plus an independent success; server conflict without overwrite; server choice preserving draft; offline blob read/upload; oversized upload; first login online-only; account partition isolation; expired session.
* Actual production PWA: service-worker registration and shared/visited asset cache; offline full document reload with catalog visible and Offline header; no API response in CacheStorage; useful unvisited-page fallback; online recovery; existing staff form creating five offline rows, refresh and automatic reconnect sync exactly once.
* Real MySQL/API: concurrent duplicate create with one server ID, repeated replay, UUID fingerprint mismatch rejection, successful guarded update, stale version conflict, missing-version rejection and no receipt on validation failure. Real cart checks confirmed hashed baselines, duplicate additions applied once, stale-cart and changed-stock rejection, quantity update and deletion using an isolated temporary customer; the fixture and receipts were removed.
* Frontend production build and TypeScript compilation passed; ESLint error check passed. Backend build passed with zero warnings/errors. Final source checks passed again after the changes. A local Docker rebuild was attempted, but Docker lost its connection when C: reached 0 bytes free. The running containers could not be updated/recovered while the drive remained full. The additive receipt SQL had already been applied and test fixtures cleaned before that infrastructure failure. After freeing several GB on C: and restoring Docker, run `docker compose up -d --build --no-deps backend frontend` and verify capabilities/health before using offline writes. Automatic approval review rejected deletion of the npm cache directory with only ?blocked by policy?; that directory was left in place.

## Practical limits

### Local verification follow-up (7 October 2026)

Docker is running again and all five application services report healthy. Both the backend at `http://localhost:5000` and the frontend proxy at `http://localhost:3001` return `offlineWritesEnabled: true`. The browser durability suite passed again, and the production PWA suite passed against port 3001, including five offline staff-form entries surviving a full reload and automatically synchronizing once after reconnecting. The PWA test now dismisses the list with Escape and reports the failing page and cache counts when a scenario fails. C: still has only approximately 290 MB free; the earlier disk-space incident remains relevant for future rebuilds.

* First visit/sign-in and downloading a new page/query require internet. Offline mode uses last downloaded data; stock and financial figures are snapshots, not a stock reservation or payment confirmation.
* Existing unexpired sessions can work offline; expired sessions require online reauthentication. Server revocations/role changes cannot be discovered offline and are enforced when reconnecting. Data is partitioned by account, role, permissions, branch and customer account type. Signing out removes private fetched caches while retaining pending drafts; a changed authorization partition is not automatically granted access to earlier, more privileged drafts.
* Background Sync wakes open windows where supported. Closing every window does not replay authenticated writes in a worker because tokens are not copied to worker storage; synchronization resumes automatically at next opening.
* IndexedDB survives normal refresh/tab closure/restarts. Clearing site data, private browsing shutdown, browser eviction or device failure can remove browser storage. Use Export local backup for valuable unsynced drafts. Quota failures report that a change was not saved; no success is claimed.
* Document database rows and replay receipts are atomic. The existing filesystem file-storage service is not transactional: a server crash/rollback after creating a file can leave an unreferenced file on disk. It cannot create a duplicate committed document row through replay, but orphan-file cleanup remains an operational concern.
* Account data in IndexedDB relies on the existing browser/authentication boundary; this feature adds no second password store, no background token store and no new authentication scheme. Backups intentionally contain the user's business drafts/files and should be handled as their own documents.

## Every source/artifact file changed for this offline task

This inventory excludes prior stock/HRMS/map changes and generated build/test output.

- `.gitignore`
- `backend/Program.cs`
- `backend/Contracts/PhaseTwoContracts.cs`
- `backend/Contracts/HrmsContracts.cs`
- `backend/Controllers/CartController.cs`
- `backend/Controllers/HrmsController.cs`
- `backend/Controllers/OfflineController.cs`
- `backend/Middleware/OfflineSyncMiddleware.cs`
- `backend/Services/OfflineSyncPolicy.cs`
- `backend/Migrations/20261007000000_OfflineSyncReceipts.cs`
- `frontend/package.json`
- `frontend/next.config.ts`
- `frontend/app/layout.tsx`
- `frontend/app/manifest.ts`
- `frontend/app/attendance/page.tsx`
- `frontend/app/leave/page.tsx`
- `frontend/app/orders/[id]/page.tsx`
- `frontend/app/delivery/orders/[id]/page.tsx`
- `frontend/components/site-header.tsx`
- `frontend/components/admin-shell.tsx`
- `frontend/components/staff-shell.tsx`
- `frontend/components/shop-provider.tsx`
- `frontend/components/hrms-admin-page.tsx`
- `frontend/components/hrms-setup-page.tsx`
- `frontend/components/hrms-office-operations.tsx`
- `frontend/components/hrms-workforce-operations.tsx`
- `frontend/components/offline-runtime.tsx`
- `frontend/components/offline-status.tsx`
- `frontend/lib/offline/db.ts`
- `frontend/lib/offline/policy.ts`
- `frontend/lib/offline/engine.ts`
- `frontend/lib/offline/hooks.ts`
- `frontend/services/api.ts`
- `frontend/public/sw.js`
- `frontend/public/offline.html`
- `frontend/public/pwa-icon-192.png`
- `frontend/public/pwa-icon-512.png`
- `frontend/scripts/generate-offline-assets.mjs`
- `frontend/scripts/verify-offline-browser.mjs`
- `frontend/scripts/verify-offline-pwa.mjs`
- `docs/offline-sync.sql`
- `docs/offline-first.md`
