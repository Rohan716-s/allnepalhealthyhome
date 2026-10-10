import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "../../.tmp-live-map-tools/node_modules/playwright");
const session = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../.tmp-delivery-audit/session.json"), "utf8"));
const api = process.env.DELIVERY_TEST_API_URL || "http://localhost:5019";
const base = process.env.DELIVERY_TEST_UI_URL || "http://localhost:3001";
const screenshots = path.resolve(import.meta.dirname, "../../.tmp-rider-map-audit");
mkdirSync(screenshots, { recursive: true });
const id = session.browserOrderId;
const sql = input => execFileSync("docker", ["exec", "-i", "allnepalhealthy-mysql", "sh", "-c", 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root "$MYSQL_DATABASE"'], { input, encoding: "utf8" }).trim();
// Only the isolated delivery verification fixture changes state. The user's
// recorded order and its branch/address coordinates are never modified.
assert.ok(session.orders.includes(id));
const previousStatus = sql(`SELECT Status FROM delivery_assignments WHERE OrderId='${id}';`);
assert.match(previousStatus, /^[A-Z_]+$/);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const contexts = [], errors = [];
let failedRequests = 0;
async function open({ missing = false, denied = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, permissions: denied ? [] : ["geolocation"], geolocation: { latitude: 27.702, longitude: 85.302, accuracy: 10 }, serviceWorkers: "block" });
  contexts.push(context);
  await context.addInitScript(account => {
    localStorage.setItem("anhh-staff-access-token", account.token);
    localStorage.setItem("anhh-staff", JSON.stringify(account));
    window.__gpsWatches = 0;
    const watch = navigator.geolocation.watchPosition.bind(navigator.geolocation);
    navigator.geolocation.watchPosition = (...args) => { window.__gpsWatches++; return watch(...args); };
  }, session.rider);
  await context.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/failed") && route.request().method() === "POST") failedRequests++;
    try {
      const response = await route.fetch({ url: api + url.pathname + url.search, headers: { ...route.request().headers(), host: new URL(api).host } });
      if (missing && url.pathname === `/api/delivery/orders/${id}` && route.request().method() === "GET" && response.ok()) {
        const data = await response.json();
        data.address.latitude = null; data.address.longitude = null; data.delivery.pickup = null;
        await route.fulfill({ response, json: data });
      } else await route.fulfill({ response });
    } catch { await route.abort().catch(() => {}); }
  });
  await context.route("https://tile.openstreetmap.org/**", route => route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/delivery/orders/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Delivery map", { exact: true }).waitFor();
  return { context, page };
}
try {
  sql(`UPDATE delivery_assignments SET Status='ACCEPTED' WHERE OrderId='${id}';`);
  const { page } = await open();
  await page.getByText("Tracking active", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Stop sharing location", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Show my location", exact: true }).count(), 0);
  const map = page.getByLabel("Delivery map", { exact: true });
  const assertFitted = async () => {
    await map.scrollIntoViewIfNeeded();
    const bounds = await map.boundingBox();
    for (const type of ["pickup", "rider", "destination"]) {
      const marker = map.locator(`[data-map-marker="${type}"]`);
      await marker.waitFor();
      const point = await marker.boundingBox();
      assert.ok(point.x >= bounds.x && point.y >= bounds.y && point.x + point.width <= bounds.x + bounds.width && point.y + point.height <= bounds.y + bounds.height, `${type} marker outside map`);
    }
  };
  await assertFitted();
  await page.getByRole("button", { name: "Destination", exact: true }).click();
  await page.getByRole("button", { name: "Fit route", exact: true }).click();
  await assertFitted();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.getByRole("button", { name: "Fit route", exact: true }).click();
  await assertFitted();
  await page.getByText(/Map tiles could not load/).waitFor();
  await page.screenshot({ path: path.join(screenshots, "rider-route-desktop.png"), fullPage: true });
  await page.evaluate(() => {
    const marker = document.querySelector('[data-map-marker="rider"]');
    window.scrollBy(0, marker.getBoundingClientRect().top - 35);
  });
  assert.ok(await page.evaluate(() => {
    const marker = document.querySelector('[data-map-marker="rider"]');
    const rect = marker.getBoundingClientRect();
    return !!document.elementFromPoint(rect.x + rect.width / 2, 35)?.closest("header");
  }), "A map marker covers the sticky header");
  await page.getByText("Rider note / report an issue", { exact: true }).click();
  await page.getByRole("button", { name: "Delivery failed", exact: true }).click();
  await page.getByText("Enter a delivery failure reason first.", { exact: true }).waitFor();
  assert.equal(failedRequests, 0);
  assert.ok(await page.getByRole("textbox", { name: /^Failure reason \(required\)/ }).evaluate(input => input === document.activeElement));
  await page.getByRole("textbox", { name: /^Failure reason \(required\)/ }).fill("Verification only; do not submit");
  assert.equal(await page.getByText("Enter a delivery failure reason first.", { exact: true }).count(), 0);
  const mobile = await open({ mobile: true, missing: true });
  await mobile.page.getByText("Tracking active", { exact: true }).waitFor();
  await mobile.page.getByText(/Pickup pin unavailable/).waitFor();
  await mobile.page.getByText(/Destination pin unavailable/).waitFor();
  assert.equal(await mobile.page.locator('[data-map-marker="pickup"], [data-map-marker="destination"]').count(), 0);
  const navigation = await mobile.page.getByRole("link", { name: "Navigate to destination", exact: true }).getAttribute("href");
  assert.ok(decodeURIComponent(navigation).includes("Verification reception"));
  assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.page.screenshot({ path: path.join(screenshots, "rider-route-missing-pins-mobile.png"), fullPage: true });
  const denied = await open({ denied: true });
  await denied.page.getByText(/Location permission is required for live delivery tracking/).waitFor();
  await denied.page.getByRole("button", { name: "Retry location access", exact: true }).waitFor();
  const before = await denied.page.evaluate(() => window.__gpsWatches);
  await denied.page.waitForResponse(response => response.url().includes(`/api/delivery/orders/${id}`) && response.ok());
  assert.equal(await denied.page.evaluate(() => window.__gpsWatches), before, "Denied GPS must not restart on polling");
  await denied.page.getByRole("button", { name: "Retry location access", exact: true }).click();
  await denied.page.waitForFunction(count => window.__gpsWatches > count, before);
  assert.deepEqual(errors, []);
  console.log("PASS rider route: auto GPS, no stop/duplicate controls, all pins fitted, focus/reset/zoom, marker clipping under header, inline failure validation, missing coordinates, address navigation, denied GPS/retry, tile failures, mobile layout.");
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  sql(`UPDATE delivery_assignments SET Status='${previousStatus}' WHERE OrderId='${id}';`);
}
