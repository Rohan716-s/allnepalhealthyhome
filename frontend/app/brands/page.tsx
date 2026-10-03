"use client";

import Link from "next/link";
import { Loader2, RefreshCw, Search, Tags } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCatalogBrands, type CatalogBrand } from "@/services/api";
import { Button } from "@/components/ui/button";

export default function BrandsPage() {
  const [rows, setRows] = useState<CatalogBrand[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => { setLoading(true); setError(""); getCatalogBrands().then(setRows).catch(reason => setError(reason instanceof Error ? reason.message : "Brands could not be loaded.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, [load]);
  const shown = useMemo(() => rows.filter(brand => brand.name.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  return <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Trusted names</p><h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950">Shop by brand</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Browse the brands currently available in the pharmacy catalog.</p><div className="mt-8 flex max-w-md items-center rounded-xl border border-slate-200 bg-white px-3"><Search size={17} className="text-slate-400" /><label htmlFor="brand-search" className="sr-only">Search brands</label><input id="brand-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search brands" className="w-full bg-transparent px-3 py-3 text-sm outline-none" /></div>{loading && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-700" aria-label="Loading brands" /></div>}{error && <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}<Button variant="outline" size="sm" className="ml-3" onClick={load}><RefreshCw size={14} /> Retry</Button></div>}{!loading && !error && !shown.length && <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center"><Tags className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-extrabold">No brands match this search.</p></div>}{!loading && !error && shown.length > 0 && <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{shown.map(brand => <Link href={`/products?brand=${encodeURIComponent(brand.name)}`} key={brand.id} className="surface group p-5 hover:border-teal-200"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-teal-700"><Tags size={23} /></div><h2 className="mt-5 font-extrabold text-slate-900">{brand.name}</h2><p className="mt-1 text-xs text-slate-400">{brand.productCount} {brand.productCount === 1 ? "product" : "products"}</p><span className="mt-5 block text-xs font-bold text-teal-700">View products →</span></Link>)}</div>}</main><SiteFooter /></div>;
}
