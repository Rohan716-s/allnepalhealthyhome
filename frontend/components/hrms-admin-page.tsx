"use client";
import { RecordTable } from "@/components/entity-record-table";
import { DeliveryTrackingMap } from "@/components/delivery-tracking-map";
import { EntityListWorkspace, EntityListPanel, ListButton, EntityFormPanel , entitySaveComplete , routeEntityEdit, useEntityRecord , useWorkspaceSelection } from "@/components/entity-list-panel";
import { useOfflineRefresh } from "@/lib/offline/hooks";

/* eslint-disable react-hooks/set-state-in-effect -- load protected HRMS data after the client session is available. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Check, Clock3, ExternalLink, MapPin, Pencil, Plus, RefreshCw, Settings2, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { HrmsSetupPage } from "@/components/hrms-setup-page";
import { HrmsOfficeOperations } from "@/components/hrms-office-operations";
import { HrmsWorkforceOperations } from "@/components/hrms-workforce-operations";
import { HrmsPayrollOperations } from "@/components/hrms-payroll-operations";
import { FormSaveActions } from "@/components/form-save-actions";
import { useSiteConfig } from "@/components/site-config-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAdminAttendance, createAdminLeaveRequest, createHrmsShift, decideLeaveRequest, deleteAdminAttendance, deleteAdminLeaveRequest, getAdminAttendance, getAdminStaff, getAttendanceCorrections, getHrmsOverview, getHrmsSettings, getHrmsShifts, getLeaveRequests, getTeamAttendance, saveHrmsSettings, updateAdminAttendance, updateAdminLeaveRequest, updateHrmsShift, type AttendanceCorrection, type AttendanceRecord, type AttendanceSettings, type HrmsOverview, type LeaveRequest, type Staff, type WorkShift } from "@/services/api";
import { formatKathmanduTime } from "@/lib/hrms-date-time";
import { formatPlatformDate } from "@/lib/date-time";
import { dateTimeInputToUtc, utcToDateTimeInput } from "@/lib/date-time";
import { getPlatformDateInput, getPlatformMonthInput } from "@/lib/platform-time-preferences";

const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
const emptyShift = { name: "", shiftType: "REGULAR", startTime: "09:00", endTime: "17:00", breakDurationMinutes: 30, gracePeriodMinutes: 15, minimumWorkingMinutes: 480, lateThresholdMinutes: 1, halfDayThresholdMinutes: 270, overtimeThresholdMinutes: 540, weeklyOffDays: "SATURDAY", isActive: true };
const emptyLeaveForm = { staffUserId: "", leaveType: "SICK", dayType: "FULL_DAY", startDate: "", endDate: "", supportingDocumentUrl: "", reason: "" };

export function HrmsAdminPage({ superAdmin = false }: { superAdmin?: boolean }) {
  const { dateFormat } = useSiteConfig();
  const [tab, setTab] = useWorkspaceSelection<string>("tab", "dashboard");
  const [overview, setOverview] = useState<HrmsOverview | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shift, setShift] = useState(emptyShift);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const validTabs = ["dashboard", "attendance", "leave", "employees", "payroll", "shifts", "settings", "setup", "office", "operations", "corrections", "reports"];
    const selectTab = (value: string | null) => {
      if (value && validTabs.includes(value)) setTab(value);
    };
    selectTab(new URLSearchParams(window.location.search).get("tab"));
    const handleTabEvent = (event: Event) => selectTab((event as CustomEvent<string>).detail);
    window.addEventListener("hrms-tab", handleTabEvent);
    return () => window.removeEventListener("hrms-tab", handleTabEvent);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const auth = token();
      const [summary, rows, policy, shiftRows, correctionRows, leaveRows, staffRows] = await Promise.all([getHrmsOverview(auth), getTeamAttendance(auth), getHrmsSettings(auth), getHrmsShifts(auth), getAttendanceCorrections(auth), getLeaveRequests(auth), getAdminStaff(auth, true)]);
      setOverview(summary); setAttendance(rows); setSettings(policy); setShifts(shiftRows); setCorrections(correctionRows); setLeaveRequests(leaveRows); setStaff(staffRows.filter((item) => item.role !== "CUSTOMER" && item.isActive));
    } catch (error) { toast.error(error instanceof Error ? error.message : "HRMS could not be loaded."); }
    finally { setLoaded(true); setLoading(false); }
  }
  useOfflineRefresh(load, "/api/hrms/");
  useEffect(() => { void load(); }, []);

  async function savePolicy(event: React.FormEvent) { event.preventDefault(); if (!settings) return; setSaving(true); try { await saveHrmsSettings(token(), settings); toast.success("Attendance settings saved."); await load();  entitySaveComplete(); } catch (error) { toast.error(error instanceof Error ? error.message : "Settings could not be saved."); } finally { setSaving(false); } }
  async function addShift(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { if (editingShiftId) { await updateHrmsShift(token(), editingShiftId, shift); toast.success("Shift updated."); } else { await createHrmsShift(token(), shift); toast.success("Shift created."); } setShift(emptyShift); setEditingShiftId(null); await load();  entitySaveComplete(); } catch (error) { toast.error(error instanceof Error ? error.message : "Shift could not be saved."); } finally { setSaving(false); } }
  async function decideLeave(id: string, status: "APPROVED" | "REJECTED") { try { await decideLeaveRequest(token(), id, { status }); toast.success(`Leave request ${status.toLowerCase()}.`); setLeaveRequests((current) => current.map((item) => item.id === id ? { ...item, status } : item));  entitySaveComplete(); } catch (error) { toast.error(error instanceof Error ? error.message : "Leave decision could not be saved."); } }
  async function refreshLeave() { try { setLeaveRequests(await getLeaveRequests(token())); } catch (error) { toast.error(error instanceof Error ? error.message : "Leave records could not be refreshed."); } }
  const tabs = [["dashboard", "Dashboard"], ["attendance", "Attendance"], ["employees", "Employees"], ["leave", "Leave management"], ["payroll", "Payroll"], ["shifts", "Shifts"], ["settings", "Attendance settings"], ["setup", "HR setup"], ["office", "Office operations"], ["operations", "Workforce operations"], ["corrections", "Corrections"], ["reports", "HR reports"]];
  return <AdminShell superAdmin={superAdmin}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">People operations</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">HRMS</h1></div><Button variant="outline" onClick={() => void load()}><RefreshCw size={16} />Refresh</Button></div><div className="mt-7 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">{tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold ${tab === key ? "bg-[#003893] text-white" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}>{label}</button>)}</div>{loading && !loaded ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading HRMS records…</div> : tab === "dashboard" ? <Dashboard summary={overview} attendance={attendance} dateFormat={dateFormat} /> : tab === "attendance" ? <AttendanceManagement staff={staff} shifts={shifts} dateFormat={dateFormat} /> : tab === "employees" ? <Employees superAdmin={superAdmin} staff={staff} /> : tab === "leave" ? <LeaveManagement rows={leaveRequests} staff={staff} dateFormat={dateFormat} onDecision={decideLeave} onRefresh={() => void refreshLeave()} /> : tab === "payroll" ? <HrmsPayrollOperations staff={staff} dateFormat={dateFormat} /> : tab === "shifts" ? <Shifts shifts={shifts} shift={shift} setShift={setShift} saving={saving} editingShiftId={editingShiftId} setEditingShiftId={setEditingShiftId} onSubmit={addShift} /> : tab === "settings" ? <SettingsForm settings={settings} setSettings={setSettings} saving={saving} onSubmit={savePolicy} /> : tab === "setup" ? <HrmsSetupPage /> : tab === "office" ? <HrmsOfficeOperations staff={staff} /> : tab === "operations" ? <HrmsWorkforceOperations staff={staff} shifts={shifts} superAdmin={superAdmin} dateFormat={dateFormat} /> : tab === "corrections" ? <Corrections rows={corrections} dateFormat={dateFormat} /> : <Reports summary={overview} attendance={attendance} />}</AdminShell>;
}

function Dashboard({ summary, attendance, dateFormat }: { summary: HrmsOverview | null; attendance: AttendanceRecord[]; dateFormat: "AD" | "BS" }) { const cards = [["Total employees", summary?.totalEmployees ?? 0, Users], ["Present today", summary?.presentToday ?? 0, CalendarCheck], ["Late today", summary?.lateToday ?? 0, Clock3], ["On leave", summary?.onLeaveToday ?? 0, CalendarCheck], ["Checked in", summary?.checkedInToday ?? 0, MapPin], ["Attendance", `${summary?.attendancePercentage ?? 0}%`, CalendarCheck]] as const; return <><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-5"><Icon size={18} className="text-[#003893]" /><p className="mt-4 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p></CardContent></Card>)}</div><Card className="mt-6"><CardHeader><CardTitle>Today&apos;s attendance alerts</CardTitle></CardHeader><CardContent><AttendanceTable rows={attendance.slice(0, 8)} compact dateFormat={dateFormat} /></CardContent></Card></>; }

type AdminAttendanceForm = { staffUserId: string; workDate: string; checkInLocal: string; checkOutLocal: string; status: string; shiftId: string };
const newAttendanceForm = (): AdminAttendanceForm => ({ staffUserId: "", workDate: getPlatformDateInput(), checkInLocal: "", checkOutLocal: "", status: "PRESENT", shiftId: "" });

function splitAttendanceDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

function mergeAttendanceDateTime(date: string, time: string) {
  return `${date}T${time}`;
}

function AttendanceManagement({ staff, shifts, dateFormat }: { staff: Staff[]; shifts: WorkShift[]; dateFormat: "AD" | "BS" }) {
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [from, setFrom] = useState(`${getPlatformMonthInput()}-01`);
  const [to, setTo] = useState(getPlatformDateInput());
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [form, setForm] = useState<AdminAttendanceForm>(newAttendanceForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      setRows(await getAdminAttendance(token(), { from, to, staffUserId: employeeFilter || undefined }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attendance records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [employeeFilter, from, to]);
  useEffect(() => { void load(); }, [load]);

  useEntityRecord(rows, startEdit, "0");
  function startEdit(row: AttendanceRecord) { if (routeEntityEdit(row.id, "0")) return;
    setEditingId(row.id);
    setForm({ staffUserId: row.staffUserId, workDate: row.workDate.slice(0, 10), checkInLocal: utcToDateTimeInput(row.checkInUtc), checkOutLocal: utcToDateTimeInput(row.checkOutUtc), status: row.status, shiftId: row.shiftId ?? "" });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { staffUserId: form.staffUserId, workDate: form.workDate, checkInUtc: dateTimeInputToUtc(form.checkInLocal), checkOutUtc: dateTimeInputToUtc(form.checkOutLocal), status: form.status, shiftId: form.shiftId || undefined };
      if (editingId) await updateAdminAttendance(token(), editingId, payload);
      else await createAdminAttendance(token(), payload);
      toast.success(editingId ? "Attendance record updated." : "Attendance record saved.");
      setForm(newAttendanceForm());
      setEditingId(null);
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attendance record could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: AttendanceRecord) {
    if (!window.confirm(`Delete ${row.staffName}'s attendance record for ${formatPlatformDate(row.workDate, dateFormat)}?`)) return;
    try {
      await deleteAdminAttendance(token(), row.id);
      toast.success("Attendance record deleted.");
      await load();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attendance record could not be deleted.");
    }
  }

  return <EntityListWorkspace title="Attendance">{<div className="mt-7 grid min-w-0 gap-6">
    <EntityListPanel formKey="0"><Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>All attendance records</CardTitle><span className="text-xs text-slate-500">{rows.length} record{rows.length === 1 ? "" : "s"}</span></div></CardHeader>
      <CardContent>
        <div className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
          <label className="grid gap-1 text-xs font-bold text-slate-600">From<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-bold text-slate-600">To<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-bold text-slate-600">Employee<Select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="">All employees</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</Select></label>
          <Button type="button" variant="outline" className="self-end" onClick={() => void load()}><RefreshCw size={15} />Refresh list</Button>
        </div>
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading attendance records…</p> : <div className="overflow-x-auto"><RecordTable className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Check in</th><th className="px-4 py-3">Check out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3 font-bold">{row.staffName}</td><td className="px-4 py-3">{formatPlatformDate(row.workDate, dateFormat)}</td><td className="px-4 py-3">{formatKathmanduTime(row.checkInUtc)}</td><td className="px-4 py-3">{formatKathmanduTime(row.checkOutUtc)}</td><td className="px-4 py-3">{Math.floor(row.totalMinutes / 60)}h {String(row.totalMinutes % 60).padStart(2, "0")}m</td><td className="px-4 py-3"><Badge variant={row.status === "LATE" ? "destructive" : "secondary"}>{row.status.replaceAll("_", " ")}</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" title="Edit attendance" aria-label="Edit attendance" onClick={() => startEdit(row)}><Pencil size={15} /></Button><Button type="button" variant="ghost" size="icon" title="Delete attendance" aria-label="Delete attendance" onClick={() => void remove(row)}><Trash2 size={15} className="text-rose-600" /></Button></div></td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No attendance records in this date range.</td></tr>}</tbody></RecordTable></div>}
      </CardContent>
    </Card></EntityListPanel>
    <EntityFormPanel formKey="0"><Card className="h-fit"><CardHeader><CardTitle>{editingId ? "Edit attendance" : "Save attendance"}</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={save}>
      <label className="grid gap-1 text-sm font-semibold">Employee<Select required value={form.staffUserId} onChange={(event) => setForm({ ...form, staffUserId: event.target.value })}><option value="">Choose employee</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.role}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-semibold">Work date<Input required type="date" value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })} /></label>
      <div className="grid min-w-0 grid-cols-1 gap-3"><label className="grid min-w-0 gap-1 text-sm font-semibold">Check in{(() => { const value = splitAttendanceDateTime(form.checkInLocal); return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_8rem] gap-2"><Input aria-label="Check in date" className="min-w-0" type="date" value={value.date} onChange={(event) => setForm({ ...form, checkInLocal: mergeAttendanceDateTime(event.target.value, value.time) })} /><Input aria-label="Check in time" className="min-w-0" type="time" value={value.time} onChange={(event) => setForm({ ...form, checkInLocal: mergeAttendanceDateTime(value.date, event.target.value) })} /></div>; })()}</label><label className="grid min-w-0 gap-1 text-sm font-semibold">Check out{(() => { const value = splitAttendanceDateTime(form.checkOutLocal); return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_8rem] gap-2"><Input aria-label="Check out date" className="min-w-0" type="date" value={value.date} onChange={(event) => setForm({ ...form, checkOutLocal: mergeAttendanceDateTime(event.target.value, value.time) })} /><Input aria-label="Check out time" className="min-w-0" type="time" value={value.time} onChange={(event) => setForm({ ...form, checkOutLocal: mergeAttendanceDateTime(value.date, event.target.value) })} /></div>; })()}</label></div>
      <label className="grid gap-1 text-sm font-semibold">Status<Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{[["PRESENT", "Present"], ["LATE", "Late"], ["CHECKED_OUT", "Checked out"], ["HALF_DAY", "Half day"], ["ABSENT", "Absent"], ["LEAVE", "Leave"], ["HOLIDAY", "Holiday"], ["WEEKEND", "Weekend"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-semibold">Shift<Select value={form.shiftId} onChange={(event) => setForm({ ...form, shiftId: event.target.value })}><option value="">Use employee&apos;s assigned shift</option>{shifts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " · inactive"}</option>)}</Select></label>
      <div className="flex gap-2"><FormSaveActions mode={editingId ? "edit" : "create"} busy={saving} onCancel={() => {}} /></div>
    </form></CardContent></Card></EntityFormPanel>
  </div>}</EntityListWorkspace>;
}

function AttendanceTable({ rows, compact = false, dateFormat }: { rows: AttendanceRecord[]; compact?: boolean; dateFormat: "AD" | "BS" }) {
  const [selectedLocation, setSelectedLocation] = useState<AttendanceRecord | null>(null);
  const selectedLatitude = selectedLocation?.checkInLatitude ?? selectedLocation?.checkOutLatitude;
  const selectedLongitude = selectedLocation?.checkInLongitude ?? selectedLocation?.checkOutLongitude;
  const mapUrl = selectedLatitude != null && selectedLongitude != null
    ? `https://www.google.com/maps?q=${selectedLatitude},${selectedLongitude}&z=17&output=embed`
    : "";
  return <Card className={compact ? "border-0 shadow-none" : "mt-7"}><CardContent className="p-0">{selectedLocation && mapUrl && <div className="border-b border-slate-200 bg-slate-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-slate-950">Attendance location · {selectedLocation.staffName}</p><p className="mt-1 text-xs text-slate-500">{selectedLocation.checkInLatitude !== undefined ? "Check-in location" : "Check-out location"} · {selectedLatitude}, {selectedLongitude}</p></div><div className="flex items-center gap-2"><a href={`https://www.google.com/maps?q=${selectedLatitude},${selectedLongitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#003893] hover:bg-blue-50"><ExternalLink size={14} /> Open in Google Maps</a><Button type="button" variant="ghost" size="sm" onClick={() => setSelectedLocation(null)}>Close</Button></div></div><DeliveryTrackingMap destination={selectedLatitude != null && selectedLongitude != null ? { latitude: selectedLatitude, longitude: selectedLongitude } : null} /></div>}<div className="overflow-x-auto"><RecordTable className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Shift</th><th className="px-5 py-3">Check in</th><th className="px-5 py-3">Check out</th><th className="px-5 py-3">Hours</th><th className="px-5 py-3">Late</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => { const latitude = row.checkInLatitude ?? row.checkOutLatitude; const longitude = row.checkInLongitude ?? row.checkOutLongitude; const hasLocation = latitude !== undefined && longitude !== undefined; const locationLabel = hasLocation ? (row.checkInLocationStatus ?? "CAPTURED") : "LEGACY · LOCATION NOT CAPTURED"; return <tr key={row.id}><td className="px-5 py-4 font-bold">{row.staffName}</td><td className="px-5 py-4">{formatPlatformDate(row.workDate, dateFormat)}</td><td className="px-5 py-4 text-xs text-slate-500">{row.shiftName ?? "—"}</td><td className="px-5 py-4">{formatKathmanduTime(row.checkInUtc)}</td><td className="px-5 py-4">{formatKathmanduTime(row.checkOutUtc)}</td><td className="px-5 py-4">{Math.floor(row.totalMinutes / 60)}h {String(row.totalMinutes % 60).padStart(2, "0")}m</td><td className="px-5 py-4">{row.lateMinutes ?? 0}m</td><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{locationLabel.replaceAll("_", " ")}</Badge>{hasLocation ? <button type="button" onClick={() => setSelectedLocation(row)} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#003893] hover:underline"><MapPin size={14} />View map</button> : null}</div></td><td className="px-5 py-4"><Badge variant={row.status === "LATE" ? "destructive" : "secondary"}>{row.status.replaceAll("_", " ")}</Badge></td></tr>; })}{!rows.length && <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-500">No attendance has been recorded today.</td></tr>}</tbody></RecordTable></div></CardContent></Card>;
}

function Employees({ superAdmin, staff }: { superAdmin: boolean; staff: Staff[] }) { return <Card className="mt-7"><CardContent className="p-8"><Users className="text-[#003893]" size={26} /><h2 className="mt-4 text-xl font-extrabold">Employee records</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">The staff directory is the source of truth for employee identity, role, branch and active status. HRMS attendance and payroll use these same records.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{staff.slice(0, 6).map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><p className="font-extrabold">{item.fullName}</p><p className="mt-1 text-xs text-slate-500">{item.role} · {item.employeeId ?? "No employee ID"}</p></div>)}</div><Link className="mt-6 inline-flex rounded-lg bg-[#003893] px-4 py-2.5 text-sm font-bold text-white" href={superAdmin ? "/superadmin/staff" : "/admin/staff"}>Open employee directory</Link></CardContent></Card>; }

function LeaveManagement({ rows, staff, dateFormat, onDecision, onRefresh }: { rows: LeaveRequest[]; staff: Staff[]; dateFormat: "AD" | "BS"; onDecision: (id: string, status: "APPROVED" | "REJECTED") => void; onRefresh: () => void }) {
  const [form, setForm] = useState(emptyLeaveForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEntityRecord(rows, edit, "0");
  function edit(row: LeaveRequest) { if (routeEntityEdit(row.id, "0")) return;
    setEditingId(row.id);
    setForm({ staffUserId: row.staffUserId, leaveType: row.leaveType, dayType: row.dayType ?? "FULL_DAY", startDate: row.startDate.slice(0, 10), endDate: row.endDate.slice(0, 10), supportingDocumentUrl: row.supportingDocumentUrl ?? "", reason: row.reason });
  }

  async function persistLeave() {
    if (form.endDate < form.startDate) { toast.error("The end date must be on or after the start date."); return; }
    if (form.dayType !== "FULL_DAY" && form.endDate !== form.startDate) { toast.error("A half-day leave must begin and end on the same date."); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) await updateAdminLeaveRequest(token(), editingId, payload);
      else await createAdminLeaveRequest(token(), payload);
      toast.success(editingId ? "Leave record updated." : "Leave record saved.");
      setForm(emptyLeaveForm);
      setEditingId(null);
      onRefresh();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Leave record could not be saved.");
    } finally { setSaving(false); }
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void persistLeave();
  }

  async function remove(row: LeaveRequest) {
    if (!window.confirm(`Delete ${row.staffName}'s ${row.leaveType.toLowerCase()} leave request?`)) return;
    try {
      await deleteAdminLeaveRequest(token(), row.id);
      toast.success("Leave record deleted.");
      if (editingId === row.id) { setEditingId(null); setForm(emptyLeaveForm); }
      onRefresh();
     entitySaveComplete(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Leave record could not be deleted.");
    }
  }

  return <EntityListWorkspace title="Leave">{<div className="mt-7 grid min-w-0 gap-6">
    <EntityListPanel formKey="0"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>All leave records</CardTitle><span className="text-xs text-slate-500">{rows.length} request{rows.length === 1 ? "" : "s"}</span></div></CardHeader><CardContent><div className="overflow-x-auto"><RecordTable className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Admin actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-4 font-bold">{row.staffName}</td><td className="px-4 py-4"><p>{row.leaveType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{(row.dayType ?? "FULL_DAY").replaceAll("_", " ")} · {row.appliedDays ?? "—"} day{row.appliedDays === 1 ? "" : "s"}</p></td><td className="px-4 py-4 text-xs">{formatPlatformDate(row.startDate, dateFormat)} – {formatPlatformDate(row.endDate, dateFormat)}</td><td className="max-w-xs px-4 py-4 text-slate-600">{row.reason}{row.supportingDocumentUrl && <a className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#003893] hover:underline" href={row.supportingDocumentUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} />Supporting document</a>}{row.approvalComment && <p className="mt-1 text-xs text-slate-400">Comment: {row.approvalComment}</p>}</td><td className="px-4 py-4"><Badge variant={row.status === "APPROVED" ? "secondary" : row.status === "REJECTED" ? "destructive" : "outline"}>{row.status}</Badge></td><td className="px-4 py-4"><div className="flex flex-wrap gap-1"><Button type="button" variant="ghost" size="icon" title="Edit leave" aria-label="Edit leave" onClick={() => edit(row)}><Pencil size={15} /></Button><Button type="button" variant="ghost" size="icon" title="Delete leave" aria-label="Delete leave" onClick={() => void remove(row)}><Trash2 size={15} className="text-rose-600" /></Button>{row.status === "PENDING" && <><Button type="button" size="sm" onClick={() => onDecision(row.id, "APPROVED")}><Check size={14} />Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => onDecision(row.id, "REJECTED")}><X size={14} />Reject</Button></>}</div></td></tr>)}{!rows.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No leave requests found.</td></tr>}</tbody></RecordTable></div></CardContent></Card></EntityListPanel>
    <EntityFormPanel formKey="0"><Card className="h-fit"><CardHeader><CardTitle>{editingId ? "Edit leave record" : "Create leave record"}</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={save}>
      <label className="grid gap-1 text-sm font-semibold">Employee<Select required value={form.staffUserId} onChange={(event) => setForm({ ...form, staffUserId: event.target.value })}><option value="">Choose employee</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.role}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-semibold">Leave type<Select value={form.leaveType} onChange={(event) => setForm({ ...form, leaveType: event.target.value })}><option value="ANNUAL">Annual</option><option value="SICK">Sick</option><option value="CASUAL">Casual</option><option value="UNPAID">Unpaid</option><option value="OTHER">Other</option></Select></label>
      <label className="grid gap-1 text-sm font-semibold">Leave duration<Select value={form.dayType} onChange={(event) => setForm({ ...form, dayType: event.target.value, endDate: event.target.value === "FULL_DAY" ? form.endDate : form.startDate })}><option value="FULL_DAY">Full day</option><option value="FIRST_HALF">First half</option><option value="SECOND_HALF">Second half</option></Select></label>
      <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-semibold">Start date<Input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value, endDate: form.dayType === "FULL_DAY" ? form.endDate : event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">End date<Input required type="date" min={form.startDate || undefined} max={form.dayType === "FULL_DAY" ? undefined : form.startDate || undefined} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></div>
      <label className="grid gap-1 text-sm font-semibold">Supporting document link <span className="font-normal text-slate-500">(optional)</span><Input type="url" maxLength={1000} placeholder="https://…" value={form.supportingDocumentUrl} onChange={(event) => setForm({ ...form, supportingDocumentUrl: event.target.value })} /></label>
      <label className="grid gap-1 text-sm font-semibold">Reason<Textarea required minLength={3} maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      <FormSaveActions mode={editingId ? "edit" : "create"} busy={saving || !staff.length} saveLabel={editingId ? "Save changes" : "Save & list"} onSaveAndAnother={() => { void persistLeave(); }} onCancel={() => { setEditingId(null); setForm(emptyLeaveForm); }} />
    </form></CardContent></Card></EntityFormPanel>
  </div>}</EntityListWorkspace>;
}

function Shifts({ shifts, shift, setShift, saving, editingShiftId, setEditingShiftId, onSubmit }: { shifts: WorkShift[]; shift: typeof emptyShift; setShift: React.Dispatch<React.SetStateAction<typeof emptyShift>>; saving: boolean; editingShiftId: string | null; setEditingShiftId: React.Dispatch<React.SetStateAction<string | null>>; onSubmit: (event: React.FormEvent) => void }) {useEntityRecord(shifts,editShift); function editShift(item:WorkShift){if(routeEntityEdit(item.id))return; setEditingShiftId(item.id); setShift({ name: item.name, shiftType: item.shiftType, startTime: item.startTime.slice(0, 5), endTime: item.endTime.slice(0, 5), breakDurationMinutes: item.breakDurationMinutes, gracePeriodMinutes: item.gracePeriodMinutes, minimumWorkingMinutes: item.minimumWorkingMinutes, lateThresholdMinutes: item.lateThresholdMinutes, halfDayThresholdMinutes: item.halfDayThresholdMinutes, overtimeThresholdMinutes: item.overtimeThresholdMinutes, weeklyOffDays: item.weeklyOffDays, isActive: item.isActive }); }  return <EntityListWorkspace title="Shifts">{<div className="mt-7 grid min-w-0 gap-6"><EntityListPanel formKey="0"><Card><CardHeader><CardTitle>Configured shifts</CardTitle></CardHeader><CardContent><div className="grid gap-3">{shifts.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-extrabold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.startTime.slice(0, 5)} – {item.endTime.slice(0, 5)} · {item.breakDurationMinutes}m break · {item.gracePeriodMinutes}m grace</p></div><div className="flex items-center gap-2"><Badge variant={item.isActive ? "secondary" : "outline"}>{item.isActive ? "ACTIVE" : "INACTIVE"}</Badge><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`} onClick={() => editShift(item)}><Pencil size={15} /></Button></div></div>)}{!shifts.length && <p className="text-sm text-slate-500">No shifts configured.</p>}</div></CardContent></Card></EntityListPanel><EntityFormPanel formKey="0"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus size={17} />{editingShiftId ? "Edit shift" : "Add shift"}</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={onSubmit}><Input required placeholder="Shift name" value={shift.name} onChange={e => setShift({ ...shift, name: e.target.value })} /><div className="grid grid-cols-2 gap-3"><Input required type="time" value={shift.startTime} onChange={e => setShift({ ...shift, startTime: e.target.value })} /><Input required type="time" value={shift.endTime} onChange={e => setShift({ ...shift, endTime: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><Input type="number" min={0} max={240} placeholder="Break minutes" value={shift.breakDurationMinutes} onChange={e => setShift({ ...shift, breakDurationMinutes: Number(e.target.value) })} /><Input type="number" min={0} max={240} placeholder="Grace minutes" value={shift.gracePeriodMinutes} onChange={e => setShift({ ...shift, gracePeriodMinutes: Number(e.target.value) })} /></div><Input placeholder="Weekly off days" value={shift.weeklyOffDays} onChange={e => setShift({ ...shift, weeklyOffDays: e.target.value })} /><FormSaveActions mode={"create"} busy={saving} onCancel={() => {}} /></form></CardContent></Card></EntityFormPanel></div>}</EntityListWorkspace>; }

function SettingsForm({ settings, setSettings, saving, onSubmit }: { settings: AttendanceSettings | null; setSettings: React.Dispatch<React.SetStateAction<AttendanceSettings | null>>; saving: boolean; onSubmit: (event: React.FormEvent) => void }) { if (!settings) return <p className="mt-7 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Attendance settings could not be loaded.</p>; const update = (key: keyof AttendanceSettings, value: number | boolean) => setSettings({ ...settings, [key]: value }); return <Card className="mt-7 max-w-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 size={18} />Attendance settings</CardTitle></CardHeader><CardContent><form className="grid gap-5" onSubmit={onSubmit}><label className="text-sm font-bold">Late check-in grace period (minutes)<Input className="mt-2" type="number" min={0} max={240} value={settings.lateCheckInGraceMinutes} onChange={e => update("lateCheckInGraceMinutes", Number(e.target.value))} /></label><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">Default radius (m)<Input className="mt-2" type="number" min={0} max={10000} value={settings.defaultRadiusMeters} onChange={e => update("defaultRadiusMeters", Number(e.target.value))} /></label><label className="text-sm font-bold">Early check-in grace<Input className="mt-2" type="number" min={0} max={240} value={settings.earlyCheckInGraceMinutes} onChange={e => update("earlyCheckInGraceMinutes", Number(e.target.value))} /></label><label className="text-sm font-bold">Early check-out grace<Input className="mt-2" type="number" min={0} max={240} value={settings.earlyCheckOutGraceMinutes} onChange={e => update("earlyCheckOutGraceMinutes", Number(e.target.value))} /></label></div><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.locationRequired} onChange={e => update("locationRequired", e.target.checked)} /> Require browser location for check-in and check-out</label><div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><MapPin size={17} className="mr-2 inline" />Branch coordinates and radius are used for geofencing. Business timezone: {settings.businessTimeZone}.</div><Button disabled={saving}>{saving ? "Saving…" : "Save attendance settings"}</Button></form></CardContent></Card>; }

function Corrections({ rows, dateFormat }: { rows: AttendanceCorrection[]; dateFormat: "AD" | "BS" }) { return <Card className="mt-7"><CardHeader><CardTitle>Attendance correction requests</CardTitle></CardHeader><CardContent><div className="grid gap-3">{rows.map(row => <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-extrabold">{row.staffName} · {formatPlatformDate(row.workDate, dateFormat)}</p><p className="mt-1 text-sm text-slate-600">{row.reason}</p><p className="mt-1 text-xs text-slate-500">Requested in {formatKathmanduTime(row.requestedCheckInUtc)} · out {formatKathmanduTime(row.requestedCheckOutUtc)}</p></div><Badge variant={row.status === "PENDING" ? "outline" : row.status === "APPROVED" ? "secondary" : "destructive"}>{row.status}</Badge></div>)}{!rows.length && <p className="text-sm text-slate-500">No correction requests.</p>}</div></CardContent></Card>; }

function Reports({ summary, attendance }: { summary: HrmsOverview | null; attendance: AttendanceRecord[] }) { return <div className="mt-7 grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle>Today&apos;s report</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm"><p className="flex justify-between"><span>Present</span><b>{summary?.presentToday ?? 0}</b></p><p className="flex justify-between"><span>Late</span><b>{summary?.lateToday ?? 0}</b></p><p className="flex justify-between"><span>Absent</span><b>{summary?.absentToday ?? 0}</b></p><p className="flex justify-between"><span>Overtime</span><b>{Math.floor((summary?.overtimeMinutes ?? 0) / 60)}h {(summary?.overtimeMinutes ?? 0) % 60}m</b></p></CardContent></Card><Card><CardHeader><CardTitle>Location audit</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm"><p>Valid location captures: <b>{attendance.filter(x => x.checkInLocationStatus === "VALID").length}</b></p><p>Unconfigured captures: <b>{attendance.filter(x => x.checkInLocationStatus === "NOT_CONFIGURED").length}</b></p><p>Outside area attempts recorded: <b>{attendance.filter(x => x.checkInLocationStatus === "OUTSIDE_ALLOWED_AREA").length}</b></p></CardContent></Card></div>; }
