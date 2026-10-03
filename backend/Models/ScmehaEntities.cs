namespace backend.Models;

public sealed class PurchaseReturn : AuditedEntity
{
    public required string ReturnNumber { get; set; }
    public Guid? PurchaseOrderId { get; set; }
    public Guid? SupplierInvoiceId { get; set; }
    public Guid SupplierId { get; set; }
    public Guid BranchId { get; set; }
    public DateTime ReturnDate { get; set; }
    public string Status { get; set; } = "DRAFT";
    public decimal TotalAmount { get; set; }
    public string? Reason { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public SupplierInvoice? SupplierInvoice { get; set; }
    public Supplier? Supplier { get; set; }
    public Branch? Branch { get; set; }
    public ICollection<PurchaseReturnItem> Items { get; set; } = [];
}

public sealed class PurchaseReturnItem : AuditedEntity
{
    public Guid PurchaseReturnId { get; set; }
    public Guid ProductId { get; set; }
    public required string BatchNumber { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TotalAmount { get; set; }
    public PurchaseReturn? PurchaseReturn { get; set; }
    public Product? Product { get; set; }
}

public sealed class CustomerCredit : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public decimal CreditLimit { get; set; }
    public decimal CurrentBalance { get; set; }
    public int PaymentTermsDays { get; set; } = 30;
    public string Status { get; set; } = "ACTIVE";
    public Customer? Customer { get; set; }
}

public sealed class SaleReturn : AuditedEntity
{
    public required string ReturnNumber { get; set; }
    public Guid? OrderId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid BranchId { get; set; }
    public DateTime ReturnDate { get; set; }
    public string Status { get; set; } = "DRAFT";
    public string ReturnType { get; set; } = "STANDARD";
    public decimal TotalAmount { get; set; }
    public string? RefundMethod { get; set; }
    public decimal CashRefundAmount { get; set; }
    public decimal CreditReliefAmount { get; set; }
    public string? Reason { get; set; }
    public PharmacyOrder? Order { get; set; }
    public Customer? Customer { get; set; }
    public Branch? Branch { get; set; }
    public ICollection<SaleReturnItem> Items { get; set; } = [];
}

public sealed class SaleReturnItem : AuditedEntity
{
    public Guid SaleReturnId { get; set; }
    public Guid ProductId { get; set; }
    public required string BatchNumber { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalAmount { get; set; }
    public SaleReturn? SaleReturn { get; set; }
    public Product? Product { get; set; }
}

public sealed class CustomerPayment : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Guid? BranchId { get; set; }
    public required string PaymentNumber { get; set; }
    public decimal Amount { get; set; }
    public required string Method { get; set; }
    public DateTime PaymentDate { get; set; }
    public string Status { get; set; } = "CLEARED";
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public Customer? Customer { get; set; }
    public Branch? Branch { get; set; }
}

public sealed class SupplierPayment : AuditedEntity
{
    public Guid SupplierId { get; set; }
    public Guid? BranchId { get; set; }
    public required string PaymentNumber { get; set; }
    public decimal Amount { get; set; }
    public required string Method { get; set; }
    public DateTime PaymentDate { get; set; }
    public string Status { get; set; } = "CLEARED";
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public Supplier? Supplier { get; set; }
    public Branch? Branch { get; set; }
}

public sealed class ContactWidgetLink : AuditedEntity
{
    public required string Type { get; set; }
    public required string Label { get; set; }
    public required string Target { get; set; }
    public string? Icon { get; set; }
    public string? PredefinedMessage { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsEnabled { get; set; } = true;
}

public sealed class TrustBadge : AuditedEntity
{
    public required string BadgeKey { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsEnabled { get; set; } = true;
}

public sealed class AssistantChatSession : AuditedEntity
{
    public required string SessionKey { get; set; }
    public string? VisitorReference { get; set; }
    public ICollection<AssistantChatMessage> Messages { get; set; } = [];
}

public sealed class AssistantChatMessage : AuditedEntity
{
    public Guid SessionId { get; set; }
    public required string Role { get; set; }
    public required string Content { get; set; }
    public AssistantChatSession? Session { get; set; }
}
