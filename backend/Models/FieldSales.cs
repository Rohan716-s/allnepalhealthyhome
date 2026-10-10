namespace backend.Models;

public sealed class SalesCustomerAssignment : AuditedEntity
{
    public Guid ExecutiveId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid BranchId { get; set; }
    public string Territory { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public sealed class SalesExecutiveTarget : AuditedEntity
{
    public Guid ExecutiveId { get; set; }
    public Guid BranchId { get; set; }
    public DateTime Month { get; set; }
    public decimal TargetAmount { get; set; }
    public decimal DiscountLimitPercent { get; set; }
}

public sealed class SalesFieldRecord : AuditedEntity
{
    public Guid ExecutiveId { get; set; }
    public Guid BranchId { get; set; }
    public Guid CustomerId { get; set; }
    public string Kind { get; set; } = "VISIT";
    public string Status { get; set; } = "PENDING";
    public DateTime OccurredAt { get; set; }
    public DateTime? FollowUpAt { get; set; }
    public string Notes { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public decimal Amount { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? ResultId { get; set; }
    public Guid RequestId { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
}
