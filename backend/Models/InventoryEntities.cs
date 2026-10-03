namespace backend.Models;

/// <summary>
/// Configurable selling and purchasing units for a product. Inventory quantities
/// remain stored once in the product's base unit; this table only describes the
/// conversion used by the counter and purchase workflows.
/// </summary>
public sealed class ProductUnit : AuditedEntity
{
    public Guid ProductId { get; set; }
    public required string UnitName { get; set; }
    public int MultiplierToBase { get; set; } = 1;
    public bool IsPurchaseUnit { get; set; }
    public bool IsSalesUnit { get; set; }
    public int DisplayOrder { get; set; }
    public Product? Product { get; set; }
}

public sealed class StockCount : AuditedEntity
{
    public required string CountNumber { get; set; }
    public Guid BranchId { get; set; }
    public string Status { get; set; } = StockCountStatuses.Draft;
    public string? Scope { get; set; }
    public string? CategoryFilter { get; set; }
    public string? LocationFilter { get; set; }
    public string? Notes { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public Guid? FinalizedByStaffId { get; set; }
    public Branch? Branch { get; set; }
    public StaffUser? FinalizedByStaffUser { get; set; }
    public ICollection<StockCountLine> Lines { get; set; } = [];
}

public sealed class StockCountLine : AuditedEntity
{
    public Guid StockCountId { get; set; }
    public Guid InventoryId { get; set; }
    public int SystemQuantity { get; set; }
    public int? PhysicalQuantity { get; set; }
    public int Variance { get; set; }
    public decimal VarianceValue { get; set; }
    public string? Reason { get; set; }
    public StockCount? StockCount { get; set; }
    public Inventory? Inventory { get; set; }
}

public sealed class InventoryTransfer : AuditedEntity
{
    public required string TransferNumber { get; set; }
    public Guid SourceBranchId { get; set; }
    public Guid TargetBranchId { get; set; }
    public string Status { get; set; } = InventoryTransferStatuses.Draft;
    public string? Note { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public Guid? DispatchedByStaffId { get; set; }
    public Guid? ReceivedByStaffId { get; set; }
    public Branch? SourceBranch { get; set; }
    public Branch? TargetBranch { get; set; }
    public StaffUser? DispatchedByStaffUser { get; set; }
    public StaffUser? ReceivedByStaffUser { get; set; }
    public ICollection<InventoryTransferItem> Items { get; set; } = [];
}

public sealed class InventoryTransferItem : AuditedEntity
{
    public Guid InventoryTransferId { get; set; }
    public Guid SourceInventoryId { get; set; }
    public Guid ProductId { get; set; }
    public required string BatchNumber { get; set; }
    public int Quantity { get; set; }
    public int ReceivedQuantity { get; set; }
    public decimal PurchasePrice { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public InventoryTransfer? InventoryTransfer { get; set; }
    public Inventory? SourceInventory { get; set; }
    public Product? Product { get; set; }
}

public static class StockCountStatuses
{
    public const string Draft = "DRAFT";
    public const string Finalized = "FINALIZED";
    public const string Cancelled = "CANCELLED";
}

public static class InventoryTransferStatuses
{
    public const string Draft = "DRAFT";
    public const string InTransit = "IN_TRANSIT";
    public const string Received = "RECEIVED";
    public const string Cancelled = "CANCELLED";
}
