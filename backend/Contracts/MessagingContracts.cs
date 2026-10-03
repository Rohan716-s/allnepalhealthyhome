namespace backend.Contracts;

public sealed record MessagingContact(Guid Id, string ParticipantType, string Role, string Name, string Email, string? BranchName, bool CanMessage, Guid? OrderId = null);
public sealed record MessageConversationRow(Guid Id, string? Subject, DateTime? LastMessageAt, int UnreadCount, string OtherParticipantName, string OtherParticipantRole, string? Preview, bool IsClosed, Guid? OrderId = null);
public sealed record MessageAttachmentRow(Guid Id, string OriginalFileName, string ContentType, long Length, string DownloadUrl);
public sealed record PlatformMessageRow(Guid Id, Guid ConversationId, string Body, string Status, bool IsMine, string SenderName, string SenderRole, DateTime CreatedAt, DateTime? DeliveredAt, DateTime? SeenAt, decimal? Latitude, decimal? Longitude, string? LocationLabel, string? LocationSource, IReadOnlyList<MessageAttachmentRow> Attachments);
public sealed record MessageThreadResponse(MessageConversationRow Conversation, IReadOnlyList<PlatformMessageRow> Messages);
public sealed record CreateConversationRequest(Guid RecipientId, string RecipientType, string? Subject, string? Message, Guid? OrderId = null);
public sealed record SendPlatformMessageRequest(string? Body, decimal? Latitude, decimal? Longitude, string? LocationLabel, string? LocationSource);
public sealed record MessagingRoleSettingRow(string Role, bool IsEnabled);
public sealed record UpdateMessagingRoleSettingRequest(bool IsEnabled);
