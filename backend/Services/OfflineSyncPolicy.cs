using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services;

/// <summary>Explicitly limits replay to operations without external financial or stock side effects.</summary>
public static partial class OfflineSyncPolicy
{
    public static bool Supports(string method, string path) =>
        (method == "POST" && path == "/api/cart/items") ||
        (method == "DELETE" && path == "/api/cart") ||
        (method is "PUT" or "DELETE" && CartItemPath().IsMatch(path)) ||
        (method is "PUT" or "DELETE" && WishlistPath().IsMatch(path)) ||
        (method == "POST" && path is "/api/hrms/leave" or "/api/hrms/leave/admin") ||
        (method is "PUT" or "DELETE" && LeavePath().IsMatch(path)) ||
        (method is "POST" or "PUT" && HrRecordPath().IsMatch(path) &&
            (method == "POST" ? path.Split('/').Length == 5 : path.Split('/').Length == 6)) ||
        (method == "POST" && DocumentPath().IsMatch(path));

    public static string CartVersion(IEnumerable<CartItem> items) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
        string.Join(";", items.OrderBy(x => x.ProductId).Select(x => $"{x.Id:N}:{x.ProductId:N}:{x.Quantity}:{x.UpdatedAt.Ticks / 10}"))))).ToLowerInvariant();

    [GeneratedRegex(@"^/api/cart/items/[^/]+$")] private static partial Regex CartItemPath();
    [GeneratedRegex(@"^/api/wishlist/[^/]+$")] private static partial Regex WishlistPath();
    [GeneratedRegex(@"^/api/hrms/leave/[0-9a-fA-F-]{36}$")] private static partial Regex LeavePath();
    [GeneratedRegex(@"^/api/hrms/(setup|office)/[A-Z_]+(/[0-9a-fA-F-]{36})?$")] private static partial Regex HrRecordPath();
    [GeneratedRegex(@"^/api/(delivery/)?orders/[0-9a-fA-F-]{36}/documents$")] private static partial Regex DocumentPath();
}
