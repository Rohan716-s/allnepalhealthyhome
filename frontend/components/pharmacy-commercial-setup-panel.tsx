"use client";
import { FormSaveActions } from "@/components/form-save-actions";
import { EntityListWorkspace, EntityListPanel, ListButton, EntityFormPanel , entitySaveComplete , routeEntityEdit, useEntityRecord } from "@/components/entity-list-panel";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, FilePlus2, Percent, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPlatformDate } from "@/lib/date-time";
import {
  getAdminManufacturers,
  getCommerceCustomers,
  getCommerceProducts,
  getCommerceSuppliers,
  getPharmacyPartyDiscounts,
  getPharmacySalesBudgets,
  getPharmacySalesTemplates,
  getPharmacySupplierDiscounts,
  savePharmacyPartyDiscount,
  savePharmacySalesBudget,
  savePharmacySalesTemplate,
  savePharmacySupplierDiscount,
  type AdminBranch,
  type AdminManufacturer,
  type CommerceProduct,
  type PharmacyPartyDiscount,
  type PharmacySalesBudget,
  type PharmacySalesTemplate,
  type PharmacySupplierDiscount,
} from "@/services/api";
import type { PharmacyMenuAction } from "@/components/pharmacy-module-menu";

type Party = { id: string; name: string };
type Supplier = { id: string; name: string };
type TemplateLine = { productId: string; quantity: number; unit?: string; discountPercent: number; bonusQuantity: number };
const percent = (value: number) => `${value.toLocaleString("en-NP", { maximumFractionDigits: 2 })}%`;
const currency = (value: number) => `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PharmacyCommercialSetupPanel({ action, token, superAdmin, branches, onClose }: { action: PharmacyMenuAction; token: string; superAdmin: boolean; branches: AdminBranch[]; onClose: () => void }) {
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [manufacturers, setManufacturers] = useState<AdminManufacturer[]>([]);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [templates, setTemplates] = useState<PharmacySalesTemplate[]>([]);
  const [partyDiscounts, setPartyDiscounts] = useState<PharmacyPartyDiscount[]>([]);
  const [supplierDiscounts, setSupplierDiscounts] = useState<PharmacySupplierDiscount[]>([]);
  const [budgets, setBudgets] = useState<PharmacySalesBudget[]>([]);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [lines, setLines] = useState<TemplateLine[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [discount, setDiscount] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [branchId, setBranchId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [targetAmount, setTargetAmount] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      if (action.mode === "sales-templates") {
        const [templateRows, productRows] = await Promise.all([getPharmacySalesTemplates(token, superAdmin), getCommerceProducts(token, undefined, undefined, superAdmin)]);
        setTemplates(templateRows); setProducts(productRows);
      } else if (action.mode === "party-discounts") {
        const [rows, partyRows, companyRows] = await Promise.all([getPharmacyPartyDiscounts(token, superAdmin), getCommerceCustomers(token, undefined, superAdmin), getAdminManufacturers(token, superAdmin)]);
        setPartyDiscounts(rows); setCustomers(partyRows); setManufacturers(companyRows);
      } else if (action.mode === "supplier-discounts") {
        const [rows, supplierRows, companyRows] = await Promise.all([getPharmacySupplierDiscounts(token, superAdmin), getCommerceSuppliers(token, undefined, superAdmin), getAdminManufacturers(token, superAdmin)]);
        setSupplierDiscounts(rows); setSuppliers(supplierRows); setManufacturers(companyRows);
      } else {
        setBudgets(await getPharmacySalesBudgets(token, undefined, undefined, superAdmin));
      }
    } catch (value) { const message = value instanceof Error ? value.message : "The saved pharmacy setup could not be loaded."; setError(message); }
    finally { setBusy(false); }
  }, [action.mode, superAdmin, token]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const selectedProduct = useMemo(() => products.find((row) => row.id === productId), [products, productId]);
  useEntityRecord(budgets,editBudget);
  function editBudget(row: PharmacySalesBudget) { if(routeEntityEdit(row.id))return;setBranchId(row.branchId ?? "");setPeriodStart(row.periodStart.slice(0,10));setPeriodEnd(row.periodEnd.slice(0,10));setTargetAmount(String(row.targetAmount));setDescription(row.notes ?? "");setEditingId(row.id); }
  function reset() { setEditingId(""); setName(""); setDescription(""); setActive(true); setLines([]); setCustomerId(""); setSupplierId(""); setManufacturerId(""); setStartsAt(""); setEndsAt(""); }
  useEntityRecord(templates, editTemplate, "0");
  function editTemplate(row: PharmacySalesTemplate) { if (routeEntityEdit(row.id, "0")) return;  setEditingId(row.id); setName(row.name); setDescription(row.description ?? ""); setActive(row.isActive); setLines(row.lines.map(({ productId: id, quantity: qty, unit: u, discountPercent, bonusQuantity }) => ({ productId: id, quantity: qty, unit: u, discountPercent, bonusQuantity }))); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
  useEntityRecord(partyDiscounts, editPartyDiscount, "0");
  function editPartyDiscount(row: PharmacyPartyDiscount) { if (routeEntityEdit(row.id, "0")) return;  setEditingId(row.id); setCustomerId(row.customerId); setManufacturerId(row.manufacturerId); setDiscount(String(row.discountPercent)); setStartsAt(row.startsAt?.slice(0, 10) ?? ""); setEndsAt(row.endsAt?.slice(0, 10) ?? ""); setActive(row.isActive); }
  useEntityRecord(supplierDiscounts, editSupplierDiscount, "0");
  function editSupplierDiscount(row: PharmacySupplierDiscount) { if (routeEntityEdit(row.id, "0")) return;  setEditingId(row.id); setSupplierId(row.supplierId); setManufacturerId(row.manufacturerId); setDiscount(String(row.discountPercent)); setStartsAt(row.startsAt?.slice(0, 10) ?? ""); setEndsAt(row.endsAt?.slice(0, 10) ?? ""); setActive(row.isActive); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (action.mode === "sales-templates") {
        if (!lines.length) throw new Error("Add at least one product to the sales template.");
        await savePharmacySalesTemplate(token, { id: editingId || undefined, name: name.trim(), description: description.trim() || undefined, isActive: active, lines }, superAdmin);
      } else if (action.mode === "party-discounts") {
        if (!customerId || !manufacturerId) throw new Error("Choose both the party and company.");
        await savePharmacyPartyDiscount(token, { id: editingId || undefined, customerId, manufacturerId, discountPercent: Number(discount), startsAt: startsAt || undefined, endsAt: endsAt || undefined, isActive: active }, superAdmin);
      } else if (action.mode === "supplier-discounts") {
        if (!supplierId || !manufacturerId) throw new Error("Choose both the supplier and company.");
        await savePharmacySupplierDiscount(token, { id: editingId || undefined, supplierId, manufacturerId, discountPercent: Number(discount), startsAt: startsAt || undefined, endsAt: endsAt || undefined, isActive: active }, superAdmin);
      } else {
        if (!periodStart || !periodEnd || Number(targetAmount) <= 0) throw new Error("Enter a valid period and positive sales target.");
        await savePharmacySalesBudget(token, { branchId: branchId || undefined, periodStart, periodEnd, targetAmount: Number(targetAmount), notes: description.trim() || undefined }, superAdmin);
      }
      toast.success(editingId ? "Setup record updated." : "Setup record saved."); reset(); setProductId(""); setPeriodStart(""); setPeriodEnd(""); setTargetAmount(""); await load();
     entitySaveComplete(); } catch (value) { const message = value instanceof Error ? value.message : "The setup record could not be saved."; setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  function addTemplateLine() {
    if (!productId || Number(quantity) <= 0 || Number(discount) < 0 || Number(discount) > 100 || Number(bonus) < 0) return toast.error("Choose a product and enter valid quantity, discount and bonus values.");
    if (lines.some((line) => line.productId === productId)) return toast.error("A product can appear only once in a sales template.");
    setLines((current) => [...current, { productId, quantity: Number(quantity), unit: unit || selectedProduct?.salesUnit || selectedProduct?.baseUnit || "piece", discountPercent: Number(discount), bonusQuantity: Number(bonus) }]);
    setProductId(""); setQuantity("1"); setUnit(""); setDiscount("0"); setBonus("0");
  }

  return <EntityListWorkspace title="Saved setup records">{<section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Catalogue setup</p><h2 className="mt-1 text-2xl font-extrabold">{action.title}</h2><p className="mt-1 max-w-3xl text-sm text-slate-500">Saved setup records are validated against the current catalogue and are applied by the matching billing, purchase, or reporting workflow.</p></div><Button variant="outline" onClick={onClose}>Back to module</Button></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
    <EntityFormPanel formKey="0"><Card><CardHeader><CardTitle>{editingId ? "Edit saved setup" : `Add ${action.title.toLowerCase()}`}</CardTitle></CardHeader><CardContent>
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        {action.mode === "sales-templates" && <><div className="grid gap-3 sm:grid-cols-2"><Field label="Template name"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required /></Field><Field label="Description"><Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></Field></div><div className="grid gap-2 rounded-xl border p-3 md:grid-cols-[minmax(220px,1fr)_100px_140px_100px_100px_auto]"><Select value={productId} onChange={(event) => { setProductId(event.target.value); setUnit(""); }}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</Select><Input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="Template quantity" placeholder="Qty" /><Input value={unit || selectedProduct?.salesUnit || selectedProduct?.baseUnit || ""} onChange={(event) => setUnit(event.target.value)} aria-label="Template unit" placeholder="Unit" /><Input type="number" min="0" max="100" value={discount} onChange={(event) => setDiscount(event.target.value)} aria-label="Line discount percent" placeholder="Discount %" /><Input type="number" min="0" value={bonus} onChange={(event) => setBonus(event.target.value)} aria-label="Bonus quantity" placeholder="Bonus" /><Button type="button" variant="outline" onClick={addTemplateLine}><Plus size={14} />Add line</Button></div><div className="space-y-2">{lines.map((line) => <div key={line.productId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{products.find((product) => product.id === line.productId)?.name ?? "Saved product"} · {line.quantity} {line.unit} · {percent(line.discountPercent)} discount · {line.bonusQuantity} bonus</span><Button type="button" size="sm" variant="ghost" onClick={() => setLines((current) => current.filter((item) => item.productId !== line.productId))}>Remove</Button></div>)}{!lines.length && <p className="text-sm text-slate-500">No product lines added.</p>}</div></>}
        {action.mode === "party-discounts" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Customer / party"><Select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required><option value="">Select active party</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field><Field label="Company / manufacturer"><Select value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)} required><option value="">Select company</option>{manufacturers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field><Field label="Discount %"><Input type="number" min="0.01" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} required /></Field><Field label="Effective from"><Input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field><Field label="Effective to"><Input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></Field></div>}
        {action.mode === "supplier-discounts" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Supplier"><Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required><option value="">Select active supplier</option>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field><Field label="Company / manufacturer"><Select value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)} required><option value="">Select company</option>{manufacturers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field><Field label="Discount %"><Input type="number" min="0.01" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} required /></Field><Field label="Effective from"><Input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field><Field label="Effective to"><Input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></Field></div>}
        {action.mode === "sales-budget" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{superAdmin && <Field label="Branch (optional — blank means all branches)"><Select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>}<Field label="Period start"><Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required /></Field><Field label="Period end"><Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required /></Field><Field label="Sales target (NPR)"><Input type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} required /></Field><Field label="Notes"><Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></Field></div>}
        {action.mode !== "sales-budget" && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Active</label>}
        <div className="flex gap-2"><FormSaveActions mode={editingId ? "edit" : "create"} busy={busy} onCancel={() => {}} /></div>
      </form>
    </CardContent></Card></EntityFormPanel>
    {action.mode === "sales-templates" && <EntityListPanel formKey="0"><Card><CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 size={17} />Saved templates <Badge variant="secondary" className="ml-auto">{templates.length}</Badge></CardTitle></CardHeader><CardContent><Rows rows={templates.map((row) => ({ id: row.id, title: row.name, detail: row.lines.map((line) => `${line.product} × ${line.quantity}`).join(" · "), active: row.isActive, onEdit: () => editTemplate(row) }))} /></CardContent></Card></EntityListPanel>}
    {action.mode === "party-discounts" && <EntityListPanel formKey="0"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Percent size={17} />Customer-by-company discounts</CardTitle></CardHeader><CardContent><Rows rows={partyDiscounts.map((row) => ({ id: row.id, title: `${row.customerName} · ${row.manufacturerName}`, detail: `${percent(row.discountPercent)}${row.startsAt || row.endsAt ? ` · ${row.startsAt ? formatPlatformDate(row.startsAt) : "Any start"} – ${row.endsAt ? formatPlatformDate(row.endsAt) : "No end"}` : " · Always effective"}`, active: row.isActive, onEdit: () => editPartyDiscount(row) }))} /></CardContent></Card></EntityListPanel>}
    {action.mode === "supplier-discounts" && <EntityListPanel formKey="0"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Percent size={17} />Supplier-by-company discounts</CardTitle></CardHeader><CardContent><Rows rows={supplierDiscounts.map((row) => ({ id: row.id, title: `${row.supplierName} · ${row.manufacturerName}`, detail: `${percent(row.discountPercent)}${row.startsAt || row.endsAt ? ` · ${row.startsAt ? formatPlatformDate(row.startsAt) : "Any start"} – ${row.endsAt ? formatPlatformDate(row.endsAt) : "No end"}` : " · Always effective"}`, active: row.isActive, onEdit: () => editSupplierDiscount(row) }))} /></CardContent></Card></EntityListPanel>}
    {action.mode === "sales-budget" && <EntityListPanel formKey="0"><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays size={17} />Actual sales versus target</CardTitle></CardHeader><CardContent><Rows rows={budgets.map((row) => ({ id: row.id, title: `${row.branch} · ${formatPlatformDate(row.periodStart)} – ${formatPlatformDate(row.periodEnd)}`, detail: `Target ${currency(row.targetAmount)} · Actual ${currency(row.actualAmount)} · ${row.variance >= 0 ? "Ahead" : "Behind"} ${currency(Math.abs(row.variance))}`, active: row.variance >= 0, label: row.variance >= 0 ? "On / above target" : "Below target", onEdit: () => editBudget(row) }))} /></CardContent></Card></EntityListPanel>}
  </section>}</EntityListWorkspace>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-xs font-bold text-slate-600">{label}{children}</label>; }
function Rows({ rows }: { rows: { id: string; title: string; detail: string; active: boolean; label?: string; onEdit: () => void }[] }) { return <div className="divide-y">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-bold">{row.title}</p><p className="mt-1 text-xs text-slate-500">{row.detail}</p></div><Badge variant={row.active ? "secondary" : "outline"}>{row.label ?? (row.active ? "Active" : "Inactive")}</Badge><Button type="button" size="sm" variant="outline" onClick={row.onEdit}>Edit</Button></div>)}{!rows.length && <p className="py-8 text-center text-sm text-slate-500">No saved records yet.</p>}</div>; }
