import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "../../.tmp-live-map-tools/node_modules/playwright");
const session = JSON.parse(readFileSync(path.resolve("../.tmp-finance-audit/session.json"), "utf8"));
const base = process.env.UI_TEST_URL || "http://127.0.0.1:3017";
const api = process.env.FINANCE_TEST_API_URL || "http://localhost:5019";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const errors = [];
async function contextFor(staff) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(staff => { localStorage.setItem("anhh-staff", JSON.stringify(staff)); localStorage.setItem("anhh-staff-access-token", staff.token); }, staff);
  await context.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    const response = await route.fetch({ url: api + url.pathname + url.search, headers: { ...request.headers(), host: new URL(api).host } });
    if (!response.ok()) console.log("Diagnostic API response", request.method(), url.pathname, response.status());
    await route.fulfill({ response });
  });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => console.log("Browser request failed", new URL(request.url()).pathname, request.failure()?.errorText));
  return { context, page };
}
let page;
try {
  ({ page } = await contextFor(session.operator));
  await page.goto(base + "/sales-purchase", { waitUntil: "networkidle" });
  await page.getByRole("menuitem", { name: "Account-Department", exact: true }).waitFor();
  async function open(group, label) {
    await page.getByRole("menuitem", { name: group, exact: true }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("dialog").last().waitFor();
    await page.waitForTimeout(450);
    assert.equal(await page.getByRole("alert").count(), 0, `${label} showed an error`);
  }
  const accountItems = ["Cash Receipt Edit", "Draft Receipt Edit", "Credit Note Edit", "Debit Note Edit", "Cash Receipt Print", "Draft Receipt Print", "Credit Note Print", "Debit Note Print", "Collection/Adjustment Register", "Cash Collection"];
  const journalItems = ["Journal Voucher Entry", "Expense/ Purchase Voucher Entry", "Cheque Print", "Payment Voucher", "Receipt Voucher", "Narration Edit", "Post To Ledger", "UnPost To Edit", "Voucher Edit", "Voucher Print", "Show Auto-Vouchers", "Journal Book", "Supplier A/C Credit Entry", "Supplier Debit Note", "Supplier Debit Note Book", "Supplier In-Complete Reconciliation Book"];
  for (const [group, items] of [["Account-Department", accountItems], ["Journal Voucher Section", journalItems]]) {
    for (const label of items) { await open(group, label); await page.keyboard.press("Escape"); await page.getByRole("dialog").waitFor({ state: "hidden" }); console.log("PASS real financial menu:", label); }
  }
  await page.getByRole("menuitem", { name: "Account-Department", exact: true }).click();
  await page.getByRole("menuitem", { name: "Debtor Account", exact: true }).hover();
  await page.getByRole("button", { name: "Debtor Ledger", exact: true }).click();
  await page.getByRole("button", { name: "View ledger", exact: true }).click();
  await page.getByRole("dialog").last().getByText("Running balance", { exact: true }).waitFor();
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  console.log("PASS debtor account opens real transaction ledger");
  await open("Account-Department", "Cash Receipt Edit");
  const name = "Browser financial receipt " + Date.now();
  await page.getByLabel("Voucher invoice", { exact: true }).selectOption(session.invoiceId);
  await page.getByLabel("Voucher reference", { exact: true }).fill(name);
  await page.getByLabel("Voucher amount", { exact: true }).fill("12");
  await page.getByLabel("Voucher narration", { exact: true }).fill(name);
  let saved = page.waitForResponse(response => response.url().includes("/finance/vouchers") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save", exact: true }).click(); const first = await (await saved).json();
  await page.getByText(`Edit ${first.number} · DRAFT`, { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 1);
  await page.getByLabel("Voucher amount", { exact: true }).fill("15");
  saved = page.waitForResponse(response => response.url().endsWith("/finance/vouchers/" + first.id) && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save & List", exact: true }).click(); await saved;
  const row = page.getByRole("dialog").last().getByRole("row").filter({ hasText: first.number }); await row.waitFor(); assert.equal(await row.count(), 1);
  await row.getByRole("button", { name: "Post to Ledger", exact: true }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "Confirm", exact: true }).click();
  await row.getByText("POSTED", { exact: true }).waitFor();
  assert.equal(await row.getByRole("button", { name: "Edit", exact: true }).count(), 0);
  await row.getByRole("button", { name: "Print", exact: true }).click();
  await page.getByRole("dialog").last().getByText(name, { exact: true }).first().waitFor();
  await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event("afterprint")); });
  await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
  mkdirSync(path.resolve("../.tmp-finance-audit"), { recursive: true });
  await page.screenshot({ path: path.resolve("../.tmp-finance-audit/financial-receipt-preview.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await row.getByRole("button", { name: "Unpost to Edit", exact: true }).click();
  await page.getByLabel("Financial audit reason", { exact: true }).fill("Browser verification reversal");
  await page.getByRole("dialog").last().getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("row").filter({ hasText: first.number }).getByText("DRAFT", { exact: true }).waitFor();
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  console.log("PASS real browser Save, Save & List, ledger posting, print preview and audited unpost");
  await open("Journal Voucher Section", "Payment Voucher");
  await page.getByLabel("Voucher payment method", { exact: true }).selectOption("CHEQUE");
  await page.getByLabel("Cheque number", { exact: true }).waitFor(); await page.getByLabel("Bank name", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "List", exact: true }).click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  console.log("PASS cheque fields and mobile editor/list layout");
  const reader = await contextFor(session.reader); await reader.page.goto(base + "/sales-purchase", { waitUntil: "networkidle" });
  await reader.page.getByRole("menuitem", { name: "Account-Department", exact: true }).click();
  assert.equal(await reader.page.getByRole("button", { name: "Cash Receipt Edit", exact: true }).count(), 0);
  assert.equal(await reader.page.getByRole("button", { name: "Cash Receipt Print", exact: true }).count(), 0);
  await reader.page.getByRole("button", { name: "Collection/Adjustment Register", exact: true }).click();
  await reader.page.getByRole("dialog").waitFor();
  assert.equal(await reader.page.getByRole("dialog").getByRole("button", { name: /^(Edit|Post to Ledger|Unpost to Edit|Narration|Print|New document)$/ }).count(), 0);
  console.log("PASS read-only role sees registers and has no unauthorized financial actions");
  const admin = await contextFor(session.admin); await admin.page.goto(base + "/superadmin/roles/create", { waitUntil: "networkidle" });
  for (const group of ["Sales & Purchase", "Account Department", "Journal Voucher Section"]) await admin.page.getByText(group, { exact: true }).last().waitFor();
  for (const key of ["sales_purchase.view", "sales_purchase.receipts.manage", "sales_purchase.notes.manage", "sales_purchase.vouchers.post", "sales_purchase.vouchers.unpost"]) await admin.page.getByText(key, { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS roles editor exposes the new permission groups; no browser runtime errors");
} catch (error) { if (page) console.log("Financial UI failure", (await page.locator("body").innerText()).slice(-3000)); throw error; }
finally { await browser.close(); }
