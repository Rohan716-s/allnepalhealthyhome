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
[Route("api/orders")]
public sealed class OrdersController(ApplicationDbContext db, INotificationTemplateService notifications, IHubContext<NotificationHub> notificationHub) : ControllerBase
{
    [HttpGet("price-visibility")]
    public async Task<ActionResult<PriceVisibilityResponse>> PriceVisibility(CancellationToken ct)
        => Ok(new PriceVisibilityResponse(await OrderPolicyReader.PricesVisibleAsync(db, User, ct)));

    [HttpGet("weekly-statement")]
    public async Task<ActionResult<CustomerStatementResponse>> WeeklyStatement([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var endLocal = (to?.Date.AddDays(1) ?? ApplicationTime.NepalNow.Date.AddDays(1));
        var startLocal = from?.Date ?? endLocal.AddDays(-7);
        if (startLocal >= endLocal || endLocal - startLocal > TimeSpan.FromDays(366)) return BadRequest(new { message = "Choose a valid statement period of no more than one year." });
        var start = ApplicationTime.ToUtc(startLocal); var end = ApplicationTime.ToUtc(endLocal);
        var customer = await db.Customers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == customerId && x.IsActive, ct);
        if (customer is null) return Unauthorized();
        var orders = await db.Orders.AsNoTracking().Where(x => x.CustomerId == customerId && x.CreatedAt >= start && x.CreatedAt < end && x.Status != OrderStatuses.Cancelled && x.Status != OrderStatuses.Failed)
            .Include(x => x.PaymentTransactions).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var lines = orders.Select(order =>
        {
            var billed = order.Total;
            var paid = Math.Min(billed, order.PaymentTransactions.Where(x => x.Status == PaymentTransactionStatuses.Paid).Sum(x => x.Amount));
            return new CustomerStatementLine(order.Id, order.OrderNumber, order.CreatedAt, order.Status, order.PaymentStatus, order.PaymentMethod, billed, paid, Math.Max(0m, billed - paid));
        }).ToList();
        return Ok(new CustomerStatementResponse(customer.Id, customer.FullName, customer.Phone, startLocal, endLocal.AddTicks(-1), lines.Count, lines.Sum(x => x.BilledAmount), lines.Sum(x => x.PaidAmount), lines.Sum(x => x.Balance), lines));
    }

    [HttpPost("coupon/validate")]
    public async Task<ActionResult<CouponValidationResponse>> ValidateCoupon(CouponValidationRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized(new { message = "Please sign in before validating a coupon." });
        if (!await OrderPolicyReader.PricesVisibleAsync(db, User, ct)) return BadRequest(new { message = "Coupon validation is unavailable while item prices are hidden. You can continue without a coupon." });
        if (request.Subtotal <= 0) return BadRequest(new { message = "Add an item before applying a coupon." });
        var result = await ResolveCoupon(request.Code, request.Subtotal, customerId, ct);
        if (result.Error is not null) return BadRequest(new { message = result.Error });
        var coupon = result.Coupon!;
        return Ok(new CouponValidationResponse(coupon.Code, coupon.Type, coupon.Value, result.Discount, request.Subtotal, request.Subtotal - result.Discount));
    }

    [HttpPost("delivery-quote")]
    public async Task<ActionResult<DeliveryQuoteResponse>> DeliveryQuote(DeliveryQuoteRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized(new { message = "Please sign in before checking delivery availability." });
        decimal quoteSubtotal;
        if (request.Items is { Count: > 0 })
        {
            if (request.Items.Any(item => string.IsNullOrWhiteSpace(item.ProductCode) || item.Quantity is < 1 or > 999)
                || request.Items.GroupBy(item => item.ProductCode, StringComparer.OrdinalIgnoreCase).Any(group => group.Count() > 1))
                return BadRequest(new { message = "The delivery quote contains invalid or duplicate order items." });
            var codes = request.Items.Select(item => item.ProductCode).ToList();
            var products = await db.Products.AsNoTracking().Where(product => product.IsActive && (codes.Contains(product.Sku) || codes.Contains(product.Slug))).ToListAsync(ct);
            if (products.Count != codes.Count) return BadRequest(new { message = "One or more selected products are no longer available." });
            quoteSubtotal = request.Items.Sum(item => products.Single(product => product.Sku.Equals(item.ProductCode, StringComparison.OrdinalIgnoreCase) || product.Slug.Equals(item.ProductCode, StringComparison.OrdinalIgnoreCase)).SellingPrice * item.Quantity);
        }
        else
        {
            // Legacy callers can still quote with a subtotal only when they are allowed to see prices.
            if (!await OrderPolicyReader.PricesVisibleAsync(db, User, ct)) return BadRequest(new { message = "Refresh the cart before checking delivery." });
            quoteSubtotal = request.Subtotal;
        }
        if (quoteSubtotal <= 0) return BadRequest(new { message = "Add an item before checking delivery." });
        var branch = request.BranchId.HasValue
            ? await db.Branches.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.BranchId.Value && x.IsActive && x.DeliveryEnabled, ct)
            : await db.Branches.AsNoTracking().Where(x => x.IsActive && x.DeliveryEnabled).OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (branch is null) return Conflict(new { message = "No pharmacy branch is configured." });
        var zone = await FindDeliveryZone(request.Province, request.District, request.Municipality, request.Ward, branch.Id, ct);
        if (zone?.MinimumOrder > quoteSubtotal) return BadRequest(new { message = $"This delivery zone requires a minimum order of NPR {zone.MinimumOrder:N2}." });
        return Ok(new DeliveryQuoteResponse(zone?.Name, CalculateDeliveryFee(zone, quoteSubtotal), zone?.FreeDeliveryThreshold ?? 1000, zone?.MinimumOrder ?? 0, zone?.SameDayDelivery ?? false));
    }

    [HttpGet("track")]
    public async Task<ActionResult<PublicOrderTrackingResponse>> Track([FromQuery] string type, [FromQuery] string value, CancellationToken ct)
    {
        var reference = value?.Trim();
        if (string.IsNullOrWhiteSpace(reference) || reference.Length > 80)
            return BadRequest(new { message = "Enter a valid Order ID or Tracking ID." });

        // Orders currently use the customer-facing order number as the tracking
        // reference. Keeping the type parameter makes the public UI ready for a
        // separate carrier/AWB number later without exposing private order data.
        var order = await db.Orders.AsNoTracking()
            .Include(x => x.Branch)
            .Include(x => x.DeliveryAssignment)
            .Include(x => x.StatusHistory)
            .SingleOrDefaultAsync(x => x.OrderNumber == reference, ct);
        if (order is null) return NotFound(new { message = "We could not find an order with that reference." });

        var pricesVisible = await OrderPolicyReader.PricesVisibleForCustomerAsync(db, order.CustomerId, ct);
        var timeline = order.StatusHistory
            .OrderBy(x => x.CreatedAt)
            .Select(x => new PublicOrderTrackingEvent(x.Status, x.CreatedAt))
            .ToList();
        return Ok(new PublicOrderTrackingResponse(
            order.OrderNumber,
            order.OrderNumber,
            order.Status,
            order.DeliveryAssignment?.Status,
            pricesVisible ? order.Total : 0,
            order.CreatedAt,
            order.Branch?.Name,
            timeline,
            pricesVisible));
    }

    [HttpGet("{id:guid}/payment-instructions")]
    public async Task<ActionResult<PaymentInstructionsResponse>> PaymentInstructions(Guid id, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId, ct);
        if (order is null) return NotFound();
        var method = await db.PaymentMethodConfigurations.AsNoTracking().SingleOrDefaultAsync(x => x.Code == order.PaymentMethod && x.IsEnabled, ct);
        return Ok(new PaymentInstructionsResponse(order.OrderNumber, order.PaymentMethod, order.PaymentStatus, order.Total, method?.Instructions, method?.QrCodeUrl));
    }

    [HttpPost]
    public async Task<ActionResult<CustomerOrderResponse>> Create(CreateOrderRequest request, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized(new { message = "Please sign in before placing an order." });
        var customerCanSeePrices = await OrderPolicyReader.PricesVisibleForCustomerAsync(db, customerId, ct);
        if (request.Items is null || request.Items.Count == 0) return BadRequest(new { message = "Your order must contain at least one item." });
        if (request.Items.Any(x => x.Quantity <= 0 || x.Quantity > 999)) return BadRequest(new { message = "Each quantity must be between 1 and 999." });
        if (request.Items.GroupBy(x => x.ProductCode, StringComparer.OrdinalIgnoreCase).Any(group => group.Count() > 1)) return BadRequest(new { message = "Each medicine may appear once in an order. Update its quantity in the cart before checkout." });
        var paymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? PaymentMethods.CashOnDelivery : request.PaymentMethod.Trim().ToUpperInvariant();
        var configuredPaymentMethod = await db.PaymentMethodConfigurations.AsNoTracking().SingleOrDefaultAsync(x => x.Code == paymentMethod, ct);
        if (configuredPaymentMethod is null || !configuredPaymentMethod.IsEnabled) return BadRequest(new { message = "The selected payment method is not available." });
        var codes = request.Items.Select(x => x.ProductCode).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var products = await db.Products.Include(x => x.Medicine).Include(x => x.Units).Where(x => x.IsActive && (codes.Contains(x.Sku) || codes.Contains(x.Slug))).ToListAsync(ct);
        if (products.Count != codes.Count) return BadRequest(new { message = "One or more products are no longer available." });
        var orderingJson = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "orders.configuration").Select(x => x.Value).SingleOrDefaultAsync(ct);
        var ordering = OrderingConfiguration.Parse(orderingJson);
        var orderingCopy = ordering.CopyFor(request.Locale);
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Phone) || string.IsNullOrWhiteSpace(request.Email)
            || string.IsNullOrWhiteSpace(request.Province) || string.IsNullOrWhiteSpace(request.District) || string.IsNullOrWhiteSpace(request.Municipality)
            || string.IsNullOrWhiteSpace(request.Ward) || string.IsNullOrWhiteSpace(request.StreetTole))
            return BadRequest(new { message = orderingCopy.RequiredFieldsMessage });
        if (!System.Net.Mail.MailAddress.TryCreate(request.Email.Trim(), out _))
            return BadRequest(new { message = orderingCopy.InvalidEmailMessage });
        if (request.Latitude.HasValue != request.Longitude.HasValue || request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Enter a valid map location: latitude and longitude must both be provided." });
        var orderMode = string.IsNullOrWhiteSpace(request.OrderMode)
            ? ordering.Mode == "BULK_ONLY" ? "BULK" : "SINGLE"
            : request.OrderMode.Trim().ToUpperInvariant();
        if (orderMode is not ("SINGLE" or "BULK")) return BadRequest(new { message = orderingCopy.ChooseMode });
        if (orderMode == "SINGLE" && ordering.Mode == "BULK_ONLY")
            return Conflict(new { code = OrderingMessages.SingleUnavailableCode, message = orderingCopy.SingleUnavailableMessage });
        if (orderMode == "BULK" && ordering.Mode == "SINGLE_ONLY")
            return Conflict(new { code = OrderingMessages.BulkUnavailableCode, message = orderingCopy.BulkUnavailableMessage });
        if (orderMode == "SINGLE" && request.Items.Count != 1)
            return BadRequest(new { message = orderingCopy.SingleProductLimitMessage });
        foreach (var item in request.Items)
        {
            var product = products.Single(x => x.Sku.Equals(item.ProductCode, StringComparison.OrdinalIgnoreCase) || x.Slug.Equals(item.ProductCode, StringComparison.OrdinalIgnoreCase));
            var rule = ordering.RuleFor(product);
            if (orderMode == "BULK" && !rule.AllowBulk)
                return Conflict(new { code = OrderingMessages.BulkUnavailableCode, message = orderingCopy.BulkUnavailableMessage });
            if (orderMode == "SINGLE" && !rule.AllowSingle)
                return Conflict(new { code = OrderingMessages.SingleUnavailableCode, message = orderingCopy.SingleUnavailableMessage });
            var minimumQuantity = orderMode == "BULK"
                ? Math.Max(ordering.MinimumBulkQuantity, Math.Max(1, rule.MinimumQuantity))
                : Math.Max(1, rule.MinimumQuantity);
            if (item.Quantity < minimumQuantity)
                return BadRequest(new { message = OrderingMessages.Format(orderingCopy.MinimumQuantityMessage, ("product", product.Name), ("minimum", minimumQuantity.ToString())) });
        }
        var prescriptionRequired = products.Any(x => x.Medicine?.PrescriptionRequired == true);
        Prescription? prescription = null;
        if (prescriptionRequired)
        {
            if (request.PrescriptionId is null) return Conflict(new { message = "A pharmacist-approved prescription is required for this order." });
            prescription = await db.Prescriptions.SingleOrDefaultAsync(x => x.Id == request.PrescriptionId && x.CustomerId == customerId, ct);
            if (prescription is null || prescription.Status is not (PrescriptionStatuses.Approved or PrescriptionStatuses.PartiallyApproved)) return Conflict(new { message = "The selected prescription has not been approved for ordering." });
        }
        var customer = await db.Customers.SingleOrDefaultAsync(x => x.Id == customerId && x.IsActive, ct); if (customer is null) return Unauthorized();
        var isPharmacy = customer.AccountType == "PHARMACY";
        var pricingBranch = request.BranchId.HasValue
            ? await db.Branches.SingleOrDefaultAsync(x => x.Id == request.BranchId.Value && x.IsActive && x.DeliveryEnabled, ct)
            : await db.Branches.Where(x => x.IsActive && x.DeliveryEnabled).OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (pricingBranch is null) return Conflict(new { message = "No pharmacy branch is configured." });
        DeliverySlot? deliverySlot = null;
        if (request.DeliverySlotId.HasValue)
        {
            deliverySlot = await db.DeliverySlots.SingleOrDefaultAsync(x => x.Id == request.DeliverySlotId.Value && x.Enabled && (x.BranchId == null || x.BranchId == pricingBranch.Id), ct);
            if (deliverySlot is null) return BadRequest(new { message = "The selected delivery time slot is no longer available." });
            if (deliverySlot.MaxOrders.HasValue && await db.Orders.CountAsync(x => x.DeliverySlotId == deliverySlot.Id && x.CreatedAt >= DateTime.UtcNow.Date && x.Status != OrderStatuses.Cancelled, ct) >= deliverySlot.MaxOrders.Value) return Conflict(new { message = "That delivery time slot is full. Please choose another slot." });
        }
        var pricingNow = DateTime.UtcNow;
        var productIds = products.Select(x => x.Id).ToList();
        var activeSales = isPharmacy ? await db.FlashSales.AsNoTracking().Where(x => productIds.Contains(x.ProductId) && x.IsActive && x.StartsAt <= pricingNow && x.EndsAt > pricingNow && (x.BranchId == null || x.BranchId == pricingBranch.Id)).ToListAsync(ct) : [];
        var selectedSales = activeSales.GroupBy(x => x.ProductId).ToDictionary(x => x.Key, x => x.OrderByDescending(s => s.DiscountPercent).FirstOrDefault(s => !s.QuantityLimit.HasValue || s.QuantitySold + request.Items.Where(i => products.Single(p => p.Sku.Equals(i.ProductCode, StringComparison.OrdinalIgnoreCase) || p.Slug.Equals(i.ProductCode, StringComparison.OrdinalIgnoreCase)).Id == s.ProductId).Sum(i => i.Quantity) <= s.QuantityLimit.Value));
        decimal SalePrice(Product product, int quantity)
        {
            var sale = selectedSales.GetValueOrDefault(product.Id);
            return sale is null ? product.SellingPrice : Math.Round(product.SellingPrice * (1 - sale.DiscountPercent / 100m), 2);
        }
        var subtotal = request.Items.Sum(requestItem =>
        {
            var product = products.Single(x => x.Sku.Equals(requestItem.ProductCode, StringComparison.OrdinalIgnoreCase) || x.Slug.Equals(requestItem.ProductCode, StringComparison.OrdinalIgnoreCase));
            return SalePrice(product, requestItem.Quantity) * requestItem.Quantity;
        });
        if (configuredPaymentMethod.MinimumOrder.HasValue && subtotal < configuredPaymentMethod.MinimumOrder.Value) return BadRequest(new { message = $"This payment method requires a minimum order of NPR {configuredPaymentMethod.MinimumOrder.Value:N2}." });
        if (configuredPaymentMethod.MaximumOrder.HasValue && subtotal > configuredPaymentMethod.MaximumOrder.Value) return BadRequest(new { message = $"This payment method is limited to orders up to NPR {configuredPaymentMethod.MaximumOrder.Value:N2}." });
        var couponResult = await ResolveCoupon(request.CouponCode, subtotal, customerId, ct);
        if (couponResult.Error is not null) return BadRequest(new { message = couponResult.Error });
        var deliveryZone = await FindDeliveryZone(request.Province, request.District, request.Municipality, request.Ward, pricingBranch.Id, ct);
        if (deliveryZone?.MinimumOrder > subtotal) return BadRequest(new { message = $"This delivery zone requires a minimum order of NPR {deliveryZone.MinimumOrder:N2}." });
        var deliveryFee = CalculateDeliveryFee(deliveryZone, subtotal);

        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult<CustomerOrderResponse>>(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
            var address = new Address { CustomerId = customerId, Label = "Checkout", Province = request.Province.Trim(), District = request.District.Trim(), Municipality = request.Municipality.Trim(), Ward = request.Ward.Trim(), StreetTole = request.StreetTole.Trim(), Landmark = request.Landmark?.Trim(), Phone = request.Phone.Trim(), Latitude = request.Latitude, Longitude = request.Longitude, IsDefault = false };
            db.Addresses.Add(address);
            var branch = pricingBranch;
            decimal total = 0; var order = new PharmacyOrder { CustomerId = customerId, BranchId = branch.Id, PharmacistId = null, DeliverySlotId = deliverySlot?.Id, PrescriptionId = prescription?.Id, Address = address, OrderNumber = $"ANHH-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", Status = prescriptionRequired ? OrderStatuses.PrescriptionVerification : OrderStatuses.Confirmed, PaymentStatus = "PENDING", OrderMode = orderMode, PaymentMethod = paymentMethod, DeliveryFee = deliveryFee, DeliveryInstructions = request.DeliveryInstructions?.Trim(), CustomerNotes = request.Notes?.Trim(), OrderCustomerName = request.FullName.Trim(), OrderCustomerPhone = request.Phone.Trim(), OrderCustomerEmail = request.Email.Trim(), CouponCode = couponResult.Coupon?.Code, DiscountAmount = couponResult.Discount };
            foreach (var requestItem in request.Items)
            {
                var product = products.Single(x => x.Sku.Equals(requestItem.ProductCode, StringComparison.OrdinalIgnoreCase) || x.Slug.Equals(requestItem.ProductCode, StringComparison.OrdinalIgnoreCase));
                var today = ApplicationTime.NepalNow.Date;
                var salesMultiplier = product.SalesUnitToBase > 0 ? product.SalesUnitToBase : 1;
                var requiredStockLong = (long)requestItem.Quantity * salesMultiplier;
                if (requiredStockLong > int.MaxValue) return BadRequest(new { message = $"The requested quantity for {product.Name} is too large." });
                var eligibleInventory = await db.Inventory
                    .Where(x => x.ProductId == product.Id && x.BranchId == branch.Id && x.StockQuantity > x.ReservedQuantity
                        && (!x.ExpiryDate.HasValue || x.ExpiryDate.Value.Date >= today)
                        && x.BatchStatus != "EXPIRED" && x.BatchStatus != "DEPLETED"
                        && x.BatchStatus != "QUARANTINED" && x.BatchStatus != "RETURNED")
                    .OrderBy(x => x.ExpiryDate ?? DateTime.MaxValue)
                    .ThenBy(x => x.CreatedAt)
                    .ToListAsync(ct);
                if (eligibleInventory.Sum(x => (long)x.StockQuantity - x.ReservedQuantity) < requiredStockLong)
                {
                    if (orderMode == "BULK") return Conflict(new { code = OrderingMessages.BulkUnavailableCode, message = orderingCopy.BulkUnavailableMessage });
                    return Conflict(new { message = $"{product.Name} does not have enough available non-expired stock." });
                }
                var remainingToReserve = (int)requiredStockLong;
                foreach (var inventory in eligibleInventory)
                {
                    if (remainingToReserve <= 0) break;
                    var take = Math.Min(remainingToReserve, inventory.StockQuantity - inventory.ReservedQuantity);
                    var before = inventory.ReservedQuantity; inventory.ReservedQuantity += take; inventory.UpdatedAt = DateTime.UtcNow; remainingToReserve -= take;
                    db.StockTransactions.Add(new StockTransaction { InventoryId = inventory.Id, BranchId = inventory.BranchId, Type = StockTransactionTypes.Reservation, Quantity = take, QuantityBefore = before, QuantityAfter = inventory.ReservedQuantity, Unit = product.BaseUnit, ReferenceType = "CUSTOMER_ORDER", ReferenceId = order.Id.ToString(), Note = "Customer order reservation" });
                }
                if (remainingToReserve > 0) return Conflict(new { message = $"Available stock for {product.Name} changed during checkout. Refresh and try again." });
                var flashSale = isPharmacy ? await db.FlashSales.Where(x => x.ProductId == product.Id && x.IsActive && x.StartsAt <= DateTime.UtcNow && x.EndsAt > DateTime.UtcNow && (x.BranchId == null || x.BranchId == branch.Id) && (!x.QuantityLimit.HasValue || x.QuantitySold + requestItem.Quantity <= x.QuantityLimit.Value)).OrderByDescending(x => x.DiscountPercent).FirstOrDefaultAsync(ct) : null;
                var unitPrice = flashSale is null ? product.SellingPrice : Math.Round(product.SellingPrice * (1 - flashSale.DiscountPercent / 100m), 2);
                if (flashSale is not null) flashSale.QuantitySold += requestItem.Quantity;
                order.Items.Add(new OrderItem { ProductId = product.Id, ProductName = product.Name, Quantity = requestItem.Quantity, Unit = product.SalesUnit, UnitMultiplier = salesMultiplier, UnitPrice = unitPrice }); total += unitPrice * requestItem.Quantity;
            }
            order.DeliveryFee = CalculateDeliveryFee(deliveryZone, total); order.Total = Math.Max(0, total - couponResult.Discount) + order.DeliveryFee; if (couponResult.Coupon is not null) couponResult.Coupon.UsedCount++;
            db.PaymentTransactions.Add(new PaymentTransaction { Order = order, TransactionNumber = $"ANHH-TXN-{Guid.NewGuid():N}"[..20].ToUpperInvariant(), Method = paymentMethod, Status = PaymentTransactionStatuses.Pending, Amount = order.Total, Notes = configuredPaymentMethod.RequiresServerVerification ? "Awaiting server-side payment verification." : "Awaiting collection or confirmation." });
            order.StatusHistory.Add(new OrderStatusHistory { Status = order.Status, Note = "Order created by customer", ActorId = customerId.ToString(), ActorRole = "CUSTOMER" }); db.Orders.Add(order);
            var orderMessage = await notifications.RenderAsync("ORDER_PLACED", "Order received", $"Your order {order.OrderNumber} has been received.", new Dictionary<string, string?> { ["order_id"] = order.OrderNumber, ["total_amount"] = customerCanSeePrices ? $"NPR {order.Total:N2}" : string.Empty, ["customer_name"] = customer.FullName, ["website_name"] = "All Nepal Healthy Home" }, ct);
            var customerNotification = new Notification { CustomerId = customerId, Type = "order_created", Title = orderMessage.Title, Body = orderMessage.Body };
            db.Notifications.Add(customerNotification);
            var branchStaff = await db.StaffUsers.Where(staff => staff.IsActive &&
                (staff.Role == StaffRoles.Admin || staff.Role == StaffRoles.SuperAdmin || staff.Role == StaffRoles.Accountant
                    || staff.BranchId == branch.Id && (staff.Role == StaffRoles.Supervisor || staff.Role == StaffRoles.Pharmacist)))
                .ToListAsync(ct);
            var staffNotifications = branchStaff.Select(staff => new Notification
            {
                StaffUserId = staff.Id,
                Type = "order_created",
                Title = "New order received",
                Body = $"Order {order.OrderNumber} was placed by {customer.FullName} for {branch.Name}."
            }).ToList();
            db.Notifications.AddRange(staffNotifications);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await notificationHub.Clients.Group(NotificationHub.Group("customer", customerId)).SendAsync("notification", new { id = customerNotification.Id, type = customerNotification.Type, title = customerNotification.Title, body = customerNotification.Body, isRead = false, createdAt = customerNotification.CreatedAt }, ct);
            foreach (var recipient in staffNotifications)
                if (recipient.StaffUserId.HasValue)
                    await notificationHub.Clients.Group(NotificationHub.Group("staff", recipient.StaffUserId.Value)).SendAsync("notification", new { id = recipient.Id, type = recipient.Type, title = recipient.Title, body = recipient.Body, isRead = false, createdAt = recipient.CreatedAt }, ct);
            return Ok(new CustomerOrderResponse(order.Id, order.OrderNumber, order.Status, customerCanSeePrices ? order.Total : 0, order.CreatedAt));
        });
    }

    private async Task<(Coupon? Coupon, decimal Discount, string? Error)> ResolveCoupon(string? code, decimal subtotal, Guid customerId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code)) return (null, 0, null);
        var coupon = await db.Coupons.SingleOrDefaultAsync(x => x.Code == code.Trim().ToUpperInvariant(), ct);
        if (coupon is null || !coupon.IsActive) return (null, 0, "This coupon is not available.");
        var now = DateTime.UtcNow;
        if (coupon.StartsAt > now || coupon.EndsAt <= now) return (null, 0, "This coupon is outside its valid dates.");
        if (coupon.UsageLimit.HasValue && coupon.UsedCount >= coupon.UsageLimit.Value) return (null, 0, "This coupon has reached its usage limit.");
        if (coupon.FirstOrderOnly && await db.Orders.AnyAsync(x => x.CustomerId == customerId, ct)) return (null, 0, "This coupon is only valid on your first order.");
        if (coupon.MinimumOrder.HasValue && subtotal < coupon.MinimumOrder.Value) return (null, 0, $"This coupon requires a minimum order of NPR {coupon.MinimumOrder.Value:N2}.");
        var discount = coupon.Type.Equals("FIXED", StringComparison.OrdinalIgnoreCase) ? coupon.Value : subtotal * coupon.Value / 100m;
        if (coupon.MaximumDiscount.HasValue) discount = Math.Min(discount, coupon.MaximumDiscount.Value);
        return (coupon, Math.Min(Math.Max(0, discount), subtotal), null);
    }

    private async Task<DeliveryZone?> FindDeliveryZone(string? province, string? district, string? municipality, string? ward, Guid branchId, CancellationToken ct)
    {
        var requested = new[] { province?.Trim() ?? "", district?.Trim() ?? "", municipality?.Trim() ?? "", ward?.Trim() ?? "" };
        var zones = await db.DeliveryZones.AsNoTracking().Where(x => x.Enabled && (x.BranchId == null || x.BranchId == branchId)).ToListAsync(ct);
        return zones.Where(zone => Matches(zone.Province, requested[0]) && Matches(zone.District, requested[1]) && Matches(zone.Municipality, requested[2]) && Matches(zone.Ward, requested[3])).OrderByDescending(zone => Specificity(zone, branchId)).ThenByDescending(zone => zone.UpdatedAt).FirstOrDefault();
    }

    private static bool Matches(string? configured, string requested) => string.IsNullOrWhiteSpace(configured) || configured.Equals(requested, StringComparison.OrdinalIgnoreCase);
    private static int Specificity(DeliveryZone zone, Guid branchId) => (zone.BranchId == branchId ? 16 : 0) + (string.IsNullOrWhiteSpace(zone.Province) ? 0 : 1) + (string.IsNullOrWhiteSpace(zone.District) ? 0 : 2) + (string.IsNullOrWhiteSpace(zone.Municipality) ? 0 : 4) + (string.IsNullOrWhiteSpace(zone.Ward) ? 0 : 8);
    private static decimal CalculateDeliveryFee(DeliveryZone? zone, decimal subtotal) => zone is null ? (subtotal >= 1000 ? 0 : 100) : zone.FreeDeliveryThreshold > 0 && subtotal >= zone.FreeDeliveryThreshold ? 0 : zone.DeliveryFee;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StaffOrderListItem>>> List(CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var pricesVisible = await OrderPolicyReader.PricesVisibleAsync(db, User, ct);
        var orders = await db.Orders.AsNoTracking().Where(x => x.CustomerId == customerId).Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.DeliveryStaff).OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(ct);
        return Ok(orders.Select(x => new StaffOrderListItem(x.Id, x.OrderNumber, x.OrderCustomerName ?? x.Customer?.FullName ?? "Customer", x.OrderCustomerPhone ?? x.Customer?.Phone ?? string.Empty, x.CreatedAt, x.Status, x.PaymentStatus, x.PaymentMethod, pricesVisible ? x.Total : 0, x.Items.Any(i => i.Product?.Medicine?.PrescriptionRequired == true), x.DeliveryAssignment?.Status, x.DeliveryAssignment?.DeliveryStaff?.FullName, x.Branch?.Name, x.OrderMode, pricesVisible)).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StaffOrderResponse>> Get(Guid id, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var pricesVisible = await OrderPolicyReader.PricesVisibleAsync(db, User, ct);
        var order = await db.Orders.AsNoTracking().Where(x => x.Id == id && x.CustomerId == customerId).Include(x => x.Customer).Include(x => x.Branch).Include(x => x.Pharmacist).Include(x => x.DeliverySlot).Include(x => x.Address).Include(x => x.Items).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.Prescription).Include(x => x.StatusHistory).Include(x => x.DeliveryAssignment).ThenInclude(x => x!.DeliveryStaff).SingleOrDefaultAsync(ct);
        if (order is null) return NotFound();
        var response = new StaffOrderResponse(order.Id, order.OrderNumber, order.OrderCustomerName ?? order.Customer?.FullName ?? "Customer", order.OrderCustomerEmail ?? order.Customer?.Email ?? string.Empty, order.OrderCustomerPhone ?? order.Customer?.Phone ?? string.Empty, order.CreatedAt, order.Status, order.PaymentStatus, order.PaymentMethod, order.Total, order.DeliveryFee, order.DeliveryInstructions, order.Address is null ? null : new StaffAddressItem(order.Address.Label, order.Address.Province, order.Address.District, order.Address.Municipality, order.Address.Ward, order.Address.StreetTole, order.Address.Landmark, order.Address.Phone, order.Address.Latitude, order.Address.Longitude), order.Items.Select(i => new StaffOrderItem(i.Id, i.ProductName, i.Quantity, i.UnitPrice, i.Product?.Sku ?? "", i.Product?.Medicine?.PrescriptionRequired ?? false)).ToList(), order.Prescription is null ? null : new StaffPrescriptionSummary(order.Prescription.Id, order.Prescription.Status, null), order.StatusHistory.OrderBy(x => x.CreatedAt).Select(h => new StatusHistoryItem(h.Status, h.Note, h.ActorId, h.ActorRole, h.CreatedAt)).ToList(), order.DeliveryAssignment is null ? null : new DeliverySummary(order.DeliveryAssignment.Id, order.DeliveryAssignment.DeliveryStaffId, order.DeliveryAssignment.DeliveryStaff?.FullName ?? "", order.DeliveryAssignment.Status, order.DeliveryAssignment.AcceptedAt, order.DeliveryAssignment.PickedUpAt, order.DeliveryAssignment.OutForDeliveryAt, order.DeliveryAssignment.DeliveredAt, order.DeliveryAssignment.FailedAt, order.DeliveryAssignment.FailureReason, order.DeliveryAssignment.Notes), order.BranchId, order.Branch?.Name, order.PharmacistId, order.Pharmacist?.FullName, order.DeliverySlotId, order.DeliverySlot?.Label, order.CustomerNotes, order.OrderMode);
        if (!pricesVisible) response = response with { Total = 0, DeliveryFee = 0, Items = response.Items.Select(item => item with { UnitPrice = 0 }).ToList(), PricesVisible = false };
        return Ok(response);
    }

    [HttpGet("{orderId:guid}/tracking")]
    public async Task<ActionResult<CustomerLiveTrackingResponse>> LiveTracking(Guid orderId, CancellationToken ct)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var order = await db.Orders.AsNoTracking()
            .Where(x => x.Id == orderId && x.CustomerId == customerId)
            .Select(x => new
            {
                x.Id,
                x.OrderNumber,
                x.Status,
                Address = x.Address == null ? null : new
                {
                    x.Address.Latitude,
                    x.Address.Longitude,
                    x.Address.StreetTole,
                    x.Address.Ward,
                    x.Address.Municipality,
                    x.Address.District,
                    x.Address.Province
                },
                Assignment = x.DeliveryAssignment == null ? null : new
                {
                    x.DeliveryAssignment.Status,
                    RiderName = x.DeliveryAssignment.DeliveryStaff!.FullName,
                    Location = x.DeliveryAssignment.CurrentLocation == null ? null : new
                    {
                        x.DeliveryAssignment.CurrentLocation.Latitude,
                        x.DeliveryAssignment.CurrentLocation.Longitude,
                        x.DeliveryAssignment.CurrentLocation.AccuracyMeters,
                        x.DeliveryAssignment.CurrentLocation.UpdatedAt
                    }
                }
            })
            .SingleOrDefaultAsync(ct);
        if (order is null) return NotFound();
        var isOutForDelivery = order.Assignment?.Status == DeliveryStatuses.OutForDelivery
            && order.Status == OrderStatuses.OutForDelivery;
        var riderName = isOutForDelivery ? order.Assignment!.RiderName : null;
        var location = isOutForDelivery && order.Assignment!.Location is { } point
            && point.UpdatedAt >= DateTime.UtcNow.AddMinutes(-2)
            ? new CustomerLiveLocation(point.Latitude, point.Longitude, point.AccuracyMeters, point.UpdatedAt)
            : null;
        var destination = order.Address?.Latitude is decimal latitude && order.Address.Longitude is decimal longitude
            ? new CustomerLiveDestination(latitude, longitude, string.Join(", ",
                new[] { order.Address.StreetTole, $"Ward {order.Address.Ward}", order.Address.Municipality, order.Address.District, order.Address.Province }
                    .Where(part => !string.IsNullOrWhiteSpace(part))))
            : null;
        return Ok(new CustomerLiveTrackingResponse(order.Id, order.OrderNumber, order.Assignment?.Status,
            riderName, location, destination));
    }
}
