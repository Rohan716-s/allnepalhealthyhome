using backend.Contracts;
using backend.Data;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResponse<ProductListItem>>> List([FromQuery] string? search, [FromQuery] string? category, [FromQuery] Guid? categoryId, [FromQuery] string? brand, [FromQuery] Guid? brandId, [FromQuery] string? company, [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice, [FromQuery] bool? hotDeal, [FromQuery] bool? prescriptionRequired, [FromQuery] bool? available, [FromQuery] string sort = "relevance", [FromQuery] int page = 1, [FromQuery] int pageSize = 24, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var stockDate = ApplicationTime.NepalNow.Date;
        var pricesVisible = await OrderPolicyReader.PricesVisibleAsync(dbContext, User, cancellationToken);
        if (!pricesVisible && (minPrice.HasValue || maxPrice.HasValue || sort is "price-low" or "price-high" or "discount"))
            return BadRequest(new { message = "Price filters and price-based sorting are unavailable for this account." });
        var isPharmacy = await IsPharmacyCustomer(cancellationToken);
        var query = dbContext.Products.AsNoTracking().Where(x => x.IsActive).Include(x => x.Medicine).ThenInclude(x => x!.Category).Include(x => x.Brand).Include(x => x.Inventory).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            var pattern = $"%{term}%";
            query = query.Where(x =>
                EF.Functions.Like(x.Name, pattern) ||
                EF.Functions.Like(x.Sku, pattern) ||
                (x.SearchKeywords != null && EF.Functions.Like(x.SearchKeywords, pattern)) ||
                (x.Medicine!.GenericName != null && EF.Functions.Like(x.Medicine.GenericName, pattern)) ||
                EF.Functions.Like(x.Brand!.Name, pattern) ||
                (x.Medicine!.Strength != null && EF.Functions.Like(x.Medicine.Strength, pattern)));
        }
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(x => x.Medicine!.Category!.Slug == category || x.Medicine.Category.Name == category);
        if (categoryId.HasValue) query = query.Where(x => x.Medicine!.CategoryId == categoryId.Value);
        if (!string.IsNullOrWhiteSpace(brand)) query = query.Where(x => x.Brand!.Slug == brand || x.Brand.Name == brand);
        if (brandId.HasValue) query = query.Where(x => x.BrandId == brandId.Value);
        if (!string.IsNullOrWhiteSpace(company)) query = query.Where(x => (x.CompanyName != null && x.CompanyName == company) || (x.CompanyCode != null && x.CompanyCode == company) || x.Brand!.Name == company);
        if (minPrice.HasValue) query = query.Where(x => x.SellingPrice >= minPrice.Value);
        if (maxPrice.HasValue) query = query.Where(x => x.SellingPrice <= maxPrice.Value);
        if (hotDeal == true) query = query.Where(x => x.IsHotDeal);
        if (prescriptionRequired.HasValue) query = query.Where(x => x.Medicine!.PrescriptionRequired == prescriptionRequired.Value);
        if (available == true) query = query.Where(x => x.Inventory.AsQueryable().Where(InventoryAvailability.SellableOn(stockDate)).Any(i => i.StockQuantity > i.ReservedQuantity));
        query = sort switch
        {
            "price-low" => query.OrderBy(x => x.SellingPrice),
            "price-high" => query.OrderByDescending(x => x.SellingPrice),
            "newest" => query.OrderByDescending(x => x.CreatedAt),
            "discount" => query.OrderByDescending(x => x.Mrp - x.SellingPrice),
            "popular" => query.OrderByDescending(x => x.DemandScore).ThenBy(x => x.DisplayOrder).ThenByDescending(x => x.IsFeatured),
            _ => query.OrderByDescending(x => x.IsFeatured).ThenBy(x => x.Name),
        };
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(x => new ProductListItem(x.Id, x.Name, x.Slug, x.Sku, x.Medicine!.GenericName ?? x.Medicine.Name, x.Brand!.Name, x.Medicine.Category!.Name, x.Medicine.Strength, x.Medicine.DosageForm, isPharmacy ? x.Mrp : x.SellingPrice, x.SellingPrice, x.Inventory.AsQueryable().Where(InventoryAvailability.SellableOn(stockDate)).Sum(i => i.StockQuantity > i.ReservedQuantity ? i.StockQuantity - i.ReservedQuantity : 0), x.Medicine.PrescriptionRequired, x.IsFeatured, x.CreatedAt, null, null, null, null, x.ImageUrl, isPharmacy ? x.DiscountPercent : null, isPharmacy ? x.BonusScheme : null, null, x.IsTrending, x.IsHotDeal, true, x.CompanyCode, x.CompanyName, x.DemandScore)).ToListAsync(cancellationToken);
        var imageRows = await dbContext.ProductImages.AsNoTracking().Where(x => items.Select(item => item.Id).Contains(x.ProductId)).OrderBy(x => x.DisplayOrder).ToListAsync(cancellationToken);
        items = items.Select(item => item with
        {
            ImageUrls = CleanProductImageUrls(
                imageRows.Where(image => image.ProductId == item.Id).OrderBy(image => image.DisplayOrder).Select(image => image.Url),
                item.ImageUrl)
        }).ToList();
        // Older imports can have a placeholder in ImageUrl while a genuine gallery
        // row exists. Return the first genuine gallery image as the effective
        // primary so cards, search, related products, and cached clients cannot
        // let that stale placeholder win.
        items = items.Select(item => item with { ImageUrl = item.ImageUrls?.FirstOrDefault() ?? item.ImageUrl }).ToList();
        var now = DateTime.UtcNow; var sales = isPharmacy ? await dbContext.FlashSales.AsNoTracking().Where(x => items.Select(item => item.Id).Contains(x.ProductId) && x.BranchId == null && x.IsActive && x.StartsAt <= now && x.EndsAt > now).ToListAsync(cancellationToken) : [];
        items = items.Select(item => { var sale = sales.Where(x => x.ProductId == item.Id && (!x.QuantityLimit.HasValue || x.QuantitySold < x.QuantityLimit.Value)).OrderByDescending(x => x.DiscountPercent).FirstOrDefault(); return sale is null ? item : item with { FlashSalePrice = Math.Round(item.SellingPrice * (1 - sale.DiscountPercent / 100m), 2), FlashSaleDiscountPercent = sale.DiscountPercent, FlashSaleEndsAt = sale.EndsAt, FlashSaleRemaining = sale.QuantityLimit.HasValue ? sale.QuantityLimit.Value - sale.QuantitySold : null }; }).ToList();
        if (!pricesVisible) items = items.Select(item => item with { Mrp = 0, SellingPrice = 0, FlashSalePrice = null, FlashSaleDiscountPercent = null, WholesaleDiscountPercent = null, BonusScheme = null, PricesVisible = false }).ToList();
        return Ok(new PagedResponse<ProductListItem>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("{slugOrId}")]
    public async Task<ActionResult<ProductDetailResponse>> Get(string slugOrId, CancellationToken cancellationToken)
    {
        var product = await dbContext.Products.AsNoTracking().Include(x => x.Medicine).ThenInclude(x => x!.Category).Include(x => x.Medicine).ThenInclude(x => x!.Manufacturer).Include(x => x.Brand).Include(x => x.Inventory).Include(x => x.Images).Where(x => x.IsActive && (x.Slug == slugOrId || x.Id.ToString() == slugOrId)).SingleOrDefaultAsync(cancellationToken);
        if (product is null) return NotFound(new { message = "Product not found." });
        var isPharmacy = await IsPharmacyCustomer(cancellationToken);
        var pricesVisible = await OrderPolicyReader.PricesVisibleAsync(dbContext, User, cancellationToken);
        var sale = isPharmacy ? await dbContext.FlashSales.AsNoTracking().Where(x => x.ProductId == product.Id && x.BranchId == null && x.IsActive && x.StartsAt <= DateTime.UtcNow && x.EndsAt > DateTime.UtcNow && (!x.QuantityLimit.HasValue || x.QuantitySold < x.QuantityLimit.Value)).OrderByDescending(x => x.DiscountPercent).FirstOrDefaultAsync(cancellationToken) : null;
        var imageUrls = CleanProductImageUrls(product.Images.OrderBy(image => image.DisplayOrder).Select(image => image.Url), product.ImageUrl);
        var effectiveImageUrl = imageUrls.FirstOrDefault() ?? product.ImageUrl;
        var response = new ProductDetailResponse(product.Id, product.Name, product.Slug, product.Sku, product.Medicine?.GenericName ?? product.Medicine?.Name ?? product.Name, product.Brand?.Name ?? "", product.Medicine?.Manufacturer?.Name ?? "", product.Medicine?.Category?.Name ?? "", product.Medicine?.Strength, product.Medicine?.DosageForm, product.Medicine?.Description, product.Medicine?.Uses, product.Medicine?.Warnings, product.Medicine?.SideEffects, product.Medicine?.StorageInformation, isPharmacy ? product.Mrp : product.SellingPrice, product.SellingPrice, InventoryAvailability.ForProduct(product.Inventory, ApplicationTime.NepalNow.Date), product.Medicine?.PrescriptionRequired ?? false, effectiveImageUrl, product.CreatedAt, sale is null ? null : Math.Round(product.SellingPrice * (1 - sale.DiscountPercent / 100m), 2), sale?.DiscountPercent, sale?.EndsAt, sale?.QuantityLimit is null ? null : sale.QuantityLimit.Value - sale.QuantitySold, isPharmacy ? product.DiscountPercent : null, isPharmacy ? product.BonusScheme : null, imageUrls, product.IsTrending, product.IsHotDeal, pricesVisible, product.CompanyCode, product.CompanyName, product.DemandScore, product.ImageSourceUrl, product.ImageVerificationStatus, product.ImageSourceReference, product.DemandBasis, product.DemandSourceUrl, product.DemandSourceReference);
        if (!pricesVisible) response = response with { Mrp = 0, SellingPrice = 0, FlashSalePrice = null, FlashSaleDiscountPercent = null, WholesaleDiscountPercent = null, BonusScheme = null };
        return Ok(response);
    }

    private async Task<bool> IsPharmacyCustomer(CancellationToken cancellationToken)
    {
        return User.TryGetCustomerId(out var customerId) && await dbContext.Customers.AsNoTracking().AnyAsync(x => x.Id == customerId && x.IsActive && x.AccountType == "PHARMACY", cancellationToken);
    }

    private static IReadOnlyList<string> CleanProductImageUrls(IEnumerable<string?> galleryUrls, string? primaryUrl)
    {
        var urls = galleryUrls
            .Where(url => !string.IsNullOrWhiteSpace(url) && !IsPlaceholderImage(url!))
            .Select(url => url!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (urls.Count == 0 && !string.IsNullOrWhiteSpace(primaryUrl) && !IsPlaceholderImage(primaryUrl))
            urls.Add(primaryUrl);

        return urls;
    }

    private static bool IsPlaceholderImage(string url) =>
        url.Equals("/catalog-placeholder.svg", StringComparison.OrdinalIgnoreCase) ||
        url.EndsWith("/catalog-placeholder.svg", StringComparison.OrdinalIgnoreCase);
}

[ApiController]
[Route("api/catalog")]
public sealed class CatalogController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet("trending")]
    public async Task<ActionResult<IReadOnlyList<TrendingProductItem>>> Trending(CancellationToken cancellationToken)
    {
        var pricesVisible = await OrderPolicyReader.PricesVisibleAsync(dbContext, User, cancellationToken);
        var products = await dbContext.Products.AsNoTracking().Where(x => x.IsActive && x.IsTrending).Include(x => x.Inventory).Include(x => x.Images).OrderBy(x => x.Name).Take(8).ToListAsync(cancellationToken);
        return Ok(products.Select(x => { var images = CleanProductImageUrls(x.Images.OrderBy(image => image.DisplayOrder).Select(image => image.Url), x.ImageUrl); return new TrendingProductItem(x.Id, x.Name, x.Slug, pricesVisible ? x.SellingPrice : 0, images.FirstOrDefault() ?? x.ImageUrl, images, pricesVisible, InventoryAvailability.ForProduct(x.Inventory, ApplicationTime.NepalNow.Date)); }).ToList());
    }

    [HttpGet("hot-deals")]
    public async Task<ActionResult<IReadOnlyList<TrendingProductItem>>> HotDeals(CancellationToken cancellationToken)
    {
        var pricesVisible = await OrderPolicyReader.PricesVisibleAsync(dbContext, User, cancellationToken);
        var products = await dbContext.Products.AsNoTracking().Where(x => x.IsActive && x.IsHotDeal).Include(x => x.Inventory).Include(x => x.Images).OrderBy(x => x.Name).Take(12).ToListAsync(cancellationToken);
        return Ok(products.Select(x => { var images = CleanProductImageUrls(x.Images.OrderBy(image => image.DisplayOrder).Select(image => image.Url), x.ImageUrl); return new TrendingProductItem(x.Id, x.Name, x.Slug, pricesVisible ? x.SellingPrice : 0, images.FirstOrDefault() ?? x.ImageUrl, images, pricesVisible, InventoryAvailability.ForProduct(x.Inventory, ApplicationTime.NepalNow.Date)); }).ToList());
    }

    [HttpGet("branches")]
    public async Task<ActionResult<IReadOnlyList<PublicBranchResponse>>> Branches(CancellationToken cancellationToken) => Ok(await dbContext.Branches.AsNoTracking().Where(x => x.IsActive && x.DeliveryEnabled).OrderBy(x => x.Name).Select(x => new PublicBranchResponse(x.Id, x.Name, x.Address, x.Province, x.District, x.Municipality, x.Ward)).ToListAsync(cancellationToken));

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken cancellationToken) => Ok(await dbContext.Categories.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Slug, x.Description, ProductCount = x.Medicines.SelectMany(m => m.Products).Count(p => p.IsActive) }).ToListAsync(cancellationToken));

    [HttpGet("brands")]
    public async Task<IActionResult> Brands([FromQuery] Guid? categoryId, CancellationToken cancellationToken)
    {
        var query = dbContext.Brands.AsNoTracking().Where(x => x.IsActive && x.Products.Any(p => p.IsActive));
        if (categoryId.HasValue) query = query.Where(x => x.Products.Any(p => p.IsActive && p.Medicine!.CategoryId == categoryId.Value));
        return Ok(await query.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Slug, ProductCount = categoryId.HasValue ? x.Products.Count(p => p.IsActive && p.Medicine!.CategoryId == categoryId.Value) : x.Products.Count(p => p.IsActive) }).ToListAsync(cancellationToken));
    }

    private static IReadOnlyList<string> CleanProductImageUrls(IEnumerable<string?> galleryUrls, string? primaryUrl)
    {
        var urls = galleryUrls
            .Where(url => !string.IsNullOrWhiteSpace(url) && !IsPlaceholderImage(url!))
            .Select(url => url!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (urls.Count == 0 && !string.IsNullOrWhiteSpace(primaryUrl) && !IsPlaceholderImage(primaryUrl))
            urls.Add(primaryUrl);

        return urls;
    }

    private static bool IsPlaceholderImage(string url) =>
        url.Equals("/catalog-placeholder.svg", StringComparison.OrdinalIgnoreCase) ||
        url.EndsWith("/catalog-placeholder.svg", StringComparison.OrdinalIgnoreCase);
}
