namespace backend.Contracts;

public sealed record FinancialVoucherInput(string Type, DateTime VoucherDate, string Reference, string Narration,
    string DebitAccount, string CreditAccount, decimal Amount, string Method, string? ChequeNumber,
    string? BankName, string? Payee, Guid? BranchId, Guid? InvoiceId, Guid? SupplierInvoiceId, int? Revision);
public sealed record FinancialVoucherAction(int Revision, string? Reason);
public sealed record FinancialVoucherNarration(int Revision, string Narration, string Reason);
