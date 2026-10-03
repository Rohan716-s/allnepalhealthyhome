using System.Security.Claims;
using backend.Services;
using Microsoft.AspNetCore.SignalR;

namespace backend.Hubs;

public sealed class NotificationHub(IAuthTokenService tokens) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var context = Context.GetHttpContext();
        var token = context?.Request.Headers.Authorization.ToString();
        if (token?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true) token = token[7..].Trim();
        else token = context?.Request.Query["access_token"].ToString();
        var principal = string.IsNullOrWhiteSpace(token) ? null : tokens.Validate(token);
        if (principal is null || !Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || id == Guid.Empty)
        {
            Context.Abort();
            return;
        }

        var type = principal.FindFirstValue("account_type")?.Equals("staff", StringComparison.OrdinalIgnoreCase) == true ? "staff" : "customer";
        await Groups.AddToGroupAsync(Context.ConnectionId, Group(type, id));
        await base.OnConnectedAsync();
    }

    public static string Group(string participantType, Guid id) => $"user:{participantType}:{id}";
}
