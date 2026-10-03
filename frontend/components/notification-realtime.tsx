"use client";

import { HubConnectionBuilder, LogLevel, type HubConnection } from "@microsoft/signalr";
import { useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/services/api";

export function NotificationRealtime() {
  useEffect(() => {
    let connection: HubConnection | undefined;
    let cancelled = false;
    const connect = async () => {
      await connection?.stop().catch(() => undefined);
      if (cancelled) return;
      const token = localStorage.getItem("anhh-staff-access-token") || localStorage.getItem("anhh-access-token");
      if (!token) return;
      const next = new HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/hubs/notifications`, { accessTokenFactory: () => token })
        .configureLogging(LogLevel.None)
        .withAutomaticReconnect()
        .build();
      next.on("notification", (notice: { id?: string; type?: string; title?: string; body?: string; isRead?: boolean }) => {
        window.dispatchEvent(new CustomEvent("anhh-notification", { detail: notice }));
        toast.info(notice.title || "New notification", { description: notice.body || "You have an update." });
      });
      connection = next;
      try { await next.start(); } catch { /* Reconnect when network or auth state changes. */ }
    };
    void connect();
    window.addEventListener("anhh-auth-changed", connect);
    return () => { cancelled = true; window.removeEventListener("anhh-auth-changed", connect); void connection?.stop(); };
  }, []);
  return null;
}
