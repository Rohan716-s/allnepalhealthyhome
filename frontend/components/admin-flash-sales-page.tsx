"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Edit3, Loader2, Plus, TimerReset } from "lucide-react";
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
import { dateInputToUtc, formatNepalDateTime, utcToDateInput } from "@/lib/date-time";
import { createAdminFlashSale, getAdminBranches, getAdminFlashSales, getAdminProducts, setAdminEntityStatus, updateAdminFlashSale, type AdminBranch, type AdminFlashSale, type AdminProduct } from "@/services/api";

type FlashSaleForm = { name: string; productId: string; branchId: string; discountPercent: string; quantityLimit: string; startsAt: string; endsAt: string; isActive: boolean };
const blank: FlashSaleForm = { name: "", productId: "", branchId: "", discountPercent: "10", quantityLimit: "", startsAt: "", endsAt: "", isActive: true };
const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";

type AdminFlashSalesPageProps = { superAdmin?: boolean; view?: "list" | "form"; saleId?: string };

export function AdminFlashSalesPage({ superAdmin = false, view = "list", saleId }: AdminFlashSalesPageProps) {
  const router = useRouter();
  const editing = Boolean(saleId);
  const listPath = superAdmin ? "/superadmin/flash-sales" : "/admin/flash-sales";
  const [rows, setRows] = useState<AdminFlashSale[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [form, setForm] = useState<FlashSaleForm>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sales, productPage, branchRows] = await Promise.all([
        getAdminFlashSales(token(), superAdmin),
        getAdminProducts(token(), {}, superAdmin, true),
        getAdminBranches(token(), superAdmin, true),
      ]);
      setRows(sales);
      setProducts(productPage.items);
      setBranches(branchRows);
      if (saleId) {
        const sale = sales.find(row => row.id === saleId);
        if (!sale) throw new Error("Flash sale could not be found.");
        setForm({ name: sale.name, productId: sale.productId, branchId: sale.branchId ?? "", discountPercent: String(sale.discountPercent), quantityLimit: sale.quantityLimit ? String(sale.quantityLimit) : "", startsAt: utcToDateInput(sale.startsAt), endsAt: utcToDateInput(sale.endsAt), isActive: sale.isActive });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Flash sales could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [saleId, superAdmin]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function field(key: keyof FlashSaleForm, value: string | boolean) { setForm(current => ({ ...current, [key]: value })); }

  async function persist(saveAndAnother = false) {
    setError("");
    if (!form.name.trim() || !form.productId || !form.startsAt || !form.endsAt) { setError("Name, product, start time, and end time are required."); return; }
    const startsAt = dateInputToUtc(form.startsAt);
    const endsAt = dateInputToUtc(form.endsAt);
    if (!startsAt || !endsAt || new Date(startsAt) >= new Date(endsAt)) { setError("End time must be later than the start time."); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), productId: form.productId, branchId: form.branchId || undefined, discountPercent: Number(form.discountPercent), quantityLimit: form.quantityLimit ? Number(form.quantityLimit) : undefined, startsAt, endsAt, isActive: form.isActive };
      const saved = editing ? await updateAdminFlashSale(saleId!, payload, token(), superAdmin) : await createAdminFlashSale(payload, token(), superAdmin);
      toast.success(editing ? `${saved.name} updated successfully.` : `${saved.name} created successfully.`);
      setRows(current => editing ? current.map(row => row.id === saved.id ? saved : row) : [saved, ...current]);
      if (editing || !saveAndAnother) router.push(listPath);
      else { setForm(blank); window.scrollTo({ top: 0, behavior: "smooth" }); }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Flash sale could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function save(event: FormEvent) { event.preventDefault(); void persist(); }

  async function toggleStatus(row: AdminFlashSale, isActive: boolean) {
    try {
      await setAdminEntityStatus("flash-sale", row.id, isActive, token(), superAdmin);
      setRows(current => current.map(item => item.id === row.id ? { ...item, isActive, status: isActive ? "ACTIVE" : "INACTIVE" } : item));
      toast.success(`${row.name} ${isActive ? "Activated" : "Deactivated"}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Flash sale status could not be updated.";
      setError(message);
      toast.error(message);
    }
  }

  return <AdminShell superAdmin={superAdmin}>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">Marketing control</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{view === "form" ? (editing ? "Edit flash sale" : "Add flash sale") : "Flash sales"}</h1><p className="mt-2 text-sm text-slate-500">Schedule product-level offers with server-side expiry and optional quantity limits.</p></div>
      {view === "list" && <Button type="button" onClick={() => router.push(`${listPath}/create`)}><Plus size={16} />Add flash sale</Button>}
    </div>
    {view === "form" ? <Card className="mt-7"><CardHeader><CardTitle className="flex items-center gap-2"><TimerReset size={18} className="text-[#DC143C]" />{editing ? "Flash sale details" : "New flash sale"}</CardTitle></CardHeader><CardContent>{loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading flash sale…</div> : <form onSubmit={save} className="grid gap-5 md:grid-cols-2"><div className="grid gap-2 md:col-span-2"><Label htmlFor="sale-name">Sale name</Label><Input id="sale-name" required value={form.name} onChange={event => field("name", event.target.value)} placeholder="Weekend wellness offer" /></div><div className="grid gap-2"><Label htmlFor="sale-product">Product</Label><Select id="sale-product" required value={form.productId} onChange={event => field("productId", event.target.value)}><option value="">Choose a product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</Select></div><div className="grid gap-2"><Label htmlFor="sale-branch">Branch scope</Label><Select id="sale-branch" value={form.branchId} onChange={event => field("branchId", event.target.value)}><option value="">All active branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div><div className="grid gap-2"><Label htmlFor="sale-discount">Discount %</Label><Input id="sale-discount" required min="0.01" max="100" step="0.01" type="number" value={form.discountPercent} onChange={event => field("discountPercent", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="sale-limit">Quantity limit</Label><Input id="sale-limit" min="1" step="1" type="number" value={form.quantityLimit} onChange={event => field("quantityLimit", event.target.value)} placeholder="Unlimited" /></div><div className="grid gap-2"><Label htmlFor="sale-start">Starts</Label><Input id="sale-start" required type="datetime-local" value={form.startsAt} onChange={event => field("startsAt", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="sale-end">Ends</Label><Input id="sale-end" required type="datetime-local" value={form.endsAt} onChange={event => field("endsAt", event.target.value)} /></div><label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2"><input type="checkbox" checked={form.isActive} onChange={event => field("isActive", event.target.checked)} />Enabled</label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}<div className="md:col-span-2"><FormSaveActions mode={editing ? "edit" : "create"} busy={saving} onCancel={() => router.push(listPath)} onSaveAndAnother={!editing ? () => void persist(true) : undefined} saveLabel={editing ? "Save changes" : "Save & list"} /></div></form>}</CardContent></Card> : <Card className="mt-7"><CardHeader><CardTitle>Offer schedule</CardTitle></CardHeader><CardContent>{loading ? <div className="p-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading flash sales…</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Offer</TableHead><TableHead>Discount</TableHead><TableHead>Schedule</TableHead><TableHead>Limit</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><p className="font-bold">{row.name}</p><p className="text-xs text-slate-500">{row.productName}</p><p className="text-[10px] text-slate-400">{row.branchName ?? "All branches"}</p></TableCell><TableCell className="font-extrabold text-[#DC143C]">{row.discountPercent}%</TableCell><TableCell className="text-xs text-slate-500">{formatNepalDateTime(row.startsAt)}<br />to {formatNepalDateTime(row.endsAt)}</TableCell><TableCell className="text-xs">{row.quantityLimit ? `${row.quantitySold} / ${row.quantityLimit}` : `${row.quantitySold} sold`}</TableCell><TableCell><ActiveStatusToggle checked={row.isActive} onChange={isActive => toggleStatus(row, isActive)} label={`flash sale ${row.name}`} confirmOnDeactivate /></TableCell><TableCell className="whitespace-nowrap text-right"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${row.name}`} title={`Edit ${row.name}`} onClick={() => router.push(`${listPath}/${row.id}/edit`)}><Edit3 size={16} /></Button></TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">No flash sales have been scheduled.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>}
  </AdminShell>;
}
