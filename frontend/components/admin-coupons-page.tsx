"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Edit3, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { AdminShell } from "@/components/admin-shell";
import { FormSaveActions } from "@/components/form-save-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateInputToUtc, formatPlatformDate, utcToDateInput } from "@/lib/date-time";
import { createAdminCoupon, getAdminCoupons, setAdminEntityStatus, updateAdminCoupon, type AdminCoupon } from "@/services/api";

type CouponForm = { code: string; type: string; value: string; minimumOrder: string; maximumDiscount: string; usageLimit: string; startsAt: string; endsAt: string; firstOrderOnly: boolean; isActive: boolean };
const blank: CouponForm = { code: "", type: "PERCENTAGE", value: "10", minimumOrder: "", maximumDiscount: "", usageLimit: "", startsAt: "", endsAt: "", firstOrderOnly: false, isActive: true };
const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";

export function AdminCouponsPage({ view = "list", couponId }: { view?: "list" | "form"; couponId?: string }) {
  const router = useRouter();
  const editing = Boolean(couponId);
  const [rows, setRows] = useState<AdminCoupon[]>([]);
  const [form, setForm] = useState<CouponForm>(blank);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const listPath = "/superadmin/coupons";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const loaded = await getAdminCoupons(token());
      setRows(loaded);
      if (couponId) {
        const coupon = loaded.find(row => row.id === couponId);
        if (!coupon) throw new Error("Coupon could not be found.");
        setForm({ code: coupon.code, type: coupon.type, value: String(coupon.value), minimumOrder: coupon.minimumOrder === undefined ? "" : String(coupon.minimumOrder), maximumDiscount: coupon.maximumDiscount === undefined ? "" : String(coupon.maximumDiscount), usageLimit: coupon.usageLimit === undefined ? "" : String(coupon.usageLimit), startsAt: utcToDateInput(coupon.startsAt), endsAt: utcToDateInput(coupon.endsAt), firstOrderOnly: coupon.firstOrderOnly, isActive: coupon.isActive });
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Coupons could not be loaded."); }
    finally { setLoading(false); }
  }, [couponId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  function field(key: keyof CouponForm, value: string | boolean) { setForm(current => ({ ...current, [key]: value })); }

  async function persist(saveAndAnother = false) {
    setError("");
    if (!form.code.trim() || !form.value || Number(form.value) <= 0) { setError("Code and a positive discount value are required."); return; }
    const startsAt = dateInputToUtc(form.startsAt);
    const endsAt = dateInputToUtc(form.endsAt);
    if (form.endsAt && !endsAt || form.startsAt && !startsAt || (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))) { setError("End time must be later than the start time."); return; }
    setSaving(true);
    try {
      const input = { code: form.code.trim().toUpperCase(), type: form.type, value: Number(form.value), minimumOrder: form.minimumOrder ? Number(form.minimumOrder) : undefined, maximumDiscount: form.maximumDiscount ? Number(form.maximumDiscount) : undefined, usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined, startsAt, endsAt, firstOrderOnly: form.firstOrderOnly, isActive: form.isActive };
      const saved = editing ? await updateAdminCoupon(couponId!, input, token()) : await createAdminCoupon(input, token());
      toast.success(editing ? `Coupon ${saved.code} updated successfully.` : `Coupon ${saved.code} created successfully.`);
      setRows(current => editing ? current.map(row => row.id === saved.id ? saved : row) : [saved, ...current]);
      if (editing || !saveAndAnother) router.push(listPath); else { setForm(blank); window.scrollTo({ top: 0, behavior: "smooth" }); }
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Coupon could not be saved."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  }

  async function toggleStatus(row: AdminCoupon, isActive: boolean) {
    try { await setAdminEntityStatus("coupon", row.id, isActive, token(), true); setRows(current => current.map(item => item.id === row.id ? { ...item, isActive } : item)); toast.success(`${row.code} ${isActive ? "Activated" : "Deactivated"}`); }
    catch (reason) { const message = reason instanceof Error ? reason.message : "Coupon status could not be updated."; setError(message); toast.error(message); }
  }

  const visibleRows = useMemo(() => rows.filter(row => (!search || row.code.toLowerCase().includes(search.toLowerCase())) && (status === "all" || row.isActive === (status === "active"))), [rows, search, status]);

  return <AdminShell superAdmin>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Marketing</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{view === "form" ? (editing ? "Edit coupon" : "Create coupon") : "Coupons"}</h1><p className="mt-2 text-sm text-slate-500">Create validated discount codes stored in the shared database.</p></div>{view === "list" && <Button type="button" onClick={() => router.push(`${listPath}/create`)}><Plus size={16} />Add coupon</Button>}</div>
    {view === "form" ? <Card className="mt-7"><CardHeader><CardTitle className="flex items-center gap-2"><BadgePercent size={18} className="text-[#003893]" />{editing ? "Coupon details" : "New coupon"}</CardTitle></CardHeader><CardContent>{loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading coupon…</div> : <form onSubmit={event => { event.preventDefault(); void persist(); }} className="grid gap-5 md:grid-cols-2"><div className="grid gap-2"><Label htmlFor="coupon-code">Code</Label><Input id="coupon-code" required value={form.code} onChange={event => field("code", event.target.value)} placeholder="WELCOME10" /></div><div className="grid gap-2"><Label htmlFor="coupon-type">Type</Label><Select id="coupon-type" value={form.type} onChange={event => field("type", event.target.value)}><option value="PERCENTAGE">Percent</option><option value="FIXED">Fixed NPR</option></Select></div><div className="grid gap-2"><Label htmlFor="coupon-value">Value</Label><Input id="coupon-value" required min="0.01" step="0.01" type="number" value={form.value} onChange={event => field("value", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="coupon-min">Minimum order</Label><Input id="coupon-min" min="0" step="0.01" type="number" value={form.minimumOrder} onChange={event => field("minimumOrder", event.target.value)} placeholder="Optional" /></div><div className="grid gap-2"><Label htmlFor="coupon-max">Maximum discount</Label><Input id="coupon-max" min="0" step="0.01" type="number" value={form.maximumDiscount} onChange={event => field("maximumDiscount", event.target.value)} placeholder="Optional" /></div><div className="grid gap-2"><Label htmlFor="coupon-limit">Usage limit</Label><Input id="coupon-limit" min="1" step="1" type="number" value={form.usageLimit} onChange={event => field("usageLimit", event.target.value)} placeholder="Unlimited" /></div><div className="grid gap-2"><Label htmlFor="coupon-start">Starts</Label><Input id="coupon-start" type="datetime-local" value={form.startsAt} onChange={event => field("startsAt", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="coupon-end">Ends</Label><Input id="coupon-end" type="datetime-local" value={form.endsAt} onChange={event => field("endsAt", event.target.value)} /></div><label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2"><input type="checkbox" checked={form.firstOrderOnly} onChange={event => field("firstOrderOnly", event.target.checked)} />First order only</label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2"><input type="checkbox" checked={form.isActive} onChange={event => field("isActive", event.target.checked)} />Coupon active</label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}<div className="md:col-span-2"><FormSaveActions mode={editing ? "edit" : "create"} busy={saving} onCancel={() => router.push(listPath)} onSaveAndAnother={!editing ? () => void persist(true) : undefined} saveLabel={editing ? "Save changes" : "Save & list"} /></div></form>}</CardContent></Card> : <Card className="mt-7"><CardHeader><CardTitle className="flex items-center gap-2"><BadgePercent size={18} className="text-[#003893]" />Coupon catalogue</CardTitle><div className="flex flex-wrap gap-2"><Input aria-label="Search coupons" placeholder="Search coupon code" value={search} onChange={event => setSearch(event.target.value)} /><Select aria-label="Filter coupons by status" className="w-[150px]" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></div></CardHeader><CardContent>{loading ? <div className="p-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading coupons…</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Offer</TableHead><TableHead>Limits</TableHead><TableHead>Schedule</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{visibleRows.map(row => <TableRow key={row.id}><TableCell className="font-extrabold">{row.code}</TableCell><TableCell>{row.type === "PERCENTAGE" ? `${row.value}%` : `NPR ${row.value}`}</TableCell><TableCell className="text-xs text-slate-500">{row.minimumOrder ? `Min NPR ${row.minimumOrder}` : "No minimum"}<br />Used {row.usedCount}{row.usageLimit ? ` / ${row.usageLimit}` : ""}</TableCell><TableCell className="text-xs text-slate-500">{row.endsAt ? formatPlatformDate(row.endsAt) : "No expiry"}</TableCell><TableCell><ActiveStatusToggle checked={row.isActive} onChange={isActive => toggleStatus(row, isActive)} label={`coupon ${row.code}`} confirmOnDeactivate /></TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${row.code}`} title={`Edit ${row.code}`} onClick={() => router.push(`${listPath}/${row.id}/edit`)}><Edit3 size={16} /></Button></TableCell></TableRow>)}{!visibleRows.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">No coupons match these filters.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>}
  </AdminShell>;
}
