using System.Security.Claims;
using backend.Contracts;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/sales-executive")]
public sealed class SalesExecutiveController(ApplicationDbContext db) : ControllerBase
{
    private bool Authorized => User.IsStaffRole(StaffRoles.SalesExecutive);
    private Guid StaffId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private Guid? BranchId => Guid.TryParse(User.FindFirstValue("branch_id"), out var id) ? id : null;

    [HttpGet("dashboard")]
    public async Task<ActionResult<SalesExecutiveDashboardResponse>> Dashboard([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var (start, end) = DateRange(from, to);
        if (start >= end) return BadRequest(new { message = "The dashboard date range is invalid." });
        var query = AssignedOrders().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var totalOrders = await query.CountAsync(ct);
        var rows = await query.Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category)
            .OrderByDescending(x => x.CreatedAt).Take(20).ToListAsync(ct);
        var assignments = await AssignmentTargets(ct);
        var mapped = rows.Select(x => ToRow(x, assignments.ProductIds, assignments.CategoryIds)).ToList();
        return Ok(new SalesExecutiveDashboardResponse(totalOrders, await query.Where(x => x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).SumAsync(x => (decimal?)x.Total, ct) ?? 0, start, end, mapped));
    }

    [HttpGet("orders")]
    public async Task<ActionResult<SalesExecutiveOrdersResponse>> Orders([FromQuery] string? search, [FromQuery] string? status, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        if (!Authorized) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var (start, end) = DateRange(from, to);
        if (start >= end) return BadRequest(new { message = "The order date range is invalid." });
        var query = AssignedOrders().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.OrderNumber.Contains(search) || x.Customer!.FullName.Contains(search) || x.Customer.Phone.Contains(search));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        var total = await query.CountAsync(ct);
        var rows = await query.Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category)
            .OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var assignments = await AssignmentTargets(ct);
        return Ok(new SalesExecutiveOrdersResponse(rows.Select(x => ToRow(x, assignments.ProductIds, assignments.CategoryIds)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpPut("orders/{id:guid}/status")]
    public async Task<ActionResult<SalesExecutiveOrderRow>> OrderStatus(Guid id, OrderStatusRequest request, CancellationToken ct)
    {
        await Task.CompletedTask;
        return StatusCode(403, new { message = "Sales executives track orders; pharmacist and delivery staff manage fulfilment." });
    }

    private IQueryable<PharmacyOrder> AssignedOrders(bool tracked = false)
    {
        var query = tracked ? db.Orders.AsQueryable() : db.Orders.AsNoTracking();
        return query.Where(order => BranchId.HasValue && order.BranchId == BranchId.Value &&
            db.SalesFieldRecords.Any(r => r.ExecutiveId == StaffId && r.Kind == "ORDER" && r.OrderId == order.Id));
    }

    private async Task<(HashSet<Guid> ProductIds, HashSet<Guid> CategoryIds)> AssignmentTargets(CancellationToken ct)
    {
        var rows = await db.SalesExecutiveProductAssignments.AsNoTracking().Where(x => x.SalesExecutiveUserId == StaffId && x.IsActive).Select(x => new { x.ProductId, x.CategoryId }).ToListAsync(ct);
        return (rows.Where(x => x.ProductId.HasValue).Select(x => x.ProductId!.Value).ToHashSet(), rows.Where(x => x.CategoryId.HasValue).Select(x => x.CategoryId!.Value).ToHashSet());
    }

    private static SalesExecutiveOrderRow ToRow(PharmacyOrder order, HashSet<Guid> productIds, HashSet<Guid> categoryIds)
    {
        var items = order.Items
            .Select(item => new SalesExecutiveOrderItemRow(item.ProductId, item.ProductName, item.Product?.Medicine?.Category?.Name, item.Quantity, item.UnitPrice, item.Quantity * item.UnitPrice)).ToList();
        return new SalesExecutiveOrderRow(order.Id, order.OrderNumber, order.Customer?.FullName ?? "Customer", order.Customer?.Phone, order.CreatedAt, order.Status, order.Branch?.Name, items, items.Sum(x => x.SalesValue));
    }

    private static (DateTime Start, DateTime End) DateRange(DateTime? from, DateTime? to)
    {
        var today = DateTime.UtcNow.Date;
        return (from?.Date ?? today.AddDays(-29), to?.Date.AddDays(1) ?? today.AddDays(1));
    }

    private static bool AllowedTransition(string current, string next)
    {
        var normalized = next.Trim().ToUpperInvariant();
        return current switch
        {
            OrderStatuses.Pending or OrderStatuses.PrescriptionVerification => normalized == OrderStatuses.Confirmed,
            OrderStatuses.Confirmed => normalized == OrderStatuses.Preparing,
            OrderStatuses.Preparing => normalized == OrderStatuses.ReadyForPickup,
            _ => false,
        };
    }
}
