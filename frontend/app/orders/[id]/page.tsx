"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, MapPin, PackageCheck, Truck, Upload, QrCode } from "lucide-react";
import { use, useEffect, useState, type ChangeEvent } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { DeliveryTrackingMap } from "@/components/delivery-tracking-map";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, downloadOrderDocument, getCustomerDeliveryTracking, getCustomerOrder, getCustomerOrderDocuments, getOrderPaymentInstructions, resolveMediaUrl, uploadOrderDocument, type DeliveryTrackingSnapshot, type OrderDocument, type PaymentInstructions, type StaffOrder } from "@/services/api";
import { formatNepalDateTime, formatPlatformDate } from "@/lib/date-time";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<StaffOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<PaymentInstructions | null>(null);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [tracking, setTracking] = useState<DeliveryTrackingSnapshot | null>(null);
  const [trackingError, setTrackingError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = localStorage.getItem("anhh-access-token");
      if (!token) {
        await Promise.resolve();
        if (!cancelled) { setLoading(false); setError("Please sign in to view this order."); }
        return;
      }
      try {
        const row = await getCustomerOrder(id, token);
        if (!cancelled) setOrder(row);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Order could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id]);
  useEffect(() => {
    const status = order?.delivery?.status;
    if (!status || !["ASSIGNED_FOR_DELIVERY", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(status)) return;
    const token = localStorage.getItem("anhh-access-token");
    if (!token) return;
    let cancelled = false;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const snapshot = await getCustomerDeliveryTracking(id, token);
        if (!cancelled) {
          setTracking(snapshot);
          setTrackingError(false);
          setOrder(current => {
            if (!current?.delivery || current.delivery.status === snapshot.deliveryStatus) return current;
            return { ...current, delivery: { ...current.delivery, status: snapshot.deliveryStatus } };
          });
        }
      } catch {
        if (!cancelled) setTrackingError(true);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [id, order?.delivery?.status]);
  useEffect(() => {
    if (!order || order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") return;
    const token = localStorage.getItem("anhh-access-token");
    if (!token) return;
    let cancelled = false;
    Promise.all([getOrderPaymentInstructions(id, token), getCustomerOrderDocuments(id, token)])
      .then(([instructions, rows]) => { if (!cancelled) { setPayment(instructions); setDocuments(rows); } })
      .catch((reason) => { if (!cancelled) setUploadError(reason instanceof ApiError ? reason.message : "Payment instructions could not be loaded."); });
    return () => { cancelled = true; };
  }, [id, order]);
  async function uploadProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const token = localStorage.getItem("anhh-access-token");
    if (!token) { setUploadError("Your session expired. Sign in again to upload payment proof."); return; }
    setUploading(true); setUploadError("");
    try { const saved = await uploadOrderDocument(id, "PAYMENT_PROOF", file, token); setDocuments((current) => [saved, ...current]); }
    catch (reason) { setUploadError(reason instanceof ApiError ? reason.message : "Payment proof could not be uploaded."); }
    finally { setUploading(false); }
  }
  return (
    <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/orders" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><ArrowLeft size={15} /> Back to orders</Link>
      {loading && <div className="mt-10 text-center"><Loader2 className="mx-auto animate-spin text-teal-700" /></div>}
      {error && <Card className="mt-8 border-rose-200 bg-rose-50"><CardContent className="p-6 text-sm text-rose-800">{error}<div className="mt-4"><ButtonLink href="/login" size="sm">Sign in</ButtonLink></div></CardContent></Card>}
      {order && <>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Order details</p><h1 className="mt-2 text-3xl font-extrabold">{order.orderNumber}</h1><p className="mt-2 text-xs text-slate-400">Placed {formatPlatformDate(order.createdAt)}</p></div><StatusBadge status={order.status} /></div>
        <div className="surface mt-8 p-6"><div className="grid gap-5 sm:grid-cols-3">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><CheckCircle2 size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</p><p className="mt-1 text-xs font-extrabold">{order.status.replaceAll("_", " ")}</p></div></div>
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Truck size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Delivery</p><p className="mt-1 text-xs font-extrabold">{order.delivery?.status?.replaceAll("_", " ") ?? "Being prepared"}</p></div></div>
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><PackageCheck size={17} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment</p><p className="mt-1 text-xs font-extrabold">{order.paymentMethod.replaceAll("_", " ")} · {order.paymentStatus.replaceAll("_", " ")}</p></div></div>
        </div></div>
        {order.delivery && ["ASSIGNED_FOR_DELIVERY", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(order.delivery.status) && <CustomerDeliveryTracker order={order} tracking={tracking} unavailable={trackingError} />}
        {payment && order.paymentMethod !== "CASH_ON_DELIVERY" && order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUNDED" && <Card className="mt-5 border-teal-100"><CardContent className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
          <div><div className="flex items-center gap-2 text-sm font-extrabold"><QrCode size={18} className="text-teal-700" /> Payment instructions</div><p className="mt-2 text-sm leading-6 text-slate-600">{payment.instructions || "Use the configured payment method and upload your receipt for verification."}</p><p className="mt-3 text-sm font-bold text-slate-900">Amount due: NPR {payment.amountDue.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</p>
            <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800">{uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}{uploading ? "Uploading…" : "Upload payment proof"}<input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={uploadProof} /></label>
            {uploadError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{uploadError}</p>}
            {documents.length > 0 && <ul className="mt-4 grid gap-2 text-sm">{documents.map((document) => <li key={document.id}><button onClick={() => { const token = localStorage.getItem("anhh-access-token"); if (token) void downloadOrderDocument(document.downloadUrl, token).catch((reason) => setUploadError(reason instanceof Error ? reason.message : "Download failed.")); }} className="font-semibold text-teal-800 underline">{document.originalFileName}</button><span className="ml-2 text-xs text-slate-500">{document.kind.replaceAll("_", " ")}</span></li>)}</ul>}
          </div>
          {payment.qrCodeUrl ? <img src={resolveMediaUrl(payment.qrCodeUrl)} alt="Configured payment QR code" className="mx-auto h-44 w-44 rounded-xl border border-slate-200 bg-white object-contain p-2 sm:mx-0" /> : <div className="grid min-h-40 place-items-center rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 sm:w-44">No QR code is configured for this payment method.</div>}
        </CardContent></Card>}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="surface overflow-hidden"><div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-extrabold">Items in this order</h2></div><div className="divide-y divide-slate-100">{order.items.map(item => <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-5"><div><p className="text-sm font-bold text-slate-900">{item.productName}</p><p className="mt-1 text-xs text-slate-400">{item.sku} · Quantity {item.quantity}</p></div>{order.pricesVisible !== false && <span className="text-sm font-extrabold">NPR {(item.unitPrice * item.quantity).toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span>}</div>)}</div>{order.pricesVisible !== false && <div className="grid gap-2 border-t border-slate-100 px-6 py-5 text-sm"><div className="flex justify-between text-slate-500"><span>Delivery</span><span>NPR {order.deliveryFee.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span></div><div className="flex justify-between text-base font-extrabold"><span>Total</span><span>NPR {order.total.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span></div></div>}</section>
          <aside className="grid gap-5"><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm font-extrabold"><MapPin size={17} className="text-teal-700" /> Delivery address</div>{order.address ? <div className="mt-4 text-sm"><p className="font-bold">{order.address.streetTole}</p><p className="mt-1 text-xs leading-5 text-slate-600">Ward {order.address.ward}, {order.address.municipality}, {order.address.district}, {order.address.province}</p>{order.address.landmark && <p className="mt-2 text-xs text-slate-500">Landmark: {order.address.landmark}</p>}</div> : <p className="mt-3 text-sm text-slate-500">Address details unavailable.</p>}</CardContent></Card><Card><CardContent className="p-5"><h2 className="text-sm font-extrabold">Status history</h2><div className="mt-4 grid gap-3">{order.timeline.map(item => <div key={`${item.status}-${item.createdAt}`} className="flex gap-3 text-xs"><span className="mt-0.5 size-2 rounded-full bg-teal-600" /><div><p className="font-bold text-slate-800">{item.status.replaceAll("_", " ")}</p><p className="mt-1 text-slate-500">{formatNepalDateTime(item.createdAt)}{item.note ? ` · ${item.note}` : ""}</p></div></div>)}</div></CardContent></Card></aside>
        </div>
      </>}
    </main><SiteFooter /></div>
  );
}

function CustomerDeliveryTracker({ order, tracking, unavailable }: {
  order: StaffOrder;
  tracking: DeliveryTrackingSnapshot | null;
  unavailable: boolean;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => { window.clearTimeout(initialUpdate); window.clearInterval(timer); };
  }, []);
  const status = tracking?.deliveryStatus ?? order.delivery?.status ?? "";
  const steps = [
    ["ASSIGNED_FOR_DELIVERY", "Rider assigned"],
    ["ACCEPTED", "Rider accepted"],
    ["PICKED_UP", "Order picked up"],
    ["OUT_FOR_DELIVERY", "Out for delivery"],
    ["DELIVERED", "Delivered"],
  ] as const;
  const currentStep = steps.findIndex(([step]) => step === status);
  const destination = tracking?.destination ?? (order.address?.latitude != null && order.address.longitude != null
    ? { latitude: order.address.latitude, longitude: order.address.longitude, address: order.address.streetTole }
    : null);
  const updatedAt = tracking?.location?.updatedAt;
  const locationTimestamp = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  const ageSeconds = Number.isFinite(locationTimestamp) && now
    ? Math.max(0, Math.floor((now - locationTimestamp) / 1000))
    : null;
  const locationIsFresh = ageSeconds != null && ageSeconds <= 120;
  const visibleLocation = locationIsFresh ? tracking?.location : null;
  const relativeUpdate = ageSeconds == null
    ? "No location received yet"
    : ageSeconds < 60 ? `Last updated ${ageSeconds} seconds ago`
      : ageSeconds < 3600 ? `Last updated ${Math.floor(ageSeconds / 60)} minutes ago`
        : `Last updated ${Math.floor(ageSeconds / 3600)} hours ago`;

  return <section className="surface mt-5 border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Delivery tracking</p><h2 className="mt-2 text-xl font-extrabold">{status === "OUT_FOR_DELIVERY" ? "Your order is on its way" : "Delivery progress"}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tracking is available only for this order.</p></div>
      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{status.replaceAll("_", " ")}</span>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rider</p><p className="mt-1 text-sm font-extrabold">{tracking?.riderName ?? order.delivery?.deliveryStaff ?? "Assigned delivery rider"}</p></div>
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rider is going to</p><p className="mt-1 text-sm font-extrabold">{destination?.address || order.address?.streetTole || "Your saved delivery address"}</p></div>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <h3 className="text-sm font-extrabold">Delivery progress</h3>
        <ol className="mt-4 grid gap-3">
          {steps.map(([step, label], index) => {
            const reached = currentStep >= index;
            return <li key={step} className="flex items-center gap-3">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${reached ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"}`}>{reached ? <CheckCircle2 size={15} /> : <Clock3 size={14} />}</span>
              <span className={`text-sm font-semibold ${reached ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>{label}</span>
            </li>;
          })}
        </ol>
        <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">{unavailable || (tracking && !tracking.location) || (tracking?.location && !locationIsFresh) ? "Rider location is temporarily unavailable." : relativeUpdate}</p>
        {visibleLocation?.accuracy != null && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">GPS accuracy ±{Math.round(visibleLocation.accuracy)} m</p>}
      </div>
      <div><DeliveryTrackingMap current={visibleLocation ?? null} destination={destination} /></div>
    </div>
  </section>;
}
