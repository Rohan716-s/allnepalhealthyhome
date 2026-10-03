"use client";

/* eslint-disable react-hooks/set-state-in-effect -- keep the active carousel page valid as database results change. */

import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/catalog";

function pagesOf<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

export function HotHealthDealsCarousel({ products }: { products: Product[] }) {
  const pages = useMemo(() => pagesOf(products, 4), [products]);
  const [page, setPage] = useState(0);

  useEffect(() => setPage((current) => pages.length ? current % pages.length : 0), [pages.length]);
  useEffect(() => {
    if (pages.length < 2) return;
    const timer = window.setInterval(() => setPage((current) => (current + 1) % pages.length), 4500);
    return () => window.clearInterval(timer);
  }, [pages.length]);
  if (!products.length) return <section className="site-promo-section px-4 py-14 sm:px-6 lg:px-8" aria-label="Hot Health Deals"><div className="mx-auto max-w-7xl"><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--color-secondary)]"><Flame size={14} /> Pharmacy picks</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Hot Health Deals</h2><div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><p className="text-sm font-bold text-slate-700">No hot deals have been selected yet.</p><p className="mt-2 text-xs text-slate-500">Superadmin can enable “Hot health deal” while editing a product.</p></div></div></section>;

  return <section className="site-promo-section px-4 py-14 sm:px-6 lg:px-8" aria-label="Hot Health Deals">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--color-secondary)]"><Flame size={14} /> Pharmacy picks</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Hot Health Deals</h2></div>
        <div className="flex items-center gap-2"><Link href="/products" className="hidden text-sm font-bold text-[var(--color-primary)] sm:inline-flex">View all medicines</Link>{pages.length > 1 && <><button type="button" onClick={() => setPage((current) => (current - 1 + pages.length) % pages.length)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]" aria-label="Previous hot health deals"><ChevronLeft size={18} /></button><button type="button" onClick={() => setPage((current) => (current + 1) % pages.length)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]" aria-label="Next hot health deals"><ChevronRight size={18} /></button></>}</div>
      </div>
      <div className="overflow-hidden"><div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${page * 100}%)` }}>{pages.map((items, index) => <div key={index} className="grid min-w-full grid-cols-2 gap-4 md:grid-cols-4">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div>)}</div></div>
      {pages.length > 1 && <div className="mt-6 flex justify-center gap-2" aria-label="Hot Health Deals pages">{pages.map((_, index) => <button type="button" key={index} onClick={() => setPage(index)} className={`h-2 rounded-full transition-all ${index === page ? "w-7 bg-[var(--color-primary)]" : "w-2 bg-slate-300"}`} aria-label={`Show hot health deals page ${index + 1}`} aria-current={index === page ? "true" : undefined} />)}</div>}
    </div>
  </section>;
}
