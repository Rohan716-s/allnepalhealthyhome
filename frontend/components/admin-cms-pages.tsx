"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit3, FileText, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { FormSaveActions } from "@/components/form-save-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dateInputToUtc, utcToDateInput } from "@/lib/date-time";
import { createAdminCmsPage, getAdminCmsPages, updateAdminCmsPage, type AdminCmsPage } from "@/services/api";

type CmsForm = { slug: string; title: string; content: string; status: string; seoTitle: string; metaDescription: string; publishedAt: string };
const blank: CmsForm = { slug: "", title: "", content: "", status: "DRAFT", seoTitle: "", metaDescription: "", publishedAt: "" };
const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";

export function AdminCmsPages({ view = "list", pageId, embedded = true }: { view?: "list" | "form"; pageId?: string; embedded?: boolean }) {
  const router = useRouter();
  const editing = Boolean(pageId);
  const listPath = "/superadmin/cms";
  const [rows, setRows] = useState<AdminCmsPage[]>([]);
  const [form, setForm] = useState<CmsForm>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const loaded = await getAdminCmsPages(token()); setRows(loaded);
      if (pageId) {
        const page = loaded.find(row => row.id === pageId);
        if (!page) throw new Error("CMS page could not be found.");
        setForm({ slug: page.slug, title: page.title, content: page.content, status: page.status, seoTitle: page.seoTitle ?? "", metaDescription: page.metaDescription ?? "", publishedAt: utcToDateInput(page.publishedAt) });
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "CMS pages could not be loaded."); }
    finally { setLoading(false); }
  }, [pageId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  function field(key: keyof CmsForm, value: string) { setForm(current => ({ ...current, [key]: value })); }
  async function persist(saveAndAnother = false) {
    setError("");
    if (!form.slug.trim() || !form.title.trim() || !form.content.trim()) { setError("Slug, title, and content are required."); return; }
    const publishedAt = dateInputToUtc(form.publishedAt);
    setSaving(true);
    try {
      const input = { slug: form.slug.trim().toLowerCase(), title: form.title.trim(), content: form.content.trim(), status: form.status, seoTitle: form.seoTitle || undefined, metaDescription: form.metaDescription || undefined, publishedAt };
      const saved = editing ? await updateAdminCmsPage(pageId!, input, token()) : await createAdminCmsPage(input, token());
      toast.success(editing ? `${saved.title} updated successfully.` : `${saved.title} created successfully.`);
      setRows(current => editing ? current.map(row => row.id === saved.id ? saved : row) : [saved, ...current]);
      if (editing || !saveAndAnother) router.push(listPath); else { setForm(blank); window.scrollTo({ top: 0, behavior: "smooth" }); }
    } catch (reason) { const message = reason instanceof Error ? reason.message : "CMS page could not be saved."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  }

  const card = view === "form" ? <Card className={embedded ? "mt-6" : "mt-7"}><CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18} className="text-[#003893]" />{editing ? "Edit CMS page" : "Create CMS page"}</CardTitle></CardHeader><CardContent>{loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading CMS page…</div> : <form onSubmit={event => { event.preventDefault(); void persist(); }} className="grid gap-5 md:grid-cols-2"><div className="grid gap-2"><Label htmlFor="cms-slug">Slug</Label><Input id="cms-slug" required value={form.slug} onChange={event => field("slug", event.target.value)} placeholder="about-us" /></div><div className="grid gap-2"><Label htmlFor="cms-title">Title</Label><Input id="cms-title" required value={form.title} onChange={event => field("title", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="cms-status">Status</Label><Select id="cms-status" value={form.status} onChange={event => field("status", event.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select></div><div className="grid gap-2"><Label htmlFor="cms-published">Publish date</Label><Input id="cms-published" type="datetime-local" value={form.publishedAt} onChange={event => field("publishedAt", event.target.value)} /></div><div className="grid gap-2 md:col-span-2"><Label htmlFor="cms-content">Content</Label><Textarea id="cms-content" required value={form.content} onChange={event => field("content", event.target.value)} className="min-h-48" placeholder="Plain text or sanitized rich content" /></div><div className="grid gap-2"><Label htmlFor="cms-seo-title">SEO title</Label><Input id="cms-seo-title" value={form.seoTitle} onChange={event => field("seoTitle", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="cms-meta">Meta description</Label><Input id="cms-meta" value={form.metaDescription} onChange={event => field("metaDescription", event.target.value)} /></div>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}<div className="md:col-span-2"><FormSaveActions mode={editing ? "edit" : "create"} busy={saving} onCancel={() => router.push(listPath)} onSaveAndAnother={!editing ? () => void persist(true) : undefined} saveLabel={editing ? "Save Changes" : "Save & List"} /></div></form>}</CardContent></Card> : <Card className={embedded ? "mt-6" : "mt-7"}><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><FileText size={18} className="text-[#003893]" />CMS pages</span><Button type="button" onClick={() => router.push(`${listPath}/create`)}><Plus size={16} />Add page</Button></CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={17} />Loading CMS pages…</div> : <div className="grid gap-3">{rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-extrabold">{row.title}</p><p className="mt-1 text-xs text-slate-500">/{row.slug} · {row.content.slice(0, 90)}{row.content.length > 90 ? "…" : ""}</p></div><div className="flex items-center gap-2"><Badge variant={row.status === "PUBLISHED" ? "default" : "secondary"}>{row.status}</Badge><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${row.title}`} title={`Edit ${row.title}`} onClick={() => router.push(`${listPath}/${row.id}/edit`)}><Edit3 size={16} /></Button></div></div>)}{!rows.length && <p className="p-8 text-center text-sm text-slate-500">No CMS pages created yet.</p>}</div>}</CardContent></Card>;
  return embedded ? card : <AdminShell superAdmin>{card}</AdminShell>;
}
