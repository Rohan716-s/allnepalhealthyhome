"use client";

import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { StaffShell, staffToken } from "@/components/staff-shell";
import { ApiError, getSalesExecutiveOrders, updateSalesExecutiveOrderStatus, type SalesExecutiveOrdersResponse } from "@/services/api";
import { formatPlatformDate } from "@/lib/date-time";
import { formatNPR } from "@/lib/catalog";

const statuses = ["PENDING", "PRESCRIPTION_VERIFICATION", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"];
const nextStatus: Record<string, string> = { PENDING: "CONFIRMED", PRESCRIPTION_VERIFICATION: "CONFIRMED", CONFIRMED: "PREPARING", PREPARING: "READY_FOR_PICKUP" };

export default function SalesExecutiveOrdersPage() {
  const [data, setData] = useState<SalesExecutiveOrdersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = () => {
    setError("");
    getSalesExecutiveOrders(staffToken(), { search: search || undefined, status: status || undefined })
      .then(setData)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Assigned orders could not be loaded."));
  };
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      getSalesExecutiveOrders(staffToken(), { search: search || undefined, status: status || undefined })
        .then((result) => { if (active) setData(result); })
        .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message : "Assigned orders could not be loaded."); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, status]);
  async function advance(id: string, next: string) { setBusy(id); setError(""); try { await updateSalesExecutiveOrderStatus(id, { status: next }, staffToken()); load(); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Order status could not be updated."); } finally { setBusy(""); } }
  return <StaffShell panel="sales-executive" title="Assigned orders" action={<button onClick={load} className="soft-btn"><RefreshCw size={15} /> Refresh</button>}>
    <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"><div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={16} className="text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => event.key === "Enter" && load()} className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search order or customer" /></div><select value={status} onChange={event => setStatus(event.target.value)} className="field sm:max-w-60"><option value="">All statuses</option>{statuses.map(item => <option key={item}>{item}</option>)}</select><button onClick={load} className="primary-btn justify-center">Search</button></div>
    {error && <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Assigned products</th><th className="px-5 py-4">Branch</th><th className="px-5 py-4">Value</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.items.map(order => <tr key={order.id} className="align-top hover:bg-slate-50"><td className="px-5 py-4 font-extrabold">{order.orderNumber}<p className="mt-1 text-xs font-normal text-slate-400">{formatPlatformDate(order.createdAt)}</p></td><td className="px-5 py-4"><p className="font-bold">{order.customerName}</p><p className="text-xs text-slate-400">{order.customerPhone ?? ""}</p></td><td className="px-5 py-4 text-xs">{order.items.map(item => <p key={item.productId}>{item.productName} × {item.quantity}</p>)}</td><td className="px-5 py-4 text-xs text-slate-500">{order.branchName ?? "—"}</td><td className="px-5 py-4 font-bold">{formatNPR(order.relevantSalesValue)}</td><td className="px-5 py-4"><span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-800">{order.status}</span></td><td className="px-5 py-4">{nextStatus[order.status] ? <button disabled={busy === order.id} onClick={() => void advance(order.id, nextStatus[order.status])} className="primary-btn whitespace-nowrap text-xs">{busy === order.id ? "Saving…" : `Mark ${nextStatus[order.status].replaceAll("_", " ")}`}</button> : <span className="text-xs text-slate-400">No action</span>}</td></tr>)}</tbody></table></div>{data?.items.length === 0 && <div className="px-6 py-20 text-center"><ClipboardList className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-extrabold">No assigned orders found.</p></div>}</div>
  </StaffShell>;
}
