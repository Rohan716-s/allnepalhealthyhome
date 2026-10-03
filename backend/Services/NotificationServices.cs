using System.Text.RegularExpressions;
using backend.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Services;

public interface INotificationTemplateService
{
    Task<(string Title, string Body)> RenderAsync(string code, string fallbackTitle, string fallbackBody, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken);
}

public sealed class NotificationTemplateService(IServiceScopeFactory scopeFactory) : INotificationTemplateService
{
    private static readonly Regex Token = new("{{\\s*([a-zA-Z0-9_]+)\\s*}}", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public async Task<(string Title, string Body)> RenderAsync(string code, string fallbackTitle, string fallbackBody, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken)
    {
        // Template rendering can be called while the caller is in a user-managed
        // transaction. Read the configuration through a short-lived independent
        // context so MySQL's retrying execution strategy does not reject that lookup.
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var template = await db.NotificationTemplates.AsNoTracking().SingleOrDefaultAsync(x => x.Code == code && x.IsEnabled, cancellationToken);
        if (template is null) return (fallbackTitle, fallbackBody);
        var title = Render(string.IsNullOrWhiteSpace(template.Subject) ? fallbackTitle : template.Subject, values);
        var body = Render(template.Body, values);
        return (title, body);
    }

    private static string Render(string text, IReadOnlyDictionary<string, string?> values) => Token.Replace(text, match => values.TryGetValue(match.Groups[1].Value, out var value) ? value ?? string.Empty : string.Empty);
}
