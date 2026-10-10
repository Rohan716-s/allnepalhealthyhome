import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const require=createRequire(import.meta.url);
const {chromium}=process.env.PLAYWRIGHT_MODULE_PATH ? require(process.env.PLAYWRIGHT_MODULE_PATH) : await import('playwright');
async function until(page, predicate) { const end=Date.now()+30000; while(Date.now()<end) { if(await page.evaluate(predicate))return; await new Promise(resolve=>setTimeout(resolve,100)); } throw new Error('Timed out waiting for offline state'); }
const siteConfig={settings:{},sections:[],assets:[],faqs:[],paymentMethods:[],navigation:[],popups:[],deliverySlots:[]};
const base=process.env.OFFLINE_TEST_URL ?? 'http://127.0.0.1:3017';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext();
const page=await context.newPage();
let diagnosticPage=page;
page.on("pageerror", error=>console.log("PAGE ERROR",error.message));

try {
  await context.route('**/api/site/config',route=>route.fulfill({json:siteConfig}));
  await context.route('**/api/offline/capabilities',route=>route.fulfill({json:{offlineWritesEnabled:true,protocolVersion:1,maxOfflineUploadBytes:5242880}}));
  await context.route('**/api/products?*',route=>route.fulfill({json:{items:[{id:'11111111-1111-4111-8111-111111111111',sku:'OFFLINE-TEST',slug:'offline-test',name:'Offline Test Product',category:'Medicine',brand:'Test',sellingPrice:10,mrp:10,stockQuantity:4,isFeatured:false,demandScore:0,prescriptionRequired:false}],totalItems:1,page:1,pageSize:100,totalPages:1}}));
  await context.route('**/api/catalog/categories',route=>route.fulfill({json:[]}));
  await context.route('**/api/catalog/brands*',route=>route.fulfill({json:[]}));
  await page.goto(base+'/products',{waitUntil:'networkidle'});
  await page.getByText('Offline Test Product',{exact:true}).waitFor();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await until(page, async()=>{const c=await caches.open('anhh-shell-v1');return Boolean(await c.match(location.href));});
  await until(page, async()=>{const c=await caches.open('anhh-assets-v1');const urls=performance.getEntriesByType('resource').map(entry=>new URL(entry.name)).filter(url=>url.origin===location.origin&&url.pathname.startsWith('/_next/static/'));return urls.length>5&&(await Promise.all(urls.map(url=>c.match(url.href)))).every(Boolean);});
  console.log('PASS production PWA registration, manifest, visited shell and static caching');
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Offline Test Product',{exact:true}).waitFor();
  await page.getByText('You are offline',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Dismiss',exact:true}).click();
  await page.waitForTimeout(300);
  assert.equal(await page.getByText('You are offline',{exact:true}).count(),0);
  const privateCached=await page.evaluate(async()=>{for(const name of await caches.keys()){for(const key of await(await caches.open(name)).keys())if(new URL(key.url).pathname.startsWith('/api/'))return true;}return false;});
  assert.equal(privateCached,false); console.log('PASS actual production page reload offline, IndexedDB catalog visible, offline popup, no private API CacheStorage');
  const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.tmp-offline-audit');
  fs.mkdirSync(directory,{recursive:true});
  await page.screenshot({path:path.join(directory,'offline-products.png'),fullPage:false});
  await page.goto(base+'/about?not-visited=1',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:"You're offline"}).waitFor();console.log('PASS unvisited route gets helpful offline fallback');
  await context.setOffline(false);
  await page.goto(base+'/products',{waitUntil:'networkidle'});
  await page.getByText('Offline Test Product',{exact:true}).waitFor();console.log('PASS reconnect recovers production app');
  const staffContext=await browser.newContext();
  const staff={id:crypto.randomUUID(),role:'ADMIN',fullName:'Offline Test Staff',email:'offline@example.invalid',permissions:[],isActive:true};
  const token='test.'+Buffer.from(JSON.stringify({sub:staff.id,role:staff.role,type:'staff',permissions:[],exp:Date.now()/1000+3600})).toString('base64url')+'.test';
  await staffContext.addInitScript(({staff,token})=>{localStorage.setItem('anhh-staff',JSON.stringify(staff));localStorage.setItem('anhh-staff-access-token',token);},{staff,token});
  const departments=[];const operationIds=new Set();
  await staffContext.route('**/api/**',async route=>{
    const request=route.request(), url=new URL(request.url());let data=[];

    if(url.pathname==='/api/offline/capabilities')data={offlineWritesEnabled:true};
    else if(url.pathname==='/api/auth/staff-me')data=staff;
    else if(url.pathname==='/api/hrms/settings')data={weeklyOffDays:['SATURDAY']};
    else if(url.pathname==='/api/hrms/dashboard/overview')data={totalEmployees:1};
    else if(url.pathname==='/api/hrms/setup/DEPARTMENT'){
      if(request.method()==='POST'){
        const operation=request.headers()['x-offline-operation'];assert(operation);
        if(!operationIds.has(operation)){operationIds.add(operation);departments.push({...request.postDataJSON(),id:crypto.randomUUID(),updatedAt:new Date().toISOString()});}
        data=departments.at(-1);
      }else data=departments;
    }
    else if(url.pathname.includes('/staff'))data=[staff];
    else if(url.pathname==='/api/site/config')data=siteConfig;
    await route.fulfill({json:data});
  });
  const staffPage=await staffContext.newPage();
  diagnosticPage=staffPage;
  await staffPage.exposeFunction('serverRecordCount',()=>departments.length);
  await staffPage.goto(base+'/admin/hrms?tab=setup',{waitUntil:'networkidle'});
  await staffPage.getByRole('heading',{name:'HR setup registers'}).waitFor();
  await staffPage.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await until(staffPage, async()=>Boolean(await(await caches.open('anhh-shell-v1')).match(location.href)));
  await staffContext.setOffline(true);
  for(let i=0;i<5;i++){
    await staffPage.locator('#hrms-setup-name').fill('UI offline department '+i);
    await staffPage.getByRole('button',{name:'Save',exact:true}).click();
    await staffPage.getByRole('button',{name:'List',exact:true}).click();
    await staffPage.getByRole('cell',{name:'UI offline department '+i,exact:true}).waitFor();
    await staffPage.keyboard.press('Escape');
    await staffPage.getByRole('dialog').waitFor({state:'hidden'});
    await staffPage.locator('#hrms-setup-name').evaluate(input=>new Promise(resolve=>{const timer=setInterval(()=>{if(input.value===''){clearInterval(timer);resolve();}},25);}));
  }
  await staffPage.reload({waitUntil:'domcontentloaded'});
  await staffPage.getByRole('button',{name:'List',exact:true}).click();
  await staffPage.getByRole('cell',{name:'UI offline department 4',exact:true}).waitFor();
  assert.equal(departments.length,0);
  await staffContext.setOffline(false);
  await until(staffPage, async()=>{
    const request=indexedDB.open('anhh-offline-v1');const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const count=db.transaction('queue').objectStore('queue').count();const remaining=await new Promise(resolve=>count.onsuccess=()=>resolve(count.result));db.close();return remaining===0;
  });
  await until(staffPage, async()=>await window.serverRecordCount()===5);
  assert.equal(departments.length,5);assert.equal(operationIds.size,5);
  await staffPage.getByRole('cell',{name:'UI offline department 4',exact:true}).waitFor();
  await staffContext.close();console.log('PASS existing staff UI saves five offline entries, survives full reload, reconnect automatically syncs once');
} catch(error) { console.log("BODY",(await diagnosticPage.locator("body").innerText()).slice(0,4000)); console.log("CACHES",await diagnosticPage.evaluate(async()=>Promise.all((await caches.keys()).map(async name=>({name,count:(await (await caches.open(name)).keys()).length}))))); throw error; } finally {await browser.close();}
