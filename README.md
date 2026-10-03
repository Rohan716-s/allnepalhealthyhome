# All Nepal Healthy Home Pvt. Ltd.

Nepal-focused online pharmacy and healthcare e-commerce platform. The repository contains a polished local-first commerce experience in Next.js, an ASP.NET Core API foundation, and local infrastructure configuration for MySQL, Redis, and Meilisearch.

## Project structure

- `frontend/` — Next.js, TypeScript, Tailwind CSS, and shadcn/ui foundation.
- `backend/` — ASP.NET Core Web API, EF Core, MySQL provider, Swagger, health checks, and error handling.
- `infrastructure/` — reserved for future deployment scripts and infrastructure notes.
- `docs/` — project documentation.
- `docker-compose.yml` — local MySQL, Redis, and Meilisearch services.

## Required software

- Node.js 22 or newer and npm
- .NET SDK 10
- Docker Desktop (required for MySQL, Redis, and Meilisearch)
- Git

## First-time setup (Windows PowerShell)

From this folder:

```powershell
Copy-Item .env.example .env
cd frontend
Copy-Item ..\.env.example .env.local
npm install
cd ..
```

The example values are for local development only. Never commit real secrets.

Before running EF migrations or the backend, provide the database connection through the process environment. For the local example values:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=localhost;Port=3306;Database=allnepalhealthy;User=appuser;Password=change_me;"
```

For a real environment, replace `change_me` with a secret that is kept outside source control.

## Start local services

Start Docker Desktop, then run:

```powershell
docker compose up -d
docker compose ps
```

This starts MySQL on `localhost:3306`, Redis on `localhost:6379`, and Meilisearch on `localhost:7700`, with persistent named volumes.

## Run the backend

In a PowerShell window:

```powershell
cd backend
dotnet restore
dotnet ef database update
dotnet run --urls http://localhost:5000
```

- API: <http://localhost:5000>
- Swagger UI: <http://localhost:5000/swagger>
- Health: <http://localhost:5000/api/health>
- Database health: <http://localhost:5000/api/health/database>
- Version: <http://localhost:5000/api/version>

## Run the frontend

In another PowerShell window:

```powershell
cd frontend
npm run dev
```

Open <http://localhost:3000>. The page calls the backend health endpoint and reports the real connection state.

For a production build, the frontend uses Next's standalone server so direct routes remain route-aware after a browser refresh. From `frontend`, run `npm run build`, set `PORT=3000`, and run `npm start`. The start helper copies the required `public` and `.next/static` assets into the standalone runtime before launching it. Do not serve the generated files through a generic static fallback server; that would replace routes such as `/products`, `/cart`, or `/admin` with the homepage.

## Stop everything

Stop the frontend and backend with `Ctrl+C`. Stop Docker services with:

```powershell
docker compose down
```

The named volumes are retained. To remove local service data intentionally, use `docker compose down -v`.

## Common errors

- `docker is not recognized`: install and start Docker Desktop.
- MySQL connection refused: wait for `docker compose ps` to show MySQL as healthy, then rerun `dotnet ef database update`.
- Migration command unavailable: run `dotnet tool install --global dotnet-ef --version 9.0.0`, reopen PowerShell, and retry.
- Frontend says API unavailable: confirm the backend is running on port 5000 and that `frontend/.env.local` contains `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000`.
- Port already in use: stop the process using the port or change the port in `.env` and the corresponding run command.

## Current product experience

The frontend includes the branded All Nepal Healthy Home storefront, live database-backed catalogue search/filter/sort, category and brand browsing, live product details, cart and wishlist persistence, checkout, order history/detail views, prescription request submission/history, account views, and operations dashboards. Cart and guest wishlist data persist in browser localStorage; authenticated orders, prescriptions, and wishlist entries are loaded from the API.

The ASP.NET Core service includes customer registration/login with PBKDF2 password hashing and signed bearer tokens, catalog/category/brand endpoints, prescription upload and protected file access, OCR provider abstraction, structured extraction, configurable medicine matching with confidence and stock availability, correction/add/remove item endpoints, pharmacist-submission status, notifications, and EF Core persistence for cart, order, pharmacist, delivery, and admin operations. The original `system_checks` table remains intact.

Admin and SuperAdmin reports are generated from the live database and support CSV or text-based PDF export with date, branch, product, category, brand, status, payment method, and staff filters.

## First-phase API and prescription workflow

After MySQL is running, apply the migration and seed the development catalog:

```powershell
cd backend
dotnet ef database update
$env:Database__SeedOnStart = "true"
dotnet run --urls http://localhost:5000
```

Customer API endpoints include:

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/products`, `GET /api/products/{slugOrId}`
- `GET /api/catalog/categories`, `GET /api/catalog/brands`
- `POST /api/prescriptions` (authenticated multipart upload)
- `GET /api/prescriptions`, `GET /api/prescriptions/{id}`, `GET /api/prescriptions/{id}/file`
- `POST /api/prescriptions/{id}/scan`
- `POST/PUT/DELETE /api/prescriptions/{id}/items[/{itemId}]`
- `POST /api/prescriptions/{id}/submit`

Prescription files are stored under `App_Data/prescriptions` by default, outside the public static directory. Uploads are limited to 10 MB and validated by extension, MIME type, and file signature. OCR uses the `IPrescriptionOcrService` abstraction and runs Tesseract only when `OCR__TESSERACTPATH` is configured; otherwise the API explicitly leaves the request available for pharmacist review without inventing OCR results. Medicine matching uses normalized names, generic names, brand context, strength comparison, fuzzy similarity, configurable confidence semantics, and actual inventory rows.

Set `AUTHENTICATION__SIGNINGKEY` to a long random secret outside development. Set `OCR__TESSERACTPATH` to a trusted Tesseract executable when image OCR is available. PDFs currently remain in the provider abstraction until a document OCR/PDF conversion provider is configured.

## Phase 2 operations panels

Phase 2 adds real, role-protected workspaces at `/pharmacist` and `/delivery`. Staff sign in at `/staff/login`. Development seed accounts are created only when `Database__SeedOnStart=true`:

- Pharmacist: `pharmacist@example.com` / `Pharmacist!123`
- Delivery staff: `delivery@example.com` / `Delivery!123`

Change or remove these development credentials before using a non-development environment.

Pharmacist APIs include `/api/auth/staff-login`, `/api/pharmacist/dashboard`, prescription queue/detail/file/review/approve/partial-approve/reject/clarification endpoints, order preparation/status and delivery assignment endpoints, inventory/low-stock/expiry queries, customer list, notifications, activity, and profile/password endpoints.

Delivery APIs include `/api/delivery/dashboard`, assigned-order list/detail, accept/pickup/start/delivered/failed transitions, history, notifications, and profile/password endpoints. Every delivery query is scoped to the logged-in delivery staff member.

Operational data is persisted in `staff_users`, `prescription_status_history`, `delivery_assignments`, `stock_transactions`, and `activity_logs`. Inventory now tracks batch number, purchase price, expiry date, minimum stock, and supplier. Customer checkout uses `POST /api/orders`, reserves non-expired stock inside a database transaction, and creates a real order/status history row. Delivery completion converts the reservation into a sale transaction; cancellation releases reservations.

Apply all migrations with `dotnet ef database update`, or use the generated [Phase 2 SQL script](docs/pharmacy-phase-two.sql). The current development limitation is external infrastructure: MySQL/Docker must be running before migrations, seeding, and end-to-end database workflow testing can execute.

## Phase 3 administration

Phase 3 adds database-backed Admin and SuperAdmin workspaces. Authorized staff sign in at `/staff/login`; Admin and Supervisor users go to `/admin`, while SuperAdmin goes to `/superadmin`.

Development-only seeded staff accounts (created when `Database__SeedOnStart=true`):

- Admin: `admin@example.com` / `Admin!123`
- Supervisor: `supervisor@example.com` / `Supervisor!123`
- SuperAdmin: `superadmin@example.com` / `SuperAdmin!123`

The local demo sign-in page at `/auth` includes all seeded accounts. The customer demo account is:

- Customer: `customer@example.com` / `Customer!123`

The customer seed is added automatically when `Database__SeedOnStart=true`. These credentials are development-only and must be changed before deployment.

SuperAdmin manages public configuration through `/superadmin/settings`, with public values available at `GET /api/site/config`. The customer header/footer consume that configuration without a frontend rebuild. The backend also exposes protected management endpoints for dashboards, products, medicines, categories, brands, manufacturers, inventory adjustments, branches, suppliers, delivery zones, staff, orders, prescriptions, website assets, CMS pages, FAQs, settings, and audit logs under `/api/admin/*` and `/api/superadmin/*`.

The SuperAdmin control center also includes live date-filtered KPIs and reporting at `/superadmin`, customer access management at `/superadmin/customers`, database-backed product and catalog-foundation management at `/superadmin/catalog`, branch, supplier and delivery-zone management at `/superadmin/branches`, validated coupon management at `/superadmin/coupons`, homepage section and hero/banner management at `/superadmin/website`, CMS pages at `/superadmin/cms`, audit review at `/superadmin/audit-logs`, and service checks at `/superadmin/system-health`. SuperAdmin-only routes are enforced server-side; Admin accounts receive `403 Forbidden` for them.

The administration surface also includes payment-method configuration and transaction/refund workflows at `/superadmin/payment-methods` and `/superadmin/payments`, prescription detail/file review and reason-required SuperAdmin overrides at `/admin/prescriptions` and `/superadmin/prescriptions`, product-review moderation at `/admin/reviews` and `/superadmin/reviews`, customer support triage at `/admin/support-tickets` and `/superadmin/support-tickets`, variable-aware notification templates at `/admin/notification-templates` and `/superadmin/notification-templates`, health-article publishing at `/admin/articles` and `/superadmin/articles`, database-backed flash-sale scheduling at `/admin/flash-sales` and `/superadmin/flash-sales`, and supplier purchase-order receiving at `/admin/purchase-orders` and `/superadmin/purchase-orders`. Reviews require a delivered purchase, support tickets are customer-owned and database-backed, flash-sale pricing is enforced by the order API with expiry and quantity checks, purchase receipts update branch inventory with stock transactions, and important changes create activity-log records.

Health content has its own publishing workflow at `/admin/articles` and `/superadmin/articles`, with draft, scheduled, published and archived states, author/category/tags, featured image, SEO metadata and a public `/articles` health library. Only published or due scheduled articles are exposed by the public API.

After pulling these changes while a backend process is already running, restart that local process so it loads the updated API build. The frontend continues to use `http://localhost:5000` by default.

All EF Core migrations are in `backend/Migrations/`; the Phase 3 management migration and the later coupon/order-column correction are included there. An idempotent SQL export is available at [docs/pharmacy-phase-three.sql](docs/pharmacy-phase-three.sql). Use `dotnet ef database update` after MySQL is available, then seed with `Database__SeedOnStart=true`. Never use the development credentials in production.
