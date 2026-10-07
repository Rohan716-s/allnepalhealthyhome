"use client";

/* eslint-disable react-hooks/set-state-in-effect -- filter state mirrors URL and backend filter responses. */

import { ChevronDown, Filter, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { type Product } from "@/lib/catalog";
import { useI18n } from "@/components/site-config-provider";
import { getCatalogBrands, getCatalogCategories, getProducts, type CatalogBrand, type CatalogCategory, type Product as ApiProduct } from "@/services/api";

function filterKey(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function matchesCatalogFilter(value: string, selected: string, allLabel: string) { return selected === allLabel || value === selected || filterKey(value) === filterKey(selected); }
function fromApiProduct(product: ApiProduct): Product {
  const tone = product.category.toLowerCase().includes("medicine") ? "from-blue-100 to-blue-50" : product.category.toLowerCase().includes("vitamin") ? "from-amber-100 to-amber-50" : product.category.toLowerCase().includes("device") ? "from-teal-100 to-cyan-50" : "from-rose-100 to-rose-50";
  const salePrice = product.flashSalePrice ?? product.sellingPrice;
  const pricesVisible = product.pricesVisible !== false;
  return { id: product.slug, name: product.name, genericName: product.genericName, brand: product.brand, category: product.category, description: "Product details are maintained in the pharmacy catalog.", price: salePrice, mrp: pricesVisible ? (product.flashSalePrice ? product.sellingPrice : product.mrp > product.sellingPrice ? product.mrp : undefined) : undefined, stock: product.stockQuantity, unit: [product.strength, product.dosageForm].filter(Boolean).join(" · ") || "1 item", sku: product.sku, prescriptionRequired: product.prescriptionRequired, featured: product.isFeatured, demandScore: product.demandScore, pricesVisible, badge: pricesVisible && product.flashSalePrice ? `Flash sale · ${product.flashSaleDiscountPercent}% off` : undefined, wholesaleDiscountPercent: pricesVisible ? product.wholesaleDiscountPercent : undefined, bonusScheme: pricesVisible ? product.bonusScheme : undefined, imageUrl: product.imageUrl, imageUrls: product.imageUrls, visual: product.name.slice(0, 5).toUpperCase(), tone };
}

function ProductsPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("All categories"); const [brand, setBrand] = useState("All brands"); const [minPrice, setMinPrice] = useState(""); const [maxPrice, setMaxPrice] = useState(""); const [sort, setSort] = useState("demand"); const [offersOnly, setOffersOnly] = useState(false); const [mobileFilters, setMobileFilters] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]); const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]); const [catalogBrands, setCatalogBrands] = useState<CatalogBrand[]>([]); const [categoryBrands, setCategoryBrands] = useState<CatalogBrand[]>([]); const [brandLoading, setBrandLoading] = useState(false); const [catalogState, setCatalogState] = useState<"loading" | "connected" | "offline">("loading"); const [catalogTotal, setCatalogTotal] = useState(0); const [page, setPage] = useState(1); const pageSize = 100;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(searchKey);
    const initialSearch = params.get("search")?.trim() || "";
    const searchTerm = query.trim() || initialSearch;
    const initialCategory = params.get("category")?.trim() || "";
    const requestedCategory = category !== "All categories" ? category : initialCategory || undefined;
    const initialBrand = params.get("brand")?.trim() || "";
    const requestedBrand = brand !== "All brands" ? brand : initialBrand || undefined;
    let active = true;
    setCatalogState("loading");
    const timer = window.setTimeout(() => {
      Promise.allSettled([
        getProducts({ page, pageSize, sort: "popular", search: searchTerm || undefined, category: requestedCategory, brand: requestedBrand }, controller.signal),
        getCatalogCategories(controller.signal),
        getCatalogBrands(undefined, controller.signal),
      ]).then(([productsResult, categoriesResult, brandsResult]) => {
        if (!active) return;
        if (productsResult.status === "fulfilled") {
          setCatalogProducts(productsResult.value.items.map(fromApiProduct));
          setCatalogTotal(productsResult.value.totalItems);
          setCatalogState("connected");
        } else { setCatalogTotal(0); setCatalogState("offline"); }
        if (categoriesResult.status === "fulfilled") setCatalogCategories(categoriesResult.value);
        if (brandsResult.status === "fulfilled") setCatalogBrands(brandsResult.value);
      }).catch(() => { if (active) setCatalogState("offline"); });
    }, searchTerm ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [brand, category, page, query, searchKey]);
  useEffect(() => { const params = new URLSearchParams(searchKey); setQuery(params.get("search") ?? ""); setCategory(params.get("category") ?? "All categories"); setBrand(params.get("brand") ?? "All brands"); setOffersOnly(params.get("filter") === "offers"); }, [searchKey]);
  useEffect(() => { setPage(1); }, [brand, category, maxPrice, minPrice, offersOnly, query, searchKey]);

  const selectedCategory = useMemo(() => category === "All categories" ? undefined : catalogCategories.find((item) => matchesCatalogFilter(item.slug, category, "All categories") || matchesCatalogFilter(item.name, category, "All categories")), [catalogCategories, category]);
  useEffect(() => { if (selectedCategory && category !== selectedCategory.slug) setCategory(selectedCategory.slug); }, [category, selectedCategory]);
  useEffect(() => { const controller = new AbortController(); if (!selectedCategory) { setCategoryBrands([]); setBrandLoading(false); return () => controller.abort(); } setBrandLoading(true); getCatalogBrands(selectedCategory.id, controller.signal).then(setCategoryBrands).catch((error) => { if (error?.name !== "AbortError") setCategoryBrands([]); }).finally(() => setBrandLoading(false)); return () => controller.abort(); }, [selectedCategory]);
  const categoryOptions = useMemo(() => catalogCategories.length ? catalogCategories.map((item) => ({ value: item.slug, label: item.name })) : [...new Set(catalogProducts.map((product) => product.category))].sort().map((item) => ({ value: filterKey(item), label: item })), [catalogCategories, catalogProducts]);
  const brandOptions = useMemo(() => { const rows = selectedCategory && categoryBrands.length ? categoryBrands : catalogBrands; const availableNames = new Set(catalogProducts.filter((product) => !selectedCategory || matchesCatalogFilter(product.category, selectedCategory.slug, "All categories") || matchesCatalogFilter(product.category, selectedCategory.name, "All categories")).map((product) => filterKey(product.brand))); return rows.filter((item) => item.productCount > 0 && (!availableNames.size || availableNames.has(filterKey(item.name)))).map((item) => ({ value: item.slug, label: item.name })); }, [catalogBrands, catalogProducts, categoryBrands, selectedCategory]);
  useEffect(() => { if (brand !== "All brands" && brandOptions.length > 0 && !brandOptions.some((item) => matchesCatalogFilter(item.value, brand, "All brands") || matchesCatalogFilter(item.label, brand, "All brands"))) setBrand("All brands"); }, [brand, brandOptions]);

  const pricesVisible = catalogProducts.some((product) => product.pricesVisible !== false);
  const totalPages = Math.max(1, Math.ceil((catalogTotal || catalogProducts.length) / pageSize));
  const filteredProducts = useMemo(() => { const normalized = query.trim().toLowerCase(); const minimum = minPrice === "" ? undefined : Number(minPrice); const maximum = maxPrice === "" ? undefined : Number(maxPrice); const result = catalogProducts.filter((product) => { const searchable = [product.name, product.genericName, product.brand, product.category, product.sku]; return (!normalized || searchable.some((field) => field.toLowerCase().includes(normalized))) && matchesCatalogFilter(product.category, category, "All categories") && matchesCatalogFilter(product.brand, brand, "All brands") && (!pricesVisible || (minimum === undefined || Number.isNaN(minimum) || product.price >= minimum) && (maximum === undefined || Number.isNaN(maximum) || product.price <= maximum) && (!offersOnly || Boolean(product.mrp))); }); return [...result].sort((a, b) => sort === "demand" ? (b.demandScore ?? 0) - (a.demandScore ?? 0) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name) : pricesVisible && sort === "price-low" ? a.price - b.price : pricesVisible && sort === "price-high" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : Number(Boolean(b.featured)) - Number(Boolean(a.featured))); }, [catalogProducts, query, category, brand, minPrice, maxPrice, sort, offersOnly, pricesVisible]);
  function clearFilters() { setCategory("All categories"); setBrand("All brands"); setMinPrice(""); setMaxPrice(""); setOffersOnly(false); setQuery(""); }

  return (
    <div className="min-h-screen bg-[#f8fbfa]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] bg-teal-50 px-6 py-6 text-center sm:px-10 sm:py-7">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            {t("catalog.title")}
          </h1>
          {catalogState === "offline" && (
            <p role="status" className="mt-3 text-xs font-semibold text-amber-800">
              The pharmacy catalogue is temporarily unavailable. Please try again shortly.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 lg:hidden">
          <button className="soft-btn" onClick={() => setMobileFilters(!mobileFilters)}>
            <SlidersHorizontal size={18} /> {t("catalog.filter")}
          </button>
          <span className="text-xs font-semibold text-slate-500">{filteredProducts.length} products</span>
        </div>
        <div className="mt-5 grid gap-8 lg:grid-cols-[270px_1fr]">
          <aside className={`${mobileFilters ? "block" : "hidden"} surface h-fit p-6 lg:block`}>
            <div className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Filter size={18} className="text-teal-700" /> {t("catalog.filter")}
            </div>
            <label className="mt-6 block text-sm font-bold text-slate-600">
              {t("catalog.allCategories")}
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="field mt-2 h-12 text-sm">
                <option value="All categories">{t("catalog.allCategories")}</option>
                {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="mt-5 block text-sm font-bold text-slate-600">
              {t("catalog.allBrands")}
              <select value={brand} onChange={(event) => setBrand(event.target.value)} className="field mt-2 h-12 text-sm" disabled={brandLoading}>
                <option value="All brands">{brandLoading ? "Loading brands…" : t("catalog.allBrands")}</option>
                {brandOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              {selectedCategory && <span className="mt-2 block text-xs font-medium text-slate-400">Showing brands with active products in {selectedCategory.name}.</span>}
            </label>
            {pricesVisible && <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="block text-sm font-bold text-slate-600">
                Min price
                <input inputMode="decimal" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="field mt-2 h-12 text-sm" placeholder="NPR 0" />
              </label>
              <label className="block text-sm font-bold text-slate-600">
                Max price
                <input inputMode="decimal" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="field mt-2 h-12 text-sm" placeholder="No limit" />
              </label>
            </div>}
            {pricesVisible && <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-600">
              <input type="checkbox" checked={offersOnly} onChange={(event) => setOffersOnly(event.target.checked)} className="h-5 w-5 accent-teal-700" /> {t("catalog.onOffer")}
            </label>}
            <button onClick={clearFilters} className="mt-7 text-sm font-bold text-teal-700">{t("catalog.clearFilters")}</button>
          </aside>
          <section>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 sm:w-96">
                <Search size={19} className="text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("catalog.search")} className="w-full bg-transparent px-3 text-sm outline-none" />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-500">
                {t("catalog.sortBy")}
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none">
                  <option value="demand">Most in demand</option>
                  <option value="featured">{t("catalog.featured")}</option>
                  {pricesVisible && <><option value="price-low">{t("catalog.priceLow")}</option><option value="price-high">{t("catalog.priceHigh")}</option></>}
                  <option value="name">{t("catalog.name")}</option>
                </select>
                <ChevronDown size={16} className="-ml-8 pointer-events-none text-slate-400" />
              </label>
            </div>
            <p className="mb-5 text-sm font-semibold text-slate-400">
              {catalogState === "loading" ? "Loading products…" : t("catalog.showing", { shown: filteredProducts.length, total: catalogTotal || catalogProducts.length })}
            </p>
            {filteredProducts.length ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : catalogState === "loading" ? (
              <div role="status" className="surface px-6 py-20 text-center">
                <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-teal-100" />
                <span className="sr-only">Loading products…</span>
              </div>
            ) : (
              <div className="surface px-6 py-20 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <Search className="text-slate-400" />
                </div>
                <h2 className="mt-4 text-lg font-extrabold text-slate-900">{t("catalog.noProducts")}</h2>
                <p className="mt-2 text-sm text-slate-500">{t("catalog.noProductsDescription")}</p>
              </div>
            )}
            {catalogState === "connected" && totalPages > 1 && <nav aria-label="Product pages" className="mt-8 flex items-center justify-center gap-4">
              <button type="button" className="soft-btn disabled:cursor-not-allowed disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span className="text-sm font-bold text-slate-600">Page {page} of {totalPages}</span>
              <button type="button" className="soft-btn disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </nav>}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function ProductsPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#f8fbfa]" />}><ProductsPageContent /></Suspense>;
}
