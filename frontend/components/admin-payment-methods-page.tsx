"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminPaymentMethod, getAdminPaymentMethods, setAdminEntityStatus, updateAdminPaymentMethod, uploadAdminMedia, resolveMediaUrl } from "@/services/api";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PaymentForm = Omit<AdminPaymentMethod, "id" | "code">;
const token = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";

function toForm(method: AdminPaymentMethod): PaymentForm {
  return { displayName: method.displayName, instructions: method.instructions ?? "", minimumOrder: method.minimumOrder, maximumOrder: method.maximumOrder, displayOrder: method.displayOrder, isEnabled: method.isEnabled, requiresServerVerification: method.requiresServerVerification, qrCodeUrl: method.qrCodeUrl ?? "" };
}

export function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<AdminPaymentMethod[]>([]);
  const [forms, setForms] = useState<Record<string, PaymentForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { getAdminPaymentMethods(token()).then(rows => { setMethods(rows); setForms(Object.fromEntries(rows.map(row => [row.code, toForm(row)]))); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  function update(code: string, patch: Partial<PaymentForm>) { setForms(current => ({ ...current, [code]: { ...current[code], ...patch } })); }
  async function save(method: AdminPaymentMethod) {
    const form = forms[method.code]; if (!form) return;
    setSaving(method.code); setError("");
    try { const saved = await updateAdminPaymentMethod(method.code, form, token()); setMethods(current => current.map(item => item.code === saved.code ? saved : item)); update(saved.code, toForm(saved)); toast.success(`${saved.displayName} settings saved`); }
    catch (e) { setError(e instanceof Error ? e.message : "Payment method settings could not be saved."); }
    finally { setSaving(""); }
  }
  async function toggleStatus(method: AdminPaymentMethod, isEnabled: boolean) { try { await setAdminEntityStatus("payment-method", method.code, isEnabled, token(), true); setMethods(current => current.map(item => item.code === method.code ? { ...item, isEnabled } : item)); update(method.code, { isEnabled }); toast.success(`${method.displayName} is now ${isEnabled ? "enabled" : "disabled"}`); } catch (e) { const message = e instanceof Error ? e.message : "Payment method status could not be updated."; setError(message); toast.error(message); } }
  async function uploadQr(method: AdminPaymentMethod, file?: File) { if (!file) return; setSaving(method.code); setError(""); try { const asset = await uploadAdminMedia(file, "PAYMENT_QR", `${method.displayName} payment QR`, true, token()); update(method.code, { qrCodeUrl: asset.url }); toast.success("Payment QR uploaded. Save this payment method to publish it."); } catch (e) { setError(e instanceof Error ? e.message : "Payment QR could not be uploaded."); } finally { setSaving(""); } }

  return <AdminShell superAdmin><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">Commerce controls</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Payment methods</h1><p className="mt-2 text-sm text-slate-500">Choose which payment options customers can use and keep verification rules visible to the pharmacy team.</p><Link href="/superadmin/commerce-settings" className="mt-4 inline-flex text-sm font-bold text-blue-800 underline">Price visibility and delivery rules</Link></div>{error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}<div className="mt-7 grid gap-5 xl:grid-cols-2">{loading ? <Card><CardContent className="p-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={17} />Loading payment methods…</CardContent></Card> : methods.map(method => { const form = forms[method.code]; return <Card key={method.code}><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard size={18} className="text-[#003893]" />{method.displayName}<ActiveStatusToggle checked={form?.isEnabled ?? false} onChange={isEnabled => toggleStatus(method, isEnabled)} label={"payment method " + method.displayName} confirmOnDeactivate /></CardTitle><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{method.code}</p></CardHeader><CardContent><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor={`${method.code}-name`}>Customer-facing name</Label><Input id={`${method.code}-name`} value={form?.displayName ?? ""} onChange={event => update(method.code, { displayName: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor={`${method.code}-instructions`}>Instructions</Label><Textarea id={`${method.code}-instructions`} value={form?.instructions ?? ""} onChange={event => update(method.code, { instructions: event.target.value })} placeholder="Explain what the customer should expect." /></div>{form?.qrCodeUrl && <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-3"><img src={resolveMediaUrl(form.qrCodeUrl)} alt={`${method.displayName} payment QR preview`} className="size-28 rounded-lg border object-contain" /><div className="min-w-0 flex-1"><p className="text-sm font-bold">Current QR code</p><p className="mt-1 break-all text-xs text-slate-500">{form.qrCodeUrl}</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => update(method.code, { qrCodeUrl: "" })}>Remove QR</Button></div></div>}<div className="grid gap-2"><Label htmlFor={`${method.code}-qr`}>{form?.qrCodeUrl ? "Replace payment QR image" : "Upload payment QR image"}</Label><Input id={`${method.code}-qr`} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void uploadQr(method, event.target.files?.[0])} /><p className="text-xs text-slate-500">The active QR is shown only on the matching customer order’s payment screen.</p></div><div className="grid gap-4 sm:grid-cols-3"><div className="grid gap-2"><Label htmlFor={`${method.code}-min`}>Minimum order</Label><Input id={`${method.code}-min`} type="number" min="0" step="0.01" value={form?.minimumOrder ?? ""} onChange={event => update(method.code, { minimumOrder: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="No minimum" /></div><div className="grid gap-2"><Label htmlFor={`${method.code}-max`}>Maximum order</Label><Input id={`${method.code}-max`} type="number" min="0" step="0.01" value={form?.maximumOrder ?? ""} onChange={event => update(method.code, { maximumOrder: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="No maximum" /></div><div className="grid gap-2"><Label htmlFor={`${method.code}-order`}>Display order</Label><Input id={`${method.code}-order`} type="number" min="0" step="1" value={form?.displayOrder ?? 0} onChange={event => update(method.code, { displayOrder: Number(event.target.value) })} /></div></div><p className="text-xs text-slate-500">Use the status switch above to control whether this method appears at checkout.</p><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><label className="flex items-start gap-2 text-sm font-semibold text-slate-700"><Checkbox checked={form?.requiresServerVerification ?? false} onChange={event => update(method.code, { requiresServerVerification: event.target.checked })} /><span><span className="flex items-center gap-1"><ShieldCheck size={15} className="text-[#003893]" />Require pharmacy verification</span><span className="mt-1 block text-xs font-normal text-slate-500">Online or manual payments remain pending until verified by the backend.</span></span></label></div><Button type="button" className="w-full justify-center" disabled={saving === method.code} onClick={() => void save(method)}>{saving === method.code ? <Loader2 className="animate-spin" /> : <Save size={16} />}Save {method.displayName}</Button></div></CardContent></Card>; })}</div></AdminShell>;
}
