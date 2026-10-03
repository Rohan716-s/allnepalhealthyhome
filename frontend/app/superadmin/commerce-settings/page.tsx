"use client";

/* eslint-disable react-hooks/set-state-in-effect -- initialize forms from persisted Superadmin settings. */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminCustomers, getDeliveryRulesSettings, getPriceVisibilitySettings, saveDeliveryRulesSettings, savePriceVisibilitySettings, type AdminCustomer, type DeliveryRulesSettings, type PriceVisibilitySettings } from "@/services/api";

const staffToken = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
const roles = [
  { key: "ANONYMOUS", label: "Visitors who are not signed in" },
  { key: "CUSTOMER", label: "Personal customers" },
  { key: "PHARMACY", label: "Pharmacy accounts" },
];
const docOptions = [
  { key: "DELIVERY_PROOF", label: "Delivery proof / receiver confirmation" },
  { key: "INVOICE", label: "Invoice" },
  { key: "CHEQUE", label: "Cheque" },
  { key: "PAYMENT_PROOF", label: "Payment proof" },
];

export default function CommerceSettingsPage() {
  const [prices, setPrices] = useState<PriceVisibilitySettings>({ defaultVisible: false, roleOverrides: {}, customerOverrides: {} });
  const [delivery, setDelivery] = useState<DeliveryRulesSettings>({ geofenceRadiusMeters: 100, enforceGeofence: true, requiredDocumentTypes: ["DELIVERY_PROOF"] });
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerVisible, setCustomerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = staffToken();
    Promise.all([getPriceVisibilitySettings(token), getDeliveryRulesSettings(token)])
      .then(([priceSettings, deliverySettings]) => {
        setPrices({ defaultVisible: priceSettings.defaultVisible, roleOverrides: priceSettings.roleOverrides ?? {}, customerOverrides: priceSettings.customerOverrides ?? {} });
        setDelivery({ geofenceRadiusMeters: deliverySettings.geofenceRadiusMeters, enforceGeofence: deliverySettings.enforceGeofence, requiredDocumentTypes: deliverySettings.requiredDocumentTypes ?? ["DELIVERY_PROOF"] });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomers([]); return; }
    let live = true;
    const timer = window.setTimeout(() => getAdminCustomers(staffToken(), customerSearch.trim(), true).then(result => { if (live) setCustomers(result.items); }).catch(() => { if (live) setCustomers([]); }), 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [customerSearch]);

  const customerOverrides = useMemo(() => prices.customerOverrides ?? {}, [prices.customerOverrides]);
  function setRoleOverride(role: string, value: "inherit" | "show" | "hide") {
    setPrices(current => {
      const next = { ...current.roleOverrides };
      if (value === "inherit") delete next[role]; else next[role] = value === "show";
      return { ...current, roleOverrides: next };
    });
  }
  function toggleRequiredDocument(kind: string) {
    setDelivery(current => {
      const required = current.requiredDocumentTypes ?? [];
      const next = required.includes(kind) ? required.filter(item => item !== kind) : [...required, kind];
      return { ...current, requiredDocumentTypes: next };
    });
  }
  async function savePrices() {
    setSaving("prices"); setError("");
    try { setPrices(await savePriceVisibilitySettings(prices, staffToken())); toast.success("Price visibility settings saved"); }
    catch (e) { setError(e instanceof Error ? e.message : "Price settings could not be saved."); }
    finally { setSaving(""); }
  }
  async function saveDelivery() {
    setSaving("delivery"); setError("");
    try { setDelivery(await saveDeliveryRulesSettings(delivery, staffToken())); toast.success("Delivery safety rules saved"); }
    catch (e) { setError(e instanceof Error ? e.message : "Delivery settings could not be saved."); }
    finally { setSaving(""); }
  }
  function addCustomerOverride() {
    if (!selectedCustomer) return;
    setPrices(current => ({ ...current, customerOverrides: { ...current.customerOverrides, [selectedCustomer]: customerVisible } }));
    setSelectedCustomer(""); setCustomerSearch(""); setCustomers([]);
  }

  return <AdminShell superAdmin>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">Commerce controls</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Price and delivery rules</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">These controls are enforced by the API as well as the customer and rider screens.</p></div>
      <Link href="/superadmin/payment-methods" className="soft-btn"><ArrowLeft size={15} /> Payment methods</Link>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
    {loading ? <Card className="mt-7"><CardContent className="p-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={17} />Loading persisted rules…</CardContent></Card> : <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="text-blue-800" size={19} />Product price visibility</CardTitle><p className="text-sm text-slate-500">Hidden prices are removed from catalog, product, cart, and order-detail API responses.</p></CardHeader><CardContent className="space-y-5">
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold"><input type="checkbox" className="mt-0.5 size-4 accent-blue-800" checked={prices.defaultVisible} onChange={event => setPrices(current => ({ ...current, defaultVisible: event.target.checked }))} /><span>Show product prices by default<span className="mt-1 block text-xs font-normal text-slate-500">Used whenever no role-specific or customer-specific rule overrides it.</span></span></label>
        <div className="space-y-3">{roles.map(role => { const selected = prices.roleOverrides?.[role.key]; const value = selected === undefined ? "inherit" : selected ? "show" : "hide"; return <div key={role.key} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_200px] sm:items-center"><span className="text-sm font-semibold text-slate-700">{role.label}</span><select aria-label={`${role.label} price visibility`} className="field h-10" value={value} onChange={event => setRoleOverride(role.key, event.target.value as "inherit" | "show" | "hide")}><option value="inherit">Use global default</option><option value="show">Show prices</option><option value="hide">Hide prices</option></select></div>; })}</div>
        <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold">Customer / pharmacy override</h3><p className="mt-1 text-xs text-slate-500">Search existing customer records; no manual or fabricated customer IDs.</p><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_170px]"><Input value={customerSearch} onChange={event => { setCustomerSearch(event.target.value); setSelectedCustomer(""); }} placeholder="Search name, phone, or email" /><select className="field h-10" value={customerVisible ? "show" : "hide"} onChange={event => setCustomerVisible(event.target.value === "show")}><option value="hide">Hide prices</option><option value="show">Show prices</option></select></div>{customers.length > 0 && <select aria-label="Matching customers" className="field mt-2 h-10 w-full" value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)}><option value="">Choose a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.fullName} · {customer.phone}</option>)}</select>}<Button type="button" variant="outline" className="mt-3" disabled={!selectedCustomer} onClick={addCustomerOverride}>Add customer rule</Button>{Object.entries(customerOverrides).length > 0 && <div className="mt-3 divide-y rounded-lg border border-slate-200">{Object.entries(customerOverrides).map(([id, visible]) => { const customer = customers.find(item => item.id === id); return <div key={id} className="flex items-center justify-between gap-3 p-3 text-xs"><span className="min-w-0 break-all font-semibold">{customer?.fullName ?? id} · {visible ? "prices shown" : "prices hidden"}</span><Button type="button" size="sm" variant="outline" onClick={() => setPrices(current => { const next = { ...current.customerOverrides }; delete next[id]; return { ...current, customerOverrides: next }; })}>Remove</Button></div>; })}</div>}</section>
        <Button type="button" disabled={!!saving} onClick={() => void savePrices()}>{saving === "prices" ? <Loader2 className="animate-spin" /> : <Save size={16} />}Save price rules</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="text-blue-800" size={19} />Rider handoff requirements</CardTitle><p className="text-sm text-slate-500">The server blocks delivery completion if the rider is outside the radius or required documents are missing.</p></CardHeader><CardContent className="space-y-5">
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold"><input type="checkbox" className="mt-0.5 size-4 accent-blue-800" checked={delivery.enforceGeofence} onChange={event => setDelivery(current => ({ ...current, enforceGeofence: event.target.checked }))} /><span>Require rider GPS inside delivery radius<span className="mt-1 block text-xs font-normal text-slate-500">Default is enabled. Customers must save destination coordinates for this check.</span></span></label>
        <div className="grid gap-2"><Label htmlFor="delivery-radius">Allowed radius (meters)</Label><Input id="delivery-radius" type="number" min={25} max={5000} step={1} value={delivery.geofenceRadiusMeters} onChange={event => setDelivery(current => ({ ...current, geofenceRadiusMeters: Number(event.target.value) }))} /><p className="text-xs text-slate-500">Valid range: 25–5,000 meters. New installations default to 100 meters.</p></div>
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-bold">Documents required before marking Delivered</legend>{docOptions.map(option => <label key={option.key} className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="size-4 accent-blue-800" checked={(delivery.requiredDocumentTypes ?? []).includes(option.key)} onChange={() => toggleRequiredDocument(option.key)} />{option.label}</label>)}</fieldset>
        <Button type="button" disabled={!!saving} onClick={() => void saveDelivery()}>{saving === "delivery" ? <Loader2 className="animate-spin" /> : <Save size={16} />}Save delivery rules</Button>
      </CardContent></Card>
    </div>}
  </AdminShell>;
}
