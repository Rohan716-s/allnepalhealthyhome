using System.Security.Claims;
using backend.Contracts;
using backend.Data;
using backend.Hubs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/delivery")]
public sealed class DeliveryController(ApplicationDbContext db, IPasswordService passwords, INotificationTemplateService notifications, IMessagingConversationService messaging, IHubContext<NotificationHub> notificationHub) : ControllerBase
{
    private bool Authorized => User.IsStaffRole(StaffRoles.Delivery, StaffRoles.Supervisor, StaffRoles.Admin, StaffRoles.SuperAdmin);
    private Guid StaffId => User.TryGetStaffId(out var id) ? id : Guid.Empty;

    [HttpGet("availability")]
    public async Task<ActionResult<RiderAvailabilityResponse>> Availability(CancellationToken ct)
    {
        var staffId = await RequireActiveRider(ct);
        if (staffId is null) return Forbid();
        var availability = await db.RiderAvailabilities.AsNoTracking()
            .SingleOrDefaultAsync(x => x.StaffUserId == staffId.Value, ct);
        var hasActiveDelivery = await HasActiveAssignment(staffId.Value, ct);
        return Ok(ToAvailabilityResponse(availability, hasActiveDelivery));
    }

    [HttpPut("availability")]
    public async Task<ActionResult<RiderAvailabilityResponse>> SetAvailability(RiderAvailabilityUpdateRequest request, CancellationToken ct)
    {
        var staffId = await RequireActiveRider(ct);
        if (staffId is null) return Forbid();
        var hasActiveDelivery = await HasActiveAssignment(staffId.Value, ct);
        if (request.IsAvailable && hasActiveDelivery)
            return Conflict(new { message = "Availability cannot be enabled while an active delivery is assigned." });

        var now = DateTime.UtcNow;
        var availability = await db.RiderAvailabilities.SingleOrDefaultAsync(x => x.StaffUserId == staffId.Value, ct);
        if (availability is null)
        {
            availability = new RiderAvailability { StaffUserId = staffId.Value, IsAvailable = request.IsAvailable };
            db.RiderAvailabilities.Add(availability);
        }
        else
        {
            availability.IsAvailable = request.IsAvailable;
            availability.UpdatedAt = now;
        }
        if (!request.IsAvailable) ClearAvailabilityLocation(availability);
        await db.SaveChangesAsync(ct);
        return Ok(ToAvailabilityResponse(availability, hasActiveDelivery));
    }

    [HttpPost("availability/location")]
    public async Task<ActionResult<RiderAvailabilityResponse>> UpdateAvailabilityLocation(DeliveryLocationUpdateRequest request, CancellationToken ct)
    {
        var staffId = await RequireActiveRider(ct);
        if (staffId is null) return Forbid();
        if (!IsValidLocation(request))
            return BadRequest(new { message = "Latitude, longitude, and accuracy must be valid; accuracy must not exceed 1000 meters." });
        var hasActiveDelivery = await HasActiveAssignment(staffId.Value, ct);
        if (hasActiveDelivery)
            return Conflict(new { message = "Availability location cannot be updated while an active delivery is assigned." });

        var availability = await db.RiderAvailabilities.SingleOrDefaultAsync(x => x.StaffUserId == staffId.Value, ct);
        if (availability is null || !availability.IsAvailable)
            return Conflict(new { message = "Opt in to availability before sharing your location." });

        var now = DateTime.UtcNow;
        availability.Latitude = (decimal)request.Latitude!.Value;
        availability.Longitude = (decimal)request.Longitude!.Value;
        availability.AccuracyMeters = (decimal)request.Accuracy!.Value;
        availability.LocationUpdatedAt = now;
        availability.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return Ok(ToAvailabilityResponse(availability, hasActiveDelivery));
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardStatsResponse>> Dashboard(CancellationToken ct)
    {
        if (!Authorized) return Forbid(); var today = DateTime.UtcNow.Date;
        var assigned = db.DeliveryAssignments.Where(x => x.DeliveryStaffId == StaffId);
        var stats = new Dictionary<string, int> { ["ASSIGNED_TODAY"] = await assigned.CountAsync(x => x.CreatedAt >= today, ct), ["PENDING_PICKUP"] = await assigned.CountAsync(x => x.Status == DeliveryStatuses.Assigned || x.Status == DeliveryStatuses.Accepted || x.Status == DeliveryStatuses.PickedUp, ct), ["OUT_FOR_DELIVERY"] = await assigned.CountAsync(x => x.Status == DeliveryStatuses.OutForDelivery, ct), ["DELIVERED_TODAY"] = await assigned.CountAsync(x => x.DeliveredAt >= today, ct), ["FAILED_DELIVERIES"] = await assigned.CountAsync(x => x.Status == DeliveryStatuses.Failed, ct), ["TOTAL_DELIVERIES"] = await assigned.CountAsync(ct) };
        return Ok(new DashboardStatsResponse(new Dictionary<string, int>(), new Dictionary<string, int>(), stats));
    }

    [HttpGet("orders")]
    public async Task<ActionResult<PagedResponse<StaffOrderListItem>>> Orders([FromQuery] string? search, [FromQuery] string? status, [FromQuery] bool today = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        if (!Authorized) return Forbid(); page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.DeliveryAssignments.AsNoTracking().Where(x => x.DeliveryStaffId == StaffId).Include(x => x.Order).ThenInclude(x => x!.Customer).Include(x => x.Order).ThenInclude(x => x!.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).AsQueryable();
        if (today) { var start = DateTime.UtcNow.Date; query = query.Where(x => x.CreatedAt >= start); }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Order!.OrderNumber.Contains(search) || x.Order.Customer!.FullName.Contains(search) || x.Order.Address!.District.Contains(search));
        var total = await query.CountAsync(ct); var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new PagedResponse<StaffOrderListItem>(rows.Select(x => ToList(x.Order!, x)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("orders/{id:guid}")]
    public async Task<ActionResult<StaffOrderResponse>> Order(Guid id, CancellationToken ct)
    {
        if (!Authorized) return Forbid(); var assignment = await Load(id, ct); return assignment is null ? NotFound() : Ok(ToOrder(assignment.Order!, assignment));
    }

    [HttpPost("orders/{orderId:guid}/location")]
    public async Task<IActionResult> UpdateLocation(Guid orderId, DeliveryLocationUpdateRequest request, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery)) return Forbid();
        if (!request.Latitude.HasValue || !request.Longitude.HasValue || !request.Accuracy.HasValue
            || !double.IsFinite(request.Latitude.Value) || request.Latitude is < -90 or > 90
            || !double.IsFinite(request.Longitude.Value) || request.Longitude is < -180 or > 180
            || !double.IsFinite(request.Accuracy.Value) || request.Accuracy is < 0 or > 1000)
            return BadRequest(new { message = "Latitude, longitude, and accuracy must be valid; accuracy must not exceed 1000 meters." });

        var staffId = StaffId;
        var staffIsActive = await db.StaffUsers.AsNoTracking().AnyAsync(x => x.Id == staffId && x.IsActive && x.Role == StaffRoles.Delivery, ct);
        if (!staffIsActive) return Forbid();

        var assignment = await db.DeliveryAssignments.SingleOrDefaultAsync(x =>
            x.OrderId == orderId && x.DeliveryStaffId == staffId, ct);
        if (assignment is null) return NotFound();
        if (assignment.Status is not (DeliveryStatuses.Assigned or DeliveryStatuses.Accepted or DeliveryStatuses.PickedUp or DeliveryStatuses.OutForDelivery))
            return Conflict(new { message = "Location updates are only allowed for an active delivery." });

        var now = DateTime.UtcNow;
        var location = await db.DeliveryLocations.SingleOrDefaultAsync(x => x.DeliveryAssignmentId == assignment.Id, ct);
        var latitude = (decimal)request.Latitude.Value;
        var longitude = (decimal)request.Longitude.Value;
        var accuracy = (decimal)request.Accuracy.Value;
        if (location is null)
        {
            db.DeliveryLocations.Add(new DeliveryLocation
            {
                DeliveryAssignmentId = assignment.Id,
                Latitude = latitude,
                Longitude = longitude,
                AccuracyMeters = accuracy,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        else
        {
            location.Latitude = latitude;
            location.Longitude = longitude;
            location.AccuracyMeters = accuracy;
            location.UpdatedAt = now;
        }
        await db.SaveChangesAsync(ct);
        return Ok(new DeliveryCurrentLocation(latitude, longitude, accuracy, now));
    }

    [HttpGet("orders/{id:guid}/requirements")]
    public async Task<IActionResult> OrderRequirements(Guid id, CancellationToken ct)
    {
        if (!Authorized || !await db.DeliveryAssignments.AnyAsync(x => x.OrderId == id && x.DeliveryStaffId == StaffId, ct)) return NotFound();
        var order = await db.Orders.AsNoTracking().Include(x => x.Address).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (order is null) return NotFound();
        var rules = await OrderPolicyReader.ReadDeliveryAsync(db, ct);
        var uploaded = await db.OrderDocuments.AsNoTracking().Where(x => x.OrderId == id).Select(x => x.Kind).Distinct().ToListAsync(ct);
        return Ok(new { rules.EnforceGeofence, rules.GeofenceRadiusMeters, RequiredDocumentTypes = rules.RequiredDocumentTypes ?? ["DELIVERY_PROOF"], UploadedDocumentTypes = uploaded, HasDestinationCoordinates = order.Address?.Latitude.HasValue == true && order.Address.Longitude.HasValue });
    }

    [HttpGet("customers")]
    public async Task<IActionResult> SearchOrderCustomers([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery)) return Forbid();
        page = Math.Clamp(page, 1, 200); pageSize = Math.Clamp(pageSize, 1, 50);
        var branchId = await db.StaffUsers.AsNoTracking().Where(x => x.Id == StaffId && x.IsActive).Select(x => x.BranchId).SingleOrDefaultAsync(ct);
        if (!branchId.HasValue) return Forbid();
        var query = db.Customers.AsNoTracking().Where(x => x.IsActive &&
            (x.PharmacyDetails != null && x.PharmacyDetails.PreferredBranchId == branchId.Value ||
             db.Orders.Any(order => order.CustomerId == x.Id && order.BranchId == branchId.Value) ||
             db.CustomerPayments.Any(payment => payment.CustomerId == x.Id && payment.BranchId == branchId.Value)));
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.FullName.Contains(search) || x.Phone.Contains(search) || x.Email.Contains(search));
        var total = await query.CountAsync(ct);
        var customers = await query.OrderBy(x => x.FullName).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, x.FullName, x.Phone, x.Email, x.AccountType,
                Addresses = db.Addresses.Where(a => a.CustomerId == x.Id).OrderByDescending(a => a.IsDefault).ThenByDescending(a => a.UpdatedAt)
                    .Select(a => new ManualOrderAddress(a.Id, a.Label, a.Province, a.District, a.Municipality, a.Ward, a.StreetTole, a.Landmark, a.Phone, a.Latitude, a.Longitude)).ToList() })
            .ToListAsync(ct);
        return Ok(new PagedResponse<ManualOrderCustomer>(customers.Select(x => new ManualOrderCustomer(x.Id, x.FullName, x.Phone, x.Email, x.AccountType, x.Addresses)).ToList(), page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }

    [HttpGet("products")]
    public async Task<IActionResult> SearchOrderProducts([FromQuery] string? search, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery)) return Forbid();
        var branchId = await db.StaffUsers.AsNoTracking().Where(x => x.Id == StaffId && x.IsActive).Select(x => x.BranchId).SingleOrDefaultAsync(ct);
        if (!branchId.HasValue) return Forbid();
        var today = ApplicationTime.NepalNow.Date;
        var query = db.Products.AsNoTracking().Where(p => p.IsActive && p.Medicine != null && !p.Medicine.PrescriptionRequired &&
            db.Inventory.Any(i => i.ProductId == p.Id && i.BranchId == branchId.Value && i.StockQuantity > i.ReservedQuantity &&
                (!i.ExpiryDate.HasValue || i.ExpiryDate.Value.Date >= today) && i.BatchStatus != "EXPIRED" && i.BatchStatus != "DEPLETED" && i.BatchStatus != "QUARANTINED" && i.BatchStatus != "RETURNED"));
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(p => p.Name.Contains(search) || p.Sku.Contains(search) || (p.Medicine!.GenericName ?? "").Contains(search));
        var orderingJson = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "orders.configuration").Select(x => x.Value).SingleOrDefaultAsync(ct);
        var ordering = OrderingConfiguration.Parse(orderingJson);
        var products = await query.OrderBy(p => p.Name).Take(100).ToListAsync(ct);
        var productIds = products.Select(x => x.Id).ToArray();
        var availableByProduct = await db.Inventory.AsNoTracking().Where(i => productIds.Contains(i.ProductId) && i.BranchId == branchId.Value && i.StockQuantity > i.ReservedQuantity &&
                (!i.ExpiryDate.HasValue || i.ExpiryDate.Value.Date >= today) && i.BatchStatus != "EXPIRED" && i.BatchStatus != "DEPLETED" && i.BatchStatus != "QUARANTINED" && i.BatchStatus != "RETURNED")
            .GroupBy(i => i.ProductId).Select(g => new { ProductId = g.Key, Quantity = g.Sum(i => i.StockQuantity - i.ReservedQuantity) }).ToDictionaryAsync(x => x.ProductId, x => x.Quantity, ct);
        var rows = products.Select(p => { var rule = ordering.RuleFor(p); return new ManualOrderProduct(p.Id, p.Name, p.Sku, p.SalesUnit,
            p.SellingPrice, availableByProduct.GetValueOrDefault(p.Id) / Math.Max(1, p.SalesUnitToBase), p.Medicine!.PrescriptionRequired, rule.AllowBulk, rule.AllowSingle, Math.Max(1, rule.MinimumQuantity)); }).ToList();
        return Ok(rows);
    }

    [HttpGet("order-settings")]
    public async Task<ActionResult<ManualRiderOrderSettings>> RiderOrderSettings(CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery)) return Forbid();
        var json = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "orders.configuration").Select(x => x.Value).SingleOrDefaultAsync(ct);
        var settings = OrderingConfiguration.Parse(json);
        return Ok(new ManualRiderOrderSettings(settings.Mode, settings.MinimumBulkQuantity));
    }

    [HttpPost("orders")]
    public async Task<IActionResult> CreateManualOrder(ManualRiderOrderRequest request, CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery)) return Forbid();
        if (request.Items is null || request.Items.Count == 0 || request.Items.Count > 100) return BadRequest(new { message = "Select at least one medicine (up to 100 lines)." });
        if (request.Items.Any(x => x.Quantity is < 1 or > 999) || request.Items.Select(x => x.ProductId).Distinct().Count() != request.Items.Count)
            return BadRequest(new { message = "Quantities must be 1–999 and each medicine may appear only once." });
        if (request.Notes?.Trim().Length > 1000) return BadRequest(new { message = "Order notes must be at most 1,000 characters." });

        var rider = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == StaffId && x.IsActive && x.Role == StaffRoles.Delivery && x.BranchId != null, ct);
        if (rider?.BranchId is not Guid branchId) return Forbid();
        var customer = await db.Customers.SingleOrDefaultAsync(x => x.Id == request.CustomerId && x.IsActive &&
            (x.PharmacyDetails != null && x.PharmacyDetails.PreferredBranchId == branchId ||
             db.Orders.Any(order => order.CustomerId == x.Id && order.BranchId == branchId) ||
             db.CustomerPayments.Any(payment => payment.CustomerId == x.Id && payment.BranchId == branchId)), ct);
        if (customer is null) return BadRequest(new { message = "Choose an active customer or pharmacy assigned to your branch." });
        var address = await db.Addresses.SingleOrDefaultAsync(x => x.Id == request.AddressId && x.CustomerId == customer.Id, ct);
        if (address is null) return BadRequest(new { message = "Choose a saved address belonging to this customer." });
        var methodCode = string.IsNullOrWhiteSpace(request.PaymentMethod) ? PaymentMethods.CashOnDelivery : request.PaymentMethod.Trim().ToUpperInvariant();
        var method = await db.PaymentMethodConfigurations.AsNoTracking().SingleOrDefaultAsync(x => x.Code == methodCode && x.IsEnabled, ct);
        if (method is null) return BadRequest(new { message = "The selected payment method is not available." });
        var productIds = request.Items.Select(x => x.ProductId).ToArray();
        var products = await db.Products.Include(x => x.Medicine).Where(x => x.IsActive && productIds.Contains(x.Id)).ToListAsync(ct);
        if (products.Count != productIds.Length) return BadRequest(new { message = "One or more medicines are no longer available." });
        if (products.Any(x => x.Medicine?.PrescriptionRequired == true)) return Conflict(new { message = "Prescription medicines must be ordered through the pharmacist-reviewed prescription flow." });
        var orderingJson = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "orders.configuration").Select(x => x.Value).SingleOrDefaultAsync(ct);
        var ordering = OrderingConfiguration.Parse(orderingJson);
        var orderMode = string.IsNullOrWhiteSpace(request.OrderMode) ? ordering.Mode == "BULK_ONLY" ? "BULK" : "SINGLE" : request.OrderMode.Trim().ToUpperInvariant();
        if (orderMode is not ("SINGLE" or "BULK")) return BadRequest(new { message = "Select a valid order mode." });
        if (orderMode == "SINGLE" && ordering.Mode == "BULK_ONLY" || orderMode == "BULK" && ordering.Mode == "SINGLE_ONLY") return Conflict(new { message = "This order mode is not available under the current Superadmin settings." });
        if (orderMode == "SINGLE" && request.Items.Count != 1) return BadRequest(new { message = "Single ordering accepts exactly one product. Use bulk ordering for multiple items." });
        foreach (var item in request.Items)
        {
            var product = products.Single(x => x.Id == item.ProductId);
            var rule = ordering.RuleFor(product);
            if (orderMode == "BULK" && !rule.AllowBulk || orderMode == "SINGLE" && !rule.AllowSingle) return Conflict(new { message = $"{product.Name} is not available for the selected order mode." });
            var minimum = orderMode == "BULK" ? Math.Max(ordering.MinimumBulkQuantity, Math.Max(1, rule.MinimumQuantity)) : Math.Max(1, rule.MinimumQuantity);
            if (item.Quantity < minimum) return BadRequest(new { message = $"{product.Name} requires a minimum quantity of {minimum} {product.SalesUnit}." });
        }

        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var now = ApplicationTime.NepalNow;
        var order = new PharmacyOrder { CustomerId = customer.Id, BranchId = branchId, AddressId = address.Id,
            OrderNumber = $"ANHH-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Status = OrderStatuses.Confirmed,
            PaymentStatus = PaymentTransactionStatuses.Pending, PaymentMethod = methodCode, OrderMode = orderMode,
            OrderCustomerName = customer.FullName, OrderCustomerPhone = address.Phone, OrderCustomerEmail = customer.Email,
            DeliveryInstructions = request.Notes?.Trim(), CustomerNotes = request.Notes?.Trim() };
        decimal subtotal = 0;
        foreach (var item in request.Items)
        {
            var product = products.Single(x => x.Id == item.ProductId);
            var multiplier = Math.Max(1, product.SalesUnitToBase);
            var requiredLong = (long)item.Quantity * multiplier;
            if (requiredLong > int.MaxValue) return BadRequest(new { message = $"Quantity for {product.Name} is too large." });
            var today = now.Date;
            var inventory = await db.Inventory.Where(x => x.ProductId == product.Id && x.BranchId == branchId && x.StockQuantity > x.ReservedQuantity &&
                (!x.ExpiryDate.HasValue || x.ExpiryDate.Value.Date >= today) && x.BatchStatus != "EXPIRED" && x.BatchStatus != "DEPLETED" && x.BatchStatus != "QUARANTINED" && x.BatchStatus != "RETURNED")
                .OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue).ThenBy(x => x.CreatedAt).ToListAsync(ct);
            if (inventory.Sum(x => (long)x.StockQuantity - x.ReservedQuantity) < requiredLong) return Conflict(new { message = $"There is not enough available stock for {product.Name}." });
            var remaining = (int)requiredLong;
            foreach (var batch in inventory)
            {
                if (remaining <= 0) break;
                var take = Math.Min(remaining, batch.StockQuantity - batch.ReservedQuantity);
                var before = batch.ReservedQuantity; batch.ReservedQuantity += take; batch.UpdatedAt = DateTime.UtcNow; remaining -= take;
                db.StockTransactions.Add(new StockTransaction { InventoryId = batch.Id, BranchId = branchId, Type = StockTransactionTypes.Reservation,
                    Quantity = take, QuantityBefore = before, QuantityAfter = batch.ReservedQuantity, Unit = product.BaseUnit,
                    ReferenceType = "CUSTOMER_ORDER", ReferenceId = order.Id.ToString(), Reason = "Rider-created order", Note = $"Reserved for {order.OrderNumber}", ActorId = StaffId });
            }
            order.Items.Add(new OrderItem { ProductId = product.Id, ProductName = product.Name, Quantity = item.Quantity, Unit = product.SalesUnit, UnitMultiplier = multiplier, UnitPrice = product.SellingPrice });
            subtotal += product.SellingPrice * item.Quantity;
        }
        if (method.MinimumOrder.HasValue && subtotal < method.MinimumOrder.Value || method.MaximumOrder.HasValue && subtotal > method.MaximumOrder.Value)
            return BadRequest(new { message = "Order value is outside this payment method's configured limits." });
        var zone = await db.DeliveryZones.Where(x => x.Enabled && (x.BranchId == null || x.BranchId == branchId) &&
            (x.Province == null || x.Province == address.Province) && (x.District == null || x.District == address.District) &&
            (x.Municipality == null || x.Municipality == address.Municipality) && (x.Ward == null || x.Ward == address.Ward))
            .OrderByDescending(x => x.BranchId == branchId).ThenByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        if (zone is not null && zone.MinimumOrder > subtotal) return BadRequest(new { message = $"This delivery area requires a minimum order of NPR {zone.MinimumOrder:N2}." });
        order.DeliveryFee = zone is null || zone.FreeDeliveryThreshold > 0 && subtotal >= zone.FreeDeliveryThreshold ? 0 : zone.DeliveryFee;
        order.Total = subtotal + order.DeliveryFee;
        var assignment = new DeliveryAssignment { OrderId = order.Id, DeliveryStaffId = StaffId, Status = DeliveryStatuses.Assigned, Notes = "Order created by assigned rider" };
        await RiderAvailabilityOperations.SetUnavailableAsync(db, StaffId, DateTime.UtcNow, ct);
        order.DeliveryAssignment = assignment;
        order.StatusHistory.Add(new OrderStatusHistory { Status = order.Status, Note = "Order created by rider", ActorId = StaffId.ToString(), ActorRole = StaffRoles.Delivery });
        order.AssignmentHistory.Add(new OrderAssignmentHistory { ActorStaffUserId = StaffId, ChangeType = "RIDER_CREATED_ORDER", NewValue = StaffId.ToString(), Note = "Rider-created order assigned to creating rider" });
        db.Orders.Add(order);
        db.PaymentTransactions.Add(new PaymentTransaction { Order = order, TransactionNumber = $"ANHH-TXN-{Guid.NewGuid():N}"[..20].ToUpperInvariant(), Method = methodCode, Status = PaymentTransactionStatuses.Pending, Amount = order.Total, Notes = "Created by delivery rider; awaiting customer payment or collection." });
        var customerNotice = new Notification { CustomerId = customer.Id, Type = "order_created", Title = "Order received", Body = $"Order {order.OrderNumber} was created by your delivery rider." };
        db.Notifications.Add(customerNotice);
        var recipients = await db.StaffUsers.Where(x => x.IsActive && (x.Role == StaffRoles.Admin || x.Role == StaffRoles.SuperAdmin || x.Role == StaffRoles.Accountant ||
            x.BranchId == branchId && (x.Role == StaffRoles.Supervisor || x.Role == StaffRoles.Pharmacist) || x.Id == StaffId)).ToListAsync(ct);
        var notices = recipients.Select(x => new Notification { StaffUserId = x.Id, Type = "order_created", Title = "Rider created an order", Body = $"Order {order.OrderNumber} was created for {customer.FullName} at {rider.BranchId}." }).ToList();
        db.Notifications.AddRange(notices);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = StaffRoles.Delivery, Action = "RIDER_CREATED_ORDER", EntityType = "PharmacyOrder", EntityId = order.Id.ToString(), NewValue = order.OrderNumber, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await notificationHub.Clients.Group(NotificationHub.Group("customer", customer.Id)).SendAsync("notification", new { id = customerNotice.Id, type = customerNotice.Type, title = customerNotice.Title, body = customerNotice.Body, isRead = false, createdAt = customerNotice.CreatedAt }, ct);
        foreach (var notice in notices) await notificationHub.Clients.Group(NotificationHub.Group("staff", notice.StaffUserId!.Value)).SendAsync("notification", new { id = notice.Id, type = notice.Type, title = notice.Title, body = notice.Body, isRead = false, createdAt = notice.CreatedAt }, ct);
        return Created($"/api/delivery/orders/{order.Id}", new { id = order.Id, orderNumber = order.OrderNumber, status = order.Status, deliveryStatus = assignment.Status, total = order.Total });
    }

    [HttpPost("orders/{id:guid}/accept")]
    public Task<ActionResult<StaffOrderResponse>> Accept(Guid id, DeliveryNoteRequest request, CancellationToken ct) => Transition(id, DeliveryStatuses.Accepted, request, ct);

    [HttpPost("orders/{id:guid}/pickup")]
    public Task<ActionResult<StaffOrderResponse>> Pickup(Guid id, DeliveryNoteRequest request, CancellationToken ct) => Transition(id, DeliveryStatuses.PickedUp, request, ct);

    [HttpPost("orders/{id:guid}/start")]
    public Task<ActionResult<StaffOrderResponse>> Start(Guid id, DeliveryNoteRequest request, CancellationToken ct) => Transition(id, DeliveryStatuses.OutForDelivery, request, ct);

    [HttpPost("orders/{id:guid}/delivered")]
    public Task<ActionResult<StaffOrderResponse>> Delivered(Guid id, DeliveryNoteRequest request, CancellationToken ct) => Transition(id, DeliveryStatuses.Delivered, request, ct);

    [HttpPost("orders/{id:guid}/failed")]
    public async Task<ActionResult<StaffOrderResponse>> Failed(Guid id, DeliveryFailureRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "A delivery failure reason is required." });
        return await Transition(id, DeliveryStatuses.Failed, new DeliveryNoteRequest($"{request.Reason}: {request.Notes}"), ct, request.Reason);
    }

    [HttpGet("history")]
    public async Task<ActionResult<PagedResponse<StaffOrderListItem>>> History([FromQuery] string? status, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) => await Orders(search, status, false, page, pageSize, ct);

    [HttpGet("notifications")]
    public async Task<ActionResult<IReadOnlyList<StaffNotificationItem>>> Notifications(CancellationToken ct) { if (!Authorized) return Forbid(); return Ok(await db.Notifications.AsNoTracking().Where(x => x.StaffUserId == StaffId).OrderByDescending(x => x.CreatedAt).Take(100).Select(x => new StaffNotificationItem(x.Id, x.Type, x.Title, x.Body, x.ReadAt != null, x.CreatedAt)).ToListAsync(ct)); }

    [HttpPut("notifications/{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id, CancellationToken ct) { if (!Authorized) return Forbid(); var notification = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.StaffUserId == StaffId, ct); if (notification is null) return NotFound(); notification.ReadAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken ct) { if (!Authorized) return Forbid(); await db.Notifications.Where(x => x.StaffUserId == StaffId && x.ReadAt == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTime.UtcNow), ct); return NoContent(); }

    [HttpGet("profile")]
    public async Task<ActionResult<StaffProfileResponse>> Profile(CancellationToken ct) { if (!User.TryGetStaffId(out var id)) return Forbid(); var staff = await db.StaffUsers.AsNoTracking().Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == id, ct); return staff is null ? NotFound() : Ok(new StaffProfileResponse(staff.Id, staff.FullName, staff.Email, staff.Phone, staff.Role, staff.BranchId, staff.Branch?.Name, staff.LicenseReference, staff.IsActive, staff.EmployeeId, staff.Address, staff.JoiningDate, staff.ProfilePhotoStoredFileName is null ? null : "/api/staff-profile/photo")); }

    [HttpPut("profile")]
    public async Task<ActionResult<StaffProfileResponse>> UpdateProfile(UpdateStaffProfileRequest request, CancellationToken ct) { if (!Authorized) return Forbid(); var staff = await db.StaffUsers.Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == StaffId, ct); if (staff is null) return NotFound(); if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Phone)) return BadRequest(new { message = "Name and phone are required." }); if (request.EmployeeId?.Trim().Length > 80 || request.Address?.Trim().Length > 500) return BadRequest(new { message = "One or more profile fields are too long." }); if (request.JoiningDate.HasValue && request.JoiningDate.Value.Date > DateTime.UtcNow.Date) return BadRequest(new { message = "Joining date cannot be in the future." }); staff.FullName = request.FullName.Trim(); staff.Phone = request.Phone.Trim(); staff.EmployeeId = request.EmployeeId?.Trim(); staff.Address = request.Address?.Trim(); staff.JoiningDate = request.JoiningDate?.Date; await db.SaveChangesAsync(ct); return Ok(new StaffProfileResponse(staff.Id, staff.FullName, staff.Email, staff.Phone, staff.Role, staff.BranchId, staff.Branch?.Name, staff.LicenseReference, staff.IsActive, staff.EmployeeId, staff.Address, staff.JoiningDate, staff.ProfilePhotoStoredFileName is null ? null : "/api/staff-profile/photo")); }

    [HttpPut("profile/password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct) { if (!Authorized) return Forbid(); if (request.NewPassword.Length < 8 || request.NewPassword != request.ConfirmPassword) return BadRequest(new { message = "New passwords must match and be at least 8 characters." }); var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == StaffId, ct); if (staff is null || !passwords.Verify(request.CurrentPassword, staff.PasswordHash)) return BadRequest(new { message = "The current password is incorrect." }); staff.PasswordHash = passwords.Hash(request.NewPassword); await db.SaveChangesAsync(ct); return NoContent(); }

    private async Task<ActionResult<StaffOrderResponse>> Transition(Guid id, string next, DeliveryNoteRequest request, CancellationToken ct, string? failureReason = null)
    {
        if (!Authorized) return Forbid();
        if (request.Latitude.HasValue != request.Longitude.HasValue || request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180)
            return BadRequest(new { message = "A valid latitude and longitude pair is required for delivery completion." });
        var notes = request.Notes;
        var allowed = new Dictionary<string, string[]> { [DeliveryStatuses.Assigned] = [DeliveryStatuses.Accepted], [DeliveryStatuses.Accepted] = [DeliveryStatuses.PickedUp], [DeliveryStatuses.PickedUp] = [DeliveryStatuses.OutForDelivery], [DeliveryStatuses.OutForDelivery] = [DeliveryStatuses.Delivered, DeliveryStatuses.Failed] };
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult<StaffOrderResponse>>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var assignment = await Load(id, ct);
            if (assignment is null || assignment.Order is null) return NotFound();
            if (!allowed.TryGetValue(assignment.Status, out var options) || !options.Contains(next, StringComparer.OrdinalIgnoreCase)) return Conflict(new { message = $"The delivery cannot move from {assignment.Status} to {next}." });
            if (next == DeliveryStatuses.Delivered)
            {
                var rules = await OrderPolicyReader.ReadDeliveryAsync(db, ct);
                if (rules.EnforceGeofence)
                {
                    var destination = assignment.Order.Address;
                    if (!request.Latitude.HasValue || !request.Longitude.HasValue || destination?.Latitude is null || destination.Longitude is null)
                        return Conflict(new { message = "Delivery cannot be completed until the saved destination and rider GPS location are both available." });
                    var distance = DistanceMeters((double)request.Latitude.Value, (double)request.Longitude!.Value, (double)destination.Latitude!.Value, (double)destination.Longitude!.Value);
                    if (distance > rules.GeofenceRadiusMeters)
                        return Conflict(new { code = "OUTSIDE_DELIVERY_GEOFENCE", distanceMeters = Math.Round(distance), allowedRadiusMeters = rules.GeofenceRadiusMeters, message = $"You are {Math.Round(distance)} meters from the destination. Move within {rules.GeofenceRadiusMeters} meters to complete delivery." });
                }
                var requiredDocuments = (rules.RequiredDocumentTypes ?? ["DELIVERY_PROOF"]).Select(x => x.ToUpperInvariant()).Distinct().ToArray();
                var uploadedTypes = await db.OrderDocuments.AsNoTracking().Where(x => x.OrderId == assignment.OrderId).Select(x => x.Kind).Distinct().ToListAsync(ct);
                var missingDocuments = requiredDocuments.Except(uploadedTypes, StringComparer.OrdinalIgnoreCase).ToArray();
                if (missingDocuments.Length > 0)
                    return Conflict(new { code = "DELIVERY_DOCUMENTS_REQUIRED", missingDocumentTypes = missingDocuments, message = $"Upload the required delivery document(s) before completing delivery: {string.Join(", ", missingDocuments)}." });
            }
            var previousStatus = assignment.Status;
            var now = ApplicationTime.NepalNow;
            assignment.Status = next; assignment.Notes = notes; assignment.FailureReason = failureReason; if (next == DeliveryStatuses.Accepted) assignment.AcceptedAt = now; if (next == DeliveryStatuses.PickedUp) assignment.PickedUpAt = now; if (next == DeliveryStatuses.OutForDelivery) assignment.OutForDeliveryAt = now; if (next == DeliveryStatuses.Delivered) assignment.DeliveredAt = now; if (next == DeliveryStatuses.Failed) assignment.FailedAt = now;
            if (next is DeliveryStatuses.Delivered or DeliveryStatuses.Failed && assignment.CurrentLocation is not null)
            {
                db.DeliveryLocations.Remove(assignment.CurrentLocation);
                assignment.CurrentLocation = null;
            }
            var orderStatus = next switch { DeliveryStatuses.OutForDelivery => OrderStatuses.OutForDelivery, DeliveryStatuses.Delivered => OrderStatuses.Delivered, DeliveryStatuses.Failed => OrderStatuses.Failed, _ => assignment.Order.Status };
            if (next == DeliveryStatuses.Delivered)
            {
                foreach (var line in assignment.Order.Items)
                {
                    var requiredBaseQuantity = (long)line.Quantity * Math.Max(1, line.UnitMultiplier);
                    if (requiredBaseQuantity > int.MaxValue) return Conflict(new { message = $"The reserved quantity for {line.ProductName} is outside the supported range." });
                    var reservations = await db.StockTransactions
                        .Include(x => x.Inventory)
                        .Where(x => x.Type == StockTransactionTypes.Reservation
                            && x.ReferenceType == "CUSTOMER_ORDER"
                            && x.ReferenceId == assignment.OrderId.ToString()
                            && x.Inventory != null
                            && x.Inventory.ProductId == line.ProductId)
                        .ToListAsync(ct);

                    if (reservations.Count > 0)
                    {
                        if (reservations.Sum(x => (long)x.Quantity) != requiredBaseQuantity) return Conflict(new { message = $"The reservation ledger for {line.ProductName} does not match the order quantity; delivery was not finalized." });
                        foreach (var reservation in reservations)
                        {
                            var stock = reservation.Inventory!;
                            var quantity = reservation.Quantity;
                            if (quantity <= 0 || stock.ReservedQuantity < quantity) return Conflict(new { message = $"The reserved stock for {line.ProductName}, batch {stock.BatchNumber}, is no longer available." });
                            if (stock.StockQuantity < quantity) return Conflict(new { message = $"The recorded stock for {line.ProductName} is lower than its reservation." });
                            if (stock.BatchStatus is "EXPIRED" or "DEPLETED" or "QUARANTINED" or "RETURNED" || stock.ExpiryDate.HasValue && stock.ExpiryDate.Value.Date < now.Date) return Conflict(new { message = $"Reserved batch {stock.BatchNumber} for {line.ProductName} is no longer valid for sale." });
                            var stockBefore = stock.StockQuantity;
                            stock.StockQuantity -= quantity;
                            stock.ReservedQuantity -= quantity;
                            stock.UpdatedAt = now;
                            db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.Sale, Quantity = -quantity, QuantityBefore = stockBefore, QuantityAfter = stock.StockQuantity, Unit = reservation.Unit, ReferenceType = "CUSTOMER_ORDER_DELIVERY", ReferenceId = assignment.OrderId.ToString(), Note = "Customer order delivered", ActorId = StaffId });
                        }
                        continue;
                    }

                    // Compatibility path for orders reserved before reservations carried
                    // an order reference. Consume only still-valid batches FEFO-style.
                    var remaining = (int)requiredBaseQuantity;
                    var legacyStocks = await db.Inventory
                        .Where(x => x.ProductId == line.ProductId && x.BranchId == assignment.Order.BranchId && x.ReservedQuantity > 0
                            && (!x.ExpiryDate.HasValue || x.ExpiryDate.Value.Date >= now.Date)
                            && x.BatchStatus != "EXPIRED" && x.BatchStatus != "DEPLETED"
                            && x.BatchStatus != "QUARANTINED" && x.BatchStatus != "RETURNED")
                        .OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue)
                        .ThenBy(x => x.CreatedAt)
                        .ToListAsync(ct);
                    foreach (var stock in legacyStocks)
                    {
                        if (remaining <= 0) break;
                        var quantity = Math.Min(remaining, Math.Min(stock.ReservedQuantity, stock.StockQuantity));
                        if (quantity <= 0) continue;
                        var before = stock.StockQuantity;
                        stock.StockQuantity -= quantity;
                        stock.ReservedQuantity -= quantity;
                        remaining -= quantity;
                        stock.UpdatedAt = now;
                        db.StockTransactions.Add(new StockTransaction { InventoryId = stock.Id, BranchId = stock.BranchId, Type = StockTransactionTypes.Sale, Quantity = -quantity, QuantityBefore = before, QuantityAfter = stock.StockQuantity, Unit = line.Unit, ReferenceType = "CUSTOMER_ORDER_DELIVERY", ReferenceId = assignment.OrderId.ToString(), ActorId = StaffId, Note = "Legacy customer order delivered" });
                    }
                    if (remaining > 0) return Conflict(new { message = $"The reservation ledger for {line.ProductName} is incomplete or contains expired stock; delivery was not finalized." });
                }
            }
            if (assignment.Order.Status != orderStatus) { assignment.Order.Status = orderStatus; db.OrderStatusHistory.Add(new OrderStatusHistory { OrderId = assignment.OrderId, Status = orderStatus, Note = notes, ActorId = StaffId.ToString(), ActorRole = User.FindFirstValue(ClaimTypes.Role) }); }
            var notificationCode = next == DeliveryStatuses.OutForDelivery ? "OUT_FOR_DELIVERY" : "ORDER_STATUS";
            var deliveryMessage = await notifications.RenderAsync(notificationCode, next == DeliveryStatuses.Delivered ? "Order delivered" : "Delivery update", next == DeliveryStatuses.Failed ? $"Your delivery could not be completed: {failureReason}" : $"Your order {assignment.Order.OrderNumber} is {next.Replace('_', ' ').ToLowerInvariant()}.", new Dictionary<string, string?> { ["order_id"] = assignment.Order.OrderNumber, ["order_status"] = next.Replace('_', ' ').ToLowerInvariant() }, ct);
            var customerNotification = new Notification { CustomerId = assignment.Order.CustomerId, Type = "delivery_status", Title = deliveryMessage.Title, Body = deliveryMessage.Body };
            db.Notifications.Add(customerNotification);
            var branchStaff = await db.StaffUsers.Where(staff => staff.IsActive &&
                (staff.Id == assignment.DeliveryStaffId || staff.Role == StaffRoles.Admin || staff.Role == StaffRoles.SuperAdmin || staff.Role == StaffRoles.Accountant
                    || staff.BranchId == assignment.Order.BranchId && (staff.Role == StaffRoles.Supervisor || staff.Role == StaffRoles.Pharmacist)))
                .ToListAsync(ct);
            var staffNotifications = branchStaff.Select(staff => new Notification { StaffUserId = staff.Id, Type = "delivery_status", Title = "Order delivery updated", Body = $"Order {assignment.Order.OrderNumber} is now {next.Replace('_', ' ').ToLowerInvariant()}." }).ToList();
            db.Notifications.AddRange(staffNotifications);
            db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = User.FindFirstValue(ClaimTypes.Role), Action = $"DELIVERY_{next}", EntityType = "PharmacyOrder", EntityId = assignment.OrderId.ToString(), PreviousValue = previousStatus, NewValue = next, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            if (next is DeliveryStatuses.Delivered or DeliveryStatuses.Failed) await messaging.CloseDeliveryConversationAsync(assignment.OrderId, ct);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            await notificationHub.Clients.Group(NotificationHub.Group("customer", assignment.Order.CustomerId)).SendAsync("notification", new { id = customerNotification.Id, type = customerNotification.Type, title = customerNotification.Title, body = customerNotification.Body, isRead = false, createdAt = customerNotification.CreatedAt }, ct);
            foreach (var notification in staffNotifications)
                if (notification.StaffUserId.HasValue)
                    await notificationHub.Clients.Group(NotificationHub.Group("staff", notification.StaffUserId.Value)).SendAsync("notification", new { id = notification.Id, type = notification.Type, title = notification.Title, body = notification.Body, isRead = false, createdAt = notification.CreatedAt }, ct);
            return Ok(ToOrder(assignment.Order, assignment));
        });
    }

    private async Task<DeliveryAssignment?> Load(Guid orderId, CancellationToken ct) => await db.DeliveryAssignments.Include(x => x.CurrentLocation).Include(x => x.Order).ThenInclude(x => x!.Customer).Include(x => x.Order).ThenInclude(x => x!.Branch).Include(x => x.Order).ThenInclude(x => x!.Pharmacist).Include(x => x.Order).ThenInclude(x => x!.DeliverySlot).Include(x => x.Order).ThenInclude(x => x!.Address).Include(x => x.Order).ThenInclude(x => x!.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Order).ThenInclude(x => x!.Prescription).Include(x => x.Order).ThenInclude(x => x!.StatusHistory).Include(x => x.Order).ThenInclude(x => x!.Documents).Include(x => x.DeliveryStaff).SingleOrDefaultAsync(x => x.OrderId == orderId && x.DeliveryStaffId == StaffId, ct);
    private static StaffOrderListItem ToList(PharmacyOrder x, DeliveryAssignment a) => new(x.Id, x.OrderNumber, x.Customer!.FullName, x.Customer.Phone, x.CreatedAt, x.Status, x.PaymentStatus, x.PaymentMethod, x.Total, x.Items.Any(i => i.Product?.Medicine?.PrescriptionRequired == true), a.Status, a.DeliveryStaff?.FullName);
    private static StaffOrderResponse ToOrder(PharmacyOrder x, DeliveryAssignment a) => new(x.Id, x.OrderNumber, x.Customer!.FullName, x.Customer.Email, x.Customer.Phone, x.CreatedAt, x.Status, x.PaymentStatus, x.PaymentMethod, x.Total, x.DeliveryFee, x.DeliveryInstructions, x.Address is null ? null : new StaffAddressItem(x.Address.Label, x.Address.Province, x.Address.District, x.Address.Municipality, x.Address.Ward, x.Address.StreetTole, x.Address.Landmark, x.Address.Phone, x.Address.Latitude, x.Address.Longitude), x.Items.Select(i => new StaffOrderItem(i.Id, i.ProductName, i.Quantity, i.UnitPrice, i.Product?.Sku ?? "", false)).ToList(), x.Prescription is null ? null : new StaffPrescriptionSummary(x.Prescription.Id, "Prescription verified", null), x.StatusHistory.OrderBy(h => h.CreatedAt).Select(h => new StatusHistoryItem(h.Status, h.Note, h.ActorId, h.ActorRole, h.CreatedAt)).ToList(), new DeliverySummary(a.Id, a.DeliveryStaffId, a.DeliveryStaff?.FullName ?? "", a.Status, a.AcceptedAt, a.PickedUpAt, a.OutForDeliveryAt, a.DeliveredAt, a.FailedAt, a.FailureReason, a.Notes, a.CurrentLocation is null ? null : new DeliveryCurrentLocation(a.CurrentLocation.Latitude, a.CurrentLocation.Longitude, a.CurrentLocation.AccuracyMeters, a.CurrentLocation.UpdatedAt), x.Branch?.Latitude is decimal latitude && x.Branch.Longitude is decimal longitude ? new DeliveryPickup(latitude, longitude, string.Join(", ", new[] { x.Branch.Name, x.Branch.StreetTole, x.Branch.Municipality, x.Branch.District, x.Branch.Province }.Where(part => !string.IsNullOrWhiteSpace(part)))) : null), x.BranchId, x.Branch?.Name, x.PharmacistId, x.Pharmacist?.FullName, x.DeliverySlotId, x.DeliverySlot?.Label, null, x.OrderMode, x.Documents.OrderByDescending(d => d.CreatedAt).Select(d => new OrderDocumentRow(d.Id, d.Kind, d.OriginalFileName, d.ContentType, d.Length, d.CreatedAt, $"/api/delivery/orders/{x.Id}/documents/{d.Id}")).ToList());

    private static double DistanceMeters(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        const double earthRadiusMeters = 6371000;
        static double ToRadians(double degrees) => degrees * Math.PI / 180;
        var dLat = ToRadians(latitude2 - latitude1);
        var dLon = ToRadians(longitude2 - longitude1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(ToRadians(latitude1)) * Math.Cos(ToRadians(latitude2)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return earthRadiusMeters * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private async Task<Guid?> RequireActiveRider(CancellationToken ct)
    {
        if (!User.IsStaffRole(StaffRoles.Delivery)) return null;
        var id = StaffId;
        return await db.StaffUsers.AsNoTracking().AnyAsync(x => x.Id == id && x.IsActive && x.Role == StaffRoles.Delivery, ct)
            ? id
            : null;
    }

    private async Task<bool> HasActiveAssignment(Guid staffId, CancellationToken ct)
        => await db.DeliveryAssignments.AnyAsync(x => x.DeliveryStaffId == staffId
            && (x.Status == DeliveryStatuses.Assigned || x.Status == DeliveryStatuses.Accepted
                || x.Status == DeliveryStatuses.PickedUp || x.Status == DeliveryStatuses.OutForDelivery), ct);

    private static bool IsValidLocation(DeliveryLocationUpdateRequest request)
        => request.Latitude.HasValue && request.Longitude.HasValue && request.Accuracy.HasValue
            && double.IsFinite(request.Latitude.Value) && request.Latitude is >= -90 and <= 90
            && double.IsFinite(request.Longitude.Value) && request.Longitude is >= -180 and <= 180
            && double.IsFinite(request.Accuracy.Value) && request.Accuracy is >= 0 and <= 1000;

    private static void ClearAvailabilityLocation(RiderAvailability availability)
    {
        availability.Latitude = null;
        availability.Longitude = null;
        availability.AccuracyMeters = null;
        availability.LocationUpdatedAt = null;
    }

    private static RiderAvailabilityResponse ToAvailabilityResponse(RiderAvailability? availability, bool hasActiveDelivery)
    {
        var location = !hasActiveDelivery && availability?.IsAvailable == true
            && availability.Latitude.HasValue && availability.Longitude.HasValue
            && availability.LocationUpdatedAt.HasValue
            ? new RiderAvailabilityLocation(availability.Latitude.Value, availability.Longitude.Value,
                availability.AccuracyMeters, availability.LocationUpdatedAt.Value)
            : null;
        return new RiderAvailabilityResponse(availability?.IsAvailable == true, hasActiveDelivery, location);
    }
}
