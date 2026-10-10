"use client";

import { useDeliveryRefresh } from "@/lib/delivery-refresh";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, PackageCheck, Phone, RefreshCw, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StaffShell, staffToken } from "@/components/staff-shell";
import { ApiError, getStaffDashboard, getStaffOrders, type DashboardStats, type Paged, type StaffOrderListItem } from "@/services/api";

const metrics = [
  { label: "Assigned today", key: "ASSIGNED_TODAY", Icon: Truck, tone: "bg-teal-50 text-teal-700" },
  { label: "Awaiting acceptance", key: "PENDING_PICKUP", Icon: PackageCheck, tone: "bg-amber-50 text-amber-700" },
  { label: "In progress", key: "OUT_FOR_DELIVERY", Icon: Clock3, tone: "bg-blue-50 text-blue-700" },
  { label: "Delivered today", key: "DELIVERED_TODAY", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
] as const;

export default function DeliveryDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Paged<StaffOrderListItem> | null>(null);
  const [error, setError] = useState("");
  const load = () => Promise.all([
    getStaffDashboard(staffToken(), "delivery"),
    getStaffOrders(staffToken(), "delivery", { active: true, pageSize: 5 }),
  ]).then(([dashboard, list]) => {
    setStats(dashboard);
    setOrders(list);
    setError("");
  }).catch((cause) => setError(cause instanceof ApiError ? cause.message : "Delivery dashboard could not be loaded."));

  useEffect(() => { void load(); }, []);
  useDeliveryRefresh(load);

  return <StaffShell panel="delivery" title="Delivery dashboard" action={<button onClick={() => void load()} className="soft-btn min-h-10"><RefreshCw size={15} /> Refresh</button>}>
    {error && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4 xl:grid-cols-4">
      {metrics.map(({ label, key, Icon, tone }) => <Card key={key}>
        <CardContent className="p-3.5 sm:p-5">
          <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
          <p className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">{label}</p>
          <p className="mt-0.5 text-xl font-extrabold sm:text-2xl">{stats ? stats.inventory[key] ?? 0 : "—"}</p>
        </CardContent>
      </Card>)}
    </div>

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:mt-6 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="mt-1.5 text-lg font-extrabold sm:text-xl">Unfinished deliveries</h2></div>
        <Link href="/delivery/orders" className="shrink-0 text-xs font-extrabold text-teal-700 dark:text-teal-300">View all <span aria-hidden="true">→</span></Link>
      </div>
      <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3">
        {orders?.items.slice(0, 5).map((order) => <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3.5 dark:border-slate-700 sm:p-4">
          <div className="min-w-0 flex-1">
            <Link href={`/delivery/orders/${order.id}`} className="font-extrabold text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-300">{order.orderNumber}</Link>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{order.customerName} · {order.customerPhone}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{order.paymentMethod.replaceAll("_", " ")}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href={`tel:${order.customerPhone}`} aria-label={`Call ${order.customerName}`} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-teal-700 hover:bg-teal-50 dark:border-slate-700 dark:text-teal-300 dark:hover:bg-slate-800"><Phone size={17} /></a>
            <div className="min-w-[92px] text-right"><p className="text-[10px] font-bold text-slate-500">{order.paymentMethod === "CASH_ON_DELIVERY" ? "To collect" : "Order total"}</p><p className="text-sm font-extrabold">Rs. {(order.paymentMethod === "CASH_ON_DELIVERY" ? order.amountDue ?? order.total : order.total).toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] font-bold text-teal-700 dark:text-teal-300">{(order.deliveryStatus ?? order.status).replaceAll("_", " ")}</p></div>
          </div>
        </article>)}
        {orders?.items.length === 0 && <p className="py-9 text-center text-sm text-slate-500 dark:text-slate-400">No unfinished deliveries.</p>}
      </div>
    </section>
  </StaffShell>;
}
