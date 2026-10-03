"use client";

import { FormEvent, useState } from "react";
import { Loader2, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminPayment, updateAdminPaymentStatus } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function AdminPaymentStatusDialog({ row, superAdmin, onSaved }: { row: AdminPayment; superAdmin: boolean; onSaved: (row: AdminPayment) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [providerReference, setProviderReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function reset() { setStatus(row.status); setProviderReference(""); setNotes(""); setError(""); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { const saved = await updateAdminPaymentStatus(row.id, { status, providerReference: providerReference || undefined, notes: notes || undefined }, window.localStorage.getItem("anhh-staff-access-token") ?? "", superAdmin); onSaved(saved); toast.success(`Payment for ${row.orderNumber} updated`); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Payment status could not be saved."); }
    finally { setSaving(false); }
  }
  const paid = row.status === "PAID" || row.status === "COMPLETED";
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) reset(); }}><DialogTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`Manage payment for ${row.orderNumber}`} title="Manage payment"><Pencil size={15} /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Manage payment</DialogTitle><DialogDescription>{row.orderNumber} · {row.customerName} · {row.method.replaceAll("_", " ")}</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4"><div className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Current status</span><Badge variant={row.status === "FAILED" || row.status === "REFUNDED" ? "destructive" : "default"}>{row.status}</Badge></div><p className="mt-2 font-extrabold text-slate-900">{row.amount.toLocaleString("en-NP", { style: "currency", currency: "NPR" })}</p></div><div className="grid gap-2"><Label htmlFor={`payment-status-${row.id}`}>New status</Label><Select id={`payment-status-${row.id}`} value={status} disabled={row.status === "REFUNDED"} onChange={event => setStatus(event.target.value)}><option value="PENDING">Pending</option><option value="PAID">Paid / verified</option><option value="FAILED">Failed</option>{paid && <option value="REFUNDED">Refunded</option>}</Select></div><div className="grid gap-2"><Label htmlFor={`payment-reference-${row.id}`}>Provider or collection reference <span className="font-normal text-slate-400">(optional for COD)</span></Label><Input id={`payment-reference-${row.id}`} value={providerReference} onChange={event => setProviderReference(event.target.value)} placeholder="Transaction ID or receipt number" /></div><div className="grid gap-2"><Label htmlFor={`payment-notes-${row.id}`}>Internal note</Label><Textarea id={`payment-notes-${row.id}`} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Verification or refund note" /></div><div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>Every payment change is recorded in the immutable audit log and mirrored to the customer notification history.</span></div>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}<Button type="submit" disabled={saving || row.status === "REFUNDED"} className="justify-center">{saving ? <Loader2 className="animate-spin" /> : <Pencil size={16} />}Save payment status</Button></form></DialogContent></Dialog>;
}
