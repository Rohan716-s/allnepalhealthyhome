"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, ShoppingBasket, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, createRiderOrder, getRiderOrderCustomers, getRiderOrderProducts, getRiderOrderSettings, type RiderOrderCustomer, type RiderOrderProduct, type RiderOrderSettings } from "@/services/api";
import { useSiteConfig } from "@/components/site-config-provider";

export function RiderOrderComposer({ token, onCreated }: { token: string; onCreated: () => void }) {
  const { paymentMethods } = useSiteConfig();
  const [open, setOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<RiderOrderCustomer[]>([]);
  const [customer, setCustomer] = useState<RiderOrderCustomer | null>(null);
  const [addressId, setAddressId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<RiderOrderProduct[]>([]);
  const [orderSettings, setOrderSettings] = useState<RiderOrderSettings | null>(null);
  const [orderMode, setOrderMode] = useState<"SINGLE" | "BULK">("SINGLE");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const enabledPaymentMethods = useMemo(() => paymentMethods.filter(method => method.enabled).sort((a, b) => a.displayOrder - b.displayOrder), [paymentMethods]);
  const [paymentMethod, setPaymentMethod] = useState("");
  useEffect(() => {
    if (enabledPaymentMethods.length && !enabledPaymentMethods.some(method => method.code === paymentMethod)) setPaymentMethod(enabledPaymentMethods[0].code);
  }, [enabledPaymentMethods, paymentMethod]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token) return;
    getRiderOrderSettings(token).then(settings => { setOrderSettings(settings); setOrderMode(settings.mode === "BULK_ONLY" ? "BULK" : "SINGLE"); }).catch(e => setError(e instanceof Error ? e.message : "Ordering rules could not be loaded."));
  }, [open, token]);
  useEffect(() => {
    if (!open || !token) return;
    const timer = window.setTimeout(() => getRiderOrderCustomers(customerSearch, token).then(value => setCustomers(value.items)).catch(e => setError(e instanceof ApiError ? e.message : "Customers could not be loaded.")), 250);
    return () => window.clearTimeout(timer);
  }, [open, customerSearch, token]);
  useEffect(() => {
    if (!open || !token) return;
    const timer = window.setTimeout(() => getRiderOrderProducts(productSearch, token).then(setProducts).catch(e => setError(e instanceof ApiError ? e.message : "Products could not be loaded.")), 250);
    return () => window.clearTimeout(timer);
  }, [open, productSearch, token]);

  const selectedLines = useMemo(() => Object.entries(selected).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ product: products.find(item => item.id === id), quantity })).filter((line): line is { product: RiderOrderProduct; quantity: number } => Boolean(line.product)), [products, selected]);
  const estimatedTotal = selectedLines.reduce((sum, line) => sum + line.product.sellingPrice * line.quantity, 0);
  const toggleProduct = (product: RiderOrderProduct) => setSelected(current => product.id in current ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== product.id)) : { ...current, [product.id]: 1 });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer || !addressId || !selectedLines.length) { setError("Select a customer, delivery address, and at least one medicine."); return; }
    setBusy(true); setError("");
    try {
      const result = await createRiderOrder({ customerId: customer.id, addressId, items: selectedLines.map(line => ({ productId: line.product.id, quantity: line.quantity })), paymentMethod, notes: notes.trim() || undefined, orderMode }, token);
      toast.success(`Order ${result.orderNumber} created successfully.`);
      setOpen(false); setCustomer(null); setAddressId(""); setSelected({}); setNotes(""); setCustomerSearch(""); setProductSearch(""); onCreated();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The order could not be saved. Please retry."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-teal-700 text-white"><ShoppingBasket size={19} /></span><div><h2 className="font-extrabold text-slate-900">Create an order for a customer</h2><p className="mt-1 text-xs text-slate-600">Choose the customer, their saved delivery address, and in-stock medicines from your branch.</p></div></div><button type="button" onClick={() => { setOpen(value => !value); setError(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800">{open ? <X size={16} /> : <Plus size={16} />}{open ? "Close" : "New order"}</button></div>
    {open && <form onSubmit={submit} className="mt-5 grid gap-5 border-t border-teal-100 pt-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2"><label className="text-sm font-bold text-slate-700" htmlFor="rider-customer-search">Customer or pharmacy</label><div className="flex items-center rounded-xl border border-slate-200 bg-white px-3"><Search size={16} className="shrink-0 text-slate-400" /><input id="rider-customer-search" value={customerSearch} onChange={event => { setCustomerSearch(event.target.value); setCustomer(null); setAddressId(""); }} placeholder="Search name, phone, or email" className="min-h-11 w-full bg-transparent px-2 text-sm outline-none" /></div>{customer ? <div className="rounded-xl border border-teal-200 bg-white p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-bold">{customer.name} <span className="ml-1 rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-800">{customer.accountType}</span></p><p className="mt-1 text-xs text-slate-500">{customer.phone} · {customer.email}</p></div><button type="button" aria-label="Clear selected customer" onClick={() => { setCustomer(null); setAddressId(""); }}><X size={16} /></button></div></div> : <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white">{customers.map(item => <button key={item.id} type="button" onClick={() => { setCustomer(item); setAddressId(item.addresses[0]?.id ?? ""); }} className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-teal-50"><span><span className="block font-bold">{item.name}</span><span className="text-xs text-slate-500">{item.phone} · {item.accountType}</span></span><ChevronDown size={15} className="-rotate-90 text-slate-400" /></button>)}{!customers.length && <p className="p-3 text-xs text-slate-500">Enter a name or phone to search customers.</p>}</div>}</div>
        <div className="grid gap-2"><label className="text-sm font-bold text-slate-700" htmlFor="rider-address">Delivery address</label><select id="rider-address" value={addressId} onChange={event => setAddressId(event.target.value)} disabled={!customer} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"><option value="">Select saved address</option>{customer?.addresses.map(address => <option key={address.id} value={address.id}>{address.label} — {address.streetTole}, {address.municipality}, {address.district}</option>)}</select>{customer && !customer.addresses.length && <p role="alert" className="text-xs font-semibold text-rose-700">This customer has no saved address. Add an address to their profile before creating the order.</p>}
          <label className="mt-1 text-sm font-bold text-slate-700" htmlFor="rider-payment-method">Payment method</label><select id="rider-payment-method" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} disabled={!enabledPaymentMethods.length} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"><option value="">Choose payment method</option>{enabledPaymentMethods.map(method => <option key={method.code} value={method.code}>{method.displayName}</option>)}</select>{!enabledPaymentMethods.length && <p role="alert" className="text-xs font-semibold text-rose-700">No payment method is currently enabled by Superadmin.</p>}</div>
      </div>
      <div className="grid gap-2"><label className="text-sm font-bold text-slate-700" htmlFor="rider-order-mode">Order mode</label><select id="rider-order-mode" value={orderMode} onChange={event => { const next = event.target.value as "SINGLE" | "BULK"; setOrderMode(next); if (next === "SINGLE" && Object.keys(selected).length > 1) setSelected(current => Object.fromEntries(Object.entries(current).slice(0, 1))); }} disabled={!orderSettings || orderSettings.mode !== "BULK_AND_SINGLE"} className="min-h-11 max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100">{orderSettings?.mode !== "BULK_ONLY" && <option value="SINGLE">Single order</option>}{orderSettings?.mode !== "SINGLE_ONLY" && <option value="BULK">Bulk order · minimum {orderSettings?.minimumBulkQuantity ?? "…"}</option>}</select></div>
      <div className="grid gap-2"><label className="text-sm font-bold text-slate-700" htmlFor="rider-product-search">Medicines available at this branch</label><div className="flex items-center rounded-xl border border-slate-200 bg-white px-3"><Search size={16} className="shrink-0 text-slate-400" /><input id="rider-product-search" value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search medicine name or SKU" className="min-h-11 w-full bg-transparent px-2 text-sm outline-none" /></div><div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{products.map(product => { const allowed = orderMode === "BULK" ? product.allowBulk : product.allowSingle; const minQuantity = orderMode === "BULK" ? Math.max(orderSettings?.minimumBulkQuantity ?? 1, product.minimumQuantity) : product.minimumQuantity; return <div key={product.id} className={`rounded-xl border bg-white p-3 ${product.id in selected ? "border-teal-400 ring-1 ring-teal-100" : "border-slate-200"}`}><div className="flex items-start gap-2"><button type="button" disabled={!allowed || orderMode === "SINGLE" && Object.keys(selected).some(id => id !== product.id)} onClick={() => toggleProduct(product)} aria-label={`${product.id in selected ? "Remove" : "Add"} ${product.name}`} className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border disabled:cursor-not-allowed disabled:opacity-40 ${product.id in selected ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 text-transparent"}`}><Check size={13} /></button><div className="min-w-0 flex-1"><p className="text-sm font-bold">{product.name}</p><p className="mt-1 text-xs text-slate-500">SKU {product.sku} · {product.availableQuantity} {product.unit} available</p><p className="mt-1 text-xs font-semibold text-slate-700">NPR {product.sellingPrice.toLocaleString("en-NP", { minimumFractionDigits: 2 })} / {product.unit}</p>{!allowed && <p className="mt-1 text-xs font-semibold text-amber-700">Not available in this order mode.</p>}{product.id in selected && <label className="mt-2 flex items-center gap-2 text-xs font-semibold">Quantity <input type="number" min={minQuantity} max={product.availableQuantity} value={selected[product.id]} onChange={event => setSelected(current => ({ ...current, [product.id]: Math.min(product.availableQuantity, Math.max(minQuantity, Number(event.target.value) || minQuantity)) }))} className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm" /><span className="text-slate-500">Min {minQuantity}</span></label>}</div></div></div>; })}{!products.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500 sm:col-span-2">No matching in-stock medicines found at your branch.</p>}</div></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div className="grid gap-2"><label className="text-sm font-bold text-slate-700" htmlFor="rider-order-notes">Delivery / order notes</label><textarea id="rider-order-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} rows={2} placeholder="Optional instructions for the customer and pharmacy" className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" /></div><div className="min-w-44 rounded-xl bg-white px-4 py-3 text-right"><p className="text-xs font-semibold text-slate-500">Estimated order total</p><p className="mt-1 text-lg font-extrabold text-slate-900">NPR {estimatedTotal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-slate-500">Final total is recalculated by the server.</p></div></div>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">Cancel</button><button type="submit" disabled={busy || !customer || !addressId || !selectedLines.length || !paymentMethod} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}Save order</button></div>
    </form>}
  </section>;
}
