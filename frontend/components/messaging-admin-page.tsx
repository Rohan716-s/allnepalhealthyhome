"use client";

/* eslint-disable react-hooks/set-state-in-effect -- restore the requested panel from the URL after mount. */
import { useEffect, useState } from "react";
import { Eye, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { MessagingCenter } from "@/components/messaging-center";
import { getMessagingOversight, getMessagingRoleSettings, updateMessagingRoleSetting, type MessageConversation, type MessagingRoleSetting } from "@/services/api";

const accessToken = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
type MessagingTab = "inbox" | "oversight";

export function MessagingAdminPage() {
  const [activeTab, setActiveTab] = useState<MessagingTab>("inbox");
  const [roles, setRoles] = useState<MessagingRoleSetting[]>([]);
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyRole, setBusyRole] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "oversight") setActiveTab("oversight");
  }, []);

  useEffect(() => {
    if (activeTab !== "oversight") return;
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([getMessagingRoleSettings(accessToken()), getMessagingOversight(accessToken())])
      .then(([roleRows, conversationRows]) => {
        if (!active) return;
        setRoles(roleRows);
        setConversations(conversationRows);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Messaging settings could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeTab, refreshKey]);

  function changeTab(tab: MessagingTab) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/superadmin/messaging?tab=${tab}`);
  }

  async function toggle(row: MessagingRoleSetting) {
    setBusyRole(row.role);
    try {
      const saved = await updateMessagingRoleSetting(row.role, !row.isEnabled, accessToken());
      setRoles((current) => current.map((item) => item.role === row.role ? saved : item));
      toast.success(`${row.role} messaging ${saved.isEnabled ? "enabled" : "disabled"}.`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Messaging setting could not be saved.");
    } finally {
      setBusyRole("");
    }
  }

  return <AdminShell superAdmin>
    <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#003893]">Superadmin control</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Messaging</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Use the staff inbox to start conversations and reply as Superadmin. Oversight and role controls are kept separate and access is audited.</p>

      <div className="mt-6 flex gap-2 border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Messaging views">
        <button type="button" role="tab" aria-selected={activeTab === "inbox"} onClick={() => changeTab("inbox")} className={`rounded-t-xl border-b-2 px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] ${activeTab === "inbox" ? "border-[#003893] text-[#003893] dark:text-blue-300" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>Inbox</button>
        <button type="button" role="tab" aria-selected={activeTab === "oversight"} onClick={() => changeTab("oversight")} className={`rounded-t-xl border-b-2 px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] ${activeTab === "oversight" ? "border-[#003893] text-[#003893] dark:text-blue-300" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>Oversight & access</button>
      </div>

      {activeTab === "inbox" ? <div className="pt-5"><MessagingCenter accountType="staff" returnTo="/superadmin/messaging?tab=inbox" /></div> : <div role="tabpanel" className="pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">Oversight and role access</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Role settings and recent conversation summaries. Viewing this page is recorded in the audit log.</p></div><button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button></div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</div>}
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" aria-busy="true">Loading messaging controls…</div> : <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"><h3 className="flex items-center gap-2 font-black text-slate-950 dark:text-white"><ShieldOff size={18} className="text-[#003893]" />Role controls</h3><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Disabled roles cannot send or receive new conversations.</p><div className="mt-4 space-y-2">{roles.map((row) => <div key={row.role} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700"><span className="text-sm font-bold text-slate-900 dark:text-slate-100">{row.role}</span><button type="button" disabled={!!busyRole} aria-pressed={row.isEnabled} onClick={() => void toggle(row)} className={`rounded-full px-3 py-1.5 text-xs font-black transition hover:ring-2 hover:ring-offset-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] disabled:cursor-wait disabled:opacity-50 ${row.isEnabled ? "bg-emerald-100 text-emerald-800 hover:ring-emerald-500 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-200 text-slate-700 hover:ring-slate-500 dark:bg-slate-700 dark:text-slate-100"}`}>{busyRole === row.role ? "Saving…" : row.isEnabled ? "Enabled" : "Disabled"}</button></div>)}</div></section>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"><h3 className="flex items-center gap-2 font-black text-slate-950 dark:text-white"><Eye size={18} className="text-[#003893]" />Recent conversations</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Read-only oversight summaries. Reply from your own Inbox conversations; this view does not impersonate participants.</p><div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto">{conversations.map((row) => <div key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-slate-950 dark:text-white">{row.otherParticipantName}</span><span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">{row.otherParticipantRole}</span></div><p className="mt-1 break-words text-sm text-slate-700 dark:text-slate-200">{row.preview || "No messages yet"}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.lastMessageAt ? new Date(row.lastMessageAt).toLocaleString() : "No messages yet"}</p></div>)}{conversations.length === 0 && <div className="rounded-xl bg-slate-100 p-8 text-center text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">No conversations found.</div>}</div></section>
        </div>}
      </div>}
    </div>
  </AdminShell>;
}
