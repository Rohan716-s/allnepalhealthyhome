using System.Security.Claims;
using backend.Data;
using backend.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Hubs;

public sealed class MessagingHub(IAuthTokenService tokens, ApplicationDbContext db) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var principal = PrincipalFromAccessToken();
        if (principal is null)
        {
            Context.Abort();
            return;
        }
        Context.Items["messaging-principal"] = principal;
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(principal));
        await base.OnConnectedAsync();
    }

    public async Task JoinConversation(Guid conversationId)
    {
        var principal = Principal();
        if (principal is null || !await IsParticipant(conversationId, principal)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation:{conversationId}");
    }

    public async Task LeaveConversation(Guid conversationId)
    {
        var principal = Principal();
        if (principal is null || !await IsParticipant(conversationId, principal)) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation:{conversationId}");
    }

    public async Task Typing(Guid conversationId, bool isTyping)
    {
        var principal = Principal();
        if (principal is null || !await IsParticipant(conversationId, principal)) return;
        await Clients.OthersInGroup($"conversation:{conversationId}").SendAsync("typing", new { conversationId, isTyping, senderId = Subject(principal) });
    }

    private ClaimsPrincipal? Principal() => Context.Items.TryGetValue("messaging-principal", out var value) ? value as ClaimsPrincipal : PrincipalFromAccessToken();

    private ClaimsPrincipal? PrincipalFromAccessToken()
    {
        var httpContext = Context.GetHttpContext();
        if (httpContext?.User.Identity?.IsAuthenticated == true) return httpContext.User;

        var token = httpContext?.Request.Query["access_token"].ToString();
        return string.IsNullOrWhiteSpace(token) ? null : tokens.Validate(token);
    }

    private async Task<bool> IsParticipant(Guid conversationId, ClaimsPrincipal principal)
    {
        var subject = Subject(principal);
        return await db.MessageParticipants.AsNoTracking().AnyAsync(x => x.ConversationId == conversationId &&
            ((subject.Type == "customer" && x.CustomerId == subject.Id) || (subject.Type == "staff" && x.StaffUserId == subject.Id)));
    }

    public static (string Type, Guid Id) Subject(ClaimsPrincipal principal)
    {
        var type = principal.FindFirstValue("account_type")?.Equals("staff", StringComparison.OrdinalIgnoreCase) == true ? "staff" : "customer";
        return (type, Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty);
    }

    public static string UserGroup(ClaimsPrincipal principal)
    {
        var subject = Subject(principal);
        return $"user:{subject.Type}:{subject.Id}";
    }
}
