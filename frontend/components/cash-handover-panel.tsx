"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, FileDown, Printer, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { formatPlatformDateTime } from "@/lib/date-time";
import { createCashHandover, getCashHandoverStaff, getCashHandovers, type AdminBranch, type CashHandoverRecord, type CashHandoverStaff } from "@/services/api";
import { staffUser } from "@/components/staff-shell";

const money = (value: number) => `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CashHandoverPanel({ title, token, superAdmin, branchId, branches, from, to, onClose }: {
  title: string;
  token: string;
  superAdmin: boolean;
  branchId: string;
  branches: AdminBranch[];
  from: string;
  to: string;
  onClose: () => void;
}) {
  const [branchInput, setBranchInput] = useState("");
  const effectiveBranchId = branchId || branchInput;
  const [staff, setStaff] = useState<CashHandoverStaff[]>([]);
  const [records, setRecords] = useState<CashHandoverRecord[]>([]);
  const [senderId, setSenderId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cashier = staff.find((row) => row.id === senderId);
  const tellerOptions = useMemo(() => staff.filter((row) => row.id !== senderId), [senderId, staff]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const [staffRows, handovers] = await Promise.all([
        getCashHandoverStaff(token, effectiveBranchId || undefined, superAdmin),
        getCashHandovers(token, { from: from || undefined, to: to || undefined, branchId: effectiveBranchId || undefined }, superAdmin),
      ]);
      setStaff(staffRows); setRecords(handovers);
      const currentStaffId = staffUser()?.id;
      setSenderId((current) => {
        if (!superAdmin && currentStaffId && staffRows.some((row) => row.id === currentStaffId)) return currentStaffId;
        return staffRows.some((row) => row.id === current) ? current : staffRows[0]?.id ?? "";
      });
      setReceiverId((current) => staffRows.some((row) => row.id === current && row.id !== senderId) ? current : "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cash handover records could not be loaded.");
    } finally { setLoading(false); }
  }, [effectiveBranchId, from, senderId, superAdmin, to, token]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function recordHandover(event: React.FormEvent) {
    event.preventDefault();
    if (!effectiveBranchId || !senderId || !receiverId || !reference.trim() || Number(amount) <= 0) {
      toast.error("Choose a branch, cashier, receiving teller and a positive amount; enter a reference."); return;
    }
    const senderName = cashier?.fullName || "Cashier";
    const tellerName = staff.find((row) => row.id === receiverId)?.fullName || "Teller";
    requestSiteConfirmation({ title: "Confirm cash handover", message: `${money(Number(amount))} will be recorded from ${senderName} to ${tellerName}. A matching accounting journal entry will be posted.`, confirmLabel: "Record handover", onConfirm: async () => {
      setSaving(true);
      try {
        await createCashHandover(token, { branchId: effectiveBranchId, receivedByStaffUserId: receiverId, ...(superAdmin ? { handedByStaffUserId: senderId } : {}), amount: Number(amount), reference: reference.trim(), notes: notes.trim() || undefined }, superAdmin);
        toast.success("Cash handover recorded and posted to the ledger."); setAmount(""); setReference(""); setNotes(""); await load();
      } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Cash handover could not be saved."); }
      finally { setSaving(false); }
    } });
  }

  function exportCsv() {
    const headings = ["Date / time", "Handover no.", "Branch", "Cashier", "Teller", "Reference", "Amount (NPR)", "Status"];
    const values = records.map((row) => [row.handoverAt, row.handoverNumber, row.branch ?? "", row.handedBy, row.receivedBy, row.reference, row.amount.toFixed(2), row.status]);
    const csv = [headings, ...values].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "cash-handovers.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <Card className="border-[#003893]/25">
    <CardHeader><CardTitle className="flex flex-wrap items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#003893]"><ArrowLeftRight size={18} /></span><span className="min-w-0 flex-1">{title}</span><Button variant="outline" onClick={exportCsv}><FileDown size={15} /> Export CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</Button><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close cash handover"><X size={17} /></Button></CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <form onSubmit={recordHandover} className="grid gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-6">
        {(!branchId || superAdmin) && <label className="block space-y-1 text-xs font-bold text-slate-600 xl:col-span-2">Branch<Select value={effectiveBranchId} onChange={(event) => setBranchInput(event.target.value)} required><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>}
        {superAdmin ? <label className="block space-y-1 text-xs font-bold text-slate-600">Cashier<Select value={senderId} onChange={(event) => { setSenderId(event.target.value); setReceiverId(""); }} required><option value="">Select cashier</option>{staff.map((row) => <option key={row.id} value={row.id}>{row.fullName} · {row.role}</option>)}</Select></label> : <label className="block space-y-1 text-xs font-bold text-slate-600">Cashier<Input value={cashier?.fullName || "Loading your staff account…"} readOnly /></label>}
        <label className="block space-y-1 text-xs font-bold text-slate-600">Receiving teller<Select value={receiverId} onChange={(event) => setReceiverId(event.target.value)} required><option value="">Select teller</option>{tellerOptions.map((row) => <option key={row.id} value={row.id}>{row.fullName} · {row.role}</option>)}</Select></label>
        <label className="block space-y-1 text-xs font-bold text-slate-600">Amount (NPR)<Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label className="block space-y-1 text-xs font-bold text-slate-600 xl:col-span-2">Reference<Input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} placeholder="Cash count / shift / voucher reference" required /></label>
        <label className="block space-y-1 text-xs font-bold text-slate-600 xl:col-span-4">Notes<Input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Optional handover notes" /></label>
        <div className="flex items-end"><Button type="submit" disabled={saving || staff.length < 2 || !effectiveBranchId}>{saving ? "Recording…" : "Record handover"}</Button></div>
        <p className="text-xs text-slate-500 md:col-span-2 xl:col-span-6">Handover records are retained for audit and post a balanced journal: Debit Cash at Teller / Credit Cash. Posted entries are not deleted from the ledger.</p>
      </form>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Date / time</th><th className="p-3">Handover no.</th><th className="p-3">Branch</th><th className="p-3">Cashier</th><th className="p-3">Teller</th><th className="p-3">Reference</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th></tr></thead><tbody>{records.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-3">{formatPlatformDateTime(row.handoverAt)}</td><td className="p-3 font-mono">{row.handoverNumber}</td><td className="p-3">{row.branch || "—"}</td><td className="p-3">{row.handedBy}</td><td className="p-3">{row.receivedBy}</td><td className="p-3">{row.reference}{row.notes && <span className="block text-xs text-slate-500">{row.notes}</span>}</td><td className="p-3 text-right font-bold">{money(row.amount)}</td><td className="p-3">{row.status}</td></tr>)}{!records.length && <tr><td colSpan={8} className="p-8 text-center text-slate-500">{loading ? "Loading handover records…" : "No recorded handovers in this date and branch range."}</td></tr>}</tbody></table></div>
    </CardContent>
  </Card>;
}
