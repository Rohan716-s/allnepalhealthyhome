using System.Security.Cryptography;
using backend.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public sealed record StoredMessageAttachment(string OriginalFileName, string StoredFileName, string ContentType, long Length, string Sha256);

public interface IMessageAttachmentStorage
{
    Task<StoredMessageAttachment> SaveAsync(IFormFile file, CancellationToken cancellationToken);
    Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken);
}

public sealed class MessageAttachmentStorage(IConfiguration configuration, IHostEnvironment environment) : IMessageAttachmentStorage
{
    private const long MaxBytes = 10 * 1024 * 1024;
    private static readonly IReadOnlyDictionary<string, string[]> Allowed = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = ["image/jpeg"], [".jpeg"] = ["image/jpeg"], [".png"] = ["image/png"], [".webp"] = ["image/webp"],
        [".pdf"] = ["application/pdf"], [".doc"] = ["application/msword"], [".docx"] = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        [".xls"] = ["application/vnd.ms-excel"], [".xlsx"] = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    };

    private string Root => Path.GetFullPath(configuration["Storage:MessageRoot"] ?? Path.Combine(environment.ContentRootPath, "App_Data", "messages"));

    public async Task<StoredMessageAttachment> SaveAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length <= 0) throw new InvalidDataException("Please choose an attachment.");
        if (file.Length > MaxBytes) throw new InvalidDataException("Attachments must be 10 MB or smaller.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!Allowed.TryGetValue(extension, out var contentTypes) || !contentTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
            throw new InvalidDataException("This attachment type is not supported.");
        var bytes = new byte[checked((int)file.Length)];
        await using var input = file.OpenReadStream();
        await input.ReadExactlyAsync(bytes, cancellationToken);
        if (!HasSafeSignature(bytes, extension)) throw new InvalidDataException("The attachment content does not match its file type.");
        if (file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) ImageContentValidation.Validate(bytes, extension);
        Directory.CreateDirectory(Root);
        var stored = $"{Guid.NewGuid():N}{extension}";
        await File.WriteAllBytesAsync(Path.Combine(Root, stored), bytes, cancellationToken);
        return new StoredMessageAttachment(Path.GetFileName(file.FileName), stored, file.ContentType, bytes.LongLength, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }

    public Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken)
    {
        if (Path.GetFileName(storedFileName) != storedFileName) return Task.FromResult<Stream?>(null);
        var path = Path.Combine(Root, storedFileName);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    private static bool HasSafeSignature(byte[] bytes, string extension) => extension switch
    {
        ".jpg" or ".jpeg" => bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff,
        ".png" => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
        ".webp" => bytes.Length >= 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
        ".pdf" => bytes.Length >= 5 && System.Text.Encoding.ASCII.GetString(bytes, 0, 5) == "%PDF-",
        ".doc" or ".xls" => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1 }),
        ".docx" or ".xlsx" => bytes.Length >= 4 && bytes.AsSpan(0, 4).SequenceEqual(new byte[] { 0x50, 0x4b, 0x03, 0x04 }),
        _ => false
    };
}

public interface IMessagingConversationService
{
    Task EnsureDeliveryConversationAsync(Guid orderId, Guid customerId, Guid deliveryStaffId, string orderNumber, CancellationToken cancellationToken);
    Task CloseDeliveryConversationAsync(Guid orderId, CancellationToken cancellationToken);
}

public sealed class MessagingConversationService(backend.Data.ApplicationDbContext db) : IMessagingConversationService
{
    public async Task EnsureDeliveryConversationAsync(Guid orderId, Guid customerId, Guid deliveryStaffId, string orderNumber, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == customerId && x.IsActive, cancellationToken);
        var delivery = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == deliveryStaffId && x.IsActive && x.Role == StaffRoles.Delivery, cancellationToken);
        if (customer is null || delivery is null) return;
        if (await db.MessagingRoleSettings.AsNoTracking().AnyAsync(x => !x.IsEnabled && (x.Role == customer.AccountType || x.Role == "CUSTOMER" || x.Role == StaffRoles.Delivery), cancellationToken)) return;

        var conversation = await db.MessageConversations.Include(x => x.Participants).SingleOrDefaultAsync(x => x.OrderId == orderId, cancellationToken);
        if (conversation is null)
        {
            conversation = new MessageConversation { OrderId = orderId, Subject = $"Delivery chat · {orderNumber}" };
            conversation.Participants.Add(new MessageParticipant { CustomerId = customerId, ParticipantRole = customer.AccountType });
            conversation.Participants.Add(new MessageParticipant { StaffUserId = deliveryStaffId, ParticipantRole = StaffRoles.Delivery });
            db.MessageConversations.Add(conversation);
        }
        else
        {
            conversation.IsClosed = false;
            conversation.Subject = $"Delivery chat · {orderNumber}";
            foreach (var participant in conversation.Participants.Where(x => x.StaffUserId.HasValue && x.StaffUserId != deliveryStaffId).ToList()) db.MessageParticipants.Remove(participant);
            if (!conversation.Participants.Any(x => x.StaffUserId == deliveryStaffId)) conversation.Participants.Add(new MessageParticipant { ConversationId = conversation.Id, StaffUserId = deliveryStaffId, ParticipantRole = StaffRoles.Delivery });
        }
        conversation.UpdatedAt = DateTime.UtcNow;
    }

    public async Task CloseDeliveryConversationAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var conversation = await db.MessageConversations.SingleOrDefaultAsync(x => x.OrderId == orderId, cancellationToken);
        if (conversation is null || conversation.IsClosed) return;
        conversation.IsClosed = true;
        conversation.UpdatedAt = DateTime.UtcNow;
    }
}
