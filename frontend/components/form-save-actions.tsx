"use client";

import { type MouseEvent } from "react";
import { Loader2, Save, X } from "lucide-react";
import { useEntityList } from "@/components/entity-list-panel";
import { Button } from "@/components/ui/button";

type FormSaveActionsProps = {
  mode: "create" | "edit";
  busy?: boolean;
  onCancel: () => void;
  onSaveAndAnother?: () => void;
  saveLabel?: string;
};

/** Shared CRUD actions. Parents own persistence and navigation. */
export function FormSaveActions({ mode, busy = false, onCancel, onSaveAndAnother }: FormSaveActionsProps) {
  const list = useEntityList();
  const resolvedSaveLabel = mode === "edit" ? "Save Changes" : "Save & List";

  function saveAndAddAnother(event: MouseEvent<HTMLButtonElement>) {
    // This button intentionally does not submit the form, because its parent
    // keeps the user on the current form after saving. Keep native validation
    // consistent with the normal Save & List submit action first.
    if (!event.currentTarget.form?.reportValidity()) return;
    list?.intent(false);
    if (onSaveAndAnother) {
      onSaveAndAnother();
      return;
    }
    event.currentTarget.form?.requestSubmit();
  }

  return <div className="flex w-full flex-col justify-end gap-2 sm:flex-row" data-form-mode={mode}>
    {mode === "create" && <Button className="min-h-10 w-full sm:w-auto" type="button" variant="secondary" onClick={saveAndAddAnother} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save size={16} />}Save</Button>}
    <Button className="min-h-10 w-full sm:w-auto" type="submit" onClick={event => { if (event.currentTarget.form?.checkValidity()) list?.intent(true); }} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save size={16} />}{resolvedSaveLabel}</Button>
    <Button className="min-h-10 w-full sm:w-auto" type="button" variant="outline" onClick={() => list ? list.cancel(onCancel) : onCancel()} disabled={busy}><X size={16} />Cancel</Button>
  </div>;
}
