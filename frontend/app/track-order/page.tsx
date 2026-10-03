"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Clock3, MapPin, PackageCheck, Search } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, trackPublicOrder, type PublicOrderTracking } from "@/services/api";
import { formatNepalDateTime } from "@/lib/date-time";

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function TrackOrderPage() {
  const [type, setType] = useState<"ORDER" | "TRACKING">("TRACKING");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<PublicOrderTracking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reference.trim()) {
      setError(`Enter your ${type === "ORDER" ? "Order ID" : "Tracking ID/AWB"}.`);
      setResult(null);
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await trackPublicOrder(type, reference.trim()));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fbfa]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Delivery updates</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Track your order</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Check your latest order status without signing in.</p>
          </div>
          <div className="mt-9 flex flex-wrap gap-6 text-sm font-semibold text-slate-800" role="radiogroup" aria-label="Tracking reference type">
            {([["ORDER", "Order ID"], ["TRACKING", "Tracking ID / AWB"]] as const).map(([value, label]) => (
              <label key={value} className="inline-flex cursor-pointer items-center gap-2">
                <input type="radio" name="tracking-type" value={value} checked={type === value} onChange={() => setType(value)} className="h-4 w-4 accent-[#003893]" />
                {label}
              </label>
            ))}
          </div>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
            <div className="relative flex-1">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={type === "ORDER" ? "Enter Order ID" : "Enter Tracking ID/AWB"} className="h-12 pl-10" aria-label={type === "ORDER" ? "Order ID" : "Tracking ID or AWB"} />
            </div>
            <Button type="submit" disabled={busy} className="h-12 min-w-44 bg-slate-950 hover:bg-[#003893]">{busy ? "Checking…" : "Track Your Order"}</Button>
          </form>
          {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        </section>

        {result && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order reference</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">{result.orderNumber}</h2>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-[#003893]">{readable(result.deliveryStatus ?? result.status)}</span>
                </div>
                <div className="mt-7 grid gap-4 text-sm">
                  <p className="flex items-center gap-3 text-slate-600"><PackageCheck size={18} className="text-[#003893]" />Order status: <strong className="text-slate-900">{readable(result.status)}</strong></p>
                  {result.branchName && <p className="flex items-center gap-3 text-slate-600"><MapPin size={18} className="text-[#003893]" />{result.branchName}</p>}
                  <p className="flex items-center gap-3 text-slate-600"><Clock3 size={18} className="text-[#003893]" />Placed {formatNepalDateTime(result.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-extrabold text-slate-950">Order progress</h2>
                <div className="mt-6 grid gap-5">
                  {result.timeline.map((item, index) => (
                    <div key={`${item.status}-${item.createdAt}-${index}`} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#003893] text-white"><CheckCircle2 size={16} /></span>
                      <div><p className="text-sm font-bold text-slate-900">{readable(item.status)}</p><p className="mt-1 text-xs text-slate-500">{formatNepalDateTime(item.createdAt)}</p></div>
                    </div>
                  ))}
                  {!result.timeline.length && <p className="text-sm text-slate-500">Your order has been received and is being prepared.</p>}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
