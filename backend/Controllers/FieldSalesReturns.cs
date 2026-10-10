using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace backend.Controllers;
public sealed partial class FieldSalesController
{
    private async Task<IActionResult?> ApproveReturn(SalesFieldRecord row, RecordInput payload, CancellationToken ct)
    {
        var request = new CommerceManagementController.SalesReturnRequest(payload.OrderId!.Value, payload.ProductId!.Value, payload.Quantity, payload.Notes, "CREDIT", payload.ExpiredReturn);
        var order = await db.Orders.Include(x => x.Items).Include(x => x.Customer).Where(x => x.BranchId == row.BranchId && x.CustomerId == row.CustomerId).SingleOrDefaultAsync(x => x.Id == request.OrderId, ct);
        if (order is null || order.Status is OrderStatuses.Cancelled or OrderStatuses.Failed || order.BranchId is not Guid branchId) return NotFound(new { message = "The sale could not be found in your operational scope." });
        if (await db.FinancialVouchers.AnyAsync(x => x.Status == "POSTED" && x.Invoice != null && x.Invoice.OrderId == order.Id, ct)) return Conflict(new { message = "Unpost linked financial receipts and notes before changing or reversing this sale." });
        var sold = order.Items.SingleOrDefault(x => x.ProductId == request.ProductId);
        var refundMethod = string.IsNullOrWhiteSpace(request.RefundMethod) ? "CREDIT" : request.RefundMethod.ToUpperInvariant();
        if (refundMethod is not "CASH" and not "CREDIT") return BadRequest(new { message = "Refund method must be CASH or CREDIT." });
        if (sold is null || request.Quantity <= 0) return BadRequest(new { message = "Choose a sold product and a positive return quantity." });
        var multiplier = Math.Max(1, sold.UnitMultiplier);
        if (request.Quantity > int.MaxValue / multiplier) return BadRequest(new { message = "The return quantity is too large." });
        var baseQuantity = request.Quantity * multiplier;
        var alreadyReturned = await db.SaleReturnItems.Where(x => x.SaleReturn!.OrderId == order.Id && x.ProductId == request.ProductId && x.SaleReturn.Status == "APPROVED").SumAsync(x => (int?)x.Quantity, ct) ?? 0;
        var remainingSoldQuantity = Math.Max(0, sold.Quantity * multiplier - alreadyReturned);
        if (baseQuantity > remainingSoldQuantity) return BadRequest(new { message = $"The return quantity is greater than the remaining sold quantity ({remainingSoldQuantity / multiplier} {sold.Unit})." });

        var saleMovements = await db.StockTransactions.Include(x => x.Inventory).ThenInclude(x => x!.Product)
            .Where(x => x.Type == StockTransactionTypes.Sale && x.ReferenceId == order.Id.ToString()
                && x.Inventory!.ProductId == request.ProductId
                && (x.ReferenceType == "POS_SALE" || x.ReferenceType == "CUSTOMER_ORDER_DELIVERY"))
            .ToListAsync(ct);
        var returnedByBatchRows = await db.SaleReturnItems.Where(x => x.SaleReturn!.OrderId == order.Id && x.ProductId == request.ProductId && x.SaleReturn.Status == "APPROVED")
            .Select(x => new { x.BatchNumber, x.Quantity }).ToListAsync(ct);
        var returnedByBatch = returnedByBatchRows.GroupBy(x => x.BatchNumber).ToDictionary(x => x.Key, x => x.Sum(item => item.Quantity), StringComparer.OrdinalIgnoreCase);
        var batchCapacities = saleMovements.Where(x => x.Inventory is not null).GroupBy(x => x.InventoryId)
            .Select(group => new { Stock = group.First().Inventory!, SoldQuantity = group.Sum(x => Math.Max(0, -x.Quantity)) })
            .OrderBy(x => x.Stock.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.Stock.CreatedAt).ToList();
        if (batchCapacities.Sum(x => x.SoldQuantity) - returnedByBatchRows.Sum(x => x.Quantity) < baseQuantity)
            return Conflict(new { message = "The original batch allocation for this sale is incomplete; the return cannot be safely posted." });

        var originalSubtotal = order.Items.Sum(x => x.UnitPrice * x.Quantity);
        var amount = decimal.Round(sold.UnitPrice * request.Quantity * (originalSubtotal > 0 ? Math.Max(0, originalSubtotal - order.DiscountAmount) / originalSubtotal : 0), 2);
        var saleReturn = new SaleReturn { ReturnNumber = $"ANHH-SR-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", OrderId = order.Id, CustomerId = order.CustomerId, BranchId = branchId, ReturnDate = ApplicationTime.NepalNow, Status = "APPROVED", ReturnType = request.ExpiredReturn ? "EXPIRED" : "STANDARD", TotalAmount = amount, Reason = request.Reason?.Trim() };
        var remainingToRestore = baseQuantity;
        foreach (var batch in batchCapacities)
        {
            if (remainingToRestore <= 0) break;
            var previouslyReturned = returnedByBatch.GetValueOrDefault(batch.Stock.BatchNumber);
            var availableForReturn = Math.Max(0, batch.SoldQuantity - previouslyReturned);
            var quantity = Math.Min(remainingToRestore, availableForReturn);
            if (quantity <= 0) continue;
            var before = batch.Stock.StockQuantity;
            batch.Stock.StockQuantity += quantity;
            batch.Stock.UpdatedAt = ApplicationTime.NepalNow;
            var batchStatusBefore = batch.Stock.BatchStatus;
            if (request.ExpiredReturn) batch.Stock.BatchStatus = "QUARANTINED";
            var baseUnitPrice = amount / baseQuantity;
            saleReturn.Items.Add(new SaleReturnItem { ProductId = request.ProductId, BatchNumber = batch.Stock.BatchNumber, Quantity = quantity, UnitPrice = baseUnitPrice, TotalAmount = baseUnitPrice * quantity });
            db.StockTransactions.Add(new StockTransaction { InventoryId = batch.Stock.Id, BranchId = batch.Stock.BranchId, Type = StockTransactionTypes.SalesReturn, Quantity = quantity, QuantityBefore = before, QuantityAfter = batch.Stock.StockQuantity, Unit = batch.Stock.Product?.BaseUnit ?? "piece", ReferenceType = "SALES_RETURN", ReferenceId = saleReturn.Id.ToString(), Reason = request.Reason?.Trim(), Note = $"{saleReturn.ReturnType} sales return {saleReturn.ReturnNumber}", BatchStatusBefore = batchStatusBefore, BatchStatusAfter = batch.Stock.BatchStatus, ActorId = actor.Id });
            remainingToRestore -= quantity;
        }
        if (remainingToRestore > 0) return Conflict(new { message = "The original batches do not have enough unreturned sold quantity." });
        db.SaleReturns.Add(saleReturn);
        var invoice = await db.Invoices.SingleOrDefaultAsync(x => x.OrderId == order.Id, ct);
        var creditRelief = 0m;
        var cashRefund = 0m;
        if (invoice is not null)
        {
            var outstandingBefore = Math.Max(0m, invoice.Total - invoice.PaidAmount);
            if (refundMethod.Equals("CASH", StringComparison.OrdinalIgnoreCase))
            {
                cashRefund = Math.Min(amount, invoice.PaidAmount);
                invoice.PaidAmount = Math.Max(0m, invoice.PaidAmount - cashRefund);
                if (cashRefund > 0) order.PaymentTransactions.Add(new PaymentTransaction { TransactionNumber = $"RETURN-REFUND-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Method = "CASH", Status = PaymentTransactionStatuses.Refunded, Amount = cashRefund, RefundedAt = ApplicationTime.NepalNow, Notes = $"Cash refund for {saleReturn.ReturnNumber}" });
                creditRelief = Math.Min(Math.Max(0m, amount - cashRefund), outstandingBefore);
            }
            else creditRelief = Math.Min(amount, outstandingBefore);
            invoice.Total = Math.Max(0m, invoice.Total - amount); invoice.Subtotal = Math.Max(0m, invoice.Subtotal - amount); invoice.PaymentStatus = invoice.PaidAmount >= invoice.Total ? "PAID" : invoice.PaidAmount > 0 ? "PARTIAL" : "UNPAID";
        }
        saleReturn.RefundMethod = refundMethod;
        saleReturn.CashRefundAmount = cashRefund;
        saleReturn.CreditReliefAmount = creditRelief;
        if (cashRefund > 0) db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = order.CustomerId, InvoiceId = invoice?.Id, EntryType = "DEBIT", Amount = cashRefund, EntryDate = saleReturn.ReturnDate, Description = $"Cash refund for sales return {saleReturn.ReturnNumber}" });
        var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == order.CustomerId, ct); if (credit is not null && creditRelief > 0) credit.CurrentBalance = Math.Max(0m, credit.CurrentBalance - creditRelief);
        if (creditRelief > 0) db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = order.CustomerId, InvoiceId = invoice?.Id, EntryType = "CREDIT", Amount = creditRelief, EntryDate = saleReturn.ReturnDate, Description = $"Sales return {saleReturn.ReturnNumber}" });
        db.ActivityLogs.Add(new ActivityLog { ActorId = actor.Id, ActorRole = actor.Role, Action = "SALES_RETURN_APPROVED", EntityType = "SaleReturn", EntityId = saleReturn.Id.ToString(), NewValue = saleReturn.ReturnNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        row.ResultId = saleReturn.Id;
        row.Amount = saleReturn.TotalAmount;
        return null;
    }
}
