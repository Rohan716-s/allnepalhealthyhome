import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../../.tmp-sales-audit"); mkdirSync(root, {recursive:true});
const api = process.env.SALES_TEST_API_URL || "http://localhost:5019";
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const sql = input => execFileSync("docker", ["exec", "-i", "allnepalhealthy-mysql", "sh", "-c", 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root "$MYSQL_DATABASE"'], { input, encoding:"utf8" }).trim();
const sessionPath = path.join(root,"session.json");
function cleanup(s) {
 const ids=s.accounts.map(x=>q(x.id)).join(','); const customers=s.customers.map(x=>q(x.id)).join(','); const products=s.products.map(x=>q(x.id)).join(',');
 sql(`DELETE FROM activity_logs WHERE ActorId IN (${ids}); DELETE FROM customer_ledger_entries WHERE CustomerId IN (${customers}); DELETE FROM sale_returns WHERE CustomerId IN (${customers}); DELETE FROM customer_payments WHERE CustomerId IN (${customers}); DELETE FROM stock_transactions WHERE BranchId IN (${q(s.branch)},${q(s.otherBranch)}); DELETE FROM invoices WHERE OrderId IN (SELECT Id FROM pharmacy_orders WHERE CustomerId IN (${customers})); DELETE FROM pharmacy_orders WHERE CustomerId IN (${customers}); DELETE FROM SalesFieldRecords WHERE ExecutiveId IN (${ids}); DELETE FROM SalesCustomerAssignments WHERE ExecutiveId IN (${ids}); DELETE FROM SalesExecutiveTargets WHERE ExecutiveId IN (${ids}); DELETE FROM inventory WHERE ProductId IN (${products}); DELETE FROM products WHERE Id IN (${products}); DELETE FROM addresses WHERE CustomerId IN (${customers}); DELETE FROM customers WHERE Id IN (${customers}); DELETE FROM staff_users WHERE Id IN (${ids}); DELETE FROM branches WHERE Id IN (${q(s.branch)},${q(s.otherBranch)});`);
 if(s.proofFile && /^[a-f0-9]{32}\.[a-z]+$/.test(s.proofFile)) { try { unlinkSync(path.resolve(root,'../backend/App_Data/media',s.proofFile)); } catch {} }
 console.log('PASS: isolated field sales fixtures removed');
}
if(process.argv.includes('--cleanup')) {cleanup(JSON.parse(readFileSync(sessionPath,'utf8')));process.exit();}
const s={branch:randomUUID(),otherBranch:randomUUID(),accounts:[],customers:[],products:[]}; const unique=Date.now(); const stamp='UTC_TIMESTAMP(6)';
function token(a){const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const p=Buffer.from(JSON.stringify({sub:a.id,role:a.role,type:'staff',name:a.fullName,email:a.email,branchId:a.branchId,permissions:a.permissions,exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');return `${h}.${p}.${createHmac('sha256','delivery-verification-local-only-separate-signing-key').update(`${h}.${p}`).digest('base64url')}`;}
for(const [branch,name] of [[s.branch,'A'],[s.otherBranch,'B']])sql(`INSERT INTO branches(Id,Name,Code,Address,IsActive,CreatedAt,UpdatedAt) VALUES(${q(branch)},'Sales test ${name} ${unique}','FS${name}${unique}','Kathmandu',1,${stamp},${stamp});`);
for(const [name,role,branch] of [['executive','SALES_EXECUTIVE',s.branch],['otherExecutive','SALES_EXECUTIVE',s.branch],['manager','SALES_MANAGER',s.branch],['accountant','ACCOUNTANT',s.branch],['pharmacist','PHARMACIST',s.branch],['otherManager','SALES_MANAGER',s.otherBranch],['unassigned','SALES_EXECUTIVE',null]]) {
 const a={id:randomUUID(),role,branchId:branch,fullName:`Sales test ${name}`,email:`sales-${name}-${unique}@test.invalid`,permissions:['orders.manage','sales_purchase.view','sales_purchase.sales.manage','sales_purchase.receipts.manage','sales_purchase.accounts.view'],isActive:true};a.token=token(a);s[name]=a;s.accounts.push(a);
 sql(`INSERT INTO staff_users(Id,FullName,Email,Phone,PasswordHash,Role,BranchId,IsActive,PermissionsCsv,CreatedAt,UpdatedAt) VALUES(${q(a.id)},${q(a.fullName)},${q(a.email)},${q(a.id.slice(0,20))},'unusable',${q(role)},${branch?q(branch):'NULL'},1,${q(a.permissions.join(','))},${stamp},${stamp});`);
}
for(const name of ['Assigned','Unassigned']){const c={id:randomUUID(),fullName:`Sales ${name} ${unique}`,phone:`FS${name[0]}${unique}`,addressId:randomUUID()};s.customers.push(c);sql(`INSERT INTO customers(Id,FullName,Email,Phone,PasswordHash,IsActive,CreditLimit,CreatedAt,UpdatedAt) VALUES(${q(c.id)},${q(c.fullName)},'sales-${name}-${unique}@test.invalid',${q(c.phone)},'unusable',1,5000,${stamp},${stamp}); INSERT INTO addresses(Id,CustomerId,Label,Province,District,Municipality,Ward,StreetTole,Phone,IsDefault,CreatedAt,UpdatedAt) VALUES(${q(c.addressId)},${q(c.id)},'Office','Bagmati','Kathmandu','Kathmandu','1','Test customer office',${q(c.phone)},1,${stamp},${stamp});`);}
const [medicine,brand]=sql("SELECT p.MedicineId,p.BrandId FROM products p JOIN medicines m ON p.MedicineId=m.Id WHERE p.IsActive=1 AND m.PrescriptionRequired=0 LIMIT 1").split('\t');
for(const [name,active,stock] of [['Active',1,100],['Inactive',0,100],['Empty',1,0]]){const p={id:randomUUID(),inventoryId:randomUUID(),name:`Field ${name} ${unique}`,sku:`FS-${name}-${unique}`};s.products.push(p);sql(`INSERT INTO products(Id,Name,Slug,Sku,Mrp,SellingPrice,IsFeatured,IsActive,MedicineId,BrandId,SalesUnit,SalesUnitToBase,CreatedAt,UpdatedAt) VALUES(${q(p.id)},${q(p.name)},${q(p.sku.toLowerCase())},${q(p.sku)},100,100,0,${active},${q(medicine)},${q(brand)},'piece',1,${stamp},${stamp}); INSERT INTO inventory(Id,ProductId,BranchId,BatchNumber,StockQuantity,ReservedQuantity,CreatedAt,UpdatedAt) VALUES(${q(p.inventoryId)},${q(p.id)},${q(s.branch)},'field-test',${stock},0,${stamp},${stamp});`);}
writeFileSync(sessionPath,JSON.stringify(s,null,2));
const customer=s.customers[0], product=s.products[0];
async function call(route,method='GET',body,account=s.executive,status=200) {const r=await fetch(api+route,{method,headers:{Authorization:`Bearer ${account.token}`,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});const text=await r.text();assert.equal(r.status,status,`${route}: ${text.slice(0,900)}`);return text?JSON.parse(text):null;}
const input=(kind,patch={})=>({requestId:randomUUID(),customerId:customer.id,kind,notes:'Verification activity',proof:'RECEIPT-123',...patch});
const review=(row,account=s.manager,approve=true,status=200)=>call(`/api/field-sales/records/${row.id}/review`,'POST',{approve,note:'Verified by reviewer'},account,status);
try {
 assert.equal((await call('/api/field-sales/workspace')).customers.length,0);
 await call('/api/field-sales/products','GET',undefined,s.unassigned,403);
 await call('/api/field-sales/assignments','PUT',{executiveId:s.executive.id,customerId:customer.id,branchId:s.branch,territory:'Kathmandu East',isActive:true},s.manager);
 await call('/api/field-sales/targets','PUT',{executiveId:s.executive.id,branchId:s.branch,month:new Date().toISOString().slice(0,7)+'-01',targetAmount:10000,discountLimitPercent:5},s.manager);
 assert.equal((await call('/api/field-sales/workspace')).customers.length,1);
 assert.equal((await call('/api/field-sales/workspace','GET',undefined,s.otherExecutive)).customers.length,0);
 await call('/api/field-sales/records','POST',input('VISIT',{customerId:s.customers[1].id}),s.executive,403);
 const visit=await call('/api/field-sales/records','POST',input('VISIT',{followUpAt:new Date(Date.now()+86400000).toISOString()}));
 await call(`/api/field-sales/records/${visit.id}/complete`,'POST',{},s.otherExecutive,404);
 assert.equal((await call(`/api/field-sales/records/${visit.id}/complete`,'POST',{})).status,'COMPLETED');
 const products=await call('/api/field-sales/products?search=FS-');assert.ok(products.some(x=>x.id===product.id));assert.ok(!products.some(x=>x.id===s.products[1].id));assert.equal(products.find(x=>x.id===s.products[2].id).available,0);
 const draft=input('ORDER',{addressId:customer.addressId,items:[{productId:product.id,quantity:5}],discountPercent:0,credit:false});
 const orderRequest=await call('/api/field-sales/records','POST',draft); assert.equal(orderRequest.amount,500);
 assert.equal((await call('/api/field-sales/records','POST',draft)).id,orderRequest.id);
 await call('/api/field-sales/records','POST',{...draft,notes:'Different'},s.executive,409);
 assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'0');
 await review(orderRequest,s.accountant,true,403);await review(orderRequest,s.otherManager,true,404);
 const approved=await review(orderRequest);s.orderId=approved.orderId;
 assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'5');
 assert.equal(sql(`SELECT Status FROM pharmacy_orders WHERE Id=${q(s.orderId)}`),'PENDING');
 await review(orderRequest,s.manager,true,409);
 await call(`/api/sales-executive/orders/${s.orderId}/status`,'PUT',{status:'CONFIRMED'},s.executive,403);
 await call('/api/admin/sales-purchase/sales','GET',undefined,s.executive,403);
 assert.equal((await call('/api/field-sales/workspace','GET',undefined,s.otherExecutive)).orders.length,0);
 const rejected=await call('/api/field-sales/records','POST',input('ORDER',{...draft,requestId:randomUUID()}));await review(rejected,s.manager,false);assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'5');
 const changed=await call('/api/field-sales/records','POST',input('ORDER',{...draft,requestId:randomUUID()}));sql(`UPDATE products SET SellingPrice=110 WHERE Id=${q(product.id)}`);await review(changed,s.manager,true,409);sql(`UPDATE products SET SellingPrice=100 WHERE Id=${q(product.id)}`);assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'5');await review(changed,s.manager,false);
 const invoiceId=randomUUID();sql(`INSERT INTO invoices(Id,OrderId,InvoiceNumber,Subtotal,TaxAmount,DiscountAmount,DeliveryFee,Total,PaidAmount,PaymentStatus,IsWholesale,IssuedAt,CreatedAt,UpdatedAt) VALUES(${q(invoiceId)},${q(s.orderId)},'FS-INV-${unique}',500,0,0,0,500,0,'UNPAID',1,${stamp},${stamp},${stamp});`);
 const collection=await call('/api/field-sales/records','POST',input('COLLECTION',{amount:100,method:'BANK'}));await review(collection,s.manager,true,403);assert.equal(sql(`SELECT PaidAmount FROM invoices WHERE Id=${q(invoiceId)}`),'0.00');await review(collection,s.accountant);assert.equal(sql(`SELECT PaidAmount FROM invoices WHERE Id=${q(invoiceId)}`),'100.00');await review(collection,s.accountant,true,409);assert.equal(sql(`SELECT COUNT(*) FROM customer_payments WHERE CustomerId=${q(customer.id)}`),'1');
 // Reproduce the existing fulfilled sale allocation using only test stock.
 sql(`UPDATE pharmacy_orders SET Status='DELIVERED' WHERE Id=${q(s.orderId)}; UPDATE inventory SET StockQuantity=95,ReservedQuantity=0 WHERE Id=${q(product.inventoryId)}; INSERT INTO stock_transactions(Id,InventoryId,BranchId,Type,Quantity,QuantityBefore,QuantityAfter,ReferenceType,ReferenceId,CreatedAt,UpdatedAt) VALUES(${q(randomUUID())},${q(product.inventoryId)},${q(s.branch)},'SALE',-5,100,95,'CUSTOMER_ORDER_DELIVERY',${q(s.orderId)},${stamp},${stamp});`);
 const returned=await call('/api/field-sales/records','POST',input('RETURN',{orderId:s.orderId,productId:product.id,quantity:2}));await review(returned);assert.equal(sql(`SELECT StockQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'97');assert.equal(sql(`SELECT Total FROM invoices WHERE Id=${q(invoiceId)}`),'300.00');await review(returned,s.manager,true,409);
 const overReturn=await call('/api/field-sales/records','POST',input('RETURN',{orderId:s.orderId,productId:product.id,quantity:4}));await review(overReturn,s.manager,true,400);await review(overReturn,s.manager,false);
 assert.equal(sql(`SELECT StockQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'97');
 sql(`UPDATE staff_users SET IsActive=0 WHERE Id=${q(s.executive.id)}`);await call('/api/field-sales/workspace','GET',undefined,s.executive,403);sql(`UPDATE staff_users SET IsActive=1 WHERE Id=${q(s.executive.id)}`);

 await call('/api/field-sales/records','POST',input('ORDER',{addressId:customer.addressId,items:[null]}),s.executive,400);
 await call('/api/field-sales/records','POST',input('ORDER',{addressId:customer.addressId,items:[{productId:s.products[1].id,quantity:1}]}),s.executive,400);
 const cancelOrder=async row=>{const approved=await review(row);await call(`/api/pharmacist/orders/${approved.orderId}/status`,'PUT',{status:'CANCELLED',note:'Verification completed'},s.pharmacist);return approved;};
 sql(`UPDATE customers SET CreditLimit=50 WHERE Id=${q(customer.id)}`);
 const credit=await call('/api/field-sales/records','POST',input('ORDER',{addressId:customer.addressId,items:[{productId:product.id,quantity:1}],credit:true}));await review(credit,s.manager,true,409);
 assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'0');
 sql(`UPDATE customers SET CreditLimit=5000 WHERE Id=${q(customer.id)}`);await cancelOrder(credit);
 const discount=await call('/api/field-sales/records','POST',input('ORDER',{addressId:customer.addressId,items:[{productId:product.id,quantity:1}],discountPercent:5}));assert.equal(discount.amount,95);await cancelOrder(discount);
 sql(`UPDATE products SET SalesUnitToBase=10 WHERE Id=${q(product.id)}`);
 const units=await call('/api/field-sales/records','POST',input('ORDER',{addressId:customer.addressId,items:[{productId:product.id,quantity:2}]}));const unitApproved=await review(units);assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'20');await call(`/api/pharmacist/orders/${unitApproved.orderId}/status`,'PUT',{status:'CANCELLED',note:'Verification completed'},s.pharmacist);assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)}`),'0');
 sql(`UPDATE products SET SalesUnitToBase=1 WHERE Id=${q(product.id)}`);
 sql(`UPDATE inventory SET ExpiryDate=DATE_SUB(UTC_DATE(), INTERVAL 1 DAY) WHERE Id=${q(product.inventoryId)}`);
 const expired=await call('/api/field-sales/records','POST',input('ORDER',{addressId:customer.addressId,items:[{productId:product.id,quantity:1}]}));await review(expired,s.manager,true,409);await review(expired,s.manager,false);sql(`UPDATE inventory SET ExpiryDate=NULL WHERE Id=${q(product.inventoryId)}`);
 const rxMedicine=sql("SELECT Id FROM medicines WHERE PrescriptionRequired=1 LIMIT 1");
 if(rxMedicine){sql(`UPDATE products SET MedicineId=${q(rxMedicine)} WHERE Id=${q(product.id)}`);const rx=await call('/api/field-sales/records','POST',input('ORDER',{addressId:customer.addressId,items:[{productId:product.id,quantity:1}]}));const rxApproved=await review(rx);assert.equal(sql(`SELECT Status FROM pharmacy_orders WHERE Id=${q(rxApproved.orderId)}`),'PRESCRIPTION_VERIFICATION');await call(`/api/pharmacist/orders/${rxApproved.orderId}/status`,'PUT',{status:'CANCELLED',note:'Verification completed'},s.pharmacist);sql(`UPDATE products SET MedicineId=${q(medicine)} WHERE Id=${q(product.id)}`);}
 const image=readFileSync(path.resolve(import.meta.dirname,'../public/pwa-icon-192.png'));const form=new FormData();form.append('file',new Blob([image],{type:'image/png'}),'receipt.png');const uploaded=await fetch(api+'/api/field-sales/proof',{method:'POST',headers:{Authorization:`Bearer ${s.executive.token}`},body:form});assert.equal(uploaded.status,200,await uploaded.clone().text());const proof=await uploaded.json();s.proofFile=proof.url.split('/').pop();
 const proofCollection=await call('/api/field-sales/records','POST',input('COLLECTION',{amount:1,method:'CASH',proof:proof.url}));const downloaded=await fetch(api+proof.url,{headers:{Authorization:`Bearer ${s.accountant.token}`}});assert.equal(downloaded.status,200);assert.equal((await downloaded.arrayBuffer()).byteLength,image.length);assert.equal((await fetch(api+proof.url,{headers:{Authorization:`Bearer ${s.otherExecutive.token}`}})).status,404);await review(proofCollection,s.accountant,false);
 sql(`UPDATE staff_users SET Role='EMPLOYEE' WHERE Id=${q(s.executive.id)}`);await call('/api/field-sales/workspace','GET',undefined,s.executive,403);sql(`UPDATE staff_users SET Role='SALES_EXECUTIVE' WHERE Id=${q(s.executive.id)}`);
 console.log('PASS: credit limits, discounts, sales unit conversion, pharmacist cancellation, expired stock, prescription review, private receipt upload and stale-role protection');
 writeFileSync(sessionPath,JSON.stringify(s,null,2));
 console.log('PASS: assignments, targets, own/branch scope, visits, active catalogue, order approval, stock rollback, price changes, accountant-only collection, repeat prevention, original batch return and inactive account checks');
} catch(error) {writeFileSync(sessionPath,JSON.stringify(s,null,2));throw error;}
if(!process.argv.includes('--keep')) cleanup(s);
