"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Radio } from "lucide-react";
import { ApiError, getRiderAvailability, setRiderAvailability, updateAvailableRiderLocation, type RiderAvailability } from "@/services/api";

function riderToken() {
  return window.localStorage.getItem("anhh-staff-access-token") ?? "";
}

export function RiderAvailabilityControl({ variant = "full" }: { variant?: "full" | "compact" }) {
  const [availability, setAvailability] = useState<RiderAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [now, setNow] = useState(0);
  const lastSent = useRef<{ latitude: number; longitude: number; sentAt: number } | null>(null);
  const lastAttempt = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const token = riderToken();
    let cancelled = false;
    let fetching = false;
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const state = await getRiderAvailability(token);
        if (!cancelled) {
          setAvailability(state);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : "Rider availability could not be loaded.");
      } finally {
        fetching = false;
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!availability?.isAvailable || availability.hasActiveDelivery) return;
    const geolocation = navigator.geolocation;
    if (!geolocation) return;
    let cancelled = false;
    const watchId = geolocation.watchPosition(position => {
      const current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      const previous = lastSent.current;
      const movedEnough = !previous || distanceMeters(previous, current) >= 40;
      const waitedLongEnough = !previous || Date.now() - previous.sentAt >= 30000;
      if ((!movedEnough && !waitedLongEnough) || pending.current || Date.now() - lastAttempt.current < 15000) return;
      pending.current = true;
      lastAttempt.current = Date.now();
      void updateAvailableRiderLocation(current, riderToken()).then(location => {
        lastSent.current = { ...current, sentAt: Date.now() };
        if (!cancelled) {
          setAvailability(state => state ? { ...state, location } : state);
          setWarning("");
        }
      }).catch(reason => {
        if (!cancelled) {
          setWarning(reason instanceof ApiError ? reason.message : "Location update failed; tracking will retry.");
          void getRiderAvailability(riderToken()).then(setAvailability).catch(() => undefined);
        }
      }).finally(() => { pending.current = false; });
    }, error => {
      if (cancelled) return;
      setWarning(error.code === error.PERMISSION_DENIED
        ? "Location permission was denied. Turn on permission to stay available for nearby assignments."
        : "Unable to access your location. Check your device settings and retry.");
      if (error.code === error.PERMISSION_DENIED) {
        void setRiderAvailability(false, riderToken())
          .then(setAvailability)
          .catch(reason => setError(reason instanceof Error ? reason.message : "Availability could not be turned off."));
      }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
    return () => { cancelled = true; geolocation.clearWatch(watchId); };
  }, [availability?.isAvailable, availability?.hasActiveDelivery]);

  async function toggleAvailability() {
    if (!availability || busy || availability.hasActiveDelivery) return;
    setError("");
    setWarning("");
    if (!availability.isAvailable) {
      if (!navigator.geolocation) {
        setWarning("Location is unavailable in this browser. Check your device location settings.");
        return;
      }
      setBusy(true);
      navigator.geolocation.getCurrentPosition(async position => {
        pending.current = true;
        const first = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        lastSent.current = { ...first, sentAt: Date.now() };
        try {
          const state = await setRiderAvailability(true, riderToken());
          setAvailability(state);
          const location = await updateAvailableRiderLocation(first, riderToken());
          setAvailability(current => current ? { ...current, location } : current);
        } catch (reason) {
          lastSent.current = null;
          setError(reason instanceof ApiError ? reason.message : "Availability could not be turned on.");
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }, locationError => {
        setWarning(locationError.code === locationError.PERMISSION_DENIED
          ? "Location permission is required while marked Available. Enable it in your browser settings and retry."
          : "Unable to access your location. Check your device location settings and retry.");
        setBusy(false);
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
      return;
    }
    setBusy(true);
    try {
      const state = await setRiderAvailability(false, riderToken());
      setAvailability(state);
      lastSent.current = null;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Availability could not be turned off.");
    } finally {
      setBusy(false);
    }
  }

  const isAvailable = Boolean(availability?.isAvailable && !availability.hasActiveDelivery);
  const locationUpdatedAt = availability?.location?.updatedAt ? Date.parse(availability.location.updatedAt) : Number.NaN;
  const locationIsFresh = Number.isFinite(locationUpdatedAt) && now > 0 && now - locationUpdatedAt <= 120000;
  const statusLabel = loading ? "Checking availability…" : availability?.hasActiveDelivery
    ? "Assigned delivery · live tracking starts when delivery is out"
    : isAvailable ? locationIsFresh
      ? "Available · location sharing is on"
      : "Available · waiting for a recent GPS location"
      : "Offline · location sharing is off";

  if (variant === "compact") {
    const shortStatus = loading ? "Checking" : availability?.hasActiveDelivery ? "On delivery" : isAvailable ? "Available" : "Offline";
    return <div className="flex shrink-0 items-center gap-2" title={error || warning || statusLabel}>
      <span className={`size-2.5 shrink-0 rounded-full ${loading ? "animate-pulse bg-amber-400" : availability?.hasActiveDelivery ? "bg-blue-500" : isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} aria-label={shortStatus} />
      <span className="hidden text-[11px] font-bold text-slate-600 dark:text-slate-300 sm:inline">{shortStatus}</span>
      <button type="button" onClick={() => void toggleAvailability()} disabled={loading || busy || availability?.hasActiveDelivery} aria-label={isAvailable ? "Go offline" : availability?.hasActiveDelivery ? "On delivery" : "Go available"} className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-xs ${isAvailable ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" : "bg-teal-700 text-white hover:bg-teal-800"}`}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
        <span className="sm:hidden">{isAvailable ? "Go offline" : availability?.hasActiveDelivery ? "On delivery" : "Go online"}</span>
        <span className="hidden sm:inline">{isAvailable ? "Go offline" : availability?.hasActiveDelivery ? "On delivery" : "Go available"}</span>
      </button>
      {(error || warning) && <span className="sr-only" role={error ? "alert" : "status"}>{error || warning}</span>}
    </div>;
  }

  return <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <div className="flex min-w-0 items-start gap-3">
      <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${isAvailable ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : availability?.hasActiveDelivery ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}><Radio size={19} /></span>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Rider availability</h2>
        <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{statusLabel}</p>
        {availability?.location && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Last location {new Date(availability.location.updatedAt).toLocaleTimeString()}{availability.location.accuracy != null ? ` · GPS ±${Math.round(availability.location.accuracy)} m` : ""}</p>}
        {isAvailable && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Your location is shared only while you choose Available. Turning Offline stops sharing.</p>}
        {(error || warning) && <p role={error ? "alert" : "status"} className={`mt-2 text-xs font-semibold ${error ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>{error || warning}</p>}
      </div>
    </div>
    <button type="button" onClick={() => void toggleAvailability()} disabled={loading || busy || availability?.hasActiveDelivery} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${isAvailable ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" : "bg-teal-700 text-white hover:bg-teal-800"}`}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
      {isAvailable ? "Go Offline" : availability?.hasActiveDelivery ? "On Delivery" : "Go Available"}
    </button>
  </section>;
}

function distanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLon = radians(to.longitude - from.longitude);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
