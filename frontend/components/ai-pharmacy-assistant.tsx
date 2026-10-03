"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bot, MessageCircle, Pill, Send, ShoppingBag } from "lucide-react";
import { getAssistantConfig, sendAssistantMessage, resolveMediaUrl, type AssistantProduct, type AssistantSuggestedPrompt } from "@/services/api";
import { formatNPR } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  products?: AssistantProduct[];
  suggestions?: AssistantSuggestedPrompt[];
  supportUrl?: string;
};

const welcomeMessage: ChatMessage = {
  id: 1,
  role: "assistant",
  text: "Hello. I’m your pharmacy assistant. I can help you find products, understand ordering steps, and answer general questions about prescriptions, delivery, and payments.",
  suggestions: [
    { label: "Find a product", prompt: "Do you have sunscreen?" },
    { label: "Prescription help", prompt: "How do I upload a prescription?" },
    { label: "Delivery & branches", prompt: "Where do you deliver?" },
  ],
};

export function AiPharmacyAssistant() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [nextId, setNextId] = useState(2);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [enabled, setEnabled] = useState(true);
  const [assistantName, setAssistantName] = useState("ANHH Assistant");
  const [showHint, setShowHint] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const hiddenOnManagementRoutes = useMemo(() => /^(\/admin|\/superadmin|\/staff|\/pharmacist|\/delivery|\/messages|\/register)(\/|$)/.test(pathname), [pathname]);

  useEffect(() => {
    let cancelled = false;
    getAssistantConfig().then((config) => {
      if (!cancelled) {
        setEnabled(config.enabled);
        setAssistantName(config.name || "ANHH Assistant");
      }
    }).catch(() => undefined);
    const storedSession = window.localStorage.getItem("anhh-assistant-session");
    const nextSession = storedSession || crypto.randomUUID();
    setSessionId(nextSession);
    window.localStorage.setItem("anhh-assistant-session", nextSession);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (open || hiddenOnManagementRoutes || !enabled) return;
    const timer = window.setTimeout(() => setShowHint(true), 5000);
    return () => window.clearTimeout(timer);
  }, [enabled, hiddenOnManagementRoutes, open]);

  if (hiddenOnManagementRoutes || !enabled) return null;

  async function submitMessage(value = input) {
    const message = value.trim();
    if (!message || sending) return;
    const userId = nextId;
    const assistantId = nextId + 1;
    setNextId(assistantId + 1);
    setInput("");
    setMessages((current) => [...current, { id: userId, role: "user", text: message }]);
    setSending(true);
    try {
      const response = await sendAssistantMessage(message, sessionId);
      setSessionId(response.sessionId);
      window.localStorage.setItem("anhh-assistant-session", response.sessionId);
      setMessages((current) => [...current, { id: assistantId, role: "assistant", text: response.message, products: response.products, suggestions: response.suggestedPrompts, supportUrl: response.supportUrl }]);
    } catch (error) {
      setMessages((current) => [...current, { id: assistantId, role: "assistant", text: error instanceof Error ? error.message : "I’m having trouble connecting right now. Please try again or contact our team." }]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage();
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) setShowHint(false); }}>
      <DialogTrigger asChild>
        <div className="fixed bottom-5 right-4 z-[60] sm:bottom-6 sm:right-6">
          {showHint && <span className="absolute bottom-14 right-0 hidden w-36 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-primary)] shadow-lg sm:block">Hi, need help?</span>}
          <Button size="icon-lg" className="h-12 w-12 animate-pulse rounded-full bg-[var(--color-primary)] shadow-lg shadow-slate-900/20 transition hover:animate-none hover:-translate-y-0.5 hover:bg-[var(--color-primary-dark)]" aria-label="Open pharmacy assistant" title="Open pharmacy assistant">
            <MessageCircle size={21} />
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="bottom-4 right-4 left-auto top-auto max-h-[min(720px,calc(100vh-2rem))] w-[calc(100%-2rem)] max-w-md translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:right-6">
        <DialogHeader className="border-b border-slate-100 bg-[var(--color-primary)] px-5 py-4 text-white">
          <div className="flex items-start gap-3 pr-6">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15"><Bot size={19} /></div>
            <div>
              <DialogTitle className="text-base text-white">{assistantName}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-white/75">Product discovery and ordering guidance</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex max-h-[min(510px,calc(100vh-12rem))] flex-col overflow-y-auto bg-[var(--color-surface-secondary)] px-4 py-4" role="log" aria-live="polite">
          <div className="grid gap-4">
            {messages.map((message) => <div key={message.id} className={`${message.role === "user" ? "ml-auto max-w-[88%]" : "mr-auto max-w-[94%]"} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
              <div className={message.role === "user" ? "rounded-2xl rounded-br-md bg-[var(--color-primary)] px-3.5 py-2.5 text-sm leading-6 text-white" : "rounded-2xl rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm leading-6 text-[var(--color-text-primary)] shadow-sm"}>{message.text}</div>
              {message.products && message.products.length > 0 && <div className="mt-2 grid gap-2">{message.products.map((product) => <ProductResult key={product.id} product={product} />)}</div>}
              {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{message.suggestions.map((suggestion) => <button key={suggestion.prompt} type="button" onClick={() => void submitMessage(suggestion.prompt)} disabled={sending} className="rounded-full border border-[var(--color-primary)]/25 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] disabled:opacity-50">{suggestion.label}</button>)}</div>}
              {message.role === "assistant" && message.supportUrl && <Link href={message.supportUrl} className="mt-2 inline-flex text-[11px] font-bold text-[var(--color-primary)] hover:underline">Contact human support</Link>}
            </div>)}
            {sending && <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-xs text-[var(--color-text-secondary)] shadow-sm"><span className="flex gap-1" aria-label="Assistant is typing"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /></span>Thinking…</div>}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about products or ordering…" maxLength={500} aria-label="Ask the pharmacy assistant" disabled={sending} />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Send message" title="Send message"><Send size={16} /></Button>
        </form>
        <p className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-3 text-[10px] leading-4 text-[var(--color-text-secondary)]">General information only — this assistant does not diagnose or prescribe. Please speak with a pharmacist for medical advice.</p>
      </DialogContent>
    </Dialog>
  );
}

function ProductResult({ product }: { product: AssistantProduct }) {
  const image = resolveMediaUrl(product.imageUrls?.[0] ?? product.imageUrl);
  return <Card className="flex items-center gap-3 rounded-xl border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-none"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--color-surface-secondary)]">{image ? <Image src={image} alt="" width={48} height={48} unoptimized className="h-full w-full object-contain p-1 mix-blend-multiply" /> : <Pill size={19} className="text-slate-400" />}</div><div className="min-w-0 flex-1"><Link href={`/products/${product.slug}`} className="line-clamp-1 text-xs font-bold text-[var(--color-text-primary)] hover:text-[var(--color-primary)]">{product.name}</Link><p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{product.brand}{product.pricesVisible !== false ? ` · ${formatNPR(product.price)}` : " · Contact us for pricing"}</p><p className={`mt-0.5 text-[10px] font-semibold ${product.stockQuantity > 0 ? "text-emerald-600" : "text-rose-600"}`}>{product.stockQuantity > 0 ? "In stock" : "Currently unavailable"}{product.prescriptionRequired ? " · pharmacist review required" : ""}</p></div><ShoppingBag size={15} className="shrink-0 text-slate-300" aria-hidden="true" /></Card>;
}
