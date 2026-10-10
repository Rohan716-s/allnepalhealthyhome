using System.Security.Claims;
using System.Globalization;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using System.Net;
using System.Text.RegularExpressions;
using System.IO.Compression;
using System.Xml.Linq;
using backend.Contracts;
using backend.Data;
using backend.Hubs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/admin")]
[Route("api/superadmin")]
public sealed class AdminController(ApplicationDbContext db, IPasswordService passwords, IPrescriptionFileStorage files, IMediaFileStorage media, INotificationTemplateService notifications, IntegrationSecretProtector secrets, IDatabaseBackupService backups, IMessagingConversationService messaging, IHubContext<NotificationHub> notificationHub) : ControllerBase
{
    private bool IsSuperAdmin => User.IsStaffRole(StaffRoles.SuperAdmin);
    private bool IsAdmin => !SuperAdminPath && User.IsStaffRole(StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.SuperAdmin) || SuperAdminPath && IsSuperAdmin;
    private bool IsSupervisor => !SuperAdminPath && User.IsStaffRole(StaffRoles.Supervisor);
    private Guid? SupervisorBranchId => Guid.TryParse(User.FindFirstValue("branch_id"), out var id) ? id : null;
    private bool IsBranchScoped => !IsSuperAdmin && (SupervisorBranchId.HasValue || User.IsStaffRole(StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.SalesExecutive));
    private Guid ActorId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private bool SuperAdminPath => Request.Path.StartsWithSegments("/api/superadmin", StringComparison.OrdinalIgnoreCase);
    private bool Can(string permission) => SuperAdminPath ? IsSuperAdmin : IsAdmin && User.HasStaffPermission(permission);
    private static readonly string[] KnownSidebarRoles = [StaffRoles.SuperAdmin, StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.Accountant, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.SalesExecutive, StaffRoles.SalesManager, StaffRoles.PurchaseInventoryManager, StaffRoles.HrManager, StaffRoles.ViewerAuditor, StaffRoles.Employee];
    private static readonly string[] PurchasePaymentModes = ["CASH", "CREDIT", "BANK_TRANSFER", "CHEQUE", "PARTIAL"];
    private static readonly string[] AllowedSidebarIcons = ["ACTIVITY", "BAR_CHART_3", "BELL", "BOOK_OPEN", "BOXES", "CALENDAR_DAYS", "CHECK_SQUARE", "CLIPBOARD_LIST", "CREDIT_CARD", "FILE_TEXT", "HEADPHONES", "IMAGES", "KEY_ROUND", "LAYOUT_DASHBOARD", "MAP_PIN", "MENU", "MESSAGE_SQUARE", "PALETTE", "PACKAGE", "RECEIPT", "SETTINGS", "SHIELD", "SPARKLES", "STORE", "TAGS", "TIMER_RESET", "TRUCK", "USERS", "WALLET"];

    private static AdminRoleSidebarMenuItem ToRoleSidebarMenuItem(RoleSidebarMenuItem item) => new(item.Id, item.Role, item.Label, item.Href, item.Icon, item.DisplayOrder, item.IsVisible);
    private static bool SafeSidebarHref(string? value) => !string.IsNullOrWhiteSpace(value) && value.Trim().StartsWith('/') && !value.Trim().StartsWith("//") && !value.Contains('<') && !value.Contains('>') && !value.Contains(' ');

    private IQueryable<PharmacyOrder> ScopeOrders(IQueryable<PharmacyOrder> query)
        => !IsBranchScoped ? query : SupervisorBranchId.HasValue
            ? query.Where(x => x.BranchId == SupervisorBranchId.Value)
            : query.Where(_ => false);

    private IQueryable<Inventory> ScopeInventory(IQueryable<Inventory> query)
        => !IsBranchScoped ? query : SupervisorBranchId.HasValue
            ? query.Where(x => x.BranchId == SupervisorBranchId.Value)
            : query.Where(_ => false);

    private IQueryable<SalesExecutiveProductAssignment> ScopeSalesExecutiveAssignments(IQueryable<SalesExecutiveProductAssignment> query)
        => !IsBranchScoped ? query : SupervisorBranchId.HasValue
            ? query.Where(x => x.SalesExecutiveUser != null && x.SalesExecutiveUser.BranchId == SupervisorBranchId.Value)
            : query.Where(_ => false);

    private IQueryable<Prescription> ScopePrescriptions(IQueryable<Prescription> query)
        => !IsBranchScoped ? query : SupervisorBranchId.HasValue
            ? query.Where(x => db.Orders.Any(order => order.PrescriptionId == x.Id && order.BranchId == SupervisorBranchId.Value))
            : query.Where(_ => false);

    private IQueryable<Customer> ScopeCustomers(IQueryable<Customer> query)
        => !IsBranchScoped ? query : SupervisorBranchId.HasValue
            ? query.Where(x => db.Orders.Any(order => order.CustomerId == x.Id && order.BranchId == SupervisorBranchId.Value) || db.CustomerPayments.Any(payment => payment.CustomerId == x.Id && payment.BranchId == SupervisorBranchId.Value))
            : query.Where(_ => false);

    private bool BranchAllowed(Guid branchId) => !IsBranchScoped || SupervisorBranchId == branchId;
    private bool SalesExecutiveBranchAllowed(Guid? branchId) => !IsBranchScoped || (SupervisorBranchId.HasValue && branchId == SupervisorBranchId.Value);

    private static double DistanceMeters(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        const double earthRadiusMeters = 6371000;
        static double ToRadians(double degrees) => degrees * Math.PI / 180;
        var dLat = ToRadians(latitude2 - latitude1);
        var dLon = ToRadians(longitude2 - longitude1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(ToRadians(latitude1)) * Math.Cos(ToRadians(latitude2)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return earthRadiusMeters * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    [HttpGet("delivery/live")]
    public async Task<ActionResult<IReadOnlyList<LiveDeliveryMapRow>>> LiveDeliveries(CancellationToken ct)
    {
        if (SuperAdminPath ? !IsSuperAdmin : !IsAdmin || !User.HasStaffPermission(AppPermissions.OrdersView))
            return Forbid();
        if (IsBranchScoped && !SupervisorBranchId.HasValue)
            return Forbid();

        var now = DateTime.UtcNow;
        var rows = await ScopeOrders(db.Orders.AsNoTracking())
            .Where(order => order.Status == OrderStatuses.OutForDelivery
                && order.DeliveryAssignment != null
                && (order.DeliveryAssignment.Status == DeliveryStatuses.Accepted || order.DeliveryAssignment.Status == DeliveryStatuses.PickedUp || order.DeliveryAssignment.Status == DeliveryStatuses.OutForDelivery || order.DeliveryAssignment.Status == DeliveryStatuses.Arrived))
            .Select(order => new
            {
                order.Id,
                order.OrderNumber,
                DestinationAddress = order.Address == null ? null : new[]
                {
                    order.Address.StreetTole,
                    $"Ward {order.Address.Ward}",
                    order.Address.Municipality,
                    order.Address.District,
                    order.Address.Province
                },
                Destination = order.Address != null && order.Address.Latitude.HasValue && order.Address.Longitude.HasValue
                    ? new
                    {
                        Latitude = order.Address.Latitude.Value,
                        Longitude = order.Address.Longitude.Value,
                        order.Address.StreetTole,
                        order.Address.Ward,
                        order.Address.Municipality,
                        order.Address.District,
                        order.Address.Province
                    }
                    : null,
                Assignment = new
                {
                    order.DeliveryAssignment!.Status,
                    RiderName = order.DeliveryAssignment.DeliveryStaff!.FullName,
                    Location = order.DeliveryAssignment.CurrentLocation != null
                        && order.DeliveryAssignment.CurrentLocation.UpdatedAt >= now.AddMinutes(-2)
                        ? new
                        {
                            order.DeliveryAssignment.CurrentLocation.Latitude,
                            order.DeliveryAssignment.CurrentLocation.Longitude,
                            Accuracy = order.DeliveryAssignment.CurrentLocation.AccuracyMeters,
                            order.DeliveryAssignment.CurrentLocation.UpdatedAt
                        }
                        : null
                }
            })
            .ToListAsync(ct);

        var response = rows.Select(row =>
        {
            var location = row.Assignment.Location is null
                ? null
                : new CustomerLiveLocation(row.Assignment.Location.Latitude, row.Assignment.Location.Longitude,
                    row.Assignment.Location.Accuracy, DateTime.SpecifyKind(row.Assignment.Location.UpdatedAt, DateTimeKind.Utc));
            CustomerLiveDestination? destination = null;
            if (row.Destination is not null)
            {
                var address = string.Join(", ", new[]
                {
                    row.Destination.StreetTole,
                    $"Ward {row.Destination.Ward}",
                    row.Destination.Municipality,
                    row.Destination.District,
                    row.Destination.Province
                }.Where(part => !string.IsNullOrWhiteSpace(part)));
                destination = new CustomerLiveDestination(row.Destination.Latitude, row.Destination.Longitude, address);
            }

            var destinationAddress = row.DestinationAddress is null
                ? null
                : string.Join(", ", row.DestinationAddress.Where(part => !string.IsNullOrWhiteSpace(part)));
            return new LiveDeliveryMapRow(row.Id, row.OrderNumber, row.Assignment.RiderName,
                row.Assignment.Status, location, destination, string.IsNullOrWhiteSpace(destinationAddress) ? null : destinationAddress);
        }).ToList();
        return Ok(response);
    }


    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<AdminGlobalSearchResult>>> Search([FromQuery] string? q, [FromQuery] int limit = 8, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.ReportsView)) return Forbid();
        var term = q?.Trim();
        if (string.IsNullOrWhiteSpace(term) || term.Length < 2) return Ok(Array.Empty<AdminGlobalSearchResult>());
        limit = Math.Clamp(limit, 1, 20);

        var customers = await ScopeCustomers(db.Customers.AsNoTracking()).Where(x => x.FullName.Contains(term) || x.Email.Contains(term) || x.Phone.Contains(term)).OrderBy(x => x.FullName).Take(limit).Select(x => new AdminGlobalSearchResult("Customer", x.Id, x.FullName, $"{x.Email} · {x.Phone}", "/superadmin/customers")).ToListAsync(ct);
        var products = await db.Products.AsNoTracking().Where(x => x.Name.Contains(term) || x.Sku.Contains(term) || x.Slug.Contains(term) || (x.SearchKeywords != null && x.SearchKeywords.Contains(term)) || (x.Medicine != null && (x.Medicine.Name.Contains(term) || (x.Medicine.GenericName != null && x.Medicine.GenericName.Contains(term))))).OrderBy(x => x.Name).Take(limit).Select(x => new AdminGlobalSearchResult("Product", x.Id, x.Name, $"SKU {x.Sku}", "/superadmin/products")).ToListAsync(ct);
        var medicines = await db.Medicines.AsNoTracking().Where(x => x.Name.Contains(term) || (x.GenericName != null && x.GenericName.Contains(term)) || (x.Strength != null && x.Strength.Contains(term))).OrderBy(x => x.Name).Take(limit).Select(x => new AdminGlobalSearchResult("Medicine", x.Id, x.Name, x.Strength, "/superadmin/catalog")).ToListAsync(ct);
        var orders = await ScopeOrders(db.Orders.AsNoTracking()).Where(x => x.OrderNumber.Contains(term) || (x.Customer != null && (x.Customer.FullName.Contains(term) || x.Customer.Email.Contains(term) || x.Customer.Phone.Contains(term)))).OrderByDescending(x => x.CreatedAt).Take(limit).Select(x => new AdminGlobalSearchResult("Order", x.Id, x.OrderNumber, $"{x.Customer!.FullName} · {x.Status}", "/superadmin/orders")).ToListAsync(ct);
        var prescriptions = await ScopePrescriptions(db.Prescriptions.AsNoTracking()).Where(x => x.OriginalFileName.Contains(term) || (x.Customer != null && (x.Customer.FullName.Contains(term) || x.Customer.Email.Contains(term)))).OrderByDescending(x => x.CreatedAt).Take(limit).Select(x => new AdminGlobalSearchResult("Prescription", x.Id, x.OriginalFileName, $"{x.Customer!.FullName} · {x.Status}", "/superadmin/prescriptions")).ToListAsync(ct);
        var branchSearch = db.Branches.AsNoTracking(); if (IsBranchScoped) branchSearch = SupervisorBranchId.HasValue ? branchSearch.Where(x => x.Id == SupervisorBranchId.Value) : branchSearch.Where(_ => false);
        var branches = await branchSearch.Where(x => x.Name.Contains(term) || (x.Code != null && x.Code.Contains(term)) || (x.District != null && x.District.Contains(term)) || (x.Municipality != null && x.Municipality.Contains(term))).OrderBy(x => x.Name).Take(limit).Select(x => new AdminGlobalSearchResult("Branch", x.Id, x.Name, x.District ?? x.Address, "/superadmin/branches")).ToListAsync(ct);
        var staffSearch = db.StaffUsers.AsNoTracking(); if (IsBranchScoped) staffSearch = SupervisorBranchId.HasValue ? staffSearch.Where(x => x.BranchId == SupervisorBranchId.Value) : staffSearch.Where(_ => false);
        var staff = await staffSearch.Where(x => x.FullName.Contains(term) || x.Email.Contains(term) || x.Phone.Contains(term) || x.Role.Contains(term)).OrderBy(x => x.FullName).Take(limit).Select(x => new AdminGlobalSearchResult("Staff", x.Id, x.FullName, $"{x.Role} · {x.Email}", "/superadmin/staff")).ToListAsync(ct);
        var supplierSearch = db.Suppliers.AsNoTracking();
        if (IsBranchScoped && SupervisorBranchId is Guid supplierBranch)
            supplierSearch = supplierSearch.Where(x => db.PurchaseOrders.Any(order => order.SupplierId == x.Id && order.BranchId == supplierBranch) || db.SupplierInvoices.Any(invoice => invoice.SupplierId == x.Id && (invoice.BranchId == supplierBranch || invoice.BranchId == null && invoice.PurchaseOrder != null && invoice.PurchaseOrder.BranchId == supplierBranch)) || db.SupplierPayments.Any(payment => payment.SupplierId == x.Id && payment.BranchId == supplierBranch));
        else if (IsBranchScoped) supplierSearch = supplierSearch.Where(_ => false);
        var suppliers = await supplierSearch.Where(x => x.Name.Contains(term) || (x.ContactPerson != null && x.ContactPerson.Contains(term)) || (x.Email != null && x.Email.Contains(term)) || (x.Phone != null && x.Phone.Contains(term))).OrderBy(x => x.Name).Take(limit).Select(x => new AdminGlobalSearchResult("Supplier", x.Id, x.Name, x.ContactPerson ?? x.Email, "/superadmin/branches")).ToListAsync(ct);

        return Ok(customers.Concat(products).Concat(medicines).Concat(orders).Concat(prescriptions).Concat(branches).Concat(staff).Concat(suppliers).Take(limit).ToList());
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<AdminDashboardResponse>> Dashboard([FromQuery] string? range, [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!Can(AppPermissions.ReportsView)) return Forbid();
        var now = DateTime.UtcNow; var today = now.Date; var week = today.AddDays(-6); var month = new DateTime(today.Year, today.Month, 1);
        var orders = ScopeOrders(db.Orders.AsNoTracking());
        var revenue = await orders.Where(x => x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).GroupBy(_ => 1).Select(g => (decimal?)g.Sum(x => x.Total)).FirstOrDefaultAsync(ct) ?? 0;
        var todayRevenue = await orders.Where(x => x.CreatedAt >= today && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var weekRevenue = await orders.Where(x => x.CreatedAt >= week && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var monthRevenue = await orders.Where(x => x.CreatedAt >= month && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var orderCounts = await orders.GroupBy(x => x.Status).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var scopedOrderIds = orders.Select(x => x.Id);
        var prescriptionCounts = await ScopePrescriptions(db.Prescriptions.AsNoTracking()).GroupBy(x => x.Status).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var inventory = await ScopeInventory(db.Inventory.AsNoTracking()).ToListAsync(ct); var date = DateTime.UtcNow.Date;
        var inventoryCounts = new Dictionary<string, int> { ["TOTAL"] = inventory.Count, ["LOW_STOCK"] = inventory.Count(x => x.StockQuantity - x.ReservedQuantity <= x.MinimumStock && x.StockQuantity - x.ReservedQuantity > 0), ["OUT_OF_STOCK"] = inventory.Count(x => x.StockQuantity - x.ReservedQuantity <= 0), ["NEAR_EXPIRY"] = inventory.Count(x => x.ExpiryDate is not null && x.ExpiryDate.Value.Date >= date && x.ExpiryDate.Value.Date <= date.AddDays(90)), ["EXPIRED"] = inventory.Count(x => x.ExpiryDate is not null && x.ExpiryDate.Value.Date < date) };
        var staffQuery = db.StaffUsers.AsNoTracking(); if (IsBranchScoped) staffQuery = SupervisorBranchId.HasValue ? staffQuery.Where(x => x.BranchId == SupervisorBranchId.Value) : staffQuery.Where(_ => false);
        var staff = await staffQuery.GroupBy(x => x.Role).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var trend = new List<AdminTrendPoint>(); for (var i = 6; i >= 0; i--) { var start = today.AddDays(-i); var end = start.AddDays(1); var row = await orders.Where(x => x.CreatedAt >= start && x.CreatedAt < end).GroupBy(_ => 1).Select(g => new { Revenue = g.Sum(x => x.Total), Orders = g.Count() }).FirstOrDefaultAsync(ct); trend.Add(new AdminTrendPoint(start.ToString("yyyy-MM-dd"), row?.Revenue ?? 0, row?.Orders ?? 0)); }
        var topRows = await db.OrderItems.AsNoTracking().Where(x => scopedOrderIds.Contains(x.OrderId) && x.Order!.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed).GroupBy(x => new { x.ProductId, x.ProductName }).Select(g => new { g.Key.ProductId, g.Key.ProductName, Quantity = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.Quantity * x.UnitPrice) }).OrderByDescending(x => x.Quantity).Take(10).ToListAsync(ct);
        var top = topRows.Select(x => new AdminTopProduct(x.ProductId, x.ProductName, x.Quantity, x.Revenue)).ToList();
        var categoryRows = await db.OrderItems.AsNoTracking().Where(x => scopedOrderIds.Contains(x.OrderId) && x.Order!.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed && x.Product!.Medicine!.Category != null).GroupBy(x => x.Product!.Medicine!.Category!.Name).Select(g => new { Category = g.Key, Quantity = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.Quantity * x.UnitPrice) }).OrderByDescending(x => x.Revenue).Take(8).ToListAsync(ct);
        var categorySales = categoryRows.Select(x => new AdminCategorySale(x.Category, x.Quantity, x.Revenue)).ToList();
        var recentOrders = await orders.Include(x => x.Customer).Include(x => x.Branch).OrderByDescending(x => x.CreatedAt).Take(5).Select(x => new AdminOrderRow(x.Id, x.OrderNumber, x.OrderCustomerName ?? x.Customer!.FullName, x.OrderCustomerPhone ?? x.Customer!.Phone, x.Branch == null ? null : x.Branch.Name, x.Status, x.PaymentStatus, x.Total, x.CreatedAt, x.OrderMode)).ToListAsync(ct);
        var rangeEnd = (to?.Date.AddDays(1) ?? today.AddDays(1));
        var rangeStart = from?.Date ?? (range?.ToLowerInvariant() switch { "today" => today, "yesterday" => today.AddDays(-1), "last7" => today.AddDays(-6), "last30" => today.AddDays(-29), "lastmonth" => month.AddMonths(-1), "thisyear" => new DateTime(today.Year, 1, 1), _ => week });
        if (rangeStart >= rangeEnd) return BadRequest(new { message = "The dashboard date range is invalid." });
        var rangeOrders = orders.Where(x => x.CreatedAt >= rangeStart && x.CreatedAt < rangeEnd);
        var pendingPrescriptionStatuses = new List<string> { PrescriptionStatuses.Uploaded, PrescriptionStatuses.Scanning, PrescriptionStatuses.Scanned, PrescriptionStatuses.PendingPharmacistReview, PrescriptionStatuses.UnderReview, PrescriptionStatuses.NeedClarification };
        var kpis = new AdminKpiSummary(
            await ScopeCustomers(db.Customers.AsNoTracking()).CountAsync(ct),
            await ScopeCustomers(db.Customers.AsNoTracking()).CountAsync(x => x.CreatedAt >= rangeStart && x.CreatedAt < rangeEnd, ct),
            await rangeOrders.CountAsync(x => x.Status == OrderStatuses.Pending || x.Status == OrderStatuses.PrescriptionVerification, ct),
            await rangeOrders.CountAsync(x => x.Status == OrderStatuses.Preparing, ct),
            await rangeOrders.CountAsync(x => x.Status == OrderStatuses.Delivered, ct),
            await rangeOrders.CountAsync(x => x.Status == OrderStatuses.Cancelled, ct),
            await ScopePrescriptions(db.Prescriptions.AsNoTracking()).CountAsync(x => pendingPrescriptionStatuses.Contains(x.Status), ct),
            await ScopePrescriptions(db.Prescriptions.AsNoTracking()).CountAsync(x => x.Status == PrescriptionStatuses.Approved || x.Status == PrescriptionStatuses.PartiallyApproved, ct),
            await ScopePrescriptions(db.Prescriptions.AsNoTracking()).CountAsync(x => x.Status == PrescriptionStatuses.Rejected, ct),
            await rangeOrders.CountAsync(x => x.PaymentStatus != "PAID" && x.PaymentStatus != "COMPLETED", ct),
            await rangeOrders.CountAsync(x => x.PaymentMethod == PaymentMethods.CashOnDelivery, ct),
            await rangeOrders.CountAsync(x => x.PaymentMethod != PaymentMethods.CashOnDelivery, ct),
            IsBranchScoped ? (SupervisorBranchId.HasValue ? 1 : 0) : await db.Branches.CountAsync(x => x.IsActive, ct),
            await staffQuery.CountAsync(x => x.IsActive && x.Role == StaffRoles.Pharmacist, ct),
            await staffQuery.CountAsync(x => x.IsActive && x.Role == StaffRoles.Delivery, ct),
            rangeStart.ToString("yyyy-MM-dd"), rangeEnd.AddDays(-1).ToString("yyyy-MM-dd"));
        var yesterdayRevenue = await orders.Where(x => x.CreatedAt >= today.AddDays(-1) && x.CreatedAt < today && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var yearRevenue = await orders.Where(x => x.CreatedAt >= new DateTime(today.Year, 1, 1) && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var deliveryCounts = await db.DeliveryAssignments.AsNoTracking().Where(x => scopedOrderIds.Contains(x.OrderId) && x.CreatedAt >= rangeStart && x.CreatedAt < rangeEnd).GroupBy(x => x.Status).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var paymentMethodCounts = await rangeOrders.GroupBy(x => x.PaymentMethod).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var branchRows = await rangeOrders.Where(x => x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).GroupBy(x => x.BranchId).Select(g => new { BranchId = g.Key, Orders = g.Count(), Revenue = g.Sum(x => x.Total) }).OrderByDescending(x => x.Revenue).ToListAsync(ct);
        var visibleBranches = db.Branches.AsNoTracking();
        if (IsBranchScoped) visibleBranches = SupervisorBranchId.HasValue ? visibleBranches.Where(x => x.Id == SupervisorBranchId.Value) : visibleBranches.Where(_ => false);
        var branchNames = await visibleBranches.ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var cashIn = new Dictionary<Guid, decimal>();
        var cashOut = new Dictionary<Guid, decimal>();
        void AddCash(Dictionary<Guid, decimal> totals, Guid? branch, decimal amount)
        {
            if (branch is Guid id && branchNames.ContainsKey(id)) totals[id] = totals.GetValueOrDefault(id) + amount;
        }
        var posCash = await db.PaymentTransactions.AsNoTracking().Where(x => x.Status == PaymentTransactionStatuses.Paid && x.PaidAt >= rangeStart && x.PaidAt < rangeEnd && x.Order!.BranchId.HasValue).Select(x => new { x.Order!.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var row in posCash) AddCash(cashIn, row.BranchId, row.Amount);
        var customerCash = await db.CustomerPayments.AsNoTracking().Where(x => x.Status == "CLEARED" && x.PaymentDate >= rangeStart && x.PaymentDate < rangeEnd && x.BranchId.HasValue).Select(x => new { x.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var row in customerCash) AddCash(cashIn, row.BranchId, row.Amount);
        var accountantCashIn = await db.AccountantPayments.AsNoTracking().Where(x => x.Status == "CLEARED" && x.InvoiceId.HasValue && x.PaymentDate >= rangeStart && x.PaymentDate < rangeEnd && x.Invoice!.Order!.BranchId.HasValue).Select(x => new { x.Invoice!.Order!.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var row in accountantCashIn) AddCash(cashIn, row.BranchId, row.Amount);
        var supplierCash = await db.SupplierPayments.AsNoTracking().Where(x => x.Status == "CLEARED" && x.PaymentDate >= rangeStart && x.PaymentDate < rangeEnd && x.BranchId.HasValue).Select(x => new { x.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var row in supplierCash) AddCash(cashOut, row.BranchId, row.Amount);
        var accountantCashOut = await db.AccountantPayments.AsNoTracking().Where(x => x.Status == "CLEARED" && x.SupplierInvoiceId.HasValue && x.PaymentDate >= rangeStart && x.PaymentDate < rangeEnd).Select(x => new { BranchId = x.SupplierInvoice!.BranchId ?? x.SupplierInvoice.PurchaseOrder!.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var row in accountantCashOut) AddCash(cashOut, row.BranchId, row.Amount);
        var branchExpenses = await db.BusinessExpenses.AsNoTracking().Where(x => x.ExpenseDate >= rangeStart && x.ExpenseDate < rangeEnd && x.BranchId.HasValue).Select(x => new { x.BranchId, x.Amount }).ToListAsync(ct);
        foreach (var row in branchExpenses) AddCash(cashOut, row.BranchId, row.Amount);
        var cashRefunds = await db.SaleReturns.AsNoTracking().Where(x => x.Status == "APPROVED" && x.ReturnDate >= rangeStart && x.ReturnDate < rangeEnd).Select(x => new { BranchId = (Guid?)x.BranchId, x.CashRefundAmount }).ToListAsync(ct);
        foreach (var row in cashRefunds) AddCash(cashOut, row.BranchId, row.CashRefundAmount);
        var branchPerformance = branchNames.Select(x =>
        {
            var row = branchRows.FirstOrDefault(y => y.BranchId == x.Key);
            var received = cashIn.GetValueOrDefault(x.Key);
            var paid = cashOut.GetValueOrDefault(x.Key);
            return new AdminBranchPerformance(x.Key, x.Value, row?.Orders ?? 0, row?.Revenue ?? 0m, received, paid, received - paid);
        }).OrderByDescending(x => x.Revenue).ToList();
        var unassignedSales = branchRows.FirstOrDefault(x => !x.BranchId.HasValue);
        if (unassignedSales is not null) branchPerformance.Add(new AdminBranchPerformance(null, "Unassigned", unassignedSales.Orders, unassignedSales.Revenue));
        var registrations = new List<AdminRegistrationPoint>();
        for (var i = 6; i >= 0; i--) { var start = today.AddDays(-i); registrations.Add(new AdminRegistrationPoint(start.ToString("yyyy-MM-dd"), await ScopeCustomers(db.Customers.AsNoTracking()).CountAsync(x => x.CreatedAt >= start && x.CreatedAt < start.AddDays(1), ct))); }
        var scopedCustomers = ScopeCustomers(db.Customers.AsNoTracking());
        var operations = new AdminDashboardOperations(yesterdayRevenue, yearRevenue, await scopedCustomers.CountAsync(x => x.IsActive, ct), await scopedCustomers.CountAsync(x => !x.IsActive, ct), await db.Products.CountAsync(x => x.IsActive, ct), inventory.Sum(x => Math.Max(x.StockQuantity - x.ReservedQuantity, 0) * x.PurchasePrice), deliveryCounts, paymentMethodCounts, registrations, branchPerformance);
        return Ok(new AdminDashboardResponse(todayRevenue, weekRevenue, monthRevenue, revenue, orderCounts, prescriptionCounts, inventoryCounts, staff, trend, top, categorySales, recentOrders, kpis, operations));
    }

    [HttpGet("branch-sales")]
    public async Task<ActionResult<BranchSalesReportResponse>> BranchSales([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? branchId, CancellationToken ct)
    {
        if (!Can(AppPermissions.ReportsView)) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var endExclusive = (to?.Date.AddDays(1) ?? DateTime.UtcNow.Date.AddDays(1));
        var start = from?.Date ?? endExclusive.AddDays(-30);
        if (start >= endExclusive) return BadRequest(new { message = "The branch sales date range is invalid." });
        var orders = ScopeOrders(db.Orders.AsNoTracking())
            .Include(x => x.Customer).Include(x => x.Branch)
            .Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive && x.Status != "CANCELLED" && x.Status != "FAILED");
        if (branchId.HasValue) orders = orders.Where(x => x.BranchId == branchId.Value);
        var rows = await orders.OrderByDescending(x => x.CreatedAt).Select(x => new BranchSalesOrder(x.Id, x.BranchId, x.OrderNumber, x.Customer!.FullName, x.CreatedAt, x.Total, x.Status, x.Branch == null ? null : x.Branch.Name)).ToListAsync(ct);
        var branchQuery = db.Branches.AsNoTracking().Where(x => x.IsActive);
        if (IsBranchScoped) branchQuery = SupervisorBranchId.HasValue ? branchQuery.Where(x => x.Id == SupervisorBranchId.Value) : branchQuery.Where(_ => false);
        if (branchId.HasValue) branchQuery = branchQuery.Where(x => x.Id == branchId.Value);
        var activeBranches = await branchQuery.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var summaries = activeBranches.Select(branch => { var branchRows = rows.Where(x => x.BranchId == branch.Id).ToList(); return new BranchSalesSummary(branch.Id, branch.Name, branchRows.Sum(x => x.Amount), branchRows.Count, branchRows.Select(x => x.CustomerName).Distinct().OrderBy(x => x).ToList()); }).ToList();
        var unassigned = rows.Where(x => !x.BranchId.HasValue).ToList();
        if (unassigned.Count > 0) summaries.Add(new BranchSalesSummary(null, "Unassigned", unassigned.Sum(x => x.Amount), unassigned.Count, unassigned.Select(x => x.CustomerName).Distinct().OrderBy(x => x).ToList()));
        summaries = summaries.OrderByDescending(x => x.TotalSales).ThenBy(x => x.BranchName).ToList();
        return Ok(new BranchSalesReportResponse(summaries, rows, start, endExclusive.AddTicks(-1)));
    }

    [HttpGet("branch-operations")]
    public async Task<ActionResult<IReadOnlyList<BranchOperationsRow>>> BranchOperations([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? branchId, CancellationToken ct)
    {
        if (!Can(AppPermissions.ReportsView)) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId.Value)) return Forbid();
        var endLocal = (to?.Date.AddDays(1) ?? ApplicationTime.NepalNow.Date.AddDays(1));
        var startLocal = from?.Date ?? endLocal.AddDays(-1);
        if (startLocal >= endLocal || endLocal - startLocal > TimeSpan.FromDays(366)) return BadRequest(new { message = "Choose a valid activity range of no more than one year." });
        var start = ApplicationTime.ToUtc(startLocal); var end = ApplicationTime.ToUtc(endLocal);
        var branches = db.Branches.AsNoTracking().Where(x => x.IsActive);
        if (IsBranchScoped) branches = SupervisorBranchId.HasValue ? branches.Where(x => x.Id == SupervisorBranchId.Value) : branches.Where(_ => false);
        if (branchId.HasValue) branches = branches.Where(x => x.Id == branchId.Value);
        var branchRows = await branches.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var orderRows = await ScopeOrders(db.Orders.AsNoTracking()).Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.BranchId != null)
            .GroupBy(x => x.BranchId!.Value).Select(g => new { BranchId = g.Key, Orders = g.Count(), Customers = g.Select(x => x.CustomerId).Distinct().Count(),
                Pharmacies = g.Where(x => x.Customer != null && x.Customer.AccountType == "PHARMACY").Select(x => x.CustomerId).Distinct().Count(),
                PendingPayments = g.Count(x => x.PaymentStatus != PaymentTransactionStatuses.Paid && x.PaymentStatus != "COMPLETED"),
                Delivered = g.Count(x => x.Status == OrderStatuses.Delivered), Value = g.Where(x => x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed).Sum(x => (decimal?)x.Total) ?? 0m }).ToListAsync(ct);
        var deliveryRows = await db.DeliveryAssignments.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Order != null && x.Order.BranchId != null)
            .GroupBy(x => x.Order!.BranchId!.Value).Select(g => new { BranchId = g.Key, Riders = g.Select(x => x.DeliveryStaffId).Distinct().Count() }).ToListAsync(ct);
        var paymentRows = await db.PaymentTransactions.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Order != null && x.Order.BranchId != null)
            .GroupBy(x => x.Order!.BranchId!.Value).Select(g => new { BranchId = g.Key,
                PaidCount = g.Count(x => x.Status == PaymentTransactionStatuses.Paid),
                PaidAmount = g.Where(x => x.Status == PaymentTransactionStatuses.Paid).Sum(x => (decimal?)x.Amount) ?? 0m }).ToListAsync(ct);
        var productRows = await ScopeInventory(db.Inventory.AsNoTracking()).Where(x => x.BranchId != Guid.Empty)
            .GroupBy(x => x.BranchId).Select(g => new { BranchId = g.Key, Products = g.Select(x => x.ProductId).Distinct().Count() }).ToListAsync(ct);
        var activeRiders = await db.StaffUsers.AsNoTracking().Where(x => x.IsActive && x.Role == StaffRoles.Delivery && x.BranchId != null)
            .GroupBy(x => x.BranchId!.Value).Select(g => new { BranchId = g.Key, Riders = g.Count() }).ToListAsync(ct);
        var rows = branchRows.Select(branch =>
        {
            var orders = orderRows.FirstOrDefault(x => x.BranchId == branch.Id);
            return new BranchOperationsRow(branch.Id, branch.Name, orders?.Orders ?? 0, orders?.Customers ?? 0, orders?.Pharmacies ?? 0,
                orders?.PendingPayments ?? 0, deliveryRows.FirstOrDefault(x => x.BranchId == branch.Id)?.Riders ?? 0, orders?.Delivered ?? 0,
                orders?.Value ?? 0m, startLocal, endLocal.AddTicks(-1), productRows.FirstOrDefault(x => x.BranchId == branch.Id)?.Products ?? 0,
                activeRiders.FirstOrDefault(x => x.BranchId == branch.Id)?.Riders ?? 0,
                paymentRows.FirstOrDefault(x => x.BranchId == branch.Id)?.PaidCount ?? 0,
                paymentRows.FirstOrDefault(x => x.BranchId == branch.Id)?.PaidAmount ?? 0m);
        }).ToList();
        return Ok(rows);
    }

    [HttpGet("customer-statements")]
    public async Task<ActionResult<CustomerStatementResponse>> CustomerStatement([FromQuery] Guid customerId, [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!Can(AppPermissions.ReportsView) || customerId == Guid.Empty) return Forbid();
        var customer = await ScopeCustomers(db.Customers.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == customerId, ct);
        if (customer is null) return NotFound();
        var endLocal = (to?.Date.AddDays(1) ?? ApplicationTime.NepalNow.Date.AddDays(1));
        var startLocal = from?.Date ?? endLocal.AddDays(-7);
        if (startLocal >= endLocal || endLocal - startLocal > TimeSpan.FromDays(366)) return BadRequest(new { message = "Choose a valid statement period of no more than one year." });
        var start = ApplicationTime.ToUtc(startLocal); var end = ApplicationTime.ToUtc(endLocal);
        var orders = await ScopeOrders(db.Orders.AsNoTracking()).Where(x => x.CustomerId == customerId && x.CreatedAt >= start && x.CreatedAt < end && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed)
            .Include(x => x.PaymentTransactions).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var lines = orders.Select(order =>
        {
            var billed = order.Total;
            var paid = order.PaymentTransactions.Where(x => x.Status == PaymentTransactionStatuses.Paid).Sum(x => x.Amount);
            paid = Math.Min(billed, paid);
            return new CustomerStatementLine(order.Id, order.OrderNumber, order.CreatedAt, order.Status, order.PaymentStatus, order.PaymentMethod, billed, paid, Math.Max(0m, billed - paid));
        }).ToList();
        return Ok(new CustomerStatementResponse(customer.Id, customer.FullName, customer.Phone, startLocal, endLocal.AddTicks(-1), lines.Count, lines.Sum(x => x.BilledAmount), lines.Sum(x => x.PaidAmount), lines.Sum(x => x.Balance), lines));
    }

    [HttpGet("reports/export")]
    public async Task<IActionResult> ExportReport([FromQuery] string type = "orders", [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] string format = "csv", [FromQuery] Guid? branchId = null, [FromQuery] Guid? productId = null, [FromQuery] Guid? categoryId = null, [FromQuery] Guid? brandId = null, [FromQuery] string? status = null, [FromQuery] string? paymentMethod = null, [FromQuery] Guid? staffId = null, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.ReportsView)) return Forbid();
        var report = type.Trim().ToLowerInvariant();
        if (IsBranchScoped && !SupervisorBranchId.HasValue) return Forbid();
        if (IsBranchScoped) branchId = SupervisorBranchId;
        var endExclusive = (to?.Date.AddDays(1) ?? DateTime.UtcNow.Date.AddDays(1));
        var start = from?.Date ?? endExclusive.AddDays(-30);
        if (start >= endExclusive) return BadRequest(new { message = "The report date range is invalid." });
        var statusFilter = status?.Trim();
        var paymentMethodFilter = paymentMethod?.Trim();
        IQueryable<PharmacyOrder> ApplyOrderFilters(IQueryable<PharmacyOrder> query)
        {
            query = ScopeOrders(query);
            if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
            if (productId.HasValue) query = query.Where(x => x.Items.Any(item => item.ProductId == productId.Value));
            if (categoryId.HasValue) query = query.Where(x => x.Items.Any(item => item.Product != null && item.Product.Medicine != null && item.Product.Medicine.CategoryId == categoryId.Value));
            if (brandId.HasValue) query = query.Where(x => x.Items.Any(item => item.Product != null && item.Product.BrandId == brandId.Value));
            if (staffId.HasValue) query = query.Where(x => x.PharmacistId == staffId.Value || db.DeliveryAssignments.Any(assignment => assignment.OrderId == x.Id && assignment.DeliveryStaffId == staffId.Value));
            if (!string.IsNullOrWhiteSpace(statusFilter)) query = query.Where(x => x.Status == statusFilter);
            if (!string.IsNullOrWhiteSpace(paymentMethodFilter)) query = query.Where(x => x.PaymentMethod == paymentMethodFilter);
            return query;
        }
        var matchingOrderIds = ApplyOrderFilters(db.Orders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive)).Select(x => x.Id);

        var csv = new StringBuilder();
        switch (report)
        {
            case "orders":
                csv.AppendLine("Order number,Created at,Customer,Phone,Branch,Status,Payment status,Payment method,Subtotal,Discount,Delivery fee,Total");
                var orders = await ApplyOrderFilters(db.Orders.AsNoTracking().Include(x => x.Customer).Include(x => x.Branch).Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive)).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
                foreach (var order in orders)
                {
                    var subtotal = order.Total - order.DeliveryFee + order.DiscountAmount;
                    csv.AppendLine(string.Join(',', Csv(order.OrderNumber), Csv(order.CreatedAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)), Csv(order.Customer?.FullName), Csv(order.Customer?.Phone), Csv(order.Branch?.Name), Csv(order.Status), Csv(order.PaymentStatus), Csv(order.PaymentMethod), Money(subtotal), Money(order.DiscountAmount), Money(order.DeliveryFee), Money(order.Total)));
                }
                break;
            case "payments":
                csv.AppendLine("Transaction number,Created at,Order number,Customer,Method,Status,Amount,Provider reference");
                var paymentsQuery = db.PaymentTransactions.AsNoTracking().Include(x => x.Order).ThenInclude(x => x!.Customer).Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive && matchingOrderIds.Contains(x.OrderId));
                if (!string.IsNullOrWhiteSpace(statusFilter)) paymentsQuery = paymentsQuery.Where(x => x.Status == statusFilter);
                if (!string.IsNullOrWhiteSpace(paymentMethodFilter)) paymentsQuery = paymentsQuery.Where(x => x.Method == paymentMethodFilter);
                var payments = await paymentsQuery.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
                foreach (var payment in payments) csv.AppendLine(string.Join(',', Csv(payment.TransactionNumber), Csv(payment.CreatedAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)), Csv(payment.Order?.OrderNumber), Csv(payment.Order?.Customer?.FullName), Csv(payment.Method), Csv(payment.Status), Money(payment.Amount), Csv(payment.ProviderReference)));
                break;
            case "customers":
                csv.AppendLine("Customer,Email,Phone,Status,Registered at");
                var customerQuery = ScopeCustomers(db.Customers.AsNoTracking()).Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive);
                if (!string.IsNullOrWhiteSpace(statusFilter)) customerQuery = customerQuery.Where(x => statusFilter == "ACTIVE" ? x.IsActive : statusFilter == "INACTIVE" && !x.IsActive);
                var customers = await customerQuery.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
                foreach (var customer in customers) csv.AppendLine(string.Join(',', Csv(customer.FullName), Csv(customer.Email), Csv(customer.Phone), Csv(customer.IsActive ? "ACTIVE" : "INACTIVE"), Csv(customer.CreatedAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture))));
                break;
            case "inventory":
                csv.AppendLine("Product,SKU,Branch,Batch,Stock quantity,Reserved,Available,Purchase price,Expiry date,Status");
                var inventoryQuery = ScopeInventory(db.Inventory.AsNoTracking()).Include(x => x.Product).Include(x => x.Branch).Where(x => x.UpdatedAt >= start && x.UpdatedAt < endExclusive);
                if (branchId.HasValue) inventoryQuery = inventoryQuery.Where(x => x.BranchId == branchId.Value);
                if (productId.HasValue) inventoryQuery = inventoryQuery.Where(x => x.ProductId == productId.Value);
                if (categoryId.HasValue) inventoryQuery = inventoryQuery.Where(x => x.Product!.Medicine!.CategoryId == categoryId.Value);
                if (brandId.HasValue) inventoryQuery = inventoryQuery.Where(x => x.Product!.BrandId == brandId.Value);
                var inventory = await inventoryQuery.OrderBy(x => x.Product!.Name).ToListAsync(ct);
                foreach (var item in inventory)
                {
                    var available = Math.Max(0, item.StockQuantity - item.ReservedQuantity);
                    var inventoryStatus = item.ExpiryDate < DateTime.UtcNow.Date ? "EXPIRED" : available <= 0 ? "OUT_OF_STOCK" : available <= item.MinimumStock ? "LOW_STOCK" : "IN_STOCK";
                    csv.AppendLine(string.Join(',', Csv(item.Product?.Name), Csv(item.Product?.Sku), Csv(item.Branch?.Name), Csv(item.BatchNumber), item.StockQuantity, item.ReservedQuantity, available, Money(item.PurchasePrice), Csv(item.ExpiryDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)), Csv(inventoryStatus)));
                }
                break;
            case "products":
                csv.AppendLine("Product,Product ID,Quantity sold,Revenue,Orders");
                var productSalesQuery = db.OrderItems.AsNoTracking().Where(x => x.Order!.CreatedAt >= start && x.Order.CreatedAt < endExclusive && x.Order.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed && matchingOrderIds.Contains(x.OrderId));
                if (productId.HasValue) productSalesQuery = productSalesQuery.Where(x => x.ProductId == productId.Value);
                if (categoryId.HasValue) productSalesQuery = productSalesQuery.Where(x => x.Product!.Medicine!.CategoryId == categoryId.Value);
                if (brandId.HasValue) productSalesQuery = productSalesQuery.Where(x => x.Product!.BrandId == brandId.Value);
                var productSales = await productSalesQuery.GroupBy(x => new { x.ProductId, x.ProductName }).Select(g => new { g.Key.ProductId, g.Key.ProductName, Quantity = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.Quantity * x.UnitPrice), Orders = g.Select(x => x.OrderId).Distinct().Count() }).OrderByDescending(x => x.Revenue).ToListAsync(ct);
                foreach (var row in productSales) csv.AppendLine(string.Join(',', Csv(row.ProductName), row.ProductId, row.Quantity, Money(row.Revenue), row.Orders));
                break;
            case "categories":
                csv.AppendLine("Category,Quantity sold,Revenue,Orders");
                var categoryItemsQuery = db.OrderItems.AsNoTracking().Include(x => x.Order).Include(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category).Where(x => x.Order!.CreatedAt >= start && x.Order.CreatedAt < endExclusive && x.Order.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed && matchingOrderIds.Contains(x.OrderId));
                if (productId.HasValue) categoryItemsQuery = categoryItemsQuery.Where(x => x.ProductId == productId.Value);
                if (categoryId.HasValue) categoryItemsQuery = categoryItemsQuery.Where(x => x.Product!.Medicine!.CategoryId == categoryId.Value);
                if (brandId.HasValue) categoryItemsQuery = categoryItemsQuery.Where(x => x.Product!.BrandId == brandId.Value);
                var categoryItems = await categoryItemsQuery.ToListAsync(ct);
                foreach (var group in categoryItems.GroupBy(x => x.Product?.Medicine?.Category?.Name ?? "Uncategorized").OrderByDescending(x => x.Sum(item => item.Quantity * item.UnitPrice))) csv.AppendLine(string.Join(',', Csv(group.Key), group.Sum(x => x.Quantity), Money(group.Sum(x => x.Quantity * x.UnitPrice)), group.Select(x => x.OrderId).Distinct().Count()));
                break;
            case "prescriptions":
                csv.AppendLine("Status,Prescriptions");
                var prescriptionQuery = ScopePrescriptions(db.Prescriptions.AsNoTracking()).Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive);
                if (!string.IsNullOrWhiteSpace(statusFilter)) prescriptionQuery = prescriptionQuery.Where(x => x.Status == statusFilter);
                if (staffId.HasValue) prescriptionQuery = prescriptionQuery.Where(x => db.Orders.Any(order => order.PrescriptionId == x.Id && (order.PharmacistId == staffId.Value || db.DeliveryAssignments.Any(assignment => assignment.OrderId == order.Id && assignment.DeliveryStaffId == staffId.Value))));
                if (branchId.HasValue) prescriptionQuery = prescriptionQuery.Where(x => db.Orders.Any(order => order.PrescriptionId == x.Id && order.BranchId == branchId.Value));
                if (productId.HasValue) prescriptionQuery = prescriptionQuery.Where(x => x.ExtractedItems.Any(item => item.Matches.Any(match => match.ProductId == productId.Value)));
                if (brandId.HasValue) prescriptionQuery = prescriptionQuery.Where(x => x.ExtractedItems.Any(item => item.Matches.Any(match => match.Product != null && match.Product.BrandId == brandId.Value)));
                if (categoryId.HasValue) prescriptionQuery = prescriptionQuery.Where(x => x.ExtractedItems.Any(item => item.Matches.Any(match => match.Product != null && match.Product.Medicine != null && match.Product.Medicine.CategoryId == categoryId.Value)));
                var prescriptionStatuses = await prescriptionQuery.GroupBy(x => x.Status).Select(g => new { Status = g.Key, Count = g.Count() }).OrderByDescending(x => x.Count).ToListAsync(ct);
                foreach (var row in prescriptionStatuses) csv.AppendLine(string.Join(',', Csv(row.Status), row.Count));
                break;
            case "delivery":
                csv.AppendLine("Delivery staff,Status,Assignments,Average hours to completion,Failures");
                var assignmentsQuery = db.DeliveryAssignments.AsNoTracking().Include(x => x.DeliveryStaff).Include(x => x.Order).Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive && matchingOrderIds.Contains(x.OrderId));
                if (staffId.HasValue) assignmentsQuery = assignmentsQuery.Where(x => x.DeliveryStaffId == staffId.Value);
                if (!string.IsNullOrWhiteSpace(statusFilter)) assignmentsQuery = assignmentsQuery.Where(x => x.Status == statusFilter);
                var assignments = await assignmentsQuery.ToListAsync(ct);
                foreach (var group in assignments.GroupBy(x => new { Staff = x.DeliveryStaff?.FullName ?? "Unassigned", x.Status }).OrderBy(x => x.Key.Staff).ThenBy(x => x.Key.Status))
                {
                    var durations = group.Where(x => x.DeliveredAt.HasValue || x.FailedAt.HasValue).Select(x => ((x.DeliveredAt ?? x.FailedAt)!.Value - x.CreatedAt).TotalHours).ToList();
                    csv.AppendLine(string.Join(',', Csv(group.Key.Staff), Csv(group.Key.Status), group.Count(), durations.Count == 0 ? "" : durations.Average().ToString("0.00", CultureInfo.InvariantCulture), group.Count(x => x.Status == DeliveryStatuses.Failed)));
                }
                break;
            case "branches":
                csv.AppendLine("Branch,Orders,Revenue,Customers");
                var branchOrders = await ApplyOrderFilters(db.Orders.AsNoTracking().Include(x => x.Branch).Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed)).ToListAsync(ct);
                foreach (var group in branchOrders.GroupBy(x => x.Branch?.Name ?? "Unassigned").OrderByDescending(x => x.Sum(item => item.Total))) csv.AppendLine(string.Join(',', Csv(group.Key), group.Count(), Money(group.Sum(x => x.Total)), group.Select(x => x.CustomerId).Distinct().Count()));
                break;
            case "staff":
                csv.AppendLine("Staff,Role,Email,Phone,Branch,Status,Created at");
                var staffQuery = db.StaffUsers.AsNoTracking().Include(x => x.Branch).AsQueryable();
                if (IsBranchScoped) staffQuery = SupervisorBranchId.HasValue ? staffQuery.Where(x => x.BranchId == SupervisorBranchId.Value) : staffQuery.Where(_ => false);
                if (staffId.HasValue) staffQuery = staffQuery.Where(x => x.Id == staffId.Value);
                if (branchId.HasValue) staffQuery = staffQuery.Where(x => x.BranchId == branchId.Value);
                if (!string.IsNullOrWhiteSpace(statusFilter)) staffQuery = staffQuery.Where(x => statusFilter == "ACTIVE" ? x.IsActive : statusFilter == "INACTIVE" && !x.IsActive);
                var staffRows = await staffQuery.OrderBy(x => x.Role).ThenBy(x => x.FullName).ToListAsync(ct);
                foreach (var staffRow in staffRows) csv.AppendLine(string.Join(',', Csv(staffRow.FullName), Csv(staffRow.Role), Csv(staffRow.Email), Csv(staffRow.Phone), Csv(staffRow.Branch?.Name), Csv(staffRow.IsActive ? "ACTIVE" : "INACTIVE"), Csv(staffRow.CreatedAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture))));
                break;
            case "coupons":
                csv.AppendLine("Coupon,Orders using coupon,Discount granted,Usage limit,Used count,Status");
                var couponOrders = await ApplyOrderFilters(db.Orders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < endExclusive && x.CouponCode != null)).GroupBy(x => x.CouponCode!).Select(g => new { Code = g.Key, Orders = g.Count(), Discount = g.Sum(x => x.DiscountAmount) }).ToListAsync(ct);
                var coupons = await db.Coupons.AsNoTracking().ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase, ct);
                foreach (var row in couponOrders.OrderByDescending(x => x.Discount)) { coupons.TryGetValue(row.Code, out var coupon); csv.AppendLine(string.Join(',', Csv(row.Code), row.Orders, Money(row.Discount), coupon?.UsageLimit?.ToString(CultureInfo.InvariantCulture) ?? "", coupon?.UsedCount.ToString(CultureInfo.InvariantCulture) ?? "", Csv(coupon?.IsActive == true ? "ACTIVE" : "INACTIVE"))); }
                break;
            case "tax":
                csv.AppendLine("Invoice,Order number,Created at,Tax amount,Subtotal,Delivery fee,Total");
                var invoices = await db.Invoices.AsNoTracking().Include(x => x.Order).Where(x => x.Order!.CreatedAt >= start && x.Order.CreatedAt < endExclusive && matchingOrderIds.Contains(x.OrderId)).OrderByDescending(x => x.IssuedAt).ToListAsync(ct);
                foreach (var invoice in invoices) csv.AppendLine(string.Join(',', Csv(invoice.InvoiceNumber), Csv(invoice.Order?.OrderNumber), Csv(invoice.IssuedAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)), Money(invoice.TaxAmount), Money(invoice.Subtotal), Money(invoice.DeliveryFee), Money(invoice.Total)));
                break;
            default:
                return BadRequest(new { message = "Supported report types are orders, payments, customers, inventory, products, categories, prescriptions, delivery, branches, staff, coupons, and tax." });
        }

        var safeFormat = format.Trim().ToLowerInvariant();
        if (safeFormat == "pdf")
        {
            Response.Headers.ContentDisposition = $"attachment; filename=anhh-{report}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
            return File(SimplePdfDocument.Create($"All Nepal Healthy Home - {report} report", csv.ToString()), "application/pdf");
        }
        if (safeFormat != "csv") return BadRequest(new { message = "Supported export formats are csv and pdf." });
        Response.Headers.ContentDisposition = $"attachment; filename=anhh-{report}-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8");
    }

    [HttpGet("products")]
    public async Task<ActionResult<PagedResponse<AdminProductRow>>> Products([FromQuery] string? search, [FromQuery] string? company, [FromQuery] string? category, [FromQuery] string sort = "created", [FromQuery] bool activeOnly = false, [FromQuery] bool? missingImages = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.CatalogView)) return Forbid(); page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Products.AsNoTracking().Include(x => x.Medicine).ThenInclude(x => x!.Category).Include(x => x.Brand).Include(x => x.Inventory).Include(x => x.Images).Include(x => x.Units).AsQueryable();
        if (activeOnly) query = query.Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Name.Contains(search) || x.Sku.Contains(search) || x.Medicine!.GenericName!.Contains(search) || x.Brand!.Name.Contains(search) || x.Medicine!.Category!.Name.Contains(search));
        if (!string.IsNullOrWhiteSpace(company)) query = query.Where(x => (x.CompanyName != null && x.CompanyName.Contains(company)) || (x.CompanyCode != null && x.CompanyCode.Contains(company)) || x.Brand!.Name.Contains(company));
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(x => x.Medicine!.Category!.Name == category || x.Medicine.Category.Slug == category);
        if (missingImages.HasValue) query = query.Where(x => missingImages.Value ? x.MissingImageStatus == "MISSING" : x.MissingImageStatus != "MISSING");
        var total = await query.CountAsync(ct);
        query = sort.ToLowerInvariant() switch
        {
            "demand" => query.OrderByDescending(x => x.DemandScore).ThenBy(x => x.DisplayOrder).ThenBy(x => x.Name),
            "rank" => query.OrderBy(x => x.DisplayOrder).ThenByDescending(x => x.DemandScore).ThenBy(x => x.Name),
            "name" => query.OrderBy(x => x.Name),
            _ => query.OrderByDescending(x => x.CreatedAt),
        };
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<AdminProductRow>(rows.Select(ProductRowFromEntity).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpPost("products")]
    public async Task<ActionResult<AdminProductRow>> CreateProduct(UpsertProductRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid(); if (request.Mrp < 0 || request.SellingPrice < 0 || request.SellingPrice > request.Mrp) return BadRequest(new { message = "Product prices are invalid." });
        if (request.ImageVerificationStatus.Equals("VERIFIED_OFFICIAL", StringComparison.OrdinalIgnoreCase) && !(Uri.TryCreate(request.ImageSourceUrl, UriKind.Absolute, out var verifiedImageUri) && IsHttpUri(verifiedImageUri))) return BadRequest(new { message = "A verified official image requires an absolute HTTP or HTTPS source URL." });
        var imageUrls = NormalizeProductImageUrls(request, out var imageError); if (imageError is not null) return BadRequest(new { message = imageError });
        if (!await db.Medicines.AnyAsync(x => x.Id == request.MedicineId, ct) || !await db.Brands.AnyAsync(x => x.Id == request.BrandId, ct)) return BadRequest(new { message = "Medicine or brand was not found." });
        var product = new Product { Name = request.Name.Trim(), Slug = request.Slug.Trim(), Sku = request.Sku.Trim(), MedicineId = request.MedicineId, BrandId = request.BrandId, Mrp = request.Mrp, SellingPrice = request.SellingPrice, ImageUrl = imageUrls[0], IsFeatured = request.IsFeatured, IsActive = request.IsActive, Barcode = request.Barcode, PackSize = request.PackSize, TaxRate = request.TaxRate, DiscountPercent = request.DiscountPercent, BonusScheme = request.BonusScheme?.Trim(), IsBestSeller = request.IsBestSeller, IsNewArrival = request.IsNewArrival, IsTrending = request.IsTrending, IsHotDeal = request.IsHotDeal, SearchKeywords = request.SearchKeywords, CompanyCode = CleanOptional(request.CompanyCode), CompanyName = CleanOptional(request.CompanyName), ImageSourceUrl = CleanOptional(request.ImageSourceUrl), ImageSourceWebsite = CleanOptional(request.ImageSourceWebsite) ?? WebsiteFromUrl(request.ImageSourcePageUrl ?? request.ImageSourceUrl), ImageSourcePageUrl = CleanOptional(request.ImageSourcePageUrl), ImageVerificationStatus = request.ImageVerificationStatus.Trim().ToUpperInvariant(), ImageSourceReference = CleanOptional(request.ImageSourceReference), ImageSearchedAtUtc = request.ImageSearchedAtUtc, ImageMatchingNotes = CleanOptional(request.ImageMatchingNotes), ImageMediaAssetId = request.ImageMediaAssetId ?? ManagedMediaId(imageUrls[0]), DemandScore = Math.Clamp(request.DemandScore, 0, 100), DemandBasis = request.DemandBasis.Trim().ToUpperInvariant(), DemandSourceUrl = CleanOptional(request.DemandSourceUrl), DemandSourceReference = CleanOptional(request.DemandSourceReference), DisplayOrder = Math.Max(0, request.DisplayOrder), ImportStatus = "MANUAL", MissingImageStatus = IsPlaceholderImage(imageUrls[0]) ? "MISSING" : "NOT_MISSING" };
        AddProductImages(product, imageUrls);
        db.Products.Add(product); db.ActivityLogs.Add(Activity("PRODUCT_CREATED", "Product", product.Id.ToString(), null, product.Name)); await db.SaveChangesAsync(ct); return CreatedAtAction(nameof(Product), new { id = product.Id }, await ProductRow(product.Id, ct));
    }

    [HttpGet("products/{id:guid}")]
    public async Task<ActionResult<AdminProductRow>> Product(Guid id, CancellationToken ct) { if (!Can(AppPermissions.CatalogView)) return Forbid(); var row = await ProductRow(id, ct); return row is null ? NotFound() : Ok(row); }

    [HttpPut("products/{id:guid}")]
    public async Task<ActionResult<AdminProductRow>> UpdateProduct(Guid id, UpsertProductRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid(); if (request.ImageVerificationStatus.Equals("VERIFIED_OFFICIAL", StringComparison.OrdinalIgnoreCase) && !(Uri.TryCreate(request.ImageSourceUrl, UriKind.Absolute, out var verifiedImageUri) && IsHttpUri(verifiedImageUri))) return BadRequest(new { message = "A verified official image requires an absolute HTTP or HTTPS source URL." }); var product = await db.Products.Include(x => x.Images).SingleOrDefaultAsync(x => x.Id == id, ct); if (product is null) return NotFound(); var imageUrls = NormalizeProductImageUrls(request, out var imageError); if (imageError is not null) return BadRequest(new { message = imageError }); var previous = JsonSerializer.Serialize(new { product.Name, product.SellingPrice, product.IsActive });
        product.Name = request.Name.Trim(); product.Slug = request.Slug.Trim(); product.Sku = request.Sku.Trim(); product.MedicineId = request.MedicineId; product.BrandId = request.BrandId; product.Mrp = request.Mrp; product.SellingPrice = request.SellingPrice; product.ImageUrl = imageUrls[0]; product.IsFeatured = request.IsFeatured; product.IsActive = request.IsActive; product.Barcode = request.Barcode; product.PackSize = request.PackSize; product.TaxRate = request.TaxRate; product.DiscountPercent = request.DiscountPercent; product.BonusScheme = request.BonusScheme?.Trim(); product.IsBestSeller = request.IsBestSeller; product.IsNewArrival = request.IsNewArrival; product.IsTrending = request.IsTrending; product.IsHotDeal = request.IsHotDeal; product.SearchKeywords = request.SearchKeywords; product.CompanyCode = CleanOptional(request.CompanyCode); product.CompanyName = CleanOptional(request.CompanyName); product.ImageSourceUrl = CleanOptional(request.ImageSourceUrl); product.ImageSourceWebsite = CleanOptional(request.ImageSourceWebsite) ?? WebsiteFromUrl(request.ImageSourcePageUrl ?? request.ImageSourceUrl); product.ImageSourcePageUrl = CleanOptional(request.ImageSourcePageUrl); product.ImageVerificationStatus = request.ImageVerificationStatus.Trim().ToUpperInvariant(); product.ImageSourceReference = CleanOptional(request.ImageSourceReference); product.ImageSearchedAtUtc = request.ImageSearchedAtUtc; product.ImageMatchingNotes = CleanOptional(request.ImageMatchingNotes); product.ImageMediaAssetId = request.ImageMediaAssetId ?? ManagedMediaId(imageUrls[0]); product.DemandScore = Math.Clamp(request.DemandScore, 0, 100); product.DemandBasis = request.DemandBasis.Trim().ToUpperInvariant(); product.DemandSourceUrl = CleanOptional(request.DemandSourceUrl); product.DemandSourceReference = CleanOptional(request.DemandSourceReference); product.DisplayOrder = Math.Max(0, request.DisplayOrder); product.MissingImageStatus = IsPlaceholderImage(imageUrls[0]) ? "MISSING" : "NOT_MISSING"; product.UpdatedAt = DateTime.UtcNow;
        // Replace child images explicitly. Reusing the tracked navigation collection
        // after RemoveRange can make EF Core issue an UPDATE for an image that was
        // already deleted, resulting in DbUpdateConcurrencyException on every save.
        var existingImages = product.Images.ToList();
        db.ProductImages.RemoveRange(existingImages);
        db.ProductImages.AddRange(imageUrls.Select((url, index) => new ProductImage
        {
            ProductId = product.Id,
            Url = url,
            DisplayOrder = index,
            AltText = product.Name, SourceUrl = product.ImageSourceUrl, SourceWebsite = product.ImageSourceWebsite, SourcePageUrl = product.ImageSourcePageUrl, VerificationStatus = product.ImageVerificationStatus, SearchedAtUtc = product.ImageSearchedAtUtc, MatchingNotes = product.ImageMatchingNotes, MissingImageStatus = product.MissingImageStatus, MediaAssetId = index == 0 ? product.ImageMediaAssetId : ManagedMediaId(url),
        }));
        db.ActivityLogs.Add(Activity("PRODUCT_UPDATED", "Product", id.ToString(), previous, JsonSerializer.Serialize(new { product.Name, product.SellingPrice, product.IsActive }))); await db.SaveChangesAsync(ct); return Ok(await ProductRow(id, ct));
    }

    [HttpPut("products/{id:guid}/image")]
    public async Task<ActionResult<AdminProductRow>> UpdateProductImage(Guid id, UpdateProductImageRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid();
        var product = await db.Products.Include(x => x.Images).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (product is null) return NotFound();
        var imageUrls = (request.ImageUrls is { Count: > 0 } ? request.ImageUrls : new[] { request.ImageUrl })
            .Where(url => !string.IsNullOrWhiteSpace(url)).Select(url => url.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (imageUrls.Length is < 1 or > 5 || imageUrls.Any(url => !url.StartsWith("/api/site/media/", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { message = "Product images must come from the managed media library." });
        var status = string.IsNullOrWhiteSpace(request.ImageVerificationStatus) ? "UNVERIFIED" : request.ImageVerificationStatus.Trim().ToUpperInvariant();
        if (status == "VERIFIED_OFFICIAL" && !(Uri.TryCreate(request.ImageSourceUrl, UriKind.Absolute, out var source) && IsHttpUri(source)))
            return BadRequest(new { message = "A verified official image requires an absolute HTTP or HTTPS source URL." });
        var previous = JsonSerializer.Serialize(new { product.ImageUrl, product.ImageSourceUrl, product.ImageVerificationStatus });
        product.ImageUrl = imageUrls[0];
        product.ImageSourceUrl = CleanOptional(request.ImageSourceUrl);
        product.ImageVerificationStatus = status;
        product.ImageSourceReference = CleanOptional(request.ImageSourceReference);
        product.ImageSourceWebsite = CleanOptional(request.ImageSourceWebsite) ?? WebsiteFromUrl(request.ImageSourcePageUrl ?? request.ImageSourceUrl);
        product.ImageSourcePageUrl = CleanOptional(request.ImageSourcePageUrl);
        product.ImageSearchedAtUtc = request.ImageSearchedAtUtc ?? DateTime.UtcNow;
        product.ImageMatchingNotes = CleanOptional(request.ImageMatchingNotes);
        product.ImageMediaAssetId = request.ImageMediaAssetId ?? ManagedMediaId(imageUrls[0]);
        product.MissingImageStatus = "NOT_MISSING";
        product.UpdatedAt = DateTime.UtcNow;
        db.ProductImages.RemoveRange(product.Images.ToList());
        db.ProductImages.AddRange(imageUrls.Select((url, index) => new ProductImage { ProductId = product.Id, Url = url, DisplayOrder = index, AltText = product.Name, SourceUrl = product.ImageSourceUrl, SourceWebsite = product.ImageSourceWebsite, SourcePageUrl = product.ImageSourcePageUrl, VerificationStatus = product.ImageVerificationStatus, SearchedAtUtc = product.ImageSearchedAtUtc, MatchingNotes = product.ImageMatchingNotes, MissingImageStatus = "NOT_MISSING", MediaAssetId = index == 0 ? product.ImageMediaAssetId : ManagedMediaId(url) }));
        db.ActivityLogs.Add(Activity("PRODUCT_IMAGE_UPDATED", "Product", product.Id.ToString(), previous, JsonSerializer.Serialize(new { product.ImageUrl, product.ImageSourceUrl, product.ImageVerificationStatus })));
        await db.SaveChangesAsync(ct);
        return Ok(await ProductRow(id, ct));
    }

    [HttpGet("products/import/template")]
    public IActionResult ProductImportTemplate()
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid();
        const string header = "product_name,generic_name,category,manufacturer,unit,batch_number,expiry_date,purchase_price,sale_price,discount_percent,bonus_scheme,reorder_level,barcode,branch_name,is_trending,description,image_filename_1,image_filename_2,image_filename_3,image_filename_4,image_filename_5";
        return File(Encoding.UTF8.GetBytes(header + Environment.NewLine), "text/csv; charset=utf-8", "all-nepal-healthy-home-product-template.csv");
    }

    [HttpPost("products/import/preview")]
    [RequestSizeLimit(120 * 1024 * 1024)]
    public async Task<ActionResult<ProductImportPreviewResponse>> PreviewProductImport([FromForm] IFormFile? csv, [FromForm] List<IFormFile>? images, [FromForm] IFormFile? imagesZip, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid();
        if (csv is null || !string.Equals(Path.GetExtension(csv.FileName), ".csv", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Choose a CSV file." });
        var imageNames = await ReadImportImageNames(images ?? [], imagesZip, ct);
        var candidates = await ParseProductImport(csv, imageNames, ct);
        var response = candidates.Select(ToImportPreviewRow).ToList();
        return Ok(new ProductImportPreviewResponse(response, response.Count(x => x.IsValid), response.Count(x => !x.IsValid)));
    }

    [HttpPost("products/import/commit")]
    [RequestSizeLimit(120 * 1024 * 1024)]
    public async Task<ActionResult<ProductImportResult>> CommitProductImport([FromForm] IFormFile? csv, [FromForm] List<IFormFile>? images, [FromForm] IFormFile? imagesZip, [FromForm] bool replaceExisting, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid();
        if (csv is null || !string.Equals(Path.GetExtension(csv.FileName), ".csv", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Choose a CSV file." });
        var imageNames = await ReadImportImageNames(images ?? [], imagesZip, ct);
        var candidates = await ParseProductImport(csv, imageNames, ct);
        var errors = candidates.Where(x => !x.IsValid).SelectMany(x => x.Errors.Select(error => $"Row {x.RowNumber}: {error}")).ToList();
        var valid = candidates.Where(x => x.IsValid).ToList();
        if (valid.Count == 0) return Ok(new ProductImportResult(0, 0, candidates.Count, errors));
        var imageBytes = await ReadImportImageBytes(images ?? [], imagesZip, ct);
        var storedNames = new List<string>(); var imageUrls = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); var importedProductIds = new HashSet<Guid>(); var added = 0; var updated = 0;
        try
        {
            // Pomelo's retrying execution strategy cannot run a user-initiated
            // transaction directly. Execute the whole import unit through the
            // strategy so the transaction remains atomic and retry-safe.
            await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                await using var transaction = await db.Database.BeginTransactionAsync(ct);
                try
                {
                    foreach (var candidate in valid)
                    {
                        var branch = await db.Branches.SingleAsync(x => x.Id == candidate.BranchId, ct);
                        var product = await FindImportProduct(candidate, branch.Id, ct);
                        var category = await db.Categories.SingleOrDefaultAsync(x => x.Name == candidate.Category, ct);
                        if (category is null) { category = new Category { Name = candidate.Category, Slug = ImportSlug(candidate.Category), IsActive = true }; db.Categories.Add(category); }
                        Manufacturer? manufacturer = null;
                        if (!string.IsNullOrWhiteSpace(candidate.Manufacturer)) { manufacturer = await db.Manufacturers.SingleOrDefaultAsync(x => x.Name == candidate.Manufacturer, ct); if (manufacturer is null) { manufacturer = new Manufacturer { Name = candidate.Manufacturer }; db.Manufacturers.Add(manufacturer); } }
                        var medicine = product?.Medicine;
                        if (medicine is null) { medicine = new Medicine { Name = candidate.ProductName, GenericName = candidate.GenericName, Description = candidate.Description, Category = category, Manufacturer = manufacturer, IsActive = true }; db.Medicines.Add(medicine); }
                        else { medicine.Name = candidate.ProductName; medicine.GenericName = candidate.GenericName; medicine.Description = candidate.Description; medicine.CategoryId = category.Id; medicine.ManufacturerId = manufacturer?.Id; medicine.IsActive = true; }
                        var brandName = string.IsNullOrWhiteSpace(candidate.Manufacturer) ? "Imported Catalog" : candidate.Manufacturer.Trim();
                        var brand = await db.Brands.SingleOrDefaultAsync(x => x.Name == brandName, ct);
                        if (brand is null) { brand = new Brand { Name = brandName, Slug = await UniqueImportBrandSlug(ImportSlug(brandName), ct), IsActive = true }; db.Brands.Add(brand); }
                        else { brand.IsActive = true; brand.UpdatedAt = DateTime.UtcNow; }
                        var urls = new List<string>();
                        foreach (var filename in candidate.ImageFilenames)
                        {
                            if (!imageUrls.TryGetValue(filename, out var url))
                            {
                                var payload = imageBytes[filename]; await using var stream = new MemoryStream(payload.Bytes); var formFile = new FormFile(stream, 0, stream.Length, "file", Path.GetFileName(filename)) { Headers = new HeaderDictionary(), ContentType = payload.ContentType }; var stored = await media.SaveAsync(formFile, ct); storedNames.Add(stored.StoredFileName); var asset = new MediaAsset { OriginalFileName = stored.OriginalFileName, StoredFileName = stored.StoredFileName, ContentType = stored.ContentType, Length = stored.Length, Sha256 = stored.Sha256, Kind = "PRODUCT", AltText = candidate.ProductName, IsPublic = true }; db.MediaAssets.Add(asset); await db.SaveChangesAsync(ct); url = $"/api/site/media/{asset.Id}"; imageUrls[filename] = url;
                            }
                            urls.Add(url);
                        }
                        var sku = string.IsNullOrWhiteSpace(candidate.Barcode) ? ImportSlug(candidate.ProductName).Replace("-", "").ToUpperInvariant() : candidate.Barcode;
                        if (string.IsNullOrWhiteSpace(sku)) sku = $"IMPORT{candidate.RowNumber}";
                        if (product is null) { product = new Product { Name = candidate.ProductName, Slug = await UniqueImportSlug(ImportSlug(candidate.ProductName), sku, ct), Sku = await UniqueImportSku(sku, ct), Medicine = medicine, Brand = brand, Mrp = candidate.SalePrice, SellingPrice = candidate.SalePrice, ImageUrl = urls[0], IsActive = true, DiscountPercent = candidate.DiscountPercent, BonusScheme = candidate.BonusScheme, IsTrending = candidate.IsTrending }; db.Products.Add(product); added++; }
                        else { product.Name = candidate.ProductName; product.Mrp = Math.Max(product.Mrp, candidate.SalePrice); product.SellingPrice = candidate.SalePrice; product.BrandId = brand.Id; product.Barcode = candidate.Barcode; product.PackSize = candidate.Unit; product.DiscountPercent = candidate.DiscountPercent; product.BonusScheme = candidate.BonusScheme; product.IsTrending = candidate.IsTrending; product.IsActive = true; product.UpdatedAt = DateTime.UtcNow; var existingImages = product.Images.ToList(); db.ProductImages.RemoveRange(existingImages); db.ProductImages.AddRange(urls.Select((url, index) => new ProductImage { ProductId = product.Id, Url = url, DisplayOrder = index, AltText = candidate.ProductName })); updated++; }
                        importedProductIds.Add(product.Id); product.ImageUrl = urls[0]; product.PackSize = candidate.Unit; product.Barcode ??= candidate.Barcode; if (product.Images.Count == 0) AddProductImages(product, urls);
                        var batch = string.IsNullOrWhiteSpace(candidate.BatchNumber) ? $"IMPORT-{product.Sku}" : candidate.BatchNumber;
                        var inventory = await db.Inventory.SingleOrDefaultAsync(x => x.ProductId == product.Id && x.BranchId == branch.Id && x.BatchNumber == batch, ct);
                        if (inventory is null) db.Inventory.Add(new Inventory { Product = product, Branch = branch, BatchNumber = batch, PurchasePrice = candidate.PurchasePrice ?? 0, ExpiryDate = candidate.ExpiryDate, MinimumStock = candidate.ReorderLevel ?? 5 });
                        else { inventory.PurchasePrice = candidate.PurchasePrice ?? inventory.PurchasePrice; inventory.ExpiryDate = candidate.ExpiryDate; inventory.MinimumStock = candidate.ReorderLevel ?? inventory.MinimumStock; inventory.UpdatedAt = DateTime.UtcNow; }
                    }
                    if (replaceExisting) { var staleProducts = await db.Products.Where(x => x.IsActive && !importedProductIds.Contains(x.Id)).ToListAsync(ct); foreach (var stale in staleProducts) { stale.IsActive = false; stale.IsTrending = false; stale.UpdatedAt = DateTime.UtcNow; } }
                    await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
                }
                catch
                {
                    await transaction.RollbackAsync(CancellationToken.None);
                    throw;
                }
            });
        }
        catch (Exception exception)
        {
            foreach (var storedName in storedNames) await media.DeleteAsync(storedName, CancellationToken.None); return BadRequest(new { message = $"The import was not saved: {exception.Message}" });
        }
        return Ok(new ProductImportResult(added, updated, errors.Count, errors));
    }

    [HttpPost("products/import/catalog/preview")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<ActionResult<CatalogWorkbookPreviewResponse>> PreviewCatalogWorkbook([FromForm] IFormFile? workbook, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid();
        if (workbook is null || !string.Equals(Path.GetExtension(workbook.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Choose the ALL PRODUCRS .xlsx workbook." });
        var rows = await ParseCatalogWorkbook(workbook, ct);
        return Ok(ToCatalogPreview(rows));
    }

    [HttpPost("products/import/catalog/commit")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<ActionResult<CatalogWorkbookImportResult>> CommitCatalogWorkbook([FromForm] IFormFile? workbook, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid();
        if (workbook is null || !string.Equals(Path.GetExtension(workbook.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Choose the ALL PRODUCRS .xlsx workbook." });
        var rows = await ParseCatalogWorkbook(workbook, ct);
        var invalid = rows.Where(x => !x.IsValid).ToList();
        var valid = rows.Where(x => x.IsValid && !x.IsDuplicate).ToList();
        if (valid.Count == 0) return Ok(new CatalogWorkbookImportResult(0, 0, rows.Count(x => x.IsDuplicate), invalid.Count, rows.Count(x => x.IsValid && x.ImageStatus == "MISSING"), 0, rows.Count(x => x.IsValid && x.DemandBasis == "MARKET_RESEARCH_PROXY"), invalid.SelectMany(x => x.Errors.Select(error => $"Row {x.RowNumber}: {error}")).ToList()));

        var placeholder = "/catalog-placeholder.svg";
        var products = await db.Products.Include(x => x.Medicine).Include(x => x.Images).ToListAsync(ct);
        var brands = await db.Brands.ToListAsync(ct);
        var categories = await db.Categories.ToListAsync(ct);
        var orders = await db.OrderItems.AsNoTracking().Include(x => x.Order).Where(x => x.Order!.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed).ToListAsync(ct);
        var salesByName = orders.GroupBy(x => NormalizeCatalogKey(x.ProductName)).ToDictionary(x => x.Key, x => (Quantity: x.Sum(item => item.Quantity), Orders: x.Select(item => item.OrderId).Distinct().Count()), StringComparer.OrdinalIgnoreCase);
        var productKeys = products.Where(x => !string.IsNullOrWhiteSpace(x.CompanyCode) && !string.IsNullOrWhiteSpace(x.CompanyName)).ToDictionary(x => CatalogIdentity(x.CompanyCode!, x.CompanyName!, x.Name), x => x, StringComparer.OrdinalIgnoreCase);
        var brandByName = brands.ToDictionary(x => NormalizeCatalogKey(x.Name), x => x, StringComparer.OrdinalIgnoreCase);
        var categoryByName = categories.ToDictionary(x => NormalizeCatalogKey(x.Name), x => x, StringComparer.OrdinalIgnoreCase);
        var added = 0; var updated = 0; var missingImageRows = 0; var salesHistoryRows = 0; var researchRows = 0; var errors = invalid.SelectMany(x => x.Errors.Select(error => $"Row {x.RowNumber}: {error}")).ToList();
        foreach (var row in valid)
        {
            try
            {
                var categoryName = CatalogCategory(row.ProductName);
                if (!categoryByName.TryGetValue(NormalizeCatalogKey(categoryName), out var category))
                {
                    category = new Category { Name = categoryName, Slug = ImportSlug(categoryName), IsActive = true }; db.Categories.Add(category); categoryByName[NormalizeCatalogKey(categoryName)] = category;
                }
                if (!brandByName.TryGetValue(NormalizeCatalogKey(row.CompanyName), out var brand))
                {
                    var brandSlug = await UniqueImportBrandSlug(ImportSlug(row.CompanyName), ct);
                    brand = new Brand { Name = row.CompanyName, Slug = brandSlug, IsActive = true }; db.Brands.Add(brand); brandByName[NormalizeCatalogKey(row.CompanyName)] = brand;
                }
                var identity = CatalogIdentity(row.CompanyCode, row.CompanyName, row.ProductName);
                var sales = salesByName.GetValueOrDefault(NormalizeCatalogKey(row.ProductName));
                var demand = DemandForCatalogRow(row.ProductName, sales.Quantity > 0);
                var demandBasis = sales.Quantity > 0 ? "SALES_HISTORY" : demand.Score > 0 ? "MARKET_RESEARCH_PROXY" : "NO_SALES_OR_RESEARCH_MATCH";
                var demandScore = sales.Quantity > 0 ? Math.Min(100m, 60m + Math.Min(40m, sales.Quantity * 10m + sales.Orders * 5m)) : demand.Score;
                missingImageRows++;
                if (sales.Quantity > 0) salesHistoryRows++; else if (demand.Score > 0) researchRows++;
                var medicine = productKeys.TryGetValue(identity, out var existing) ? existing.Medicine : null;
                if (medicine is null)
                {
                    medicine = new Medicine { Name = row.ProductName, GenericName = row.ProductName, Category = category, IsActive = true }; db.Medicines.Add(medicine);
                }
                else { medicine.Name = row.ProductName; medicine.GenericName ??= row.ProductName; medicine.CategoryId = category.Id; medicine.IsActive = true; }
                if (existing is null)
                {
                    var skuBase = $"IMP-{row.CompanyCode}-{row.RowNumber}-{ImportSlug(row.ProductName)}".ToUpperInvariant(); var sku = await UniqueImportSku(skuBase[..Math.Min(78, skuBase.Length)], ct); var slugBase = $"{ImportSlug(row.ProductName)}-{ImportSlug(row.CompanyName)}-{row.CompanyCode}-{row.RowNumber}"; var slug = await UniqueImportSlug(slugBase[..Math.Min(238, slugBase.Length)], sku, ct);
                    existing = new Product { Name = row.ProductName, Slug = slug, Sku = sku, Medicine = medicine, Brand = brand, Mrp = 0, SellingPrice = 0, ImageUrl = placeholder, CompanyCode = row.CompanyCode, CompanyName = row.CompanyName, ImageVerificationStatus = "MISSING", ImageSourceReference = "No official/manufacturer image was verified during import", DemandScore = demandScore, DemandBasis = demandBasis, DemandSourceUrl = demand.SourceUrl, DemandSourceReference = demand.Reference, DemandMeasuredAt = DateTime.UtcNow, DisplayOrder = 0, ImportStatus = "IMPORTED_WORKBOOK", MissingImageStatus = "MISSING", IsActive = true, SearchKeywords = row.ProductName };
                    existing.Images.Add(new ProductImage { ProductId = existing.Id, Url = placeholder, DisplayOrder = 0, AltText = row.ProductName }); db.Products.Add(existing); products.Add(existing); productKeys[identity] = existing; added++;
                }
                else
                {
                    existing.Name = row.ProductName; existing.CompanyCode = row.CompanyCode; existing.CompanyName = row.CompanyName; existing.BrandId = brand.Id; existing.Medicine = medicine; existing.ImageUrl ??= placeholder; existing.ImageVerificationStatus = string.IsNullOrWhiteSpace(existing.ImageSourceUrl) ? "MISSING" : existing.ImageVerificationStatus; existing.MissingImageStatus = existing.ImageVerificationStatus == "VERIFIED_OFFICIAL" ? "NOT_MISSING" : "MISSING"; existing.DemandScore = demandScore; existing.DemandBasis = demandBasis; existing.DemandSourceUrl = demand.SourceUrl; existing.DemandSourceReference = demand.Reference; existing.DemandMeasuredAt = DateTime.UtcNow; existing.ImportStatus = "UPDATED_WORKBOOK"; existing.UpdatedAt = DateTime.UtcNow; updated++;
                    if (existing.Images.Count == 0) existing.Images.Add(new ProductImage { ProductId = existing.Id, Url = placeholder, DisplayOrder = 0, AltText = row.ProductName });
                }
            }
            catch (Exception exception) { errors.Add($"Row {row.RowNumber}: {exception.Message}"); }
        }
        await db.SaveChangesAsync(ct);
        return Ok(new CatalogWorkbookImportResult(added, updated, rows.Count(x => x.IsDuplicate), invalid.Count, missingImageRows, salesHistoryRows, researchRows, errors));
    }

    [HttpPost("products/import")]
    [RequestSizeLimit(120 * 1024 * 1024)]
    public async Task<IActionResult> ImportProducts([FromForm] IFormFile? spreadsheet, [FromForm] IFormFile? imagesZip, [FromForm] bool replaceExisting, CancellationToken ct)
    {
        if (!Can(AppPermissions.CatalogManage)) return Forbid();
        if (spreadsheet is null || spreadsheet.Length == 0) return BadRequest(new { message = "Choose a CSV or XLSX product spreadsheet." });
        if (imagesZip is null || imagesZip.Length == 0) return BadRequest(new { message = "Choose a ZIP containing the product images." });
        var rows = await ReadProductSpreadsheet(spreadsheet, ct);
        if (rows.Count < 2) return BadRequest(new { message = "The spreadsheet must contain a header row and at least one product." });
        using var archiveStream = imagesZip.OpenReadStream();
        using var archive = new ZipArchive(archiveStream, ZipArchiveMode.Read, leaveOpen: false);
        var imageEntries = archive.Entries.Where(x => !string.IsNullOrWhiteSpace(x.Name)).ToList();
        if (imageEntries.Count == 0) return BadRequest(new { message = "The image ZIP is empty." });
        var headers = rows[0].Select(NormalizeImportHeader).ToList();
        string Cell(IReadOnlyList<string> row, params string[] names)
        {
            foreach (var name in names)
            {
                var index = headers.IndexOf(NormalizeImportHeader(name));
                if (index >= 0 && index < row.Count) return row[index].Trim();
            }
            return "";
        }
        static string Slug(string value) => Regex.Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        static string Key(string value) => Slug(Path.GetFileNameWithoutExtension(value));
        string? ContentType(string extension) => extension.ToLowerInvariant() switch { ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", ".gif" => "image/gif", ".bmp" => "image/bmp", ".avif" => "image/avif", _ => null };
        async Task<string> StoreImage(ZipArchiveEntry entry, string altText)
        {
            await using var source = entry.Open();
            await using var memory = new MemoryStream();
            await source.CopyToAsync(memory, ct);
            memory.Position = 0;
            var type = ContentType(Path.GetExtension(entry.Name));
            if (type is null) throw new InvalidDataException($"Unsupported image format for {entry.Name}.");
            var file = new FormFile(memory, 0, memory.Length, "file", Path.GetFileName(entry.Name)) { Headers = new HeaderDictionary(), ContentType = type };
            var stored = await media.SaveAsync(file, ct);
            var asset = new MediaAsset { OriginalFileName = stored.OriginalFileName, StoredFileName = stored.StoredFileName, ContentType = stored.ContentType, Length = stored.Length, Sha256 = stored.Sha256, Kind = "PRODUCT", AltText = altText, IsPublic = true };
            db.MediaAssets.Add(asset);
            await db.SaveChangesAsync(ct);
            return $"/api/site/media/{asset.Id}";
        }
        var importedSkus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var errors = new List<string>();
        var created = 0; var updated = 0;
        var importBrand = await db.Brands.FirstOrDefaultAsync(x => x.Name == "Imported Catalog", ct);
        if (importBrand is null) { importBrand = new Brand { Name = "Imported Catalog", Slug = "imported-catalog", IsActive = true }; db.Brands.Add(importBrand); }
        foreach (var row in rows.Skip(1))
        {
            var name = Cell(row, "name", "product name", "title");
            if (string.IsNullOrWhiteSpace(name)) continue;
            var sku = Cell(row, "sku", "code");
            if (string.IsNullOrWhiteSpace(sku)) sku = Slug(name).Replace("-", "").ToUpperInvariant()[..Math.Min(24, Slug(name).Replace("-", "").Length)];
            var slug = Slug(Cell(row, "slug")); if (string.IsNullOrWhiteSpace(slug)) slug = Slug(name);
            var priceText = Cell(row, "selling price", "price", "mrp").Replace(",", "");
            if (!decimal.TryParse(priceText, NumberStyles.Number, CultureInfo.InvariantCulture, out var price) || price < 0) { errors.Add($"{name}: price is invalid."); continue; }
            var categoryName = Cell(row, "category") switch { { Length: > 0 } value => value, _ => "Imported" };
            var category = await db.Categories.FirstOrDefaultAsync(x => x.Name == categoryName, ct);
            if (category is null) { category = new Category { Name = categoryName, Slug = Slug(categoryName), IsActive = true }; db.Categories.Add(category); }
            var medicine = await db.Medicines.FirstOrDefaultAsync(x => x.Name == name, ct);
            if (medicine is null) { medicine = new Medicine { Name = name, Description = Cell(row, "description"), Category = category, IsActive = true }; db.Medicines.Add(medicine); }
            else { medicine.Description = Cell(row, "description"); medicine.CategoryId = category.Id; medicine.IsActive = true; }
            var candidates = imageEntries.Where(entry => { var k = Key(entry.Name); return k == Key(sku) || k == Key(slug) || k == Key(name) || k.StartsWith(Key(sku) + "-") || k.StartsWith(Key(slug) + "-") || k.StartsWith(Key(name) + "-"); }).Take(5).ToList();
            var explicitImage = Cell(row, "image", "image file", "filename", "photo");
            if (!string.IsNullOrWhiteSpace(explicitImage)) candidates = imageEntries.Where(entry => string.Equals(Key(entry.Name), Key(explicitImage), StringComparison.OrdinalIgnoreCase)).Take(5).ToList();
            if (candidates.Count == 0) { errors.Add($"{name}: no matching image found in the ZIP (name the file after the SKU, slug, or product name)."); continue; }
            var urls = new List<string>(); foreach (var entry in candidates) urls.Add(await StoreImage(entry, name));
            var product = await db.Products.Include(x => x.Images).SingleOrDefaultAsync(x => x.Sku == sku, ct);
            if (product is null) { product = new Product { Name = name, Slug = slug, Sku = sku, Medicine = medicine, Brand = importBrand, Mrp = price, SellingPrice = price, ImageUrl = urls[0], IsActive = true, IsTrending = false }; db.Products.Add(product); created++; }
            else { product.Name = name; product.Slug = slug; product.Mrp = price; product.SellingPrice = price; product.ImageUrl = urls[0]; product.IsActive = true; product.MedicineId = medicine.Id; product.BrandId = importBrand.Id; product.UpdatedAt = DateTime.UtcNow; db.ProductImages.RemoveRange(product.Images); product.Images.Clear(); updated++; }
            AddProductImages(product, urls); importedSkus.Add(sku);
        }
        if (replaceExisting)
        {
            var stale = await db.Products.Where(x => !importedSkus.Contains(x.Sku) && x.IsActive).ToListAsync(ct);
            foreach (var product in stale) { product.IsActive = false; product.IsTrending = false; product.UpdatedAt = DateTime.UtcNow; }
        }
        await db.SaveChangesAsync(ct);
        return Ok(new { created, updated, deactivated = replaceExisting, errors });
    }

    [HttpPost("products/bulk-status")]
    public async Task<ActionResult<BulkOperationResponse>> BulkProductStatus(BulkProductStatusRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var ids = request.ProductIds?.Distinct().ToList() ?? [];
        if (ids.Count == 0) return BadRequest(new { message = "Select at least one product." });
        if (ids.Count > 100) return BadRequest(new { message = "You can update at most 100 products at a time." });
        var products = await db.Products.Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        var found = products.Select(x => x.Id).ToHashSet();
        var changed = 0;
        foreach (var product in products)
        {
            if (product.IsActive == request.IsActive) continue;
            var previous = product.IsActive.ToString(); product.IsActive = request.IsActive; product.UpdatedAt = DateTime.UtcNow;
            db.ActivityLogs.Add(Activity(request.IsActive ? "PRODUCT_BULK_ACTIVATED" : "PRODUCT_BULK_DEACTIVATED", "Product", product.Id.ToString(), previous, request.IsActive.ToString()));
            changed++;
        }
        await db.SaveChangesAsync(ct);
        return Ok(new BulkOperationResponse(ids.Count, changed, ids.Where(id => !found.Contains(id)).ToList()));
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<Category>>> Categories([FromQuery] bool activeOnly = false, CancellationToken ct = default) => !Can(AppPermissions.CatalogView) ? Forbid() : Ok(await db.Categories.AsNoTracking().Where(x => !activeOnly || x.IsActive).OrderBy(x => x.Name).ToListAsync(ct));
    [HttpPost("categories")]
    public async Task<ActionResult<Category>> CreateCategory(UpsertCategoryRequest r, CancellationToken ct) => await SaveCategory(null, r, ct);
    [HttpPut("categories/{id:guid}")]
    public async Task<ActionResult<Category>> UpdateCategory(Guid id, UpsertCategoryRequest r, CancellationToken ct) => await SaveCategory(id, r, ct);
    [HttpDelete("categories/{id:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken ct) => await ToggleEntity(db.Categories, id, "CATEGORY_DEACTIVATED", "Category", ct);

    [HttpGet("brands")]
    public async Task<ActionResult<IReadOnlyList<Brand>>> Brands([FromQuery] bool activeOnly = false, CancellationToken ct = default) => !Can(AppPermissions.CatalogView) ? Forbid() : Ok(await db.Brands.AsNoTracking().Where(x => !activeOnly || x.IsActive).OrderBy(x => x.Name).ToListAsync(ct));
    [HttpPost("brands")]
    public async Task<ActionResult<Brand>> CreateBrand(UpsertBrandRequest r, CancellationToken ct) => await SaveBrand(null, r, ct);
    [HttpPut("brands/{id:guid}")]
    public async Task<ActionResult<Brand>> UpdateBrand(Guid id, UpsertBrandRequest r, CancellationToken ct) => await SaveBrand(id, r, ct);

    [HttpGet("manufacturers")]
    public async Task<ActionResult<IReadOnlyList<Manufacturer>>> Manufacturers([FromQuery] bool activeOnly = false, CancellationToken ct = default) => !Can(AppPermissions.CatalogView) ? Forbid() : Ok(await db.Manufacturers.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct));
    [HttpPost("manufacturers")]
    public async Task<ActionResult<Manufacturer>> CreateManufacturer(UpsertManufacturerRequest r, CancellationToken ct) { if (!Can(AppPermissions.CatalogManage)) return Forbid(); var e = new Manufacturer { Name = r.Name.Trim(), Country = r.Country }; db.Manufacturers.Add(e); db.ActivityLogs.Add(Activity("MANUFACTURER_CREATED", "Manufacturer", e.Id.ToString(), null, e.Name)); await db.SaveChangesAsync(ct); return Ok(e); }
    [HttpPut("manufacturers/{id:guid}")]
    public async Task<ActionResult<Manufacturer>> UpdateManufacturer(Guid id, UpsertManufacturerRequest r, CancellationToken ct) { if (!Can(AppPermissions.CatalogManage)) return Forbid(); var e = await db.Manufacturers.FindAsync([id], ct); if (e is null) return NotFound(); e.Name = r.Name.Trim(); e.Country = r.Country; e.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("MANUFACTURER_UPDATED", "Manufacturer", id.ToString(), null, e.Name)); await db.SaveChangesAsync(ct); return Ok(e); }

    [HttpGet("medicines")]
    public async Task<ActionResult<IReadOnlyList<Medicine>>> Medicines([FromQuery] bool activeOnly = false, CancellationToken ct = default) => !Can(AppPermissions.CatalogView) ? Forbid() : Ok(await db.Medicines.AsNoTracking().Where(x => !activeOnly || x.IsActive).OrderBy(x => x.Name).ToListAsync(ct));
    [HttpPost("medicines")]
    public async Task<ActionResult<Medicine>> CreateMedicine(UpsertMedicineRequest r, CancellationToken ct) { if (!Can(AppPermissions.CatalogManage)) return Forbid(); var e = new Medicine { Name = r.Name.Trim(), GenericName = r.GenericName, Strength = r.Strength, DosageForm = r.DosageForm, Description = r.Description, Uses = r.Uses, Warnings = r.Warnings, SideEffects = r.SideEffects, StorageInformation = r.StorageInformation, PrescriptionRequired = r.PrescriptionRequired, IsActive = r.IsActive, CategoryId = r.CategoryId, ManufacturerId = r.ManufacturerId }; db.Medicines.Add(e); db.ActivityLogs.Add(Activity("MEDICINE_CREATED", "Medicine", e.Id.ToString(), null, e.Name)); await db.SaveChangesAsync(ct); return Ok(e); }
    [HttpPut("medicines/{id:guid}")]
    public async Task<ActionResult<Medicine>> UpdateMedicine(Guid id, UpsertMedicineRequest r, CancellationToken ct) { if (!Can(AppPermissions.CatalogManage)) return Forbid(); var e = await db.Medicines.FindAsync([id], ct); if (e is null) return NotFound(); e.Name = r.Name.Trim(); e.GenericName = r.GenericName; e.Strength = r.Strength; e.DosageForm = r.DosageForm; e.Description = r.Description; e.Uses = r.Uses; e.Warnings = r.Warnings; e.SideEffects = r.SideEffects; e.StorageInformation = r.StorageInformation; e.PrescriptionRequired = r.PrescriptionRequired; e.IsActive = r.IsActive; e.CategoryId = r.CategoryId; e.ManufacturerId = r.ManufacturerId; e.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return Ok(e); }

    [HttpGet("inventory")]
    public async Task<ActionResult<PagedResponse<AdminInventoryRow>>> Inventory([FromQuery] string? filter, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.InventoryView)) return Forbid(); var query = ScopeInventory(db.Inventory.AsNoTracking()).Include(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Branch).AsQueryable(); var today = ApplicationTime.NepalNow.Date;
        query = filter?.ToLowerInvariant() switch { "low-stock" => query.Where(x => x.StockQuantity - x.ReservedQuantity > 0 && x.StockQuantity - x.ReservedQuantity <= x.MinimumStock), "out-of-stock" => query.Where(x => x.StockQuantity - x.ReservedQuantity <= 0), "expired" => query.Where(x => x.ExpiryDate < today), "expiry" => query.Where(x => x.ExpiryDate >= today && x.ExpiryDate <= today.AddDays(90)), _ => query };
        var total = await query.CountAsync(ct); var rows = await query.OrderBy(x => x.ExpiryDate).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct); return Ok(new PagedResponse<AdminInventoryRow>(rows.Select(x => InventoryRow(x)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpPost("inventory/{id:guid}/adjust")]
    public async Task<ActionResult<AdminInventoryRow>> AdjustInventory(Guid id, StockAdjustmentRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.InventoryAdjust)) return Forbid();
        if (request.QuantityDelta == 0) return BadRequest(new { message = "A non-zero stock adjustment is required." });
        if (string.IsNullOrWhiteSpace(request.Note) || request.Note.Trim().Length > 500) return BadRequest(new { message = "A reason of 1 to 500 characters is required." });
        var type = string.IsNullOrWhiteSpace(request.Type) ? StockTransactionTypes.Adjustment : request.Type.Trim().ToUpperInvariant();
        var allowedTypes = new[] { StockTransactionTypes.Adjustment, StockTransactionTypes.Purchase, StockTransactionTypes.Expired, StockTransactionTypes.Damage, StockTransactionTypes.Return };
        if (!allowedTypes.Contains(type, StringComparer.Ordinal)) return BadRequest(new { message = "Choose a valid stock transaction type." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult<AdminInventoryRow>>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var inventory = await db.Inventory.Include(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Branch)
                .SingleOrDefaultAsync(x => x.Id == id && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct);
            if (inventory is null) return NotFound();
            var afterLong = (long)inventory.StockQuantity + request.QuantityDelta;
            if (afterLong < inventory.ReservedQuantity) return Conflict(new { message = "Stock cannot be lower than reserved quantity." });
            if (afterLong < 0 || afterLong > int.MaxValue) return BadRequest(new { message = "The resulting stock quantity is outside the supported range." });
            var before = inventory.StockQuantity;
            inventory.StockQuantity = (int)afterLong;
            inventory.UpdatedAt = ApplicationTime.NepalNow;
            db.StockTransactions.Add(new StockTransaction { InventoryId = id, BranchId = inventory.BranchId, Type = type, Quantity = request.QuantityDelta, QuantityBefore = before, QuantityAfter = inventory.StockQuantity, Unit = inventory.Product?.BaseUnit ?? "base", ReferenceType = "INVENTORY_ADJUSTMENT", ReferenceId = id.ToString(), Reason = request.Note.Trim(), Note = request.Note.Trim(), ActorId = ActorId });
            db.ActivityLogs.Add(Activity("STOCK_ADJUSTED", "Inventory", id.ToString(), before.ToString(), inventory.StockQuantity.ToString()));
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(InventoryRow(inventory));
        });
    }

    [HttpPost("inventory/{id:guid}/transfer")]
    public async Task<ActionResult<InventoryTransferResponse>> TransferInventory(Guid id, InventoryTransferRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.InventoryAdjust)) return Forbid();
        if (IsBranchScoped) return Forbid();
        if (request.Quantity <= 0) return BadRequest(new { message = "Transfer quantity must be greater than zero." });
        if (string.IsNullOrWhiteSpace(request.Note) || request.Note.Trim().Length > 500) return BadRequest(new { message = "A transfer reason of 1 to 500 characters is required." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult<InventoryTransferResponse>>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var source = await ScopeInventory(db.Inventory).Include(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Branch)
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            if (source is null) return NotFound();
            if (source.BranchId == request.TargetBranchId) return BadRequest(new { message = "Choose a different target branch." });
            var targetBranch = await db.Branches.SingleOrDefaultAsync(x => x.Id == request.TargetBranchId && x.IsActive, ct);
            if (targetBranch is null) return BadRequest(new { message = "The target branch is not active." });
            if (source.ExpiryDate?.Date < ApplicationTime.NepalNow.Date || source.BatchStatus is "EXPIRED" or "DEPLETED" or "QUARANTINED" or "RETURNED")
                return Conflict(new { message = "Expired, depleted, quarantined, or returned stock cannot be transferred." });
            var available = source.StockQuantity - source.ReservedQuantity;
            if (request.Quantity > available) return Conflict(new { message = $"Only {Math.Max(0, available)} units are available to transfer." });
            var target = await db.Inventory.Include(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Branch)
                .SingleOrDefaultAsync(x => x.ProductId == source.ProductId && x.BranchId == request.TargetBranchId && x.BatchNumber == source.BatchNumber, ct);
            if (target is not null && (target.BatchStatus is "QUARANTINED" or "RETURNED" || target.ExpiryDate?.Date < ApplicationTime.NepalNow.Date))
                return Conflict(new { message = "The matching destination batch is not eligible to receive stock." });
            var targetIsNew = target is null;
            target ??= new Inventory { ProductId = source.ProductId, BranchId = request.TargetBranchId, BatchNumber = source.BatchNumber, PurchasePrice = source.PurchasePrice, SellingPrice = source.SellingPrice, Mrp = source.Mrp, ExpiryDate = source.ExpiryDate, ManufacturingDate = source.ManufacturingDate, MinimumStock = source.MinimumStock, Supplier = source.Supplier, SupplierId = source.SupplierId, PurchaseOrderId = source.PurchaseOrderId, PurchaseReference = source.PurchaseReference, BatchStatus = source.BatchStatus, StockQuantity = 0, ReservedQuantity = 0, Product = source.Product, Branch = targetBranch };
            var targetBefore = target.StockQuantity;
            var targetAfterLong = (long)targetBefore + request.Quantity;
            if (targetAfterLong > int.MaxValue) return Conflict(new { message = "The destination batch would exceed the supported stock quantity." });
            var sourceBefore = source.StockQuantity;
            source.StockQuantity -= request.Quantity;
            source.UpdatedAt = ApplicationTime.NepalNow;
            target.StockQuantity = (int)targetAfterLong;
            target.UpdatedAt = ApplicationTime.NepalNow;
            if (targetIsNew) db.Inventory.Add(target);
            db.StockTransactions.Add(new StockTransaction { InventoryId = source.Id, BranchId = source.BranchId, Type = StockTransactionTypes.TransferOut, Quantity = -request.Quantity, QuantityBefore = sourceBefore, QuantityAfter = source.StockQuantity, Unit = source.Product?.BaseUnit ?? "base", ReferenceType = "INVENTORY_TRANSFER", ReferenceId = id.ToString(), Reason = request.Note.Trim(), Note = request.Note.Trim(), ActorId = ActorId });
            db.StockTransactions.Add(new StockTransaction { InventoryId = target.Id, BranchId = target.BranchId, Type = StockTransactionTypes.TransferIn, Quantity = request.Quantity, QuantityBefore = targetBefore, QuantityAfter = target.StockQuantity, Unit = target.Product?.BaseUnit ?? "base", ReferenceType = "INVENTORY_TRANSFER", ReferenceId = id.ToString(), Reason = request.Note.Trim(), Note = request.Note.Trim(), ActorId = ActorId });
            db.ActivityLogs.Add(Activity("STOCK_TRANSFERRED", "Inventory", source.Id.ToString(), $"{source.Branch?.Name}: {sourceBefore}", $"{targetBranch.Name}: {target.StockQuantity}"));
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(new InventoryTransferResponse(InventoryRow(source), InventoryRow(target)));
        });
    }

    [HttpGet("branches")]
    public async Task<ActionResult<IReadOnlyList<Branch>>> Branches([FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.BranchesManage)) return Forbid();
        var query = db.Branches.AsNoTracking().Where(x => !activeOnly || x.IsActive);
        if (IsBranchScoped) query = SupervisorBranchId.HasValue ? query.Where(x => x.Id == SupervisorBranchId.Value) : query.Where(_ => false);
        return Ok(await query.OrderBy(x => x.Name).ToListAsync(ct));
    }
    [HttpPost("branches")]
    public async Task<ActionResult<Branch>> CreateBranch(UpsertBranchRequest r, CancellationToken ct) => await SaveBranch(null, r, ct);
    [HttpPut("branches/{id:guid}")]
    public async Task<ActionResult<Branch>> UpdateBranch(Guid id, UpsertBranchRequest r, CancellationToken ct) => await SaveBranch(id, r, ct);

    [HttpGet("suppliers")]
    public async Task<ActionResult<IReadOnlyList<Supplier>>> Suppliers([FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.BranchesManage)) return Forbid();
        var query = db.Suppliers.AsNoTracking().Where(x => !activeOnly || x.IsActive);
        if (IsBranchScoped && SupervisorBranchId is Guid branchId)
            query = query.Where(x => db.PurchaseOrders.Any(order => order.SupplierId == x.Id && order.BranchId == branchId) || db.SupplierInvoices.Any(invoice => invoice.SupplierId == x.Id && (invoice.BranchId == branchId || invoice.BranchId == null && invoice.PurchaseOrder != null && invoice.PurchaseOrder.BranchId == branchId)) || db.SupplierPayments.Any(payment => payment.SupplierId == x.Id && payment.BranchId == branchId));
        else if (IsBranchScoped) query = query.Where(_ => false);
        return Ok(await query.OrderBy(x => x.Name).ToListAsync(ct));
    }
    [HttpPost("suppliers")]
    public async Task<ActionResult<Supplier>> CreateSupplier(UpsertSupplierRequest r, CancellationToken ct) => await SaveSupplier(null, r, ct);
    [HttpPut("suppliers/{id:guid}")]
    public async Task<ActionResult<Supplier>> UpdateSupplier(Guid id, UpsertSupplierRequest r, CancellationToken ct) => await SaveSupplier(id, r, ct);

    [HttpGet("purchase-orders")]
    public async Task<ActionResult<IReadOnlyList<AdminPurchaseOrderRow>>> PurchaseOrders([FromQuery] string? status, CancellationToken ct)
    {
        if (!Can(AppPermissions.PurchaseOrdersManage)) return Forbid();
        var query = db.PurchaseOrders.AsNoTracking().Include(x => x.Supplier).Include(x => x.Branch).Include(x => x.Items).AsQueryable();
        if (IsBranchScoped) query = SupervisorBranchId.HasValue ? query.Where(x => x.BranchId == SupervisorBranchId.Value) : query.Where(_ => false);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status.Trim().ToUpperInvariant());
        var rows = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(PurchaseOrderRow).ToList());
    }

    [HttpGet("purchase-orders/{id:guid}")]
    public async Task<ActionResult<AdminPurchaseOrderDetail>> PurchaseOrder(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.PurchaseOrdersManage)) return Forbid();
        var order = await db.PurchaseOrders.AsNoTracking().Include(x => x.Supplier).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).SingleOrDefaultAsync(x => x.Id == id && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct);
        return order is null ? NotFound() : Ok(PurchaseOrderDetailRow(order));
    }

    [HttpPost("purchase-orders")]
    public async Task<ActionResult<AdminPurchaseOrderDetail>> CreatePurchaseOrder(CreatePurchaseOrderRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.PurchaseOrdersManage)) return Forbid();
        if (IsBranchScoped && (!SupervisorBranchId.HasValue || request.BranchId != SupervisorBranchId.Value)) return Forbid();
        var validation = await ValidatePurchaseOrder(request, ct); if (validation is not null) return BadRequest(new { message = validation });
        var productIds = request.Items.Select(x => x.ProductId).ToList();
        var products = await db.Products.Include(x => x.Units).Where(x => productIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var order = new PurchaseOrder { OrderNumber = $"ANHH-PO-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", SupplierId = request.SupplierId, BranchId = request.BranchId, Status = PurchaseOrderStatuses.Draft, ExpectedAt = request.ExpectedAt.HasValue ? ApplicationTime.ToUtc(request.ExpectedAt.Value) : null, Notes = CleanOptional(request.Notes), TotalAmount = request.Items.Sum(x => x.Quantity * x.UnitCost) };
        foreach (var item in request.Items)
        {
            var product = products[item.ProductId];
            var unit = string.IsNullOrWhiteSpace(item.Unit) ? product.PurchaseUnit : item.Unit.Trim();
            var multiplier = PurchaseUnitMultiplier(product, unit);
            if (multiplier is null) return BadRequest(new { message = $"The purchase unit '{unit}' is not configured for {product.Name}." });
            order.Items.Add(new PurchaseOrderItem { ProductId = item.ProductId, Product = product, ProductName = product.Name, QuantityOrdered = item.Quantity, Unit = unit, UnitMultiplier = multiplier.Value, UnitCost = item.UnitCost, BatchNumber = CleanOptional(item.BatchNumber), ExpiryDate = item.ExpiryDate?.Date });
        }
        db.PurchaseOrders.Add(order); db.ActivityLogs.Add(Activity("PURCHASE_ORDER_CREATED", "PurchaseOrder", order.Id.ToString(), null, order.OrderNumber)); await db.SaveChangesAsync(ct);
        await db.Entry(order).Reference(x => x.Supplier).LoadAsync(ct); await db.Entry(order).Reference(x => x.Branch).LoadAsync(ct);
        return Ok(PurchaseOrderDetailRow(order));
    }

    [HttpPost("purchase-orders/{id:guid}/receive")]
    public async Task<ActionResult<AdminPurchaseOrderDetail>> ReceivePurchaseOrder(Guid id, ReceivePurchaseOrderRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.PurchaseOrdersManage)) return Forbid();
        if (IsBranchScoped && !SupervisorBranchId.HasValue) return Forbid();
        var paymentMode = request.PaymentMode?.Trim().ToUpperInvariant() ?? "CREDIT";
        if (request.Items is null || request.Items.Count == 0 || request.Items.Any(x => x.Quantity <= 0) || !PurchasePaymentModes.Contains(paymentMode) || request.PaidAmount < 0 || (request.SupplierInvoiceReference?.Length ?? 0) > 120) return BadRequest(new { message = "Add positive received quantities and valid supplier payment details." });
        if (request.Items.GroupBy(x => x.ItemId).Any(x => x.Count() > 1)) return BadRequest(new { message = "Each purchase-order item can be received only once per submission." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult<AdminPurchaseOrderDetail>>(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var order = await db.PurchaseOrders.Include(x => x.Supplier).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).SingleOrDefaultAsync(x => x.Id == id && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct);
            if (order is null) return NotFound();
            if (order.Status is PurchaseOrderStatuses.Cancelled or PurchaseOrderStatuses.Received) return Conflict(new { message = "This purchase order cannot receive more stock." });
            decimal receiptTotal = 0m;
            var batchesInSubmission = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var received in request.Items)
            {
                var item = order.Items.SingleOrDefault(x => x.Id == received.ItemId);
                if (item is null) return BadRequest(new { message = "A received item does not belong to this purchase order." });
                if (received.Quantity > item.QuantityOrdered - item.QuantityReceived) return Conflict(new { message = $"Received quantity for {item.ProductName} exceeds the remaining order quantity." });
                var batch = string.IsNullOrWhiteSpace(received.BatchNumber) ? item.BatchNumber ?? $"{order.OrderNumber}-{item.Id.ToString()[..6]}" : received.BatchNumber.Trim();
                var expiry = received.ExpiryDate?.Date ?? item.ExpiryDate?.Date;
                if (batch.Length > 80) return BadRequest(new { message = "Batch numbers cannot exceed 80 characters." });
                if (!batchesInSubmission.Add($"{item.ProductId:N}:{batch}")) return BadRequest(new { message = $"Batch {batch} appears more than once in this receipt. Combine the quantities before submitting." });
                if (expiry.HasValue && expiry.Value < ApplicationTime.NepalNow.Date) return BadRequest(new { message = $"Expired batch {batch} cannot be received into saleable inventory." });
                if ((long)received.Quantity * Math.Max(1, item.UnitMultiplier) > int.MaxValue) return BadRequest(new { message = $"The received quantity for {item.ProductName} is too large." });
                receiptTotal += received.Quantity * item.UnitCost;
            }
            if (receiptTotal <= 0) return BadRequest(new { message = "The received items must have a positive purchase value." });
            var paid = paymentMode == "CREDIT" ? 0m : request.PaidAmount ?? receiptTotal;
            if (paid < 0 || paid > receiptTotal || paymentMode == "PARTIAL" && (paid <= 0 || paid >= receiptTotal) || paymentMode != "CREDIT" && paymentMode != "PARTIAL" && paid != receiptTotal)
                return BadRequest(new { message = "Credit must have no payment, partial payment must be less than the receipt total, and other payment modes must pay the full receipt." });
            if (paymentMode == "CREDIT" && request.PaidAmount > 0) return BadRequest(new { message = "Enter zero paid amount for a credit receipt." });
            var previouslyReceived = order.Items.Sum(x => x.QuantityReceived * x.UnitCost);
            var previousInvoices = await db.SupplierInvoices.Where(x => x.PurchaseOrderId == order.Id && x.Status != "VOID").ToListAsync(ct);
            var previouslyPaid = previousInvoices.Sum(x => x.PaidAmount);
            foreach (var received in request.Items)
            {
                var item = order.Items.Single(x => x.Id == received.ItemId);
                var batch = string.IsNullOrWhiteSpace(received.BatchNumber) ? item.BatchNumber ?? $"{order.OrderNumber}-{item.Id.ToString()[..6]}" : received.BatchNumber.Trim();
                var inventory = await db.Inventory.Include(x => x.Product).SingleOrDefaultAsync(x => x.ProductId == item.ProductId && x.BranchId == order.BranchId && x.BatchNumber == batch, ct);
                if (inventory is null)
                {
                    inventory = new Inventory { ProductId = item.ProductId, Product = item.Product, BranchId = order.BranchId, StockQuantity = 0, ReservedQuantity = 0, BatchNumber = batch, PurchasePrice = item.UnitCost / Math.Max(1, item.UnitMultiplier), ExpiryDate = received.ExpiryDate?.Date ?? item.ExpiryDate, SupplierId = order.SupplierId, Supplier = order.Supplier?.Name, PurchaseOrderId = order.Id, BatchStatus = "ACTIVE" };
                    db.Inventory.Add(inventory);
                }
                else if (inventory.SupplierId.HasValue && inventory.SupplierId.Value != order.SupplierId) return Conflict(new { message = $"Batch {batch} is already linked to a different supplier." });
                if (inventory.BatchStatus is "QUARANTINED" or "RETURNED") return Conflict(new { message = $"Batch {batch} is quarantined or returned and cannot receive more saleable stock." });
                var before = inventory.StockQuantity;
                var baseQuantity = (int)((long)received.Quantity * Math.Max(1, item.UnitMultiplier));
                var stockAfter = (long)inventory.StockQuantity + baseQuantity;
                if (stockAfter > int.MaxValue) return Conflict(new { message = $"Receiving batch {batch} would exceed the supported stock quantity." });
                inventory.StockQuantity = (int)stockAfter;
                inventory.PurchasePrice = item.UnitCost / Math.Max(1, item.UnitMultiplier);
                inventory.SupplierId = order.SupplierId;
                inventory.Supplier = order.Supplier?.Name;
                inventory.PurchaseOrderId = order.Id;
                inventory.BatchNumber = batch;
                inventory.ExpiryDate = received.ExpiryDate?.Date ?? item.ExpiryDate ?? inventory.ExpiryDate;
                inventory.BatchStatus = inventory.BatchStatus == "EXPIRED" || inventory.ExpiryDate.HasValue && inventory.ExpiryDate.Value.Date < ApplicationTime.NepalNow.Date ? "EXPIRED" : "ACTIVE";
                inventory.UpdatedAt = ApplicationTime.NepalNow;
                item.QuantityReceived += received.Quantity;
                item.BatchNumber = inventory.BatchNumber;
                item.ExpiryDate = inventory.ExpiryDate;
                item.UpdatedAt = ApplicationTime.NepalNow;
                db.StockTransactions.Add(new StockTransaction { InventoryId = inventory.Id, BranchId = inventory.BranchId, Type = StockTransactionTypes.Purchase, Quantity = baseQuantity, QuantityBefore = before, QuantityAfter = inventory.StockQuantity, Unit = item.Product?.BaseUnit ?? "piece", ReferenceType = "PURCHASE_RECEIPT", ReferenceId = order.Id.ToString(), Note = $"Received {received.Quantity} {item.Unit} ({baseQuantity} base units) against {order.OrderNumber}", ActorId = ActorId });
            }
            var now = ApplicationTime.NepalNow;
            var supplierInvoice = new SupplierInvoice
            {
                SupplierId = order.SupplierId,
                PurchaseOrderId = order.Id,
                BranchId = order.BranchId,
                InvoiceNumber = $"{order.OrderNumber}-R{now:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}",
                InvoiceDate = now,
                Subtotal = receiptTotal,
                Total = receiptTotal,
                PaidAmount = paid,
                Status = paid >= receiptTotal ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
                Notes = $"PURCHASE_ORDER_ID:{order.Id}; PO:{order.OrderNumber}; Supplier invoice:{CleanOptional(request.SupplierInvoiceReference) ?? "not provided"}"
            };
            db.SupplierInvoices.Add(supplierInvoice);
            if (paid > 0) db.SupplierPayments.Add(new SupplierPayment { SupplierId = order.SupplierId, BranchId = order.BranchId, PaymentNumber = $"SPAY-{now:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Amount = paid, Method = paymentMode, PaymentDate = now, Notes = $"Payment for {supplierInvoice.InvoiceNumber}" });
            var receivedValue = order.Items.Sum(x => x.QuantityReceived * x.UnitCost);
            var paidValue = previouslyPaid + paid;
            order.PaymentStatus = paidValue >= receivedValue ? "PAID" : paidValue > 0 ? "PARTIAL" : "UNPAID";
            order.PaymentMethod = previouslyReceived <= 0 || order.PaymentMethod == paymentMode ? paymentMode : "PARTIAL";
            order.Status = order.Items.All(x => x.QuantityReceived >= x.QuantityOrdered) ? PurchaseOrderStatuses.Received : PurchaseOrderStatuses.PartiallyReceived;
            order.UpdatedAt = ApplicationTime.NepalNow;
            db.ActivityLogs.Add(Activity("PURCHASE_ORDER_RECEIVED", "PurchaseOrder", order.Id.ToString(), null, JsonSerializer.Serialize(new { order.OrderNumber, order.Status, order.PaymentStatus, receiptTotal, paid })));
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Ok(PurchaseOrderDetailRow(order));
        });
    }

    [HttpPost("purchase-orders/{id:guid}/cancel")]
    public async Task<IActionResult> CancelPurchaseOrder(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.PurchaseOrdersManage)) return Forbid(); var order = await db.PurchaseOrders.SingleOrDefaultAsync(x => x.Id == id && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct); if (order is null) return NotFound(); if (order.Status is PurchaseOrderStatuses.Received or PurchaseOrderStatuses.Cancelled) return Conflict(new { message = "This purchase order is already closed." }); order.Status = PurchaseOrderStatuses.Cancelled; order.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("PURCHASE_ORDER_CANCELLED", "PurchaseOrder", id.ToString(), null, order.OrderNumber)); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpGet("delivery/zones")]
    public async Task<ActionResult<IReadOnlyList<DeliveryZone>>> Zones([FromQuery] bool activeOnly = false, CancellationToken ct = default) => !Can(AppPermissions.BranchesManage) ? Forbid() : Ok(await db.DeliveryZones.AsNoTracking().Include(x => x.Branch).Where(x => !activeOnly || x.Enabled).OrderBy(x => x.Name).ToListAsync(ct));

    [HttpGet("sales-executive/assignment-options/branches")]
    public async Task<ActionResult<IReadOnlyList<SalesAssignmentBranchOption>>> SalesAssignmentBranches(CancellationToken ct)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        var branches = db.Branches.AsNoTracking().Where(x => x.IsActive);
        if (IsBranchScoped) branches = SupervisorBranchId.HasValue ? branches.Where(x => x.Id == SupervisorBranchId.Value) : branches.Where(_ => false);
        return Ok(await branches.OrderBy(x => x.Name)
            .Select(x => new SalesAssignmentBranchOption(x.Id, x.Name)).ToListAsync(ct));
    }

    [HttpGet("sales-executive/assignment-options/staff")]
    public async Task<ActionResult<PagedResponse<SalesExecutiveOption>>> SalesAssignmentStaffOptions(
        [FromQuery] string? search, [FromQuery] Guid? branchId, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.StaffUsers.AsNoTracking().Include(x => x.Branch)
            .Where(x => x.Role == StaffRoles.SalesExecutive && x.IsActive);
        if (IsBranchScoped) query = SupervisorBranchId.HasValue ? query.Where(x => x.BranchId == SupervisorBranchId.Value) : query.Where(_ => false);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.FullName.Contains(term) || x.Email.Contains(term) || x.Phone.Contains(term)
                || (x.Branch != null && (x.Branch.Name.Contains(term)
                    || (x.Branch.District != null && x.Branch.District.Contains(term))
                    || (x.Branch.Municipality != null && x.Branch.Municipality.Contains(term)))));
        }
        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(x => x.FullName).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var items = rows.Select(x => new SalesExecutiveOption(x.Id, x.FullName, x.Email, x.Phone, x.BranchId,
            x.Branch?.Name, x.Branch is null ? null : string.Join(", ", new[] { x.Branch.District, x.Branch.Municipality }.Where(value => !string.IsNullOrWhiteSpace(value))))).ToList();
        return Ok(new PagedResponse<SalesExecutiveOption>(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("sales-executive/assignment-options/products")]
    public async Task<ActionResult<PagedResponse<AdminProductRow>>> SalesAssignmentProductOptions(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Products.AsNoTracking().Include(x => x.Medicine).ThenInclude(x => x!.Category)
            .Include(x => x.Brand).Include(x => x.Inventory).Include(x => x.Images).Include(x => x.Units)
            .Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.Name.Contains(term) || x.Sku.Contains(term)
                || (x.Medicine!.GenericName != null && x.Medicine.GenericName.Contains(term))
                || (x.Brand != null && x.Brand.Name.Contains(term))
                || (x.Medicine!.Category != null && x.Medicine.Category.Name.Contains(term)));
        }
        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<AdminProductRow>(rows.Select(ProductRowFromEntity).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("sales-executive/assignments")]
    public async Task<ActionResult<PagedResponse<SalesExecutiveAssignmentRow>>> SalesExecutiveAssignments(
        [FromQuery] string? search, [FromQuery] Guid? branchId, [FromQuery] bool? activeOnly = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = ScopeSalesExecutiveAssignments(db.SalesExecutiveProductAssignments.AsNoTracking())
            .Include(x => x.SalesExecutiveUser).ThenInclude(x => x!.Branch)
            .Include(x => x.Product).ThenInclude(x => x!.Brand).Include(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category).Include(x => x.Category)
            .Where(x => x.SalesExecutiveUser != null && x.SalesExecutiveUser.Role == StaffRoles.SalesExecutive);
        if (branchId.HasValue) query = query.Where(x => x.SalesExecutiveUser!.BranchId == branchId.Value);
        if (activeOnly.HasValue) query = query.Where(x => x.IsActive == activeOnly.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.SalesExecutiveUser!.FullName.Contains(term)
                || x.SalesExecutiveUser.Email.Contains(term) || x.SalesExecutiveUser.Phone.Contains(term)
                || (x.SalesExecutiveUser.Branch != null && x.SalesExecutiveUser.Branch.Name.Contains(term))
                || (x.Product != null && (x.Product.Name.Contains(term) || x.Product.Sku.Contains(term)))
                || (x.Category != null && x.Category.Name.Contains(term)));
        }
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<SalesExecutiveAssignmentRow>(rows.Select(AssignmentRow).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpPost("sales-executive/assignments")]
    public async Task<ActionResult<SalesExecutiveAssignmentRow>> CreateSalesExecutiveAssignment(UpsertSalesExecutiveAssignmentRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        if ((request.ProductId.HasValue ? 1 : 0) + (request.CategoryId.HasValue ? 1 : 0) != 1)
            return BadRequest(new { message = "Choose exactly one product or category." });
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.SalesExecutiveUserId && x.Role == StaffRoles.SalesExecutive, ct);
        if (staff is null) return BadRequest(new { message = "Select an active Sales Executive account." });
        if (!staff.IsActive) return BadRequest(new { message = "The selected Sales Executive is inactive." });
        if (!SalesExecutiveBranchAllowed(staff.BranchId)) return Forbid();
        if (request.ProductId.HasValue && !await db.Products.AnyAsync(x => x.Id == request.ProductId.Value && x.IsActive, ct))
            return BadRequest(new { message = "The selected product is not active." });
        if (request.CategoryId.HasValue && !await db.Categories.AnyAsync(x => x.Id == request.CategoryId.Value && x.IsActive, ct))
            return BadRequest(new { message = "The selected category is not active." });
        if (await db.SalesExecutiveProductAssignments.AnyAsync(x => x.SalesExecutiveUserId == request.SalesExecutiveUserId && x.ProductId == request.ProductId && x.CategoryId == request.CategoryId, ct))
            return Conflict(new { message = "This assignment already exists." });
        var item = new SalesExecutiveProductAssignment { SalesExecutiveUserId = request.SalesExecutiveUserId, ProductId = request.ProductId, CategoryId = request.CategoryId, IsActive = request.IsActive };
        db.SalesExecutiveProductAssignments.Add(item);
        db.ActivityLogs.Add(Activity("SALES_EXECUTIVE_ASSIGNMENT_CREATED", "SalesExecutiveProductAssignment", item.Id.ToString(), null, JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId, item.CategoryId })));
        await db.SaveChangesAsync(ct);
        await db.Entry(item).Reference(x => x.SalesExecutiveUser).LoadAsync(ct);
        await db.Entry(item.SalesExecutiveUser!).Reference(x => x.Branch).LoadAsync(ct);
        if (item.ProductId.HasValue) await db.Entry(item).Reference(x => x.Product).LoadAsync(ct);
        if (item.CategoryId.HasValue) await db.Entry(item).Reference(x => x.Category).LoadAsync(ct);
        return Ok(AssignmentRow(item));
    }

    [HttpPost("sales-executive/assignments/bulk")]
    public async Task<ActionResult<BulkSalesExecutiveAssignmentResponse>> BulkCreateSalesExecutiveAssignments(BulkSalesExecutiveAssignmentRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        var salesExecutiveIds = request.SalesExecutiveUserIds.Distinct().ToList();
        var productIds = request.ProductIds.Distinct().ToList();
        if (salesExecutiveIds.Count == 0 || productIds.Count == 0)
            return BadRequest(new { message = "Select at least one Sales Executive and one product." });
        if (salesExecutiveIds.Count > 200 || productIds.Count > 500)
            return BadRequest(new { message = "The bulk selection is too large. Select fewer items and try again." });
        if ((long)salesExecutiveIds.Count * productIds.Count > 10_000)
            return BadRequest(new { message = "A single action can create at most 10,000 assignments. Split this selection into smaller batches." });

        var staff = await db.StaffUsers.Where(x => salesExecutiveIds.Contains(x.Id) && x.Role == StaffRoles.SalesExecutive).ToListAsync(ct);
        if (staff.Count != salesExecutiveIds.Count || staff.Any(x => !x.IsActive))
            return BadRequest(new { message = "Every selected Sales Executive must be active." });
        if (staff.Any(x => !SalesExecutiveBranchAllowed(x.BranchId))) return Forbid();
        var activeProductIds = await db.Products.Where(x => productIds.Contains(x.Id) && x.IsActive).Select(x => x.Id).ToListAsync(ct);
        if (activeProductIds.Count != productIds.Count)
            return BadRequest(new { message = "Every selected product must still be active." });

        var existing = await db.SalesExecutiveProductAssignments.AsNoTracking()
            .Where(x => x.ProductId.HasValue && salesExecutiveIds.Contains(x.SalesExecutiveUserId) && productIds.Contains(x.ProductId.Value))
            .Select(x => new { x.SalesExecutiveUserId, ProductId = x.ProductId!.Value })
            .ToListAsync(ct);
        var existingKeys = existing.Select(x => (x.SalesExecutiveUserId, x.ProductId)).ToHashSet();
        var created = new List<SalesExecutiveProductAssignment>();
        foreach (var salesExecutiveId in salesExecutiveIds)
        foreach (var productId in productIds)
        {
            if (!existingKeys.Add((salesExecutiveId, productId))) continue;
            var item = new SalesExecutiveProductAssignment { SalesExecutiveUserId = salesExecutiveId, ProductId = productId, IsActive = request.IsActive };
            created.Add(item);
            db.SalesExecutiveProductAssignments.Add(item);
            db.ActivityLogs.Add(Activity("SALES_EXECUTIVE_ASSIGNMENT_CREATED", "SalesExecutiveProductAssignment", item.Id.ToString(), null, JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId })));
        }
        if (created.Count > 0) await db.SaveChangesAsync(ct);
        var createdIds = created.Select(x => x.Id).ToList();
        var rows = await db.SalesExecutiveProductAssignments.AsNoTracking()
            .Include(x => x.SalesExecutiveUser).ThenInclude(x => x!.Branch).Include(x => x.Product).ThenInclude(x => x!.Brand).Include(x => x.Product).ThenInclude(x => x!.Medicine).ThenInclude(x => x!.Category)
            .Where(x => createdIds.Contains(x.Id)).OrderBy(x => x.SalesExecutiveUser!.FullName).ThenBy(x => x.Product!.Name).ToListAsync(ct);
        var skipped = salesExecutiveIds.Count * productIds.Count - created.Count;
        return Ok(new BulkSalesExecutiveAssignmentResponse(rows.Select(AssignmentRow).ToList(), skipped));
    }

    [HttpPut("sales-executive/assignments/{id:guid}")]
    public async Task<ActionResult<SalesExecutiveAssignmentRow>> UpdateSalesExecutiveAssignment(Guid id, UpsertSalesExecutiveAssignmentRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        if ((request.ProductId.HasValue ? 1 : 0) + (request.CategoryId.HasValue ? 1 : 0) != 1)
            return BadRequest(new { message = "Choose exactly one product or category." });
        var item = await ScopeSalesExecutiveAssignments(db.SalesExecutiveProductAssignments).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.SalesExecutiveUserId && x.Role == StaffRoles.SalesExecutive, ct);
        if (staff is null || !staff.IsActive) return BadRequest(new { message = "Select an active Sales Executive account." });
        if (!SalesExecutiveBranchAllowed(staff.BranchId)) return Forbid();
        if (request.ProductId.HasValue && !await db.Products.AnyAsync(x => x.Id == request.ProductId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected product is not active." });
        if (request.CategoryId.HasValue && !await db.Categories.AnyAsync(x => x.Id == request.CategoryId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected category is not active." });
        if (await db.SalesExecutiveProductAssignments.AnyAsync(x => x.Id != id && x.SalesExecutiveUserId == request.SalesExecutiveUserId && x.ProductId == request.ProductId && x.CategoryId == request.CategoryId, ct))
            return Conflict(new { message = "This assignment already exists." });
        var previous = JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId, item.CategoryId, item.IsActive });
        item.SalesExecutiveUserId = request.SalesExecutiveUserId; item.ProductId = request.ProductId; item.CategoryId = request.CategoryId; item.IsActive = request.IsActive; item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("SALES_EXECUTIVE_ASSIGNMENT_UPDATED", "SalesExecutiveProductAssignment", item.Id.ToString(), previous, JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId, item.CategoryId, item.IsActive })));
        await db.SaveChangesAsync(ct);
        await db.Entry(item).Reference(x => x.SalesExecutiveUser).LoadAsync(ct);
        await db.Entry(item.SalesExecutiveUser!).Reference(x => x.Branch).LoadAsync(ct);
        if (item.ProductId.HasValue) await db.Entry(item).Reference(x => x.Product).LoadAsync(ct);
        if (item.CategoryId.HasValue) await db.Entry(item).Reference(x => x.Category).LoadAsync(ct);
        return Ok(AssignmentRow(item));
    }

    [HttpPut("sales-executive/assignments/bulk")]
    public async Task<ActionResult<BulkSalesExecutiveAssignmentMutationResponse>> BulkUpdateSalesExecutiveAssignments(BulkSalesExecutiveAssignmentUpdateRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        var ids = request.AssignmentIds.Distinct().ToList();
        if (ids.Count == 0 || ids.Count > 500) return BadRequest(new { message = "Select between 1 and 500 assignments." });
        if (request.IsActive is null && request.SalesExecutiveUserId is null && request.ProductId is null)
            return BadRequest(new { message = "Choose at least one field to update." });
        if (request.SalesExecutiveUserId.HasValue)
        {
            var targetExecutive = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.SalesExecutiveUserId.Value && x.Role == StaffRoles.SalesExecutive && x.IsActive, ct);
            if (targetExecutive is null) return BadRequest(new { message = "Select an active Sales Executive account." });
            if (!SalesExecutiveBranchAllowed(targetExecutive.BranchId)) return Forbid();
        }
        if (request.ProductId.HasValue && !await db.Products.AnyAsync(x => x.Id == request.ProductId.Value && x.IsActive, ct))
            return BadRequest(new { message = "Select an active product." });

        var items = await ScopeSalesExecutiveAssignments(db.SalesExecutiveProductAssignments).Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        if (items.Count != ids.Count) return NotFound(new { message = "One or more selected assignments no longer exist. Refresh the list and try again." });
        if (request.SalesExecutiveUserId.HasValue || request.ProductId.HasValue)
        {
            var candidatePairs = items.Select(x => (
                ExecutiveId: request.SalesExecutiveUserId ?? x.SalesExecutiveUserId,
                ProductId: request.ProductId ?? x.ProductId,
                CategoryId: request.ProductId.HasValue ? null : x.CategoryId)).ToList();
            if (candidatePairs.GroupBy(x => (x.ExecutiveId, x.ProductId, x.CategoryId)).Any(group => group.Count() > 1))
                return Conflict(new { message = "These changes would create duplicate assignments. Adjust the selection and try again." });
            var executiveIds = candidatePairs.Select(x => x.ExecutiveId).Distinct().ToList();
            var productIds = candidatePairs.Where(x => x.ProductId.HasValue).Select(x => x.ProductId!.Value).Distinct().ToList();
            var categoryIds = candidatePairs.Where(x => x.CategoryId.HasValue).Select(x => x.CategoryId!.Value).Distinct().ToList();
            var occupied = await db.SalesExecutiveProductAssignments.AsNoTracking()
                .Where(x => !ids.Contains(x.Id) && executiveIds.Contains(x.SalesExecutiveUserId)
                    && ((x.ProductId.HasValue && productIds.Contains(x.ProductId.Value))
                        || (x.CategoryId.HasValue && categoryIds.Contains(x.CategoryId.Value))))
                .Select(x => new { x.SalesExecutiveUserId, x.ProductId, x.CategoryId }).ToListAsync(ct);
            if (candidatePairs.Any(pair => occupied.Any(row => row.SalesExecutiveUserId == pair.ExecutiveId && row.ProductId == pair.ProductId && row.CategoryId == pair.CategoryId)))
                return Conflict(new { message = "These changes would duplicate an existing assignment. Adjust the selection and try again." });
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        foreach (var item in items)
        {
            var before = JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId, item.CategoryId, item.IsActive });
            if (request.SalesExecutiveUserId.HasValue) item.SalesExecutiveUserId = request.SalesExecutiveUserId.Value;
            if (request.ProductId.HasValue) { item.ProductId = request.ProductId.Value; item.CategoryId = null; }
            if (request.IsActive.HasValue) item.IsActive = request.IsActive.Value;
            item.UpdatedAt = ApplicationTime.NepalNow;
            db.ActivityLogs.Add(Activity("SALES_EXECUTIVE_ASSIGNMENT_UPDATED", "SalesExecutiveProductAssignment", item.Id.ToString(), before,
                JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId, item.CategoryId, item.IsActive })));
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(new BulkSalesExecutiveAssignmentMutationResponse(items.Count, 0));
    }

    [HttpDelete("sales-executive/assignments/bulk")]
    public async Task<ActionResult<BulkSalesExecutiveAssignmentMutationResponse>> BulkDeleteSalesExecutiveAssignments(BulkSalesExecutiveAssignmentDeleteRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        var ids = request.AssignmentIds.Distinct().ToList();
        if (ids.Count == 0 || ids.Count > 500) return BadRequest(new { message = "Select between 1 and 500 assignments." });
        var items = await ScopeSalesExecutiveAssignments(db.SalesExecutiveProductAssignments).Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        if (items.Count != ids.Count) return NotFound(new { message = "One or more selected assignments no longer exist. Refresh the list and try again." });
        foreach (var item in items)
        {
            db.ActivityLogs.Add(Activity("SALES_EXECUTIVE_ASSIGNMENT_DELETED", "SalesExecutiveProductAssignment", item.Id.ToString(),
                JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId, item.CategoryId }), null));
        }
        db.SalesExecutiveProductAssignments.RemoveRange(items);
        await db.SaveChangesAsync(ct);
        return Ok(new BulkSalesExecutiveAssignmentMutationResponse(0, items.Count));
    }

    [HttpDelete("sales-executive/assignments/{id:guid}")]
    public async Task<IActionResult> DeleteSalesExecutiveAssignment(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.SalesAssignmentsManage)) return Forbid();
        var item = await ScopeSalesExecutiveAssignments(db.SalesExecutiveProductAssignments).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        db.SalesExecutiveProductAssignments.Remove(item);
        db.ActivityLogs.Add(Activity("SALES_EXECUTIVE_ASSIGNMENT_DELETED", "SalesExecutiveProductAssignment", id.ToString(), JsonSerializer.Serialize(new { item.SalesExecutiveUserId, item.ProductId, item.CategoryId }), null));
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("delivery/zones")]
    public async Task<ActionResult<DeliveryZone>> CreateZone(UpsertZoneRequest r, CancellationToken ct) => await SaveZone(null, r, ct);
    [HttpPut("delivery/zones/{id:guid}")]
    public async Task<ActionResult<DeliveryZone>> UpdateZone(Guid id, UpsertZoneRequest r, CancellationToken ct) => await SaveZone(id, r, ct);
    [HttpGet("delivery/slots")]
    public async Task<ActionResult<IReadOnlyList<AdminDeliverySlot>>> DeliverySlots(CancellationToken ct)
    {
        if (!Can(AppPermissions.BranchesManage)) return Forbid();
        var query = db.DeliverySlots.AsNoTracking().Include(x => x.Branch).AsQueryable();
        if (IsBranchScoped) query = SupervisorBranchId.HasValue ? query.Where(x => x.BranchId == SupervisorBranchId.Value) : query.Where(_ => false);
        var rows = await query.OrderBy(x => x.DisplayOrder).ThenBy(x => x.StartTime).ToListAsync(ct);
        return Ok(rows.Select(x => new AdminDeliverySlot(x.Id, x.Label, x.StartTime, x.EndTime, x.BranchId, x.Branch?.Name, x.MaxOrders, x.DisplayOrder, x.Enabled, x.UpdatedAt)).ToList());
    }
    [HttpPost("delivery/slots")]
    public async Task<ActionResult<AdminDeliverySlot>> CreateDeliverySlot(UpsertDeliverySlotRequest r, CancellationToken ct) => await SaveDeliverySlot(null, r, ct);
    [HttpPut("delivery/slots/{id:guid}")]
    public async Task<ActionResult<AdminDeliverySlot>> UpdateDeliverySlot(Guid id, UpsertDeliverySlotRequest r, CancellationToken ct) => await SaveDeliverySlot(id, r, ct);

    [HttpGet("staff")]
    public async Task<ActionResult<IReadOnlyList<AdminStaffRow>>> Staff([FromQuery] bool activeOnly = false, CancellationToken ct = default) { if (!Can(AppPermissions.StaffManage) && !Can(AppPermissions.SalesAssignmentsManage)) return Forbid(); var query = db.StaffUsers.AsNoTracking().Include(x => x.Branch).Where(x => !activeOnly || x.IsActive); if (IsBranchScoped) query = SupervisorBranchId.HasValue ? query.Where(x => x.BranchId == SupervisorBranchId.Value) : query.Where(_ => false); var rows = await query.OrderBy(x => x.Role).ThenBy(x => x.FullName).ToListAsync(ct); return Ok(rows.Select(x => StaffRow(x, x.Branch?.Name, x.Branch is null ? null : string.Join(", ", new[] { x.Branch.District, x.Branch.Municipality }.Where(value => !string.IsNullOrWhiteSpace(value))))).ToList()); }
    [HttpPost("staff")]
    public async Task<ActionResult<AdminStaffRow>> CreateStaff(UpsertStaffRequest r, CancellationToken ct) => await SaveStaff(null, r, ct);
    [HttpPut("staff/{id:guid}")]
    public async Task<ActionResult<AdminStaffRow>> UpdateStaff(Guid id, UpsertStaffRequest r, CancellationToken ct) => await SaveStaff(id, r, ct);

    [HttpGet("staff/{id:guid}/photo")]
    public async Task<IActionResult> StaffPhoto(Guid id, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var staff = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (staff?.ProfilePhotoStoredFileName is null || string.IsNullOrWhiteSpace(staff.ProfilePhotoContentType)) return NotFound();
        var stream = await media.OpenReadAsync(staff.ProfilePhotoStoredFileName, ct);
        return stream is null ? NotFound() : File(stream, staff.ProfilePhotoContentType, enableRangeProcessing: true);
    }

    [HttpPost("staff/{id:guid}/photo")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<ActionResult<AdminStaffRow>> UploadStaffPhoto(Guid id, [FromForm] IFormFile file, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var staff = await db.StaffUsers.Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (staff is null) return NotFound();
        StoredMediaFile? stored = null;
        try
        {
            stored = await media.SaveAsync(file, ct);
            var previousFile = staff.ProfilePhotoStoredFileName;
            staff.ProfilePhotoStoredFileName = stored.StoredFileName;
            staff.ProfilePhotoContentType = stored.ContentType;
            staff.UpdatedAt = DateTime.UtcNow;
            db.ActivityLogs.Add(Activity("STAFF_PROFILE_PHOTO_UPDATED", "StaffUser", id.ToString(), previousFile, stored.OriginalFileName));
            await db.SaveChangesAsync(ct);
            if (!string.IsNullOrWhiteSpace(previousFile) && previousFile != stored.StoredFileName) await media.DeleteAsync(previousFile, ct);
            return Ok(StaffRow(staff, staff.Branch?.Name));
        }
        catch (InvalidDataException exception) { return BadRequest(new { message = exception.Message }); }
        catch
        {
            if (stored is not null) await media.DeleteAsync(stored.StoredFileName, CancellationToken.None);
            throw;
        }
    }

    [HttpGet("orders")]
    public async Task<ActionResult<PagedResponse<AdminOrderRow>>> Orders([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken ct = default) { if (!Can(AppPermissions.OrdersView)) return Forbid(); var query = ScopeOrders(db.Orders.AsNoTracking()).Include(x => x.Customer).Include(x => x.Branch).Include(x => x.DeliveryAssignment).AsQueryable(); if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.OrderNumber.Contains(search) || (x.OrderCustomerName ?? x.Customer!.FullName).Contains(search) || (x.OrderCustomerPhone ?? x.Customer!.Phone).Contains(search)); if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status); var total = await query.CountAsync(ct); var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct); return Ok(new PagedResponse<AdminOrderRow>(rows.Select(x => new AdminOrderRow(x.Id, x.OrderNumber, x.OrderCustomerName ?? x.Customer?.FullName ?? "", x.OrderCustomerPhone ?? x.Customer?.Phone ?? "", x.Branch?.Name, x.Status, x.PaymentStatus, x.Total, x.CreatedAt, x.OrderMode)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize))); }

    [HttpGet("orders/{id:guid}")]
    public async Task<ActionResult<AdminOrderDetailResponse>> Order(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.OrdersView)) return Forbid();
        var response = await LoadAdminOrderDetail(id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpGet("orders/{orderId:guid}/nearby-riders")]
    public async Task<ActionResult<IReadOnlyList<NearbyRiderCandidate>>> NearbyRiders(Guid orderId, CancellationToken ct)
    {
        if (SuperAdminPath ? !IsSuperAdmin : !IsAdmin || !User.HasStaffPermission(AppPermissions.OrdersManage))
            return Forbid();
        if (IsBranchScoped && !SupervisorBranchId.HasValue)
            return Forbid();

        var order = await ScopeOrders(db.Orders.AsNoTracking())
            .Where(x => x.Id == orderId)
            .Select(x => new
            {
                x.BranchId,
                Pickup = x.Branch == null ? null : new { x.Branch.Latitude, x.Branch.Longitude }
            })
            .SingleOrDefaultAsync(ct);
        if (order is null) return NotFound();
        if (order.BranchId is null || order.Pickup?.Latitude is not decimal pickupLatitude
            || order.Pickup.Longitude is not decimal pickupLongitude
            || pickupLatitude is < -90 or > 90 || pickupLongitude is < -180 or > 180)
            return BadRequest(new { message = "Pickup coordinates are not configured for the order's branch. Configure valid branch latitude and longitude before requesting rider suggestions." });

        var now = DateTime.UtcNow;
        var freshAfter = now.AddMinutes(-2);
        var activeStatuses = new[]
        {
            DeliveryStatuses.Assigned,
            DeliveryStatuses.Accepted,
            DeliveryStatuses.PickedUp,
            DeliveryStatuses.OutForDelivery
        };
        var query = db.RiderAvailabilities.AsNoTracking()
            .Where(availability => availability.IsAvailable
                && availability.LocationUpdatedAt >= freshAfter
                && availability.Latitude.HasValue
                && availability.Longitude.HasValue
                && availability.StaffUser != null
                && availability.StaffUser.IsActive
                && availability.StaffUser.Role == StaffRoles.Delivery
                && !db.DeliveryAssignments.Any(assignment => assignment.DeliveryStaffId == availability.StaffUserId
                    && activeStatuses.Contains(assignment.Status)));
        if (IsBranchScoped)
            query = query.Where(availability => availability.StaffUser!.BranchId == order.BranchId);

        var riders = await query.Select(availability => new
        {
            availability.StaffUserId,
            RiderName = availability.StaffUser!.FullName,
            Latitude = availability.Latitude!.Value,
            Longitude = availability.Longitude!.Value,
            LastUpdatedAt = availability.LocationUpdatedAt!.Value
        }).ToListAsync(ct);

        var candidates = riders.Select(rider => new NearbyRiderCandidate(
                rider.StaffUserId,
                rider.RiderName,
                Math.Round(DistanceMeters((double)pickupLatitude, (double)pickupLongitude,
                    (double)rider.Latitude, (double)rider.Longitude), 1),
                true,
                rider.LastUpdatedAt))
            .OrderBy(candidate => candidate.DistanceMeters)
            .ToList();
        return Ok(candidates);
    }

    [HttpPut("orders/{id:guid}/assignment")]
    public async Task<ActionResult<AdminOrderDetailResponse>> AssignOrder(Guid id, AdminOrderAssignmentRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.OrdersManage)) return Forbid();
        var order = await ScopeOrders(db.Orders).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.CurrentLocation).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (order is null) return NotFound();
        if (IsBranchScoped && (!SupervisorBranchId.HasValue || request.BranchId != SupervisorBranchId.Value)) return Forbid();
        if (request.BranchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == request.BranchId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected branch is not active." });
        var pharmacist = request.PharmacistId.HasValue ? await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.PharmacistId.Value && x.Role == StaffRoles.Pharmacist && x.IsActive && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct) : null;
        if (request.PharmacistId.HasValue && pharmacist is null) return BadRequest(new { message = "The selected pharmacist is not active." });
        var deliveryStaff = request.DeliveryStaffId.HasValue ? await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.DeliveryStaffId.Value && x.Role == StaffRoles.Delivery && x.IsActive && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct) : null;
        if (request.DeliveryStaffId.HasValue && deliveryStaff is null) return BadRequest(new { message = "The selected delivery staff member is not active." });
        var supervisor = request.SupervisorId.HasValue ? await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.SupervisorId.Value && x.Role == StaffRoles.Supervisor && x.IsActive && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct) : null;
        if (request.SupervisorId.HasValue && supervisor is null) return BadRequest(new { message = "The selected supervisor is not active." });
        var allowedAssigneeRoles = new[] { StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.Accountant, StaffRoles.SalesManager, StaffRoles.PurchaseInventoryManager };
        var otherAssignee = request.AssignedStaffUserId.HasValue ? await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.AssignedStaffUserId.Value && allowedAssigneeRoles.Contains(x.Role) && x.IsActive && (!IsBranchScoped || x.BranchId == SupervisorBranchId), ct) : null;
        if (request.AssignedStaffUserId.HasValue && otherAssignee is null) return BadRequest(new { message = "Choose an active operations user who is permitted to receive order assignments." });
        if (request.BranchId.HasValue && pharmacist?.BranchId.HasValue == true && pharmacist.BranchId != request.BranchId) return BadRequest(new { message = "The pharmacist is assigned to a different branch." });
        if (request.BranchId.HasValue && deliveryStaff?.BranchId.HasValue == true && deliveryStaff.BranchId != request.BranchId) return BadRequest(new { message = "The delivery staff member is assigned to a different branch." });
        if (request.BranchId.HasValue && supervisor?.BranchId.HasValue == true && supervisor.BranchId != request.BranchId) return BadRequest(new { message = "The supervisor is assigned to a different branch." });
        if (request.BranchId.HasValue && otherAssignee?.BranchId.HasValue == true && otherAssignee.BranchId != request.BranchId) return BadRequest(new { message = "The operations assignee is assigned to a different branch." });
        var previousStatus = order.Status;
        var assignmentNotifications = new List<Notification>();
        var previous = JsonSerializer.Serialize(new { order.BranchId, order.PharmacistId, DeliveryStaffId = order.DeliveryAssignment?.DeliveryStaffId, order.SupervisorId, order.AssignedStaffUserId, order.Status });
        var next = JsonSerializer.Serialize(new { NewBranchId = request.BranchId, NewPharmacistId = request.PharmacistId, NewDeliveryStaffId = request.DeliveryStaffId, NewSupervisorId = request.SupervisorId, NewAssigneeId = request.AssignedStaffUserId });
        order.BranchId = request.BranchId; order.PharmacistId = request.PharmacistId; order.SupervisorId = request.SupervisorId; order.AssignedStaffUserId = request.AssignedStaffUserId; order.UpdatedAt = DateTime.UtcNow;
        if (order.DeliveryAssignment is not null && order.DeliveryAssignment.DeliveryStaffId != request.DeliveryStaffId)
            await RiderAvailabilityOperations.SetUnavailableAsync(db, order.DeliveryAssignment.DeliveryStaffId, DateTime.UtcNow, ct);
        if (order.DeliveryAssignment is not null && !request.DeliveryStaffId.HasValue)
        {
            db.DeliveryAssignments.Remove(order.DeliveryAssignment);
            await messaging.CloseDeliveryConversationAsync(id, ct);
            if (order.Status == OrderStatuses.AssignedForDelivery) order.Status = OrderStatuses.ReadyForPickup;
        }
        else if (deliveryStaff is not null)
        {
            var assignment = order.DeliveryAssignment ?? new DeliveryAssignment { OrderId = id, DeliveryStaffId = deliveryStaff.Id, Status = DeliveryStatuses.Assigned };
            await RiderAvailabilityOperations.SetUnavailableAsync(db, deliveryStaff.Id, DateTime.UtcNow, ct);
            if (order.DeliveryAssignment?.CurrentLocation is not null)
            {
                db.DeliveryLocations.Remove(order.DeliveryAssignment.CurrentLocation);
                order.DeliveryAssignment.CurrentLocation = null;
            }
            assignment.DeliveryStaffId = deliveryStaff.Id; assignment.Status = DeliveryStatuses.Assigned; assignment.AcceptedAt = null; assignment.ArrivedAt = null; assignment.PickedUpAt = null; assignment.OutForDeliveryAt = null; assignment.DeliveredAt = null; assignment.FailedAt = null; assignment.FailureReason = null; assignment.Notes = request.Note?.Trim(); assignment.UpdatedAt = DateTime.UtcNow;
            if (order.DeliveryAssignment is null) db.DeliveryAssignments.Add(assignment);
            if (order.Status == OrderStatuses.ReadyForPickup) order.Status = OrderStatuses.AssignedForDelivery;
            var deliveryMessage = await notifications.RenderAsync("DELIVERY_ASSIGNED", "Delivery assigned", $"Order {order.OrderNumber} has been assigned to you.", new Dictionary<string, string?> { ["order_id"] = order.OrderNumber }, ct);
            var deliveryNotification = new Notification { StaffUserId = deliveryStaff.Id, Type = "delivery_assignment", Title = deliveryMessage.Title, Body = deliveryMessage.Body };
            assignmentNotifications.Add(deliveryNotification);
            await messaging.EnsureDeliveryConversationAsync(id, order.CustomerId, deliveryStaff.Id, order.OrderNumber, ct);
        }
        if (pharmacist is not null) assignmentNotifications.Add(new Notification { StaffUserId = pharmacist.Id, Type = "order_assignment", Title = "Order assigned for pharmacy review", Body = $"Order {order.OrderNumber} has been assigned to you." });
        if (supervisor is not null) assignmentNotifications.Add(new Notification { StaffUserId = supervisor.Id, Type = "order_assignment", Title = "Order assigned for supervision", Body = $"Order {order.OrderNumber} has been assigned to you for branch oversight." });
        if (otherAssignee is not null) assignmentNotifications.Add(new Notification { StaffUserId = otherAssignee.Id, Type = "order_assignment", Title = "Order assigned to you", Body = $"Order {order.OrderNumber} has been assigned to you." });
        var assignmentRecipients = await db.StaffUsers.Where(x => x.IsActive && (x.Role == StaffRoles.Admin || x.Role == StaffRoles.SuperAdmin || x.Role == StaffRoles.Accountant ||
            order.BranchId.HasValue && x.BranchId == order.BranchId && (x.Role == StaffRoles.Supervisor || x.Role == StaffRoles.Pharmacist))).Select(x => x.Id).ToListAsync(ct);
        var alreadyNotified = assignmentNotifications.Where(x => x.StaffUserId.HasValue).Select(x => x.StaffUserId!.Value).ToHashSet();
        assignmentNotifications.AddRange(assignmentRecipients.Where(x => !alreadyNotified.Contains(x)).Select(x => new Notification { StaffUserId = x, Type = "order_assignment", Title = "Order assignment updated", Body = $"Assignments for order {order.OrderNumber} were updated." }));
        var customerAssignmentNotice = new Notification { CustomerId = order.CustomerId, Type = "order_assignment", Title = "Your order was assigned", Body = $"Your order {order.OrderNumber} has been assigned to the team for processing and delivery." };
        db.Notifications.AddRange(assignmentNotifications);
        db.Notifications.Add(customerAssignmentNotice);
        db.OrderAssignmentHistory.Add(new OrderAssignmentHistory { OrderId = id, ActorStaffUserId = ActorId, ChangeType = "MANUAL_ASSIGNMENT", PreviousValue = previous, NewValue = next, Note = request.Note?.Trim() });
        if (order.Status != previousStatus) db.OrderStatusHistory.Add(new OrderStatusHistory { OrderId = id, Status = order.Status, Note = request.Note?.Trim(), ActorId = ActorId.ToString(), ActorRole = User.FindFirstValue(ClaimTypes.Role) });
        db.ActivityLogs.Add(Activity("ADMIN_UPDATED_ORDER_ASSIGNMENT", "PharmacyOrder", id.ToString(), previous, JsonSerializer.Serialize(new { order.BranchId, order.PharmacistId, DeliveryStaffId = request.DeliveryStaffId, order.SupervisorId, order.AssignedStaffUserId })));
        await db.SaveChangesAsync(ct);
        await notificationHub.Clients.Group(NotificationHub.Group("customer", order.CustomerId)).SendAsync("notification", new { id = customerAssignmentNotice.Id, type = customerAssignmentNotice.Type, title = customerAssignmentNotice.Title, body = customerAssignmentNotice.Body, isRead = false, createdAt = customerAssignmentNotice.CreatedAt }, ct);
        foreach (var notification in assignmentNotifications)
            if (notification.StaffUserId.HasValue)
                await notificationHub.Clients.Group(NotificationHub.Group("staff", notification.StaffUserId.Value)).SendAsync("notification", new { id = notification.Id, type = notification.Type, title = notification.Title, body = notification.Body, isRead = false, createdAt = notification.CreatedAt }, ct);
        var response = await LoadAdminOrderDetail(id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpGet("orders/{id:guid}/invoice")]
    public async Task<ActionResult<AdminInvoiceResponse>> Invoice(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.OrdersView)) return Forbid();
        var invoice = await EnsureInvoice(id, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpGet("orders/{id:guid}/invoice/document")]
    public async Task<IActionResult> InvoiceDocument(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.OrdersView)) return Forbid();
        var order = await ScopeOrders(db.Orders.AsNoTracking()).Include(x => x.Customer).Include(x => x.Items).Include(x => x.Invoice).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (order is null) return NotFound();
        var invoice = await EnsureInvoice(id, ct);
        if (invoice is null) return NotFound();
        var invoiceSettings = await db.SystemSettings.AsNoTracking().Where(x => x.Key.StartsWith("invoice.")).ToDictionaryAsync(x => x.Key, x => x.Value, ct);
        var companyName = WebUtility.HtmlEncode(invoiceSettings.GetValueOrDefault("invoice.companyName") ?? "All Nepal Healthy Home");
        var companyAddress = WebUtility.HtmlEncode(invoiceSettings.GetValueOrDefault("invoice.companyAddress") ?? "New Baneshwor, Kathmandu, Nepal");
        var panVat = WebUtility.HtmlEncode(invoiceSettings.GetValueOrDefault("invoice.panVat") ?? string.Empty);
        var footer = WebUtility.HtmlEncode(invoiceSettings.GetValueOrDefault("invoice.footer") ?? string.Empty);
        var terms = WebUtility.HtmlEncode(invoiceSettings.GetValueOrDefault("invoice.terms") ?? string.Empty);
        var showTax = !bool.TryParse(invoiceSettings.GetValueOrDefault("invoice.showTax"), out var configuredShowTax) || configuredShowTax;
        var customer = WebUtility.HtmlEncode(order.Customer?.FullName ?? "Customer");
        var rows = string.Join("", order.Items.Select(item => $"<tr><td>{WebUtility.HtmlEncode(item.ProductName)}</td><td>{item.Quantity}</td><td>{item.UnitPrice:N2}</td><td>{(item.Quantity * item.UnitPrice):N2}</td></tr>"));
        var taxLine = showTax && invoice.TaxAmount > 0 ? $"<br>Tax: NPR {invoice.TaxAmount:N2}" : string.Empty;
        var identifiers = string.IsNullOrWhiteSpace(panVat) ? string.Empty : $"<br><strong>PAN/VAT:</strong> {panVat}";
        var footerBlock = string.IsNullOrWhiteSpace(footer) ? string.Empty : $"<p class='footer'>{footer}</p>";
        var termsBlock = string.IsNullOrWhiteSpace(terms) ? string.Empty : $"<p class='terms'><strong>Terms:</strong> {terms}</p>";
        var html = $"<!doctype html><html><head><meta charset='utf-8'><title>{invoice.InvoiceNumber}</title><style>body{{font-family:Arial,sans-serif;margin:40px;color:#172033}}h1{{color:#003893;margin-bottom:4px}}.muted{{color:#64748b}}table{{width:100%;border-collapse:collapse;margin-top:24px}}th,td{{border-bottom:1px solid #ddd;padding:10px;text-align:left}}.total{{margin-top:24px;text-align:right;font-size:18px;font-weight:700}}.footer{{margin-top:42px;color:#003893;font-weight:700}}.terms{{margin-top:24px;color:#64748b;font-size:12px}}</style></head><body><h1>{companyName}</h1><p class='muted'>{companyAddress}{identifiers}</p><p><strong>Invoice:</strong> {invoice.InvoiceNumber}<br><strong>Order:</strong> {invoice.OrderNumber}<br><strong>Issued:</strong> {invoice.IssuedAt:yyyy-MM-dd}</p><p><strong>Bill to:</strong> {customer}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{rows}</tbody></table><div class='total'>Subtotal: NPR {invoice.Subtotal:N2}{taxLine}<br>Discount: NPR {invoice.DiscountAmount:N2}<br>Delivery: NPR {invoice.DeliveryFee:N2}<br>Total: NPR {invoice.Total:N2}</div>{termsBlock}{footerBlock}</body></html>";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{invoice.InvoiceNumber}.html\"";
        return Content(html, "text/html; charset=utf-8");
    }

    [HttpPut("orders/{id:guid}/status")]
    public async Task<ActionResult<AdminOrderRow>> UpdateOrderStatus(Guid id, OrderStatusRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.OrdersManage)) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Status)) return BadRequest(new { message = "A target order status is required." });
        var nextStatus = request.Status.Trim().ToUpperInvariant();
        if (request.Note?.Trim().Length > 500) return BadRequest(new { message = "The order status note cannot exceed 500 characters." });
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult<AdminOrderRow>>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var order = await ScopeOrders(db.Orders).Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Items).Include(x => x.DeliveryAssignment).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (order is null) return NotFound();
            if (order.DeliveryAssignment is not null && nextStatus == OrderStatuses.Delivered) return Conflict(new { message = "The assigned rider must arrive and complete delivery with the required proof." });
            if (!AllowedOrderTransition(order.Status, nextStatus) && !(IsSuperAdmin && nextStatus == OrderStatuses.Cancelled && order.Status != OrderStatuses.Delivered)) return Conflict(new { message = $"The order cannot move from {order.Status} to {nextStatus}." });
            var previous = order.Status;
            order.Status = nextStatus;
            order.UpdatedAt = ApplicationTime.NepalNow;
            if (order.Status == OrderStatuses.Cancelled && previous != OrderStatuses.Cancelled)
            {
                foreach (var line in order.Items)
                {
                    var requiredBaseQuantity = (long)line.Quantity * Math.Max(1, line.UnitMultiplier);
                    if (requiredBaseQuantity > int.MaxValue) return Conflict(new { message = $"The reservation quantity for {line.ProductName} is outside the supported range." });
                    var reservations = await db.StockTransactions
                        .Include(x => x.Inventory)
                        .Where(x => x.Type == StockTransactionTypes.Reservation
                            && x.ReferenceType == "CUSTOMER_ORDER"
                            && x.ReferenceId == order.Id.ToString()
                            && x.Inventory != null
                            && x.Inventory.ProductId == line.ProductId)
                        .ToListAsync(ct);
                    if (reservations.Count > 0)
                    {
                        if (reservations.Sum(x => (long)x.Quantity) != requiredBaseQuantity) return Conflict(new { message = $"The reservation ledger for {line.ProductName} does not match the order quantity; cancellation was not posted." });
                        foreach (var reservation in reservations)
                        {
                            var stock = reservation.Inventory!;
                            if (stock.ReservedQuantity < reservation.Quantity) return Conflict(new { message = $"Reserved stock for {line.ProductName}, batch {stock.BatchNumber}, no longer matches its ledger." });
                            var before = stock.ReservedQuantity;
                            stock.ReservedQuantity -= reservation.Quantity;
                            stock.UpdatedAt = ApplicationTime.NepalNow;
                            db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.Release, Quantity = -reservation.Quantity, QuantityBefore = before, QuantityAfter = stock.ReservedQuantity, Unit = reservation.Unit, ReferenceType = "CUSTOMER_ORDER_CANCEL", ReferenceId = order.Id.ToString(), Reason = request.Note?.Trim() ?? "Order cancelled", Note = $"Order {order.OrderNumber} cancelled", ActorId = ActorId });
                        }
                        continue;
                    }

                    var remaining = (int)requiredBaseQuantity;
                    var legacyStocks = await db.Inventory.Where(x => x.ProductId == line.ProductId && x.BranchId == order.BranchId && x.ReservedQuantity > 0).OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.CreatedAt).ToListAsync(ct);
                    foreach (var legacyStock in legacyStocks)
                    {
                        if (remaining <= 0) break;
                        var release = Math.Min(remaining, legacyStock.ReservedQuantity);
                        if (release <= 0) continue;
                        var before = legacyStock.ReservedQuantity;
                        legacyStock.ReservedQuantity -= release;
                        legacyStock.UpdatedAt = ApplicationTime.NepalNow;
                        remaining -= release;
                        db.StockTransactions.Add(new StockTransaction { InventoryId = legacyStock.Id, BranchId = legacyStock.BranchId, Type = StockTransactionTypes.Release, Quantity = -release, QuantityBefore = before, QuantityAfter = legacyStock.ReservedQuantity, Unit = line.Unit, ReferenceType = "CUSTOMER_ORDER_CANCEL", ReferenceId = order.Id.ToString(), Reason = request.Note?.Trim() ?? "Order cancelled", Note = $"Order {order.OrderNumber} cancelled", ActorId = ActorId });
                    }
                    if (remaining > 0) return Conflict(new { message = $"The reservation ledger for {line.ProductName} is incomplete; cancellation was not posted." });
                }
            }
            db.OrderStatusHistory.Add(new OrderStatusHistory { OrderId = id, Status = order.Status, Note = request.Note, ActorId = ActorId.ToString(), ActorRole = User.FindFirstValue(ClaimTypes.Role) });
            var orderMessage = await notifications.RenderAsync("ORDER_STATUS", "Order status updated", $"Your order {order.OrderNumber} is now {order.Status.Replace('_', ' ').ToLowerInvariant()}.", new Dictionary<string, string?> { ["order_id"] = order.OrderNumber, ["order_status"] = order.Status.Replace('_', ' ').ToLowerInvariant() }, ct);
            var customerStatusNotice = new Notification { CustomerId = order.CustomerId, Type = "order_status", Title = orderMessage.Title, Body = orderMessage.Body };
            db.Notifications.Add(customerStatusNotice);
            var statusRecipients = await db.StaffUsers.Where(x => x.IsActive && (x.Role == StaffRoles.Admin || x.Role == StaffRoles.SuperAdmin || x.Role == StaffRoles.Accountant ||
                order.BranchId.HasValue && x.BranchId == order.BranchId && (x.Role == StaffRoles.Supervisor || x.Role == StaffRoles.Pharmacist) ||
                order.DeliveryAssignment != null && x.Id == order.DeliveryAssignment.DeliveryStaffId || order.PharmacistId.HasValue && x.Id == order.PharmacistId.Value))
                .Select(x => x.Id).ToListAsync(ct);
            var statusNotices = statusRecipients.Select(staffId => new Notification { StaffUserId = staffId, Type = "order_status", Title = "Order status updated", Body = $"Order {order.OrderNumber} is now {order.Status.Replace('_', ' ').ToLowerInvariant()}." }).ToList();
            db.Notifications.AddRange(statusNotices);
            db.ActivityLogs.Add(Activity("ADMIN_CHANGED_ORDER_STATUS", "PharmacyOrder", id.ToString(), previous, order.Status));
            if (nextStatus == OrderStatuses.Cancelled) await messaging.CloseDeliveryConversationAsync(id, ct);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            await notificationHub.Clients.Group(NotificationHub.Group("customer", order.CustomerId)).SendAsync("notification", new { id = customerStatusNotice.Id, type = customerStatusNotice.Type, title = customerStatusNotice.Title, body = customerStatusNotice.Body, isRead = false, createdAt = customerStatusNotice.CreatedAt }, ct);
            foreach (var notice in statusNotices) await notificationHub.Clients.Group(NotificationHub.Group("staff", notice.StaffUserId!.Value)).SendAsync("notification", new { id = notice.Id, type = notice.Type, title = notice.Title, body = notice.Body, isRead = false, createdAt = notice.CreatedAt }, ct);
            return Ok(new AdminOrderRow(order.Id, order.OrderNumber, order.OrderCustomerName ?? order.Customer?.FullName ?? "", order.OrderCustomerPhone ?? order.Customer?.Phone ?? "", order.Branch?.Name, order.Status, order.PaymentStatus, order.Total, order.CreatedAt, order.OrderMode));
        });
    }

    [HttpGet("payments")]
    public async Task<ActionResult<PagedResponse<AdminPaymentRow>>> Payments([FromQuery] string? search, [FromQuery] string? status, [FromQuery] string? method, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.OrdersView)) return Forbid(); page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = ScopeOrders(db.Orders.AsNoTracking()).Include(x => x.Customer).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.OrderNumber.Contains(search) || x.Customer!.FullName.Contains(search) || x.Customer.Email.Contains(search));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.PaymentStatus == status);
        if (!string.IsNullOrWhiteSpace(method)) query = query.Where(x => x.PaymentMethod == method);
        var total = await query.CountAsync(ct); var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<AdminPaymentRow>(rows.Select(x => new AdminPaymentRow(x.Id, x.OrderNumber, x.Customer?.FullName ?? "", x.PaymentMethod, x.PaymentStatus, x.Total, x.CreatedAt)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpPut("payments/{id:guid}/status")]
    public async Task<ActionResult<AdminPaymentRow>> UpdatePaymentStatus(Guid id, UpdatePaymentTransactionRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.OrdersManage)) return Forbid();
        var nextStatus = request.Status.Trim().ToUpperInvariant();
        if (nextStatus is not (PaymentTransactionStatuses.Pending or PaymentTransactionStatuses.Paid or PaymentTransactionStatuses.Failed or PaymentTransactionStatuses.Refunded)) return BadRequest(new { message = "Payment status must be PENDING, PAID, FAILED, or REFUNDED." });
        var order = await ScopeOrders(db.Orders).Include(x => x.Customer).Include(x => x.PaymentTransactions).Include(x => x.DeliveryAssignment).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (order is null) return NotFound();
        var currentStatus = order.PaymentStatus.Trim().ToUpperInvariant();
        if (currentStatus == PaymentTransactionStatuses.Refunded && nextStatus != PaymentTransactionStatuses.Refunded) return Conflict(new { message = "A refunded payment cannot be reopened." });
        if (nextStatus == PaymentTransactionStatuses.Refunded && currentStatus is not (PaymentTransactionStatuses.Paid or "COMPLETED")) return Conflict(new { message = "Only a paid payment can be refunded." });
        if (nextStatus == PaymentTransactionStatuses.Paid && order.PaymentMethod != PaymentMethods.CashOnDelivery && string.IsNullOrWhiteSpace(request.ProviderReference)) return BadRequest(new { message = "A provider reference is required before confirming an online payment." });
        var transaction = order.PaymentTransactions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
        if (transaction is null)
        {
            transaction = new PaymentTransaction { OrderId = order.Id, TransactionNumber = $"ANHH-TXN-{Guid.NewGuid():N}"[..20].ToUpperInvariant(), Method = order.PaymentMethod, Amount = order.Total, Status = currentStatus is "PAID" or "COMPLETED" ? PaymentTransactionStatuses.Paid : PaymentTransactionStatuses.Pending };
            db.PaymentTransactions.Add(transaction);
        }
        var previous = JsonSerializer.Serialize(new { order.PaymentStatus, transaction.Status, transaction.ProviderReference, transaction.Notes });
        transaction.Status = nextStatus;
        transaction.ProviderReference = string.IsNullOrWhiteSpace(request.ProviderReference) ? transaction.ProviderReference : request.ProviderReference.Trim();
        transaction.Notes = string.IsNullOrWhiteSpace(request.Notes) ? transaction.Notes : request.Notes.Trim();
        transaction.PaidAt = nextStatus == PaymentTransactionStatuses.Paid ? transaction.PaidAt ?? DateTime.UtcNow : transaction.PaidAt;
        transaction.RefundedAt = nextStatus == PaymentTransactionStatuses.Refunded ? transaction.RefundedAt ?? DateTime.UtcNow : transaction.RefundedAt;
        transaction.UpdatedAt = DateTime.UtcNow;
        order.PaymentStatus = nextStatus;
        order.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity(nextStatus == PaymentTransactionStatuses.Refunded ? "PAYMENT_REFUNDED" : "PAYMENT_STATUS_UPDATED", "PaymentTransaction", transaction.Id.ToString(), previous, JsonSerializer.Serialize(new { order.PaymentStatus, transaction.Status, transaction.ProviderReference, transaction.Notes })));
        var paymentMessage = await notifications.RenderAsync("PAYMENT_UPDATE", nextStatus == PaymentTransactionStatuses.Refunded ? "Payment refunded" : "Payment status updated", $"Payment for order {order.OrderNumber} is now {nextStatus.Replace('_', ' ').ToLowerInvariant()}.", new Dictionary<string, string?> { ["order_id"] = order.OrderNumber, ["payment_status"] = nextStatus.Replace('_', ' ').ToLowerInvariant() }, ct);
        var customerPaymentNotice = new Notification { CustomerId = order.CustomerId, Type = "payment_status", Title = paymentMessage.Title, Body = paymentMessage.Body };
        db.Notifications.Add(customerPaymentNotice);
        var paymentRecipients = await db.StaffUsers.Where(x => x.IsActive && (x.Role == StaffRoles.Admin || x.Role == StaffRoles.SuperAdmin || x.Role == StaffRoles.Accountant ||
            order.BranchId.HasValue && x.BranchId == order.BranchId && (x.Role == StaffRoles.Supervisor || x.Role == StaffRoles.Pharmacist) ||
            order.DeliveryAssignment != null && x.Id == order.DeliveryAssignment.DeliveryStaffId || order.PharmacistId.HasValue && x.Id == order.PharmacistId.Value))
            .Select(x => x.Id).ToListAsync(ct);
        var paymentNotices = paymentRecipients.Select(staffId => new Notification { StaffUserId = staffId, Type = "payment_status", Title = "Order payment updated", Body = $"Payment for order {order.OrderNumber} is now {nextStatus.Replace('_', ' ').ToLowerInvariant()}." }).ToList();
        db.Notifications.AddRange(paymentNotices);
        await db.SaveChangesAsync(ct);
        await notificationHub.Clients.Group(NotificationHub.Group("customer", order.CustomerId)).SendAsync("notification", new { id = customerPaymentNotice.Id, type = customerPaymentNotice.Type, title = customerPaymentNotice.Title, body = customerPaymentNotice.Body, isRead = false, createdAt = customerPaymentNotice.CreatedAt }, ct);
        foreach (var notice in paymentNotices) await notificationHub.Clients.Group(NotificationHub.Group("staff", notice.StaffUserId!.Value)).SendAsync("notification", new { id = notice.Id, type = notice.Type, title = notice.Title, body = notice.Body, isRead = false, createdAt = notice.CreatedAt }, ct);
        return Ok(new AdminPaymentRow(order.Id, order.OrderNumber, order.Customer?.FullName ?? "", order.PaymentMethod, order.PaymentStatus, order.Total, order.CreatedAt));
    }

    [HttpGet("payment-methods")]
    public async Task<ActionResult<IReadOnlyList<AdminPaymentMethodRow>>> PaymentMethodConfigurations(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var rows = await db.PaymentMethodConfigurations.AsNoTracking().OrderBy(x => x.DisplayOrder).ThenBy(x => x.DisplayName).ToListAsync(ct);
        return Ok(rows.Select(x => new AdminPaymentMethodRow(x.Id, x.Code, x.DisplayName, x.Instructions, x.MinimumOrder, x.MaximumOrder, x.DisplayOrder, x.IsEnabled, x.RequiresServerVerification, x.QrCodeUrl)).ToList());
    }

    [HttpPut("payment-methods/{code}")]
    public async Task<ActionResult<AdminPaymentMethodRow>> UpdatePaymentMethod(string code, UpsertPaymentMethodRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var normalized = code.Trim().ToUpperInvariant();
        if (!PaymentMethods.Supported.Contains(normalized, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "The selected payment method is not supported." });
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 120) return BadRequest(new { message = "A payment method display name is required and must be at most 120 characters." });
        if (request.MinimumOrder < 0 || request.MaximumOrder < 0 || request.MinimumOrder.HasValue && request.MaximumOrder.HasValue && request.MinimumOrder > request.MaximumOrder) return BadRequest(new { message = "Payment order limits are invalid." });
        if (!string.IsNullOrWhiteSpace(request.QrCodeUrl) && !IsSafePublicMediaUrl(request.QrCodeUrl.Trim())) return BadRequest(new { message = "QR code URL must be a local site path or HTTPS URL." });
        var item = await db.PaymentMethodConfigurations.SingleOrDefaultAsync(x => x.Code == normalized, ct);
        if (item is null) return NotFound();
        var previous = JsonSerializer.Serialize(new { item.DisplayName, item.IsEnabled, item.MinimumOrder, item.MaximumOrder });
        item.Code = normalized;
        item.DisplayName = request.DisplayName.Trim();
        item.Instructions = request.Instructions?.Trim();
        item.QrCodeUrl = CleanOptional(request.QrCodeUrl);
        item.MinimumOrder = request.MinimumOrder;
        item.MaximumOrder = request.MaximumOrder;
        item.DisplayOrder = Math.Max(0, request.DisplayOrder);
        item.IsEnabled = request.IsEnabled;
        item.RequiresServerVerification = request.RequiresServerVerification;
        item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("PAYMENT_METHOD_UPDATED", "PaymentMethodConfiguration", item.Id.ToString(), previous, JsonSerializer.Serialize(new { item.DisplayName, item.IsEnabled, item.MinimumOrder, item.MaximumOrder })));
        await db.SaveChangesAsync(ct);
        return Ok(new AdminPaymentMethodRow(item.Id, item.Code, item.DisplayName, item.Instructions, item.MinimumOrder, item.MaximumOrder, item.DisplayOrder, item.IsEnabled, item.RequiresServerVerification, item.QrCodeUrl));
    }

    [HttpGet("price-visibility")]
    public async Task<ActionResult<PriceVisibilitySettings>> GetPriceVisibility(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        return Ok(await OrderPolicyReader.ReadPricesAsync(db, ct));
    }

    [HttpPut("price-visibility")]
    public async Task<ActionResult<PriceVisibilitySettings>> SavePriceVisibility(PriceVisibilitySettings request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (request.RoleOverrides?.Count > 20 || request.CustomerOverrides?.Count > 2000) return BadRequest(new { message = "Too many price-visibility overrides." });
        var roles = new HashSet<string>(["ANONYMOUS", "CUSTOMER", "PERSONAL", "PHARMACY"], StringComparer.OrdinalIgnoreCase);
        if (request.RoleOverrides?.Keys.Any(key => !roles.Contains(key)) == true) return BadRequest(new { message = "An unknown customer price-visibility role was supplied." });
        if (request.CustomerOverrides?.Keys.Any(key => !Guid.TryParse(key, out _)) == true) return BadRequest(new { message = "Customer overrides must use valid customer IDs." });
        var normalized = request with
        {
            RoleOverrides = request.RoleOverrides?.ToDictionary(x => x.Key.Trim().ToUpperInvariant(), x => x.Value, StringComparer.OrdinalIgnoreCase),
            CustomerOverrides = request.CustomerOverrides?.ToDictionary(x => Guid.Parse(x.Key).ToString("D"), x => x.Value, StringComparer.OrdinalIgnoreCase)
        };
        await SaveCommerceSetting("orders.price-visibility", JsonSerializer.Serialize(normalized), "Control product price visibility globally, by customer account role, or customer.", ct);
        return Ok(normalized);
    }

    [HttpGet("delivery-rules")]
    public async Task<ActionResult<DeliveryRulesSettings>> GetDeliveryRules(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        return Ok(await OrderPolicyReader.ReadDeliveryAsync(db, ct));
    }

    [HttpPut("delivery-rules")]
    public async Task<ActionResult<DeliveryRulesSettings>> SaveDeliveryRules(DeliveryRulesSettings request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (request.GeofenceRadiusMeters is < 25 or > 5000) return BadRequest(new { message = "Delivery geofence radius must be between 25 and 5,000 meters." });
        var allowed = new HashSet<string>(["INVOICE", "CHEQUE", "PAYMENT_PROOF", "DELIVERY_PROOF"], StringComparer.OrdinalIgnoreCase);
        var required = (request.RequiredDocumentTypes ?? ["DELIVERY_PROOF"]).Select(x => x.Trim().ToUpperInvariant()).Distinct().ToArray();
        if (required.Length > 4 || required.Any(x => !allowed.Contains(x))) return BadRequest(new { message = "Choose valid required delivery document types." });
        var normalized = request with { RequiredDocumentTypes = required };
        await SaveCommerceSetting("orders.delivery-rules", JsonSerializer.Serialize(normalized), "Delivery geofence and required handoff document controls.", ct);
        return Ok(normalized);
    }

    private async Task SaveCommerceSetting(string key, string value, string description, CancellationToken ct)
    {
        var setting = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == key, ct);
        var previous = setting?.Value;
        if (setting is null) db.SystemSettings.Add(new SystemSetting { Key = key, Value = value, Group = "orders", IsPublic = false, Description = description });
        else { setting.Value = value; setting.Group = "orders"; setting.IsPublic = false; setting.Description = description; setting.UpdatedAt = DateTime.UtcNow; }
        db.ActivityLogs.Add(Activity("COMMERCE_SETTING_UPDATED", "SystemSetting", key, previous, value));
        await db.SaveChangesAsync(ct);
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<PagedResponse<AdminNotificationRow>>> Notifications([FromQuery] string? search, [FromQuery] bool? unread, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.NotificationsView)) return Forbid(); page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Notifications.AsNoTracking().Include(x => x.Customer).Include(x => x.StaffUser).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Title.Contains(search) || x.Body.Contains(search) || x.Type.Contains(search));
        if (unread == true) query = query.Where(x => x.ReadAt == null);
        var total = await query.CountAsync(ct); var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<AdminNotificationRow>(rows.Select(x => new AdminNotificationRow(x.Id, x.CustomerId, x.StaffUserId, x.Customer?.FullName ?? x.StaffUser?.FullName ?? "System", x.Type, x.Title, x.Body, x.ReadAt != null, x.CreatedAt)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("notification-templates")]
    public async Task<ActionResult<IReadOnlyList<AdminNotificationTemplateRow>>> NotificationTemplates(CancellationToken ct)
    {
        if (!Can(AppPermissions.NotificationsManage)) return Forbid();
        return Ok(await db.NotificationTemplates.AsNoTracking().OrderBy(x => x.Name).Select(x => new AdminNotificationTemplateRow(x.Id, x.Code, x.Name, x.Channel, x.Subject, x.Body, x.Variables, x.IsEnabled, x.UpdatedAt)).ToListAsync(ct));
    }

    [HttpPost("notification-templates")]
    public async Task<ActionResult<AdminNotificationTemplateRow>> CreateNotificationTemplate(UpsertNotificationTemplateRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.NotificationsManage)) return Forbid();
        var validation = ValidateTemplate(request); if (validation is not null) return BadRequest(new { message = validation });
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.NotificationTemplates.AnyAsync(x => x.Code == code, ct)) return Conflict(new { message = "A notification template with this code already exists." });
        var template = new NotificationTemplate { Code = code, Name = request.Name.Trim(), Channel = request.Channel.Trim().ToUpperInvariant(), Subject = string.IsNullOrWhiteSpace(request.Subject) ? null : request.Subject.Trim(), Body = request.Body.Trim(), Variables = string.IsNullOrWhiteSpace(request.Variables) ? null : request.Variables.Trim(), IsEnabled = request.IsEnabled };
        db.NotificationTemplates.Add(template); db.ActivityLogs.Add(Activity("NOTIFICATION_TEMPLATE_CREATED", "NotificationTemplate", template.Id.ToString(), null, template.Code)); await db.SaveChangesAsync(ct);
        return Ok(TemplateRow(template));
    }

    [HttpPut("notification-templates/{id:guid}")]
    public async Task<ActionResult<AdminNotificationTemplateRow>> UpdateNotificationTemplate(Guid id, UpsertNotificationTemplateRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.NotificationsManage)) return Forbid();
        var validation = ValidateTemplate(request); if (validation is not null) return BadRequest(new { message = validation });
        var template = await db.NotificationTemplates.SingleOrDefaultAsync(x => x.Id == id, ct); if (template is null) return NotFound();
        var code = request.Code.Trim().ToUpperInvariant(); if (await db.NotificationTemplates.AnyAsync(x => x.Id != id && x.Code == code, ct)) return Conflict(new { message = "A notification template with this code already exists." });
        var previous = JsonSerializer.Serialize(new { template.Code, template.Channel, template.IsEnabled }); template.Code = code; template.Name = request.Name.Trim(); template.Channel = request.Channel.Trim().ToUpperInvariant(); template.Subject = string.IsNullOrWhiteSpace(request.Subject) ? null : request.Subject.Trim(); template.Body = request.Body.Trim(); template.Variables = string.IsNullOrWhiteSpace(request.Variables) ? null : request.Variables.Trim(); template.IsEnabled = request.IsEnabled; template.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("NOTIFICATION_TEMPLATE_UPDATED", "NotificationTemplate", id.ToString(), previous, JsonSerializer.Serialize(new { template.Code, template.Channel, template.IsEnabled }))); await db.SaveChangesAsync(ct);
        return Ok(TemplateRow(template));
    }

    [HttpGet("prescriptions")]
    public async Task<ActionResult<PagedResponse<AdminPrescriptionRow>>> Prescriptions([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken ct = default) { if (!Can(AppPermissions.PrescriptionsView)) return Forbid(); var query = ScopePrescriptions(db.Prescriptions.AsNoTracking()).Include(x => x.Customer).Include(x => x.ExtractedItems).Include(x => x.Reviews).AsQueryable(); if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status); var total = await query.CountAsync(ct); var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct); return Ok(new PagedResponse<AdminPrescriptionRow>(rows.Select(x => new AdminPrescriptionRow(x.Id, Number(x.Id), x.Customer?.FullName ?? "", x.Status, x.ExtractedItems.Count, x.Reviews.OrderByDescending(r => r.CreatedAt).FirstOrDefault()?.ReviewerId, x.ExtractedItems.SelectMany(i => i.Matches).Select(m => m.Confidence).DefaultIfEmpty(0).Average(), x.CreatedAt)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize))); }

    [HttpGet("prescriptions/{id:guid}")]
    public async Task<ActionResult<StaffPrescriptionResponse>> Prescription(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.PrescriptionsView)) return Forbid();
        var prescription = await LoadAdminPrescription(id, ct);
        return prescription is null ? NotFound() : Ok(ToStaffPrescription(prescription));
    }

    [HttpGet("prescriptions/{id:guid}/file")]
    public async Task<IActionResult> PrescriptionFile(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.PrescriptionsView)) return Forbid();
        var prescription = await ScopePrescriptions(db.Prescriptions.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (prescription is null) return NotFound();
        var stream = await files.OpenReadAsync(prescription.StoredFileName, ct);
        return stream is null ? NotFound() : File(stream, prescription.ContentType, prescription.OriginalFileName, enableRangeProcessing: true);
    }

    [HttpPost("prescriptions/{id:guid}/override")]
    public async Task<ActionResult<StaffPrescriptionResponse>> OverridePrescription(Guid id, PrescriptionOverrideRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.PrescriptionsOverride)) return Forbid();
        var nextStatus = request.Status.Trim();
        if (nextStatus is not (PrescriptionStatuses.Approved or PrescriptionStatuses.PartiallyApproved or PrescriptionStatuses.NeedClarification or PrescriptionStatuses.Rejected)) return BadRequest(new { message = "The override status is invalid." });
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 5) return BadRequest(new { message = "A reason of at least five characters is required for an override." });
        var prescription = await ScopePrescriptions(db.Prescriptions).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (prescription is null) return NotFound();
        var previousStatus = prescription.Status;
        prescription.Status = nextStatus;
        prescription.UpdatedAt = DateTime.UtcNow;
        var reason = request.Reason.Trim();
        db.PrescriptionReviews.Add(new PrescriptionReview { PrescriptionId = id, Status = nextStatus, Notes = $"SuperAdmin override: {reason}", ReviewerId = ActorId.ToString(), ReviewedAt = DateTime.UtcNow });
        db.PrescriptionStatusHistory.Add(new PrescriptionStatusHistory { PrescriptionId = id, Status = nextStatus, Note = $"Override: {reason}", ActorId = ActorId.ToString(), ActorRole = User.FindFirstValue(ClaimTypes.Role) });
        db.ActivityLogs.Add(Activity("PRESCRIPTION_OVERRIDDEN", "Prescription", id.ToString(), previousStatus, JsonSerializer.Serialize(new { Status = nextStatus, Reason = reason })));
        db.Notifications.Add(new Notification { CustomerId = prescription.CustomerId, Type = "prescription_override", Title = "Prescription status updated", Body = $"Your prescription status is now {nextStatus}." });
        await db.SaveChangesAsync(ct);
        var loaded = await LoadAdminPrescription(id, ct);
        return Ok(ToStaffPrescription(loaded!));
    }

    [HttpGet("reviews")]
    public async Task<ActionResult<PagedResponse<AdminReviewRow>>> Reviews([FromQuery] string? status, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.ReviewsManage)) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.ProductReviews.AsNoTracking().Include(x => x.Product).Include(x => x.Customer).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Comment.Contains(search) || (x.Title != null && x.Title.Contains(search)) || x.Customer!.FullName.Contains(search) || x.Product!.Name.Contains(search));
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<AdminReviewRow>(rows.Select(x => new AdminReviewRow(x.Id, x.ProductId, x.Product?.Name ?? "", x.Customer?.FullName ?? "", x.Customer?.Email ?? "", x.OrderId, x.Rating, x.Title, x.Comment, x.Status, x.AdminResponse, x.CreatedAt, x.PublishedAt)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpPut("reviews/{id:guid}")]
    public async Task<ActionResult<AdminReviewRow>> UpdateReview(Guid id, UpdateReviewRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.ReviewsManage)) return Forbid();
        var status = request.Status.Trim().ToUpperInvariant();
        if (status is not (ReviewStatuses.Pending or ReviewStatuses.Published or ReviewStatuses.Rejected or ReviewStatuses.Hidden)) return BadRequest(new { message = "Review status is invalid." });
        var review = await db.ProductReviews.Include(x => x.Product).Include(x => x.Customer).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (review is null) return NotFound();
        var previous = JsonSerializer.Serialize(new { review.Status, review.AdminResponse });
        review.Status = status; review.AdminResponse = string.IsNullOrWhiteSpace(request.AdminResponse) ? null : request.AdminResponse.Trim(); review.PublishedAt = status == ReviewStatuses.Published ? review.PublishedAt ?? DateTime.UtcNow : null; review.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("REVIEW_MODERATED", "ProductReview", id.ToString(), previous, JsonSerializer.Serialize(new { review.Status, review.AdminResponse })));
        await db.SaveChangesAsync(ct);
        return Ok(new AdminReviewRow(review.Id, review.ProductId, review.Product?.Name ?? "", review.Customer?.FullName ?? "", review.Customer?.Email ?? "", review.OrderId, review.Rating, review.Title, review.Comment, review.Status, review.AdminResponse, review.CreatedAt, review.PublishedAt));
    }

    [HttpGet("support-tickets")]
    public async Task<ActionResult<PagedResponse<AdminSupportTicketRow>>> SupportTickets([FromQuery] string? status, [FromQuery] string? priority, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.SupportManage)) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.SupportTickets.AsNoTracking().Include(x => x.Customer).Include(x => x.AssignedStaff).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(priority)) query = query.Where(x => x.Priority == priority.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.TicketNumber.Contains(search) || x.Subject.Contains(search) || x.Customer!.FullName.Contains(search) || x.Customer.Email.Contains(search));
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<AdminSupportTicketRow>(rows.Select(TicketRow).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpPut("support-tickets/{id:guid}")]
    public async Task<ActionResult<AdminSupportTicketRow>> UpdateSupportTicket(Guid id, UpdateSupportTicketRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.SupportManage)) return Forbid();
        var status = request.Status.Trim().ToUpperInvariant(); var priority = request.Priority.Trim().ToUpperInvariant();
        if (status is not (SupportTicketStatuses.Open or SupportTicketStatuses.InProgress or SupportTicketStatuses.WaitingOnCustomer or SupportTicketStatuses.Resolved or SupportTicketStatuses.Closed)) return BadRequest(new { message = "Ticket status is invalid." });
        if (priority is not (SupportTicketPriorities.Low or SupportTicketPriorities.Medium or SupportTicketPriorities.High or SupportTicketPriorities.Urgent)) return BadRequest(new { message = "Ticket priority is invalid." });
        var ticket = await db.SupportTickets.Include(x => x.Customer).Include(x => x.AssignedStaff).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (ticket is null) return NotFound();
        if (request.AssignedStaffId.HasValue && !await db.StaffUsers.AnyAsync(x => x.Id == request.AssignedStaffId && x.IsActive, ct)) return BadRequest(new { message = "Assigned staff member was not found or is inactive." });
        var previous = JsonSerializer.Serialize(new { ticket.Status, ticket.Priority, ticket.Resolution, ticket.AssignedStaffId });
        ticket.Status = status; ticket.Priority = priority; ticket.Resolution = string.IsNullOrWhiteSpace(request.Resolution) ? null : request.Resolution.Trim(); ticket.AssignedStaffId = request.AssignedStaffId; ticket.ResolvedAt = status is SupportTicketStatuses.Resolved or SupportTicketStatuses.Closed ? ticket.ResolvedAt ?? DateTime.UtcNow : null; ticket.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("SUPPORT_TICKET_UPDATED", "SupportTicket", id.ToString(), previous, JsonSerializer.Serialize(new { ticket.Status, ticket.Priority, ticket.Resolution, ticket.AssignedStaffId })));
        db.Notifications.Add(new Notification { CustomerId = ticket.CustomerId, Type = "support_ticket", Title = $"Support ticket {ticket.TicketNumber} updated", Body = $"Your ticket is now {ticket.Status.Replace('_', ' ')}." });
        await db.SaveChangesAsync(ct);
        return Ok(TicketRow(ticket));
    }

    [HttpGet("support-tickets/{id:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<AdminSupportTicketMessageRow>>> SupportTicketMessages(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.SupportManage)) return Forbid();
        if (!await db.SupportTickets.AnyAsync(x => x.Id == id, ct)) return NotFound();
        var messages = await db.SupportTicketMessages.AsNoTracking().Include(x => x.StaffUser).Include(x => x.Customer).Where(x => x.SupportTicketId == id).OrderBy(x => x.CreatedAt).ToListAsync(ct);
        return Ok(messages.Select(x => new AdminSupportTicketMessageRow(x.Id, x.SupportTicketId, x.Message, x.IsInternal, x.StaffUser?.FullName ?? x.Customer?.FullName, x.IsInternal ? "INTERNAL" : x.StaffUserId.HasValue ? "STAFF" : "CUSTOMER", x.CreatedAt)).ToList());
    }

    [HttpPost("support-tickets/{id:guid}/messages")]
    public async Task<ActionResult<AdminSupportTicketMessageRow>> AddSupportTicketMessage(Guid id, CreateSupportTicketMessageRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.SupportManage)) return Forbid();
        if (!User.TryGetStaffId(out var staffId)) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Trim().Length < 2 || request.Message.Trim().Length > 4000) return BadRequest(new { message = "A message between 2 and 4,000 characters is required." });
        var ticket = await db.SupportTickets.Include(x => x.Customer).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (ticket is null) return NotFound();
        var message = new SupportTicketMessage { SupportTicketId = id, StaffUserId = staffId, Message = request.Message.Trim(), IsInternal = request.IsInternal };
        db.SupportTicketMessages.Add(message);
        if (!request.IsInternal && ticket.Status == SupportTicketStatuses.Open) ticket.Status = SupportTicketStatuses.InProgress;
        ticket.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity(request.IsInternal ? "SUPPORT_INTERNAL_NOTE_ADDED" : "SUPPORT_TICKET_REPLIED", "SupportTicket", id.ToString(), null, message.Message));
        if (!request.IsInternal) db.Notifications.Add(new Notification { CustomerId = ticket.CustomerId, Type = "support_ticket", Title = $"Reply on support ticket {ticket.TicketNumber}", Body = message.Message.Length > 240 ? $"{message.Message[..240]}…" : message.Message });
        await db.SaveChangesAsync(ct);
        return Ok(new AdminSupportTicketMessageRow(message.Id, id, message.Message, message.IsInternal, User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email), request.IsInternal ? "INTERNAL" : "STAFF", message.CreatedAt));
    }

    [HttpGet("permissions")]
    public async Task<ActionResult<IReadOnlyList<AdminPermissionRow>>> Permissions(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var permissions = await db.AccessPermissions.AsNoTracking().OrderBy(x => x.Group).ThenBy(x => x.Key).ToListAsync(ct);
        return Ok(permissions.Select(x => new AdminPermissionRow(x.Id, x.Key, x.Description, x.Group, x.IsSystem)).ToList());
    }

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<AdminRoleRow>>> Roles(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var roles = await db.AccessRoles.AsNoTracking().Include(x => x.RolePermissions).ThenInclude(x => x.Permission).OrderBy(x => x.Name).ToListAsync(ct);
        return Ok(roles.Select(RoleRow).ToList());
    }

    [HttpPost("roles")]
    public async Task<ActionResult<AdminRoleRow>> CreateRole(UpsertRoleRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var validation = ValidateRole(request); if (validation is not null) return BadRequest(new { message = validation });
        var name = request.Name.Trim().ToUpperInvariant();
        if (await db.AccessRoles.AnyAsync(x => x.Name == name, ct)) return Conflict(new { message = "A role with this name already exists." });
        var permissionKeys = request.Permissions.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var permissionSet = new HashSet<string>(permissionKeys, StringComparer.OrdinalIgnoreCase);
        var permissions = (await db.AccessPermissions.AsNoTracking().ToListAsync(ct)).Where(x => permissionSet.Contains(x.Key)).ToList();
        if (permissions.Count != permissionKeys.Length) return BadRequest(new { message = "One or more selected permissions are invalid." });
        var role = new AccessRole { Name = name, DisplayName = request.DisplayName.Trim(), Description = request.Description?.Trim(), IsActive = request.IsActive, IsSystem = false };
        role.RolePermissions = permissions.Select(permission => new AccessRolePermission { Role = role, PermissionId = permission.Id }).ToList();
        db.AccessRoles.Add(role); db.ActivityLogs.Add(Activity("ROLE_CREATED", "AccessRole", role.Id.ToString(), null, role.Name));
        await db.SaveChangesAsync(ct);
        return Ok(RoleRow(await db.AccessRoles.AsNoTracking().Include(x => x.RolePermissions).ThenInclude(x => x.Permission).SingleAsync(x => x.Id == role.Id, ct)));
    }

    [HttpPut("roles/{id:guid}")]
    public async Task<ActionResult<AdminRoleRow>> UpdateRole(Guid id, UpsertRoleRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var role = await db.AccessRoles.Include(x => x.RolePermissions).ThenInclude(x => x.Permission).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (role is null) return NotFound();
        var validation = ValidateRole(request); if (validation is not null) return BadRequest(new { message = validation });
        var name = request.Name.Trim().ToUpperInvariant();
        if (role.IsSystem && !name.Equals(role.Name, StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "System role names cannot be changed." });
        if (await db.AccessRoles.AnyAsync(x => x.Id != id && x.Name == name, ct)) return Conflict(new { message = "A role with this name already exists." });
        var permissionKeys = request.Permissions.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var permissionSet = new HashSet<string>(permissionKeys, StringComparer.OrdinalIgnoreCase);
        var permissions = (await db.AccessPermissions.AsNoTracking().ToListAsync(ct)).Where(x => permissionSet.Contains(x.Key)).ToList();
        if (permissions.Count != permissionKeys.Length) return BadRequest(new { message = "One or more selected permissions are invalid." });
        var previousName = role.Name;
        var previous = JsonSerializer.Serialize(new { role.Name, role.DisplayName, role.IsActive, Permissions = role.RolePermissions.Select(x => x.Permission?.Key).ToArray() });
        role.Name = name; role.DisplayName = request.DisplayName.Trim(); role.Description = request.Description?.Trim(); role.IsActive = request.IsActive; role.UpdatedAt = DateTime.UtcNow;
        var existingLinks = await db.AccessRolePermissions.Where(x => x.RoleId == role.Id).ToListAsync(ct);
        db.AccessRolePermissions.RemoveRange(existingLinks);
        foreach (var permission in permissions) db.AccessRolePermissions.Add(new AccessRolePermission { RoleId = role.Id, PermissionId = permission.Id });
        var assignedStaff = await db.StaffUsers.Where(x => x.Role == previousName).ToListAsync(ct);
        foreach (var staff in assignedStaff) { staff.PermissionsCsv = permissionKeys.Length == 0 ? "__none__" : string.Join(',', permissionKeys); staff.UpdatedAt = DateTime.UtcNow; }
        db.ActivityLogs.Add(Activity("ROLE_UPDATED", "AccessRole", role.Id.ToString(), previous, JsonSerializer.Serialize(new { role.Name, role.DisplayName, role.IsActive, Permissions = permissionKeys })));
        await db.SaveChangesAsync(ct);
        return Ok(RoleRow(await db.AccessRoles.AsNoTracking().Include(x => x.RolePermissions).ThenInclude(x => x.Permission).SingleAsync(x => x.Id == id, ct)));
    }

    [HttpGet("settings")]
    public async Task<ActionResult<IReadOnlyList<SystemSetting>>> Settings(CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var query = db.SystemSettings.AsNoTracking();
        if (!SuperAdminPath)
            query = query.Where(x => x.Key == "website.design" || x.Key == "website.marquee" || x.Key == "website.contactWidget" || x.Key == "website.logoUrl");
        var settings = await query.OrderBy(x => x.Group).ThenBy(x => x.Key).ToListAsync(ct);
        return Ok(settings.Select(x => IntegrationSettingKeys.IsSecret(x.Key) ? new SystemSetting { Id = x.Id, Key = x.Key, Value = string.IsNullOrWhiteSpace(x.Value) ? "" : "[configured]", Group = x.Group, IsPublic = false, Description = x.Description, CreatedAt = x.CreatedAt, UpdatedAt = x.UpdatedAt } : x).ToList());
    }
    [HttpPut("settings/{key}")]
    public async Task<ActionResult<SystemSetting>> SaveSetting(string key, UpsertSettingRequest r, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        if (!SuperAdminPath && key is not ("website.design" or "website.marquee" or "website.contactWidget" or "website.logoUrl")) return Forbid();
        if (key.StartsWith(IntegrationSettingKeys.Prefix, StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Use the protected integrations settings endpoint for provider configuration." });
        if (key.Equals("system.tablePageSize", StringComparison.OrdinalIgnoreCase) && (!int.TryParse(r.Value, out var tablePageSize) || tablePageSize is < 1 or > 100)) return BadRequest(new { message = "Table row count must be a whole number between 1 and 100." });
        if (key.Equals("system.timeFormat", StringComparison.OrdinalIgnoreCase) && r.Value.Trim() is not ("12" or "24")) return BadRequest(new { message = "Time format must be 12-hour or 24-hour." });
        if (key.Equals("system.timezone", StringComparison.OrdinalIgnoreCase))
        {
            var timeZone = r.Value.Trim();
            try { _ = TimeZoneInfo.FindSystemTimeZoneById(timeZone); }
            catch (TimeZoneNotFoundException) { return BadRequest(new { message = "Choose a valid IANA timezone." }); }
            catch (InvalidTimeZoneException) { return BadRequest(new { message = "Choose a valid IANA timezone." }); }
        }
        if (key.Equals("notification.toast.position", StringComparison.OrdinalIgnoreCase) && !new[] { "top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right" }.Contains(r.Value.Trim(), StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "Choose a valid toast position." });
        if (key.Equals("notification.toast.duration", StringComparison.OrdinalIgnoreCase) && (!int.TryParse(r.Value, out var toastDuration) || toastDuration is < 1500 or > 10000)) return BadRequest(new { message = "Toast duration must be between 1,500 and 10,000 milliseconds." });
        if (key.Equals("website.logoUrl", StringComparison.OrdinalIgnoreCase) && (r.Value.Length > 2000 || (r.Value.Length > 0 && !(r.Value.StartsWith("/", StringComparison.Ordinal) && !r.Value.StartsWith("//", StringComparison.Ordinal)) && !(Uri.TryCreate(r.Value, UriKind.Absolute, out var logoUri) && logoUri.Scheme == Uri.UriSchemeHttps)))) return BadRequest(new { message = "Logo URL must be a local site path or a secure HTTPS URL, up to 2,000 characters." });
        if (key.StartsWith("notification.toast.", StringComparison.OrdinalIgnoreCase) && !key.Equals("notification.toast.position", StringComparison.OrdinalIgnoreCase) && !key.Equals("notification.toast.duration", StringComparison.OrdinalIgnoreCase) && r.Value.Trim().Length > 160) return BadRequest(new { message = "Toast message must be at most 160 characters." });
        if (key.Equals("website.design", StringComparison.OrdinalIgnoreCase) || key.Equals("website.marquee", StringComparison.OrdinalIgnoreCase))
        {
            var validation = ValidatePublicDesignSetting(key, r.Value);
            if (validation is not null) return BadRequest(new { message = validation });
        }
        var item = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == key, ct);
        var previous = item?.Value;
        if (item is null) { item = new SystemSetting { Key = key.Trim(), Value = r.Value, Group = r.Group, IsPublic = r.IsPublic, Description = r.Description }; db.SystemSettings.Add(item); }
        else { item.Value = r.Value; item.Group = r.Group; item.IsPublic = r.IsPublic; item.Description = r.Description; item.UpdatedAt = DateTime.UtcNow; }
        db.ActivityLogs.Add(Activity("SETTINGS_CHANGED", "SystemSetting", key, previous, r.Value));
        await db.SaveChangesAsync(ct);
        if (key.Equals("system.timezone", StringComparison.OrdinalIgnoreCase)) ApplicationTime.ConfigureTimeZone(r.Value.Trim());
        return Ok(item);
    }

    [HttpGet("theme/sidebar")]
    public async Task<ActionResult<SidebarThemeSettings>> GetSidebarTheme([FromQuery] string? role, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.SuperAdmin, StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.Accountant, StaffRoles.SalesExecutive, StaffRoles.SalesManager, StaffRoles.PurchaseInventoryManager, StaffRoles.HrManager, StaffRoles.ViewerAuditor, StaffRoles.Employee)) return Forbid();
        var currentRole = User.FindFirstValue(ClaimTypes.Role)?.ToUpperInvariant();
        var requestedRole = string.IsNullOrWhiteSpace(role) ? currentRole : role.Trim().ToUpperInvariant();
        if (requestedRole is null || !KnownSidebarRoles.Contains(requestedRole, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "The selected sidebar role is invalid." });
        if (!IsSuperAdmin && !string.Equals(currentRole, requestedRole, StringComparison.OrdinalIgnoreCase)) return Forbid();
        return Ok(await LoadSidebarTheme(ct, requestedRole));
    }

    [HttpGet("sidebar-config")]
    public async Task<ActionResult<IReadOnlyList<AdminRoleSidebarMenuItem>>> GetSidebarConfig([FromQuery] string? role, CancellationToken ct)
    {
        var currentRole = User.FindFirstValue(ClaimTypes.Role)?.ToUpperInvariant();
        var requestedRole = string.IsNullOrWhiteSpace(role) ? currentRole : role.Trim().ToUpperInvariant();
        if (requestedRole is null || !KnownSidebarRoles.Contains(requestedRole, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "The selected sidebar role is invalid." });
        if (!IsSuperAdmin && !string.Equals(currentRole, requestedRole, StringComparison.OrdinalIgnoreCase)) return Forbid();
        var rows = await db.RoleSidebarMenuItems.AsNoTracking().Where(x => x.Role == requestedRole).OrderBy(x => x.DisplayOrder).ThenBy(x => x.Label).ToListAsync(ct);
        return Ok(rows.Select(ToRoleSidebarMenuItem).ToList());
    }

    [HttpPut("sidebar-config/{role}")]
    public async Task<ActionResult<IReadOnlyList<AdminRoleSidebarMenuItem>>> SaveSidebarConfig(string role, UpsertRoleSidebarMenuRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var normalizedRole = role.Trim().ToUpperInvariant();
        if (!KnownSidebarRoles.Contains(normalizedRole, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "The selected sidebar role is invalid." });
        if (request.Items is null || request.Items.Count > 80) return BadRequest(new { message = "A sidebar can contain at most 80 menu items." });
        var seenOrders = new HashSet<int>();
        foreach (var input in request.Items)
        {
            if (string.IsNullOrWhiteSpace(input.Label) || input.Label.Trim().Length > 120) return BadRequest(new { message = "Each menu label must contain 1 to 120 characters." });
            if (input.DisplayOrder < 0 || !seenOrders.Add(input.DisplayOrder)) return BadRequest(new { message = "Sidebar positions must be unique non-negative numbers." });
            if (!SafeSidebarHref(input.Href)) return BadRequest(new { message = "Sidebar links must be local application paths." });
            if (!AllowedSidebarIcons.Contains(input.Icon.Trim(), StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "Choose an icon from the supported icon library." });
        }
        var existing = await db.RoleSidebarMenuItems.Where(x => x.Role == normalizedRole).ToListAsync(ct);
        db.RoleSidebarMenuItems.RemoveRange(existing);
        db.RoleSidebarMenuItems.AddRange(request.Items.Select(input => new RoleSidebarMenuItem { Role = normalizedRole, Label = input.Label.Trim(), Href = input.Href.Trim(), Icon = input.Icon.Trim().ToUpperInvariant(), DisplayOrder = input.DisplayOrder, IsVisible = input.IsVisible }));
        db.ActivityLogs.Add(Activity("ROLE_SIDEBAR_UPDATED", "RoleSidebarMenu", normalizedRole, JsonSerializer.Serialize(existing.Select(ToRoleSidebarMenuItem)), JsonSerializer.Serialize(request.Items)));
        await db.SaveChangesAsync(ct);
        return Ok(await db.RoleSidebarMenuItems.AsNoTracking().Where(x => x.Role == normalizedRole).OrderBy(x => x.DisplayOrder).ThenBy(x => x.Label).Select(x => new AdminRoleSidebarMenuItem(x.Id, x.Role, x.Label, x.Href, x.Icon, x.DisplayOrder, x.IsVisible)).ToListAsync(ct));
    }

    [HttpPut("theme/sidebar")]
    public async Task<ActionResult<SidebarThemeSettings>> SaveSidebarTheme([FromQuery] string? role, UpdateSidebarThemeRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var requestedRole = string.IsNullOrWhiteSpace(role) ? StaffRoles.SuperAdmin : role.Trim().ToUpperInvariant();
        if (!KnownSidebarRoles.Contains(requestedRole, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "The selected sidebar role is invalid." });
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["sidebarBackground"] = request.SidebarBackground,
            ["sidebarText"] = request.SidebarText,
            ["sidebarIcon"] = request.SidebarIcon,
            ["sidebarHoverBackground"] = request.SidebarHoverBackground,
            ["sidebarHoverText"] = request.SidebarHoverText,
            ["sidebarActiveBackground"] = request.SidebarActiveBackground,
            ["sidebarActiveText"] = request.SidebarActiveText,
            ["sidebarActiveIcon"] = request.SidebarActiveIcon,
            ["sidebarBorder"] = request.SidebarBorder,
            ["sidebarDivider"] = request.SidebarDivider,
            ["sidebarHeaderBackground"] = request.SidebarHeaderBackground,
            ["sidebarHeaderText"] = request.SidebarHeaderText,
            ["sidebarFooterBackground"] = request.SidebarFooterBackground,
            ["sidebarFooterText"] = request.SidebarFooterText,
            ["sidebarBadgeBackground"] = request.SidebarBadgeBackground,
            ["sidebarBadgeText"] = request.SidebarBadgeText,
        };
        if (values.Any(x => !Regex.IsMatch(x.Value ?? string.Empty, "^#[0-9a-fA-F]{6}$"))) return BadRequest(new { message = "Every sidebar theme color must be a valid six-digit HEX value such as #003893." });
        var prefix = SidebarThemePrefix(requestedRole);
        var keys = values.Keys.Select(key => $"{prefix}{key}").ToArray();
        var existingRows = await db.SystemSettings.AsNoTracking().ToListAsync(ct);
        var existing = existingRows.Where(x => keys.Contains(x.Key, StringComparer.Ordinal)).ToDictionary(x => x.Key, x => x.Value, StringComparer.Ordinal);
        var previous = JsonSerializer.Serialize(ManagementSidebarThemeDefaults.Values.ToDictionary(x => x.Key, x => existing.GetValueOrDefault($"{prefix}{x.Key}", x.Value)));
        foreach (var value in values)
        {
            var settingKeys = requestedRole == StaffRoles.SuperAdmin
                ? new[] { $"{prefix}{value.Key}", $"management.sidebar.{value.Key}" }
                : new[] { $"{prefix}{value.Key}" };
            foreach (var key in settingKeys)
            {
                var item = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == key, ct);
                if (item is null) db.SystemSettings.Add(new SystemSetting { Key = key, Value = value.Value.ToUpperInvariant(), Group = ManagementSidebarThemeDefaults.Group, IsPublic = false, Description = $"{requestedRole} management sidebar appearance." });
                else { item.Value = value.Value.ToUpperInvariant(); item.Group = ManagementSidebarThemeDefaults.Group; item.IsPublic = false; item.Description = $"{requestedRole} management sidebar appearance."; item.UpdatedAt = DateTime.UtcNow; }
            }
        }
        db.ActivityLogs.Add(Activity("MANAGEMENT_SIDEBAR_THEME_UPDATED", "SystemSetting", requestedRole, previous, JsonSerializer.Serialize(values)));
        await db.SaveChangesAsync(ct);
        return Ok(await LoadSidebarTheme(ct, requestedRole));
    }

    [HttpGet("integrations")]
    public async Task<ActionResult<IntegrationStatusResponse>> Integrations(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var values = await IntegrationValues(ct);
        var email = new EmailIntegrationStatus(IsEmailConfigured(values), Get(values, IntegrationSettingKeys.EmailHost), IntValue(values, IntegrationSettingKeys.EmailPort), Get(values, IntegrationSettingKeys.EmailUsername), Get(values, IntegrationSettingKeys.EmailSenderName), Get(values, IntegrationSettingKeys.EmailSenderEmail), Get(values, IntegrationSettingKeys.EmailEncryption) ?? "STARTTLS");
        var sms = new SmsIntegrationStatus(IsConfigured(values, IntegrationSettingKeys.SmsProvider, IntegrationSettingKeys.SmsApiUrl, IntegrationSettingKeys.SmsApiKey, IntegrationSettingKeys.SmsSenderId), Get(values, IntegrationSettingKeys.SmsProvider), Get(values, IntegrationSettingKeys.SmsApiUrl), Get(values, IntegrationSettingKeys.SmsSenderId), IntValue(values, IntegrationSettingKeys.SmsOtpExpiryMinutes) ?? 10, IntValue(values, IntegrationSettingKeys.SmsOtpLength) ?? 6, IntValue(values, IntegrationSettingKeys.SmsRateLimit) ?? 5, IntValue(values, IntegrationSettingKeys.SmsRetryLimit) ?? 3);
        var whatsapp = new WhatsAppIntegrationStatus(IsConfigured(values, IntegrationSettingKeys.WhatsAppProvider, IntegrationSettingKeys.WhatsAppApiUrl, IntegrationSettingKeys.WhatsAppApiKey, IntegrationSettingKeys.WhatsAppBusinessNumber), Get(values, IntegrationSettingKeys.WhatsAppProvider), Get(values, IntegrationSettingKeys.WhatsAppApiUrl), Get(values, IntegrationSettingKeys.WhatsAppBusinessNumber), Get(values, IntegrationSettingKeys.WhatsAppTemplates));
        return Ok(new IntegrationStatusResponse(email, sms, whatsapp));
    }

    [HttpPut("integrations/email")]
    public async Task<ActionResult<EmailIntegrationStatus>> SaveEmailIntegration(UpsertEmailIntegrationRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Host) || request.Port is < 1 or > 65535 || string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.SenderName) || !MailAddress.TryCreate(request.SenderEmail, out _)) return BadRequest(new { message = "Enter a valid SMTP host, port, username, sender name, and sender email." });
        if (request.Encryption.Trim().ToUpperInvariant() is not ("NONE" or "SSL" or "STARTTLS")) return BadRequest(new { message = "Email encryption must be NONE, SSL, or STARTTLS." });
        var values = await IntegrationValues(ct); var previous = JsonSerializer.Serialize(new { Host = Get(values, IntegrationSettingKeys.EmailHost), Port = Get(values, IntegrationSettingKeys.EmailPort), Username = Get(values, IntegrationSettingKeys.EmailUsername), SenderEmail = Get(values, IntegrationSettingKeys.EmailSenderEmail), Encryption = Get(values, IntegrationSettingKeys.EmailEncryption) });
        await SaveIntegration(IntegrationSettingKeys.EmailHost, request.Host.Trim(), false, ct); await SaveIntegration(IntegrationSettingKeys.EmailPort, request.Port.ToString(CultureInfo.InvariantCulture), false, ct); await SaveIntegration(IntegrationSettingKeys.EmailUsername, request.Username.Trim(), false, ct); await SaveIntegration(IntegrationSettingKeys.EmailSenderName, request.SenderName.Trim(), false, ct); await SaveIntegration(IntegrationSettingKeys.EmailSenderEmail, request.SenderEmail.Trim(), false, ct); await SaveIntegration(IntegrationSettingKeys.EmailEncryption, request.Encryption.Trim().ToUpperInvariant(), false, ct); if (!string.IsNullOrWhiteSpace(request.Password)) await SaveIntegration(IntegrationSettingKeys.EmailPassword, request.Password, true, ct);
        db.ActivityLogs.Add(Activity("EMAIL_INTEGRATION_UPDATED", "Integration", "email", previous, JsonSerializer.Serialize(new { request.Host, request.Port, request.Username, request.SenderName, request.SenderEmail, request.Encryption })));
        await db.SaveChangesAsync(ct); return Ok(await EmailStatus(ct));
    }

    [HttpPost("integrations/email/test")]
    public async Task<IActionResult> TestEmail(TestEmailRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (!MailAddress.TryCreate(request.To, out var recipient)) return BadRequest(new { message = "Enter a valid recipient email address." });
        var values = await IntegrationValues(ct); if (!IsEmailConfigured(values)) return Conflict(new { message = "Email is not configured. Save SMTP settings and a password first." });
        try
        {
            using var client = new SmtpClient(Get(values, IntegrationSettingKeys.EmailHost)!, IntValue(values, IntegrationSettingKeys.EmailPort) ?? 587) { EnableSsl = Get(values, IntegrationSettingKeys.EmailEncryption) is not "NONE" };
            var username = Get(values, IntegrationSettingKeys.EmailUsername); var password = Get(values, IntegrationSettingKeys.EmailPassword); if (!string.IsNullOrWhiteSpace(username) && password is not null) client.Credentials = new System.Net.NetworkCredential(username, password);
            using var message = new MailMessage(Get(values, IntegrationSettingKeys.EmailSenderEmail)!, recipient.Address) { Subject = "All Nepal Healthy Home SMTP test", Body = "This is a real SMTP connectivity test from All Nepal Healthy Home." };
            await client.SendMailAsync(message, ct); db.ActivityLogs.Add(Activity("EMAIL_TEST_SENT", "Integration", "email", null, recipient.Address)); await db.SaveChangesAsync(ct); return Ok(new { message = "Test email sent successfully." });
        }
        catch (Exception) { return StatusCode(StatusCodes.Status502BadGateway, new { message = "The SMTP test failed. Verify the host, port, encryption, credentials, and sender address." }); }
    }

    [HttpPut("integrations/sms")]
    public async Task<ActionResult<SmsIntegrationStatus>> SaveSmsIntegration(UpsertSmsIntegrationRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (request.OtpExpiryMinutes is < 1 or > 60 || request.OtpLength is < 4 or > 10 || request.RateLimitPerHour is < 1 or > 100 || request.RetryLimit is < 0 or > 10) return BadRequest(new { message = "OTP expiry, length, rate limit, or retry limit is outside the supported range." });
        await SaveIntegration(IntegrationSettingKeys.SmsProvider, request.Provider, false, ct); await SaveIntegration(IntegrationSettingKeys.SmsApiUrl, request.ApiUrl, false, ct); if (!string.IsNullOrWhiteSpace(request.ApiKey)) await SaveIntegration(IntegrationSettingKeys.SmsApiKey, request.ApiKey, true, ct); await SaveIntegration(IntegrationSettingKeys.SmsSenderId, request.SenderId, false, ct); await SaveIntegration(IntegrationSettingKeys.SmsOtpExpiryMinutes, request.OtpExpiryMinutes.ToString(CultureInfo.InvariantCulture), false, ct); await SaveIntegration(IntegrationSettingKeys.SmsOtpLength, request.OtpLength.ToString(CultureInfo.InvariantCulture), false, ct); await SaveIntegration(IntegrationSettingKeys.SmsRateLimit, request.RateLimitPerHour.ToString(CultureInfo.InvariantCulture), false, ct); await SaveIntegration(IntegrationSettingKeys.SmsRetryLimit, request.RetryLimit.ToString(CultureInfo.InvariantCulture), false, ct); db.ActivityLogs.Add(Activity("SMS_INTEGRATION_UPDATED", "Integration", "sms", null, JsonSerializer.Serialize(new { request.Provider, request.ApiUrl, request.SenderId, request.OtpExpiryMinutes, request.OtpLength, request.RateLimitPerHour, request.RetryLimit }))); await db.SaveChangesAsync(ct); return Ok(await SmsStatus(ct));
    }

    [HttpPut("integrations/whatsapp")]
    public async Task<ActionResult<WhatsAppIntegrationStatus>> SaveWhatsAppIntegration(UpsertWhatsAppIntegrationRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        await SaveIntegration(IntegrationSettingKeys.WhatsAppProvider, request.Provider, false, ct); await SaveIntegration(IntegrationSettingKeys.WhatsAppApiUrl, request.ApiUrl, false, ct); if (!string.IsNullOrWhiteSpace(request.ApiKey)) await SaveIntegration(IntegrationSettingKeys.WhatsAppApiKey, request.ApiKey, true, ct); await SaveIntegration(IntegrationSettingKeys.WhatsAppBusinessNumber, request.BusinessNumber, false, ct); await SaveIntegration(IntegrationSettingKeys.WhatsAppTemplates, request.Templates, false, ct); db.ActivityLogs.Add(Activity("WHATSAPP_INTEGRATION_UPDATED", "Integration", "whatsapp", null, JsonSerializer.Serialize(new { request.Provider, request.ApiUrl, request.BusinessNumber, request.Templates }))); await db.SaveChangesAsync(ct); return Ok(await WhatsAppStatus(ct));
    }

    [HttpGet("integrations/assistant")]
    public async Task<ActionResult<AssistantIntegrationStatus>> AssistantIntegration(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        return Ok(await AssistantStatus(ct));
    }

    [HttpPut("integrations/assistant")]
    public async Task<ActionResult<AssistantIntegrationStatus>> SaveAssistantIntegration(UpsertAssistantIntegrationRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var provider = request.Provider.Trim().ToUpperInvariant();
        if (provider is not ("OPENAI" or "OPENAI_COMPATIBLE")) return BadRequest(new { message = "Assistant provider must be OPENAI or OPENAI_COMPATIBLE." });
        if (string.IsNullOrWhiteSpace(request.Model) || request.Model.Trim().Length > 120) return BadRequest(new { message = "Enter a valid assistant model." });
        if (!Uri.TryCreate(request.BaseUrl.Trim(), UriKind.Absolute, out var baseUri) || baseUri.Scheme is not ("http" or "https")) return BadRequest(new { message = "Enter a valid HTTP(S) assistant API base URL." });
        await SaveIntegration(IntegrationSettingKeys.AssistantProvider, provider, false, ct);
        await SaveIntegration(IntegrationSettingKeys.AssistantModel, request.Model, false, ct);
        await SaveIntegration(IntegrationSettingKeys.AssistantBaseUrl, request.BaseUrl, false, ct);
        await SaveIntegration(IntegrationSettingKeys.AssistantApiKey, request.ApiKey, true, ct);
        var enabled = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == "assistant.enabled", ct);
        if (enabled is null) db.SystemSettings.Add(new SystemSetting { Key = "assistant.enabled", Value = request.Enabled.ToString(), Group = "assistant", IsPublic = true, Description = "Enable the customer-facing AI pharmacy assistant." });
        else { enabled.Value = request.Enabled.ToString(); enabled.Group = "assistant"; enabled.IsPublic = true; enabled.UpdatedAt = DateTime.UtcNow; }
        db.ActivityLogs.Add(Activity("ASSISTANT_INTEGRATION_UPDATED", "Integration", "assistant", null, JsonSerializer.Serialize(new { request.Enabled, Provider = provider, request.Model, request.BaseUrl, ApiKeyConfigured = !string.IsNullOrWhiteSpace(request.ApiKey) })));
        await db.SaveChangesAsync(ct);
        return Ok(await AssistantStatus(ct));
    }

    [HttpGet("system/maintenance")]
    public async Task<ActionResult<MaintenanceSettingsResponse>> Maintenance(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var values = await db.SystemSettings.AsNoTracking().Where(x => x.Key.StartsWith("maintenance.")).ToDictionaryAsync(x => x.Key, x => x.Value, StringComparer.OrdinalIgnoreCase, ct);
        return Ok(new MaintenanceSettingsResponse(bool.TryParse(values.GetValueOrDefault("maintenance.enabled"), out var enabled) && enabled, values.GetValueOrDefault("maintenance.message") ?? "We are making a few improvements. Please check back shortly.", !bool.TryParse(values.GetValueOrDefault("maintenance.allowAdmin"), out var allowAdmin) || allowAdmin));
    }

    [HttpPut("system/maintenance")]
    public async Task<ActionResult<MaintenanceSettingsResponse>> UpdateMaintenance(UpdateMaintenanceRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Trim().Length > 500) return BadRequest(new { message = "Enter a maintenance message of 1 to 500 characters." });
        var settingRows = await db.SystemSettings.Where(x => x.Key == "maintenance.enabled" || x.Key == "maintenance.message" || x.Key == "maintenance.allowAdmin").ToListAsync(ct);
        var settings = settingRows.ToDictionary(x => x.Key, StringComparer.OrdinalIgnoreCase);
        var previous = JsonSerializer.Serialize(new { Enabled = settings.GetValueOrDefault("maintenance.enabled")?.Value, Message = settings.GetValueOrDefault("maintenance.message")?.Value, AllowAdmin = settings.GetValueOrDefault("maintenance.allowAdmin")?.Value });
        SetSetting(settings, "maintenance.enabled", request.Enabled.ToString(), "maintenance", true, "Put the customer website into maintenance mode.");
        SetSetting(settings, "maintenance.message", request.Message.Trim(), "maintenance", true, "Customer-facing maintenance message.");
        SetSetting(settings, "maintenance.allowAdmin", request.AllowAdmin.ToString(), "maintenance", false, "Keep protected staff portals available during maintenance.");
        db.ActivityLogs.Add(Activity("MAINTENANCE_SETTINGS_UPDATED", "SystemSetting", "maintenance", previous, JsonSerializer.Serialize(request)));
        await db.SaveChangesAsync(ct);
        return Ok(new MaintenanceSettingsResponse(request.Enabled, request.Message.Trim(), request.AllowAdmin));
    }

    [HttpGet("system/backups")]
    public async Task<ActionResult<IReadOnlyList<AdminBackupRow>>> Backups(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var rows = await db.SystemBackups.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(50).ToListAsync(ct);
        return Ok(rows.Select(BackupRow).ToList());
    }

    [HttpPost("system/backups")]
    public async Task<ActionResult<AdminBackupRow>> CreateBackup(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var result = await backups.CreateAsync(ct);
        var row = new SystemBackup { FileName = result.FileName, Status = result.Succeeded ? "COMPLETED" : "FAILED", Provider = result.Provider, SizeBytes = result.SizeBytes, Sha256 = result.Sha256, FailureReason = result.Error, CreatedBy = ActorId.ToString(), CompletedAt = result.Succeeded ? DateTime.UtcNow : null };
        db.SystemBackups.Add(row);
        db.ActivityLogs.Add(Activity(result.Succeeded ? "DATABASE_BACKUP_CREATED" : "DATABASE_BACKUP_FAILED", "SystemBackup", row.Id.ToString(), null, result.Succeeded ? row.FileName : result.Error));
        await db.SaveChangesAsync(ct);
        var response = BackupRow(row);
        return result.Succeeded ? Ok(response) : StatusCode(StatusCodes.Status502BadGateway, response);
    }

    [HttpPost("system/backups/{id:guid}/restore")]
    public async Task<IActionResult> RestoreBackup(Guid id, RestoreBackupRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (!request.Confirm) return BadRequest(new { message = "Confirm the restore operation before continuing." });
        var row = await db.SystemBackups.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        if (row.Status != "COMPLETED") return BadRequest(new { message = "Only a completed backup can be restored." });
        var result = await backups.RestoreAsync(row.FileName, ct);
        db.ActivityLogs.Add(Activity(result.Succeeded ? "DATABASE_BACKUP_RESTORED" : "DATABASE_BACKUP_RESTORE_FAILED", "SystemBackup", row.Id.ToString(), null, result.Succeeded ? row.FileName : result.Error));
        await db.SaveChangesAsync(ct);
        return result.Succeeded ? Ok(new { message = "The database backup was restored.", fileName = row.FileName }) : StatusCode(StatusCodes.Status502BadGateway, new { message = result.Error ?? "The database restore failed." });
    }

    [HttpGet("homepage/sections")]
    public async Task<ActionResult<IReadOnlyList<HomepageSection>>> Sections(CancellationToken ct) => !Can(AppPermissions.WebsiteManage) ? Forbid() : Ok(await db.HomepageSections.AsNoTracking().OrderBy(x => x.DisplayOrder).ToListAsync(ct));
    [HttpPut("homepage/sections/{id:guid}")]
    public async Task<ActionResult<HomepageSection>> SaveSection(Guid id, UpsertHomepageSectionRequest r, CancellationToken ct) { if (!Can(AppPermissions.WebsiteManage)) return Forbid(); var item = await db.HomepageSections.FindAsync([id], ct); if (item is null) return NotFound(); item.SectionKey = r.SectionKey; item.Title = r.Title; item.ContentJson = r.ContentJson; item.DisplayOrder = r.DisplayOrder; item.Enabled = r.Enabled; item.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("HOMEPAGE_SECTION_UPDATED", "HomepageSection", id.ToString(), null, item.Title)); await db.SaveChangesAsync(ct); return Ok(item); }
    [HttpGet("website/assets")]
    public async Task<ActionResult<IReadOnlyList<WebsiteAsset>>> Assets(CancellationToken ct) => !IsSuperAdmin || !SuperAdminPath ? Forbid() : Ok(await db.WebsiteAssets.AsNoTracking().OrderBy(x => x.Priority).ToListAsync(ct));
    [HttpPost("website/assets")]
    public async Task<ActionResult<WebsiteAsset>> CreateAsset(UpsertWebsiteAssetRequest r, CancellationToken ct) { if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var item = new WebsiteAsset { Kind = r.Kind, Title = r.Title, Subtitle = r.Subtitle, Description = r.Description, ImageUrl = r.ImageUrl, MobileImageUrl = r.MobileImageUrl, ButtonText = r.ButtonText, Destination = r.Destination, StartsAt = r.StartsAt.HasValue ? ApplicationTime.ToUtc(r.StartsAt.Value) : null, EndsAt = r.EndsAt.HasValue ? ApplicationTime.ToUtc(r.EndsAt.Value) : null, Priority = r.Priority, Enabled = r.Enabled, MobileEnabled = r.MobileEnabled, DesktopEnabled = r.DesktopEnabled }; db.WebsiteAssets.Add(item); db.ActivityLogs.Add(Activity("WEBSITE_ASSET_CREATED", "WebsiteAsset", item.Id.ToString(), null, item.Title)); await db.SaveChangesAsync(ct); return Ok(item); }
    [HttpPut("website/assets/{id:guid}")]
    public async Task<ActionResult<WebsiteAsset>> UpdateAsset(Guid id, UpsertWebsiteAssetRequest r, CancellationToken ct) { if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var item = await db.WebsiteAssets.FindAsync([id], ct); if (item is null) return NotFound(); item.Kind = r.Kind; item.Title = r.Title; item.Subtitle = r.Subtitle; item.Description = r.Description; item.ImageUrl = r.ImageUrl; item.MobileImageUrl = r.MobileImageUrl; item.ButtonText = r.ButtonText; item.Destination = r.Destination; item.StartsAt = r.StartsAt.HasValue ? ApplicationTime.ToUtc(r.StartsAt.Value) : null; item.EndsAt = r.EndsAt.HasValue ? ApplicationTime.ToUtc(r.EndsAt.Value) : null; item.Priority = r.Priority; item.Enabled = r.Enabled; item.MobileEnabled = r.MobileEnabled; item.DesktopEnabled = r.DesktopEnabled; item.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return Ok(item); }

    [HttpGet("website/hero-slides")]
    public async Task<ActionResult<IReadOnlyList<AdminHeroSlide>>> HeroSlides(CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var rows = await db.WebsiteAssets.AsNoTracking().Where(x => x.Kind == "HERO").OrderBy(x => x.Priority).ThenBy(x => x.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(HeroSlideRow).ToList());
    }

    [HttpGet("website/hero-slides/{id:guid}")]
    public async Task<ActionResult<AdminHeroSlide>> HeroSlide(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var item = await db.WebsiteAssets.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.Kind == "HERO", ct);
        return item is null ? NotFound() : Ok(HeroSlideRow(item));
    }

    [HttpPost("website/hero-slides/video")]
    [RequestSizeLimit(110 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 110 * 1024 * 1024)]
    public async Task<ActionResult<AdminMediaAsset>> UploadHeroVideo([FromForm] IFormFile file, [FromForm] string? altText, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        StoredMediaFile? stored = null;
        try
        {
            stored = await media.SaveHeroVideoAsync(file, ct);
            var existing = await db.MediaAssets.SingleOrDefaultAsync(x => x.Sha256 == stored.Sha256 && x.Kind == "HERO_VIDEO" && x.IsActive && x.IsPublic, ct);
            if (existing is not null)
            {
                await media.DeleteAsync(stored.StoredFileName, ct);
                return Ok(MediaRow(existing));
            }

            var item = new MediaAsset
            {
                OriginalFileName = stored.OriginalFileName,
                StoredFileName = stored.StoredFileName,
                ContentType = stored.ContentType,
                Length = stored.Length,
                Sha256 = stored.Sha256,
                Kind = "HERO_VIDEO",
                AltText = CleanOptional(altText),
                IsPublic = true,
            };
            db.MediaAssets.Add(item);
            db.ActivityLogs.Add(Activity("HERO_VIDEO_UPLOADED", "MediaAsset", item.Id.ToString(), null, item.OriginalFileName));
            await db.SaveChangesAsync(ct);
            return Ok(MediaRow(item));
        }
        catch (InvalidDataException exception) { return BadRequest(new { message = exception.Message }); }
        catch
        {
            if (stored is not null) await media.DeleteAsync(stored.StoredFileName, CancellationToken.None);
            throw;
        }
    }

    [HttpPost("website/hero-slides")]
    public async Task<ActionResult<AdminHeroSlide>> CreateHeroSlide(UpsertHeroSlideRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var validation = ValidateHeroSlide(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = new WebsiteAsset { Kind = "HERO", Title = request.Title.Trim() };
        ApplyHeroSlide(item, request);
        db.WebsiteAssets.Add(item);
        db.ActivityLogs.Add(Activity("HERO_SLIDE_CREATED", "WebsiteAsset", item.Id.ToString(), null, item.Title));
        await db.SaveChangesAsync(ct);
        return Ok(HeroSlideRow(item));
    }

    [HttpPut("website/hero-slides/{id:guid}")]
    public async Task<ActionResult<AdminHeroSlide>> UpdateHeroSlide(Guid id, UpsertHeroSlideRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var validation = ValidateHeroSlide(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = await db.WebsiteAssets.SingleOrDefaultAsync(x => x.Id == id && x.Kind == "HERO", ct);
        if (item is null) return NotFound();
        var previous = JsonSerializer.Serialize(new { item.Title, item.ImageUrl, item.MobileImageUrl, item.VideoUrl, item.Priority, item.Enabled, item.LayoutVariant, item.TypingSpeedMs, item.BackgroundColor, item.AnimationType });
        item.Title = request.Title.Trim();
        ApplyHeroSlide(item, request);
        item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("HERO_SLIDE_UPDATED", "WebsiteAsset", id.ToString(), previous, JsonSerializer.Serialize(new { item.Title, item.ImageUrl, item.MobileImageUrl, item.VideoUrl, item.Priority, item.Enabled, item.LayoutVariant, item.TypingSpeedMs, item.BackgroundColor, item.AnimationType })));
        await db.SaveChangesAsync(ct);
        return Ok(HeroSlideRow(item));
    }

    [HttpDelete("website/hero-slides/{id:guid}")]
    public async Task<IActionResult> DeleteHeroSlide(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var item = await db.WebsiteAssets.SingleOrDefaultAsync(x => x.Id == id && x.Kind == "HERO", ct);
        if (item is null) return NotFound();
        db.ActivityLogs.Add(Activity("HERO_SLIDE_DELETED", "WebsiteAsset", id.ToString(), JsonSerializer.Serialize(new { item.Title, item.ImageUrl, item.MobileImageUrl, item.VideoUrl, item.Priority, item.Enabled }), null));
        db.WebsiteAssets.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("website/hero-slides/reorder")]
    public async Task<ActionResult<IReadOnlyList<AdminHeroSlide>>> ReorderHeroSlides(ReorderHeroSlidesRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        if (request.Slides is null || request.Slides.Count == 0 || request.Slides.Any(x => x.DisplayOrder < 0)) return BadRequest(new { message = "Provide a valid slide order." });
        var ids = request.Slides.Select(x => x.Id).Distinct().ToList();
        var items = await db.WebsiteAssets.Where(x => x.Kind == "HERO" && ids.Contains(x.Id)).ToListAsync(ct);
        if (items.Count != ids.Count) return BadRequest(new { message = "One or more hero slides could not be found." });
        foreach (var item in items)
        {
            var order = request.Slides.First(x => x.Id == item.Id).DisplayOrder;
            item.Priority = order;
            item.UpdatedAt = DateTime.UtcNow;
        }
        db.ActivityLogs.Add(Activity("HERO_SLIDES_REORDERED", "WebsiteAsset", "bulk", null, string.Join(',', request.Slides.OrderBy(x => x.DisplayOrder).Select(x => $"{x.Id}:{x.DisplayOrder}"))));
        await db.SaveChangesAsync(ct);
        return Ok(items.OrderBy(x => x.Priority).ThenBy(x => x.CreatedAt).Select(HeroSlideRow).ToList());
    }

    [HttpGet("website/navigation")]
    public async Task<ActionResult<IReadOnlyList<AdminNavigationMenuItem>>> Navigation([FromQuery] string? menu, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var query = db.NavigationMenuItems.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(menu)) query = query.Where(x => x.MenuKey == menu.Trim().ToLowerInvariant());
        var rows = await query.OrderBy(x => x.MenuKey).ThenBy(x => x.DisplayOrder).ThenBy(x => x.Label).ToListAsync(ct);
        return Ok(rows.Select(NavigationRow).ToList());
    }

    [HttpPost("website/navigation")]
    public async Task<ActionResult<AdminNavigationMenuItem>> CreateNavigation(UpsertNavigationMenuItemRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var validation = await ValidateNavigation(request, null, ct); if (validation is not null) return BadRequest(new { message = validation });
        var item = new NavigationMenuItem { MenuKey = request.MenuKey.Trim().ToLowerInvariant(), Label = request.Label.Trim(), Url = request.Url.Trim(), ParentId = request.ParentId, Icon = CleanOptional(request.Icon), DisplayOrder = Math.Max(0, request.DisplayOrder), IsVisible = request.IsVisible, OpenInNewTab = request.OpenInNewTab };
        db.NavigationMenuItems.Add(item); db.ActivityLogs.Add(Activity("NAVIGATION_ITEM_CREATED", "NavigationMenuItem", item.Id.ToString(), null, item.Label)); await db.SaveChangesAsync(ct);
        return Ok(NavigationRow(item));
    }

    [HttpPut("website/navigation/{id:guid}")]
    public async Task<ActionResult<AdminNavigationMenuItem>> UpdateNavigation(Guid id, UpsertNavigationMenuItemRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var item = await db.NavigationMenuItems.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound();
        var validation = await ValidateNavigation(request, id, ct); if (validation is not null) return BadRequest(new { message = validation });
        var previous = JsonSerializer.Serialize(new { item.MenuKey, item.Label, item.Url, item.ParentId, item.DisplayOrder, item.IsVisible });
        item.MenuKey = request.MenuKey.Trim().ToLowerInvariant(); item.Label = request.Label.Trim(); item.Url = request.Url.Trim(); item.ParentId = request.ParentId; item.Icon = CleanOptional(request.Icon); item.DisplayOrder = Math.Max(0, request.DisplayOrder); item.IsVisible = request.IsVisible; item.OpenInNewTab = request.OpenInNewTab; item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("NAVIGATION_ITEM_UPDATED", "NavigationMenuItem", id.ToString(), previous, JsonSerializer.Serialize(new { item.MenuKey, item.Label, item.Url, item.ParentId, item.DisplayOrder, item.IsVisible }))); await db.SaveChangesAsync(ct); return Ok(NavigationRow(item));
    }

    [HttpDelete("website/navigation/{id:guid}")]
    public async Task<IActionResult> HideNavigation(Guid id, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var item = await db.NavigationMenuItems.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound();
        item.IsVisible = false; item.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("NAVIGATION_ITEM_HIDDEN", "NavigationMenuItem", id.ToString(), "true", "false")); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpGet("website/popups")]
    public async Task<ActionResult<IReadOnlyList<AdminPopupCampaign>>> Popups(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        return Ok((await db.PopupCampaigns.AsNoTracking().OrderByDescending(x => x.UpdatedAt).ToListAsync(ct)).Select(PopupRow).ToList());
    }

    [HttpPost("website/popups")]
    public async Task<ActionResult<AdminPopupCampaign>> CreatePopup(UpsertPopupCampaignRequest request, CancellationToken ct) => await SavePopup(null, request, ct);

    [HttpPut("website/popups/{id:guid}")]
    public async Task<ActionResult<AdminPopupCampaign>> UpdatePopup(Guid id, UpsertPopupCampaignRequest request, CancellationToken ct) => await SavePopup(id, request, ct);

    [HttpDelete("website/popups/{id:guid}")]
    public async Task<IActionResult> DeactivatePopup(Guid id, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var popup = await db.PopupCampaigns.SingleOrDefaultAsync(x => x.Id == id, ct); if (popup is null) return NotFound(); popup.IsActive = false; popup.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("POPUP_DEACTIVATED", "PopupCampaign", id.ToString(), "true", "false")); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpGet("website/seo")]
    public async Task<ActionResult<IReadOnlyList<AdminSeoEntry>>> Seo(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        return Ok((await db.SeoEntries.AsNoTracking().OrderBy(x => x.Scope).ThenBy(x => x.Path).ToListAsync(ct)).Select(SeoRow).ToList());
    }

    [HttpPost("website/seo")]
    public async Task<ActionResult<AdminSeoEntry>> CreateSeo(UpsertSeoEntryRequest request, CancellationToken ct) => await SaveSeo(null, request, ct);

    [HttpPut("website/seo/{id:guid}")]
    public async Task<ActionResult<AdminSeoEntry>> UpdateSeo(Guid id, UpsertSeoEntryRequest request, CancellationToken ct) => await SaveSeo(id, request, ct);

    [HttpGet("media")]
    public async Task<ActionResult<IReadOnlyList<AdminMediaAsset>>> Media([FromQuery] string? search, [FromQuery] string? kind, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var query = db.MediaAssets.AsNoTracking().Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.OriginalFileName.Contains(search));
        if (!string.IsNullOrWhiteSpace(kind)) query = query.Where(x => x.Kind == kind.Trim().ToUpperInvariant());
        var rows = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(MediaRow).ToList());
    }

    [HttpPost("media")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<ActionResult<AdminMediaAsset>> UploadMedia([FromForm] IFormFile file, [FromForm] string? kind, [FromForm] string? altText, [FromForm] bool isPublic, CancellationToken ct)
    {
        if ((!IsSuperAdmin || !SuperAdminPath) && !(Can(AppPermissions.CatalogManage) || Can(AppPermissions.WebsiteManage))) return Forbid();
        StoredMediaFile? stored = null;
        try
        {
            var normalizedKind = string.IsNullOrWhiteSpace(kind) ? "GENERAL" : kind.Trim().ToUpperInvariant();
            stored = await media.SaveAsync(file, ct, normalizedKind == "LOGO");
            var existing = await db.MediaAssets.SingleOrDefaultAsync(x => x.Sha256 == stored.Sha256 && x.IsActive, ct);
            if (existing is not null)
            {
                await media.DeleteAsync(stored.StoredFileName, ct);
                return Ok(MediaRow(existing));
            }
            var item = new MediaAsset { OriginalFileName = stored.OriginalFileName, StoredFileName = stored.StoredFileName, ContentType = stored.ContentType, Length = stored.Length, Sha256 = stored.Sha256, Kind = normalizedKind, AltText = CleanOptional(altText), IsPublic = isPublic };
            db.MediaAssets.Add(item); db.ActivityLogs.Add(Activity("MEDIA_UPLOADED", "MediaAsset", item.Id.ToString(), null, item.OriginalFileName)); await db.SaveChangesAsync(ct); return Ok(MediaRow(item));
        }
        catch (InvalidDataException exception) { return BadRequest(new { message = exception.Message }); }
        catch
        {
            if (stored is not null) await media.DeleteAsync(stored.StoredFileName, CancellationToken.None);
            throw;
        }
    }

    [HttpDelete("media/{id:guid}")]
    public async Task<IActionResult> DeactivateMedia(Guid id, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var item = await db.MediaAssets.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound(); item.IsActive = false; item.IsPublic = false; item.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("MEDIA_DEACTIVATED", "MediaAsset", id.ToString(), "true", "false")); await db.SaveChangesAsync(ct); return NoContent();
    }
    [HttpGet("cms/pages")]
    public async Task<ActionResult<IReadOnlyList<CmsPage>>> Pages(CancellationToken ct) => !IsSuperAdmin || !SuperAdminPath ? Forbid() : Ok(await db.CmsPages.AsNoTracking().OrderBy(x => x.Title).ToListAsync(ct));
    [HttpPost("cms/pages")]
    public async Task<ActionResult<CmsPage>> CreatePage(UpsertCmsPageRequest r, CancellationToken ct) { if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var item = new CmsPage { Slug = r.Slug.Trim(), Title = r.Title.Trim(), Content = r.Content, Status = r.Status, SeoTitle = r.SeoTitle, MetaDescription = r.MetaDescription, PublishedAt = r.PublishedAt }; db.CmsPages.Add(item); db.ActivityLogs.Add(Activity("CMS_PAGE_CREATED", "CmsPage", item.Id.ToString(), null, item.Slug)); await db.SaveChangesAsync(ct); return Ok(item); }
    [HttpPut("cms/pages/{id:guid}")]
    public async Task<ActionResult<CmsPage>> UpdatePage(Guid id, UpsertCmsPageRequest r, CancellationToken ct) { if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var item = await db.CmsPages.FindAsync([id], ct); if (item is null) return NotFound(); item.Slug = r.Slug.Trim(); item.Title = r.Title.Trim(); item.Content = r.Content; item.Status = r.Status; item.SeoTitle = r.SeoTitle; item.MetaDescription = r.MetaDescription; item.PublishedAt = r.PublishedAt; item.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return Ok(item); }
    [HttpGet("articles")]
    public async Task<ActionResult<IReadOnlyList<AdminHealthArticleRow>>> Articles(CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        return Ok(await db.HealthArticles.AsNoTracking().OrderByDescending(x => x.UpdatedAt).Select(x => new AdminHealthArticleRow(x.Id, x.Slug, x.Title, x.Excerpt, x.Content, x.Category, x.TagsCsv, x.AuthorName, x.FeaturedImageUrl, x.Status, x.SeoTitle, x.MetaDescription, x.PublishedAt, x.ScheduledAt, x.IsFeatured, x.UpdatedAt)).ToListAsync(ct));
    }

    [HttpPost("articles")]
    public async Task<ActionResult<AdminHealthArticleRow>> CreateArticle(UpsertHealthArticleRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var validation = ValidateArticle(request); if (validation is not null) return BadRequest(new { message = validation });
        var slug = request.Slug.Trim().ToLowerInvariant(); if (await db.HealthArticles.AnyAsync(x => x.Slug == slug, ct)) return Conflict(new { message = "An article with this slug already exists." });
        var article = new HealthArticle { Slug = slug, Title = request.Title.Trim(), Excerpt = CleanOptional(request.Excerpt), Content = request.Content.Trim(), Category = CleanOptional(request.Category), TagsCsv = CleanOptional(request.TagsCsv), AuthorName = CleanOptional(request.AuthorName), FeaturedImageUrl = CleanOptional(request.FeaturedImageUrl), Status = request.Status.Trim().ToUpperInvariant(), SeoTitle = CleanOptional(request.SeoTitle), MetaDescription = CleanOptional(request.MetaDescription), PublishedAt = request.PublishedAt.HasValue ? ApplicationTime.ToUtc(request.PublishedAt.Value) : null, ScheduledAt = request.ScheduledAt.HasValue ? ApplicationTime.ToUtc(request.ScheduledAt.Value) : null, IsFeatured = request.IsFeatured };
        if (article.Status == "PUBLISHED" && !article.PublishedAt.HasValue) article.PublishedAt = DateTime.UtcNow;
        db.HealthArticles.Add(article); db.ActivityLogs.Add(Activity("ARTICLE_CREATED", "HealthArticle", article.Id.ToString(), null, article.Slug)); await db.SaveChangesAsync(ct); return Ok(ArticleRow(article));
    }

    [HttpPut("articles/{id:guid}")]
    public async Task<ActionResult<AdminHealthArticleRow>> UpdateArticle(Guid id, UpsertHealthArticleRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.WebsiteManage)) return Forbid();
        var validation = ValidateArticle(request); if (validation is not null) return BadRequest(new { message = validation });
        var article = await db.HealthArticles.FindAsync([id], ct); if (article is null) return NotFound();
        var slug = request.Slug.Trim().ToLowerInvariant(); if (await db.HealthArticles.AnyAsync(x => x.Id != id && x.Slug == slug, ct)) return Conflict(new { message = "An article with this slug already exists." });
        var previous = JsonSerializer.Serialize(new { article.Slug, article.Status, article.IsFeatured }); article.Slug = slug; article.Title = request.Title.Trim(); article.Excerpt = CleanOptional(request.Excerpt); article.Content = request.Content.Trim(); article.Category = CleanOptional(request.Category); article.TagsCsv = CleanOptional(request.TagsCsv); article.AuthorName = CleanOptional(request.AuthorName); article.FeaturedImageUrl = CleanOptional(request.FeaturedImageUrl); article.Status = request.Status.Trim().ToUpperInvariant(); article.SeoTitle = CleanOptional(request.SeoTitle); article.MetaDescription = CleanOptional(request.MetaDescription); article.PublishedAt = request.PublishedAt.HasValue ? ApplicationTime.ToUtc(request.PublishedAt.Value) : (article.Status == "PUBLISHED" ? DateTime.UtcNow : null); article.ScheduledAt = request.ScheduledAt.HasValue ? ApplicationTime.ToUtc(request.ScheduledAt.Value) : null; article.IsFeatured = request.IsFeatured; article.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("ARTICLE_UPDATED", "HealthArticle", id.ToString(), previous, JsonSerializer.Serialize(new { article.Slug, article.Status, article.IsFeatured }))); await db.SaveChangesAsync(ct); return Ok(ArticleRow(article));
    }
    [HttpGet("faq")]
    public async Task<ActionResult<IReadOnlyList<Faq>>> Faq(CancellationToken ct) => !IsSuperAdmin || !SuperAdminPath ? Forbid() : Ok(await db.Faqs.AsNoTracking().OrderBy(x => x.DisplayOrder).ToListAsync(ct));
    [HttpPost("faq")]
    public async Task<ActionResult<Faq>> CreateFaq(UpsertFaqRequest r, CancellationToken ct) { if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var item = new Faq { Question = r.Question, Answer = r.Answer, Category = r.Category, DisplayOrder = r.DisplayOrder, Published = r.Published }; db.Faqs.Add(item); await db.SaveChangesAsync(ct); return Ok(item); }
    [HttpPut("faq/{id:guid}")]
    public async Task<ActionResult<Faq>> UpdateFaq(Guid id, UpsertFaqRequest r, CancellationToken ct) { if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var item = await db.Faqs.FindAsync([id], ct); if (item is null) return NotFound(); item.Question = r.Question; item.Answer = r.Answer; item.Category = r.Category; item.DisplayOrder = r.DisplayOrder; item.Published = r.Published; item.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return Ok(item); }
    [HttpDelete("faq/{id:guid}")]
    public async Task<IActionResult> DeleteFaq(Guid id, CancellationToken ct) { if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var item = await db.Faqs.FindAsync([id], ct); if (item is null) return NotFound(); db.Faqs.Remove(item); await db.SaveChangesAsync(ct); return NoContent(); }
    [HttpGet("audit-logs")]
    public async Task<ActionResult<PagedResponse<AdminAuditRow>>> AuditLogs([FromQuery] string? search, [FromQuery] string? action, [FromQuery] string? entityType, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var q = db.ActivityLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(x => x.Action.Contains(search) || x.EntityType.Contains(search) || x.EntityId.Contains(search) || (x.ActorRole != null && x.ActorRole.Contains(search)));
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(x => x.Action == action.Trim());
        if (!string.IsNullOrWhiteSpace(entityType)) q = q.Where(x => x.EntityType == entityType.Trim());
        if (from.HasValue) q = q.Where(x => x.CreatedAt >= from.Value.Date);
        if (to.HasValue) q = q.Where(x => x.CreatedAt < to.Value.Date.AddDays(1));
        var total = await q.CountAsync(ct); var rows = await q.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<AdminAuditRow>(rows.Select(x => new AdminAuditRow(x.Id, x.Action, x.EntityType, x.EntityId, x.ActorRole, x.PreviousValue, x.NewValue, x.CreatedAt)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("customers")]
    public async Task<ActionResult<PagedResponse<AdminCustomerRow>>> Customers([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!Can(AppPermissions.CustomersView)) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = ScopeCustomers(db.Customers.AsNoTracking()).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.FullName.Contains(search) || x.Email.Contains(search) || x.Phone.Contains(search));
        var total = await query.CountAsync(ct);
        var scopedOrders = ScopeOrders(db.Orders.AsNoTracking());
        var scopedPrescriptions = ScopePrescriptions(db.Prescriptions.AsNoTracking());
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).Select(x => new AdminCustomerRow(x.Id, x.FullName, x.Email, x.Phone, x.IsActive, scopedOrders.Count(o => o.CustomerId == x.Id), scopedPrescriptions.Count(p => p.CustomerId == x.Id), x.CreatedAt)).ToListAsync(ct);
        return Ok(new PagedResponse<AdminCustomerRow>(rows, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("customers/{id:guid}")]
    public async Task<ActionResult<AdminCustomerDetailResponse>> Customer(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.CustomersView)) return Forbid();
        var customer = await ScopeCustomers(db.Customers.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (customer is null) return NotFound();

        var addresses = await db.Addresses.AsNoTracking().Where(x => x.CustomerId == id).OrderByDescending(x => x.IsDefault).ThenByDescending(x => x.UpdatedAt).Select(x => new AdminCustomerAddressRow(x.Id, x.Label, x.Province, x.District, x.Municipality, x.Ward, x.StreetTole, x.Landmark, x.Phone, x.IsDefault)).ToListAsync(ct);
        var orders = await ScopeOrders(db.Orders.AsNoTracking()).Where(x => x.CustomerId == id).Include(x => x.Branch).OrderByDescending(x => x.CreatedAt).Take(100).Select(x => new AdminCustomerOrderRow(x.Id, x.OrderNumber, x.Status, x.PaymentStatus, x.Total, x.Branch == null ? null : x.Branch.Name, x.CreatedAt)).ToListAsync(ct);
        var prescriptions = await ScopePrescriptions(db.Prescriptions.AsNoTracking()).Where(x => x.CustomerId == id).Include(x => x.ExtractedItems).OrderByDescending(x => x.CreatedAt).Take(100).Select(x => new AdminCustomerPrescriptionRow(x.Id, x.Status, x.OriginalFileName, x.ExtractedItems.Count, x.CreatedAt)).ToListAsync(ct);
        var reviews = await db.ProductReviews.AsNoTracking().Where(x => x.CustomerId == id).Include(x => x.Product).OrderByDescending(x => x.CreatedAt).Take(100).Select(x => new AdminCustomerReviewRow(x.Id, x.Product == null ? "Unknown product" : x.Product.Name, x.Rating, x.Status, x.Title, x.Comment, x.CreatedAt)).ToListAsync(ct);
        var tickets = await db.SupportTickets.AsNoTracking().Where(x => x.CustomerId == id).Include(x => x.AssignedStaff).OrderByDescending(x => x.CreatedAt).Take(100).Select(x => new AdminSupportTicketRow(x.Id, x.TicketNumber, customer.FullName, customer.Email, x.Subject, x.Description, x.Status, x.Priority, x.Category, x.Resolution, x.AssignedStaff == null ? null : x.AssignedStaff.FullName, x.CreatedAt, x.ResolvedAt)).ToListAsync(ct);
        return Ok(new AdminCustomerDetailResponse(customer.Id, customer.FullName, customer.Email, customer.Phone, customer.IsActive, customer.CreatedAt, addresses, orders, prescriptions, reviews, tickets));
    }

    [HttpPut("customers/{id:guid}/status")]
    public async Task<ActionResult<AdminCustomerRow>> UpdateCustomerStatus(Guid id, SetActiveRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.CustomersManage)) return Forbid();
        var customer = await ScopeCustomers(db.Customers).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (customer is null) return NotFound();
        var previous = customer.IsActive.ToString(); customer.IsActive = request.IsActive; customer.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity(request.IsActive ? "CUSTOMER_ACTIVATED" : "CUSTOMER_DEACTIVATED", "Customer", id.ToString(), previous, request.IsActive.ToString()));
        await db.SaveChangesAsync(ct);
        return Ok(new AdminCustomerRow(customer.Id, customer.FullName, customer.Email, customer.Phone, customer.IsActive, await ScopeOrders(db.Orders.AsNoTracking()).CountAsync(x => x.CustomerId == id, ct), await ScopePrescriptions(db.Prescriptions.AsNoTracking()).CountAsync(x => x.CustomerId == id, ct), customer.CreatedAt));
    }

    [HttpGet("coupons")]
    public async Task<ActionResult<IReadOnlyList<Coupon>>> Coupons(CancellationToken ct) => !IsSuperAdmin || !SuperAdminPath ? Forbid() : Ok(await db.Coupons.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct));

    [HttpPost("coupons")]
    public async Task<ActionResult<Coupon>> CreateCoupon(UpsertCouponRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var validation = ValidateCoupon(request); if (validation is not null) return BadRequest(new { message = validation });
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Coupons.AnyAsync(x => x.Code == code, ct)) return Conflict(new { message = "A coupon with this code already exists." });
        var coupon = new Coupon { Code = code, Type = request.Type.Trim().ToUpperInvariant(), Value = request.Value, MinimumOrder = request.MinimumOrder, MaximumDiscount = request.MaximumDiscount, UsageLimit = request.UsageLimit, StartsAt = request.StartsAt.HasValue ? ApplicationTime.ToUtc(request.StartsAt.Value) : null, EndsAt = request.EndsAt.HasValue ? ApplicationTime.ToUtc(request.EndsAt.Value) : null, FirstOrderOnly = request.FirstOrderOnly, IsActive = request.IsActive };
        db.Coupons.Add(coupon); db.ActivityLogs.Add(Activity("COUPON_CREATED", "Coupon", coupon.Id.ToString(), null, coupon.Code)); await db.SaveChangesAsync(ct); return Ok(coupon);
    }

    [HttpPut("coupons/{id:guid}")]
    public async Task<ActionResult<Coupon>> UpdateCoupon(Guid id, UpsertCouponRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var validation = ValidateCoupon(request); if (validation is not null) return BadRequest(new { message = validation });
        var coupon = await db.Coupons.SingleOrDefaultAsync(x => x.Id == id, ct); if (coupon is null) return NotFound();
        var code = request.Code.Trim().ToUpperInvariant(); if (await db.Coupons.AnyAsync(x => x.Id != id && x.Code == code, ct)) return Conflict(new { message = "A coupon with this code already exists." });
        var previous = JsonSerializer.Serialize(new { coupon.Code, coupon.Value, coupon.IsActive }); coupon.Code = code; coupon.Type = request.Type.Trim().ToUpperInvariant(); coupon.Value = request.Value; coupon.MinimumOrder = request.MinimumOrder; coupon.MaximumDiscount = request.MaximumDiscount; coupon.UsageLimit = request.UsageLimit; coupon.StartsAt = request.StartsAt.HasValue ? ApplicationTime.ToUtc(request.StartsAt.Value) : null; coupon.EndsAt = request.EndsAt.HasValue ? ApplicationTime.ToUtc(request.EndsAt.Value) : null; coupon.FirstOrderOnly = request.FirstOrderOnly; coupon.IsActive = request.IsActive; coupon.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("COUPON_UPDATED", "Coupon", id.ToString(), previous, JsonSerializer.Serialize(new { coupon.Code, coupon.Value, coupon.IsActive }))); await db.SaveChangesAsync(ct); return Ok(coupon);
    }

    [HttpDelete("coupons/{id:guid}")]
    public async Task<IActionResult> DeactivateCoupon(Guid id, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid(); var coupon = await db.Coupons.SingleOrDefaultAsync(x => x.Id == id, ct); if (coupon is null) return NotFound(); coupon.IsActive = false; coupon.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("COUPON_DEACTIVATED", "Coupon", id.ToString(), "true", "false")); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpGet("flash-sales")]
    public async Task<ActionResult<IReadOnlyList<AdminFlashSaleRow>>> FlashSales([FromQuery] string? status, CancellationToken ct)
    {
        if (!Can(AppPermissions.FlashSalesManage)) return Forbid();
        var now = DateTime.UtcNow;
        var rows = await db.FlashSales.AsNoTracking().Include(x => x.Product).Include(x => x.Branch).OrderBy(x => x.StartsAt).ToListAsync(ct);
        var result = rows.Select(x => FlashSaleRow(x, now)).Where(x => string.IsNullOrWhiteSpace(status) || x.Status.Equals(status, StringComparison.OrdinalIgnoreCase)).ToList();
        return Ok(result);
    }

    [HttpPost("flash-sales")]
    public async Task<ActionResult<AdminFlashSaleRow>> CreateFlashSale(UpsertFlashSaleRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.FlashSalesManage)) return Forbid();
        var validation = await ValidateFlashSale(request, null, ct);
        if (validation is not null) return BadRequest(new { message = validation });
        var sale = new FlashSale { Name = request.Name.Trim(), ProductId = request.ProductId, BranchId = request.BranchId, DiscountPercent = request.DiscountPercent, QuantityLimit = request.QuantityLimit, StartsAt = ApplicationTime.ToUtc(request.StartsAt), EndsAt = ApplicationTime.ToUtc(request.EndsAt), IsActive = request.IsActive };
        db.FlashSales.Add(sale);
        db.ActivityLogs.Add(Activity("FLASH_SALE_CREATED", "FlashSale", sale.Id.ToString(), null, JsonSerializer.Serialize(new { sale.Name, sale.ProductId, sale.DiscountPercent, sale.StartsAt, sale.EndsAt })));
        await db.SaveChangesAsync(ct);
        await db.Entry(sale).Reference(x => x.Product).LoadAsync(ct); await db.Entry(sale).Reference(x => x.Branch).LoadAsync(ct);
        return Ok(FlashSaleRow(sale, DateTime.UtcNow));
    }

    [HttpPut("flash-sales/{id:guid}")]
    public async Task<ActionResult<AdminFlashSaleRow>> UpdateFlashSale(Guid id, UpsertFlashSaleRequest request, CancellationToken ct)
    {
        if (!Can(AppPermissions.FlashSalesManage)) return Forbid();
        var validation = await ValidateFlashSale(request, id, ct);
        if (validation is not null) return BadRequest(new { message = validation });
        var sale = await db.FlashSales.Include(x => x.Product).Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (sale is null) return NotFound();
        if (sale.QuantitySold > 0 && sale.ProductId != request.ProductId) return Conflict(new { message = "A sale with completed orders cannot be moved to another product." });
        if (request.QuantityLimit.HasValue && request.QuantityLimit.Value < sale.QuantitySold) return Conflict(new { message = "Quantity limit cannot be below the number already sold." });
        var previous = JsonSerializer.Serialize(new { sale.Name, sale.ProductId, sale.DiscountPercent, sale.StartsAt, sale.EndsAt, sale.IsActive });
        sale.Name = request.Name.Trim(); sale.ProductId = request.ProductId; sale.BranchId = request.BranchId; sale.DiscountPercent = request.DiscountPercent; sale.QuantityLimit = request.QuantityLimit; sale.StartsAt = ApplicationTime.ToUtc(request.StartsAt); sale.EndsAt = ApplicationTime.ToUtc(request.EndsAt); sale.IsActive = request.IsActive; sale.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(Activity("FLASH_SALE_UPDATED", "FlashSale", id.ToString(), previous, JsonSerializer.Serialize(new { sale.Name, sale.ProductId, sale.DiscountPercent, sale.StartsAt, sale.EndsAt, sale.IsActive })));
        await db.SaveChangesAsync(ct);
        await db.Entry(sale).Reference(x => x.Product).LoadAsync(ct); await db.Entry(sale).Reference(x => x.Branch).LoadAsync(ct);
        return Ok(FlashSaleRow(sale, DateTime.UtcNow));
    }

    [HttpDelete("flash-sales/{id:guid}")]
    public async Task<IActionResult> DeactivateFlashSale(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.FlashSalesManage)) return Forbid();
        var sale = await db.FlashSales.SingleOrDefaultAsync(x => x.Id == id, ct); if (sale is null) return NotFound();
        sale.IsActive = false; sale.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity("FLASH_SALE_DEACTIVATED", "FlashSale", id.ToString(), "true", "false")); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPut("status/{entity}/{id}")]
    public async Task<IActionResult> SetEntityStatus(string entity, string id, SetActiveRequest request, CancellationToken ct)
    {
        var key = entity.Trim().ToLowerInvariant();
        var permission = key switch
        {
            "product" or "category" or "brand" or "medicine" => AppPermissions.CatalogManage,
            "branch" or "supplier" or "delivery-zone" or "delivery-slot" => AppPermissions.BranchesManage,
            "customer" => AppPermissions.CustomersManage,
            "flash-sale" => AppPermissions.FlashSalesManage,
            "website-asset" => AppPermissions.WebsiteManage,
            "staff" or "coupon" or "payment-method" or "notification-template" or "homepage-section" or "navigation" or "popup" or "seo" or "media" or "role" => "SUPERADMIN_ONLY",
            _ => null,
        };
        if (permission is null) return BadRequest(new { message = "This record does not support an active status." });
        if (permission == "SUPERADMIN_ONLY" ? !IsSuperAdmin || !SuperAdminPath : !Can(permission)) return Forbid();

        if (key == "payment-method")
        {
            var method = await db.PaymentMethodConfigurations.SingleOrDefaultAsync(x => x.Code == id, ct);
            if (method is null) return NotFound();
            var previous = method.IsEnabled.ToString(); method.IsEnabled = request.IsActive; method.UpdatedAt = DateTime.UtcNow;
            db.ActivityLogs.Add(Activity(request.IsActive ? "PAYMENT_METHOD_ACTIVATED" : "PAYMENT_METHOD_DEACTIVATED", "PaymentMethodConfiguration", id, previous, request.IsActive.ToString()));
            await db.SaveChangesAsync(ct);
            return Ok(new { entity = key, id, active = request.IsActive });
        }

        if (!Guid.TryParse(id, out var recordId)) return BadRequest(new { message = "The status record id is invalid." });
        var updated = key switch
        {
            "product" => await ApplyStatus(db.Products, recordId, "IsActive", "Product", request.IsActive, ct),
            "category" => await ApplyStatus(db.Categories, recordId, "IsActive", "Category", request.IsActive, ct),
            "brand" => await ApplyStatus(db.Brands, recordId, "IsActive", "Brand", request.IsActive, ct),
            "medicine" => await ApplyStatus(db.Medicines, recordId, "IsActive", "Medicine", request.IsActive, ct),
            "branch" => await ApplyStatus(db.Branches, recordId, "IsActive", "Branch", request.IsActive, ct),
            "supplier" => await ApplyStatus(db.Suppliers, recordId, "IsActive", "Supplier", request.IsActive, ct),
            "delivery-zone" => await ApplyStatus(db.DeliveryZones, recordId, "Enabled", "DeliveryZone", request.IsActive, ct),
            "delivery-slot" => await ApplyStatus(db.DeliverySlots, recordId, "Enabled", "DeliverySlot", request.IsActive, ct),
            "staff" => await ApplyStatus(db.StaffUsers, recordId, "IsActive", "StaffUser", request.IsActive, ct),
            "customer" => await ApplyStatus(db.Customers, recordId, "IsActive", "Customer", request.IsActive, ct),
            "flash-sale" => await ApplyStatus(db.FlashSales, recordId, "IsActive", "FlashSale", request.IsActive, ct),
            "notification-template" => await ApplyStatus(db.NotificationTemplates, recordId, "IsEnabled", "NotificationTemplate", request.IsActive, ct),
            "homepage-section" => await ApplyStatus(db.HomepageSections, recordId, "Enabled", "HomepageSection", request.IsActive, ct),
            "website-asset" => await ApplyStatus(db.WebsiteAssets, recordId, "Enabled", "WebsiteAsset", request.IsActive, ct),
            "navigation" => await ApplyStatus(db.NavigationMenuItems, recordId, "IsVisible", "NavigationMenuItem", request.IsActive, ct),
            "popup" => await ApplyStatus(db.PopupCampaigns, recordId, "IsActive", "PopupCampaign", request.IsActive, ct),
            "seo" => await ApplyStatus(db.SeoEntries, recordId, "IsActive", "SeoEntry", request.IsActive, ct),
            "media" => await ApplyStatus(db.MediaAssets, recordId, "IsActive", "MediaAsset", request.IsActive, ct),
            "role" => await ApplyStatus(db.AccessRoles, recordId, "IsActive", "AccessRole", request.IsActive, ct),
            _ => false,
        };
        return updated ? Ok(new { entity = key, id, active = request.IsActive }) : NotFound();
    }

    [HttpGet("system/health")]
    public async Task<ActionResult<object>> SystemHealth(CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var database = false; var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        try { database = await db.Database.CanConnectAsync(ct); } catch { database = false; }
        stopwatch.Stop();
        var prescriptionStorage = Path.Combine(AppContext.BaseDirectory, "App_Data", "prescriptions");
        var values = await IntegrationValues(ct);
        return Ok(new { backend = "healthy", database = database ? "connected" : "unavailable", databaseLatencyMs = stopwatch.ElapsedMilliseconds, prescriptionStorage = Directory.Exists(prescriptionStorage) ? "ready" : "not-created", environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production", currentTimeUtc = DateTime.UtcNow, ocr = string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OCR__TESSERACTPATH")) ? "not-configured" : "configured", email = IsEmailConfigured(values) ? "configured" : "not-configured", sms = IsConfigured(values, IntegrationSettingKeys.SmsProvider, IntegrationSettingKeys.SmsApiUrl, IntegrationSettingKeys.SmsApiKey, IntegrationSettingKeys.SmsSenderId) ? "configured" : "not-configured", whatsapp = IsConfigured(values, IntegrationSettingKeys.WhatsAppProvider, IntegrationSettingKeys.WhatsAppApiUrl, IntegrationSettingKeys.WhatsAppApiKey, IntegrationSettingKeys.WhatsAppBusinessNumber) ? "configured" : "not-configured" });
    }

    private async Task<string?> ValidatePurchaseOrder(CreatePurchaseOrderRequest request, CancellationToken ct)
    {
        if (request.Items is null || request.Items.Count == 0) return "A purchase order needs at least one item.";
        if (request.Items.GroupBy(x => x.ProductId).Any(x => x.Count() > 1)) return "Each product can appear only once in a purchase order.";
        if (request.Items.Any(x => x.Quantity <= 0 || x.UnitCost < 0)) return "Quantities must be positive and unit costs cannot be negative.";
        if (!await db.Suppliers.AnyAsync(x => x.Id == request.SupplierId && x.IsActive, ct)) return "Select an active supplier.";
        if (!await db.Branches.AnyAsync(x => x.Id == request.BranchId && x.IsActive, ct)) return "Select an active branch.";
        var productIds = request.Items.Select(x => x.ProductId).Distinct().ToList();
        var products = await db.Products.Include(x => x.Units).Where(x => productIds.Contains(x.Id) && x.IsActive).ToDictionaryAsync(x => x.Id, ct);
        if (products.Count != productIds.Count) return "All purchase-order products must be active catalog products.";
        foreach (var item in request.Items)
        {
            var product = products[item.ProductId];
            var unit = string.IsNullOrWhiteSpace(item.Unit) ? product.PurchaseUnit : item.Unit.Trim();
            if (PurchaseUnitMultiplier(product, unit) is null) return $"The purchase unit '{unit}' is not configured for {product.Name}.";
        }
        return null;
    }

    private static int? PurchaseUnitMultiplier(Product product, string unit)
    {
        if (unit.Equals(product.BaseUnit, StringComparison.OrdinalIgnoreCase) || unit.Equals("base", StringComparison.OrdinalIgnoreCase)) return 1;
        if (unit.Equals(product.PurchaseUnit, StringComparison.OrdinalIgnoreCase)) return product.PurchaseUnitToBase > 0 ? product.PurchaseUnitToBase : null;
        var configured = product.Units.FirstOrDefault(x => x.UnitName.Equals(unit, StringComparison.OrdinalIgnoreCase));
        if (configured is not null) return (configured.IsPurchaseUnit || unit.Equals(product.PurchaseUnit, StringComparison.OrdinalIgnoreCase)) && configured.MultiplierToBase > 0 ? configured.MultiplierToBase : null;
        return null;
    }

    private static AdminPurchaseOrderRow PurchaseOrderRow(PurchaseOrder order) => new(order.Id, order.OrderNumber, order.SupplierId, order.Supplier?.Name ?? "", order.BranchId, order.Branch?.Name ?? "", order.Status, order.ExpectedAt, order.TotalAmount, order.Items.Count, order.Items.Count(x => x.QuantityReceived > 0), order.CreatedAt);
    private static AdminPurchaseOrderDetail PurchaseOrderDetailRow(PurchaseOrder order) => new(order.Id, order.OrderNumber, order.SupplierId, order.Supplier?.Name ?? "", order.BranchId, order.Branch?.Name ?? "", order.Status, order.ExpectedAt, order.Notes, order.TotalAmount, order.CreatedAt, order.Items.OrderBy(x => x.CreatedAt).Select(x => new AdminPurchaseOrderItemRow(x.Id, x.ProductId, x.ProductName, x.Product?.Sku ?? "", x.QuantityOrdered, x.QuantityReceived, x.UnitCost, x.BatchNumber, x.ExpiryDate, x.Unit, x.UnitMultiplier)).ToList());

    private static string? ValidateCoupon(UpsertCouponRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Trim().Length > 80) return "Coupon code is required and must be at most 80 characters.";
        if (request.Type is not ("PERCENTAGE" or "FIXED")) return "Coupon type must be PERCENTAGE or FIXED.";
        if (request.Value <= 0 || request.Type == "PERCENTAGE" && request.Value > 100) return "Coupon value is invalid.";
        if (request.MinimumOrder < 0 || request.MaximumDiscount < 0 || request.UsageLimit < 0) return "Coupon limits cannot be negative.";
        if (request.StartsAt.HasValue && request.EndsAt.HasValue && request.StartsAt > request.EndsAt) return "Coupon end date must be after its start date.";
        return null;
    }

    private async Task<AdminOrderDetailResponse?> LoadAdminOrderDetail(Guid id, CancellationToken ct)
    {
        var order = await ScopeOrders(db.Orders.AsNoTracking()).Where(x => x.Id == id).Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Pharmacist).Include(x => x.DeliverySlot).Include(x => x.Address).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Prescription).Include(x => x.StatusHistory).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.DeliveryStaff).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.CurrentLocation).Include(x => x.Invoice).Include(x => x.Documents).SingleOrDefaultAsync(ct);
        if (order is null) return null;
        return new AdminOrderDetailResponse(order.Id, order.OrderNumber, order.OrderCustomerName ?? order.Customer?.FullName ?? "", order.OrderCustomerEmail ?? order.Customer?.Email ?? "", order.OrderCustomerPhone ?? order.Customer?.Phone ?? "", order.CreatedAt, order.Status, order.PaymentStatus, order.PaymentMethod, order.Total, order.DeliveryFee, order.DiscountAmount, order.CouponCode, order.DeliveryInstructions, order.Address is null ? null : new StaffAddressItem(order.Address.Label, order.Address.Province, order.Address.District, order.Address.Municipality, order.Address.Ward, order.Address.StreetTole, order.Address.Landmark, order.Address.Phone, order.Address.Latitude, order.Address.Longitude), order.Items.Select(x => new StaffOrderItem(x.Id, x.ProductName, x.Quantity, x.UnitPrice, x.Product?.Sku ?? "", x.Product?.Medicine?.PrescriptionRequired ?? false)).ToList(), order.Prescription is null ? null : new StaffPrescriptionSummary(order.Prescription.Id, order.Prescription.Status, order.Prescription.CustomerNote), order.StatusHistory.OrderBy(x => x.CreatedAt).Select(x => new StatusHistoryItem(x.Status, x.Note, x.ActorId, x.ActorRole, x.CreatedAt)).ToList(), order.DeliveryAssignment is null ? null : new DeliverySummary(order.DeliveryAssignment.Id, order.DeliveryAssignment.DeliveryStaffId, order.DeliveryAssignment.DeliveryStaff?.FullName ?? "", order.DeliveryAssignment.Status, order.DeliveryAssignment.AcceptedAt, order.DeliveryAssignment.PickedUpAt, order.DeliveryAssignment.OutForDeliveryAt, order.DeliveryAssignment.DeliveredAt, order.DeliveryAssignment.FailedAt, order.DeliveryAssignment.FailureReason, order.DeliveryAssignment.Notes, CurrentLocation: order.DeliveryAssignment.CurrentLocation is null ? null : new DeliveryCurrentLocation(order.DeliveryAssignment.CurrentLocation.Latitude, order.DeliveryAssignment.CurrentLocation.Longitude, order.DeliveryAssignment.CurrentLocation.AccuracyMeters, DateTime.SpecifyKind(order.DeliveryAssignment.CurrentLocation.UpdatedAt, DateTimeKind.Utc)), ArrivedAt: order.DeliveryAssignment.ArrivedAt), order.Branch?.Name, order.BranchId, order.PharmacistId, order.Pharmacist?.FullName, order.DeliveryAssignment?.DeliveryStaffId, order.Invoice?.InvoiceNumber, order.CustomerNotes, order.OrderMode, order.SupervisorId, order.AssignedStaffUserId, order.Documents.OrderByDescending(x => x.CreatedAt).Select(x => new OrderDocumentRow(x.Id, x.Kind, x.OriginalFileName, x.ContentType, x.Length, x.CreatedAt, $"/api/{(SuperAdminPath ? "superadmin" : "admin")}/orders/{order.Id}/documents/{x.Id}")).ToList());
    }

    private async Task<AdminInvoiceResponse?> EnsureInvoice(Guid orderId, CancellationToken ct)
    {
        var order = await ScopeOrders(db.Orders).Include(x => x.Items).Include(x => x.Invoice).SingleOrDefaultAsync(x => x.Id == orderId, ct);
        if (order is null) return null;
        var invoice = order.Invoice;
        if (invoice is null)
        {
            var subtotal = order.Items.Sum(x => x.Quantity * x.UnitPrice);
            var prefix = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "invoice.prefix").Select(x => x.Value).SingleOrDefaultAsync(ct) ?? "ANHH-INV";
            invoice = new Invoice { OrderId = order.Id, InvoiceNumber = $"{prefix.Trim()}-{order.OrderNumber}", Subtotal = subtotal, TaxAmount = 0, DiscountAmount = order.DiscountAmount, DeliveryFee = order.DeliveryFee, Total = order.Total, IssuedAt = DateTime.UtcNow };
            db.Invoices.Add(invoice);
            db.ActivityLogs.Add(Activity("INVOICE_GENERATED", "Invoice", invoice.Id.ToString(), null, invoice.InvoiceNumber));
            await db.SaveChangesAsync(ct);
        }
        return new AdminInvoiceResponse(invoice.Id, invoice.InvoiceNumber, order.Id, order.OrderNumber, invoice.Subtotal, invoice.TaxAmount, invoice.DiscountAmount, invoice.DeliveryFee, invoice.Total, invoice.IssuedAt);
    }

    private async Task<string?> ValidateFlashSale(UpsertFlashSaleRequest request, Guid? existingId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 180) return "Sale name is required and must be at most 180 characters.";
        if (request.DiscountPercent <= 0 || request.DiscountPercent > 100) return "Discount must be between 0.01 and 100 percent.";
        if (request.StartsAt >= request.EndsAt) return "Sale end date must be after its start date.";
        if (request.QuantityLimit is <= 0) return "Quantity limit must be greater than zero.";
        if (!await db.Products.AnyAsync(x => x.Id == request.ProductId && x.IsActive, ct)) return "Select an active product.";
        if (request.BranchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == request.BranchId.Value && x.IsActive, ct)) return "Select an active branch.";
        var starts = ApplicationTime.ToUtc(request.StartsAt); var ends = ApplicationTime.ToUtc(request.EndsAt);
        if (await db.FlashSales.AnyAsync(x => x.Id != existingId && x.ProductId == request.ProductId && x.IsActive && (x.BranchId == request.BranchId || x.BranchId == null || request.BranchId == null) && starts < x.EndsAt && ends > x.StartsAt, ct)) return "Another active sale overlaps this product and schedule.";
        return null;
    }

    private static string? ValidateTemplate(UpsertNotificationTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Trim().Length > 80) return "Template code is required and must be at most 80 characters.";
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 160) return "Template name is required and must be at most 160 characters.";
        if (request.Channel.Trim().ToUpperInvariant() is not ("IN_APP" or "EMAIL" or "SMS")) return "Channel must be IN_APP, EMAIL or SMS.";
        if (string.IsNullOrWhiteSpace(request.Body) || request.Body.Trim().Length > 4000) return "Template body is required and must be at most 4,000 characters.";
        return null;
    }

    private static string? ValidateArticle(UpsertHealthArticleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Slug) || request.Slug.Trim().Length > 220) return "Article slug is required and must be at most 220 characters.";
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 240) return "Article title is required and must be at most 240 characters.";
        if (string.IsNullOrWhiteSpace(request.Content)) return "Article content is required.";
        if (request.Status.Trim().ToUpperInvariant() is not ("DRAFT" or "PUBLISHED" or "SCHEDULED" or "ARCHIVED")) return "Article status is invalid.";
        if (request.Status.Trim().Equals("SCHEDULED", StringComparison.OrdinalIgnoreCase) && !request.ScheduledAt.HasValue) return "A scheduled article requires a scheduled date.";
        return null;
    }

    private async Task<string?> ValidateNavigation(UpsertNavigationMenuItemRequest request, Guid? existingId, CancellationToken ct)
    {
        var menu = request.MenuKey.Trim().ToLowerInvariant();
        if (menu is not ("header" or "mobile" or "footer" or "account")) return "Menu must be header, mobile, footer, or account.";
        if (string.IsNullOrWhiteSpace(request.Label) || request.Label.Trim().Length > 160) return "Navigation label is required and must be at most 160 characters.";
        if (string.IsNullOrWhiteSpace(request.Url) || request.Url.Trim().Length > 500) return "Navigation URL is required and must be at most 500 characters.";
        var url = request.Url.Trim();
        var isAbsoluteUrl = Uri.TryCreate(url, UriKind.Absolute, out var parsedUrl);
        if (!url.StartsWith('/') && (!isAbsoluteUrl || parsedUrl is null || parsedUrl.Scheme is not ("http" or "https"))) return "Navigation URLs must be local paths or HTTP(S) links.";
        if (existingId.HasValue && request.ParentId == existingId) return "A navigation item cannot be its own parent.";
        if (request.ParentId.HasValue)
        {
            var parent = await db.NavigationMenuItems.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.ParentId.Value, ct);
            if (parent is null || !parent.MenuKey.Equals(menu, StringComparison.OrdinalIgnoreCase)) return "The parent item must exist in the same menu.";
        }
        return null;
    }

    private async Task<ActionResult<AdminPopupCampaign>> SavePopup(Guid? id, UpsertPopupCampaignRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var validation = ValidatePopup(request); if (validation is not null) return BadRequest(new { message = validation });
        var item = id is null ? new PopupCampaign { Kind = request.Kind.Trim().ToUpperInvariant(), Title = request.Title.Trim() } : await db.PopupCampaigns.SingleOrDefaultAsync(x => x.Id == id.Value, ct);
        if (item is null) return NotFound();
        var previous = id is null ? null : JsonSerializer.Serialize(new { item.Kind, item.Title, item.IsActive, item.StartsAt, item.EndsAt });
        item.Kind = request.Kind.Trim().ToUpperInvariant(); item.Title = request.Title.Trim(); item.Description = CleanOptional(request.Description); item.ImageUrl = CleanOptional(request.ImageUrl); item.ButtonText = CleanOptional(request.ButtonText); item.Destination = CleanOptional(request.Destination); item.DelaySeconds = request.DelaySeconds; item.Frequency = request.Frequency.Trim().ToUpperInvariant(); item.Audience = request.Audience.Trim().ToUpperInvariant(); item.MobileEnabled = request.MobileEnabled; item.DesktopEnabled = request.DesktopEnabled; item.StartsAt = request.StartsAt.HasValue ? ApplicationTime.ToUtc(request.StartsAt.Value) : null; item.EndsAt = request.EndsAt.HasValue ? ApplicationTime.ToUtc(request.EndsAt.Value) : null; item.IsActive = request.IsActive; item.UpdatedAt = DateTime.UtcNow;
        if (id is null) db.PopupCampaigns.Add(item);
        db.ActivityLogs.Add(Activity(id is null ? "POPUP_CREATED" : "POPUP_UPDATED", "PopupCampaign", item.Id.ToString(), previous, JsonSerializer.Serialize(new { item.Kind, item.Title, item.IsActive, item.StartsAt, item.EndsAt }))); await db.SaveChangesAsync(ct); return Ok(PopupRow(item));
    }

    private static string? ValidatePopup(UpsertPopupCampaignRequest request)
    {
        if (request.Kind.Trim().ToUpperInvariant() is not ("WELCOME" or "DISCOUNT" or "COUPON" or "PRESCRIPTION_REMINDER" or "NEWSLETTER" or "CAMPAIGN" or "ANNOUNCEMENT" or "MAINTENANCE" or "COOKIE")) return "Popup type is invalid.";
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 220) return "Popup title is required and must be at most 220 characters.";
        if (request.DelaySeconds is < 0 or > 86400) return "Popup delay must be between 0 and 86,400 seconds.";
        if (request.Frequency.Trim().ToUpperInvariant() is not ("ALWAYS" or "ONCE_PER_SESSION" or "ONCE_PER_DAY" or "ONCE_PER_USER")) return "Popup frequency is invalid.";
        if (request.Audience.Trim().ToUpperInvariant() is not ("ALL" or "GUESTS" or "LOGGED_IN")) return "Popup audience is invalid.";
        if (request.StartsAt.HasValue && request.EndsAt.HasValue && request.StartsAt > request.EndsAt) return "Popup end date must be after its start date.";
        return null;
    }

    private async Task<ActionResult<AdminSeoEntry>> SaveSeo(Guid? id, UpsertSeoEntryRequest request, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        var validation = ValidateSeo(request); if (validation is not null) return BadRequest(new { message = validation });
        var scope = request.Scope.Trim().ToUpperInvariant(); var path = NormalizePath(request.Path);
        if (await db.SeoEntries.AnyAsync(x => x.Id != id && x.Scope == scope && x.Path == path, ct)) return Conflict(new { message = "SEO metadata already exists for this scope and path." });
        var item = id is null ? new SeoEntry { Scope = scope, Path = path } : await db.SeoEntries.SingleOrDefaultAsync(x => x.Id == id.Value, ct);
        if (item is null) return NotFound();
        var previous = id is null ? null : JsonSerializer.Serialize(new { item.Scope, item.Path, item.Title, item.MetaDescription, item.IsActive });
        item.Scope = scope; item.Path = path; item.Title = CleanOptional(request.Title); item.MetaDescription = CleanOptional(request.MetaDescription); item.Keywords = CleanOptional(request.Keywords); item.OgTitle = CleanOptional(request.OgTitle); item.OgDescription = CleanOptional(request.OgDescription); item.OgImageUrl = CleanOptional(request.OgImageUrl); item.CanonicalUrl = CleanOptional(request.CanonicalUrl); item.Robots = string.IsNullOrWhiteSpace(request.Robots) ? "index,follow" : request.Robots.Trim(); item.IsActive = request.IsActive; item.UpdatedAt = DateTime.UtcNow;
        if (id is null) db.SeoEntries.Add(item);
        db.ActivityLogs.Add(Activity(id is null ? "SEO_CREATED" : "SEO_UPDATED", "SeoEntry", item.Id.ToString(), previous, JsonSerializer.Serialize(new { item.Scope, item.Path, item.Title, item.MetaDescription, item.IsActive }))); await db.SaveChangesAsync(ct); return Ok(SeoRow(item));
    }

    private static string? ValidateSeo(UpsertSeoEntryRequest request)
    {
        if (request.Scope.Trim().ToUpperInvariant() is not ("GLOBAL" or "PAGE" or "PRODUCT" or "CATEGORY" or "BRAND")) return "SEO scope is invalid.";
        if (string.IsNullOrWhiteSpace(request.Path) || request.Path.Trim().Length > 500) return "SEO path is required and must be at most 500 characters.";
        if (request.Title?.Length > 240 || request.MetaDescription?.Length > 500 || request.Keywords?.Length > 1000 || request.OgTitle?.Length > 240 || request.OgDescription?.Length > 500 || request.OgImageUrl?.Length > 500 || request.CanonicalUrl?.Length > 500) return "One or more SEO fields are too long.";
        if (string.IsNullOrWhiteSpace(request.Robots) || request.Robots.Trim().Length > 120) return "Robots policy is required and must be at most 120 characters.";
        return null;
    }

    private static string NormalizePath(string path) => path.Trim().StartsWith('/') ? path.Trim() : $"/{path.Trim()}";

    private static AdminNavigationMenuItem NavigationRow(NavigationMenuItem item) => new(item.Id, item.MenuKey, item.Label, item.Url, item.ParentId, item.Icon, item.DisplayOrder, item.IsVisible, item.OpenInNewTab, item.UpdatedAt);
    private static AdminPopupCampaign PopupRow(PopupCampaign item) => new(item.Id, item.Kind, item.Title, item.Description, item.ImageUrl, item.ButtonText, item.Destination, item.DelaySeconds, item.Frequency, item.Audience, item.MobileEnabled, item.DesktopEnabled, item.StartsAt, item.EndsAt, item.IsActive, item.UpdatedAt);
    private static AdminSeoEntry SeoRow(SeoEntry item) => new(item.Id, item.Scope, item.Path, item.Title, item.MetaDescription, item.Keywords, item.OgTitle, item.OgDescription, item.OgImageUrl, item.CanonicalUrl, item.Robots, item.IsActive, item.UpdatedAt);
    private static AdminMediaAsset MediaRow(MediaAsset item) => new(item.Id, item.OriginalFileName, item.ContentType, item.Length, item.Sha256, item.Kind, item.AltText, $"/api/site/media/{item.Id}", item.IsPublic, item.IsActive, item.CreatedAt);
    private static AdminBackupRow BackupRow(SystemBackup item) => new(item.Id, item.FileName, item.Status, item.Provider, item.SizeBytes, item.Sha256, item.FailureReason, item.CreatedBy, item.CreatedAt, item.CompletedAt);

    private static string? CleanOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static bool IsSafePublicMediaUrl(string value) => value.Length <= 2000
        && (value.StartsWith("/", StringComparison.Ordinal) && !value.StartsWith("//", StringComparison.Ordinal) && !value.Contains('\\')
            || Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps);

    private static string Csv(string? value) => $"\"{(value ?? string.Empty).Replace("\"", "\"\"")}\"";
    private static string Money(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture);

    private async Task<Dictionary<string, string>> IntegrationValues(CancellationToken ct)
    {
        var rows = await db.SystemSettings.AsNoTracking().Where(x => x.Key.StartsWith(IntegrationSettingKeys.Prefix)).ToListAsync(ct);
        return rows.ToDictionary(x => x.Key, x => IntegrationSettingKeys.IsSecret(x.Key) ? secrets.Unprotect(x.Value) ?? string.Empty : x.Value, StringComparer.OrdinalIgnoreCase);
    }

    private async Task SaveIntegration(string key, string? value, bool secret, CancellationToken ct)
    {
        var item = await db.SystemSettings.SingleOrDefaultAsync(x => x.Key == key, ct);
        var normalized = value?.Trim() ?? string.Empty;
        if (item is null)
        {
            item = new SystemSetting { Key = key, Value = secret && normalized.Length > 0 ? secrets.Protect(normalized) : normalized, Group = "integrations", IsPublic = false, Description = "Managed by the protected integrations settings." };
            db.SystemSettings.Add(item);
        }
        else if (!secret || normalized.Length > 0)
        {
            item.Value = secret && normalized.Length > 0 ? secrets.Protect(normalized) : normalized;
            item.Group = "integrations"; item.IsPublic = false; item.UpdatedAt = DateTime.UtcNow;
        }
    }

    private void SetSetting(Dictionary<string, SystemSetting> settings, string key, string value, string group, bool isPublic, string description)
    {
        if (!settings.TryGetValue(key, out var item))
        {
            item = new SystemSetting { Key = key, Value = value, Group = group, IsPublic = isPublic, Description = description };
            settings[key] = item;
            db.SystemSettings.Add(item);
            return;
        }
        item.Value = value; item.Group = group; item.IsPublic = isPublic; item.Description = description; item.UpdatedAt = DateTime.UtcNow;
    }

    private async Task<EmailIntegrationStatus> EmailStatus(CancellationToken ct)
    {
        var values = await IntegrationValues(ct);
        return new EmailIntegrationStatus(IsEmailConfigured(values), Get(values, IntegrationSettingKeys.EmailHost), IntValue(values, IntegrationSettingKeys.EmailPort), Get(values, IntegrationSettingKeys.EmailUsername), Get(values, IntegrationSettingKeys.EmailSenderName), Get(values, IntegrationSettingKeys.EmailSenderEmail), Get(values, IntegrationSettingKeys.EmailEncryption) ?? "STARTTLS");
    }

    private async Task<SmsIntegrationStatus> SmsStatus(CancellationToken ct)
    {
        var values = await IntegrationValues(ct);
        return new SmsIntegrationStatus(IsConfigured(values, IntegrationSettingKeys.SmsProvider, IntegrationSettingKeys.SmsApiUrl, IntegrationSettingKeys.SmsApiKey, IntegrationSettingKeys.SmsSenderId), Get(values, IntegrationSettingKeys.SmsProvider), Get(values, IntegrationSettingKeys.SmsApiUrl), Get(values, IntegrationSettingKeys.SmsSenderId), IntValue(values, IntegrationSettingKeys.SmsOtpExpiryMinutes) ?? 10, IntValue(values, IntegrationSettingKeys.SmsOtpLength) ?? 6, IntValue(values, IntegrationSettingKeys.SmsRateLimit) ?? 5, IntValue(values, IntegrationSettingKeys.SmsRetryLimit) ?? 3);
    }

    private async Task<WhatsAppIntegrationStatus> WhatsAppStatus(CancellationToken ct)
    {
        var values = await IntegrationValues(ct);
        return new WhatsAppIntegrationStatus(IsConfigured(values, IntegrationSettingKeys.WhatsAppProvider, IntegrationSettingKeys.WhatsAppApiUrl, IntegrationSettingKeys.WhatsAppApiKey, IntegrationSettingKeys.WhatsAppBusinessNumber), Get(values, IntegrationSettingKeys.WhatsAppProvider), Get(values, IntegrationSettingKeys.WhatsAppApiUrl), Get(values, IntegrationSettingKeys.WhatsAppBusinessNumber), Get(values, IntegrationSettingKeys.WhatsAppTemplates));
    }

    private async Task<AssistantIntegrationStatus> AssistantStatus(CancellationToken ct)
    {
        var values = await IntegrationValues(ct);
        var enabledValue = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "assistant.enabled").Select(x => x.Value).SingleOrDefaultAsync(ct);
        var provider = Get(values, IntegrationSettingKeys.AssistantProvider) ?? "OPENAI";
        return new AssistantIntegrationStatus(!bool.TryParse(enabledValue, out var enabled) || enabled, !string.IsNullOrWhiteSpace(Get(values, IntegrationSettingKeys.AssistantApiKey)), provider, Get(values, IntegrationSettingKeys.AssistantModel) ?? "gpt-4o-mini", Get(values, IntegrationSettingKeys.AssistantBaseUrl) ?? "https://api.openai.com/v1");
    }

    private static bool IsEmailConfigured(IReadOnlyDictionary<string, string> values) => IsConfigured(values, IntegrationSettingKeys.EmailHost, IntegrationSettingKeys.EmailPort, IntegrationSettingKeys.EmailUsername, IntegrationSettingKeys.EmailPassword, IntegrationSettingKeys.EmailSenderEmail);
    private static bool IsConfigured(IReadOnlyDictionary<string, string> values, params string[] keys) => keys.All(key => values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value));
    private static string? Get(IReadOnlyDictionary<string, string> values, string key) => values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : null;
    private static int? IntValue(IReadOnlyDictionary<string, string> values, string key) => int.TryParse(Get(values, key), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : null;

    private static string? ValidateRole(UpsertRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 60) return "Role name is required and must be at most 60 characters.";
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 120) return "Role display name is required and must be at most 120 characters.";
        if (request.Permissions is null) return "Select at least zero or more valid permissions.";
        return null;
    }

    private static AdminRoleRow RoleRow(AccessRole role) => new(role.Id, role.Name, role.DisplayName, role.Description, role.IsActive, role.IsSystem, role.RolePermissions.Where(x => x.Permission is not null).Select(x => x.Permission!.Key).OrderBy(x => x).ToArray(), role.CreatedAt);

    private static AdminNotificationTemplateRow TemplateRow(NotificationTemplate template) => new(template.Id, template.Code, template.Name, template.Channel, template.Subject, template.Body, template.Variables, template.IsEnabled, template.UpdatedAt);

    private static AdminHealthArticleRow ArticleRow(HealthArticle article) => new(article.Id, article.Slug, article.Title, article.Excerpt, article.Content, article.Category, article.TagsCsv, article.AuthorName, article.FeaturedImageUrl, article.Status, article.SeoTitle, article.MetaDescription, article.PublishedAt, article.ScheduledAt, article.IsFeatured, article.UpdatedAt);

    private static string[] EffectivePermissions(StaffUser staff) => string.IsNullOrWhiteSpace(staff.PermissionsCsv) ? AppPermissions.DefaultsFor(staff.Role).OrderBy(x => x).ToArray() : staff.PermissionsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToArray();

    private static AdminFlashSaleRow FlashSaleRow(FlashSale sale, DateTime now)
    {
        var status = !sale.IsActive ? "INACTIVE" : sale.StartsAt > now ? "SCHEDULED" : sale.EndsAt <= now ? "EXPIRED" : sale.QuantityLimit.HasValue && sale.QuantitySold >= sale.QuantityLimit.Value ? "SOLD_OUT" : "ACTIVE";
        return new AdminFlashSaleRow(sale.Id, sale.Name, sale.ProductId, sale.Product?.Name ?? "", sale.BranchId, sale.Branch?.Name, sale.DiscountPercent, sale.QuantityLimit, sale.QuantitySold, sale.StartsAt, sale.EndsAt, sale.IsActive, status);
    }

    private static AdminSupportTicketRow TicketRow(SupportTicket ticket) => new(ticket.Id, ticket.TicketNumber, ticket.Customer?.FullName ?? "", ticket.Customer?.Email ?? "", ticket.Subject, ticket.Description, ticket.Status, ticket.Priority, ticket.Category, ticket.Resolution, ticket.AssignedStaff?.FullName, ticket.CreatedAt, ticket.ResolvedAt);

    private static SalesExecutiveAssignmentRow AssignmentRow(SalesExecutiveProductAssignment item)
    {
        var executive = item.SalesExecutiveUser!;
        var territory = executive.Branch is null ? null : string.Join(", ", new[] { executive.Branch.District, executive.Branch.Municipality }.Where(value => !string.IsNullOrWhiteSpace(value)));
        return new SalesExecutiveAssignmentRow(item.Id, item.SalesExecutiveUserId, executive.FullName, item.ProductId, item.Product?.Name,
            item.CategoryId, item.Category?.Name, item.IsActive, item.CreatedAt, executive.Phone, executive.Email, executive.Branch?.Name, territory,
            executive.BranchId, item.Product?.Sku, item.Product?.Brand?.Name, item.Product?.Medicine?.Category?.Name, item.Product?.SellingPrice);
    }

    private async Task<AdminProductRow?> ProductRow(Guid id, CancellationToken ct) { var x = await db.Products.AsNoTracking().Include(x => x.Medicine).ThenInclude(x => x!.Category).Include(x => x.Brand).Include(x => x.Inventory).Include(x => x.Images).Include(x => x.Units).SingleOrDefaultAsync(x => x.Id == id, ct); return x is null ? null : ProductRowFromEntity(x); }

    private static string NormalizeImportHeader(string value) => Regex.Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", "");

    private sealed record CatalogWorkbookRow(int RowNumber, string CompanyCode, string CompanyName, string ProductName, bool IsValid, bool IsDuplicate, bool WillUpdate, IReadOnlyList<string> Errors, string ImageStatus, decimal DemandScore, string DemandBasis, string? DemandSourceUrl = null, string? DemandSourceReference = null);
    private sealed record CatalogDemand(decimal Score, string? SourceUrl, string? Reference);
    private const string DdaEssentialMedicinesUrl = "https://www.dda.gov.np/content/38/national-list-of-essential-medicines-nepal--sixth/";
    private const string WhoEssentialMedicinesUrl = "https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02";
    private static string NormalizeCatalogKey(string value) => Regex.Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", " ").Trim();
    private static string CatalogIdentity(string code, string company, string product) => $"{NormalizeCatalogKey(code)}|{NormalizeCatalogKey(company)}|{NormalizeCatalogKey(product)}";
    private static string CleanCatalogProductName(string value) => Regex.Replace(value.Replace('\u00a0', ' ').Trim(), "\\s+", " ");
    private static string CatalogCategory(string name)
    {
        var value = NormalizeCatalogKey(name);
        if (Regex.IsMatch(value, "\\b(glove|gauze|syringe|mask|thermometer|surgical|catheter|bandage|cotton|dressing)\\b")) return "Medical supplies";
        if (Regex.IsMatch(value, "\\b(vitamin|calcium|iron|zinc|protein|multivit|folic|omega|supplement)\\b")) return "Vitamins & supplements";
        if (Regex.IsMatch(value, "\\b(baby|diaper|infant|feeding|formula)\\b")) return "Baby care";
        if (Regex.IsMatch(value, "\\b(cream|lotion|serum|shampoo|conditioner|sunscreen|moistur|cosmetic|soap|face|hair|skin)\\b")) return "Personal care";
        if (Regex.IsMatch(value, "\\b(detergent|cleaner|repellent|house|home|phenyl)\\b")) return "Home care";
        return "Medicines";
    }
    private static CatalogDemand DemandForCatalogRow(string name, bool hasSales)
    {
        if (hasSales) return new(100, null, "Based on completed/non-cancelled order items in this website database");
        var value = NormalizeCatalogKey(name);
        var essential = new[] { "paracetamol", "acetaminophen", "ibuprofen", "amoxicillin", "azithromycin", "cetirizine", "omeprazole", "metformin", "insulin", "oral rehydration", "ors", "salbutamol", "amlodipine", "losartan", "atorvastatin", "doxycycline", "ciprofloxacin", "fluconazole", "hydrocortisone", "adrenaline", "diazepam", "sodium chloride" };
        var match = essential.FirstOrDefault(term => Regex.IsMatch(value, $"\\b{Regex.Escape(term)}\\b"));
        if (match is not null) return new(75, DdaEssentialMedicinesUrl, $"Product name matched the explicit essential-medicine proxy term '{match}'. This is a research proxy, not a sales forecast. WHO reference: {WhoEssentialMedicinesUrl}");
        if (Regex.IsMatch(value, "\\b(thermometer|glove|mask|gauze|bandage|vitamin|calcium|zinc|sunscreen|diaper)\\b")) return new(35, DdaEssentialMedicinesUrl, "Product name matched a healthcare or household-care demand proxy. This is not a sales forecast.");
        return new(0, null, null);
    }
    private static CatalogWorkbookPreviewResponse ToCatalogPreview(IReadOnlyList<CatalogWorkbookRow> rows) => new(rows.Select(x => new CatalogWorkbookPreviewRow(x.RowNumber, x.CompanyCode, x.CompanyName, x.ProductName, x.IsValid, x.IsDuplicate, x.WillUpdate, x.Errors, x.ImageStatus, x.DemandScore, x.DemandBasis)).ToList(), rows.Count, rows.Count(x => x.IsValid && !x.IsDuplicate), rows.Count(x => x.IsDuplicate), rows.Count(x => !x.IsValid), rows.Count(x => x.Errors.Any(error => error.Equals("blank row", StringComparison.OrdinalIgnoreCase))));

    private async Task<List<CatalogWorkbookRow>> ParseCatalogWorkbook(IFormFile workbook, CancellationToken ct)
    {
        var raw = await ReadProductSpreadsheet(workbook, ct); var headerIndex = raw.FindIndex(row => row.Select(NormalizeImportHeader).Take(3).SequenceEqual(new[] { "compcode", "compname", "product" }));
        if (headerIndex < 0) throw new InvalidDataException("The workbook must contain a header row with Compcode, Compname, and Product.");
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var existing = await db.Products.AsNoTracking().Where(x => x.CompanyCode != null && x.CompanyName != null).Select(x => new { x.CompanyCode, x.CompanyName, x.Name }).ToListAsync(ct); var existingKeys = existing.Select(x => CatalogIdentity(x.CompanyCode!, x.CompanyName!, x.Name)).ToHashSet(StringComparer.OrdinalIgnoreCase); var result = new List<CatalogWorkbookRow>();
        for (var index = headerIndex + 1; index < raw.Count; index++)
        {
            var row = raw[index]; var code = row.ElementAtOrDefault(0)?.Trim() ?? ""; var company = CleanCatalogProductName(row.ElementAtOrDefault(1) ?? ""); var name = CleanCatalogProductName(row.ElementAtOrDefault(2) ?? "");
            if (row.All(string.IsNullOrWhiteSpace)) { result.Add(new(index + 1, "", "", "", false, false, false, ["blank row"], "MISSING", 0, "NO_SALES_OR_RESEARCH_MATCH")); continue; }
            var errors = new List<string>(); if (string.IsNullOrWhiteSpace(code)) errors.Add("company code is required"); if (string.IsNullOrWhiteSpace(company)) errors.Add("company name is required"); if (string.IsNullOrWhiteSpace(name)) errors.Add("product name is required");
            var identity = CatalogIdentity(code, company, name); var duplicate = errors.Count == 0 && !seen.Add(identity); var update = errors.Count == 0 && !duplicate && existingKeys.Contains(identity); var demand = DemandForCatalogRow(name, false); if (duplicate) errors.Add("duplicate product in workbook");
            result.Add(new(index + 1, code, company, name, errors.Count == 0, duplicate, update, errors, "MISSING", demand.Score, demand.Score > 0 ? "MARKET_RESEARCH_PROXY" : "NO_SALES_OR_RESEARCH_MATCH", demand.SourceUrl, demand.Reference));
        }
        return result;
    }

    private sealed record ProductImportCandidate(int RowNumber, string ProductName, string? GenericName, string Category, string? Manufacturer, string Unit, string? BatchNumber, DateTime? ExpiryDate, decimal? PurchasePrice, decimal SalePrice, decimal DiscountPercent, string? BonusScheme, int? ReorderLevel, string? Barcode, string BranchName, Guid? BranchId, bool IsTrending, string? Description, IReadOnlyList<string> ImageFilenames, IReadOnlyList<string> Errors, bool WillUpdate)
    {
        public bool IsValid => Errors.Count == 0 && BranchId.HasValue;
    }

    private static ProductImportPreviewRow ToImportPreviewRow(ProductImportCandidate candidate) => new(candidate.RowNumber, candidate.ProductName, candidate.Category, candidate.BranchName, candidate.Barcode, candidate.SalePrice, candidate.IsTrending, candidate.ImageFilenames, candidate.IsValid, candidate.Errors, candidate.WillUpdate);

    private async Task<List<ProductImportCandidate>> ParseProductImport(IFormFile csv, IReadOnlySet<string> imageNames, CancellationToken ct)
    {
        var rows = await ReadProductSpreadsheet(csv, ct); if (rows.Count == 0) return [];
        var headers = rows[0].Select(NormalizeImportHeader).ToList();
        string Cell(IReadOnlyList<string> row, params string[] names) { foreach (var name in names) { var index = headers.IndexOf(NormalizeImportHeader(name)); if (index >= 0 && index < row.Count) return row[index].Trim(); } return ""; }
        var branches = await db.Branches.AsNoTracking().Where(x => x.IsActive).Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var result = new List<ProductImportCandidate>();
        for (var index = 1; index < rows.Count; index++)
        {
            var row = rows[index]; if (row.All(string.IsNullOrWhiteSpace)) continue;
            var errors = new List<string>(); var name = Cell(row, "product_name"); var category = Cell(row, "category"); var unit = Cell(row, "unit"); var branchName = Cell(row, "branch_name");
            if (string.IsNullOrWhiteSpace(name)) errors.Add("product_name is required"); if (string.IsNullOrWhiteSpace(category)) errors.Add("category is required"); if (string.IsNullOrWhiteSpace(unit)) errors.Add("unit is required"); if (string.IsNullOrWhiteSpace(branchName)) errors.Add("branch_name is required");
            var branch = branches.FirstOrDefault(x => string.Equals(x.Name, branchName, StringComparison.OrdinalIgnoreCase)); if (!string.IsNullOrWhiteSpace(branchName) && branch is null) errors.Add($"branch '{branchName}' does not exist or is inactive");
            var saleText = Cell(row, "sale_price").Replace(",", ""); decimal sale = 0; if (!decimal.TryParse(saleText, NumberStyles.Number, CultureInfo.InvariantCulture, out sale) || sale < 0) errors.Add("sale_price must be a valid non-negative number");
            decimal? purchase = null; var purchaseText = Cell(row, "purchase_price").Replace(",", ""); if (!string.IsNullOrWhiteSpace(purchaseText)) { if (decimal.TryParse(purchaseText, NumberStyles.Number, CultureInfo.InvariantCulture, out var value) && value >= 0) purchase = value; else errors.Add("purchase_price must be a valid non-negative number"); }
            decimal discount = 0; var discountText = Cell(row, "discount_percent"); if (!string.IsNullOrWhiteSpace(discountText)) { if (decimal.TryParse(discountText, NumberStyles.Number, CultureInfo.InvariantCulture, out var value) && value is >= 0 and <= 100) discount = value; else errors.Add("discount_percent must be between 0 and 100"); }
            int? reorder = null; var reorderText = Cell(row, "reorder_level"); if (!string.IsNullOrWhiteSpace(reorderText)) { if (int.TryParse(reorderText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) && value >= 0) reorder = value; else errors.Add("reorder_level must be a non-negative whole number"); }
            DateTime? expiry = null; var expiryText = Cell(row, "expiry_date"); if (!string.IsNullOrWhiteSpace(expiryText)) { if (DateTime.TryParse(expiryText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var value)) expiry = DateTime.SpecifyKind(value.Date, DateTimeKind.Utc); else errors.Add("expiry_date must be a valid date"); }
            var trendText = Cell(row, "is_trending"); var trending = string.IsNullOrWhiteSpace(trendText) || trendText.Equals("no", StringComparison.OrdinalIgnoreCase) || trendText.Equals("false", StringComparison.OrdinalIgnoreCase) || trendText == "0" ? false : trendText.Equals("yes", StringComparison.OrdinalIgnoreCase) || trendText.Equals("true", StringComparison.OrdinalIgnoreCase) || trendText == "1"; if (!string.IsNullOrWhiteSpace(trendText) && !trending && !trendText.Equals("no", StringComparison.OrdinalIgnoreCase) && !trendText.Equals("false", StringComparison.OrdinalIgnoreCase) && trendText != "0") errors.Add("is_trending must be Yes or No");
            var filenames = Enumerable.Range(1, 5).Select(number => Cell(row, $"image_filename_{number}")).Where(value => !string.IsNullOrWhiteSpace(value)).Select(Path.GetFileName).Where(value => !string.IsNullOrWhiteSpace(value)).Cast<string>().Distinct(StringComparer.OrdinalIgnoreCase).ToList(); if (filenames.Count is < 1 or > 5) errors.Add("one to five image filenames are required"); foreach (var filename in filenames) if (!imageNames.Contains(filename)) errors.Add($"image '{filename}' was not uploaded");
            var barcode = Cell(row, "barcode"); var candidate = new ProductImportCandidate(index + 1, name, Cell(row, "generic_name"), category, Cell(row, "manufacturer"), unit, Cell(row, "batch_number"), expiry, purchase, sale, discount, Cell(row, "bonus_scheme"), reorder, string.IsNullOrWhiteSpace(barcode) ? null : barcode, branchName, branch?.Id, trending, Cell(row, "description"), filenames, errors, false);
            var existing = candidate.BranchId.HasValue ? await FindImportProduct(candidate, candidate.BranchId.Value, ct) : null; result.Add(candidate with { WillUpdate = existing is not null });
        }
        return result;
    }

    private static async Task<HashSet<string>> ReadImportImageNames(IEnumerable<IFormFile> files, IFormFile? zip, CancellationToken ct)
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase); foreach (var file in files) if (file.Length > 0) names.Add(Path.GetFileName(file.FileName));
        if (zip is not null) { await using var stream = zip.OpenReadStream(); using var archive = new ZipArchive(stream, ZipArchiveMode.Read); foreach (var entry in archive.Entries.Where(x => !string.IsNullOrWhiteSpace(x.Name))) names.Add(entry.Name); }
        return names;
    }

    private static async Task<Dictionary<string, (byte[] Bytes, string ContentType)>> ReadImportImageBytes(IEnumerable<IFormFile> files, IFormFile? zip, CancellationToken ct)
    {
        var output = new Dictionary<string, (byte[] Bytes, string ContentType)>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in files) { await using var stream = file.OpenReadStream(); using var memory = new MemoryStream(); await stream.CopyToAsync(memory, ct); var type = ImportContentType(Path.GetExtension(file.FileName)); if (type is not null) output[Path.GetFileName(file.FileName)] = (memory.ToArray(), type); }
        if (zip is not null) { await using var stream = zip.OpenReadStream(); using var archive = new ZipArchive(stream, ZipArchiveMode.Read); foreach (var entry in archive.Entries.Where(x => !string.IsNullOrWhiteSpace(x.Name))) { await using var source = entry.Open(); using var memory = new MemoryStream(); await source.CopyToAsync(memory, ct); var type = ImportContentType(Path.GetExtension(entry.Name)); if (type is not null && !output.ContainsKey(entry.Name)) output[entry.Name] = (memory.ToArray(), type); } }
        return output;
    }

    private static string? ImportContentType(string extension) => extension.ToLowerInvariant() switch { ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", ".gif" => "image/gif", ".bmp" => "image/bmp", ".avif" => "image/avif", _ => null };
    private async Task<Product?> FindImportProduct(ProductImportCandidate candidate, Guid branchId, CancellationToken ct)
    {
        var query = db.Products.Include(x => x.Inventory).Include(x => x.Images).Include(x => x.Medicine).AsQueryable();
        return !string.IsNullOrWhiteSpace(candidate.Barcode) ? await query.SingleOrDefaultAsync(x => x.Barcode == candidate.Barcode, ct) : await query.SingleOrDefaultAsync(x => x.Name == candidate.ProductName && x.Inventory.Any(i => i.BranchId == branchId), ct);
    }
    private async Task<string> UniqueImportSku(string requested, CancellationToken ct) { var value = requested; var suffix = 1; while (await db.Products.AnyAsync(x => x.Sku == value, ct)) value = $"{requested}-{suffix++}"; return value; }
    private async Task<string> UniqueImportBrandSlug(string requested, CancellationToken ct) { var baseSlug = string.IsNullOrWhiteSpace(requested) ? "imported-brand" : requested; var value = baseSlug; var suffix = 1; while (await db.Brands.AnyAsync(x => x.Slug == value, ct)) value = $"{baseSlug}-{suffix++}"; return value; }
    private async Task<string> UniqueImportSlug(string requested, string sku, CancellationToken ct) { var value = string.IsNullOrWhiteSpace(requested) ? $"product-{sku.ToLowerInvariant()}" : requested; if (!await db.Products.AnyAsync(x => x.Slug == value, ct)) return value; return $"{value}-{sku.ToLowerInvariant()}"; }
    private static string ImportSlug(string value) => Regex.Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');

    private static async Task<List<List<string>>> ReadProductSpreadsheet(IFormFile file, CancellationToken ct)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        await using var input = file.OpenReadStream();
        if (extension == ".csv")
        {
            using var reader = new StreamReader(input, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            var rows = new List<List<string>>();
            string? line; while ((line = await reader.ReadLineAsync(ct)) is not null) rows.Add(ParseCsvLine(line));
            return rows;
        }
        if (extension != ".xlsx") throw new InvalidDataException("Only CSV and XLSX spreadsheets are supported.");
        using var archive = new ZipArchive(input, ZipArchiveMode.Read);
        var shared = new List<string>();
        var sharedEntry = archive.GetEntry("xl/sharedStrings.xml");
        if (sharedEntry is not null) { using var sharedReader = new StreamReader(sharedEntry.Open()); var sharedXml = XDocument.Parse(await sharedReader.ReadToEndAsync(ct)); shared = sharedXml.Descendants(sharedXml.Root!.GetDefaultNamespace() + "si").Select(x => string.Concat(x.Descendants(sharedXml.Root.GetDefaultNamespace() + "t").Select(t => t.Value))).ToList(); }
        var sheet = archive.GetEntry("xl/worksheets/sheet1.xml") ?? throw new InvalidDataException("The XLSX workbook has no first worksheet.");
        using var sheetReader = new StreamReader(sheet.Open()); var xml = XDocument.Parse(await sheetReader.ReadToEndAsync(ct)); var ns = xml.Root!.GetDefaultNamespace(); var result = new List<List<string>>();
        foreach (var row in xml.Descendants(ns + "row"))
        {
            var rowNumber = int.TryParse(row.Attribute("r")?.Value, out var parsedRowNumber) ? parsedRowNumber : result.Count + 1;
            while (result.Count < rowNumber - 1) result.Add([]);
            var cells = new Dictionary<int, string>();
            foreach (var cell in row.Elements(ns + "c"))
            {
                var reference = cell.Attribute("r")?.Value ?? "A1"; var column = 0;
                foreach (var character in reference.TakeWhile(char.IsLetter)) column = column * 26 + char.ToUpperInvariant(character) - 'A' + 1;
                column--; var value = cell.Element(ns + "v")?.Value ?? "";
                if (cell.Attribute("t")?.Value == "s" && int.TryParse(value, out var sharedIndex) && sharedIndex < shared.Count) value = shared[sharedIndex];
                cells[column] = value;
            }
            var width = cells.Count == 0 ? 0 : cells.Keys.Max() + 1; var values = Enumerable.Range(0, width).Select(index => cells.TryGetValue(index, out var value) ? value : "").ToList(); result.Add(values);
        }
        return result;
    }

    private static List<string> ParseCsvLine(string line)
    {
        var values = new List<string>(); var value = new StringBuilder(); var quoted = false;
        for (var index = 0; index < line.Length; index++) { var character = line[index]; if (character == '"' && quoted && index + 1 < line.Length && line[index + 1] == '"') { value.Append('"'); index++; } else if (character == '"') quoted = !quoted; else if (character == ',' && !quoted) { values.Add(value.ToString()); value.Clear(); } else value.Append(character); }
        values.Add(value.ToString()); return values;
    }

    private static AdminProductRow ProductRowFromEntity(Product x)
    {
        var imageUrls = x.Images.OrderBy(image => image.DisplayOrder).Select(image => image.Url).Where(url => !IsPlaceholderImage(url)).ToList();
        if (imageUrls.Count == 0 && !string.IsNullOrWhiteSpace(x.ImageUrl) && !IsPlaceholderImage(x.ImageUrl)) imageUrls.Add(x.ImageUrl);
        var effectiveImageUrl = imageUrls.FirstOrDefault() ?? x.ImageUrl;
        return new AdminProductRow(x.Id, x.Name, x.Sku, x.Slug, x.MedicineId, x.BrandId, x.Brand?.Name ?? "", x.Medicine?.Category?.Name ?? "", x.Medicine?.GenericName ?? x.Medicine?.Name ?? "", x.Mrp, x.SellingPrice, x.IsActive, x.Medicine?.PrescriptionRequired ?? false, InventoryAvailability.ForProduct(x.Inventory, ApplicationTime.NepalNow.Date), x.CreatedAt, effectiveImageUrl, x.BonusScheme, imageUrls, x.IsTrending, x.IsHotDeal, x.BaseUnit, x.PurchaseUnit, x.PurchaseUnitToBase, x.Units.OrderBy(unit => unit.DisplayOrder).Select(unit => new ProductUnitOption(unit.UnitName, unit.MultiplierToBase, unit.IsPurchaseUnit, unit.IsSalesUnit)).ToList(), x.CompanyCode, x.CompanyName, x.ImageSourceUrl, x.ImageVerificationStatus, x.ImageSourceReference, x.DemandScore, x.DemandBasis, x.DemandSourceUrl, x.DemandSourceReference, x.DisplayOrder, x.ImportStatus, x.MissingImageStatus, x.ImageSourceWebsite, x.ImageSourcePageUrl, x.ImageSearchedAtUtc, x.ImageMatchingNotes, x.ImageMediaAssetId);
    }

    private static string[] NormalizeProductImageUrls(UpsertProductRequest request, out string? error)
    {
        IEnumerable<string?> source = request.ImageUrls is { Count: > 0 } ? request.ImageUrls!.Cast<string?>() : new[] { request.ImageUrl };
        var urls = source
            .Where(url => !string.IsNullOrWhiteSpace(url)).Select(url => url!.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        // A real managed image always wins over a stale placeholder record.
        if (urls.Any(url => !IsPlaceholderImage(url))) urls = urls.Where(url => !IsPlaceholderImage(url)).ToArray();
        error = urls.Length is < 1 or > 5 ? "Add between 1 and 5 product images." : urls.Any(url => !url.StartsWith("/api/site/media/", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase) && !url.Equals("/catalog-placeholder.svg", StringComparison.OrdinalIgnoreCase)) ? "Product images must come from the managed media library or the approved catalog placeholder." : null;
        return urls;
    }

    private static bool IsHttpUri(Uri uri) => uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) || uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);

    private static void AddProductImages(Product product, IReadOnlyList<string> urls)
    {
        for (var index = 0; index < urls.Count; index++) product.Images.Add(new ProductImage { ProductId = product.Id, Url = urls[index], DisplayOrder = index, AltText = product.Name, MissingImageStatus = IsPlaceholderImage(urls[index]) ? "MISSING" : "NOT_MISSING", MediaAssetId = ManagedMediaId(urls[index]) });
    }

    private static bool IsPlaceholderImage(string url) => url.Equals("/catalog-placeholder.svg", StringComparison.OrdinalIgnoreCase) || url.EndsWith("/catalog-placeholder.svg", StringComparison.OrdinalIgnoreCase);
    private static Guid? ManagedMediaId(string? url) => Guid.TryParse(url?.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault(), out var id) ? id : null;
    private static string? WebsiteFromUrl(string? url) => Uri.TryCreate(url, UriKind.Absolute, out var uri) && IsHttpUri(uri) ? uri.Host : null;
    private static AdminInventoryRow InventoryRow(Inventory x) => new(x.Id, x.ProductId, x.BranchId, x.Product?.Name ?? "", x.Product?.Sku ?? "", x.BatchNumber, x.Branch?.Name ?? "", x.StockQuantity, x.ReservedQuantity, Math.Max(0, x.StockQuantity - x.ReservedQuantity), x.MinimumStock, x.PurchasePrice, x.Product?.SellingPrice ?? 0, x.ExpiryDate, x.ExpiryDate < DateTime.UtcNow.Date ? "EXPIRED" : x.StockQuantity - x.ReservedQuantity <= 0 ? "OUT_OF_STOCK" : x.StockQuantity - x.ReservedQuantity <= x.MinimumStock ? "LOW_STOCK" : x.ExpiryDate <= DateTime.UtcNow.Date.AddDays(90) ? "NEAR_EXPIRY" : "IN_STOCK");
    private async Task<ActionResult<Category>> SaveCategory(Guid? id, UpsertCategoryRequest r, CancellationToken ct) { if (!Can(AppPermissions.CatalogManage)) return Forbid(); var e = id is null ? new Category { Name = r.Name.Trim(), Slug = r.Slug.Trim(), Description = r.Description, IsActive = r.IsActive } : await db.Categories.FindAsync([id.Value], ct); if (e is null) return NotFound(); e.Name = r.Name.Trim(); e.Slug = r.Slug.Trim(); e.Description = r.Description; e.IsActive = r.IsActive; e.UpdatedAt = DateTime.UtcNow; if (id is null) db.Categories.Add(e); db.ActivityLogs.Add(Activity(id is null ? "CATEGORY_CREATED" : "CATEGORY_UPDATED", "Category", e.Id.ToString(), null, e.Name)); await db.SaveChangesAsync(ct); return Ok(e); }
    private async Task<ActionResult<Brand>> SaveBrand(Guid? id, UpsertBrandRequest r, CancellationToken ct) { if (!Can(AppPermissions.CatalogManage)) return Forbid(); var e = id is null ? new Brand { Name = r.Name.Trim(), Slug = r.Slug.Trim(), IsActive = r.IsActive } : await db.Brands.FindAsync([id.Value], ct); if (e is null) return NotFound(); e.Name = r.Name.Trim(); e.Slug = r.Slug.Trim(); e.IsActive = r.IsActive; e.UpdatedAt = DateTime.UtcNow; if (id is null) db.Brands.Add(e); db.ActivityLogs.Add(Activity(id is null ? "BRAND_CREATED" : "BRAND_UPDATED", "Brand", e.Id.ToString(), null, e.Name)); await db.SaveChangesAsync(ct); return Ok(e); }
    private async Task<ActionResult<Branch>> SaveBranch(Guid? id, UpsertBranchRequest r, CancellationToken ct)
    {
        if (!Can(AppPermissions.BranchesManage) || IsBranchScoped && (!id.HasValue || !BranchAllowed(id.Value))) return Forbid();
        if (r.Latitude.HasValue != r.Longitude.HasValue
            || r.Latitude is < -90 or > 90
            || r.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Pickup coordinates must be a valid latitude/longitude pair." });
        var e = id is null ? new Branch { Name = r.Name.Trim(), Address = r.Address.Trim() } : await db.Branches.FindAsync([id.Value], ct);
        if (e is null) return NotFound();
        e.Name = r.Name.Trim(); e.Address = r.Address.Trim(); e.Code = r.Code; e.Phone = r.Phone; e.Email = r.Email;
        e.Province = r.Province; e.District = r.District; e.Municipality = r.Municipality; e.Ward = r.Ward;
        e.StreetTole = r.StreetTole; e.Landmark = r.Landmark; e.Latitude = r.Latitude; e.Longitude = r.Longitude;
        e.OpeningTime = r.OpeningTime; e.ClosingTime = r.ClosingTime; e.DeliveryEnabled = r.DeliveryEnabled;
        e.PickupEnabled = r.PickupEnabled; e.IsActive = r.IsActive; e.UpdatedAt = DateTime.UtcNow;
        if (id is null) db.Branches.Add(e);
        db.ActivityLogs.Add(Activity(id is null ? "BRANCH_CREATED" : "BRANCH_UPDATED", "Branch", e.Id.ToString(), null, e.Name));
        await db.SaveChangesAsync(ct);
        return Ok(e);
    }
    private async Task<ActionResult<Supplier>> SaveSupplier(Guid? id, UpsertSupplierRequest r, CancellationToken ct) { if (!Can(AppPermissions.BranchesManage)) return Forbid(); var e = id is null ? new Supplier { Name = r.Name.Trim() } : await db.Suppliers.FindAsync([id.Value], ct); if (e is null) return NotFound(); e.Name = r.Name.Trim(); e.ContactPerson = r.ContactPerson; e.Phone = r.Phone; e.Email = r.Email; e.Address = r.Address; e.TaxNumber = r.TaxNumber; e.IsActive = r.IsActive; e.UpdatedAt = DateTime.UtcNow; if (id is null) db.Suppliers.Add(e); await db.SaveChangesAsync(ct); return Ok(e); }
    private async Task<ActionResult<DeliveryZone>> SaveZone(Guid? id, UpsertZoneRequest r, CancellationToken ct) { if (!Can(AppPermissions.BranchesManage) || IsBranchScoped && (!r.BranchId.HasValue || !BranchAllowed(r.BranchId.Value))) return Forbid(); var e = id is null ? new DeliveryZone { Name = r.Name.Trim() } : await db.DeliveryZones.FindAsync([id.Value], ct); if (e is null || id.HasValue && IsBranchScoped && e.BranchId != SupervisorBranchId) return NotFound(); e.Name = r.Name.Trim(); e.Province = r.Province; e.District = r.District; e.Municipality = r.Municipality; e.Ward = r.Ward; e.BranchId = r.BranchId; e.DeliveryFee = r.DeliveryFee; e.FreeDeliveryThreshold = r.FreeDeliveryThreshold; e.MinimumOrder = r.MinimumOrder; e.SameDayDelivery = r.SameDayDelivery; e.Enabled = r.Enabled; e.UpdatedAt = DateTime.UtcNow; if (id is null) db.DeliveryZones.Add(e); await db.SaveChangesAsync(ct); return Ok(e); }
    private async Task<ActionResult<AdminDeliverySlot>> SaveDeliverySlot(Guid? id, UpsertDeliverySlotRequest r, CancellationToken ct)
    {
        if (!Can(AppPermissions.BranchesManage)) return Forbid();
        if (IsBranchScoped && (!r.BranchId.HasValue || !BranchAllowed(r.BranchId.Value))) return Forbid();
        if (string.IsNullOrWhiteSpace(r.Label) || !TimeOnly.TryParse(r.StartTime, out var start) || !TimeOnly.TryParse(r.EndTime, out var end) || start >= end) return BadRequest(new { message = "Enter a valid delivery slot with an end time after its start time." });
        if (r.MaxOrders is <= 0) return BadRequest(new { message = "Maximum orders must be greater than zero." });
        if (r.BranchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == r.BranchId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected branch is not active." });
        var e = id is null ? new DeliverySlot { Label = r.Label.Trim(), StartTime = start.ToString("HH:mm"), EndTime = end.ToString("HH:mm") } : await db.DeliverySlots.FindAsync([id.Value], ct);
        if (e is null || id.HasValue && IsBranchScoped && e.BranchId != SupervisorBranchId) return NotFound();
        e.Label = r.Label.Trim(); e.StartTime = start.ToString("HH:mm"); e.EndTime = end.ToString("HH:mm"); e.BranchId = r.BranchId; e.MaxOrders = r.MaxOrders; e.DisplayOrder = r.DisplayOrder; e.Enabled = r.Enabled; e.UpdatedAt = DateTime.UtcNow;
        if (id is null) db.DeliverySlots.Add(e);
        db.ActivityLogs.Add(Activity(id is null ? "DELIVERY_SLOT_CREATED" : "DELIVERY_SLOT_UPDATED", "DeliverySlot", e.Id.ToString(), null, e.Label));
        await db.SaveChangesAsync(ct);
        var branch = e.BranchId is null ? null : await db.Branches.FindAsync([e.BranchId.Value], ct);
        return Ok(new AdminDeliverySlot(e.Id, e.Label, e.StartTime, e.EndTime, e.BranchId, branch?.Name, e.MaxOrders, e.DisplayOrder, e.Enabled, e.UpdatedAt));
    }
    private async Task<ActionResult<AdminStaffRow>> SaveStaff(Guid? id, UpsertStaffRequest r, CancellationToken ct)
    {
        if (!IsSuperAdmin || !SuperAdminPath) return Forbid();
        if (string.IsNullOrWhiteSpace(r.FullName) || r.FullName.Trim().Length > 160 || string.IsNullOrWhiteSpace(r.Email) || r.Email.Trim().Length > 240 || string.IsNullOrWhiteSpace(r.Phone) || r.Phone.Trim().Length > 30)
            return BadRequest(new { message = "Name, email, and phone are required and must be within the supported lengths." });
        if (!new[] { StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.Accountant, StaffRoles.SalesExecutive, StaffRoles.SalesManager, StaffRoles.PurchaseInventoryManager, StaffRoles.HrManager, StaffRoles.ViewerAuditor, StaffRoles.Employee }.Contains(r.Role, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "The selected staff role is invalid." });
        if (r.EmployeeId?.Trim().Length > 80 || r.Address?.Trim().Length > 500 || r.LicenseReference?.Trim().Length > 120 || r.Department?.Trim().Length > 160 || r.JobTitle?.Trim().Length > 160 || r.AppointmentType?.Trim().Length > 100 || r.EmploymentStatus?.Trim().Length > 100 || r.OfficialEmail?.Trim().Length > 240 || r.Gender?.Trim().Length > 40 || r.MaritalStatus?.Trim().Length > 40 || r.TaxNumber?.Trim().Length > 80 || r.CitizenshipNumber?.Trim().Length > 100 || r.EmergencyContactName?.Trim().Length > 160 || r.EmergencyContactPhone?.Trim().Length > 30 || r.BloodGroup?.Trim().Length > 10 || r.DeviceEnrollmentId?.Trim().Length > 100) return BadRequest(new { message = "One or more staff profile fields are too long." });
        if (r.JoiningDate.HasValue && r.JoiningDate.Value.Date > DateTime.UtcNow.Date) return BadRequest(new { message = "Joining date cannot be in the future." });
        if (r.DateOfBirth.HasValue && r.DateOfBirth.Value.Date > DateTime.UtcNow.Date) return BadRequest(new { message = "Date of birth cannot be in the future." });
        var normalizedEmail = r.Email.Trim().ToLowerInvariant();
        var normalizedEmployeeId = CleanOptional(r.EmployeeId);
        if (await db.StaffUsers.AnyAsync(x => x.Email == normalizedEmail && x.Id != id, ct)) return Conflict(new { message = "A staff account already uses that email." });
        if (normalizedEmployeeId is not null && await db.StaffUsers.AnyAsync(x => x.EmployeeId == normalizedEmployeeId && x.Id != id, ct)) return Conflict(new { message = "That employee ID is already assigned." });
        var e = id is null ? new StaffUser { FullName = r.FullName.Trim(), Email = normalizedEmail, Phone = r.Phone.Trim(), PasswordHash = passwords.Hash(string.IsNullOrWhiteSpace(r.Password) ? "ChangeMe!123" : r.Password), Role = r.Role.ToUpperInvariant() } : await db.StaffUsers.FindAsync([id.Value], ct);
        if (e is null) return NotFound();
        e.FullName = r.FullName.Trim(); e.Email = normalizedEmail; e.Phone = r.Phone.Trim(); e.Role = r.Role.ToUpperInvariant(); e.BranchId = r.BranchId; e.LicenseReference = CleanOptional(r.LicenseReference); e.EmployeeId = normalizedEmployeeId; e.Address = CleanOptional(r.Address); e.JoiningDate = r.JoiningDate?.Date; e.Department = CleanOptional(r.Department); e.JobTitle = CleanOptional(r.JobTitle); e.AppointmentType = CleanOptional(r.AppointmentType); e.EmploymentStatus = CleanOptional(r.EmploymentStatus); e.OfficialEmail = CleanOptional(r.OfficialEmail); e.DateOfBirth = r.DateOfBirth?.Date; e.Gender = CleanOptional(r.Gender); e.MaritalStatus = CleanOptional(r.MaritalStatus); e.TaxNumber = CleanOptional(r.TaxNumber); e.CitizenshipNumber = CleanOptional(r.CitizenshipNumber); e.EmergencyContactName = CleanOptional(r.EmergencyContactName); e.EmergencyContactPhone = CleanOptional(r.EmergencyContactPhone); e.BloodGroup = CleanOptional(r.BloodGroup); e.DeviceEnrollmentId = CleanOptional(r.DeviceEnrollmentId); e.MobileAccessEnabled = r.MobileAccessEnabled; e.WebAccessEnabled = r.WebAccessEnabled; e.PermissionsCsv = r.Permissions is { Length: 0 } ? "__none__" : string.Join(',', r.Permissions ?? []); e.IsActive = r.IsActive; if (!string.IsNullOrWhiteSpace(r.Password)) e.PasswordHash = passwords.Hash(r.Password); e.UpdatedAt = DateTime.UtcNow;
        if (id is null) db.StaffUsers.Add(e);
        db.ActivityLogs.Add(Activity(id is null ? "USER_CREATED" : "USER_UPDATED", "StaffUser", e.Id.ToString(), null, e.Email));
        await db.SaveChangesAsync(ct);
        var b = e.BranchId is null ? null : await db.Branches.FindAsync([e.BranchId.Value], ct);
        return Ok(StaffRow(e, b?.Name));
    }
    private AdminStaffRow StaffRow(StaffUser staff, string? branchName, string? territory = null) => new(staff.Id, staff.FullName, staff.Email, staff.Phone, staff.Role, staff.BranchId, branchName, staff.IsActive, EffectivePermissions(staff), staff.CreatedAt, staff.EmployeeId, staff.Address, staff.JoiningDate, staff.ProfilePhotoStoredFileName is null ? null : $"/api/superadmin/staff/{staff.Id}/photo", new StaffHrProfileResponse(staff.Department, staff.JobTitle, staff.AppointmentType, staff.EmploymentStatus, staff.OfficialEmail, staff.DateOfBirth, staff.Gender, staff.MaritalStatus, staff.TaxNumber, staff.CitizenshipNumber, staff.EmergencyContactName, staff.EmergencyContactPhone, staff.BloodGroup, staff.DeviceEnrollmentId, staff.MobileAccessEnabled, staff.WebAccessEnabled), territory);
    private async Task<bool> ApplyStatus<TEntity>(DbSet<TEntity> set, Guid id, string propertyName, string type, bool next, CancellationToken ct) where TEntity : class
    {
        var entity = await set.FindAsync([id], ct);
        if (entity is null) return false;
        var property = typeof(TEntity).GetProperty(propertyName);
        if (property?.PropertyType != typeof(bool)) return false;
        var previous = (bool)property.GetValue(entity)!;
        property.SetValue(entity, next);
        var updatedAt = typeof(TEntity).GetProperty("UpdatedAt");
        if (updatedAt?.PropertyType == typeof(DateTime)) updatedAt.SetValue(entity, DateTime.UtcNow);
        db.ActivityLogs.Add(Activity(next ? $"{type.ToUpperInvariant()}_ACTIVATED" : $"{type.ToUpperInvariant()}_DEACTIVATED", type, id.ToString(), previous.ToString(), next.ToString()));
        await db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<IActionResult> ToggleEntity<TEntity>(DbSet<TEntity> set, Guid id, string action, string type, CancellationToken ct) where TEntity : AuditedEntity { if (!IsAdmin) return Forbid(); var entity = await set.FindAsync([id], ct); if (entity is null) return NotFound(); var active = entity.GetType().GetProperty("IsActive"); if (active is null) return BadRequest(); active.SetValue(entity, false); entity.UpdatedAt = DateTime.UtcNow; db.ActivityLogs.Add(Activity(action, type, id.ToString(), "true", "false")); await db.SaveChangesAsync(ct); return NoContent(); }
    private static string SidebarThemePrefix(string role) => $"management.sidebar.{role.ToUpperInvariant()}.";

    private async Task<SidebarThemeSettings> LoadSidebarTheme(CancellationToken ct, string role)
    {
        var prefix = SidebarThemePrefix(role);
        var keys = ManagementSidebarThemeDefaults.Values.Keys.SelectMany(key => new[] { $"{prefix}{key}", $"management.sidebar.{key}" }).ToArray();
        var storedRows = await db.SystemSettings.AsNoTracking().ToListAsync(ct);
        var stored = storedRows.Where(x => keys.Contains(x.Key, StringComparer.Ordinal)).ToDictionary(x => x.Key, x => x.Value, StringComparer.Ordinal);
        string Value(string key)
        {
            var roleValue = stored.GetValueOrDefault($"{prefix}{key}", "");
            if (Regex.IsMatch(roleValue, "^#[0-9a-fA-F]{6}$")) return roleValue.ToUpperInvariant();
            var legacyValue = stored.GetValueOrDefault($"management.sidebar.{key}", "");
            return Regex.IsMatch(legacyValue, "^#[0-9a-fA-F]{6}$") ? legacyValue.ToUpperInvariant() : ManagementSidebarThemeDefaults.Values[key];
        }
        return new SidebarThemeSettings(Value("sidebarBackground"), Value("sidebarText"), Value("sidebarIcon"), Value("sidebarHoverBackground"), Value("sidebarHoverText"), Value("sidebarActiveBackground"), Value("sidebarActiveText"), Value("sidebarActiveIcon"), Value("sidebarBorder"), Value("sidebarDivider"), Value("sidebarHeaderBackground"), Value("sidebarHeaderText"), Value("sidebarFooterBackground"), Value("sidebarFooterText"), Value("sidebarBadgeBackground"), Value("sidebarBadgeText"));
    }

    private static AdminHeroSlide HeroSlideRow(WebsiteAsset item) => new(item.Id, item.Title, item.Subtitle, item.Description, item.ButtonText, item.Destination, item.SecondaryButtonText, item.SecondaryButtonUrl, item.ImageUrl, item.MobileImageUrl, item.CustomLabel, item.LayoutVariant, item.TypingSpeedMs, item.BackgroundColor, item.OverlayOpacity, item.TextAlignment, item.ContentPosition, item.BackgroundPosition, item.AnimationType, item.SlideDuration, item.TransitionDuration, item.Priority, item.Enabled, item.AutoplayEnabled, item.PauseOnHover, item.ShowNavigationArrows, item.ShowPaginationDots, item.LoopSlides, item.RandomizeSlides, item.RespectSchedule, item.StartsAt, item.EndsAt, item.VideoUrl, item.UpdatedAt);

    private static string? ValidateHeroSlide(UpsertHeroSlideRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 200) return "Slide title is required and must be 200 characters or fewer.";
        if (string.IsNullOrWhiteSpace(request.DesktopImage) || request.DesktopImage.Trim().Length > 500) return "A poster or fallback desktop image is required.";
        if (request.MobileImage is { Length: > 500 }) return "The mobile image URL is too long.";
        if (request.VideoUrl is { Length: > 500 }) return "The video URL is too long.";
        if (!SafeHeroUrl(request.DesktopImage) || !SafeHeroUrl(request.MobileImage) || !SafeHeroUrl(request.VideoUrl)) return "Media URLs must be local media paths or secure http(s) URLs.";
        if (!string.IsNullOrWhiteSpace(request.VideoUrl) && !request.VideoUrl.StartsWith("/api/site/media/", StringComparison.OrdinalIgnoreCase))
        {
            if (!Uri.TryCreate(request.VideoUrl, UriKind.Absolute, out var videoUri) || videoUri.Scheme is not ("http" or "https"))
                return "Hero videos must use the managed media library or a secure http(s) URL.";
        }
        if (!new[] { "STANDARD", "TYPEWRITER_GRAPHIC" }.Contains(request.LayoutVariant.Trim().ToUpperInvariant())) return "Choose a supported hero layout.";
        if (request.TypingSpeedMs < 0 || (request.TypingSpeedMs > 0 && request.TypingSpeedMs < 18)) return "Typing speed must be 0 or at least 18 milliseconds per character.";
        if (!Regex.IsMatch(request.BackgroundColor.Trim(), "^#[0-9a-fA-F]{6}$")) return "Background color must be a valid six-digit HEX color.";
        if (request.OverlayOpacity is < 0 or > 90) return "Overlay opacity must be between 0 and 90.";
        if (request.SlideDuration is < 1000 or > 30000) return "Slide duration must be between 1,000 and 30,000 milliseconds.";
        if (request.TransitionDuration is < 100 or > 5000) return "Transition duration must be between 100 and 5,000 milliseconds.";
        if (request.DisplayOrder < 0) return "Display order cannot be negative.";
        if (!new[] { "FADE", "SLIDE_LEFT", "SLIDE_RIGHT", "SLIDE_UP", "SUBTLE_ZOOM", "FADE_ZOOM" }.Contains(request.AnimationType.Trim().ToUpperInvariant())) return "Choose a supported animation type.";
        if (!new[] { "LEFT", "CENTER", "RIGHT" }.Contains(request.TextAlignment.Trim().ToUpperInvariant())) return "Choose a supported text alignment.";
        if (!new[] { "TOP", "CENTER", "BOTTOM" }.Contains(request.ContentPosition.Trim().ToUpperInvariant())) return "Choose a supported content position.";
        if (!new[] { "CENTER", "CENTER_TOP", "CENTER_BOTTOM", "LEFT", "RIGHT" }.Contains(request.BackgroundPosition.Trim().ToUpperInvariant())) return "Choose a supported background position.";
        if (!SafeHeroUrl(request.ButtonUrl) || !SafeHeroUrl(request.SecondaryButtonUrl)) return "Button links must be local paths or secure http(s) URLs.";
        if (request.StartDate.HasValue && request.EndDate.HasValue && ApplicationTime.ToUtc(request.EndDate.Value) < ApplicationTime.ToUtc(request.StartDate.Value)) return "The end date must be after the start date.";
        return null;
    }

    private static string? ValidatePublicDesignSetting(string key, string value)
    {
        if (value.Length > 30000) return "Design settings are too large.";
        try
        {
            using var document = JsonDocument.Parse(value);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return "Design settings must be a JSON object.";
            if (key.Equals("website.design", StringComparison.OrdinalIgnoreCase))
            {
                var colorKeys = new[] { "primary", "primaryDark", "primaryLight", "secondary", "secondaryDark", "secondaryLight", "background", "surface", "surfaceSecondary", "textPrimary", "textSecondary", "border", "success", "warning", "danger", "info", "headerBackground", "headerText", "headerActive" };
                foreach (var property in document.RootElement.EnumerateObject())
                    if (colorKeys.Contains(property.Name, StringComparer.OrdinalIgnoreCase))
                        if (property.Value.ValueKind != JsonValueKind.String || !Regex.IsMatch(property.Value.GetString() ?? "", "^#[0-9a-fA-F]{6}$")) return $"{property.Name} must be a valid six-digit HEX color.";
                if (document.RootElement.TryGetProperty("fontFamily", out var fontFamily) && (!new[] { "Inter", "Geist", "Arial", "system-ui" }.Contains(fontFamily.GetString(), StringComparer.Ordinal))) return "Choose a supported font family.";
                if (document.RootElement.TryGetProperty("sideNavPosition", out var sideNavPosition) && (!new[] { "LEFT", "RIGHT" }.Contains(sideNavPosition.GetString(), StringComparer.Ordinal))) return "Choose a supported side navigation position.";
                if (document.RootElement.TryGetProperty("heroTextAnimation", out var textAnimation) && !new[] { "NONE", "FADE", "FADE_UP", "FADE_DOWN", "FADE_LEFT", "FADE_RIGHT", "SLIDE_UP", "SLIDE_DOWN", "SLIDE_LEFT", "SLIDE_RIGHT", "SOFT_REVEAL", "BLUR_REVEAL", "ZOOM_IN", "WORD_REVEAL", "LETTER_REVEAL", "CHARACTER_REVEAL", "TYPEWRITER" }.Contains(textAnimation.GetString(), StringComparer.Ordinal)) return "Choose a supported hero text animation.";
                if (document.RootElement.TryGetProperty("heroImageAnimation", out var imageAnimation) && !new[] { "NONE", "FADE", "FADE_UP", "FADE_DOWN", "FADE_LEFT", "FADE_RIGHT", "SLIDE_LEFT", "SLIDE_RIGHT", "SOFT_SCALE", "ZOOM_IN", "ZOOM_OUT", "KEN_BURNS", "SUBTLE_PARALLAX", "SCALE_FADE" }.Contains(imageAnimation.GetString(), StringComparer.Ordinal)) return "Choose a supported hero image animation.";
                if (document.RootElement.TryGetProperty("heroTransition", out var transition) && !new[] { "FADE", "SLIDE_LEFT", "SLIDE_RIGHT", "SLIDE_UP", "SLIDE_DOWN", "SOFT_ZOOM", "SCALE_FADE", "BLUR_FADE", "KEN_BURNS", "CROSS_FADE" }.Contains(transition.GetString(), StringComparer.Ordinal)) return "Choose a supported hero transition.";
                if (document.RootElement.TryGetProperty("scrollReveal", out var scrollReveal) && !new[] { "NONE", "FADE", "FADE_UP", "FADE_DOWN", "SLIDE_LEFT", "SLIDE_RIGHT", "SOFT_SCALE", "BLUR_REVEAL" }.Contains(scrollReveal.GetString(), StringComparer.Ordinal)) return "Choose a supported scroll reveal.";
                if (document.RootElement.TryGetProperty("buttonAnimation", out var buttonAnimation) && !new[] { "NONE", "SOFT_SCALE", "SOFT_LIFT", "BORDER_HIGHLIGHT", "SHINE" }.Contains(buttonAnimation.GetString(), StringComparer.Ordinal)) return "Choose a supported button animation.";
                if (document.RootElement.TryGetProperty("animationIntensity", out var intensity) && !new[] { "SUBTLE", "STANDARD", "EXPRESSIVE" }.Contains(intensity.GetString(), StringComparer.Ordinal)) return "Choose a supported animation intensity.";
                foreach (var booleanKey in new[] { "animationsEnabled", "reducedMotionSupport" })
                    if (document.RootElement.TryGetProperty(booleanKey, out var booleanValue) && (booleanValue.ValueKind != JsonValueKind.True && booleanValue.ValueKind != JsonValueKind.False)) return $"{booleanKey} must be true or false.";
                foreach (var timing in new[] { "textDuration", "imageDuration" })
                    if (document.RootElement.TryGetProperty(timing, out var durationValue) && (durationValue.ValueKind != JsonValueKind.Number || !durationValue.TryGetInt32(out var milliseconds) || milliseconds is < 0 or > 5000)) return $"{timing} must be between 0 and 5,000 milliseconds.";
                foreach (var timing in new[] { "textDelay", "imageDelay" })
                    if (document.RootElement.TryGetProperty(timing, out var delayValue) && (delayValue.ValueKind != JsonValueKind.Number || !delayValue.TryGetInt32(out var milliseconds) || milliseconds is < 0 or > 3000)) return $"{timing} must be between 0 and 3,000 milliseconds.";
                foreach (var timing in new[] { "scrollDuration", "scrollStagger" })
                    if (document.RootElement.TryGetProperty(timing, out var scrollTiming) && (scrollTiming.ValueKind != JsonValueKind.Number || !scrollTiming.TryGetInt32(out var milliseconds) || milliseconds is < 0 or > 3000)) return $"{timing} must be between 0 and 3,000 milliseconds.";
                if (document.RootElement.TryGetProperty("animationEasing", out var easing) && !new[] { "ease", "ease-in", "ease-out", "ease-in-out", "linear" }.Contains(easing.GetString(), StringComparer.Ordinal)) return "Choose a supported animation easing.";
            }
            else
            {
                foreach (var color in new[] { "backgroundColor", "textColor", "linkColor" })
                    if (document.RootElement.TryGetProperty(color, out var colorValue) && (colorValue.ValueKind != JsonValueKind.String || !Regex.IsMatch(colorValue.GetString() ?? "", "^#[0-9a-fA-F]{6}$"))) return $"{color} must be a valid six-digit HEX color.";
                if (document.RootElement.TryGetProperty("messages", out var messages))
                {
                    if (messages.ValueKind != JsonValueKind.Array || messages.GetArrayLength() > 50) return "Announcement messages must be an array of 50 items or fewer.";
                    foreach (var message in messages.EnumerateArray())
                    {
                        if (message.ValueKind != JsonValueKind.Object) return "Each announcement must be an object.";
                        if (message.TryGetProperty("message", out var text) && (text.ValueKind != JsonValueKind.String || (text.GetString()?.Length ?? 0) > 180)) return "Announcement text must be 180 characters or fewer.";
                        if (message.TryGetProperty("linkUrl", out var link) && !SafeHeroUrl(link.GetString())) return "Announcement links must be local paths or secure http(s) URLs.";
                    }
                }
            }
            return null;
        }
        catch (JsonException) { return "Design settings must contain valid JSON."; }
    }

    private static bool SafeHeroUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        var trimmed = value.Trim();
        if (trimmed.Contains('<') || trimmed.Contains('>') || trimmed.StartsWith("//", StringComparison.Ordinal)) return false;
        if (trimmed.StartsWith("/", StringComparison.Ordinal)) return true;
        return Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    private static void ApplyHeroSlide(WebsiteAsset item, UpsertHeroSlideRequest request)
    {
        item.Subtitle = CleanOptional(request.Subtitle);
        item.Description = CleanOptional(request.Description);
        item.ButtonText = CleanOptional(request.ButtonText);
        item.Destination = CleanOptional(request.ButtonUrl);
        item.SecondaryButtonText = CleanOptional(request.SecondaryButtonText);
        item.SecondaryButtonUrl = CleanOptional(request.SecondaryButtonUrl);
        item.ImageUrl = CleanOptional(request.DesktopImage);
        item.MobileImageUrl = CleanOptional(request.MobileImage);
        item.VideoUrl = CleanOptional(request.VideoUrl);
        item.CustomLabel = CleanOptional(request.CustomLabel);
        item.LayoutVariant = request.LayoutVariant.Trim().ToUpperInvariant();
        item.TypingSpeedMs = request.TypingSpeedMs;
        item.BackgroundColor = request.BackgroundColor.Trim().ToUpperInvariant();
        item.OverlayOpacity = request.OverlayOpacity;
        item.TextAlignment = request.TextAlignment.Trim().ToUpperInvariant();
        item.ContentPosition = request.ContentPosition.Trim().ToUpperInvariant();
        item.BackgroundPosition = request.BackgroundPosition.Trim().ToUpperInvariant();
        item.AnimationType = request.AnimationType.Trim().ToUpperInvariant();
        item.SlideDuration = request.SlideDuration;
        item.TransitionDuration = request.TransitionDuration;
        item.Priority = request.DisplayOrder;
        item.Enabled = request.IsActive;
        item.AutoplayEnabled = request.AutoplayEnabled;
        item.PauseOnHover = request.PauseOnHover;
        item.ShowNavigationArrows = request.ShowNavigationArrows;
        item.ShowPaginationDots = request.ShowPaginationDots;
        item.LoopSlides = request.LoopSlides;
        item.RandomizeSlides = request.RandomizeSlides;
        item.RespectSchedule = request.RespectSchedule;
        item.StartsAt = request.StartDate.HasValue ? ApplicationTime.ToUtc(request.StartDate.Value) : null;
        item.EndsAt = request.EndDate.HasValue ? ApplicationTime.ToUtc(request.EndDate.Value) : null;
        item.MobileEnabled = true;
        item.DesktopEnabled = true;
    }

    private ActivityLog Activity(string action, string type, string entityId, string? previous, string? next) => new() { ActorId = ActorId, ActorRole = User.FindFirstValue(ClaimTypes.Role), Action = action, EntityType = type, EntityId = entityId, PreviousValue = previous, NewValue = next, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() };
    private async Task<Prescription?> LoadAdminPrescription(Guid id, CancellationToken ct) => await db.Prescriptions.AsNoTracking().Include(x => x.Customer).Include(x => x.ExtractedItems).ThenInclude(x => x.Matches).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.ExtractedItems).ThenInclude(x => x.Matches).ThenInclude(x => x.Product).ThenInclude(x => x!.Brand).Include(x => x.StatusHistory).Include(x => x.Reviews).SingleOrDefaultAsync(x => x.Id == id, ct);
    private static StaffPrescriptionResponse ToStaffPrescription(Prescription x) => new(x.Id, Number(x.Id), x.Customer?.FullName ?? "", x.Customer?.Phone ?? "", x.Customer?.Email ?? "", x.CreatedAt, x.SubmittedAt, x.OriginalFileName, x.ContentType, x.Status, x.OcrProvider, x.OcrStatus, x.OcrText, x.CustomerNote, x.ExtractedItems.Select(i => new StaffPrescriptionItem(i.Id, i.DetectedName, i.NormalizedName, i.Strength, i.DosageForm, i.Quantity, i.Frequency, i.Duration, i.Instructions, i.Matches.Select(m => m.Confidence).DefaultIfEmpty(0).Max(), i.Matches.OrderByDescending(m => m.CreatedAt).Select(m => new StaffMatchItem(m.Id, m.ProductId, m.Product?.Name, m.Product?.Medicine?.GenericName, m.Product?.Brand?.Name, m.Product?.SellingPrice, m.Confidence, m.MatchType, m.Availability, m.StockQuantity, m.NeedsPharmacistReview, m.Product?.Medicine?.PrescriptionRequired ?? false)).FirstOrDefault(), i.Dosage, i.Timing)).ToList(), x.StatusHistory.OrderBy(h => h.CreatedAt).Select(h => new StatusHistoryItem(h.Status, h.Note, h.ActorId, h.ActorRole, h.CreatedAt)).ToList(), x.Reviews.OrderByDescending(r => r.CreatedAt).Select(r => new ReviewItem(r.Status, r.Notes, r.ReviewerId, r.ReviewedAt, r.CreatedAt)).ToList());
    private static string Number(Guid id) => $"PR-{id.ToString("N")[..8].ToUpperInvariant()}";
    private static bool AllowedOrderTransition(string current, string next) => new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase) { [OrderStatuses.Pending] = [OrderStatuses.PrescriptionVerification, OrderStatuses.Confirmed, OrderStatuses.Cancelled], [OrderStatuses.PrescriptionVerification] = [OrderStatuses.Confirmed, OrderStatuses.Rejected, OrderStatuses.Cancelled], [OrderStatuses.Confirmed] = [OrderStatuses.Preparing, OrderStatuses.Cancelled], [OrderStatuses.Preparing] = [OrderStatuses.ReadyForPickup, OrderStatuses.Cancelled], [OrderStatuses.ReadyForPickup] = [OrderStatuses.AssignedForDelivery], [OrderStatuses.AssignedForDelivery] = [OrderStatuses.OutForDelivery], [OrderStatuses.OutForDelivery] = [OrderStatuses.Failed, OrderStatuses.Delivered] }.TryGetValue(current, out var options) && options.Contains(next, StringComparer.OrdinalIgnoreCase);
}
