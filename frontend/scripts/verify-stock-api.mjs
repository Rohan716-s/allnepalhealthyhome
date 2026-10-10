import assert from "node:assert/strict";

// Read-only check. Run against a quiet database so inventory cannot change
// between the list and detail requests.
const baseUrl = process.env.SHOP_TEST_BASE_URL ?? "http://localhost:5000";
async function get(path) {
  const response = await fetch(`${baseUrl}/api/${path}`);
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}
function checkStock(product, context) {
  assert.ok(Number.isInteger(product.stockQuantity) && product.stockQuantity >= 0,
    `${context}: ${product.slug} has invalid stock ${product.stockQuantity}`);
}

const products = new Map();
const first = await get("products?pageSize=100&page=1");
for (let page = 1; page <= first.totalPages; page++) {
  const result = page === 1 ? first : await get(`products?pageSize=100&page=${page}`);
  for (const product of result.items) {
    checkStock(product, "catalog");
    products.set(product.slug, product);
  }
}
assert.equal(products.size, first.totalItems, "Catalog pagination must include every product");
let checked = 0;
let zeroStock = 0;
const queue = [...products.values()];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const product = queue.pop();
    const detail = await get(`products/${encodeURIComponent(product.slug)}`);
    checkStock(detail, "detail");
    assert.equal(detail.stockQuantity, product.stockQuantity,
      `${product.slug}: catalog stock differs from detail stock`);
    if (detail.stockQuantity === 0) zeroStock++;
    if (++checked % 500 === 0) console.log(`Checked ${checked}/${products.size} products`);
  }
}));
let promoted = 0;
for (const endpoint of ["catalog/hot-deals", "catalog/trending"]) {
  for (const product of await get(endpoint)) {
    checkStock(product, endpoint);
    assert.ok(products.has(product.slug), `${endpoint}: product missing from catalog`);
    assert.equal(product.stockQuantity, products.get(product.slug).stockQuantity,
      `${endpoint}: ${product.slug} stock differs from catalog`);
    promoted++;
  }
}
console.log(`PASS: ${checked} products (${zeroStock} with zero stock) and ${promoted} promotional entries have consistent stock.`);
