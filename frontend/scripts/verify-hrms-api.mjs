import assert from "node:assert/strict";

// Read-only regression check using an HR manager's test session.
const baseUrl = process.env.HRMS_TEST_BASE_URL ?? "http://localhost:5000";
const token = process.env.HRMS_TEST_TOKEN;
assert.ok(token, "Set HRMS_TEST_TOKEN to an admin/superadmin test session.");
async function get(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/hrms/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, expectedStatus, `${path}: unexpected HTTP status`);
  return response.status === 204 ? null : response.json();
}
for (const path of ["attendance/history", "dashboard", "dashboard/overview", "leave",
  "settings", "shifts", "attendance/team", "attendance/records", "attendance/corrections",
  "leave/allocations", "overtime", "employment-movements", "salary-revisions", "payroll",
  "accounts/summary", "setup/DEPARTMENT", "office/NOTICE"]) {
  await get(path);
}
const rows = await get("leave/balances");
assert.ok(Array.isArray(rows), "Leave balances must return an array");
for (const row of rows) {
  assert.equal(row.remainingDays, row.allocatedDays + row.carryForwardDays + row.adjustmentDays - row.usedDays,
    "Leave balance arithmetic must remain correct");
}
const directoryResponse = await fetch(`${baseUrl}/api/admin/staff?activeOnly=true`, {
  headers: { Authorization: `Bearer ${token}` },
});
assert.equal(directoryResponse.status, 200, "Staff directory must be available");
const directory = await directoryResponse.json();
const staffId = rows[0]?.staffUserId ?? directory.find(staff => staff.role !== "CUSTOMER")?.id;
if (staffId) {
  const filtered = await get(`leave/balances?staffUserId=${encodeURIComponent(staffId)}`);
  assert.equal(filtered.length, rows.filter(row => row.staffUserId === staffId).length,
    "Employee filter must preserve that employee's balances");
  assert.ok(filtered.every(row => row.staffUserId === staffId), "Employee filter must exclude other staff");
}
await get("leave/balances?staffUserId=00000000-0000-0000-0000-000000000000", 404);
await get("leave/balances?leaveYear=1999", 400);
await get("leave/balances?leaveYear=2201", 400);
await get("leave/balances?leaveYear=2025");
console.log(`PASS: HRMS read endpoints, ${rows.length} leave balances, employee filtering, and year validation.`);
