"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Database, FileLock2, Gauge, Loader2, Mail, MessageCircle, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { AdminSystemHealth, getAdminSystemHealth } from "@/services/api";
import { AdminShell } from "@/components/admin-shell";
import { AdminBackups } from "@/components/admin-backups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNepalDateTime } from "@/lib/date-time";

export default function SystemHealthPage() {
  const [health, setHealth] = useState<AdminSystemHealth | null>(null); const [error, setError] = useState("");
  useEffect(() => { const token = window.localStorage.getItem("anhh-staff-access-token"); if (token) getAdminSystemHealth(token).then(setHealth).catch((e: Error) => setError(e.message)); }, []);
  const checks = health ? [["Backend API", health.backend, Activity], ["Database", health.database, Database], ["Prescription storage", health.prescriptionStorage, FileLock2], ["OCR provider", health.ocr, Gauge], ["Email", health.email, Mail], ["SMS", health.sms, Smartphone], ["WhatsApp", health.whatsapp, MessageCircle]] as const : [];
  return <AdminShell superAdmin><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">System</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">System health</h1><p className="mt-2 text-sm text-slate-500">Operational checks from the live backend. Secrets are never returned to the browser.</p></div>{error && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}{!health && !error ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Checking system services…</div> : health && <><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{checks.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-5"><Icon className="text-[#003893]" size={20} /><p className="mt-4 text-xs font-bold text-slate-500">{label}</p><div className="mt-2 flex items-center gap-2 text-sm font-extrabold text-slate-900">{value === "connected" || value === "healthy" || value === "ready" || value === "configured" ? <CheckCircle2 className="text-emerald-600" size={16} /> : <XCircle className="text-amber-600" size={16} />}{value}</div></CardContent></Card>)}</div><Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#003893]" />Runtime details</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm sm:grid-cols-3"><div><p className="text-xs font-bold text-slate-400">Environment</p><p className="mt-1 font-extrabold">{health.environment}</p></div><div><p className="text-xs font-bold text-slate-400">Database latency</p><p className="mt-1 font-extrabold">{health.databaseLatencyMs} ms</p></div><div><p className="text-xs font-bold text-slate-400">Current platform time</p><p className="mt-1 font-extrabold">{formatNepalDateTime(health.currentTimeUtc)}</p></div></CardContent></Card><AdminBackups /></>}</AdminShell>;
}
