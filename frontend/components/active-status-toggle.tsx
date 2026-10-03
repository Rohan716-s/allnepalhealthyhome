"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ActiveStatusToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => Promise<void> | void;
  label: string;
  disabled?: boolean;
  confirmOnDeactivate?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
};

export function ActiveStatusToggle({ checked, onChange, label, disabled = false, confirmOnDeactivate = false, confirmTitle, confirmDescription }: ActiveStatusToggleProps) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function commit(next: boolean) {
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  function requestChange() {
    if (busy || disabled) return;
    const next = !checked;
    if (!next && confirmOnDeactivate) setConfirmOpen(true);
    else void commit(next);
  }

  return <>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${checked ? "Deactivate" : "Activate"} ${label}`}
      title={`${checked ? "Deactivate" : "Activate"} ${label}`}
      disabled={disabled || busy}
      onClick={requestChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[#003893]" : "bg-slate-300"}`}
    >
      <span className={`grid size-5 place-items-center rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}>
        {busy && <Loader2 size={12} className="animate-spin text-slate-500" />}
      </span>
    </button>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle ?? `Deactivate ${label}?`}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription ?? `This will make the ${label.toLowerCase()} unavailable while preserving its records and history.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep active</AlertDialogCancel>
          <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => void commit(false)}>Deactivate</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
