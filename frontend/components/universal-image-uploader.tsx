"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { IMAGE_ACCEPT, MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS, TRANSPARENCY_PREVIEW_STYLE, formatImageSize, readImageDimensions, validateImageFile } from "@/lib/image-upload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { resolveMediaUrl } from "@/services/api";

type UploadState = "idle" | "uploading" | "success" | "error";

export function UniversalImageUploader({
  label,
  value,
  onChange,
  onRemove,
  required,
  disabled,
  error,
  helperText,
  uploadState = "idle",
  uploadProgress,
  aspect = "aspect-video",
  className,
  accept = IMAGE_ACCEPT.replace(",image/svg+xml", ""),
  maxBytes = 8 * 1024 * 1024,
  onFiles,
  multiple = false,
  maxFiles,
}: {
  accept?: string;
  maxBytes?: number;
  multiple?: boolean;
  maxFiles?: number;
  onFiles?: (files: File[]) => void;
  label: string;
  value?: string;
  onChange: (file: File) => void;
  onRemove?: () => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  uploadState?: UploadState;
  uploadProgress?: number;
  aspect?: string;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string>();
  const [selected, setSelected] = useState<File>();
  const [metadata, setMetadata] = useState<{ width: number; height: number }>();
  const [localError, setLocalError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [savedPreview, setSavedPreview] = useState<{ source: string; url: string }>();
  // These existing staff-photo endpoints require a bearer token. Never attach
  // credentials to arbitrary image URLs supplied by a record.
  const protectedPhoto = Boolean(value && /^\/api\/(?:staff-profile\/photo|superadmin\/staff\/[a-f0-9-]+\/photo)$/i.test(value));
  const preview = localPreview ?? (protectedPhoto ? savedPreview && savedPreview.source === value ? savedPreview.url : undefined : resolveMediaUrl(value));

  useEffect(() => {
    if (!protectedPhoto || !value) return;
    const token = window.localStorage.getItem("anhh-staff-access-token");
    const url = resolveMediaUrl(value);
    if (!token || !url) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("Saved photo preview could not be loaded."); return response.blob(); })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSavedPreview({ source: value, url: objectUrl });
        setPreviewFailed(false);
      }).catch(() => { if (!controller.signal.aborted) setPreviewFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [protectedPhoto, value]);

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  const selectionVersion = useRef(0);
  const [gallery, setGallery] = useState<string[]>([]);
  useEffect(() => () => gallery.forEach(url => URL.revokeObjectURL(url)), [gallery]);
  useEffect(() => () => { selectionVersion.current++; }, []);

  async function choose(files: File[]) {
    if (disabled || uploadState === "uploading" || !files.length) return;
    if (maxFiles !== undefined && files.length > maxFiles) {
      setLocalError(`You can add ${maxFiles} more image${maxFiles === 1 ? "" : "s"}.`);
      return;
    }
    const version = ++selectionVersion.current;
    const candidates = multiple ? files : files.slice(0, 1);
    let dimensions: { width: number; height: number } | undefined;
    let firstDimensions: { width: number; height: number } | undefined;
    for (const file of candidates) {
      const isImage = file.type.startsWith("image/");
      const allowed = accept.split(",").some(type => type === file.type || type === `.${file.name.split(".").pop()?.toLowerCase()}`);
      let message = !allowed ? "This file type is not supported at this destination." : "";
      if (!message && (!file.size || file.size > maxBytes)) message = `Choose a non-empty file of ${maxBytes / (1024 * 1024)} MB or smaller.`;
      if (!message && isImage) {
        message = validateImageFile(file, maxBytes) ?? "";
        dimensions = await readImageDimensions(file);
        if (file === candidates[0]) firstDimensions = dimensions;
        if (!message && !dimensions) message = "This image cannot be decoded. Please choose a valid image.";
        if (dimensions && (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS)) message = "Image dimensions exceed 16,384 pixels per side or 40 megapixels.";
      }
      if (version !== selectionVersion.current) return;
      if (message) { setLocalError(message); return; }
    }
    setLocalError("");
    setSelected(candidates[0]);
    setMetadata(firstDimensions);
    setPreviewFailed(false);
    setGallery(multiple ? candidates.filter(file => file.type.startsWith("image/")).map(file => URL.createObjectURL(file)) : []);
    setLocalPreview(candidates[0].type.startsWith("image/") ? URL.createObjectURL(candidates[0]) : undefined);
    if (onFiles) onFiles(candidates);
    else onChange(candidates[0]);
  }

  function remove() {
    selectionVersion.current++;
    setGallery([]);
    setSelected(undefined);
    setMetadata(undefined);
    setLocalError("");
    setPreviewFailed(false);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(undefined);
    if (inputRef.current) inputRef.current.value = "";
    onRemove?.();
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <Label htmlFor={inputId}>{label}{required && <span aria-hidden="true" className="ml-1 text-rose-600">*</span>}</Label>
      <button
        type="button"
        disabled={disabled || uploadState === "uploading"}
        onClick={() => inputRef.current?.click()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); void choose(Array.from(event.dataTransfer.files)); }}
        className={cn("relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-[#003893] disabled:cursor-not-allowed disabled:opacity-60", aspect)}
        style={TRANSPARENCY_PREVIEW_STYLE}
        aria-label={`Choose ${label.toLowerCase()}`}
      >
        {preview && !previewFailed ? <img src={preview} alt={`${label} preview`} className="h-full w-full object-contain p-2" onError={() => setPreviewFailed(true)} /> : <span className="grid place-items-center gap-2 px-4 text-xs font-semibold text-slate-500"><ImagePlus size={28} className="text-slate-400" /><span>{preview ? "Image preview unavailable — choose another" : selected && !selected.type.startsWith("image/") ? selected.name : "Drop a file here or browse"}</span></span>}
        {uploadState === "uploading" && <span className="absolute inset-0 grid place-items-center bg-white/85 text-xs font-bold text-[#003893]"><Loader2 className="animate-spin" size={22} /><span>{uploadProgress === undefined ? "Uploading..." : `${uploadProgress}% uploading`}</span></span>}
      </button>
      <input id={inputId} ref={inputRef} type="file" aria-required={required} accept={accept} multiple={multiple} disabled={disabled || uploadState === "uploading"} className="sr-only" onChange={event => { void choose(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Button type="button" variant="outline" size="sm" disabled={disabled || uploadState === "uploading"} onClick={() => inputRef.current?.click()}><UploadCloud size={14} />{preview || selected ? "Replace file" : "Choose file"}</Button>
        {(preview || selected) && onRemove && <Button type="button" variant="ghost" size="sm" disabled={disabled || uploadState === "uploading"} onClick={remove}><Trash2 size={14} />Remove</Button>}
        {uploadState === "success" && <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check size={14} />Saved</span>}
        {uploadState === "error" && <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><RefreshCw size={14} />Upload failed — choose again</span>}
      </div>
      {gallery.length > 1 && <div className="grid grid-cols-3 gap-2">{gallery.map((url, index) => <img key={url} src={url} alt={`Selected image ${index + 1}`} className="aspect-square w-full object-contain" style={TRANSPARENCY_PREVIEW_STYLE} />)}</div>}
      <p className="text-[11px] text-slate-500">PNG and WebP support transparency. Original image pixels are preserved.{selected && ["image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"].includes(selected.type) ? " Selected format supports transparency (if present)." : selected?.type === "image/jpeg" ? " JPEG has no transparency." : ""}</p>
      {selected && <p className="text-[11px] text-slate-500">{selected.name} · {formatImageSize(selected.size)}{metadata ? ` · ${metadata.width} × ${metadata.height}px` : ""}</p>}
      {(localError || error) && <p role="alert" className="text-xs font-semibold text-rose-700">{localError || error}</p>}
      {helperText && !localError && !error && <p className="text-[11px] leading-5 text-slate-400">{helperText}</p>}
    </div>
  );
}
