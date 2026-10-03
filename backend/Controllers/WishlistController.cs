using backend.Contracts;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/wishlist")]
public sealed class WishlistController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomerWishlistItem>>> List(CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        return Ok(await db.WishlistItems.AsNoTracking().Where(x => x.CustomerId == customerId && x.Product != null && x.Product.IsActive).OrderByDescending(x => x.CreatedAt).Select(x => new CustomerWishlistItem(x.ProductId, x.Product!.Sku)).ToListAsync(ct));
    }

    [HttpPut("{productCode}")]
    public async Task<ActionResult<CustomerWishlistItem>> Add(string productCode, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var product = await db.Products.SingleOrDefaultAsync(x => x.IsActive && (x.Sku == productCode || x.Slug == productCode || x.Id.ToString() == productCode), ct);
        if (product is null) return NotFound(new { message = "Product not found." });
        var item = await db.WishlistItems.SingleOrDefaultAsync(x => x.CustomerId == customerId && x.ProductId == product.Id, ct);
        if (item is null) { item = new WishlistItem { CustomerId = customerId, ProductId = product.Id }; db.WishlistItems.Add(item); await db.SaveChangesAsync(ct); }
        return Ok(new CustomerWishlistItem(product.Id, product.Sku));
    }

    [HttpDelete("{productCode}")]
    public async Task<IActionResult> Remove(string productCode, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var item = await db.WishlistItems.Include(x => x.Product).SingleOrDefaultAsync(x => x.CustomerId == customerId && x.Product != null && (x.Product.Sku == productCode || x.Product.Slug == productCode || x.Product.Id.ToString() == productCode), ct);
        if (item is null) return NoContent();
        db.WishlistItems.Remove(item); await db.SaveChangesAsync(ct); return NoContent();
    }
}
