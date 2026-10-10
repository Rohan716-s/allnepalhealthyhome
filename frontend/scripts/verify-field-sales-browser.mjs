import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
const require=createRequire(import.meta.url);
const {chromium}=require('../../.tmp-live-map-tools/node_modules/playwright');
const s=JSON.parse(readFileSync(path.resolve(import.meta.dirname,'../../.tmp-sales-audit/session.json'),'utf8'));
const base=process.env.SALES_TEST_UI_URL || 'http://localhost:3000';
const api=process.env.SALES_TEST_API_URL || 'http://localhost:5019';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
async function open(account, mobile=false) {
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'});
 await context.addInitScript(a=>{localStorage.setItem('anhh-staff-access-token',a.token);localStorage.setItem('anhh-staff',JSON.stringify(a));},account);
 await context.route('**/api/**',async route=>{const url=new URL(route.request().url());try { const response=await route.fetch({url:api+url.pathname+url.search});await route.fulfill({response}); } catch(error) { if (!String(error).includes('disposed') && !String(error).includes('closed')) throw error; }});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {context,page};
}
try {
 const {context,page}=await open(s.executive);
 for(const [route,title] of [['','Your sales workspace'],['customers','Assigned customers'],['visits','Visits & follow-ups'],['payments','Payment follow-up'],['collections','Collections'],['returns','Return requests'],['performance','Sales performance'],['orders','My orders']]) {
  await page.goto(`${base}/sales-executive/${route}`);await page.getByRole('heading',{name:title,exact:true}).last().waitFor();await page.getByText('Loading workspace…').waitFor({state:'hidden'});
  assert.deepEqual((await page.getByRole('alert').allTextContents()).filter(x=>x.trim()),[],route);
 }
 await page.goto(base+'/sales-executive/take-order');await page.getByLabel('Search products').fill(s.products[0].sku);
 await page.getByRole('button',{name:`Add ${s.products[0].name}`,exact:true}).waitFor();assert.equal(await page.getByText(s.products[1].name,{exact:true}).count(),0);
 await page.getByRole('button',{name:`Add ${s.products[0].name}`,exact:true}).click();
 await page.getByLabel('Customer / party').selectOption(s.customers[0].id);await page.getByLabel('Delivery address').selectOption(s.customers[0].addressId);
 await page.getByLabel(`Quantity ${s.products[0].name}`,{exact:true}).fill('2');await page.getByLabel('Discussion / remarks').fill('Browser order verification');
 await page.getByRole('button',{name:'Submit for review',exact:true}).click();await page.getByRole('status').filter({hasText:'Submitted for review'}).waitFor();
 await page.screenshot({path:path.resolve(import.meta.dirname,'../../.tmp-sales-audit/take-order-desktop.png'),fullPage:true});
 const manager=await open(s.manager);await manager.page.goto(base+'/sales-management');await manager.page.getByRole('heading',{name:'Order & return approvals',exact:true}).waitFor();
 const row=manager.page.locator('article').filter({hasText:'Browser order verification'}).first();await row.getByPlaceholder('Required approval / rejection note').fill('Reviewed quantities and customer');await row.getByRole('button',{name:'Approve',exact:true}).click();await manager.page.getByRole('status').filter({hasText:'Approved and applied'}).waitFor();
 await manager.page.screenshot({path:path.resolve(import.meta.dirname,'../../.tmp-sales-audit/management-desktop.png'),fullPage:true});
 await page.goto(base+'/sales-executive/orders');await page.getByText('Browser order verification').waitFor();assert.ok(await page.getByText('PENDING',{exact:true}).count()>0);
 const accountant=await open(s.accountant);await accountant.page.goto(base+'/sales-management');await accountant.page.getByRole('heading',{name:'Collections awaiting verification',exact:true}).waitFor();assert.equal(await accountant.page.getByRole('heading',{name:'Assign customer / territory',exact:true}).count(),0);
 const mobile=await open(s.executive,true);await mobile.page.goto(base+'/sales-executive/take-order');await mobile.page.getByRole('heading',{name:'Active product catalogue',exact:true}).waitFor();await mobile.page.getByLabel('Search products').fill(s.products[0].sku);await mobile.page.getByRole('button',{name:`Add ${s.products[0].name}`,exact:true}).waitFor();
 const overflow=await mobile.page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,'Mobile page overflows viewport');await mobile.page.screenshot({path:path.resolve(import.meta.dirname,'../../.tmp-sales-audit/take-order-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: every executive module, active product search, order submission, manager approval, accountant separation, mobile layout, and browser runtime');
 await Promise.all([context.close(),manager.context.close(),accountant.context.close(),mobile.context.close()]);
} finally {await browser.close();}
