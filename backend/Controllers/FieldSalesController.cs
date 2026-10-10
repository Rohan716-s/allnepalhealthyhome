using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/field-sales")]
public sealed partial class FieldSalesController(ApplicationDbContext db) : ControllerBase
{
    private StaffUser actor = null!;
    private bool Manager => actor.Role is StaffRoles.SuperAdmin or StaffRoles.Admin or StaffRoles.SalesManager;
    private bool Global => actor.Role == StaffRoles.SuperAdmin || actor.Role == StaffRoles.Admin && actor.BranchId == null;
    private bool Accountant => actor.Role == StaffRoles.Accountant;
    private bool Executive => actor.Role == StaffRoles.SalesExecutive;
    private bool BranchAllowed(Guid branch) => Global || actor.BranchId == branch;
    private async Task<bool> Access(CancellationToken ct)
    {
        if (!User.TryGetStaffId(out var id)) return false;
        actor = (await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.IsActive, ct))!;
        return actor != null && (actor.Role is StaffRoles.SuperAdmin or StaffRoles.Admin or StaffRoles.SalesManager or StaffRoles.SalesExecutive or StaffRoles.Accountant)
            && !await db.AccessRoles.AnyAsync(x => x.Name == actor.Role && !x.IsActive, ct);
    }
    private IQueryable<SalesFieldRecord> Records() => db.SalesFieldRecords.Where(x =>
        (Global || x.BranchId == actor.BranchId) && (!Executive || x.ExecutiveId == actor.Id));
    private IQueryable<SalesCustomerAssignment> Assignments() => db.SalesCustomerAssignments.Where(x =>
        (Global || x.BranchId == actor.BranchId) && (!Executive || x.ExecutiveId == actor.Id));
    private void Audit(SalesFieldRecord row, string action) => db.ActivityLogs.Add(new ActivityLog {
        ActorId = actor.Id, ActorRole = actor.Role, Action = action, EntityType = nameof(SalesFieldRecord), EntityId = row.Id.ToString(), NewValue = row.Status });

    [HttpGet("workspace")]
    public async Task<IActionResult> Workspace(CancellationToken ct)
    {
        if (!await Access(ct)) return Forbid();
        var month = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var assignments = await Assignments().ToListAsync(ct);
        var customerIds = assignments.Where(x => x.IsActive).Select(x => x.CustomerId).Distinct().ToArray();
        var customers = await db.Customers.AsNoTracking().Where(x => x.IsActive && Enumerable.Contains(customerIds, x.Id))
            .Select(x => new { x.Id, x.FullName, x.Phone, x.CreditLimit, x.PaymentTermsDays,
                Addresses = x.Addresses.Select(a => new { a.Id, a.Label, a.StreetTole, a.Municipality }).ToList() }).ToListAsync(ct);
        var records = await Records().AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var ownedOrderIds = await Records().Where(x => x.Kind == "ORDER" && x.OrderId != null).Select(x => x.OrderId!.Value).ToListAsync(ct);
        var orders = await db.Orders.AsNoTracking().Where(x => ownedOrderIds.Contains(x.Id))
            .Select(x => new { x.Id, x.OrderNumber, x.CustomerId, x.Status, x.PaymentStatus, x.Total, x.CreatedAt,
                Items = x.Items.Select(i => new { i.ProductId, i.ProductName, i.Quantity, i.Unit, i.UnitPrice }).ToList() })
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var invoices = await db.Invoices.AsNoTracking().Where(x => x.Order != null && Enumerable.Contains(customerIds, x.Order.CustomerId)
            && (Global || x.Order.BranchId == actor.BranchId)
            && x.Order.Status != OrderStatuses.Cancelled && x.PaymentStatus != "VOID" && x.Total > x.PaidAmount)
            .Select(x => new { x.Id, x.InvoiceNumber, x.OrderId, x.Order!.CustomerId, x.Total, x.PaidAmount, x.DueAt }).ToListAsync(ct);
        var targets = await db.SalesExecutiveTargets.AsNoTracking().Where(x =>
            (Global || x.BranchId == actor.BranchId) && (!Executive || x.ExecutiveId == actor.Id) && x.Month == month).ToListAsync(ct);
        var sales = await db.Orders.Where(x => ownedOrderIds.Contains(x.Id) && x.CreatedAt >= month && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed)
            .SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var returned = await db.SaleReturns.Where(x => x.OrderId.HasValue && ownedOrderIds.Contains(x.OrderId.Value) && x.Status == "APPROVED" && x.ReturnDate >= month).SumAsync(x => (decimal?)x.TotalAmount, ct) ?? 0;
        sales = Math.Max(0, sales - returned);
        return Ok(new { role = actor.Role, actor.BranchId, assignments, customers, records, orders, invoices, targets,
            summary = new { sales, target = targets.Sum(x => x.TargetAmount), orders = orders.Count,
                pending = records.Count(x => x.Status == "PENDING"), outstanding = invoices.Sum(x => x.Total - x.PaidAmount) } });
    }

    [HttpGet("setup-options")]
    public async Task<IActionResult> Options(CancellationToken ct)
    {
        if (!await Access(ct) || !Manager) return Forbid();
        return Ok(new {
            executives = await db.StaffUsers.AsNoTracking().Where(x => x.IsActive && x.Role == StaffRoles.SalesExecutive && (Global || x.BranchId == actor.BranchId)).Select(x => new { x.Id, x.FullName, x.BranchId }).ToListAsync(ct),
            customers = await db.Customers.AsNoTracking().Where(x => x.IsActive && (Global ||
                x.PharmacyDetails != null && x.PharmacyDetails.PreferredBranchId == actor.BranchId || db.Orders.Any(o => o.CustomerId == x.Id && o.BranchId == actor.BranchId)))
                .Select(x => new { x.Id, x.FullName, x.Phone }).OrderBy(x => x.FullName).ToListAsync(ct),
            branches = await db.Branches.AsNoTracking().Where(x => Global || x.Id == actor.BranchId).Select(x => new { x.Id, x.Name }).ToListAsync(ct) });
    }

    public sealed record AssignmentInput(Guid ExecutiveId, Guid CustomerId, Guid BranchId, string Territory, bool IsActive);
    [HttpPut("assignments")]
    public async Task<IActionResult> Assign(AssignmentInput input, CancellationToken ct)
    {
        if (!await Access(ct) || !Manager || !BranchAllowed(input.BranchId)) return Forbid();
        if (input.Territory.Length > 160 || !await db.StaffUsers.AnyAsync(x => x.Id == input.ExecutiveId && x.Role == StaffRoles.SalesExecutive && x.IsActive && x.BranchId == input.BranchId, ct)
            || !await db.Customers.AnyAsync(x => x.Id == input.CustomerId && x.IsActive, ct)) return BadRequest(new { message = "Choose an active executive in this branch and an active customer." });
        var row = await db.SalesCustomerAssignments.SingleOrDefaultAsync(x => x.ExecutiveId == input.ExecutiveId && x.CustomerId == input.CustomerId && x.BranchId == input.BranchId, ct);
        if (row == null) { row = new SalesCustomerAssignment { ExecutiveId = input.ExecutiveId, CustomerId = input.CustomerId, BranchId = input.BranchId }; db.SalesCustomerAssignments.Add(row); }
        row.Territory = input.Territory.Trim(); row.IsActive = input.IsActive; row.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = actor.Id, ActorRole = actor.Role, Action = "SALES_CUSTOMER_ASSIGNED", EntityType = nameof(SalesCustomerAssignment), EntityId = row.Id.ToString(), NewValue = JsonSerializer.Serialize(input) });
        await db.SaveChangesAsync(ct); return Ok(row);
    }

    public sealed record TargetInput(Guid ExecutiveId, Guid BranchId, DateTime Month, decimal TargetAmount, decimal DiscountLimitPercent);
    [HttpPut("targets")]
    public async Task<IActionResult> Target(TargetInput input, CancellationToken ct)
    {
        if (!await Access(ct) || !Manager || !BranchAllowed(input.BranchId)) return Forbid();
        if (input.TargetAmount < 0 || input.DiscountLimitPercent is < 0 or > 100 || !await db.StaffUsers.AnyAsync(x => x.Id == input.ExecutiveId && x.Role == StaffRoles.SalesExecutive && x.IsActive && x.BranchId == input.BranchId, ct)) return BadRequest(new { message = "Choose an active executive, a positive target and a discount limit from 0 to 100%." });
        var month = new DateTime(input.Month.Year, input.Month.Month, 1);
        var row = await db.SalesExecutiveTargets.SingleOrDefaultAsync(x => x.ExecutiveId == input.ExecutiveId && x.Month == month, ct);
        if (row == null) { row = new SalesExecutiveTarget { ExecutiveId = input.ExecutiveId, Month = month }; db.SalesExecutiveTargets.Add(row); }
        row.BranchId = input.BranchId; row.TargetAmount = input.TargetAmount; row.DiscountLimitPercent = input.DiscountLimitPercent; row.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = actor.Id, ActorRole = actor.Role, Action = "SALES_TARGET_SET", EntityType = nameof(SalesExecutiveTarget), EntityId = row.Id.ToString(), NewValue = JsonSerializer.Serialize(input) });
        await db.SaveChangesAsync(ct); return Ok(row);
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products(string? search, CancellationToken ct)
    {
        if (!await Access(ct) || !Executive || actor.BranchId == null) return Forbid();
        var query = db.Products.AsNoTracking().Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Name.Contains(search) || x.Sku.Contains(search) || x.Barcode != null && x.Barcode.Contains(search));
        var products = await query.Include(x => x.Medicine).OrderBy(x => x.Name).ToListAsync(ct);
        var inventory = await db.Inventory.AsNoTracking().Where(x => x.BranchId == actor.BranchId).Where(InventoryAvailability.SellableOn(DateTime.UtcNow.Date)).ToListAsync(ct);
        return Ok(products.Select(p => new { p.Id, p.Name, p.Sku, price = p.SellingPrice, unit = p.SalesUnit,
            available = InventoryAvailability.ForProduct(inventory.Where(x => x.ProductId == p.Id), DateTime.UtcNow.Date) / Math.Max(1, p.SalesUnitToBase), prescriptionRequired = p.Medicine?.PrescriptionRequired == true }));
    }

    public sealed record Line(Guid ProductId, int Quantity);
    public sealed record RecordInput(Guid RequestId, Guid CustomerId, string Kind, string Notes, DateTime? FollowUpAt,
        Guid? AddressId, Guid? OrderId, IReadOnlyList<Line>? Items, decimal DiscountPercent = 0, bool Credit = false,
        decimal Amount = 0, string Method = "CASH", string Proof = "", Guid? ProductId = null, int Quantity = 0, bool ExpiredReturn = false);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpPost("proof")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> UploadProof([FromForm] IFormFile file, [FromServices] IMediaFileStorage storage, CancellationToken ct)
    {
        if (!await Access(ct) || !Executive || actor.BranchId == null) return Forbid();
        try { var stored = await storage.SaveAsync(file, ct); return Ok(new { url = $"/api/field-sales/proof/{stored.StoredFileName}" }); }
        catch (InvalidDataException error) { return BadRequest(new { message = error.Message }); }
    }

    [HttpGet("proof/{fileName}")]
    public async Task<IActionResult> Proof(string fileName, [FromServices] IMediaFileStorage storage, CancellationToken ct)
    {
        if (!await Access(ct)) return Forbid();
        if (Path.GetFileName(fileName) != fileName || !await Records().AnyAsync(x => x.Kind == "COLLECTION" && x.PayloadJson.Contains("/api/field-sales/proof/" + fileName), ct)) return NotFound();
        var stream = await storage.OpenReadAsync(fileName, ct);
        return stream == null ? NotFound() : File(stream, "application/octet-stream", "collection-proof" + Path.GetExtension(fileName));
    }

    [HttpPost("records/{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        if (!await Access(ct) || !Executive) return Forbid();
        var row = await Records().SingleOrDefaultAsync(x => x.Id == id && (x.Kind == "VISIT" || x.Kind == "FOLLOW_UP"), ct);
        if (row == null) return NotFound();
        row.Status = "COMPLETED"; row.UpdatedAt = DateTime.UtcNow; Audit(row, "SALES_FOLLOW_UP_COMPLETED"); await db.SaveChangesAsync(ct); return Ok(row);
    }

    [HttpPost("records")]
    public async Task<IActionResult> Submit(RecordInput input, CancellationToken ct)
    {
        if (!await Access(ct) || !Executive || actor.BranchId is not Guid branch) return Forbid();
        if (input.RequestId == Guid.Empty || input.Notes.Length > 2000 || input.Proof.Length > 2000 || input.Kind is not ("VISIT" or "FOLLOW_UP" or "ORDER" or "COLLECTION" or "RETURN")) return BadRequest(new { message = "Complete the request with valid details." });
        var existing = await Records().SingleOrDefaultAsync(x => x.RequestId == input.RequestId, ct);
        if (existing != null) return JsonSerializer.Serialize(JsonSerializer.Deserialize<RecordInput>(existing.PayloadJson, JsonOptions), JsonOptions) == JsonSerializer.Serialize(input, JsonOptions) ? Ok(existing) : Conflict(new { message = "This request identifier has already been used." });
        if (!await Assignments().AnyAsync(x => x.CustomerId == input.CustomerId && x.IsActive, ct) || !await db.Customers.AnyAsync(x => x.Id == input.CustomerId && x.IsActive, ct)) return Forbid();
        if (string.IsNullOrWhiteSpace(input.Notes) && input.Kind is "VISIT" or "FOLLOW_UP" or "RETURN") return BadRequest(new { message = "Add discussion notes or a reason." });
        if (input.Kind == "ORDER" && (input.Items == null || input.Items.Count is < 1 or > 100 || input.Items.Any(x => x == null || x.Quantity is < 1 or > 1000000) || input.Items.Select(x => x.ProductId).Distinct().Count() != input.Items.Count || input.DiscountPercent is < 0 or > 100 || input.AddressId == null)) return BadRequest(new { message = "Choose an address and valid product quantities." });
        if (input.Kind == "COLLECTION" && (input.Amount <= 0 || input.Amount > 1000000000 || input.Method is not ("CASH" or "BANK" or "CHEQUE" or "DIGITAL") || string.IsNullOrWhiteSpace(input.Proof))) return BadRequest(new { message = "Add a positive collection amount, payment method and receipt/reference or proof link." });
        if (input.Kind == "RETURN" && (input.OrderId == null || input.ProductId == null || input.Quantity <= 0 || input.Notes.Length > 500 || !await Records().AnyAsync(x => x.Kind == "ORDER" && x.OrderId == input.OrderId && x.CustomerId == input.CustomerId, ct))) return BadRequest(new { message = "Choose one of your customer's approved orders, a positive return quantity and a reason within 500 characters." });
        decimal amount = input.Amount;
        var snapshot = JsonNode.Parse(JsonSerializer.Serialize(input, JsonOptions))!.AsObject();
        if (input.Kind == "ORDER") {
            if (!await db.Addresses.AnyAsync(x => x.Id == input.AddressId && x.CustomerId == input.CustomerId, ct)) return BadRequest(new { message = "Choose this customer's saved delivery address." });
            var ids = input.Items!.Select(x => x.ProductId).ToArray();
            var products = await db.Products.Where(x => x.IsActive && Enumerable.Contains(ids, x.Id)).ToListAsync(ct);
            if (products.Count != ids.Length) return BadRequest(new { message = "Only active products can be ordered." });
            var subtotal = input.Items!.Sum(x => products.Single(p => p.Id == x.ProductId).SellingPrice * x.Quantity);
            var address = await db.Addresses.SingleAsync(x => x.Id == input.AddressId && x.CustomerId == input.CustomerId, ct);
            var zone = await DeliveryZone(branch, address, ct);
            if (zone != null && subtotal < zone.MinimumOrder) return BadRequest(new { message = $"This delivery area requires a minimum order of NPR {zone.MinimumOrder:N2}." });
            var fee = zone == null || zone.FreeDeliveryThreshold > 0 && subtotal >= zone.FreeDeliveryThreshold ? 0 : zone.DeliveryFee;
            amount = subtotal - decimal.Round(subtotal * input.DiscountPercent / 100m, 2);
            amount += fee;
            snapshot["deliveryFee"] = fee;
            snapshot["lines"] = JsonSerializer.SerializeToNode(input.Items!.Select(x => new { x.ProductId, name = products.Single(p => p.Id == x.ProductId).Name, x.Quantity, unitPrice = products.Single(p => p.Id == x.ProductId).SellingPrice }), JsonOptions);
            var month = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            snapshot["discountLimitPercent"] = await db.SalesExecutiveTargets.Where(x => x.ExecutiveId == actor.Id && x.Month == month).Select(x => (decimal?)x.DiscountLimitPercent).SingleOrDefaultAsync(ct) ?? 0;
        }
        var row = new SalesFieldRecord { ExecutiveId = actor.Id, BranchId = branch, CustomerId = input.CustomerId, Kind = input.Kind,
            Notes = input.Notes.Trim(), FollowUpAt = input.FollowUpAt, OccurredAt = DateTime.UtcNow, Amount = amount,
            OrderId = input.Kind == "RETURN" ? input.OrderId : null, RequestId = input.RequestId,
            Status = input.Kind is "VISIT" or "FOLLOW_UP" ? "RECORDED" : "PENDING", PayloadJson = snapshot.ToJsonString(JsonOptions) };
        db.SalesFieldRecords.Add(row); Audit(row, "SALES_" + row.Kind + "_SUBMITTED");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException error) when (error.InnerException is MySqlConnector.MySqlException { Number: 1062 }) { return Conflict(new { message = "This request was already submitted. Refresh the workspace to see its status." }); }
        return Ok(row);
    }

    public sealed record ReviewInput(bool Approve, string Note);
    [HttpPost("records/{id:guid}/review")]
    public async Task<IActionResult> Review(Guid id, ReviewInput input, CancellationToken ct)
    {
        if (!await Access(ct) || Executive || input.Note.Length > 2000) return Forbid();
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () => {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var row = await Records().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (row == null) return NotFound();
            if (row.Kind == "COLLECTION" ? !Accountant : !Manager) return Forbid();
            if (row.Status != "PENDING") return Conflict(new { message = "This request has already been reviewed." });
            if (row.ExecutiveId == actor.Id) return Forbid();
            if (string.IsNullOrWhiteSpace(input.Note)) return BadRequest(new { message = "Add an approval or rejection note." });
            if (input.Approve) {
                var payload = JsonSerializer.Deserialize<RecordInput>(row.PayloadJson, JsonOptions)!;
                IActionResult? error = row.Kind switch {
                    "ORDER" => await ApproveOrder(row, payload, ct),
                    "COLLECTION" => await ApproveCollection(row, payload, ct),
                    "RETURN" => await ApproveReturn(row, payload, ct),
                    _ => BadRequest(new { message = "This record does not require approval." }) };
                if (error != null) return error;
            }
            row.Status = input.Approve ? "APPROVED" : "REJECTED"; row.ReviewedBy = actor.Id; row.ReviewedAt = DateTime.UtcNow; row.ReviewNote = input.Note.Trim(); row.UpdatedAt = DateTime.UtcNow;
            Audit(row, "SALES_" + row.Kind + "_" + row.Status); await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(row);
        });
    }
}
