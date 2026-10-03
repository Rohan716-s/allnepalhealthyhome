using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public sealed record PriceVisibilitySettings(
    bool DefaultVisible = false,
    Dictionary<string, bool>? RoleOverrides = null,
    Dictionary<string, bool>? CustomerOverrides = null);

public sealed record DeliveryRulesSettings(
    int GeofenceRadiusMeters = 100,
    bool EnforceGeofence = true,
    string[]? RequiredDocumentTypes = null);

public sealed record StoredOrderDocument(string OriginalFileName, string StoredFileName, string ContentType, long Length, string Sha256);

public interface IOrderDocumentStorage
{
    Task<StoredOrderDocument> SaveAsync(IFormFile file, CancellationToken cancellationToken);
    Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken);
}

public sealed class OrderDocumentStorage(IConfiguration configuration, IHostEnvironment environment) : IOrderDocumentStorage
{
    private const long MaxBytes = 10 * 1024 * 1024;
    private static readonly IReadOnlyDictionary<string, string> Allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png", [".webp"] = "image/webp", [".pdf"] = "application/pdf"
    };
    private string Root => Path.GetFullPath(configuration["Storage:OrderDocumentsRoot"] ?? Path.Combine(environment.ContentRootPath, "App_Data", "order-documents"));

    public async Task<StoredOrderDocument> SaveAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length <= 0) throw new InvalidDataException("Choose a document to upload.");
        if (file.Length > MaxBytes) throw new InvalidDataException("Order documents must be 10 MB or smaller.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!Allowed.TryGetValue(extension, out var expectedType) || !string.Equals(expectedType, file.ContentType, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Upload a PDF, JPG, PNG, or WEBP document.");
        var bytes = new byte[checked((int)file.Length)];
        await using (var input = file.OpenReadStream()) await input.ReadExactlyAsync(bytes, cancellationToken);
        if (!HasExpectedSignature(bytes, extension)) throw new InvalidDataException("The document content does not match its file type.");
        Directory.CreateDirectory(Root);
        var stored = $"{Guid.NewGuid():N}{extension}";
        await File.WriteAllBytesAsync(Path.Combine(Root, stored), bytes, cancellationToken);
        return new StoredOrderDocument(Path.GetFileName(file.FileName), stored, expectedType, bytes.LongLength, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }

    public Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken)
    {
        if (Path.GetFileName(storedFileName) != storedFileName) return Task.FromResult<Stream?>(null);
        var path = Path.Combine(Root, storedFileName);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    private static bool HasExpectedSignature(byte[] bytes, string extension) => extension switch
    {
        ".pdf" => bytes.Length >= 5 && Encoding.ASCII.GetString(bytes, 0, 5) == "%PDF-",
        ".png" => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
        ".webp" => bytes.Length >= 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
        ".jpg" or ".jpeg" => bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff,
        _ => false
    };
}

public static class OrderPolicyReader
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task<PriceVisibilitySettings> ReadPricesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var json = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "orders.price-visibility").Select(x => x.Value).SingleOrDefaultAsync(ct);
        try { return string.IsNullOrWhiteSpace(json) ? new() : JsonSerializer.Deserialize<PriceVisibilitySettings>(json, JsonOptions) ?? new(); }
        catch (JsonException) { return new(); }
    }

    public static async Task<bool> PricesVisibleAsync(ApplicationDbContext db, ClaimsPrincipal principal, CancellationToken ct)
    {
        var config = await ReadPricesAsync(db, ct);
        var principalAccountType = principal.FindFirstValue("account_type");
        var customerId = Guid.Empty;
        var hasCustomerId = (string.IsNullOrWhiteSpace(principalAccountType) || principalAccountType.Equals("customer", StringComparison.OrdinalIgnoreCase))
            && Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out customerId);
        if (hasCustomerId)
            return await PricesVisibleForCustomerAsync(db, customerId, ct, config);
        else if (!string.Equals(principalAccountType, "staff", StringComparison.OrdinalIgnoreCase))
        {
            if (config.RoleOverrides?.TryGetValue("ANONYMOUS", out var anonymousOverride) == true) return anonymousOverride;
        }
        return config.DefaultVisible;
    }

    public static async Task<bool> PricesVisibleForCustomerAsync(ApplicationDbContext db, Guid customerId, CancellationToken ct)
        => await PricesVisibleForCustomerAsync(db, customerId, ct, await ReadPricesAsync(db, ct));

    private static async Task<bool> PricesVisibleForCustomerAsync(ApplicationDbContext db, Guid customerId, CancellationToken ct, PriceVisibilitySettings config)
    {
        var accountType = await db.Customers.AsNoTracking().Where(x => x.Id == customerId).Select(x => x.AccountType).SingleOrDefaultAsync(ct);
        if (config.CustomerOverrides?.TryGetValue(customerId.ToString("D"), out var customerOverride) == true) return customerOverride;
        var role = string.Equals(accountType, "PHARMACY", StringComparison.OrdinalIgnoreCase) ? "PHARMACY" : "CUSTOMER";
        if (config.RoleOverrides?.TryGetValue(role, out var roleOverride) == true) return roleOverride;
        return config.DefaultVisible;
    }

    public static async Task<DeliveryRulesSettings> ReadDeliveryAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var json = await db.SystemSettings.AsNoTracking().Where(x => x.Key == "orders.delivery-rules").Select(x => x.Value).SingleOrDefaultAsync(ct);
        try { return string.IsNullOrWhiteSpace(json) ? new() : JsonSerializer.Deserialize<DeliveryRulesSettings>(json, JsonOptions) ?? new(); }
        catch (JsonException) { return new(); }
    }
}
