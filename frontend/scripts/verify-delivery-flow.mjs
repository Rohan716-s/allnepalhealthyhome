import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

// Use a diagnostic backend with this separate signing key. No production tokens.
const base = process.env.DELIVERY_TEST_API_URL || "http://localhost:5019";
const signingKey = process.env.DELIVERY_TEST_SIGNING_KEY || "delivery-verification-local-only-separate-signing-key";
const directory = path.resolve(import.meta.dirname, "../../.tmp-delivery-audit");
const sessionFile = path.join(directory, "session.json");
export function sql(input) {
  return execFileSync("docker", ["exec", "-i", "allnepalhealthy-mysql", "sh", "-c", 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root "$MYSQL_DATABASE"'], { input, encoding: "utf8" }).trim();
}
const q = value => `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
function token(account) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: account.id, role: account.role, type: account.role === "CUSTOMER" ? "customer" : "staff", name: account.fullName, email: account.email, branchId: account.branchId, permissions: account.permissions, exp: Math.floor(Date.now() / 1000) + 7200 })).toString("base64url");
  return `${header}.${payload}.${createHmac("sha256", signingKey).update(`${header}.${payload}`).digest("base64url")}`;
}
function cleanup(s) {
  const staffIds = [s.rider.id, s.otherRider.id, s.admin.id, s.superadmin.id, s.pharmacist.id, s.supervisor.id].map(q).join(",");
  const orders = s.orders.map(q).join(",");
  // Only records created by this suite's UUIDs are removed.
  const stored = [...new Set([...(s.storedFiles || []), ...sql(`SELECT StoredFileName FROM order_documents WHERE OrderId IN (${orders});`).split("\n").filter(Boolean)])];
  s.storedFiles = stored;
  writeFileSync(sessionFile, JSON.stringify(s, null, 2));
  sql(`DELETE FROM activity_logs WHERE ActorId IN (${staffIds}) OR EntityId IN (${orders});
    DELETE FROM notifications WHERE StaffUserId IN (${staffIds}) OR CustomerId=${q(s.customer.id)};
    DELETE FROM offline_sync_receipts WHERE Owner IN ('staff:${s.rider.id.replaceAll("-", "")}');
    DELETE FROM stock_transactions WHERE InventoryId=${q(s.inventoryId)};
    DELETE FROM pharmacy_orders WHERE Id IN (${orders});
    DELETE FROM inventory WHERE Id=${q(s.inventoryId)};
    DELETE FROM addresses WHERE Id=${q(s.addressId)};
    DELETE FROM customers WHERE Id=${q(s.customer.id)};
    DELETE FROM staff_users WHERE Id IN (${staffIds});
    DELETE FROM branches WHERE Id=${q(s.branchId)};`);
  // Stored filenames are generated server-side, validated before deleting fixtures.
  for (const name of stored) if (/^[a-zA-Z0-9_.-]+$/.test(name)) {
    rmSync(path.resolve(import.meta.dirname, "../../backend/App_Data/order-documents", name), { force: true });
  }
  console.log("PASS temporary delivery fixtures cleaned up");
}
if (process.argv.includes("--cleanup")) { cleanup(JSON.parse(readFileSync(sessionFile, "utf8"))); process.exit(); }
for (let attempt = 0; attempt < 50; attempt++) {
  try { if ((await fetch(base + "/healthz")).ok) break; } catch { /* Starting diagnostic API. */ }
  if (attempt === 49) throw new Error("Diagnostic backend did not become healthy.");
  await new Promise(resolve => setTimeout(resolve, 200));
}
mkdirSync(directory, { recursive: true });
const unique = Date.now();
const s = { branchId: randomUUID(), addressId: randomUUID(), inventoryId: randomUUID(), orders: [], notes: `Delivery verification ${unique}: call at reception`, unique };
for (const [key, role] of [["rider", "DELIVERY"], ["otherRider", "DELIVERY"], ["admin", "ADMIN"], ["superadmin", "SUPERADMIN"], ["pharmacist", "PHARMACIST"], ["supervisor", "SUPERVISOR"], ["customer", "CUSTOMER"]]) {
  s[key] = { id: randomUUID(), role, branchId: s.branchId, fullName: `Delivery test ${key}`, email: `delivery-${key}-${unique}@test.invalid`, isActive: true, permissions: ["orders.view", "orders.manage", "dashboard.view", "delivery.view", "delivery.manage"] };
  s[key].token = token(s[key]);
}
const stamp = "UTC_TIMESTAMP(6)";
sql(`INSERT INTO branches (Id,Name,Code,Address,IsActive,Latitude,Longitude,CreatedAt,UpdatedAt) VALUES (${q(s.branchId)},'Delivery verification ${unique}','DT${unique}','Kathmandu',1,27.7,85.3,${stamp},${stamp});
  INSERT INTO customers (Id,FullName,Email,Phone,PasswordHash,IsActive,CreatedAt,UpdatedAt) VALUES (${q(s.customer.id)},${q(s.customer.fullName)},${q(s.customer.email)},'test-${unique}','unusable-test-password-hash',1,${stamp},${stamp});
  INSERT INTO addresses (Id,CustomerId,Label,Province,District,Municipality,Ward,StreetTole,Phone,IsDefault,Latitude,Longitude,CreatedAt,UpdatedAt) VALUES (${q(s.addressId)},${q(s.customer.id)},'Test','Bagmati','Kathmandu','Kathmandu','1','Verification reception','test-contact',1,27.701,85.301,${stamp},${stamp});`);
for (const key of ["rider", "otherRider", "admin", "superadmin", "pharmacist", "supervisor"]) {
  const staff = s[key];
  sql(`INSERT INTO staff_users (Id,FullName,Email,Phone,PasswordHash,Role,BranchId,IsActive,PermissionsCsv,CreatedAt,UpdatedAt) VALUES (${q(staff.id)},${q(staff.fullName)},${q(staff.email)},'test-${key}-${unique}','unusable-test-password-hash',${q(staff.role)},${q(s.branchId)},1,${q(staff.permissions.join(","))},${stamp},${stamp});`);
}
s.productId = sql("SELECT Id FROM products WHERE IsActive=1 LIMIT 1;");
assert.ok(s.productId, "A product is required for stock verification");
sql(`INSERT INTO inventory (Id,ProductId,BranchId,BatchNumber,StockQuantity,ReservedQuantity,CreatedAt,UpdatedAt) VALUES (${q(s.inventoryId)},${q(s.productId)},${q(s.branchId)},'DT-${unique}',20,0,${stamp},${stamp});`);
function order(status = "ASSIGNED_FOR_DELIVERY") {
  const id = randomUUID(); s.orders.push(id);
  sql(`INSERT INTO pharmacy_orders (Id,CustomerId,AddressId,BranchId,OrderNumber,Status,PaymentStatus,PaymentMethod,Total,DeliveryInstructions,CreatedAt,UpdatedAt) VALUES (${q(id)},${q(s.customer.id)},${q(s.addressId)},${q(s.branchId)},'DT-${id.slice(0,8)}','${status === "OUT_FOR_DELIVERY" ? status : "ASSIGNED_FOR_DELIVERY"}','PENDING','CASH_ON_DELIVERY',10,${q(s.notes)},${stamp},${stamp});
    INSERT INTO delivery_assignments (Id,OrderId,DeliveryStaffId,Status,Notes,CreatedAt,UpdatedAt) VALUES (${q(randomUUID())},${q(id)},${q(s.rider.id)},${q(status)},'Existing handoff note',${stamp},${stamp});
    INSERT INTO order_items (Id,OrderId,ProductId,ProductName,Quantity,UnitPrice,CreatedAt,UpdatedAt) VALUES (${q(randomUUID())},${q(id)},${q(s.productId)},'Verification item',1,10,${stamp},${stamp});
    UPDATE inventory SET ReservedQuantity=ReservedQuantity+1 WHERE Id=${q(s.inventoryId)};
    INSERT INTO stock_transactions (Id,InventoryId,BranchId,Type,Quantity,QuantityBefore,QuantityAfter,ReferenceType,ReferenceId,CreatedAt,UpdatedAt) VALUES (${q(randomUUID())},${q(s.inventoryId)},${q(s.branchId)},'RESERVATION',1,20,20,'CUSTOMER_ORDER',${q(id)},${stamp},${stamp});`);
  writeFileSync(sessionFile, JSON.stringify(s, null, 2));
  return id;
}
async function api(route, method = "GET", body, account = s.rider, expected = 200, extra = {}) {
  const response = await fetch(base + route, { method, headers: { ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${account.token}`, ...extra }, ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
  const text = await response.text(); assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${text.slice(0, 600)}`);
  return { data: text ? JSON.parse(text) : null, response };
}
function proof() { const form = new FormData(); form.append("kind", "DELIVERY_PROOF"); form.append("file", new Blob(["%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"], { type: "application/pdf" }), "delivery-verification.pdf"); return form; }
try {
  const id = order(); const root = `/api/delivery/orders/${id}`;
  await api(root, "GET", undefined, s.otherRider, 404);
  await api(root + "/arrived", "POST", {}, s.rider, 409);
  await api(root + "/delivered", "POST", {}, s.rider, 409);
  await api(root + "/documents", "POST", proof(), s.rider, 409);
  await api(root + "/accept", "POST", {}, s.rider, 400, { "X-Offline-Operation": randomUUID() });
  const accepted = (await api(root + "/accept", "POST", {})).data;
  assert.equal(accepted.delivery.status, "ACCEPTED"); assert.ok(accepted.delivery.acceptedAt);
  assert.equal(accepted.delivery.notes, "Existing handoff note"); assert.equal(accepted.deliveryInstructions, s.notes);
  await api(root + "/accept", "POST", {}, s.rider, 409);
  await api(root + "/delivered", "POST", {}, s.rider, 409);
  await api(root + "/documents", "POST", proof(), s.rider, 409);
  await api(root + "/location", "POST", { latitude: 91, longitude: 85.301, accuracy: 10 }, s.rider, 400);
  await api(root + "/location", "POST", { latitude: 27.701, longitude: 85.301, accuracy: 10 });
  const arrived = (await api(root + "/arrived", "POST", { latitude: 27.701, longitude: 85.301 })).data;
  assert.equal(arrived.delivery.status, "ARRIVED"); assert.ok(arrived.delivery.arrivedAt); assert.ok(arrived.delivery.currentLocation);
  const tracking = (await api(`/api/orders/${id}/tracking`, "GET", undefined, s.customer)).data;
  assert.equal(tracking.deliveryStatus, "ARRIVED"); assert.ok(tracking.location);
  for (const [account, route] of [[s.customer, `/api/orders/${id}`], [s.pharmacist, `/api/pharmacist/orders/${id}`], [s.admin, `/api/admin/orders/${id}`], [s.superadmin, `/api/superadmin/orders/${id}`], [s.supervisor, `/api/admin/orders/${id}`]]) {
    const visible = (await api(route, "GET", undefined, account)).data;
    assert.equal(visible.delivery.status, "ARRIVED"); assert.equal(visible.deliveryInstructions, s.notes); assert.ok(visible.delivery.arrivedAt);
  }
  for (const account of [s.admin, s.superadmin, s.pharmacist]) await api(`/api/${account.role === "PHARMACIST" ? "pharmacist" : account.role === "SUPERADMIN" ? "superadmin" : "admin"}/orders/${id}/status`, "PUT", { status: "DELIVERED" }, account, 409);
  const requirements = (await api(root + "/requirements")).data;
  if (requirements.requiredDocumentTypes.length) await api(root + "/delivered", "POST", { latitude: 27.701, longitude: 85.301 }, s.rider, 409);
  for (const kind of [...new Set([...requirements.requiredDocumentTypes, "DELIVERY_PROOF"])]) {
    const form = proof(); form.set("kind", kind);
    const operation = randomUUID(); const first = await api(root + "/documents", "POST", form, s.rider, 200, { "X-Offline-Operation": operation });
    const second = await api(root + "/documents", "POST", form, s.rider, 200, { "X-Offline-Operation": operation });
    assert.equal(first.data.id, second.data.id); assert.equal(second.response.headers.get("X-Offline-Replayed"), "true");
  }
  const completed = (await api(root + "/delivered", "POST", { latitude: 27.701, longitude: 85.301 })).data;
  assert.equal(completed.delivery.status, "DELIVERED"); assert.equal(completed.status, "DELIVERED"); assert.ok(completed.delivery.deliveredAt);
  await api(root + "/delivered", "POST", {}, s.rider, 409);
  assert.equal(sql(`SELECT COUNT(*) FROM stock_transactions WHERE ReferenceType='CUSTOMER_ORDER_DELIVERY' AND ReferenceId=${q(id)};`), "1");
  for (const [account, route] of [[s.customer, `/api/orders/${id}/documents`], [s.pharmacist, `/api/admin/orders/${id}/documents`], [s.admin, `/api/admin/orders/${id}/documents`], [s.superadmin, `/api/superadmin/orders/${id}/documents`]]) {
    const documents = (await api(route, "GET", undefined, account)).data; assert.ok(documents.some(file => file.kind === "DELIVERY_PROOF"));
    const document = documents.find(file => file.kind === "DELIVERY_PROOF");
    const download = await fetch(base + document.downloadUrl, { headers: { Authorization: `Bearer ${account.token}` } }); assert.equal(download.status, 200);
  }
  const legacy = order("OUT_FOR_DELIVERY");
  await api(`/api/delivery/orders/${legacy}/delivered`, "POST", {}, s.rider, 409);
  assert.equal((await api(`/api/delivery/orders/${legacy}/arrived`, "POST", {})).data.delivery.status, "ARRIVED");
  const concurrent = order();
  const responses = await Promise.all([1, 2].map(() => fetch(`${base}/api/delivery/orders/${concurrent}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.rider.token}` }, body: "{}" })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(sql(`SELECT COUNT(*) FROM order_status_history WHERE OrderId=${q(concurrent)} AND Status='ACCEPTED';`), "1");
  sql(`UPDATE addresses SET Latitude=NULL, Longitude=NULL WHERE Id=${q(s.addressId)};`);
  assert.equal((await api(`/api/delivery/orders/${legacy}/requirements`)).data.hasDestinationCoordinates, false);
  assert.equal((await api(`/api/orders/${legacy}/tracking`, "GET", undefined, s.customer)).data.destination, null);
  sql(`UPDATE addresses SET Latitude=27.701, Longitude=85.301 WHERE Id=${q(s.addressId)};`);
  s.browserOrderId = order(); writeFileSync(sessionFile, JSON.stringify(s, null, 2));
  console.log("PASS real API sequence, timestamps, notes, role visibility, map data, final proof, replay and single stock commit");
} finally {
  if (process.env.DELIVERY_TEST_KEEP !== "1") cleanup(s);
}
