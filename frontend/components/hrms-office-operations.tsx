"use client";

/* eslint-disable react-hooks/set-state-in-effect -- load protected office records after the selected register changes. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, ClipboardCheck, ExternalLink, FileText, Megaphone, Pencil, RefreshCw, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { FormSaveActions } from "@/components/form-save-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOfficeOperationRecord, getOfficeOperationRecords, updateOfficeOperationRecord, type OfficeOperationRecord, type Staff } from "@/services/api";

const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
const modules = [
  ["NOTICE", "Notice board", "Publish internal announcements.", Megaphone],
  ["DOCUMENT", "Documents", "Track policies, files and document links.", FileText],
  ["OFFICIAL_VISIT", "Official visits", "Record planned field and official visits.", BriefcaseBusiness],
  ["WORK_LOG", "Work logs", "Capture daily work completed by staff.", ScrollText],
  ["APPRAISAL", "Appraisals", "Manage performance review records.", ClipboardCheck],
  ["CALENDAR_EVENT", "Calendar", "Plan organization and HR events.", CalendarDays],
] as const;
type ModuleId = (typeof modules)[number][0];
type FormState = { title: string; details: string; status: string; staffUserId: string; startsAt: string; endsAt: string; location: string; audience: string; referenceNumber: string; attachmentUrl: string };
const defaultStatus: Record<ModuleId, string> = { NOTICE: "DRAFT", DOCUMENT: "DRAFT", OFFICIAL_VISIT: "REQUESTED", WORK_LOG: "DRAFT", APPRAISAL: "DRAFT", CALENDAR_EVENT: "DRAFT" };
const statuses: Record<ModuleId, string[]> = { NOTICE: ["DRAFT", "PUBLISHED", "ARCHIVED"], DOCUMENT: ["DRAFT", "ACTIVE", "ARCHIVED"], OFFICIAL_VISIT: ["REQUESTED", "APPROVED", "COMPLETED", "REJECTED"], WORK_LOG: ["DRAFT", "SUBMITTED", "APPROVED"], APPRAISAL: ["DRAFT", "IN_PROGRESS", "COMPLETED"], CALENDAR_EVENT: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] };
const blank = (category: ModuleId): FormState => ({ title: "", details: "", status: defaultStatus[category], staffUserId: "", startsAt: "", endsAt: "", location: "", audience: category === "NOTICE" ? "ALL STAFF" : "", referenceNumber: "", attachmentUrl: "" });
const dateTimeValue = (value?: string) => value ? value.slice(0, 16) : "";
const displayDate = (value?: string) => value ? new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export function HrmsOfficeOperations({ staff }: { staff: Staff[] }) {
  const [active, setActive] = useState<ModuleId>("NOTICE");
  const [rows, setRows] = useState<OfficeOperationRecord[]>([]);
  const [form, setForm] = useState<FormState>(() => blank("NOTICE"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const selected = useMemo(() => modules.find(([id]) => id === active)!, [active]);
  const moduleName = selected[1];

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getOfficeOperationRecords(token(), active)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Office records could not be loaded."); }
    finally { setLoading(false); }
  }, [active]);
  useEffect(() => { void load(); }, [load]);

  function reset() { setEditingId(null); setForm(blank(active)); }
  function changeModule(category: ModuleId) { setActive(category); setEditingId(null); setForm(blank(category)); }
  function edit(row: OfficeOperationRecord) {
    setEditingId(row.id);
    setForm({ title: row.title, details: row.details ?? "", status: row.status, staffUserId: row.staffUserId ?? "", startsAt: dateTimeValue(row.startsAt), endsAt: dateTimeValue(row.endsAt), location: row.location ?? "", audience: row.audience ?? "", referenceNumber: row.referenceNumber ?? "", attachmentUrl: row.attachmentUrl ?? "" });
  }

  async function persist(addAnother = false) {
    if (!form.title.trim()) { toast.error("Enter a title before saving."); return; }
    setSaving(true);
    try {
      const input = { title: form.title.trim(), details: form.details.trim() || undefined, status: form.status, staffUserId: form.staffUserId || undefined, startsAt: form.startsAt || undefined, endsAt: form.endsAt || undefined, location: form.location.trim() || undefined, audience: form.audience.trim() || undefined, referenceNumber: form.referenceNumber.trim() || undefined, attachmentUrl: form.attachmentUrl.trim() || undefined };
      if (editingId) { await updateOfficeOperationRecord(token(), active, editingId, input); toast.success(`${moduleName} entry updated.`); }
      else { await createOfficeOperationRecord(token(), active, input); toast.success(`${moduleName} entry created.`); }
      reset(); await load();
      if (!addAnother) document.getElementById("office-operation-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "The office record could not be saved."); }
    finally { setSaving(false); }
  }

  return <div className="mt-7 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Office operations</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">Documents, notices and people operations</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Run the daily office modules inspired by the reference system in one clean, blue HR workspace. Each entry is stored, auditable and linked to an employee where relevant.</p></div><Button type="button" variant="outline" disabled={loading || saving} onClick={() => void load()}><RefreshCw size={16} />Refresh</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modules.map(([id, title, description, Icon]) => <button key={id} type="button" onClick={() => changeModule(id)} className={`rounded-2xl border p-4 text-left transition ${active === id ? "border-[#003893] bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"}`}><Icon size={19} className="text-[#003893]" /><p className="mt-3 text-sm font-extrabold text-slate-950">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></button>)}</div>
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card id="office-operation-list"><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>{moduleName}</CardTitle><span className="text-xs font-semibold text-slate-500">{rows.length} record{rows.length === 1 ? "" : "s"}</span></div></CardHeader><CardContent>{loading ? <p className="py-12 text-center text-sm text-slate-500">Loading {moduleName.toLowerCase()}…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-4"><p className="font-bold text-slate-900">{row.title}</p>{row.referenceNumber && <p className="mt-1 text-xs text-slate-500">Ref: {row.referenceNumber}</p>}{row.attachmentUrl && <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#003893] hover:underline" href={row.attachmentUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} />Open link</a>}</td><td className="px-4 py-4 text-slate-600">{row.staffName ?? "—"}</td><td className="px-4 py-4 text-xs text-slate-600">{displayDate(row.startsAt)}</td><td className="px-4 py-4"><Badge variant={row.status === "REJECTED" || row.status === "ARCHIVED" || row.status === "CANCELLED" ? "outline" : "secondary"}>{row.status.replaceAll("_", " ")}</Badge></td><td className="px-4 py-4 text-right"><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => edit(row)}><Pencil size={15} />Edit</Button></td></tr>)}{!rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No {moduleName.toLowerCase()} records yet. Create the first one from the form.</td></tr>}</tbody></table></div>}</CardContent></Card>
      <Card className="h-fit 2xl:sticky 2xl:top-24"><CardHeader><CardTitle>{editingId ? `Edit ${moduleName} entry` : `Create ${moduleName} entry`}</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void persist(); }}>
        <div className="grid gap-2"><Label htmlFor="office-title">Title</Label><Input id="office-title" required maxLength={220} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
        <div className="grid gap-2"><Label htmlFor="office-status">Status</Label><Select id="office-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statuses[active].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</Select></div>
        <div className="grid gap-2"><Label htmlFor="office-staff">Employee <span className="font-normal text-slate-400">optional</span></Label><Select id="office-staff" value={form.staffUserId} onChange={(event) => setForm({ ...form, staffUserId: event.target.value })}><option value="">Not linked to one employee</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.fullName} · {person.employeeId ?? person.role}</option>)}</Select></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="office-start">Starts</Label><Input id="office-start" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="office-end">Ends</Label><Input id="office-end" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></div></div>
        <div className="grid gap-2"><Label htmlFor="office-location">Location <span className="font-normal text-slate-400">optional</span></Label><Input id="office-location" maxLength={300} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="office-audience">Audience</Label><Input id="office-audience" maxLength={60} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} placeholder="e.g. All staff" /></div><div className="grid gap-2"><Label htmlFor="office-reference">Reference</Label><Input id="office-reference" maxLength={100} value={form.referenceNumber} onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })} /></div></div>
        <div className="grid gap-2"><Label htmlFor="office-link">Document link <span className="font-normal text-slate-400">optional</span></Label><Input id="office-link" type="url" maxLength={1000} value={form.attachmentUrl} onChange={(event) => setForm({ ...form, attachmentUrl: event.target.value })} placeholder="https://…" /></div>
        <div className="grid gap-2"><Label htmlFor="office-details">Details <span className="font-normal text-slate-400">optional</span></Label><Textarea id="office-details" maxLength={4000} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></div>
        <FormSaveActions mode={editingId ? "edit" : "create"} busy={saving} onCancel={reset} onSaveAndAnother={editingId ? undefined : () => void persist(true)} />
      </form></CardContent></Card>
    </div>
  </div>;
}
