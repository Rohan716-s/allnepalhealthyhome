export type StoredBody = string | { fields: { name: string; value: string | Blob; fileName?: string }[] } | undefined;
export type CachedResponse = { key: string; scope: string; path: string; data: unknown; fetchedAt: number };
export type LocalRecord = {
  key: string; scope: string; entity: string; localRecordId: string; serverRecordId?: string;
  data: Record<string, unknown>; file?: Blob; deleted: boolean;
  syncStatus: "pending_sync" | "synced" | "conflict" | "rejected" | "discarded";
  localTimestamp: number; serverTimestamp?: string;
};
export type PendingOperation = {
  operationId: string; scope: string; entity: string; root: string; localRecordId: string;
  serverRecordId?: string; operationType: "CREATE" | "UPDATE" | "DELETE";
  method: string; path: string; payload: StoredBody; baseVersion?: string; dependsOn?: string;
  createdAt: number; updatedAt: number; sequence: number; retryCount: number;
  syncStatus: "pending_sync" | "syncing" | "conflict" | "rejected";
  nextAttemptAt: number; lastError?: string; localResponse: unknown; serverResponse?: unknown;
};
export type Mapping = { key: string; scope: string; localId: string; serverId: string; version?: string; data: unknown };
export type Meta = { key: string; value: unknown };
type Tables = { cache: CachedResponse; records: LocalRecord; queue: PendingOperation; mappings: Mapping; meta: Meta };
export type TableName = keyof Tables;
let database: Promise<IDBDatabase> | undefined;

export class OfflineError extends Error {
  constructor(message: string, public status = 0) { super(message); this.name = "OfflineError"; }
}
export function openOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new OfflineError("Offline storage is unavailable. Internet is required to save changes."));
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("anhh-offline-v1", 1);
    request.onupgradeneeded = () => {
      for (const name of ["cache", "records", "queue", "mappings", "meta"] as TableName[]) {
        const store = request.result.createObjectStore(name, { keyPath: name === "queue" ? "operationId" : "key" });
        if (name !== "meta") store.createIndex("scope", "scope");
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { database = undefined; reject(new OfflineError("Offline storage could not be opened. Check browser storage settings.")); };
    request.onblocked = () => { database = undefined; reject(new OfflineError("Close other application tabs to update offline storage.")); };
  });
  return database;
}
export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function dbTransaction<T>(names: TableName[], mode: IDBTransactionMode, action: (transaction: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await openOfflineDb();
  const tx = db.transaction(names, mode, { durability: mode === "readwrite" ? "strict" : "default" });
  const completed = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new OfflineError(tx.error?.name === "QuotaExceededError"
      ? "Device storage is full. Your change was not saved. Free space or reconnect before trying again."
      : "The local save could not be completed. Your change was not saved."));
    tx.onerror = () => { /* onabort reports the full transaction failure */ };
  });
  try { const result = await action(tx); await completed; return result; }
  catch (error) {
    try { tx.abort(); } catch { /* already completed */ }
    await completed.catch(() => undefined);
    if (error instanceof OfflineError) throw error;
    throw new OfflineError(error instanceof DOMException && error.name === "QuotaExceededError"
      ? "Device storage is full. Your change was not saved. Free space or reconnect before trying again."
      : "The local save could not be completed. Your change was not saved. Check browser storage settings.");
  }
}
export const getRow = <K extends TableName>(table: K, key: string): Promise<Tables[K] | undefined> => dbTransaction([table], "readonly", tx => idbRequest(tx.objectStore(table).get(key)));
export const putRow = <K extends TableName>(table: K, value: Tables[K]): Promise<void> => dbTransaction([table], "readwrite", async tx => { await idbRequest(tx.objectStore(table).put(value)); });
export const scopedRows = <K extends Exclude<TableName, "meta">>(table: K, scope: string): Promise<Tables[K][]> => dbTransaction([table], "readonly", tx => idbRequest(tx.objectStore(table).index("scope").getAll(scope)));
export async function deletePrivateCache(scope: string) {
  await dbTransaction(["cache"], "readwrite", async tx => {
    const store = tx.objectStore("cache");
    for (const row of await idbRequest<CachedResponse[]>(store.index("scope").getAll(scope))) await idbRequest(store.delete(row.key));
  });
}
