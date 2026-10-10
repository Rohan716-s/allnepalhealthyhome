import assert from "node:assert/strict";

// Use a dedicated test customer with an empty cart and wishlist.
const baseUrl = process.env.SHOP_TEST_BASE_URL ?? "http://localhost:3000";
const token = process.env.SHOP_TEST_TOKEN;
const code = process.env.SHOP_TEST_PRODUCT_CODE;
assert.ok(token && code, "Set SHOP_TEST_TOKEN and SHOP_TEST_PRODUCT_CODE (at least 8 available units).");
const itemPath = encodeURIComponent(code);
async function request(path, method = "GET", body) {
  const response = await fetch(`${baseUrl}/api/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

assert.equal((await request("cart")).items.length, 0, "Use an empty test cart.");
assert.equal((await request("wishlist")).length, 0, "Use an empty test wishlist.");
try {
  await Promise.all(Array.from({ length: 8 }, () => request(`wishlist/${itemPath}`, "PUT")));
  assert.equal((await request("wishlist")).length, 1, "Concurrent PUT must be idempotent.");
  await Promise.all(Array.from({ length: 8 }, () => request("cart/items", "POST", { productCode: code, quantity: 1 })));
  const cart = await request("cart");
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 8, "Concurrent additions must preserve every increment.");
  const updated = await request(`cart/items/${itemPath}`, "PUT", { quantity: 2 });
  assert.equal(updated.items[0].quantity, 2);
  assert.equal((await request("cart")).items[0].quantity, 2, "Quantity must persist.");
  assert.equal((await request(`cart/items/${itemPath}`, "DELETE")).items.length, 0);
  await request(`wishlist/${itemPath}`, "DELETE");
  assert.equal((await request("wishlist")).length, 0);
  await request("cart/items", "POST", { productCode: code, quantity: 1 });
  await request("cart", "DELETE");
  assert.equal((await request("cart")).items.length, 0);
  console.log("PASS: concurrent wishlist/cart requests, persistence, quantity updates, removals, and clear.");
} finally {
  await request(`wishlist/${itemPath}`, "DELETE");
  await request("cart", "DELETE");
}
