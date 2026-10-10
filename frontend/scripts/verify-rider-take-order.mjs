import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const api = process.env.TAKE_ORDER_TEST_API_URL || "http://localhost:5019";
const root = path.resolve(import.meta.dirname, "../../.tmp-take-order-audit");
const session = path.join(root, "session.json");
const key = "delivery-verification-local-only-separate-signing-key";
const q = value => `'${String(value).replaceAll("'", "''")}'`;
function sql(input) { return execFileSync("docker", ["exec", "-i", "allnepalhealthy-mysql", "sh", "-c", 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root "$MYSQL_DATABASE"'], { input, encoding: "utf8" }).trim(); }
function token(account) { const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"); const p = Buffer.from(JSON.stringify({ sub: account.id, role: account.role, type: account.role === "CUSTOMER" ? "customer" : "staff", name: account.fullName, email: account.email, branchId: account.branchId, permissions: account.permissions, exp: Math.floor(Date.now()/1000)+7200 })).toString("base64url"); return `${h}.${p}.${createHmac("sha256", key).update(`${h}.${p}`).digest("base64url")}`; }
function cleanup(s) {
  const staff = [s.rider.id,s.otherRider.id,s.admin.id,s.superadmin.id,s.pharmacist.id].map(q).join(",");
  const customers = s.customers.map(c => q(c.id)).join(",");
  const numbers = sql(`SELECT OrderNumber FROM pharmacy_orders WHERE BranchId=${q(s.branchId)};`).split("\n").filter(Boolean);
  const notices = numbers.map(number => `Body LIKE ${q("%"+number+"%")}`).join(" OR ") || "1=0";
  sql(`DELETE FROM notifications WHERE CustomerId IN (${customers}) OR StaffUserId IN (${staff}) OR ${notices};
    DELETE FROM activity_logs WHERE ActorId IN (${staff});
    DELETE FROM offline_sync_receipts WHERE Owner IN ('rider-order:${s.rider.id.replaceAll("-","")}','rider-order:${s.otherRider.id.replaceAll("-","")}');
    DELETE FROM stock_transactions WHERE BranchId=${q(s.branchId)};
    DELETE FROM pharmacy_orders WHERE BranchId=${q(s.branchId)};
    DELETE FROM inventory WHERE BranchId=${q(s.branchId)};
    DELETE FROM products WHERE Id IN (${s.products.map(p=>q(p.id)).join(",")});
    DELETE FROM delivery_zones WHERE BranchId=${q(s.branchId)};
    DELETE FROM addresses WHERE CustomerId IN (${customers});
    DELETE FROM customers WHERE Id IN (${customers});
    DELETE FROM staff_users WHERE Id IN (${staff});
    DELETE FROM branches WHERE Id=${q(s.branchId)};`);
  console.log("PASS Take Order fixtures removed");
}
if (process.argv.includes("--cleanup")) { cleanup(JSON.parse(readFileSync(session,"utf8"))); process.exit(); }
for (let attempt = 0; attempt < 40; attempt++) {
  try { if ((await fetch(api + "/healthz")).ok) break; } catch { /* Diagnostic startup. */ }
  if (attempt === 39) throw new Error("Diagnostic API did not become healthy.");
  await new Promise(resolve => setTimeout(resolve, 500));
}
mkdirSync(root,{recursive:true});
const unique=Date.now();
const s={branchId:randomUUID(),unique,customers:[],products:[]};
for(const [name,role] of [["rider","DELIVERY"],["otherRider","DELIVERY"],["admin","ADMIN"],["superadmin","SUPERADMIN"],["pharmacist","PHARMACIST"]]){s[name]={id:randomUUID(),role,branchId:s.branchId,fullName:`Take Order ${name}`,email:`take-${name}-${unique}@test.invalid`,isActive:true,permissions:["orders.view","orders.manage","delivery.view","delivery.manage","dashboard.view"]};s[name].token=token(s[name]);}
const stamp="UTC_TIMESTAMP(6)";
sql(`INSERT INTO branches(Id,Name,Code,Address,IsActive,CreatedAt,UpdatedAt) VALUES(${q(s.branchId)},'Take Order verification ${unique}','TO${unique}','Kathmandu',1,${stamp},${stamp});`);
for(const name of ["rider","otherRider","admin","superadmin","pharmacist"]){const c=s[name];sql(`INSERT INTO staff_users(Id,FullName,Email,Phone,PasswordHash,Role,BranchId,IsActive,PermissionsCsv,CreatedAt,UpdatedAt) VALUES(${q(c.id)},${q(c.fullName)},${q(c.email)},'verification','unusable',${q(c.role)},${q(s.branchId)},1,${q(c.permissions.join(","))},${stamp},${stamp});`);}
for(const name of ["A","B","NoAddress"]){const c={id:randomUUID(),role:"CUSTOMER",fullName:`Take Customer ${name} ${unique}`,email:`take-customer-${name}-${unique}@test.invalid`,phone:`TO-${name}-${unique}`,addressId:randomUUID()};c.token=token(c);s.customers.push(c);sql(`INSERT INTO customers(Id,FullName,Email,Phone,PasswordHash,IsActive,CreatedAt,UpdatedAt) VALUES(${q(c.id)},${q(c.fullName)},${q(c.email)},${q(c.phone)},'unusable',1,${stamp},${stamp}); INSERT INTO pharmacy_orders(Id,CustomerId,BranchId,OrderNumber,Status,PaymentStatus,PaymentMethod,Total,CreatedAt,UpdatedAt) VALUES(${q(randomUUID())},${q(c.id)},${q(s.branchId)},'TO-${name}-${unique}','CONFIRMED','PENDING','CASH_ON_DELIVERY',0,${stamp},${stamp});`);if(name!=="NoAddress")sql(`INSERT INTO addresses(Id,CustomerId,Label,Province,District,Municipality,Ward,StreetTole,Phone,IsDefault,Latitude,Longitude,CreatedAt,UpdatedAt) VALUES(${q(c.addressId)},${q(c.id)},'Home','Bagmati','Kathmandu','Kathmandu','1','Take Order reception',${q(c.phone)},1,27.7,85.3,${stamp},${stamp});`);}
const [medicine,brand]=sql("SELECT p.MedicineId,p.BrandId FROM products p JOIN medicines m ON p.MedicineId=m.Id WHERE p.IsActive=1 AND m.PrescriptionRequired=0 LIMIT 1;").split("\t");assert.ok(medicine);
for(const [name,stock,price] of [["Alpha",100,100],["Beta",100,120],["Limited",5,70],["Empty",0,90]]){const p={id:randomUUID(),inventoryId:randomUUID(),name:`Take ${name} ${unique}`,sku:`TO-${name}-${unique}`,stock,price};s.products.push(p);sql(`INSERT INTO products(Id,Name,Slug,Sku,Mrp,SellingPrice,IsFeatured,IsActive,MedicineId,BrandId,SalesUnit,SalesUnitToBase,Barcode,CreatedAt,UpdatedAt) VALUES(${q(p.id)},${q(p.name)},${q(p.sku.toLowerCase())},${q(p.sku)},${price},${price},0,1,${q(medicine)},${q(brand)},'piece',1,${q('BAR-'+p.sku)},${stamp},${stamp}); INSERT INTO inventory(Id,ProductId,BranchId,BatchNumber,StockQuantity,ReservedQuantity,CreatedAt,UpdatedAt) VALUES(${q(p.inventoryId)},${q(p.id)},${q(s.branchId)},'verification',${stock},0,${stamp},${stamp});`);}
sql(`INSERT INTO delivery_zones(Id,Name,BranchId,DeliveryFee,FreeDeliveryThreshold,MinimumOrder,SameDayDelivery,Enabled,CreatedAt,UpdatedAt) VALUES(${q(randomUUID())},'Take Order verification',${q(s.branchId)},20,0,0,0,1,${stamp},${stamp});`);
writeFileSync(session,JSON.stringify(s,null,2));
async function call(route,method="GET",body,account=s.rider,status=200){const response=await fetch(api+route,{method,headers:{Authorization:`Bearer ${account.token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});const text=await response.text();assert.equal(response.status,status,`${route}: ${text.slice(0,700)}`);return text?JSON.parse(text):null;}
const customer=s.customers[0]; const product=s.products[0];
const draft={customerId:customer.id,addressId:customer.addressId,items:[{productId:product.id,quantity:10}],paymentMethod:"CASH_ON_DELIVERY",orderMode:"BULK",requestId:randomUUID()};
try {
  for(const search of [customer.fullName,customer.phone,customer.email])assert.ok((await call(`/api/delivery/customers?search=${encodeURIComponent(search)}`)).items.some(c=>c.id===customer.id));
  assert.equal((await call('/api/delivery/customers?search=no-match-'+unique)).items.length,0);
  for(const search of [product.name,product.sku,'BAR-'+product.sku])assert.ok((await call(`/api/delivery/products?search=${encodeURIComponent(search)}`)).some(p=>p.id===product.id));
  sql(`UPDATE products SET IsActive=0 WHERE Id=${q(product.id)};`);
  assert.equal((await call(`/api/delivery/products?search=${product.sku}`)).length,0);
  await call('/api/delivery/orders/preview','POST',draft,s.rider,400);
  sql(`UPDATE products SET IsActive=1 WHERE Id=${q(product.id)};`);
  assert.ok((await call(`/api/delivery/products?search=${product.sku}`)).some(p=>p.id===product.id));
  sql(`DELETE FROM inventory WHERE Id=${q(s.products[3].inventoryId)};`);
  const empty=await call(`/api/delivery/products?search=${s.products[3].sku}`);assert.equal(empty[0].availableQuantity,0);
  await call('/api/delivery/products','GET',undefined,s.admin,403);
  for(const patch of [{customerId:randomUUID()},{addressId:randomUUID()},{items:[]},{items:[{productId:randomUUID(),quantity:10}]},{items:[{productId:product.id,quantity:0}]},{items:[{productId:product.id,quantity:-1}]},{items:[null]},{items:[draft.items[0],draft.items[0]]}])await call('/api/delivery/orders','POST',{...draft,...patch},s.rider,400);
  const limited={...draft,orderMode:"SINGLE",items:[{productId:s.products[2].id,quantity:6}]};
  const stockError=await call('/api/delivery/orders','POST',limited,s.rider,409);assert.match(stockError.message,/Only 5/);
  await call('/api/delivery/orders','POST',{...draft,requestId:undefined},s.rider,400);
  const before=sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)};`);
  const quote=await call('/api/delivery/orders/preview','POST',{...draft,items:[{...draft.items[0],unitPrice:1}],total:1});assert.equal(quote.subtotal,1000);assert.equal(quote.deliveryFee,20);assert.equal(quote.total,1020);
  assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)};`),before);
  sql(`UPDATE inventory SET StockQuantity=9 WHERE Id=${q(product.inventoryId)};`);
  await call('/api/delivery/orders','POST',{...draft,expectedTotal:quote.total},s.rider,409);
  sql(`UPDATE inventory SET StockQuantity=100 WHERE Id=${q(product.inventoryId)}; UPDATE products SET SellingPrice=101 WHERE Id=${q(product.id)};`);
  await call('/api/delivery/orders','POST',{...draft,expectedTotal:quote.total},s.rider,409);
  sql(`UPDATE products SET SellingPrice=100 WHERE Id=${q(product.id)};`);
  assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)};`),before);
  await call('/api/delivery/orders','POST',{...draft,expectedTotal:1},s.rider,409);
  const payload={...draft,expectedTotal:quote.total};
  const results=await Promise.all([call('/api/delivery/orders','POST',payload,s.rider,201),call('/api/delivery/orders','POST',payload,s.rider,201)]);assert.equal(results[0].id,results[1].id);s.createdId=results[0].id;
  assert.equal((await call('/api/delivery/orders','POST',payload,s.rider,201)).id,s.createdId);
  await call('/api/delivery/orders','POST',{...payload,notes:"different"},s.rider,409);
  assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(product.inventoryId)};`),"10");
  assert.equal(sql(`SELECT COUNT(*) FROM stock_transactions WHERE ReferenceId=${q(s.createdId)} AND Type='RESERVATION';`),"1");
  for(const [account,route] of [[customer,`/api/orders/${s.createdId}`],[s.pharmacist,`/api/pharmacist/orders/${s.createdId}`],[s.admin,`/api/admin/orders/${s.createdId}`],[s.superadmin,`/api/superadmin/orders/${s.createdId}`],[s.rider,`/api/delivery/orders/${s.createdId}`]]){const order=await call(route,"GET",undefined,account);assert.equal(order.id,s.createdId);assert.equal(order.total,account.role === "CUSTOMER" && order.pricesVisible === false ? 0 : quote.total);}
  assert.equal(sql(`SELECT COUNT(*) FROM payment_transactions WHERE OrderId=${q(s.createdId)};`),"1");
  assert.ok((await call('/api/orders','GET',undefined,customer)).some(order=>order.id===s.createdId));
  const report = await fetch(`${api}/api/superadmin/reports/export?type=orders&format=csv&branchId=${s.branchId}`, { headers: { Authorization: `Bearer ${s.superadmin.token}` } });
  assert.equal(report.status,200);assert.ok((await report.text()).includes(results[0].orderNumber));
  const multi={...draft,requestId:randomUUID(),items:[{productId:product.id,quantity:10},{productId:s.products[1].id,quantity:10}]};const multiQuote=await call('/api/delivery/orders/preview','POST',multi);assert.equal(multiQuote.items.length,2);assert.equal(multiQuote.total,2220);
  sql(`UPDATE products SET SalesUnitToBase=2 WHERE Id=${q(s.products[1].id)};`);
  assert.equal((await call(`/api/delivery/products?search=${s.products[1].sku}`))[0].availableQuantity,50);
  sql(`UPDATE products SET SalesUnitToBase=1 WHERE Id=${q(s.products[1].id)};`);
  // The last 5 units cannot be reserved twice by different riders.
  const last={...draft,orderMode:"SINGLE",items:[{productId:s.products[2].id,quantity:5}],expectedTotal:370};
  const race=await Promise.all([s.rider,s.otherRider].map(account=>fetch(api+'/api/delivery/orders',{method:"POST",headers:{Authorization:`Bearer ${account.token}`,"Content-Type":"application/json"},body:JSON.stringify({...last,requestId:randomUUID()})})));
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);assert.equal(sql(`SELECT ReservedQuantity FROM inventory WHERE Id=${q(s.products[2].inventoryId)};`),"5");
  sql(`UPDATE staff_users SET IsActive=0 WHERE Id=${q(s.otherRider.id)};`);await call('/api/delivery/orders','POST',{...draft,requestId:randomUUID()},s.otherRider,403);
  sql(`UPDATE staff_users SET IsActive=1 WHERE Id=${q(s.otherRider.id)}; UPDATE inventory SET StockQuantity=10 WHERE Id=${q(s.products[2].inventoryId)};`);
  writeFileSync(session,JSON.stringify(s,null,2));
  console.log("PASS Take Order API: searches, invalid input, authoritative review, no preview reservation, idempotency, concurrent stock protection, existing role visibility");
} finally { if(process.env.TAKE_ORDER_TEST_KEEP!=="1")cleanup(s); }
