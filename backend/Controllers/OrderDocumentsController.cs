using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
public sealed class OrderDocumentsController(ApplicationDbContext db, IOrderDocumentStorage storage) : ControllerBase
{
    [HttpPost("api/orders/{orderId:guid}/documents")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 11 * 1024 * 1024)]
    public async Task<ActionResult<OrderDocumentRow>> UploadCustomer(Guid orderId, [FromForm] IFormFile file, [FromForm] string kind, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (!string.Equals(kind, "PAYMENT_PROOF", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Customers may upload payment proof for their own order." });
        var order = await db.Orders.SingleOrDefaultAsync(x => x.Id == orderId && x.CustomerId == customerId, ct);
        if (order is null) return NotFound();
        if (order.PaymentStatus is "PAID" or "REFUNDED") return Conflict(new { message = "This order is already settled and cannot accept another payment proof." });
        if (await db.OrderDocuments.CountAsync(x => x.OrderId == orderId && x.Kind == "PAYMENT_PROOF", ct) >= 10) return Conflict(new { message = "This order has reached the payment-proof upload limit." });
        return await Save(order, file, "PAYMENT_PROOF", customerId, null, "CUSTOMER_PAYMENT_PROOF_UPLOADED", ct);
    }

    [HttpGet("api/orders/{orderId:guid}/documents")]
    public async Task<ActionResult<IReadOnlyList<OrderDocumentRow>>> CustomerList(Guid orderId, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (!await db.Orders.AnyAsync(x => x.Id == orderId && x.CustomerId == customerId, ct)) return NotFound();
        return Ok(await db.OrderDocuments.AsNoTracking().Where(x => x.OrderId == orderId && (x.UploadedByCustomerId == customerId || x.Kind == "DELIVERY_PROOF" && x.Order!.Status == OrderStatuses.Delivered))
            .OrderByDescending(x => x.CreatedAt).Select(x => Row(orderId, x, "/api/orders")).ToListAsync(ct));
    }

    [HttpGet("api/orders/{orderId:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> CustomerDownload(Guid orderId, Guid documentId, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var document = await db.OrderDocuments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == documentId && x.OrderId == orderId && (x.UploadedByCustomerId == customerId || x.Kind == "DELIVERY_PROOF" && x.Order!.Status == OrderStatuses.Delivered) && x.Order!.CustomerId == customerId, ct);
        return document is null ? NotFound() : await Download(document, ct);
    }

    [HttpPost("api/delivery/orders/{orderId:guid}/documents")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 11 * 1024 * 1024)]
    public async Task<ActionResult<OrderDocumentRow>> UploadDelivery(Guid orderId, [FromForm] IFormFile file, [FromForm] string kind, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery) || !User.TryGetStaffId(out var staffId)) return Forbid();
        var normalized = kind?.Trim().ToUpperInvariant();
        if (normalized is not ("INVOICE" or "CHEQUE" or "PAYMENT_PROOF" or "DELIVERY_PROOF")) return BadRequest(new { message = "Choose an invoice, cheque, payment proof, or delivery proof document type." });
        var assignment = await db.DeliveryAssignments.AsNoTracking().SingleOrDefaultAsync(x => x.OrderId == orderId && x.DeliveryStaffId == staffId, ct);
        if (assignment is null) return NotFound();
        if (assignment.Status != DeliveryStatuses.Arrived) return Conflict(new { message = "Delivery documents can only be uploaded after arrival, while completing delivery." });
        if (await db.OrderDocuments.CountAsync(x => x.OrderId == orderId && x.UploadedByStaffUserId == staffId, ct) >= 20) return Conflict(new { message = "This order has reached the delivery document upload limit." });
        var order = await db.Orders.SingleAsync(x => x.Id == orderId, ct);
        return await Save(order, file, normalized, null, staffId, "DELIVERY_DOCUMENT_UPLOADED", ct);
    }

    [HttpGet("api/delivery/orders/{orderId:guid}/documents")]
    public async Task<ActionResult<IReadOnlyList<OrderDocumentRow>>> DeliveryList(Guid orderId, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery) || !User.TryGetStaffId(out var staffId)) return Forbid();
        if (!await db.DeliveryAssignments.AnyAsync(x => x.OrderId == orderId && x.DeliveryStaffId == staffId, ct)) return NotFound();
        return Ok(await db.OrderDocuments.AsNoTracking().Where(x => x.OrderId == orderId).OrderByDescending(x => x.CreatedAt).Select(x => Row(orderId, x, "/api/delivery/orders")).ToListAsync(ct));
    }

    [HttpGet("api/delivery/orders/{orderId:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> DeliveryDownload(Guid orderId, Guid documentId, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery) || !User.TryGetStaffId(out var staffId)) return Forbid();
        if (!await db.DeliveryAssignments.AnyAsync(x => x.OrderId == orderId && x.DeliveryStaffId == staffId, ct)) return NotFound();
        var document = await db.OrderDocuments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == documentId && x.OrderId == orderId, ct);
        return document is null ? NotFound() : await Download(document, ct);
    }

    [HttpGet("api/admin/orders/{orderId:guid}/documents")]
    [HttpGet("api/superadmin/orders/{orderId:guid}/documents")]
    public async Task<ActionResult<IReadOnlyList<OrderDocumentRow>>> AdminList(Guid orderId, CancellationToken ct)
    {
        if (!CanReadStaffDocuments) return Forbid();
        var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(x => x.Id == orderId, ct);
        if (order is null || !BranchAllowed(order.BranchId)) return NotFound();
        var basePath = Request.Path.StartsWithSegments("/api/superadmin", StringComparison.OrdinalIgnoreCase) ? "/api/superadmin/orders" : "/api/admin/orders";
        return Ok(await db.OrderDocuments.AsNoTracking().Where(x => x.OrderId == orderId).OrderByDescending(x => x.CreatedAt).Select(x => Row(orderId, x, basePath)).ToListAsync(ct));
    }

    [HttpGet("api/admin/orders/{orderId:guid}/documents/{documentId:guid}")]
    [HttpGet("api/superadmin/orders/{orderId:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> AdminDownload(Guid orderId, Guid documentId, CancellationToken ct)
    {
        if (!CanReadStaffDocuments) return Forbid();
        var document = await db.OrderDocuments.AsNoTracking().Include(x => x.Order).SingleOrDefaultAsync(x => x.Id == documentId && x.OrderId == orderId && x.Order != null, ct);
        return document is null || !BranchAllowed(document.Order!.BranchId) ? NotFound() : await Download(document, ct);
    }

    private bool CanReadStaffDocuments => User.IsStaffRole(StaffRoles.Admin, StaffRoles.SuperAdmin, StaffRoles.Supervisor, StaffRoles.Accountant, StaffRoles.Pharmacist);
    private bool BranchAllowed(Guid? branchId)
    {
        if (User.IsStaffRole(StaffRoles.SuperAdmin)) return true;
        if (!Guid.TryParse(User.FindFirst("branch_id")?.Value, out var scopedBranch)) return !User.IsStaffRole(StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery);
        return branchId == scopedBranch;
    }

    private async Task<ActionResult<OrderDocumentRow>> Save(PharmacyOrder order, IFormFile file, string kind, Guid? customerId, Guid? staffId, string auditAction, CancellationToken ct)
    {
        StoredOrderDocument stored;
        try { stored = await storage.SaveAsync(file, ct); }
        catch (InvalidDataException ex) { return BadRequest(new { message = ex.Message }); }
        var document = new OrderDocument
        {
            OrderId = order.Id,
            UploadedByCustomerId = customerId,
            UploadedByStaffUserId = staffId,
            Kind = kind,
            OriginalFileName = stored.OriginalFileName,
            StoredFileName = stored.StoredFileName,
            ContentType = stored.ContentType,
            Length = stored.Length,
            Sha256 = stored.Sha256
        };
        db.OrderDocuments.Add(document);
        db.ActivityLogs.Add(new ActivityLog { ActorId = staffId, ActorRole = staffId.HasValue ? StaffRoles.Delivery : "CUSTOMER", Action = auditAction, EntityType = "PharmacyOrder", EntityId = order.Id.ToString(), NewValue = $"{kind}:{stored.Sha256}" });
        await db.SaveChangesAsync(ct);
        return Ok(Row(order.Id, document, staffId.HasValue ? "/api/delivery/orders" : "/api/orders"));
    }

    private async Task<IActionResult> Download(OrderDocument document, CancellationToken ct)
    {
        var stream = await storage.OpenReadAsync(document.StoredFileName, ct);
        return stream is null ? NotFound() : File(stream, document.ContentType, document.OriginalFileName, enableRangeProcessing: true);
    }

    private static OrderDocumentRow Row(Guid orderId, OrderDocument document, string basePath) => new(document.Id, document.Kind, document.OriginalFileName, document.ContentType, document.Length, document.CreatedAt, $"{basePath}/{orderId}/documents/{document.Id}");
}
