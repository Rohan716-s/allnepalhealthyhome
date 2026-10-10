"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type StaffOrder } from "@/services/api";
import { staffToken } from "@/components/staff-shell";
import { getDeliveryCash, getDeliveryRetries, recordDeliveryCash, requestDeliveryRetry, type DeliveryRetry } from "@/lib/delivery-operations-api";

export function DeliveryOrderOperations({ order }: { order: StaffOrder }) {
  const [collected, setCollected] = useState<number | null>(null);
  const [retries, setRetries] = useState<DeliveryRetry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const saving = useRef(false);
  const [pendingRetry, setPendingRetry] = useState<{ requestId: string; requestedDate: string; reason: string } | null>(null);
  const due = order.amountDue;
  const status = order.delivery?.status;
  const load = useCallback(async () => {
    try {
      if (order.paymentMethod === "CASH_ON_DELIVERY") {
        const cash = await getDeliveryCash(staffToken());
        setCollected(cash.collections.find(x => x.orderId === order.id)?.amount ?? null);
      }
      if (status === "FAILED") setRetries((await getDeliveryRetries(staffToken())).filter(x => x.orderId === order.id));
      setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Delivery operations could not be loaded."); }
  }, [order.id, order.paymentMethod, status]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function collect() {
    if (saving.current || due == null || !confirmed) return;
    saving.current = true; setBusy(true); setError("");
    try { await recordDeliveryCash(order.id, due, staffToken()); setSuccess("Cash recorded. Submit it from My cash for accountant confirmation."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Cash could not be recorded."); }
    finally { saving.current = false; setBusy(false); }
  }
  async function retry(event: React.FormEvent) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError("");
    const payload = pendingRetry ?? { requestId: crypto.randomUUID(), requestedDate: date, reason: reason.trim() };
    setPendingRetry(payload);
    try { await requestDeliveryRetry(order.id, payload, staffToken()); setPendingRetry(null); setSuccess("Retry requested. Branch staff must approve before you attempt delivery again."); await load(); }
    catch (e) { if (e instanceof ApiError && e.status >= 400 && e.status < 500) setPendingRetry(null); setError(e instanceof Error ? e.message : "Retry could not be requested."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="mt-4 rounded-2xl border bg-white p-5 dark:bg-slate-900">
    {error && <p role="alert" className="mb-3 text-sm text-rose-700">{error} <button className="underline" onClick={() => void load()}>Reload</button></p>}
    {success && <p role="status" className="mb-3 text-sm text-emerald-700">{success}</p>}
    {order.paymentMethod === "CASH_ON_DELIVERY" ? <>
      <p className="text-xs font-bold text-slate-500">{collected != null ? "Cash already recorded — do not collect again" : "Amount to collect"}</p>
      <p className="mt-1 text-2xl font-extrabold">{due == null ? "Refresh to check balance" : `NPR ${(collected != null ? 0 : due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}</p>
      {collected != null && <p className="mt-2 text-sm">Recorded NPR {collected.toLocaleString("en-IN")}. <Link className="font-bold text-teal-700 underline" href="/delivery/cash">View My cash</Link></p>}
      {status === "DELIVERED" && loaded && collected == null && due != null && due > 0 && <div className="mt-4"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />I received the full amount in cash from this customer.</label><button disabled={busy || !confirmed} className="primary-btn mt-3 disabled:opacity-50" onClick={() => void collect()}>{busy ? "Saving…" : "Record received cash"}</button></div>}
    </> : <><p className="text-xs font-bold text-slate-500">Payment</p><p className="mt-1 font-bold">{order.paymentStatus === "PAID" ? "Already paid — no cash to collect" : "Use the order's payment instructions; no cash collection recorded here."}</p></>}
    {status === "FAILED" && <div className="mt-5 border-t pt-4"><h2 className="font-extrabold">Request another delivery attempt</h2><p className="mt-2 text-sm text-slate-500">Choose the customer’s requested date. Staff approve on that date and can assign another rider.</p>{retries.map(row => <p key={row.id} className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">{row.requestedDate.slice(0, 10)} · {row.status}{row.reviewNote && ` · ${row.reviewNote}`}</p>)}{loaded && !retries.some(x => x.status === "PENDING") && <form onSubmit={retry} className="mt-4 grid gap-3"><label className="text-sm font-bold">Requested date<input required type="date" value={date} disabled={busy || !!pendingRetry} onChange={e => setDate(e.target.value)} className="field mt-2" /></label><label className="text-sm font-bold">Reason / customer agreement<textarea required maxLength={1000} value={reason} disabled={busy || !!pendingRetry} onChange={e => setReason(e.target.value)} className="field mt-2" /></label><button disabled={busy} className="primary-btn justify-center">{busy ? "Submitting…" : pendingRetry ? "Retry submission" : "Request retry"}</button></form>}</div>}
  </section>;
}
