using System.Security.Claims;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

/// <summary>
/// The single operational API used by the Sales & Purchase workspace.
/// It deliberately reuses the existing orders, invoices, purchase orders,
/// inventory and ledger tables so the old workflows and reports remain valid.
/// </summary>
[ApiController]
[Route("api/admin/sales-purchase")]
[Route("api/superadmin/sales-purchase")]
public sealed class CommerceManagementController(ApplicationDbContext db) : ControllerBase
{
    private bool IsSuperAdmin => User.IsStaffRole(StaffRoles.SuperAdmin);
    private bool IsAdmin => User.IsStaffRole(StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.SuperAdmin);
    private bool IsAccountant => User.IsStaffRole(StaffRoles.Accountant);
    private bool IsSalesExecutive => User.IsStaffRole(StaffRoles.SalesExecutive);
    private bool SuperAdminPath => Request.Path.StartsWithSegments("/api/superadmin", StringComparison.OrdinalIgnoreCase);
    private Guid ActorId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private Guid? ActorBranchId => Guid.TryParse(User.FindFirstValue("branch_id"), out var id) ? id : null;
    private string ActorRole => User.FindFirstValue(ClaimTypes.Role) ?? "STAFF";

    private bool CanView => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || IsAdmin || IsAccountant || IsSalesExecutive;
    private bool CanSell => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || IsAdmin || IsAccountant || IsSalesExecutive;
    private bool CanPurchase => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || IsAdmin || IsAccountant;
    private bool CanLedger => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || IsAdmin || IsAccountant;
    private bool CanInventoryView => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || !IsSalesExecutive && User.HasStaffPermission(AppPermissions.InventoryView);
    private bool CanInventoryAdjust => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || IsAdmin && User.HasStaffPermission(AppPermissions.InventoryAdjust);
    private bool CanInventoryValuation => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || User.HasStaffPermission(AppPermissions.InventoryValuationView);
    private bool CanManageProductMaster => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || IsAdmin && User.HasStaffPermission(AppPermissions.CatalogManage);
    // A branch assignment is the data boundary, regardless of staff role. An
    // unassigned Admin/Accountant is treated as Head Office; operational roles
    // that require a branch fail closed when their assignment is missing.
    private bool HasBranchScope => !IsSuperAdmin && (ActorBranchId.HasValue || User.IsStaffRole(StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.SalesExecutive));

    private IQueryable<PharmacyOrder> ScopeOrders(IQueryable<PharmacyOrder> query)
    {
        if (HasBranchScope && ActorBranchId is Guid branchId) query = query.Where(x => x.BranchId == branchId);
        else if (HasBranchScope) query = query.Where(_ => false);

        if (!IsSalesExecutive) return query;
        var staffId = ActorId;
        return query.Where(order => order.Items.Any(item => db.SalesExecutiveProductAssignments.Any(a =>
            a.SalesExecutiveUserId == staffId && a.IsActive &&
            ((a.ProductId.HasValue && a.ProductId.Value == item.ProductId) ||
             (a.CategoryId.HasValue && item.Product!.Medicine!.CategoryId == a.CategoryId.Value)))));
    }

    private bool BranchAllowed(Guid branchId)
        => !HasBranchScope || ActorBranchId == branchId;

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(DateTime? from, DateTime? to, Guid? branchId, CancellationToken ct)
    {
        if (!CanView) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var (start, end) = Range(from, to);
        var ordersQuery = ScopeOrders(db.Orders.AsNoTracking()).Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed);
        if (branchId.HasValue) ordersQuery = ordersQuery.Where(x => x.BranchId == branchId.Value);
        var orders = await ordersQuery.ToListAsync(ct);
        var purchasesQuery = db.PurchaseOrders.AsNoTracking().Include(x => x.Items).Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Items.Any(item => item.QuantityReceived > 0));
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) purchasesQuery = purchasesQuery.Where(x => x.BranchId == scopedBranch);
        else if (HasBranchScope) purchasesQuery = purchasesQuery.Where(_ => false);
        if (branchId.HasValue) purchasesQuery = purchasesQuery.Where(x => x.BranchId == branchId.Value);
        var purchases = await purchasesQuery.ToListAsync(ct);
        var receivableQuery = db.Invoices.AsNoTracking().Where(x => x.PaymentStatus != "VOID" && x.Order!.Status != OrderStatuses.Cancelled);
        if (HasBranchScope) receivableQuery = ActorBranchId is Guid receivableBranch ? receivableQuery.Where(x => x.Order!.BranchId == receivableBranch) : receivableQuery.Where(_ => false);
        if (branchId.HasValue) receivableQuery = receivableQuery.Where(x => x.Order!.BranchId == branchId.Value);
        var receivables = await receivableQuery.SumAsync(x => (decimal?)Math.Max(0m, x.Total - x.PaidAmount), ct) ?? 0m;
        var payableQuery = db.SupplierInvoices.AsNoTracking().Where(x => x.Status != "VOID");
        if (HasBranchScope) payableQuery = ActorBranchId is Guid payableBranch ? payableQuery.Where(x => x.BranchId == payableBranch || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == payableBranch) : payableQuery.Where(_ => false);
        if (branchId.HasValue) payableQuery = payableQuery.Where(x => x.BranchId == branchId.Value || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == branchId.Value);
        var payables = await payableQuery.SumAsync(x => (decimal?)Math.Max(0m, x.Total - x.PaidAmount), ct) ?? 0m;
        var inventoryQuery = db.Inventory.AsNoTracking();
        if (HasBranchScope && ActorBranchId is Guid inventoryBranch) inventoryQuery = inventoryQuery.Where(x => x.BranchId == inventoryBranch);
        else if (HasBranchScope) inventoryQuery = inventoryQuery.Where(_ => false);
        if (branchId.HasValue) inventoryQuery = inventoryQuery.Where(x => x.BranchId == branchId.Value);
        var inventory = await inventoryQuery.ToListAsync(ct);
        var orderIds = orders.Select(x => x.Id).ToList();
        var invoiceRows = await db.Invoices.AsNoTracking().Where(x => orderIds.Contains(x.OrderId) && x.PaymentStatus != "VOID").ToListAsync(ct);
        var saleReturnsQuery = db.SaleReturns.AsNoTracking().Where(x => x.ReturnDate >= start && x.ReturnDate < end && x.Status == "APPROVED");
        if (HasBranchScope && ActorBranchId is Guid returnBranch) saleReturnsQuery = saleReturnsQuery.Where(x => x.BranchId == returnBranch);
        else if (HasBranchScope) saleReturnsQuery = saleReturnsQuery.Where(_ => false);
        if (branchId.HasValue) saleReturnsQuery = saleReturnsQuery.Where(x => x.BranchId == branchId.Value);
        var totalReturns = await saleReturnsQuery.SumAsync(x => (decimal?)x.TotalAmount, ct) ?? 0m;
        var cashCollected = invoiceRows.Where(x => orders.FirstOrDefault(o => o.Id == x.OrderId)?.PaymentMethod is "CASH" or "PARTIAL").Sum(x => x.PaidAmount);
        var creditIssued = invoiceRows.Where(x => orders.FirstOrDefault(o => o.Id == x.OrderId)?.PaymentMethod is "CREDIT" or "PARTIAL").Sum(x => Math.Max(0m, x.Total - x.PaidAmount));
        var today = ApplicationTime.NepalNow.Date;
        return Ok(new
        {
            sales = orders.Sum(x => x.Total),
            salesCount = orders.Count,
            purchases = purchases.Sum(x => x.Items.Sum(item => item.QuantityReceived * item.UnitCost)),
            purchaseCount = purchases.Count,
            receivables,
            payables,
            netCredit = receivables - payables,
            stockValue = CanInventoryValuation ? inventory.Sum(x => x.StockQuantity * x.PurchasePrice) : (decimal?)null,
            lowStock = inventory.Count(x => x.StockQuantity - x.ReservedQuantity <= x.MinimumStock),
            nearExpiry = inventory.Count(x => x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date >= today && x.ExpiryDate.Value.Date <= today.AddDays(90)),
            profit = orders.Count == 0 ? 0m : await ProfitForOrders(orders.Select(x => x.Id), ct)
            ,cashCollected
            ,creditIssued
            ,totalReturns
            ,netSales = orders.Sum(x => x.Total) - totalReturns
        });
    }

    [HttpGet("branch-cash-flow")]
    public async Task<IActionResult> BranchCashFlow(DateTime? from, DateTime? to, Guid? branchId, CancellationToken ct)
    {
        if (!CanLedger) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var (start, end) = Range(from, to);
        var branchQuery = db.Branches.AsNoTracking();
        if (HasBranchScope) branchQuery = ActorBranchId is Guid ownBranch ? branchQuery.Where(x => x.Id == ownBranch) : branchQuery.Where(_ => false);
        if (branchId.HasValue) branchQuery = branchQuery.Where(x => x.Id == branchId.Value);
        var branches = await branchQuery.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var allowedBranchIds = branches.Select(x => x.Id).ToHashSet();
        var cashIn = new Dictionary<Guid, decimal>();
        var cashOut = new Dictionary<Guid, decimal>();
        void Add(Dictionary<Guid, decimal> target, Guid? id, decimal amount)
        {
            if (id is Guid value && allowedBranchIds.Contains(value)) target[value] = target.GetValueOrDefault(value) + amount;
        }

        var posReceipts = await db.PaymentTransactions.AsNoTracking()
            .Where(x => x.Status == PaymentTransactionStatuses.Paid && x.PaidAt >= start && x.PaidAt < end && x.Order!.BranchId.HasValue)
            .Select(x => new { x.Order!.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var item in posReceipts) Add(cashIn, item.BranchId, item.Amount);

        var customerReceipts = await db.CustomerPayments.AsNoTracking()
            .Where(x => x.Status == "CLEARED" && x.PaymentDate >= start && x.PaymentDate < end && x.BranchId.HasValue)
            .Select(x => new { x.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var item in customerReceipts) Add(cashIn, item.BranchId, item.Amount);

        var accountantReceipts = await db.AccountantPayments.AsNoTracking()
            .Where(x => x.Status == "CLEARED" && x.InvoiceId.HasValue && x.PaymentDate >= start && x.PaymentDate < end && x.Invoice!.Order!.BranchId.HasValue)
            .Select(x => new { x.Invoice!.Order!.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var item in accountantReceipts) Add(cashIn, item.BranchId, item.Amount);

        var supplierReceipts = await db.SupplierPayments.AsNoTracking()
            .Where(x => x.Status == "CLEARED" && x.PaymentDate >= start && x.PaymentDate < end && x.BranchId.HasValue)
            .Select(x => new { x.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var item in supplierReceipts) Add(cashOut, item.BranchId, item.Amount);

        var accountantPayments = await db.AccountantPayments.AsNoTracking()
            .Where(x => x.Status == "CLEARED" && x.SupplierInvoiceId.HasValue && x.PaymentDate >= start && x.PaymentDate < end)
            .Select(x => new { BranchId = x.SupplierInvoice!.BranchId ?? x.SupplierInvoice.PurchaseOrder!.BranchId, x.Amount })
            .ToListAsync(ct);
        foreach (var item in accountantPayments) Add(cashOut, item.BranchId, item.Amount);

        var expenses = await db.BusinessExpenses.AsNoTracking()
            .Where(x => x.ExpenseDate >= start && x.ExpenseDate < end && x.BranchId.HasValue)
            .Select(x => new { x.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var item in expenses) Add(cashOut, item.BranchId, item.Amount);

        var refunds = await db.SaleReturns.AsNoTracking()
            .Where(x => x.Status == "APPROVED" && x.ReturnDate >= start && x.ReturnDate < end && x.BranchId != Guid.Empty)
            .Select(x => new { BranchId = (Guid?)x.BranchId, x.CashRefundAmount }).ToListAsync(ct);
        foreach (var item in refunds) Add(cashOut, item.BranchId, item.CashRefundAmount);

        var sales = await db.Orders.AsNoTracking()
            .Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed && x.BranchId.HasValue)
            .GroupBy(x => x.BranchId!.Value).Select(g => new { BranchId = g.Key, Revenue = g.Sum(x => x.Total), Orders = g.Count() }).ToListAsync(ct);
        var purchases = await db.PurchaseOrders.AsNoTracking().Include(x => x.Items)
            .Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Items.Any(item => item.QuantityReceived > 0))
            .Select(x => new { x.BranchId, Amount = x.Items.Sum(item => item.QuantityReceived * item.UnitCost) }).ToListAsync(ct);
        var salesByBranch = sales.ToDictionary(x => x.BranchId);
        var purchasesByBranch = purchases.GroupBy(x => x.BranchId).ToDictionary(x => x.Key, x => x.Sum(row => row.Amount));

        return Ok(branches.Select(branch =>
        {
            var sale = salesByBranch.GetValueOrDefault(branch.Id);
            var received = cashIn.GetValueOrDefault(branch.Id);
            var paid = cashOut.GetValueOrDefault(branch.Id);
            return new { branchId = branch.Id, branchName = branch.Name, orders = sale?.Orders ?? 0, sales = sale?.Revenue ?? 0m, purchases = purchasesByBranch.GetValueOrDefault(branch.Id), cashIn = received, cashOut = paid, netCashFlow = received - paid };
        }).ToList());
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products(string? search, Guid? branchId, CancellationToken ct)
    {
        if (!CanView) return Forbid();
        var query = db.Products.AsNoTracking().Include(x => x.Medicine).ThenInclude(x => x!.Category).Include(x => x.Medicine).ThenInclude(x => x!.Manufacturer).Include(x => x.Brand).Include(x => x.Units).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Name.Contains(search) || x.Sku.Contains(search) || (x.Barcode != null && x.Barcode.Contains(search)) || (x.SearchKeywords != null && x.SearchKeywords.Contains(search)) || (x.Medicine!.GenericName != null && x.Medicine.GenericName.Contains(search)) || (x.Medicine!.Strength != null && x.Medicine.Strength.Contains(search)) || (x.Medicine!.DosageForm != null && x.Medicine.DosageForm.Contains(search)) || (x.Medicine!.Manufacturer != null && x.Medicine.Manufacturer.Name.Contains(search)) || x.Brand!.Name.Contains(search));
        if (IsSalesExecutive)
        {
            var staffId = ActorId;
            query = query.Where(product => db.SalesExecutiveProductAssignments.Any(assignment => assignment.SalesExecutiveUserId == staffId && assignment.IsActive &&
                ((assignment.ProductId.HasValue && assignment.ProductId.Value == product.Id) ||
                 (assignment.CategoryId.HasValue && product.Medicine != null && product.Medicine.CategoryId == assignment.CategoryId.Value))));
        }
        var rows = await query.Where(x => x.IsActive).OrderBy(x => x.Name).Take(100).ToListAsync(ct);
        if (HasBranchScope && branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var stockQuery = db.Inventory.AsNoTracking();
        if (branchId.HasValue) stockQuery = stockQuery.Where(x => x.BranchId == branchId.Value);
        else if (HasBranchScope && ActorBranchId is Guid scopedBranch) stockQuery = stockQuery.Where(x => x.BranchId == scopedBranch);
        else if (HasBranchScope) stockQuery = stockQuery.Where(_ => false);
        var stock = await stockQuery.ToListAsync(ct);
        var stockDate = ApplicationTime.NepalNow.Date;
        var branchNames = await db.Branches.AsNoTracking().Where(x => x.IsActive).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var invoiceTaxRate = await db.TaxConfigurations.AsNoTracking().Where(x => x.IsActive).OrderByDescending(x => x.EffectiveFrom).Select(x => (decimal?)x.VatRate).FirstOrDefaultAsync(ct) ?? 13m;
        return Ok(rows.Select(x =>
        {
            var productBatches = stock.Where(s => s.ProductId == x.Id).ToList();
            var sellableBatches = productBatches.Where(s => AvailableForSale(s, stockDate) > 0).OrderBy(s => s.ExpiryDate ?? DateTime.MaxValue).ThenBy(s => s.CreatedAt).ToList();
            return new
            {
                id = x.Id, name = x.Name, sku = x.Sku, barcode = x.Barcode, category = x.Medicine?.Category?.Name, brand = x.Brand?.Name,
                genericName = x.Medicine?.GenericName, manufacturer = x.Medicine?.Manufacturer?.Name, manufacturerId = x.Medicine?.ManufacturerId, strength = x.Medicine?.Strength, dosageForm = x.Medicine?.DosageForm,
                mrp = x.Mrp, salePrice = x.SellingPrice, purchasePrice = CanInventoryValuation ? productBatches.OrderBy(s => s.ExpiryDate ?? DateTime.MaxValue).Select(s => (decimal?)s.PurchasePrice).FirstOrDefault() : null,
                stock = sellableBatches.Sum(s => AvailableForSale(s, stockDate)), discountPercent = x.DiscountPercent,
                invoiceTaxRate, batches = sellableBatches.Select(s => new { inventoryId = s.Id, batchNumber = s.BatchNumber, branchId = s.BranchId, branch = branchNames.GetValueOrDefault(s.BranchId), availableQuantity = AvailableForSale(s, stockDate), reservedQuantity = s.ReservedQuantity, mrp = s.Mrp ?? x.Mrp, sellingPrice = x.SellingPrice, expiryDate = s.ExpiryDate }),
                bonusScheme = x.BonusScheme, taxRate = x.TaxRate, baseUnit = x.BaseUnit, purchaseUnit = x.PurchaseUnit, salesUnit = x.SalesUnit, purchaseUnitToBase = x.PurchaseUnitToBase, salesUnitToBase = x.SalesUnitToBase, units = x.Units.OrderBy(u => u.DisplayOrder).Select(u => new { name = u.UnitName, multiplierToBase = u.MultiplierToBase, isPurchaseUnit = u.IsPurchaseUnit, isSalesUnit = u.IsSalesUnit })
            };
        }).ToList());
    }

    [HttpGet("products/{id:guid}/history")]
    public async Task<IActionResult> ProductHistory(Guid id, Guid? branchId, CancellationToken ct)
    {
        if (!CanView) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();

        var movementsQuery = db.StockTransactions.AsNoTracking()
            .Include(x => x.Inventory).ThenInclude(x => x!.Product)
            .Where(x => x.Inventory != null && x.Inventory.ProductId == id &&
                (x.Type == StockTransactionTypes.Sale || x.Type == StockTransactionTypes.SalesReturn));
        if (HasBranchScope && ActorBranchId is Guid scopedBranch)
            movementsQuery = movementsQuery.Where(x => x.Inventory!.BranchId == scopedBranch);
        else if (HasBranchScope)
            movementsQuery = movementsQuery.Where(_ => false);
        if (branchId.HasValue)
            movementsQuery = movementsQuery.Where(x => x.Inventory!.BranchId == branchId.Value);

        var movements = await movementsQuery.OrderByDescending(x => x.CreatedAt).Take(300).ToListAsync(ct);
        var orderIds = movements.Where(x => x.Type == StockTransactionTypes.Sale)
            .Select(x => Guid.TryParse(x.ReferenceId, out var referenceId) ? referenceId : Guid.Empty)
            .Where(x => x != Guid.Empty).Distinct().ToList();
        var returnIds = movements.Where(x => x.Type == StockTransactionTypes.SalesReturn && x.ReferenceType == "SALES_RETURN")
            .Select(x => Guid.TryParse(x.ReferenceId, out var referenceId) ? referenceId : Guid.Empty)
            .Where(x => x != Guid.Empty).Distinct().ToList();

        var orders = orderIds.Count == 0 ? [] : await ScopeOrders(db.Orders.AsNoTracking()
            .Include(x => x.Invoice).Include(x => x.Items))
            .Where(x => orderIds.Contains(x.Id)).ToListAsync(ct);
        var orderById = orders.ToDictionary(x => x.Id);
        var returns = returnIds.Count == 0 ? [] : await db.SaleReturns.AsNoTracking()
            .Include(x => x.Items)
            .Where(x => returnIds.Contains(x.Id) && (!HasBranchScope || x.BranchId == ActorBranchId) &&
                (!branchId.HasValue || x.BranchId == branchId.Value))
            .ToListAsync(ct);
        var returnById = returns.ToDictionary(x => x.Id);

        var history = new List<ProductHistoryRow>();
        foreach (var movement in movements)
        {
            var stock = movement.Inventory!;
            if (movement.Type == StockTransactionTypes.Sale && Guid.TryParse(movement.ReferenceId, out var orderId) && orderById.TryGetValue(orderId, out var order))
            {
                var line = order.Items.FirstOrDefault(x => x.ProductId == id);
                var rate = stock.Product?.SellingPrice ?? line?.UnitPrice ?? 0m;
                var discount = rate > 0m && line is not null ? Math.Clamp(Math.Round((rate - line.UnitPrice) / rate * 100m, 2), 0m, 100m) : 0m;
                history.Add(new ProductHistoryRow(movement.Id, movement.CreatedAt, order.Invoice?.InvoiceNumber ?? order.OrderNumber,
                    stock.BatchNumber, stock.ExpiryDate, Math.Abs(movement.Quantity), line?.BonusQuantity ?? 0, rate,
                    stock.Mrp ?? stock.Product?.Mrp ?? 0m, discount, "Sales"));
            }
            else if (movement.Type == StockTransactionTypes.SalesReturn && movement.ReferenceType == "SALES_RETURN" &&
                Guid.TryParse(movement.ReferenceId, out var returnId) && returnById.TryGetValue(returnId, out var saleReturn))
            {
                var line = saleReturn.Items.FirstOrDefault(x => x.ProductId == id && x.BatchNumber == stock.BatchNumber);
                history.Add(new ProductHistoryRow(movement.Id, movement.CreatedAt, saleReturn.ReturnNumber,
                    stock.BatchNumber, stock.ExpiryDate, Math.Abs(movement.Quantity), 0, line?.UnitPrice ?? 0m,
                    stock.Mrp ?? stock.Product?.Mrp ?? 0m, 0m, "Return"));
            }
        }

        return Ok(history.OrderByDescending(x => x.Date));
    }

    [HttpGet("customers")]
    public async Task<IActionResult> Customers(string? search, CancellationToken ct)
    {
        if (!CanSell && !CanLedger) return Forbid();
        var query = db.Customers.AsNoTracking().Where(x => x.IsActive);
        if (HasBranchScope && ActorBranchId is Guid branchId)
            query = query.Where(x => db.Orders.Any(o => o.CustomerId == x.Id && o.BranchId == branchId) || db.CustomerPayments.Any(p => p.CustomerId == x.Id && p.BranchId == branchId));
        else if (HasBranchScope) query = query.Where(_ => false);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.FullName.Contains(search) || x.Email.Contains(search) || x.Phone.Contains(search));
        return Ok(await query.OrderBy(x => x.FullName).Take(100).Select(x => new { id = x.Id, name = x.FullName, email = x.Email, phone = x.Phone, accountType = x.AccountType, address = x.PharmacyDetails != null ? x.PharmacyDetails.Address : null, panNumber = x.PharmacyDetails != null && x.PharmacyDetails.PanNumber != "" ? x.PharmacyDetails.PanNumber : x.TaxNumber, telephone = x.PharmacyDetails != null && x.PharmacyDetails.Telephone != null ? x.PharmacyDetails.Telephone : x.Phone }).ToListAsync(ct));
    }

    [HttpGet("suppliers")]
    public async Task<IActionResult> Suppliers(string? search, CancellationToken ct)
    {
        if (!CanPurchase && !CanLedger) return Forbid();
        var query = db.Suppliers.AsNoTracking().Where(x => x.IsActive);
        if (HasBranchScope && ActorBranchId is Guid branchId)
            query = query.Where(x => db.PurchaseOrders.Any(p => p.SupplierId == x.Id && p.BranchId == branchId) || db.SupplierInvoices.Any(i => i.SupplierId == x.Id && (i.BranchId == branchId || i.BranchId == null && i.PurchaseOrder != null && i.PurchaseOrder.BranchId == branchId)) || db.SupplierPayments.Any(p => p.SupplierId == x.Id && p.BranchId == branchId));
        else if (HasBranchScope) query = query.Where(_ => false);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Name.Contains(search) || (x.Phone != null && x.Phone.Contains(search)) || (x.Email != null && x.Email.Contains(search)));
        return Ok(await query.OrderBy(x => x.Name).Take(100).Select(x => new { id = x.Id, name = x.Name, phone = x.Phone, email = x.Email }).ToListAsync(ct));
    }

    [HttpGet("sales")]
    public async Task<IActionResult> Sales(DateTime? from, DateTime? to, Guid? branchId, string? paymentStatus, string? paymentMethod, Guid? customerId, Guid? productId, string? search, CancellationToken ct)
    {
        if (!CanView) return Forbid();
        var (start, end) = Range(from, to);
        var query = ScopeOrders(db.Orders.AsNoTracking().Include(x => x.Customer).ThenInclude(x => x!.PartySector).Include(x => x.Branch).Include(x => x.Address).Include(x => x.Invoice).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Manufacturer).Where(x => x.CreatedAt >= start && x.CreatedAt < end));
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        if (!string.IsNullOrWhiteSpace(paymentStatus)) query = query.Where(x => x.PaymentStatus == paymentStatus);
        if (!string.IsNullOrWhiteSpace(paymentMethod)) query = query.Where(x => x.PaymentMethod == paymentMethod.ToUpperInvariant());
        if (customerId.HasValue) query = query.Where(x => x.CustomerId == customerId.Value);
        if (productId.HasValue) query = query.Where(x => x.Items.Any(i => i.ProductId == productId.Value));
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(x => x.OrderNumber.Contains(search, StringComparison.OrdinalIgnoreCase) || (x.Customer?.FullName?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false) || x.Items.Any(i => i.ProductName.Contains(search, StringComparison.OrdinalIgnoreCase))).ToList();
        var invoiceIds = rows.Where(x => x.Invoice != null).Select(x => x.Invoice!.Id.ToString()).ToList();
        var saleActors = await db.ActivityLogs.AsNoTracking().Where(x => x.Action == "POS_SALE_CREATED" && invoiceIds.Contains(x.EntityId) && x.ActorId.HasValue).Select(x => new { x.EntityId, x.ActorId }).ToListAsync(ct);
        var actorIds = saleActors.Select(x => x.ActorId!.Value).Distinct().ToList();
        var actorNames = await db.StaffUsers.AsNoTracking().Where(x => actorIds.Contains(x.Id)).Select(x => new { x.Id, x.FullName }).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var salesPersonByInvoice = saleActors.Where(x => x.ActorId.HasValue && actorNames.ContainsKey(x.ActorId.Value)).GroupBy(x => x.EntityId).ToDictionary(x => x.Key, x => actorNames[x.First().ActorId!.Value]);
        return Ok(rows.Select(x => new { id = x.Id, number = x.OrderNumber, invoiceNumber = x.Invoice?.InvoiceNumber, referenceCode = ExtractReferenceCode(x.Invoice?.Notes), customerId = x.CustomerId, customer = x.Customer?.FullName ?? "Walk-in", customerPhone = x.Customer?.Phone, walkIn = x.Customer?.Email.EndsWith("@local.invalid", StringComparison.OrdinalIgnoreCase) ?? false, accountType = x.Customer?.AccountType, partySector = x.Customer?.PartySector?.Name, panNumber = x.Customer?.TaxNumber, province = x.Address?.Province, district = x.Address?.District, municipality = x.Address?.Municipality, insuranceProvider = x.InsuranceProvider, insurancePolicyNumber = x.InsurancePolicyNumber, salesPerson = x.Invoice != null && salesPersonByInvoice.TryGetValue(x.Invoice.Id.ToString(), out var staffName) ? staffName : null, date = x.CreatedAt, branchId = x.BranchId, branch = x.Branch?.Name, status = x.Status, paymentStatus = x.PaymentStatus, paymentMethod = x.PaymentMethod, total = x.Total, subtotal = x.Invoice?.Subtotal, taxAmount = x.Invoice?.TaxAmount, discountAmount = x.Invoice?.DiscountAmount, paidAmount = x.Invoice?.PaidAmount, items = x.Items.Select(i => new { productId = i.ProductId, product = i.ProductName, category = i.Product?.Medicine?.Category?.Name, manufacturer = i.Product?.Medicine?.Manufacturer?.Name, quantity = i.Quantity, bonusQuantity = i.BonusQuantity, unit = i.Unit, unitPrice = i.UnitPrice }) }));
    }

    [HttpGet("sales/invoice")]
    public async Task<IActionResult> SalesInvoiceLookup(string? invoiceNumber, CancellationToken ct)
    {
        if (!CanView) return Forbid();
        var number = invoiceNumber?.Trim();
        if (string.IsNullOrWhiteSpace(number)) return BadRequest(new { message = "Enter an invoice number." });
        var query = ScopeOrders(db.Orders.AsNoTracking()
            .Include(x => x.Customer).ThenInclude(x => x!.PartySector)
            .Include(x => x.Branch).Include(x => x.Address).Include(x => x.Invoice)
            .Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category)
            .Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Manufacturer));
        var order = await query.FirstOrDefaultAsync(x => x.OrderNumber == number || (x.Invoice != null && x.Invoice.InvoiceNumber == number), ct);
        if (order == null) return NotFound(new { message = "No accessible saved invoice was found with that number." });
        return Ok(new
        {
            id = order.Id, number = order.OrderNumber, invoiceNumber = order.Invoice?.InvoiceNumber, referenceCode = ExtractReferenceCode(order.Invoice?.Notes),
            customerId = order.CustomerId, customer = order.Customer?.FullName ?? "Walk-in", customerPhone = order.Customer?.Phone,
            walkIn = order.Customer?.Email.EndsWith("@local.invalid", StringComparison.OrdinalIgnoreCase) ?? false,
            accountType = order.Customer?.AccountType, partySector = order.Customer?.PartySector?.Name,
            panNumber = order.Customer?.TaxNumber, province = order.Address?.Province, district = order.Address?.District,
            municipality = order.Address?.Municipality, insuranceProvider = order.InsuranceProvider,
            insurancePolicyNumber = order.InsurancePolicyNumber, salesPerson = (string?)null,
            date = order.CreatedAt, branchId = order.BranchId, branch = order.Branch?.Name, status = order.Status,
            paymentStatus = order.PaymentStatus, paymentMethod = order.PaymentMethod, total = order.Total,
            subtotal = order.Invoice?.Subtotal, taxAmount = order.Invoice?.TaxAmount,
            discountAmount = order.Invoice?.DiscountAmount, paidAmount = order.Invoice?.PaidAmount,
            items = order.Items.Select(i => new { productId = i.ProductId, product = i.ProductName,
                category = i.Product?.Medicine?.Category?.Name, manufacturer = i.Product?.Medicine?.Manufacturer?.Name,
                quantity = i.Quantity, bonusQuantity = i.BonusQuantity, unit = i.Unit, unitPrice = i.UnitPrice })
        });
    }

    [HttpGet("purchases")]
    public async Task<IActionResult> Purchases(DateTime? from, DateTime? to, Guid? branchId, Guid? supplierId, Guid? productId, string? paymentMethod, string? paymentStatus, string? search, CancellationToken ct)
    {
        if (!CanPurchase) return Forbid();
        var (start, end) = Range(from, to);
        var query = db.PurchaseOrders.AsNoTracking().Include(x => x.Supplier).Include(x => x.Branch).Include(x => x.Items).Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Items.Any(item => item.QuantityReceived > 0));
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) query = query.Where(x => x.BranchId == scopedBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        if (supplierId.HasValue) query = query.Where(x => x.SupplierId == supplierId.Value);
        if (productId.HasValue) query = query.Where(x => x.Items.Any(i => i.ProductId == productId.Value));
        if (!string.IsNullOrWhiteSpace(paymentStatus)) query = query.Where(x => x.PaymentStatus == paymentStatus.ToUpperInvariant());
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(x => x.OrderNumber.Contains(search, StringComparison.OrdinalIgnoreCase) || (x.Supplier?.Name?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false) || x.Items.Any(i => i.ProductName.Contains(search, StringComparison.OrdinalIgnoreCase))).ToList();
        if (!string.IsNullOrWhiteSpace(paymentMethod)) rows = rows.Where(x => x.PaymentMethod.Equals(paymentMethod, StringComparison.OrdinalIgnoreCase)).ToList();
        var purchaseIds = rows.Select(x => x.Id).ToList();
        var supplierInvoices = await db.SupplierInvoices.AsNoTracking().Where(x => x.PurchaseOrderId.HasValue && purchaseIds.Contains(x.PurchaseOrderId.Value) && x.Status != "VOID").OrderByDescending(x => x.InvoiceDate).ToListAsync(ct);
        var invoiceByPurchase = supplierInvoices.GroupBy(x => x.PurchaseOrderId!.Value).ToDictionary(x => x.Key, x => x.First());
        return Ok(rows.Select(x => new { id = x.Id, number = x.OrderNumber, supplierId = x.SupplierId, supplier = x.Supplier?.Name, supplierInvoiceNumber = invoiceByPurchase.GetValueOrDefault(x.Id)?.InvoiceNumber, notes = x.Notes, date = x.CreatedAt, branchId = x.BranchId, branch = x.Branch?.Name, status = x.Status, paymentMethod = x.PaymentMethod, paymentStatus = x.PaymentStatus, total = CanInventoryValuation ? x.Items.Sum(i => i.QuantityReceived * i.UnitCost) : (decimal?)null, items = x.Items.Where(i => i.QuantityReceived > 0).Select(i => new { productId = i.ProductId, product = i.ProductName, quantity = i.QuantityReceived, unitCost = CanInventoryValuation ? i.UnitCost : (decimal?)null, unit = i.Unit, unitMultiplier = i.UnitMultiplier, batch = i.BatchNumber, expiry = i.ExpiryDate }) }));
    }

    [HttpGet("sales-returns")]
    public async Task<IActionResult> SalesReturns(DateTime? from, DateTime? to, Guid? branchId, Guid? customerId, string? search, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        var (start, end) = Range(from, to);
        var scopedOrderIds = await ScopeOrders(db.Orders.AsNoTracking()).Select(x => x.Id).ToListAsync(ct);
        var query = db.SaleReturns.AsNoTracking().Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).Where(x => x.ReturnDate >= start && x.ReturnDate < end && x.OrderId.HasValue && scopedOrderIds.Contains(x.OrderId.Value));
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        if (customerId.HasValue) query = query.Where(x => x.CustomerId == customerId.Value);
        var rows = await query.OrderByDescending(x => x.ReturnDate).Take(500).ToListAsync(ct);
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(x => x.ReturnNumber.Contains(search, StringComparison.OrdinalIgnoreCase) || (x.Customer?.FullName?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false) || x.Items.Any(i => i.Product?.Name?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        return Ok(rows.Select(x => new { id = x.Id, number = x.ReturnNumber, orderId = x.OrderId, customer = x.Customer?.FullName ?? "Walk-in", branch = x.Branch?.Name, date = x.ReturnDate, status = x.Status, returnType = x.ReturnType, amount = x.TotalAmount, reason = x.Reason, items = x.Items.Select(i => new { productId = i.ProductId, product = i.Product?.Name, quantity = i.Quantity, unitPrice = i.UnitPrice, batch = i.BatchNumber }) }));
    }

    [HttpGet("sales-returns/lookup")]
    public async Task<IActionResult> SalesReturnLookup(string? number, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        var returnNumber = number?.Trim();
        if (string.IsNullOrWhiteSpace(returnNumber)) return BadRequest(new { message = "Enter a credit note number." });
        var scopedOrderIds = await ScopeOrders(db.Orders.AsNoTracking()).Select(x => x.Id).ToListAsync(ct);
        var item = await db.SaleReturns.AsNoTracking().Include(x => x.Customer).Include(x => x.Branch)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(x => x.ReturnNumber == returnNumber && x.OrderId.HasValue && scopedOrderIds.Contains(x.OrderId.Value), ct);
        if (item == null) return NotFound(new { message = "No accessible saved credit note was found with that number." });
        return Ok(new { id = item.Id, number = item.ReturnNumber, orderId = item.OrderId,
            customer = item.Customer?.FullName ?? "Walk-in", branch = item.Branch?.Name,
            date = item.ReturnDate, status = item.Status, returnType = item.ReturnType,
            amount = item.TotalAmount, reason = item.Reason,
            items = item.Items.Select(i => new { productId = i.ProductId, product = i.Product?.Name,
                quantity = i.Quantity, unitPrice = i.UnitPrice, batch = i.BatchNumber }) });
    }

    [HttpGet("sales-reports/user-cash-summary")]
    public async Task<IActionResult> UserCashSummary(DateTime? from, DateTime? to, Guid? branchId, bool includeCard = true, CancellationToken ct = default)
    {
        if (!CanView || IsSalesExecutive) return Forbid();
        var (start, end) = Range(from, to);
        var ordersQuery = db.Orders.AsNoTracking().Include(x => x.Invoice).Include(x => x.PaymentTransactions)
            .Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed);
        if (HasBranchScope && ActorBranchId is Guid ownBranch) ordersQuery = ordersQuery.Where(x => x.BranchId == ownBranch);
        else if (HasBranchScope) ordersQuery = ordersQuery.Where(_ => false);
        if (branchId.HasValue) ordersQuery = ordersQuery.Where(x => x.BranchId == branchId.Value);
        var orders = await ordersQuery.ToListAsync(ct);
        var invoiceIds = orders.Where(x => x.Invoice != null).Select(x => x.Invoice!.Id.ToString()).ToList();
        var saleActors = await db.ActivityLogs.AsNoTracking().Where(x => x.Action == "POS_SALE_CREATED" && invoiceIds.Contains(x.EntityId) && x.ActorId.HasValue)
            .Select(x => new { x.EntityId, x.ActorId }).ToListAsync(ct);
        var actorIds = saleActors.Select(x => x.ActorId!.Value).Distinct().ToList();
        var actorNames = await db.StaffUsers.AsNoTracking().Where(x => actorIds.Contains(x.Id))
            .Select(x => new { x.Id, x.FullName }).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var actorByInvoice = saleActors.Where(x => actorNames.ContainsKey(x.ActorId!.Value))
            .GroupBy(x => x.EntityId).ToDictionary(x => x.Key, x => actorNames[x.First().ActorId!.Value]);
        var totals = new Dictionary<string, UserCashSummaryAccumulator>(StringComparer.OrdinalIgnoreCase);
        UserCashSummaryAccumulator For(string name)
        {
            if (!totals.TryGetValue(name, out var value)) totals[name] = value = new UserCashSummaryAccumulator();
            return value;
        }
        string SaleOwner(PharmacyOrder order) => order.Invoice != null && actorByInvoice.TryGetValue(order.Invoice.Id.ToString(), out var name) ? name : "Not recorded";
        foreach (var order in orders)
        {
            var row = For(SaleOwner(order));
            row.Sales += order.Invoice?.Total ?? order.Total;
            row.Return += 0m;
            foreach (var payment in order.PaymentTransactions.Where(x => x.Status == PaymentTransactionStatuses.Paid))
            {
                if (payment.Method.Equals("CASH", StringComparison.OrdinalIgnoreCase) || payment.Method.Equals("PARTIAL", StringComparison.OrdinalIgnoreCase)) row.CashReceive += payment.Amount;
                if (payment.Method.Contains("CARD", StringComparison.OrdinalIgnoreCase) && includeCard) row.Card += payment.Amount;
            }
        }
        var returnQuery = db.SaleReturns.AsNoTracking().Where(x => x.ReturnDate >= start && x.ReturnDate < end && x.Status == "APPROVED");
        if (HasBranchScope && ActorBranchId is Guid returnBranch) returnQuery = returnQuery.Where(x => x.BranchId == returnBranch);
        else if (HasBranchScope) returnQuery = returnQuery.Where(_ => false);
        if (branchId.HasValue) returnQuery = returnQuery.Where(x => x.BranchId == branchId.Value);
        var returns = await returnQuery.ToListAsync(ct);
        var returnIds = returns.Select(x => x.Id.ToString()).ToList();
        var returnActors = await db.ActivityLogs.AsNoTracking().Where(x => x.Action == "SALES_RETURN_APPROVED" && returnIds.Contains(x.EntityId) && x.ActorId.HasValue)
            .Select(x => new { x.EntityId, x.ActorId }).ToListAsync(ct);
        var returnActorIds = returnActors.Select(x => x.ActorId!.Value).Distinct().ToList();
        var returnActorNames = await db.StaffUsers.AsNoTracking().Where(x => returnActorIds.Contains(x.Id))
            .Select(x => new { x.Id, x.FullName }).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var returnOwnerById = returnActors.Where(x => returnActorNames.ContainsKey(x.ActorId!.Value))
            .GroupBy(x => x.EntityId).ToDictionary(x => x.Key, x => returnActorNames[x.First().ActorId!.Value]);
        foreach (var item in returns) For(returnOwnerById.GetValueOrDefault(item.Id.ToString(), "Not recorded")).Return += item.TotalAmount;

        var paymentRows = await db.CustomerPayments.AsNoTracking().Where(x => x.PaymentDate >= start && x.PaymentDate < end && x.Status == "CLEARED"
                && (!branchId.HasValue || x.BranchId == branchId.Value)
                && (!HasBranchScope || ActorBranchId.HasValue && x.BranchId == ActorBranchId.Value))
            .Select(x => new { x.Id, x.Amount, x.Method }).ToListAsync(ct);
        var paymentIds = paymentRows.Select(x => x.Id.ToString()).ToList();
        var paymentActors = await db.ActivityLogs.AsNoTracking().Where(x => x.Action == "CUSTOMER_PAYMENT_RECORDED" && paymentIds.Contains(x.EntityId) && x.ActorId.HasValue)
            .Select(x => new { x.EntityId, x.ActorId }).ToListAsync(ct);
        var paymentActorIds = paymentActors.Select(x => x.ActorId!.Value).Distinct().ToList();
        var paymentActorNames = await db.StaffUsers.AsNoTracking().Where(x => paymentActorIds.Contains(x.Id))
            .Select(x => new { x.Id, x.FullName }).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var paymentOwnerById = paymentActors.Where(x => paymentActorNames.ContainsKey(x.ActorId!.Value))
            .GroupBy(x => x.EntityId).ToDictionary(x => x.Key, x => paymentActorNames[x.First().ActorId!.Value]);
        foreach (var payment in paymentRows)
        {
            var row = For(paymentOwnerById.GetValueOrDefault(payment.Id.ToString(), "Not recorded"));
            if (payment.Method.Equals("CASH", StringComparison.OrdinalIgnoreCase)) row.Receipt += payment.Amount;
            if (payment.Method.Contains("CARD", StringComparison.OrdinalIgnoreCase) && includeCard) row.Card += payment.Amount;
        }
        var handoversQuery = db.CashHandovers.AsNoTracking().Include(x => x.HandedByStaffUser)
            .Where(x => x.HandoverAt >= start && x.HandoverAt < end && x.Status == "POSTED");
        if (HasBranchScope && ActorBranchId is Guid handoverBranch) handoversQuery = handoversQuery.Where(x => x.BranchId == handoverBranch);
        else if (HasBranchScope) handoversQuery = handoversQuery.Where(_ => false);
        if (branchId.HasValue) handoversQuery = handoversQuery.Where(x => x.BranchId == branchId.Value);
        foreach (var handover in await handoversQuery.ToListAsync(ct)) For(handover.HandedByStaffUser?.FullName ?? "Not recorded").HandOver += handover.Amount;

        return Ok(totals.OrderBy(x => x.Key).Select(x => new
        {
            userName = x.Key, cashReceive = x.Value.CashReceive, sales = x.Value.Sales, receipt = x.Value.Receipt,
            card = includeCard ? x.Value.Card : (decimal?)null, opdCopy = (decimal?)null, drNote = (decimal?)null,
            cashIn = (decimal?)null, @return = x.Value.Return, cashOld = (decimal?)null, crNote = (decimal?)null,
            purch = (decimal?)null, net = x.Value.Sales - x.Value.Return, handOver = x.Value.HandOver,
        }));
    }

    [HttpGet("sales-reports/change-in-debtors")]
    public async Task<IActionResult> ChangeInDebtors(DateTime? from, DateTime? to, Guid? branchId, CancellationToken ct)
    {
        if (!CanLedger || IsSalesExecutive) return Forbid();
        var (start, end) = Range(from, to);
        var query = db.CustomerLedgerEntries.AsNoTracking().Include(x => x.Invoice).ThenInclude(x => x!.Order)
            .Where(x => x.EntryDate < end);
        if (HasBranchScope && ActorBranchId is Guid ownBranch) query = query.Where(x => x.Invoice != null && x.Invoice.Order != null && x.Invoice.Order.BranchId == ownBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.Invoice != null && x.Invoice.Order != null && x.Invoice.Order.BranchId == branchId.Value);
        var opening = await query.Where(x => x.EntryDate < start)
            .SumAsync(x => x.EntryType == "DEBIT" ? x.Amount : -x.Amount, ct);
        var entries = await query.Where(x => x.EntryDate >= start)
            .Select(x => new { x.EntryDate, x.EntryType, x.Amount }).ToListAsync(ct);
        var daily = entries.GroupBy(x => x.EntryDate.Date)
            .ToDictionary(group => group.Key, group => group.Sum(x => x.EntryType == "DEBIT" ? x.Amount : -x.Amount));
        var balance = opening;
        var reportRows = new List<object>();
        for (var day = start.Date; day < end.Date; day = day.AddDays(1))
        {
            var increase = daily.GetValueOrDefault(day);
            var openingForDay = balance;
            balance += increase;
            reportRows.Add(new { date = day, openingDebtor = openingForDay, closingDebtor = balance, increase });
        }
        return Ok(new { openingDebtor = opening, closingDebtor = balance, increase = balance - opening, total = balance - opening, rows = reportRows });
    }

    [HttpGet("purchases/change-in-supplier")]
    public async Task<IActionResult> ChangeInSupplier(DateTime? from, DateTime? to, Guid? branchId, CancellationToken ct)
    {
        if (!CanPurchase) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var (start, end) = Range(from, to);

        var invoiceQuery = db.SupplierInvoices.AsNoTracking().Include(x => x.PurchaseOrder)
            .Where(x => x.InvoiceDate < end && x.Status != "VOID");
        if (HasBranchScope && ActorBranchId is Guid ownBranch)
            invoiceQuery = invoiceQuery.Where(x => x.BranchId == ownBranch || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == ownBranch);
        else if (HasBranchScope) invoiceQuery = invoiceQuery.Where(_ => false);
        if (branchId.HasValue)
            invoiceQuery = invoiceQuery.Where(x => x.BranchId == branchId.Value || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == branchId.Value);
        var invoices = await invoiceQuery.ToListAsync(ct);

        // Purchase returns reduce the saved invoice total. Add them back here to
        // recover the original invoice amount, then post each return on its own date.
        var returnQuery = db.PurchaseReturns.AsNoTracking().Where(x => x.Status == "APPROVED");
        if (HasBranchScope && ActorBranchId is Guid returnBranch) returnQuery = returnQuery.Where(x => x.BranchId == returnBranch);
        else if (HasBranchScope) returnQuery = returnQuery.Where(_ => false);
        if (branchId.HasValue) returnQuery = returnQuery.Where(x => x.BranchId == branchId.Value);
        var activeInvoiceIds = invoices.Select(x => x.Id).ToHashSet();
        var activePurchaseOrderIds = invoices.Where(x => x.PurchaseOrderId.HasValue).Select(x => x.PurchaseOrderId!.Value).ToHashSet();
        var approvedReturns = (await returnQuery.ToListAsync(ct)).Where(x =>
            x.SupplierInvoiceId.HasValue ? activeInvoiceIds.Contains(x.SupplierInvoiceId.Value) :
            x.PurchaseOrderId.HasValue && activePurchaseOrderIds.Contains(x.PurchaseOrderId.Value)).ToList();

        var movements = new List<(DateTime Date, decimal Amount)>();
        foreach (var invoice in invoices)
        {
            var linkedReturns = approvedReturns.Where(x => x.SupplierInvoiceId == invoice.Id ||
                !x.SupplierInvoiceId.HasValue && invoice.PurchaseOrderId.HasValue && x.PurchaseOrderId == invoice.PurchaseOrderId.Value).ToList();
            var originalTotal = invoice.Total + linkedReturns.Sum(x => x.TotalAmount);
            movements.Add((invoice.InvoiceDate, originalTotal));
        }
        movements.AddRange(approvedReturns.Where(x => x.ReturnDate < end).Select(x => (x.ReturnDate, -x.TotalAmount)));

        var supplierPaymentQuery = db.SupplierPayments.AsNoTracking()
            .Where(x => x.Status == "CLEARED" && x.PaymentDate < end);
        if (HasBranchScope && ActorBranchId is Guid paymentBranch) supplierPaymentQuery = supplierPaymentQuery.Where(x => x.BranchId == paymentBranch);
        else if (HasBranchScope) supplierPaymentQuery = supplierPaymentQuery.Where(_ => false);
        if (branchId.HasValue) supplierPaymentQuery = supplierPaymentQuery.Where(x => x.BranchId == branchId.Value);
        var supplierPayments = await supplierPaymentQuery.Select(x => new { x.PaymentDate, x.Amount }).ToListAsync(ct);
        movements.AddRange(supplierPayments.Select(x => (x.PaymentDate, -x.Amount)));

        var accountantPaymentQuery = db.AccountantPayments.AsNoTracking()
            .Where(x => x.Status == "CLEARED" && x.SupplierInvoiceId.HasValue && x.PaymentDate < end && x.SupplierInvoice != null && x.SupplierInvoice.Status != "VOID");
        if (HasBranchScope && ActorBranchId is Guid accountantBranch)
            accountantPaymentQuery = accountantPaymentQuery.Where(x => x.SupplierInvoice!.BranchId == accountantBranch || x.SupplierInvoice.BranchId == null && x.SupplierInvoice.PurchaseOrder != null && x.SupplierInvoice.PurchaseOrder.BranchId == accountantBranch);
        else if (HasBranchScope) accountantPaymentQuery = accountantPaymentQuery.Where(_ => false);
        if (branchId.HasValue)
            accountantPaymentQuery = accountantPaymentQuery.Where(x => x.SupplierInvoice!.BranchId == branchId.Value || x.SupplierInvoice.BranchId == null && x.SupplierInvoice.PurchaseOrder != null && x.SupplierInvoice.PurchaseOrder.BranchId == branchId.Value);
        var accountantPayments = await accountantPaymentQuery.Select(x => new { x.PaymentDate, x.Amount }).ToListAsync(ct);
        movements.AddRange(accountantPayments.Select(x => (x.PaymentDate, -x.Amount)));

        var opening = movements.Where(x => x.Date < start).Sum(x => x.Amount);
        var daily = movements.Where(x => x.Date >= start && x.Date < end)
            .GroupBy(x => x.Date.Date)
            .ToDictionary(group => group.Key, group => group.Sum(x => x.Amount));
        var balance = opening;
        var reportRows = new List<object>();
        for (var day = start.Date; day < end.Date; day = day.AddDays(1))
        {
            var increase = daily.GetValueOrDefault(day);
            var openingForDay = balance;
            balance += increase;
            reportRows.Add(new { date = day, openingSupplier = openingForDay, closingSupplier = balance, increase });
        }
        return Ok(new { openingSupplier = opening, closingSupplier = balance, increase = balance - opening, total = balance - opening, rows = reportRows });
    }

    [HttpGet("purchase-returns")]
    public async Task<IActionResult> PurchaseReturns(DateTime? from, DateTime? to, Guid? branchId, Guid? supplierId, string? search, CancellationToken ct)
    {
        if (!CanPurchase) return Forbid();
        var (start, end) = Range(from, to);
        var query = db.PurchaseReturns.AsNoTracking().Include(x => x.Supplier).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).Where(x => x.ReturnDate >= start && x.ReturnDate < end);
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) query = query.Where(x => x.BranchId == scopedBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        if (supplierId.HasValue) query = query.Where(x => x.SupplierId == supplierId.Value);
        var rows = await query.OrderByDescending(x => x.ReturnDate).Take(500).ToListAsync(ct);
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(x => x.ReturnNumber.Contains(search, StringComparison.OrdinalIgnoreCase) || (x.Supplier?.Name?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false) || x.Items.Any(i => i.Product?.Name?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        return Ok(rows.Select(x => new { id = x.Id, number = x.ReturnNumber, supplier = x.Supplier?.Name, branch = x.Branch?.Name, date = x.ReturnDate, status = x.Status, amount = CanInventoryValuation ? x.TotalAmount : (decimal?)null, reason = x.Reason, items = x.Items.Select(i => new { productId = i.ProductId, product = i.Product?.Name, quantity = i.Quantity, unitCost = CanInventoryValuation ? i.UnitCost : (decimal?)null, batch = i.BatchNumber }) }));
    }

    [HttpGet("inventory")]
    public async Task<IActionResult> Inventory(Guid? branchId, string? filter, string? search, int? nearExpiryDays, CancellationToken ct)
    {
        if (!CanInventoryView) return Forbid();
        var today = ApplicationTime.NepalNow.Date;
        var days = Math.Clamp(nearExpiryDays ?? await NearExpiryDays(ct), 1, 365);
        var rows = await InventoryScope(branchId, search).OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.Product!.Name).Take(5000).ToListAsync(ct);
        var mapped = rows.Select(x => ToInventoryRow(x, today, days)).ToList();
        mapped = filter?.Trim().ToUpperInvariant() switch
        {
            "LOW" => mapped.Where(x => x.Status is "LOW_STOCK" or "OUT_OF_STOCK").ToList(),
            "OUT_OF_STOCK" => mapped.Where(x => x.Status == "OUT_OF_STOCK").ToList(),
            "NEAR_EXPIRY" => mapped.Where(x => x.Status == "NEAR_EXPIRY").ToList(),
            "EXPIRED" => mapped.Where(x => x.Status == "EXPIRED").ToList(),
            _ => mapped
        };
        var visibleIds = mapped.Select(x => x.Id).ToHashSet();
        return Ok(rows.Where(x => visibleIds.Contains(x.Id)).Select(x =>
        {
            var row = ToInventoryRow(x, today, days);
            return new { id = x.Id, productId = x.ProductId, product = row.Product, sku = row.ProductCode, category = row.Category, manufacturer = row.Manufacturer, storageLocation = row.StorageLocation, productActive = x.Product?.IsActive ?? false, batch = x.BatchNumber, branch = row.Branch, branchId = x.BranchId, stock = x.StockQuantity, reserved = x.ReservedQuantity, available = row.AvailableQuantity, bonusQuantity = x.BonusQuantity, minimumStock = x.MinimumStock, reorderLevel = row.ReorderLevel, maximumStock = row.MaximumStock, purchasePrice = CanInventoryValuation ? x.PurchasePrice : (decimal?)null, salePrice = row.SellingPrice, mrp = row.Mrp, expiry = x.ExpiryDate, status = row.Status, supplier = row.Supplier, supplierId = x.SupplierId };
        }));
    }

    [HttpGet("inventory/overview")]
    public async Task<IActionResult> InventoryOverview(Guid? branchId, string? filter, string? search, int? nearExpiryDays, int page = 1, int pageSize = 100, CancellationToken ct = default)
    {
        if (!CanInventoryView) return Forbid();
        var days = Math.Clamp(nearExpiryDays ?? await NearExpiryDays(ct), 1, 365);
        var today = ApplicationTime.NepalNow.Date;
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 25, 250);
        var query = InventoryScope(branchId, search);
        var normalizedFilter = filter?.Trim().ToUpperInvariant();
        var excludedBatch = query.Where(x => x.BatchStatus != "QUARANTINED" && x.BatchStatus != "RETURNED");
        query = normalizedFilter switch
        {
            "LOW" => excludedBatch.Where(x => x.BatchStatus != "EXPIRED" && x.BatchStatus != "DEPLETED" && (!x.ExpiryDate.HasValue || x.ExpiryDate.Value.Date >= today) && x.StockQuantity > x.ReservedQuantity && x.StockQuantity - x.ReservedQuantity <= (x.Product!.ReorderLevel > 0 ? x.Product.ReorderLevel : x.MinimumStock)),
            "OUT_OF_STOCK" => excludedBatch.Where(x => x.BatchStatus != "EXPIRED" && (!x.ExpiryDate.HasValue || x.ExpiryDate.Value.Date >= today) && (x.BatchStatus == "DEPLETED" || x.StockQuantity <= x.ReservedQuantity)),
            "NEAR_EXPIRY" => excludedBatch.Where(x => x.BatchStatus != "EXPIRED" && x.BatchStatus != "DEPLETED" && x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date >= today && x.ExpiryDate.Value.Date <= today.AddDays(days) && x.StockQuantity > x.ReservedQuantity),
            "EXPIRED" => excludedBatch.Where(x => x.BatchStatus == "EXPIRED" || x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date < today),
            _ => query
        };
        var activeProducts = await db.Products.AsNoTracking().CountAsync(x => x.IsActive, ct);
        var allInventory = db.Inventory.AsNoTracking().AsQueryable();
        if (HasBranchScope && ActorBranchId is Guid summaryBranch) allInventory = allInventory.Where(x => x.BranchId == summaryBranch);
        else if (HasBranchScope) allInventory = allInventory.Where(_ => false);
        if (branchId.HasValue) allInventory = allInventory.Where(x => x.BranchId == branchId.Value);
        var inventoryFacts = await allInventory.Select(x => new
        {
            x.ProductId, x.StockQuantity, x.ReservedQuantity, x.PurchasePrice, x.BatchStatus, x.ExpiryDate, x.MinimumStock,
            ReorderLevel = x.Product!.ReorderLevel
        }).ToListAsync(ct);
        var statusRows = inventoryFacts.Select(x =>
        {
            var expired = x.BatchStatus == "EXPIRED" || x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date < today;
            var excluded = x.BatchStatus is "QUARANTINED" or "RETURNED";
            var available = expired || excluded || x.BatchStatus == "DEPLETED" ? 0 : Math.Max(0, x.StockQuantity - x.ReservedQuantity);
            var status = excluded ? x.BatchStatus : expired ? "EXPIRED" : x.BatchStatus == "DEPLETED" || available <= 0 ? "OUT_OF_STOCK" : available <= (x.ReorderLevel > 0 ? x.ReorderLevel : x.MinimumStock) ? "LOW_STOCK" : x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date <= today.AddDays(days) ? "NEAR_EXPIRY" : "IN_STOCK";
            return new { x.ProductId, x.StockQuantity, x.PurchasePrice, Available = available, Status = status, ReorderLevel = x.ReorderLevel > 0 ? x.ReorderLevel : x.MinimumStock };
        }).ToList();
        var productStock = statusRows.GroupBy(x => x.ProductId).Select(group => new { Available = group.Sum(x => x.Available), ReorderLevel = group.Max(x => x.ReorderLevel) }).ToList();
        var pendingTransfers = await db.InventoryTransfers.AsNoTracking().CountAsync(x => x.Status == InventoryTransferStatuses.InTransit && (!HasBranchScope || x.SourceBranchId == ActorBranchId || x.TargetBranchId == ActorBranchId) && (!branchId.HasValue || x.SourceBranchId == branchId.Value || x.TargetBranchId == branchId.Value), ct);
        var adjustmentsQuery = db.StockTransactions.AsNoTracking().Where(x => x.Type == StockTransactionTypes.Adjustment);
        if (HasBranchScope && ActorBranchId is Guid adjustmentScope) adjustmentsQuery = adjustmentsQuery.Where(x => x.BranchId == adjustmentScope);
        else if (HasBranchScope) adjustmentsQuery = adjustmentsQuery.Where(_ => false);
        if (branchId.HasValue) adjustmentsQuery = adjustmentsQuery.Where(x => x.BranchId == branchId.Value);
        var adjustments = await adjustmentsQuery.CountAsync(ct);
        var movementSince = ApplicationTime.NepalNow.AddDays(-180);
        var soldProductIds = await db.StockTransactions.AsNoTracking().Where(x => x.Type == StockTransactionTypes.Sale && x.CreatedAt >= movementSince && (!HasBranchScope || x.BranchId == ActorBranchId) && (!branchId.HasValue || x.BranchId == branchId.Value)).Select(x => x.Inventory!.ProductId).Distinct().ToListAsync(ct);
        var rowCount = await query.CountAsync(ct);
        page = Math.Min(page, Math.Max(1, (rowCount + pageSize - 1) / pageSize));
        var rows = await query.OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.Product!.Name).ThenBy(x => x.BatchNumber).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new
        {
            summary = new
            {
                activeMedicines = activeProducts,
                totalAvailableStock = statusRows.Sum(x => x.Available),
                stockValue = CanInventoryValuation ? inventoryFacts.Sum(x => x.StockQuantity * x.PurchasePrice) : (decimal?)null,
                lowStock = productStock.Count(x => x.Available > 0 && x.Available <= x.ReorderLevel),
                outOfStock = productStock.Count(x => x.Available <= 0),
                nearExpiry = statusRows.Count(x => x.Status == "NEAR_EXPIRY"),
                expired = statusRows.Count(x => x.Status == "EXPIRED"),
                stockAdjustments = adjustments,
                pendingTransfers,
                nonMoving = statusRows.Where(x => x.Available > 0).Select(x => x.ProductId).Distinct().Count(id => !soldProductIds.Contains(id))
            },
            nearExpiryDays = days,
            page,
            pageSize,
            totalRows = rowCount,
            rows = rows.Select(x => ToInventoryRow(x, today, days))
        });
    }

    [HttpGet("inventory/product-master")]
    public async Task<IActionResult> InventoryProductMaster(string? search, Guid? branchId, CancellationToken ct)
    {
        if (!CanInventoryView) return Forbid();
        if (HasBranchScope && branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var query = db.Products.AsNoTracking().Include(x => x.Medicine).ThenInclude(x => x!.Category).Include(x => x.Medicine).ThenInclude(x => x!.Manufacturer).Include(x => x.Brand).Include(x => x.Rack).ThenInclude(x => x!.RackGroup).Include(x => x.Inventory).Include(x => x.Units).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Name.Contains(search) || x.Sku.Contains(search) || (x.Barcode != null && x.Barcode.Contains(search)) || (x.SearchKeywords != null && x.SearchKeywords.Contains(search)) || (x.Medicine != null && x.Medicine.GenericName != null && x.Medicine.GenericName.Contains(search)) || (x.Medicine != null && x.Medicine.Strength != null && x.Medicine.Strength.Contains(search)) || (x.Medicine != null && x.Medicine.DosageForm != null && x.Medicine.DosageForm.Contains(search)) || (x.Medicine != null && x.Medicine.Manufacturer != null && x.Medicine.Manufacturer.Name.Contains(search)) || (x.Medicine != null && x.Medicine.Category != null && x.Medicine.Category.Name.Contains(search)) || (x.Brand != null && x.Brand.Name.Contains(search)) || (x.StorageLocation != null && x.StorageLocation.Contains(search)));
        var rows = await query.OrderBy(x => x.Name).Take(500).ToListAsync(ct);
        var today = ApplicationTime.NepalNow.Date;
        return Ok(rows.Select(x =>
        {
            var inventory = x.Inventory.Where(i => HasBranchScope ? ActorBranchId == i.BranchId : !branchId.HasValue || branchId.Value == i.BranchId).ToList();
            return new
            {
                id = x.Id, name = x.Name, productCode = x.Sku, barcode = x.Barcode, genericName = x.Medicine?.GenericName, brand = x.Brand?.Name,
                manufacturer = x.Medicine?.Manufacturer?.Name, category = x.Medicine?.Category?.Name, strength = x.Medicine?.Strength, dosageForm = x.Medicine?.DosageForm,
                baseUnit = x.BaseUnit, purchaseUnit = x.PurchaseUnit, salesUnit = x.SalesUnit, purchaseUnitToBase = x.PurchaseUnitToBase, salesUnitToBase = x.SalesUnitToBase,
                purchaseRate = CanInventoryValuation ? inventory.OrderBy(i => i.ExpiryDate ?? DateTime.MaxValue).Select(i => (decimal?)i.PurchasePrice).FirstOrDefault() : null, saleRate = x.SellingPrice, mrp = x.Mrp,
                minimumStock = inventory.Select(i => (int?)i.MinimumStock).FirstOrDefault() ?? x.ReorderLevel, reorderLevel = x.ReorderLevel, maximumStock = x.MaximumStock, storageLocation = x.StorageLocation,
                rackId = x.RackId, rackName = x.Rack?.Name, rackGroup = x.Rack?.RackGroup?.Name,
                prescriptionRequired = x.Medicine != null && x.Medicine.PrescriptionRequired, isActive = x.IsActive, notes = x.Notes,
                stock = inventory.Sum(i => AvailableForSale(i, today)), searchKeywords = x.SearchKeywords, units = x.Units.OrderBy(u => u.DisplayOrder).Select(u => new { name = u.UnitName, multiplierToBase = u.MultiplierToBase, isPurchaseUnit = u.IsPurchaseUnit, isSalesUnit = u.IsSalesUnit })
            };
        }));
    }

    [HttpGet("inventory/products/{productId:guid}/alternatives")]
    public async Task<IActionResult> InventoryAlternatives(Guid productId, Guid? branchId, CancellationToken ct)
    {
        if (!CanInventoryView) return Forbid();
        if (HasBranchScope && branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var source = await db.Products.AsNoTracking().Include(x => x.Medicine).SingleOrDefaultAsync(x => x.Id == productId && x.IsActive, ct);
        if (source is null) return NotFound(new { message = "The active medicine could not be found." });
        var generic = source.Medicine?.GenericName?.Trim();
        var strength = source.Medicine?.Strength?.Trim();
        var dosageForm = source.Medicine?.DosageForm?.Trim();
        if (string.IsNullOrWhiteSpace(generic) || string.IsNullOrWhiteSpace(strength) || string.IsNullOrWhiteSpace(dosageForm))
            return Ok(new { sourceProductId = productId, matchCriteriaAvailable = false, alternatives = Array.Empty<object>() });

        var candidates = await db.Products.AsNoTracking()
            .Where(x => x.IsActive && x.Id != productId && x.Medicine != null
                && x.Medicine.GenericName != null && x.Medicine.GenericName.ToUpper() == generic.ToUpper()
                && x.Medicine.Strength != null && x.Medicine.Strength.ToUpper() == strength.ToUpper()
                && x.Medicine.DosageForm != null && x.Medicine.DosageForm.ToUpper() == dosageForm.ToUpper())
            .OrderBy(x => x.Name).Take(50)
            .Include(x => x.Medicine).Include(x => x.Brand)
            .Include(x => x.Inventory).ThenInclude(x => x.Branch)
            .ToListAsync(ct);
        var effectiveBranch = branchId ?? (HasBranchScope ? ActorBranchId : null);
        var branchRestricted = branchId.HasValue || HasBranchScope;
        var today = ApplicationTime.NepalNow.Date;
        var alternatives = candidates.Select(product =>
        {
            var batches = product.Inventory.Where(x => !branchRestricted || effectiveBranch == x.BranchId).ToList();
            var sellable = batches.Where(x => AvailableForSale(x, today) > 0).OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.CreatedAt).ToList();
            return new
            {
                productId = product.Id, name = product.Name, brand = product.Brand?.Name,
                genericName = product.Medicine?.GenericName, strength = product.Medicine?.Strength,
                dosageForm = product.Medicine?.DosageForm, baseUnit = product.BaseUnit,
                available = sellable.Sum(x => AvailableForSale(x, today)),
                nearestExpiry = sellable.FirstOrDefault()?.ExpiryDate,
                sellingPrice = sellable.FirstOrDefault()?.SellingPrice ?? product.SellingPrice,
                batches = sellable.Select(x => new { x.BatchNumber, available = AvailableForSale(x, today), x.ExpiryDate, branchId = x.BranchId, branch = x.Branch?.Name }).ToArray()
            };
        }).ToArray();
        return Ok(new { sourceProductId = productId, matchCriteriaAvailable = true, alternatives });
    }

    [HttpPut("inventory/near-expiry-days")]
    public async Task<IActionResult> UpdateNearExpiryDays(NearExpiryDaysRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        if (request.Days is not (30 or 60 or 90 or 180)) return BadRequest(new { message = "Near-expiry threshold must be 30, 60, 90 or 180 days." });
        return await InventoryWrite(async () =>
        {
            var setting = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == "inventory.near_expiry_days", ct);
            var previous = setting?.Value;
            if (setting is null) db.SystemSettings.Add(new SystemSetting { Key = "inventory.near_expiry_days", Value = request.Days.ToString(), Group = "inventory", IsPublic = false, Description = "Default near-expiry alert threshold in days." });
            else setting.Value = request.Days.ToString();
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "INVENTORY_EXPIRY_THRESHOLD_UPDATED", EntityType = "SystemSetting", EntityId = "inventory.near_expiry_days", PreviousValue = previous, NewValue = request.Days.ToString(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { nearExpiryDays = request.Days });
        }, ct);
    }

    [HttpPut("inventory/product-master/{id:guid}")]
    public async Task<IActionResult> UpdateInventoryProductMaster(Guid id, ProductMasterUpdateRequest request, CancellationToken ct)
    {
        if (!CanManageProductMaster) return Forbid();
        if (!ModelState.IsValid) return BadRequest(new { message = "The medicine master values are invalid." });
        if (string.IsNullOrWhiteSpace(request.BaseUnit) || request.BaseUnit.Trim().Length > 40 || string.IsNullOrWhiteSpace(request.PurchaseUnit) || request.PurchaseUnit.Trim().Length > 40 || string.IsNullOrWhiteSpace(request.SalesUnit) || request.SalesUnit.Trim().Length > 40 || request.PurchaseUnitToBase <= 0 || request.SalesUnitToBase <= 0 || request.ReorderLevel < 0 || request.MaximumStock < 0 || request.MaximumStock > 0 && request.MaximumStock < request.ReorderLevel || request.StorageLocation?.Trim().Length > 160 || request.Notes?.Trim().Length > 1000 || request.SearchKeywords?.Trim().Length > 1000 || request.GenericName?.Trim().Length > 200 || request.Strength?.Trim().Length > 80 || request.DosageForm?.Trim().Length > 80) return BadRequest(new { message = "Medicine units, conversion factors, stock levels or text fields are invalid." });
        var units = request.Units;
        if (units is not null && (units.Any(unit => string.IsNullOrWhiteSpace(unit.Name) || unit.Name.Trim().Length > 40 || unit.MultiplierToBase <= 0 || unit.DisplayOrder < 0) || units.Select(unit => unit.Name.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != units.Count)) return BadRequest(new { message = "Configured units must have unique names, positive base conversions and valid display order." });
        if (units is not null && units.Any(unit => unit.Name.Trim().Equals(request.BaseUnit.Trim(), StringComparison.OrdinalIgnoreCase) && unit.MultiplierToBase != 1 || unit.Name.Trim().Equals(request.PurchaseUnit.Trim(), StringComparison.OrdinalIgnoreCase) && unit.MultiplierToBase != request.PurchaseUnitToBase || unit.Name.Trim().Equals(request.SalesUnit.Trim(), StringComparison.OrdinalIgnoreCase) && unit.MultiplierToBase != request.SalesUnitToBase)) return BadRequest(new { message = "Configured unit conversions must agree with the product's base, purchase and sales units." });
        var product = await db.Products.Include(x => x.Medicine).Include(x => x.Units).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (product is null) return NotFound(new { message = "The medicine could not be found." });
        ProductRack? selectedRack = null;
        if (request.RackId.HasValue)
        {
            selectedRack = await db.ProductRacks.Include(x => x.RackGroup).SingleOrDefaultAsync(x => x.Id == request.RackId.Value && x.IsActive && x.RackGroup != null && x.RackGroup.IsActive, ct);
            if (selectedRack is null) return BadRequest(new { message = "Select an active rack in an active rack group." });
        }
        var unitConfigurationChanged = !product.BaseUnit.Equals(request.BaseUnit.Trim(), StringComparison.OrdinalIgnoreCase) || !product.PurchaseUnit.Equals(request.PurchaseUnit.Trim(), StringComparison.OrdinalIgnoreCase) || !product.SalesUnit.Equals(request.SalesUnit.Trim(), StringComparison.OrdinalIgnoreCase) || product.PurchaseUnitToBase != request.PurchaseUnitToBase || product.SalesUnitToBase != request.SalesUnitToBase;
        if (units is not null)
        {
            var existingUnits = product.Units.OrderBy(unit => unit.DisplayOrder).Select(unit => (unit.UnitName, unit.MultiplierToBase, unit.IsPurchaseUnit, unit.IsSalesUnit, unit.DisplayOrder)).ToArray();
            var proposedUnits = units.OrderBy(unit => unit.DisplayOrder).Select(unit => (unit.Name.Trim(), unit.MultiplierToBase, unit.IsPurchaseUnit, unit.IsSalesUnit, unit.DisplayOrder)).ToArray();
            unitConfigurationChanged |= !existingUnits.SequenceEqual(proposedUnits);
        }
        if (unitConfigurationChanged && (await db.Inventory.AnyAsync(x => x.ProductId == id, ct) || await db.StockTransactions.AnyAsync(x => x.Inventory!.ProductId == id, ct))) return Conflict(new { message = "Unit conversions cannot be changed after stock or movement history exists because quantities are stored in the base unit. Create a controlled migration instead." });
        var before = System.Text.Json.JsonSerializer.Serialize(new { product.BaseUnit, product.PurchaseUnit, product.SalesUnit, product.PurchaseUnitToBase, product.SalesUnitToBase, product.ReorderLevel, product.MaximumStock, product.RackId, product.StorageLocation, product.IsActive, units = product.Units.Select(unit => new { unit.UnitName, unit.MultiplierToBase, unit.IsPurchaseUnit, unit.IsSalesUnit }) });
        product.BaseUnit = request.BaseUnit.Trim(); product.PurchaseUnit = request.PurchaseUnit.Trim(); product.SalesUnit = request.SalesUnit.Trim(); product.PurchaseUnitToBase = request.PurchaseUnitToBase; product.SalesUnitToBase = request.SalesUnitToBase; product.ReorderLevel = request.ReorderLevel; product.MaximumStock = request.MaximumStock; product.RackId = selectedRack?.Id; product.StorageLocation = selectedRack is null ? request.StorageLocation?.Trim() : RackLocation(selectedRack); product.Notes = request.Notes?.Trim(); product.SearchKeywords = request.SearchKeywords?.Trim(); if (request.IsActive.HasValue) product.IsActive = request.IsActive.Value;
        if (product.Medicine is null && (request.GenericName is not null || request.Strength is not null || request.DosageForm is not null || request.PrescriptionRequired.HasValue)) return Conflict(new { message = "Medicine metadata is missing for this product and cannot be updated safely." });
        if (request.GenericName is not null) product.Medicine!.GenericName = request.GenericName.Trim(); if (request.Strength is not null) product.Medicine!.Strength = request.Strength.Trim(); if (request.DosageForm is not null) product.Medicine!.DosageForm = request.DosageForm.Trim(); if (request.PrescriptionRequired.HasValue) product.Medicine!.PrescriptionRequired = request.PrescriptionRequired.Value;
        if (units is not null && unitConfigurationChanged)
        {
            db.ProductUnits.RemoveRange(product.Units);
            product.Units.Clear();
            foreach (var unit in units) product.Units.Add(new ProductUnit { ProductId = product.Id, UnitName = unit.Name.Trim(), MultiplierToBase = unit.MultiplierToBase, IsPurchaseUnit = unit.IsPurchaseUnit, IsSalesUnit = unit.IsSalesUnit, DisplayOrder = unit.DisplayOrder });
        }
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "INVENTORY_PRODUCT_MASTER_UPDATED", EntityType = "Product", EntityId = id.ToString(), PreviousValue = before, NewValue = System.Text.Json.JsonSerializer.Serialize(new { product.BaseUnit, product.PurchaseUnit, product.SalesUnit, product.PurchaseUnitToBase, product.SalesUnitToBase, product.ReorderLevel, product.MaximumStock, product.RackId, product.StorageLocation, product.IsActive, units = units?.Select(unit => new { name = unit.Name.Trim(), unit.MultiplierToBase, unit.IsPurchaseUnit, unit.IsSalesUnit }) }), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct); return Ok(new { id = product.Id, message = "Medicine master updated." });
    }

    [HttpGet("inventory/movements")]
    public async Task<IActionResult> InventoryMovements(Guid? branchId, Guid? productId, Guid? inventoryId, string? batchNumber, string? type, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!CanInventoryView) return Forbid();
        if (HasBranchScope && branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var query = db.StockTransactions.AsNoTracking().Include(x => x.Inventory).ThenInclude(x => x!.Product).Include(x => x.Inventory).ThenInclude(x => x!.Branch).AsQueryable();
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) query = query.Where(x => x.BranchId == scopedBranch || x.Inventory!.BranchId == scopedBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId || x.Inventory!.BranchId == branchId);
        if (productId.HasValue) query = query.Where(x => x.Inventory!.ProductId == productId);
        if (inventoryId.HasValue) query = query.Where(x => x.InventoryId == inventoryId);
        if (!string.IsNullOrWhiteSpace(batchNumber)) query = query.Where(x => x.Inventory!.BatchNumber.Contains(batchNumber));
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(x => x.Type == type.ToUpperInvariant());
        if (from.HasValue) query = query.Where(x => x.CreatedAt >= from.Value.Date);
        if (to.HasValue) query = query.Where(x => x.CreatedAt < to.Value.Date.AddDays(1));
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(1000).ToListAsync(ct);
        var adjustmentIds = rows.Where(x => x.ReferenceType == "INVENTORY_ADJUSTMENT").Select(x => x.Id.ToString()).ToList();
        var cancelledAdjustmentIds = adjustmentIds.Count == 0 ? new HashSet<string>() : await db.StockTransactions.AsNoTracking().Where(x => x.ReferenceType == "INVENTORY_ADJUSTMENT_CANCEL" && x.ReferenceId != null && adjustmentIds.Contains(x.ReferenceId)).Select(x => x.ReferenceId!).ToHashSetAsync(ct);
        return Ok(rows.Select(x => new { id = x.Id, date = x.CreatedAt, productId = x.Inventory!.ProductId, product = x.Inventory.Product!.Name, batch = x.Inventory.BatchNumber, branchId = x.Inventory.BranchId, branch = x.Inventory.Branch!.Name, type = x.Type, quantityBefore = x.QuantityBefore, quantity = x.Quantity, quantityAfter = x.QuantityAfter, unit = x.Unit, referenceType = x.ReferenceType, referenceId = x.ReferenceId, note = x.Note, reason = x.Reason, actorId = x.ActorId, batchStatusBefore = x.BatchStatusBefore, batchStatusAfter = x.BatchStatusAfter, isCancelled = cancelledAdjustmentIds.Contains(x.Id.ToString()) }));
    }

    [HttpPost("inventory/movements/{id:guid}/cancel")]
    public async Task<IActionResult> CancelInventoryAdjustment(Guid id, VoidTransactionRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 500) return BadRequest(new { message = "A cancellation reason of 1 to 500 characters is required." });
        return await InventoryWrite(async () =>
        {
            var movement = await db.StockTransactions.Include(x => x.Inventory).ThenInclude(x => x!.Product).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (movement is null || movement.ReferenceType != "INVENTORY_ADJUSTMENT" || movement.Type is not (StockTransactionTypes.Adjustment or StockTransactionTypes.OpeningStock or StockTransactionTypes.Expired or StockTransactionTypes.Expiry or StockTransactionTypes.Damage or StockTransactionTypes.Other))
                return NotFound(new { message = "This is not a cancellable manual stock adjustment." });
            if (movement.Inventory is null || !BranchAllowed(movement.Inventory.BranchId)) return NotFound(new { message = "The stock adjustment was not found in your operational scope." });
            if (await db.StockTransactions.AnyAsync(x => x.ReferenceType == "INVENTORY_ADJUSTMENT_CANCEL" && x.ReferenceId == movement.Id.ToString(), ct))
                return Conflict(new { message = "This stock adjustment has already been cancelled." });
            var stock = movement.Inventory;
            if (movement.BatchStatusBefore is null || movement.BatchStatusAfter is null)
                return Conflict(new { message = "This older adjustment has no saved batch-status snapshot, so it cannot be safely reversed automatically." });
            if (stock.BatchStatus != movement.BatchStatusAfter)
                return Conflict(new { message = "The batch status has changed since this adjustment. Review and correct it manually before reversing stock." });
            var after = (long)stock.StockQuantity - movement.Quantity;
            if (after < stock.ReservedQuantity || after < 0 || after > int.MaxValue)
                return Conflict(new { message = "The adjustment cannot be reversed because current or reserved stock would become invalid." });
            var before = stock.StockQuantity;
            stock.StockQuantity = (int)after;
            stock.BatchStatus = movement.BatchStatusBefore;
            stock.UpdatedAt = ApplicationTime.NepalNow;
            db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.VoidReversal, Quantity = -movement.Quantity, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = movement.Unit, ReferenceType = "INVENTORY_ADJUSTMENT_CANCEL", ReferenceId = movement.Id.ToString(), Reason = request.Reason.Trim(), Note = $"Cancellation of adjustment {movement.Id}", ActorId = ActorId });
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "INVENTORY_ADJUSTMENT_CANCELLED", EntityType = nameof(StockTransaction), EntityId = movement.Id.ToString(), PreviousValue = movement.Quantity.ToString(), NewValue = request.Reason.Trim(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            await db.SaveChangesAsync(ct);
            return Ok(new { id = movement.Id, status = "CANCELLED", quantity = stock.StockQuantity, batchStatus = stock.BatchStatus });
        }, ct);
    }

    [HttpGet("inventory/suggestions")]
    public async Task<IActionResult> InventorySuggestions(Guid? branchId, CancellationToken ct)
    {
        if (!CanInventoryView) return Forbid();
        if (HasBranchScope && branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var branchQuery = db.Branches.AsNoTracking().Where(x => x.IsActive);
        if (HasBranchScope && ActorBranchId is Guid actorBranch) branchQuery = branchQuery.Where(x => x.Id == actorBranch);
        else if (HasBranchScope) branchQuery = branchQuery.Where(_ => false);
        if (branchId.HasValue) branchQuery = branchQuery.Where(x => x.Id == branchId.Value);
        var branchNames = await branchQuery.ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var scopedBranchIds = branchNames.Keys.ToArray();
        if (scopedBranchIds.Length == 0) return Ok(Array.Empty<object>());
        var products = await db.Products.AsNoTracking().Where(x => x.IsActive)
            .Include(x => x.Units).Include(x => x.Inventory).ThenInclude(x => x.SupplierEntity)
            .OrderBy(x => x.Name).ToListAsync(ct);
        var productIds = products.Select(x => x.Id).ToArray();
        var incomingRows = await db.PurchaseOrderItems.AsNoTracking()
            .Where(item => productIds.Contains(item.ProductId) && scopedBranchIds.Contains(item.PurchaseOrder!.BranchId)
                && (item.PurchaseOrder.Status == PurchaseOrderStatuses.Sent || item.PurchaseOrder.Status == PurchaseOrderStatuses.PartiallyReceived))
            .Select(item => new { item.ProductId, BranchId = item.PurchaseOrder!.BranchId, item.QuantityOrdered, item.QuantityReceived, item.UnitMultiplier })
            .ToListAsync(ct);
        var incomingByProductBranch = incomingRows.GroupBy(x => (x.ProductId, x.BranchId))
            .ToDictionary(group => group.Key, group => group.Sum(x => Math.Max(0L, (long)x.QuantityOrdered - x.QuantityReceived) * Math.Max(1, x.UnitMultiplier)));
        var suggestions = new List<InventorySuggestionRow>();
        var today = ApplicationTime.NepalNow.Date;
        foreach (var product in products)
        {
            foreach (var scopedBranchId in scopedBranchIds)
            {
                var batches = product.Inventory.Where(x => x.BranchId == scopedBranchId).ToList();
                var available = batches.Sum(x => AvailableForSale(x, today));
                var incoming = incomingByProductBranch.GetValueOrDefault((product.Id, scopedBranchId));
                var minimum = batches.Select(x => x.MinimumStock).DefaultIfEmpty(product.ReorderLevel).Max();
                var reorder = product.ReorderLevel > 0 ? product.ReorderLevel : minimum;
                if (reorder <= 0) continue;
                var maximum = product.MaximumStock > 0 ? product.MaximumStock : (int)Math.Min(int.MaxValue, (long)reorder * 2);
                var suggested = (int)Math.Clamp((long)maximum - available - incoming, 0L, int.MaxValue);
                if (suggested <= 0 || (long)available + incoming > reorder) continue;
                var lastBatch = batches.OrderByDescending(x => x.UpdatedAt).FirstOrDefault();
                var unitMultiplier = UnitMultiplier(product, product.PurchaseUnit, isPurchaseUnit: true) ?? Math.Max(1, product.PurchaseUnitToBase);
                suggestions.Add(new InventorySuggestionRow(
                    product.Id, product.Name, product.Sku, scopedBranchId, branchNames[scopedBranchId],
                    available, incoming, minimum, reorder, maximum, suggested,
                    lastBatch?.SupplierEntity?.Name ?? lastBatch?.Supplier, lastBatch?.SupplierId,
                    product.PurchaseUnit, unitMultiplier, lastBatch is null ? null : lastBatch.PurchasePrice * unitMultiplier));
            }
        }
        return Ok(suggestions.OrderBy(row => row.Available).ThenBy(row => row.Product));
    }

    [HttpGet("inventory/velocity")]
    public async Task<IActionResult> InventoryVelocity(Guid? branchId, int days = 90, string? classification = null, CancellationToken ct = default)
    {
        if (!CanInventoryView) return Forbid();
        days = Math.Clamp(days, 30, 365);
        var since = ApplicationTime.NepalNow.AddDays(-days);
        var sales = await db.OrderItems.AsNoTracking().Include(x => x.Order).ThenInclude(x => x!.Branch).Where(x => x.Order!.CreatedAt >= since && x.Order.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed && (!HasBranchScope || x.Order.BranchId == ActorBranchId) && (!branchId.HasValue || x.Order.BranchId == branchId)).Select(x => new { x.ProductId, x.ProductName, x.Quantity, x.UnitMultiplier, Date = x.Order!.CreatedAt }).ToListAsync(ct);
        var inventory = await InventoryScope(branchId, null).ToListAsync(ct);
        var inventoryToday = ApplicationTime.NepalNow.Date;
        var latest = sales.GroupBy(x => new { x.ProductId, x.ProductName }).Select(group => { var productRows = inventory.Where(x => x.ProductId == group.Key.ProductId).ToList(); var stock = productRows.Sum(x => AvailableForSale(x, inventoryToday)); var sold = (int)Math.Min(int.MaxValue, group.Sum(x => (long)x.Quantity * Math.Max(1, x.UnitMultiplier))); var last = group.Max(x => x.Date); var average = sold / (decimal)days; var label = average >= 1m ? "FAST_MOVING" : average > 0m ? "SLOW_MOVING" : "NON_MOVING"; var value = productRows.Sum(x => x.StockQuantity * x.PurchasePrice); return new InventoryVelocityRow(group.Key.ProductId, group.Key.ProductName, sold, stock, CanInventoryValuation ? value : null, last, (int)Math.Max(0, (ApplicationTime.NepalNow - last).TotalDays), label); }).ToList();
        var productsWithStock = inventory.Where(x => AvailableForSale(x, inventoryToday) > 0 && latest.All(v => v.ProductId != x.ProductId)).GroupBy(x => new { x.ProductId, Product = x.Product?.Name }).Select(group => new InventoryVelocityRow(group.Key.ProductId, group.Key.Product ?? "", 0, group.Sum(x => AvailableForSale(x, inventoryToday)), CanInventoryValuation ? group.Sum(x => x.StockQuantity * x.PurchasePrice) : null, null, null, "NON_MOVING"));
        var output = latest.Concat(productsWithStock).Where(x => string.IsNullOrWhiteSpace(classification) || x.Classification.Equals(classification, StringComparison.OrdinalIgnoreCase)).OrderByDescending(x => x.QuantitySold).ToList();
        return Ok(new { days, rows = output });
    }

    [HttpGet("inventory/counts")]
    public async Task<IActionResult> StockCounts(Guid? branchId, CancellationToken ct)
    {
        if (!CanInventoryView) return Forbid();
        if (HasBranchScope && branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var query = db.StockCounts.AsNoTracking().Include(x => x.Branch).Include(x => x.Lines).AsQueryable();
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) query = query.Where(x => x.BranchId == scopedBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(ct);
        return Ok(rows.Select(x => new { id = x.Id, countNumber = x.CountNumber, branchId = x.BranchId, branch = x.Branch?.Name, status = x.Status, createdAt = x.CreatedAt, finalizedAt = x.FinalizedAt, lineCount = x.Lines.Count, variance = x.Lines.Sum(line => line.Variance), varianceValue = CanInventoryValuation ? x.Lines.Sum(line => line.VarianceValue) : (decimal?)null }));
    }

    [HttpGet("inventory/transfers")]
    public async Task<IActionResult> InventoryTransfers(Guid? branchId, CancellationToken ct)
    {
        if (!CanInventoryView) return Forbid();
        if (HasBranchScope && branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var query = db.InventoryTransfers.AsNoTracking().Include(x => x.SourceBranch).Include(x => x.TargetBranch).Include(x => x.Items).ThenInclude(x => x.Product).AsQueryable();
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) query = query.Where(x => x.SourceBranchId == scopedBranch || x.TargetBranchId == scopedBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.SourceBranchId == branchId || x.TargetBranchId == branchId);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(ct);
        return Ok(rows.Select(x => new { id = x.Id, transferNumber = x.TransferNumber, sourceBranchId = x.SourceBranchId, sourceBranch = x.SourceBranch?.Name, targetBranchId = x.TargetBranchId, targetBranch = x.TargetBranch?.Name, status = x.Status, note = x.Note, createdAt = x.CreatedAt, dispatchedAt = x.DispatchedAt, receivedAt = x.ReceivedAt, items = x.Items.Select(item => new { id = item.Id, productId = item.ProductId, product = item.Product?.Name, batchNumber = item.BatchNumber, quantity = item.Quantity, receivedQuantity = item.ReceivedQuantity }) }));
    }

    [HttpPost("inventory/adjust")]
    public async Task<IActionResult> AdjustInventoryDepartment(InventoryAdjustmentRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        if (request.QuantityDelta == 0 || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 500) return BadRequest(new { message = "A non-zero quantity and a reason of 1 to 500 characters are required." });
        var type = string.IsNullOrWhiteSpace(request.Type) ? StockTransactionTypes.Adjustment : request.Type.Trim().ToUpperInvariant();
        var allowedTypes = new[] { StockTransactionTypes.Adjustment, StockTransactionTypes.OpeningStock, StockTransactionTypes.Expired, StockTransactionTypes.Expiry, StockTransactionTypes.Damage, StockTransactionTypes.Other };
        if (!allowedTypes.Contains(type, StringComparer.Ordinal)) return BadRequest(new { message = "Choose a valid stock-adjustment movement type." });
        var batchStatus = request.BatchStatus?.Trim().ToUpperInvariant();
        if (batchStatus is not null && batchStatus is not ("ACTIVE" or "NEAR_EXPIRY" or "EXPIRED" or "DEPLETED" or "QUARANTINED" or "RETURNED")) return BadRequest(new { message = "Choose a valid batch status." });
        return await InventoryWrite(async () =>
        {
            IQueryable<Inventory> adjustmentQuery = db.Inventory.Include(x => x.Product);
            if (HasBranchScope && ActorBranchId is Guid adjustmentBranch) adjustmentQuery = adjustmentQuery.Where(x => x.BranchId == adjustmentBranch);
            else if (HasBranchScope) adjustmentQuery = adjustmentQuery.Where(_ => false);
            var inventory = await adjustmentQuery.SingleOrDefaultAsync(x => x.Id == request.InventoryId, ct);
            if (inventory is null) return NotFound(new { message = "The inventory batch could not be found in your scope." });
            var afterLong = (long)inventory.StockQuantity + request.QuantityDelta;
            if (afterLong < inventory.ReservedQuantity) return Conflict(new { message = "Stock cannot be reduced below the quantity reserved for customer orders." });
            if (afterLong < 0 || afterLong > int.MaxValue) return BadRequest(new { message = "The resulting stock quantity is outside the supported range." });
            if (batchStatus == "DEPLETED" && afterLong != 0) return BadRequest(new { message = "A batch can only be marked depleted when its quantity is zero." });
            if (batchStatus == "ACTIVE" && inventory.ExpiryDate.HasValue && inventory.ExpiryDate.Value.Date < ApplicationTime.NepalNow.Date) return Conflict(new { message = "An expired batch cannot be reactivated for sale." });
            var before = inventory.StockQuantity;
            var batchStatusBefore = inventory.BatchStatus;
            inventory.StockQuantity = (int)afterLong;
            if (batchStatus is not null) inventory.BatchStatus = batchStatus;
            db.StockTransactions.Add(new StockTransaction { InventoryId = inventory.Id, BranchId = inventory.BranchId, Type = type, Quantity = request.QuantityDelta, QuantityBefore = before, QuantityAfter = inventory.StockQuantity, Unit = request.Unit?.Trim() ?? inventory.Product?.BaseUnit ?? "base", ReferenceType = "INVENTORY_ADJUSTMENT", ReferenceId = inventory.Id.ToString(), Reason = request.Reason.Trim(), Note = request.Reason.Trim(), BatchStatusBefore = batchStatusBefore, BatchStatusAfter = inventory.BatchStatus, ActorId = ActorId });
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "INVENTORY_ADJUSTED", EntityType = "Inventory", EntityId = inventory.Id.ToString(), PreviousValue = before.ToString(), NewValue = inventory.StockQuantity.ToString(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(ToInventoryRow(inventory, ApplicationTime.NepalNow.Date, await NearExpiryDays(ct)));
        }, ct);
    }

    [HttpPost("inventory/opening-stock")]
    public async Task<IActionResult> CreateOpeningStock(OpeningStockRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust || !BranchAllowed(request.BranchId)) return Forbid();
        var batch = request.BatchNumber?.Trim();
        var reason = request.Reason?.Trim();
        if (request.ProductId == Guid.Empty || request.BranchId == Guid.Empty || request.Quantity <= 0 || request.Quantity > int.MaxValue || request.PurchasePrice < 0 || request.PurchasePrice > 1000000000m || string.IsNullOrWhiteSpace(batch) || batch.Length > 80 || string.IsNullOrWhiteSpace(reason) || reason.Length > 500)
            return BadRequest(new { message = "Choose a product and branch, enter a positive quantity, valid purchase rate, batch number and opening-stock reason." });
        if (request.ExpiryDate.HasValue && request.ManufacturingDate.HasValue && request.ManufacturingDate.Value.Date > request.ExpiryDate.Value.Date)
            return BadRequest(new { message = "Manufacturing date cannot be later than expiry date." });
        return await InventoryWrite(async () =>
        {
            var branch = await db.Branches.SingleOrDefaultAsync(x => x.Id == request.BranchId && x.IsActive, ct);
            if (branch is null) return BadRequest(new { message = "Choose an active branch." });
            var product = await db.Products.Include(x => x.Medicine).Include(x => x.Brand).SingleOrDefaultAsync(x => x.Id == request.ProductId && x.IsActive, ct);
            if (product is null) return BadRequest(new { message = "Choose an active product." });
            if (await db.Inventory.AnyAsync(x => x.ProductId == product.Id && x.BranchId == branch.Id && x.BatchNumber == batch, ct))
                return Conflict(new { message = "This product already has this batch number at the selected branch. Use a controlled adjustment for an existing batch." });
            var expired = request.ExpiryDate.HasValue && request.ExpiryDate.Value.Date < ApplicationTime.NepalNow.Date;
            var inventory = new Inventory
            {
                ProductId = product.Id, Product = product, BranchId = branch.Id, Branch = branch,
                BatchNumber = batch, StockQuantity = (int)request.Quantity, ReservedQuantity = 0,
                PurchasePrice = Math.Round(request.PurchasePrice, 2), SellingPrice = product.SellingPrice, Mrp = product.Mrp,
                ExpiryDate = request.ExpiryDate?.Date, ManufacturingDate = request.ManufacturingDate?.Date,
                MinimumStock = product.ReorderLevel, BatchStatus = expired ? "EXPIRED" : "ACTIVE",
                PurchaseReference = string.IsNullOrWhiteSpace(request.Reference) ? "OPENING STOCK" : request.Reference.Trim(),
                Supplier = string.IsNullOrWhiteSpace(request.SupplierName) ? null : request.SupplierName.Trim()
            };
            db.Inventory.Add(inventory);
            db.StockTransactions.Add(new StockTransaction { Inventory = inventory, BranchId = branch.Id, Type = StockTransactionTypes.OpeningStock, Quantity = inventory.StockQuantity, QuantityBefore = 0, QuantityAfter = inventory.StockQuantity, Unit = product.BaseUnit, ReferenceType = "INVENTORY_OPENING_STOCK", ReferenceId = inventory.Id.ToString(), Reason = reason, Note = request.Reference?.Trim(), ActorId = ActorId });
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "INVENTORY_OPENING_STOCK_POSTED", EntityType = "Inventory", EntityId = inventory.Id.ToString(), NewValue = $"{product.Name} · {batch} · {inventory.StockQuantity} {product.BaseUnit}", IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(ToInventoryRow(inventory, ApplicationTime.NepalNow.Date, await NearExpiryDays(ct)));
        }, ct);
    }

    [HttpPost("inventory/counts")]
    public async Task<IActionResult> CreateStockCount(CreateStockCountRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust || !BranchAllowed(request.BranchId)) return Forbid();
        if (request.Scope?.Trim().Length > 120 || request.Category?.Trim().Length > 120 || request.Location?.Trim().Length > 160 || request.Search?.Trim().Length > 200 || request.Notes?.Trim().Length > 1000) return BadRequest(new { message = "Stock-count filters or notes exceed their supported lengths." });
        return await InventoryWrite(async () =>
        {
            if (!await db.Branches.AnyAsync(x => x.Id == request.BranchId && x.IsActive, ct)) return BadRequest(new { message = "The selected branch is not active." });
            var query = InventoryScope(request.BranchId, request.Search);
            if (!string.IsNullOrWhiteSpace(request.Category)) query = query.Where(x => x.Product!.Medicine!.Category!.Name.Contains(request.Category));
            if (!string.IsNullOrWhiteSpace(request.Location)) query = query.Where(x => x.Product!.StorageLocation != null && x.Product.StorageLocation.Contains(request.Location));
            var rows = await query.OrderBy(x => x.Product!.Name).ThenBy(x => x.ExpiryDate ?? DateTime.MaxValue).Take(5001).ToListAsync(ct);
            if (rows.Count > 5000) return BadRequest(new { message = "This count includes more than 5,000 batches. Narrow it by search, category or rack and create separate counts." });
            var count = new StockCount { CountNumber = $"SC-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", BranchId = request.BranchId, Scope = request.Scope?.Trim(), CategoryFilter = request.Category?.Trim(), LocationFilter = request.Location?.Trim(), Notes = request.Notes?.Trim() };
            foreach (var row in rows) count.Lines.Add(new StockCountLine { InventoryId = row.Id, SystemQuantity = row.StockQuantity, PhysicalQuantity = null, Variance = 0, VarianceValue = 0 });
            var stockById = rows.ToDictionary(row => row.Id);
            db.StockCounts.Add(count);
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_COUNT_CREATED", EntityType = "StockCount", EntityId = count.Id.ToString(), NewValue = count.CountNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = count.Id, countNumber = count.CountNumber, branchId = count.BranchId, status = count.Status, lines = count.Lines.Select(line => { var stock = stockById[line.InventoryId]; return new { id = line.Id, inventoryId = line.InventoryId, product = stock.Product?.Name ?? "Medicine", batchNumber = stock.BatchNumber, storageLocation = stock.Product?.StorageLocation, baseUnit = stock.Product?.BaseUnit ?? "piece", unitCost = CanInventoryValuation ? stock.PurchasePrice : (decimal?)null, systemQuantity = line.SystemQuantity, physicalQuantity = line.PhysicalQuantity, variance = line.Variance, varianceValue = CanInventoryValuation ? line.VarianceValue : (decimal?)null }; }) });
        }, ct);
    }

    [HttpPut("inventory/counts/{id:guid}/lines")]
    public async Task<IActionResult> UpdateStockCountLines(Guid id, UpdateStockCountLinesRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        if (request.Lines.Count == 0 || request.Lines.Count > 5000 || request.Lines.GroupBy(x => x.LineId).Any(group => group.Count() > 1) || request.Lines.Any(x => x.PhysicalQuantity < 0 || x.Reason?.Trim().Length > 500)) return BadRequest(new { message = "Provide unique stock-count lines with valid non-negative quantities and reasons." });
        return await InventoryWrite(async () =>
        {
            var count = await db.StockCounts.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (count is null) return NotFound();
            if (count.Status != StockCountStatuses.Draft) return Conflict(new { message = "A finalized or cancelled stock count cannot be edited." });
            if (!BranchAllowed(count.BranchId)) return Forbid();
            if (request.Lines.Any(update => count.Lines.All(line => line.Id != update.LineId))) return BadRequest(new { message = "One or more stock-count lines do not belong to this draft." });
            var inventory = await db.Inventory.Where(x => count.Lines.Select(line => line.InventoryId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            var changes = new List<object>();
            foreach (var update in request.Lines)
            {
                var line = count.Lines.Single(x => x.Id == update.LineId);
                var stock = inventory[line.InventoryId];
                changes.Add(new { lineId = line.Id, before = line.PhysicalQuantity, after = update.PhysicalQuantity });
                line.PhysicalQuantity = update.PhysicalQuantity;
                line.Variance = update.PhysicalQuantity - line.SystemQuantity;
                line.VarianceValue = line.Variance * stock.PurchasePrice;
                line.Reason = update.Reason?.Trim();
            }
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_COUNT_LINES_UPDATED", EntityType = "StockCount", EntityId = count.Id.ToString(), PreviousValue = System.Text.Json.JsonSerializer.Serialize(changes), NewValue = $"{request.Lines.Count} physical quantities recorded", IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = count.Id, status = count.Status, updated = request.Lines.Count });
        }, ct);
    }

    [HttpPost("inventory/counts/{id:guid}/finalize")]
    public async Task<IActionResult> FinalizeStockCount(Guid id, FinalizeStockCountRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        if (request.Reason?.Trim().Length > 500) return BadRequest(new { message = "The stock-count reason cannot exceed 500 characters." });
        return await InventoryWrite(async () =>
        {
            var count = await db.StockCounts.Include(x => x.Lines).ThenInclude(x => x.Inventory).ThenInclude(x => x!.Product).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (count is null) return NotFound();
            if (count.Status != StockCountStatuses.Draft) return Conflict(new { message = "This stock count is already closed." });
            if (!BranchAllowed(count.BranchId)) return Forbid();
            if (count.Lines.Any(x => x.PhysicalQuantity is null)) return BadRequest(new { message = "Enter physical quantity for every line before finalizing." });
            var inventoryIds = count.Lines.Select(line => line.InventoryId).ToArray();
            if (await db.StockTransactions.AsNoTracking().AnyAsync(x => inventoryIds.Contains(x.InventoryId) && x.CreatedAt > count.CreatedAt, ct))
                return Conflict(new { message = "Stock moved while this count was in progress. Cancel this draft and start a fresh count so sales or receipts are not overwritten." });
            var reason = request.Reason?.Trim();
            if (count.Lines.Any(line => line.PhysicalQuantity != line.Inventory!.StockQuantity) && string.IsNullOrWhiteSpace(reason)) return BadRequest(new { message = "A reason is required when a stock count has variance." });
            foreach (var line in count.Lines)
            {
                var stock = line.Inventory!;
                var physical = line.PhysicalQuantity!.Value;
                if (physical < stock.ReservedQuantity) return Conflict(new { message = $"{stock.Product?.Name ?? "A batch"} cannot be below its reserved quantity." });
                var before = stock.StockQuantity;
                var delta = physical - before;
                stock.StockQuantity = physical;
                line.Variance = delta;
                line.VarianceValue = delta * stock.PurchasePrice;
                if (delta != 0) db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.Adjustment, Quantity = delta, QuantityBefore = before, QuantityAfter = physical, Unit = stock.Product?.BaseUnit ?? "base", ReferenceType = "STOCK_COUNT", ReferenceId = count.Id.ToString(), Reason = reason, Note = $"Stock count {count.CountNumber}", ActorId = ActorId });
            }
            count.Status = StockCountStatuses.Finalized;
            count.FinalizedAt = ApplicationTime.NepalNow;
            count.FinalizedByStaffId = ActorId;
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_COUNT_FINALIZED", EntityType = "StockCount", EntityId = count.Id.ToString(), NewValue = reason ?? count.CountNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = count.Id, status = count.Status, finalizedAt = count.FinalizedAt, totalVariance = count.Lines.Sum(x => x.Variance), varianceValue = CanInventoryValuation ? count.Lines.Sum(x => x.VarianceValue) : (decimal?)null });
        }, ct);
    }

    [HttpPost("inventory/counts/{id:guid}/cancel")]
    public async Task<IActionResult> CancelStockCount(Guid id, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        return await InventoryWrite(async () =>
        {
            var count = await db.StockCounts.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (count is null) return NotFound();
            if (count.Status != StockCountStatuses.Draft) return Conflict(new { message = "Only a draft stock count can be cancelled." });
            if (!BranchAllowed(count.BranchId)) return Forbid();
            count.Status = StockCountStatuses.Cancelled;
            count.UpdatedAt = ApplicationTime.NepalNow;
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_COUNT_CANCELLED", EntityType = "StockCount", EntityId = count.Id.ToString(), NewValue = count.CountNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = count.Id, status = count.Status });
        }, ct);
    }

    [HttpPost("inventory/transfers")]
    public async Task<IActionResult> CreateInventoryTransfer(CreateInventoryTransferRequest request, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        if (request.SourceBranchId == request.TargetBranchId || !BranchAllowed(request.SourceBranchId) || !BranchAllowed(request.TargetBranchId) || request.Items.Count == 0 || request.Note?.Trim().Length > 500) return BadRequest(new { message = "Choose two different permitted branches and at least one batch." });
        if (!await db.Branches.AnyAsync(x => x.Id == request.SourceBranchId && x.IsActive, ct) || !await db.Branches.AnyAsync(x => x.Id == request.TargetBranchId && x.IsActive, ct)) return BadRequest(new { message = "Both transfer branches must be active." });
        var ids = request.Items.Select(x => x.InventoryId).Distinct().ToList();
        if (ids.Count != request.Items.Count) return BadRequest(new { message = "Each transfer batch may appear only once." });
        return await InventoryWrite(async () =>
        {
            var source = await InventoryScope(request.SourceBranchId, null).Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            if (source.Count != ids.Count) return NotFound(new { message = "One or more source batches are outside the selected branch." });
            foreach (var item in request.Items)
            {
                if (item.Quantity <= 0 || item.Quantity > source[item.InventoryId].StockQuantity - source[item.InventoryId].ReservedQuantity) return Conflict(new { message = "A transfer quantity exceeds available stock." });
                var batch = source[item.InventoryId];
                if (batch.ExpiryDate?.Date < ApplicationTime.NepalNow.Date || batch.BatchStatus is "EXPIRED" or "DEPLETED" or "QUARANTINED" or "RETURNED") return Conflict(new { message = "Expired, depleted, quarantined, or returned stock cannot be transferred." });
            }
            var transfer = new InventoryTransfer { TransferNumber = $"TR-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", SourceBranchId = request.SourceBranchId, TargetBranchId = request.TargetBranchId, Note = request.Note?.Trim() };
            foreach (var item in request.Items)
            {
                var row = source[item.InventoryId];
                transfer.Items.Add(new InventoryTransferItem { SourceInventoryId = row.Id, ProductId = row.ProductId, BatchNumber = row.BatchNumber, Quantity = item.Quantity, PurchasePrice = row.PurchasePrice, ExpiryDate = row.ExpiryDate });
            }
            db.InventoryTransfers.Add(transfer);
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_TRANSFER_CREATED", EntityType = "InventoryTransfer", EntityId = transfer.Id.ToString(), NewValue = transfer.TransferNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = transfer.Id, transferNumber = transfer.TransferNumber, status = transfer.Status, itemCount = transfer.Items.Count });
        }, ct);
    }

    [HttpPost("inventory/transfers/{id:guid}/dispatch")]
    public async Task<IActionResult> DispatchInventoryTransfer(Guid id, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        return await InventoryWrite(async () =>
        {
            var transfer = await db.InventoryTransfers.Include(x => x.Items).ThenInclude(x => x.SourceInventory).ThenInclude(x => x!.Product).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (transfer is null) return NotFound();
            if (transfer.Status != InventoryTransferStatuses.Draft) return Conflict(new { message = "Only draft transfers can be dispatched." });
            if (!BranchAllowed(transfer.SourceBranchId) || !BranchAllowed(transfer.TargetBranchId)) return Forbid();
            foreach (var item in transfer.Items)
            {
                var source = item.SourceInventory;
                if (source is null) return Conflict(new { message = $"The source batch {item.BatchNumber} is missing." });
                var available = source.StockQuantity - source.ReservedQuantity;
                if (item.Quantity <= 0 || item.Quantity > available) return Conflict(new { message = $"Insufficient stock for batch {item.BatchNumber}." });
                if (source.ExpiryDate?.Date < ApplicationTime.NepalNow.Date || source.BatchStatus is "EXPIRED" or "DEPLETED" or "QUARANTINED" or "RETURNED") return Conflict(new { message = $"Batch {item.BatchNumber} is not eligible for transfer." });
                var before = source.StockQuantity;
                source.StockQuantity -= item.Quantity;
                db.StockTransactions.Add(new StockTransaction { InventoryId = source.Id, BranchId = source.BranchId, Type = StockTransactionTypes.TransferOut, Quantity = -item.Quantity, QuantityBefore = before, QuantityAfter = source.StockQuantity, Unit = source.Product?.BaseUnit ?? "base", ReferenceType = "INVENTORY_TRANSFER", ReferenceId = transfer.Id.ToString(), Reason = transfer.Note, Note = transfer.TransferNumber, ActorId = ActorId });
                var target = await db.Inventory.SingleOrDefaultAsync(x => x.ProductId == item.ProductId && x.BranchId == transfer.TargetBranchId && x.BatchNumber == item.BatchNumber, ct);
                if (target is null)
                {
                    target = new Inventory { ProductId = item.ProductId, BranchId = transfer.TargetBranchId, BatchNumber = item.BatchNumber, PurchasePrice = item.PurchasePrice, SellingPrice = source.SellingPrice, Mrp = source.Mrp, ExpiryDate = item.ExpiryDate, ManufacturingDate = source.ManufacturingDate, StockQuantity = 0, ReservedQuantity = 0, MinimumStock = source.MinimumStock, Supplier = source.Supplier, SupplierId = source.SupplierId, PurchaseOrderId = source.PurchaseOrderId, PurchaseReference = source.PurchaseReference, BatchStatus = source.BatchStatus };
                    db.Inventory.Add(target);
                }
                else if (target.BatchStatus is "QUARANTINED" or "RETURNED") return Conflict(new { message = $"The destination batch {item.BatchNumber} is quarantined or returned." });
            }
            transfer.Status = InventoryTransferStatuses.InTransit;
            transfer.DispatchedAt = ApplicationTime.NepalNow;
            transfer.DispatchedByStaffId = ActorId;
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_TRANSFER_DISPATCHED", EntityType = "InventoryTransfer", EntityId = transfer.Id.ToString(), NewValue = transfer.TransferNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = transfer.Id, status = transfer.Status, dispatchedAt = transfer.DispatchedAt });
        }, ct);
    }

    [HttpPost("inventory/transfers/{id:guid}/receive")]
    public async Task<IActionResult> ReceiveInventoryTransfer(Guid id, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        return await InventoryWrite(async () =>
        {
            var transfer = await db.InventoryTransfers.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (transfer is null) return NotFound();
            if (transfer.Status != InventoryTransferStatuses.InTransit) return Conflict(new { message = "Only in-transit transfers can be received." });
            if (!BranchAllowed(transfer.TargetBranchId)) return Forbid();
            foreach (var item in transfer.Items)
            {
                var target = await db.Inventory.SingleOrDefaultAsync(x => x.ProductId == item.ProductId && x.BranchId == transfer.TargetBranchId && x.BatchNumber == item.BatchNumber, ct);
                if (target is null) return Conflict(new { message = "The destination batch is missing." });
                if (target.BatchStatus is "QUARANTINED" or "RETURNED") return Conflict(new { message = $"The destination batch {item.BatchNumber} is quarantined or returned." });
                var updated = (long)target.StockQuantity + item.Quantity;
                if (updated > int.MaxValue) return Conflict(new { message = $"Receiving batch {item.BatchNumber} would exceed the supported stock quantity." });
                var before = target.StockQuantity;
                target.StockQuantity = (int)updated;
                if (target.ExpiryDate.HasValue && target.ExpiryDate.Value.Date < ApplicationTime.NepalNow.Date) target.BatchStatus = "EXPIRED";
                item.ReceivedQuantity = item.Quantity;
                db.StockTransactions.Add(new StockTransaction { InventoryId = target.Id, BranchId = target.BranchId, Type = StockTransactionTypes.TransferIn, Quantity = item.Quantity, QuantityBefore = before, QuantityAfter = target.StockQuantity, Unit = "base", ReferenceType = "INVENTORY_TRANSFER", ReferenceId = transfer.Id.ToString(), Reason = transfer.Note, Note = transfer.TransferNumber, ActorId = ActorId });
            }
            transfer.Status = InventoryTransferStatuses.Received;
            transfer.ReceivedAt = ApplicationTime.NepalNow;
            transfer.ReceivedByStaffId = ActorId;
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_TRANSFER_RECEIVED", EntityType = "InventoryTransfer", EntityId = transfer.Id.ToString(), NewValue = transfer.TransferNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = transfer.Id, status = transfer.Status, receivedAt = transfer.ReceivedAt });
        }, ct);
    }

    [HttpPost("inventory/transfers/{id:guid}/cancel")]
    public async Task<IActionResult> CancelInventoryTransfer(Guid id, CancellationToken ct)
    {
        if (!CanInventoryAdjust) return Forbid();
        return await InventoryWrite(async () =>
        {
            var transfer = await db.InventoryTransfers.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (transfer is null) return NotFound();
            if (transfer.Status is InventoryTransferStatuses.Received or InventoryTransferStatuses.Cancelled) return Conflict(new { message = "This transfer is already closed." });
            if (!BranchAllowed(transfer.SourceBranchId) || !BranchAllowed(transfer.TargetBranchId)) return Forbid();
            if (transfer.Status == InventoryTransferStatuses.InTransit)
            {
                foreach (var item in transfer.Items)
                {
                    var source = await db.Inventory.Include(x => x.Product).SingleOrDefaultAsync(x => x.Id == item.SourceInventoryId, ct);
                    if (source is null) return Conflict(new { message = "The source batch for this transfer is missing." });
                    var updated = (long)source.StockQuantity + item.Quantity;
                    if (updated > int.MaxValue) return Conflict(new { message = $"Restoring batch {item.BatchNumber} would exceed the supported stock quantity." });
                    var before = source.StockQuantity;
                    source.StockQuantity = (int)updated;
                    source.UpdatedAt = ApplicationTime.NepalNow;
                    db.StockTransactions.Add(new StockTransaction { InventoryId = source.Id, BranchId = source.BranchId, Type = StockTransactionTypes.VoidReversal, Quantity = item.Quantity, QuantityBefore = before, QuantityAfter = source.StockQuantity, Unit = source.Product?.BaseUnit ?? "base", ReferenceType = "INVENTORY_TRANSFER_CANCEL", ReferenceId = transfer.Id.ToString(), Reason = "Transfer cancelled before receipt", Note = transfer.TransferNumber, ActorId = ActorId });
                }
            }
            transfer.Status = InventoryTransferStatuses.Cancelled;
            transfer.UpdatedAt = ApplicationTime.NepalNow;
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "STOCK_TRANSFER_CANCELLED", EntityType = "InventoryTransfer", EntityId = transfer.Id.ToString(), NewValue = transfer.TransferNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            return Ok(new { id = transfer.Id, status = transfer.Status });
        }, ct);
    }

    [HttpGet("credit-ledger")]
    public async Task<IActionResult> CreditLedger(Guid? branchId, CancellationToken ct)
    {
        if (!CanLedger) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var customerQuery = db.Customers.AsNoTracking().Where(x => x.IsActive);
        if (HasBranchScope && ActorBranchId is Guid customerBranch)
            customerQuery = customerQuery.Where(x => db.Orders.Any(o => o.CustomerId == x.Id && o.BranchId == customerBranch) || db.CustomerPayments.Any(p => p.CustomerId == x.Id && p.BranchId == customerBranch));
        else if (HasBranchScope) customerQuery = customerQuery.Where(_ => false);
        if (branchId.HasValue)
            customerQuery = customerQuery.Where(x => db.Orders.Any(o => o.CustomerId == x.Id && o.BranchId == branchId.Value) || db.CustomerPayments.Any(p => p.CustomerId == x.Id && p.BranchId == branchId.Value));
        var customers = await customerQuery.Select(x => new { x.Id, x.FullName, x.Email, x.CreditLimit }).ToListAsync(ct);
        var invoiceQuery = db.Invoices.AsNoTracking().Include(x => x.Order).Where(x => x.PaymentStatus != "VOID" && x.Order!.Status != OrderStatuses.Cancelled);
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) invoiceQuery = invoiceQuery.Where(x => x.Order!.BranchId == scopedBranch);
        else if (HasBranchScope) invoiceQuery = invoiceQuery.Where(_ => false);
        if (branchId.HasValue) invoiceQuery = invoiceQuery.Where(x => x.Order!.BranchId == branchId.Value);
        var invoices = await invoiceQuery.ToListAsync(ct);
        var supplierQuery = db.Suppliers.AsNoTracking().Where(x => x.IsActive);
        if (HasBranchScope && ActorBranchId is Guid supplierBranch)
            supplierQuery = supplierQuery.Where(x => db.PurchaseOrders.Any(p => p.SupplierId == x.Id && p.BranchId == supplierBranch) || db.SupplierInvoices.Any(i => i.SupplierId == x.Id && (i.BranchId == supplierBranch || i.BranchId == null && i.PurchaseOrder != null && i.PurchaseOrder.BranchId == supplierBranch)) || db.SupplierPayments.Any(p => p.SupplierId == x.Id && p.BranchId == supplierBranch));
        else if (HasBranchScope) supplierQuery = supplierQuery.Where(_ => false);
        if (branchId.HasValue)
            supplierQuery = supplierQuery.Where(x => db.PurchaseOrders.Any(p => p.SupplierId == x.Id && p.BranchId == branchId.Value) || db.SupplierInvoices.Any(i => i.SupplierId == x.Id && (i.BranchId == branchId.Value || i.BranchId == null && i.PurchaseOrder != null && i.PurchaseOrder.BranchId == branchId.Value)) || db.SupplierPayments.Any(p => p.SupplierId == x.Id && p.BranchId == branchId.Value));
        var suppliers = await supplierQuery.Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var supplierInvoiceQuery = db.SupplierInvoices.AsNoTracking().Include(x => x.PurchaseOrder).Where(x => x.Status != "VOID");
        if (HasBranchScope && ActorBranchId is Guid supplierInvoiceBranch) supplierInvoiceQuery = supplierInvoiceQuery.Where(x => x.BranchId == supplierInvoiceBranch || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == supplierInvoiceBranch);
        else if (HasBranchScope) supplierInvoiceQuery = supplierInvoiceQuery.Where(_ => false);
        if (branchId.HasValue) supplierInvoiceQuery = supplierInvoiceQuery.Where(x => x.BranchId == branchId.Value || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == branchId.Value);
        var supplierInvoices = await supplierInvoiceQuery.ToListAsync(ct);
        var today = ApplicationTime.NepalNow.Date;
        var supplierBalances = suppliers.Select(s =>
        {
            var balances = supplierInvoices.Where(invoice => invoice.SupplierId == s.Id && invoice.Total > invoice.PaidAmount).Select(invoice => new { amount = invoice.Total - invoice.PaidAmount, date = (invoice.DueAt ?? invoice.InvoiceDate).Date }).ToList();
            return new { id = s.Id, name = s.Name, balance = balances.Sum(row => row.amount), invoices = balances.Count, aging0To30 = balances.Where(row => row.date >= today.AddDays(-30)).Sum(row => row.amount), aging31To60 = balances.Where(row => row.date < today.AddDays(-30) && row.date >= today.AddDays(-60)).Sum(row => row.amount), aging60Plus = balances.Where(row => row.date < today.AddDays(-60)).Sum(row => row.amount) };
        }).ToList();
        return Ok(new
        {
            customers = customers.Select(c => { var rows = invoices.Where(i => i.Order?.CustomerId == c.Id && i.Total > i.PaidAmount).Select(i => new { amount = i.Total - i.PaidAmount, date = i.DueAt ?? i.IssuedAt }); var balance = rows.Sum(x => x.amount); return new { id = c.Id, name = c.FullName, email = c.Email, limit = c.CreditLimit, balance, aging0To30 = rows.Where(x => x.date >= ApplicationTime.NepalNow.AddDays(-30)).Sum(x => x.amount), aging31To60 = rows.Where(x => x.date < ApplicationTime.NepalNow.AddDays(-30) && x.date >= ApplicationTime.NepalNow.AddDays(-60)).Sum(x => x.amount), aging60Plus = rows.Where(x => x.date < ApplicationTime.NepalNow.AddDays(-60)).Sum(x => x.amount) }; }),
            suppliers = supplierBalances,
            totalReceivable = invoices.Sum(x => Math.Max(0m, x.Total - x.PaidAmount)),
            totalPayable = supplierBalances.Sum(x => Math.Max(0m, x.balance)),
            supplierCredit = supplierBalances.Sum(x => Math.Max(0m, -x.balance))
        });
    }

    [HttpGet("cash-handovers/staff")]
    public async Task<IActionResult> CashHandoverStaff(Guid? branchId, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var query = db.StaffUsers.AsNoTracking().Where(x => x.IsActive);
        if (HasBranchScope && ActorBranchId is Guid actorBranch) query = query.Where(x => x.BranchId == actorBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        return Ok(await query.OrderBy(x => x.FullName).Select(x => new { x.Id, x.FullName, x.Role, x.BranchId }).ToListAsync(ct));
    }

    [HttpGet("cash-handovers")]
    public async Task<IActionResult> CashHandovers(DateTime? from, DateTime? to, Guid? branchId, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var (start, end) = Range(from, to);
        var query = db.CashHandovers.AsNoTracking().Include(x => x.Branch).Include(x => x.HandedByStaffUser).Include(x => x.ReceivedByStaffUser)
            .Where(x => x.HandoverAt >= start && x.HandoverAt < end);
        if (HasBranchScope && ActorBranchId is Guid actorBranch) query = query.Where(x => x.BranchId == actorBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        var rows = await query.OrderByDescending(x => x.HandoverAt).Take(1000).ToListAsync(ct);
        return Ok(rows.Select(x => new { x.Id, x.HandoverNumber, x.BranchId, branch = x.Branch!.Name, handedByStaffUserId = x.HandedByStaffUserId, handedBy = x.HandedByStaffUser!.FullName, receivedByStaffUserId = x.ReceivedByStaffUserId, receivedBy = x.ReceivedByStaffUser!.FullName, x.HandoverAt, x.Amount, x.Reference, x.Notes, x.Status }));
    }

    [HttpPost("cash-handovers")]
    public async Task<IActionResult> CreateCashHandover(CashHandoverInput request, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        if (!BranchAllowed(request.BranchId)) return Forbid();
        if (request.Amount <= 0 || request.Amount > 100_000_000m || string.IsNullOrWhiteSpace(request.Reference) || request.Reference.Trim().Length > 120 || request.Notes?.Length > 1000)
            return BadRequest(new { message = "Enter a positive amount, a reference (up to 120 characters), and notes no longer than 1,000 characters." });
        var senderId = IsSuperAdmin && request.HandedByStaffUserId.HasValue ? request.HandedByStaffUserId.Value : ActorId;
        var staff = await db.StaffUsers.AsNoTracking().Where(x => x.IsActive && x.BranchId == request.BranchId && (x.Id == senderId || x.Id == request.ReceivedByStaffUserId)).ToListAsync(ct);
        var sender = staff.SingleOrDefault(x => x.Id == senderId);
        var receiver = staff.SingleOrDefault(x => x.Id == request.ReceivedByStaffUserId);
        if (sender is null || receiver is null) return BadRequest(new { message = "Choose active cashier and teller staff members assigned to the selected branch." });
        if (sender.Id == receiver.Id) return BadRequest(new { message = "The cashier and receiving teller must be different staff members." });

        var now = ApplicationTime.NepalNow;
        var handover = new CashHandover
        {
            HandoverNumber = $"ANHH-CH-{now:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}",
            BranchId = request.BranchId, HandedByStaffUserId = sender.Id, ReceivedByStaffUserId = receiver.Id,
            HandoverAt = now, Amount = Math.Round(request.Amount, 2), Reference = request.Reference.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(), Status = "POSTED",
        };
        db.CashHandovers.Add(handover);
        db.JournalEntries.Add(new JournalEntry
        {
            EntryDate = now, Reference = handover.HandoverNumber,
            Description = $"Cash handed from {sender.FullName} to teller {receiver.FullName}",
            DebitAccount = "Cash at Teller", CreditAccount = "Cash", Amount = handover.Amount,
            Notes = $"Branch {request.BranchId}; {handover.Reference}. {handover.Notes}".Trim(),
        });
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "CASH_HANDOVER_POSTED", EntityType = nameof(CashHandover), EntityId = handover.Id.ToString(), NewValue = $"{handover.HandoverNumber} · {handover.Amount:0.00} · {sender.FullName} → {receiver.FullName}", IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct);
        return Ok(new { handover.Id, handover.HandoverNumber, handover.BranchId, branch = (string?)null, handedByStaffUserId = sender.Id, handedBy = sender.FullName, receivedByStaffUserId = receiver.Id, receivedBy = receiver.FullName, handover.HandoverAt, handover.Amount, handover.Reference, handover.Notes, handover.Status });
    }

    [HttpPost("pos-sales")]
    public async Task<IActionResult> CreateSale(PosSaleRequest request, CancellationToken ct)
    {
        var paymentMode = request.PaymentMode?.Trim().ToUpperInvariant() ?? "";
        if (!CanSell || IsSalesExecutive && request.BranchId.HasValue && !BranchAllowed(request.BranchId.Value)) return Forbid();
        if (request.Items.Count == 0 || request.Items.Any(x => x.Quantity <= 0 || x.BonusQuantity < 0 || x.DiscountPercent is < 0 or > 100) || !PaymentModes.Contains(paymentMode)) return BadRequest(new { message = "Add at least one item and choose a valid payment mode." });
        if (request.Items.GroupBy(x => x.ProductId).Any(group => group.Count() > 1)) return BadRequest(new { message = "Add each product to the bill once; edit its existing line quantity instead." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var branchId = request.BranchId ?? ActorBranchId ?? await db.Branches.Where(x => x.IsActive).Select(x => x.Id).FirstOrDefaultAsync(ct);
        if (branchId == Guid.Empty) return BadRequest(new { message = "An active branch is required before billing." });
        if (!BranchAllowed(branchId)) return Forbid();
        var productIds = request.Items.Select(x => x.ProductId).Distinct().ToList();
        var products = await db.Products.Include(x => x.Medicine).Include(x => x.Units).Where(x => productIds.Contains(x.Id) && x.IsActive).ToDictionaryAsync(x => x.Id, ct);
        if (products.Count != productIds.Count) return BadRequest(new { message = "One or more selected products are unavailable." });
        var selectedCustomer = request.CustomerId.HasValue
            ? await db.Customers.SingleOrDefaultAsync(x => x.Id == request.CustomerId.Value && x.IsActive, ct)
            : null;
        if (request.CustomerId.HasValue && selectedCustomer is null) return NotFound(new { message = "The selected customer is unavailable." });
        var partyCompanyDiscounts = selectedCustomer is null
            ? new Dictionary<Guid, decimal>()
            : await db.CustomerManufacturerDiscounts.AsNoTracking()
                .Where(x => x.CustomerId == selectedCustomer.Id && x.IsActive && (!x.StartsAt.HasValue || x.StartsAt.Value.Date <= ApplicationTime.NepalNow.Date) && (!x.EndsAt.HasValue || x.EndsAt.Value.Date >= ApplicationTime.NepalNow.Date))
                .ToDictionaryAsync(x => x.ManufacturerId, x => x.DiscountPercent, ct);
        if (IsSalesExecutive)
        {
            var staffId = ActorId;
            var assignedProductIds = await db.Products.Where(product => productIds.Contains(product.Id) && db.SalesExecutiveProductAssignments.Any(assignment => assignment.SalesExecutiveUserId == staffId && assignment.IsActive &&
                ((assignment.ProductId.HasValue && assignment.ProductId.Value == product.Id) ||
                 (assignment.CategoryId.HasValue && product.Medicine != null && product.Medicine.CategoryId == assignment.CategoryId.Value))))
                .Select(product => product.Id).ToListAsync(ct);
            if (assignedProductIds.Count != productIds.Count) return Forbid();
        }
        var today = ApplicationTime.NepalNow.Date;
        var stockRows = await db.Inventory.Where(x => x.BranchId == branchId && productIds.Contains(x.ProductId) && x.StockQuantity > x.ReservedQuantity && (x.ExpiryDate == null || x.ExpiryDate.Value.Date >= today) && x.BatchStatus != "EXPIRED" && x.BatchStatus != "DEPLETED" && x.BatchStatus != "QUARANTINED" && x.BatchStatus != "RETURNED").OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.CreatedAt).ToListAsync(ct);
        var lines = new List<(Product Product, PosSaleItemRequest Request, decimal Unit, decimal LineTotal, int BaseQuantity, int UnitMultiplier)>();
        foreach (var item in request.Items)
        {
            var product = products[item.ProductId];
            var selectedUnit = string.IsNullOrWhiteSpace(item.Unit) ? product.SalesUnit : item.Unit.Trim();
            var multiplier = UnitMultiplier(product, selectedUnit, isSalesUnit: true);
            if (multiplier is null) return BadRequest(new { message = $"The unit '{item.Unit}' is not configured for {product.Name}." });
            var stockRequiredLong = ((long)item.Quantity + item.BonusQuantity) * multiplier.Value;
            if (stockRequiredLong > int.MaxValue) return BadRequest(new { message = $"The requested quantity for {product.Name} is too large." });
            var stockRequired = (int)stockRequiredLong;
            var matchingStocks = stockRows.Where(x => x.ProductId == item.ProductId && (!item.InventoryId.HasValue || x.Id == item.InventoryId.Value)).ToList();
            if (item.InventoryId.HasValue && matchingStocks.Count == 0) return Conflict(new { message = $"The selected batch for {product.Name} is no longer available at this branch. Refresh stock and choose another batch." });
            var available = matchingStocks.Sum(x => (long)x.StockQuantity - x.ReservedQuantity);
            if (available < stockRequired) return Conflict(new { message = $"Insufficient stock for {product.Name}. Available: {available}." });
            var companyDiscount = product.Medicine?.ManufacturerId is Guid manufacturerId ? partyCompanyDiscounts.GetValueOrDefault(manufacturerId) : 0m;
            var discount = Math.Clamp(product.DiscountPercent + companyDiscount + (item.DiscountPercent ?? 0m), 0m, 100m);
            var defaultSalesMultiplier = UnitMultiplier(product, product.SalesUnit, isSalesUnit: true) ?? Math.Max(1, product.SalesUnitToBase);
            var unit = Math.Max(0m, product.SellingPrice * multiplier.Value / defaultSalesMultiplier * (1m - discount / 100m));
            lines.Add((product, item with { Unit = selectedUnit }, unit, unit * item.Quantity, stockRequired, multiplier.Value));
        }
        var subtotal = lines.Sum(x => x.LineTotal);
        var taxRate = await db.TaxConfigurations.AsNoTracking().Where(x => x.IsActive).OrderByDescending(x => x.EffectiveFrom).Select(x => (decimal?)x.VatRate).FirstOrDefaultAsync(ct) ?? 13m;
        var tax = Math.Round(subtotal * taxRate / 100m, 2); var total = subtotal + tax;
        var paid = paymentMode == "CREDIT" ? 0m : Math.Clamp(request.PaidAmount ?? total, 0m, total);
        if (paymentMode == "PARTIAL" && (paid <= 0 || paid >= total)) return BadRequest(new { message = "Partial payment must be greater than zero and less than the invoice total." });
        if (paymentMode == "CREDIT" && request.PaidAmount > 0) return BadRequest(new { message = "Enter zero paid amount for a credit sale." });
        if ((paymentMode is "CASH" or "BANK_TRANSFER" or "CHEQUE") && paid != total) return BadRequest(new { message = "Cash, bank transfer and cheque sales must be paid in full; use Partial or Credit otherwise." });
        var customer = selectedCustomer;
        if (customer is null)
        {
            var phone = string.IsNullOrWhiteSpace(request.WalkInPhone) ? "WALK-IN" : request.WalkInPhone.Trim();
            var email = $"walkin-{Guid.NewGuid():N}@local.invalid";
            customer = new Customer { FullName = string.IsNullOrWhiteSpace(request.WalkInName) ? "Walk-in customer" : request.WalkInName.Trim(), Email = email, Phone = phone, PasswordHash = "POS-WALK-IN", AccountType = "PERSONAL", CustomerType = "RETAILER" };
            db.Customers.Add(customer);
        }
        var outstanding = total - paid;
        if (outstanding > 0 && request.CustomerId.HasValue && customer.CreditLimit > 0)
        {
            var currentBalance = await db.CustomerCredits.Where(x => x.CustomerId == customer.Id).Select(x => (decimal?)x.CurrentBalance).FirstOrDefaultAsync(ct) ?? 0m;
            if (currentBalance + outstanding > customer.CreditLimit) return Conflict(new { message = $"This sale exceeds the customer's credit limit of NPR {customer.CreditLimit:N2}.", creditLimit = customer.CreditLimit, currentBalance });
        }
        if (request.ReferenceCode?.Trim().Length > 120) return BadRequest(new { message = "Reference code cannot exceed 120 characters." });
        if (request.InsuranceProvider?.Trim().Length > 160 || request.InsurancePolicyNumber?.Trim().Length > 120) return BadRequest(new { message = "Insurance provider or policy number is too long." });
        if (!string.IsNullOrWhiteSpace(request.InsurancePolicyNumber) && string.IsNullOrWhiteSpace(request.InsuranceProvider)) return BadRequest(new { message = "Choose an insurance provider when entering a policy number." });
        var order = new PharmacyOrder { Customer = customer, BranchId = branchId, InsuranceProvider = string.IsNullOrWhiteSpace(request.InsuranceProvider) ? null : request.InsuranceProvider.Trim(), InsurancePolicyNumber = string.IsNullOrWhiteSpace(request.InsurancePolicyNumber) ? null : request.InsurancePolicyNumber.Trim(), OrderNumber = $"ANHH-POS-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Status = OrderStatuses.Delivered, PaymentStatus = paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID", PaymentMethod = paymentMode, DiscountAmount = lines.Sum(x => x.Product.SellingPrice * x.UnitMultiplier / (UnitMultiplier(x.Product, x.Product.SalesUnit, isSalesUnit: true) ?? Math.Max(1, x.Product.SalesUnitToBase)) * x.Request.Quantity - x.LineTotal), Total = total };
        foreach (var line in lines) order.Items.Add(new OrderItem { ProductId = line.Product.Id, ProductName = line.Product.Name, Quantity = line.Request.Quantity, BonusQuantity = line.Request.BonusQuantity, Unit = line.Request.Unit?.Trim() ?? line.Product.SalesUnit, UnitMultiplier = line.UnitMultiplier, UnitPrice = line.Unit });
        var invoice = new Invoice { Order = order, InvoiceNumber = $"ANHH-BILL-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Subtotal = subtotal, TaxAmount = tax, DiscountAmount = order.DiscountAmount, Total = total, PaidAmount = paid, IssuedAt = ApplicationTime.NepalNow, PaymentStatus = order.PaymentStatus, IsWholesale = customer.AccountType.Equals("PHARMACY", StringComparison.OrdinalIgnoreCase), Notes = string.IsNullOrWhiteSpace(request.ReferenceCode) ? null : $"REFCODE:{request.ReferenceCode.Trim()}" };
        db.Orders.Add(order); db.Invoices.Add(invoice);
        if (paid > 0) order.PaymentTransactions.Add(new PaymentTransaction { TransactionNumber = $"POS-PAY-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Method = paymentMode, Status = PaymentTransactionStatuses.Paid, Amount = paid, PaidAt = invoice.IssuedAt, Notes = $"Payment for {invoice.InvoiceNumber}" });
        foreach (var line in lines)
        {
            var remaining = line.BaseQuantity;
            foreach (var stock in stockRows.Where(x => x.ProductId == line.Product.Id && (!line.Request.InventoryId.HasValue || x.Id == line.Request.InventoryId.Value) && remaining > 0)) { var take = Math.Min(remaining, stock.StockQuantity - stock.ReservedQuantity); if (take <= 0) continue; var before = stock.StockQuantity; stock.StockQuantity -= take; remaining -= take; db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.Sale, Quantity = -take, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = line.Product.BaseUnit, ReferenceType = "POS_SALE", ReferenceId = order.Id.ToString(), Note = $"POS sale {order.OrderNumber}", ActorId = ActorId }); }
            if (remaining > 0) return Conflict(new { message = $"Available stock for {line.Product.Name} changed while billing. Refresh stock and try again." });
        }
        db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { Customer = customer, Invoice = invoice, EntryType = "DEBIT", Amount = total, EntryDate = invoice.IssuedAt, DueAt = invoice.IssuedAt.AddDays(customer.PaymentTermsDays), Description = $"POS sale {invoice.InvoiceNumber}" });
        if (paid > 0) db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { Customer = customer, Invoice = invoice, EntryType = "CREDIT", Amount = paid, EntryDate = invoice.IssuedAt, Description = $"Payment for {invoice.InvoiceNumber}" });
        if (outstanding > 0) { var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == customer.Id, ct); if (credit is null) db.CustomerCredits.Add(new CustomerCredit { Customer = customer, CreditLimit = customer.CreditLimit, CurrentBalance = outstanding }); else credit.CurrentBalance += outstanding; }
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "POS_SALE_CREATED", EntityType = "Invoice", EntityId = invoice.Id.ToString(), NewValue = invoice.InvoiceNumber });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(new { orderId = order.Id, invoiceId = invoice.Id, invoiceNumber = invoice.InvoiceNumber, total, paid, balance = total - paid, paymentStatus = invoice.PaymentStatus });
        });
    }

    [HttpPut("sales/{id:guid}")]
    public async Task<IActionResult> EditPosSale(Guid id, PosSaleEditRequest request, CancellationToken ct)
    {
        var input = request.Sale;
        var paymentMode = input.PaymentMode?.Trim().ToUpperInvariant() ?? "";
            if (!CanSell || request.Sale is null || input.Items is null || input.Items.Count == 0 || input.Items.Any(x => x.ProductId == Guid.Empty || x.Quantity <= 0 || x.BonusQuantity < 0 || x.DiscountPercent is < 0 or > 100) || !PaymentModes.Contains(paymentMode))
            return BadRequest(new { message = "Add valid sale lines and choose a supported payment mode." });
        if (input.Items.GroupBy(x => x.ProductId).Any(group => group.Count() > 1)) return BadRequest(new { message = "Add each product to the bill once." });
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 500) return BadRequest(new { message = "A correction reason of 1 to 500 characters is required." });
        if (input.ReferenceCode?.Trim().Length > 120) return BadRequest(new { message = "Reference code cannot exceed 120 characters." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var order = await ScopeOrders(db.Orders.Include(x => x.Invoice).Include(x => x.Items).Include(x => x.Customer).Include(x => x.PaymentTransactions))
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            if (order is null || order.BranchId is not Guid branchId) return NotFound(new { message = "The sale was not found in your operational scope." });
            if (!order.OrderNumber.StartsWith("ANHH-POS-", StringComparison.Ordinal) || order.Invoice is null)
                return Conflict(new { message = "Only a saved POS sale with an invoice can be edited here." });
            if (order.Status is OrderStatuses.Cancelled or OrderStatuses.Failed || order.Invoice.PaymentStatus == "VOID") return Conflict(new { message = "A voided sale cannot be edited." });
            if (!BranchAllowed(branchId) || input.BranchId.HasValue && input.BranchId.Value != branchId) return Forbid();
            if (await db.SaleReturns.AnyAsync(x => x.OrderId == order.Id && x.Status == "APPROVED", ct))
                return Conflict(new { message = "Cancel the posted sales returns first. A sale with approved returns cannot be edited safely." });

            var invoice = order.Invoice;
            var previousLedger = await db.CustomerLedgerEntries.Where(x => x.InvoiceId == invoice.Id).ToListAsync(ct);
            if (previousLedger.Any(entry => entry.Description != $"POS sale {invoice.InvoiceNumber}" && entry.Description != $"Payment for {invoice.InvoiceNumber}" && !entry.Description.StartsWith("Sale edit reversal ", StringComparison.Ordinal)))
                return Conflict(new { message = "This invoice has separate customer receipts or ledger adjustments. Reverse those linked entries before editing the sale." });
            if (order.PaymentTransactions.Any(payment => payment.Status != PaymentTransactionStatuses.Refunded && payment.Notes != $"Payment for {invoice.InvoiceNumber}" && payment.Notes != $"Replacement payment for {invoice.InvoiceNumber}"))
                return Conflict(new { message = "This invoice has a separately recorded payment or refund. Reconcile that payment before editing the sale." });
            var originalMovements = await db.StockTransactions.Where(x => x.Type == StockTransactionTypes.Sale && x.ReferenceType == "POS_SALE" && x.ReferenceId == order.Id.ToString()).ToListAsync(ct);
            if (originalMovements.Count == 0) return Conflict(new { message = "The original POS batch movements are missing; this invoice cannot be edited safely." });

            var productIds = input.Items.Select(x => x.ProductId).Distinct().ToList();
            var products = await db.Products.Include(x => x.Medicine).Include(x => x.Units).Where(x => productIds.Contains(x.Id) && x.IsActive).ToDictionaryAsync(x => x.Id, ct);
            if (products.Count != productIds.Count) return BadRequest(new { message = "One or more selected products are unavailable." });
            if (IsSalesExecutive)
            {
                var staffId = ActorId;
                var assignedIds = await db.Products.Where(product => productIds.Contains(product.Id) && db.SalesExecutiveProductAssignments.Any(assignment => assignment.SalesExecutiveUserId == staffId && assignment.IsActive &&
                    ((assignment.ProductId.HasValue && assignment.ProductId.Value == product.Id) || (assignment.CategoryId.HasValue && product.Medicine != null && product.Medicine.CategoryId == assignment.CategoryId.Value))))
                    .Select(product => product.Id).ToListAsync(ct);
                if (assignedIds.Count != productIds.Count) return Forbid();
            }

            var oldCustomerId = order.CustomerId;
            Customer? customer;
            if (input.CustomerId.HasValue)
            {
                customer = await db.Customers.SingleOrDefaultAsync(x => x.Id == input.CustomerId.Value && x.IsActive, ct);
                if (customer is null) return NotFound(new { message = "The selected customer is unavailable." });
            }
            else if (order.Customer is not null && order.Customer.Email.EndsWith("@local.invalid", StringComparison.OrdinalIgnoreCase))
            {
                customer = order.Customer;
                customer.FullName = string.IsNullOrWhiteSpace(input.WalkInName) ? "Walk-in customer" : input.WalkInName.Trim();
                customer.Phone = string.IsNullOrWhiteSpace(input.WalkInPhone) ? "WALK-IN" : input.WalkInPhone.Trim();
            }
            else
            {
                customer = new Customer { FullName = string.IsNullOrWhiteSpace(input.WalkInName) ? "Walk-in customer" : input.WalkInName.Trim(), Email = $"walkin-{Guid.NewGuid():N}@local.invalid", Phone = string.IsNullOrWhiteSpace(input.WalkInPhone) ? "WALK-IN" : input.WalkInPhone.Trim(), PasswordHash = "POS-WALK-IN", AccountType = "PERSONAL", CustomerType = "RETAILER" };
                db.Customers.Add(customer);
            }
            var companyDiscounts = await db.CustomerManufacturerDiscounts.AsNoTracking()
                .Where(x => x.CustomerId == customer.Id && x.IsActive && (!x.StartsAt.HasValue || x.StartsAt.Value.Date <= ApplicationTime.NepalNow.Date) && (!x.EndsAt.HasValue || x.EndsAt.Value.Date >= ApplicationTime.NepalNow.Date))
                .ToDictionaryAsync(x => x.ManufacturerId, x => x.DiscountPercent, ct);
            var preparedLines = new List<(Product Product, PosSaleItemRequest Request, decimal UnitPrice, decimal LineTotal, int BaseQuantity, int Multiplier)>();
            foreach (var item in input.Items)
            {
                var product = products[item.ProductId];
                var unitName = string.IsNullOrWhiteSpace(item.Unit) ? product.SalesUnit : item.Unit.Trim();
                var multiplier = UnitMultiplier(product, unitName, isSalesUnit: true);
                if (multiplier is null) return BadRequest(new { message = $"The unit '{unitName}' is not configured for {product.Name}." });
                var baseQuantityLong = ((long)item.Quantity + item.BonusQuantity) * multiplier.Value;
                if (baseQuantityLong > int.MaxValue) return BadRequest(new { message = $"The requested quantity for {product.Name} is too large." });
                var manufacturerDiscount = product.Medicine?.ManufacturerId is Guid manufacturerId ? companyDiscounts.GetValueOrDefault(manufacturerId) : 0m;
                var discount = Math.Clamp(product.DiscountPercent + manufacturerDiscount + (item.DiscountPercent ?? 0m), 0m, 100m);
                var defaultMultiplier = UnitMultiplier(product, product.SalesUnit, isSalesUnit: true) ?? Math.Max(1, product.SalesUnitToBase);
                var unitPrice = Math.Max(0m, product.SellingPrice * multiplier.Value / defaultMultiplier * (1m - discount / 100m));
                preparedLines.Add((product, item with { Unit = unitName }, unitPrice, unitPrice * item.Quantity, (int)baseQuantityLong, multiplier.Value));
            }
            var subtotal = preparedLines.Sum(x => x.LineTotal);
            var vatRate = await db.TaxConfigurations.AsNoTracking().Where(x => x.IsActive).OrderByDescending(x => x.EffectiveFrom).Select(x => (decimal?)x.VatRate).FirstOrDefaultAsync(ct) ?? 13m;
            var vat = Math.Round(subtotal * vatRate / 100m, 2);
            var total = subtotal + vat;
            var paid = paymentMode == "CREDIT" ? 0m : Math.Clamp(input.PaidAmount ?? total, 0m, total);
            if (paymentMode == "PARTIAL" && (paid <= 0 || paid >= total)) return BadRequest(new { message = "Partial payment must be greater than zero and less than the invoice total." });
            if (paymentMode == "CREDIT" && input.PaidAmount > 0) return BadRequest(new { message = "Enter zero paid amount for a credit sale." });
            if ((paymentMode is "CASH" or "BANK_TRANSFER" or "CHEQUE") && paid != total) return BadRequest(new { message = "Cash, bank transfer and cheque sales must be paid in full; use Partial or Credit otherwise." });
            if (input.InsuranceProvider?.Trim().Length > 160 || input.InsurancePolicyNumber?.Trim().Length > 120 || !string.IsNullOrWhiteSpace(input.InsurancePolicyNumber) && string.IsNullOrWhiteSpace(input.InsuranceProvider))
                return BadRequest(new { message = "Enter a valid insurance provider and policy reference." });

            var previousTotal = invoice.Total;
            var originalOutstanding = Math.Max(0m, previousTotal - invoice.PaidAmount);
            var outstanding = total - paid;
            if (outstanding > 0 && input.CustomerId.HasValue && customer.CreditLimit > 0)
            {
                var currentBalance = await db.CustomerCredits.Where(x => x.CustomerId == customer.Id).Select(x => (decimal?)x.CurrentBalance).FirstOrDefaultAsync(ct) ?? 0m;
                var balanceWithoutOriginal = customer.Id == oldCustomerId ? Math.Max(0m, currentBalance - originalOutstanding) : currentBalance;
                if (balanceWithoutOriginal + outstanding > customer.CreditLimit) return Conflict(new { message = $"This edit exceeds the customer's credit limit of NPR {customer.CreditLimit:N2}.", creditLimit = customer.CreditLimit, currentBalance = balanceWithoutOriginal });
            }

            var now = ApplicationTime.NepalNow;
            foreach (var movement in originalMovements)
            {
                var stock = await db.Inventory.SingleOrDefaultAsync(x => x.Id == movement.InventoryId && x.BranchId == branchId, ct);
                var restore = Math.Max(0, -movement.Quantity);
                if (stock is null || restore == 0 || stock.StockQuantity > int.MaxValue - restore) return Conflict(new { message = "The original batch stock history cannot be restored safely." });
                var before = stock.StockQuantity;
                stock.StockQuantity += restore;
                stock.UpdatedAt = now;
                movement.Type = "SALE_CORRECTED";
                movement.Note = $"Corrected POS sale {order.OrderNumber}";
                movement.Reason = request.Reason.Trim();
                db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.VoidReversal, Quantity = restore, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = stock.Product?.BaseUnit ?? "base", ReferenceType = "POS_SALE_EDIT_RESTORE", ReferenceId = order.Id.ToString(), Reason = request.Reason.Trim(), Note = $"Stock restored for POS sale edit {order.OrderNumber}", ActorId = ActorId });
            }

            var sellableStocks = await db.Inventory.Include(x => x.Product).Where(x => x.BranchId == branchId && productIds.Contains(x.ProductId) && x.StockQuantity > x.ReservedQuantity && (x.ExpiryDate == null || x.ExpiryDate.Value.Date >= now.Date) && x.BatchStatus != "EXPIRED" && x.BatchStatus != "DEPLETED" && x.BatchStatus != "QUARANTINED" && x.BatchStatus != "RETURNED")
                .OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.CreatedAt).ToListAsync(ct);
            foreach (var line in preparedLines)
            {
                var matchingStocks = sellableStocks.Where(x => x.ProductId == line.Product.Id && (!line.Request.InventoryId.HasValue || x.Id == line.Request.InventoryId.Value)).ToList();
                if (line.Request.InventoryId.HasValue && matchingStocks.Count == 0) return Conflict(new { message = $"The selected batch for {line.Product.Name} is no longer available at this branch. Refresh stock and choose another batch." });
                var available = matchingStocks.Sum(x => (long)x.StockQuantity - x.ReservedQuantity);
                if (available < line.BaseQuantity) return Conflict(new { message = $"Insufficient saleable stock for {line.Product.Name}. Available: {available}." });
            }

            var previousPaid = invoice.PaidAmount;
            foreach (var payment in order.PaymentTransactions.Where(x => x.Status == PaymentTransactionStatuses.Paid))
            {
                payment.Status = PaymentTransactionStatuses.Refunded;
                payment.RefundedAt = now;
                payment.Notes = $"Reversed for sale correction {order.OrderNumber}: {request.Reason.Trim()}";
            }
            foreach (var entry in previousLedger)
            {
                var opposite = entry.EntryType == "DEBIT" ? "CREDIT" : "DEBIT";
                db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = entry.CustomerId, InvoiceId = invoice.Id, EntryType = opposite, Amount = entry.Amount, EntryDate = now, Description = $"Sale edit reversal {invoice.InvoiceNumber}", Reference = request.Reason.Trim() });
            }
            var oldCredit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == oldCustomerId, ct);
            if (oldCredit is not null && originalOutstanding > 0) oldCredit.CurrentBalance = Math.Max(0m, oldCredit.CurrentBalance - originalOutstanding);

            order.CustomerId = customer.Id; order.Customer = customer; order.PaymentMethod = paymentMode;
            order.InsuranceProvider = string.IsNullOrWhiteSpace(input.InsuranceProvider) ? null : input.InsuranceProvider.Trim();
            order.InsurancePolicyNumber = string.IsNullOrWhiteSpace(input.InsurancePolicyNumber) ? null : input.InsurancePolicyNumber.Trim();
            order.DiscountAmount = preparedLines.Sum(x => x.Product.SellingPrice * x.Multiplier / (UnitMultiplier(x.Product, x.Product.SalesUnit, isSalesUnit: true) ?? Math.Max(1, x.Product.SalesUnitToBase)) * x.Request.Quantity - x.LineTotal);
            order.Total = total; order.PaymentStatus = paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
            invoice.Subtotal = subtotal; invoice.TaxAmount = vat; invoice.DiscountAmount = order.DiscountAmount; invoice.Total = total; invoice.PaidAmount = paid;
            invoice.PaymentStatus = order.PaymentStatus; invoice.IsWholesale = customer.AccountType.Equals("PHARMACY", StringComparison.OrdinalIgnoreCase); invoice.Notes = $"{(string.IsNullOrWhiteSpace(input.ReferenceCode) ? "" : $"REFCODE:{input.ReferenceCode.Trim()}|")}Edited {now:yyyy-MM-dd HH:mm:ss} Asia/Kathmandu · {request.Reason.Trim()}";
            order.Items.Clear();
            foreach (var line in preparedLines)
            {
                order.Items.Add(new OrderItem { ProductId = line.Product.Id, ProductName = line.Product.Name, Quantity = line.Request.Quantity, BonusQuantity = line.Request.BonusQuantity, Unit = line.Request.Unit?.Trim() ?? line.Product.SalesUnit, UnitMultiplier = line.Multiplier, UnitPrice = line.UnitPrice });
                var remaining = line.BaseQuantity;
                foreach (var stock in sellableStocks.Where(x => x.ProductId == line.Product.Id && (!line.Request.InventoryId.HasValue || x.Id == line.Request.InventoryId.Value) && remaining > 0))
                {
                    var take = Math.Min(remaining, stock.StockQuantity - stock.ReservedQuantity); if (take <= 0) continue;
                    var before = stock.StockQuantity; stock.StockQuantity -= take; remaining -= take;
                    db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.Sale, Quantity = -take, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = line.Product.BaseUnit, ReferenceType = "POS_SALE", ReferenceId = order.Id.ToString(), Note = $"POS sale {order.OrderNumber} (edited)", Reason = request.Reason.Trim(), ActorId = ActorId });
                }
            }
            db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = customer.Id, InvoiceId = invoice.Id, EntryType = "DEBIT", Amount = total, EntryDate = now, DueAt = now.AddDays(customer.PaymentTermsDays), Description = $"POS sale {invoice.InvoiceNumber}" });
            if (paid > 0) db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = customer.Id, InvoiceId = invoice.Id, EntryType = "CREDIT", Amount = paid, EntryDate = now, Description = $"Payment for {invoice.InvoiceNumber}" });
            if (outstanding > 0)
            {
                var newCredit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == customer.Id, ct);
                if (newCredit is null) db.CustomerCredits.Add(new CustomerCredit { CustomerId = customer.Id, CreditLimit = customer.CreditLimit, CurrentBalance = outstanding });
                else newCredit.CurrentBalance += outstanding;
            }
            if (paid > 0) order.PaymentTransactions.Add(new PaymentTransaction { TransactionNumber = $"POS-EDIT-PAY-{now:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Method = paymentMode, Status = PaymentTransactionStatuses.Paid, Amount = paid, PaidAt = now, Notes = $"Replacement payment for {invoice.InvoiceNumber}" });
            order.StatusHistory.Add(new OrderStatusHistory { Status = order.Status, Note = $"POS sale edited: {request.Reason.Trim()}", ActorId = ActorId.ToString(), ActorRole = ActorRole });
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "POS_SALE_EDITED", EntityType = "Invoice", EntityId = invoice.Id.ToString(), PreviousValue = $"Paid {previousPaid:0.00}; total before {previousTotal:0.00}", NewValue = $"{invoice.InvoiceNumber}; total {total:0.00}; {request.Reason.Trim()}", IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(new { orderId = order.Id, invoiceId = invoice.Id, invoiceNumber = invoice.InvoiceNumber, total, paid, balance = total - paid, paymentStatus = invoice.PaymentStatus });
        });
    }

    [HttpPost("purchase-receipts")]
    public async Task<IActionResult> ReceivePurchase(PurchaseReceiptRequest request, CancellationToken ct)
    {
        if (!CanPurchase) return Forbid();
        var paymentMode = request.PaymentMode?.Trim().ToUpperInvariant() ?? "";
        if (!BranchAllowed(request.BranchId) || request.Items.Count == 0 || request.Items.Any(x => x.ProductId == Guid.Empty || x.Quantity <= 0 || x.UnitCost < 0 || x.BatchNumber?.Trim().Length > 80) || !PaymentModes.Contains(paymentMode)) return BadRequest(new { message = "Branch, valid purchase items and a valid payment method are required." });
        if (request.Items.Any(x => x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date < ApplicationTime.NepalNow.Date)) return BadRequest(new { message = "Expired stock cannot be received into saleable inventory." });
        if (request.SupplierInvoiceNumber?.Trim().Length > 80 || request.Notes?.Trim().Length > 1000) return BadRequest(new { message = "The supplier reference or notes exceed the allowed length." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var supplier = await db.Suppliers.SingleOrDefaultAsync(x => x.Id == request.SupplierId && x.IsActive, ct);
            if (supplier is null) return NotFound(new { message = "Supplier not found." });
            var productIds = request.Items.Select(x => x.ProductId).Distinct().ToList();
            var products = await db.Products.Include(x => x.Medicine).Include(x => x.Units).Where(x => productIds.Contains(x.Id) && x.IsActive).ToDictionaryAsync(x => x.Id, ct);
            if (products.Count != productIds.Count) return BadRequest(new { message = "One or more products are unavailable." });

            var supplierCompanyDiscounts = await db.SupplierManufacturerDiscounts.AsNoTracking()
                .Where(x => x.SupplierId == supplier.Id && x.IsActive && (!x.StartsAt.HasValue || x.StartsAt.Value.Date <= ApplicationTime.NepalNow.Date) && (!x.EndsAt.HasValue || x.EndsAt.Value.Date >= ApplicationTime.NepalNow.Date))
                .ToDictionaryAsync(x => x.ManufacturerId, x => x.DiscountPercent, ct);
            decimal DiscountedCost(PurchaseReceiptItemRequest item)
            {
                var product = products[item.ProductId];
                var discount = product.Medicine?.ManufacturerId is Guid manufacturerId ? supplierCompanyDiscounts.GetValueOrDefault(manufacturerId) : 0m;
                return item.UnitCost * (1m - Math.Clamp(discount, 0m, 100m) / 100m);
            }

            var orderNumber = $"ANHH-GRN-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}";
            var totalAmount = request.Items.Sum(x => x.Quantity * DiscountedCost(x));
            var paid = paymentMode == "CREDIT" ? 0m : request.PaidAmount ?? totalAmount;
            if (paid < 0 || paid > totalAmount || paymentMode == "PARTIAL" && (paid <= 0 || paid >= totalAmount) || paymentMode != "CREDIT" && paymentMode != "PARTIAL" && paid != totalAmount) return BadRequest(new { message = "Credit must have no payment, partial payment must be less than the purchase total, and other payment modes must pay the full amount." });
            if (paymentMode == "CREDIT" && request.PaidAmount > 0) return BadRequest(new { message = "Enter zero paid amount for a credit purchase." });
            var invoiceNumber = string.IsNullOrWhiteSpace(request.SupplierInvoiceNumber) ? orderNumber : request.SupplierInvoiceNumber.Trim();
            if (await db.SupplierInvoices.AnyAsync(x => x.SupplierId == supplier.Id && x.InvoiceNumber == invoiceNumber, ct)) return Conflict(new { message = "A supplier invoice with this reference is already recorded." });

            var purchase = new PurchaseOrder { SupplierId = supplier.Id, BranchId = request.BranchId, OrderNumber = orderNumber, Status = PurchaseOrderStatuses.Received, PaymentMethod = paymentMode, TotalAmount = totalAmount, Notes = request.Notes?.Trim(), PaymentStatus = paid >= totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" };
            var batchKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in request.Items)
            {
                var product = products[item.ProductId];
                var selectedUnit = string.IsNullOrWhiteSpace(item.Unit) ? product.PurchaseUnit : item.Unit.Trim();
                var multiplier = UnitMultiplier(product, selectedUnit, isPurchaseUnit: true);
                if (multiplier is null) return BadRequest(new { message = $"The unit '{selectedUnit}' is not configured as a purchase unit for {product.Name}." });
                var baseQuantityLong = (long)item.Quantity * multiplier.Value;
                if (baseQuantityLong > int.MaxValue) return BadRequest(new { message = $"The received quantity for {product.Name} is too large." });
                var batch = string.IsNullOrWhiteSpace(item.BatchNumber) ? $"GRN-{orderNumber}-{item.ProductId.ToString()[..6]}" : item.BatchNumber.Trim();
                if (!batchKeys.Add($"{item.ProductId:N}:{batch}")) return BadRequest(new { message = $"Batch {batch} for {product.Name} appears more than once. Combine the lines or use separate batch numbers." });
                var baseQuantity = (int)baseQuantityLong;
                var discountedUnitCost = DiscountedCost(item);
                var baseCost = discountedUnitCost / multiplier.Value;
                var expiryDate = item.ExpiryDate?.Date;
                purchase.Items.Add(new PurchaseOrderItem { ProductId = item.ProductId, ProductName = product.Name, QuantityOrdered = item.Quantity, QuantityReceived = item.Quantity, Unit = selectedUnit, UnitMultiplier = multiplier.Value, UnitCost = discountedUnitCost, BatchNumber = batch, ExpiryDate = expiryDate });
                var stock = await db.Inventory.SingleOrDefaultAsync(x => x.ProductId == item.ProductId && x.BranchId == request.BranchId && x.BatchNumber == batch, ct);
                if (stock is null)
                {
                    stock = new Inventory { ProductId = item.ProductId, BranchId = request.BranchId, BatchNumber = batch, PurchaseOrder = purchase, PurchasePrice = baseCost, SellingPrice = product.SellingPrice, Mrp = product.Mrp, ExpiryDate = expiryDate, StockQuantity = 0, ReservedQuantity = 0, SupplierId = supplier.Id, Supplier = supplier.Name, PurchaseReference = request.SupplierInvoiceNumber?.Trim(), BatchStatus = "ACTIVE" };
                    db.Inventory.Add(stock);
                }
                else if (stock.SupplierId.HasValue && stock.SupplierId.Value != supplier.Id)
                {
                    return Conflict(new { message = $"Batch {batch} is already linked to a different supplier." });
                }
                if (stock.BatchStatus is "QUARANTINED" or "RETURNED") return Conflict(new { message = $"Batch {batch} is quarantined or returned and cannot receive more saleable stock." });
                var updatedQuantity = (long)stock.StockQuantity + baseQuantity;
                if (updatedQuantity > int.MaxValue) return BadRequest(new { message = $"The resulting stock for {product.Name}, batch {batch}, exceeds the supported quantity." });
                var before = stock.StockQuantity;
                stock.StockQuantity = (int)updatedQuantity;
                stock.PurchaseOrder ??= purchase;
                stock.PurchasePrice = baseCost;
                stock.SellingPrice = product.SellingPrice;
                stock.Mrp = product.Mrp;
                stock.ExpiryDate = expiryDate ?? stock.ExpiryDate;
                stock.SupplierId = supplier.Id;
                stock.Supplier = supplier.Name;
                stock.PurchaseReference = request.SupplierInvoiceNumber?.Trim() ?? stock.PurchaseReference;
                stock.BatchStatus = stock.BatchStatus == "EXPIRED" || stock.ExpiryDate.HasValue && stock.ExpiryDate.Value.Date < ApplicationTime.NepalNow.Date ? "EXPIRED" : "ACTIVE";
                db.StockTransactions.Add(new StockTransaction { Inventory = stock, BranchId = request.BranchId, Type = StockTransactionTypes.Purchase, Quantity = baseQuantity, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = product.BaseUnit, ReferenceType = "PURCHASE_RECEIPT", ReferenceId = purchase.Id.ToString(), Note = $"Purchase receipt {purchase.OrderNumber}", ActorId = ActorId });
            }
            db.PurchaseOrders.Add(purchase);
            var supplierInvoice = new SupplierInvoice { SupplierId = supplier.Id, PurchaseOrder = purchase, BranchId = request.BranchId, InvoiceNumber = invoiceNumber, InvoiceDate = ApplicationTime.NepalNow, Subtotal = totalAmount, Total = totalAmount, PaidAmount = paid, Status = purchase.PaymentStatus, Notes = request.Notes?.Trim() };
            db.SupplierInvoices.Add(supplierInvoice);
            if (paid > 0) db.SupplierPayments.Add(new SupplierPayment { SupplierId = supplier.Id, BranchId = request.BranchId, PaymentNumber = $"SPAY-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Amount = paid, Method = paymentMode, PaymentDate = ApplicationTime.NepalNow, Notes = $"Payment for {supplierInvoice.InvoiceNumber}" });
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "PURCHASE_RECEIVED", EntityType = "PurchaseOrder", EntityId = purchase.Id.ToString(), NewValue = purchase.OrderNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(new { purchaseId = purchase.Id, invoiceId = supplierInvoice.Id, invoiceNumber = supplierInvoice.InvoiceNumber, total = totalAmount, paid, balance = totalAmount - paid, paymentMethod = purchase.PaymentMethod });
        });
    }

    [HttpPost("sales-returns")]
    public async Task<IActionResult> CreateSalesReturn(SalesReturnRequest request, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 500) return BadRequest(new { message = "A sales-return reason of 1 to 500 characters is required." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var order = await ScopeOrders(db.Orders.Include(x => x.Items).Include(x => x.Customer)).SingleOrDefaultAsync(x => x.Id == request.OrderId, ct);
        if (order is null || order.Status is OrderStatuses.Cancelled or OrderStatuses.Failed || order.BranchId is not Guid branchId) return NotFound(new { message = "The sale could not be found in your operational scope." });
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

        var amount = sold.UnitPrice * request.Quantity;
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
            var baseUnitPrice = sold.UnitPrice / multiplier;
            saleReturn.Items.Add(new SaleReturnItem { ProductId = request.ProductId, BatchNumber = batch.Stock.BatchNumber, Quantity = quantity, UnitPrice = baseUnitPrice, TotalAmount = baseUnitPrice * quantity });
            db.StockTransactions.Add(new StockTransaction { InventoryId = batch.Stock.Id, BranchId = batch.Stock.BranchId, Type = StockTransactionTypes.SalesReturn, Quantity = quantity, QuantityBefore = before, QuantityAfter = batch.Stock.StockQuantity, Unit = batch.Stock.Product?.BaseUnit ?? "piece", ReferenceType = "SALES_RETURN", ReferenceId = saleReturn.Id.ToString(), Reason = request.Reason?.Trim(), Note = $"{saleReturn.ReturnType} sales return {saleReturn.ReturnNumber}", BatchStatusBefore = batchStatusBefore, BatchStatusAfter = batch.Stock.BatchStatus, ActorId = ActorId });
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
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "SALES_RETURN_APPROVED", EntityType = "SaleReturn", EntityId = saleReturn.Id.ToString(), NewValue = saleReturn.ReturnNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(new { returnNumber = saleReturn.ReturnNumber, amount, creditRelief, cashRefund, refundMethod, status = saleReturn.Status });
        });
    }

    [HttpPost("purchase-returns")]
    public async Task<IActionResult> CreatePurchaseReturn(PurchaseReturnRequest request, CancellationToken ct)
    {
        if (!CanPurchase || !BranchAllowed(request.BranchId)) return Forbid();
        if (request.Quantity <= 0) return BadRequest(new { message = "Return quantity must be positive." });
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 500) return BadRequest(new { message = "A purchase-return reason of 1 to 500 characters is required." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var stock = await db.Inventory.SingleOrDefaultAsync(x => x.Id == request.InventoryId && x.BranchId == request.BranchId, ct); if (stock is null) return NotFound(new { message = "The inventory batch could not be found." });
        if (request.Quantity > stock.StockQuantity - stock.ReservedQuantity) return Conflict(new { message = "The return quantity is greater than available stock." });
        var supplier = await db.Suppliers.SingleOrDefaultAsync(x => x.Id == request.SupplierId && x.IsActive, ct); if (supplier is null) return NotFound(new { message = "Supplier not found." });
        if (stock.SupplierId.HasValue && stock.SupplierId.Value != supplier.Id) return BadRequest(new { message = "Choose the supplier recorded against this batch." });
        var sameSupplierBatchIds = await db.Inventory.AsNoTracking()
            .Where(x => x.ProductId == stock.ProductId && x.BranchId == stock.BranchId && x.BatchNumber == stock.BatchNumber && x.SupplierId == supplier.Id)
            .Select(x => x.Id).ToListAsync(ct);
        var quantityReceived = await db.StockTransactions.AsNoTracking()
            .Where(x => sameSupplierBatchIds.Contains(x.InventoryId) && x.Type == StockTransactionTypes.Purchase)
            .SumAsync(x => (long?)x.Quantity, ct) ?? 0L;
        var quantityPreviouslyReturned = await db.PurchaseReturnItems.AsNoTracking()
            .Where(x => x.PurchaseReturn!.Status == "APPROVED" && x.PurchaseReturn.BranchId == stock.BranchId
                && x.PurchaseReturn.SupplierId == supplier.Id && x.ProductId == stock.ProductId && x.BatchNumber == stock.BatchNumber)
            .SumAsync(x => (long?)x.Quantity, ct) ?? 0L;
        var returnEligible = Math.Max(0L, quantityReceived - quantityPreviouslyReturned);
        if (request.Quantity > returnEligible) return Conflict(new { message = $"This return exceeds the remaining supplier-received quantity for batch {stock.BatchNumber} ({returnEligible} base units)." });
        var amount = stock.PurchasePrice * request.Quantity;
        var supplierInvoiceQuery = db.SupplierInvoices.Where(x => x.SupplierId == supplier.Id && x.Status != "VOID");
        if (stock.PurchaseOrderId.HasValue) supplierInvoiceQuery = supplierInvoiceQuery.Where(x => x.PurchaseOrderId == stock.PurchaseOrderId.Value);
        else if (!string.IsNullOrWhiteSpace(stock.PurchaseReference)) supplierInvoiceQuery = supplierInvoiceQuery.Where(x => x.InvoiceNumber == stock.PurchaseReference);
        else return Conflict(new { message = "This batch is missing its original supplier invoice link, so the return cannot safely change the supplier ledger." });
        var supplierInvoice = await supplierInvoiceQuery.OrderByDescending(x => x.InvoiceDate).FirstOrDefaultAsync(ct);
        if (supplierInvoice is null) return Conflict(new { message = "The original supplier invoice for this batch could not be found." });
        if (amount > supplierInvoice.Total) return Conflict(new { message = "This return is larger than the original supplier invoice value for the batch." });
        var linkedPurchaseOrderId = stock.PurchaseOrderId ?? supplierInvoice.PurchaseOrderId;
        var item = new PurchaseReturn { ReturnNumber = $"ANHH-PR-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", PurchaseOrderId = linkedPurchaseOrderId, SupplierInvoiceId = supplierInvoice.Id, SupplierId = supplier.Id, BranchId = request.BranchId, ReturnDate = ApplicationTime.NepalNow, Status = "APPROVED", TotalAmount = amount, Reason = request.Reason?.Trim() };
        item.Items.Add(new PurchaseReturnItem { ProductId = stock.ProductId, BatchNumber = stock.BatchNumber, Quantity = request.Quantity, UnitCost = stock.PurchasePrice, TotalAmount = amount });
        var before = stock.StockQuantity; stock.StockQuantity -= request.Quantity; db.PurchaseReturns.Add(item); db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.PurchaseReturn, Quantity = -request.Quantity, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = stock.Product?.BaseUnit ?? "base", ReferenceType = "PURCHASE_RETURN", ReferenceId = item.Id.ToString(), Reason = request.Reason?.Trim(), Note = $"Purchase return {item.ReturnNumber}", ActorId = ActorId });
        supplierInvoice.Total -= amount;
        supplierInvoice.Subtotal = Math.Max(0m, supplierInvoice.Subtotal - amount);
        supplierInvoice.Status = supplierInvoice.PaidAmount >= supplierInvoice.Total ? "PAID" : supplierInvoice.PaidAmount > 0 ? "PARTIAL" : "UNPAID";
        if (linkedPurchaseOrderId is Guid purchaseOrderId)
            await SyncPurchaseOrderPaymentStatus(purchaseOrderId, ct);
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "PURCHASE_RETURN_APPROVED", EntityType = "PurchaseReturn", EntityId = item.Id.ToString(), NewValue = item.ReturnNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(new { returnNumber = item.ReturnNumber, amount, status = item.Status });
        });
    }

    [HttpPost("sales-returns/{id:guid}/cancel")]
    public async Task<IActionResult> CancelSalesReturn(Guid id, VoidTransactionRequest request, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 500)
            return BadRequest(new { message = "A cancellation reason of 1 to 500 characters is required." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var saleReturn = await db.SaleReturns.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (saleReturn is null || !BranchAllowed(saleReturn.BranchId)) return NotFound(new { message = "The sales return was not found in your operational scope." });
            if (saleReturn.Status != "APPROVED") return Conflict(new { message = "Only an approved sales return can be cancelled." });
            if (!saleReturn.OrderId.HasValue) return Conflict(new { message = "This return is not linked to a sale, so its ledger impact cannot be safely reversed." });
            var order = await ScopeOrders(db.Orders.Include(x => x.Invoice).Include(x => x.PaymentTransactions))
                .SingleOrDefaultAsync(x => x.Id == saleReturn.OrderId.Value, ct);
            if (order is null) return NotFound(new { message = "The source sale was not found in your operational scope." });

            var originalReturnMovements = await db.StockTransactions.AsNoTracking()
                .Where(x => x.ReferenceType == "SALES_RETURN" && x.ReferenceId == saleReturn.Id.ToString())
                .ToListAsync(ct);

            foreach (var group in saleReturn.Items.GroupBy(x => (x.ProductId, x.BatchNumber)))
            {
                var quantity = group.Sum(x => x.Quantity);
                var stock = await db.Inventory.SingleOrDefaultAsync(x => x.BranchId == saleReturn.BranchId && x.ProductId == group.Key.ProductId && x.BatchNumber == group.Key.BatchNumber, ct);
                if (stock is null || stock.StockQuantity - stock.ReservedQuantity < quantity)
                    return Conflict(new { message = $"Batch {group.Key.BatchNumber} has been sold or reserved since this return. Resolve those units before cancelling the return." });
                var before = stock.StockQuantity;
                stock.StockQuantity -= quantity;
                stock.UpdatedAt = ApplicationTime.NepalNow;
                var batchStatusBefore = stock.BatchStatus;
                if (saleReturn.ReturnType == "EXPIRED")
                {
                    var otherExpiredReturnExists = await db.SaleReturnItems.AsNoTracking().AnyAsync(item => item.SaleReturnId != saleReturn.Id
                        && item.ProductId == group.Key.ProductId && item.BatchNumber == group.Key.BatchNumber
                        && item.SaleReturn!.BranchId == saleReturn.BranchId && item.SaleReturn.Status == "APPROVED"
                        && item.SaleReturn.ReturnType == "EXPIRED", ct);
                    if (!otherExpiredReturnExists)
                    {
                        var originalStatus = originalReturnMovements.FirstOrDefault(x => x.InventoryId == stock.Id)?.BatchStatusBefore;
                        stock.BatchStatus = stock.ExpiryDate.HasValue && stock.ExpiryDate.Value.Date < ApplicationTime.NepalNow.Date
                            ? "EXPIRED"
                            : originalStatus ?? "ACTIVE";
                    }
                }
                db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.VoidReversal, Quantity = -quantity, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = stock.Product?.BaseUnit ?? "base", ReferenceType = "SALES_RETURN_CANCEL", ReferenceId = saleReturn.Id.ToString(), Reason = request.Reason.Trim(), Note = $"Cancellation reversal for {saleReturn.ReturnNumber}", BatchStatusBefore = batchStatusBefore, BatchStatusAfter = stock.BatchStatus, ActorId = ActorId });
            }

            var invoice = order.Invoice;
            var cashRefund = saleReturn.CashRefundAmount;
            var creditRelief = saleReturn.CreditReliefAmount;
            if (saleReturn.RefundMethod is null)
            {
                cashRefund = await db.PaymentTransactions.AsNoTracking().Where(x => x.OrderId == order.Id && x.Status == PaymentTransactionStatuses.Refunded && x.Notes != null && x.Notes.Contains(saleReturn.ReturnNumber)).SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
                creditRelief = await db.CustomerLedgerEntries.AsNoTracking().Where(x => x.CustomerId == saleReturn.CustomerId && x.EntryType == "CREDIT" && x.Description == $"Sales return {saleReturn.ReturnNumber}").SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
            }
            if (invoice is not null)
            {
                invoice.Total += saleReturn.TotalAmount;
                invoice.Subtotal += saleReturn.TotalAmount;
                invoice.PaidAmount += cashRefund;
                invoice.PaymentStatus = invoice.PaidAmount >= invoice.Total ? "PAID" : invoice.PaidAmount > 0 ? "PARTIAL" : "UNPAID";
                if (cashRefund > 0)
                {
                    order.PaymentTransactions.Add(new PaymentTransaction { TransactionNumber = $"RETURN-RECOVERY-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Method = "CASH", Status = PaymentTransactionStatuses.Paid, Amount = cashRefund, PaidAt = ApplicationTime.NepalNow, Notes = $"Cash recovery for cancelled return {saleReturn.ReturnNumber}" });
                    if (saleReturn.RefundMethod is not null)
                        db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = saleReturn.CustomerId, InvoiceId = invoice.Id, EntryType = "CREDIT", Amount = cashRefund, EntryDate = ApplicationTime.NepalNow, Description = $"Cash recovery for cancelled return {saleReturn.ReturnNumber}" });
                }
            }
            if (creditRelief > 0)
            {
                var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == saleReturn.CustomerId, ct);
                if (credit is not null) credit.CurrentBalance += creditRelief;
                db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = saleReturn.CustomerId, InvoiceId = invoice?.Id, EntryType = "DEBIT", Amount = creditRelief, EntryDate = ApplicationTime.NepalNow, Description = $"Cancelled sales return {saleReturn.ReturnNumber}", Reference = request.Reason.Trim() });
            }
            saleReturn.Status = "CANCELLED";
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "SALES_RETURN_CANCELLED", EntityType = nameof(SaleReturn), EntityId = id.ToString(), PreviousValue = saleReturn.ReturnNumber, NewValue = request.Reason.Trim(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(new { returnNumber = saleReturn.ReturnNumber, status = saleReturn.Status });
        });
    }

    [HttpPost("purchase-returns/{id:guid}/cancel")]
    public async Task<IActionResult> CancelPurchaseReturn(Guid id, VoidTransactionRequest request, CancellationToken ct)
    {
        if (!CanPurchase) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 500)
            return BadRequest(new { message = "A cancellation reason of 1 to 500 characters is required." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var purchaseReturn = await db.PurchaseReturns.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (purchaseReturn is null || !BranchAllowed(purchaseReturn.BranchId)) return NotFound(new { message = "The purchase return was not found in your operational scope." });
            if (purchaseReturn.Status != "APPROVED") return Conflict(new { message = "Only an approved purchase return can be cancelled." });

            SupplierInvoice? invoice = null;
            if (purchaseReturn.SupplierInvoiceId.HasValue)
                invoice = await db.SupplierInvoices.SingleOrDefaultAsync(x => x.Id == purchaseReturn.SupplierInvoiceId.Value && x.SupplierId == purchaseReturn.SupplierId && x.Status != "VOID", ct);
            else if (purchaseReturn.PurchaseOrderId.HasValue)
            {
                var invoices = await db.SupplierInvoices.Where(x => x.PurchaseOrderId == purchaseReturn.PurchaseOrderId && x.SupplierId == purchaseReturn.SupplierId && x.Status != "VOID").Take(2).ToListAsync(ct);
                if (invoices.Count == 1) invoice = invoices[0];
            }
            else
            {
                var item = purchaseReturn.Items.FirstOrDefault();
                var reference = item is null ? null : await db.Inventory.AsNoTracking().Where(x => x.BranchId == purchaseReturn.BranchId && x.SupplierId == purchaseReturn.SupplierId && x.ProductId == item.ProductId && x.BatchNumber == item.BatchNumber).Select(x => x.PurchaseReference).FirstOrDefaultAsync(ct);
                if (!string.IsNullOrWhiteSpace(reference)) invoice = await db.SupplierInvoices.SingleOrDefaultAsync(x => x.SupplierId == purchaseReturn.SupplierId && x.InvoiceNumber == reference && x.Status != "VOID", ct);
            }
            if (invoice is null) return Conflict(new { message = "The original supplier invoice could not be resolved uniquely. No stock or ledger values were changed." });

            foreach (var group in purchaseReturn.Items.GroupBy(x => (x.ProductId, x.BatchNumber)))
            {
                var stock = await db.Inventory.SingleOrDefaultAsync(x => x.BranchId == purchaseReturn.BranchId && x.ProductId == group.Key.ProductId && x.BatchNumber == group.Key.BatchNumber && x.SupplierId == purchaseReturn.SupplierId, ct);
                if (stock is null) return Conflict(new { message = $"Batch {group.Key.BatchNumber} could not be found. No stock or ledger values were changed." });
                var quantity = group.Sum(x => x.Quantity);
                var before = stock.StockQuantity;
                stock.StockQuantity += quantity;
                stock.UpdatedAt = ApplicationTime.NepalNow;
                db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.VoidReversal, Quantity = quantity, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = stock.Product?.BaseUnit ?? "base", ReferenceType = "PURCHASE_RETURN_CANCEL", ReferenceId = purchaseReturn.Id.ToString(), Reason = request.Reason.Trim(), Note = $"Cancellation reversal for {purchaseReturn.ReturnNumber}", ActorId = ActorId });
            }
            invoice.Total += purchaseReturn.TotalAmount;
            invoice.Subtotal += purchaseReturn.TotalAmount;
            invoice.Status = invoice.PaidAmount >= invoice.Total ? "PAID" : invoice.PaidAmount > 0 ? "PARTIAL" : "UNPAID";
            purchaseReturn.Status = "CANCELLED";
            if (purchaseReturn.PurchaseOrderId.HasValue) await SyncPurchaseOrderPaymentStatus(purchaseReturn.PurchaseOrderId.Value, ct);
            db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "PURCHASE_RETURN_CANCELLED", EntityType = nameof(PurchaseReturn), EntityId = id.ToString(), PreviousValue = purchaseReturn.ReturnNumber, NewValue = request.Reason.Trim(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(new { returnNumber = purchaseReturn.ReturnNumber, status = purchaseReturn.Status });
        });
    }

    [HttpPost("sales/{id:guid}/void")]
    public async Task<IActionResult> VoidSale(Guid id, VoidTransactionRequest request, CancellationToken ct)
    {
        if (!CanSell) return Forbid();
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var order = await ScopeOrders(db.Orders.Include(x => x.Invoice).Include(x => x.Items).Include(x => x.Customer).Include(x => x.StatusHistory)).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (order is null || order.BranchId is not Guid branchId) return NotFound(new { message = "The sale was not found in your operational scope." });
        if (order.Status is OrderStatuses.Cancelled or OrderStatuses.Failed || order.Invoice?.PaymentStatus == "VOID") return Conflict(new { message = "This sale has already been voided." });
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "A void reason is required." });
        if (!BranchAllowed(branchId)) return Forbid();
        if (await db.SaleReturns.AnyAsync(x => x.OrderId == order.Id && x.Status == "APPROVED", ct))
            return Conflict(new { message = "Cancel the approved sales returns first. A sale with posted returns cannot be reversed safely until those return entries are cancelled." });

        var notePrefix = $"POS sale {order.OrderNumber}";
        var orderReference = order.Id.ToString();
        var transactions = await db.StockTransactions.Where(x => x.Type == StockTransactionTypes.Sale &&
            ((x.ReferenceId == orderReference && (x.ReferenceType == "POS_SALE" || x.ReferenceType == "CUSTOMER_ORDER_DELIVERY")) ||
             (x.Note != null && x.Note.StartsWith(notePrefix)))).ToListAsync(ct);
        var inventoryIds = transactions.Select(x => x.InventoryId).Distinct().ToList();
        var inventory = await db.Inventory.Include(x => x.Product).Where(x => inventoryIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var returnedRows = await db.SaleReturnItems.AsNoTracking()
            .Where(x => x.SaleReturn!.OrderId == order.Id && x.SaleReturn.Status == "APPROVED")
            .Select(x => new { x.ProductId, x.BatchNumber, x.Quantity })
            .ToListAsync(ct);
        var returnedByBatch = returnedRows.GroupBy(x => (x.ProductId, x.BatchNumber))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
        var totalRestored = 0;
        foreach (var group in transactions.GroupBy(x => x.InventoryId))
        {
            if (!inventory.TryGetValue(group.Key, out var row)) return Conflict(new { message = "The stock history for this sale is incomplete; it cannot be safely voided." });
            var soldQuantity = group.Sum(tx => Math.Max(0, -tx.Quantity));
            var returnedQuantity = returnedByBatch.GetValueOrDefault((row.ProductId, row.BatchNumber));
            var restoredQuantity = Math.Max(0, soldQuantity - returnedQuantity);
            if (restoredQuantity == 0) continue;
            totalRestored += restoredQuantity;
            var before = row.StockQuantity;
            row.StockQuantity += restoredQuantity;
            db.StockTransactions.Add(new StockTransaction
            {
                InventoryId = row.Id,
                BranchId = row.BranchId,
                Type = StockTransactionTypes.VoidReversal,
                Quantity = restoredQuantity,
                QuantityBefore = before,
                QuantityAfter = row.StockQuantity,
                Unit = row.Product?.BaseUnit ?? "base",
                ReferenceType = "POS_SALE_VOID",
                ReferenceId = orderReference,
                Reason = request.Reason.Trim(),
                Note = $"Void reversal for {order.OrderNumber}",
                ActorId = ActorId
            });
        }
        var invoice = order.Invoice;
        if (invoice is not null)
        {
            var outstanding = Math.Max(0m, invoice.Total - invoice.PaidAmount);
            var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == order.CustomerId, ct);
            if (credit is not null && outstanding > 0) credit.CurrentBalance = Math.Max(0m, credit.CurrentBalance - outstanding);
            if (outstanding > 0) db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = order.CustomerId, InvoiceId = invoice.Id, EntryType = "CREDIT", Amount = outstanding, EntryDate = ApplicationTime.NepalNow, Description = $"Voided sale {invoice.InvoiceNumber}", Reference = request.Reason.Trim() });
            if (invoice.PaidAmount > 0) order.PaymentTransactions.Add(new PaymentTransaction { TransactionNumber = $"VOID-REFUND-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Method = invoice.Order?.PaymentMethod ?? "CASH", Status = PaymentTransactionStatuses.Refunded, Amount = invoice.PaidAmount, RefundedAt = ApplicationTime.NepalNow, Notes = $"Refund for voided invoice {invoice.InvoiceNumber}" });
            invoice.PaymentStatus = "VOID";
        }
        order.Status = OrderStatuses.Cancelled;
        order.PaymentStatus = "VOID";
        order.StatusHistory.Add(new OrderStatusHistory { Status = OrderStatuses.Cancelled, Note = $"Voided: {request.Reason.Trim()}", ActorId = ActorId.ToString(), ActorRole = ActorRole });
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "POS_SALE_VOIDED", EntityType = "Order", EntityId = order.Id.ToString(), PreviousValue = order.OrderNumber, NewValue = request.Reason.Trim(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(new { orderId = order.Id, status = order.Status, restoredStock = totalRestored });
        });
    }

    [HttpPut("purchases/{id:guid}/additional-info")]
    public async Task<IActionResult> UpdatePurchaseAdditionalInfo(Guid id, PurchaseAdditionalInfoRequest request, CancellationToken ct)
    {
        if (!CanPurchase) return Forbid();
        if (request.SupplierInvoiceNumber?.Trim().Length > 80 || request.Notes?.Trim().Length > 1000)
            return BadRequest(new { message = "Supplier invoice number or notes exceed the allowed length." });
        var purchase = await db.PurchaseOrders.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (purchase is null || !BranchAllowed(purchase.BranchId)) return NotFound(new { message = "The purchase was not found in your operational scope." });
        if (purchase.Status == PurchaseOrderStatuses.Cancelled) return Conflict(new { message = "A voided purchase cannot be edited." });
        var invoices = await db.SupplierInvoices.Where(x => x.PurchaseOrderId == purchase.Id && x.SupplierId == purchase.SupplierId && x.Status != "VOID").ToListAsync(ct);
        if (invoices.Count != 1) return Conflict(new { message = "This purchase does not have exactly one active linked supplier invoice, so its additional information cannot be safely edited." });
        var invoice = invoices[0];
        var invoiceNumber = request.SupplierInvoiceNumber?.Trim();
        if (!string.IsNullOrWhiteSpace(invoiceNumber) && await db.SupplierInvoices.AnyAsync(x => x.Id != invoice.Id && x.SupplierId == purchase.SupplierId && x.InvoiceNumber == invoiceNumber, ct))
            return Conflict(new { message = "That supplier invoice number is already used for this supplier." });
        var before = System.Text.Json.JsonSerializer.Serialize(new { SupplierInvoiceNumber = invoice.InvoiceNumber, InvoiceNotes = invoice.Notes, PurchaseNotes = purchase.Notes });
        if (!string.IsNullOrWhiteSpace(invoiceNumber))
        {
            invoice.InvoiceNumber = invoiceNumber;
            var inventoryRows = await db.Inventory.Where(x => x.PurchaseOrderId == purchase.Id && x.SupplierId == purchase.SupplierId).ToListAsync(ct);
            foreach (var row in inventoryRows) row.PurchaseReference = invoiceNumber;
        }
        invoice.Notes = request.Notes?.Trim();
        purchase.Notes = request.Notes?.Trim();
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "PURCHASE_ADDITIONAL_INFO_UPDATED", EntityType = nameof(PurchaseOrder), EntityId = id.ToString(), PreviousValue = before, NewValue = System.Text.Json.JsonSerializer.Serialize(new { SupplierInvoiceNumber = invoice.InvoiceNumber, InvoiceNotes = invoice.Notes, PurchaseNotes = purchase.Notes }), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct);
        return Ok(new { purchaseId = purchase.Id, supplierInvoiceNumber = invoice.InvoiceNumber, notes = purchase.Notes });
    }

    [HttpPost("purchases/{id:guid}/void")]
    public async Task<IActionResult> VoidPurchase(Guid id, VoidTransactionRequest request, CancellationToken ct)
    {
        if (!CanPurchase) return Forbid();
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var purchase = await db.PurchaseOrders.Include(x => x.Supplier).Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (purchase is null || !BranchAllowed(purchase.BranchId)) return NotFound(new { message = "The purchase was not found in your operational scope." });
        if (purchase.Status == PurchaseOrderStatuses.Cancelled) return Conflict(new { message = "This purchase has already been voided." });
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "A void reason is required." });
        var notePrefix = $"Purchase receipt {purchase.OrderNumber}";
        var purchaseReference = purchase.Id.ToString();
        var transactions = await db.StockTransactions.Where(x => x.Type == StockTransactionTypes.Purchase && ((x.ReferenceType == "PURCHASE_RECEIPT" && x.ReferenceId == purchaseReference) || (x.Note != null && x.Note.StartsWith(notePrefix)))).ToListAsync(ct);
        var inventoryIds = transactions.Select(x => x.InventoryId).Distinct().ToList();
        var inventory = await db.Inventory.Where(x => inventoryIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        foreach (var tx in transactions)
        {
            if (!inventory.TryGetValue(tx.InventoryId, out var row)) return Conflict(new { message = "The stock history for this purchase is incomplete; it cannot be safely voided." });
            if (row.StockQuantity - row.ReservedQuantity < tx.Quantity) return Conflict(new { message = "Some stock from this purchase has already been sold or reserved; reverse the related sale first." });
        }
        foreach (var tx in transactions)
        {
            var row = inventory[tx.InventoryId];
            var before = row.StockQuantity;
            row.StockQuantity -= tx.Quantity;
            db.StockTransactions.Add(new StockTransaction
            {
                InventoryId = row.Id,
                BranchId = row.BranchId,
                Type = StockTransactionTypes.VoidReversal,
                Quantity = -tx.Quantity,
                QuantityBefore = before,
                QuantityAfter = row.StockQuantity,
                Unit = tx.Unit,
                ReferenceType = "PURCHASE_VOID",
                ReferenceId = purchase.Id.ToString(),
                Reason = request.Reason.Trim(),
                Note = $"Void reversal for {purchase.OrderNumber}",
                ActorId = ActorId
            });
        }
        var supplierInvoices = await db.SupplierInvoices.Where(x => x.PurchaseOrderId == purchase.Id && x.Status != "VOID").ToListAsync(ct);
        if (supplierInvoices.Any(x => x.PaidAmount > 0)) return Conflict(new { message = "This purchase has supplier payments. Record the supplier refund or credit adjustment before voiding it." });
        foreach (var supplierInvoice in supplierInvoices) supplierInvoice.Status = "VOID";
        purchase.Status = PurchaseOrderStatuses.Cancelled;
        purchase.PaymentStatus = "VOID";
        db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "PURCHASE_VOIDED", EntityType = "PurchaseOrder", EntityId = purchase.Id.ToString(), PreviousValue = purchase.OrderNumber, NewValue = request.Reason.Trim(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(new { purchaseId = purchase.Id, status = purchase.Status, restoredStock = transactions.Sum(x => x.Quantity) });
        });
    }

    [HttpPost("customer-payments")]
    public async Task<IActionResult> RecordCustomerPayment(CustomerPaymentRequest request, CancellationToken ct)
    {
        if (!CanLedger || request.Amount <= 0 || !PaymentModes.Contains(request.Method.ToUpperInvariant())) return BadRequest(new { message = "Choose a customer, positive amount and valid payment method." });
        if (HasBranchScope && (!ActorBranchId.HasValue || request.BranchId.HasValue && request.BranchId != ActorBranchId)) return Forbid();
        if (HasBranchScope && ActorBranchId is Guid customerBranch && !await db.Orders.AnyAsync(x => x.CustomerId == request.CustomerId && x.BranchId == customerBranch) && !await db.CustomerPayments.AnyAsync(x => x.CustomerId == request.CustomerId && x.BranchId == customerBranch, ct)) return NotFound(new { message = "Customer not found in your branch." });
        var customer = await db.Customers.SingleOrDefaultAsync(x => x.Id == request.CustomerId && x.IsActive, ct); if (customer is null) return NotFound(new { message = "Customer not found." });
        var payment = new CustomerPayment { CustomerId = customer.Id, BranchId = BranchForWrite(request.BranchId), PaymentNumber = $"CPAY-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Amount = request.Amount, Method = request.Method.ToUpperInvariant(), PaymentDate = request.PaymentDate ?? ApplicationTime.NepalNow, Reference = request.Reference?.Trim(), Notes = request.Notes?.Trim() };
        var remaining = request.Amount; var invoicesQuery = db.Invoices.Include(x => x.Order).Where(x => x.PaymentStatus != "VOID" && x.Order!.Status != OrderStatuses.Cancelled && x.Order.CustomerId == customer.Id && x.Total > x.PaidAmount);
        if (HasBranchScope && ActorBranchId is Guid branchId) invoicesQuery = invoicesQuery.Where(x => x.Order!.BranchId == branchId);
        var invoices = await invoicesQuery.OrderBy(x => x.DueAt ?? x.IssuedAt).ToListAsync(ct);
        foreach (var invoice in invoices) { if (remaining <= 0) break; var applied = Math.Min(remaining, invoice.Total - invoice.PaidAmount); invoice.PaidAmount += applied; invoice.PaymentStatus = invoice.PaidAmount >= invoice.Total ? "PAID" : "PARTIAL"; remaining -= applied; db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = customer.Id, InvoiceId = invoice.Id, EntryType = "CREDIT", Amount = applied, EntryDate = payment.PaymentDate, Description = $"Payment {payment.PaymentNumber}", Reference = payment.Reference }); }
        var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == customer.Id, ct); if (credit is not null) credit.CurrentBalance = Math.Max(0m, credit.CurrentBalance - request.Amount + remaining);
        db.CustomerPayments.Add(payment); db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "CUSTOMER_PAYMENT_RECORDED", EntityType = "CustomerPayment", EntityId = payment.Id.ToString(), NewValue = payment.PaymentNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() }); await db.SaveChangesAsync(ct); return Ok(new { paymentNumber = payment.PaymentNumber, applied = request.Amount - remaining, unapplied = remaining });
    }

    [HttpPost("supplier-payments")]
    public async Task<IActionResult> RecordSupplierPayment(SupplierPaymentRequest request, CancellationToken ct)
    {
        if (!CanLedger || request.Amount <= 0 || !PaymentModes.Contains(request.Method.ToUpperInvariant())) return BadRequest(new { message = "Choose a supplier, positive amount and valid payment method." });
        if (HasBranchScope && (!ActorBranchId.HasValue || request.BranchId.HasValue && request.BranchId != ActorBranchId)) return Forbid();
        if (HasBranchScope && ActorBranchId is Guid supplierBranch && !await db.PurchaseOrders.AnyAsync(x => x.SupplierId == request.SupplierId && x.BranchId == supplierBranch) && !await db.SupplierInvoices.AnyAsync(x => x.SupplierId == request.SupplierId && (x.BranchId == supplierBranch || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == supplierBranch), ct) && !await db.SupplierPayments.AnyAsync(x => x.SupplierId == request.SupplierId && x.BranchId == supplierBranch, ct)) return NotFound(new { message = "Supplier not found in your branch." });
        if (!await db.Suppliers.AnyAsync(x => x.Id == request.SupplierId && x.IsActive, ct)) return NotFound(new { message = "Supplier not found." });
        var payment = new SupplierPayment { SupplierId = request.SupplierId, BranchId = BranchForWrite(request.BranchId), PaymentNumber = $"SPAY-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Amount = request.Amount, Method = request.Method.ToUpperInvariant(), PaymentDate = request.PaymentDate ?? ApplicationTime.NepalNow, Reference = request.Reference?.Trim(), Notes = request.Notes?.Trim() };
        var remaining = request.Amount; var invoices = await db.SupplierInvoices.Where(x => x.Status != "VOID" && x.SupplierId == request.SupplierId).OrderBy(x => x.DueAt ?? x.InvoiceDate).ToListAsync(ct);
        foreach (var invoice in invoices) { if (remaining <= 0) break; var openBalance = Math.Max(0m, invoice.Total - invoice.PaidAmount); if (openBalance <= 0) continue; var applied = Math.Min(remaining, openBalance); invoice.PaidAmount += applied; invoice.Status = invoice.PaidAmount >= invoice.Total ? "PAID" : "PARTIAL"; remaining -= applied; }
        foreach (var purchaseOrderId in invoices.Where(x => x.PurchaseOrderId.HasValue).Select(x => x.PurchaseOrderId!.Value).Distinct()) await SyncPurchaseOrderPaymentStatus(purchaseOrderId, ct);
        db.SupplierPayments.Add(payment); db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = "SUPPLIER_PAYMENT_RECORDED", EntityType = "SupplierPayment", EntityId = payment.Id.ToString(), NewValue = payment.PaymentNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() }); await db.SaveChangesAsync(ct); return Ok(new { paymentNumber = payment.PaymentNumber, applied = request.Amount - remaining, unapplied = remaining });
    }

    private Guid? BranchForWrite(Guid? branchId) { var value = branchId ?? ActorBranchId; return value.HasValue && BranchAllowed(value.Value) ? value : null; }

    private async Task SyncPurchaseOrderPaymentStatus(Guid purchaseOrderId, CancellationToken ct)
    {
        var purchase = await db.PurchaseOrders.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == purchaseOrderId, ct);
        if (purchase is null) return;
        var invoices = await db.SupplierInvoices.Where(x => x.PurchaseOrderId == purchaseOrderId && x.Status != "VOID").ToListAsync(ct);
        var returned = await db.PurchaseReturns.Where(x => x.PurchaseOrderId == purchaseOrderId && x.Status == "APPROVED").SumAsync(x => (decimal?)x.TotalAmount, ct) ?? 0m;
        var totalReceived = Math.Max(0m, purchase.Items.Sum(x => x.QuantityReceived * x.UnitCost) - returned);
        var totalPaid = invoices.Sum(x => x.PaidAmount);
        purchase.PaymentStatus = totalPaid >= totalReceived ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID";
    }

    private async Task<decimal> ProfitForOrders(IEnumerable<Guid> orderIds, CancellationToken ct)
    {
        var ids = orderIds.Distinct().ToList();
        if (ids.Count == 0) return 0m;

        var references = ids.Select(id => id.ToString()).ToList();
        var salesRevenue = await db.OrderItems.AsNoTracking()
            .Where(x => ids.Contains(x.OrderId))
            .SumAsync(x => (decimal?)(x.Quantity * x.UnitPrice), ct) ?? 0m;

        // Use the purchase price of the exact FEFO batches actually consumed, not
        // the cheapest batch currently on hand (which can be a different receipt).
        var soldBatchCost = await db.StockTransactions.AsNoTracking()
            .Where(x => x.Type == StockTransactionTypes.Sale && x.ReferenceId != null && references.Contains(x.ReferenceId)
                && (x.ReferenceType == "POS_SALE" || x.ReferenceType == "CUSTOMER_ORDER_DELIVERY"))
            .SumAsync(x => (decimal?)(-x.Quantity * x.Inventory!.PurchasePrice), ct) ?? 0m;

        var returns = await db.SaleReturns.AsNoTracking()
            .Where(x => x.OrderId.HasValue && ids.Contains(x.OrderId.Value) && x.Status == "APPROVED")
            .Select(x => new { x.Id, x.TotalAmount })
            .ToListAsync(ct);
        var returnReferences = returns.Select(x => x.Id.ToString()).ToList();
        var returnedBatchCost = returnReferences.Count == 0 ? 0m : await db.StockTransactions.AsNoTracking()
            .Where(x => x.Type == StockTransactionTypes.SalesReturn && x.ReferenceType == "SALES_RETURN" && x.ReferenceId != null && returnReferences.Contains(x.ReferenceId))
            .SumAsync(x => (decimal?)(x.Quantity * x.Inventory!.PurchasePrice), ct) ?? 0m;

        return salesRevenue - returns.Sum(x => x.TotalAmount) - Math.Max(0m, soldBatchCost - returnedBatchCost);
    }

    private async Task<IActionResult> InventoryWrite(Func<Task<IActionResult>> write, CancellationToken ct)
    {
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var result = await write();
            var statusCode = result switch
            {
                ObjectResult objectResult => objectResult.StatusCode ?? StatusCodes.Status200OK,
                StatusCodeResult statusResult => statusResult.StatusCode,
                ForbidResult => StatusCodes.Status403Forbidden,
                _ => StatusCodes.Status200OK
            };
            if (statusCode >= 400) return result;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return result;
        });
    }

    private IQueryable<Inventory> InventoryScope(Guid? branchId, string? search)
    {
        IQueryable<Inventory> query = db.Inventory.AsNoTracking()
            .Include(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category)
            .Include(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Manufacturer)
            .Include(x => x.Product).ThenInclude(x => x!.Brand)
            .Include(x => x.Product).ThenInclude(x => x!.Units)
            .Include(x => x.Branch).Include(x => x.SupplierEntity);
        if (HasBranchScope && ActorBranchId is Guid scopedBranch) query = query.Where(x => x.BranchId == scopedBranch);
        else if (HasBranchScope) query = query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.BatchNumber.Contains(search) || x.Product!.Name.Contains(search) || x.Product.Sku.Contains(search) || (x.Product.Barcode != null && x.Product.Barcode.Contains(search)) || (x.Product.SearchKeywords != null && x.Product.SearchKeywords.Contains(search)) || (x.Product.Medicine!.GenericName != null && x.Product.Medicine.GenericName.Contains(search)) || (x.Product.Medicine!.Strength != null && x.Product.Medicine.Strength.Contains(search)) || (x.Product.Medicine!.DosageForm != null && x.Product.Medicine.DosageForm.Contains(search)) || (x.Product.Medicine!.Manufacturer != null && x.Product.Medicine.Manufacturer.Name.Contains(search)) || (x.Product.Brand != null && x.Product.Brand.Name.Contains(search)) || (x.Product.StorageLocation != null && x.Product.StorageLocation.Contains(search)) || (x.SupplierEntity != null && x.SupplierEntity.Name.Contains(search)) || (x.Supplier != null && x.Supplier.Contains(search)));
        return query;
    }

    private async Task<int> NearExpiryDays(CancellationToken ct)
    {
        var configured = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "inventory.near_expiry_days").Select(x => x.Value).SingleOrDefaultAsync(ct);
        return int.TryParse(configured, out var days) && days > 0 ? days : 90;
    }

    private static int? UnitMultiplier(Product product, string? unit, bool isPurchaseUnit = false, bool isSalesUnit = false)
    {
        if (string.IsNullOrWhiteSpace(unit) || unit.Equals("base", StringComparison.OrdinalIgnoreCase) || unit.Equals(product.BaseUnit, StringComparison.OrdinalIgnoreCase)) return 1;
        if (isPurchaseUnit && unit.Equals(product.PurchaseUnit, StringComparison.OrdinalIgnoreCase)) return product.PurchaseUnitToBase > 0 ? product.PurchaseUnitToBase : null;
        if (isSalesUnit && unit.Equals(product.SalesUnit, StringComparison.OrdinalIgnoreCase)) return product.SalesUnitToBase > 0 ? product.SalesUnitToBase : null;
        var configured = product.Units.FirstOrDefault(x => x.UnitName.Equals(unit.Trim(), StringComparison.OrdinalIgnoreCase));
        if (configured is not null)
        {
            if (isPurchaseUnit && !configured.IsPurchaseUnit && !unit.Equals(product.PurchaseUnit, StringComparison.OrdinalIgnoreCase) || isSalesUnit && !configured.IsSalesUnit && !unit.Equals(product.SalesUnit, StringComparison.OrdinalIgnoreCase)) return null;
            return configured.MultiplierToBase > 0 ? configured.MultiplierToBase : null;
        }
        return null;
    }

    private InventoryDepartmentRow ToInventoryRow(Inventory x, DateTime today, int nearExpiryDays)
    {
        var available = AvailableForSale(x, today);
        var days = x.ExpiryDate.HasValue ? (int)(x.ExpiryDate.Value.Date - today).TotalDays : (int?)null;
        var status = x.BatchStatus is "QUARANTINED" or "RETURNED" ? x.BatchStatus : x.BatchStatus == "EXPIRED" || x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date < today ? "EXPIRED" : x.BatchStatus == "DEPLETED" || available <= 0 ? "OUT_OF_STOCK" : available <= (x.Product?.ReorderLevel > 0 ? x.Product.ReorderLevel : x.MinimumStock) ? "LOW_STOCK" : x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date <= today.AddDays(nearExpiryDays) ? "NEAR_EXPIRY" : "IN_STOCK";
        return new InventoryDepartmentRow(x.Id, x.ProductId, x.Product?.Name ?? "", x.Product?.Sku ?? "", x.Product?.Barcode, x.Product?.Medicine?.GenericName, x.Product?.Brand?.Name, x.Product?.Medicine?.Manufacturer?.Name, x.Product?.Medicine?.Category?.Name, x.Product?.Medicine?.Strength, x.Product?.Medicine?.DosageForm, x.BatchNumber, x.BranchId, x.Branch?.Name, x.StockQuantity, x.ReservedQuantity, available, CanInventoryValuation ? x.PurchasePrice : null, x.SellingPrice ?? x.Product?.SellingPrice ?? 0m, x.Mrp ?? x.Product?.Mrp ?? 0m, x.ExpiryDate, x.ManufacturingDate, days, status, x.MinimumStock, x.Product?.ReorderLevel ?? x.MinimumStock, x.Product?.MaximumStock ?? 0, x.Product?.StorageLocation, x.SupplierEntity?.Name ?? x.Supplier, x.PurchaseReference, x.Product?.BaseUnit ?? "piece", x.Product?.SalesUnit ?? "piece", x.BatchStatus);
    }

    private static int AvailableForSale(Inventory x, DateTime today)
    {
        if (x.BatchStatus is "EXPIRED" or "DEPLETED" or "QUARANTINED" or "RETURNED" || x.ExpiryDate.HasValue && x.ExpiryDate.Value.Date < today) return 0;
        return Math.Max(0, x.StockQuantity - x.ReservedQuantity);
    }

    private static string RackLocation(ProductRack rack)
    {
        var group = rack.RackGroup?.Name ?? "";
        var full = $"{group} / {rack.Name}";
        if (full.Length <= 160) return full;
        return $"{group[..Math.Min(77, group.Length)]} / {rack.Name[..Math.Min(80, rack.Name.Length)]}";
    }

    private static readonly string[] PaymentModes = ["CASH", "CREDIT", "BANK_TRANSFER", "CHEQUE", "PARTIAL"];
    private static (DateTime Start, DateTime End) Range(DateTime? from, DateTime? to) { var now = ApplicationTime.NepalNow; var start = (from ?? new DateTime(now.Year, now.Month, 1)).Date; var end = (to ?? now).Date.AddDays(1); return (start, end <= start ? start.AddDays(1) : end); }
    private static string? ExtractReferenceCode(string? notes)
    {
        const string prefix = "REFCODE:";
        if (string.IsNullOrWhiteSpace(notes) || !notes.StartsWith(prefix, StringComparison.Ordinal)) return null;
        var separator = notes.IndexOf('|');
        var code = notes.Substring(prefix.Length, (separator < 0 ? notes.Length : separator) - prefix.Length).Trim();
        return code.Length == 0 ? null : code;
    }

    public sealed record PosSaleItemRequest(Guid ProductId, int Quantity, decimal? DiscountPercent = null, int BonusQuantity = 0, string? Unit = null, Guid? InventoryId = null);
    public sealed record ProductHistoryRow(Guid Id, DateTime Date, string InvoiceNumber, string Batch, DateTime? ExpiryDate, int Quantity, int Free, decimal Rate, decimal Mrp, decimal DiscountPercent, string Type);
    public sealed record PosSaleRequest(Guid? CustomerId, string? WalkInName, string? WalkInPhone, Guid? BranchId, string PaymentMode, decimal? PaidAmount, IReadOnlyList<PosSaleItemRequest> Items, string? InsuranceProvider = null, string? InsurancePolicyNumber = null, string? ReferenceCode = null);
    public sealed record PosSaleEditRequest(PosSaleRequest Sale, string Reason);
    public sealed record PurchaseReceiptItemRequest(Guid ProductId, int Quantity, decimal UnitCost, string? BatchNumber, DateTime? ExpiryDate, string? Unit = null);
    public sealed record PurchaseReceiptRequest(Guid SupplierId, Guid BranchId, string PaymentMode, decimal? PaidAmount, string? SupplierInvoiceNumber, string? Notes, IReadOnlyList<PurchaseReceiptItemRequest> Items);
    public sealed record SalesReturnRequest(Guid OrderId, Guid ProductId, int Quantity, string? Reason, string RefundMethod = "CREDIT", bool ExpiredReturn = false);
    public sealed record PurchaseReturnRequest(Guid InventoryId, Guid SupplierId, Guid BranchId, int Quantity, string? Reason);
    public sealed record CustomerPaymentRequest(Guid CustomerId, decimal Amount, string Method, DateTime? PaymentDate, Guid? BranchId, string? Reference, string? Notes);
    public sealed record SupplierPaymentRequest(Guid SupplierId, decimal Amount, string Method, DateTime? PaymentDate, Guid? BranchId, string? Reference, string? Notes);
    public sealed record CashHandoverInput(Guid BranchId, Guid ReceivedByStaffUserId, decimal Amount, string Reference, string? Notes, Guid? HandedByStaffUserId = null);
    public sealed record PurchaseAdditionalInfoRequest(string? SupplierInvoiceNumber, string? Notes);
    public sealed record VoidTransactionRequest(string Reason);
    public sealed record ProductUnitRequest(string Name, int MultiplierToBase, bool IsPurchaseUnit, bool IsSalesUnit, int DisplayOrder = 0);
    public sealed record ProductMasterUpdateRequest(string BaseUnit, string PurchaseUnit, string SalesUnit, int PurchaseUnitToBase, int SalesUnitToBase, int ReorderLevel, int MaximumStock, string? StorageLocation, string? Notes, bool? IsActive = null, string? GenericName = null, string? Strength = null, string? DosageForm = null, bool? PrescriptionRequired = null, string? SearchKeywords = null, IReadOnlyList<ProductUnitRequest>? Units = null, Guid? RackId = null);
    public sealed record InventoryAdjustmentRequest(Guid InventoryId, int QuantityDelta, string Reason, string? Type = null, string? Unit = null, string? BatchStatus = null);
    public sealed record OpeningStockRequest(Guid ProductId, Guid BranchId, long Quantity, string BatchNumber, decimal PurchasePrice, DateTime? ManufacturingDate, DateTime? ExpiryDate, string Reason, string? Reference, string? SupplierName);
    public sealed record CreateStockCountRequest(Guid BranchId, string? Scope = null, string? Category = null, string? Location = null, string? Search = null, string? Notes = null);
    public sealed record StockCountLineUpdate(Guid LineId, int PhysicalQuantity, string? Reason = null);
    public sealed record UpdateStockCountLinesRequest(IReadOnlyList<StockCountLineUpdate> Lines);
    public sealed record FinalizeStockCountRequest(string? Reason = null);
    public sealed record InventoryTransferItemRequest(Guid InventoryId, int Quantity);
    public sealed record CreateInventoryTransferRequest(Guid SourceBranchId, Guid TargetBranchId, IReadOnlyList<InventoryTransferItemRequest> Items, string? Note = null);
    public sealed record InventoryDepartmentRow(Guid Id, Guid ProductId, string Product, string ProductCode, string? Barcode, string? GenericName, string? Brand, string? Manufacturer, string? Category, string? Strength, string? DosageForm, string BatchNumber, Guid BranchId, string? Branch, int StockQuantity, int ReservedQuantity, int AvailableQuantity, decimal? PurchasePrice, decimal SellingPrice, decimal Mrp, DateTime? ExpiryDate, DateTime? ManufacturingDate, int? DaysToExpiry, string Status, int MinimumStock, int ReorderLevel, int MaximumStock, string? StorageLocation, string? Supplier, string? PurchaseReference, string BaseUnit, string SalesUnit, string BatchStatus);
    public sealed record InventoryVelocityRow(Guid ProductId, string Product, int QuantitySold, int CurrentStock, decimal? StockValue, DateTime? LastSaleDate, int? DaysSinceLastSale, string Classification);
    public sealed record InventorySuggestionRow(Guid ProductId, string Product, string Sku, Guid BranchId, string Branch, int Available, long PendingPurchaseQuantity, int MinimumStock, int ReorderLevel, int MaximumStock, int SuggestedOrderQuantity, string? Supplier, Guid? SupplierId, string PurchaseUnit, int PurchaseUnitToBase, decimal? PurchaseUnitCost);
    public sealed record NearExpiryDaysRequest(int Days);

    private sealed class UserCashSummaryAccumulator
    {
        public decimal CashReceive { get; set; }
        public decimal Sales { get; set; }
        public decimal Receipt { get; set; }
        public decimal Card { get; set; }
        public decimal Return { get; set; }
        public decimal HandOver { get; set; }
    }
}
