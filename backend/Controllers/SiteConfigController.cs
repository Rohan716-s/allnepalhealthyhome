using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/site")]
public sealed class SiteConfigController(ApplicationDbContext db, IMediaFileStorage media) : ControllerBase
{
    [HttpGet("config")]
    public async Task<ActionResult<PublicSiteConfigResponse>> Config(CancellationToken ct)
    {
        var settings = await db.SystemSettings.AsNoTracking()
            .Where(x => x.IsPublic || x.Key == "system.timeFormat" || x.Key == "system.timezone")
            .ToDictionaryAsync(x => x.Key, x => x.Value, ct);
        settings.TryAdd("system.tablePageSize", "25");
        settings.TryAdd("system.timeFormat", "12");
        settings.TryAdd("system.timezone", "Asia/Kathmandu");
        // Return the complete section map so the customer renderer can respect an
        // explicitly disabled section instead of treating it as unconfigured.
        var sections = await db.HomepageSections.AsNoTracking().OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        var now = DateTime.UtcNow;
        var assets = await db.WebsiteAssets.AsNoTracking().Where(x => x.Enabled && (!x.RespectSchedule || (!x.StartsAt.HasValue || x.StartsAt <= now) && (!x.EndsAt.HasValue || x.EndsAt >= now))).OrderBy(x => x.Priority).ToListAsync(ct);
        var faqs = await db.Faqs.AsNoTracking().Where(x => x.Published).OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        var paymentMethods = await db.PaymentMethodConfigurations.AsNoTracking().Where(x => x.IsEnabled).OrderBy(x => x.DisplayOrder).Select(x => new PublicPaymentMethodRow(x.Code, x.DisplayName, x.Instructions, x.MinimumOrder, x.MaximumOrder, x.DisplayOrder, true, x.RequiresServerVerification, x.QrCodeUrl)).ToListAsync(ct);
        var navigation = await db.NavigationMenuItems.AsNoTracking().Where(x => x.IsVisible).OrderBy(x => x.MenuKey).ThenBy(x => x.DisplayOrder).ThenBy(x => x.Label).Select(x => new PublicNavigationMenuItem(x.Id, x.MenuKey, x.Label, x.Url, x.ParentId, x.Icon, x.DisplayOrder, x.OpenInNewTab)).ToListAsync(ct);
        var popups = await db.PopupCampaigns.AsNoTracking().Where(x => x.IsActive && (!x.StartsAt.HasValue || x.StartsAt <= now) && (!x.EndsAt.HasValue || x.EndsAt >= now)).OrderByDescending(x => x.UpdatedAt).Select(x => new PublicPopupCampaign(x.Id, x.Kind, x.Title, x.Description, x.ImageUrl, x.ButtonText, x.Destination, x.DelaySeconds, x.Frequency, x.Audience, x.MobileEnabled, x.DesktopEnabled)).ToListAsync(ct);
        var deliverySlots = await db.DeliverySlots.AsNoTracking().Where(x => x.Enabled).OrderBy(x => x.DisplayOrder).ThenBy(x => x.StartTime).Select(x => new PublicDeliverySlot(x.Id, x.Label, x.StartTime, x.EndTime, x.BranchId, x.MaxOrders)).ToListAsync(ct);
        var seo = await db.SeoEntries.AsNoTracking().Where(x => x.IsActive && x.Scope == "GLOBAL" && x.Path == "/").Select(x => new PublicSeoEntry(x.Scope, x.Path, x.Title, x.MetaDescription, x.Keywords, x.OgTitle, x.OgDescription, x.OgImageUrl, x.CanonicalUrl, x.Robots)).SingleOrDefaultAsync(ct);
        return Ok(new PublicSiteConfigResponse(settings, sections, assets, faqs, paymentMethods, navigation, popups, seo, deliverySlots));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<PublicSiteSummaryResponse>> Summary(CancellationToken ct)
    {
        return Ok(new PublicSiteSummaryResponse(
            await db.Customers.CountAsync(x => x.IsActive, ct),
            await db.Products.CountAsync(x => x.IsActive, ct),
            await db.Orders.CountAsync(x => x.Status == OrderStatuses.Delivered, ct),
            await db.Branches.CountAsync(x => x.IsActive, ct),
            await db.ProductReviews.CountAsync(x => x.Status == ReviewStatuses.Published, ct)));
    }

    [HttpGet("featured-reviews")]
    public async Task<ActionResult<IReadOnlyList<PublicReviewRow>>> FeaturedReviews(CancellationToken ct)
    {
        var rows = await db.ProductReviews.AsNoTracking().Include(x => x.Customer).Where(x => x.Status == ReviewStatuses.Published).OrderByDescending(x => x.CreatedAt).Take(3).Select(x => new PublicReviewRow(x.Id, x.Customer!.FullName, x.Rating, x.Title, x.Comment, x.CreatedAt, x.AdminResponse)).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("media/{id:guid}")]
    public async Task<IActionResult> Media(Guid id, CancellationToken ct)
    {
        var item = await db.MediaAssets.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.IsActive && x.IsPublic, ct);
        if (item is null) return NotFound();
        var stream = await media.OpenReadAsync(item.StoredFileName, ct);
        return stream is null ? NotFound() : File(stream, item.ContentType, enableRangeProcessing: true);
    }

    [HttpGet("pages/{slug}")]
    public async Task<ActionResult<object>> Page(string slug, CancellationToken ct)
    {
        var page = await db.CmsPages.AsNoTracking().SingleOrDefaultAsync(x => x.Slug == slug && x.Status == "PUBLISHED", ct);
        return page is null ? NotFound() : Ok(new { page.Slug, page.Title, page.Content, page.SeoTitle, page.MetaDescription, page.PublishedAt });
    }

    [HttpGet("articles")]
    public async Task<ActionResult<IReadOnlyList<AdminHealthArticleRow>>> Articles(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var rows = await db.HealthArticles.AsNoTracking().Where(x => x.Status == "PUBLISHED" || x.Status == "SCHEDULED" && x.ScheduledAt <= now).OrderByDescending(x => x.IsFeatured).ThenByDescending(x => x.PublishedAt ?? x.ScheduledAt ?? x.CreatedAt).Select(x => new AdminHealthArticleRow(x.Id, x.Slug, x.Title, x.Excerpt, x.Content, x.Category, x.TagsCsv, x.AuthorName, x.FeaturedImageUrl, x.Status, x.SeoTitle, x.MetaDescription, x.PublishedAt, x.ScheduledAt, x.IsFeatured, x.UpdatedAt)).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("articles/{slug}")]
    public async Task<ActionResult<AdminHealthArticleRow>> Article(string slug, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var article = await db.HealthArticles.AsNoTracking().Where(x => x.Slug == slug && (x.Status == "PUBLISHED" || x.Status == "SCHEDULED" && x.ScheduledAt <= now)).Select(x => new AdminHealthArticleRow(x.Id, x.Slug, x.Title, x.Excerpt, x.Content, x.Category, x.TagsCsv, x.AuthorName, x.FeaturedImageUrl, x.Status, x.SeoTitle, x.MetaDescription, x.PublishedAt, x.ScheduledAt, x.IsFeatured, x.UpdatedAt)).SingleOrDefaultAsync(ct);
        return article is null ? NotFound() : Ok(article);
    }

    private static AdminHealthArticleRow ArticleRow(HealthArticle article) => new(article.Id, article.Slug, article.Title, article.Excerpt, article.Content, article.Category, article.TagsCsv, article.AuthorName, article.FeaturedImageUrl, article.Status, article.SeoTitle, article.MetaDescription, article.PublishedAt, article.ScheduledAt, article.IsFeatured, article.UpdatedAt);
}
