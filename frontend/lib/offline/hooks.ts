"use client";
import { useEffect, useRef } from "react";
import { currentSession } from "./policy";

/** Refresh mounted views after a confirmed write or a connectivity recovery. */
export function useOfflineRefresh(refresh: () => unknown, prefix: string) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; scope: string }>).detail;
      if (detail && (detail.scope !== currentSession()?.scope || !detail.path.startsWith(prefix))) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void latest.current(); }, 150);
    };
    window.addEventListener("anhh-offline-data", update);
    window.addEventListener("anhh-offline-refresh", update);
    return () => { clearTimeout(timer); window.removeEventListener("anhh-offline-data", update); window.removeEventListener("anhh-offline-refresh", update); };
  }, [prefix]);
}
