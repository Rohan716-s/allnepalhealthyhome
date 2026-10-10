using System.Linq.Expressions;
using backend.Models;

namespace backend.Services;

public static class InventoryAvailability
{
    public static Expression<Func<Inventory, bool>> SellableOn(DateTime date) => inventory =>
        inventory.BatchStatus != "EXPIRED" &&
        inventory.BatchStatus != "DEPLETED" &&
        inventory.BatchStatus != "QUARANTINED" &&
        inventory.BatchStatus != "RETURNED" &&
        (!inventory.ExpiryDate.HasValue || inventory.ExpiryDate.Value.Date >= date);

    public static int ForBatch(Inventory inventory, DateTime date)
    {
        if (inventory.BatchStatus is "EXPIRED" or "DEPLETED" or "QUARANTINED" or "RETURNED" ||
            inventory.ExpiryDate.HasValue && inventory.ExpiryDate.Value.Date < date)
        {
            return 0;
        }

        return Math.Max(0, inventory.StockQuantity - inventory.ReservedQuantity);
    }

    public static int ForProduct(IEnumerable<Inventory> inventory, DateTime date)
    {
        var available = inventory.Sum(batch => (long)ForBatch(batch, date));
        return (int)Math.Min(int.MaxValue, available);
    }
}
