namespace backend.Models;

public sealed class CustomerManufacturerDiscount : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Guid ManufacturerId { get; set; }
    public decimal DiscountPercent { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
    public Customer? Customer { get; set; }
    public Manufacturer? Manufacturer { get; set; }
}

public sealed class SupplierManufacturerDiscount : AuditedEntity
{
    public Guid SupplierId { get; set; }
    public Guid ManufacturerId { get; set; }
    public decimal DiscountPercent { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
    public Supplier? Supplier { get; set; }
    public Manufacturer? Manufacturer { get; set; }
}

public sealed class SalesTemplate : AuditedEntity
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<SalesTemplateLine> Lines { get; set; } = [];
}

public sealed class SalesTemplateLine : AuditedEntity
{
    public Guid SalesTemplateId { get; set; }
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public string? Unit { get; set; }
    public decimal DiscountPercent { get; set; }
    public int BonusQuantity { get; set; }
    public SalesTemplate? SalesTemplate { get; set; }
    public Product? Product { get; set; }
}

public sealed class PharmacySalesBudget : AuditedEntity
{
    public Guid? BranchId { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public decimal TargetAmount { get; set; }
    public string? Notes { get; set; }
    public Branch? Branch { get; set; }
}
