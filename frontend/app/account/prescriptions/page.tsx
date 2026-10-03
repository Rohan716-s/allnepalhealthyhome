"use client";

import Link from "next/link";
import { FileCheck2, FileUp, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPrescriptions, type Prescription } from "@/services/api";
import { formatPlatformDate } from "@/lib/date-time";

export default function PrescriptionHistoryPage() {
  const [items, setItems] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { const token = localStorage.getItem("anhh-access-token"); if (!token) { const timer = window.setTimeout(() => { setLoading(false); setError("Please sign in to view your prescription history."); }, 0); return () => window.clearTimeout(timer); } let cancelled = false; getPrescriptions(token).then((response) => { if (!cancelled) setItems(response); }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "We could not load your prescriptions."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  return <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Account centre</p><h1 className="mt-2 text-4xl font-extrabold tracking-tight">My prescriptions</h1><p className="mt-3 text-sm text-slate-500">Review your uploaded prescriptions and pharmacist verification status.</p>{loading && <div className="mt-8 grid gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>}{error && <Card className="mt-8 border-rose-200 bg-rose-50"><CardContent className="p-6 text-sm text-rose-800">{error}<div className="mt-4"><ButtonLink href="/login" size="sm">Sign in</ButtonLink></div></CardContent></Card>}{!loading && !error && items.length === 0 && <Card className="mt-8"><CardContent className="px-6 py-20 text-center"><FileCheck2 className="mx-auto text-slate-300" size={42} /><h2 className="mt-5 text-xl font-extrabold">No prescriptions yet</h2><p className="mt-2 text-sm text-slate-500">Upload a clear prescription to identify medicines and check availability.</p><ButtonLink href="/prescription" className="mt-6"><FileUp /> Upload prescription</ButtonLink></CardContent></Card>}{!loading && !error && items.length > 0 && <div className="mt-8 grid gap-4">{items.map((item) => <Card key={item.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><FileCheck2 className="text-teal-700" size={22} /><div><Link href={`/account/prescriptions/${item.id}`} className="text-sm font-extrabold text-slate-900 hover:text-teal-700">{item.originalFileName}</Link><p className="mt-1 text-xs text-slate-400">{item.id} · {formatPlatformDate(item.createdAt)} · {item.items.length} detected medicines</p></div></div><div className="flex items-center gap-3"><StatusBadge status={item.status} /><Link href={`/account/prescriptions/${item.id}`} className="text-xs font-bold text-teal-700">View</Link></div></CardContent></Card>)}</div>}<p className="mt-10 text-center text-xs text-slate-400"><RefreshCcw size={13} className="mr-1 inline" /> Status updates are loaded securely from your account.</p></main><SiteFooter /></div>;
}
