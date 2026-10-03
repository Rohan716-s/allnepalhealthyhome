"use client";

import { FormEvent, useEffect, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminAuditLogs } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSiteConfig } from "@/components/site-config-provider";
import { formatPlatformDateTime } from "@/lib/date-time";

export default function AuditLogsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getAdminAuditLogs>>>([]);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { dateFormat } = useSiteConfig();

  function load(params = { search, entityType, from, to }) {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token) return;
    setLoading(true); setError("");
    getAdminAuditLogs(token, params).then(setRows).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { const token = window.localStorage.getItem("anhh-staff-access-token"); if (token) getAdminAuditLogs(token).then(setRows).catch((e: Error) => setError(e.message)); }, []);
  function submit(event: FormEvent) { event.preventDefault(); load(); }

  return <AdminShell superAdmin><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Governance</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Audit logs</h1><p className="mt-2 text-sm text-slate-500">Immutable operational activity recorded by the backend.</p></div><Card className="mt-7"><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[#003893]" />Recent activity</CardTitle><form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_170px_145px_145px_auto]"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input aria-label="Search audit logs" placeholder="Action, entity, ID or actor" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div><Input aria-label="Filter audit logs by entity type" placeholder="Entity type" value={entityType} onChange={event => setEntityType(event.target.value)} /><Input aria-label="Audit log start date" type="date" value={from} onChange={event => setFrom(event.target.value)} /><Input aria-label="Audit log end date" type="date" value={to} onChange={event => setTo(event.target.value)} /><Button type="submit" disabled={loading}>{loading ? "Loading…" : "Filter"}</Button></form></CardHeader><CardContent>{error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Actor</TableHead><TableHead>Change</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell className="font-bold">{row.action}</TableCell><TableCell>{row.entityType} · {row.entityId.slice(0, 8)}</TableCell><TableCell>{row.actorRole ?? "System"}</TableCell><TableCell className="max-w-xs text-xs text-slate-500">{row.previousValue ?? "—"} → {row.newValue ?? "—"}</TableCell><TableCell className="whitespace-nowrap">{formatPlatformDateTime(row.createdAt, dateFormat)}</TableCell></TableRow>)}{!rows.length && !loading && <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-slate-500">No audit activity matches these filters.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card></AdminShell>;
}
