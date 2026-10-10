from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import OrderedDict
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def read_rows(path: Path):
    names = ["id", "kind", "stored", "original", "type", "length", "sha", "public", "active", "alt", "product_refs", "gallery_refs", "desktop_refs", "mobile_refs", "setting_refs"]
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, fieldnames=names, delimiter="\t"))


def run_mask(session, image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB").resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = ((rgb - mean) / std).transpose(2, 0, 1)[None, ...].astype(np.float32)
    pred = session.run(None, {session.get_inputs()[0].name: arr})[0][:, 0, :, :]
    low = float(pred.min())
    high = float(pred.max())
    if not np.isfinite(low + high) or high - low < 1e-8:
        raise ValueError("segmentation model returned a flat mask")
    norm = np.clip((pred[0] - low) / (high - low), 0.0, 1.0)
    mask = Image.fromarray(np.uint8(np.round(norm * 255)))
    return mask.resize(image.size, Image.Resampling.LANCZOS)


def inspect_source(image: Image.Image, mask: Image.Image):
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    a = np.asarray(mask, dtype=np.uint8)
    h, w = a.shape
    side = max(2, int(min(w, h) * 0.05))
    corners = [rgb[:side, :side], rgb[:side, -side:], rgb[-side:, :side], rgb[-side:, -side:]]
    corner_metrics = []
    for patch in corners:
        lum = patch.astype(np.float32).mean(axis=2)
        corner_metrics.append({
            "mean_luminance": round(float(lum.mean()), 2),
            "luminance_std": round(float(lum.std()), 2),
            "near_white_fraction": round(float((patch.min(axis=2) >= 230).mean()), 4),
        })
    border = np.concatenate([rgb[:side].reshape(-1, 3), rgb[-side:].reshape(-1, 3), rgb[:, :side].reshape(-1, 3), rgb[:, -side:].reshape(-1, 3)])
    background = rgb[a < 16]
    ys, xs = np.where(a >= 96)
    fg_fraction = float((a >= 96).mean())
    transparent_fraction = float((a < 16).mean())
    bbox = None if not len(xs) else [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    white_corners = all(c["mean_luminance"] >= 232 and c["luminance_std"] <= 26 and c["near_white_fraction"] >= 0.88 for c in corner_metrics)
    removed_bg_is_white = bool(len(background) and float(background.min(axis=1).mean()) >= 220 and float((background.min(axis=1) >= 200).mean()) >= 0.9)
    valid_mask = 0.03 <= fg_fraction <= 0.94 and 0.02 <= transparent_fraction <= 0.88 and bbox is not None
    safe_candidate = white_corners and removed_bg_is_white and valid_mask
    reasons = []
    if not white_corners: reasons.append("source corners are not a plain near-white background")
    if not removed_bg_is_white: reasons.append("removed pixels are not consistently near-white")
    if not valid_mask: reasons.append("mask coverage or object bounds need manual review")
    return {
        "width": w, "height": h,
        "foreground_fraction": round(fg_fraction, 5),
        "transparent_fraction": round(transparent_fraction, 5),
        "foreground_bbox": bbox,
        "corners": corner_metrics,
        "safe_candidate": safe_candidate,
        "manual_review_reasons": reasons,
    }


def checkerboard(size, cell=16):
    bg = Image.new("RGB", size, (245, 245, 245))
    draw = ImageDraw.Draw(bg)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2 == 0:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(205, 211, 220))
    return bg


def main():
    ap = argparse.ArgumentParser(description="Stage, score, and checkerboard-review backgrounds without editing source images or the database.")
    ap.add_argument("--media-root", type=Path, default=Path("backend/App_Data/media"))
    ap.add_argument("--assets-tsv", type=Path, default=Path(".tmp-existing-image-audit/media-assets-references.tsv"))
    ap.add_argument("--model", type=Path, default=Path(".tmp-existing-image-audit/models/u2net.onnx"))
    ap.add_argument("--out", type=Path, default=Path(".tmp-existing-image-audit/staged"))
    ap.add_argument("--kinds", default="PRODUCT,LOGO", help="comma-separated active media kinds to stage")
    args = ap.parse_args()
    root = args.media_root.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    rows = read_rows(args.assets_tsv)
    kinds = {k.strip().upper() for k in args.kinds.split(",") if k.strip()}
    selected = [r for r in rows if r["kind"] in kinds and r["active"] == "1"]
    groups = OrderedDict()
    for row in selected:
        src = (root / row["stored"]).resolve()
        if root not in src.parents or not src.is_file():
            row["stage_status"] = "missing-or-outside-root"
            continue
        try:
            actual_hash = sha256(src)
            if actual_hash != row["sha"].lower():
                row["stage_status"] = "database-hash-mismatch"
                continue
            with Image.open(src) as probe:
                if probe.format not in {"PNG", "JPEG", "WEBP", "BMP", "GIF"}:
                    row["stage_status"] = "unsupported-image-format"
                    continue
                im = probe.copy()
            groups.setdefault(actual_hash, {"src": src, "image": im, "rows": []})["rows"].append(row)
        except Exception as e:
            row["stage_status"] = f"decode-failed: {type(e).__name__}: {e}"
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 1
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(str(args.model.resolve()), sess_options=opts, providers=["CPUExecutionProvider"])
    records = []
    for index, (source_hash, group) in enumerate(groups.items(), 1):
        im = group["image"]
        base = {"source_sha256": source_hash, "source_file": group["src"].name, "asset_ids": [r["id"] for r in group["rows"]], "asset_kinds": sorted({r["kind"] for r in group["rows"]}), "original_names": sorted({r["original"] for r in group["rows"]})}
        record = dict(base)
        try:
            if "A" in im.getbands() and im.getchannel("A").getextrema()[0] < 255:
                record.update({"status": "already-transparent", "safe_candidate": False, "width": im.width, "height": im.height})
                records.append(record)
                print(f"{index}/{len(groups)} already transparent: {group['src'].name}", flush=True)
                continue
            if im.getexif().get(274, 1) != 1:
                record.update({"status": "manual-review-exif-orientation", "safe_candidate": False, "width": im.width, "height": im.height})
                records.append(record)
                print(f"{index}/{len(groups)} manual review EXIF: {group['src'].name}", flush=True)
                continue
            mask = run_mask(session, im)
            metrics = inspect_source(im, mask)
            staged_name = f"{source_hash}.png"
            staged_path = args.out / staged_name
            out = im.convert("RGBA")
            out.putalpha(mask)
            kwargs = {"format": "PNG", "compress_level": 9}
            if im.info.get("icc_profile"): kwargs["icc_profile"] = im.info["icc_profile"]
            out.save(staged_path, **kwargs)
            record.update(metrics)
            record.update({"status": "staged" if metrics["safe_candidate"] else "manual-review", "staged_file": staged_name, "staged_sha256": sha256(staged_path), "staged_bytes": staged_path.stat().st_size, "source_format": im.format})
            # Keep one review tile for each unique original content.
            tile_size = (240, 250)
            source_thumb = im.convert("RGBA").copy(); source_thumb.thumbnail((220, 205))
            cut_thumb = out.copy(); cut_thumb.thumbnail((220, 205))
            tile = Image.new("RGB", (tile_size[0] * 2, tile_size[1]), (238, 242, 247))
            for offset, preview, label in [(0, source_thumb, "original"), (tile_size[0], cut_thumb, "transparent candidate")]:
                bg = checkerboard((220, 205))
                bg.paste(preview, ((220-preview.width)//2, (205-preview.height)//2), preview)
                tile.paste(bg, (offset+10, 8))
                ImageDraw.Draw(tile).text((offset+10, 218), label, fill=(18, 30, 45))
            ImageDraw.Draw(tile).text((10, 235), group["src"].name[:32], fill=(18, 30, 45))
            tile.save(args.out / f"review-{source_hash}.png")
            records.append(record)
            print(f"{index}/{len(groups)} {record['status']}: {group['src'].name} fg={metrics['foreground_fraction']:.3f} bg={metrics['transparent_fraction']:.3f}", flush=True)
        except Exception as e:
            record.update({"status": "manual-review-inference-failed", "safe_candidate": False, "error": f"{type(e).__name__}: {e}"})
            records.append(record)
            print(f"{index}/{len(groups)} inference failed: {group['src'].name}: {e}", flush=True)
    for row in selected:
        if "stage_status" in row:
            records.append({"asset_id": row["id"], "kind": row["kind"], "source_file": row["stored"], "status": row["stage_status"], "safe_candidate": False})
    (args.out / "manifest.json").write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    safe = sum(r.get("status") == "staged" for r in records)
    review = len([r for r in records if str(r.get("status", "")).startswith("manual-review")])
    print(f"Unique staged transparent candidates: {safe}; manual review/other: {len(records)-safe}; manifest: {args.out/'manifest.json'}")


if __name__ == "__main__":
    main()
