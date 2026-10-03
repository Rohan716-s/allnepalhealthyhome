"use client";

import { Heart } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { useShop } from "@/components/shop-provider";
import { ButtonLink } from "@/components/ui/button-link";

export default function WishlistPage() { const { wishlist, catalogProducts } = useShop(); const items = catalogProducts.filter((product) => wishlist.includes(product.id)); return <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Saved for later</p><h1 className="mt-2 text-4xl font-extrabold tracking-tight">Your wishlist</h1><p className="mt-3 text-sm text-slate-500">Keep the products you want to come back to close at hand.</p>{items.length ? <div className="mt-9 grid grid-cols-2 gap-4 md:grid-cols-4">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="surface mt-8 px-6 py-24 text-center"><Heart className="mx-auto text-slate-300" size={42} /><h2 className="mt-5 text-xl font-extrabold">Nothing saved yet</h2><p className="mt-2 text-sm text-slate-500">Tap the heart on a product to save it here.</p><ButtonLink href="/products" className="mt-6">Explore products</ButtonLink></div>}</main><SiteFooter /></div>; }
