"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, Loader2, MapPin, Navigation, Phone, Radio, Upload, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { StaffShell, staffToken } from "@/components/staff-shell";
import { DeliveryTrackingMap } from "@/components/delivery-tracking-map";
import { ApiError, downloadOrderDocument, getDeliveryOrderRequirements, getStaffOrder, transitionDelivery, updateRiderDeliveryLocation, uploadOrderDocument, type DeliveryOrderRequirements, type StaffOrder } from "@/services/api";

const actionFor: Record<string, { action: "accept" | "pickup" | "start" | "delivered"; label: string }> = { ASSIGNED_FOR_DELIVERY: { action: "accept", label: "Accept delivery" }, ACCEPTED: { action: "pickup", label: "Mark as picked up" }, PICKED_UP: { action: "start", label: "Start delivery" }, OUT_FOR_DELIVERY: { action: "delivered", label: "Mark as delivered" } };
export default function DeliveryDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [order, setOrder] = useState<StaffOrder | null>(null);
  const [requirements, setRequirements] = useState<DeliveryOrderRequirements | null>(null);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState(false);
  const [documentKind, setDocumentKind] = useState("DELIVERY_PROOF");
  const [gps, setGps] = useState<{ latitude: number; longitude: number; accuracy?: number; timestamp: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState("");
  const lastLocationSent = useRef<{ latitude: number; longitude: number; sentAt: number } | null>(null);
  const lastLocationAttempt = useRef(0);
  const locationUpdatePending = useRef(false);
  const previouslyOutForDelivery = useRef(false);
  const token = () => staffToken();
  const load = useCallback(async (resolved: string) => {
    const access = staffToken();
    const [loadedOrder, loadedRequirements] = await Promise.all([getStaffOrder(resolved, access, "delivery"), getDeliveryOrderRequirements(resolved, access)]);
    setOrder(loadedOrder); setRequirements(loadedRequirements);
    const isOutForDelivery = loadedOrder.delivery?.status === "OUT_FOR_DELIVERY";
    if (isOutForDelivery && !previouslyOutForDelivery.current) setTrackingEnabled(true);
    if (!isOutForDelivery) setTrackingEnabled(false);
    previouslyOutForDelivery.current = Boolean(isOutForDelivery);
    const currentLocation = loadedOrder.delivery?.currentLocation;
    const locationTimestamp = currentLocation ? Date.parse(currentLocation.updatedAt) : Number.NaN;
    const locationIsFresh = Number.isFinite(locationTimestamp) && Date.now() - locationTimestamp <= 120000;
    setGps(currentLocation && locationIsFresh ? { ...currentLocation, timestamp: locationTimestamp } : null);
    setTrackingWarning(currentLocation && !locationIsFresh ? "The last GPS point is stale. Waiting for a fresh location." : "");
    setDocumentKind(loadedRequirements.requiredDocumentTypes[0] ?? "DELIVERY_PROOF");
  }, []);
  useEffect(() => {
    let cancelled = false;
    params.then(({ id: resolved }) => {
      if (cancelled) return;
      setId(resolved);
      void load(resolved).catch(reason => {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : "Delivery could not be loaded.");
      });
    });
    return () => { cancelled = true; };
  }, [load, params]);
  useEffect(() => {
    lastLocationSent.current = null;
    lastLocationAttempt.current = 0;
    locationUpdatePending.current = false;
    previouslyOutForDelivery.current = false;
  }, [id]);
  async function transition(action: "accept" | "pickup" | "start" | "delivered" | "failed") {
    if (action === "failed" && !failure.trim()) { setError("Enter a delivery failure reason first."); return; }
    setBusy(action); setError("");
    try { await transitionDelivery(id, action, action === "failed" ? { reason: failure, notes: note } : { notes: note, latitude: gps?.latitude, longitude: gps?.longitude }, token()); await load(id); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Delivery update could not be saved."); }
    finally { setBusy(""); }
  }
  async function uploadDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setUploading(true); setError("");
    try { const saved = await uploadOrderDocument(id, documentKind, file, token(), true); setOrder(current => current ? { ...current, documents: [saved, ...(current.documents ?? [])] } : current); await load(id); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "The delivery document could not be uploaded."); }
    finally { setUploading(false); }
  }
  function captureLocation() {
    setGpsError("");
    if (!navigator.geolocation) { setGpsError("Unable to access your location. Please check your device location settings."); return; }
    navigator.geolocation.getCurrentPosition(position => setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp }), error => setGpsError(error.code === error.PERMISSION_DENIED ? "Location permission is required for live delivery tracking. Enable it in your browser settings, then retry." : "Unable to access your location. Please check your device location settings and retry."), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  useEffect(() => {
    if (!trackingEnabled || order?.delivery?.status !== "OUT_FOR_DELIVERY" || !id) return;
    const geolocation = navigator.geolocation;
    if (!geolocation) return;
    let cancelled = false;
    const watchId = geolocation.watchPosition(position => {
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      setGps(next);
      const previous = lastLocationSent.current;
      const movedEnough = !previous || haversine(previous.latitude, previous.longitude, next.latitude, next.longitude) >= 40;
      const waitedLongEnough = !previous || Date.now() - previous.sentAt >= 30000;
      if ((!movedEnough && !waitedLongEnough) || locationUpdatePending.current || Date.now() - lastLocationAttempt.current < 15000) return;
      locationUpdatePending.current = true;
      lastLocationAttempt.current = Date.now();
      void updateRiderDeliveryLocation(id, {
        latitude: next.latitude,
        longitude: next.longitude,
        accuracy: next.accuracy,
      }, staffToken()).then(() => {
        lastLocationSent.current = { latitude: next.latitude, longitude: next.longitude, sentAt: Date.now() };
        if (!cancelled) setTrackingWarning("");
      }).catch(reason => {
        if (!cancelled) setTrackingWarning(reason instanceof ApiError ? reason.message : "Location update could not be sent. Tracking will retry automatically.");
      }).finally(() => {
        locationUpdatePending.current = false;
      });
    }, error => {
      setGpsError(error.code === error.PERMISSION_DENIED
        ? "Location permission is required for live delivery tracking. Enable it in your browser settings, then retry."
        : "Unable to access your location. Please check your device location settings and retry.");
      if (error.code === error.PERMISSION_DENIED) {
        setTrackingEnabled(false);
        setGps(null);
      }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
    return () => { cancelled = true; geolocation.clearWatch(watchId); };
  }, [id, order?.delivery?.status, trackingEnabled]);
  const destination = order?.address?.latitude != null && order.address.longitude != null ? { latitude: order.address.latitude, longitude: order.address.longitude } : null;
  const distance = gps && destination ? haversine(gps.latitude, gps.longitude, destination.latitude, destination.longitude) : null;
  const uploaded = new Set([...(requirements?.uploadedDocumentTypes ?? []), ...(order?.documents ?? []).map(file => file.kind.toUpperCase())]);
  const missing = (requirements?.requiredDocumentTypes ?? ["DELIVERY_PROOF"]).filter(kind => !uploaded.has(kind.toUpperCase()));
  const geoReady = !requirements?.enforceGeofence || Boolean(requirements.hasDestinationCoordinates && gps && distance != null && distance <= (requirements.geofenceRadiusMeters ?? 100));
  const deliverReady = missing.length === 0 && geoReady;
  const geoAvailable = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
  return <StaffShell panel="delivery" title={order?.orderNumber ?? "Delivery detail"} action={<Link href="/delivery/orders" className="soft-btn"><ArrowLeft size={15} /> Back to deliveries</Link>}>
    {error && <p role="alert" className="mb-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
    {!order ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><Loader2 className="mx-auto animate-spin text-teal-700" /></div> : <>
      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal-700">Current delivery status</p><h2 className="mt-2 text-2xl font-extrabold text-teal-950">{order.delivery?.status.replaceAll("_", " ")}</h2></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-teal-800">{order.paymentMethod} · {order.paymentStatus}</span></div></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal-700">Customer</p><h2 className="mt-2 text-xl font-extrabold">{order.customerName}</h2><p className="mt-1 text-sm text-slate-500">{order.customerPhone}</p></div><a href={`tel:${order.customerPhone}`} aria-label="Call customer" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-white"><Phone size={20} /></a></div>
          {order.address && <div className="mt-6 flex gap-3 rounded-2xl bg-slate-50 p-4"><MapPin className="mt-0.5 shrink-0 text-teal-700" size={18} /><div className="text-sm"><p className="font-extrabold">{order.address.streetTole}</p><p className="mt-1 text-xs leading-5 text-slate-600">Ward {order.address.ward}, {order.address.municipality}, {order.address.district}, {order.address.province}</p>{order.address.landmark && <p className="mt-1 text-xs text-slate-500">Landmark: {order.address.landmark}</p>}
            {destination && <a className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-800 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`}>Open route map <ExternalLink size={13} /></a>}</div></div>}
          {order.deliveryInstructions && <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Delivery note:</strong> {order.deliveryInstructions}</div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal-700">Order summary</p><p className="mt-2 text-3xl font-extrabold">Rs. {order.total.toLocaleString("en-IN")}</p><div className="mt-5 divide-y divide-slate-100">{order.items.map(item => <div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><span><span className="font-bold">{item.productName}</span><span className="block text-xs text-slate-500">Quantity {item.quantity}</span></span><span className="font-extrabold">Rs. {(item.unitPrice * item.quantity).toLocaleString("en-IN")}</span></div>)}</div>{order.prescription && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><CheckCircle2 className="mr-1 inline" size={14} /> Prescription verified.</p>}</section>
      </div>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-300">Live delivery route</p><h2 className="mt-2 text-lg font-extrabold">Pickup → your current location → customer</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Location is shared only while this delivery is out for delivery.</p></div>
          {order.delivery?.status === "OUT_FOR_DELIVERY" && <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${trackingEnabled && gps ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}><Radio size={14} />{trackingEnabled && gps ? "Tracking active" : "Tracking off"}</span>}
        </div>
        {order.delivery?.status === "OUT_FOR_DELIVERY" ? <>
          {trackingEnabled
            ? <button type="button" onClick={() => { setTrackingEnabled(false); setGps(null); }} className="soft-btn mt-4 min-h-11"><Radio size={16} />Stop sharing location</button>
            : <button type="button" onClick={() => { setGpsError(""); setTrackingWarning(""); setTrackingEnabled(true); }} className="primary-btn mt-4 min-h-11"><MapPin size={16} />{gpsError ? "Retry location access" : "Start live location"}</button>}
          {trackingEnabled && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"><Radio className="mr-2 inline" size={14} />Live location tracking is active for this delivery. Updates are shared with the customer and authorized operations staff.</p>}
          {(gpsError || (trackingEnabled && !geoAvailable && "Unable to access your location. Please check your device location settings.")) && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200">{gpsError || "Unable to access your location. Please check your device location settings."}</p>}
          {trackingWarning && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{trackingWarning}</p>}
          <div className="mt-4"><DeliveryTrackingMap pickup={order.delivery?.pickup} current={gps} destination={destination} /></div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Pickup point: {order.delivery?.pickup?.address || "Branch pickup coordinates have not been configured."}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Current location</p><p className="mt-1 text-sm font-bold">{gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : "Waiting for GPS location"}</p>{gps?.accuracy != null && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Accuracy ±{Math.round(gps.accuracy)} m</p>}{gps && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last updated {new Date(gps.timestamp).toLocaleTimeString()}</p>}</div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rider is going to</p><p className="mt-1 text-sm font-bold">{order.address?.streetTole}, {order.address?.municipality}, {order.address?.district}</p>{distance != null && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`} direct distance to destination</p>}{distance != null && requirements?.geofenceRadiusMeters != null && distance <= requirements.geofenceRadiusMeters && <p className="mt-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">You are near the delivery location.</p>}</div>
          </div>
          {destination && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&${gps ? `origin=${gps.latitude},${gps.longitude}&` : ""}destination=${destination.latitude},${destination.longitude}&travelmode=driving`} className="soft-btn mt-4 min-h-11 justify-center"><Navigation size={16} />Navigate to customer</a>}
        </> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Live location sharing starts when you mark this order as out for delivery.</p>}
      </section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-extrabold">Delivery documents</h2><p className="mt-1 text-xs text-slate-500">Upload the required invoice, cheque, payment proof, or delivery proof before completion.</p></div><div className="flex gap-2"><select value={documentKind} onChange={event => setDocumentKind(event.target.value)} className="field min-h-11 w-auto">{[...new Set([...(requirements?.requiredDocumentTypes ?? []), "INVOICE", "CHEQUE", "PAYMENT_PROOF", "DELIVERY_PROOF"])].map(kind => <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>)}</select><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-teal-700 px-3 text-sm font-bold text-teal-800 hover:bg-teal-50">{uploading ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}{uploading ? "Uploading…" : "Upload"}<input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={uploadDocument} /></label></div></div>
        {missing.length > 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900">Still required: {missing.map(kind => kind.replaceAll("_", " ")).join(", " )}</p>}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{(order.documents ?? []).map(file => <li key={file.id} className="rounded-xl border border-slate-100 p-3 text-xs"><button className="inline-flex items-center gap-2 font-bold text-teal-800 underline" onClick={() => void downloadOrderDocument(file.downloadUrl, token()).catch(reason => setError(reason instanceof Error ? reason.message : "Document could not be downloaded."))}><FileText size={14} />{file.originalFileName}</button><span className="ml-2 text-slate-500">{file.kind.replaceAll("_", " ")}</span></li>)}</ul>
      </section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><label className="min-w-56 flex-1 text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">Delivery notes<textarea value={note} onChange={event => setNote(event.target.value)} className="field mt-3 min-h-20" placeholder="Add handoff or customer note" /></label>
        {requirements?.enforceGeofence && <div className="rounded-xl bg-slate-50 p-4 sm:min-w-64"><p className="text-sm font-extrabold">Delivery location check</p><p className="mt-1 text-xs text-slate-600">Must be within {requirements.geofenceRadiusMeters} m of the saved destination.</p><button type="button" onClick={captureLocation} className="soft-btn mt-3 min-h-10"><MapPin size={15} />{gps ? "Refresh my location" : "Share current location"}</button>{distance != null && <p className={`mt-2 text-xs font-bold ${distance <= requirements.geofenceRadiusMeters ? "text-emerald-700" : "text-rose-700"}`}>{Math.round(distance)} m away · {distance <= requirements.geofenceRadiusMeters ? "within range" : "move closer"}</p>}{!requirements.hasDestinationCoordinates && <p className="mt-2 text-xs font-semibold text-rose-700">The saved destination has no map location. Ask the customer to update it.</p>}{gpsError && <p role="alert" className="mt-2 text-xs text-rose-700">{gpsError}</p>}</div>}
      </div><div className="mt-4 grid gap-3 sm:grid-cols-2"><button disabled={!!busy || !actionFor[order.delivery?.status ?? ""] || (order.delivery?.status === "OUT_FOR_DELIVERY" && !deliverReady)} onClick={() => actionFor[order.delivery?.status ?? ""] && transition(actionFor[order.delivery?.status ?? ""].action)} className="primary-btn min-h-14 justify-center text-base disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={19} /> : <CheckCircle2 size={19} />}{busy ? "Saving…" : actionFor[order.delivery?.status ?? ""]?.label ?? "No next action"}</button>{order.delivery?.status === "OUT_FOR_DELIVERY" && <button disabled={!!busy} onClick={() => void transition("failed")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-base font-extrabold text-rose-700"><XCircle size={19} /> Delivery failed</button>}</div>
        {order.delivery?.status === "OUT_FOR_DELIVERY" && missing.length > 0 && <p className="mt-3 text-xs text-slate-600">Delivery completion is locked until the required documents are uploaded.</p>}
        {order.delivery?.status === "OUT_FOR_DELIVERY" && <label className="mt-4 block text-xs font-bold text-slate-600">Failure reason<input value={failure} onChange={event => setFailure(event.target.value)} className="field mt-2" placeholder="Customer unavailable, wrong address, payment issue…" /></label>}
      </section>
    </>}
  </StaffShell>;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1); const deltaLon = radians(lon2 - lon1);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
