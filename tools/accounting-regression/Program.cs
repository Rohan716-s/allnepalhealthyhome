using backend.Services;

var passed = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception($"FAIL {name}");
    Console.WriteLine($"PASS {name}");
    passed++;
}

foreach (var (method, incoming, outgoing) in new[]
{
    ("CASH", "Cash", "Cash"),
    ("BANK_TRANSFER", "Bank", "Bank"),
    ("CHEQUE", "Cheques in Hand", "Bank")
})
{
    var receipt = AccountingPaymentPosting.Create(true, method, 250m);
    var payment = AccountingPaymentPosting.Create(false, method, 125m);
    Check(receipt.DebitAccount == incoming && receipt.CreditAccount == "Accounts Receivable" && receipt.Amount == 250m,
        $"{method} receipt increases money and reduces receivables");
    Check(payment.DebitAccount == "Accounts Payable" && payment.CreditAccount == outgoing && payment.Amount == 125m,
        $"{method} supplier payment reduces payables and money");
}

// Reconcile a purchase, a partial supplier settlement, a credit sale and a receipt.
var ledger = new Dictionary<string, decimal>();
void Post(string debit, string credit, decimal amount)
{
    ledger[debit] = ledger.GetValueOrDefault(debit) + amount;
    ledger[credit] = ledger.GetValueOrDefault(credit) - amount;
}
Post("Cash", "Opening Equity", 1000m);
Post("Inventory", "Accounts Payable", 600m);
Post("Accounts Receivable", "Sales", 400m);
foreach (var settlement in new[]
{
    AccountingPaymentPosting.Create(false, "CASH", 200m),
    AccountingPaymentPosting.Create(true, "CASH", 150m)
}) Post(settlement.DebitAccount, settlement.CreditAccount, settlement.Amount);
Check(ledger["Cash"] == 950m, "cash reconciles with supplier outflow and customer inflow");
Check(ledger["Accounts Payable"] == -400m, "partially paid supplier liability reconciles");
Check(ledger["Accounts Receivable"] == 250m, "partially paid customer receivable reconciles");
Check(ledger.Values.Sum() == 0m, "settlement scenario trial balance reconciles");

foreach (var amount in new[] { 0m, -1m })
{
    var rejected = false;
    try { AccountingPaymentPosting.Create(true, "CASH", amount); }
    catch (ArgumentOutOfRangeException) { rejected = true; }
    Check(rejected, $"invalid amount {amount} rejected");
}
var invalidMethodRejected = false;
try { AccountingPaymentPosting.Create(false, "UNKNOWN", 1m); }
catch (ArgumentException) { invalidMethodRejected = true; }
Check(invalidMethodRejected, "unknown payment method rejected rather than mapped to bank");
Console.WriteLine($"{passed} accounting regression checks passed.");
