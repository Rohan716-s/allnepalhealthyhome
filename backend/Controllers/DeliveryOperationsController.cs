using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/delivery-operations")]
public sealed class DeliveryOperationsController(ApplicationDbContext db, IMessagingConversationService messaging) : ControllerBase
{
    private async Task<StaffUser?> Actor(CancellationToken ct) => User.TryGetStaffId(out var id)
        ? await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.IsActive, ct) : null;
    private static bool Manager(StaffUser s) => s.Role is StaffRoles.Pharmacist or StaffRoles.Supervisor or StaffRoles.Admin or StaffRoles.SuperAdmin;
    private static bool InBranch(StaffUser s, Guid branch) => s.Role == StaffRoles.SuperAdmin || s.BranchId == branch;
    public sealed record CollectionInput(decimal Amount);
    public sealed record HandoverInput(Guid RequestId, string Reference);
    public sealed record RetryInput(Guid RequestId, DateTime RequestedDate, string Reason);
    public sealed record ReviewInput(bool Approve, string Note, Guid? RiderId = null);

    [HttpGet("cash")]
    public async Task<IActionResult> Cash(CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor?.Role != StaffRoles.Delivery) return Forbid();
        var collections = await db.DeliveryCashCollections.AsNoTracking().Include(x => x.Order)
            .Where(x => x.RiderId == actor.Id).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var handovers = await db.DeliveryHandoverRequests.AsNoTracking().Where(x => x.RiderId == actor.Id)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(new {
            collected = collections.Sum(x => x.Amount),
            available = collections.Where(x => x.HandoverRequestId == null).Sum(x => x.Amount),
            pending = handovers.Where(x => x.Status == "PENDING").Sum(x => x.Amount),
            confirmed = handovers.Where(x => x.Status == "APPROVED").Sum(x => x.Amount),
            collections = collections.Select(x => new { x.Id, x.OrderId, orderNumber = x.Order!.OrderNumber, x.Amount, x.CreatedAt, x.HandoverRequestId }),
            handovers
        });
    }

    [HttpPost("orders/{orderId:guid}/collect")]
    public async Task<IActionResult> Collect(Guid orderId, CollectionInput input, CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor?.Role != StaffRoles.Delivery) return Forbid();
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () => {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var order = await db.Orders.Include(x => x.DeliveryAssignment).Include(x => x.PaymentTransactions).Include(x => x.Invoice)
                .SingleOrDefaultAsync(x => x.Id == orderId && x.DeliveryAssignment!.DeliveryStaffId == actor.Id, ct);
            if (order is null || !order.BranchId.HasValue || !InBranch(actor, order.BranchId.Value)) return NotFound();
            var existing = await db.DeliveryCashCollections.SingleOrDefaultAsync(x => x.OrderId == orderId, ct);
            if (existing is not null) return existing.RiderId == actor.Id && existing.Amount == input.Amount ? Ok(existing.Id) : Conflict(new { message = "Cash has already been recorded for this order." });
            if (order.DeliveryAssignment!.Status != DeliveryStatuses.Delivered || order.PaymentMethod != PaymentMethods.CashOnDelivery)
                return Conflict(new { message = "Cash collection is available only for delivered cash-on-delivery orders." });
            var due = DeliveryMoney.AmountDue(order);
            if (due <= 0 || input.Amount != due) return Conflict(new { message = $"Confirm the exact outstanding amount: NPR {due:0.00}." });
            var row = new DeliveryCashCollection { OrderId = orderId, RiderId = actor.Id, BranchId = order.BranchId.Value, Amount = due };
            db.DeliveryCashCollections.Add(row);
            Audit(actor, "DELIVERY_CASH_COLLECTED", orderId, $"NPR {due:0.00}");
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Ok(row.Id);
        });
    }

    [HttpPost("handovers")]
    public async Task<IActionResult> SubmitHandover(HandoverInput input, CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor?.Role != StaffRoles.Delivery || actor.BranchId is null) return Forbid();
        if (input.RequestId == Guid.Empty || string.IsNullOrWhiteSpace(input.Reference) || input.Reference.Trim().Length > 120)
            return BadRequest(new { message = "Enter a handover reference of up to 120 characters." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () => {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var existing = await db.DeliveryHandoverRequests.SingleOrDefaultAsync(x => x.RiderId == actor.Id && x.RequestId == input.RequestId, ct);
            if (existing is not null) return existing.Reference == input.Reference.Trim() ? Ok(existing.Id) : Conflict(new { message = "This request reference was already used." });
            var cash = await db.DeliveryCashCollections.Where(x => x.RiderId == actor.Id && x.BranchId == actor.BranchId && x.HandoverRequestId == null).ToListAsync(ct);
            if (cash.Count == 0) return Conflict(new { message = "There is no unsubmitted cash in your current branch." });
            var row = new DeliveryHandoverRequest { RiderId = actor.Id, BranchId = actor.BranchId.Value, RequestId = input.RequestId, Amount = cash.Sum(x => x.Amount), Reference = input.Reference.Trim() };
            foreach (var item in cash) item.HandoverRequestId = row.Id;
            db.DeliveryHandoverRequests.Add(row);
            Audit(actor, "DELIVERY_HANDOVER_SUBMITTED", row.Id, row.Reference);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Ok(row.Id);
        });
    }

    [HttpGet("reviews")]
    public async Task<IActionResult> Reviews(CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor is null || !(Manager(actor) || actor.Role == StaffRoles.Accountant)) return Forbid();
        var handovers = actor.Role == StaffRoles.Accountant
            ? await db.DeliveryHandoverRequests.AsNoTracking().Include(x => x.Rider).Where(x => x.BranchId == actor.BranchId)
                .OrderByDescending(x => x.CreatedAt).Take(200).Select(x => new { x.Id, rider = x.Rider!.FullName, x.Amount, x.Reference, x.Status, x.ReviewNote, x.CreatedAt }).ToListAsync(ct) : [];
        var retries = Manager(actor)
            ? await db.DeliveryRetryRequests.AsNoTracking().Include(x => x.Order).Include(x => x.Rider)
                .Where(x => actor.Role == StaffRoles.SuperAdmin || x.BranchId == actor.BranchId)
                .OrderByDescending(x => x.CreatedAt).Take(200).Select(x => new { x.Id, x.OrderId, orderNumber = x.Order!.OrderNumber, rider = x.Rider!.FullName, x.RequestedDate, x.Reason, x.Status, x.ReviewNote, x.CreatedAt, x.RiderId }).ToListAsync(ct) : [];
        var riders = Manager(actor) ? await db.StaffUsers.AsNoTracking().Where(x => x.IsActive && x.Role == StaffRoles.Delivery && (actor.Role == StaffRoles.SuperAdmin || x.BranchId == actor.BranchId)).Select(x => new { x.Id, x.FullName, x.BranchId }).ToListAsync(ct) : [];
        return Ok(new { handovers, retries, riders });
    }

    [HttpPost("handovers/{id:guid}/review")]
    public async Task<IActionResult> ReviewHandover(Guid id, ReviewInput input, CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor?.Role != StaffRoles.Accountant || actor.BranchId is null) return Forbid();
        if (string.IsNullOrWhiteSpace(input.Note) || input.Note.Length > 1000) return BadRequest(new { message = "Enter a review note of up to 1,000 characters." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () => {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var row = await db.DeliveryHandoverRequests.Include(x => x.Rider).SingleOrDefaultAsync(x => x.Id == id && x.BranchId == actor.BranchId, ct);
            if (row is null) return NotFound();
            if (row.Status != "PENDING") return Conflict(new { message = "This handover has already been reviewed." });
            var cash = await db.DeliveryCashCollections.Include(x => x.Order).ThenInclude(x => x!.Invoice)
                .Include(x => x.Order).ThenInclude(x => x!.PaymentTransactions).Where(x => x.HandoverRequestId == id).ToListAsync(ct);
            if (input.Approve)
            {
                if (cash.Count == 0 || cash.Sum(x => x.Amount) != row.Amount) return Conflict(new { message = "The handover does not match its collections." });
                foreach (var item in cash)
                {
                    var order = item.Order!;
                    if (DeliveryMoney.AmountDue(order) < item.Amount) return Conflict(new { message = $"Payment changed for {order.OrderNumber}. Reject this handover and reconcile the collection before confirmation." });
                    var invoice = order.Invoice;
                    if (invoice is null) return Conflict(new { message = $"Create the invoice for {order.OrderNumber} before confirming its cash." });
                    if (invoice.Total - invoice.PaidAmount < item.Amount) return Conflict(new { message = $"Invoice balance changed for {order.OrderNumber}." });
                    var payment = new AccountantPayment { InvoiceId = invoice.Id, PaymentNumber = $"RIDER-{item.Id:N}", Method = "CASH", Amount = item.Amount, PaymentDate = ApplicationTime.NepalNow, Reference = row.Reference };
                    db.AccountantPayments.Add(payment);
                    invoice.PaidAmount += item.Amount; invoice.PaymentStatus = invoice.PaidAmount >= invoice.Total ? "PAID" : "PARTIAL";
                    order.PaymentStatus = invoice.PaymentStatus;
                    db.PaymentTransactions.Add(new PaymentTransaction { OrderId = order.Id, TransactionNumber = $"RIDER-{item.Id:N}", Method = PaymentMethods.CashOnDelivery, Status = PaymentTransactionStatuses.Paid, Amount = item.Amount, PaidAt = DateTime.UtcNow, ProviderReference = row.Reference });
                    db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = order.CustomerId, InvoiceId = invoice.Id, PaymentId = payment.Id, EntryType = "CREDIT", Amount = item.Amount, EntryDate = ApplicationTime.NepalNow, Description = $"Rider cash for {order.OrderNumber}", Reference = row.Reference });
                }
                var handover = new CashHandover { BranchId = row.BranchId, HandedByStaffUserId = row.RiderId, ReceivedByStaffUserId = actor.Id, HandoverNumber = $"RIDER-CH-{row.Id:N}", Amount = row.Amount, HandoverAt = ApplicationTime.NepalNow, Reference = row.Reference, Notes = input.Note.Trim() };
                db.CashHandovers.Add(handover); row.CashHandoverId = handover.Id;
                db.JournalEntries.Add(new JournalEntry { EntryDate = ApplicationTime.NepalNow, Reference = handover.HandoverNumber, Description = $"Rider cash received from {row.Rider!.FullName}", DebitAccount = "Cash at Teller", CreditAccount = "Accounts Receivable", Amount = row.Amount, Notes = input.Note.Trim() });
            }
            else foreach (var item in cash) item.HandoverRequestId = null;
            row.Status = input.Approve ? "APPROVED" : "REJECTED"; row.ReviewNote = input.Note.Trim(); row.ReviewedBy = actor.Id; row.ReviewedAt = DateTime.UtcNow;
            Audit(actor, "DELIVERY_HANDOVER_REVIEWED", row.Id, row.Status);
            db.Notifications.Add(new Notification { StaffUserId = row.RiderId, Type = "delivery_cash", Title = "Cash handover reviewed", Body = $"Your handover is {row.Status.ToLowerInvariant()}: {row.ReviewNote}" });
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Ok(new { row.Status });
        });
    }

    [HttpGet("retries")]
    public async Task<IActionResult> MyRetries(CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor?.Role != StaffRoles.Delivery) return Forbid();
        return Ok(await db.DeliveryRetryRequests.AsNoTracking().Include(x => x.Order).Where(x => x.RiderId == actor.Id)
            .OrderByDescending(x => x.CreatedAt).Take(200).Select(x => new { x.Id, x.OrderId, orderNumber = x.Order!.OrderNumber, x.RequestedDate, x.Reason, x.Status, x.ReviewNote }).ToListAsync(ct));
    }

    [HttpPost("orders/{orderId:guid}/retry")]
    public async Task<IActionResult> RequestRetry(Guid orderId, RetryInput input, CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor?.Role != StaffRoles.Delivery) return Forbid();
        if (input.RequestId == Guid.Empty || string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 1000 || input.RequestedDate.Date < ApplicationTime.NepalNow.Date || input.RequestedDate.Date > ApplicationTime.NepalNow.Date.AddDays(30))
            return BadRequest(new { message = "Enter a reason and choose a retry date within the next 30 days." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () => {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var existing = await db.DeliveryRetryRequests.SingleOrDefaultAsync(x => x.RiderId == actor.Id && x.RequestId == input.RequestId, ct);
            if (existing is not null) return existing.OrderId == orderId && existing.RequestedDate == input.RequestedDate.Date && existing.Reason == input.Reason.Trim() ? Ok(existing.Id) : Conflict(new { message = "This retry request identifier was already used." });
            var assignment = await db.DeliveryAssignments.Include(x => x.Order).SingleOrDefaultAsync(x => x.OrderId == orderId && x.DeliveryStaffId == actor.Id, ct);
            if (assignment?.Order?.BranchId is not Guid branch || !InBranch(actor, branch)) return NotFound();
            if (assignment.Status != DeliveryStatuses.Failed || assignment.Order.Status != OrderStatuses.Failed) return Conflict(new { message = "Only a failed delivery can be requested again." });
            if (await db.DeliveryRetryRequests.AnyAsync(x => x.OrderId == orderId && x.Status == "PENDING", ct)) return Conflict(new { message = "A retry request is already awaiting review." });
            var row = new DeliveryRetryRequest { OrderId = orderId, RiderId = actor.Id, BranchId = branch, RequestId = input.RequestId, RequestedDate = input.RequestedDate.Date, Reason = input.Reason.Trim() };
            db.DeliveryRetryRequests.Add(row); Audit(actor, "DELIVERY_RETRY_REQUESTED", orderId, row.Reason);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Ok(row.Id);
        });
    }

    [HttpPost("retries/{id:guid}/review")]
    public async Task<IActionResult> ReviewRetry(Guid id, ReviewInput input, CancellationToken ct)
    {
        var actor = await Actor(ct); if (actor is null || !Manager(actor)) return Forbid();
        if (string.IsNullOrWhiteSpace(input.Note) || input.Note.Length > 1000) return BadRequest(new { message = "Enter a review note of up to 1,000 characters." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () => {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var row = await db.DeliveryRetryRequests.Include(x => x.Order).ThenInclude(x => x!.DeliveryAssignment)
                .Include(x => x.Order).ThenInclude(x => x!.Items)
                .SingleOrDefaultAsync(x => x.Id == id && (actor.Role == StaffRoles.SuperAdmin || x.BranchId == actor.BranchId), ct);
            if (row is null) return NotFound();
            if (row.Status != "PENDING") return Conflict(new { message = "This retry has already been reviewed." });
            if (input.Approve)
            {
                var order = row.Order!; var assignment = order.DeliveryAssignment;
                if (order.Status != OrderStatuses.Failed || assignment?.Status != DeliveryStatuses.Failed || assignment.DeliveryStaffId != row.RiderId) return Conflict(new { message = "The order or rider assignment has changed. Reject this stale request." });
                if (row.RequestedDate.Date > ApplicationTime.NepalNow.Date) return Conflict(new { message = "Approve this request on its scheduled date so it enters the rider queue at the correct time." });
                var riderId = input.RiderId ?? row.RiderId;
                if (!await db.StaffUsers.AnyAsync(x => x.Id == riderId && x.IsActive && x.Role == StaffRoles.Delivery && x.BranchId == row.BranchId, ct)) return BadRequest(new { message = "Choose an active rider in the order's branch." });
                foreach (var line in order.Items)
                {
                    var reservations = await db.StockTransactions.Include(x => x.Inventory)
                        .Where(x => x.Type == StockTransactionTypes.Reservation && x.ReferenceType == "CUSTOMER_ORDER"
                            && x.ReferenceId == order.Id.ToString() && x.Inventory!.ProductId == line.ProductId).ToListAsync(ct);
                    var required = (long)line.Quantity * Math.Max(1, line.UnitMultiplier);
                    var valid = reservations.Where(x => x.Inventory is not null && x.Inventory.BranchId == row.BranchId
                        && x.Inventory.BatchStatus is not "EXPIRED" and not "DEPLETED" and not "QUARANTINED" and not "RETURNED"
                        && (!x.Inventory.ExpiryDate.HasValue || x.Inventory.ExpiryDate.Value.Date >= ApplicationTime.NepalNow.Date))
                        .GroupBy(x => x.InventoryId).Sum(g => (long)Math.Min(g.Sum(x => x.Quantity), Math.Min(g.First().Inventory!.ReservedQuantity, g.First().Inventory!.StockQuantity)));
                    if (valid < required) return Conflict(new { message = $"The reserved stock for {line.ProductName} is unavailable or expired. Resolve the stock before approving a retry." });
                }
                assignment.DeliveryStaffId = riderId; assignment.Status = DeliveryStatuses.Assigned;
                assignment.AcceptedAt = null; assignment.ArrivedAt = null; assignment.PickedUpAt = null; assignment.OutForDeliveryAt = null; assignment.DeliveredAt = null; assignment.FailedAt = null;
                assignment.FailureReason = null; assignment.Notes = input.Note.Trim(); assignment.UpdatedAt = DateTime.UtcNow;
                order.Status = OrderStatuses.AssignedForDelivery; order.UpdatedAt = DateTime.UtcNow;
                db.OrderStatusHistory.Add(new OrderStatusHistory { OrderId = order.Id, Status = OrderStatuses.AssignedForDelivery, Note = $"Delivery retry approved: {input.Note.Trim()}", ActorId = actor.Id.ToString(), ActorRole = actor.Role });
                await RiderAvailabilityOperations.SetUnavailableAsync(db, riderId, DateTime.UtcNow, ct);
                await messaging.EnsureDeliveryConversationAsync(order.Id, order.CustomerId, riderId, order.OrderNumber, ct);
                db.Notifications.Add(new Notification { StaffUserId = riderId, Type = "delivery_assigned", Title = "Delivery retry assigned", Body = $"Order {order.OrderNumber} is ready for another delivery attempt." });
            }
            row.Status = input.Approve ? "APPROVED" : "REJECTED"; row.ReviewNote = input.Note.Trim(); row.ReviewedBy = actor.Id; row.ReviewedAt = DateTime.UtcNow;
            Audit(actor, "DELIVERY_RETRY_REVIEWED", row.OrderId, row.Status);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Ok(new { row.Status });
        });
    }

    private void Audit(StaffUser actor, string action, Guid id, string value) => db.ActivityLogs.Add(new ActivityLog { ActorId = actor.Id, ActorRole = actor.Role, Action = action, EntityType = "DeliveryOperation", EntityId = id.ToString(), NewValue = value });
}
