import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || "../../.tmp-live-map-tools/node_modules/playwright");
const root=path.resolve(import.meta.dirname,"../../.tmp-take-order-audit");
const s=JSON.parse(readFileSync(path.join(root,"session.json"),"utf8"));
const api=process.env.TAKE_ORDER_TEST_API_URL || "http://localhost:5019";
const base=process.env.TAKE_ORDER_TEST_UI_URL || "http://localhost:3001";
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
await context.addInitScript(account=>{localStorage.setItem("anhh-staff-access-token",account.token);localStorage.setItem("anhh-staff",JSON.stringify(account));},s.rider);
let createRequests=0; let failReview=true; let loseResponse=true; const submissions=[];
await context.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==="/api/delivery/orders/preview" && failReview){failReview=false;await route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({message:"Stock changed. Please review quantities."})});return;}
  const creates=url.pathname==="/api/delivery/orders" && route.request().method()==="POST";
  if(creates){createRequests++;submissions.push(route.request().postDataJSON());}
  try{const response=await route.fetch({url:api+url.pathname+url.search,headers:{...route.request().headers(),host:new URL(api).host}});
    if(creates && loseResponse){loseResponse=false;await route.abort("failed");return;}
    await route.fulfill({response});
  }catch{await route.abort().catch(()=>{});}
});
const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on("pageerror",error=>errors.push(error.message));
async function customer(c){await page.getByLabel("Search Customer",{exact:true}).fill(c.phone);await page.getByRole("button",{name:new RegExp(c.fullName)}).click();await page.getByRole("region",{name:"Selected Customer"}).getByText(c.fullName,{exact:true}).waitFor();}
async function search(p){await page.getByLabel("Search Product / Medicine",{exact:true}).fill(p.sku);await page.getByRole("button",{name:`Select ${p.name}`,exact:true}).waitFor();}
const items=()=>page.getByRole("region",{name:"Order Items",exact:true});
try{
  await page.goto(base+"/delivery/orders",{waitUntil:"domcontentloaded"});
  assert.equal(await page.getByRole("region",{name:"Take Order",exact:true}).count(),0);
  await page.getByRole("button",{name:"Open navigation",exact:true}).click();
  const deliveries=page.getByRole("button",{name:"Deliveries",exact:true});
  if(await deliveries.getAttribute("aria-expanded")!=="true") await deliveries.click();
  await page.getByRole("link",{name:"Take order",exact:true}).click();
  await page.waitForURL(base+"/delivery/take-order");
  await page.getByText("Please select a customer first.",{exact:true}).waitFor();assert.equal(await page.getByLabel("Search Product / Medicine").count(),0);
  await page.getByLabel("Search Customer").fill("no-match-"+s.unique);await page.getByText("No customer found.",{exact:true}).waitFor();
  await customer(s.customers[0]);await page.getByRole("region",{name:"Selected Customer"}).getByRole("link",{name:s.customers[0].phone,exact:true}).waitFor();await page.getByText(/Take Order reception, Kathmandu/).first().waitFor();
  await page.getByLabel("Search Product / Medicine").fill("no-match-"+s.unique);await page.getByText("No product found.",{exact:true}).waitFor();
  await search(s.products[0]);await page.getByRole("button",{name:`Select ${s.products[0].name}`,exact:true}).click();
  await page.getByRole("button",{name:`Select ${s.products[0].name}`,exact:true}).click();assert.equal(await page.getByLabel(`Quantity for ${s.products[0].name}`).inputValue(),"11");assert.equal(await items().getByText(s.products[0].name,{exact:true}).count(),1);
  await page.getByLabel(`Quantity for ${s.products[0].name}`).fill("12");
  await page.getByRole("button",{name:`Increase ${s.products[0].name}`,exact:true}).click();assert.equal(await page.getByLabel(`Quantity for ${s.products[0].name}`).inputValue(),"13");
  await page.getByRole("button",{name:`Decrease ${s.products[0].name}`,exact:true}).click();assert.equal(await page.getByLabel(`Quantity for ${s.products[0].name}`).inputValue(),"12");
  await search(s.products[1]);await page.getByRole("button",{name:`Select ${s.products[1].name}`,exact:true}).click();assert.equal(await items().getByText(s.products[0].name,{exact:true}).count(),1);assert.equal(await items().getByText(s.products[1].name,{exact:true}).count(),1);
  await page.getByRole("button",{name:`Remove ${s.products[1].name}`,exact:true}).click();assert.equal(await items().getByText(s.products[1].name,{exact:true}).count(),0);
  page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("button",{name:"Change Customer",exact:true}).click();assert.equal(await items().getByText(s.products[0].name,{exact:true}).count(),1);
  page.once("dialog",async dialog=>{assert.match(dialog.message(),/Changing the customer will clear/);await dialog.accept();});await page.getByRole("button",{name:"Change Customer",exact:true}).click();await customer(s.customers[1]);await page.getByText("Add at least one product to continue.",{exact:true}).waitFor();
  await page.getByLabel("Order mode").selectOption("SINGLE");await search(s.products[2]);await page.getByRole("button",{name:`Select ${s.products[2].name}`,exact:true}).click();await page.getByLabel(`Quantity for ${s.products[2].name}`).fill("6");await page.getByRole("alert").getByText("Only 5 units are available.",{exact:true}).waitFor();assert.equal(await page.getByLabel(`Quantity for ${s.products[2].name}`).inputValue(),"1");
  await search(s.products[3]);assert.equal(await page.getByRole("button",{name:`Select ${s.products[3].name}`,exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"Close",exact:true}).click();await page.getByRole("button",{name:"Take Order",exact:true}).click();
  assert.equal(await page.getByLabel("Order mode").inputValue(),"SINGLE");assert.equal(await page.getByLabel(`Quantity for ${s.products[2].name}`).inputValue(),"1");
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Change Customer",exact:true}).click();await customer(s.customers[2]);await page.getByText("This customer has no saved delivery address.",{exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Review Order",exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"Change Customer",exact:true}).click();await customer(s.customers[0]);await page.getByLabel("Order mode").selectOption("BULK");
  for(const p of s.products.slice(0,2)){await search(p);await page.getByRole("button",{name:`Select ${p.name}`,exact:true}).click();}
  await page.getByRole("button",{name:"Review Order",exact:true}).click();await page.getByText("Stock changed. Please review quantities.",{exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Confirm Order",exact:true}).count(),0);
  await page.getByRole("button",{name:"Review Order",exact:true}).click();await page.getByRole("region",{name:"Review Order",exact:true}).waitFor();assert.equal(createRequests,0);await page.getByRole("region",{name:"Review Order"}).getByText("Rs. 2,220.00",{exact:true}).waitFor();
  mkdirSync(root,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(root,"review-mobile.png"),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole("button",{name:"Confirm Order",exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByRole("button",{name:"Retry Confirmation",exact:true}).waitFor();assert.equal(createRequests,1);assert.equal(await page.getByRole("button",{name:"Edit Order",exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"Retry Confirmation",exact:true}).click();await page.getByText(/Order ANHH-.* created successfully./).first().waitFor();assert.equal(createRequests,2);assert.deepEqual(submissions[0],submissions[1]);assert.equal(await page.getByRole("button",{name:"Confirm Order",exact:true}).count(),0);
  const sql=input=>execFileSync("docker",["exec","-i","allnepalhealthy-mysql","sh","-c",'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root "$MYSQL_DATABASE"'],{input,encoding:"utf8"}).trim();
  assert.equal(sql(`SELECT COUNT(*) FROM offline_sync_receipts WHERE Owner='rider-order:${s.rider.id.replaceAll("-","")}' AND OperationId='${submissions[0].requestId}';`),"1");
  assert.deepEqual(errors,[]);console.log("PASS Take Order browser: customer details, multiple searches/items, merged quantities, stock limit, removal, customer-change cancel/confirm, empty states, server review, double-click and lost-response retry, mobile layout");
}catch(error){console.log((await page.locator("body").innerText()).slice(-3500));throw error;}finally{await context.close();await browser.close();}
