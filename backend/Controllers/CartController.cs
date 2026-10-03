using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/cart")]
public sealed class CartController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CustomerCartResponse>> List(CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var cart = await LoadCart(customerId, ct);
        return Ok(await BuildResponse(cart?.Items ?? [], [], ct));
    }

    [HttpPost("items")]
    public async Task<ActionResult<CustomerCartResponse>> AddItem(CustomerCartItemRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.ProductCode) || request.Quantity is < 1 or > 999) return BadRequest(new { message = "Cart quantity must be between 1 and 999." });
        var product = await FindProduct(request.ProductCode, ct);
        if (product is null) return NotFound(new { message = "This product is no longer available." });
        var available = Available(product);
        if (available < 1) return Conflict(new { message = "This product is out of stock." });
        var cart = await GetOrCreateCart(customerId, ct);
        var item = await db.CartItems.SingleOrDefaultAsync(x => x.CartId == cart.Id && x.ProductId == product.Id, ct);
        var requested = (item?.Quantity ?? 0) + request.Quantity;
        var nextQuantity = Math.Min(available, requested);
        if (item is null) db.CartItems.Add(new CartItem { CartId = cart.Id, ProductId = product.Id, Quantity = nextQuantity });
        else item.Quantity = nextQuantity;
        await db.SaveChangesAsync(ct);
        return Ok(await ResponseForCart(cart.Id, [], ct));
    }

    [HttpPut("items/{productCode}")]
    public async Task<ActionResult<CustomerCartResponse>> SetItemQuantity(string productCode, CustomerCartQuantityRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(productCode) || request.Quantity is < 0 or > 999) return BadRequest(new { message = "Cart quantity must be between 0 and 999." });
        var cart = await db.Carts.SingleOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (cart is null) return Ok(new CustomerCartResponse([], [], 0));
        var item = await db.CartItems.Include(x => x.Product).ThenInclude(x => x!.Inventory).SingleOrDefaultAsync(x => x.CartId == cart.Id && x.Product!.IsActive && (x.Product.Sku == productCode || x.Product.Slug == productCode), ct);
        if (item is null) return NotFound(new { message = "This item is not in your cart." });
        if (request.Quantity == 0) db.CartItems.Remove(item);
        else item.Quantity = Math.Min(Available(item.Product!), request.Quantity);
        await db.SaveChangesAsync(ct);
        return Ok(await ResponseForCart(cart.Id, [], ct));
    }

    [HttpDelete("items/{productCode}")]
    public async Task<ActionResult<CustomerCartResponse>> RemoveItem(string productCode, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var cart = await db.Carts.SingleOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (cart is null) return Ok(new CustomerCartResponse([], [], 0));
        var item = await db.CartItems.Include(x => x.Product).SingleOrDefaultAsync(x => x.CartId == cart.Id && (x.Product!.Sku == productCode || x.Product.Slug == productCode), ct);
        if (item is not null) db.CartItems.Remove(item);
        await db.SaveChangesAsync(ct);
        return Ok(await ResponseForCart(cart.Id, [], ct));
    }

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var cart = await db.Carts.SingleOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (cart is not null)
        {
            db.CartItems.RemoveRange(await db.CartItems.Where(x => x.CartId == cart.Id).ToListAsync(ct));
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpPost("merge")]
    public async Task<ActionResult<CustomerCartResponse>> Merge(MergeCustomerCartRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (request.Items is null || request.Items.Count > 100) return BadRequest(new { message = "Your cart contains too many items." });
        if (request.Items.Any(x => string.IsNullOrWhiteSpace(x.ProductCode) || x.Quantity is < 1 or > 999)) return BadRequest(new { message = "Cart quantities must be between 1 and 999." });

        var requested = request.Items.GroupBy(x => x.ProductCode.Trim(), StringComparer.OrdinalIgnoreCase).ToDictionary(x => x.Key, x => Math.Min(999, x.Sum(item => item.Quantity)), StringComparer.OrdinalIgnoreCase);
        var products = await db.Products.Include(x => x.Medicine).Include(x => x.Inventory).Where(x => x.IsActive && (requested.Keys.Contains(x.Sku) || requested.Keys.Contains(x.Slug))).ToListAsync(ct);
        var cart = await GetOrCreateCart(customerId, ct);
        var warnings = new List<string>();
        foreach (var entry in requested)
        {
            var product = products.SingleOrDefault(x => x.Sku.Equals(entry.Key, StringComparison.OrdinalIgnoreCase) || x.Slug.Equals(entry.Key, StringComparison.OrdinalIgnoreCase));
            if (product is null) { warnings.Add($"{entry.Key} is no longer available."); continue; }
            var available = Available(product);
            if (available < 1) { warnings.Add($"{product.Name} is out of stock."); continue; }
            var item = await db.CartItems.SingleOrDefaultAsync(x => x.CartId == cart.Id && x.ProductId == product.Id, ct);
            var nextQuantity = Math.Min(available, (item?.Quantity ?? 0) + entry.Value);
            if (nextQuantity < (item?.Quantity ?? 0) + entry.Value) warnings.Add($"{product.Name} was limited to {available} available unit(s).");
            if (item is null) db.CartItems.Add(new CartItem { CartId = cart.Id, ProductId = product.Id, Quantity = nextQuantity });
            else item.Quantity = nextQuantity;
        }

        await db.SaveChangesAsync(ct);
        return Ok(await ResponseForCart(cart.Id, warnings, ct));
    }

    private async Task<Cart> GetOrCreateCart(Guid customerId, CancellationToken ct)
    {
        var cart = await db.Carts.SingleOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (cart is not null) return cart;
        cart = new Cart { CustomerId = customerId };
        db.Carts.Add(cart);
        await db.SaveChangesAsync(ct);
        return cart;
    }

    private Task<Cart?> LoadCart(Guid customerId, CancellationToken ct) => db.Carts.AsNoTracking().AsSplitQuery().Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Inventory).SingleOrDefaultAsync(x => x.CustomerId == customerId, ct);

    private async Task<CustomerCartResponse> ResponseForCart(Guid cartId, IReadOnlyList<string> warnings, CancellationToken ct)
    {
        var cart = await db.Carts.AsNoTracking().AsSplitQuery().Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Inventory).SingleAsync(x => x.Id == cartId, ct);
        return await BuildResponse(cart.Items, warnings, ct);
    }

    private Task<Product?> FindProduct(string code, CancellationToken ct) => db.Products.Include(x => x.Medicine).Include(x => x.Inventory).SingleOrDefaultAsync(x => x.IsActive && (x.Sku == code || x.Slug == code), ct);

    private static int Available(Product product) => product.Inventory.Where(x => !x.ExpiryDate.HasValue || x.ExpiryDate.Value.Date >= DateTime.UtcNow.Date).Sum(x => Math.Max(0, x.StockQuantity - x.ReservedQuantity));

    private async Task<CustomerCartResponse> BuildResponse(IEnumerable<CartItem> items, IReadOnlyList<string> warnings, CancellationToken ct)
    {
        var lines = items.Where(x => x.Product?.IsActive == true).Select(x => new CustomerCartLine(x.ProductId, x.Product!.Sku, x.Product.Slug, x.Product.Name, x.Quantity, Available(x.Product), x.Product.Medicine?.PrescriptionRequired == true, x.Product.ImageUrl, x.Product.SellingPrice)).ToList();
        var visible = await OrderPolicyReader.PricesVisibleAsync(db, User, ct);
        if (!visible) lines = lines.Select(x => x with { SellingPrice = 0, PricesVisible = false }).ToList();
        return new CustomerCartResponse(lines, warnings, lines.Sum(x => x.Quantity));
    }
}
