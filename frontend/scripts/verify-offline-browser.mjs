import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const { chromium } = process.env.PLAYWRIGHT_MODULE_PATH ? require(process.env.PLAYWRIGHT_MODULE_PATH) : await import("playwright");
const sources = Object.fromEntries(["db", "policy", "engine"].map(name => ["./" + name, ts.transpileModule(fs.readFileSync(path.join(root, "lib/offline", name + ".ts"), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText]));
const bundle = `(() => { const sources = ${JSON.stringify(sources)}, cache = {}; function load(name) { if (cache[name]) return cache[name].exports; const module = {exports:{}}; cache[name] = module; new Function('require','module','exports',sources[name])(load,module,module.exports); return module.exports; } window.offline = load('./engine'); window.db = load('./db'); window.policy = load('./policy'); })()`;
const directory = process.env.OFFLINE_TEST_PROFILE ?? path.resolve(root, "../.tmp-offline-browser-profile-" + Date.now());
let context;
const tables = new Map(); const receipts = new Map(); let requests = 0; let loseResponse = false;
function error(status, message) { return { error: { status, message } }; }
function server(route, method, body, headers) {
  if (route === "/api/offline/capabilities") return { data: { offlineWritesEnabled: true } };
  requests++;
  const id = headers["x-offline-operation"];
  if (id && receipts.has(id)) return { data: receipts.get(id) };
  const parts = route.split('/'); const collection = method === "POST" || method === "GET" ? route : parts.slice(0, -1).join('/');
  const rows = tables.get(collection) ?? []; tables.set(collection, rows);
  if (method === "GET") return { data: rows };
  if (body?.name === "reject") return error(400, "Invalid record; saved for review.");
  let data;
  if (route.endsWith("/documents")) { const documentId = crypto.randomUUID(); data = { id: documentId, downloadUrl: route + '/' + documentId, originalFileName: "proof.txt", length: body?.fileSize }; }
  else if (method === "POST") { data = { ...body, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }; rows.push(data); }
  else {
    const index = rows.findIndex(row => row.id === parts.at(-1)); if (index < 0) return error(404, "Removed");
    if (headers["x-offline-base-version"] !== rows[index].updatedAt) return error(409, "Sync conflict detected. Please review this record.");
    if (method === "DELETE") rows.splice(index, 1);
    else { data = { ...rows[index], ...body, updatedAt: new Date(Date.now() + requests).toISOString() }; rows[index] = data; }
  }
  if (id) receipts.set(id, data);
  if (loseResponse) { loseResponse = false; return error(0, "Connection lost after commit"); }
  return { data };
}
const token = (id, type = "staff", exp = Date.now()/1000+3600) => 'test.' + Buffer.from(JSON.stringify({sub:id,type,role:type === 'staff' ? 'ADMIN' : 'CUSTOMER',permissions:[],exp})).toString('base64url') + '.test';
const actor = crypto.randomUUID(); const staffToken = token(actor);
async function boot() {
  context = await chromium.launchPersistentContext(directory, { executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  if (process.env.OFFLINE_TEST_DISABLE_WEB_LOCKS === "1") await context.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined, configurable: true }));
  await context.route("http://localhost:3019/**", route => route.fulfill({contentType:"text/html",body:"<!doctype html><title>Offline durability test</title>"}));
  const page = context.pages()[0] ?? await context.newPage();
  await page.exposeFunction("testServer", server);
  await page.goto("http://localhost:3019/");
  await inject(page); return page;
}
async function inject(page) {
  await page.addScriptTag({content:bundle});
  await page.evaluate(token => {
    localStorage.setItem('anhh-staff-access-token',token);
    window.send = async (route, init={}, token) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      let body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      if (init.body instanceof FormData) body = {fileSize: [...init.body.values()].find(value => value instanceof Blob)?.size};
      const result = await window.testServer(route,init.method ?? 'GET',body,headers);
      if (result.error) { const e = new Error(result.error.message); e.status = result.error.status; throw e; }
      return result.data;
    };
    window.offline.setOfflineTransport(window.send);
    window.req = (route, method='GET', input) => window.offline.offlineRequest(route,{method, body: input === undefined ? undefined : JSON.stringify(input)},localStorage.getItem('anhh-staff-access-token') ?? localStorage.getItem('anhh-access-token'),window.send);
  },staffToken);
}
let page = await boot();
try {
  await page.evaluate(async () => { await window.offline.checkOfflineConnection(); await window.req('/api/hrms/setup/DEPARTMENTS'); });
  const online = await page.evaluate(() => window.req('/api/hrms/setup/DEPARTMENTS','POST',{name:'online',isActive:true}));
  assert(tables.get('/api/hrms/setup/DEPARTMENTS').some(row=>row.id===online.id)); console.log('PASS online create and server confirmation');
  await context.setOffline(true);
  const five = await page.evaluate(async () => {const rows=[];for(let i=0;i<5;i++) rows.push(await window.req('/api/hrms/setup/DEPARTMENTS','POST',{name:'offline-'+i,isActive:true}));return rows;});
  assert.equal(new Set(five.map(row=>row.id)).size,5);
  await page.reload(); await inject(page);
  assert.equal((await page.evaluate(()=>window.req('/api/hrms/setup/DEPARTMENTS'))).length,6); console.log('PASS five offline creates, UUIDs, refresh, cached data');
  await context.close(); page = await boot(); await context.setOffline(true);
  assert.equal((await page.evaluate(()=>window.req('/api/hrms/setup/DEPARTMENTS'))).length,6); console.log('PASS browser close/reopen retains queue and records');
  await context.setOffline(false);
  await page.evaluate(async()=>{await window.offline.checkOfflineConnection();await window.offline.syncOfflineChanges(true);});
  assert.equal(tables.get('/api/hrms/setup/DEPARTMENTS').length,6); assert.equal(await page.evaluate(async()=> (await window.db.scopedRows('queue',window.policy.currentSession().scope)).length),0); console.log('PASS reconnect syncs five, maps server IDs, removes confirmed queue');
  await page.evaluate(()=>window.req('/api/hrms/leave'));
  await context.setOffline(true);
  await page.evaluate(async()=>{const row=await window.req('/api/hrms/leave','POST',{name:'dependent',startDate:'2027-01-01',endDate:'2027-01-01'});await window.req('/api/hrms/leave/'+row.id,'PUT',{name:'edited'});await window.req('/api/hrms/leave/'+row.id,'DELETE');});
  assert.equal((await page.evaluate(()=>window.req('/api/hrms/leave'))).length,0);
  await context.setOffline(false); await page.evaluate(()=>window.offline.syncOfflineChanges(true));
  assert.equal(tables.get('/api/hrms/leave').length,0);console.log('PASS dependent create/update/delete remaps UUID and server version');
  loseResponse=true;
  await page.evaluate(()=>window.req('/api/hrms/setup/DEPARTMENTS','POST',{name:'uncertain'}));
  const uncertain=await page.evaluate(async()=> (await window.db.scopedRows('queue',window.policy.currentSession().scope)).find(row=>row.localResponse.name==='uncertain'));
  assert(uncertain); const before=tables.get('/api/hrms/setup/DEPARTMENTS').length;
  await page.evaluate(async()=>{await window.offline.checkOfflineConnection();await window.offline.syncOfflineChanges(true);await window.offline.syncOfflineChanges(true);});
  assert.equal(tables.get('/api/hrms/setup/DEPARTMENTS').length,before);console.log('PASS disconnect after commit, retry twice, no duplicate');
  await context.setOffline(true);
  await page.evaluate(async()=>{await window.req('/api/hrms/setup/DEPARTMENTS','POST',{name:'reject'});await window.req('/api/hrms/setup/DEPARTMENTS','POST',{name:'independent'});});
  await context.setOffline(false);await page.evaluate(async()=>{await window.offline.checkOfflineConnection();await window.offline.syncOfflineChanges(true);});
  assert(tables.get('/api/hrms/setup/DEPARTMENTS').some(row=>row.name==='independent'));
  assert.equal((await page.evaluate(async()=>await window.db.scopedRows('queue',window.policy.currentSession().scope))).length,1);console.log('PASS rejected draft retained, independent write continues');
  await page.evaluate(()=>window.req('/api/hrms/setup/DEPARTMENTS'));
  await context.setOffline(true);
  await page.evaluate(id=>window.req('/api/hrms/setup/DEPARTMENTS/'+id,'PUT',{name:'local conflict'}),online.id);
  const serverRow=tables.get('/api/hrms/setup/DEPARTMENTS').find(row=>row.id===online.id);serverRow.name='changed by other device';serverRow.updatedAt='2027-02-02T00:00:00.000Z';
  await context.setOffline(false);await page.evaluate(()=>window.offline.syncOfflineChanges(true));
  assert.equal(serverRow.name,'changed by other device');
  const conflict=await page.evaluate(async()=> (await window.db.scopedRows('queue',window.policy.currentSession().scope)).find(row=>row.syncStatus==='conflict'));
  assert.equal(conflict.localResponse.name,'local conflict');
  await page.evaluate(id=>window.offline.reviewOperation(id,'server'),conflict.operationId);
  assert((await page.evaluate(async()=>await window.db.scopedRows('records',window.policy.currentSession().scope))).some(row=>row.syncStatus==='discarded'&&row.data.response.name==='local conflict'));console.log('PASS conflict blocks overwrite, server choice preserves draft backup');
  await page.evaluate(token=>{localStorage.removeItem('anhh-staff-access-token');localStorage.setItem('anhh-access-token',token);},token(crypto.randomUUID(),'customer'));
  await context.setOffline(true);
  const upload=await page.evaluate(async()=>{const body=new FormData();body.append('file',new File(['proof'],'proof.txt',{type:'text/plain'}));body.append('kind','PAYMENT_PROOF');return window.offline.offlineRequest('/api/orders/11111111-1111-4111-8111-111111111111/documents',{method:'POST',body},localStorage.getItem('anhh-access-token'),window.send);});
  assert.equal(await page.evaluate(async url=>(await window.offline.localDocument(url,localStorage.getItem('anhh-access-token'))).text(),upload.downloadUrl),'proof');
  await context.setOffline(false);await page.evaluate(()=>window.offline.syncOfflineChanges(true));
  assert.equal(await page.evaluate(async()=>{const row=(await window.db.scopedRows('records',window.policy.currentSession().scope)).find(row=>row.entity==='document'&&row.syncStatus==='synced');return (await window.offline.localDocument(row.data.response.downloadUrl,localStorage.getItem('anhh-access-token'))).text();}),'proof');console.log('PASS offline blob saved/read/synced, mapped URL retains offline file access');
  await context.setOffline(true);
  const outcomes=await page.evaluate(async()=>{
    let login=false,large=false,isolated=false,expired=false;
    try{await window.offline.offlineRequest('/api/auth/login',{method:'POST',body:'{}'},undefined,window.send);}catch(e){login=e.message.includes('internet');}
    try{const body=new FormData();body.append('file',new Blob([new Uint8Array(6*1024*1024)]),'big.bin');await window.offline.offlineRequest('/api/orders/11111111-1111-4111-8111-111111111111/documents',{method:'POST',body},localStorage.getItem('anhh-access-token'),window.send);}catch(e){large=e.status===413;}
    try{await window.req('/api/hrms/setup/DEPARTMENTS');}catch(e){isolated=e.message.includes('not been downloaded');}
    return {login,large,isolated};
  }); assert.deepEqual(outcomes,{login:true,large:true,isolated:true});
  await page.evaluate(t=>{localStorage.setItem('anhh-access-token',t);},token(crypto.randomUUID(),'customer',1));
  assert.equal(await page.evaluate(async()=>{try{await window.req('/api/cart');return false;}catch(e){return e.status===401;}}),true);console.log('PASS first login online-only, large-file rejection, account isolation, expired auth');
  console.log('Offline browser durability checks passed.');
} finally {await context.close();}
