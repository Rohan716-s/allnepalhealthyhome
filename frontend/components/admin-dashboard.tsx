"use client";

/* eslint-disable react-hooks/set-state-in-effect -- this effect loads the selected dashboard range from the API. */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardList,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  AdminDashboard,
  AdminReportType,
  downloadAdminReport,
  getAdminDashboard,
} from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNPR } from "@/lib/catalog";
import { formatNepalDate } from "@/lib/date-time";

const ranges = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 days"],
  ["last30", "Last 30 days"],
  ["lastmonth", "Last month"],
  ["thisyear", "This year"],
  ["custom", "Custom range"],
] as const;

export function AdminDashboardView({
  superAdmin = false,
}: {
  superAdmin?: boolean;
}) {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [range, setRange] = useState("last7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  useEffect(() => {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token || (range === "custom" && (!from || !to))) return;
    setLoading(true);
    setError("");
    getAdminDashboard(
      token,
      superAdmin,
      range,
      range === "custom" ? from : undefined,
      range === "custom" ? to : undefined,
    )
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range, from, to, superAdmin]);
  if (error && !data)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading live dashboard…
      </div>
    );
  const fallbackKpis = {
    totalCustomers: 0,
    newCustomers: 0,
    pendingOrders: data.orders.PENDING ?? 0,
    processingOrders: data.orders.PREPARING ?? 0,
    deliveredOrders: data.orders.DELIVERED ?? 0,
    cancelledOrders: data.orders.CANCELLED ?? 0,
    pendingPrescriptions: data.prescriptions["Pending Pharmacist Review"] ?? 0,
    approvedPrescriptions: data.prescriptions.Approved ?? 0,
    rejectedPrescriptions: data.prescriptions.Rejected ?? 0,
    pendingPayments: 0,
    codOrders: 0,
    onlineOrders: 0,
    activeBranches: 0,
    activePharmacists: data.staff.PHARMACIST ?? 0,
    activeDeliveryStaff: data.staff.DELIVERY ?? 0,
    rangeStart: "",
    rangeEnd: "",
  };
  const kpis = data.kpis ?? fallbackKpis;
  const operations = data.operations ?? {
    yesterdayRevenue: 0,
    yearRevenue: 0,
    activeCustomers: kpis.totalCustomers,
    inactiveCustomers: 0,
    totalProducts: 0,
    stockValue: 0,
    delivery: {},
    paymentMethods: {},
    customerRegistrations: [],
    branchPerformance: [],
  };
  async function exportReport(type: AdminReportType) {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token) return;
    setExporting(type);
    setError("");
    try {
      await downloadAdminReport(
        type,
        token,
        superAdmin,
        kpis.rangeStart || undefined,
        kpis.rangeEnd || undefined,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The report could not be exported.",
      );
    } finally {
      setExporting("");
    }
  }
  const categorySales = data.categorySales ?? [];
  const recentOrders = data.recentOrders ?? [];
  const cards = [
    [
      "Today revenue",
      formatNPR(data.todayRevenue),
      "bg-rose-50 text-rose-700",
      IndianRupee,
    ],
    [
      "This month",
      formatNPR(data.monthRevenue),
      "bg-violet-50 text-violet-700",
      BarChart3,
    ],
    [
      "Customers",
      String(kpis.totalCustomers),
      "bg-emerald-50 text-emerald-700",
      Users,
    ],
    [
      "Orders in range",
      String(Object.values(data.orders).reduce((sum, value) => sum + value, 0)),
      "bg-teal-50 text-teal-700",
      ClipboardList,
    ],
  ] as const;
  const attention: [string, number, typeof Boxes][] = [
    ["Pending orders", kpis.pendingOrders, ClipboardList],
    ["Pending payments", kpis.pendingPayments, IndianRupee],
    ["Low stock", data.inventory.LOW_STOCK ?? 0, Boxes],
    ["Out of stock", data.inventory.OUT_OF_STOCK ?? 0, AlertTriangle],
    ["Pending prescriptions", kpis.pendingPrescriptions, FileText],
  ];
  const statusCards = [
    ["Delivered", kpis.deliveredOrders],
    ["Cancelled", kpis.cancelledOrders],
    ["Approved prescriptions", kpis.approvedPrescriptions],
    ["Rejected prescriptions", kpis.rejectedPrescriptions],
    ["Near expiry", data.inventory.NEAR_EXPIRY ?? 0],
    ["Expired batches", data.inventory.EXPIRED ?? 0],
  ] as const;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">
            {superAdmin ? "System control" : "Operations"}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
            Live pharmacy overview
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            aria-label="Dashboard date range"
            value={range}
            onChange={(event) => {
              setLoading(true);
              setRange(event.target.value);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#DC143C]/20"
          >
            {ranges.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {range === "custom" && (
            <>
              <input
                aria-label="Dashboard start date"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
              />
              <input
                aria-label="Dashboard end date"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
              />
            </>
          )}
          {loading ? (
            <Loader2 className="animate-spin text-[#DC143C]" size={17} />
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <RefreshCw size={13} />
              Live data
            </span>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <span className="mr-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
          <Download size={14} />
          Export live data
        </span>
        {(
          [
            ["orders", "Orders"],
            ["payments", "Payments"],
            ["customers", "Customers"],
            ["inventory", "Inventory"],
            ["products", "Products"],
            ["categories", "Categories"],
            ["prescriptions", "Prescriptions"],
            ["delivery", "Delivery"],
            ["branches", "Branches"],
            ["staff", "Staff"],
            ["coupons", "Coupons"],
            ["tax", "Tax"],
          ] as const
        ).map(([type, label]) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            disabled={Boolean(exporting)}
            onClick={() => exportReport(type)}
          >
            {exporting === type ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            {label} CSV
          </Button>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, tone, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon size={18} />
              </span>
              <p className="mt-5 text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-950">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-bold text-slate-500">Yesterday sales</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">
            {formatNPR(operations.yesterdayRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-bold text-slate-500">Year-to-date sales</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">
            {formatNPR(operations.yearRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-bold text-slate-500">Active customers</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">
            {operations.activeCustomers}
          </p>
          <p className="text-[11px] text-slate-400">
            {operations.inactiveCustomers} inactive
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-bold text-slate-500">
            Inventory stock value
          </p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">
            {formatNPR(operations.stockValue)}
          </p>
          <p className="text-[11px] text-slate-400">
            {operations.totalProducts} active products
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statusCards.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <span className="text-xs font-bold text-slate-600">{label}</span>
            <span className="text-lg font-extrabold text-slate-950">
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Revenue and order trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-52 items-end gap-2">
              {data.revenueTrend.map((point) => {
                const max = Math.max(
                  ...data.revenueTrend.map((x) => x.revenue),
                  1,
                );
                return (
                  <div
                    key={point.label}
                    className="group flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <div className="relative flex h-40 w-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-[#DC143C] transition group-hover:bg-[#003893]"
                        style={{
                          height: `${Math.max(5, (point.revenue / max) * 100)}%`,
                        }}
                        title={`${formatNPR(point.revenue)} · ${point.orders} orders`}
                      />
                    </div>
                    <span className="truncate text-[10px] text-slate-400">
                      {point.label.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Showing {kpis.rangeStart || "the selected"} through{" "}
              {kpis.rangeEnd || "current period"}. Hover a bar for revenue and
              order count.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attention needed</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {attention.map(([label, value, Icon]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Icon size={15} />
                  {label}
                </span>
                <b className="text-sm text-slate-900">{value}</b>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales by category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {categorySales.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No categorized sales have been recorded yet.
                </p>
              ) : (
                categorySales.map((sale, index) => {
                  const max = Math.max(
                    ...categorySales.map((item) => item.revenue),
                    1,
                  );
                  return (
                    <div key={sale.category}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">
                          {sale.category}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatNPR(sale.revenue)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full ${index % 2 === 0 ? "bg-[#DC143C]" : "bg-[#003893]"}`}
                          style={{
                            width: `${Math.max(4, (sale.revenue / max) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {Object.entries(data.orders)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <span className="h-2 w-2 rounded-full bg-[#DC143C]" />
                      {status.replaceAll("_", " ")}
                    </span>
                    <b className="text-sm text-slate-900">{count}</b>
                  </div>
                ))}
              {!Object.keys(data.orders).length && (
                <p className="text-sm text-slate-500">
                  No orders have been recorded yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Delivery performance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {Object.entries(operations.delivery).length ? (
              Object.entries(operations.delivery).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
                >
                  <span className="text-xs font-bold text-slate-700">
                    {status.replaceAll("_", " ")}
                  </span>
                  <b>{count}</b>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No delivery assignments in this range.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {Object.entries(operations.paymentMethods).length ? (
              Object.entries(operations.paymentMethods).map(
                ([method, count]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
                  >
                    <span className="text-xs font-bold text-slate-700">
                      {method.replaceAll("_", " ")}
                    </span>
                    <b>{count}</b>
                  </div>
                ),
              )
            ) : (
              <p className="text-sm text-slate-500">
                No payments in this range.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Customer registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-28 items-end gap-2">
              {operations.customerRegistrations.length ? (
                operations.customerRegistrations.map((point) => (
                  <div
                    key={point.label}
                    className="group flex min-w-0 flex-1 flex-col items-center gap-1"
                  >
                    <div className="flex h-20 w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-[#003893]"
                        style={{
                          height: `${Math.max(6, (point.customers / Math.max(...operations.customerRegistrations.map((x) => x.customers), 1)) * 100)}%`,
                        }}
                        title={`${point.customers} customers`}
                      />
                    </div>
                    <span className="truncate text-[9px] text-slate-400">
                      {point.label.slice(5)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No registrations recorded.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Branch performance</CardTitle>
          </CardHeader>
          <CardContent className="grid max-h-[520px] gap-3 overflow-y-auto">
            {operations.branchPerformance.length ? (
              operations.branchPerformance.map((branch, index) => {
                const max = Math.max(
                  ...operations.branchPerformance.map((item) => item.revenue),
                  1,
                );
                return (
                  <div key={branch.branchId ?? "unassigned"}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-bold text-slate-700">
                        {branch.branchName}
                      </span>
                      <span className="shrink-0 font-extrabold text-slate-900">
                        {formatNPR(branch.revenue)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px]">
                      <span className="text-slate-500">
                        Cash in {formatNPR(branch.cashIn)} · out {formatNPR(branch.cashOut)}
                      </span>
                      <span className={`font-extrabold ${branch.netCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        Net flow {formatNPR(branch.netCashFlow)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${index % 2 === 0 ? "bg-[#DC143C]" : "bg-[#003893]"}`}
                        style={{
                          width: `${Math.max(4, (branch.revenue / max) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {branch.orders} {branch.orders === 1 ? "order" : "orders"}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                No branch sales in this range.
              </p>
            )}
            {operations.branchPerformance.length > 0 && (
              <p className="border-t pt-2 text-[10px] leading-4 text-slate-400">
                  Cash in includes POS and recorded customer receipts; cash out includes supplier payments, branch expenses, and cash refunds.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye size={17} className="text-[#DC143C]" />
              Recent orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No orders have been recorded yet.
                </p>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-slate-400">
                        {order.customerName} ·{" "}
                        {formatNepalDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">
                        {formatNPR(order.total)}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {order.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operations at a glance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-700">Active branches</p>
              <p className="mt-2 text-2xl font-extrabold text-blue-950">
                {kpis.activeBranches}
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-xs font-bold text-violet-700">
                Active pharmacists
              </p>
              <p className="mt-2 text-2xl font-extrabold text-violet-950">
                {kpis.activePharmacists}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-700">Delivery staff</p>
              <p className="mt-2 text-2xl font-extrabold text-amber-950">
                {kpis.activeDeliveryStaff}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-700">COD / online</p>
              <p className="mt-2 text-2xl font-extrabold text-emerald-950">
                {kpis.codOrders} / {kpis.onlineOrders}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
