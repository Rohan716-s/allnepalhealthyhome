namespace backend.Services;

/// <summary>Ledger direction for cleared accountant invoice settlements.</summary>
public static class AccountingPaymentPosting
{
    public sealed record Posting(string DebitAccount, string CreditAccount, decimal Amount);

    public static Posting Create(bool customerReceipt, string method, decimal amount)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
        var moneyAccount = method.Trim().ToUpperInvariant() switch
        {
            "CASH" => "Cash",
            "BANK_TRANSFER" => "Bank",
            // An outgoing cheque reduces bank; it is never an asset held by us.
            "CHEQUE" => customerReceipt ? "Cheques in Hand" : "Bank",
            _ => throw new ArgumentException("Unsupported settlement method.", nameof(method))
        };
        return customerReceipt
            ? new Posting(moneyAccount, "Accounts Receivable", amount)
            : new Posting("Accounts Payable", moneyAccount, amount);
    }
}
