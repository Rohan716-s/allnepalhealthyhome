namespace backend.Models;

public sealed class MessageConversation : AuditedEntity
{
    public Guid? OrderId { get; set; }
    public string? Subject { get; set; }
    public bool IsClosed { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public ICollection<MessageParticipant> Participants { get; set; } = [];
    public ICollection<PlatformMessage> Messages { get; set; } = [];
    public PharmacyOrder? Order { get; set; }
}

public sealed class MessageParticipant : AuditedEntity
{
    public Guid ConversationId { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? StaffUserId { get; set; }
    public required string ParticipantRole { get; set; }
    public DateTime? LastReadAt { get; set; }
    public MessageConversation? Conversation { get; set; }
    public Customer? Customer { get; set; }
    public StaffUser? StaffUser { get; set; }
}

public sealed class PlatformMessage : AuditedEntity
{
    public Guid ConversationId { get; set; }
    public Guid? SenderCustomerId { get; set; }
    public Guid? SenderStaffUserId { get; set; }
    public required string Body { get; set; }
    public string Status { get; set; } = MessageStatuses.Sent;
    public DateTime? DeliveredAt { get; set; }
    public DateTime? SeenAt { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? LocationLabel { get; set; }
    public string? LocationSource { get; set; }
    public MessageConversation? Conversation { get; set; }
    public Customer? SenderCustomer { get; set; }
    public StaffUser? SenderStaffUser { get; set; }
    public ICollection<MessageAttachment> Attachments { get; set; } = [];
}

public sealed class MessageAttachment : AuditedEntity
{
    public Guid MessageId { get; set; }
    public required string OriginalFileName { get; set; }
    public required string StoredFileName { get; set; }
    public required string ContentType { get; set; }
    public long Length { get; set; }
    public required string Sha256 { get; set; }
    public PlatformMessage? Message { get; set; }
}

public sealed class MessagingRoleSetting : AuditedEntity
{
    public required string Role { get; set; }
    public bool IsEnabled { get; set; } = true;
    public Guid? UpdatedByStaffUserId { get; set; }
    public StaffUser? UpdatedByStaffUser { get; set; }
}

public static class MessageStatuses
{
    public const string Sent = "SENT";
    public const string Delivered = "DELIVERED";
    public const string Seen = "SEEN";
}
