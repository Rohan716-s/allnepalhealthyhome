"use client";

import { FormEvent, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { FormSaveActions } from "@/components/form-save-actions";
import { UniversalImageUploader } from "@/components/universal-image-uploader";
import { StaffShell, staffToken, staffUser } from "@/components/staff-shell";
import { Button } from "@/components/ui/button";
import { ApiError, changeStaffPassword, getStaffProfile, updateStaffProfile, uploadStaffProfilePhoto, type Staff } from "@/services/api";
import { utcToDateInput } from "@/lib/date-time";

type ProfileForm = { fullName: string; phone: string; licenseReference: string; employeeId: string; address: string; joiningDate: string };
const emptyProfile: ProfileForm = { fullName: "", phone: "", licenseReference: "", employeeId: "", address: "", joiningDate: "" };
const emptyPassword = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function StaffProfile({ panel }: { panel: "pharmacist" | "delivery" }) {
  const [staff, setStaff] = useState<Staff | null>(staffUser());
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [photo, setPhoto] = useState<File | null>(null);
  const [password, setPassword] = useState(emptyPassword);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getStaffProfile(staffToken(), panel).then(value => {
      setStaff(value);
      setForm({ fullName: value.fullName, phone: value.phone, licenseReference: value.licenseReference ?? "", employeeId: value.employeeId ?? "", address: value.address ?? "", joiningDate: utcToDateInput(value.joiningDate) });
    }).catch(e => setError(e instanceof ApiError ? e.message : "Profile could not be loaded."));
  }, [panel]);

  function resetProfile() {
    if (!staff) return;
    setForm({ fullName: staff.fullName, phone: staff.phone, licenseReference: staff.licenseReference ?? "", employeeId: staff.employeeId ?? "", address: staff.address ?? "", joiningDate: utcToDateInput(staff.joiningDate) });
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setBusy("profile");
    try { const updated = await updateStaffProfile(staffToken(), panel, form); setStaff(updated); window.localStorage.setItem("anhh-staff", JSON.stringify(updated)); setMessage("Profile saved successfully."); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Profile could not be saved."); }
    finally { setBusy(""); }
  }

  async function savePhoto() {
    if (!photo) return;
    setError(""); setMessage(""); setBusy("photo");
    try { const saved = await uploadStaffProfilePhoto(staffToken(), photo); setStaff(current => current ? { ...current, profilePhotoUrl: saved.url } : current); setPhoto(null); setMessage("Profile photo updated successfully."); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Profile photo could not be uploaded."); }
    finally { setBusy(""); }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setBusy("password");
    try { await changeStaffPassword(staffToken(), panel, password); setPassword(emptyPassword); setMessage("Password changed successfully."); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Password could not be changed."); }
    finally { setBusy(""); }
  }

  return <StaffShell panel={panel} title="Profile"><div className="grid gap-5 lg:grid-cols-2">
    {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 lg:col-span-2">{error}</p>}
    {message && <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 lg:col-span-2">{message}</p>}
    <form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal-700">Work profile</p><h2 className="mt-2 text-xl font-extrabold">{staff?.role === "DELIVERY" ? "Delivery staff profile" : "Pharmacist profile"}</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-600 sm:col-span-2">Full name<input required value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} className="field mt-2" /></label>
      <label className="text-xs font-bold text-slate-600">Phone<input required value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="field mt-2" /></label>
      <label className="text-xs font-bold text-slate-600">Employee ID<input value={form.employeeId} onChange={event => setForm({ ...form, employeeId: event.target.value })} className="field mt-2" /></label>
      <label className="text-xs font-bold text-slate-600">Work email<input disabled value={staff?.email ?? ""} className="field mt-2 bg-slate-50" /></label>
      <label className="text-xs font-bold text-slate-600">Joining date<input type="date" value={form.joiningDate} onChange={event => setForm({ ...form, joiningDate: event.target.value })} className="field mt-2" /></label>
      <label className="text-xs font-bold text-slate-600 sm:col-span-2">Address<input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="field mt-2" /></label>
      {panel === "pharmacist" && <label className="text-xs font-bold text-slate-600 sm:col-span-2">License / reference<input value={form.licenseReference} onChange={event => setForm({ ...form, licenseReference: event.target.value })} className="field mt-2" /></label>}
    </div><div className="mt-6"><FormSaveActions mode="edit" busy={busy === "profile"} onCancel={resetProfile} saveLabel="Save profile" /></div></form>
    <div className="grid gap-5"><section className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal-700">Identity</p><h2 className="mt-2 text-xl font-extrabold">Profile photo</h2><p className="mt-2 text-sm text-slate-500">Use the shared image uploader to preview and replace your profile photo.</p><div className="mt-5"><UniversalImageUploader disabled={busy === "photo"} uploadState={busy === "photo" ? "uploading" : "idle"} key={panel} label="Profile photo" value={staff?.profilePhotoUrl} onChange={setPhoto} aspect="aspect-square" helperText="JPG, PNG, WebP, GIF, BMP, or AVIF · maximum 8 MB" /><Button type="button" className="mt-3" disabled={!photo || busy === "photo"} onClick={() => void savePhoto}>{busy === "photo" ? "Uploading…" : <><Upload size={15} />Upload photo</>}</Button></div></section>
      <form onSubmit={savePassword} className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal-700">Security</p><h2 className="mt-2 text-xl font-extrabold">Change password</h2><div className="mt-6 grid gap-4"><label className="text-xs font-bold text-slate-600">Current password<input required type="password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })} className="field mt-2" /></label><label className="text-xs font-bold text-slate-600">New password<input required minLength={8} type="password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })} className="field mt-2" /></label><label className="text-xs font-bold text-slate-600">Confirm new password<input required minLength={8} type="password" value={password.confirmPassword} onChange={event => setPassword({ ...password, confirmPassword: event.target.value })} className="field mt-2" /></label></div><div className="mt-6"><FormSaveActions mode="edit" busy={busy === "password"} onCancel={() => setPassword(emptyPassword)} saveLabel="Change password" /></div></form>
    </div>
  </div></StaffShell>;
}
