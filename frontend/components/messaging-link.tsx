"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, getMessagingConversations } from "@/services/api";

type MessagingAccountType = "staff" | "customer";

export function MessagingLink({ compact = false, accountType = "customer", href }: { compact?: boolean; accountType?: MessagingAccountType; href?: string }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const readSession = () => setSessionToken(window.localStorage.getItem(accountType === "staff" ? "anhh-staff-access-token" : "anhh-access-token"));
    readSession();
    window.addEventListener("anhh-auth-changed", readSession);
    window.addEventListener("storage", readSession);
    return () => { window.removeEventListener("anhh-auth-changed", readSession); window.removeEventListener("storage", readSession); };
  }, [accountType]);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (!sessionToken) return;
      getMessagingConversations(sessionToken).then(rows => { if (active) setUnread(rows.reduce((sum, row) => sum + row.unreadCount, 0)); }).catch((error) => {
        if (active && error instanceof ApiError && error.status === 401) { setSessionToken(null); setUnread(0); }
      });
    };
    load(); const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [sessionToken]);
  if (!sessionToken) return null;
  const destination = href ?? `/messages?account=${accountType}`;
  return <Link href={destination} className={`relative inline-flex items-center gap-2 rounded-xl text-slate-600 transition hover:text-[#003893] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] focus-visible:ring-offset-2 dark:text-slate-300 ${compact ? "p-2" : "px-3 py-2"}`} aria-label={`Messages${unread ? `, ${unread} unread` : ""}`} title="Messages"><MessageCircle size={compact ? 19 : 17} />{!compact && <span className="hidden text-xs font-bold sm:inline">Messages</span>}{unread > 0 && <b className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#DC143C] px-1 text-center text-[10px] leading-4 text-white">{unread > 99 ? "99+" : unread}</b>}</Link>;
}
