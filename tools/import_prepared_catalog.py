from __future__ import annotations

import csv
import json
import mimetypes
import uuid
import urllib.error
import urllib.request
from pathlib import Path


API_ROOT = "http://localhost:5000"
OUTPUT_DIR = Path(r"C:\Users\LENOVO\Downloads\all-nepal-healthy-home-product-images-2026-09-16")
CSV_FILES = [
    OUTPUT_DIR / "bulk_upload_products_with_source_links_updated.csv",
    OUTPUT_DIR / "toran_tradelink_personal_care_products_updated.csv",
]
ZIP_FILE = OUTPUT_DIR / "product_images.zip"
IMPORT_CSV = OUTPUT_DIR / "catalog_import_ready.csv"


def json_request(url: str, method: str = "GET", payload: dict | None = None, token: str | None = None):
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail)
        except ValueError:
            pass
        return exc.code, detail


def multipart_request(url: str, fields: dict[str, str], files: dict[str, tuple[str, str, bytes]], token: str):
    boundary = f"----AllNepalHealthyHome{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
            value.encode("utf-8"),
            b"\r\n",
        ])
    for key, (filename, content_type, data) in files.items():
        chunks.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode(),
            f"Content-Type: {content_type}\r\n\r\n".encode(),
            data,
            b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode())
    request = urllib.request.Request(
        url,
        data=b"".join(chunks),
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail)
        except ValueError:
            pass
        return exc.code, detail


def main():
    for path in [*CSV_FILES, ZIP_FILE]:
        if not path.exists():
            raise SystemExit(f"Missing prepared catalog file: {path}")

    status, auth = json_request(
        f"{API_ROOT}/api/auth/staff-login",
        method="POST",
        payload={"emailOrPhone": "superadmin@example.com", "password": "SuperAdmin!123"},
    )
    if status != 200 or not isinstance(auth, dict) or not auth.get("accessToken"):
        raise SystemExit(f"SuperAdmin login failed ({status}): {auth}")
    token = auth["accessToken"]

    status, branches = json_request(f"{API_ROOT}/api/superadmin/branches", token=token)
    if status != 200 or not isinstance(branches, list):
        raise SystemExit(f"Could not load branches ({status}): {branches}")
    active_branches = [branch for branch in branches if branch.get("isActive")]
    if not active_branches:
        raise SystemExit("No active branch exists for the product import.")
    branch_names = {str(branch.get("name", "")).strip().lower(): branch.get("name", "") for branch in active_branches}
    fallback_branch = active_branches[0].get("name", "") if len(active_branches) == 1 else ""

    fieldnames: list[str] = []
    rows: list[dict[str, str]] = []
    mapping_notes: list[str] = []
    for source in CSV_FILES:
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames:
                for field in reader.fieldnames:
                    if field not in fieldnames:
                        fieldnames.append(field)
            for row in reader:
                if not (row.get("image_filename_1") or "").strip():
                    continue
                original_branch = (row.get("branch_name") or "").strip()
                normalized = original_branch.lower()
                if normalized not in branch_names:
                    if not fallback_branch:
                        raise SystemExit(f"No exact active branch match for '{original_branch}' in {source.name}.")
                    row["branch_name"] = fallback_branch
                    mapping_notes.append(f"{source.name}: {original_branch} -> {fallback_branch}")
                else:
                    row["branch_name"] = branch_names[normalized]
                rows.append(row)

    if not rows:
        raise SystemExit("No rows with image_filename_1 are ready to import.")
    with IMPORT_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    files = {
        "csv": (IMPORT_CSV.name, "text/csv", IMPORT_CSV.read_bytes()),
        "imagesZip": (ZIP_FILE.name, "application/zip", ZIP_FILE.read_bytes()),
    }
    preview_status, preview = multipart_request(
        f"{API_ROOT}/api/superadmin/products/import/preview",
        {},
        files,
        token,
    )
    if preview_status != 200:
        raise SystemExit(f"Import preview failed ({preview_status}): {preview}")
    if not isinstance(preview, dict) or preview.get("validRows") != len(rows):
        raise SystemExit(f"Import preview did not validate all prepared rows: {json.dumps(preview, indent=2)}")

    commit_status, result = multipart_request(
        f"{API_ROOT}/api/superadmin/products/import/commit",
        {"replaceExisting": "false"},
        files,
        token,
    )
    if commit_status != 200:
        raise SystemExit(f"Import commit failed ({commit_status}): {result}")
    if isinstance(result, dict):
        result["branchMapping"] = mapping_notes
        result["importedRows"] = len(rows)
        result["activeBranch"] = fallback_branch
        print(json.dumps(result, indent=2))
    else:
        print(result)


if __name__ == "__main__":
    main()
