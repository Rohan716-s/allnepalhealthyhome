"use client";

import { useEffect, useState } from "react";
import { Archive, DatabaseBackup, Download, Loader2, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AdminBackup, createAdminBackup, getAdminBackups, restoreAdminBackup } from "@/services/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNepalDateTime } from "@/lib/date-time";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminBackups() {
  const [rows, setRows] = useState<AdminBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<AdminBackup | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token) return;
    getAdminBackups(token).then(setRows).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function createBackup() {
    setBusy("create"); setError("");
    try { const backup = await createAdminBackup(window.localStorage.getItem("anhh-staff-access-token") ?? ""); setRows(current => [backup, ...current]); toast.success("Database backup created"); }
    catch (e) { setError(e instanceof Error ? e.message : "The database backup could not be created."); }
    finally { setBusy(""); }
  }

  async function restoreBackup() {
    if (!restoreTarget) return;
    setBusy(restoreTarget.id); setError("");
    try { await restoreAdminBackup(restoreTarget.id, window.localStorage.getItem("anhh-staff-access-token") ?? ""); toast.success("Database backup restored"); setRestoreTarget(null); }
    catch (e) { setError(e instanceof Error ? e.message : "The database restore failed."); }
    finally { setBusy(""); }
  }

  return <Card className="mt-6"><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><DatabaseBackup size={18} className="text-[#003893]" />Database backups</CardTitle><p className="mt-2 text-sm text-slate-500">Create a real MySQL snapshot before high-risk changes. Every backup is stored with a checksum and audit record.</p></div><Button onClick={() => void createBackup()} disabled={busy === "create"}>{busy === "create" ? <Loader2 className="animate-spin" /> : <Archive />}Create backup</Button></div></CardHeader><CardContent>{error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}{loading ? <div className="flex items-center justify-center p-10 text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading backup history…</div> : rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><ShieldCheck className="mx-auto text-slate-400" size={24} /><p className="mt-3 text-sm font-bold text-slate-700">No database backups yet</p><p className="mt-1 text-xs text-slate-500">Create one before changing products, settings, or payment configuration.</p></div> : <div className="grid gap-3">{rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-extrabold text-slate-900">{row.fileName}</p><Badge variant={row.status === "COMPLETED" ? "default" : "destructive"}>{row.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{row.provider} · {formatBytes(row.sizeBytes)} · {formatNepalDateTime(row.createdAt)}</p>{row.sha256 && <p className="mt-1 truncate font-mono text-[10px] text-slate-400">SHA-256 {row.sha256}</p>}{row.failureReason && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-700"><TriangleAlert size={13} />{row.failureReason}</p>}</div>{row.status === "COMPLETED" && <Button variant="outline" size="sm" onClick={() => setRestoreTarget(row)} disabled={Boolean(busy)}><RotateCcw />Restore</Button>}</div>)}</div>}</CardContent><AlertDialog open={Boolean(restoreTarget)} onOpenChange={open => { if (!open && !busy) setRestoreTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore this database backup?</AlertDialogTitle><AlertDialogDescription>This will replace the current database contents with <strong>{restoreTarget?.fileName}</strong>. The application may need a restart afterward. Continue only if this snapshot is the intended recovery point.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={Boolean(busy)}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-rose-700 hover:bg-rose-800" disabled={Boolean(busy)} onClick={event => { event.preventDefault(); void restoreBackup(); }}>{busy ? <Loader2 className="animate-spin" /> : <Download />}Restore database</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></Card>;
}
