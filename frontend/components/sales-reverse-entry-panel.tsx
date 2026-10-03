"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPlatformDate } from "@/lib/date-time";
import { getCommerceSaleByInvoice, type CommerceSale } from "@/services/api";

const money = (value: number) => `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalesReverseEntryPanel({ sales, token, superAdmin, busy, labelFor, onClose, onReverse }: {
  sales: CommerceSale[];
  token: string;
  superAdmin: boolean;
  busy: boolean;
  labelFor: (label: string) => string;
  onClose: () => void;
  onReverse: (sale: CommerceSale, reason: string) => Promise<void>;
}) {
  const [invoice, setInvoice] = useState("");
  const [reason, setReason] = useState("");
  const [lookedUpSale, setLookedUpSale] = useState<CommerceSale | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reverseError, setReverseError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const normalizedInvoice = invoice.trim().toLocaleLowerCase();
  const matches = useMemo(() => normalizedInvoice
    ? sales.filter((sale) => [sale.invoiceNumber, sale.number].some((value) => value?.toLocaleLowerCase().includes(normalizedInvoice))).slice(0, 8)
    : [], [normalizedInvoice, sales]);
  const localExactMatch = sales.find((sale) => [sale.invoiceNumber, sale.number].some((value) => value?.toLocaleLowerCase() === normalizedInvoice)) ?? null;
  const selected = lookedUpSale && [lookedUpSale.invoiceNumber, lookedUpSale.number].some((value) => value?.toLocaleLowerCase() === normalizedInvoice) ? lookedUpSale : localExactMatch;
  const findInvoice = async () => {
    const invoiceNumber = invoice.trim();
    if (!invoiceNumber) { setLookupError("Enter an invoice number first."); return; }
    if (localExactMatch) { setLookedUpSale(localExactMatch); setLookupError(""); return; }
    setLookupLoading(true);
    setLookupError("");
    try {
      const sale = await getCommerceSaleByInvoice(token, invoiceNumber, superAdmin);
      setLookedUpSale(sale);
    } catch (error) {
      setLookedUpSale(null);
      setLookupError(error instanceof Error ? error.message : "No accessible invoice was found with that number.");
    } finally {
      setLookupLoading(false);
    }
  };

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent overlayClassName="bg-slate-950/20" className="max-w-[390px] gap-0 rounded-sm border border-[#8b8b8b] bg-[#f2f1ef] p-0 shadow-lg [&>button:last-child]:hidden">
      <DialogHeader className="border-b border-[#d3d1ce] px-3 py-2 pr-10">
        <DialogTitle className="text-sm font-normal text-[#333]">{labelFor("Sales Reverse Entry")}</DialogTitle>
        <DialogDescription className="sr-only">Find a saved invoice, then provide a reversal remark.</DialogDescription>
      </DialogHeader>
      <button type="button" className="w-fit px-3 py-1 text-left text-xs text-[#444] hover:bg-[#e3e2df]" onClick={onClose}>{labelFor("Exit")}</button>
      <form className="space-y-2 px-3 pb-3" onSubmit={(event) => { event.preventDefault(); if (selected && reason.trim()) { setReverseError(""); setConfirmOpen(true); } }}>
        <div className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-2 text-sm text-[#333]">
          <label htmlFor="sales-reverse-invoice">{labelFor("Invoice No.")}</label>
          <Input id="sales-reverse-invoice" value={invoice} onChange={(event) => { setInvoice(event.target.value); setLookedUpSale(null); setLookupError(""); }} list="sales-reverse-invoices" autoComplete="off" placeholder="" className="h-8 rounded-none border-[#9b9b9b] bg-white px-2" required />
          <Button type="button" variant="outline" onClick={() => void findInvoice()} disabled={!invoice.trim() || lookupLoading || busy} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] px-3 text-sm text-[#333] shadow-sm hover:bg-white">{lookupLoading ? "Searching…" : "Find"}</Button>
        </div>
        <datalist id="sales-reverse-invoices">{matches.map((sale) => <option key={sale.id} value={sale.invoiceNumber || sale.number}>{sale.customer} · {formatPlatformDate(sale.date)}</option>)}</datalist>
        <label className="block space-y-1 text-sm text-[#333]">{labelFor("Remarks")}<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="h-8 rounded-none border-[#9b9b9b] bg-white px-2" required /></label>
        {selected && <p role="status" className="text-xs text-[#555]">{selected.customer} · {formatPlatformDate(selected.date)} · {money(selected.total)} · {selected.branch || "Branch not recorded"}</p>}
        {lookupError && <p role="alert" className="text-xs text-red-700">{lookupError}</p>}
        {reverseError && <p role="alert" className="text-xs text-red-700">{reverseError}</p>}
        <DialogFooter className="grid grid-cols-2 gap-1 border-t border-[#d3d1ce] pt-2 sm:flex-row sm:justify-between">
          <Button type="submit" variant="outline" disabled={!selected || !reason.trim() || busy || lookupLoading} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{busy ? "Processing…" : labelFor("Reverse")}</Button>
          <Button type="button" variant="outline" onClick={onClose} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{labelFor("Close")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
    <Dialog open={confirmOpen && !!selected} onOpenChange={(open) => { if (!busy) setConfirmOpen(open); }}>
      <DialogContent overlayClassName="z-[80] bg-slate-950/40" className="z-[90] max-w-[460px] gap-0 rounded-sm border border-[#888] bg-[#f2f1ef] p-0 text-[#333] shadow-xl [&>button:last-child]:hidden">
        <DialogHeader className="border-b border-[#d3d1ce] px-3 py-2 pr-10"><DialogTitle className="text-sm font-normal">Are You Sure?</DialogTitle><DialogDescription className="sr-only">Review the invoice summary and confirm its reversal.</DialogDescription></DialogHeader>
        {selected && <div className="space-y-3 p-3">
          <div className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 border border-[#c9c7c3] bg-white p-3 text-xs">
            <span>Date</span><strong>{formatPlatformDate(selected.date)}</strong>
            <span>Invoice No.</span><strong>{selected.invoiceNumber || selected.number}</strong>
            <span>To</span><strong>{selected.customer}</strong>
            <span>Amount</span><strong>{money((selected.subtotal ?? selected.total - (selected.taxAmount ?? 0)) + (selected.discountAmount ?? 0))}</strong>
            <span>Discount</span><strong>{money(selected.discountAmount ?? 0)}</strong>
            <span>VAT</span><strong>{money(selected.taxAmount ?? 0)}</strong>
            <span>Freight</span><strong>NPR 0.00</strong>
            <span className="border-t border-[#ddd] pt-1 font-semibold">Net</span><strong className="border-t border-[#ddd] pt-1">{money(selected.total)}</strong>
          </div>
          <div className="border border-[#c9c7c3] bg-white px-3 py-2 text-xs"><span className="text-[#666]">Remarks</span><p className="mt-1 break-words font-medium">{reason.trim()}</p></div>
          <p className="text-xs leading-5 text-[#555]">Reversing this invoice restores its unreturned stock and reverses the customer balance. This action is recorded in the audit log.</p>
          <DialogFooter className="grid grid-cols-2 gap-2 border-t border-[#d3d1ce] pt-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">No</Button>
            <Button type="button" disabled={busy} onClick={() => { void onReverse(selected, reason.trim()).then(() => setConfirmOpen(false)).catch((error: unknown) => { setConfirmOpen(false); setReverseError(error instanceof Error ? error.message : "The sale could not be reversed."); }); }} className="h-8 rounded-none bg-[#315889] text-sm text-white hover:bg-[#264b79]">{busy ? "Reversing…" : "Yes, Reverse"}</Button>
          </DialogFooter>
        </div>}
      </DialogContent>
    </Dialog>
  </Dialog>;
}
