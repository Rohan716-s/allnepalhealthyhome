using backend.Models;
using backend.Contracts;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

public sealed partial class FieldSalesController
{
    private Task<DeliveryZone?> DeliveryZone(Guid branch, Address address, CancellationToken ct) => db.DeliveryZones.Where(x => x.Enabled && (x.BranchId == null || x.BranchId == branch) &&
        (x.Province == null || x.Province == address.Province) && (x.District == null || x.District == address.District) &&
        (x.Municipality == null || x.Municipality == address.Municipality) && (x.Ward == null || x.Ward == address.Ward))
        .OrderByDescending(x => x.BranchId == branch).ThenByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
    private async Task<IActionResult?> ApproveOrder(SalesFieldRecord row, RecordInput input, CancellationToken ct)
    {
        if (!await db.StaffUsers.AnyAsync(x => x.Id == row.ExecutiveId && x.IsActive && x.Role == StaffRoles.SalesExecutive && x.BranchId == row.BranchId, ct)
            || !await db.SalesCustomerAssignments.AnyAsync(x => x.ExecutiveId == row.ExecutiveId && x.CustomerId == row.CustomerId && x.BranchId == row.BranchId && x.IsActive, ct)) return Conflict(new { message = "The executive or customer assignment is no longer active." });
        var customer = await db.Customers.SingleOrDefaultAsync(x => x.Id == row.CustomerId && x.IsActive, ct);
        if (customer == null || !await db.Addresses.AnyAsync(x => x.Id == input.AddressId && x.CustomerId == row.CustomerId, ct)) return Conflict(new { message = "The customer or delivery address is no longer available." });
        var ids = input.Items!.Select(x => x.ProductId).ToArray();
        var products = await db.Products.Include(x => x.Medicine).Where(x => Enumerable.Contains(ids, x.Id) && x.IsActive).ToListAsync(ct);
        if (products.Count != ids.Length) return Conflict(new { message = "A requested product is inactive. Reject this request and ask for an updated order." });
        var config = OrderingConfiguration.Parse(await db.SystemSettings.Where(x => x.Key == "orders.configuration").Select(x => x.Value).SingleOrDefaultAsync(ct));
        var mode = config.Mode == "BULK_ONLY" ? "BULK" : "SINGLE";
        var order = new PharmacyOrder { CustomerId = row.CustomerId, BranchId = row.BranchId, AddressId = input.AddressId,
            OrderNumber = "SE-" + row.Id.ToString("N")[..20].ToUpperInvariant(), Status = products.Any(x => x.Medicine?.PrescriptionRequired == true) ? OrderStatuses.PrescriptionVerification : OrderStatuses.Pending,
            PaymentStatus = "UNPAID", PaymentMethod = input.Credit ? "CREDIT" : PaymentMethods.CashOnDelivery, OrderMode = mode,
            CustomerNotes = input.Notes, OrderCustomerName = customer.FullName, OrderCustomerPhone = customer.Phone };
        foreach (var line in input.Items!) {
            var product = products.Single(x => x.Id == line.ProductId); var multiplier = Math.Max(1, product.SalesUnitToBase);
            var rule = config.RuleFor(product);
            var minimum = mode == "BULK" ? Math.Max(config.MinimumBulkQuantity, rule.MinimumQuantity) : Math.Max(1, rule.MinimumQuantity);
            if ((mode == "BULK" ? !rule.AllowBulk : !rule.AllowSingle) || line.Quantity < minimum || line.Quantity > int.MaxValue / multiplier)
                return Conflict(new { message = $"{product.Name} does not meet the current ordering rules (minimum {minimum})." });
            var required = line.Quantity * multiplier;
            var stocks = await db.Inventory.Where(x => x.BranchId == row.BranchId && x.ProductId == product.Id)
                .Where(InventoryAvailability.SellableOn(DateTime.UtcNow.Date)).OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.CreatedAt).ToListAsync(ct);
            if (stocks.Sum(x => (long)Math.Max(0, x.StockQuantity - x.ReservedQuantity)) < required) return Conflict(new { message = $"Insufficient branch stock for {product.Name}." });
            foreach (var stock in stocks) {
                var take = Math.Min(required, Math.Max(0, stock.StockQuantity - stock.ReservedQuantity)); if (take == 0) continue;
                stock.ReservedQuantity += take; stock.UpdatedAt = DateTime.UtcNow;
                db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = row.BranchId, Type = StockTransactionTypes.Reservation,
                    Quantity = take, QuantityBefore = stock.StockQuantity, QuantityAfter = stock.StockQuantity, ActorId = actor.Id,
                    ReferenceType = "CUSTOMER_ORDER", ReferenceId = order.Id.ToString(), Unit = product.BaseUnit, Note = "Manager approved sales executive order" });
                required -= take; if (required == 0) break;
            }
            order.Items.Add(new OrderItem { ProductId = product.Id, ProductName = product.Name, Quantity = line.Quantity, UnitPrice = product.SellingPrice, Unit = product.SalesUnit, UnitMultiplier = multiplier });
        }
        var subtotal = order.Items.Sum(x => x.Quantity * x.UnitPrice);
        var address = await db.Addresses.SingleAsync(x => x.Id == input.AddressId && x.CustomerId == row.CustomerId, ct);
        var zone = await DeliveryZone(row.BranchId, address, ct);
        if (zone != null && subtotal < zone.MinimumOrder) return Conflict(new { message = "The order is below this delivery area's minimum." });
        order.DeliveryFee = zone == null || zone.FreeDeliveryThreshold > 0 && subtotal >= zone.FreeDeliveryThreshold ? 0 : zone.DeliveryFee;
        order.DiscountAmount = decimal.Round(subtotal * input.DiscountPercent / 100m, 2);
        order.Total = subtotal - order.DiscountAmount + order.DeliveryFee;
        if (row.Amount != order.Total) return Conflict(new { message = "Product prices changed after submission. Reject this request and ask for a fresh order." });
        if (input.Credit) {
            var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == customer.Id, ct);
            var limit = credit?.CreditLimit ?? customer.CreditLimit;
            var outstanding = await db.Invoices.Where(x => x.Order!.CustomerId == customer.Id && x.PaymentStatus != "VOID" && x.Order.Status != OrderStatuses.Cancelled).SumAsync(x => (decimal?)Math.Max(0m, x.Total - x.PaidAmount), ct) ?? 0;
            var pendingCredit = await db.Orders.Where(x => x.CustomerId == customer.Id && x.PaymentMethod == "CREDIT" && x.Invoice == null && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
            if (credit is { Status: not "ACTIVE" } || limit <= 0 || outstanding + pendingCredit + order.Total > limit) return Conflict(new { message = "The customer's available credit limit is insufficient." });
        }
        order.StatusHistory.Add(new OrderStatusHistory { Status = order.Status, ActorId = actor.Id.ToString(), ActorRole = actor.Role, Note = "Sales request approved; awaiting pharmacist review." });
        order.PaymentTransactions.Add(new PaymentTransaction { TransactionNumber = "SE-PAY-" + row.Id.ToString("N"), Method = order.PaymentMethod, Status = "PENDING", Amount = order.Total });
        db.Orders.Add(order); row.OrderId = order.Id; row.ResultId = order.Id; return null;
    }

    private async Task<IActionResult?> ApproveCollection(SalesFieldRecord row, RecordInput input, CancellationToken ct)
    {
        var invoices = await db.Invoices.Include(x => x.Order).Where(x => x.Order!.CustomerId == row.CustomerId && x.Order.BranchId == row.BranchId
            && x.PaymentStatus != "VOID" && x.Order.Status != OrderStatuses.Cancelled && x.Total > x.PaidAmount).OrderBy(x => x.DueAt ?? x.IssuedAt).ToListAsync(ct);
        if (input.Amount > invoices.Sum(x => x.Total - x.PaidAmount)) return Conflict(new { message = "Collection exceeds the current outstanding invoices. Confirm the amount before accepting it." });
        var payment = new CustomerPayment { CustomerId = row.CustomerId, BranchId = row.BranchId, PaymentNumber = "SE-COL-" + row.Id.ToString("N")[..20], Amount = input.Amount, Method = input.Method,
            PaymentDate = row.OccurredAt, Reference = "FIELD-SALES:" + row.Id, Notes = row.Notes[..Math.Min(row.Notes.Length, 1000)] };
        var remaining = input.Amount;
        foreach (var invoice in invoices) {
            var applied = Math.Min(remaining, invoice.Total - invoice.PaidAmount); if (applied <= 0) break;
            invoice.PaidAmount += applied; invoice.PaymentStatus = invoice.PaidAmount >= invoice.Total ? "PAID" : "PARTIAL"; invoice.Order!.PaymentStatus = invoice.PaymentStatus;
            db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = row.CustomerId, InvoiceId = invoice.Id, EntryType = "CREDIT", Amount = applied, EntryDate = payment.PaymentDate, Description = "Verified collection " + payment.PaymentNumber, Reference = payment.PaymentNumber }); remaining -= applied;
        }
        var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == row.CustomerId, ct);
        if (credit != null) credit.CurrentBalance = Math.Max(0, credit.CurrentBalance - input.Amount);
        db.CustomerPayments.Add(payment); row.ResultId = payment.Id; return null;
    }
}
