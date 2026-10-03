"use client";

import { useEffect, useState } from "react";
import { ArrowRight, HeartPulse, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button-link";
import { getPublicCmsPage } from "@/services/api";

export default function AboutPage() {
  const [page, setPage] = useState<{ title: string; content: string } | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { getPublicCmsPage("about-us").then(setPage).catch(() => undefined); }, 0); return () => window.clearTimeout(timer); }, []);
  return <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="rounded-[2rem] bg-teal-50 p-8 sm:p-14"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">About All Nepal Healthy Home</p><h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">{page?.title ?? "A healthier home starts with easier access to care."}</h1><p className="mt-5 max-w-xl whitespace-pre-line text-base leading-7 text-slate-600">{page ? page.content : <><Loader2 className="mr-2 inline animate-spin" size={16} />We’re building a dependable online pharmacy experience for Nepal—one that makes everyday healthcare shopping clearer, kinder and more convenient.</>}</p></div><div className="mt-10 grid gap-4 md:grid-cols-3"><div className="surface p-6"><HeartPulse className="text-teal-700" /><h2 className="mt-6 text-lg font-extrabold">Care-first</h2><p className="mt-2 text-sm leading-6 text-slate-500">We design every step around real family health needs.</p></div><div className="surface p-6"><ShieldCheck className="text-teal-700" /><h2 className="mt-6 text-lg font-extrabold">Trustworthy</h2><p className="mt-2 text-sm leading-6 text-slate-500">Transparent pricing, genuine products and clear guidance.</p></div><div className="surface p-6"><Stethoscope className="text-teal-700" /><h2 className="mt-6 text-lg font-extrabold">Human support</h2><p className="mt-2 text-sm leading-6 text-slate-500">Our pharmacist support makes online ordering feel personal.</p></div></div><div className="mt-10 text-center"><ButtonLink href="/products" size="lg">Explore the catalogue <ArrowRight /></ButtonLink></div></main><SiteFooter /></div>;
}
