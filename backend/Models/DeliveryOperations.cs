namespace backend.Models;

public sealed class DeliveryCashCollection : AuditedEntity
{
    public Guid OrderId { get; set; }
    public Guid RiderId { get; set; }
    public Guid BranchId { get; set; }
    public decimal Amount { get; set; }
    public Guid? HandoverRequestId { get; set; }
    public PharmacyOrder? Order { get; set; }
}

public sealed class DeliveryHandoverRequest : AuditedEntity
{
    public Guid RiderId { get; set; }
    public Guid BranchId { get; set; }
    public Guid RequestId { get; set; }
    public decimal Amount { get; set; }
    public string Reference { get; set; } = "";
    public string Status { get; set; } = "PENDING";
    public string? ReviewNote { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? CashHandoverId { get; set; }
    public StaffUser? Rider { get; set; }
}

public sealed class DeliveryRetryRequest : AuditedEntity
{
    public Guid OrderId { get; set; }
    public Guid RiderId { get; set; }
    public Guid BranchId { get; set; }
    public Guid RequestId { get; set; }
    public DateTime RequestedDate { get; set; }
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "PENDING";
    public string? ReviewNote { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public PharmacyOrder? Order { get; set; }
    public StaffUser? Rider { get; set; }
}
