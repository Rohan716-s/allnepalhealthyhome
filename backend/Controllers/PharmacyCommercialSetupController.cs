using System.Security.Claims;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/sales-purchase/setup")]
[Route("api/superadmin/sales-purchase/setup")]
public sealed class PharmacyCommercialSetupController(ApplicationDbContext db) : ControllerBase
{
    private bool IsSuperAdmin => User.IsStaffRole(StaffRoles.SuperAdmin);
    private bool SuperAdminPath => Request.Path.StartsWithSegments("/api/superadmin", StringComparison.OrdinalIgnoreCase);
    private bool WorkspaceAccess => (SuperAdminPath ? IsSuperAdmin : User.TryGetStaffId(out _)) && User.HasStaffPermission(SalesPurchasePermissions.View);
    private bool CanManage => WorkspaceAccess && User.HasStaffPermission(AppPermissions.CatalogManage);
    private bool CanUseSalesTemplates => CanManage || WorkspaceAccess && User.HasStaffPermission(SalesPurchasePermissions.SalesView);
    private bool CanUsePartyDiscounts => CanUseSalesTemplates;
    private bool CanUseSupplierDiscounts => CanManage || WorkspaceAccess && User.HasStaffPermission(SalesPurchasePermissions.PurchaseView);
    private Guid ActorId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private string ActorRole => User.FindFirstValue(ClaimTypes.Role) ?? "STAFF";
    private Guid? ActorBranchId => Guid.TryParse(User.FindFirstValue("branch_id"), out var id) ? id : null;

    [HttpGet("party-discounts")]
    public async Task<IActionResult> PartyDiscounts(Guid? customerId, CancellationToken ct)
    {
        if (!CanUsePartyDiscounts || !CanManage && !customerId.HasValue) return Forbid();
        var query = db.CustomerManufacturerDiscounts.AsNoTracking().Include(x => x.Customer).Include(x => x.Manufacturer).AsQueryable();
        if (customerId.HasValue) query = query.Where(x => x.CustomerId == customerId.Value);
        return Ok(await query.OrderBy(x => x.Customer!.FullName).ThenBy(x => x.Manufacturer!.Name)
            .Select(x => new { x.Id, customerId = x.CustomerId, customerName = x.Customer!.FullName, manufacturerId = x.ManufacturerId, manufacturerName = x.Manufacturer!.Name, x.DiscountPercent, x.StartsAt, x.EndsAt, x.IsActive }).ToListAsync(ct));
    }

    [HttpPost("party-discounts")]
    public async Task<IActionResult> CreatePartyDiscount(PartyDiscountInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var error = await ValidateDiscount(input.CustomerId, input.ManufacturerId, input.DiscountPercent, input.StartsAt, input.EndsAt, ct);
        if (error is not null) return BadRequest(new { message = error });
        if (await db.CustomerManufacturerDiscounts.AnyAsync(x => x.CustomerId == input.CustomerId && x.ManufacturerId == input.ManufacturerId, ct)) return Conflict(new { message = "A discount for this party and company already exists. Edit that rule instead." });
        var row = new CustomerManufacturerDiscount { CustomerId = input.CustomerId, ManufacturerId = input.ManufacturerId, DiscountPercent = input.DiscountPercent, StartsAt = input.StartsAt, EndsAt = input.EndsAt, IsActive = input.IsActive };
        db.CustomerManufacturerDiscounts.Add(row); Audit("PARTY_COMPANY_DISCOUNT_CREATED", row, $"{input.CustomerId} · {input.ManufacturerId} · {input.DiscountPercent:0.##}%");
        await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpPut("party-discounts/{id:guid}")]
    public async Task<IActionResult> UpdatePartyDiscount(Guid id, PartyDiscountInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var row = await db.CustomerManufacturerDiscounts.SingleOrDefaultAsync(x => x.Id == id, ct); if (row is null) return NotFound();
        var error = await ValidateDiscount(input.CustomerId, input.ManufacturerId, input.DiscountPercent, input.StartsAt, input.EndsAt, ct); if (error is not null) return BadRequest(new { message = error });
        if (await db.CustomerManufacturerDiscounts.AnyAsync(x => x.Id != id && x.CustomerId == input.CustomerId && x.ManufacturerId == input.ManufacturerId, ct)) return Conflict(new { message = "A discount for this party and company already exists." });
        row.CustomerId = input.CustomerId; row.ManufacturerId = input.ManufacturerId; row.DiscountPercent = input.DiscountPercent; row.StartsAt = input.StartsAt; row.EndsAt = input.EndsAt; row.IsActive = input.IsActive; row.UpdatedAt = ApplicationTime.NepalNow;
        Audit("PARTY_COMPANY_DISCOUNT_UPDATED", row, $"{input.CustomerId} · {input.ManufacturerId} · {input.DiscountPercent:0.##}%"); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpGet("supplier-discounts")]
    public async Task<IActionResult> SupplierDiscounts(Guid? supplierId, CancellationToken ct)
    {
        if (!CanUseSupplierDiscounts || !CanManage && !supplierId.HasValue) return Forbid();
        var query = db.SupplierManufacturerDiscounts.AsNoTracking().Include(x => x.Supplier).Include(x => x.Manufacturer).AsQueryable();
        if (supplierId.HasValue) query = query.Where(x => x.SupplierId == supplierId.Value);
        return Ok(await query.OrderBy(x => x.Supplier!.Name).ThenBy(x => x.Manufacturer!.Name)
            .Select(x => new { x.Id, supplierId = x.SupplierId, supplierName = x.Supplier!.Name, manufacturerId = x.ManufacturerId, manufacturerName = x.Manufacturer!.Name, x.DiscountPercent, x.StartsAt, x.EndsAt, x.IsActive }).ToListAsync(ct));
    }

    [HttpPost("supplier-discounts")]
    public async Task<IActionResult> CreateSupplierDiscount(SupplierDiscountInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var error = await ValidateSupplierDiscount(input, ct); if (error is not null) return BadRequest(new { message = error });
        if (await db.SupplierManufacturerDiscounts.AnyAsync(x => x.SupplierId == input.SupplierId && x.ManufacturerId == input.ManufacturerId, ct)) return Conflict(new { message = "A discount for this supplier and company already exists. Edit that rule instead." });
        var row = new SupplierManufacturerDiscount { SupplierId = input.SupplierId, ManufacturerId = input.ManufacturerId, DiscountPercent = input.DiscountPercent, StartsAt = input.StartsAt, EndsAt = input.EndsAt, IsActive = input.IsActive };
        db.SupplierManufacturerDiscounts.Add(row); Audit("SUPPLIER_COMPANY_DISCOUNT_CREATED", row, $"{input.SupplierId} · {input.ManufacturerId} · {input.DiscountPercent:0.##}%"); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpPut("supplier-discounts/{id:guid}")]
    public async Task<IActionResult> UpdateSupplierDiscount(Guid id, SupplierDiscountInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var row = await db.SupplierManufacturerDiscounts.SingleOrDefaultAsync(x => x.Id == id, ct); if (row is null) return NotFound();
        var error = await ValidateSupplierDiscount(input, ct); if (error is not null) return BadRequest(new { message = error });
        if (await db.SupplierManufacturerDiscounts.AnyAsync(x => x.Id != id && x.SupplierId == input.SupplierId && x.ManufacturerId == input.ManufacturerId, ct)) return Conflict(new { message = "A discount for this supplier and company already exists." });
        row.SupplierId = input.SupplierId; row.ManufacturerId = input.ManufacturerId; row.DiscountPercent = input.DiscountPercent; row.StartsAt = input.StartsAt; row.EndsAt = input.EndsAt; row.IsActive = input.IsActive; row.UpdatedAt = ApplicationTime.NepalNow;
        Audit("SUPPLIER_COMPANY_DISCOUNT_UPDATED", row, $"{input.SupplierId} · {input.ManufacturerId} · {input.DiscountPercent:0.##}%"); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpGet("sales-templates")]
    public async Task<IActionResult> SalesTemplates(CancellationToken ct)
    {
        if (!CanUseSalesTemplates) return Forbid();
        var templates = await db.SalesTemplates.AsNoTracking().Where(x => x.IsActive || CanManage).Include(x => x.Lines).ThenInclude(x => x.Product).OrderBy(x => x.Name).ToListAsync(ct);
        var assignedProductIds = User.IsStaffRole(StaffRoles.SalesExecutive)
            ? await db.Products.Where(product => db.SalesExecutiveProductAssignments.Any(assignment => assignment.SalesExecutiveUserId == ActorId && assignment.IsActive && ((assignment.ProductId.HasValue && assignment.ProductId.Value == product.Id) || (assignment.CategoryId.HasValue && product.Medicine != null && product.Medicine.CategoryId == assignment.CategoryId.Value)))).Select(product => product.Id).ToListAsync(ct)
            : null;
        return Ok(templates.Select(x => new { x.Id, x.Name, x.Description, x.IsActive, Lines = x.Lines.Where(l => assignedProductIds is null || assignedProductIds.Contains(l.ProductId)).OrderBy(l => l.Product!.Name).Select(l => new { l.ProductId, product = l.Product!.Name, l.Quantity, l.Unit, l.DiscountPercent, l.BonusQuantity }) }));
    }

    [HttpPost("sales-templates")]
    public async Task<IActionResult> CreateSalesTemplate(SalesTemplateInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid(); var error = await ValidateTemplate(input, null, ct); if (error is not null) return BadRequest(new { message = error });
        var row = new SalesTemplate { Name = input.Name.Trim(), Description = Clean(input.Description), IsActive = input.IsActive };
        ApplyLines(row, input.Lines); db.SalesTemplates.Add(row); Audit("SALES_TEMPLATE_CREATED", row, row.Name); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpPut("sales-templates/{id:guid}")]
    public async Task<IActionResult> UpdateSalesTemplate(Guid id, SalesTemplateInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid(); var row = await db.SalesTemplates.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == id, ct); if (row is null) return NotFound();
        var error = await ValidateTemplate(input, id, ct); if (error is not null) return BadRequest(new { message = error });
        row.Name = input.Name.Trim(); row.Description = Clean(input.Description); row.IsActive = input.IsActive; row.UpdatedAt = ApplicationTime.NepalNow;
        db.SalesTemplateLines.RemoveRange(row.Lines); row.Lines.Clear(); ApplyLines(row, input.Lines); Audit("SALES_TEMPLATE_UPDATED", row, row.Name); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpGet("budgets")]
    public async Task<IActionResult> Budgets(DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var query = db.PharmacySalesBudgets.AsNoTracking().Include(x => x.Branch).AsQueryable();
        if (!IsSuperAdmin) { if (!ActorBranchId.HasValue) return Forbid(); query = query.Where(x => x.BranchId == ActorBranchId.Value); }
        if (from.HasValue) query = query.Where(x => x.PeriodEnd >= from.Value.Date);
        if (to.HasValue) query = query.Where(x => x.PeriodStart < to.Value.Date.AddDays(1));
        var rows = await query.OrderByDescending(x => x.PeriodStart).Take(200).ToListAsync(ct);
        var result = new List<object>();
        foreach (var row in rows)
        {
            var actualQuery = db.Invoices.AsNoTracking().Where(x => x.IssuedAt >= row.PeriodStart && x.IssuedAt < row.PeriodEnd.AddDays(1) && x.PaymentStatus != "VOID" && x.Order != null && x.Order.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed);
            if (row.BranchId.HasValue) actualQuery = actualQuery.Where(x => x.Order!.BranchId == row.BranchId.Value);
            var actual = await actualQuery.SumAsync(x => (decimal?)x.Total, ct) ?? 0m;
            result.Add(new { row.Id, row.BranchId, branch = row.Branch?.Name ?? "All branches", row.PeriodStart, row.PeriodEnd, row.TargetAmount, actualAmount = actual, variance = actual - row.TargetAmount, row.Notes });
        }
        return Ok(result);
    }

    [HttpPost("budgets")]
    public async Task<IActionResult> SaveBudget(BudgetInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var branchId = input.BranchId;
        if (!IsSuperAdmin) { if (!ActorBranchId.HasValue || branchId.HasValue && branchId != ActorBranchId) return Forbid(); branchId = ActorBranchId; }
        if (branchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == branchId && x.IsActive, ct)) return BadRequest(new { message = "Select an active branch." });
        var start = input.PeriodStart.Date; var end = input.PeriodEnd.Date;
        if (input.TargetAmount <= 0 || start > end || (end - start).TotalDays > 370 || input.Notes?.Length > 500) return BadRequest(new { message = "Enter a positive target, valid date range of at most 371 days, and notes up to 500 characters." });
        var row = await db.PharmacySalesBudgets.SingleOrDefaultAsync(x => x.BranchId == branchId && x.PeriodStart == start && x.PeriodEnd == end, ct);
        var created = row is null;
        if (row is null) { row = new PharmacySalesBudget { BranchId = branchId, PeriodStart = start, PeriodEnd = end, TargetAmount = input.TargetAmount, Notes = Clean(input.Notes) }; db.PharmacySalesBudgets.Add(row); }
        else { row.TargetAmount = input.TargetAmount; row.Notes = Clean(input.Notes); row.UpdatedAt = ApplicationTime.NepalNow; }
        Audit(created ? "SALES_BUDGET_CREATED" : "SALES_BUDGET_UPDATED", row, $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd} · NPR {input.TargetAmount:0.00}"); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    private async Task<string?> ValidateDiscount(Guid customerId, Guid manufacturerId, decimal percent, DateTime? starts, DateTime? ends, CancellationToken ct)
    {
        if (percent is <= 0 or > 100 || starts.HasValue && ends.HasValue && starts.Value.Date > ends.Value.Date) return "Discount must be between 0.01% and 100%, with a valid effective date range.";
        if (!await db.Customers.AnyAsync(x => x.Id == customerId && x.IsActive, ct)) return "Select an active customer/party.";
        if (!await db.Manufacturers.AnyAsync(x => x.Id == manufacturerId, ct)) return "Select a valid company/manufacturer.";
        return null;
    }

    private async Task<string?> ValidateSupplierDiscount(SupplierDiscountInput input, CancellationToken ct)
    {
        if (input.DiscountPercent is <= 0 or > 100 || input.StartsAt.HasValue && input.EndsAt.HasValue && input.StartsAt.Value.Date > input.EndsAt.Value.Date) return "Discount must be between 0.01% and 100%, with a valid effective date range.";
        if (!await db.Suppliers.AnyAsync(x => x.Id == input.SupplierId && x.IsActive, ct)) return "Select an active supplier.";
        if (!await db.Manufacturers.AnyAsync(x => x.Id == input.ManufacturerId, ct)) return "Select a valid company/manufacturer.";
        return null;
    }

    private async Task<string?> ValidateTemplate(SalesTemplateInput input, Guid? currentId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160 || input.Description?.Length > 500 || input.Lines.Count == 0 || input.Lines.Count > 100) return "Enter a template name and between 1 and 100 product lines.";
        if (input.Lines.Any(x => x.ProductId == Guid.Empty || x.Quantity <= 0 || x.Quantity > 100000 || x.DiscountPercent is < 0 or > 100 || x.BonusQuantity < 0 || x.Unit?.Length > 40) || input.Lines.Select(x => x.ProductId).Distinct().Count() != input.Lines.Count) return "Template lines must use unique products, positive quantities and valid discount/bonus values.";
        if (await db.SalesTemplates.AnyAsync(x => x.Id != currentId && x.Name.ToLower() == input.Name.Trim().ToLower(), ct)) return "A sales template with that name already exists.";
        var ids = input.Lines.Select(x => x.ProductId).ToList();
        if (await db.Products.CountAsync(x => ids.Contains(x.Id) && x.IsActive, ct) != ids.Count) return "Every template product must exist and be active.";
        return null;
    }

    private static void ApplyLines(SalesTemplate template, IEnumerable<SalesTemplateLineInput> lines)
    {
        foreach (var line in lines) template.Lines.Add(new SalesTemplateLine { ProductId = line.ProductId, Quantity = line.Quantity, Unit = Clean(line.Unit), DiscountPercent = line.DiscountPercent, BonusQuantity = line.BonusQuantity });
    }

    private void Audit(string action, AuditedEntity item, string value) => db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = action, EntityType = item.GetType().Name, EntityId = item.Id.ToString(), NewValue = value, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public sealed record PartyDiscountInput(Guid CustomerId, Guid ManufacturerId, decimal DiscountPercent, DateTime? StartsAt, DateTime? EndsAt, bool IsActive);
    public sealed record SupplierDiscountInput(Guid SupplierId, Guid ManufacturerId, decimal DiscountPercent, DateTime? StartsAt, DateTime? EndsAt, bool IsActive);
    public sealed record SalesTemplateLineInput(Guid ProductId, int Quantity, string? Unit, decimal DiscountPercent, int BonusQuantity);
    public sealed record SalesTemplateInput(string Name, string? Description, bool IsActive, List<SalesTemplateLineInput> Lines);
    public sealed record BudgetInput(Guid? BranchId, DateTime PeriodStart, DateTime PeriodEnd, decimal TargetAmount, string? Notes);
}
