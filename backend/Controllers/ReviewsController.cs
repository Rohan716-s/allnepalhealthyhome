using backend.Contracts;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/reviews")]
public sealed class ReviewsController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet("product/{productId:guid}")]
    public async Task<ActionResult<IReadOnlyList<PublicReviewRow>>> ProductReviews(Guid productId, CancellationToken ct)
    {
        var rows = await db.ProductReviews.AsNoTracking().Include(x => x.Customer).Where(x => x.ProductId == productId && x.Status == ReviewStatuses.Published).OrderByDescending(x => x.CreatedAt).Select(x => new PublicReviewRow(x.Id, x.Customer!.FullName, x.Rating, x.Title, x.Comment, x.CreatedAt, x.AdminResponse)).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<PublicReviewRow>> Create(CreateReviewRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (request.Rating is < 1 or > 5) return BadRequest(new { message = "Rating must be between one and five stars." });
        if (string.IsNullOrWhiteSpace(request.Comment) || request.Comment.Trim().Length < 10 || request.Comment.Trim().Length > 2000) return BadRequest(new { message = "Review comment must be between 10 and 2,000 characters." });
        var productExists = await db.Products.AnyAsync(x => x.Id == request.ProductId && x.IsActive, ct);
        if (!productExists) return NotFound(new { message = "Product not found." });
        var order = await db.Orders.Include(x => x.Items).Where(x => x.CustomerId == customerId && x.Status == OrderStatuses.Delivered && x.Items.Any(item => item.ProductId == request.ProductId) && (!request.OrderId.HasValue || x.Id == request.OrderId.Value)).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (order is null) return BadRequest(new { message = "Reviews are available after a delivered purchase of this product." });
        if (await db.ProductReviews.AnyAsync(x => x.CustomerId == customerId && x.ProductId == request.ProductId && x.OrderId == order.Id, ct)) return Conflict(new { message = "You have already reviewed this purchase." });
        var review = new ProductReview { CustomerId = customerId, ProductId = request.ProductId, OrderId = order.Id, Rating = request.Rating, Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(), Comment = request.Comment.Trim() };
        db.ProductReviews.Add(review);
        await db.SaveChangesAsync(ct);
        var customer = await db.Customers.AsNoTracking().SingleAsync(x => x.Id == customerId, ct);
        return Ok(new PublicReviewRow(review.Id, customer.FullName, review.Rating, review.Title, review.Comment, review.CreatedAt, review.AdminResponse));
    }
}
