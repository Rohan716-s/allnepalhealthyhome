"use client";
import { RecordTable } from "@/components/entity-record-table";
import { EntityListWorkspace, EntityListPanel, EntityFormPanel , entitySaveComplete , useWorkspaceSelection } from "@/components/entity-list-panel";
import { useOfflineRefresh } from "@/lib/offline/hooks";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CalendarDays, Check, Clock3, FileCheck2, RefreshCw, UserRoundCog, X } from "lucide-react";
import { toast } from "sonner";
import { FormSaveActions } from "@/components/form-save-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPlatformDate } from "@/lib/date-time";
import { getPlatformDateInput } from "@/lib/platform-time-preferences";
import {
  createEmploymentMovement,
  createOvertimeRecord,
  decideEmploymentMovement,
  decideOvertimeRecord,
  getAdminBranches,
  getEmploymentMovements,
  getLeaveBalances,
  getOvertimeRecords,
  saveLeaveAllocation,
  type AdminBranch,
  type EmploymentMovement,
  type LeaveBalance,
  type OvertimeRecord,
  type Staff,
  type WorkShift,
} from "@/services/api";

const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
const currentYear = () => new Date().getFullYear();
const newOvertime = () => ({ staffUserId: "", workDate: getPlatformDateInput(), startTime: "17:00", endTime: "18:00", overtimeType: "REGULAR", remarks: "" });
const newAllocation = () => ({ staffUserId: "", leaveType: "ANNUAL", leaveYear: String(currentYear()), allocatedDays: "0", carryForwardDays: "0", adjustmentDays: "0", notes: "" });
const newMovement = () => ({ staffUserId: "", movementType: "PROMOTION", effectiveDate: getPlatformDateInput(), newBranchId: "", newShiftId: "", newDepartment: "", newJobTitle: "", reason: "" });

function durationLabel(totalMinutes: number) {
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

function timeValue(value?: string) {
  return value?.slice(0, 5) || "—";
}

function statusVariant(status: string) {
  if (status === "APPROVED") return "secondary" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "outline" as const;
}

export function HrmsWorkforceOperations({ staff, shifts, superAdmin, dateFormat }: { staff: Staff[]; shifts: WorkShift[]; superAdmin: boolean; dateFormat: "AD" | "BS" }) {
  const [view, setView] = useWorkspaceSelection<"overtime" | "movements" | "leave">("workforce", "overtime");
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [overtime, setOvertime] = useState<OvertimeRecord[]>([]);
  const [movements, setMovements] = useState<EmploymentMovement[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [overtimeForm, setOvertimeForm] = useState(newOvertime);
  const [allocationForm, setAllocationForm] = useState(newAllocation);
  const [movementForm, setMovementForm] = useState(newMovement);
  const [overtimeFrom, setOvertimeFrom] = useState(`${getPlatformDateInput().slice(0, 7)}-01`);
  const [overtimeTo, setOvertimeTo] = useState(getPlatformDateInput());
  const [overtimeStaff, setOvertimeStaff] = useState("");
  const [balanceYear, setBalanceYear] = useState(String(currentYear()));
  const [balanceStaff, setBalanceStaff] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeStaff = useMemo(() => staff.filter((item) => item.isActive && item.role !== "CUSTOMER"), [staff]);
  const activeBranches = useMemo(() => branches.filter((item) => item.isActive), [branches]);
  const activeShifts = useMemo(() => shifts.filter((item) => item.isActive), [shifts]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const year = Number(balanceYear) || currentYear();
      const [branchRows, overtimeRows, movementRows, balanceRows] = await Promise.all([
        getAdminBranches(token(), superAdmin, true),
        getOvertimeRecords(token(), { from: overtimeFrom || undefined, to: overtimeTo || undefined, staffUserId: overtimeStaff || undefined }),
        getEmploymentMovements(token()),
        getLeaveBalances(token(), { leaveYear: year, staffUserId: balanceStaff || undefined }),
      ]);
      setBranches(branchRows);
      setOvertime(overtimeRows);
      setMovements(movementRows);
      setBalances(balanceRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workforce operations could not be loaded.");
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }, [balanceStaff, balanceYear, overtimeFrom, overtimeStaff, overtimeTo, superAdmin]);

  useOfflineRefresh(load, "/api/hrms/");
  useEffect(() => {
    // Defer the first network refresh so React does not synchronously cascade
    // state updates while this protected client panel is mounting.
    const refresh = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(refresh);
  }, [load]);

  async function saveOvertime(saveAndAnother = false) {
    setSaving(true);
    try {
      await createOvertimeRecord(token(), { ...overtimeForm, remarks: overtimeForm.remarks || undefined });
      toast.success("Overtime record saved for approval.");
      setOvertimeForm(newOvertime());
      await load();
      if (!saveAndAnother) setView("overtime");
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Overtime record could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function decideOvertime(row: OvertimeRecord, status: "APPROVED" | "REJECTED") {
    if (!window.confirm(`${status === "APPROVED" ? "Approve" : "Reject"} overtime for ${row.staffName}?`)) return;
    try {
      await decideOvertimeRecord(token(), row.id, { status });
      toast.success(`Overtime ${status.toLowerCase()}.`);
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "The overtime decision could not be saved.");
    }
  }

  async function saveAllocation(saveAndAnother = false) {
    setSaving(true);
    try {
      await saveLeaveAllocation(token(), {
        staffUserId: allocationForm.staffUserId,
        leaveType: allocationForm.leaveType,
        leaveYear: Number(allocationForm.leaveYear),
        allocatedDays: Number(allocationForm.allocatedDays),
        carryForwardDays: Number(allocationForm.carryForwardDays),
        adjustmentDays: Number(allocationForm.adjustmentDays),
        notes: allocationForm.notes || undefined,
      });
      toast.success("Leave allocation saved.");
      setAllocationForm(newAllocation());
      await load();
      if (!saveAndAnother) setView("leave");
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Leave allocation could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement(saveAndAnother = false) {
    setSaving(true);
    try {
      await createEmploymentMovement(token(), {
        staffUserId: movementForm.staffUserId,
        movementType: movementForm.movementType,
        effectiveDate: movementForm.effectiveDate,
        newBranchId: movementForm.newBranchId || undefined,
        newShiftId: movementForm.newShiftId || undefined,
        newDepartment: movementForm.newDepartment || undefined,
        newJobTitle: movementForm.newJobTitle || undefined,
        reason: movementForm.reason,
      });
      toast.success("Employee movement saved for approval.");
      setMovementForm(newMovement());
      await load();
      if (!saveAndAnother) setView("movements");
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee movement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function decideMovement(row: EmploymentMovement, status: "APPROVED" | "REJECTED") {
    const action = status === "APPROVED" ? "Approve and apply" : "Reject";
    if (!window.confirm(`${action} this ${row.movementType.toLowerCase().replaceAll("_", " ")} for ${row.staffName}?`)) return;
    try {
      await decideEmploymentMovement(token(), row.id, { status });
      toast.success(`Employee movement ${status.toLowerCase()}.`);
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "The employee movement decision could not be saved.");
    }
  }

  const tabs: Array<[typeof view, string, typeof Clock3]> = [
    ["overtime", "Overtime", Clock3],
    ["movements", "Employee changes", ArrowRightLeft],
    ["leave", "Leave balances", CalendarDays],
  ];

  return <section className="mt-7">
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#003893]">Reference HR workflows</p>
      <h2 className="mt-2 text-xl font-extrabold text-slate-950">Workforce operations</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">Track payable overtime, control employee promotions and transfers through approval, and keep leave allocations visible before leave is approved.</p>
    </div>
    <div className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">{tabs.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setView(key)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${view === key ? "bg-[#003893] text-white" : "text-slate-500 hover:bg-blue-50 hover:text-[#003893]"}`}><Icon size={15} />{label}</button>)}</div>
    {loading && !loaded ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading workforce operations…</div> : view === "overtime" ? <OvertimePanel staff={activeStaff} rows={overtime} form={overtimeForm} setForm={setOvertimeForm} from={overtimeFrom} setFrom={setOvertimeFrom} to={overtimeTo} setTo={setOvertimeTo} staffFilter={overtimeStaff} setStaffFilter={setOvertimeStaff} saving={saving} onSave={saveOvertime} onDecision={decideOvertime} onRefresh={() => void load()} dateFormat={dateFormat} /> : view === "movements" ? <MovementPanel staff={activeStaff} shifts={activeShifts} branches={activeBranches} rows={movements} form={movementForm} setForm={setMovementForm} saving={saving} onSave={saveMovement} onDecision={decideMovement} dateFormat={dateFormat} /> : <LeaveBalancePanel staff={activeStaff} rows={balances} form={allocationForm} setForm={setAllocationForm} year={balanceYear} setYear={setBalanceYear} staffFilter={balanceStaff} setStaffFilter={setBalanceStaff} saving={saving} onSave={saveAllocation} onRefresh={() => void load()} />}
  </section>;
}

function OvertimePanel({ staff, rows, form, setForm, from, setFrom, to, setTo, staffFilter, setStaffFilter, saving, onSave, onDecision, onRefresh, dateFormat }: { staff: Staff[]; rows: OvertimeRecord[]; form: ReturnType<typeof newOvertime>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof newOvertime>>>; from: string; setFrom: (value: string) => void; to: string; setTo: (value: string) => void; staffFilter: string; setStaffFilter: (value: string) => void; saving: boolean; onSave: (saveAndAnother?: boolean) => Promise<void>; onDecision: (row: OvertimeRecord, status: "APPROVED" | "REJECTED") => Promise<void>; onRefresh: () => void; dateFormat: "AD" | "BS" }) {
  return <EntityListWorkspace title="Overtime">{<div className="mt-6 grid min-w-0 gap-6">
    <EntityListPanel formKey="0"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Clock3 size={18} className="text-[#003893]" />Overtime records</CardTitle><Button type="button" variant="outline" size="sm" onClick={onRefresh}><RefreshCw size={14} />Refresh</Button></div></CardHeader><CardContent>
      <div className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4"><label className="grid gap-1 text-xs font-bold text-slate-600">From<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="grid gap-1 text-xs font-bold text-slate-600">To<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label className="grid gap-1 text-xs font-bold text-slate-600">Employee<Select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}><option value="">All employees</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</Select></label><Button type="button" variant="outline" className="self-end" onClick={onRefresh}><RefreshCw size={15} />Apply filters</Button></div>
      <div className="overflow-x-auto"><RecordTable className="w-full min-w-[880px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-4 font-bold">{row.staffName}</td><td className="px-4 py-4">{formatPlatformDate(row.workDate, dateFormat)}</td><td className="px-4 py-4">{timeValue(row.startTime)} – {timeValue(row.endTime)}<p className="mt-1 text-xs text-slate-500">{durationLabel(row.totalMinutes)}</p></td><td className="px-4 py-4">{row.overtimeType.replaceAll("_", " ")}</td><td className="max-w-xs px-4 py-4 text-slate-600">{row.remarks || "—"}{row.decisionComment && <p className="mt-1 text-xs text-slate-400">{row.decisionComment}</p>}</td><td className="px-4 py-4"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td><td className="px-4 py-4 text-right">{row.status === "PENDING" && <div className="flex justify-end gap-1"><Button type="button" size="sm" onClick={() => void onDecision(row, "APPROVED")}><Check size={14} />Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => void onDecision(row, "REJECTED")}><X size={14} />Reject</Button></div>}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No overtime records match this range.</td></tr>}</tbody></RecordTable></div>
    </CardContent></Card></EntityListPanel>
    <EntityFormPanel formKey="0"><Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 size={17} className="text-[#003893]" />Create overtime record</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void onSave(); }}><label className="grid gap-1 text-sm font-semibold">Employee<Select required value={form.staffUserId} onChange={(event) => setForm({ ...form, staffUserId: event.target.value })}><option value="">Choose employee</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.role}</option>)}</Select></label><label className="grid gap-1 text-sm font-semibold">Overtime date<Input required type="date" value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-semibold">Time from<Input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Time till<Input required type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div><label className="grid gap-1 text-sm font-semibold">Overtime type<Select value={form.overtimeType} onChange={(event) => setForm({ ...form, overtimeType: event.target.value })}><option value="REGULAR">Regular</option><option value="HOLIDAY">Holiday</option><option value="EMERGENCY">Emergency</option><option value="NIGHT_SHIFT">Night shift</option></Select></label><label className="grid gap-1 text-sm font-semibold">Remarks<Textarea maxLength={1000} value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Why was the overtime needed?" /></label><FormSaveActions mode="create" busy={saving} onCancel={() => setForm(newOvertime())} onSaveAndAnother={() => void onSave(true)} /></form></CardContent></Card></EntityFormPanel>
  </div>}</EntityListWorkspace>;
}

function MovementPanel({ staff, shifts, branches, rows, form, setForm, saving, onSave, onDecision, dateFormat }: { staff: Staff[]; shifts: WorkShift[]; branches: AdminBranch[]; rows: EmploymentMovement[]; form: ReturnType<typeof newMovement>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof newMovement>>>; saving: boolean; onSave: (saveAndAnother?: boolean) => Promise<void>; onDecision: (row: EmploymentMovement, status: "APPROVED" | "REJECTED") => Promise<void>; dateFormat: "AD" | "BS" }) {
  const typeNeedsBranch = form.movementType === "BRANCH_TRANSFER";
  const typeNeedsShift = form.movementType === "SHIFT_TRANSFER";
  const typeNeedsPosition = form.movementType === "PROMOTION" || form.movementType === "POSITION_CHANGE";
  return <EntityListWorkspace title="Movement">{<div className="mt-6 grid min-w-0 gap-6">
    <EntityListPanel formKey="0"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft size={18} className="text-[#003893]" />Promotion and transfer history</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><RecordTable className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3">Previous</th><th className="px-4 py-3">New</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-4 font-bold">{row.staffName}<p className="mt-1 max-w-xs text-xs font-normal text-slate-500">{row.reason}</p></td><td className="px-4 py-4">{row.movementType.replaceAll("_", " ")}</td><td className="px-4 py-4">{formatPlatformDate(row.effectiveDate, dateFormat)}</td><td className="px-4 py-4 text-xs text-slate-600"><p>{row.previousBranchName || row.previousShiftName || "—"}</p><p>{row.previousJobTitle || row.previousDepartment || ""}</p></td><td className="px-4 py-4 text-xs font-semibold text-slate-800"><p>{row.newBranchName || row.newShiftName || "—"}</p><p>{row.newJobTitle || row.newDepartment || ""}</p></td><td className="px-4 py-4"><Badge variant={statusVariant(row.status)}>{row.status}</Badge>{row.decisionComment && <p className="mt-1 max-w-32 text-xs text-slate-400">{row.decisionComment}</p>}</td><td className="px-4 py-4 text-right">{row.status === "PENDING" && <div className="flex justify-end gap-1"><Button type="button" size="sm" onClick={() => void onDecision(row, "APPROVED")}><Check size={14} />Apply</Button><Button type="button" size="sm" variant="outline" onClick={() => void onDecision(row, "REJECTED")}><X size={14} />Reject</Button></div>}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No employee changes have been recorded.</td></tr>}</tbody></RecordTable></div></CardContent></Card></EntityListPanel>
    <EntityFormPanel formKey="0"><Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><UserRoundCog size={17} className="text-[#003893]" />Create employee change</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void onSave(); }}><label className="grid gap-1 text-sm font-semibold">Employee<Select required value={form.staffUserId} onChange={(event) => setForm({ ...form, staffUserId: event.target.value })}><option value="">Choose employee</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.hrProfile?.jobTitle || item.role}</option>)}</Select></label><label className="grid gap-1 text-sm font-semibold">Change type<Select value={form.movementType} onChange={(event) => setForm({ ...form, movementType: event.target.value, newBranchId: "", newShiftId: "", newDepartment: "", newJobTitle: "" })}><option value="PROMOTION">Promotion</option><option value="BRANCH_TRANSFER">Branch transfer</option><option value="SHIFT_TRANSFER">Shift transfer</option><option value="POSITION_CHANGE">Position / department change</option></Select></label><label className="grid gap-1 text-sm font-semibold">Effective from<Input required type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></label>{typeNeedsBranch && <label className="grid gap-1 text-sm font-semibold">Transfer to branch<Select required value={form.newBranchId} onChange={(event) => setForm({ ...form, newBranchId: event.target.value })}><option value="">Choose destination branch</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>}{typeNeedsShift && <label className="grid gap-1 text-sm font-semibold">Transfer to shift<Select required value={form.newShiftId} onChange={(event) => setForm({ ...form, newShiftId: event.target.value })}><option value="">Choose destination shift</option>{shifts.map((item) => <option key={item.id} value={item.id}>{item.name} · {timeValue(item.startTime)}–{timeValue(item.endTime)}</option>)}</Select></label>}{typeNeedsPosition && <><label className="grid gap-1 text-sm font-semibold">New job title<Input required={form.movementType === "PROMOTION"} value={form.newJobTitle} onChange={(event) => setForm({ ...form, newJobTitle: event.target.value })} placeholder="e.g. Senior pharmacist" /></label><label className="grid gap-1 text-sm font-semibold">New department<Input value={form.newDepartment} onChange={(event) => setForm({ ...form, newDepartment: event.target.value })} placeholder="Optional if unchanged" /></label></>}<label className="grid gap-1 text-sm font-semibold">Reason / recommendation<Textarea required minLength={3} maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Why is this change required?" /></label><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950">The employee profile is updated only when an administrator applies this approved change on or after its effective date.</div><FormSaveActions mode="create" busy={saving} onCancel={() => setForm(newMovement())} onSaveAndAnother={() => void onSave(true)} /></form></CardContent></Card></EntityFormPanel>
  </div>}</EntityListWorkspace>;
}

function LeaveBalancePanel({ staff, rows, form, setForm, year, setYear, staffFilter, setStaffFilter, saving, onSave, onRefresh }: { staff: Staff[]; rows: LeaveBalance[]; form: ReturnType<typeof newAllocation>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof newAllocation>>>; year: string; setYear: (value: string) => void; staffFilter: string; setStaffFilter: (value: string) => void; saving: boolean; onSave: (saveAndAnother?: boolean) => Promise<void>; onRefresh: () => void }) {
  return <EntityListWorkspace title="Leave Balance">{<div className="mt-6 grid min-w-0 gap-6">
    <EntityListPanel formKey="0"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><CalendarDays size={18} className="text-[#003893]" />Leave allocations and balances</CardTitle><Button type="button" variant="outline" size="sm" onClick={onRefresh}><RefreshCw size={14} />Refresh</Button></div></CardHeader><CardContent><div className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"><label className="grid gap-1 text-xs font-bold text-slate-600">Leave year<Input type="number" min="2000" max="2200" value={year} onChange={(event) => setYear(event.target.value)} /></label><label className="grid gap-1 text-xs font-bold text-slate-600">Employee<Select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}><option value="">All employees</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</Select></label><Button type="button" variant="outline" className="self-end" onClick={onRefresh}><RefreshCw size={15} />Apply filters</Button></div><div className="overflow-x-auto"><RecordTable className="w-full min-w-[840px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Leave type</th><th className="px-4 py-3">Allocated</th><th className="px-4 py-3">Used</th><th className="px-4 py-3">Remaining</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={`${row.staffUserId}-${row.leaveType}`}><td className="px-4 py-4 font-bold">{row.staffName}</td><td className="px-4 py-4">{row.leaveType.replaceAll("_", " ")}</td><td className="px-4 py-4">{row.allocatedDays + row.carryForwardDays + row.adjustmentDays}<p className="mt-1 text-xs text-slate-500">Base {row.allocatedDays} · carry {row.carryForwardDays} · adj {row.adjustmentDays}</p></td><td className="px-4 py-4">{row.usedDays}</td><td className={`px-4 py-4 font-extrabold ${row.isConfigured && row.remainingDays < 0 ? "text-rose-600" : "text-slate-950"}`}>{row.isConfigured ? row.remainingDays : "Not allocated"}</td><td className="px-4 py-4 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => setForm({ staffUserId: row.staffUserId, leaveType: row.leaveType, leaveYear: String(row.leaveYear), allocatedDays: String(row.allocatedDays), carryForwardDays: String(row.carryForwardDays), adjustmentDays: String(row.adjustmentDays), notes: "" })}>Use in editor</Button></td></tr>)}{!rows.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No leave types or balances are configured for this selection.</td></tr>}</tbody></RecordTable></div><p className="mt-4 text-xs text-slate-500">Approvals check the allocation only after a leave type has been configured. Unpaid leave is never balance-limited. Balances shown for {year || currentYear()} use saved approved leave records.</p></CardContent></Card></EntityListPanel>
    <EntityFormPanel formKey="0"><Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 size={17} className="text-[#003893]" />Set leave allocation</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void onSave(); }}><label className="grid gap-1 text-sm font-semibold">Employee<Select required value={form.staffUserId} onChange={(event) => setForm({ ...form, staffUserId: event.target.value })}><option value="">Choose employee</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</Select></label><label className="grid gap-1 text-sm font-semibold">Leave type<Input required maxLength={50} value={form.leaveType} onChange={(event) => setForm({ ...form, leaveType: event.target.value.toUpperCase() })} placeholder="ANNUAL" /></label><label className="grid gap-1 text-sm font-semibold">Leave year<Input required type="number" min="2000" max="2200" value={form.leaveYear} onChange={(event) => setForm({ ...form, leaveYear: event.target.value })} /></label><div className="grid grid-cols-3 gap-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Base days<Input required type="number" min="0" max="366" step="0.5" value={form.allocatedDays} onChange={(event) => setForm({ ...form, allocatedDays: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold text-slate-600">Carry forward<Input required type="number" min="0" max="366" step="0.5" value={form.carryForwardDays} onChange={(event) => setForm({ ...form, carryForwardDays: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold text-slate-600">Adjustment<Input required type="number" min="-366" max="366" step="0.5" value={form.adjustmentDays} onChange={(event) => setForm({ ...form, adjustmentDays: event.target.value })} /></label></div><label className="grid gap-1 text-sm font-semibold">Notes<Textarea maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Policy note or approved adjustment reason" /></label><FormSaveActions mode="create" busy={saving} onCancel={() => setForm(newAllocation())} onSaveAndAnother={() => void onSave(true)} /></form></CardContent></Card></EntityFormPanel>
  </div>}</EntityListWorkspace>;
}
