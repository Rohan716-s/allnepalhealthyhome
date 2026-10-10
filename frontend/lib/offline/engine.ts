import { CachedResponse, LocalRecord, Mapping, Meta, OfflineError, PendingOperation, StoredBody, dbTransaction, getRow, idbRequest, putRow, scopedRows } from "./db";
import { MutationPolicy, Session, authorizeLocal, cacheableRead, currentSession, mutationPolicy, requireSession, sessionForToken } from "./policy";

type Row = Record<string, unknown>;
type Transport = (path: string, init: RequestInit, token?: string) => Promise<unknown>;
type State = { checking: boolean; online: boolean; syncing: boolean; pending: number; failed: number; lastSyncedAt: number; error: string };
let state: State = { checking: false, online: true, syncing: false, pending: 0, failed: 0, lastSyncedAt: 0, error: "" };
const listeners = new Set<() => void>();
let transport: Transport | undefined;
const tabId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "server";
const MAX_UPLOAD = 5 * 1024 * 1024;
const EMPTY_CART_VERSION = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export const subscribeOffline = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getOfflineState = () => state;
const serverState = { ...state };
export const getServerOfflineState = () => serverState;
export function setOfflineState(update: Partial<State>) { state = { ...state, ...update }; listeners.forEach(listener => listener()); }
export function setOfflineTransport(sender: Transport) { transport = sender; }
const asRow = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const errorStatus = (error: unknown) => Number(asRow(error).status ?? 0);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "This change could not be synced.";
const recordKey = (scope: string, entity: string, id: string) => `${scope}|${entity}|${id}`;
const cacheKey = (scope: string, path: string) => `${scope}|${path}`;
function changed(path: string, scope: string) { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("anhh-offline-data", { detail: { path, scope } })); }

export async function refreshOfflineCounts() {
  try {
    const session = currentSession();
    const rows = session ? await scopedRows("queue", session.scope) : [];
    setOfflineState({ pending: rows.length, failed: rows.filter(row => ["conflict", "rejected"].includes(row.syncStatus) || row.retryCount > 0).length });
  } catch (error) { setOfflineState({ error: errorMessage(error) }); }
}

function safeCache(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeCache);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/password|secret|accessToken|refreshToken|signingKey|apiKey|citizenshipNumber|emergencyContact|checkInLatitude|checkInLongitude|checkOutLatitude|checkOutLongitude|hrProfile|currentLocation|riderLocation/i.test(key)).map(([key, item]) => [key, safeCache(item)]));
}
export async function cacheServerResult(path: string, scope: string, value: unknown) {
  if (!cacheableRead(path)) return;
  const key = cacheKey(scope, path);
  const prior = await getRow("cache", key);
  const data = safeCache(value);
  await putRow("cache", { key, scope, path, data, fetchedAt: Date.now() });
  if (prior && JSON.stringify(prior.data) !== JSON.stringify(data)) changed(path, scope);
}
export async function mergedCache(path: string, scope: string, serverData?: unknown): Promise<unknown> {
  const cached = serverData === undefined ? await getRow("cache", cacheKey(scope, path)) : undefined;
  let data = serverData ?? cached?.data;
  const root = path.split("?")[0];
  const localRecords = (await scopedRows("records", scope)).filter(record => record.syncStatus !== "synced" && record.syncStatus !== "discarded");
  if (data && !Array.isArray(data) && /^\/api\/(?:delivery\/)?orders\/[0-9a-f-]{36}$/.test(root) && localRecords.some(record => record.data._root === `${root}/documents`)) {
    data = { ...asRow(data), documents: await mergedCache(`${root}/documents`, scope, asRow(data).documents ?? []) };
  }
  const records = localRecords.filter(record => record.data._root === root);
  if (!records.length) return data;
  if (root === "/api/cart") return records.sort((a, b) => a.localTimestamp - b.localTimestamp).at(-1)!.data.response;
  const rows = Array.isArray(data) ? [...data] : [];
  for (const record of records) {
    const index = rows.findIndex(item => String(asRow(item).id ?? asRow(item).productCode) === (record.serverRecordId ?? record.localRecordId));
    if (index >= 0) rows.splice(index, 1);
    if (!record.deleted) rows.unshift(record.data.response);
  }
  data = rows;
  return data;
}

async function productForCode(scope: string, code: string): Promise<Row | undefined> {
  const caches = [...await scopedRows("cache", scope), ...await scopedRows("cache", "public")];
  for (const cached of caches) {
    if (!cached.path.startsWith("/api/products")) continue;
    const payload = asRow(cached.data);
    const rows = Array.isArray(payload.items) ? payload.items : [payload];
    const found = rows.find(value => { const product = asRow(value); return product.sku === code || product.slug === code || product.id === code; });
    if (found) return asRow(found);
  }
}
async function serializeBody(body: BodyInit | null | undefined): Promise<StoredBody> {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof FormData) {
    const fields: NonNullable<Exclude<StoredBody, string>>["fields"] = [];
    let bytes = 0;
    for (const [name, value] of body.entries()) {
      bytes += typeof value === "string" ? new Blob([value]).size : value.size;
      fields.push({ name, value, fileName: typeof value === "string" ? undefined : value.name });
    }
    if (bytes > MAX_UPLOAD) throw new OfflineError("This file is too large to save offline. Files over 5 MB require internet.", 413);
    return { fields };
  }
  throw new OfflineError("This upload requires an internet connection.");
}
function restoreBody(body: StoredBody): BodyInit | undefined {
  if (typeof body === "string" || !body) return body;
  const form = new FormData();
  for (const field of body.fields) {
    if (typeof field.value === "string") form.append(field.name, field.value);
    else form.append(field.name, field.value, field.fileName ?? "upload");
  }
  return form;
}
function bodyJson(body: StoredBody): Row { return typeof body === "string" ? asRow(JSON.parse(body)) : {}; }
const versionOf = (value: unknown): string | undefined => { const row = asRow(value); return typeof row.updatedAt === "string" ? row.updatedAt : typeof row.syncVersion === "string" ? row.syncVersion : undefined; };

async function enqueue(policy: MutationPolicy, path: string, init: RequestInit, session: Session) {
  const operationId = crypto.randomUUID();
  const payload = await serializeBody(init.body);
  const input = bodyJson(payload);
  const method = (init.method ?? "GET").toUpperCase();
  const localId = policy.recordId ?? crypto.randomUUID();
  const localKey = recordKey(session.scope, policy.entity, localId);
  const data = await mergedCache(policy.root, session.scope);
  const previous = policy.kind === "cart" ? data : Array.isArray(data) ? data.find(item => String(asRow(item).id ?? asRow(item).productCode) === localId) : undefined;
  const priorRecord = await getRow("records", localKey);
  let baseVersion = versionOf(previous);
  let response: unknown;
  let file: Blob | undefined;
  if (policy.kind === "cart") {
    const cart = asRow(data);
    const items = Array.isArray(cart.items) ? cart.items.map(item => ({ ...asRow(item) })) : [];
    const code = method === "POST" ? String(input.productCode) : decodeURIComponent(path.split('/').at(-1) ?? "");
    const index = items.findIndex(item => item.productCode === code || item.productSlug === code);
    if (method === "DELETE" && path === policy.root) items.splice(0);
    else if (method === "DELETE" || method === "PUT" && Number(input.quantity) === 0) { if (index >= 0) items.splice(index, 1); }
    else {
      const product = await productForCode(session.scope, code);
      if (!product) throw new OfflineError("Download this product online before adding it to your offline cart.");
      const quantity = method === "POST" ? Number(input.quantity) + Number(index >= 0 ? items[index].quantity : 0) : Number(input.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new OfflineError("Cart quantity must be between 1 and 999.", 400);
      if (Number(product.stockQuantity) < quantity) throw new OfflineError("This quantity exceeds the last downloaded stock. Reconnect to check current availability.", 409);
      const item = { productId: product.id, productCode: product.sku, productSlug: product.slug, productName: product.name, quantity, availableQuantity: product.stockQuantity,
        prescriptionRequired: product.prescriptionRequired, imageUrl: product.imageUrl, sellingPrice: product.sellingPrice, pricesVisible: product.pricesVisible };
      if (index < 0) items.push(item); else items[index] = item;
    }
    baseVersion = baseVersion ?? EMPTY_CART_VERSION;
    response = { ...cart, items, count: items.reduce((sum, item) => sum + Number(item.quantity), 0), warnings: [], syncVersion: baseVersion };
  } else if (policy.kind === "wishlist") {
    const product = await productForCode(session.scope, localId);
    if (!product && method !== "DELETE") throw new OfflineError("Download this product online before saving it offline.");
    response = { productId: product?.id ?? asRow(previous).productId, productCode: product?.sku ?? localId };
  } else if (policy.kind === "document") {
    if (!payload || typeof payload === "string") throw new OfflineError("Select a file to save offline.", 400);
    const field = payload.fields.find(field => field.value instanceof Blob);
    file = field?.value as Blob | undefined;
    if (!file) throw new OfflineError("Select a file to save offline.", 400);
    response = { id: localId, kind: payload.fields.find(field => field.name === "kind")?.value ?? "DELIVERY_PROOF", originalFileName: field?.fileName, fileName: field?.fileName, contentType: file.type,
      length: file.size, createdAt: new Date().toISOString(), downloadUrl: `${policy.root}/${localId}` };
  } else {
    if (method !== "POST" && !previous && !priorRecord) throw new OfflineError("Download this record online before editing it offline.", 428);
    if (method !== "POST" && !baseVersion && !priorRecord) throw new OfflineError("This record has no offline version. Download it from the updated server first.", 428);
    response = { ...asRow(previous), ...input, id: localId, createdAt: asRow(previous).createdAt ?? new Date().toISOString(), updatedAt: baseVersion,
      ...(policy.entity === "leave" ? { staffUserId: input.staffUserId ?? session.id, staffName: asRow(previous).staffName ?? "", status: asRow(previous).status ?? "PENDING", dayType: input.dayType ?? "FULL_DAY", appliedDays: input.dayType === "HALF_DAY" ? 0.5 : Math.floor((Date.parse(String(input.endDate)) - Date.parse(String(input.startDate))) / 86400000) + 1 } : {}) };
  }
  const now = Date.now();
  const record: LocalRecord = { key: localKey, scope: session.scope, entity: policy.entity, localRecordId: localId,
    serverRecordId: priorRecord?.serverRecordId ?? (policy.recordId ? localId : undefined), data: { _root: policy.root, response }, file, deleted: method === "DELETE",
    syncStatus: "pending_sync", localTimestamp: now, serverTimestamp: baseVersion };
  const operation: PendingOperation = { operationId, scope: session.scope, entity: policy.entity, root: policy.root, localRecordId: localId,
    serverRecordId: record.serverRecordId, operationType: method === "DELETE" ? "DELETE" : method === "POST" ? "CREATE" : "UPDATE", method, path, payload, baseVersion,
    createdAt: now, updatedAt: now, sequence: 0, retryCount: 0, syncStatus: "pending_sync", nextAttemptAt: 0, localResponse: response };
  await dbTransaction(["queue", "records", "meta"], "readwrite", async tx => {
    const queue = tx.objectStore("queue");
    const pending = (await idbRequest<PendingOperation[]>(queue.index("scope").getAll(session.scope)))
      .filter(row => row.entity === policy.entity && row.localRecordId === localId).sort((a, b) => b.sequence - a.sequence);
    operation.dependsOn = pending[0]?.operationId;
    const meta = tx.objectStore("meta");
    if (!navigator.locks) {
      const lease = await idbRequest<Meta | undefined>(meta.get(`write-lease:${session.scope}`));
      if (asRow(lease?.value).tabId !== tabId) throw new OfflineError("Another tab finished saving first. Please try your change again.");
    }
    const sequence = await idbRequest<Meta | undefined>(meta.get("sequence"));
    operation.sequence = Number(sequence?.value ?? 0) + 1;
    await idbRequest(meta.put({ key: "sequence", value: operation.sequence }));
    await idbRequest(queue.add(operation));
    await idbRequest(tx.objectStore("records").put(record));
  });
  changed(policy.root, session.scope);
  await refreshOfflineCounts();
  if ("serviceWorker" in navigator) void navigator.serviceWorker.ready.then(registration => {
    const sync = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
    return sync?.register("anhh-offline-sync");
  }).catch(() => undefined);
  return operation;
}

async function withLocalWriteLock<T>(scope: string, action: () => Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request(`anhh-local:${scope}`, action);
  const key = `write-lease:${scope}`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const acquired = await dbTransaction(["meta"], "readwrite", async tx => {
      const store = tx.objectStore("meta"); const lease = await idbRequest<Meta | undefined>(store.get(key));
      if (Number(asRow(lease?.value).until ?? 0) > Date.now()) return false;
      await idbRequest(store.put({ key, value: { tabId, until: Date.now() + 30000 } })); return true;
    });
    if (acquired) { try { return await action(); } finally { await putRow("meta", { key, value: { until: 0 } }); } }
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new OfflineError("Another tab is saving a change. Please try again.");
}

export async function offlineRequest<T>(path: string, init: RequestInit, token: string | undefined, send: Transport): Promise<T> {
  if (typeof window === "undefined") return await send(path, init, token) as T;
  const method = (init.method ?? "GET").toUpperCase();
  const session = sessionForToken(token);
  const scope = token ? session?.scope ?? "invalid-session" : "public";
  if (method === "GET") {
    if (token) requireSession(session);
    if (navigator.onLine !== false) {
      try {
        const data = await send(path, init, token);
        setOfflineState({ online: true });
        if (cacheableRead(path)) {
          try { await cacheServerResult(path, scope, data); return await mergedCache(path, scope, data) as T; }
          catch { /* Online reads must still work if device storage is unavailable. */ }
        }
        return data as T;
      } catch (error) {
        if (init.signal?.aborted || errorStatus(error) === 401 || errorStatus(error) === 403 || errorStatus(error) === 404 || errorStatus(error) === 400) throw error;
        if (errorStatus(error) === 0 || errorStatus(error) === 408 || errorStatus(error) >= 500) setOfflineState({ online: false });
        else throw error;
      }
    }
    if (cacheableRead(path)) {
      const data = await mergedCache(path, scope);
      if (data !== undefined) return data as T;
    }
    throw new OfflineError("This data has not been downloaded to this device yet. Reconnect once to make it available offline.");
  }
  const policy = mutationPolicy(path, method);
  const ready = await getRow("meta", "capabilities").catch(() => undefined);
  if (!policy || ready?.value !== true) {
    if (navigator.onLine !== false && state.online) return await send(path, init, token) as T;
    const auth = path.startsWith("/api/auth/");
    throw new OfflineError(auth ? "Sign-in and authentication require internet. Previously signed-in users can keep using downloaded data while their session is valid."
      : policy ? "Connect once to the updated server to enable offline editing on this device."
        : "This operation requires internet so the server can check current permissions, balances, or stock. Your downloaded data is still available.");
  }
  requireSession(session);
  authorizeLocal(policy, session);
  if (path === "/api/hrms/leave/admin" && !["ADMIN", "SUPERADMIN"].includes(session.role)) throw new OfflineError("Only a manager can create leave for another employee.", 403);
  // Large files retain the existing online upload flow.
  if (init.body instanceof FormData && [...init.body.values()].some(value => value instanceof Blob && value.size > MAX_UPLOAD)) {
    if (navigator.onLine !== false && state.online) return await send(path, init, token) as T;
    throw new OfflineError("Files over 5 MB require internet. This file has not been saved offline.", 413);
  }
  let operation: PendingOperation;
  try { operation = await withLocalWriteLock(session.scope, () => enqueue(policy, path, init, session)); }
  catch (error) {
    if (!(error instanceof OfflineError) && navigator.onLine !== false && state.online) return await send(path, init, token) as T;
    throw error;
  }
  if (navigator.onLine !== false && state.online) {
    await syncOfflineChanges(false, session);
    const result = await getRow("meta", `result:${operation.operationId}`);
    if (result) return asRow(result.value).data as T;
    const pending = await getRow("queue", operation.operationId);
    if (pending && ["conflict", "rejected"].includes(pending.syncStatus)) throw new OfflineError(pending.lastError ?? "Your saved change needs review.", pending.syncStatus === "conflict" ? 409 : 400);
  }
  window.dispatchEvent(new CustomEvent("anhh-offline-saved"));
  return operation.localResponse as T;
}

async function applySuccess(operation: PendingOperation, response: unknown) {
  const serverId = String(asRow(response).id ?? operation.serverRecordId ?? operation.localRecordId);
  const version = versionOf(response) ?? (operation.entity === "cart" ? EMPTY_CART_VERSION : undefined);
  await dbTransaction(["queue", "records", "mappings", "cache", "meta"], "readwrite", async tx => {
    const queue = tx.objectStore("queue");
    const remaining = (await idbRequest<PendingOperation[]>(queue.index("scope").getAll(operation.scope))).filter(row => row.operationId !== operation.operationId);
    for (const row of remaining) {
      if (row.entity === operation.entity && row.localRecordId === operation.localRecordId) {
        row.serverRecordId = serverId;
        row.path = row.path.split('/').map(segment => segment === operation.localRecordId ? serverId : segment).join('/');
        if (row.dependsOn === operation.operationId) { row.dependsOn = undefined; row.baseVersion = version; }
        await idbRequest(queue.put(row));
      }
    }
    const records = tx.objectStore("records");
    const key = recordKey(operation.scope, operation.entity, operation.localRecordId);
    const record = await idbRequest<LocalRecord | undefined>(records.get(key));
    if (record) {
      record.serverRecordId = serverId; record.serverTimestamp = version;
      if (!remaining.some(row => row.entity === operation.entity && row.localRecordId === operation.localRecordId)) {
        record.syncStatus = "synced"; record.data.response = response;
      } else {
        const local = asRow(record.data.response); record.data.response = { ...local, id: serverId, updatedAt: version, ...(operation.entity === "cart" ? { syncVersion: version } : {}) };
      }
      await idbRequest(records.put(record));
    }
    const cache = tx.objectStore("cache");
    const caches = await idbRequest<CachedResponse[]>(cache.index("scope").getAll(operation.scope));
    if (!caches.some(row => row.path.split("?")[0] === operation.root)) {
      caches.push({ key: cacheKey(operation.scope, operation.root), scope: operation.scope, path: operation.root, data: operation.entity === "cart" ? response : [], fetchedAt: Date.now() });
    }
    for (const row of caches) {
      if (operation.entity === "document" && row.path.split('?')[0] === operation.root.replace(/\/documents$/, "")) {
        const parent = asRow(row.data);
        const documents = Array.isArray(parent.documents) ? parent.documents.filter(value => ![operation.localRecordId, serverId].includes(String(asRow(value).id))) : [];
        if (response) documents.unshift(response);
        row.data = { ...parent, documents }; await idbRequest(cache.put(row));
      }
      if (row.path.split('?')[0] !== operation.root) continue;
      if (operation.entity === "cart") row.data = response ?? { items: [], warnings: [], count: 0, syncVersion: EMPTY_CART_VERSION };
      else if (Array.isArray(row.data)) {
        row.data = row.data.filter(value => ![operation.localRecordId, operation.serverRecordId, serverId].includes(String(asRow(value).id ?? asRow(value).productCode)));
        if (operation.method !== "DELETE" && response) (row.data as unknown[]).unshift(response);
      }
      row.fetchedAt = Date.now(); await idbRequest(cache.put(row));
    }
    const mapping: Mapping = { key: recordKey(operation.scope, operation.entity, operation.localRecordId), scope: operation.scope, localId: operation.localRecordId, serverId, version, data: response };
    await idbRequest(tx.objectStore("mappings").put(mapping));
    await idbRequest(tx.objectStore("meta").put({ key: `result:${operation.operationId}`, value: { data: response, at: Date.now(), scope: operation.scope } }));
    await idbRequest(queue.delete(operation.operationId));
  });
  // A confirmed write is durable before any UI refresh happens.
  changed(operation.root, operation.scope);
}

async function performSync(force: boolean, session: Session, lease: boolean) {
  if (!transport || navigator.onLine === false) { setOfflineState({ online: false }); return; }
  requireSession(session);
  if (currentSession()?.scope !== session.scope) return;
  const leaseKey = `sync-lease:${session.scope}`;
  const renewLease = () => dbTransaction(["meta"], "readwrite", async tx => {
    const store = tx.objectStore("meta"); const current = await idbRequest<Meta | undefined>(store.get(leaseKey));
    if (asRow(current?.value).tabId !== tabId) return false;
    await idbRequest(store.put({ key: leaseKey, value: { tabId, until: Date.now() + 60000 } })); return true;
  });
  if (lease) {
    const acquired = await dbTransaction(["meta"], "readwrite", async tx => {
      const store = tx.objectStore("meta"); const previous = await idbRequest<Meta | undefined>(store.get(leaseKey));
      if (Number(asRow(previous?.value).until ?? 0) > Date.now()) return false;
      await idbRequest(store.put({ key: leaseKey, value: { tabId, until: Date.now() + 60000 } })); return true;
    });
    if (!acquired) return;
  }
  setOfflineState({ syncing: true, error: "" });
  let successCount = 0;
  try {
    const operations = (await scopedRows("queue", session.scope)).filter(row => !["conflict", "rejected"].includes(row.syncStatus)).sort((a, b) => a.sequence - b.sequence);
    let attempts = 0;
    for (const original of operations) {
      if (currentSession()?.scope !== session.scope || !navigator.onLine) break;
      const operation = await getRow("queue", original.operationId);
      if (!operation || ["conflict", "rejected"].includes(operation.syncStatus) || !force && operation.nextAttemptAt > Date.now()) continue;
      if (operation.dependsOn && await getRow("queue", operation.dependsOn)) continue;
      if (session.expiresAt <= Date.now()) { setOfflineState({ error: "Sign in again to sync your saved changes." }); break; }
      if (lease && !await renewLease()) break;
      if (++attempts > 50) break;
      operation.syncStatus = "syncing"; await putRow("queue", operation);
      try {
        const headers = new Headers({ "X-Offline-Operation": operation.operationId });
        if (operation.baseVersion) headers.set("X-Offline-Base-Version", operation.baseVersion);
        const response = await transport(operation.path, { method: operation.method, body: restoreBody(operation.payload), headers }, session.token);
        if (lease && !await renewLease()) break;
        await applySuccess(operation, response);
        successCount++; setOfflineState({ online: true });
      } catch (error) {
        const status = errorStatus(error);
        operation.retryCount++; operation.updatedAt = Date.now(); operation.lastError = errorMessage(error);
        operation.syncStatus = status === 409 || status === 428 ? "conflict" : status >= 400 && status < 500 && ![401, 408, 429].includes(status) ? "rejected" : "pending_sync";
        operation.nextAttemptAt = Date.now() + Math.min(300000, 1000 * 2 ** Math.min(operation.retryCount, 8)) + Math.floor(Math.random() * 500);
        await putRow("queue", operation);
        const record = await getRow("records", recordKey(operation.scope, operation.entity, operation.localRecordId));
        if (record) { record.syncStatus = operation.syncStatus === "pending_sync" ? "pending_sync" : operation.syncStatus; await putRow("records", record); }
        if (status === 401) { setOfflineState({ error: "Your session expired. Sign in again; your local changes are retained." }); break; }
        if (status === 0 || status === 408) { setOfflineState({ online: false }); break; }
      }
    }
    if (successCount) {
      setOfflineState({ lastSyncedAt: Date.now() });
      window.dispatchEvent(new CustomEvent("anhh-offline-synced", { detail: { count: successCount, scope: session.scope } }));
    }
  } finally {
    if (lease) await dbTransaction(["meta"], "readwrite", async tx => {
      const store = tx.objectStore("meta"); const current = await idbRequest<Meta | undefined>(store.get(leaseKey));
      if (asRow(current?.value).tabId === tabId) await idbRequest(store.put({ key: leaseKey, value: { until: 0 } }));
    });
    setOfflineState({ syncing: false }); await refreshOfflineCounts();
  }
}
export async function syncOfflineChanges(force = false, session = currentSession()) {
  if (!session) { await refreshOfflineCounts(); return; }
  try {
    if (navigator.locks) await navigator.locks.request(`anhh-sync:${session.scope}`, { ifAvailable: true }, lock => lock ? performSync(force, session, false) : Promise.resolve());
    else await performSync(force, session, true);
  } catch (error) { setOfflineState({ syncing: false, error: errorMessage(error) }); }
}
export async function checkOfflineConnection() {
  if (!transport || navigator.onLine === false) { setOfflineState({ online: false }); return false; }
  setOfflineState({ checking: true });
  try {
    const capabilities = asRow(await transport("/api/offline/capabilities", {}, undefined));
    await putRow("meta", { key: "capabilities", value: capabilities.offlineWritesEnabled === true });
    setOfflineState({ online: true }); return true;
  } catch (error) {
    // An older backend still supports its existing online features.
    if (errorStatus(error) === 404) { await putRow("meta", { key: "capabilities", value: false }); setOfflineState({ online: true }); return true; }
    setOfflineState({ online: false }); return false;
  } finally { setOfflineState({ checking: false }); }
}
export async function previewServerOperation(operationId: string) {
  const operation = await getRow("queue", operationId); const session = currentSession(); requireSession(session);
  if (!operation || operation.scope !== session.scope || !transport) throw new OfflineError("This change is unavailable.");
  const latest = await transport(operation.root, {}, session.token);
  return operation.entity === "cart" ? latest : Array.isArray(latest) ? latest.find(value => String(asRow(value).id ?? asRow(value).productCode) === (operation.serverRecordId ?? operation.localRecordId)) ?? { message: "This record does not exist on the server yet." } : latest;
}
export async function reviewOperation(operationId: string, action: "server" | "retry") {
  const operation = await getRow("queue", operationId);
  const session = currentSession(); requireSession(session);
  if (!operation || operation.scope !== session.scope || !transport) return;
  const latest = await transport(operation.root, {}, session.token);
  await cacheServerResult(operation.root, operation.scope, latest);
  if (action === "retry") {
    const record = operation.entity === "cart" ? latest : Array.isArray(latest) ? latest.find(value => String(asRow(value).id) === (operation.serverRecordId ?? operation.localRecordId)) : latest;
    if (operation.method !== "POST" && !record) throw new OfflineError("This record was removed from the server. Use the server version or create a new record.", 409);
    operation.baseVersion = versionOf(record); operation.syncStatus = "pending_sync"; operation.nextAttemptAt = 0; operation.lastError = undefined;
    await putRow("queue", operation);
    await syncOfflineChanges(true);
  } else {
    // Preserve a local audit copy of the draft, but stop applying it to server views.
    await dbTransaction(["queue", "records"], "readwrite", async tx => {
      const queue = tx.objectStore("queue");
      const rows = await idbRequest<PendingOperation[]>(queue.index("scope").getAll(operation.scope));
      for (const row of rows.filter(row => row.entity === operation.entity && row.localRecordId === operation.localRecordId)) await idbRequest(queue.delete(row.operationId));
      const records = tx.objectStore("records");
      const record = await idbRequest<LocalRecord | undefined>(records.get(recordKey(operation.scope, operation.entity, operation.localRecordId)));
      if (record) { record.syncStatus = "discarded"; await idbRequest(records.put(record)); }
    });
    changed(operation.root, operation.scope); await refreshOfflineCounts();
  }
}
export async function localDocument(url: string, token: string): Promise<Blob | undefined> {
  const session = sessionForToken(token); requireSession(session);
  const id = url.split('/').at(-1);
  const record = id ? await getRow("records", recordKey(session.scope, "document", id)) : undefined;
  if (record?.file) return record.file;
  // A confirmed upload changes its URL to the server ID, while the durable
  // local blob remains keyed by its original UUID.
  return id ? (await scopedRows("records", session.scope)).find(row => row.entity === "document" && row.serverRecordId === id)?.file : undefined;
}
