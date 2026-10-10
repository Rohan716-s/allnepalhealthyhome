import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

// Uses a diagnostic API with a separate signing key; never forge production tokens.
const base = process.env.FINANCE_TEST_API_URL || "http://localhost:5019";
const signingKey = process.env.FINANCE_TEST_SIGNING_KEY || "financial-verification-local-only-separate-signing-key";
const auditDirectory = path.resolve("../.tmp-finance-audit");
const sessionPath = path.join(auditDirectory, "session.json");
const prefix = "sales_purchase.";
const all = ["view", "sales.view", "sales.manage", "purchase.view", "purchase.manage", "accounts.view", "receipts.manage", "notes.manage", "journal.view", "journal.manage", "vouchers.post", "vouchers.unpost", "vouchers.narration", "vouchers.print"].map(x => prefix + x);
function sql(input) {
  return execFileSync("docker", ["exec", "-i", "allnepalhealthy-mysql", "sh", "-c", 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root "$MYSQL_DATABASE"'], { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).trim();
}
const quote = value => `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
function token(staff) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: staff.id, role: staff.role, type: "staff", email: staff.email, name: staff.fullName, branchId: staff.branchId, permissions: staff.permissions, exp: Math.floor(Date.now() / 1000) + 7200 })).toString("base64url");
  return `${header}.${payload}.${createHmac("sha256", signingKey).update(`${header}.${payload}`).digest("base64url")}`;
}
export function cleanup(session) {
  const actors = [session.admin.id, session.operator.id, session.reader.id].map(quote).join(",");
  sql(`SET @customer=${quote(session.customerId)}; SET @supplier=${quote(session.supplierId)};
DELETE j FROM journal_entries j JOIN financial_vouchers v ON j.Reference=v.Number WHERE v.CreatedBy IN (${actors});
DELETE FROM customer_ledger_entries WHERE CustomerId=@customer;
DELETE FROM customer_payments WHERE CustomerId=@customer;
DELETE FROM supplier_payments WHERE SupplierId=@supplier;
DELETE FROM financial_vouchers WHERE CreatedBy IN (${actors});
DELETE FROM activity_logs WHERE ActorId IN (${actors});
DELETE FROM invoices WHERE Id=${quote(session.invoiceId)};
DELETE FROM supplier_invoices WHERE Id=${quote(session.supplierInvoiceId)};
DELETE FROM pharmacy_orders WHERE Id=${quote(session.orderId)};
DELETE FROM customer_credit WHERE CustomerId=@customer;
DELETE FROM customers WHERE Id=@customer;
DELETE FROM suppliers WHERE Id=@supplier;
DELETE FROM staff_users WHERE Id IN (${actors});
DELETE p FROM access_role_permissions p JOIN access_roles r ON p.RoleId=r.Id WHERE r.Name=${quote(session.roleName || "UNUSED_FINANCE_TEST_ROLE")};
DELETE FROM access_roles WHERE Name=${quote(session.roleName || "UNUSED_FINANCE_TEST_ROLE")};
DELETE FROM branches WHERE Id IN (${quote(session.branchId)}, ${quote(session.otherBranchId)});`);
}
if (process.argv.includes("--cleanup")) { cleanup(JSON.parse(readFileSync(sessionPath, "utf8"))); console.log("PASS temporary financial verification records removed"); process.exit(0); }

const unique = randomUUID().slice(0, 8);
const branchId = randomUUID(), otherBranchId = randomUUID();
const makeStaff = (role, permissions, branch) => ({ id: randomUUID(), role, permissions, branchId: branch, fullName: `Financial verification ${role}`, email: `finance-${role.toLowerCase()}-${unique}@example.invalid`, isActive: true });
const session = { branchId, otherBranchId, customerId: randomUUID(), supplierId: randomUUID(), orderId: randomUUID(), invoiceId: randomUUID(), supplierInvoiceId: randomUUID(),
  roleName: `FINANCE_TEST_${unique.toUpperCase()}`,
  admin: makeStaff("SUPERADMIN", []), operator: makeStaff("FINANCE_VERIFICATION", all, branchId), reader: makeStaff("FINANCE_READER", [prefix + "view", prefix + "accounts.view", prefix + "journal.view"], branchId) };
for (const staff of [session.admin, session.operator, session.reader]) staff.token = token(staff);
let retain = false;
try {
  sql(`INSERT INTO branches (Id,Name,Address,IsActive,CreatedAt,UpdatedAt) VALUES (${quote(branchId)},'Finance verification ${unique}','Temporary diagnostic branch',1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),(${quote(otherBranchId)},'Other finance verification ${unique}','Temporary diagnostic branch',1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
${[session.admin, session.operator, session.reader].map(staff => `INSERT INTO staff_users (Id,FullName,Email,Phone,PasswordHash,Role,BranchId,PermissionsCsv,IsActive,CreatedAt,UpdatedAt) VALUES (${quote(staff.id)},${quote(staff.fullName)},${quote(staff.email)},${quote('test-' + staff.id.slice(0, 12))},'unusable-test-password-hash',${quote(staff.role)},${staff.branchId ? quote(staff.branchId) : 'NULL'},${staff.permissions.length ? quote(staff.permissions.join(',')) : 'NULL'},1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));`).join("\n")}
INSERT INTO customers (Id,FullName,Email,Phone,PasswordHash,IsActive,CreatedAt,UpdatedAt) VALUES (${quote(session.customerId)},'Finance test debtor ${unique}','finance-debtor-${unique}@example.invalid','test-${unique}','unusable-test-password-hash',1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO suppliers (Id,Name,IsActive,CreatedAt,UpdatedAt) VALUES (${quote(session.supplierId)},'Finance test supplier ${unique}',1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO pharmacy_orders (Id,CustomerId,BranchId,OrderNumber,Status,PaymentStatus,PaymentMethod,Total,CreatedAt,UpdatedAt) VALUES (${quote(session.orderId)},${quote(session.customerId)},${quote(branchId)},'FT-ORDER-${unique}','DELIVERED','UNPAID','CREDIT',1000,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO invoices (Id,OrderId,InvoiceNumber,Subtotal,TaxAmount,DiscountAmount,DeliveryFee,Total,PaidAmount,PaymentStatus,IssuedAt,CreatedAt,UpdatedAt) VALUES (${quote(session.invoiceId)},${quote(session.orderId)},'FT-INV-${unique}',1000,0,0,0,1000,0,'UNPAID',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO supplier_invoices (Id,SupplierId,BranchId,InvoiceNumber,InvoiceDate,Subtotal,TaxAmount,Total,PaidAmount,Status,CreatedAt,UpdatedAt) VALUES (${quote(session.supplierInvoiceId)},${quote(session.supplierId)},${quote(branchId)},'FT-SUP-${unique}',UTC_TIMESTAMP(6),1000,0,1000,0,'UNPAID',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));`);
  async function api(route, method = "GET", body, staff = session.operator, expected = 200) {
    const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(staff ? { Authorization: `Bearer ${staff.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${text.slice(0, 700)}`); return text ? JSON.parse(text) : null;
  }
  const root = "/api/admin/sales-purchase/finance";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const input = (type, amount, extra = {}) => ({ type, voucherDate: today, reference: `FT-${unique}-${type}`, narration: `Financial verification ${type}`, debitAccount: "Cash", creditAccount: "Accounts Receivable", amount, method: "CASH", branchId, ...extra });
  const create = body => api(root + "/vouchers", "POST", body);
  const post = row => api(`${root}/vouchers/${row.id}/post`, "POST", { revision: row.revision });
  const unpost = row => api(`${root}/vouchers/${row.id}/unpost`, "POST", { revision: row.revision, reason: "Diagnostic reversal verification" });
  const invoice = () => JSON.parse(sql(`SELECT JSON_OBJECT('total',Total,'paid',PaidAmount,'status',PaymentStatus) FROM invoices WHERE Id=${quote(session.invoiceId)};`));
  const supplier = () => JSON.parse(sql(`SELECT JSON_OBJECT('total',Total,'paid',PaidAmount) FROM supplier_invoices WHERE Id=${quote(session.supplierInvoiceId)};`));
  await api(root + "/options", "GET", undefined, null, 403);
  const permissions = await api("/api/superadmin/permissions", "GET", undefined, session.admin);
  assert.ok(all.every(key => permissions.some(row => row.key === key)));
  const roleInput = permissions => ({ name: session.roleName, displayName: "Temporary financial verification role", description: "Diagnostic permission verification", isActive: true, permissions });
  const customRole = await api("/api/superadmin/roles", "POST", roleInput(all), session.admin);
  sql(`UPDATE staff_users SET Role=${quote(session.roleName)} WHERE Id=${quote(session.operator.id)};`);
  session.operator.role = session.roleName;
  await api(root + "/options?branchId=" + otherBranchId, "GET", undefined, session.operator, 403);
  const options = await api(root + "/options"); assert.ok(options.customerInvoices.some(x => x.id === session.invoiceId)); assert.ok(options.branches.every(x => x.id === branchId));
  await api(root + "/vouchers", "POST", input("JOURNAL", 10, { creditAccount: "Other Income" }), session.reader, 403);
  await api("/api/admin/sales-purchase/purchases", "GET", undefined, session.reader, 403);
  await api("/api/admin/sales-purchase/sales", "GET", undefined, session.reader, 403);
  console.log("PASS permission catalog, custom role, read-only denial and branch boundaries");
  let cash = await create(input("CASH_RECEIPT", 100, { invoiceId: session.invoiceId })); assert.equal(invoice().paid, 0);
  const savedList = await api(`${root}/vouchers?from=${today}&to=${today}&type=CASH_RECEIPT&branchId=${branchId}`);
  assert.ok(savedList.some(x => x.id === cash.id));
  const concurrent = await Promise.all([fetch(`${base}${root}/vouchers/${cash.id}/post`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.operator.token}` }, body: JSON.stringify({ revision: cash.revision }) }), fetch(`${base}${root}/vouchers/${cash.id}/post`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.operator.token}` }, body: JSON.stringify({ revision: cash.revision }) })]);
  assert.deepEqual(concurrent.map(x => x.status).sort(), [200, 409]); cash = await api(`${root}/vouchers/${cash.id}`); assert.equal(invoice().paid, 100);
  await api(`${root}/vouchers/${cash.id}/post`, "POST", { revision: cash.revision }, session.operator, 409);
  await api(`${root}/vouchers/${cash.id}`, "PUT", { ...input("CASH_RECEIPT", 110, { invoiceId: session.invoiceId }), revision: cash.revision }, session.operator, 409);
  cash = await api(`${root}/vouchers/${cash.id}/narration`, "PUT", { revision: cash.revision, narration: "Updated diagnostic narration", reason: "Verify audited narration edit" });
  assert.equal((await api(`${root}/vouchers/${cash.id}/print`)).narration, "Updated diagnostic narration");
  await api(`${root}/vouchers/${cash.id}/print`, "GET", undefined, session.reader, 403);
  cash = await unpost(cash); assert.equal(invoice().paid, 0);
  await api(`${root}/vouchers/${cash.id}`, "PUT", { ...input("CASH_RECEIPT", 120, { invoiceId: session.invoiceId }), revision: cash.revision - 1 }, session.operator, 409);
  cash = await api(`${root}/vouchers/${cash.id}`, "PUT", { ...input("CASH_RECEIPT", 120, { invoiceId: session.invoiceId }), revision: cash.revision }); cash = await post(cash); assert.equal(invoice().paid, 120);
  await api(`/api/admin/sales-purchase/sales/${session.orderId}/void`, "POST", { reason: "Verify linked financial voucher safeguard" }, session.operator, 409);
  await api("/api/admin/sales-purchase/sales-returns", "POST", { orderId: session.orderId, productId: randomUUID(), quantity: 1, reason: "Verify linked voucher safeguard", refundMethod: "CREDIT", expiredReturn: false }, session.operator, 409);
  const excessive = await create(input("CASH_RECEIPT", 9999, { invoiceId: session.invoiceId })); await api(`${root}/vouchers/${excessive.id}/post`, "POST", { revision: excessive.revision }, session.operator, 409); assert.equal(invoice().paid, 120);
  console.log("PASS draft isolation, concurrent post once, posted edit denial, stale edit, narration, print, unpost/repost and overpayment rejection");
  let note = await create(input("CREDIT_NOTE", 50, { invoiceId: session.invoiceId, debitAccount: "Sales Adjustments" })); note = await post(note); assert.equal(invoice().total, 950);
  let debit = await create(input("DEBIT_NOTE", 25, { invoiceId: session.invoiceId, debitAccount: "Accounts Receivable", creditAccount: "Other Income" })); debit = await post(debit); assert.equal(invoice().total, 975);
  const summary = await api("/api/accountant/accounting-summary", "GET", undefined, session.admin);
  assert.ok(summary.trialBalance.every(x => Number.isFinite(x.balance)));
  await unpost(debit); await unpost(note); assert.equal(invoice().total, 1000);
  let supplierNote = await create(input("SUPPLIER_DEBIT", 70, { supplierInvoiceId: session.supplierInvoiceId, debitAccount: "Accounts Payable", creditAccount: "Purchase Adjustments" })); supplierNote = await post(supplierNote); assert.equal(supplier().total, 930);
  let supplierCredit = await create(input("SUPPLIER_CREDIT", 20, { supplierInvoiceId: session.supplierInvoiceId, debitAccount: "Purchase Adjustments", creditAccount: "Accounts Payable" })); supplierCredit = await post(supplierCredit); assert.equal(supplier().total, 950);
  let payment = await create(input("PAYMENT", 80, { supplierInvoiceId: session.supplierInvoiceId, debitAccount: "Accounts Payable", creditAccount: "Bank", method: "CHEQUE", chequeNumber: "FT-123", bankName: "Test bank", payee: "Test supplier" })); payment = await post(payment); assert.equal(supplier().paid, 80);
  await unpost(payment); await unpost(supplierCredit); await unpost(supplierNote); assert.deepEqual(supplier(), { total: 1000, paid: 0 });
  for (const type of ["JOURNAL", "EXPENSE_PURCHASE", "RECEIPT", "DRAFT_RECEIPT"]) {
    let row = await create(input(type, 10, { debitAccount: type === "EXPENSE_PURCHASE" ? "Business Expenses" : "Bank", creditAccount: type === "DRAFT_RECEIPT" ? "Accounts Receivable" : type === "EXPENSE_PURCHASE" ? "Cash" : "Other Income", ...(type === "DRAFT_RECEIPT" ? { invoiceId: session.invoiceId, method: "BANK_TRANSFER" } : {}) })); row = await post(row);
    if (type === "EXPENSE_PURCHASE") { const scopedSummary = await api("/api/accountant/accounting-summary"); assert.equal(scopedSummary.expenses, 10); }
    await unpost(row);
  }
  console.log("PASS all ten voucher types, customer/supplier balance adjustments, cheque payment and reversals");
  const automatic = await api(root + "/auto-vouchers"); assert.ok(automatic.some(x => x.reference === `FT-INV-${unique}`));
  const ledger = await api(root + "/debtor-ledger/" + session.customerId); assert.ok(ledger.entries.some(x => x.amount === 120));
  await api(`/api/superadmin/roles/${customRole.id}`, "PUT", roleInput([prefix + "view", prefix + "accounts.view", prefix + "journal.view"]), session.admin);
  await api(root + "/vouchers", "POST", input("JOURNAL", 10, { creditAccount: "Other Income" }), session.operator, 403);
  await api(`/api/superadmin/roles/${customRole.id}`, "PUT", roleInput(all), session.admin);
  const refreshed = await api("/api/auth/staff-me"); assert.ok(all.every(key => refreshed.permissions.includes(key)));
  assert.ok(Number(sql(`SELECT COUNT(*) FROM activity_logs WHERE ActorId=${quote(session.operator.id)} AND Action LIKE 'FINANCIAL_VOUCHER_%';`)) >= 15);
  console.log("PASS automatic source register, debtor ledger, audited changes and permission revocation on an existing token");
  mkdirSync(auditDirectory, { recursive: true }); session.cashId = cash.id; session.today = today;
  writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  retain = process.env.FINANCE_TEST_KEEP === "1";
  console.log("Financial voucher API/MySQL verification passed.");
} finally { if (!retain) cleanup(session); }
