"use client";

import Link from "next/link";
import { ArrowRight, Loader2, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerOrders, type StaffOrderListItem } from "@/services/api";
import { CustomerWeeklyStatement } from "@/components/customer-weekly-statement";

export default function OrdersPage() {
  const [orders, setOrders] = useState<StaffOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = localStorage.getItem("anhh-access-token");
      if (!token) {
        await Promise.resolve();
        if (!cancelled) { setLoading(false); setError("Please sign in to view your order history."); }
        return;
      }
      try {
        const rows = await getCustomerOrders(token);
        if (!cancelled) setOrders(rows);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Orders could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);
  return <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Account centre</p><h1 className="mt-2 text-4xl font-extrabold tracking-tight">Order history</h1><p className="mt-3 text-sm text-slate-500">Track your real orders, payment status, and delivery progress.</p>{!error && !loading && <CustomerWeeklyStatement />}{loading && <div className="mt-8 grid gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}{error && <Card className="mt-8 border-rose-200 bg-rose-50"><CardContent className="p-6 text-sm text-rose-800">{error}<div className="mt-4"><ButtonLink href="/login" size="sm">Sign in</ButtonLink></div></CardContent></Card>}{!loading && !error && !orders.length && <Card className="mt-8"><CardContent className="px-6 py-24 text-center"><PackageCheck className="mx-auto text-slate-300" size={42} /><h2 className="mt-5 text-xl font-extrabold">No orders yet</h2><p className="mt-2 text-sm text-slate-500">Your confirmed orders will appear here.</p><ButtonLink href="/products" className="mt-6">Start shopping <ArrowRight size={15} /></ButtonLink></CardContent></Card>}{!loading && !error && orders.length > 0 && <div className="mt-8 grid gap-4">{orders.map(order => <Card key={order.id}><CardContent className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/orders/${order.id}`} className="text-sm font-extrabold text-slate-900 hover:text-teal-700">{order.orderNumber}</Link><p className="mt-1 text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString("en-NP", { dateStyle: "medium" })} · {order.customerName}</p></div><StatusBadge status={order.status} /></div><div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4"><div className="text-xs text-slate-500"><span className="font-bold text-slate-700">{order.paymentMethod.replaceAll("_", " ")}</span> · Payment {order.paymentStatus.replaceAll("_", " ")} {order.deliveryStatus && <> · Delivery {order.deliveryStatus.replaceAll("_", " ")}</>}</div><div className="flex items-center gap-4"><span className="text-sm font-extrabold">NPR {order.total.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span><Link href={`/orders/${order.id}`} className="text-xs font-bold text-teal-700">View details</Link></div></div></CardContent></Card>)}</div>}{!loading && <p className="mt-10 text-center text-xs text-slate-400"><Loader2 size={13} className="mr-1 inline" /> Order status is loaded securely from the pharmacy API.</p>}</main><SiteFooter /></div>;
}
