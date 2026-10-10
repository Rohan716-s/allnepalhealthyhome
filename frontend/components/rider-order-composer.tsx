"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Minus, Plus, Search, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { ApiError, createRiderOrder, getRiderOrderCustomers, getRiderOrderProducts, getRiderOrderSettings, previewRiderOrder, type RiderOrderCustomer, type RiderOrderProduct, type RiderOrderSettings, type RiderOrderInput, type RiderOrderPreview } from "@/services/api";
import { useSiteConfig } from "@/components/site-config-provider";

type Line = { product: RiderOrderProduct; quantity: number };
const money = (value: number) => `Rs. ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RiderOrderComposer({ token }: { token: string }) {
  const { paymentMethods } = useSiteConfig();
  const [open, setOpen] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<RiderOrderCustomer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customer, setCustomer] = useState<RiderOrderCustomer | null>(null);
  const [addressId, setAddressId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<RiderOrderProduct[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [settings, setSettings] = useState<RiderOrderSettings | null>(null);
  const settingsLoaded = useRef(false);
  const [orderMode, setOrderMode] = useState<"SINGLE" | "BULK">("SINGLE");
  const [lines, setLines] = useState<Line[]>([]);
  const methods = useMemo(() => paymentMethods.filter(method => method.enabled).sort((a, b) => a.displayOrder - b.displayOrder), [paymentMethods]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const method = methods.some(item => item.code === paymentMethod) ? paymentMethod : methods[0]?.code ?? "";
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const pending = useRef<RiderOrderInput | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [preview, setPreview] = useState<RiderOrderPreview | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; orderNumber: string } | null>(null);
  const address = customer?.addresses.find(item => item.id === addressId);
  const locked = busy || uncertain;
  const minimum = (product: RiderOrderProduct) => orderMode === "BULK" ? Math.max(settings?.minimumBulkQuantity ?? 1, product.minimumQuantity) : product.minimumQuantity;
  const editable = () => { setPreview(null); setError(""); };

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    getRiderOrderSettings(token).then(value => {
      if (cancelled) return;
      setSettings(value);
      if (!settingsLoaded.current) setOrderMode(value.mode === "SINGLE_ONLY" ? "SINGLE" : "BULK");
      settingsLoaded.current = true;
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Ordering rules could not be loaded."); });
    return () => { cancelled = true; };
  }, [open, token]);
  useEffect(() => {
    if (!open || !token || customer) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCustomerLoading(true);
      try { const value = await getRiderOrderCustomers(customerSearch.trim(), token); if (!cancelled) setCustomers(value.items); }
      catch (reason) { if (!cancelled) { setCustomers([]); setError(reason instanceof Error ? reason.message : "Customers could not be loaded."); } }
      finally { if (!cancelled) setCustomerLoading(false); }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, customerSearch, customer, token]);
  useEffect(() => {
    if (!open || !token || !customer || preview) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setProductLoading(true);
      try { const value = await getRiderOrderProducts(productSearch.trim(), token); if (!cancelled) setProducts(value); }
      catch (reason) { if (!cancelled) { setProducts([]); setError(reason instanceof Error ? reason.message : "Products could not be loaded."); } }
      finally { if (!cancelled) setProductLoading(false); }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, productSearch, customer, preview, token]);

  function changeCustomer() {
    if (locked || lines.length && !window.confirm("Changing the customer will clear the current order items. Continue?")) return;
    editable(); setCustomer(null); setAddressId(""); setLines([]); setProducts([]); setProductSearch(""); setCustomerSearch(""); setNotes("");
  }
  function selectProduct(product: RiderOrderProduct) {
    if (!customer || locked) return;
    const min = minimum(product);
    if (product.availableQuantity < 1) { setError("This product is currently out of stock."); return; }
    if (orderMode === "SINGLE" && lines.some(line => line.product.id !== product.id)) { setError("Single ordering accepts one product. Choose bulk ordering to add more products."); return; }
    const line = lines.find(item => item.product.id === product.id);
    const quantity = line ? line.quantity + 1 : min;
    if (quantity > product.availableQuantity) { setError(`Only ${product.availableQuantity} units are available.`); return; }
    if (quantity > 999) { setError("The maximum quantity is 999."); return; }
    editable();
    setLines(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) return current.map(item => item.product.id === product.id ? { product, quantity: Math.min(product.availableQuantity, 999, existing.quantity + 1) } : item);
      if (orderMode === "SINGLE" && current.length) return current;
      return [...current, { product, quantity: min }];
    });
  }
  function quantity(product: RiderOrderProduct, value: number) {
    if (value > product.availableQuantity) { setError(`Only ${product.availableQuantity} units are available.`); return; }
    if (!Number.isInteger(value) || value < minimum(product) || value > 999) { setError(`Quantity must be ${minimum(product)}-${Math.min(999, product.availableQuantity)}.`); return; }
    editable(); setLines(current => current.map(line => line.product.id === product.id ? { ...line, quantity: value } : line));
  }
  function input(): RiderOrderInput {
    return { customerId: customer!.id, addressId, items: lines.map(line => ({ productId: line.product.id, quantity: line.quantity })), paymentMethod: method, notes: notes.trim() || undefined, orderMode };
  }
  async function review() {
    if (submitting.current) return;
    if (!customer) { setError("Please select a customer first."); return; }
    if (!lines.length) { setError("Add at least one product to continue."); return; }
    if (!addressId || !method || !settings) { setError("Choose a saved address and an available payment method."); return; }
    submitting.current = true; setBusy(true); setError("");
    try { setPreview(await previewRiderOrder(input(), token)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The order could not be reviewed."); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function confirm() {
    if (submitting.current || !preview) return;
    submitting.current = true; setBusy(true); setError("");
    pending.current ??= { ...input(), requestId: crypto.randomUUID(), expectedTotal: preview.total };
    try {
      const result = await createRiderOrder(pending.current, token);
      pending.current = null; setUncertain(false); setSuccess(result); setPreview(null); setCustomer(null); setAddressId(""); setLines([]); setNotes(""); setCustomerSearch(""); setProductSearch(""); setOpen(false);
      toast.success(`Order ${result.orderNumber} created successfully.`);
    } catch (reason) {
      const knownRejected = reason instanceof ApiError && reason.status >= 400 && reason.status < 500;
      if (knownRejected) { pending.current = null; setPreview(null); }
      setUncertain(!knownRejected);
      setError(reason instanceof Error ? reason.message : "Confirmation could not be checked. Retry confirmation safely.");
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section aria-label="Take Order" className="rounded-2xl border border-teal-200 bg-white p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-extrabold"><ShoppingBasket size={19} />Take Order</h2><button type="button" disabled={locked} className="soft-btn min-h-11" onClick={() => { if (!open) setSuccess(null); setOpen(value => !value); setError(""); }}>{open ? "Close" : "Take Order"}</button></div>
    {success && <div role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm"><p className="font-bold">Order {success.orderNumber} created successfully.</p><Link className="break-all text-teal-800 underline" href={`/delivery/orders/${success.id}`}>View order {success.id}</Link></div>}
    {open && <form onSubmit={event => { event.preventDefault(); void (preview ? confirm() : review()); }} className="mt-4 grid gap-4">
      {!customer ? <div className="grid gap-2"><label htmlFor="rider-customer-search" className="text-sm font-bold">Search Customer</label><div className="flex items-center rounded-xl border px-3"><Search size={16} /><input id="rider-customer-search" autoComplete="off" value={customerSearch} onChange={event => { setCustomerSearch(event.target.value); setCustomers([]); setError(""); }} placeholder="Name, phone or email" className="min-h-11 min-w-0 w-full px-2 text-sm outline-none" /></div><div aria-live="polite" className="max-h-56 overflow-y-auto rounded-xl border">{customerLoading ? <p className="p-3 text-sm">Searching customers...</p> : customers.map(item => <button key={item.id} type="button" className="flex min-h-14 w-full flex-col border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-teal-50" onClick={() => { editable(); setCustomer(item); setAddressId(item.addresses[0]?.id ?? ""); }}><strong>{item.name}</strong><span>{item.phone}</span><span className="text-xs text-slate-500">{item.addresses[0]?.municipality}{item.addresses[0]?.district ? `, ${item.addresses[0].district}` : ""}</span></button>)}{!customerLoading && !customers.length && <p className="p-3 text-sm text-slate-500">{customerSearch.trim() ? "No customer found." : "Search by name, phone or email."}</p>}</div></div> : <section aria-label="Selected Customer" className="grid gap-2 rounded-xl bg-teal-50 p-3 text-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{customer.name}</h3><a href={`tel:${customer.phone}`} className="block text-base font-bold text-teal-800">{customer.phone}</a>{customer.email && <p className="break-all text-slate-600">{customer.email}</p>}</div><button type="button" disabled={locked} onClick={changeCustomer} className="min-h-11 shrink-0 text-xs font-bold text-teal-800 underline">Change Customer</button></div>{address && <><p>{[address.streetTole, address.municipality, address.district, address.province, address.ward && `Ward ${address.ward}`].filter(Boolean).join(", ")}</p>{address.landmark && <p>{address.landmark}</p>}{address.latitude != null && address.longitude != null && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`} className="text-teal-800 underline">View customer location</a>}</>}<label htmlFor="rider-address" className="font-semibold">Delivery address</label><select id="rider-address" value={addressId} disabled={locked || !!preview} onChange={event => { editable(); setAddressId(event.target.value); }} className="field min-w-0 w-full"><option value="">Select saved address</option>{customer.addresses.map(item => <option key={item.id} value={item.id}>{item.label} - {item.streetTole}, {item.municipality}</option>)}</select>{!customer.addresses.length && <p role="alert" className="text-rose-700">This customer has no saved delivery address.</p>}</section>}
      {!customer && <p className="text-sm text-slate-500">Please select a customer first.</p>}
      {customer && !preview && <>
        {settings?.mode === "BULK_AND_SINGLE" && <label className="grid gap-1 text-sm font-semibold">Order mode<select value={orderMode} disabled={locked} onChange={event => { const next = event.target.value as "SINGLE" | "BULK"; if (lines.length && !window.confirm("Changing order mode will clear the current order items. Continue?")) return; editable(); setLines([]); setOrderMode(next); }} className="field"><option value="BULK">Bulk / multiple products</option><option value="SINGLE">Single product</option></select></label>}
        <div className="grid gap-2"><label htmlFor="rider-product-search" className="text-sm font-bold">Search Product / Medicine</label><input id="rider-product-search" disabled={locked || !settings} value={productSearch} onChange={event => { setProductSearch(event.target.value); setProducts([]); setError(""); }} placeholder="Name, brand, SKU or barcode" className="field" /><div aria-live="polite" className="max-h-64 overflow-y-auto rounded-xl border">{productLoading ? <p className="p-3 text-sm">Searching products...</p> : products.map(product => { const allowed = !product.prescriptionRequired && (orderMode === "BULK" ? product.allowBulk : product.allowSingle); return <div key={product.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-0"><div className="min-w-0 text-sm"><p className="font-bold">{product.name}</p><p className="break-all text-xs text-slate-500">{product.brand ? `${product.brand} / ` : ""}{product.sku}</p><p>Available: {product.availableQuantity} {product.unit}</p><p className="font-semibold">{money(product.sellingPrice)}</p>{product.prescriptionRequired ? <p className="text-xs text-amber-700">Requires a pharmacist-reviewed prescription.</p> : !allowed ? <p className="text-xs text-amber-700">Unavailable in this order mode.</p> : product.availableQuantity === 0 ? <p className="text-xs text-rose-700">This product is currently out of stock.</p> : minimum(product) > 1 && <p className="text-xs text-slate-500">Minimum quantity: {minimum(product)}</p>}</div><button type="button" aria-label={`Select ${product.name}`} disabled={locked || !allowed || product.availableQuantity < minimum(product)} onClick={() => selectProduct(product)} className="min-h-11 shrink-0 rounded-xl bg-teal-700 px-3 text-sm font-bold text-white disabled:opacity-40">Select</button></div>; })}{!productLoading && !products.length && <p className="p-3 text-sm text-slate-500">No product found.</p>}</div></div>
        <section aria-label="Order Items" className="grid gap-3"><h3 className="text-sm font-bold">Order Items</h3>{!lines.length && <p className="text-sm text-slate-500">Add at least one product to continue.</p>}{lines.map(line => <div key={line.product.id} className="grid gap-2 rounded-xl border p-3 text-sm"><div className="flex items-start justify-between gap-2"><strong>{line.product.name}</strong><button type="button" aria-label={`Remove ${line.product.name}`} disabled={locked} className="min-h-11 text-xs text-rose-700 underline" onClick={() => { editable(); setLines(current => current.filter(item => item.product.id !== line.product.id)); }}>Remove</button></div><div className="flex items-center gap-2"><button type="button" aria-label={`Decrease ${line.product.name}`} disabled={locked || line.quantity <= minimum(line.product)} onClick={() => quantity(line.product, line.quantity - 1)} className="soft-btn min-h-11"><Minus size={15} /></button><input aria-label={`Quantity for ${line.product.name}`} type="number" min={minimum(line.product)} max={Math.min(999, line.product.availableQuantity)} step="1" disabled={locked} value={line.quantity} onChange={event => quantity(line.product, Number(event.target.value))} className="field w-20 text-center" /><button type="button" aria-label={`Increase ${line.product.name}`} disabled={locked || line.quantity >= Math.min(999, line.product.availableQuantity)} onClick={() => quantity(line.product, line.quantity + 1)} className="soft-btn min-h-11"><Plus size={15} /></button></div><p>{money(line.product.sellingPrice)} x {line.quantity} = <strong>{money(line.product.sellingPrice * line.quantity)}</strong></p></div>)}</section>
        <label className="grid gap-1 text-sm font-semibold">Payment method<select value={method} disabled={locked || !methods.length} onChange={event => { editable(); setPaymentMethod(event.target.value); }} className="field"><option value="">Choose payment method</option>{methods.map(item => <option key={item.code} value={item.code}>{item.displayName}</option>)}</select>{!methods.length && <span className="text-xs text-rose-700">No payment method is available.</span>}</label><label className="grid gap-1 text-sm font-semibold">Delivery notes (optional)<textarea value={notes} maxLength={1000} rows={2} disabled={locked} onChange={event => { editable(); setNotes(event.target.value); }} className="field" /></label>
        <p className="text-right text-sm font-bold">Subtotal: {money(lines.reduce((sum, line) => sum + line.product.sellingPrice * line.quantity, 0))}</p>
      </>}
      {preview && <section aria-label="Review Order" className="grid gap-3 rounded-xl border p-3 text-sm"><h3 className="font-bold">Review Order</h3>{preview.items.map(item => <div key={item.productId} className="flex justify-between gap-3"><span>{item.name} x {item.quantity}</span><strong className="shrink-0">{money(item.lineTotal)}</strong></div>)}<div className="grid gap-1 border-t pt-3"><p className="flex justify-between"><span>Subtotal</span><span>{money(preview.subtotal)}</span></p><p className="flex justify-between"><span>Delivery</span><span>{money(preview.deliveryFee)}</span></p><p className="flex justify-between font-bold"><span>Total</span><span>{money(preview.total)}</span></p></div><p>Payment: {methods.find(item => item.code === method)?.displayName ?? method}</p>{notes && <p className="whitespace-pre-wrap break-words">{notes}</p>}<button type="button" disabled={locked} onClick={() => setPreview(null)} className="min-h-11 text-teal-800 underline">Edit Order</button></section>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {uncertain && <p role="status" className="text-sm">Confirmation could not be verified. Retry the same confirmation to check its result safely.</p>}
      <button type="submit" disabled={busy || !customer || !addressId || !lines.length || !method || !settings} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 font-bold text-white disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin" />}{preview ? uncertain ? "Retry Confirmation" : "Confirm Order" : "Review Order"}</button>
    </form>}
  </section>;
}
