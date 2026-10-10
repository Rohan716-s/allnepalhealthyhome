using System.Data.Common;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using backend.Controllers;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace backend.Middleware;

/// <summary>Uses the existing controllers, with one atomic transaction for their writes and replay receipt.</summary>
public sealed class OfflineSyncMiddleware(RequestDelegate next, ILogger<OfflineSyncMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue("X-Offline-Operation", out var operation)) { await next(context); return; }
        if (!Guid.TryParse(operation, out var operationId) || !OfflineSyncPolicy.Supports(context.Request.Method, context.Request.Path))
        { await Problem(context, 400, "This operation cannot be synchronized offline."); return; }
        if (!Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId) || context.User.Identity?.IsAuthenticated != true)
        { await Problem(context, 401, "Sign in again to synchronize your saved changes."); return; }

        // Only these requests disable EF's automatic retries. Retrying the HTTP
        // operation with the same UUID is safe; rerunning MVC inside a DB retry is not.
        context.Items["offline-sync-transaction"] = true;
        var db = context.RequestServices.GetRequiredService<ApplicationDbContext>();
        var type = context.User.FindFirstValue("account_type") ?? "customer";
        var owner = $"{type}:{actorId:N}";
        if (!await Authorized(context, db, type, actorId))
        { await Problem(context, 403, "You no longer have permission to synchronize this change."); return; }
        var hash = await Fingerprint(context.Request);
        var connection = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync(context.RequestAborted);
        var lockName = "offline:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(owner + operationId))).Substring(0, 48);
        var locked = false;
        var originalBody = context.Response.Body;
        try
        {
            locked = Convert.ToInt32(await Command(connection, null, "SELECT GET_LOCK(@name, 5)", ("name", lockName)).ExecuteScalarAsync(context.RequestAborted)) == 1;
            if (!locked) { await Problem(context, 503, "This change is already syncing. It will retry automatically."); return; }
            await using var receiptQuery = Command(connection, null,
                "SELECT RequestHash, StatusCode, ResponseBody FROM offline_sync_receipts WHERE Owner = @owner AND OperationId = @id",
                ("owner", owner), ("id", operationId.ToString()));
            await using (var reader = await receiptQuery.ExecuteReaderAsync(context.RequestAborted))
            {
                if (await reader.ReadAsync(context.RequestAborted))
                {
                    if (reader.GetString(0) != hash) { await Problem(context, 409, "This sync identifier was already used for different data."); return; }
                    context.Response.StatusCode = reader.GetInt32(1);
                    context.Response.ContentType = "application/json";
                    context.Response.Headers["X-Offline-Replayed"] = "true";
                    await context.Response.WriteAsync(reader.GetString(2), context.RequestAborted);
                    return;
                }
            }
            await using var transaction = await db.Database.BeginTransactionAsync(context.RequestAborted);
            var sqlTransaction = transaction.GetDbTransaction();
            if (!await VersionMatches(context, db, connection, sqlTransaction, actorId))
            { await transaction.RollbackAsync(context.RequestAborted); return; }
            await using var buffer = new MemoryStream();
            context.Response.Body = buffer;
            await next(context);
            context.Response.Body = originalBody;
            if (context.Response.StatusCode is >= 200 and < 300)
            {
                var body = Encoding.UTF8.GetString(buffer.ToArray());
                await using var insert = Command(connection, sqlTransaction,
                    "INSERT INTO offline_sync_receipts (Owner, OperationId, RequestHash, StatusCode, ResponseBody, CreatedAt) VALUES (@owner, @id, @hash, @status, @body, UTC_TIMESTAMP(6))",
                    ("owner", owner), ("id", operationId.ToString()), ("hash", hash), ("status", context.Response.StatusCode), ("body", body));
                await insert.ExecuteNonQueryAsync(context.RequestAborted);
                await transaction.CommitAsync(context.RequestAborted);
            }
            else await transaction.RollbackAsync(context.RequestAborted);
            buffer.Position = 0;
            await buffer.CopyToAsync(originalBody, context.RequestAborted);
        }
        finally
        {
            context.Response.Body = originalBody;
            if (locked)
            {
                try { await Command(connection, null, "SELECT RELEASE_LOCK(@name)", ("name", lockName)).ExecuteScalarAsync(CancellationToken.None); }
                catch (Exception error) { logger.LogWarning(error, "Could not release an offline operation lock."); }
            }
            await db.Database.CloseConnectionAsync();
        }
    }

    private static async Task<bool> Authorized(HttpContext context, ApplicationDbContext db, string type, Guid id)
    {
        var path = context.Request.Path.Value!;
        if (type == "staff")
        {
            var staff = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.IsActive);
            if (staff is null || staff.Role != context.User.FindFirstValue(ClaimTypes.Role)) return false;
            if (path.StartsWith("/api/delivery/orders/"))
                return staff.Role == StaffRoles.Delivery && Guid.TryParse(path.Split('/')[4], out var orderId)
                    && await db.DeliveryAssignments.AnyAsync(x => x.OrderId == orderId && x.DeliveryStaffId == id);
            if (!path.StartsWith("/api/hrms/")) return false;
            if (path == "/api/hrms/leave" && context.Request.Method == "POST") return true;
            if (staff.Role is StaffRoles.Admin or StaffRoles.SuperAdmin) return true;
            if (path.StartsWith("/api/hrms/leave")) return false;
            IEnumerable<string> permissions = string.IsNullOrWhiteSpace(staff.PermissionsCsv) ? AppPermissions.DefaultsFor(staff.Role) : staff.PermissionsCsv.Split(',', StringSplitOptions.TrimEntries);
            return permissions.Contains(path.StartsWith("/api/hrms/setup/") ? AppPermissions.HrSettingsManage : AppPermissions.HrmsManage);
        }
        if (type != "customer" || !await db.Customers.AnyAsync(x => x.Id == id && x.IsActive)) return false;
        if (path.StartsWith("/api/cart") || path.StartsWith("/api/wishlist/")) return true;
        return path.StartsWith("/api/orders/") && Guid.TryParse(path.Split('/')[3], out var customerOrderId)
            && await db.Orders.AnyAsync(x => x.Id == customerOrderId && x.CustomerId == id);
    }

    private static async Task<bool> VersionMatches(HttpContext context, ApplicationDbContext db, DbConnection connection, DbTransaction transaction, Guid actorId)
    {
        var path = context.Request.Path.Value!;
        if (path.StartsWith("/api/wishlist/") || path.EndsWith("/documents") || context.Request.Method == "POST" && path.StartsWith("/api/hrms/")) return true;
        var expected = context.Request.Headers["X-Offline-Base-Version"].ToString();
        if (string.IsNullOrWhiteSpace(expected)) { await Problem(context, 428, "Download this record online before editing it offline."); return false; }
        string? actual;
        if (path.StartsWith("/api/cart"))
        {
            await Command(connection, transaction, "SELECT Id FROM customers WHERE Id = @id FOR UPDATE", ("id", actorId.ToString())).ExecuteScalarAsync(context.RequestAborted);
            var items = await db.CartItems.AsNoTracking().Where(x => x.Cart!.CustomerId == actorId).ToListAsync(context.RequestAborted);
            actual = OfflineSyncPolicy.CartVersion(items);
            if (actual == expected && context.Request.Method is "POST" or "PUT")
            {
                using var body = await JsonDocument.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted);
                context.Request.Body.Position = 0;
                if (body.RootElement.TryGetProperty("quantity", out var requested) && requested.TryGetInt32(out var quantity) && quantity > 0)
                {
                    var code = context.Request.Method == "POST" && body.RootElement.TryGetProperty("productCode", out var productCode)
                        ? productCode.GetString() : Uri.UnescapeDataString(path.Split('/')[^1]);
                    var product = await db.Products.AsNoTracking().Include(x => x.Inventory).SingleOrDefaultAsync(x => x.IsActive && (x.Sku == code || x.Slug == code), context.RequestAborted);
                    var desired = quantity + (context.Request.Method == "POST" ? items.Where(x => x.ProductId == product?.Id).Sum(x => x.Quantity) : 0);
                    if (product is not null && desired > InventoryAvailability.ForProduct(product.Inventory, ApplicationTime.NepalNow.Date))
                    { await Problem(context, 409, "Available stock changed. Review your saved cart quantity before retrying."); return false; }
                }
            }
        }
        else
        {
            var parts = path.Split('/');
            var table = parts[3] switch { "setup" => "hrms_setup_items", "office" => "office_operation_records", "leave" => "leave_requests", _ => null };
            if (table is null || !Guid.TryParse(parts[^1], out var id)) { await Problem(context, 400, "Invalid record identifier."); return false; }
            var value = await Command(connection, transaction, $"SELECT UpdatedAt FROM {table} WHERE Id = @id FOR UPDATE", ("id", id.ToString())).ExecuteScalarAsync(context.RequestAborted);
            actual = value is DateTime date ? DateTime.SpecifyKind(date, DateTimeKind.Utc).ToString("O") : null;
        }
        var matches = actual == expected || actual is not null && DateTime.TryParse(actual, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var serverDate)
            && DateTime.TryParse(expected, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var localDate)
            && serverDate.Ticks / 10 == localDate.Ticks / 10;
        if (matches) return true;
        await Problem(context, 409, "Sync conflict detected. Please review this record. Your saved local changes have been retained.");
        return false;
    }

    private static async Task<string> Fingerprint(HttpRequest request)
    {
        var text = new StringBuilder(request.Method + ":" + request.Path + request.QueryString);
        request.EnableBuffering();
        if (request.HasFormContentType)
        {
            var form = await request.ReadFormAsync(request.HttpContext.RequestAborted);
            foreach (var field in form.OrderBy(x => x.Key)) text.Append('|').Append(field.Key).Append('=').Append(JsonSerializer.Serialize(field.Value.ToArray()));
            foreach (var file in form.Files.OrderBy(x => x.Name))
            {
                await using var stream = file.OpenReadStream();
                text.Append('|').Append(file.Name).Append(':').Append(file.FileName).Append(':').Append(file.ContentType)
                    .Append(':').Append(Convert.ToHexString(await SHA256.HashDataAsync(stream, request.HttpContext.RequestAborted)));
            }
        }
        else
        {
            using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
            text.Append(await reader.ReadToEndAsync(request.HttpContext.RequestAborted));
        }
        request.Body.Position = 0;
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString())));
    }

    private static DbCommand Command(DbConnection connection, DbTransaction? transaction, string sql, params (string Name, object Value)[] parameters)
    {
        var command = connection.CreateCommand(); command.CommandText = sql; command.Transaction = transaction;
        foreach (var (name, value) in parameters) { var parameter = command.CreateParameter(); parameter.ParameterName = "@" + name; parameter.Value = value; command.Parameters.Add(parameter); }
        return command;
    }
    private static Task Problem(HttpContext context, int status, string message)
    { context.Response.StatusCode = status; return context.Response.WriteAsJsonAsync(new { message }); }
}
