using backend.Contracts;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/support-tickets")]
public sealed class SupportTicketsController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminSupportTicketRow>>> Mine(CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var rows = await db.SupportTickets.AsNoTracking().Include(x => x.Customer).Include(x => x.AssignedStaff).Where(x => x.CustomerId == customerId).OrderByDescending(x => x.CreatedAt).Select(x => new AdminSupportTicketRow(x.Id, x.TicketNumber, x.Customer!.FullName, x.Customer.Email, x.Subject, x.Description, x.Status, x.Priority, x.Category, x.Resolution, x.AssignedStaff == null ? null : x.AssignedStaff.FullName, x.CreatedAt, x.ResolvedAt)).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<AdminSupportTicketRow>> Create(CreateSupportTicketRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Trim().Length > 200) return BadRequest(new { message = "A subject up to 200 characters is required." });
        if (string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length < 10 || request.Description.Trim().Length > 4000) return BadRequest(new { message = "Description must be between 10 and 4,000 characters." });
        var priority = request.Priority.Trim().ToUpperInvariant();
        if (priority is not (SupportTicketPriorities.Low or SupportTicketPriorities.Medium or SupportTicketPriorities.High or SupportTicketPriorities.Urgent)) return BadRequest(new { message = "Ticket priority is invalid." });
        var customer = await db.Customers.SingleOrDefaultAsync(x => x.Id == customerId && x.IsActive, ct);
        if (customer is null) return Unauthorized();
        var ticket = new SupportTicket { CustomerId = customerId, TicketNumber = $"SUP-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}", Subject = request.Subject.Trim(), Description = request.Description.Trim(), Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(), Priority = priority };
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync(ct);
        return Ok(new AdminSupportTicketRow(ticket.Id, ticket.TicketNumber, customer.FullName, customer.Email, ticket.Subject, ticket.Description, ticket.Status, ticket.Priority, ticket.Category, ticket.Resolution, null, ticket.CreatedAt, ticket.ResolvedAt));
    }

    [HttpGet("{id:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<AdminSupportTicketMessageRow>>> Messages(Guid id, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (!await db.SupportTickets.AnyAsync(x => x.Id == id && x.CustomerId == customerId, ct)) return NotFound();
        var messages = await db.SupportTicketMessages.AsNoTracking().Include(x => x.StaffUser).Include(x => x.Customer).Where(x => x.SupportTicketId == id && !x.IsInternal).OrderBy(x => x.CreatedAt).ToListAsync(ct);
        return Ok(messages.Select(x => new AdminSupportTicketMessageRow(x.Id, x.SupportTicketId, x.Message, false, x.StaffUser?.FullName ?? x.Customer?.FullName, x.StaffUserId.HasValue ? "STAFF" : "CUSTOMER", x.CreatedAt)).ToList());
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<ActionResult<AdminSupportTicketMessageRow>> AddMessage(Guid id, CreateSupportTicketMessageRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Trim().Length < 2 || request.Message.Trim().Length > 4000) return BadRequest(new { message = "A message between 2 and 4,000 characters is required." });
        var ticket = await db.SupportTickets.SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId, ct);
        if (ticket is null) return NotFound();
        var message = new SupportTicketMessage { SupportTicketId = id, CustomerId = customerId, Message = request.Message.Trim(), IsInternal = false };
        db.SupportTicketMessages.Add(message); ticket.Status = SupportTicketStatuses.Open; ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(new AdminSupportTicketMessageRow(message.Id, id, message.Message, false, null, "CUSTOMER", message.CreatedAt));
    }
}
