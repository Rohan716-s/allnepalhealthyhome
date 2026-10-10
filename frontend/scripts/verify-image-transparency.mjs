import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from "node:fs";
import path from "node:path";

// A schema-only copy and fresh test accounts keep all business records untouched.
const root = path.resolve(import.meta.dirname, "../..");
const fixtures = path.join(root, ".tmp-transparency-fixtures");
const database = `anhh_image_test_${randomUUID().replaceAll("-", "")}`;
assert.match(database, /^anhh_image_test_[a-f0-9]{32}$/);
const container = process.env.IMAGE_TEST_MYSQL_CONTAINER || "allnepalhealthy-mysql";
const key = "image-transparency-test-only-key-never-production";
const api = "http://localhost:5028";
const ui = "http://localhost:3037";
mkdirSync(fixtures, { recursive: true });
const dockerEnv = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0].Config.Env;
const password = dockerEnv.find(x => x.startsWith("MYSQL_ROOT_PASSWORD="))?.slice("MYSQL_ROOT_PASSWORD=".length);
assert.ok(password, "Local MySQL container root configuration is required");
const dockerSql = input => execFileSync("docker", ["exec", "-i", container, "sh", "-c", 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root'], { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
const sql = input => dockerSql(`USE \`${database}\`; ${input}`);
const q = value => `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
const children = [];
let browser;
function start(command, args, cwd, env, logName) {
  const log = openSync(path.join(fixtures, logName), "w");
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", log, log] });
  closeSync(log); children.push(child); return child;
}
async function ready(url) {
  let last = "";
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (response.ok) return; last = `${response.status} ${await response.text()}`; } catch (error) { last = error.message; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not become ready: ${url}: ${last}`);
}
function account(role) {
  const data = { id: randomUUID(), role, fullName: `Transparency ${role}`, email: `${role.toLowerCase()}@transparency.invalid`, phone: `test-${role}`, isActive: true, permissions: ["catalog.view", "catalog.manage", "website.manage", "staff.manage", "orders.view", "orders.manage", "dashboard.view", "delivery.view", "delivery.manage"] };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: data.id, role, type: role === "CUSTOMER" ? "customer" : "staff", name: data.fullName, email: data.email, permissions: data.permissions, exp: Math.floor(Date.now() / 1000) + 7200 })).toString("base64url");
  data.token = `${header}.${payload}.${createHmac("sha256", key).update(`${header}.${payload}`).digest("base64url")}`;
  return data;
}
const customer = account("CUSTOMER"), superadmin = account("SUPERADMIN"), admin = account("ADMIN"), rider = account("DELIVERY"), pharmacist = account("PHARMACIST"), supervisor = account("SUPERVISOR"), executive = account("SALES_EXECUTIVE");
const branch = randomUUID(), address = randomUUID(), order = randomUUID();
const stamp = "UTC_TIMESTAMP(6)";
async function request(route, who = superadmin, method = "GET", body, expected = 200) {
  const response = await fetch(api + route, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${(expected !== response.status ? await response.text() : "").slice(0, 500)}`);
  return response;
}
function upload(extension, extra = {}) {
  const type = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  const form = new FormData();
  form.append("file", new Blob([readFileSync(path.join(fixtures, `fixture.${extension}`))], { type }), `fixture.${extension}`);
  for (const [key, value] of Object.entries(extra)) form.append(key, String(value));
  return form;
}
async function sameBytes(route, who, extension) {
  const response = await request(route, who);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(path.join(fixtures, `fixture.${extension}`)), `Retrieval changed ${extension} bytes at ${route}`);
}
try {
  const schema = execFileSync("docker", ["exec", container, "sh", "-c", 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --no-data --skip-comments --set-gtid-purged=OFF -u root "$MYSQL_DATABASE"'], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  dockerSql(`CREATE DATABASE \`${database}\`; USE \`${database}\`; ${schema}`);
  console.log("Prepared isolated image test schema");
  sql(`INSERT INTO branches (Id,Name,Code,Address,IsActive,Latitude,Longitude,CreatedAt,UpdatedAt) VALUES (${q(branch)},'Transparency test','IMGTEST','Kathmandu',1,27.7,85.3,${stamp},${stamp});
    INSERT INTO customers (Id,FullName,Email,Phone,PasswordHash,IsActive,CreatedAt,UpdatedAt) VALUES (${q(customer.id)},${q(customer.fullName)},${q(customer.email)},${q(customer.phone)},'unusable-test-hash',1,${stamp},${stamp});
    INSERT INTO addresses (Id,CustomerId,Label,Province,District,Municipality,Ward,StreetTole,Phone,IsDefault,Latitude,Longitude,CreatedAt,UpdatedAt) VALUES (${q(address)},${q(customer.id)},'Test','Bagmati','Kathmandu','Kathmandu','1','Test','test',1,27.7,85.3,${stamp},${stamp});`);
  for (const who of [superadmin, admin, rider, pharmacist, supervisor, executive]) {
    sql(`INSERT INTO staff_users (Id,FullName,Email,Phone,PasswordHash,Role,BranchId,IsActive,PermissionsCsv,CreatedAt,UpdatedAt) VALUES (${q(who.id)},${q(who.fullName)},${q(who.email)},${q(who.phone)},'unusable-test-hash',${q(who.role)},${q(branch)},1,${q(who.permissions.join(","))},${stamp},${stamp});`);
  }
  sql(`INSERT INTO pharmacy_orders (Id,CustomerId,AddressId,BranchId,OrderNumber,Status,PaymentStatus,PaymentMethod,Total,CreatedAt,UpdatedAt) VALUES (${q(order)},${q(customer.id)},${q(address)},${q(branch)},'IMG-TEST','OUT_FOR_DELIVERY','PENDING','BANK_TRANSFER',10,${stamp},${stamp});
    INSERT INTO delivery_assignments (Id,OrderId,DeliveryStaffId,Status,CreatedAt,UpdatedAt) VALUES (${q(randomUUID())},${q(order)},${q(rider.id)},'ARRIVED',${stamp},${stamp});`);
  sql(`INSERT INTO payment_method_configurations (Id,Code,DisplayName,DisplayOrder,IsEnabled,RequiresServerVerification,CreatedAt,UpdatedAt) VALUES (${q(randomUUID())},'BANK_TRANSFER','Bank transfer',0,1,1,${stamp},${stamp});
    INSERT INTO homepage_sections (Id,SectionKey,Title,ContentJson,DisplayOrder,Enabled,CreatedAt,UpdatedAt) VALUES (${q(randomUUID())},'trust','Trust images','{}',1,1,${stamp},${stamp});`);
  start("dotnet", [path.join(root, ".tmp-transparency-build/backend.dll"), "--urls", api], path.join(root, "backend"), {
    Authentication__SigningKey: key, ConnectionStrings__DefaultConnection: `Server=127.0.0.1;Port=${process.env.IMAGE_TEST_MYSQL_PORT || 3306};Database=${database};User=root;Password=${password};SslMode=None;AllowPublicKeyRetrieval=True`,
    Database__SeedOnStart: "false", Database__ApplyMigrationsOnStart: "false", Logging__LogLevel__Default: "Information",
    Storage__MediaRoot: path.join(fixtures, "http/media"), Storage__PrescriptionRoot: path.join(fixtures, "http/prescriptions"), Storage__OrderDocumentsRoot: path.join(fixtures, "http/documents"), Storage__MessageRoot: path.join(fixtures, "http/messages"),
    Ocr__TesseractPath: "transparency-test-no-ocr-executable",
  }, "http-backend.log");
  await ready(api + "/healthz");
  await request("/api/auth/staff-me");
  const thread = await (await request("/api/messaging/conversations", superadmin, "POST", { recipientId: admin.id, recipientType: "staff", subject: "Image verification" })).json();
  const conversationId = thread.conversation?.id ?? thread.id;
  assert.ok(conversationId, "Conversation response has no ID");
  await request("/api/field-sales/assignments", superadmin, "PUT", { executiveId: executive.id, customerId: customer.id, branchId: branch, territory: "Image test", isActive: true });
  for (const extension of ["png", "webp", "jpg"]) {
    const asset = await (await request("/api/superadmin/media", superadmin, "POST", upload(extension, { kind: "PRODUCT", altText: "Transparency fixture", isPublic: true }))).json();
    await sameBytes(asset.url, null, extension);
    const adminAsset = await (await request("/api/admin/media", admin, "POST", upload(extension, { kind: "HERO", isPublic: true }))).json();
    await sameBytes(adminAsset.url, null, extension);
    for (const who of [rider, pharmacist, supervisor]) {
      await request("/api/staff-profile/photo", who, "POST", upload(extension));
      await sameBytes("/api/staff-profile/photo", who, extension);
    }
    await request(`/api/superadmin/staff/${admin.id}/photo`, superadmin, "POST", upload(extension));
    await sameBytes("/api/staff-profile/photo", admin, extension);
    const prescription = await (await request("/api/prescriptions", customer, "POST", upload(extension))).json();
    await sameBytes(`/api/prescriptions/${prescription.id}/file`, customer, extension);
    sql(`UPDATE prescriptions SET Status='Need Clarification' WHERE Id=${q(prescription.id)};`);
    await request(`/api/prescriptions/${prescription.id}/clarification-upload`, customer, "POST", upload(extension));
    await sameBytes(`/api/prescriptions/${prescription.id}/file`, customer, extension);
    const proof = await (await request(`/api/orders/${order}/documents`, customer, "POST", upload(extension, { kind: "PAYMENT_PROOF" }))).json();
    await sameBytes(proof.url ?? proof.downloadUrl ?? `/api/orders/${order}/documents/${proof.id}`, customer, extension);
    const delivery = await (await request(`/api/delivery/orders/${order}/documents`, rider, "POST", upload(extension, { kind: "DELIVERY_PROOF" }))).json();
    await sameBytes(delivery.url ?? delivery.downloadUrl ?? `/api/delivery/orders/${order}/documents/${delivery.id}`, rider, extension);
    const message = await (await request(`/api/messaging/conversations/${conversationId}/attachments`, superadmin, "POST", upload(extension, { body: "Transparent image" }))).json();
    await sameBytes(`/api/messaging/attachments/${message.attachments[0].id}`, admin, extension);
    const receipt = await (await request("/api/field-sales/proof", executive, "POST", upload(extension))).json();
    await request("/api/field-sales/records", executive, "POST", { requestId: randomUUID(), customerId: customer.id, kind: "COLLECTION", notes: "Image test receipt", amount: 1, method: "BANK", proof: receipt.url });
    await sameBytes(receipt.url, executive, extension);
    console.log(`PASS HTTP ${extension}: Admin/SuperAdmin media, 4 staff photos, prescription/clarification, customer proof, delivery proof, messaging, sales receipt; retrieval byte-identical`);
  }
  await request("/api/superadmin/media", null, "POST", upload("png"), 403);
  const invalid = new FormData(); invalid.append("file", new Blob(["invalid"], { type: "image/png" }), "invalid.png");
  await request("/api/superadmin/media", superadmin, "POST", invalid, 400);
  for (const zipped of [false, true]) {
    const name = zipped ? "Transparency ZIP gallery" : "Transparency direct gallery";
    function importForm() {
      const form = new FormData();
      const csv = `product_name,category,unit,sale_price,branch_name,image_filename_1,image_filename_2,image_filename_3\n${name},Transparency,BOX,10,Transparency test,fixture.png,fixture.webp,fixture.jpg\n`;
      form.append("csv", new Blob([csv], { type: "text/csv" }), "gallery.csv");
      form.append("replaceExisting", "false");
      if (zipped) form.append("imagesZip", new Blob([readFileSync(path.join(fixtures, "fixtures.zip"))], { type: "application/zip" }), "fixtures.zip");
      else for (const extension of ["png", "webp", "jpg"]) form.append("images", new Blob([readFileSync(path.join(fixtures, `fixture.${extension}`))], { type: extension === "jpg" ? "image/jpeg" : `image/${extension}` }), `fixture.${extension}`);
      return form;
    }
    const preview = await (await request("/api/superadmin/products/import/preview", superadmin, "POST", importForm())).json();
    assert.equal(preview.validRows, 1, JSON.stringify(preview));
    const result = await (await request("/api/superadmin/products/import/commit", superadmin, "POST", importForm())).json();
    assert.equal(result.added, 1, JSON.stringify(result));
    const urls = sql(`SELECT i.Url FROM product_images i JOIN products p ON p.Id=i.ProductId WHERE p.Name=${q(name)} ORDER BY i.DisplayOrder;`).split("\n");
    assert.equal(urls.length, 3);
    for (const [index, extension] of ["png", "webp", "jpg"].entries()) await sameBytes(urls[index], null, extension);
    console.log(`PASS HTTP ${zipped ? "ZIP" : "multiple-file"} product import: PNG/WebP/JPEG gallery retains original bytes`);
  }
  console.log("PASS HTTP authentication and invalid-content rejection");
  writeFileSync(path.join(fixtures, "http-test-result.json"), JSON.stringify({ api: "passed", formats: ["png", "webp", "jpg"], databaseIsolation: true }, null, 2));
  if (!process.argv.includes("--skip-browser")) {
    start(process.execPath, [path.join(root, "frontend/node_modules/next/dist/bin/next"), "start", "-p", "3037"], path.join(root, "frontend"), { BACKEND_INTERNAL_URL: api }, "http-frontend.log");
    await ready(ui + "/staff/login");
    const require = createRequire(import.meta.url);
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "../../.tmp-live-map-tools/node_modules/playwright");
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
    await verifyBrowser();
  }
} finally {
  await browser?.close();
  for (const child of children) child.kill();
  dockerSql(`DROP DATABASE IF EXISTS \`${database}\`;`);
  console.log("Cleaned up isolated image test database and servers");
}

async function verifyBrowser() {
  const cases = [
    [superadmin, "/superadmin/media", "Image file"],
    [superadmin, "/superadmin/popups", "Popup image"],
    [superadmin, "/superadmin/website/design", "Website logo image"],
    [superadmin, "/superadmin/website", "Asset image"],
    [superadmin, "/superadmin/website", "Clear product information"],
    [superadmin, "/superadmin/website", "How verification works"],
    [superadmin, "/superadmin/website", "Delivering across Nepal"],
    [superadmin, "/superadmin/payment-methods", "Payment QR image"],
    [superadmin, "/superadmin/website/hero-slides/create", "Desktop image"],
    [superadmin, "/superadmin/website/hero-slides/create", "Mobile image"],
    [admin, "/admin/website/hero-slides/create", "Desktop image"],
    [admin, "/admin/website/hero-slides/create", "Mobile image"],
    [superadmin, "/superadmin/articles/create", "Featured image"],
    [admin, "/admin/articles/create", "Featured image"],
    [superadmin, "/superadmin/products/create", "Add product images"],
    [admin, "/admin/products/create", "Add product images"],
    [superadmin, "/superadmin/catalog/import", "Import images"],
    [admin, "/admin/catalog/import", "Import images"],
    [superadmin, `/superadmin/staff/${admin.id}/edit`, "Profile photo"],
    [rider, "/delivery/profile", "Profile photo"],
    [pharmacist, "/pharmacist/profile", "Profile photo"],
    [customer, "/prescription", "Prescription file"],
    [customer, `/orders/${order}`, "Payment proof"],
    [rider, `/delivery/orders/${order}`, "Delivery proof"],
    [executive, "/sales-executive/collections/create", "Receipt image"],
    [superadmin, "/messages", "Attach a file"],
  ];
  const results = [];
  for (const [who, route, label] of cases.filter(entry => !process.env.IMAGE_TEST_BROWSER_LABELS || process.env.IMAGE_TEST_BROWSER_LABELS.split(",").includes(entry[2]))) {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    await context.addInitScript(who => {
      const prefix = who.role === "CUSTOMER" ? "anhh" : "anhh-staff";
      localStorage.setItem(`${prefix}-access-token`, who.token);
      localStorage.setItem(who.role === "CUSTOMER" ? "anhh-customer" : "anhh-staff", JSON.stringify(who));
    }, who);
    await context.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      try { const response = await route.fetch({ url: api + url.pathname + url.search, headers: { ...route.request().headers(), host: new URL(api).host } }); await route.fulfill({ response }); }
      catch { await route.abort(); }
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(ui + route, { waitUntil: "domcontentloaded" });
      if (label === "Website logo image") await page.getByRole("button", { name: "Website logo", exact: true }).click();
      if (label === "Delivery proof") { await page.getByRole("button", { name: "Delivered", exact: true }).click(); }
      const input = page.getByLabel(new RegExp(`^${label}(?:\\s*\\*)?$`));
      await input.waitFor({ state: "attached" });
      await page.waitForFunction(label => {
        const element = Array.from(document.querySelectorAll("label")).find(node => node.textContent.replace(/\s*\*$/, "") === label);
        const input = element && document.getElementById(element.htmlFor);
        return input && !input.disabled && Object.keys(input).some(key => key.startsWith("__reactProps") && input[key]?.onChange);
      }, label);
      if (label === "Profile photo") {
        await page.waitForFunction(() => Array.from(document.images).some(img => img.alt === "Profile photo preview" && img.complete && img.naturalWidth === 48));
      }
      async function waitForPicker() {
        await page.waitForFunction(label => {
          const element = Array.from(document.querySelectorAll("label")).find(node => node.textContent.replace(/\s*\*$/, "") === label);
          const input = element && document.getElementById(element.htmlFor);
          return input && !input.disabled;
        }, label);
      }
      for (const extension of ["png", "webp", "jpg"]) {
        await waitForPicker();
        await input.setInputFiles(path.join(fixtures, `fixture.${extension}`));
        if (label !== "Add product images") await page.getByText(`fixture.${extension}`, { exact: false }).first().waitFor();
        const preview = label === "Add product images" ? page.getByAltText(`Product image ${["png", "webp", "jpg"].indexOf(extension) + 1}`, { exact: true }) : page.getByAltText(`${label} preview`, { exact: true });
        await preview.waitFor();
        await preview.evaluate(img => img.decode());
        assert.equal(await preview.evaluate(img => img.naturalWidth), 48);
        const alpha = await preview.evaluate(img => {
          const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 32; const context = canvas.getContext("2d"); context.drawImage(img, 0, 0); return [...context.getImageData(0, 0, 1, 1).data];
        });
        if (extension !== "jpg") assert.equal(alpha[3], 0, `${route} preview alpha lost`);
        const checkerboard = await preview.evaluate(img => getComputedStyle(img.parentElement).backgroundImage);
        assert.ok(checkerboard.includes("gradient"), `${route} missing checkerboard preview`);
      }
      if (label === "Image file") {
        const data = readFileSync(path.join(fixtures, "fixture.png")).toString("base64");
        const transfer = await page.evaluateHandle(data => {
          const transfer = new DataTransfer();
          transfer.items.add(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], "dropped.png", { type: "image/png" }));
          return transfer;
        }, data);
        await page.getByRole("button", { name: "Choose image file", exact: true }).dispatchEvent("drop", { dataTransfer: transfer });
        await page.getByText("dropped.png", { exact: false }).waitFor();
        await transfer.dispose();
        await page.setViewportSize({ width: 393, height: 852 });
        await page.emulateMedia({ colorScheme: "dark" });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Mobile layout overflows");
        const preview = page.getByAltText("Image file preview", { exact: true });
        await preview.evaluate(img => img.decode());
        assert.ok(await preview.evaluate(img => getComputedStyle(img.parentElement).backgroundImage.includes("gradient")));
        await page.screenshot({ path: path.join(fixtures, "mobile-dark-upload.png"), fullPage: true });
      }
      if (label === "Import images") {
        await input.setInputFiles(["png", "webp", "jpg"].map(ext => path.join(fixtures, `fixture.${ext}`)));
        await page.getByAltText("Selected image 3", { exact: true }).waitFor();
        assert.equal(await page.getByAltText(/^Selected image [1-3]$/).count(), 3);
      }
      const picker = input.locator("..");
      await waitForPicker();
      await input.setInputFiles({ name: "invalid.exe", mimeType: "application/octet-stream", buffer: Buffer.from("invalid") });
      await picker.getByRole("alert").filter({ hasText: /not supported/ }).waitFor();
      await input.setInputFiles({ name: "oversized.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
      await picker.getByRole("alert").filter({ hasText: /MB or smaller/ }).waitFor();
      const remove = picker.getByRole("button", { name: "Remove", exact: true });
      if (await remove.count()) { await remove.click(); assert.equal(await picker.locator('img[src^="blob:"]').count(), 0, "Removed preview remains"); }
      if (label === "Add product images") {
        await page.getByRole("button", { name: "Remove image 2", exact: true }).click();
        assert.equal(await page.locator('img[alt^="Product image "]').count(), 2);
      }
      assert.deepEqual(errors.filter(message => !message.startsWith("Minified React error #418;")), [], `${route} browser errors`);
      results.push({ route, label, result: "passed", hydrationWarnings: errors });
      console.log(`PASS browser ${route} / ${label}: PNG/WebP/JPEG previews and alpha`);
    } catch (error) {
      results.push({ route, label, result: "failed", message: error.message });
      await page.screenshot({ path: path.join(fixtures, `failure-${results.length}.png`), fullPage: true });
      console.log(`FAIL browser ${route} / ${label}: ${error.message.split("\n")[0]}`);
    }
    await context.close();
  }
  writeFileSync(path.join(fixtures, process.env.IMAGE_TEST_BROWSER_LABELS ? "browser-extra-test-result.json" : "browser-test-result.json"), JSON.stringify(results, null, 2));
  assert.ok(results.every(x => x.result === "passed"), "Some upload locations failed browser verification; see browser-test-result.json");
}
