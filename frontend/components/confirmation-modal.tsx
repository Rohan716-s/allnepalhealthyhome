"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type ConfirmationRequest,
} from "@/lib/confirmation-events";

export type ConfirmationModalProps = ConfirmationRequest & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  message,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  checkboxLabel,
  inputLabel,
  inputPlaceholder,
  inputRequired = false,
  tone = "default",
  onConfirm,
}: ConfirmationModalProps) {
  const [checked, setChecked] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm?.(checked, inputValue.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="confirmation-modal-content max-w-md gap-0 p-0">
        <DialogHeader className="confirmation-modal-header gap-3 p-6 pb-4 sm:p-7 sm:pb-5">
          <div className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${tone === "danger" ? "bg-rose-100 text-rose-700" : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"}`}>
              <ShieldAlert size={19} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="confirmation-modal-title text-lg font-extrabold">{title}</DialogTitle>
              <DialogDescription className="confirmation-modal-message mt-2 text-sm leading-6">{message}</DialogDescription>
            </div>
          </div>
          {description && <p className="confirmation-modal-description pl-[52px] text-xs leading-5">{description}</p>}
        </DialogHeader>
        {checkboxLabel && (
          <label className="confirmation-modal-checkbox mx-6 mb-1 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs font-semibold sm:mx-7">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
            <span>{checkboxLabel}</span>
          </label>
        )}
        {inputLabel && (
          <label className="mx-6 mb-1 grid gap-2 text-xs font-semibold sm:mx-7">
            <span>{inputLabel}</span>
            <textarea value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder={inputPlaceholder} rows={3} className="min-h-20 resize-y rounded-xl border bg-transparent px-3 py-2 text-sm font-normal outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15" />
          </label>
        )}
        <DialogFooter className="confirmation-modal-footer flex-col-reverse gap-2 p-6 pt-5 sm:flex-row sm:justify-end sm:p-7 sm:pt-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{cancelLabel}</Button>
          <Button type="button" variant={tone === "danger" ? "destructive" : "default"} onClick={() => void confirm()} disabled={busy || (inputRequired && !inputValue.trim())}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmationModalHost() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  useEffect(() => {
    const onRequest = (event: Event) => setRequest((event as CustomEvent<ConfirmationRequest>).detail ?? null);
    window.addEventListener("anhh:confirmation-request", onRequest);
    return () => window.removeEventListener("anhh:confirmation-request", onRequest);
  }, []);
  return request ? <ConfirmationModal key={`${request.title}:${request.message}`} {...request} open onOpenChange={(open) => !open && setRequest(null)} /> : null;
}
