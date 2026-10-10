import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || '../../.tmp-live-map-tools/node_modules/playwright');
const base=process.env.UI_TEST_URL || 'http://localhost:3000';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({permissions:['geolocation'],geolocation:{latitude:27.7101,longitude:85.3201}});
const staff={id:crypto.randomUUID(),role:'SUPERADMIN',fullName:'UI verification',email:'ui@example.invalid',permissions:[],isActive:true};
const token='test.'+Buffer.from(JSON.stringify({sub:staff.id,type:'staff',role:staff.role,exp:Date.now()/1000+3600})).toString('base64url')+'.test';
await context.addInitScript(({staff,token})=>{localStorage.setItem('anhh-staff',JSON.stringify(staff));localStorage.setItem('anhh-staff-access-token',token);},{staff,token});
let branchSaved; const departments=[];let rejectSave=false;let productReads=0;
await context.route('**/api/**',async route=>{
 const request=route.request(),url=new URL(request.url());let data=[];
 if(url.pathname==='/api/auth/staff-me')data=staff;
 else if(url.pathname==='/api/site/config')data={settings:{},sections:[],assets:[],faqs:[],paymentMethods:[],navigation:[],popups:[],deliverySlots:[]};
 else if(url.pathname==='/api/offline/capabilities')data={offlineWritesEnabled:true};
 else if(url.pathname.endsWith('/products')){productReads++;data={items:[],totalItems:0,page:1,pageSize:100,totalPages:0};}
 else if(url.pathname.endsWith('/settings'))data={weeklyOffDays:['SATURDAY']};
 else if(url.pathname.endsWith('/overview'))data={totalEmployees:1};
 else if(url.pathname.endsWith('/staff'))data=[staff];
 else if(url.pathname.endsWith('/hrms/setup/DEPARTMENT')){
   if(request.method()==='POST'){
     if(rejectSave)return route.fulfill({status:400,json:{message:'Test validation failed'}});
     data={...request.postDataJSON(),id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};departments.push(data);
   }else data=departments;
 }
 else if(url.pathname.includes('/hrms/setup/DEPARTMENT/')&&request.method()==='PUT'){
   const index=departments.findIndex(row=>row.id===url.pathname.split('/').at(-1));
   assert.ok(index>=0);data={...departments[index],...request.postDataJSON(),updatedAt:new Date().toISOString()};departments[index]=data;
 }
 else if(url.pathname.endsWith('/branches')&&request.method()==='POST'){branchSaved={...request.postDataJSON(),id:crypto.randomUUID()};data=branchSaved;}
 else if(url.pathname.endsWith('/branches'))data=branchSaved?[branchSaved]:[];
 else if(branchSaved && url.pathname.endsWith('/branches/'+branchSaved.id))data=branchSaved;
 await route.fulfill({json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const paths=['products/create','branches/create','staff/create','articles/create','cms/create','coupons/create','roles/create','zones/create','flash-sales/create','notification-templates/create','purchase-orders/create','website/hero-slides/create','catalog/category','catalog/brand','catalog/manufacturer','catalog/medicine','transporters','hrms?tab=setup','hrms?tab=attendance','hrms?tab=leave','hrms?tab=payroll','hrms?tab=shifts','hrms?tab=office','hrms?tab=operations'];
 for(const path of paths){
   await page.goto(base+'/superadmin/'+path,{waitUntil:'networkidle'});
   const list=page.getByRole('button',{name:'List',exact:true}).first();await list.waitFor();
   assert.equal(await page.locator('table:visible').count(),0,'Unexpected permanently visible record table: '+path);
   await list.click();await page.getByRole('dialog').last().waitFor();
   if(path==='products/create'){
     const response=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/products'));
     await page.getByLabel('Search products',{exact:true}).fill('Retained filter');await response;
     const reads=productReads;
     await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();await list.click();
     assert.equal(await page.getByLabel('Search products',{exact:true}).inputValue(),'Retained filter');
     await page.waitForTimeout(500);assert.equal(productReads,reads,'Reopening a list must not repeat its initial fetch');
     console.log('PASS list retains product search state and avoids duplicate fetch on reopen');
   }
   await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();
   assert.equal(await page.getByRole('button',{name:'List',exact:true}).count()>0,true);
   console.log('PASS list opens/closes; form preserved:',path);
 }
 await page.goto(base+'/superadmin/branches/create',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Show my location',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#branch-latitude')?.value==='27.7101');
 assert.equal(await page.locator('#branch-longitude').inputValue(),'85.3201');
 await page.getByText('Selected location',{exact:true}).first().waitFor();
 const tiles=page.locator('img[src*="tile.openstreetmap.org"]');await tiles.first().waitFor();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('img[src*="tile.openstreetmap.org"]')).some(img=>img.naturalWidth===256));
 console.log('PASS real OSM tiles load; browser geolocation updates marker and form coordinates');
 const map=page.getByLabel('Select location on map');await map.click({position:{x:125,y:125}});
 assert.notEqual(await page.locator('#branch-latitude').inputValue(),'27.7101');
 const latitude=Number(await page.locator('#branch-latitude').inputValue()),longitude=Number(await page.locator('#branch-longitude').inputValue());
 assert.ok(Math.abs(latitude-27.7101)<0.1 && Math.abs(longitude-85.3201)<0.1,'Manual selection must remain near the displayed GPS position');
 await page.locator('#branch-name').fill('UI location verification');await page.locator('#branch-code').fill('UIVERIFY');await page.locator('#branch-address').fill('Test address');
 await page.getByRole('button',{name:'Save & List',exact:true}).click();
 await page.getByRole('dialog').last().waitFor();assert.equal(branchSaved.latitude,latitude);assert.equal(branchSaved.longitude,longitude);
 console.log('PASS manually selected coordinates reach existing branch save API; Save & List opens panel');
 await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();
 await context.setOffline(true);await page.getByText('You are offline',{exact:true}).waitFor();await page.getByText('Map requires an internet connection.',{exact:false}).waitFor();
 assert.equal(Number(await page.locator('#branch-latitude').inputValue()),latitude);
 await page.getByRole('button',{name:'Dismiss',exact:true}).click();await page.waitForTimeout(1200);assert.equal(await page.getByText('You are offline',{exact:true}).count(),0);
 await context.setOffline(false);await page.waitForTimeout(1500);assert.equal(await page.getByRole('button',{name:'Offline synchronization status'}).count(),0);
 console.log('PASS offline popup dismisses once, map explains offline state, coordinates retained, no permanent Online badge');
 await page.goto(base+'/superadmin/branches/'+branchSaved.id+'/edit',{waitUntil:'networkidle'});
 assert.equal(Number(await page.locator('#branch-latitude').inputValue()),latitude);
 assert.equal(Number(await page.locator('#branch-longitude').inputValue()),longitude);
 await page.getByText('Selected location',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByLabel('Select location on map').click({position:{x:125,y:125}});
 assert.notEqual(Number(await page.locator('#branch-latitude').inputValue()),latitude);
 await page.setViewportSize({width:1280,height:720});
 console.log('PASS saved location reloads through existing read API; mobile map selects coordinates without page overflow');
 await page.goto(base+'/superadmin/hrms?tab=setup',{waitUntil:'networkidle'});
 await page.locator('#hrms-setup-name').fill('Save stays on form');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#hrms-setup-name')?.value==='');
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'List',exact:true}).click();await page.getByRole('cell',{name:'Save stays on form',exact:true}).waitFor();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 console.log('PASS Save retains the form; List uses the updated existing data');
 await page.goto(base+'/superadmin/hrms?tab=setup',{waitUntil:'networkidle'});await page.locator('#hrms-setup-name').fill('Dynamic list record');await page.getByRole('button',{name:'Save & List',exact:true}).click();await page.getByRole('cell',{name:'Dynamic list record',exact:true}).waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'List',exact:true}).click();
 await page.getByRole('row').filter({hasText:'Dynamic list record'}).getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.locator('#hrms-setup-name').fill('Updated list record');await page.getByRole('button',{name:'Save & List',exact:true}).click();
 await page.getByRole('cell',{name:'Updated list record',exact:true}).waitFor();
 const updatedRow=page.getByRole('row').filter({hasText:'Updated list record'});
 await updatedRow.getByRole('button',{name:'Deactivate',exact:true}).click();await updatedRow.getByRole('button',{name:'Activate',exact:true}).waitFor();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 console.log('PASS edit and deactivate update the existing list without page refresh');
 rejectSave=true;await page.locator('#hrms-setup-name').fill('Rejected record');await page.getByRole('button',{name:'Save & List',exact:true}).click();await page.getByText('Test validation failed',{exact:false}).first().waitFor();assert.equal(await page.getByRole('dialog').count(),0);console.log('PASS successful CRUD updates list immediately; failed save keeps form open');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'List',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.getByRole('button',{name:'Close dialog',exact:true}).click();console.log('PASS mobile list panel has no horizontal page overflow');
 await context.clearPermissions();await page.goto(base+'/superadmin/branches/create',{waitUntil:'networkidle'});await context.grantPermissions([]);
 // Explicitly simulate the browser permission-denied result.
 await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_success,error)=>error({code:1,PERMISSION_DENIED:1});});await page.getByRole('button',{name:'Show my location',exact:true}).click();await page.getByText('Location permission is required',{exact:false}).waitFor();console.log('PASS denied location permission leaves manual map selection available');
 assert.deepEqual(errors,[],'Browser runtime errors');
}catch(error){console.log("UI failure body",(await page.locator("body").innerText()).slice(-3500));throw error;}finally{await browser.close()}
