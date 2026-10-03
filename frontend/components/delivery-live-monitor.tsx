"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, RefreshCw, Truck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { DeliveryTrackingMap, type DeliveryMapRoute } from "@/components/delivery-tracking-map";
import { formatNepalDateTime } from "@/lib/date-time";
import { ApiError, getAdminLiveDeliveries, type DeliveryTrackingSnapshot } from "@/services/api";

export function DeliveryLiveMonitor({ superAdmin = false, supervisor = false }: {
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const [deliveries, setDeliveries] = useState<DeliveryTrackingSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    const token = window.localStorage.getItem("anhh-staff-access-token") ?? "";
    if (!token) return;
    let cancelled = false;
    const refresh = async () => {
      if (pending.current) return;
      pending.current = true;
      try {
        const rows = await getAdminLiveDeliveries(token, superAdmin);
        if (cancelled) return;
        setDeliveries(rows);
        setSelectedId(current => rows.some(row => row.orderId === current) ? current : rows[0]?.orderId ?? "");
        setUpdatedAt(new Date().toISOString());
        setError("");
      } catch (reason) {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : "Live deliveries could not be loaded.");
      } finally {
        pending.current = false;
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 20000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [refreshKey, superAdmin]);

  const routes = useMemo<DeliveryMapRoute[]>(() => deliveries.map(row => ({
    id: row.orderId,
    label: row.riderName || row.orderNumber,
    current: row.location,
    destination: row.destination,
  })), [deliveries]);
  const selected = deliveries.find(row => row.orderId === selectedId) ?? deliveries[0] ?? null;

  return <AdminShell supervisor={supervisor} superAdmin={superAdmin}>
    <main className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Delivery operations</p><h1 className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-slate-50 sm:text-3xl">Live delivery map</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Active riders and destinations in your authorized delivery scope.</p></div>
        <button type="button" onClick={() => { if (pending.current) return; setRefreshing(true); setRefreshKey(value => value + 1); }} disabled={refreshing} className="soft-btn min-h-11">
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}Refresh
        </button>
      </header>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Active riders</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{deliveries.length} out-for-delivery · {deliveries.filter(row => row.location).length} with a recent GPS location</p></div>
          {updatedAt && <p className="text-xs text-slate-500 dark:text-slate-400">Updated {formatNepalDateTime(updatedAt)}</p>}
        </div>
        {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div>
          : deliveries.length ? <DeliveryTrackingMap routes={routes} />
            : <div className="grid min-h-64 place-items-center rounded-xl bg-slate-50 px-5 text-center dark:bg-slate-800"><div><Truck className="mx-auto text-slate-400" size={32} /><p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">No active deliveries</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Riders appear here when an order is out for delivery.</p></div></div>}
      </section>
      {selected && <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700 dark:text-blue-300">Selected delivery</p>
          <h2 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">{selected.orderNumber}</h2>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><Truck size={16} />{selected.riderName || "Rider name unavailable"}</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{selected.deliveryStatus.replaceAll("_", " ")}</p>
          <p className="mt-4 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"><MapPin size={16} className="mt-0.5 shrink-0 text-rose-600" />{selected.destination?.address || selected.destinationAddress || "Destination address unavailable."}</p>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{selected.location ? `Last location update: ${formatNepalDateTime(selected.location.updatedAt)}` : "Rider location is temporarily unavailable."}</p>
          {selected.location && selected.destination && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDirectDistance(distanceMeters(selected.location, selected.destination))} direct distance to destination</p>}
        </div>
        <div className="grid content-start gap-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Deliveries on map</h2>
          {deliveries.map(row => <button type="button" key={row.orderId} onClick={() => setSelectedId(row.orderId)} aria-pressed={row.orderId === selected.orderId} className={`rounded-xl border p-4 text-left transition ${row.orderId === selected.orderId ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"}`}>
            <span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-extrabold text-slate-900 dark:text-slate-100">{row.riderName || "Rider"} · {row.orderNumber}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{row.deliveryStatus.replaceAll("_", " ")}</span></span><span className={`size-2.5 shrink-0 rounded-full ${row.location ? "bg-emerald-500" : "bg-slate-400"}`} title={row.location ? "Recent rider location" : "Location unavailable"} /></span>
            {row.location && <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">Updated {formatNepalDateTime(row.location.updatedAt)}</span>}
          </button>)}
        </div>
      </section>}
    </main>
  </AdminShell>;
}

function distanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLon = radians(to.longitude - from.longitude);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDirectDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
