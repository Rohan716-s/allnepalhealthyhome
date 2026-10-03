using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Collections.Concurrent;
using backend.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace backend.Services;

public interface IPasswordService
{
    string Hash(string password);
    bool Verify(string password, string encodedHash);
}

public sealed class PasswordService : IPasswordService
{
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 120_000;

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return $"v1${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(key)}";
    }

    public bool Verify(string password, string encodedHash)
    {
        var parts = encodedHash.Split('$');
        if (parts.Length != 4 || parts[0] != "v1" || !int.TryParse(parts[1], out var iterations)) return false;
        try
        {
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }
}

public interface IAuthTokenService
{
    (string Token, DateTime ExpiresAt) Create(Customer customer);
    (string Token, DateTime ExpiresAt) Create(StaffUser staffUser);
    ClaimsPrincipal? Validate(string token);
    void Revoke(string token);
}

public sealed class AuthTokenService(IConfiguration configuration) : IAuthTokenService
{
    private readonly byte[] signingKey = Encoding.UTF8.GetBytes(configuration["Authentication:SigningKey"] ?? "development-only-change-this-signing-key-please");
    private readonly int lifetimeMinutes = configuration.GetValue("Authentication:TokenLifetimeMinutes", 120);
    private readonly ConcurrentDictionary<string, DateTimeOffset> revokedTokens = new(StringComparer.Ordinal);

    public (string Token, DateTime ExpiresAt) Create(Customer customer)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(lifetimeMinutes);
        var header = Encode(new { alg = "HS256", typ = "JWT" });
        var payload = Encode(new { jti = Guid.NewGuid().ToString("N"), sub = customer.Id, email = customer.Email, name = customer.FullName, role = "CUSTOMER", type = "customer", customerAccountType = customer.AccountType, exp = new DateTimeOffset(expiresAt).ToUnixTimeSeconds() });
        var signature = Sign($"{header}.{payload}");
        return ($"{header}.{payload}.{signature}", expiresAt);
    }

    public (string Token, DateTime ExpiresAt) Create(StaffUser staffUser)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(lifetimeMinutes);
        var header = Encode(new { alg = "HS256", typ = "JWT" });
        var permissions = string.IsNullOrWhiteSpace(staffUser.PermissionsCsv)
            ? AppPermissions.DefaultsFor(staffUser.Role).ToArray()
            : staffUser.PermissionsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var payload = Encode(new { jti = Guid.NewGuid().ToString("N"), sub = staffUser.Id, email = staffUser.Email, name = staffUser.FullName, role = staffUser.Role, type = "staff", branchId = staffUser.BranchId, permissions, exp = new DateTimeOffset(expiresAt).ToUnixTimeSeconds() });
        var signature = Sign($"{header}.{payload}");
        return ($"{header}.{payload}.{signature}", expiresAt);
    }

    public ClaimsPrincipal? Validate(string token)
    {
        CleanupRevokedTokens();
        if (revokedTokens.ContainsKey(HashToken(token))) return null;
        var parts = token.Split('.');
        if (parts.Length != 3) return null;
        var expectedSignature = Sign($"{parts[0]}.{parts[1]}");
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expectedSignature), Encoding.ASCII.GetBytes(parts[2]))) return null;
        try
        {
            var payload = JsonSerializer.Deserialize<JsonElement>(Decode(parts[1]));
            if (!payload.TryGetProperty("sub", out var subject) || !Guid.TryParse(subject.GetString(), out var customerId)) return null;
            if (!payload.TryGetProperty("exp", out var expiry) || expiry.GetInt64() <= DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return null;
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, customerId.ToString()),
                new Claim(ClaimTypes.Email, payload.GetProperty("email").GetString() ?? string.Empty),
                new Claim(ClaimTypes.Name, payload.GetProperty("name").GetString() ?? string.Empty),
                new Claim(ClaimTypes.Role, payload.TryGetProperty("role", out var role) ? role.GetString() ?? "CUSTOMER" : "CUSTOMER"),
                new Claim("account_type", payload.TryGetProperty("type", out var type) ? type.GetString() ?? "customer" : "customer"),
            };
            if (payload.TryGetProperty("customerAccountType", out var customerAccountType) && customerAccountType.ValueKind == JsonValueKind.String)
                claims = [.. claims, new Claim("customer_account_type", customerAccountType.GetString() ?? "PERSONAL")];
            if (payload.TryGetProperty("branchId", out var branch) && branch.ValueKind != JsonValueKind.Null) claims = [.. claims, new Claim("branch_id", branch.GetString() ?? string.Empty)];
            if (payload.TryGetProperty("permissions", out var permissions) && permissions.ValueKind == JsonValueKind.Array)
            {
                claims = [.. claims, .. permissions.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => new Claim("permission", x.GetString() ?? string.Empty)).Where(x => !string.IsNullOrWhiteSpace(x.Value))];
            }
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "CustomerBearer"));
        }
        catch (JsonException) { return null; }
        catch (FormatException) { return null; }
        catch (InvalidOperationException) { return null; }
    }

    public void Revoke(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return;
        var parts = token.Split('.');
        if (parts.Length != 3) return;
        try
        {
            var payload = JsonSerializer.Deserialize<JsonElement>(Decode(parts[1]));
            if (payload.TryGetProperty("exp", out var expiry) && expiry.TryGetInt64(out var unixExpiry))
                revokedTokens[HashToken(token)] = DateTimeOffset.FromUnixTimeSeconds(unixExpiry);
            else
                revokedTokens[HashToken(token)] = DateTimeOffset.UtcNow.AddMinutes(lifetimeMinutes);
        }
        catch (JsonException) { revokedTokens[HashToken(token)] = DateTimeOffset.UtcNow.AddMinutes(lifetimeMinutes); }
        catch (FormatException) { revokedTokens[HashToken(token)] = DateTimeOffset.UtcNow.AddMinutes(lifetimeMinutes); }
    }

    private void CleanupRevokedTokens()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var item in revokedTokens)
            if (item.Value <= now) revokedTokens.TryRemove(item.Key, out _);
    }

    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private string Sign(string input) => Base64Url(HMACSHA256.HashData(signingKey, Encoding.UTF8.GetBytes(input)));
    private static string Encode(object value) => Base64Url(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value)));
    private static string Decode(string value) => Encoding.UTF8.GetString(Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4)));
    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed class CustomerAuthenticationMiddleware(RequestDelegate next, IAuthTokenService tokenService)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var principal = tokenService.Validate(header[7..].Trim());
            if (principal is not null) context.User = principal;
        }
        await next(context);
    }
}

public sealed class ManualAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync() => Task.FromResult(AuthenticateResult.NoResult());
}
