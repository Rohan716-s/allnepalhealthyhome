"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { getOfflineState, getServerOfflineState, subscribeOffline, syncOfflineChanges, checkOfflineConnection, reviewOperation, previewServerOperation } from "@/lib/offline/engine";
import { PendingOperation, scopedRows } from "@/lib/offline/db";
import { currentSession } from "@/lib/offline/policy";

export function OfflineStatus() {
  const state = useSyncExternalStore(subscribeOffline, getOfflineState, getServerOfflineState);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PendingOperation[]>([]);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, unknown>>({});
  const label = state.syncing ? "Syncing..." : !state.online ? "Offline" : state.failed ? "Sync Failed" : state.lastSyncedAt && !state.pending ? "Synced" : "Online";
  async function load() { const session = currentSession(); setRows(session ? await scopedRows("queue", session.scope) : []); }
  useEffect(() => {
    if (!open) return;
    let active = true;
    const session = currentSession();
    void (session ? scopedRows("queue", session.scope) : Promise.resolve([])).then(items => { if (active) setRows(items); }).catch(() => undefined);
    return () => { active = false; };
  }, [open, state.pending, state.failed, state.syncing]);
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    try { await action(); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Please reconnect to review this change."); }
    finally { setBusy(false); }
  }
  async function backup() {
    const session = currentSession(); if (!session) return;
    const records = await scopedRows("records", session.scope);
    const operations = await scopedRows("queue", session.scope);
    const files = records.filter(record => record.file);
    const exports = await Promise.all(files.map(async record => ({ localRecordId: record.localRecordId, type: record.file!.type, base64: btoa(Array.from(new Uint8Array(await record.file!.arrayBuffer()), byte => String.fromCharCode(byte)).join("")) })));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records, operations, files: exports }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "healthy-home-offline-backup.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!state.failed && !open) return null;
  return <div className="fixed bottom-4 right-4 z-[90] inline-flex text-xs text-slate-700 dark:text-slate-200">
    <button type="button" className="flex items-center gap-1 rounded-lg border border-current/20 bg-white/80 px-2 py-1.5 dark:bg-slate-900" onClick={() => { setOpen(!open); void load().catch(() => undefined); }} aria-expanded={open} aria-label="Offline synchronization status">
      <span className={`h-2 w-2 rounded-full ${state.online && !state.failed ? "bg-emerald-500" : "bg-amber-500"}`} />Review saved changes{state.pending > 0 && <span> ({state.pending})</span>}
    </button>
    {open && <div className="fixed inset-x-3 top-20 z-[100] mx-auto max-h-[75vh] max-w-xl overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-label="Saved changes">
      <div className="flex justify-between"><strong>{label}</strong><button onClick={() => setOpen(false)}>Close</button></div>
      <p className="my-3">{state.pending ? `${state.pending} changes waiting to sync. Supported edits remain saved on this device.` : "No changes waiting to sync."}</p>
      {!state.online && <p className="mb-3">You&apos;re offline. Changes sync automatically when you reconnect.</p>}
      {state.error && <p className="mb-3 text-amber-700">{state.error}</p>}
      <div className="flex gap-3"><button className="rounded border px-3 py-2" disabled={busy} onClick={() => void act(async () => { if (await checkOfflineConnection()) await syncOfflineChanges(true); })}>Sync Now</button><button className="rounded border px-3 py-2" disabled={busy} onClick={() => void act(backup)}>Export local backup</button></div>
      {rows.map(row => <article className="mt-3 rounded border border-slate-200 p-3 dark:border-slate-700" key={row.operationId}>
        <p className="font-semibold">{row.operationType} {row.entity} · {row.syncStatus}</p>
        {row.lastError && <p className="my-2 text-amber-700">{row.lastError}</p>}
        <details><summary>Saved local change</summary><pre className="my-2 overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(row.localResponse, null, 2)}</pre></details>
        {["conflict", "rejected"].includes(row.syncStatus) && <div className="mt-3 flex flex-wrap gap-2"><p className="w-full">Review the latest record online before retrying. Retry applies your saved change to that version. Using the server version keeps a backup of your draft.</p><button className="rounded border px-2 py-1" disabled={busy || !state.online} onClick={() => void act(async () => { const latest = await previewServerOperation(row.operationId); setPreviews(current => ({ ...current, [row.operationId]: latest })); })}>Compare server version</button>{previews[row.operationId] !== undefined && <pre className="w-full overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(previews[row.operationId], null, 2)}</pre>}<button className="rounded border px-2 py-1" disabled={busy || !state.online || previews[row.operationId] === undefined} onClick={() => void act(() => reviewOperation(row.operationId, "retry"))}>Retry my change</button><button className="rounded border px-2 py-1" disabled={busy || !state.online} onClick={() => void act(() => reviewOperation(row.operationId, "server"))}>Use server version</button></div>}
      </article>)}
    </div>}
  </div>;
}
