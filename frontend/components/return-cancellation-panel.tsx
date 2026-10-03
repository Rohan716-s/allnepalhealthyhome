"use client";

import { useState } from "react";
import { Ban, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { formatPlatformDate } from "@/lib/date-time";
import { cancelCommercePurchaseReturn, cancelCommerceSalesReturn, type CommercePurchaseReturn, type CommerceSalesReturn } from "@/services/api";

const money = (value: number) => `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ReturnCancellationPanel({ kind, salesReturns, purchaseReturns, token, superAdmin, onClose, onSaved, labelFor = (label) => label }: {
  kind: "sales" | "purchase";
  salesReturns: CommerceSalesReturn[];
  purchaseReturns: CommercePurchaseReturn[];
  token: string;
  superAdmin: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  labelFor?: (label: string) => string;
}) {
  const [returnId, setReturnId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = kind === "sales" ? salesReturns : purchaseReturns;
  const selected = rows.find((row) => row.id === returnId);
  const eligible = rows.filter((row) => row.status.toUpperCase() === "APPROVED");

  function cancel(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !reason.trim()) { toast.error("Choose an approved return and enter a reason."); return; }
    requestSiteConfirmation({
      title: `Cancel return ${selected.number}?`,
      message: "This posts a reversal to the saved stock movement and customer/supplier balance. The audit record is retained.",
      inputLabel: "Cancellation reason", inputPlaceholder: "Explain why this return is being cancelled", inputRequired: true,
      confirmLabel: "Cancel return", tone: "danger",
      onConfirm: async (_checked, confirmedReason) => {
        setSaving(true);
        try {
          if (kind === "sales") await cancelCommerceSalesReturn(token, selected.id, confirmedReason?.trim() || reason.trim(), superAdmin);
          else await cancelCommercePurchaseReturn(token, selected.id, confirmedReason?.trim() || reason.trim(), superAdmin);
          toast.success(`${selected.number} cancelled; stock and ledger reversals were saved.`);
          setReturnId(""); setReason(""); await onSaved();
        } catch (error) { toast.error(error instanceof Error ? error.message : "The return could not be cancelled safely."); }
        finally { setSaving(false); }
      },
    });
  }

  return <section className="text-[#333]">
    <div className="flex items-center justify-between border-b border-[#d0ceca] px-3 py-2">
      <h2 className="flex items-center gap-2 text-sm font-normal"><Ban size={15} className="text-[#385989]" />{labelFor(kind === "sales" ? "Sales Return Cancel" : "Purchase Return Cancel")}</h2>
      <button type="button" onClick={onClose} className="flex items-center gap-1 px-1 text-xs hover:bg-[#e3e2df]" aria-label={labelFor("Exit")}>{labelFor("Exit")}<X size={13} /></button>
    </div>
    <div className="space-y-3 p-3">
      <p className="text-xs text-[#555]">{labelFor("Only approved returns appear here. Cancellation is blocked if the linked batch/ledger cannot be reversed safely.")}</p>
      <form onSubmit={cancel} className="space-y-2">
        <label className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm">{labelFor("Approved return")}<Select value={returnId} onChange={(event) => setReturnId(event.target.value)} required className="h-8 rounded-none border-[#9b9b9b] bg-white"><option value="">{labelFor("Select return")}</option>{eligible.map((row) => <option key={row.id} value={row.id}>{row.number} · {kind === "sales" ? (row as CommerceSalesReturn).customer : (row as CommercePurchaseReturn).supplier ?? "Supplier"} · {formatPlatformDate(row.date)}</option>)}</Select></label>
        <label className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm">{labelFor("Reason")}<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={labelFor("Required audit reason")} required className="h-8 rounded-none border-[#9b9b9b] bg-white" /></label>
        <div className="flex justify-end gap-1 border-t border-[#d0ceca] pt-2">
          <Button type="submit" variant="outline" disabled={!selected || saving} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{saving ? labelFor("Cancelling…") : labelFor("Cancel return")}</Button>
          <Button type="button" variant="outline" onClick={onClose} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{labelFor("Close")}</Button>
        </div>
      </form>
      {selected && <div className="border border-[#d0ceca] bg-white p-2 text-xs"><p><strong>{selected.number}</strong> · {kind === "sales" ? (selected as CommerceSalesReturn).customer : (selected as CommercePurchaseReturn).supplier}{kind === "sales" && <span className="ml-2 font-bold text-[#8a6200]">{labelFor((selected as CommerceSalesReturn).returnType === "EXPIRED" ? "Expired / quarantined" : "Standard")}</span>}</p><p className="mt-1 text-[#555]">{selected.items.map((item) => `${item.product ?? item.productId} × ${item.quantity} · batch ${item.batch}`).join("; ")}</p><p className="mt-1 font-bold">{selected.amount == null ? labelFor("Amount restricted") : money(selected.amount)}</p></div>}
      {!eligible.length && <p className="border border-[#d8cba0] bg-[#fff8e5] p-2 text-xs text-[#755900]">{labelFor("There are no approved returns available to cancel in the selected date and branch range.")}</p>}
    </div>
  </section>;
}
