"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { IMAGE_ACCEPT, formatImageSize, readImageDimensions, validateImageFile } from "@/lib/image-upload";
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
}: {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string>();
  const [selected, setSelected] = useState<File>();
  const [metadata, setMetadata] = useState<{ width: number; height: number }>();
  const [localError, setLocalError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const preview = localPreview ?? resolveMediaUrl(value);

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  useEffect(() => {
    if (!selected) return;
    void readImageDimensions(selected).then(setMetadata);
  }, [selected]);

  function choose(file?: File) {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError("");
    setSelected(file);
    setMetadata(undefined);
    setPreviewFailed(false);
    const nextPreview = URL.createObjectURL(file);
    setLocalPreview(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return nextPreview;
    });
    onChange(file);
  }

  function remove() {
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
      <Label>{label}{required && <span className="ml-1 text-rose-600">*</span>}</Label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files?.[0]); }}
        className={cn("relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-[#003893] disabled:cursor-not-allowed disabled:opacity-60", aspect)}
        aria-label={`Choose ${label.toLowerCase()}`}
      >
        {preview && !previewFailed ? <img src={preview} alt={`${label} preview`} className="h-full w-full object-contain p-2" onError={() => setPreviewFailed(true)} /> : <span className="grid place-items-center gap-2 px-4 text-xs font-semibold text-slate-500"><ImagePlus size={28} className="text-slate-400" /><span>{preview ? "Image preview unavailable — choose another" : "Drop an image here or browse"}</span></span>}
        {uploadState === "uploading" && <span className="absolute inset-0 grid place-items-center bg-white/85 text-xs font-bold text-[#003893]"><Loader2 className="animate-spin" size={22} /><span>{uploadProgress ?? 0}% uploading</span></span>}
      </button>
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} disabled={disabled} className="sr-only" onChange={event => choose(event.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}><UploadCloud size={14} />{preview ? "Replace image" : "Choose image"}</Button>
        {preview && onRemove && <Button type="button" variant="ghost" size="sm" disabled={disabled || uploadState === "uploading"} onClick={remove}><Trash2 size={14} />Remove</Button>}
        {uploadState === "success" && <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check size={14} />Saved</span>}
        {uploadState === "error" && <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><RefreshCw size={14} />Upload failed — choose again</span>}
      </div>
      {selected && <p className="text-[11px] text-slate-500">{selected.name} · {formatImageSize(selected.size)}{metadata ? ` · ${metadata.width} × ${metadata.height}px` : ""}</p>}
      {(localError || error) && <p role="alert" className="text-xs font-semibold text-rose-700">{localError || error}</p>}
      {helperText && !localError && !error && <p className="text-[11px] leading-5 text-slate-400">{helperText}</p>}
    </div>
  );
}
