"use client";
import { RecordTable } from "@/components/entity-record-table";
import { EntityListWorkspace, EntityListPanel, showEntityList, EntityFormPanel , entitySaveComplete , routeEntityEdit, useEntityRecord , useWorkspaceSelection } from "@/components/entity-list-panel";
import { useOfflineRefresh } from "@/lib/offline/hooks";

/* eslint-disable react-hooks/set-state-in-effect -- load protected HR setup data after the selected register changes. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CircleDollarSign, ClipboardList, FileText, Landmark, Layers3, Pencil, RefreshCw, ShieldCheck, Tags, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { FormSaveActions } from "@/components/form-save-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createHrmsSetupItem, getHrmsSetupItems, updateHrmsSetupItem, type HrmsSetupItem } from "@/services/api";

const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";

const registers = [
  ["DEPARTMENT", "Departments", "Organize teams and reporting areas.", BriefcaseBusiness],
  ["JOB_TITLE", "Job titles", "Define positions used on employee records.", Tags],
  ["APPOINTMENT_TYPE", "Appointment types", "Full-time, part-time, contract and other arrangements.", UsersRound],
  ["EMPLOYEE_STATUS", "Employee statuses", "Employment lifecycle labels.", ShieldCheck],
  ["LEAVE_TYPE", "Leave types", "Annual, sick, unpaid and custom leave policies.", ClipboardList],
  ["SALARY_COMPONENT", "Salary components", "Reusable earnings and allowance heads.", CircleDollarSign],
  ["SALARY_DEDUCTION", "Salary deductions", "Reusable deduction and contribution heads.", CircleDollarSign],
  ["EMPLOYEE_FUND", "Employee funds", "Provident fund, insurance and staff funds.", Landmark],
  ["COMPETENCY", "Competencies", "Skills tracked in performance reviews.", Layers3],
  ["PERFORMANCE_LEVEL", "Performance levels", "Rating scales for appraisal results.", Tags],
  ["APPRAISAL_TEMPLATE", "Appraisal templates", "Reusable appraisal structures.", FileText],
  ["APPRAISAL_TOPIC", "Appraisal topics", "Topics and evaluation sections.", ClipboardList],
  ["SUBJECT_TEMPLATE", "Subject templates", "Consistent review and document subjects.", FileText],
  ["ORGANOGRAM", "Organogram", "Reporting-line and organization labels.", UsersRound],
] as const;

type RegisterId = (typeof registers)[number][0];
type FormState = { name: string; code: string; description: string; isActive: boolean };
const emptyForm: FormState = { name: "", code: "", description: "", isActive: true };

export function HrmsSetupPage() {
  const [active, setActive] = useWorkspaceSelection<RegisterId>("register", "DEPARTMENT");
  const [rows, setRows] = useState<HrmsSetupItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const selected = useMemo(() => registers.find(([id]) => id === active)!, [active]);
  const registerName = selected[1];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getHrmsSetupItems(token(), active));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "HR setup could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [active]);

  useOfflineRefresh(load, "/api/hrms/");
  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function changeRegister(id: RegisterId) {
    setActive(id);
    resetForm();
  }

  useEntityRecord(rows, edit, "0");
  function edit(item: HrmsSetupItem) { if (routeEntityEdit(item.id, "0")) return;
    setEditingId(item.id);
    setForm({ name: item.name, code: item.code ?? "", description: item.description ?? "", isActive: item.isActive });
  }

  async function persist(addAnother = false) {
    const name = form.name.trim();
    if (!name) {
      toast.error("Enter a name before saving.");
      return;
    }
    setSaving(true);
    try {
      const input = { name, code: form.code.trim() || undefined, description: form.description.trim() || undefined, isActive: form.isActive };
      if (editingId) {
        await updateHrmsSetupItem(token(), active, editingId, input);
        toast.success(`${registerName} entry updated.`);
      } else {
        await createHrmsSetupItem(token(), active, input);
        toast.success(`${registerName} entry created.`);
      }
      resetForm();
      await load();
      if (!addAnother) showEntityList();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "The HR setup entry could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: HrmsSetupItem) {
    setSaving(true);
    try {
      await updateHrmsSetupItem(token(), active, item.id, { name: item.name, code: item.code, description: item.description, isActive: !item.isActive });
      toast.success(`${item.name} is now ${item.isActive ? "inactive" : "active"}.`);
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "The item status could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  return <EntityListWorkspace title="Setup">{<div className="mt-7 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">HR and payroll configuration</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">HR setup registers</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Manage the master data that powers employee records, leave, payroll and performance reviews. Existing data is kept safely; you can deactivate entries when they should no longer be used.</p>
      </div>
      <Button type="button" variant="outline" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={16} />Refresh</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {registers.map(([id, title, description, Icon]) => <button key={id} type="button" onClick={() => changeRegister(id)} className={`rounded-2xl border p-4 text-left transition ${active === id ? "border-[#003893] bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"}`}>
        <Icon size={19} className="text-[#003893]" />
        <p className="mt-3 text-sm font-extrabold text-slate-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </button>)}
    </div>

    <div className="grid min-w-0 gap-6">
      <EntityListPanel formKey="0"><Card id="hrms-setup-list">
        <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>{registerName}</CardTitle><span className="text-xs font-semibold text-slate-500">{rows.length} item{rows.length === 1 ? "" : "s"}</span></div></CardHeader>
        <CardContent>
          {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading {registerName.toLowerCase()}…</p> : <div className="overflow-x-auto"><RecordTable className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item) => <tr key={item.id}><td className="px-4 py-4 font-bold text-slate-900">{item.name}</td><td className="px-4 py-4 font-mono text-xs text-slate-600">{item.code || "—"}</td><td className="max-w-md px-4 py-4 text-slate-600">{item.description || "—"}</td><td className="px-4 py-4"><Badge variant={item.isActive ? "secondary" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => edit(item)} disabled={saving}><Pencil size={15} />Edit</Button><Button type="button" variant="outline" size="sm" onClick={() => void toggle(item)} disabled={saving}>{item.isActive ? "Deactivate" : "Activate"}</Button></div></td></tr>)}{!rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No {registerName.toLowerCase()} yet. Create the first entry using the form.</td></tr>}</tbody></RecordTable></div>}
        </CardContent>
      </Card></EntityListPanel>

      <EntityFormPanel formKey="0"><Card className="h-fit "><CardHeader><CardTitle>{editingId ? `Edit ${registerName} entry` : `Create ${registerName} entry`}</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void persist(); }}>
        <div className="grid gap-2"><Label htmlFor="hrms-setup-name">Name</Label><Input id="hrms-setup-name" required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={`e.g. ${active === "DEPARTMENT" ? "Pharmacy operations" : "New entry"}`} /></div>
        <div className="grid gap-2"><Label htmlFor="hrms-setup-code">Code <span className="font-normal text-slate-400">optional</span></Label><Input id="hrms-setup-code" maxLength={60} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Short internal code" /></div>
        <div className="grid gap-2"><Label htmlFor="hrms-setup-description">Description <span className="font-normal text-slate-400">optional</span></Label><Textarea id="hrms-setup-description" maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="How this entry should be used" /></div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Available for new records</label>
        <FormSaveActions mode={editingId ? "edit" : "create"} busy={saving} onCancel={resetForm} onSaveAndAnother={editingId ? undefined : () => void persist(true)} />
      </form></CardContent></Card></EntityFormPanel>
    </div>
  </div>}</EntityListWorkspace>;
}
