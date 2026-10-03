"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Database, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminFaq,
  deleteAdminFaq,
  getAdminAssistantIntegration,
  getAdminFaqs,
  getAdminSettings,
  saveAdminAssistantIntegration,
  saveAdminSetting,
  updateAdminFaq,
  type AdminAssistantIntegration,
  type AdminFaq,
} from "@/services/api";

type PolicyKey = "assistant.policy" | "assistant.registration" | "assistant.delivery" | "assistant.returns";
const policyLabels: Record<PolicyKey, string> = {
  "assistant.policy": "Safety and scope policy",
  "assistant.registration": "Registration and pharmacy verification guidance",
  "assistant.delivery": "Delivery, branch, and payment guidance",
  "assistant.returns": "Return and refund policy",
};

const blankFaq = { question: "", answer: "", category: "", displayOrder: 10, published: true };

export default function ChatbotSettingsPage() {
  const [config, setConfig] = useState<AdminAssistantIntegration>({ enabled: true, configured: false, provider: "OPENAI", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" });
  const [apiKey, setApiKey] = useState("");
  const [policies, setPolicies] = useState<Record<PolicyKey, string>>({ "assistant.policy": "", "assistant.registration": "", "assistant.delivery": "", "assistant.returns": "" });
  const [faqs, setFaqs] = useState<AdminFaq[]>([]);
  const [faq, setFaq] = useState(blankFaq);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  function token() { return window.localStorage.getItem("anhh-staff-access-token") ?? ""; }

  useEffect(() => {
    const accessToken = window.localStorage.getItem("anhh-staff-access-token");
    if (!accessToken) return;
    Promise.all([getAdminAssistantIntegration(accessToken), getAdminFaqs(accessToken), getAdminSettings(accessToken)])
      .then(([assistant, faqRows, settings]) => {
        setConfig(assistant);
        setFaqs(faqRows);
        setPolicies((current) => Object.fromEntries(Object.keys(current).map((key) => [key, settings.find((item) => item.key === key)?.value ?? current[key as PolicyKey]])) as Record<PolicyKey, string>);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Chatbot settings could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  async function saveAssistant() {
    setSaving("assistant"); setError("");
    try {
      const saved = await saveAdminAssistantIntegration({ enabled: config.enabled, provider: config.provider, model: config.model ?? "gpt-4o-mini", baseUrl: config.baseUrl ?? "https://api.openai.com/v1", apiKey: apiKey || undefined }, token());
      setConfig(saved); setApiKey(""); toast.success("Chatbot settings saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Chatbot settings could not be saved."); }
    finally { setSaving(""); }
  }

  async function savePolicies() {
    setSaving("policies"); setError("");
    try {
      for (const [key, value] of Object.entries(policies)) await saveAdminSetting(key, { value, group: "assistant", isPublic: true, description: policyLabels[key as PolicyKey] }, token());
      toast.success("Knowledge base guidance saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Knowledge base could not be saved."); }
    finally { setSaving(""); }
  }

  async function saveFaq(event: React.FormEvent) {
    event.preventDefault();
    if (!faq.question.trim() || !faq.answer.trim()) return;
    setSaving("faq"); setError("");
    try {
      const input = { ...faq, question: faq.question.trim(), answer: faq.answer.trim(), category: faq.category.trim() || undefined };
      const saved = editingId ? await updateAdminFaq(editingId, input, token()) : await createAdminFaq(input, token());
      setFaqs((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [...current, saved].sort((a, b) => a.displayOrder - b.displayOrder));
      setFaq(blankFaq); setEditingId(null); toast.success(editingId ? "FAQ updated." : "FAQ added.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "FAQ could not be saved."); }
    finally { setSaving(""); }
  }

  async function removeFaq(id: string) {
    setSaving(`delete-${id}`); setError("");
    try { await deleteAdminFaq(id, token()); setFaqs((current) => current.filter((item) => item.id !== id)); toast.success("FAQ removed."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "FAQ could not be removed."); }
    finally { setSaving(""); }
  }

  return <AdminShell superAdmin><div className="mx-auto max-w-5xl">
    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#003893]">Customer experience</p>
    <h1 className="mt-2 text-3xl font-black text-slate-950">AI chatbot</h1>
    <p className="mt-2 max-w-3xl text-sm text-slate-500">Configure the customer-facing assistant. It uses live products, branches, delivery zones, published articles, FAQs, and your policy text as grounded knowledge.</p>
    {error && <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {loading ? <Card className="mt-6"><CardContent className="p-6 text-sm text-slate-500">Loading chatbot settings…</CardContent></Card> : <>
      <Card className="mt-6 border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="text-[#003893]" size={19} />Assistant connection</CardTitle><p className="text-sm text-slate-500">Use OpenAI or any compatible chat-completions endpoint. The API key is encrypted in the database and never shown after saving.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label htmlFor="assistant-enabled">Website status</Label><Select id="assistant-enabled" value={config.enabled ? "enabled" : "disabled"} onChange={(event) => setConfig({ ...config, enabled: event.target.value === "enabled" })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></Select></div>
        <div><Label htmlFor="assistant-provider">Provider</Label><Select id="assistant-provider" value={config.provider} onChange={(event) => setConfig({ ...config, provider: event.target.value })}><option value="OPENAI">OpenAI</option><option value="OPENAI_COMPATIBLE">OpenAI-compatible API</option></Select></div>
        <div><Label htmlFor="assistant-model">Model</Label><Input id="assistant-model" value={config.model ?? ""} onChange={(event) => setConfig({ ...config, model: event.target.value })} placeholder="gpt-4o-mini" /></div>
        <div><Label htmlFor="assistant-base-url">API base URL</Label><Input id="assistant-base-url" value={config.baseUrl ?? ""} onChange={(event) => setConfig({ ...config, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" /></div>
        <div className="md:col-span-2"><Label htmlFor="assistant-api-key">API key {config.configured && <Badge className="ml-2" variant="secondary"><CheckCircle2 className="mr-1" size={12} />Configured</Badge>}</Label><Input id="assistant-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config.configured ? "Leave blank to keep the saved key" : "Paste provider API key"} /></div>
        <div className="md:col-span-2"><Button onClick={() => void saveAssistant()} disabled={saving === "assistant"}><Save size={15} />{saving === "assistant" ? "Saving…" : "Save assistant settings"}</Button></div>
      </CardContent></Card>

      <Card className="mt-6 border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="text-[#003893]" size={19} />Knowledge base guidance</CardTitle><p className="text-sm text-slate-500">Keep these operational answers current. Product, branch, delivery-zone, article, and FAQ records are retrieved automatically.</p></CardHeader><CardContent className="grid gap-5">{(Object.keys(policies) as PolicyKey[]).map((key) => <div key={key}><Label htmlFor={key}>{policyLabels[key]}</Label><textarea id={key} value={policies[key]} onChange={(event) => setPolicies({ ...policies, [key]: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2 focus:ring-[#003893]/30" /></div>)}<Button className="w-fit" onClick={() => void savePolicies()} disabled={saving === "policies"}><Save size={15} />{saving === "policies" ? "Saving…" : "Save knowledge guidance"}</Button></CardContent></Card>

      <Card className="mt-6 border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="text-[#003893]" size={19} />FAQ knowledge entries</CardTitle><p className="text-sm text-slate-500">Only published FAQs are available to customers and the assistant.</p></CardHeader><CardContent><form onSubmit={saveFaq} className="grid gap-3 rounded-xl bg-slate-50 p-4"><Label htmlFor="faq-question">Question</Label><Input id="faq-question" value={faq.question} onChange={(event) => setFaq({ ...faq, question: event.target.value })} placeholder="How does pharmacy verification work?" required /><Label htmlFor="faq-answer">Answer</Label><Textarea id="faq-answer" value={faq.answer} onChange={(event) => setFaq({ ...faq, answer: event.target.value })} placeholder="Write the approved answer…" rows={4} required /><div className="grid gap-3 sm:grid-cols-[1fr_120px_140px_160px] sm:items-end"><div><Label htmlFor="faq-category">Category</Label><Input id="faq-category" value={faq.category} onChange={(event) => setFaq({ ...faq, category: event.target.value })} placeholder="Delivery" /></div><div><Label htmlFor="faq-order">Order</Label><Input id="faq-order" type="number" min={0} value={faq.displayOrder} onChange={(event) => setFaq({ ...faq, displayOrder: Number(event.target.value) })} /></div><div><Label htmlFor="faq-visibility">Visibility</Label><Select id="faq-visibility" value={faq.published ? "published" : "draft"} onChange={(event) => setFaq({ ...faq, published: event.target.value === "published" })}><option value="published">Published</option><option value="draft">Draft</option></Select></div><Button type="submit" disabled={saving === "faq"}>{saving === "faq" ? "Saving…" : editingId ? "Update FAQ" : "Add FAQ"}</Button></div>{editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setFaq(blankFaq); }}>Cancel editing</Button>}</form><div className="mt-5 grid gap-3">{faqs.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="font-bold text-slate-900">{item.question}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.answer}</p><p className="mt-2 text-xs text-slate-400">{item.category || "General"} · {item.published ? "Published" : "Draft"}</p></div><div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(item.id); setFaq({ question: item.question, answer: item.answer, category: item.category ?? "", displayOrder: item.displayOrder, published: item.published }); }}>Edit</Button><Button type="button" variant="ghost" size="sm" onClick={() => void removeFaq(item.id)} disabled={saving === `delete-${item.id}`} aria-label="Delete FAQ"><Trash2 size={15} /></Button></div></div></div>)}{faqs.length === 0 && <p className="text-sm text-slate-500">No FAQ entries yet.</p>}</div></CardContent></Card>
    </>}</div></AdminShell>;
}
