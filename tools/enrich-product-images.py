"""Find high-confidence catalog images and attach them through the admin API.

The public catalog can contain thousands of rows, so this is intentionally a
batchable command. It never assigns an image to a malformed or low-confidence
product name. Set ANHH_ADMIN_EMAIL and ANHH_ADMIN_PASSWORD before using
--apply; use --dry-run first to inspect the matches.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class RequestError(RuntimeError):
    pass


class Response:
    def __init__(self, status_code: int, headers: dict[str, str], content: bytes):
        self.status_code, self.headers, self.content = status_code, headers, content
        self.text = content.decode("utf-8", errors="replace")

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RequestError(f"HTTP {self.status_code}: {self.text[:300]}")

    def json(self):
        return json.loads(self.text)


class SimpleSession:
    def _request(self, method: str, url: str, headers: dict[str, str] | None = None, body: bytes | None = None, timeout: int = 30) -> Response:
        request = Request(url, data=body, headers=headers or {}, method=method)
        try:
            with urlopen(request, timeout=timeout) as response:
                return Response(response.status, dict(response.headers.items()), response.read())
        except HTTPError as error:
            return Response(error.code, dict(error.headers.items()), error.read())
        except URLError as error:
            raise RequestError(str(error.reason)) from error

    @staticmethod
    def _query(url: str, params: dict | None) -> str:
        if not params:
            return url
        return f"{url}{'&' if '?' in url else '?'}{urlencode(params)}"

    def get(self, url: str, params: dict | None = None, headers: dict[str, str] | None = None, timeout: int = 30) -> Response:
        return self._request("GET", self._query(url, params), headers=headers, timeout=timeout)

    def post(self, url: str, json: dict | None = None, data: dict | None = None, files: dict | None = None, headers: dict[str, str] | None = None, timeout: int = 30) -> Response:
        request_headers = dict(headers or {})
        if json is not None:
            request_headers["Content-Type"] = "application/json"
            return self._request("POST", url, request_headers, json_module_dumps(json), timeout)
        if files is not None:
            body, content_type = multipart(data or {}, files)
            request_headers["Content-Type"] = content_type
            return self._request("POST", url, request_headers, body, timeout)
        body = urlencode(data or {}).encode()
        request_headers["Content-Type"] = "application/x-www-form-urlencoded"
        return self._request("POST", url, request_headers, body, timeout)

    def put(self, url: str, json: dict, headers: dict[str, str] | None = None, timeout: int = 30) -> Response:
        request_headers = dict(headers or {})
        request_headers["Content-Type"] = "application/json"
        return self._request("PUT", url, request_headers, json_module_dumps(json), timeout)


def json_module_dumps(value: dict) -> bytes:
    return json.dumps(value, ensure_ascii=False).encode("utf-8")


def multipart(fields: dict[str, str], files: dict) -> tuple[bytes, str]:
    boundary = f"----codex-{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks += [f"--{boundary}\r\n".encode(), f'Content-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()]
    for key, file_value in files.items():
        filename, payload, content_type = file_value
        chunks += [f"--{boundary}\r\n".encode(), f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode(), payload, b"\r\n"]
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


PLACEHOLDER = "/catalog-placeholder.svg"
STOP_WORDS = {
    "and", "baby", "care", "co", "company", "cream", "general", "home",
    "india", "ltd", "limited", "medical", "medicine", "nepal", "pharma",
    "pharmaceutical", "pharmacy", "pvt", "the", "tab", "tablet", "tablets",
}


def tokens(value: str) -> set[str]:
    return {
        token for token in re.findall(r"[a-z0-9]+", value.lower())
        if len(token) > 1 and token not in STOP_WORDS
    }


def malformed(name: str) -> bool:
    return not name.strip() or bool(re.fullmatch(r"[0-9 .%+\-]+", name.strip()))


def google_candidates(session: SimpleSession, query: str) -> list[dict]:
    """Google may require JavaScript in this environment; return only parseable results."""
    try:
        response = session.get(
            "https://www.google.com/search",
            params={"tbm": "isch", "q": query, "hl": "en", "gl": "us"},
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"},
            timeout=15,
        )
        if response.status_code != 200:
            return []
        # Google commonly serves a JavaScript challenge here. Keep this parser
        # conservative; the Bing fallback below is used when no image payload
        # is present instead of guessing from the page markup.
        found = re.findall(r'"(https?://[^" ]+?\.(?:jpg|jpeg|png|webp)(?:\?[^" ]*)?)"', response.text, re.I)
        return [{"murl": url.replace(r"\u003d", "=").replace(r"\u0026", "&"), "purl": "https://www.google.com/search", "t": query} for url in found[:10]]
    except RequestError:
        return []


def bing_candidates(session: SimpleSession, query: str) -> list[dict]:
    response = session.get(
        "https://www.bing.com/images/search",
        params={"q": query, "form": "HDRSC2", "setlang": "en", "cc": "us"},
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"},
        timeout=20,
    )
    response.raise_for_status()
    candidates: list[dict] = []
    for match in re.finditer(r'm="([^"]+)"', response.text):
        try:
            payload = json.loads(html.unescape(match.group(1)))
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and payload.get("murl"):
            candidates.append(payload)
    return candidates


def choose_candidate(candidates: list[dict], name: str, brand: str) -> dict | None:
    wanted = tokens(f"{name} {brand}")
    brand_tokens = tokens(brand)
    if not wanted:
        return None
    ranked: list[tuple[int, dict]] = []
    for candidate in candidates:
        haystack = f"{candidate.get('t', '')} {candidate.get('desc', '')} {candidate.get('purl', '')} {candidate.get('murl', '')}".lower()
        matched = wanted & tokens(haystack)
        brand_match = len(brand_tokens & tokens(haystack))
        score = len(matched) * 2 + brand_match * 4
        if brand_tokens and brand_match == 0:
            continue
        if len(matched) < (2 if len(wanted) > 2 else 1):
            continue
        ranked.append((score, candidate))
    return max(ranked, key=lambda item: item[0])[1] if ranked else None


def download_image(session: SimpleSession, url: str) -> tuple[bytes, str] | None:
    try:
        response = session.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}, timeout=25)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
        ext_by_type = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/bmp": ".bmp", "image/avif": ".avif"}
        extension = ext_by_type.get(content_type)
        if not extension or not response.content or len(response.content) > 8 * 1024 * 1024:
            return None
        return response.content, extension
    except RequestError:
        return None


def login(session: SimpleSession, base_url: str, email: str, password: str) -> str:
    response = session.post(f"{base_url}/api/auth/staff-login", json={"emailOrPhone": email, "password": password}, timeout=20)
    response.raise_for_status()
    token = response.json().get("accessToken")
    if not token:
        raise RuntimeError("Staff login returned no access token.")
    return token


def public_products(session: SimpleSession, base_url: str) -> list[dict]:
    first = session.get(f"{base_url}/api/products", params={"page": 1, "pageSize": 100}, timeout=30)
    first.raise_for_status()
    payload = first.json()
    products = list(payload.get("items", []))
    for page in range(2, int(payload.get("totalPages", 1)) + 1):
        response = session.get(f"{base_url}/api/products", params={"page": page, "pageSize": 100}, timeout=30)
        response.raise_for_status()
        products.extend(response.json().get("items", []))
    return products


def upload(session: SimpleSession, base_url: str, token: str, data: bytes, extension: str, alt_text: str) -> str:
    content_type = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp", ".avif": "image/avif"}[extension]
    response = session.post(
        f"{base_url}/api/superadmin/media",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": (f"catalog-{abs(hash(alt_text))}{extension}", data, content_type)},
        data={"kind": "PRODUCT", "altText": alt_text, "isPublic": "true"},
        timeout=45,
    )
    response.raise_for_status()
    return response.json()["url"]


def attach(session: SimpleSession, base_url: str, token: str, product: dict, managed_url: str, source_url: str, page_url: str) -> None:
    response = session.put(
        f"{base_url}/api/superadmin/products/{product['id']}/image",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "imageUrl": managed_url,
            "imageUrls": [managed_url],
            "imageSourceUrl": source_url,
            "imageVerificationStatus": "UNVERIFIED",
            "imageSourceReference": f"Image-search match: {page_url or 'Google/Bing Images'}",
        },
        timeout=30,
    )
    response.raise_for_status()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:5000")
    parser.add_argument("--limit", type=int, default=25, help="Maximum products to inspect in this batch")
    parser.add_argument("--apply", action="store_true", help="Upload and attach images; otherwise only report matches")
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--report", default="tools/product-image-enrichment.jsonl")
    args = parser.parse_args()
    email = os.environ.get("ANHH_ADMIN_EMAIL")
    password = os.environ.get("ANHH_ADMIN_PASSWORD")
    if args.apply and (not email or not password):
        raise SystemExit("Set ANHH_ADMIN_EMAIL and ANHH_ADMIN_PASSWORD before using --apply.")

    session = SimpleSession()
    token = login(session, args.base_url, email, password) if args.apply else ""
    products = [p for p in public_products(session, args.base_url) if p.get("imageUrl") in (None, "", PLACEHOLDER)]
    products = products[: max(0, args.limit)]
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("a", encoding="utf-8") as report:
        for index, product in enumerate(products, 1):
            name, brand = str(product.get("name", "")).strip(), str(product.get("brand", "")).strip()
            result = {"id": product.get("id"), "name": name, "brand": brand}
            if malformed(name):
                result.update(status="REVIEW_REQUIRED", reason="Malformed imported product name")
                print(f"[{index}/{len(products)}] REVIEW {name!r}")
                report.write(json.dumps(result, ensure_ascii=False) + "\n")
                continue
            # Percentages, pack counts and import typos often make an exact
            # quoted search return no image results. Keep the meaningful brand
            # and product words, while retaining the full name for matching.
            query = f"{brand} {' '.join(sorted(tokens(name), key=lambda value: name.lower().find(value)))} product package"
            try:
                candidates = google_candidates(session, query)
                provider = "Google Images"
                candidate = choose_candidate(candidates, name, brand)
                if candidate is None:
                    candidates = bing_candidates(session, query)
                    provider = "Bing Images fallback"
                    candidate = choose_candidate(candidates, name, brand)
                if candidate is None:
                    result.update(status="REVIEW_REQUIRED", reason="No high-confidence image result")
                else:
                    image = download_image(session, candidate["murl"])
                    if image is None:
                        result.update(status="REVIEW_REQUIRED", reason="Candidate image could not be downloaded")
                    else:
                        result.update(status="MATCHED", provider=provider, sourceUrl=candidate["murl"], sourcePage=candidate.get("purl"), title=candidate.get("t"))
                        if args.apply:
                            managed_url = upload(session, args.base_url, token, image[0], image[1], name)
                            attach(session, args.base_url, token, product, managed_url, candidate["murl"], candidate.get("purl", ""))
                            result["managedUrl"] = managed_url
                        print(f"[{index}/{len(products)}] {result['status']} {name}")
            except RequestError as error:
                result.update(status="RETRY_REQUIRED", reason=str(error))
            report.write(json.dumps(result, ensure_ascii=False) + "\n")
            report.flush()
            time.sleep(args.delay)
    return 0


if __name__ == "__main__":
    sys.exit(main())
