"use client";

import Link from "next/link";
import { BarChart3, ClipboardList, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { StaffShell, staffToken } from "@/components/staff-shell";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, getSalesExecutiveDashboard, type SalesExecutiveDashboard } from "@/services/api";
import { formatPlatformDate } from "@/lib/date-time";
import { formatNPR } from "@/lib/catalog";

const defaultFrom = () => { const date = new Date(); date.setDate(date.getDate() - 29); return date.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default function SalesExecutiveDashboardPage() {
  const [initialRange] = useState(() => ({ from: defaultFrom(), to: today() }));
  const [data, setData] = useState<SalesExecutiveDashboard | null>(null);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    getSalesExecutiveDashboard(staffToken(), from, to)
      .then(setData)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Sales dashboard could not be loaded."));
  };
  useEffect(() => {
    let active = true;
    getSalesExecutiveDashboard(staffToken(), initialRange.from, initialRange.to)
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message : "Sales dashboard could not be loaded."); });
    return () => { active = false; };
  }, [initialRange]);
  return <StaffShell panel="sales-executive" title="Sales Executive dashboard" action={<button onClick={load} className="soft-btn"><RefreshCw size={15} /> Refresh</button>}>
    <div className="mt-7 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"><label className="grid gap-1 text-xs font-bold text-slate-500">From<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="field" /></label><label className="grid gap-1 text-xs font-bold text-slate-500">To<input type="date" value={to} onChange={event => setTo(event.target.value)} className="field" /></label><button onClick={load} className="primary-btn">Apply range</button></div>
    {error && <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2"><Card><CardContent className="p-6"><div className="flex items-center gap-3 text-teal-700"><ClipboardList size={20} /><span className="text-sm font-bold">Assigned orders</span></div><p className="mt-3 text-3xl font-extrabold">{data?.totalOrders ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Orders containing your assigned products</p></CardContent></Card><Card><CardContent className="p-6"><div className="flex items-center gap-3 text-teal-700"><BarChart3 size={20} /><span className="text-sm font-bold">Relevant sales value</span></div><p className="mt-3 text-3xl font-extrabold">{data ? formatNPR(data.totalSalesValue) : "—"}</p><p className="mt-1 text-xs text-slate-500">Based on the selected date range</p></CardContent></Card></div>
    <Card className="mt-6"><CardContent className="p-0"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold">Recent assigned orders</h2><Link href="/sales-executive/orders" className="text-xs font-extrabold text-teal-700">Open order list →</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Assigned products</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.recentOrders.map(order => <tr key={order.id}><td className="px-5 py-4 font-bold">{order.orderNumber}<p className="text-xs font-normal text-slate-400">{formatPlatformDate(order.createdAt)}</p></td><td className="px-5 py-4">{order.customerName}</td><td className="px-5 py-4 text-xs">{order.items.map(item => `${item.productName} × ${item.quantity}`).join(", ")}</td><td className="px-5 py-4 text-xs text-slate-500">{order.branchName ?? "—"}</td><td className="px-5 py-4 font-bold">{formatNPR(order.relevantSalesValue)}</td><td className="px-5 py-4"><span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-800">{order.status}</span></td></tr>)}</tbody></table></div>{data && !data.recentOrders.length && <p className="px-5 py-12 text-center text-sm text-slate-500">No assigned orders are in this date range.</p>}</CardContent></Card>
  </StaffShell>;
}
