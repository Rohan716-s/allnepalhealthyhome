from __future__ import annotations

import csv
import hashlib
import html
import json
import mimetypes
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.robotparser
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


INPUT_FILES = [
    Path(r"C:\Users\LENOVO\Downloads\bulk_upload_products_with_source_links.csv"),
    Path(r"C:\Users\LENOVO\Downloads\toran_tradelink_personal_care_products.csv"),
]
OUTPUT_BASE = Path(r"C:\Users\LENOVO\Downloads\all-nepal-healthy-home-product-images-2026-09-16")
USER_AGENT = "AllNepalHealthyHomeCatalogBot/1.0 (+internal cataloging; contact admin)"
REQUEST_TIMEOUT = 25
MIN_DELAY_SECONDS = 1.5
MAX_HTML_BYTES = 8 * 1024 * 1024
MAX_IMAGE_BYTES = 25 * 1024 * 1024


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    return value or "product"


def normalize_text(value: str) -> str:
    value = html.unescape(value or "").lower()
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def significant_tokens(value: str) -> set[str]:
    stop = {"and", "the", "with", "for", "of", "in", "on", "by", "pack", "size", "new"}
    return {token for token in normalize_text(value).split() if len(token) > 1 and token not in stop}


class Node:
    def __init__(self, tag: str, attrs: dict[str, str], parent: "Node | None" = None):
        self.tag = tag
        self.attrs = attrs
        self.parent = parent
        self.children: list[Node | str] = []


class PageParser(__import__("html.parser", fromlist=["HTMLParser"]).HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", {})
        self.stack = [self.root]
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        self._script_node: Node | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attrs_dict = {key.lower(): (value or "") for key, value in attrs}
        node = Node(tag.lower(), attrs_dict, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag.lower() in {"meta", "link"}:
            key = attrs_dict.get("property") or attrs_dict.get("name") or attrs_dict.get("rel")
            value = attrs_dict.get("content") or attrs_dict.get("href")
            if key and value:
                self.meta[key.lower()] = value
        if tag.lower() == "script" and "application/ld+json" in attrs_dict.get("type", "").lower():
            self._script_node = node
        if tag.lower() not in self.VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in self.VOID_TAGS and len(self.stack) > 1:
            self.stack.pop()

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        if self._script_node is not None and tag == "script":
            self.json_ld.append(node_text(self._script_node))
            self._script_node = None
        for idx in range(len(self.stack) - 1, 0, -1):
            if self.stack[idx].tag == tag:
                del self.stack[idx:]
                return

    def handle_data(self, data: str):
        self.stack[-1].children.append(data)


def node_text(node: Node) -> str:
    parts: list[str] = []
    for child in node.children:
        if isinstance(child, str):
            parts.append(child)
        else:
            parts.append(node_text(child))
    return " ".join(" ".join(parts).split())


def walk(node: Node):
    for child in node.children:
        if isinstance(child, Node):
            yield child
            yield from walk(child)


def ancestor_attrs(node: Node, tag: str) -> dict[str, str] | None:
    current = node.parent
    while current:
        if current.tag == tag:
            return current.attrs
        current = current.parent
    return None


def image_candidates(parser: PageParser, page_url: str, product_name: str) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    page_slug = slugify(product_name)
    product_tokens = significant_tokens(product_name)

    def add(url: str, score: int, source: str, context: str = "", attrs: dict[str, str] | None = None):
        if not url:
            return
        url = html.unescape(url.strip())
        if url.startswith("//"):
            url = urllib.parse.urljoin(page_url, url)
        url = urllib.parse.urljoin(page_url, url)
        if url.startswith("data:") or not url.startswith(("http://", "https://")):
            return
        text_for_rejection = normalize_text(" ".join([url, context, json.dumps(attrs or {})]))
        if any(bad in text_for_rejection for bad in ("favicon", "sprite", "placeholder", "loading image")):
            return
        context_tokens = significant_tokens(context)
        overlap = len(product_tokens & context_tokens) / max(1, len(product_tokens))
        if overlap:
            score += round(overlap * 35)
        candidates.append({"url": url, "score": score, "source": source, "context": context})

    structured_products: list[dict[str, Any]] = []

    def collect_json(value: Any):
        if isinstance(value, dict):
            types = value.get("@type", [])
            if isinstance(types, str):
                types = [types]
            if any(str(item).lower() == "product" for item in types):
                structured_products.append(value)
            for nested in value.values():
                collect_json(nested)
        elif isinstance(value, list):
            for nested in value:
                collect_json(nested)

    for raw in parser.json_ld:
        try:
            collect_json(json.loads(raw))
        except (ValueError, TypeError):
            continue
    for product in structured_products:
        product_title = str(product.get("name", ""))
        overlap = len(product_tokens & significant_tokens(product_title)) / max(1, len(product_tokens))
        if overlap >= 0.55 or page_slug in normalize_text(page_url).replace(" ", "_"):
            images = product.get("image", [])
            if isinstance(images, str):
                images = [images]
            if isinstance(images, dict):
                images = list(images.values())
            for image_url in images[:5]:
                if isinstance(image_url, str):
                    add(image_url, 105, "json-ld Product", product_title)

    for key in ("og:image", "twitter:image", "twitter:image:src"):
        if key in parser.meta:
            add(parser.meta[key], 70 if "/product/" in page_url or "/products/" in page_url else 25, key)

    for node in walk(parser.root):
        if node.tag == "img":
            attrs = node.attrs
            raw_src = attrs.get("src") or attrs.get("data-src") or attrs.get("data-lazy-src") or attrs.get("data-original")
            srcset = attrs.get("srcset") or attrs.get("data-srcset")
            if not raw_src and srcset:
                raw_src = choose_srcset(srcset)
            if not raw_src:
                continue
            link_attrs = ancestor_attrs(node, "a") or {}
            context_nodes: list[Node] = []
            if node.parent:
                context_nodes.append(node.parent)
                if node.parent.parent:
                    context_nodes.append(node.parent.parent)
            context = " ".join(node_text(item) for item in context_nodes)
            context = " ".join(
                [context, attrs.get("alt", ""), attrs.get("title", ""), attrs.get("class", ""), link_attrs.get("href", "")]
            )
            context_tokens = significant_tokens(context)
            overlap = len(product_tokens & context_tokens) / max(1, len(product_tokens))
            score = 20 + round(overlap * 90)
            if overlap >= 0.55:
                score += 30
            elif ("/brand/" in page_url or "/manufacturer/" in page_url) and overlap < 0.35:
                score -= 35
            add(raw_src, score, "img", context, attrs)

    # Some sites expose image URLs in their hydration data but not as ordinary img tags.
    raw_page = " ".join(parser.meta.values())
    for match in re.findall(r"https?://[^\\\"'<> ]+?\\.(?:jpe?g|png|webp)(?:\\?[^\\\"'<> ]*)?", raw_page, flags=re.I):
        add(match.replace("\\/", "/"), 15, "metadata")
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def choose_srcset(srcset: str) -> str:
    choices: list[tuple[int, str]] = []
    for part in srcset.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        width = 0
        if len(bits) > 1:
            match = re.match(r"(\d+)w", bits[1])
            if match:
                width = int(match.group(1))
        choices.append((width, bits[0]))
    return max(choices, default=(0, ""))[1]


class Fetcher:
    def __init__(self):
        self.last_request: dict[str, float] = defaultdict(float)
        self.robots: dict[str, tuple[bool, str]] = {}
        self.page_cache: dict[str, tuple[bytes, str]] = {}

    def throttle(self, host: str):
        elapsed = time.monotonic() - self.last_request[host]
        if elapsed < MIN_DELAY_SECONDS:
            time.sleep(MIN_DELAY_SECONDS - elapsed)
        self.last_request[host] = time.monotonic()

    def request(self, url: str, referer: str | None = None, max_bytes: int = MAX_HTML_BYTES) -> tuple[bytes | None, str | None, str | None]:
        host = urllib.parse.urlparse(url).netloc.lower()
        self.throttle(host)
        headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.5"}
        if referer:
            headers["Referer"] = referer
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                content_type = response.headers.get("Content-Type", "")
                data = response.read(max_bytes + 1)
                if len(data) > max_bytes:
                    return None, None, f"response exceeds {max_bytes // (1024 * 1024)} MB"
                return data, response.geturl(), content_type
        except urllib.error.HTTPError as exc:
            return None, None, f"HTTP {exc.code}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            return None, None, str(exc.reason if isinstance(exc, urllib.error.URLError) else exc)

    def allowed(self, url: str) -> tuple[bool, str]:
        parsed = urllib.parse.urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin in self.robots:
            return self.robots[origin]
        robots_url = origin + "/robots.txt"
        data, _, content_type_or_error = self.request(robots_url, max_bytes=512 * 1024)
        if data is None:
            result = (False, f"robots.txt unavailable ({content_type_or_error})")
        elif content_type_or_error and "text" not in content_type_or_error.lower() and data[:1] == b"<":
            result = (False, "robots.txt did not return a readable robots policy")
        else:
            parser = urllib.robotparser.RobotFileParser()
            parser.set_url(robots_url)
            parser.parse(data.decode("utf-8", errors="replace").splitlines())
            result = (parser.can_fetch(USER_AGENT, url), "robots.txt disallows this URL" if not parser.can_fetch(USER_AGENT, url) else "")
        self.robots[origin] = result
        return result

    def page(self, url: str) -> tuple[bytes | None, str | None, str | None]:
        if url in self.page_cache:
            return self.page_cache[url]
        result = self.request(url)
        self.page_cache[url] = result
        return result


def image_extension(content_type: str, url: str, data: bytes) -> str | None:
    ct = (content_type or "").split(";", 1)[0].lower()
    mapping = {"image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    if ct in mapping:
        return mapping[ct]
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG"):
        return ".png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    path_ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    return path_ext if path_ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else None


def parse_json_image_urls(parser: PageParser) -> list[str]:
    urls: list[str] = []
    def collect(value: Any):
        if isinstance(value, dict):
            for key, item in value.items():
                if str(key).lower() == "image":
                    if isinstance(item, str):
                        urls.append(item)
                    elif isinstance(item, list):
                        urls.extend(item for item in item if isinstance(item, str))
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
    for raw in parser.json_ld:
        try:
            collect(json.loads(raw))
        except (ValueError, TypeError):
            pass
    return urls


def main():
    for source in INPUT_FILES:
        if not source.exists():
            raise SystemExit(f"Missing input file: {source}")

    output_dir = OUTPUT_BASE
    suffix = 2
    while output_dir.exists():
        output_dir = Path(f"{OUTPUT_BASE}-{suffix}")
        suffix += 1
    image_dir = output_dir / "product_images"
    image_dir.mkdir(parents=True, exist_ok=False)

    fetcher = Fetcher()
    rows_by_file: dict[Path, list[dict[str, str]]] = {}
    all_rows: list[tuple[Path, int, dict[str, str]]] = []
    used_names: set[str] = set()
    logs: list[dict[str, str]] = []
    successes = 0
    failures = 0

    for source in INPUT_FILES:
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames or "product_name" not in reader.fieldnames or "source_product_page_url" not in reader.fieldnames:
                raise SystemExit(f"CSV must contain product_name and source_product_page_url: {source}")
            rows = list(reader)
        rows_by_file[source] = rows
        for row_number, row in enumerate(rows, start=2):
            all_rows.append((source, row_number, row))

    for source, row_number, row in all_rows:
        product_name = (row.get("product_name") or "").strip()
        page_url = (row.get("source_product_page_url") or "").strip()
        entry = {
            "source_csv": source.name,
            "csv_row": str(row_number),
            "product_name": product_name,
            "source_product_page_url": page_url,
            "status": "failed",
            "image_filename_1": "",
            "image_source_url": "",
            "reason": "",
        }
        if not product_name or not page_url:
            entry["reason"] = "missing product_name or source_product_page_url"
            failures += 1
            logs.append(entry)
            continue
        parsed_url = urllib.parse.urlparse(page_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            entry["reason"] = "invalid source URL"
            failures += 1
            logs.append(entry)
            continue
        allowed, robot_reason = fetcher.allowed(page_url)
        if not allowed:
            entry["reason"] = robot_reason
            failures += 1
            logs.append(entry)
            continue
        page_bytes, final_url, content_type = fetcher.page(page_url)
        if page_bytes is None:
            entry["reason"] = f"source page fetch failed: {content_type}"
            failures += 1
            logs.append(entry)
            continue
        parser = PageParser()
        try:
            parser.feed(page_bytes.decode("utf-8", errors="replace"))
        except Exception as exc:
            entry["reason"] = f"HTML parse failed: {exc}"
            failures += 1
            logs.append(entry)
            continue
        candidates = image_candidates(parser, final_url or page_url, product_name)
        if not candidates:
            entry["reason"] = "no candidate product image found"
            failures += 1
            logs.append(entry)
            continue

        chosen = None
        image_error = ""
        page_is_listing = "/brand/" in page_url or "/manufacturer/" in page_url
        product_tokens = significant_tokens(product_name)
        for candidate in candidates[:12]:
            # Listing/brand pages require a strong exact-product context; never use a generic page image.
            candidate_overlap = len(product_tokens & significant_tokens(candidate.get("context", ""))) / max(1, len(product_tokens))
            if page_is_listing and candidate["score"] < 70 and candidate_overlap < 0.55:
                continue
            image_data, image_final_url, image_content_type = fetcher.request(candidate["url"], referer=final_url or page_url, max_bytes=MAX_IMAGE_BYTES)
            if image_data is None:
                image_error = f"image fetch failed: {image_content_type}"
                continue
            extension = image_extension(image_content_type or "", image_final_url or candidate["url"], image_data)
            if not extension or len(image_data) < 2048:
                image_error = "downloaded candidate was not a valid image or was too small"
                continue
            chosen = (candidate, image_data, image_final_url or candidate["url"], extension)
            break
        if chosen is None:
            entry["reason"] = image_error or "exact product image could not be verified on source page"
            failures += 1
            logs.append(entry)
            continue

        candidate, image_data, image_url, extension = chosen
        stem = slugify(product_name)
        filename = f"{stem}{extension}"
        counter = 2
        while filename in used_names or (image_dir / filename).exists():
            filename = f"{stem}_{counter}{extension}"
            counter += 1
        used_names.add(filename)
        (image_dir / filename).write_bytes(image_data)
        row["image_filename_1"] = filename
        entry.update({
            "status": "success",
            "image_filename_1": filename,
            "image_source_url": image_url,
            "reason": f"matched via {candidate['source']}; sha256={hashlib.sha256(image_data).hexdigest()}",
        })
        successes += 1
        logs.append(entry)

    for source, rows in rows_by_file.items():
        destination = output_dir / f"{source.stem}_updated.csv"
        with destination.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
            writer.writeheader()
            writer.writerows(rows)

    summary_csv = output_dir / "product_image_download_summary.csv"
    with summary_csv.open("w", encoding="utf-8-sig", newline="") as handle:
        fields = ["source_csv", "csv_row", "product_name", "source_product_page_url", "status", "image_filename_1", "image_source_url", "reason"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(logs)

    summary_txt = output_dir / "product_image_download_summary.txt"
    with summary_txt.open("w", encoding="utf-8") as handle:
        handle.write("All Nepal Healthy Home product image download summary\n")
        handle.write(f"Run date: {datetime.now().astimezone().isoformat()}\n")
        handle.write(f"Input files: {len(INPUT_FILES)}; rows processed: {len(all_rows)}\n")
        handle.write(f"Succeeded: {successes}\nFailed/skipped: {failures}\n")
        handle.write("\nFailure details:\n")
        for item in logs:
            if item["status"] == "failed":
                handle.write(f"- {item['source_csv']} row {item['csv_row']}: {item['product_name']} | {item['source_product_page_url']} | {item['reason']}\n")

    zip_path = output_dir / "product_images.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for image_path in sorted(image_dir.iterdir()):
            archive.write(image_path, arcname=image_path.name)

    print(json.dumps({
        "output_dir": str(output_dir),
        "images_dir": str(image_dir),
        "zip": str(zip_path),
        "updated_csvs": [str(output_dir / f"{source.stem}_updated.csv") for source in INPUT_FILES],
        "summary_csv": str(summary_csv),
        "summary_txt": str(summary_txt),
        "rows_processed": len(all_rows),
        "succeeded": successes,
        "failed": failures,
    }, indent=2))


if __name__ == "__main__":
    main()
