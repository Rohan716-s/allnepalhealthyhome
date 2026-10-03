"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Pill, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCatalogCategories, type CatalogCategory } from "@/services/api";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/animated";

export default function CategoriesPage() {
  const [rows, setRows] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => { setLoading(true); setError(""); getCatalogCategories().then(setRows).catch(reason => setError(reason instanceof Error ? reason.message : "Categories could not be loaded.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, [load]);
  return <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><p className="animate-fade-up text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Browse the catalogue</p><h1 className="mt-2 animate-fade-up text-4xl font-extrabold tracking-tight text-slate-950 [animation-delay:100ms]">Shop by category</h1><p className="mt-3 max-w-xl animate-fade-up text-sm leading-6 text-slate-500 [animation-delay:180ms]">Find a simpler way to shop for your everyday health, wellness and home care essentials.</p>{loading && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-700" aria-label="Loading categories" /></div>}{error && <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}<Button variant="outline" size="sm" className="ml-3" onClick={load}><RefreshCw size={14} /> Retry</Button></div>}{!loading && !error && !rows.length && <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center"><Pill className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-extrabold">No categories are available.</p></div>}{!loading && !error && rows.length > 0 && <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map(category => <Link href={`/products?category=${encodeURIComponent(category.slug)}`} key={category.id} className="surface group flex min-h-48 flex-col justify-between p-6 transition hover:-translate-y-1 hover:border-teal-200"><div><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Pill size={25} /></span><h2 className="mt-6 text-lg font-extrabold text-slate-900">{category.name}</h2><p className="mt-1 text-xs text-slate-400"><AnimatedCounter value={category.productCount} /> {category.productCount === 1 ? "product" : "products"}</p>{category.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{category.description}</p>}</div><span className="mt-6 flex items-center gap-1 text-xs font-extrabold text-teal-700">Explore category <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span></Link>)}</div>}</main><SiteFooter /></div>;
}
