"use client";

/* eslint-disable @next/next/no-img-element -- article image URLs are content-managed and may be external. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicHealthArticles, resolveMediaUrl, type AdminHealthArticle } from "@/services/api";

export function HealthArticleHub() {
  const [rows, setRows] = useState<AdminHealthArticle[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { getPublicHealthArticles().then(setRows).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex justify-center py-20 text-slate-500"><Loader2 className="mr-2 animate-spin" />Loading health articles…</div>;
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rows.map(row => <Card key={row.id} className="overflow-hidden"><CardContent className="p-0"><div className="flex h-36 items-center justify-center bg-teal-50 text-teal-700">{row.featuredImageUrl ? <img src={resolveMediaUrl(row.featuredImageUrl)} alt="" className="h-full w-full object-cover" /> : <FileText size={34} />}</div><div className="p-5"><div className="flex items-center gap-2"><Badge variant="secondary">{row.category ?? "Health"}</Badge>{row.isFeatured && <Badge>Featured</Badge>}</div><h2 className="mt-3 text-lg font-extrabold text-slate-900">{row.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{row.excerpt ?? row.content}</p><Link href={`/articles/${row.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-teal-900">Read article <ArrowRight size={15} /></Link></div></CardContent></Card>)}{!rows.length && <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">No published health articles yet.</div>}</div>;
}
