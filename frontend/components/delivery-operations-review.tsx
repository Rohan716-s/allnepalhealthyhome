"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StaffShell, staffToken } from "@/components/staff-shell";
import { getDeliveryReviews, reviewDeliveryOperation, type DeliveryReviews } from "@/lib/delivery-operations-api";

export function DeliveryOperationsReview({ panel }: { panel: "accountant" | "pharmacist" }) {
  const [data, setData] = useState<DeliveryReviews | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [riders, setRiders] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const saving = useRef(false);
  const load = useCallback(async () => {
    try { setData(await getDeliveryReviews(staffToken())); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Reviews could not be loaded."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function review(kind: "handovers" | "retries", id: string, approve: boolean) {
    if (saving.current) return;
    if (!notes[id]?.trim()) { setError("Enter a review note before making a decision."); return; }
    if (approve && confirming !== id) { setConfirming(id); return; }
    saving.current = true; setBusy(id); setError(""); setSuccess("");
    try { await reviewDeliveryOperation(kind, id, { approve, note: notes[id].trim(), riderId: riders[id] || undefined }, staffToken()); setSuccess(approve ? "Request approved." : "Request rejected."); setConfirming(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Review could not be saved."); }
    finally { saving.current = false; setBusy(""); }
  }
  function controls(kind: "handovers" | "retries", id: string) {
    return <div className="mt-4"><label className="block text-sm font-bold">Review note<textarea maxLength={1000} value={notes[id] ?? ""} onChange={e => { setNotes(n => ({ ...n, [id]: e.target.value })); setConfirming(null); }} className="field mt-2" /></label>{confirming === id && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{kind === "handovers" ? "Confirm that you physically received and counted this cash. Approval posts the customer payments and cash handover." : "Approval returns this order to the selected rider’s assigned queue."}</p>}<div className="mt-3 flex flex-wrap gap-3"><button disabled={!!busy} onClick={() => void review(kind, id, true)} className="primary-btn">{busy === id ? "Saving…" : confirming === id ? "Confirm approval" : kind === "handovers" ? "Confirm cash received" : "Approve retry"}</button><button disabled={!!busy} onClick={() => void review(kind, id, false)} className="soft-btn">Reject</button>{confirming === id && <button className="soft-btn" onClick={() => setConfirming(null)}>Cancel</button>}</div></div>;
  }
  return <StaffShell panel={panel} title={panel === "accountant" ? "Delivery cash handovers" : "Delivery retry requests"} action={<button onClick={() => void load()} className="soft-btn">Refresh</button>}>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {success && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{success}</p>}
    {!data && !error && <p role="status" className="mt-4">Loading requests…</p>}
    {data && <div className="mt-5 grid gap-4">
      {panel === "accountant" ? <>{data.handovers.map(row => <article key={row.id} className="rounded-2xl border bg-white p-5 dark:bg-slate-900"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-extrabold">{row.rider}</h2><p className="mt-1 text-sm">{row.reference}</p></div><strong>NPR {row.amount.toLocaleString("en-IN")}</strong></div><p className="mt-3 text-xs font-bold">{row.status}</p>{row.reviewNote && <p className="mt-2 text-sm">{row.reviewNote}</p>}{row.status === "PENDING" && controls("handovers", row.id)}</article>)}{!data.handovers.length && <p className="text-sm text-slate-500">No delivery cash handovers to review.</p>}</> : <>{data.retries.map(row => <article key={row.id} className="rounded-2xl border bg-white p-5 dark:bg-slate-900"><h2 className="font-extrabold">{row.orderNumber}</h2><p className="mt-2 text-sm">{row.rider} · Requested {row.requestedDate.slice(0, 10)}</p><p className="mt-2 text-sm">{row.reason}</p><p className="mt-3 text-xs font-bold">{row.status}</p>{row.reviewNote && <p className="mt-2 text-sm">{row.reviewNote}</p>}{row.status === "PENDING" && <><label className="mt-4 block text-sm font-bold">Assign rider<select className="field mt-2" value={riders[row.id] ?? row.riderId ?? ""} onChange={e => { setRiders(r => ({ ...r, [row.id]: e.target.value })); setConfirming(null); }}>{data.riders.map(r => <option key={r.id} value={r.id}>{r.fullName}</option>)}</select></label>{controls("retries", row.id)}</>}</article>)}{!data.retries.length && <p className="text-sm text-slate-500">No delivery retry requests to review.</p>}</>}
    </div>}
  </StaffShell>;
}
