using backend.Models;

namespace backend.Services;

public static class DeliveryMoney
{
    public static decimal AmountDue(PharmacyOrder order)
    {
        if (order.PaymentStatus == "PAID") return 0m;
        var paid = Math.Max(order.Invoice?.PaidAmount ?? 0m,
            order.PaymentTransactions.Where(x => x.Status == PaymentTransactionStatuses.Paid).Sum(x => x.Amount));
        return Math.Max(0m, Math.Round(order.Total - paid, 2));
    }
}
