# Existing image transparency audit

Audit date: 2026-10-10. Scope: the local All Nepal Healthy Home database and runtime storage in `backend/App_Data`, plus repository-managed raster images under `frontend/public`. The runtime backend mounts `backend/App_Data`; the root `App_Data/media` folder is a mirror copy.

## Results

The database contains 73 `MediaAsset` rows. Of those, 67 active/public raster images were verified through the live `/api/site/media/{assetId}` endpoint. **48 database assets now serve genuine transparent PNGs**: 43 product image records (25 distinct source images), 4 hero image records, and 1 active logo. Each output is PNG/RGBA with transparent pixels, retains the original pixel dimensions, matches the database SHA-256 and length, and loaded at its existing stable media URL.

3 active product records (2 unique source images) already contained real alpha and were kept unchanged. 16 active database image records remain on their originals for manual review: 14 product records covering 9 source images, and 2 hero photographs. These include scene photography, non-uniform backgrounds, small pale product parts, and text/details that a cutout could weaken. There were no processing failures. A second checkerboard pass approved three additional source images for four shared records: Fixderma cleanser, Shadow SPF 50+ artwork, and DermaCo face wash. Their visible package details remain intact, and original files stay available for rollback. Four source-image candidates remain withheld across five media rows: the Dot & Key mask removed a separate 120gm callout, the Shadow SPF 30+ mask weakened promotional lettering, and the Cetirizine and Paracetamol masks made white tablets semi-transparent. Their original files remain at their existing URLs; all five withheld PNG trials remain on disk.

The remaining database rows are 4 inactive/private media records preserved as-is and 2 video uploads, which are not raster images. Six loose image files have no current `MediaAsset` row or live media URL; the CSV identifies their duplicate, already-transparent, or manual-review status. The root `App_Data/media` copy contains 58 image files, each byte-identical to a runtime counterpart. The six repository-managed UI PNGs also already contain real alpha and were unchanged.

Two uploaded prescription document images were left untouched to preserve document text. `order-documents` is empty and there are no active field-sales collection proof uploads. Database tables for brands/categories and flash-sale records have no uploaded image path requiring conversion; the website logo and hero images are stored as `MediaAsset` records.

## References and storefront verification

No product, gallery, hero, or logo URL was rewritten: existing GUID-based `/api/site/media/{assetId}` paths remain stable. The website setting still points to the same active logo ID. The Admin media row factory returns the same GUID-based URL, so Admin/SuperAdmin consumers continue to resolve the updated `MediaAsset` record through the same endpoint. I verified the existing Ekran product and site logo, then checked the Fixderma and DermaCo product pages in the running storefront; each image loaded at native dimensions over a checkerboard. The Dot & Key product is inactive, so it has no customer product page; its retained media URLs still passed the live endpoint checks. The Admin/SuperAdmin browser UI was not opened with an authenticated staff session. For alpha inspection, the storefront screenshots temporarily neutralized the page's existing multiply blend on the displayed image.

- [Live storefront product image over checkerboard](existing-image-transparency-product-checkerboard.png)
- [Live storefront logo over checkerboard](existing-image-transparency-logo-checkerboard.png)
- [Follow-up Fixderma storefront check](existing-image-transparency-followup-fixderma.png)
- [Follow-up DermaCo storefront check](existing-image-transparency-followup-dermaco.png)
- [Per-asset database and file report](existing-image-transparency-audit.csv)
- Existing future-upload PNG/WebP behavior: [transparent-image-support.md](transparent-image-support.md)

## Rollback and verification

All 53 source asset files addressed by the conversion plan remain in `backend/App_Data/media` with their pre-conversion lengths and SHA-256 hashes verified. The five unused cutout candidates were retained for review and rollback. Full SQL snapshots were saved before the initial and follow-up batches: `anhh-before-image-transparency-20261010-104241-e36dabca.sql` (7,441,703 bytes; SHA-256 `c189975bcb8abe88c30b039a34d921cac3cb5f5708a8f15b3c2e7f7d5b23fe92`) and `anhh-before-existing-image-followup-20261010.sql` (7,427,384 bytes; SHA-256 `09b6c75c56a61907101136c852fe4fabd74a59f0437fb400643b95e8572e5bb2`). A guarded metadata-only rollback script for the 48 currently converted database records is at `backend/App_Data/backups/existing-image-transparency/rollback-deployed-media-assets.sql`.

Checks passed: all 73 database file references exist and match stored lengths/hashes; all 67 active public image assets return the exact stored bytes and MIME type; every converted image is a same-size PNG with real alpha; all source backups match their original hashes; all 58 mirror files match corresponding runtime copies; and the live product/logo routes load in the website. This report does not claim every existing image is transparent: the manual-review and document items above remain intentionally unchanged.
