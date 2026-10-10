// Isolated UI regression: all authentication and protected API responses are mocked.
// Verifies client navigation without real credentials or database mutations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || '../../.tmp-live-map-tools/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.LOGIN_TEST_URL||'http://localhost:3001';
const cases=[['DELIVERY','/delivery','Delivery'],['PHARMACIST','/pharmacist','Pharmacist'],['SALES_EXECUTIVE','/sales-executive','Sales Executive'],['ACCOUNTANT','/accounts','Accountant'],['ADMIN','/admin','Admin'],['SUPERADMIN','/superadmin','Superadmin'],['SUPERVISOR','/supervisor','Supervisor'],['EMPLOYEE','/attendance','Employee'],['SALES_MANAGER','/admin','Admin'],['PURCHASE_INVENTORY_MANAGER','/admin','Admin'],['HR_MANAGER','/admin','Admin'],['VIEWER_AUDITOR','/admin','Admin']];
try {
 for(const [role,destination,label] of cases){
  for(const login of ['/staff/login','/auth','/',...(role==='DELIVERY'?['/?stalled=1']:[])]){
   const context=await browser.newContext({serviceWorkers:'block'});
   const staff={id:'login-test',role,name:'Login test',fullName:'Login test',isActive:true,permissions:['dashboard.view','hrms.attendance.self','accountant.dashboard.view']};
   const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,role,type:'staff',sub:staff.id})).toString('base64url')+'.browser-fixture';
   if(login.startsWith('/?') || login==='/') await context.addInitScript(({staff,token})=>{localStorage.setItem('anhh-staff',JSON.stringify(staff));localStorage.setItem('anhh-staff-access-token',token);},{staff,token});
   if(login.includes('stalled')) await context.route('**/*',async route=>{if(route.request().headers().rsc==='1') { await new Promise(resolve=>setTimeout(resolve,12000)); await route.abort().catch(()=>{}); } else await route.fallback();});
   await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/staff-login')return route.fulfill({json:{accessToken:token,staff}});
    if(path==='/api/auth/staff-me')return route.fulfill({json:staff});
    if(path==='/api/site/config')return route.fulfill({json:{settings:{},paymentMethods:[],navigation:[],popups:[],deliverySlots:[]}});
    if(path==='/api/offline/capabilities')return route.fulfill({json:{enabled:true}});
    if(path.includes('sidebar-config'))return route.fulfill({json:[]});
    return route.fulfill({status:503,json:{message:'Dashboard data unavailable in isolated routing test'}});
   });
   const page=await context.newPage();page.setDefaultTimeout(15000);let documents=0;const errors=[];
   page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents++;});
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+login);
   if(login==='/auth'){const button=page.getByRole('button',{name:label,exact:true});if(await button.count())await button.click();else await page.getByRole('button',{name:'Delivery',exact:true}).click();}
   if(login==='/staff/login' || login==='/auth') {
   await page.locator('#login-identifier').fill('login@test.example');await page.locator('#login-password').fill('Fixture!123');
   await page.locator('form button[type="submit"]').click();
   }
   if(login.includes('stalled')) await page.getByRole('link',{name:'Open workspace',exact:true}).waitFor();
   await page.waitForURL(base+destination,{timeout:30000});
   await page.waitForTimeout(450);
   assert.equal(await page.getByText('Opening your staff workspace…',{exact:true}).count(),0,`${role} ${login} stuck`);
   assert.equal(await page.getByText('This page couldn’t load',{exact:true}).count(),0);
   assert.equal(documents,login.includes('stalled')?2:1,`${role} triggered a page reload`);
   assert.deepEqual(errors,[]);
   assert.ok((await page.locator('body').innerText()).length>100);
   console.log('PASS',role,login,'->',destination,login.includes('stalled')?'with stalled redirect recovery':'without reload');await context.close();
  }
 }
} finally {await browser.close();}
