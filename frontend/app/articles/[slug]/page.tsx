"use client";

/* eslint-disable @next/next/no-img-element -- article image URLs are content-managed and may be external. */

import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPublicHealthArticle, resolveMediaUrl, type AdminHealthArticle } from "@/services/api";

export default function ArticlePage() { const params = useParams<{ slug: string }>(); const [article, setArticle] = useState<AdminHealthArticle | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); useEffect(() => { getPublicHealthArticle(params.slug).then(setArticle).catch(reason => setError(reason instanceof Error ? reason.message : "Article could not be loaded.")).finally(() => setLoading(false)); }, [params.slug]); if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin" />Loading article…</div>; if (error || !article) return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-rose-700">{error || "Article not found."}</div>; return <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><Link href="/articles" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700"><ArrowLeft size={15} />Health library</Link><div className="mt-8 flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-teal-50 text-teal-700">{article.featuredImageUrl ? <img src={resolveMediaUrl(article.featuredImageUrl)} alt="" className="h-full w-full object-cover" /> : <FileText size={42} />}</div><p className="mt-7 text-xs font-bold uppercase tracking-wider text-teal-700">{article.category ?? "Health"} · {article.authorName ?? "All Nepal Healthy Home"}</p><h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950">{article.title}</h1>{article.excerpt && <p className="mt-4 text-lg leading-8 text-slate-600">{article.excerpt}</p>}<div className="mt-8 whitespace-pre-wrap text-base leading-8 text-slate-700">{article.content}</div></main>; }
