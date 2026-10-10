"use client";
import { RecordTable } from "@/components/entity-record-table";
import { FormSaveActions } from "@/components/form-save-actions";
import { EntityListWorkspace, EntityListPanel, ListButton, EntityFormPanel , entitySaveComplete , routeEntityEdit, useEntityRecord } from "@/components/entity-list-panel";

/* eslint-disable react-hooks/set-state-in-effect -- load saved transporter records after the client session is available. */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw, Search, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAdminTransporter, getAdminTransporters, updateAdminTransporter, type AdminTransporter } from "@/services/api";

type TransporterForm = Omit<AdminTransporter, "id" | "createdAt" | "updatedAt">;
const emptyForm: TransporterForm = { name: "", contactPerson: "", phone: "", email: "", vehicleNumber: "", licenseNumber: "", serviceArea: "", notes: "", isActive: true };

export function AdminTransporterManagement({ superAdmin = true }: { superAdmin?: boolean }) {
  const [rows, setRows] = useState<AdminTransporter[]>([]);
  const [form, setForm] = useState<TransporterForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const token = () => window.localStorage.getItem("anhh-staff-access-token") ?? "";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows(await getAdminTransporters(token(), superAdmin, search || undefined)); }
    catch (e) { setError(e instanceof Error ? e.message : "Transporters could not be loaded."); }
    finally { setLoading(false); }
  }, [search, superAdmin]);
  useEffect(() => { void load(); }, [load]);

  useEntityRecord(rows, edit, "0");
  function edit(row: AdminTransporter) { if (routeEntityEdit(row.id, "0")) return;
    setEditing(row.id);
    setForm({ name: row.name, contactPerson: row.contactPerson ?? "", phone: row.phone ?? "", email: row.email ?? "", vehicleNumber: row.vehicleNumber ?? "", licenseNumber: row.licenseNumber ?? "", serviceArea: row.serviceArea ?? "", notes: row.notes ?? "", isActive: row.isActive });
  }
  function reset() { setEditing(null); setForm(emptyForm); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Enter a transporter name.");
    setSaving(true);
    try {
      const saved = editing ? await updateAdminTransporter(editing, form, token(), superAdmin) : await createAdminTransporter(form, token(), superAdmin);
      setRows((current) => editing ? current.map((row) => row.id === saved.id ? saved : row) : [saved, ...current]);
      toast.success(editing ? "Transporter updated." : "Transporter saved.");
      reset();
     entitySaveComplete(); } catch (e) { toast.error(e instanceof Error ? e.message : "The transporter could not be saved."); }
    finally { setSaving(false); }
  }

  return <EntityListWorkspace title="Transporter Management">{<AdminShell superAdmin={superAdmin}>
    <main className="mx-auto max-w-7xl space-y-6 px-5 pb-16 pt-8 lg:px-8">
      <header><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Catalogue · Delivery setup</p><h1 className="mt-2 text-3xl font-black">Transporter Setup</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Maintain the actual carriers used for pharmacy deliveries. Records are saved centrally and inactive transporters remain in history.</p></header>
      <div className="grid min-w-0 items-start gap-5">
        <EntityFormPanel formKey="0"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck size={18} className="text-[#003893]" />{editing ? "Edit transporter" : "Add transporter"}</CardTitle></CardHeader><CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <label className="space-y-1 text-xs font-bold text-slate-600 sm:col-span-2">Company / transporter name<Input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600">Contact person<Input maxLength={160} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600">Phone<Input maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600">Email<Input type="email" maxLength={240} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600">Vehicle number<Input maxLength={40} value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600">License / registration number<Input maxLength={80} value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600">Service area<Input maxLength={300} value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} placeholder="Districts or delivery coverage" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600 sm:col-span-2">Notes<Input maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active and selectable for operations</label>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><FormSaveActions mode={editing ? "edit" : "create"} busy={saving} onCancel={() => {}} /></div>
          </form>
        </CardContent></Card></EntityFormPanel>
        <EntityListPanel formKey="0"><Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><span className="flex-1">Saved transporters</span><Badge variant="secondary">{rows.length}</Badge><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />Refresh</Button></CardTitle></CardHeader><CardContent className="space-y-4">
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}><Input className="min-w-0 flex-1" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, contact, vehicle, service area" /><Button type="submit" variant="outline"><Search size={15} />Search</Button></form>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="overflow-x-auto"><RecordTable className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Transporter</th><th className="p-3">Contact</th><th className="p-3">Vehicle / License</th><th className="p-3">Coverage</th><th className="p-3">Status</th><th className="p-3" /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-3 font-bold">{row.name}<span className="block text-xs font-normal text-slate-500">{row.email || ""}</span></td><td className="p-3">{row.contactPerson || "—"}<span className="block text-xs text-slate-500">{row.phone || "—"}</span></td><td className="p-3">{row.vehicleNumber || "—"}<span className="block text-xs text-slate-500">{row.licenseNumber || ""}</span></td><td className="p-3">{row.serviceArea || "—"}</td><td className="p-3"><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></td><td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => edit(row)}><Pencil size={14} />Edit</Button></td></tr>)}</tbody></RecordTable></div>
          {!rows.length && <p className="py-8 text-center text-sm text-slate-500">{loading ? "Loading saved transporters…" : "No transporter records match this search."}</p>}
        </CardContent></Card></EntityListPanel>
      </div>
    </main>
  </AdminShell>}</EntityListWorkspace>;
}
