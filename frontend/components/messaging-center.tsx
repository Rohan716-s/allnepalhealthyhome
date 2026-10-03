"use client";

/* eslint-disable react-hooks/set-state-in-effect -- restore the selected authenticated account after mount. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HubConnection, HubConnectionBuilder, HttpTransportType, LogLevel } from "@microsoft/signalr";
import { ChevronLeft, FileText, MapPin, MessageCircle, Paperclip, RefreshCw, Search, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL, ApiError, createMessagingConversation, downloadMessagingAttachment, getMessagingContacts, getMessagingConversations, getMessagingThread, markMessagingConversationRead, sendMessagingMessage, uploadMessagingAttachment, type MessageConversation, type MessagingContact, type PlatformMessage } from "@/services/api";

type MessagingAccountType = "staff" | "customer";

function sessionToken(accountType: MessagingAccountType) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(accountType === "staff" ? "anhh-staff-access-token" : "anhh-access-token") ?? "";
}

function notifyNewMessage(message: PlatformMessage) {
  if (typeof window === "undefined" || document.visibilityState === "visible") return;
  if ("Notification" in window && Notification.permission === "granted") new Notification("New message", { body: message.body || "You received a new message." });
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-NP", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function MessagingCenter({ accountType, returnTo = "/messages" }: { accountType: MessagingAccountType; returnTo?: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [contacts, setContacts] = useState<MessagingContact[]>([]);
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [thread, setThread] = useState<PlatformMessage[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<MessageConversation>();
  const [compose, setCompose] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [startingContactId, setStartingContactId] = useState<string>();
  const [typing, setTyping] = useState(false);
  const [liveConnectionError, setLiveConnectionError] = useState(false);
  const [connection, setConnection] = useState<HubConnection>();
  const [attachment, setAttachment] = useState<File>();
  const [loadError, setLoadError] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | undefined>(undefined);
  const joinedConversationRef = useRef<string | undefined>(undefined);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadConversations = useCallback(async (accessToken: string) => {
    const rows = await getMessagingConversations(accessToken);
    setConversations(rows);
    setSelectedSummary((current) => rows.find((row) => row.id === current?.id) ?? current);
    return rows;
  }, []);

  const expireSession = useCallback(() => {
    const key = accountType === "staff" ? "anhh-staff-access-token" : "anhh-access-token";
    window.localStorage.removeItem(key);
    if (accountType === "staff") window.localStorage.removeItem("anhh-staff");
    window.dispatchEvent(new Event("anhh-auth-changed"));
    const loginPath = accountType === "staff" ? "/staff/login" : "/login";
    router.replace(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`);
  }, [accountType, returnTo, router]);

  useEffect(() => {
    const accessToken = sessionToken(accountType);
    setToken(accessToken);
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([getMessagingContacts(accessToken), loadConversations(accessToken)])
      .then(([people, rows]) => {
        if (!active) return;
        setContacts(people);
        if (!selectedIdRef.current && rows[0]) {
          selectedIdRef.current = rows[0].id;
          setSelectedId(rows[0].id);
          setMobileThreadOpen(true);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          expireSession();
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Messages could not be loaded. Check your connection and retry.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountType, expireSession, loadConversations]);

  const refreshInbox = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    setLoadError("");
    try {
      const rows = await loadConversations(token);
      const activeId = selectedIdRef.current;
      if (activeId && rows.some((row) => row.id === activeId)) {
        const loaded = await getMessagingThread(activeId, token);
        setThread(loaded.messages);
        setSelectedSummary(loaded.conversation);
        await markMessagingConversationRead(activeId, token);
        await loadConversations(token);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expireSession();
        return;
      }
      const message = error instanceof Error ? error.message : "The inbox could not be refreshed. Please try again.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }, [expireSession, loadConversations, token]);

  useEffect(() => {
    if (!token) return;
    const hub = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/messaging`, { accessTokenFactory: () => token, transport: HttpTransportType.LongPolling, withCredentials: false })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build();
    let disposed = false;
    let retryTimer: number | undefined;

    const joinActiveConversation = async (id: string) => {
      if (disposed || hub.state !== "Connected" || joinedConversationRef.current === id) return;
      const previous = joinedConversationRef.current;
      if (previous) await hub.invoke("LeaveConversation", previous).catch(() => undefined);
      joinedConversationRef.current = undefined;
      await hub.invoke("JoinConversation", id);
      joinedConversationRef.current = id;
      setLiveConnectionError(false);
    };

    hub.on("conversation:updated", async ({ conversationId }: { conversationId: string }) => {
      try {
        await loadConversations(token);
        if (conversationId !== selectedIdRef.current && "Notification" in window && Notification.permission === "default") void Notification.requestPermission();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "A new conversation update could not be loaded.");
      }
    });
    hub.on("message:new", async ({ conversationId }: { conversationId: string }) => {
      if (conversationId !== selectedIdRef.current) {
        try { await loadConversations(token); } catch { /* The next refresh can recover the list. */ }
        return;
      }
      try {
        const loaded = await getMessagingThread(conversationId, token);
        setThread(loaded.messages);
        setSelectedSummary(loaded.conversation);
        const latest = loaded.messages.at(-1);
        if (latest && !latest.isMine) notifyNewMessage(latest);
        await markMessagingConversationRead(conversationId, token);
        await loadConversations(token);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "The new message could not be loaded.");
      }
    });
    hub.on("conversation:read", async ({ conversationId }: { conversationId: string }) => {
      try {
        await loadConversations(token);
        if (conversationId === selectedIdRef.current) {
          const loaded = await getMessagingThread(conversationId, token);
          setThread(loaded.messages);
          setSelectedSummary(loaded.conversation);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Read status could not be refreshed.");
      }
    });
    hub.on("typing", ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (conversationId === selectedIdRef.current) setTyping(isTyping);
    });
    hub.onreconnected(() => {
      setLiveConnectionError(false);
      joinedConversationRef.current = undefined;
      const activeId = selectedIdRef.current;
      if (activeId) void joinActiveConversation(activeId).catch(() => setLiveConnectionError(true));
    });

    setConnection(hub);
    const connect = () => {
      if (disposed || hub.state !== "Disconnected") return;
      void hub.start().then(async () => {
        if (disposed) return;
        setLiveConnectionError(false);
        const activeId = selectedIdRef.current;
        if (activeId) await joinActiveConversation(activeId);
      }).catch(() => {
        if (disposed) return;
        setLiveConnectionError(true);
        retryTimer = window.setTimeout(connect, 3000);
      });
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      joinedConversationRef.current = undefined;
      void hub.stop();
    };
  }, [loadConversations, token]);

  useEffect(() => {
    if (!selectedId || !token) return;
    let active = true;
    getMessagingThread(selectedId, token)
      .then(async (loaded) => {
        if (!active) return;
        setThread(loaded.messages);
        setSelectedSummary(loaded.conversation);
        await markMessagingConversationRead(selectedId, token);
        if (active) await loadConversations(token);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          expireSession();
          return;
        }
        setLoadError(error instanceof Error ? error.message : "This conversation could not be opened.");
      });
    return () => { active = false; };
  }, [expireSession, loadConversations, selectedId, token]);

  useEffect(() => {
    if (!selectedId || !connection || connection.state !== "Connected") return;
    const previous = joinedConversationRef.current;
    if (previous === selectedId) return;
    let active = true;
    void (async () => {
      if (previous) await connection.invoke("LeaveConversation", previous).catch(() => undefined);
      joinedConversationRef.current = undefined;
      await connection.invoke("JoinConversation", selectedId);
      if (active) {
        joinedConversationRef.current = selectedId;
        setLiveConnectionError(false);
      }
    })().catch(() => { if (active) setLiveConnectionError(true); });
    return () => { active = false; };
  }, [connection, selectedId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread, typing]);

  const filteredConversations = useMemo(() => conversations.filter((row) => `${row.otherParticipantName} ${row.otherParticipantRole} ${row.preview ?? ""}`.toLowerCase().includes(contactSearch.toLowerCase())), [conversations, contactSearch]);
  const filteredContacts = useMemo(() => contacts.filter((person) => `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(contactSearch.toLowerCase())), [contacts, contactSearch]);

  async function startConversation(contact: MessagingContact) {
    setStartingContactId(`${contact.participantType}:${contact.id}:${contact.orderId ?? ""}`);
    setLoadError("");
    try {
      const created = await createMessagingConversation({ recipientId: contact.id, recipientType: contact.participantType, subject: `Conversation with ${contact.name}`, orderId: contact.orderId }, token);
      selectedIdRef.current = created.conversation.id;
      setSelectedId(created.conversation.id);
      setSelectedSummary(created.conversation);
      setThread(created.messages);
      setMobileThreadOpen(true);
      await loadConversations(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Conversation could not be started.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setStartingContactId(undefined);
    }
  }

  async function send() {
    if (!selectedId || selectedSummary?.isClosed || sending || (!compose.trim() && !attachment)) return;
    setSending(true);
    setLoadError("");
    try {
      const message = attachment
        ? await uploadMessagingAttachment(selectedId, attachment, compose, token)
        : await sendMessagingMessage(selectedId, { body: compose.trim() }, token);
      setThread((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setCompose("");
      setAttachment(undefined);
      await loadConversations(token);
      void connection?.invoke("Typing", selectedId, false).catch(() => undefined);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expireSession();
        return;
      }
      const message = error instanceof Error ? error.message : "Message could not be sent. Please try again.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  const openAttachment = useCallback(async (id: string) => {
    const previewWindow = window.open("about:blank", "_blank");
    try {
      const blob = await downloadMessagingAttachment(id, token);
      const url = URL.createObjectURL(blob);
      if (previewWindow) previewWindow.location.href = url;
      else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "attachment";
        anchor.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow?.close();
      const message = error instanceof Error ? error.message : "Attachment could not be opened.";
      setLoadError(message);
      toast.error(message);
    }
  }, [token]);

  useEffect(() => {
    const handleAttachmentClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="/api/messaging/attachments/"]');
      if (!anchor) return;
      const id = anchor.href.split("/api/messaging/attachments/")[1]?.split(/[?#]/)[0];
      if (!id) return;
      event.preventDefault();
      void openAttachment(id);
    };
    document.addEventListener("click", handleAttachmentClick);
    return () => document.removeEventListener("click", handleAttachmentClick);
  }, [openAttachment]);

  function shareLocation() {
    if (!selectedId || selectedSummary?.isClosed) return;
    if (!navigator.geolocation) {
      const message = "Location sharing is not supported in this browser.";
      setLoadError(message);
      toast.error(message);
      return;
    }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const message = await sendMessagingMessage(selectedId, { latitude: coords.latitude, longitude: coords.longitude, locationLabel: "Shared current location", locationSource: "GPS" }, token);
        setThread((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        await loadConversations(token);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Location could not be shared.";
        setLoadError(message);
        toast.error(message);
      }
    }, () => {
      const message = "Location permission was not granted.";
      setLoadError(message);
      toast.error(message);
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  if (!token) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10"><MessageCircle className="mx-auto mb-3 text-[#003893]" size={34} /><h2 className="text-xl font-black text-slate-950">Sign in to view messages</h2><p className="mt-2 text-sm text-slate-600">Your conversations and attachments are private to your account.</p></div>;
  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600" aria-busy="true">Loading your inbox…</div>;

  return <div className="messages-center">
    {loadError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><span>{loadError}</span><button type="button" onClick={() => void refreshInbox()} className="rounded-lg px-3 py-1.5 font-bold underline underline-offset-2 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700">Retry</button></div>}
    <section aria-label="Secure messages" className="messages-panel grid h-[min(72dvh,720px)] min-h-[560px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.10)] lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={`messages-sidebar ${mobileThreadOpen ? "hidden" : "block"} border-b border-slate-200 bg-slate-50/70 lg:block lg:border-b-0 lg:border-r`}>
        <div className="messages-sidebar-header flex items-center justify-between border-b border-slate-200 bg-white p-4 sm:p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#003893]">Inbox</p><h2 className="mt-1 text-xl font-black text-slate-950">Messages</h2></div>
          <button type="button" onClick={() => void refreshInbox()} disabled={refreshing} aria-label="Refresh inbox" title="Refresh inbox" className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-[#003893] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] disabled:cursor-wait disabled:opacity-60"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button>
        </div>
        <div className="p-3"><label className="messages-search flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-slate-500 focus-within:border-[#003893] focus-within:ring-2 focus-within:ring-[#003893]/20"><Search size={15} aria-hidden="true" /><span className="sr-only">Search people and conversations</span><input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Find a person or conversation" className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500" /></label></div>
        <div className="max-h-[min(34vh,250px)] overflow-y-auto px-2 pb-3 lg:max-h-[520px]">
          {filteredConversations.map((row) => <button key={row.id} type="button" onClick={() => { selectedIdRef.current = row.id; setSelectedId(row.id); setMobileThreadOpen(true); }} className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] ${selectedId === row.id ? "bg-blue-100" : "hover:bg-slate-100"}`} aria-current={selectedId === row.id ? "true" : undefined}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-slate-950">{row.otherParticipantName}</span>{row.unreadCount > 0 && <b className="rounded-full bg-[#B20D2E] px-2 py-0.5 text-[10px] text-white" aria-label={`${row.unreadCount} unread messages`}>{row.unreadCount > 99 ? "99+" : row.unreadCount}</b>}</div><p className="mt-1 truncate text-xs text-slate-600">{row.preview || row.otherParticipantRole}</p></button>)}
          {!filteredConversations.length && <p className="px-3 py-4 text-sm text-slate-600">{contactSearch ? "No matching conversations." : "No conversations yet. Start one below."}</p>}
          {filteredContacts.length > 0 && <p className="px-3 pb-2 pt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Start a conversation</p>}
          {filteredContacts.map((person) => {
            const contactId = `${person.participantType}:${person.id}:${person.orderId ?? ""}`;
            return <button key={contactId} type="button" disabled={!!startingContactId} onClick={() => void startConversation(person)} className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] disabled:cursor-wait disabled:opacity-60"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-[#003893]">{startingContactId === contactId ? <RefreshCw size={15} className="animate-spin" /> : <UserRound size={16} />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-950">{person.name}</span><span className="block truncate text-xs text-slate-600">{person.role}{person.orderId ? " · Order chat" : person.branchName ? ` · ${person.branchName}` : ""}</span></span></button>;
          })}
        </div>
      </aside>

      <div className={`messages-thread-panel ${mobileThreadOpen ? "flex" : "hidden lg:flex"} min-h-0 flex-col`}>
        {selectedId ? <>
          <header className="messages-thread-header flex min-h-[86px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button type="button" onClick={() => setMobileThreadOpen(false)} aria-label="Back to conversations" title="Back to conversations" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] lg:hidden"><ChevronLeft size={20} /></button>
              <div className="min-w-0"><h3 className="truncate font-black text-slate-950">{selectedSummary?.otherParticipantName || "Conversation"}</h3><p className={`truncate text-xs ${liveConnectionError ? "text-amber-700" : "text-slate-600"}`}>{liveConnectionError ? "Live updates reconnecting…" : selectedSummary?.isClosed ? "Read-only · conversation closed" : selectedSummary?.otherParticipantRole || "Secure platform messaging"}</p></div>
            </div>
            <ShieldCheck size={19} className="shrink-0 text-emerald-700" aria-label="Secure conversation" />
          </header>

          <div className="messages-thread-body min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f7f9fc] p-3 sm:p-5" aria-live="polite" aria-label="Conversation messages">
            {thread.map((message) => <div key={message.id} className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] break-words rounded-2xl px-4 py-3 shadow-sm sm:max-w-[min(80%,560px)] ${message.isMine ? "rounded-br-md bg-[#003893] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-950"}`}>
                {!message.isMine && <p className="mb-1 text-[11px] font-bold text-slate-600">{message.senderName}{message.senderRole ? ` · ${message.senderRole}` : ""}</p>}
                {message.body && <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>}
                {message.locationLabel && <a className={`mt-3 block rounded-xl p-3 text-xs font-semibold underline underline-offset-2 ${message.isMine ? "bg-white/15 text-white hover:bg-white/25" : "bg-blue-50 text-blue-900 hover:bg-blue-100"}`} target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}><MapPin size={14} className="mr-1 inline" />{message.locationLabel}</a>}
                {message.attachments.map((file) => <button key={file.id} type="button" onClick={() => void openAttachment(file.id)} className={`mt-3 flex max-w-full items-center gap-2 rounded-xl p-3 text-left text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current ${message.isMine ? "bg-white/15 text-white hover:bg-white/25" : "bg-blue-50 text-blue-900 hover:bg-blue-100"}`}><FileText size={15} className="shrink-0" /><span className="break-all">{file.originalFileName}</span></button>)}
                <div className={`mt-2 flex items-center justify-end gap-2 text-[10px] font-medium ${message.isMine ? "text-blue-100" : "text-slate-600"}`}><span>{formatTime(message.createdAt)}</span>{message.isMine && <span>{message.seenAt ? "Seen" : message.deliveredAt ? "Delivered" : "Sent"}</span>}</div>
              </div>
            </div>)}
            {typing && <div className="text-xs font-medium italic text-slate-600">Someone is typing…</div>}
            {!thread.length && <div className="messages-thread-empty mx-auto grid h-full min-h-40 max-w-sm place-items-center content-center rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center shadow-sm"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-[#003893]"><MessageCircle size={22} aria-hidden="true" /></span><p className="mt-4 font-black text-slate-900">No messages yet</p><p className="mt-1 text-sm leading-6 text-slate-500">Send a message to start this conversation.</p></div>}
            <div ref={bottomRef} />
          </div>

          <div className="messages-composer border-t border-slate-200 bg-white p-3 sm:p-4">
            {selectedSummary?.isClosed && <div className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">This order conversation is closed after delivery or cancellation.</div>}
            {attachment && <div className="mb-2 flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800"><span className="truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)} aria-label="Remove attachment" className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893]"><X size={14} /></button></div>}
            <div className="flex items-end gap-1.5 sm:gap-2">
              <label className={`grid h-11 w-10 shrink-0 place-items-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-100 hover:text-[#003893] focus-within:ring-2 focus-within:ring-[#003893] ${selectedSummary?.isClosed ? "pointer-events-none opacity-50" : "cursor-pointer"}`} title="Attach a file"><Paperclip size={18} /><span className="sr-only">Attach a file</span><input type="file" disabled={selectedSummary?.isClosed} className="sr-only" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setAttachment(event.target.files?.[0])} /></label>
              <button type="button" onClick={shareLocation} disabled={selectedSummary?.isClosed} className="grid h-11 w-10 shrink-0 place-items-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-100 hover:text-[#003893] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Share current location" title="Share current location"><MapPin size={18} /></button>
              <textarea disabled={selectedSummary?.isClosed || sending} value={compose} onChange={(event) => { setCompose(event.target.value); if (selectedId) void connection?.invoke("Typing", selectedId, event.target.value.length > 0).catch(() => undefined); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={1} maxLength={4000} aria-label="Write a message" placeholder={selectedSummary?.isClosed ? "Conversation closed" : "Write a message…"} className="max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-5 text-slate-950 outline-none placeholder:text-slate-500 focus:border-[#003893] focus:ring-2 focus:ring-[#003893]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600" />
              <button type="button" onClick={() => void send()} disabled={selectedSummary?.isClosed || sending || (!compose.trim() && !attachment)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#003893] text-white transition hover:bg-[#002b70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400" aria-label={sending ? "Sending message" : "Send message"} title="Send message"><Send size={17} /></button>
            </div>
            <p className="mt-1.5 pl-1 text-[11px] text-slate-600">Press Enter to send · Shift+Enter for a new line</p>
          </div>
        </> : <div className="messages-select-empty grid flex-1 place-items-center bg-[#f7f9fc] p-8 text-center text-slate-600"><div className="max-w-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-[#003893]"><MessageCircle size={26} aria-hidden="true" /></span><p className="mt-4 font-bold text-slate-900">Select a conversation</p><p className="mt-1 text-sm">Choose a contact or open an existing thread.</p></div></div>}
      </div>
    </section>
  </div>;
}
