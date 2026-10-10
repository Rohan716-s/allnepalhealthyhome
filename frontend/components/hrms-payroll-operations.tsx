"use client";
import { RecordTable } from "@/components/entity-record-table";
import { EntityListWorkspace, EntityListPanel, EntityFormPanel , entitySaveComplete , useWorkspaceSelection } from "@/components/entity-list-panel";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Check, ClipboardList, FileClock, Landmark, Plus, ReceiptText, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { FormSaveActions } from "@/components/form-save-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPlatformDate } from "@/lib/date-time";
import { getPlatformDateInput, getPlatformMonthInput } from "@/lib/platform-time-preferences";
import {
  createSalaryRevision,
  decidePayroll,
  decideSalaryRevision,
  getPayroll,
  getPayrollSuggestion,
  getSalaryRevisions,
  savePayroll,
  type PayrollComponent,
  type PayrollRecord,
  type PayrollSuggestion,
  type SalaryRevision,
  type Staff,
} from "@/services/api";

const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
const money = (value: number) => `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const normaliseMonth = (month: string) => `${month}-01`;
type PayrollComponentDraft = { componentName: string; componentKind: PayrollComponent["componentKind"]; amount: string };
const blankComponent = (): PayrollComponentDraft => ({ componentName: "", componentKind: "EARNING", amount: "0" });
const blankPayroll = (month = getPlatformMonthInput()) => ({ staffUserId: "", payrollMonth: month, basicSalary: "", allowances: "0", overtimeAmount: "0", bonus: "0", deductions: "0", components: [] as PayrollComponentDraft[] });
const blankRevision = () => ({ staffUserId: "", title: "", revisionType: "INCREMENT", effectiveDate: getPlatformDateInput(), revisedBasicSalary: "", reason: "", attachmentUrl: "" });
const blankPayment = () => ({ paidAtUtc: `${getPlatformDateInput()}T12:00`, paymentMethod: "BANK_TRANSFER", paymentReference: "", paymentNotes: "" });

function statusVariant(status: string) {
  if (status === "PAID" || status === "APPROVED") return "secondary" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "outline" as const;
}

export function HrmsPayrollOperations({ staff, dateFormat }: { staff: Staff[]; dateFormat: "AD" | "BS" }) {
  const [view, setView] = useWorkspaceSelection<"payroll" | "revisions">("payroll", "payroll");
  const [month, setMonth] = useState(getPlatformMonthInput());
  const [rows, setRows] = useState<PayrollRecord[]>([]);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [payrollForm, setPayrollForm] = useState(blankPayroll);
  const [revisionForm, setRevisionForm] = useState(blankRevision);
  const [suggestion, setSuggestion] = useState<PayrollSuggestion | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PayrollRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState(blankPayment);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const employees = useMemo(() => staff.filter((item) => item.isActive && item.role !== "CUSTOMER"), [staff]);
  const componentEarnings = useMemo(() => payrollForm.components.filter((component) => component.componentKind === "EARNING").reduce((sum, component) => sum + (Number(component.amount) || 0), 0), [payrollForm.components]);
  const componentDeductions = useMemo(() => payrollForm.components.filter((component) => component.componentKind === "DEDUCTION").reduce((sum, component) => sum + (Number(component.amount) || 0), 0), [payrollForm.components]);
  const grossPreview = (Number(payrollForm.basicSalary) || suggestion?.suggestedBasicSalary || 0) + (Number(payrollForm.allowances) || 0) + (Number(payrollForm.overtimeAmount) || 0) + (Number(payrollForm.bonus) || 0) + componentEarnings;
  const netPreview = Math.max(0, grossPreview - (Number(payrollForm.deductions) || 0) - componentDeductions);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payrollRows, revisionRows] = await Promise.all([getPayroll(token(), normaliseMonth(month)), getSalaryRevisions(token())]);
      setRows(payrollRows);
      setRevisions(revisionRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payroll operations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  const loadSuggestion = useCallback(async () => {
    if (!payrollForm.staffUserId) return;
    try {
      setSuggestion(await getPayrollSuggestion(token(), payrollForm.staffUserId, normaliseMonth(payrollForm.payrollMonth)));
    } catch (error) {
      setSuggestion(null);
      toast.error(error instanceof Error ? error.message : "The payroll salary suggestion could not be loaded.");
    }
  }, [payrollForm.payrollMonth, payrollForm.staffUserId]);

  useEffect(() => {
    const refresh = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(refresh);
  }, [load]);

  useEffect(() => {
    if (!payrollForm.staffUserId) return;
    const refresh = window.setTimeout(() => { void loadSuggestion(); }, 0);
    return () => window.clearTimeout(refresh);
  }, [loadSuggestion, payrollForm.staffUserId]);

  function updateComponent(index: number, patch: Partial<PayrollComponentDraft>) {
    setPayrollForm((current) => ({ ...current, components: current.components.map((component, componentIndex) => componentIndex === index ? { ...component, ...patch } : component) }));
  }

  async function savePayrollRecord(saveAndAnother = false) {
    if (!payrollForm.staffUserId || !payrollForm.payrollMonth) { toast.error("Choose an employee and payroll month."); return; }
    setSaving(true);
    try {
      await savePayroll(token(), {
        staffUserId: payrollForm.staffUserId,
        payrollMonth: normaliseMonth(payrollForm.payrollMonth),
        basicSalary: Number(payrollForm.basicSalary) || 0,
        allowances: Number(payrollForm.allowances) || 0,
        overtimeAmount: Number(payrollForm.overtimeAmount) || 0,
        bonus: Number(payrollForm.bonus) || 0,
        deductions: Number(payrollForm.deductions) || 0,
        components: payrollForm.components.map((component) => ({ componentName: component.componentName.trim(), componentKind: component.componentKind, amount: Number(component.amount) || 0 })),
      });
      toast.success("Payroll record saved as a draft.");
      setPayrollForm(blankPayroll(month));
      setSuggestion(null);
      await load();
      if (!saveAndAnother) setView("payroll");
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payroll record could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function decidePayrollRecord(row: PayrollRecord, status: "APPROVED" | "DRAFT") {
    if (!window.confirm(`${status === "APPROVED" ? "Approve" : "Return"} ${row.staffName}'s payroll for ${month}?`)) return;
    try {
      await decidePayroll(token(), row.id, { status });
      toast.success(`Payroll ${status.toLowerCase()}.`);
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payroll status could not be updated.");
    }
  }

  async function markPaid() {
    if (!paymentTarget) return;
    setSaving(true);
    try {
      await decidePayroll(token(), paymentTarget.id, { status: "PAID", paidAtUtc: new Date(paymentForm.paidAtUtc).toISOString(), paymentMethod: paymentForm.paymentMethod, paymentReference: paymentForm.paymentReference || undefined, paymentNotes: paymentForm.paymentNotes || undefined });
      toast.success("Payroll marked as paid and locked.");
      setPaymentTarget(null);
      setPaymentForm(blankPayment());
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salary payment could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRevision(saveAndAnother = false) {
    if (!revisionForm.staffUserId || !revisionForm.title.trim() || !revisionForm.effectiveDate || !revisionForm.revisedBasicSalary) { toast.error("Complete the employee, title, effective date, and revised basic salary."); return; }
    setSaving(true);
    try {
      await createSalaryRevision(token(), { staffUserId: revisionForm.staffUserId, title: revisionForm.title.trim(), revisionType: revisionForm.revisionType, effectiveDate: revisionForm.effectiveDate, revisedBasicSalary: Number(revisionForm.revisedBasicSalary), reason: revisionForm.reason || undefined, attachmentUrl: revisionForm.attachmentUrl || undefined });
      toast.success("Salary revision saved for approval.");
      setRevisionForm(blankRevision());
      await load();
      if (!saveAndAnother) setView("revisions");
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salary revision could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function decideRevision(row: SalaryRevision, status: "APPROVED" | "REJECTED") {
    if (!window.confirm(`${status === "APPROVED" ? "Approve" : "Reject"} the salary revision for ${row.staffName}?`)) return;
    try {
      await decideSalaryRevision(token(), row.id, { status });
      toast.success(`Salary revision ${status.toLowerCase()}.`);
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "The salary revision decision could not be saved.");
    }
  }

  return <EntityListWorkspace title="Payroll">{<section className="mt-7 space-y-6">
    <Card className="overflow-hidden border-[#003893]/15 bg-gradient-to-br from-white via-white to-[#eef4ff]">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Compensation control</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">Payroll and salary revisions</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Build a monthly salary sheet with clear earning and deduction heads, then approve and lock payment. Salary changes stay historical until an approver accepts them.</p></div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh</Button>
      </CardContent>
    </Card>

    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
      {[["payroll", "Monthly payroll", ReceiptText], ["revisions", "Salary revisions", FileClock]].map(([id, label, Icon]) => <button key={id as string} type="button" onClick={() => setView(id as "payroll" | "revisions")} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${view === id ? "bg-[#003893] text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-[#003893]"}`}><Icon size={16} />{label as string}</button>)}
    </div>

    {view === "payroll" ? <div className="grid min-w-0 gap-6">
      <EntityListPanel formKey="0"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><ClipboardList size={18} className="text-[#003893]" />Payroll sheet</CardTitle><label className="flex items-center gap-2 text-sm font-semibold text-slate-600">Month <Input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setPayrollForm((current) => ({ ...current, payrollMonth: event.target.value })); }} /></label></div></CardHeader><CardContent>{loading ? <p className="py-10 text-center text-sm text-slate-500">Loading payroll sheet…</p> : <div className="overflow-x-auto"><RecordTable className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Basic / heads</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Net pay</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-4 font-bold">{row.staffName}<p className="mt-1 text-xs font-normal text-slate-500">{formatPlatformDate(row.payrollMonth, dateFormat)}</p></td><td className="px-4 py-4"><p>{money(row.basicSalary)} basic</p><p className="mt-1 text-xs text-slate-500">{row.components?.length ? `${row.components.length} configured head${row.components.length === 1 ? "" : "s"}` : "Standard salary heads"}</p></td><td className="px-4 py-4 font-semibold">{money(row.grossSalary)}</td><td className="px-4 py-4">{money(row.totalDeductions ?? row.deductions)}</td><td className="px-4 py-4 font-extrabold text-[#003893]">{money(row.netSalary)}</td><td className="px-4 py-4"><Badge variant={statusVariant(row.status)}>{row.status}</Badge>{row.paymentMethod && <p className="mt-1 text-xs text-slate-500">{row.paymentMethod}</p>}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{row.status === "DRAFT" && <Button type="button" size="sm" onClick={() => void decidePayrollRecord(row, "APPROVED")}><Check size={14} />Approve</Button>}{row.status === "APPROVED" && <><Button type="button" size="sm" onClick={() => { setPaymentTarget(row); setPaymentForm(blankPayment()); }}><Banknote size={14} />Mark paid</Button><Button type="button" size="sm" variant="outline" onClick={() => void decidePayrollRecord(row, "DRAFT")}><X size={14} />Return</Button></>}{row.status === "PAID" && <span className="text-xs font-semibold text-slate-500">Locked</span>}</div></td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">No payroll records for this month yet.</td></tr>}</tbody></RecordTable></div>}</CardContent></Card></EntityListPanel>
      <EntityFormPanel formKey="0"><Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><Plus size={18} className="text-[#003893]" />Prepare payroll</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void savePayrollRecord(); }}><label className="grid gap-1.5 text-sm font-semibold">Employee<Select required value={payrollForm.staffUserId} onChange={(event) => { setPayrollForm((current) => ({ ...current, staffUserId: event.target.value })); setSuggestion(null); }}><option value="">Choose employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.employeeId ?? item.role}</option>)}</Select></label><label className="grid gap-1.5 text-sm font-semibold">Payroll month<Input required type="month" value={payrollForm.payrollMonth} onChange={(event) => { setPayrollForm((current) => ({ ...current, payrollMonth: event.target.value })); setSuggestion(null); }} /></label>{suggestion && <div className="rounded-xl border border-[#003893]/15 bg-[#eef4ff] p-3 text-sm text-[#002b70]"><p className="font-bold">Suggested basic: {money(suggestion.suggestedBasicSalary)}</p><p className="mt-1 text-xs">{suggestion.salaryRevisionTitle ? `From approved revision: ${suggestion.salaryRevisionTitle}` : "From the employee’s current basic salary"} · {suggestion.approvedOvertimeMinutes} approved overtime minutes</p><Button type="button" variant="link" className="mt-1 h-auto p-0 text-[#003893]" onClick={() => setPayrollForm((current) => ({ ...current, basicSalary: String(suggestion.suggestedBasicSalary) }))}>Use suggested basic salary</Button></div>}<div className="grid grid-cols-2 gap-3">{(["basicSalary", "allowances", "overtimeAmount", "bonus", "deductions"] as const).map((key) => <label key={key} className="grid gap-1 text-xs font-bold text-slate-600">{key === "basicSalary" ? "Basic salary" : key === "deductions" ? "Other deductions" : key.replace(/([A-Z])/g, " $1")}<Input type="number" min="0" step="0.01" value={payrollForm[key]} onChange={(event) => setPayrollForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-800">Salary components</p><Button type="button" variant="outline" size="sm" onClick={() => setPayrollForm((current) => ({ ...current, components: [...current.components, blankComponent()] }))}><Plus size={14} />Add head</Button></div><div className="mt-3 grid gap-3">{payrollForm.components.map((component, index) => <div key={`${index}-${component.componentName}`} className="grid gap-2 rounded-lg bg-slate-50 p-2"><div className="flex gap-2"><Input aria-label={`Salary component ${index + 1} name`} required placeholder="e.g. Grade allowance" value={component.componentName} onChange={(event) => updateComponent(index, { componentName: event.target.value })} /><Button type="button" variant="ghost" size="icon" aria-label="Remove salary component" title="Remove salary component" onClick={() => setPayrollForm((current) => ({ ...current, components: current.components.filter((_, componentIndex) => componentIndex !== index) }))}><Trash2 size={15} className="text-rose-600" /></Button></div><div className="grid grid-cols-2 gap-2"><Select aria-label={`Salary component ${index + 1} kind`} value={component.componentKind} onChange={(event) => updateComponent(index, { componentKind: event.target.value as PayrollComponent["componentKind"] })}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option><option value="EMPLOYER_CONTRIBUTION">Employer contribution</option></Select><Input aria-label={`Salary component ${index + 1} amount`} required type="number" min="0" step="0.01" value={component.amount} onChange={(event) => updateComponent(index, { amount: event.target.value })} /></div></div>)}{!payrollForm.components.length && <p className="text-xs text-slate-500">Add named heads such as grade allowance, SSF, tax, travel or incentive.</p>}</div></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Gross salary</p><p className="mt-1 text-lg font-extrabold text-slate-950">{money(grossPreview)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Net salary</p><p className="mt-1 text-lg font-extrabold text-[#003893]">{money(netPreview)}</p></div></div><FormSaveActions mode="create" busy={saving || !employees.length} saveLabel="Save & list" onSaveAndAnother={() => { void savePayrollRecord(true); }} onCancel={() => { setPayrollForm(blankPayroll(month)); setSuggestion(null); }} /></form></CardContent></Card></EntityFormPanel>
    </div> : <div className="grid min-w-0 gap-6">
      <EntityListPanel formKey="1"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Landmark size={18} className="text-[#003893]" />Salary revision history</CardTitle></CardHeader><CardContent>{loading ? <p className="py-10 text-center text-sm text-slate-500">Loading salary revisions…</p> : <div className="overflow-x-auto"><RecordTable className="w-full min-w-[810px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Revision</th><th className="px-4 py-3">Effective date</th><th className="px-4 py-3">Basic salary</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{revisions.map((row) => <tr key={row.id}><td className="px-4 py-4 font-bold">{row.staffName}</td><td className="px-4 py-4"><p className="font-semibold">{row.title}</p><p className="mt-1 text-xs text-slate-500">{row.revisionType.replaceAll("_", " ")}</p></td><td className="px-4 py-4">{formatPlatformDate(row.effectiveDate, dateFormat)}</td><td className="px-4 py-4"><p>{money(row.previousBasicSalary)} → <span className="font-extrabold text-[#003893]">{money(row.revisedBasicSalary)}</span></p>{row.attachmentUrl && <a href={row.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-[#003893] hover:underline">Supporting document</a>}</td><td className="px-4 py-4"><Badge variant={statusVariant(row.status)}>{row.status}</Badge>{row.decisionComment && <p className="mt-1 max-w-40 text-xs text-slate-500">{row.decisionComment}</p>}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{row.status === "PENDING" && <><Button type="button" size="sm" onClick={() => void decideRevision(row, "APPROVED")}><Check size={14} />Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => void decideRevision(row, "REJECTED")}><X size={14} />Reject</Button></>}</div></td></tr>)}{!revisions.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No salary revisions have been created.</td></tr>}</tbody></RecordTable></div>}</CardContent></Card></EntityListPanel>
      <EntityFormPanel formKey="1"><Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><Plus size={18} className="text-[#003893]" />Create salary revision</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveRevision(); }}><label className="grid gap-1.5 text-sm font-semibold">Employee<Select required value={revisionForm.staffUserId} onChange={(event) => setRevisionForm((current) => ({ ...current, staffUserId: event.target.value }))}><option value="">Choose employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.employeeId ?? item.role}</option>)}</Select></label><label className="grid gap-1.5 text-sm font-semibold">Revision title<Input required maxLength={180} placeholder="Annual salary revision" value={revisionForm.title} onChange={(event) => setRevisionForm((current) => ({ ...current, title: event.target.value }))} /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-sm font-semibold">Revision type<Select value={revisionForm.revisionType} onChange={(event) => setRevisionForm((current) => ({ ...current, revisionType: event.target.value }))}><option value="INCREMENT">Increment</option><option value="PROMOTION">Promotion</option><option value="CORRECTION">Correction</option><option value="ANNUAL_REVIEW">Annual review</option><option value="OTHER">Other</option></Select></label><label className="grid gap-1.5 text-sm font-semibold">Effective date<Input required type="date" value={revisionForm.effectiveDate} onChange={(event) => setRevisionForm((current) => ({ ...current, effectiveDate: event.target.value }))} /></label></div><label className="grid gap-1.5 text-sm font-semibold">Revised basic salary<Input required type="number" min="0" step="0.01" value={revisionForm.revisedBasicSalary} onChange={(event) => setRevisionForm((current) => ({ ...current, revisedBasicSalary: event.target.value }))} /></label><label className="grid gap-1.5 text-sm font-semibold">Supporting document link <span className="font-normal text-slate-500">(optional)</span><Input type="url" maxLength={1000} placeholder="https://…" value={revisionForm.attachmentUrl} onChange={(event) => setRevisionForm((current) => ({ ...current, attachmentUrl: event.target.value }))} /></label><label className="grid gap-1.5 text-sm font-semibold">Reason <span className="font-normal text-slate-500">(optional)</span><Textarea maxLength={1000} value={revisionForm.reason} onChange={(event) => setRevisionForm((current) => ({ ...current, reason: event.target.value }))} /></label><FormSaveActions mode="create" busy={saving || !employees.length} saveLabel="Save & list" onSaveAndAnother={() => { void saveRevision(true); }} onCancel={() => setRevisionForm(blankRevision())} /></form></CardContent></Card></EntityFormPanel>
    </div>}

    {paymentTarget && <Card className="border-[#003893]/25 bg-[#f8fbff]"><CardHeader><CardTitle className="flex items-center gap-2"><Banknote size={18} className="text-[#003893]" />Record salary payment · {paymentTarget.staffName}</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void markPaid(); }}><label className="grid gap-1.5 text-sm font-semibold">Payment date and time<Input required type="datetime-local" value={paymentForm.paidAtUtc} onChange={(event) => setPaymentForm((current) => ({ ...current, paidAtUtc: event.target.value }))} /></label><label className="grid gap-1.5 text-sm font-semibold">Payment method<Select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="MOBILE_WALLET">Mobile wallet</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option></Select></label><label className="grid gap-1.5 text-sm font-semibold">Reference <span className="font-normal text-slate-500">(optional)</span><Input maxLength={160} value={paymentForm.paymentReference} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentReference: event.target.value }))} /></label><label className="grid gap-1.5 text-sm font-semibold">Notes <span className="font-normal text-slate-500">(optional)</span><Input maxLength={1000} value={paymentForm.paymentNotes} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentNotes: event.target.value }))} /></label><div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={saving}>Confirm payment</Button><Button type="button" variant="outline" onClick={() => setPaymentTarget(null)}>Cancel</Button></div></form></CardContent></Card>}
  </section>}</EntityListWorkspace>;
}
