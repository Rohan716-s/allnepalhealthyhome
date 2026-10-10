"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNetworkStatus } from "@/lib/offline/network-status";
import { OfflineStatus } from "@/components/offline-status";
import { toast } from "sonner";
import { getOfflineState, checkOfflineConnection, refreshOfflineCounts, setOfflineState, syncOfflineChanges } from "@/lib/offline/engine";
import { currentSession } from "@/lib/offline/policy";
import { deletePrivateCache } from "@/lib/offline/db";
import "@/services/api";

export function OfflineRuntime() {
  const pathname = usePathname();
  const network = useNetworkStatus();
  const previousOnline = useRef<boolean | null>(null);
  useEffect(() => {
    if (previousOnline.current === network.online) return;
    const wasOffline = previousOnline.current === false;
    previousOnline.current = network.online;
    if (!network.online) {
      if (sessionStorage.getItem("anhh-offline-dismissed") !== "1") toast.warning("You are offline", {
        id: "offline-status", duration: Infinity,
        description: "No internet connection detected. Supported changes will be saved locally and synced automatically when you are back online.",
        action: { label: "Dismiss", onClick: () => { sessionStorage.setItem("anhh-offline-dismissed", "1"); toast.dismiss("offline-status"); } },
        onDismiss: () => { if (!getOfflineState().online) sessionStorage.setItem("anhh-offline-dismissed", "1"); },
      });
    } else {
      toast.dismiss("offline-status");
      sessionStorage.removeItem("anhh-offline-dismissed");
      if (wasOffline && !network.pending) toast.success("Back online.", { id: "offline-recovered", duration: 3000 });
    }
  }, [network.online, network.pending]);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !(process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_OFFLINE_DEV === "1")) return;
    const warm = () => { void navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: "warm-shell", path: location.pathname + location.search, resources: performance.getEntriesByType("resource").map(entry => entry.name) })); };
    warm();
    const timer = setTimeout(warm, 2000);
    navigator.serviceWorker.addEventListener("controllerchange", warm);
    return () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener("controllerchange", warm); };
  }, [pathname]);
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let scope = currentSession()?.scope;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("anhh-offline") : undefined;
    const run = async (refresh = false) => {
      if (busy || stopped) return;
      busy = true;
      try {
        await refreshOfflineCounts();
        if (await checkOfflineConnection()) {
          await syncOfflineChanges();
          if (refresh && !stopped) window.dispatchEvent(new Event("anhh-offline-refresh"));
        }
      } finally { busy = false; }
    };
    const online = () => { void run(true); };
    const offline = () => {
      setOfflineState({ online: false });

    };
    const visible = () => { if (document.visibilityState === "visible") void run(true); };
    const auth = () => {
      const next = currentSession()?.scope;
      if (scope && scope !== next) void deletePrivateCache(scope).catch(() => undefined);
      scope = next;
      void run(true);
    };
    const saved = () => { toast.info("Saved on this device. Waiting to sync.", { id: "offline-saved" }); channel?.postMessage("changed"); };
    const synced = () => { void refreshOfflineCounts().then(() => { if (getOfflineState().pending) toast.info("Synced available changes. Some saved changes still need review or retry.", { id: "offline-saved" }); else toast.success("All changes synced successfully.", { id: "offline-saved" }); }); channel?.postMessage("changed"); };
    const message = () => { void refreshOfflineCounts(); window.dispatchEvent(new Event("anhh-offline-refresh")); };
    const navigate = (event: MouseEvent) => {
      if (navigator.onLine || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.download || link.origin !== location.origin || link.pathname === location.pathname) return;
      // Next's RSC flight data is deliberately not cached with document shells.
      event.preventDefault(); event.stopPropagation(); location.assign(link.href);
    };
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    window.addEventListener("focus", online); document.addEventListener("visibilitychange", visible);
    window.addEventListener("anhh-auth-changed", auth); window.addEventListener("storage", auth);
    window.addEventListener("anhh-offline-saved", saved); window.addEventListener("anhh-offline-synced", synced);
    document.addEventListener("click", navigate, true);
    if (channel) channel.onmessage = message;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", online);
      if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_OFFLINE_DEV === "1") {
        void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
          setOfflineState({ error: "Offline page loading is unavailable in this browser. Saved changes are still retained." });
        });
      }
    }
    setOfflineState({ online: navigator.onLine });
    void run();
    const retry = window.setInterval(() => { void run(); }, 15000);
    return () => {
      stopped = true; clearInterval(retry); channel?.close();
      window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.removeEventListener("focus", online);
      document.removeEventListener("visibilitychange", visible); document.removeEventListener("click", navigate, true);
      window.removeEventListener("anhh-auth-changed", auth); window.removeEventListener("storage", auth);
      window.removeEventListener("anhh-offline-saved", saved); window.removeEventListener("anhh-offline-synced", synced);
      navigator.serviceWorker?.removeEventListener("message", online);
    };
  }, []);
  return <OfflineStatus />;
}
