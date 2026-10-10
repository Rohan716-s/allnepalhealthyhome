"use client";
import { useEffect, useRef, useState } from "react";

export function useDeliveryClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);
  return now;
}

/** Existing SignalR delivery invalidations, with a polling fallback. */
export function useDeliveryRefresh(refresh: () => unknown, orderId?: string) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useEffect(() => {
    let pending = false;
    let cancelled = false;
    const update = async () => {
      if (cancelled || pending || document.hidden || !navigator.onLine) return;
      pending = true;
      try { await latest.current(); } catch { /* Keep the last known state. */ }
      finally { pending = false; }
    };
    const changed = (event: Event) => {
      const id = (event as CustomEvent<{ orderId?: string }>).detail?.orderId;
      if (!orderId || !id || id === orderId) void update();
    };
    const visible = () => { void update(); };
    const timer = window.setInterval(visible, 10000);
    window.addEventListener("anhh-delivery-location-changed", changed);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("anhh-delivery-location-changed", changed);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [orderId]);
}
