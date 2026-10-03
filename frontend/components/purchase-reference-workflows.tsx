"use client";

import { useState } from "react";
import { FilePenLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { formatPlatformDate } from "@/lib/date-time";
import { updateCommercePurchaseAdditionalInfo, voidCommercePurchase, type CommercePurchase } from "@/services/api";

export function PurchaseAdditionalInfoEditor({ purchases, token, superAdmin, onClose, onSaved }: {
  purchases: CommercePurchase[]; token: string; superAdmin: boolean; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [purchaseId, setPurchaseId] = useState("");
  const selectable = purchases.filter((row) => row.status.toUpperCase() !== "CANCELLED");
  const purchase = selectable.find((row) => row.id === purchaseId) ?? selectable[0];
  const [invoiceNumber, setInvoiceNumber] = useState<string | undefined>();
  const [notes, setNotes] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!purchase) return;
    setSaving(true);
    try {
      await updateCommercePurchaseAdditionalInfo(token, purchase.id, { supplierInvoiceNumber: invoiceNumber ?? purchase.supplierInvoiceNumber, notes: notes ?? purchase.notes }, superAdmin);
      toast.success("Purchase reference and notes saved. Stock and financial amounts were not changed.");
      await onSaved(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Purchase information could not be saved."); }
    finally { setSaving(false); }
  }
  return <Card className="border-[#003893]/25"><CardHeader><CardTitle className="flex items-center gap-3"><FilePenLine size={19} className="text-[#003893]" /><span className="min-w-0 flex-1">Purchase Additional Information Edit</span><Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X size={17} /></Button></CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-4 md:grid-cols-2"><label className="space-y-1 text-xs font-bold text-slate-600 md:col-span-2">Purchase receipt<Select value={purchase?.id ?? ""} onChange={(event) => { setPurchaseId(event.target.value); setInvoiceNumber(undefined); setNotes(undefined); }} required><option value="">Select receipt</option>{purchases.filter((row) => row.status.toUpperCase() !== "CANCELLED").map((row) => <option key={row.id} value={row.id}>{row.number} · {row.supplier} · {formatPlatformDate(row.date)}</option>)}</Select></label><label className="space-y-1 text-xs font-bold text-slate-600">Supplier invoice / reference<Input value={invoiceNumber ?? purchase?.supplierInvoiceNumber ?? ""} onChange={(event) => setInvoiceNumber(event.target.value)} maxLength={80} /></label><label className="space-y-1 text-xs font-bold text-slate-600">Notes<Input value={notes ?? purchase?.notes ?? ""} onChange={(event) => setNotes(event.target.value)} maxLength={1000} /></label><p className="text-xs text-slate-500 md:col-span-2">This updates the linked supplier reference and notes only. Received quantities, batch balances, invoice amounts, and payments are not edited here.</p><div className="md:col-span-2"><Button type="submit" disabled={!purchase || saving}>{saving ? "Saving…" : "Save additional information"}</Button></div></form></CardContent></Card>;
}

export function PurchaseCorrectionPanel({ purchases, token, superAdmin, onClose, onSaved, onCorrect }: {
  purchases: CommercePurchase[]; token: string; superAdmin: boolean; onClose: () => void; onSaved: () => Promise<void>; onCorrect: (purchase: CommercePurchase) => void;
}) {
  const [purchaseId, setPurchaseId] = useState("");
  const selectable = purchases.filter((row) => row.status.toUpperCase() !== "CANCELLED");
  const purchase = selectable.find((row) => row.id === purchaseId) ?? selectable[0];
  const canRecreate = Boolean(purchase?.supplierId && purchase.items.length && purchase.items.every((item) => item.unitCost != null));
  const [busy, setBusy] = useState(false);
  function reverseAndPrepare() {
    if (!purchase) return;
    requestSiteConfirmation({ title: `Reverse ${purchase.number}?`, message: "The posted receipt, stock batches and payable are reversed together. If the purchase has been paid or its stock has since been consumed, the server will refuse the reversal and leave it unchanged.", inputLabel: "Correction reason", inputPlaceholder: "Explain the correction", inputRequired: true, confirmLabel: "Reverse and prepare replacement", tone: "danger", onConfirm: async (_checked, reason) => {
      setBusy(true);
      try { await voidCommercePurchase(token, purchase.id, reason?.trim() || "Purchase correction", superAdmin); await onSaved(); toast.success("Original purchase reversed. Review the prefilled replacement before saving it."); onCorrect(purchase); }
      catch (error) { toast.error(error instanceof Error ? error.message : "The purchase could not be safely reversed."); }
      finally { setBusy(false); }
    } });
  }
  return <Card className="border-amber-300"><CardHeader><CardTitle className="flex items-center gap-3"><FilePenLine size={19} className="text-amber-700" /><span className="min-w-0 flex-1">Correct a posted purchase</span><Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X size={17} /></Button></CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-600">Posted purchase lines cannot be edited in place. This controlled correction reverses the original only if no supplier payment or stock constraint prevents it, then pre-fills a replacement receipt for review.</p><label className="block max-w-2xl space-y-1 text-xs font-bold text-slate-600">Purchase to correct<Select value={purchase?.id ?? ""} onChange={(event) => setPurchaseId(event.target.value)}><option value="">Select purchase</option>{selectable.map((row) => <option key={row.id} value={row.id}>{row.number} · {row.supplier} · {formatPlatformDate(row.date)}</option>)}</Select></label>{purchase && <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Product</th><th className="p-3">Batch</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Cost</th></tr></thead><tbody>{purchase.items.map((item, index) => <tr className="border-b" key={`${item.productId}-${index}`}><td className="p-3">{item.product}</td><td className="p-3">{item.batch || "—"}</td><td className="p-3 text-right">{item.quantity} {item.unit || "base"}</td><td className="p-3 text-right">{item.unitCost == null ? "Restricted" : `NPR ${item.unitCost.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`}</td></tr>)}</tbody></table></div>}{purchase && !canRecreate && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">This user cannot see the required supplier, product cost, or received line data, so the system will not reverse a purchase it cannot prefill accurately.</p>}<Button variant="destructive" disabled={!canRecreate || busy} onClick={reverseAndPrepare}>{busy ? "Reversing…" : "Reverse and prepare replacement"}</Button></CardContent></Card>;
}
