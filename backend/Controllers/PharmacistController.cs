using System.Globalization;
using System.Security.Claims;
using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/pharmacist")]
public sealed class PharmacistController(ApplicationDbContext db, IPasswordService passwords, IPrescriptionFileStorage files, INotificationTemplateService notifications, IMessagingConversationService messaging) : ControllerBase
{
    private bool Authorized => User.IsStaffRole(StaffRoles.Pharmacist, StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.SuperAdmin);
    private Guid StaffId => User.TryGetStaffId(out var id) ? id : Guid.Empty;

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardStatsResponse>> Dashboard(CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var prescriptionCounts = await db.Prescriptions.GroupBy(x => x.Status).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var orderCounts = await db.Orders.GroupBy(x => x.Status).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var inventory = await db.Inventory.Include(x => x.Product).ThenInclude(x => x!.Medicine).ToListAsync(ct);
        var today = DateTime.UtcNow.Date;
        var inventoryCounts = new Dictionary<string, int>
        {
            ["LOW_STOCK"] = inventory.Count(x => x.StockQuantity - x.ReservedQuantity <= x.MinimumStock && x.StockQuantity - x.ReservedQuantity > 0),
            ["OUT_OF_STOCK"] = inventory.Count(x => x.StockQuantity - x.ReservedQuantity <= 0),
            ["NEAR_EXPIRY"] = inventory.Count(x => x.ExpiryDate is not null && x.ExpiryDate.Value.Date >= DateTime.UtcNow.Date && x.ExpiryDate.Value.Date <= DateTime.UtcNow.Date.AddDays(90)),
            ["EXPIRED"] = inventory.Count(x => x.ExpiryDate is not null && x.ExpiryDate.Value.Date < DateTime.UtcNow.Date),
        };
        return Ok(new DashboardStatsResponse(prescriptionCounts, orderCounts, inventoryCounts));
    }

    [HttpGet("prescriptions")]
    public async Task<ActionResult<PagedResponse<StaffPrescriptionListItem>>> Prescriptions([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        if (!Authorized) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Prescriptions.AsNoTracking().Include(x => x.Customer).Include(x => x.ExtractedItems).Include(x => x.Reviews).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Customer!.FullName.Contains(search) || x.Customer.Email.Contains(search) || x.Id.ToString().Contains(search));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.SubmittedAt ?? x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<StaffPrescriptionListItem>(rows.Select(x => new StaffPrescriptionListItem(x.Id, Number(x.Id), x.CustomerId, x.Customer!.FullName, x.Customer.Phone, x.SubmittedAt ?? x.CreatedAt, x.ExtractedItems.Count, Confidence(x), x.Status, x.Reviews.OrderByDescending(r => r.CreatedAt).FirstOrDefault()?.Status ?? x.Status, null, Priority(x), null)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("prescriptions/{id:guid}")]
    public async Task<ActionResult<StaffPrescriptionResponse>> Prescription(Guid id, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var item = await LoadPrescription(id, ct);
        return item is null ? NotFound() : Ok(ToPrescription(item));
    }

    [HttpPost("prescriptions/{id:guid}/start-review")]
    public async Task<ActionResult<StaffPrescriptionResponse>> StartReview(Guid id, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var prescription = await db.Prescriptions.SingleOrDefaultAsync(x => x.Id == id, ct); if (prescription is null) return NotFound();
        if (prescription.Status is not (PrescriptionStatuses.PendingPharmacistReview or PrescriptionStatuses.Scanned or PrescriptionStatuses.Uploaded)) return Conflict(new { message = "This prescription is not waiting for review." });
        prescription.Status = PrescriptionStatuses.UnderReview; prescription.UpdatedAt = DateTime.UtcNow; AddPrescriptionHistory(id, PrescriptionStatuses.UnderReview, "Pharmacist started review."); db.PrescriptionReviews.Add(new PrescriptionReview { PrescriptionId = id, Status = PrescriptionStatuses.UnderReview, ReviewerId = StaffId.ToString(), ReviewedAt = DateTime.UtcNow }); db.ActivityLogs.Add(Activity("PHARMACIST_STARTED_PRESCRIPTION_REVIEW", "Prescription", id.ToString(), null, PrescriptionStatuses.UnderReview, null)); await db.SaveChangesAsync(ct); var loaded = await LoadPrescription(id, ct); return Ok(ToPrescription(loaded!));
    }

    [HttpGet("prescriptions/{id:guid}/file")]
    public async Task<IActionResult> PrescriptionFile(Guid id, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var prescription = await db.Prescriptions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (prescription is null) return NotFound();
        var stream = await files.OpenReadAsync(prescription.StoredFileName, ct);
        return stream is null ? NotFound() : File(stream, prescription.ContentType, prescription.OriginalFileName, enableRangeProcessing: true);
    }

    [HttpPut("prescriptions/{id:guid}/items/{itemId:guid}")]
    public async Task<ActionResult<StaffPrescriptionResponse>> ReviewItem(Guid id, Guid itemId, ReviewMedicineRequest request, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        if (request.Quantity is <= 0) return BadRequest(new { message = "Quantity must be greater than zero." });
        var item = await db.PrescriptionExtractedItems.Include(x => x.Prescription).ThenInclude(x => x!.Customer).Include(x => x.Matches).SingleOrDefaultAsync(x => x.Id == itemId && x.PrescriptionId == id, ct);
        if (item is null) return NotFound();
        var product = request.ProductId is null ? null : await db.Products.Include(x => x.Medicine).Include(x => x.Brand).Include(x => x.Inventory).SingleOrDefaultAsync(x => x.Id == request.ProductId, ct);
        if (request.ProductId is not null && product is null) return BadRequest(new { message = "The selected medicine was not found." });
        db.PrescriptionMedicineMatches.RemoveRange(item.Matches);
        var stock = product?.Inventory.Sum(x => Math.Max(0, x.StockQuantity - x.ReservedQuantity)) ?? 0;
        item.Matches.Add(new PrescriptionMedicineMatch { ProductId = product?.Id, Confidence = product is null ? 0 : 100, MatchType = "pharmacist_confirmed", Availability = request.Availability, StockQuantity = stock, NeedsPharmacistReview = false });
        item.Quantity = request.Quantity ?? item.Quantity; item.Strength = product?.Medicine?.Strength ?? item.Strength; item.DosageForm = product?.Medicine?.DosageForm ?? item.DosageForm; item.CustomerEdited = true; item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("PHARMACIST_UPDATED_MEDICINE_MATCH", "PrescriptionExtractedItem", item.Id.ToString(), null, request.ProductId?.ToString(), request.Note));
        await db.SaveChangesAsync(ct);
        var loaded = await LoadPrescription(id, ct);
        return Ok(ToPrescription(loaded!));
    }

    [HttpPost("prescriptions/{id:guid}/approve")]
    public Task<ActionResult<StaffPrescriptionResponse>> Approve(Guid id, PrescriptionDecisionRequest request, CancellationToken ct) => Decide(id, PrescriptionStatuses.Approved, request, ct);

    [HttpPost("prescriptions/{id:guid}/partial-approve")]
    public Task<ActionResult<StaffPrescriptionResponse>> PartialApprove(Guid id, PrescriptionDecisionRequest request, CancellationToken ct) => Decide(id, PrescriptionStatuses.PartiallyApproved, request, ct);

    [HttpPost("prescriptions/{id:guid}/reject")]
    public Task<ActionResult<StaffPrescriptionResponse>> Reject(Guid id, PrescriptionRejectionRequest request, CancellationToken ct) => Decide(id, PrescriptionStatuses.Rejected, new PrescriptionDecisionRequest(request.Reason, null), ct);

    [HttpPost("prescriptions/{id:guid}/clarification")]
    public async Task<ActionResult<StaffPrescriptionResponse>> Clarification(Guid id, PrescriptionClarificationRequest request, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Message)) return BadRequest(new { message = "A clarification message is required." });
        var prescription = await db.Prescriptions.Include(x => x.Customer).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (prescription is null) return NotFound();
        prescription.Status = PrescriptionStatuses.NeedClarification; prescription.UpdatedAt = DateTime.UtcNow;
        db.PrescriptionReviews.Add(new PrescriptionReview { PrescriptionId = id, Status = PrescriptionStatuses.NeedClarification, Notes = request.Message, ReviewerId = StaffId.ToString(), ReviewedAt = DateTime.UtcNow });
        AddPrescriptionHistory(id, PrescriptionStatuses.NeedClarification, request.Message);
        var clarification = await notifications.RenderAsync("PRESCRIPTION_CLARIFICATION", "Clarification requested", request.Message, new Dictionary<string, string?> { ["prescription_id"] = prescription.Id.ToString() }, ct);
        db.Notifications.Add(new Notification { CustomerId = prescription.CustomerId, Type = "prescription_clarification", Title = clarification.Title, Body = clarification.Body });
        db.ActivityLogs.Add(Activity("PHARMACIST_REQUESTED_CLARIFICATION", "Prescription", id.ToString(), prescription.Status, PrescriptionStatuses.NeedClarification, request.Message));
        await db.SaveChangesAsync(ct);
        var loaded = await LoadPrescription(id, ct); return Ok(ToPrescription(loaded!));
    }

    [HttpGet("orders")]
    public async Task<ActionResult<PagedResponse<StaffOrderListItem>>> Orders([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        if (!Authorized) return Forbid();
        var query = db.Orders.AsNoTracking().Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.DeliveryStaff).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.OrderNumber.Contains(search) || x.Customer!.FullName.Contains(search) || x.Customer.Phone.Contains(search));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        var total = await query.CountAsync(ct); var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<StaffOrderListItem>(rows.Select(ToOrderList).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("orders/{id:guid}")]
    public async Task<ActionResult<StaffOrderResponse>> Order(Guid id, CancellationToken ct)
    {
        if (!Authorized) return Forbid(); var order = await LoadOrder(id, ct); return order is null ? NotFound() : Ok(ToOrder(order));
    }

    [HttpPut("orders/{id:guid}/status")]
    public async Task<ActionResult<StaffOrderResponse>> OrderStatus(Guid id, OrderStatusRequest request, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var order = await LoadOrder(id, ct); if (order is null) return NotFound();
        if (!AllowedOrderTransition(order.Status, request.Status)) return Conflict(new { message = $"The order cannot move from {order.Status} to {request.Status}." });
        var previous = order.Status; order.Status = request.Status; order.UpdatedAt = DateTime.UtcNow;
        if (request.Status == OrderStatuses.Cancelled && previous != OrderStatuses.Cancelled)
        {
            foreach (var line in order.Items)
            {
                var reservations = await db.StockTransactions
                    .Include(x => x.Inventory)
                    .Where(x => x.Type == StockTransactionTypes.Reservation
                        && x.ReferenceType == "CUSTOMER_ORDER"
                        && x.ReferenceId == id.ToString()
                        && x.Inventory != null
                        && x.Inventory.ProductId == line.ProductId)
                    .ToListAsync(ct);

                if (reservations.Count > 0)
                {
                    foreach (var reservation in reservations)
                    {
                        var stock = reservation.Inventory!;
                        var before = stock.ReservedQuantity;
                        var releaseQuantity = Math.Min(reservation.Quantity, stock.ReservedQuantity);
                        stock.ReservedQuantity -= releaseQuantity;
                        stock.UpdatedAt = DateTime.UtcNow;
                        db.StockTransactions.Add(new StockTransaction
                        {
                            InventoryId = stock.Id,
                            BranchId = stock.BranchId,
                            Type = StockTransactionTypes.Release,
                            Quantity = -releaseQuantity,
                            QuantityBefore = before,
                            QuantityAfter = stock.ReservedQuantity,
                            Unit = reservation.Unit,
                            ReferenceType = "CUSTOMER_ORDER_CANCEL",
                            ReferenceId = id.ToString(),
                            Reason = "Order cancelled",
                            Note = "Order cancellation released the batch reservation",
                            ActorId = StaffId
                        });
                    }
                    continue;
                }

                // Compatibility path for reservations created before batch-aware references were added.
                var legacyStock = await db.Inventory
                    .Where(x => x.ProductId == line.ProductId && x.BranchId == order.BranchId)
                    .OrderBy(x => x.CreatedAt)
                    .FirstOrDefaultAsync(ct);
                if (legacyStock is null) continue;
                var legacyBefore = legacyStock.ReservedQuantity;
                var legacyRelease = Math.Min(line.Quantity, legacyStock.ReservedQuantity);
                legacyStock.ReservedQuantity -= legacyRelease;
                legacyStock.UpdatedAt = DateTime.UtcNow;
                db.StockTransactions.Add(new StockTransaction
                {
                    InventoryId = legacyStock.Id,
                    BranchId = legacyStock.BranchId,
                    Type = StockTransactionTypes.Release,
                    Quantity = -legacyRelease,
                    QuantityBefore = legacyBefore,
                    QuantityAfter = legacyStock.ReservedQuantity,
                    Unit = line.Unit,
                    ReferenceType = "CUSTOMER_ORDER_CANCEL",
                    ReferenceId = id.ToString(),
                    Reason = "Order cancelled",
                    Note = "Legacy order cancellation released a reservation",
                    ActorId = StaffId
                });
            }
        }
        db.OrderStatusHistory.Add(new OrderStatusHistory { OrderId = id, Status = request.Status, Note = request.Note, ActorId = StaffId.ToString(), ActorRole = User.FindFirstValue(ClaimTypes.Role) });
        var orderMessage = await notifications.RenderAsync("ORDER_STATUS", "Order status updated", $"Your order {order.OrderNumber} is now {request.Status.Replace('_', ' ').ToLowerInvariant()}.", new Dictionary<string, string?> { ["order_id"] = order.OrderNumber, ["order_status"] = request.Status.Replace('_', ' ').ToLowerInvariant() }, ct);
        db.Notifications.Add(new Notification { CustomerId = order.CustomerId, Type = "order_status", Title = orderMessage.Title, Body = orderMessage.Body });
        db.ActivityLogs.Add(Activity("PHARMACIST_CHANGED_ORDER_STATUS", "PharmacyOrder", id.ToString(), previous, request.Status, request.Note));
        if (request.Status == OrderStatuses.Cancelled) await messaging.CloseDeliveryConversationAsync(id, ct);
        await db.SaveChangesAsync(ct); return Ok(ToOrder(order));
    }

    [HttpGet("delivery-staff")]
    public async Task<ActionResult<IReadOnlyList<StaffProfileResponse>>> DeliveryStaff(CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        return Ok(await db.StaffUsers.AsNoTracking().Include(x => x.Branch).Where(x => x.Role == StaffRoles.Delivery && x.IsActive).OrderBy(x => x.FullName).Select(x => new StaffProfileResponse(x.Id, x.FullName, x.Email, x.Phone, x.Role, x.BranchId, x.Branch!.Name, x.LicenseReference, x.IsActive)).ToListAsync(ct));
    }

    [HttpPost("orders/{id:guid}/assign-delivery")]
    public async Task<ActionResult<StaffOrderResponse>> AssignDelivery(Guid id, AssignDeliveryRequest request, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var order = await LoadOrder(id, ct); var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.DeliveryStaffId && x.Role == StaffRoles.Delivery && x.IsActive, ct);
        if (order is null || staff is null) return NotFound();
        if (order.Status != OrderStatuses.ReadyForPickup && order.Status != OrderStatuses.Confirmed) return Conflict(new { message = "Only confirmed or ready orders can be assigned for delivery." });
        var assignment = order.DeliveryAssignment ?? new DeliveryAssignment { OrderId = id, DeliveryStaffId = staff.Id, Status = DeliveryStatuses.Assigned, Notes = request.Notes };
        if (order.DeliveryAssignment is not null && order.DeliveryAssignment.DeliveryStaffId != staff.Id)
            await RiderAvailabilityOperations.SetUnavailableAsync(db, order.DeliveryAssignment.DeliveryStaffId, DateTime.UtcNow, ct);
        if (order.DeliveryAssignment?.CurrentLocation is not null)
        {
            db.DeliveryLocations.Remove(order.DeliveryAssignment.CurrentLocation);
            order.DeliveryAssignment.CurrentLocation = null;
        }
        await RiderAvailabilityOperations.SetUnavailableAsync(db, staff.Id, DateTime.UtcNow, ct);
        assignment.DeliveryStaffId = staff.Id; assignment.Status = DeliveryStatuses.Assigned; assignment.Notes = request.Notes; order.Status = OrderStatuses.AssignedForDelivery; order.UpdatedAt = DateTime.UtcNow;
        if (order.DeliveryAssignment is null) db.DeliveryAssignments.Add(assignment);
        order.StatusHistory.Add(new OrderStatusHistory { OrderId = id, Status = OrderStatuses.AssignedForDelivery, Note = request.Notes, ActorId = StaffId.ToString(), ActorRole = User.FindFirstValue(ClaimTypes.Role) });
        db.Notifications.Add(new Notification { StaffUserId = staff.Id, Type = "delivery_assigned", Title = "New delivery assigned", Body = $"Order {order.OrderNumber} is ready for your delivery queue." });
        db.ActivityLogs.Add(Activity("PHARMACIST_ASSIGNED_DELIVERY", "PharmacyOrder", id.ToString(), null, staff.Id.ToString(), request.Notes));
        await messaging.EnsureDeliveryConversationAsync(id, order.CustomerId, staff.Id, order.OrderNumber, ct);
        await db.SaveChangesAsync(ct); var loaded = await LoadOrder(id, ct); return Ok(ToOrder(loaded!));
    }

    [HttpGet("inventory")]
    public async Task<ActionResult<PagedResponse<InventoryListItem>>> Inventory([FromQuery] string? search, [FromQuery] string? filter, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!Authorized) return Forbid();
        var query = db.Inventory.AsNoTracking().Include(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Product).ThenInclude(x => x!.Brand).Include(x => x.Branch).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Product!.Name.Contains(search) || x.Product.Sku.Contains(search) || x.Product.Medicine!.GenericName!.Contains(search));
        var today = DateTime.UtcNow.Date; var expiry = today.AddDays(filter == "expired" ? 0 : filter == "7" ? 7 : filter == "30" ? 30 : filter == "60" ? 60 : 90);
        if (filter == "low-stock") query = query.Where(x => x.StockQuantity - x.ReservedQuantity <= x.MinimumStock && x.StockQuantity - x.ReservedQuantity > 0);
        if (filter == "out-of-stock") query = query.Where(x => x.StockQuantity - x.ReservedQuantity <= 0);
        if (filter == "expired") query = query.Where(x => x.ExpiryDate < today);
        if (filter is "7" or "30" or "60" or "90") query = query.Where(x => x.ExpiryDate >= today && x.ExpiryDate <= expiry);
        var total = await query.CountAsync(ct); var rows = await query.OrderBy(x => x.Product!.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<InventoryListItem>(rows.Select(x => ToInventory(x, filter)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("inventory/low-stock")]
    public Task<ActionResult<PagedResponse<InventoryListItem>>> LowStock([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) => Inventory(null, "low-stock", page, pageSize, ct);

    [HttpGet("inventory/expiry")]
    public Task<ActionResult<PagedResponse<InventoryListItem>>> Expiry([FromQuery] string? filter = "90", [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) => Inventory(null, filter, page, pageSize, ct);

    [HttpGet("customers")]
    public async Task<ActionResult<IReadOnlyList<StaffCustomerListItem>>> Customers([FromQuery] string? search, CancellationToken ct)
    {
        if (!Authorized) return Forbid(); var query = db.Customers.AsNoTracking().AsQueryable(); if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.FullName.Contains(search) || x.Email.Contains(search) || x.Phone.Contains(search));
        var rows = await query.OrderBy(x => x.FullName).Take(200).Select(x => new StaffCustomerListItem(x.Id, x.FullName, x.Email, x.Phone, db.Orders.Count(o => o.CustomerId == x.Id), db.Prescriptions.Count(p => p.CustomerId == x.Id), db.Orders.Where(o => o.CustomerId == x.Id).OrderByDescending(o => o.CreatedAt).Select(o => (DateTime?)o.CreatedAt).FirstOrDefault(), x.IsActive)).ToListAsync(ct); return Ok(rows);
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<IReadOnlyList<StaffNotificationItem>>> Notifications(CancellationToken ct)
    {
        if (!Authorized) return Forbid(); return Ok(await db.Notifications.AsNoTracking().Where(x => x.StaffUserId == StaffId).OrderByDescending(x => x.CreatedAt).Take(100).Select(x => new StaffNotificationItem(x.Id, x.Type, x.Title, x.Body, x.ReadAt != null, x.CreatedAt)).ToListAsync(ct));
    }

    [HttpPut("notifications/{id:guid}/read")]
    public async Task<IActionResult> ReadNotification(Guid id, CancellationToken ct) { if (!Authorized) return Forbid(); var n = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.StaffUserId == StaffId, ct); if (n is null) return NotFound(); n.ReadAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> ReadAllNotifications(CancellationToken ct) { if (!Authorized) return Forbid(); await db.Notifications.Where(x => x.StaffUserId == StaffId && x.ReadAt == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTime.UtcNow), ct); return NoContent(); }

    [HttpGet("activity")]
    public async Task<ActionResult<IReadOnlyList<StaffActivityItem>>> Activity(CancellationToken ct) { if (!Authorized) return Forbid(); return Ok(await db.ActivityLogs.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(200).Select(x => new StaffActivityItem(x.Id, x.Action, x.EntityType, x.EntityId, x.ActorRole, x.PreviousValue, x.NewValue, x.CreatedAt)).ToListAsync(ct)); }

    [HttpGet("profile")]
    public async Task<ActionResult<StaffProfileResponse>> Profile(CancellationToken ct) { if (!User.TryGetStaffId(out var id)) return Forbid(); var staff = await db.StaffUsers.AsNoTracking().Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == id, ct); return staff is null ? NotFound() : Ok(ToProfile(staff)); }

    [HttpPut("profile")]
    public async Task<ActionResult<StaffProfileResponse>> UpdateProfile(UpdateStaffProfileRequest request, CancellationToken ct) { if (!Authorized) return Forbid(); var staff = await db.StaffUsers.Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == StaffId, ct); if (staff is null) return NotFound(); if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Phone)) return BadRequest(new { message = "Name and phone are required." }); if (request.EmployeeId?.Trim().Length > 80 || request.Address?.Trim().Length > 500 || request.LicenseReference?.Trim().Length > 120) return BadRequest(new { message = "One or more profile fields are too long." }); if (request.JoiningDate.HasValue && request.JoiningDate.Value.Date > DateTime.UtcNow.Date) return BadRequest(new { message = "Joining date cannot be in the future." }); staff.FullName = request.FullName.Trim(); staff.Phone = request.Phone.Trim(); staff.LicenseReference = request.LicenseReference?.Trim(); staff.EmployeeId = request.EmployeeId?.Trim(); staff.Address = request.Address?.Trim(); staff.JoiningDate = request.JoiningDate?.Date; await db.SaveChangesAsync(ct); return Ok(ToProfile(staff)); }

    [HttpPut("profile/password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct) { if (!Authorized) return Forbid(); if (request.NewPassword.Length < 8 || request.NewPassword != request.ConfirmPassword) return BadRequest(new { message = "New passwords must match and be at least 8 characters." }); var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == StaffId, ct); if (staff is null || !passwords.Verify(request.CurrentPassword, staff.PasswordHash)) return BadRequest(new { message = "The current password is incorrect." }); staff.PasswordHash = passwords.Hash(request.NewPassword); await db.SaveChangesAsync(ct); return NoContent(); }

    private async Task<ActionResult<StaffPrescriptionResponse>> Decide(Guid id, string status, PrescriptionDecisionRequest request, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var prescription = await LoadPrescription(id, ct); if (prescription is null) return NotFound();
        var previous = prescription.Status; if (request.Items is not null) foreach (var pair in request.Items) { var match = prescription.ExtractedItems.SingleOrDefault(x => x.Id == pair.Key)?.Matches.FirstOrDefault(); if (match is not null) { match.Availability = pair.Value.Availability; match.ProductId = pair.Value.ProductId; match.NeedsPharmacistReview = false; match.UpdatedAt = DateTime.UtcNow; } }
        prescription.Status = status; prescription.UpdatedAt = DateTime.UtcNow;
        db.PrescriptionReviews.Add(new PrescriptionReview { PrescriptionId = id, Status = status, Notes = request.Notes, ReviewerId = StaffId.ToString(), ReviewedAt = DateTime.UtcNow });
        AddPrescriptionHistory(id, status, request.Notes);
        var prescriptionCode = status == PrescriptionStatuses.Approved ? "PRESCRIPTION_APPROVED" : status == PrescriptionStatuses.NeedClarification ? "PRESCRIPTION_CLARIFICATION" : "PRESCRIPTION_REJECTED";
        var prescriptionMessage = await notifications.RenderAsync(prescriptionCode, $"Prescription {status.ToLowerInvariant()}", request.Notes ?? $"Your prescription has been {status.ToLowerInvariant()}.", new Dictionary<string, string?> { ["prescription_id"] = prescription.Id.ToString() }, ct);
        db.Notifications.Add(new Notification { CustomerId = prescription.CustomerId, Type = "prescription_status", Title = prescriptionMessage.Title, Body = prescriptionMessage.Body });
        db.ActivityLogs.Add(Activity(status == PrescriptionStatuses.Approved ? "PHARMACIST_APPROVED_PRESCRIPTION" : status == PrescriptionStatuses.PartiallyApproved ? "PHARMACIST_PARTIALLY_APPROVED_PRESCRIPTION" : "PHARMACIST_REJECTED_PRESCRIPTION", "Prescription", id.ToString(), previous, status, request.Notes));
        await db.SaveChangesAsync(ct); var loaded = await LoadPrescription(id, ct); return Ok(ToPrescription(loaded!));
    }

    private async Task<Prescription?> LoadPrescription(Guid id, CancellationToken ct) => await db.Prescriptions.Include(x => x.Customer).Include(x => x.ExtractedItems).ThenInclude(x => x.Matches).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.ExtractedItems).ThenInclude(x => x.Matches).ThenInclude(x => x.Product).ThenInclude(x => x!.Brand).Include(x => x.StatusHistory).Include(x => x.Reviews).SingleOrDefaultAsync(x => x.Id == id, ct);
    private async Task<PharmacyOrder?> LoadOrder(Guid id, CancellationToken ct) => await db.Orders.Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Pharmacist).Include(x => x.DeliverySlot).Include(x => x.Address).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Prescription).Include(x => x.StatusHistory).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.CurrentLocation).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.DeliveryStaff).SingleOrDefaultAsync(x => x.Id == id, ct);
    private void AddPrescriptionHistory(Guid id, string status, string? note) => db.PrescriptionStatusHistory.Add(new PrescriptionStatusHistory { PrescriptionId = id, Status = status, Note = note, ActorId = StaffId.ToString(), ActorRole = User.FindFirstValue(ClaimTypes.Role) });
    private ActivityLog Activity(string action, string entityType, string entityId, string? previous, string? next, string? note) => new() { ActorId = StaffId, ActorRole = User.FindFirstValue(ClaimTypes.Role), Action = action, EntityType = entityType, EntityId = entityId, PreviousValue = previous, NewValue = next ?? note, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() };
    private static string Number(Guid id) => $"PR-{id.ToString("N")[..8].ToUpperInvariant()}";
    private static decimal Confidence(Prescription x) => x.ExtractedItems.SelectMany(i => i.Matches).Select(m => m.Confidence).DefaultIfEmpty(0).Average();
    private static string Priority(Prescription x) => x.Status == PrescriptionStatuses.NeedClarification ? "High" : x.CreatedAt < DateTime.UtcNow.AddHours(-24) ? "High" : "Normal";
    private static bool AllowedOrderTransition(string current, string next) => new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase) { [OrderStatuses.Pending] = [OrderStatuses.PrescriptionVerification, OrderStatuses.Confirmed, OrderStatuses.Cancelled], [OrderStatuses.PrescriptionVerification] = [OrderStatuses.Confirmed, OrderStatuses.Rejected, OrderStatuses.Cancelled], [OrderStatuses.Confirmed] = [OrderStatuses.Preparing, OrderStatuses.Cancelled], [OrderStatuses.Preparing] = [OrderStatuses.ReadyForPickup, OrderStatuses.Cancelled], [OrderStatuses.ReadyForPickup] = [OrderStatuses.AssignedForDelivery], [OrderStatuses.AssignedForDelivery] = [OrderStatuses.OutForDelivery], [OrderStatuses.OutForDelivery] = [OrderStatuses.Failed, OrderStatuses.Delivered] }.TryGetValue(current, out var options) && options.Contains(next, StringComparer.OrdinalIgnoreCase);
    private static StaffPrescriptionResponse ToPrescription(Prescription x) => new(x.Id, Number(x.Id), x.Customer!.FullName, x.Customer.Phone, x.Customer.Email, x.CreatedAt, x.SubmittedAt, x.OriginalFileName, x.ContentType, x.Status, x.OcrProvider, x.OcrStatus, x.OcrText, x.CustomerNote, x.ExtractedItems.Select(i => new StaffPrescriptionItem(i.Id, i.DetectedName, i.NormalizedName, i.Strength, i.DosageForm, i.Quantity, i.Frequency, i.Duration, i.Instructions, i.Matches.Select(m => m.Confidence).DefaultIfEmpty(0).Max(), i.Matches.OrderByDescending(m => m.CreatedAt).Select(m => new StaffMatchItem(m.Id, m.ProductId, m.Product?.Name, m.Product?.Medicine?.GenericName, m.Product?.Brand?.Name, m.Product?.SellingPrice, m.Confidence, m.MatchType, m.Availability, m.StockQuantity, m.NeedsPharmacistReview, m.Product?.Medicine?.PrescriptionRequired ?? false)).FirstOrDefault(), i.Dosage, i.Timing)).ToList(), x.StatusHistory.OrderBy(h => h.CreatedAt).Select(h => new StatusHistoryItem(h.Status, h.Note, h.ActorId, h.ActorRole, h.CreatedAt)).ToList(), x.Reviews.OrderByDescending(r => r.CreatedAt).Select(r => new ReviewItem(r.Status, r.Notes, r.ReviewerId, r.ReviewedAt, r.CreatedAt)).ToList());
    private static StaffOrderListItem ToOrderList(PharmacyOrder x) => new(x.Id, x.OrderNumber, x.Customer!.FullName, x.Customer.Phone, x.CreatedAt, x.Status, x.PaymentStatus, x.PaymentMethod, x.Total, x.Items.Any(i => i.Product?.Medicine?.PrescriptionRequired == true), x.DeliveryAssignment?.Status, x.DeliveryAssignment?.DeliveryStaff?.FullName, x.Branch?.Name);
    private static StaffOrderResponse ToOrder(PharmacyOrder x) => new(x.Id, x.OrderNumber, x.Customer!.FullName, x.Customer.Email, x.Customer.Phone, x.CreatedAt, x.Status, x.PaymentStatus, x.PaymentMethod, x.Total, x.DeliveryFee, x.DeliveryInstructions, x.Address is null ? null : new StaffAddressItem(x.Address.Label, x.Address.Province, x.Address.District, x.Address.Municipality, x.Address.Ward, x.Address.StreetTole, x.Address.Landmark, x.Address.Phone), x.Items.Select(i => new StaffOrderItem(i.Id, i.ProductName, i.Quantity, i.UnitPrice, i.Product?.Sku ?? "", i.Product?.Medicine?.PrescriptionRequired ?? false)).ToList(), x.Prescription is null ? null : new StaffPrescriptionSummary(x.Prescription.Id, x.Prescription.Status, null), x.StatusHistory.OrderBy(h => h.CreatedAt).Select(h => new StatusHistoryItem(h.Status, h.Note, h.ActorId, h.ActorRole, h.CreatedAt)).ToList(), x.DeliveryAssignment is null ? null : new DeliverySummary(x.DeliveryAssignment.Id, x.DeliveryAssignment.DeliveryStaffId, x.DeliveryAssignment.DeliveryStaff?.FullName ?? "", x.DeliveryAssignment.Status, x.DeliveryAssignment.AcceptedAt, x.DeliveryAssignment.PickedUpAt, x.DeliveryAssignment.OutForDeliveryAt, x.DeliveryAssignment.DeliveredAt, x.DeliveryAssignment.FailedAt, x.DeliveryAssignment.FailureReason, x.DeliveryAssignment.Notes), x.BranchId, x.Branch?.Name, x.PharmacistId, x.Pharmacist?.FullName, x.DeliverySlotId, x.DeliverySlot?.Label);
    private static InventoryListItem ToInventory(Inventory x, string? filter) { var available = Math.Max(0, x.StockQuantity - x.ReservedQuantity); var status = x.ExpiryDate < DateTime.UtcNow.Date ? "EXPIRED" : available <= 0 ? "OUT_OF_STOCK" : available <= x.MinimumStock ? "LOW_STOCK" : "IN_STOCK"; return new InventoryListItem(x.Id, x.ProductId, x.Product?.Name ?? "", x.Product?.Medicine?.GenericName ?? "", x.Product?.Brand?.Name ?? "", x.Product?.Sku ?? "", x.BatchNumber, x.StockQuantity, x.ReservedQuantity, available, x.Product?.Mrp ?? 0, x.Product?.SellingPrice ?? 0, x.ExpiryDate, x.Branch?.Name ?? "", status, x.MinimumStock); }
    private static StaffProfileResponse ToProfile(StaffUser x) => new(x.Id, x.FullName, x.Email, x.Phone, x.Role, x.BranchId, x.Branch?.Name, x.LicenseReference, x.IsActive, x.EmployeeId, x.Address, x.JoiningDate, x.ProfilePhotoStoredFileName is null ? null : "/api/staff-profile/photo");
}
