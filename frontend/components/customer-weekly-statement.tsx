"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { ApiError, getMyWeeklyStatement, type CustomerStatement } from "@/services/api";

const localDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
function exportStatement(statement: CustomerStatement) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["Order", "Date", "Status", "Payment status", "Billed", "Paid", "Balance"], ...statement.orders.map(row => [row.orderNumber, new Date(row.createdAt).toLocaleDateString(), row.status, row.paymentStatus, row.billedAmount, row.paidAmount, row.balance]), ["TOTAL", "", "", "", statement.billedAmount, statement.paidAmount, statement.balance]];
  const blob = new Blob(["\uFEFF" + rows.map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `weekly-statement-${statement.customerId}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

export function CustomerWeeklyStatement() {
  const initialTo = new Date(); const initialFrom = new Date(); initialFrom.setDate(initialFrom.getDate() - 6);
  const [from, setFrom] = useState(localDate(initialFrom));
  const [to, setTo] = useState(localDate(initialTo));
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    const token = localStorage.getItem("anhh-access-token"); if (!token) return;
    setLoading(true); setError("");
    try { setStatement(await getMyWeeklyStatement(token, { from, to })); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Your statement could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><FileText size={18} className="text-teal-700" /><h2 className="text-lg font-extrabold">Weekly statement</h2></div><p className="mt-1 text-xs text-slate-500">Your saved order and payment activity for the selected period.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} disabled={!statement} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold disabled:opacity-50"><Printer size={14} />Print</button><button type="button" onClick={() => statement && exportStatement(statement)} disabled={!statement} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold disabled:opacity-50"><Download size={14} />CSV</button></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1 text-xs font-bold text-slate-600">From<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-bold text-slate-600">To<input type="date" value={to} min={from} max={localDate(new Date())} onChange={event => setTo(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal" /></label><button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50">{loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}Update</button></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
    {statement && <><div className="mt-4 grid gap-2 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Orders</p><p className="mt-1 text-lg font-extrabold">{statement.orderCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Billed</p><p className="mt-1 text-sm font-extrabold">NPR {statement.billedAmount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase text-emerald-800">Paid</p><p className="mt-1 text-sm font-extrabold text-emerald-900">NPR {statement.paidAmount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase text-amber-800">Balance</p><p className="mt-1 text-sm font-extrabold text-amber-950">NPR {statement.balance.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</p></div></div><div className="mt-4 space-y-2">{statement.orders.map(order => <div key={order.orderId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-xs"><span><b>{order.orderNumber}</b><span className="ml-2 text-slate-500">{new Date(order.createdAt).toLocaleDateString("en-NP", { dateStyle: "medium" })}</span></span><span className="font-semibold text-slate-600">{order.paymentStatus.replaceAll("_", " ")}</span><span className="font-bold">Billed NPR {order.billedAmount.toLocaleString("en-NP", { minimumFractionDigits: 2 })} · Balance NPR {order.balance.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span></div>)}{!statement.orders.length && <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">No orders in this period.</p>}</div></>}
  </section>;
}
