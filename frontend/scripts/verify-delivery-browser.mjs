import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "../../.tmp-live-map-tools/node_modules/playwright");
const auditDirectory = path.resolve(import.meta.dirname, "../../.tmp-delivery-audit");
const s = JSON.parse(readFileSync(path.join(auditDirectory, "session.json"), "utf8"));
const base = process.env.DELIVERY_TEST_UI_URL || "http://localhost:3001";
const api = process.env.DELIVERY_TEST_API_URL || "http://localhost:5019";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const errors = [];
const contexts = [];
async function view(account, pathname, options = {}) {
  const context = await browser.newContext({ serviceWorkers: "block", geolocation: { latitude: 27.701, longitude: 85.301, accuracy: 10 }, permissions: ["geolocation"], ...options });
  contexts.push(context);
  await context.addInitScript(account => {
    const customer = account.role === "CUSTOMER";
    localStorage.setItem(customer ? "anhh-access-token" : "anhh-staff-access-token", account.token);
    localStorage.setItem(customer ? "anhh-customer" : "anhh-staff", JSON.stringify(account));
  }, account);
  await context.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    try { const response = await route.fetch({ url: api + url.pathname + url.search, headers: { ...route.request().headers(), host: new URL(api).host } }); await route.fulfill({ response }); }
    catch { await route.abort().catch(() => {}); }
  });
  await context.route("https://tile.openstreetmap.org/**", route => route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + pathname, { waitUntil: "domcontentloaded" });
  return { page, context };
}
try {
  const id = s.browserOrderId;
  const rider = await view(s.rider, `/delivery/orders/${id}`, { viewport: { width: 390, height: 844 } });
  const customer = await view(s.customer, `/orders/${id}`);
  const pharmacist = await view(s.pharmacist, `/pharmacist/orders/${id}`);
  await rider.page.getByText(s.notes, { exact: false }).waitFor();
  assert.equal(await rider.page.locator('input[type="file"]').count(), 0);
  await rider.page.getByLabel("Delivery map", { exact: true }).waitFor();
  await rider.page.getByText(/Map tiles could not load/).first().waitFor();
  assert.ok(await rider.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Assigned page overflows mobile viewport");
  await rider.page.getByRole("button", { name: "Accept delivery", exact: true }).click();
  await rider.page.getByRole("button", { name: "Arrived", exact: true }).waitFor();
  assert.equal(await rider.page.locator('input[type="file"]').count(), 0);
  assert.equal(await rider.page.getByRole("button", { name: "Delivered", exact: true }).count(), 0);
  await rider.page.getByText("Tracking active", { exact: true }).waitFor();
  const denied = await view(s.rider, `/delivery/orders/${id}`, { permissions: [] });
  await denied.page.getByText(/Location permission is required for live delivery tracking/).first().waitFor();
  await denied.page.getByRole("button", { name: "Retry location access", exact: true }).waitFor();
  assert.equal(await denied.page.getByRole("button", { name: "Stop sharing location", exact: true }).count(), 0);
  await denied.page.getByRole("button", { name: "Arrived", exact: true }).waitFor();
  await denied.context.close();
  await rider.page.getByRole("button", { name: "Arrived", exact: true }).click();
  await rider.page.getByRole("button", { name: "Delivered", exact: true }).waitFor();
  await rider.page.getByText("Arrived at destination", { exact: true }).waitFor();
  mkdirSync(auditDirectory, { recursive: true });
  await rider.page.screenshot({ path: path.join(auditDirectory, "rider-arrived-mobile.png"), fullPage: true });
  await customer.page.getByText("ARRIVED", { exact: true }).first().waitFor({ timeout: 25000 });
  await pharmacist.page.getByText(/Delivery test rider · ARRIVED/).waitFor({ timeout: 25000 });
  await pharmacist.page.getByText(s.notes, { exact: true }).waitFor();
  const managers = [];
  const number = "DT-" + id.slice(0, 8);
  for (const [account, root] of [[s.admin, "/admin"], [s.superadmin, "/superadmin"]]) {
    const manager = await view(account, `${root}/orders`);
    await manager.page.getByLabel("Search orders", { exact: true }).fill(number);
    await manager.page.getByRole("button", { name: `View ${number}`, exact: true }).click();
    await manager.page.getByRole("dialog").getByText(s.notes, { exact: true }).waitFor();
    await manager.page.getByRole("dialog").getByText(/Delivery test rider · ARRIVED/).first().waitFor();
    managers.push(manager);
  }
  assert.equal(await rider.page.locator('input[type="file"]').count(), 0);
  await rider.page.getByRole("button", { name: "Delivered", exact: true }).click();
  await rider.page.getByRole("region", { name: "Complete delivery" }).waitFor();
  const requirements = await (await fetch(`${api}/api/delivery/orders/${id}/requirements`, { headers: { Authorization: `Bearer ${s.rider.token}` } })).json();
  // Use the existing offline queue for an actual proof file.
  await rider.page.waitForResponse(response => response.url().includes("/offline/capabilities") && response.ok(), { timeout: 1000 }).catch(() => {});
  await rider.context.setOffline(true);
  await rider.page.getByText(/Offline. Reconnect for status changes/).waitFor();
  assert.equal(await rider.page.getByRole("button", { name: "Confirm delivered", exact: true }).isDisabled(), true);
  const kind = requirements.requiredDocumentTypes[0] || "DELIVERY_PROOF";
  await rider.page.getByLabel("Proof document type").selectOption(kind);
  await rider.page.getByLabel("Upload delivery proof").setInputFiles({ name: "browser-delivery-proof.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF") });
  await rider.page.getByText("browser-delivery-proof.pdf", { exact: true }).waitFor();
  await rider.context.setOffline(false);
  await rider.page.getByText(/Offline. Reconnect for status changes/).waitFor({ state: "hidden", timeout: 30000 });
  // Poll server to verify the queued upload synchronized, once only.
  let serverFiles = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    serverFiles = await (await fetch(`${api}/api/delivery/orders/${id}/documents`, { headers: { Authorization: `Bearer ${s.rider.token}` } })).json();
    if (serverFiles.some(file => file.originalFileName === "browser-delivery-proof.pdf")) break;
    await rider.page.waitForTimeout(1000);
  }
  assert.equal(serverFiles.filter(file => file.originalFileName === "browser-delivery-proof.pdf").length, 1);
  for (const other of [...new Set([...requirements.requiredDocumentTypes, "DELIVERY_PROOF"])].filter(value => value !== kind)) {
    await rider.page.getByLabel("Proof document type").selectOption(other);
    await rider.page.getByLabel("Upload delivery proof").setInputFiles({ name: `browser-${other}.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF") });
    await rider.page.getByText(`browser-${other}.pdf`, { exact: true }).waitFor();
  }
  await rider.page.getByRole("button", { name: "Confirm delivered", exact: true }).click();
  await rider.page.getByRole("heading", { name: "Delivery proof", exact: true }).waitFor();
  await rider.page.getByRole("heading", { name: "DELIVERED", exact: true }).waitFor();
  await customer.page.getByRole("heading", { name: "Delivery proof", exact: true }).waitFor({ timeout: 25000 });
  await pharmacist.page.getByText(/Delivery test rider · DELIVERED/).waitFor({ timeout: 25000 });
  for (const manager of managers) {
    await manager.page.getByRole("dialog").getByText(/Delivery test rider · DELIVERED/).first().waitFor({ timeout: 25000 });
    await manager.page.getByRole("dialog").getByRole("button", { name: /browser-delivery-proof.pdf/ }).waitFor();
  }
  assert.ok(await rider.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Delivered page overflows mobile viewport");
  mkdirSync(auditDirectory, { recursive: true });
  await rider.page.evaluate(() => window.scrollTo(0, 0));
  await rider.page.waitForTimeout(250);
  await rider.page.screenshot({ path: path.join(auditDirectory, "rider-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS browser sequence, customer/pharmacist/admin/superadmin auto-refresh, offline proof sync, denied GPS, map failure and mobile layout");
} catch (error) {
  for (const context of contexts) for (const page of context.pages()) console.log("Delivery test page", page.url(), (await page.locator("body").innerText()).slice(-1800));
  throw error;
} finally { for (const context of contexts) await context.close(); await browser.close(); }
