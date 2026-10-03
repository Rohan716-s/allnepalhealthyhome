"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit3, Loader2, Plus, Shield, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { AdminShell } from "@/components/admin-shell";
import { FormSaveActions } from "@/components/form-save-actions";
import { UniversalImageUploader } from "@/components/universal-image-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminBranches, getAdminStaff, createAdminStaff, setAdminEntityStatus, updateAdminStaff, uploadAdminStaffPhoto, type AdminBranch, type Staff } from "@/services/api";

const permissions = ["catalog.view", "catalog.manage", "inventory.view", "inventory.adjust", "orders.view", "customers.view", "customers.manage", "prescriptions.view", "branches.manage", "reports.view"];
const blank = { fullName: "", email: "", phone: "", role: "PHARMACIST", branchId: "", licenseReference: "", employeeId: "", address: "", joiningDate: "", department: "", jobTitle: "", appointmentType: "", employmentStatus: "", officialEmail: "", dateOfBirth: "", gender: "", maritalStatus: "", taxNumber: "", citizenshipNumber: "", emergencyContactName: "", emergencyContactPhone: "", bloodGroup: "", deviceEnrollmentId: "", mobileAccessEnabled: true, webAccessEnabled: true, permissions: [] as string[], isActive: true, password: "" };
const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";

function HrProfileFields({ form, field }: { form: typeof blank; field: (key: keyof typeof blank, value: string | boolean | string[]) => void }) {
  return <fieldset className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 md:col-span-2"><legend className="px-1 text-sm font-extrabold text-[#003893]">Employee profile</legend>
    <p className="-mt-2 text-xs leading-5 text-slate-500 md:col-span-2">Employment, identity and access details aligned with the HRMS employee register.</p>
    <div className="grid gap-2"><Label htmlFor="staff-department">Department</Label><Input id="staff-department" value={form.department} onChange={event => field("department", event.target.value)} placeholder="e.g. Pharmacy operations" /></div>
    <div className="grid gap-2"><Label htmlFor="staff-job-title">Job title</Label><Input id="staff-job-title" value={form.jobTitle} onChange={event => field("jobTitle", event.target.value)} placeholder="e.g. Pharmacist" /></div>
    <div className="grid gap-2"><Label htmlFor="staff-appointment">Appointment type</Label><Input id="staff-appointment" value={form.appointmentType} onChange={event => field("appointmentType", event.target.value)} placeholder="e.g. Full-time" /></div>
    <div className="grid gap-2"><Label htmlFor="staff-employment-status">Employment status</Label><Input id="staff-employment-status" value={form.employmentStatus} onChange={event => field("employmentStatus", event.target.value)} placeholder="e.g. Active" /></div>
    <div className="grid gap-2"><Label htmlFor="staff-official-email">Official email</Label><Input id="staff-official-email" type="email" value={form.officialEmail} onChange={event => field("officialEmail", event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="staff-dob">Date of birth</Label><Input id="staff-dob" type="date" value={form.dateOfBirth} onChange={event => field("dateOfBirth", event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="staff-gender">Gender</Label><Select id="staff-gender" value={form.gender} onChange={event => field("gender", event.target.value)}><option value="">Not specified</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option></Select></div>
    <div className="grid gap-2"><Label htmlFor="staff-marital-status">Marital status</Label><Select id="staff-marital-status" value={form.maritalStatus} onChange={event => field("maritalStatus", event.target.value)}><option value="">Not specified</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="OTHER">Other</option></Select></div>
    <div className="grid gap-2"><Label htmlFor="staff-tax-number">PAN / tax number</Label><Input id="staff-tax-number" value={form.taxNumber} onChange={event => field("taxNumber", event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="staff-citizenship">Citizenship number</Label><Input id="staff-citizenship" value={form.citizenshipNumber} onChange={event => field("citizenshipNumber", event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="staff-emergency-name">Emergency contact name</Label><Input id="staff-emergency-name" value={form.emergencyContactName} onChange={event => field("emergencyContactName", event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="staff-emergency-phone">Emergency contact phone</Label><Input id="staff-emergency-phone" value={form.emergencyContactPhone} onChange={event => field("emergencyContactPhone", event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="staff-blood-group">Blood group</Label><Input id="staff-blood-group" value={form.bloodGroup} onChange={event => field("bloodGroup", event.target.value)} placeholder="e.g. O+" /></div>
    <div className="grid gap-2"><Label htmlFor="staff-device-id">Staff device / enrol ID</Label><Input id="staff-device-id" value={form.deviceEnrollmentId} onChange={event => field("deviceEnrollmentId", event.target.value)} /></div>
    <div className="flex flex-wrap gap-5 md:col-span-2"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Checkbox checked={form.mobileAccessEnabled} onChange={event => field("mobileAccessEnabled", event.target.checked)} />Mobile access enabled</label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Checkbox checked={form.webAccessEnabled} onChange={event => field("webAccessEnabled", event.target.checked)} />Web access enabled</label></div>
  </fieldset>;
}

export function AdminStaffPage({ view = "list", staffId, superAdmin = true }: { view?: "list" | "form"; staffId?: string; superAdmin?: boolean }) {
  const router = useRouter();
  const editing = Boolean(staffId);
  const listPath = superAdmin ? "/superadmin/staff" : "/admin/staff";
  const [rows, setRows] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [form, setForm] = useState(blank);
  const [photo, setPhoto] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [staffRows, branchRows] = await Promise.all([getAdminStaff(token()), getAdminBranches(token(), superAdmin, true)]);
      setRows(staffRows); setBranches(branchRows);
      if (staffId) {
        const staff = staffRows.find(row => row.id === staffId);
        if (!staff) throw new Error("Staff account could not be found.");
        const profile = staff.hrProfile;
        setForm({ ...blank, fullName: staff.fullName, email: staff.email, phone: staff.phone, role: staff.role, branchId: staff.branchId ?? "", licenseReference: staff.licenseReference ?? "", employeeId: staff.employeeId ?? "", address: staff.address ?? "", joiningDate: staff.joiningDate?.slice(0, 10) ?? "", department: profile?.department ?? "", jobTitle: profile?.jobTitle ?? "", appointmentType: profile?.appointmentType ?? "", employmentStatus: profile?.employmentStatus ?? "", officialEmail: profile?.officialEmail ?? "", dateOfBirth: profile?.dateOfBirth?.slice(0, 10) ?? "", gender: profile?.gender ?? "", maritalStatus: profile?.maritalStatus ?? "", taxNumber: profile?.taxNumber ?? "", citizenshipNumber: profile?.citizenshipNumber ?? "", emergencyContactName: profile?.emergencyContactName ?? "", emergencyContactPhone: profile?.emergencyContactPhone ?? "", bloodGroup: profile?.bloodGroup ?? "", deviceEnrollmentId: profile?.deviceEnrollmentId ?? "", mobileAccessEnabled: profile?.mobileAccessEnabled ?? true, webAccessEnabled: profile?.webAccessEnabled ?? true, permissions: staff.permissions ?? [], isActive: staff.isActive });
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Staff could not be loaded."); }
    finally { setLoading(false); }
  }, [staffId, superAdmin]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  function field(key: keyof typeof blank, value: string | boolean | string[]) { setForm(current => ({ ...current, [key]: value })); }
  function togglePermission(permission: string) { field("permissions", form.permissions.includes(permission) ? form.permissions.filter(item => item !== permission) : [...form.permissions, permission]); }

  async function persist(saveAndAnother = false) {
    setError("");
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) { setError("Name, email, and phone are required."); return; }
    if (!editing && form.password.length < 8) { setError("A password of at least 8 characters is required."); return; }
    setSaving(true);
    try {
      const input = { ...form, fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(), branchId: form.branchId || undefined, licenseReference: form.licenseReference || undefined, employeeId: form.employeeId || undefined, address: form.address || undefined, joiningDate: form.joiningDate || undefined, password: form.password || undefined };
      const saved = editing ? await updateAdminStaff(staffId!, input, token()) : await createAdminStaff(input, token());
      const finalRow = photo ? await uploadAdminStaffPhoto(saved.id, photo, token()) : saved;
      toast.success(editing ? `${finalRow.fullName} updated successfully.` : `${finalRow.fullName} created successfully.`);
      setRows(current => editing ? current.map(row => row.id === finalRow.id ? finalRow : row) : [finalRow, ...current]);
      if (editing || !saveAndAnother) router.push(listPath); else { setForm(blank); setPhoto(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Staff account could not be saved."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  }

  async function toggleStatus(row: Staff, isActive: boolean) {
    try { await setAdminEntityStatus("staff", row.id, isActive, token(), true); setRows(current => current.map(item => item.id === row.id ? { ...item, isActive } : item)); toast.success(`${row.fullName} is now ${isActive ? "active" : "inactive"}`); }
    catch (reason) { const message = reason instanceof Error ? reason.message : "Staff status could not be updated."; setError(message); toast.error(message); }
  }

  const visibleRows = rows.filter(row => !search || `${row.fullName} ${row.email} ${row.role} ${row.employeeId ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <AdminShell superAdmin={superAdmin}><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Access control</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{view === "form" ? (editing ? "Edit staff account" : "Create staff account") : "Staff and roles"}</h1><p className="mt-2 text-sm text-slate-500">Manage staff identities, branch assignment, active status, and granular permissions.</p></div>{view === "list" && <Button type="button" onClick={() => router.push(`${listPath}/create`)}><Plus size={16} />Add staff</Button>}</div>
    {view === "form" ? <Card className="mt-7"><CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} className="text-[#003893]" />{editing ? "Staff account details" : "New staff account"}</CardTitle></CardHeader><CardContent>{loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading staff account…</div> : <form onSubmit={event => { event.preventDefault(); void persist(); }} className="grid gap-5 md:grid-cols-2"><div className="grid gap-2 md:col-span-2"><Label htmlFor="staff-name">Full name</Label><Input id="staff-name" required value={form.fullName} onChange={event => field("fullName", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="staff-email">Email</Label><Input id="staff-email" required type="email" value={form.email} onChange={event => field("email", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="staff-phone">Phone</Label><Input id="staff-phone" required value={form.phone} onChange={event => field("phone", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="staff-employee-id">Employee ID</Label><Input id="staff-employee-id" value={form.employeeId} onChange={event => field("employeeId", event.target.value)} placeholder="ANHH-014" /></div><div className="grid gap-2"><Label htmlFor="staff-role">Role</Label><Select id="staff-role" value={form.role} onChange={event => field("role", event.target.value)}><option value="PHARMACIST">Pharmacist</option><option value="DELIVERY">Delivery</option><option value="ACCOUNTANT">Accountant</option><option value="SUPERVISOR">Supervisor</option><option value="SALES_EXECUTIVE">Sales Executive</option><option value="SALES_MANAGER">Sales Manager</option><option value="PURCHASE_INVENTORY_MANAGER">Purchase / Inventory Manager</option><option value="HR_MANAGER">HR Manager</option><option value="VIEWER_AUDITOR">Viewer / Auditor</option><option value="EMPLOYEE">Employee</option><option value="ADMIN">Admin</option></Select></div><div className="grid gap-2"><Label htmlFor="staff-branch">Branch</Label><Select id="staff-branch" value={form.branchId} onChange={event => field("branchId", event.target.value)}><option value="">No branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div><div className="grid gap-2"><Label htmlFor="staff-joining-date">Joining date</Label><Input id="staff-joining-date" type="date" value={form.joiningDate} onChange={event => field("joiningDate", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="staff-address">Address</Label><Input id="staff-address" value={form.address} onChange={event => field("address", event.target.value)} placeholder="Permanent or current address" /></div><div className="grid gap-2"><Label htmlFor="staff-license">License reference</Label><Input id="staff-license" value={form.licenseReference} onChange={event => field("licenseReference", event.target.value)} placeholder="Optional for pharmacist" /></div><div className="grid gap-2"><Label htmlFor="staff-password">{editing ? "New password" : "Password"}</Label><Input id="staff-password" required={!editing} minLength={8} type="password" value={form.password} onChange={event => field("password", event.target.value)} placeholder={editing ? "Leave blank to keep" : "At least 8 characters"} /></div><HrProfileFields form={form} field={field} /><div className="md:col-span-2">{editing ? <UniversalImageUploader key={rows.find(row => row.id === staffId)?.profilePhotoUrl ?? "empty"} label="Profile photo" value={rows.find(row => row.id === staffId)?.profilePhotoUrl} onChange={setPhoto} helperText="JPG, PNG, WebP, GIF, BMP, or AVIF · maximum 8 MB" /> : <p className="text-[11px] text-slate-400">Save the account first, then add a profile photo.</p>}</div><fieldset className="grid gap-3 md:col-span-2"><legend className="text-sm font-bold text-slate-700">Permissions</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{permissions.map(permission => <label key={permission} className="flex items-start gap-2 text-xs font-semibold text-slate-600"><Checkbox checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />{permission}</label>)}</div></fieldset><label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2"><Checkbox checked={form.isActive} onChange={event => field("isActive", event.target.checked)} />Account active</label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}<div className="md:col-span-2"><FormSaveActions mode={editing ? "edit" : "create"} busy={saving} onCancel={() => router.push(listPath)} onSaveAndAnother={!editing ? () => void persist(true) : undefined} saveLabel={editing ? "Save changes" : "Save & list"} /></div></form>}</CardContent></Card> : <Card className="mt-7"><CardHeader><CardTitle className="flex items-center gap-2"><UserCog size={18} className="text-[#003893]" />Staff accounts</CardTitle><Input aria-label="Search staff" placeholder="Search staff, role or employee ID" value={search} onChange={event => setSearch(event.target.value)} /></CardHeader><CardContent>{loading ? <div className="p-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading staff…</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Contact</TableHead><TableHead>Employee ID</TableHead><TableHead>Branch</TableHead><TableHead>Permissions</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{visibleRows.map(row => <TableRow key={row.id}><TableCell className="font-bold">{row.fullName}</TableCell><TableCell><span className="flex items-center gap-1 text-xs font-bold"><Shield size={13} />{row.role}</span>{row.hrProfile?.jobTitle && <p className="mt-1 text-xs font-medium text-slate-500">{row.hrProfile.jobTitle}{row.hrProfile.department ? ` · ${row.hrProfile.department}` : ""}</p>}</TableCell><TableCell>{row.email}<div className="text-xs text-slate-400">{row.phone}</div></TableCell><TableCell>{row.employeeId ?? "—"}</TableCell><TableCell>{row.branchName ?? "—"}</TableCell><TableCell className="max-w-xs text-xs text-slate-500">{row.permissions?.length ? row.permissions.join(", ") : "Role defaults"}</TableCell><TableCell><ActiveStatusToggle checked={row.isActive} onChange={isActive => toggleStatus(row, isActive)} label={`staff account ${row.fullName}`} confirmOnDeactivate /></TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${row.fullName}`} title={`Edit ${row.fullName}`} onClick={() => router.push(`${listPath}/${row.id}/edit`)}><Edit3 size={16} /></Button></TableCell></TableRow>)}{!visibleRows.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">No staff accounts match your search.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>}
  </AdminShell>;
}
