"use client";

/* eslint-disable react-hooks/set-state-in-effect -- restore saved order configuration after protected page data loads. */
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Loader2, PackageSearch, Save, Search, Settings2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_ORDERING_SETTINGS,
  getProductOrderingRule,
  normalizeProductKey,
  ORDERING_SETTING_KEY,
  parseOrderingSettings,
  type OrderingCopy,
  type OrderingLocale,
  type OrderingSettings,
  type ProductOrderingRule,
} from "@/lib/ordering";
import {
  getAdminProducts,
  getAdminSettings,
  saveAdminSetting,
  type AdminProduct,
} from "@/services/api";

const copyFields: { key: keyof OrderingCopy; label: string; long?: boolean }[] = [
  { key: "pageTitle", label: "Checkout page title" },
  { key: "pageDescription", label: "Checkout description", long: true },
  { key: "chooseMode", label: "Choose order type" },
  { key: "singleMode", label: "Single order label" },
  { key: "singleModeDescription", label: "Single order description", long: true },
  { key: "bulkMode", label: "Bulk order label" },
  { key: "bulkModeDescription", label: "Bulk order description", long: true },
  { key: "product", label: "Product label" },
  { key: "quantity", label: "Quantity label" },
  { key: "minimumQuantity", label: "Minimum quantity label" },
  { key: "customerName", label: "Customer name label" },
  { key: "phone", label: "Phone label" },
  { key: "email", label: "Email label" },
  { key: "province", label: "Province label" },
  { key: "district", label: "District label" },
  { key: "municipality", label: "Municipality label" },
  { key: "ward", label: "Ward label" },
  { key: "address", label: "Address label" },
  { key: "landmark", label: "Landmark label" },
  { key: "deliveryInstructions", label: "Delivery details label" },
  { key: "deliverySlot", label: "Delivery time label" },
  { key: "branch", label: "Branch label" },
  { key: "paymentOption", label: "Payment option label" },
  { key: "notes", label: "Notes label" },
  { key: "placeOrder", label: "Order button label" },
  { key: "orderSummary", label: "Order summary label" },
  { key: "subtotal", label: "Subtotal label" },
  { key: "deliveryFee", label: "Delivery fee label" },
  { key: "total", label: "Total label" },
  { key: "addToCart", label: "Add-to-cart button label" },
  { key: "orderInstructions", label: "Order instructions", long: true },
  { key: "bulkUnavailableTitle", label: "Bulk unavailable dialog title" },
  { key: "bulkUnavailableMessage", label: "Bulk unavailable message", long: true },
  { key: "singleUnavailableMessage", label: "Single unavailable message", long: true },
  { key: "minimumQuantityMessage", label: "Minimum quantity message ({product}, {minimum})", long: true },
  { key: "singleProductLimitMessage", label: "Single-product limit message", long: true },
  { key: "requiredFieldsMessage", label: "Required fields validation", long: true },
  { key: "invalidEmailMessage", label: "Invalid email validation" },
  { key: "successTitle", label: "Order confirmation title" },
  { key: "successMessage", label: "Order confirmation message ({orderNumber})", long: true },
  { key: "emptyCart", label: "Empty cart message", long: true },
  { key: "outOfStock", label: "Out-of-stock label" },
  { key: "dialogOkay", label: "Dialog button label" },
];

type CopyLocale = OrderingLocale;
const initialSettings = parseOrderingSettings(JSON.stringify(DEFAULT_ORDERING_SETTINGS));

function staffToken() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
}

export default function OrderingSettingsPage() {
  const [ordering, setOrdering] = useState<OrderingSettings>(initialSettings);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const token = staffToken();
    if (!token) {
      setError("Please sign in as a Superadmin to manage ordering.");
      setLoading(false);
      return;
    }
    Promise.all([getAdminSettings(token), getAdminProducts(token, { page: 1, pageSize: 250 }, true)])
      .then(async ([settings, firstPage]) => {
        const allProducts = [...firstPage.items];
        for (let nextPage = 2; nextPage <= firstPage.totalPages; nextPage += 1) {
          const result = await getAdminProducts(token, { page: nextPage, pageSize: 250 }, true);
          allProducts.push(...result.items);
        }
        if (!active) return;
        const stored = settings.find((item) => item.key === ORDERING_SETTING_KEY)?.value;
        if (stored) setOrdering(parseOrderingSettings(stored));
        setProducts(allProducts);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Ordering settings could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => !term || [product.name, product.sku, product.brand, product.category].some((value) => value.toLowerCase().includes(term)));
  }, [products, query]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  function updateCopy(locale: CopyLocale, key: keyof OrderingCopy, value: string) {
    setOrdering((current) => ({ ...current, localized: { ...current.localized, [locale]: { ...current.localized[locale], [key]: value } } }));
    setSaved(false);
  }

  function updateProduct(product: AdminProduct, patch: Partial<ProductOrderingRule>) {
    const key = normalizeProductKey(product.sku || product.slug);
    const currentRule = getProductOrderingRule(ordering, product.sku, product.slug);
    setOrdering((current) => ({
      ...current,
      products: { ...current.products, [key]: { ...currentRule, ...patch } },
    }));
    setSaved(false);
  }

  function updateProductText(product: AdminProduct, locale: CopyLocale, key: "name" | "description" | "instructions" | "buttonLabel", value: string) {
    const rule = getProductOrderingRule(ordering, product.sku, product.slug);
    updateProduct(product, { localized: { ...rule.localized, [locale]: { ...rule.localized[locale], [key]: value } } });
  }

  async function save() {
    const token = staffToken();
    if (!token) { setError("Your Superadmin session has expired. Please sign in again."); return; }
    setSaving(true);
    setError("");
    try {
      await saveAdminSetting(ORDERING_SETTING_KEY, {
        value: JSON.stringify(ordering),
        group: "orders",
        isPublic: true,
        description: "Superadmin-controlled order modes, minimum quantities, product eligibility, and English/Nepali storefront copy.",
      }, token);
      setSaved(true);
      window.dispatchEvent(new Event("anhh:site-config-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ordering settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell superAdmin>
      <div className="mx-auto w-full max-w-7xl space-y-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-blue-800"><Settings2 size={15} /> Storefront controls</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Ordering system</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Control order modes, minimum quantities, product availability, and the English/Nepali customer experience. Changes are saved to the database and applied to the storefront.</p>
          </div>
          <Button onClick={() => void save()} disabled={saving || loading} className="shrink-0">
            {saving ? <Loader2 className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : saved ? "Saved" : "Save all changes"}
          </Button>
        </div>

        {error && <Alert className="border-rose-200 bg-rose-50 text-rose-800">{error}</Alert>}
        {saved && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">Ordering rules and language content are saved and live.</Alert>}

        <Card className="border-blue-100 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="text-blue-800" size={19} /> Order rules</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-slate-700">Order mode
              <select value={ordering.mode} onChange={(event) => { setOrdering((current) => ({ ...current, mode: event.target.value as OrderingSettings["mode"] })); setSaved(false); }} className="field h-11">
                <option value="BULK_ONLY">Bulk Only</option><option value="SINGLE_ONLY">Single Only</option><option value="BULK_AND_SINGLE">Bulk + Single</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Minimum bulk quantity
              <Input type="number" min={1} max={999} value={ordering.minimumBulkQuantity} onChange={(event) => { const minimumBulkQuantity = Math.min(999, Math.max(1, Number(event.target.value) || 1)); setOrdering((current) => ({ ...current, minimumBulkQuantity })); setSaved(false); }} />
            </label>
            <div className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Bulk quantity is validated for every product on the server. A product’s higher minimum always takes precedence.</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">English and Nepali ordering content</CardTitle>
            <p className="text-sm text-slate-500">Every field below is editable. The customer’s selected language controls the storefront labels, messages, validation, and confirmation.</p>
          </CardHeader>
          <CardContent className="space-y-7">
            <div className="hidden grid-cols-[minmax(180px,0.8fr)_1fr_1fr] gap-4 border-b pb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 md:grid"><span>Content</span><span>English</span><span>Nepali</span></div>
            {copyFields.map((field) => (
              <div key={field.key} className="grid gap-3 border-b border-slate-100 pb-4 last:border-0 md:grid-cols-[minmax(180px,0.8fr)_1fr_1fr] md:items-start">
                <Label className="pt-2 text-xs font-bold text-slate-600">{field.label}</Label>
                {(["en", "ne"] as const).map((locale) => {
                  const Field = field.long ? "textarea" : "input";
                  return <label key={locale} className="grid gap-1.5 text-[11px] font-semibold text-slate-400 md:text-transparent"><span className="md:hidden">{locale === "en" ? "English" : "नेपाली"}</span><Field value={ordering.localized[locale][field.key]} onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateCopy(locale, field.key, event.target.value)} rows={field.long ? 2 : undefined} className={field.long ? "field min-h-16 resize-y text-sm text-slate-800" : "field h-10 text-sm text-slate-800"} /></label>;
                })}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-4">
            <div><CardTitle className="flex items-center gap-2 text-lg"><PackageSearch size={19} className="text-blue-800" /> Product ordering rules</CardTitle><p className="mt-2 text-sm text-slate-500">Set per-product order eligibility, minimum quantity, and optional bilingual product names, descriptions, instructions, and button labels.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by product, SKU, brand…" className="pl-9" /></div>
              <p className="text-xs font-semibold text-slate-500">{filteredProducts.length} products · Page {page} of {pageCount}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} />Loading saved rules and product catalog…</div> : visibleProducts.length ? visibleProducts.map((product) => {
              const rule = getProductOrderingRule(ordering, product.sku, product.slug);
              const key = normalizeProductKey(product.sku || product.slug);
              const isExpanded = expanded === key;
              return <section key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(200px,1fr)_auto_auto_150px] lg:items-center">
                  <div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-slate-900">{product.name}</h3><p className="mt-1 text-xs text-slate-500">SKU {product.sku} · {product.brand} · Stock {product.stock}</p></div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={rule.allowSingle} onChange={(event) => updateProduct(product, { allowSingle: event.target.checked })} className="size-4 accent-blue-700" />Single ordering</label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={rule.allowBulk} onChange={(event) => updateProduct(product, { allowBulk: event.target.checked })} className="size-4 accent-blue-700" />Bulk ordering</label>
                  <label className="grid gap-1 text-[11px] font-bold text-slate-500">Minimum quantity<Input type="number" min={1} max={999} value={rule.minimumQuantity} onChange={(event) => updateProduct(product, { minimumQuantity: Math.min(999, Math.max(1, Number(event.target.value) || 1)) })} className="h-9" /></label>
                </div>
                <button type="button" onClick={() => setExpanded(isExpanded ? "" : key)} className="mt-4 text-xs font-bold text-blue-800 hover:underline">{isExpanded ? "Hide bilingual product content" : "Edit bilingual product content"}</button>
                {isExpanded && <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-2">
                  {(["en", "ne"] as const).map((locale) => <div key={locale} className="space-y-3 rounded-xl bg-slate-50 p-4">
                    <h4 className="text-sm font-extrabold text-slate-800">{locale === "en" ? "English" : "नेपाली"}</h4>
                    <label className="grid gap-1 text-xs font-bold text-slate-600">Product name<Input value={rule.localized[locale].name} onChange={(event) => updateProductText(product, locale, "name", event.target.value)} /></label>
                    <label className="grid gap-1 text-xs font-bold text-slate-600">Description<textarea rows={2} value={rule.localized[locale].description} onChange={(event) => updateProductText(product, locale, "description", event.target.value)} className="field resize-y" /></label>
                    <label className="grid gap-1 text-xs font-bold text-slate-600">Order instructions<textarea rows={2} value={rule.localized[locale].instructions} onChange={(event) => updateProductText(product, locale, "instructions", event.target.value)} className="field resize-y" /></label>
                    <label className="grid gap-1 text-xs font-bold text-slate-600">Product button label<Input value={rule.localized[locale].buttonLabel} onChange={(event) => updateProductText(product, locale, "buttonLabel", event.target.value)} /></label>
                  </div>)}
                </div>}
              </section>;
            }) : <div className="rounded-xl bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">{loading ? "Loading products…" : "No products match your search."}</div>}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span className="text-xs font-semibold text-slate-500">{page} / {pageCount}</span><Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
