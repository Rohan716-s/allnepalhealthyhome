"use client";

import Link from "next/link";
import { ApiError } from "@/services/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { StaffShell, staffToken } from "@/components/staff-shell";
import { getDeliveryCash, submitDeliveryHandover, type DeliveryCashSummary } from "@/lib/delivery-operations-api";
import { formatNepalDateTime } from "@/lib/date-time";

const money = (n: number) => `NPR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
export function DeliveryCashPage() {
  const [data, setData] = useState<DeliveryCashSummary | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ requestId: string; reference: string } | null>(null);
  const saving = useRef(false);
  const load = useCallback(async () => {
    try { setData(await getDeliveryCash(staffToken())); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Cash could not be loaded."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError(""); setSuccess("");
    const payload = pending ?? { requestId: crypto.randomUUID(), reference: reference.trim() };
    setPending(payload);
    try {
      await submitDeliveryHandover(payload, staffToken()); setPending(null); setReference("");
      setSuccess("Handover submitted. Give the cash to your branch accountant for confirmation."); await load();
    } catch (e) { if (e instanceof ApiError && e.status >= 400 && e.status < 500) setPending(null); setError(e instanceof Error ? e.message : "Handover could not be submitted. Retry to confirm the same request."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <StaffShell panel="delivery" title="My cash" action={<button className="soft-btn" onClick={() => void load()}>Refresh</button>}>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {success && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{success}</p>}
    {!data && !error && <p role="status" className="mt-4">Loading cash…</p>}
    {data && <>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ["Recorded collections", data.collected], ["Ready to hand over", data.available], ["Awaiting confirmation", data.pending], ["Confirmed handovers", data.confirmed],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-extrabold">{money(Number(value))}</p></div>)}</div>
      <p className="mt-4 text-sm text-slate-500">All amounts cover recorded collections across your history. <Link className="font-bold text-teal-700 underline" href="/delivery/orders?status=DELIVERED">Open delivered orders to record received cash</Link>.</p>
      <form onSubmit={submit} className="mt-5 rounded-2xl border bg-white p-5 dark:bg-slate-900">
        <h2 className="font-extrabold">Submit cash handover</h2><p className="mt-2 text-sm text-slate-500">Includes all your unsubmitted collections in your current branch. The accountant confirms receipt before payments are posted.</p>
        <label className="mt-4 block text-sm font-bold">Handover reference<input required maxLength={120} value={reference} disabled={busy || !!pending} onChange={e => setReference(e.target.value)} className="field mt-2" placeholder="Cash bag, shift, or receipt reference" /></label>
        <button disabled={busy || (data.available <= 0 && !pending)} className="primary-btn mt-4 disabled:opacity-50">{busy ? "Submitting…" : pending ? "Retry handover confirmation" : `Submit ${money(data.available)}`}</button>
      </form>
      <section className="mt-5 rounded-2xl border bg-white p-5 dark:bg-slate-900"><h2 className="font-extrabold">Handover history</h2><div className="mt-3 grid gap-3">{data.handovers.map(row => <article key={row.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{money(row.amount)}</strong><span className="text-xs font-bold">{row.status}</span></div><p className="mt-2 text-sm">{row.reference}</p><p className="mt-1 text-xs text-slate-500">{formatNepalDateTime(row.createdAt)}</p>{row.reviewNote && <p className="mt-2 text-sm">Accountant: {row.reviewNote}</p>}</article>)}{!data.handovers.length && <p className="text-sm text-slate-500">No handovers submitted yet.</p>}</div></section>
      <section className="mt-5 rounded-2xl border bg-white p-5 dark:bg-slate-900"><h2 className="font-extrabold">Recorded collections</h2><div className="mt-3 grid gap-3">{data.collections.map(row => <article key={row.id} className="flex flex-wrap justify-between gap-3 rounded-xl border p-3"><div><Link className="font-bold text-teal-700" href={`/delivery/orders/${row.orderId}`}>{row.orderNumber}</Link><p className="mt-1 text-xs text-slate-500">{row.handoverRequestId ? "Included in handover" : "Ready to hand over"}</p></div><strong>{money(row.amount)}</strong></article>)}{!data.collections.length && <p className="text-sm text-slate-500">Record received cash from a delivered cash-on-delivery order.</p>}</div></section>
    </>}
  </StaffShell>;
}
