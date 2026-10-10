# Transparent image support audit

Date: 10 October 2026

## Behavior

Uploads preserve original file bytes. Transparent PNG and WebP retain both fully
transparent and partially transparent pixels; JPEG remains an ordinary opaque
image. No background removal, white flattening, JPEG conversion, compression or
resizing runs during upload. Existing paths, media references, permissions and
business database records remain unchanged.

Checkerboards are CSS backgrounds in upload previews only. They are never written
into stored image files. Product images and logos use `object-contain`; fixed
banner/article/popup layouts retain their intentional cropping.

## Upload inventory

All production source under `frontend/app`, `frontend/components`, `frontend/lib`,
`frontend/services`, `backend/Controllers` and `backend/Services` was searched for
file inputs, MIME filters, drag/drop handlers, FormData, image transformations and
storage writes. Generated builds, dependency directories and old verification
snapshots are outside this inventory.

| Upload destination | Frontend source and routes | Backend path |
| --- | --- | --- |
| Product / medicine packshots and galleries, up to five images | `admin-products-page.tsx`; Admin/SuperAdmin `/products/create` and `/products/{id}/edit` | Admin/SuperAdmin `/media`, followed by the existing product save |
| Bulk product images, separate files and image ZIP | `admin-product-import.tsx`; Admin/SuperAdmin `/catalog/import` | `/products/import/preview`, `/products/import/commit`; legacy `/products/import` also calls the same media storage |
| Desktop hero image and video poster/fallback | `admin-hero-slides-page.tsx`; Admin/SuperAdmin `/website/hero-slides`; SuperAdmin `/website/slides` aliases | Admin/SuperAdmin `/media`, then hero slide save |
| Mobile hero image | Same hero editor and aliases | Same media storage and slide relationship |
| Health article featured image / thumbnail | `admin-health-articles-page.tsx`; Admin/SuperAdmin `/articles/create` and edit | Admin/SuperAdmin `/media`, then article save |
| Popup / promotional image | `PopupManager` in `admin-website-control.tsx`; `/superadmin/popups` | SuperAdmin `/media`, then popup save |
| Media library: general, logo, hero, banner, product, category, article assets | `MediaManager` in `admin-website-control.tsx`; `/superadmin/media` | SuperAdmin `/media` |
| Website logo | `/superadmin/website/design/page.tsx`, Website logo tab | SuperAdmin `/media` with LOGO kind, then existing `website.logoUrl` setting |
| Website assets: campaign/banner/promotional graphics | `/superadmin/website/page.tsx`, Asset image | SuperAdmin `/media`, then existing website asset save |
| Three homepage trust illustrations | Same website page: Clear product information, How verification works, Delivering across Nepal | SuperAdmin `/media` with TRUST_BADGE kind; existing section JSON references |
| Payment QR image | `admin-payment-methods-page.tsx`; `/superadmin/payment-methods` | SuperAdmin `/media` with PAYMENT_QR kind, then payment method save |
| Staff photos, including HRMS staff roles | `admin-staff-page.tsx`; SuperAdmin staff edit | SuperAdmin `/staff/{id}/photo` |
| Delivery and Pharmacist personal photo | `staff-profile.tsx`; `/delivery/profile`, `/pharmacist/profile` | `/staff-profile/photo` |
| Prescription image and clarification replacement | `/prescription/page.tsx` | `/prescriptions`, `/prescriptions/{id}/clarification-upload` |
| Customer payment proof | `/orders/{id}/page.tsx` | `/orders/{id}/documents` |
| Delivery invoice, cheque, payment proof, delivery proof | `/delivery/orders/{id}/page.tsx`, completion panel after arrival | `/delivery/orders/{id}/documents` |
| Private message image attachments | `messaging-center.tsx`; `/messages`, available staff/customer accounts | `/messaging/conversations/{id}/attachments` |
| Sales Executive receipt image | `field-sales-workspace.tsx`; `/sales-executive/collections/create` | `/field-sales/proof`; retrieval remains restricted to an accessible collection record |

The Admin staff editor previously exposed a photo selector whose upload endpoint
requires SuperAdmin. That selector is now shown only to SuperAdmin, matching the
existing backend permission. This change grants no additional upload access.

No independent customer-avatar uploader, Supervisor personal-photo uploader,
branch-logo uploader, supplier-photo uploader, favicon uploader, or taxonomy
brand/category-image field exists in the inspected UI. HRMS staff identity photos
are managed by the existing SuperAdmin staff editor. Flash-sale/coupon setup has
no independent image file selector; promotional website assets use the shared
media path above. The favicon is the existing static `icon.svg`. These are not
claimed as newly implemented upload features.

## Changes

- Improved `UniversalImageUploader` and integrated it into the remaining image
  selectors. It supports click selection, drag/drop, CSS checkerboards, original
  image previews, replacement/removal where allowed, multiple previews, maximum
  gallery count, MIME/extension and size checks, decoded dimensions, useful
  errors, format transparency guidance, and upload state/progress.
- Ordinary media has an 8 MB limit. Prescription/document/message destinations
  retain their existing 10 MB limit and permitted non-image document types.
  Percentages are shown only when the caller supplies real progress; other
  uploads show an indeterminate uploading state.
- Fixed media-library and messaging remounts that discarded selected previews.
  Prescription removal uses the shared control so selection and preview clear
  together. Product galleries own their actual selected-image previews and remove/reorder
  controls, avoiding a stale duplicate preview in the add-image picker.
- Protected staff-photo previews fetch their existing bearer-protected endpoints
  into temporary object URLs. Credentials are attached only to the two explicitly
  recognized staff-photo route patterns. Preview URLs are revoked on cleanup.
- Removed automatic edge-connected background removal from product uploads.
  `prepareProductImageForUpload` is retained as a byte-preserving compatibility
  function. `uploadAdminMedia` sends the original File.
- Removed product image `mix-blend-multiply`, which changed displayed colours.
  Product galleries/cards retain `object-contain`; media-library previews now
  also show the complete asset.
- Added `ImageContentValidation` with SkiaSharp 3.119.4 and its Linux native
  package. PNG, WebP, JPEG, GIF and BMP get decoder validation and a limit of
  16,384 pixels per side / 40 megapixels. The original bytes are stored after
  validation, not re-encoded.
- Applied validation to media, prescriptions, order documents and message image
  attachments. Existing MIME/signature checks, safe generated filenames, hashes,
  authorization, storage roots and URL conventions remain in place.
- AVIF keeps its existing signature validation and byte-preserving storage;
  the selected native codec does not decode AVIF. SVG remains restricted to logo
  media and keeps the existing SVG checks. Neither is claimed as decoder-tested.
- Added the Suspense boundary required by existing query-dependent workspace
  pages so the production frontend build can complete.

## Validation

Reproducible checks:

```powershell
dotnet build backend/backend.csproj --no-restore -o .tmp-transparency-build
dotnet run --project tools/image-transparency-check -- .tmp-transparency-fixtures
cd frontend
npm run build
node scripts/verify-image-transparency.mjs
```

The HTTP/browser suite requires the local MySQL Docker container and Chrome/
Playwright. It clones **schema only** into a uniquely named temporary database,
creates test accounts there, runs the actual backend on port 5028 and production
frontend on port 3037, then drops only its own test database and stops its servers.
It does not seed or migrate the business database. Fixtures and diagnostic output
are under ignored `.tmp-transparency-fixtures` directories.

Storage results: **passed on Windows and Linux Docker**. All four storage services
were tested with transparent PNG, transparent WebP and JPEG. Checks compare exact
bytes and SHA-256, alpha 0 and alpha 128, original dimensions, unique replacement
filenames, retention of the original, invalid content, extension/MIME mismatch,
unsupported files, oversized files and unsafe retrieval paths. A valid PNG with
width 20,000 pixels is rejected.

HTTP results: **passed for PNG, WebP and JPEG** through actual Admin/SuperAdmin
media, SuperAdmin staff photo, Delivery/Pharmacist/Supervisor authenticated photo,
prescription and clarification replacement, customer payment proof, delivery
proof, message attachment and Sales Executive receipt endpoints. Every downloaded
file was byte-identical to its upload. Unauthenticated media upload and invalid
image content are rejected.

Bulk-import HTTP results: **passed** for both separate-file and ZIP imports.
Each creates a product with PNG/WebP/JPEG gallery entries in the isolated test
database; every stored gallery URL retrieves the exact original bytes.

Browser results: **all 26 cases verified across the full run and focused rerun**.
The full run passed 25 cases, including drag/drop, a 393px viewport with dark
colour-scheme preference, multiple-file import previews, replacement, permitted
removal, invalid format and oversized-file errors. Delivery PNG/WebP/JPEG previews
passed in that run, but its invalid-file check ran during automatic upload. After
the test was changed to wait for the enabled picker, the focused delivery rerun
passed all checks (exit 0). No production code change was needed for that timing
issue. Results are retained separately in `browser-test-result.json` and
`browser-extra-test-result.json`; the initial failed run is not rewritten.

Run a focused case with, for example:

```powershell
$env:IMAGE_TEST_BROWSER_LABELS = 'Delivery proof'
node frontend/scripts/verify-image-transparency.mjs
Remove-Item Env:IMAGE_TEST_BROWSER_LABELS
```

The browser run also recorded React #418 hydration warnings on the customer
prescription and order pages. Those warnings are preserved in the result JSON
and excluded from image-specific assertions; this report does not claim a
warning-free browser run or that those separate hydration issues were repaired.

The final production frontend build passed (202 static pages and 141 shared
offline assets), as did backend compilation with zero warnings/errors. Targeted
frontend lint passed with zero errors; the broader changed-file check reported
seven warnings (six direct-image advisories and one existing unused import).
The final prescription-page and test-script lint check passed without warnings.

There is no generated thumbnail or resize pipeline in the inspected project.
Article thumbnails, product thumbnails, hero variants and table previews use
the original stored image with CSS sizing. Therefore no generated derivative can
lose alpha in the current upload pipeline; resized-file generation is not claimed
as a tested feature. Previously flattened files are not retroactively repaired,
and existing files are not bulk-converted.
