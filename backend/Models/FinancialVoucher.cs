namespace backend.Models;

/// <summary>Draft financial documents become ledger entries only through explicit posting.</summary>
public sealed class FinancialVoucher : AuditedEntity
{
    public required string Number { get; set; }
    public required string Type { get; set; }
    public Guid? BranchId { get; set; }
    public DateTime VoucherDate { get; set; }
    public required string Reference { get; set; }
    public required string Narration { get; set; }
    public required string DebitAccount { get; set; }
    public required string CreditAccount { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = "CASH";
    public string? ChequeNumber { get; set; }
    public string? BankName { get; set; }
    public string? Payee { get; set; }
    public string Status { get; set; } = "DRAFT";
    public Guid? InvoiceId { get; set; }
    public Guid? SupplierInvoiceId { get; set; }
    public Guid? JournalEntryId { get; set; }
    public Guid? CustomerLedgerEntryId { get; set; }
    public Guid? CustomerPaymentId { get; set; }
    public Guid? SupplierPaymentId { get; set; }
    public Guid CreatedBy { get; set; }
    public int Revision { get; set; } = 1;
    public DateTime? PostedAt { get; set; }
    public Invoice? Invoice { get; set; }
    public SupplierInvoice? SupplierInvoice { get; set; }
    public Branch? Branch { get; set; }
}
