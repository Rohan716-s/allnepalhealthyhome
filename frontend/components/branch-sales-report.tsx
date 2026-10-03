"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, ChevronRight, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPlatformDate } from "@/lib/date-time";
import { getAdminBranches, getBranchSalesReport, type AdminBranch, type BranchSalesReport } from "@/services/api";

const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
const money = (value: number) => `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`;

export function BranchSalesReport() {
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [report, setReport] = useState<BranchSalesReport | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  async function load(nextBranch = branchId) {
    const accessToken = token(); if (!accessToken) return;
    setLoading(true);
    try { setReport(await getBranchSalesReport(accessToken, true, from || undefined, to || undefined, nextBranch || undefined)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Branch sales could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const accessToken = token();
    if (!accessToken) return;
    let active = true;
    getAdminBranches(accessToken, true, true)
      .then((rows) => { if (active) setBranches(rows); })
      .catch(() => toast.error("Branches could not be loaded."));
    getBranchSalesReport(accessToken, true)
      .then((result) => { if (active) setReport(result); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Branch sales could not be loaded."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const details = report?.orders.filter(order => !selected || order.branchId === selected) ?? [];
  return <AdminShell superAdmin>
    <div className="mb-7"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">Superadmin reports</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Branch-wise sales</h1><p className="mt-2 text-sm text-slate-500">Compare branch performance and drill into every order by date range.</p></div>
    <Card className="mb-6"><CardContent className="grid gap-4 p-5 sm:grid-cols-4 sm:items-end"><label className="grid gap-2 text-xs font-bold text-slate-600">From<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="grid gap-2 text-xs font-bold text-slate-600">To<input type="date" value={to} onChange={event => setTo(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="grid gap-2 text-xs font-bold text-slate-600">Branch<select value={branchId} onChange={event => { setBranchId(event.target.value); setSelected(event.target.value || null); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><button type="button" onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#003893] px-4 text-sm font-bold text-white hover:bg-[#002b70]">{loading ? <Loader2 className="animate-spin" size={16} /> : <CalendarDays size={16} />} Apply filters</button></CardContent></Card>
    {report && <><div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total sales</p><p className="mt-2 text-2xl font-black text-[#003893]">{money(report.branches.reduce((sum, branch) => sum + branch.totalSales, 0))}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Orders</p><p className="mt-2 text-2xl font-black">{report.branches.reduce((sum, branch) => sum + branch.orderCount, 0)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Customers</p><p className="mt-2 text-2xl font-black">{new Set(report.orders.map(order => order.customerName)).size}</p></CardContent></Card></div><Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 size={18} className="text-[#DC143C]" />Branch comparison</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Total sales</th><th className="px-3 py-3">Orders</th><th className="px-3 py-3">Customers</th><th className="px-3 py-3" /></tr></thead><tbody>{report.branches.map(branch => <tr key={branch.branchId ?? branch.branchName} className={`border-b last:border-0 ${selected === branch.branchId ? "bg-blue-50" : ""}`}><td className="px-3 py-4 font-bold">{branch.branchName}</td><td className="px-3 py-4 font-extrabold text-[#003893]">{money(branch.totalSales)}</td><td className="px-3 py-4">{branch.orderCount}</td><td className="px-3 py-4"><span className="inline-flex items-center gap-1"><Users size={14} />{branch.customers.length}</span></td><td className="px-3 py-4 text-right"><button type="button" onClick={() => setSelected(branch.branchId ?? null)} className="inline-flex items-center gap-1 text-xs font-bold text-[#003893]">Details <ChevronRight size={14} /></button></td></tr>)}</tbody></table></div>{!report.branches.length && <p className="py-12 text-center text-sm text-slate-500">No sales were recorded for this range.</p>}</CardContent></Card><Card className="mt-6"><CardHeader><CardTitle>{selected ? "Branch order details" : "Order details"}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{details.map(order => <tr key={order.id} className="border-b last:border-0"><td className="px-3 py-3 font-bold">{order.orderNumber}</td><td className="px-3 py-3">{order.customerName}</td><td className="px-3 py-3">{order.branchName ?? "Unassigned"}</td><td className="px-3 py-3">{formatPlatformDate(order.orderDate)}</td><td className="px-3 py-3 font-bold">{money(order.amount)}</td><td className="px-3 py-3"><Badge variant="secondary">{order.status.replaceAll("_", " ")}</Badge></td></tr>)}</tbody></table></div>{!details.length && <p className="py-12 text-center text-sm text-slate-500">No matching orders.</p>}</CardContent></Card></>}
  </AdminShell>;
}
