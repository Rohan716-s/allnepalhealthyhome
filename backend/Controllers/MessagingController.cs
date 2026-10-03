using System.Security.Claims;
using backend.Contracts;
using backend.Data;
using backend.Hubs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/messaging")]
public sealed class MessagingController(ApplicationDbContext db, IMessageAttachmentStorage attachments, IHubContext<MessagingHub> hub) : ControllerBase
{
    private (string Type, Guid Id, string Role) Current => (
        User.FindFirstValue("account_type")?.Equals("staff", StringComparison.OrdinalIgnoreCase) == true ? "staff" : "customer",
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty,
        User.FindFirstValue(ClaimTypes.Role) ?? "CUSTOMER");

    [HttpGet("contacts")]
    public async Task<ActionResult<IReadOnlyList<MessagingContact>>> Contacts(CancellationToken ct)
    {
        if (!HasIdentity(out _)) return Unauthorized();
        var current = Current;
        var disabledRoles = await db.MessagingRoleSettings.AsNoTracking().Where(x => !x.IsEnabled).Select(x => x.Role).ToListAsync(ct);
        var result = new List<MessagingContact>();
        if (!await RoleEnabled(MessagingRole(current), ct)) return Ok(result);

        if (current.Type == "customer")
        {
            var support = await db.StaffUsers.AsNoTracking().Include(x => x.Branch)
                .Where(x => x.IsActive && (x.Role == StaffRoles.Admin || x.Role == StaffRoles.SuperAdmin))
                .OrderBy(x => x.Role).ThenBy(x => x.FullName).ToListAsync(ct);
            result.AddRange(support.Where(x => IsRoleEnabled(x.Role, disabledRoles)).Select(x => new MessagingContact(x.Id, "staff", x.Role, x.FullName, x.Email, x.Branch?.Name, true)));

            var prescriptionOrders = await db.Orders.AsNoTracking().Where(x => x.CustomerId == current.Id && x.PrescriptionId != null && x.PharmacistId != null)
                .Select(x => new { x.Id, x.OrderNumber, PharmacistId = x.PharmacistId!.Value, BranchId = x.BranchId }).ToListAsync(ct);
            var pharmacists = await db.StaffUsers.AsNoTracking().Include(x => x.Branch).Where(x => x.IsActive && x.Role == StaffRoles.Pharmacist && prescriptionOrders.Select(o => o.PharmacistId).Contains(x.Id)).ToListAsync(ct);
            result.AddRange(prescriptionOrders.Join(pharmacists, o => o.PharmacistId, p => p.Id, (o, p) => new MessagingContact(p.Id, "staff", p.Role, p.FullName, p.Email, p.Branch?.Name, true, o.Id)));

            var activeDeliveryOrders = await db.Orders.AsNoTracking().Include(x => x.DeliveryAssignment).ThenInclude(x => x!.DeliveryStaff).Include(x => x.Branch)
                .Where(x => x.CustomerId == current.Id && x.DeliveryAssignment != null && x.DeliveryAssignment.DeliveryStaffId != Guid.Empty && x.Status != OrderStatuses.Delivered && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed && x.DeliveryAssignment.Status != DeliveryStatuses.Delivered && x.DeliveryAssignment.Status != DeliveryStatuses.Failed)
                .ToListAsync(ct);
            result.AddRange(activeDeliveryOrders.Where(x => x.DeliveryAssignment?.DeliveryStaff is not null).Select(x => new MessagingContact(x.DeliveryAssignment!.DeliveryStaffId, "staff", StaffRoles.Delivery, x.DeliveryAssignment.DeliveryStaff!.FullName, x.DeliveryAssignment.DeliveryStaff.Email, x.DeliveryAssignment.DeliveryStaff.Branch?.Name, true, x.Id)));
        }
        else
        {
            var staff = await db.StaffUsers.AsNoTracking().Include(x => x.Branch).Where(x => x.IsActive && x.Id != current.Id).OrderBy(x => x.Role).ThenBy(x => x.FullName).ToListAsync(ct);
            var customers = await db.Customers.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.FullName).Take(500).ToListAsync(ct);
            if (current.Role is StaffRoles.Admin or StaffRoles.SuperAdmin)
            {
                result.AddRange(customers.Where(x => IsRoleEnabled(x.AccountType, disabledRoles)).Select(x => new MessagingContact(x.Id, "customer", x.AccountType, x.FullName, x.Email, null, true)));
                result.AddRange(staff.Where(x => IsRoleEnabled(x.Role, disabledRoles)).Select(x => new MessagingContact(x.Id, "staff", x.Role, x.FullName, x.Email, x.Branch?.Name, true)));
            }
            else if (current.Role == StaffRoles.Supervisor)
            {
                result.AddRange(staff.Where(x => x.Role is StaffRoles.Admin or StaffRoles.SuperAdmin || x.BranchId == CurrentBranchId(current)).Where(x => IsRoleEnabled(x.Role, disabledRoles)).Select(x => new MessagingContact(x.Id, "staff", x.Role, x.FullName, x.Email, x.Branch?.Name, true)));
                var branchOrders = await db.Orders.AsNoTracking().Where(x => x.BranchId == CurrentBranchId(current) && x.CustomerId != Guid.Empty && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Delivered).Select(x => new { x.Id, x.CustomerId }).ToListAsync(ct);
                result.AddRange(branchOrders.Join(customers, x => x.CustomerId, x => x.Id, (x, c) => new MessagingContact(c.Id, "customer", c.AccountType, c.FullName, c.Email, null, true, x.Id)));
            }
            else if (current.Role == StaffRoles.Pharmacist)
            {
                result.AddRange(staff.Where(x => x.Role is StaffRoles.Admin or StaffRoles.SuperAdmin || x.Role == StaffRoles.Supervisor && x.BranchId == CurrentBranchId(current)).Where(x => IsRoleEnabled(x.Role, disabledRoles)).Select(x => new MessagingContact(x.Id, "staff", x.Role, x.FullName, x.Email, x.Branch?.Name, true)));
                var assignedOrders = await db.Orders.AsNoTracking().Where(x => x.PharmacistId == current.Id && x.PrescriptionId != null && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Delivered).Select(x => new { x.Id, x.CustomerId }).ToListAsync(ct);
                result.AddRange(assignedOrders.Join(customers, x => x.CustomerId, x => x.Id, (x, c) => new MessagingContact(c.Id, "customer", c.AccountType, c.FullName, c.Email, null, true, x.Id)));
            }
            else if (current.Role == StaffRoles.Delivery)
            {
                result.AddRange(staff.Where(x => x.Role is StaffRoles.Admin or StaffRoles.SuperAdmin || x.Role == StaffRoles.Supervisor && x.BranchId == CurrentBranchId(current)).Where(x => IsRoleEnabled(x.Role, disabledRoles)).Select(x => new MessagingContact(x.Id, "staff", x.Role, x.FullName, x.Email, x.Branch?.Name, true)));
                var assignedOrders = await db.Orders.AsNoTracking().Include(x => x.DeliveryAssignment).Where(x => x.DeliveryAssignment != null && x.DeliveryAssignment.DeliveryStaffId == current.Id && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Delivered && x.Status != OrderStatuses.Failed && x.DeliveryAssignment.Status != DeliveryStatuses.Delivered && x.DeliveryAssignment.Status != DeliveryStatuses.Failed).Select(x => new { x.Id, x.CustomerId }).ToListAsync(ct);
                result.AddRange(assignedOrders.Join(customers, x => x.CustomerId, x => x.Id, (x, c) => new MessagingContact(c.Id, "customer", c.AccountType, c.FullName, c.Email, null, true, x.Id)));
            }
            else
            {
                result.AddRange(staff.Where(x => x.Role is StaffRoles.Admin or StaffRoles.SuperAdmin).Where(x => IsRoleEnabled(x.Role, disabledRoles)).Select(x => new MessagingContact(x.Id, "staff", x.Role, x.FullName, x.Email, x.Branch?.Name, true)));
            }
        }
        return Ok(result.GroupBy(x => $"{x.ParticipantType}:{x.Id}:{x.OrderId}").Select(x => x.First()).ToList());
    }

    [HttpGet("conversations")]
    public async Task<ActionResult<IReadOnlyList<MessageConversationRow>>> Conversations(CancellationToken ct)
    {
        if (!HasIdentity(out var current)) return Unauthorized();
        var participantIds = await db.MessageParticipants.AsNoTracking().Where(x => current.Type == "customer" ? x.CustomerId == current.Id : x.StaffUserId == current.Id).Select(x => x.ConversationId).ToListAsync(ct);
        var participantReadAt = await db.MessageParticipants.AsNoTracking().Where(x => participantIds.Contains(x.ConversationId) && (current.Type == "customer" ? x.CustomerId == current.Id : x.StaffUserId == current.Id)).ToDictionaryAsync(x => x.ConversationId, x => x.LastReadAt, ct);
        var rows = await db.MessageConversations.AsNoTracking().AsSplitQuery().Where(x => participantIds.Contains(x.Id)).Include(x => x.Participants).ThenInclude(x => x.Customer).Include(x => x.Participants).ThenInclude(x => x.StaffUser).Include(x => x.Messages.OrderByDescending(m => m.CreatedAt).Take(1)).OrderByDescending(x => x.LastMessageAt ?? x.CreatedAt).ToListAsync(ct);
        var incoming = await db.PlatformMessages.AsNoTracking().Where(x => participantIds.Contains(x.ConversationId) && (current.Type == "customer" ? x.SenderCustomerId != current.Id : x.SenderStaffUserId != current.Id)).Select(x => new { x.ConversationId, x.CreatedAt }).ToListAsync(ct);
        var unread = incoming.GroupBy(x => x.ConversationId).ToDictionary(x => x.Key, x => x.Count(message => !participantReadAt.TryGetValue(x.Key, out var readAt) || readAt is null || message.CreatedAt > readAt));
        var result = rows.Select(x =>
        {
            var other = x.Participants.FirstOrDefault(p => !Owns(p, current));
            var last = x.Messages.FirstOrDefault();
            return new MessageConversationRow(x.Id, x.Subject, x.LastMessageAt, unread.GetValueOrDefault(x.Id), DisplayName(other), other?.ParticipantRole ?? "", last?.Body, x.IsClosed, x.OrderId);
        }).ToList();
        return Ok(result);
    }

    [HttpPost("conversations")]
    public async Task<ActionResult<MessageThreadResponse>> CreateConversation(CreateConversationRequest request, CancellationToken ct)
    {
        if (!HasIdentity(out var current)) return Unauthorized();
        if (!Guid.TryParse(request.RecipientId.ToString(), out _) || request.RecipientType is not ("customer" or "staff")) return BadRequest(new { message = "Recipient is invalid." });
        var recipient = await FindRecipient(request.RecipientId, request.RecipientType, ct);
        if (recipient is null || !await CanMessage(current, recipient.Value.Type, recipient.Value.Id, recipient.Value.Role, request.OrderId, ct)) return Forbid();
        var existing = await db.MessageConversations.Include(x => x.Participants).Where(x => x.OrderId == request.OrderId && x.Participants.Any(p => current.Type == "customer" ? p.CustomerId == current.Id : p.StaffUserId == current.Id) && x.Participants.Any(p => recipient.Value.Type == "customer" ? p.CustomerId == recipient.Value.Id : p.StaffUserId == recipient.Value.Id)).OrderByDescending(x => x.LastMessageAt).FirstOrDefaultAsync(ct);
        if (existing?.IsClosed == true && request.OrderId is null) return Conflict(new { message = "This conversation is closed." });
        var conversation = existing ?? new MessageConversation { OrderId = request.OrderId, Subject = Clean(request.Subject, 200) };
        if (existing is null)
        {
            conversation.Participants.Add(ToParticipant(current, MessagingRole(current)));
            conversation.Participants.Add(ToParticipant(recipient.Value, recipient.Value.Role));
            db.MessageConversations.Add(conversation);
        }
        if (!string.IsNullOrWhiteSpace(request.Message)) AddMessage(conversation, current, request.Message.Trim(), null);
        await db.SaveChangesAsync(ct);
        if (!string.IsNullOrWhiteSpace(request.Message)) await Broadcast(conversation, current, ct);
        return Ok(await Thread(conversation.Id, current, ct));
    }

    [HttpGet("conversations/{id:guid}")]
    public async Task<ActionResult<MessageThreadResponse>> Thread(Guid id, CancellationToken ct)
    {
        if (!HasIdentity(out var current)) return Unauthorized();
        if (!await IsMember(id, current, ct)) return NotFound();
        return Ok(await Thread(id, current, ct));
    }

    [HttpPost("conversations/{id:guid}/messages")]
    public async Task<ActionResult<PlatformMessageRow>> Send(Guid id, SendPlatformMessageRequest request, CancellationToken ct)
    {
        if (!HasIdentity(out var current)) return Unauthorized();
        if (!await CanSend(id, current, ct)) return Conflict(new { message = "This conversation is closed or you are no longer allowed to send messages here." });
        if (string.IsNullOrWhiteSpace(request.Body) && request.Latitude is null && request.Longitude is null) return BadRequest(new { message = "Write a message or share a location." });
        if (request.Body?.Length > 4000 || request.LocationLabel?.Length > 300) return BadRequest(new { message = "Message or location is too long." });
        if (request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180) return BadRequest(new { message = "The shared location is invalid." });
        var conversation = await db.MessageConversations.Include(x => x.Participants).SingleAsync(x => x.Id == id, ct);
        var message = AddMessage(conversation, current, request.Body?.Trim() ?? "", request);
        await db.SaveChangesAsync(ct);
        await Broadcast(conversation, current, ct);
        return Ok(ToMessageRow(message, current));
    }

    [HttpPost("conversations/{id:guid}/attachments")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<ActionResult<PlatformMessageRow>> SendAttachment(Guid id, [FromForm] IFormFile file, [FromForm] string? body, CancellationToken ct)
    {
        if (!HasIdentity(out var current)) return Unauthorized();
        if (!await CanSend(id, current, ct)) return Conflict(new { message = "This conversation is closed or you are no longer allowed to send messages here." });
        StoredMessageAttachment stored;
        try { stored = await attachments.SaveAsync(file, ct); } catch (InvalidDataException exception) { return BadRequest(new { message = exception.Message }); }
        var conversation = await db.MessageConversations.Include(x => x.Participants).SingleAsync(x => x.Id == id, ct);
        var message = AddMessage(conversation, current, string.IsNullOrWhiteSpace(body) ? "Shared an attachment" : body.Trim(), null);
        message.Attachments.Add(new MessageAttachment { OriginalFileName = stored.OriginalFileName, StoredFileName = stored.StoredFileName, ContentType = stored.ContentType, Length = stored.Length, Sha256 = stored.Sha256 });
        await db.SaveChangesAsync(ct);
        await Broadcast(conversation, current, ct);
        return Ok(ToMessageRow(message, current));
    }

    [HttpPost("conversations/{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        if (!HasIdentity(out var current)) return Unauthorized();
        var conversation = await db.MessageConversations.Include(x => x.Participants).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (conversation is null) return NotFound();
        var participant = conversation.Participants.SingleOrDefault(x => current.Type == "customer" ? x.CustomerId == current.Id : x.StaffUserId == current.Id);
        if (participant is null) return NotFound();
        var readAt = DateTime.UtcNow;
        participant.LastReadAt = readAt;
        await db.PlatformMessages.Where(x => x.ConversationId == id && (current.Type == "customer" ? x.SenderCustomerId != current.Id : x.SenderStaffUserId != current.Id) && x.SeenAt == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.SeenAt, readAt).SetProperty(x => x.Status, MessageStatuses.Seen), ct);
        await db.SaveChangesAsync(ct);
        var payload = new { conversationId = id };
        foreach (var otherParticipant in conversation.Participants.Where(x => !Owns(x, current)))
            await hub.Clients.Group(UserGroup(otherParticipant)).SendAsync("conversation:read", payload, ct);
        return NoContent();
    }

    [HttpGet("attachments/{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        if (!HasIdentity(out var current)) return Unauthorized();
        var attachment = await db.MessageAttachments.Include(x => x.Message).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (attachment is null || attachment.Message is null || !await IsMember(attachment.Message.ConversationId, current, ct)) return NotFound();
        var stream = await attachments.OpenReadAsync(attachment.StoredFileName, ct);
        return stream is null ? NotFound() : File(stream, attachment.ContentType, attachment.OriginalFileName);
    }

    [HttpGet("admin/role-settings")]
    public async Task<ActionResult<IReadOnlyList<MessagingRoleSettingRow>>> RoleSettings(CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.SuperAdmin)) return Forbid();
        var roles = new[] { "CUSTOMER", "PERSONAL", "PHARMACY", StaffRoles.Admin, StaffRoles.SuperAdmin, StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.Accountant, StaffRoles.SalesExecutive };
        var saved = await db.MessagingRoleSettings.AsNoTracking().ToDictionaryAsync(x => x.Role, StringComparer.OrdinalIgnoreCase, ct);
        return Ok(roles.Select(x => new MessagingRoleSettingRow(x, !saved.TryGetValue(x, out var row) || row.IsEnabled)).ToList());
    }

    [HttpPut("admin/role-settings/{role}")]
    public async Task<ActionResult<MessagingRoleSettingRow>> UpdateRoleSetting(string role, UpdateMessagingRoleSettingRequest request, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.SuperAdmin)) return Forbid();
        role = role.Trim().ToUpperInvariant();
        if (role.Length is < 2 or > 40) return BadRequest(new { message = "Role is invalid." });
        var current = await db.MessagingRoleSettings.SingleOrDefaultAsync(x => x.Role == role, ct);
        if (current is null) db.MessagingRoleSettings.Add(new MessagingRoleSetting { Role = role, IsEnabled = request.IsEnabled, UpdatedByStaffUserId = User.TryGetStaffId(out var actor) ? actor : null });
        else { current.IsEnabled = request.IsEnabled; current.UpdatedByStaffUserId = User.TryGetStaffId(out var actor) ? actor : null; current.UpdatedAt = DateTime.UtcNow; }
        db.ActivityLogs.Add(new ActivityLog { ActorId = User.TryGetStaffId(out var staff) ? staff : null, ActorRole = StaffRoles.SuperAdmin, Action = "MESSAGING_ROLE_SETTING_UPDATED", EntityType = "MessagingRoleSetting", EntityId = role, NewValue = request.IsEnabled.ToString() });
        await db.SaveChangesAsync(ct);
        return Ok(new MessagingRoleSettingRow(role, request.IsEnabled));
    }

    [HttpGet("admin/conversations")]
    public async Task<ActionResult<IReadOnlyList<MessageConversationRow>>> Oversight(CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.SuperAdmin)) return Forbid();
        db.ActivityLogs.Add(new ActivityLog { ActorId = User.TryGetStaffId(out var actor) ? actor : null, ActorRole = StaffRoles.SuperAdmin, Action = "MESSAGING_OVERSIGHT_VIEWED", EntityType = "MessageConversation", EntityId = "all" });
        await db.SaveChangesAsync(ct);
        var rows = await db.MessageConversations.AsNoTracking().AsSplitQuery().Where(x => !x.IsClosed).Include(x => x.Participants).ThenInclude(x => x.Customer).Include(x => x.Participants).ThenInclude(x => x.StaffUser).Include(x => x.Messages.OrderByDescending(m => m.CreatedAt).Take(1)).OrderByDescending(x => x.LastMessageAt ?? x.CreatedAt).Take(500).ToListAsync(ct);
        return Ok(rows.Select(x => new MessageConversationRow(x.Id, x.Subject, x.LastMessageAt, 0, string.Join(" · ", x.Participants.Select(DisplayName)), string.Join(", ", x.Participants.Select(p => p.ParticipantRole)), x.Messages.FirstOrDefault()?.Body, x.IsClosed, x.OrderId)).ToList());
    }

    private async Task<MessageThreadResponse> Thread(Guid id, (string Type, Guid Id, string Role) current, CancellationToken ct)
    {
        var conversation = await db.MessageConversations.AsNoTracking().AsSplitQuery().Include(x => x.Participants).ThenInclude(x => x.Customer).Include(x => x.Participants).ThenInclude(x => x.StaffUser).Include(x => x.Messages.OrderBy(x => x.CreatedAt)).ThenInclude(x => x.Attachments).SingleAsync(x => x.Id == id, ct);
        var other = conversation.Participants.FirstOrDefault(x => !Owns(x, current));
        var lastReadAt = await db.MessageParticipants.AsNoTracking().Where(x => x.ConversationId == id && (current.Type == "customer" ? x.CustomerId == current.Id : x.StaffUserId == current.Id)).Select(x => x.LastReadAt).SingleOrDefaultAsync(ct);
        var unread = conversation.Messages.Count(x => !IsSender(x, current) && (lastReadAt is null || x.CreatedAt > lastReadAt));
        var summary = new MessageConversationRow(conversation.Id, conversation.Subject, conversation.LastMessageAt, unread, DisplayName(other), other?.ParticipantRole ?? "", conversation.Messages.LastOrDefault()?.Body, conversation.IsClosed, conversation.OrderId);
        return new MessageThreadResponse(summary, conversation.Messages.Select(x => ToMessageRow(x, current)).ToList());
    }

    private async Task Broadcast(MessageConversation conversation, (string Type, Guid Id, string Role) sender, CancellationToken ct)
    {
        var payload = new { conversationId = conversation.Id };
        await hub.Clients.Group($"conversation:{conversation.Id}").SendAsync("message:new", payload, ct);
        foreach (var participant in conversation.Participants.Where(x => !Owns(x, sender))) await hub.Clients.Group(UserGroup(participant)).SendAsync("conversation:updated", payload, ct);
    }

    private PlatformMessage AddMessage(MessageConversation conversation, (string Type, Guid Id, string Role) sender, string body, SendPlatformMessageRequest? location)
    {
        var message = new PlatformMessage { ConversationId = conversation.Id, Body = body, SenderCustomerId = sender.Type == "customer" ? sender.Id : null, SenderStaffUserId = sender.Type == "staff" ? sender.Id : null, Latitude = location?.Latitude, Longitude = location?.Longitude, LocationLabel = Clean(location?.LocationLabel, 300), LocationSource = Clean(location?.LocationSource, 30), DeliveredAt = DateTime.UtcNow };
        db.PlatformMessages.Add(message); conversation.LastMessageAt = DateTime.UtcNow; conversation.UpdatedAt = DateTime.UtcNow;
        return message;
    }

    private PlatformMessageRow ToMessageRow(PlatformMessage message, (string Type, Guid Id, string Role) current) => new(message.Id, message.ConversationId, message.Body, message.Status, IsSender(message, current), message.SenderCustomer?.FullName ?? message.SenderStaffUser?.FullName ?? (IsSender(message, current) ? User.Identity?.Name ?? "You" : "User"), message.SenderStaffUser?.Role ?? "CUSTOMER", message.CreatedAt, message.DeliveredAt, message.SeenAt, message.Latitude, message.Longitude, message.LocationLabel, message.LocationSource, message.Attachments.Select(x => new MessageAttachmentRow(x.Id, x.OriginalFileName, x.ContentType, x.Length, $"/api/messaging/attachments/{x.Id}")).ToList());

    private async Task<(string Type, Guid Id, string Role)?> FindRecipient(Guid id, string type, CancellationToken ct)
    {
        if (type == "customer")
        {
            var customer = await db.Customers.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new { x.Id, x.AccountType }).SingleOrDefaultAsync(ct);
            return customer is null ? null : ("customer", customer.Id, customer.AccountType);
        }
        var staff = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.IsActive, ct);
        return staff is null ? null : ("staff", staff.Id, staff.Role);
    }

    private async Task<bool> CanMessage((string Type, Guid Id, string Role) current, string recipientType, Guid recipientId, string recipientRole, Guid? orderId, CancellationToken ct)
    {
        if (current.Id == recipientId && current.Type == recipientType) return false;
        if (!await RoleEnabled(MessagingRole(current), ct) || !await RoleEnabled(recipientRole, ct)) return false;

        if (current.Type == "customer")
        {
            if (recipientType != "staff") return false;
            if (recipientRole is StaffRoles.Admin or StaffRoles.SuperAdmin) return true;
            if (recipientRole == StaffRoles.Pharmacist) return orderId.HasValue && await IsPrescriptionContext(orderId.Value, current, recipientId, ct);
            if (recipientRole == StaffRoles.Delivery) return orderId.HasValue && await IsActiveDeliveryContext(orderId.Value, current, recipientType, recipientId, ct);
            return false;
        }

        if (current.Role is StaffRoles.Admin or StaffRoles.SuperAdmin) return true;
        if (current.Role == StaffRoles.Supervisor)
        {
            if (recipientType == "staff" && recipientRole is StaffRoles.Admin or StaffRoles.SuperAdmin) return true;
            if (recipientType == "staff") return await SameBranch(current.Id, recipientId, ct);
            return recipientType == "customer" && orderId.HasValue && await CustomerOrderInBranch(orderId.Value, current, recipientId, ct);
        }
        if (current.Role == StaffRoles.Pharmacist)
        {
            if (recipientType == "staff" && recipientRole is StaffRoles.Admin or StaffRoles.SuperAdmin) return true;
            if (recipientType == "staff" && recipientRole == StaffRoles.Supervisor) return await SameBranch(current.Id, recipientId, ct);
            return recipientType == "customer" && orderId.HasValue && await IsPrescriptionContext(orderId.Value, current, recipientId, ct);
        }
        if (current.Role == StaffRoles.Delivery)
        {
            if (recipientType == "staff" && recipientRole is StaffRoles.Admin or StaffRoles.SuperAdmin) return true;
            if (recipientType == "staff" && recipientRole == StaffRoles.Supervisor) return await SameBranch(current.Id, recipientId, ct);
            return recipientType == "customer" && orderId.HasValue && await IsActiveDeliveryContext(orderId.Value, current, recipientType, recipientId, ct);
        }
        return recipientType == "staff" && recipientRole is StaffRoles.Admin or StaffRoles.SuperAdmin;
    }

    private async Task<bool> IsPrescriptionContext(Guid orderId, (string Type, Guid Id, string Role) current, Guid otherId, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(x => x.Id == orderId && x.PrescriptionId != null && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Delivered, ct);
        if (order is null) return false;
        return current.Type == "customer"
            ? order.CustomerId == current.Id && order.PharmacistId == otherId
            : current.Role == StaffRoles.Pharmacist && order.PharmacistId == current.Id && order.CustomerId == otherId;
    }

    private async Task<bool> IsActiveDeliveryContext(Guid orderId, (string Type, Guid Id, string Role) current, string recipientType, Guid recipientId, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(x => x.DeliveryAssignment).SingleOrDefaultAsync(x => x.Id == orderId, ct);
        var assignment = order?.DeliveryAssignment;
        if (order is null || assignment is null || order.Status is OrderStatuses.Delivered or OrderStatuses.Cancelled or OrderStatuses.Failed || assignment.Status is DeliveryStatuses.Delivered or DeliveryStatuses.Failed) return false;
        return current.Type == "customer"
            ? order.CustomerId == current.Id && recipientType == "staff" && recipientId == assignment.DeliveryStaffId
            : current.Role == StaffRoles.Delivery && current.Id == assignment.DeliveryStaffId && recipientType == "customer" && recipientId == order.CustomerId;
    }

    private async Task<bool> CustomerOrderInBranch(Guid orderId, (string Type, Guid Id, string Role) current, Guid customerId, CancellationToken ct)
    {
        var branchId = CurrentBranchId(current);
        return branchId.HasValue && await db.Orders.AsNoTracking().AnyAsync(x => x.Id == orderId && x.BranchId == branchId && x.CustomerId == customerId && x.Status != OrderStatuses.Cancelled, ct);
    }

    private async Task<bool> SameBranch(Guid currentStaffId, Guid recipientStaffId, CancellationToken ct)
    {
        var branchId = CurrentBranchId(Current);
        return branchId.HasValue && await db.StaffUsers.AsNoTracking().AnyAsync(x => x.Id == recipientStaffId && x.IsActive && x.BranchId == branchId, ct);
    }

    private Guid? CurrentBranchId((string Type, Guid Id, string Role) current) => current.Type == "staff" && Guid.TryParse(User.FindFirstValue("branch_id"), out var branchId) ? branchId : null;
    private async Task<bool> RoleEnabled(string role, CancellationToken ct)
    {
        var disabledRoles = await db.MessagingRoleSettings.AsNoTracking().Where(x => !x.IsEnabled).Select(x => x.Role).ToListAsync(ct);
        return IsRoleEnabled(role, disabledRoles);
    }
    private static bool IsRoleEnabled(string role, IReadOnlyCollection<string> disabledRoles) => !disabledRoles.Contains(role, StringComparer.OrdinalIgnoreCase) && !((role is "PERSONAL" or "PHARMACY") && disabledRoles.Contains("CUSTOMER", StringComparer.OrdinalIgnoreCase));
    private async Task<bool> IsMember(Guid id, (string Type, Guid Id, string Role) current, CancellationToken ct) => await db.MessageParticipants.AsNoTracking().AnyAsync(x => x.ConversationId == id && (current.Type == "customer" ? x.CustomerId == current.Id : x.StaffUserId == current.Id), ct);
    private async Task<bool> CanSend(Guid id, (string Type, Guid Id, string Role) current, CancellationToken ct)
    {
        var conversation = await db.MessageConversations.AsNoTracking().Include(x => x.Participants).SingleOrDefaultAsync(x => x.Id == id, ct);
        var ownParticipant = conversation?.Participants.FirstOrDefault(x => current.Type == "customer" ? x.CustomerId == current.Id : x.StaffUserId == current.Id);
        if (conversation is null || conversation.IsClosed || ownParticipant is null) return false;
        var recipients = conversation.Participants.Where(x => !Owns(x, current)).Select(x => x.CustomerId.HasValue ? (Type: "customer", Id: x.CustomerId.Value, Role: x.ParticipantRole) : (Type: "staff", Id: x.StaffUserId!.Value, Role: x.ParticipantRole)).ToList();
        if (recipients.Count == 0) return false;
        foreach (var recipient in recipients)
        {
            if (!await CanMessage(current, recipient.Type, recipient.Id, recipient.Role, conversation.OrderId, ct)) return false;
        }
        return true;
    }
    private bool HasIdentity(out (string Type, Guid Id, string Role) current) { current = Current; return current.Id != Guid.Empty; }
    private string MessagingRole((string Type, Guid Id, string Role) current) => current.Type == "customer" ? (User.FindFirstValue("customer_account_type") ?? "CUSTOMER") : current.Role;
    private static bool Owns(MessageParticipant participant, (string Type, Guid Id, string Role) current) => current.Type == "customer" ? participant.CustomerId == current.Id : participant.StaffUserId == current.Id;
    private static bool IsSender(PlatformMessage message, (string Type, Guid Id, string Role) current) => current.Type == "customer" ? message.SenderCustomerId == current.Id : message.SenderStaffUserId == current.Id;
    private static MessageParticipant ToParticipant((string Type, Guid Id, string Role) subject, string role) => new() { CustomerId = subject.Type == "customer" ? subject.Id : null, StaffUserId = subject.Type == "staff" ? subject.Id : null, ParticipantRole = role };
    private static string UserGroup(MessageParticipant participant) => participant.CustomerId.HasValue ? $"user:customer:{participant.CustomerId}" : $"user:staff:{participant.StaffUserId}";
    private static string DisplayName(MessageParticipant? participant) => participant?.Customer?.FullName ?? participant?.StaffUser?.FullName ?? "Conversation";
    private static string? Clean(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];
}
