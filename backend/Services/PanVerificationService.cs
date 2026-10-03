using System.Text.Json;
using System.Text.RegularExpressions;

namespace backend.Services;

public sealed record PanVerificationResult(bool IsVerified, string Status, string? RegisteredName, string Message, string Source);

public interface IPanVerificationService
{
    Task<PanVerificationResult> VerifyAsync(string panNumber, CancellationToken cancellationToken);
}

/// <summary>
/// Uses the official IRD form when available. IRD currently protects the form
/// with invisible reCAPTCHA, so blocked/unavailable calls deliberately return a
/// manual fallback instead of pretending that a PAN was verified.
/// </summary>
public sealed class IrPanVerificationService(HttpClient httpClient, IConfiguration configuration, ILogger<IrPanVerificationService> logger) : IPanVerificationService
{
    private static readonly Regex PanPattern = new("^\\d{9}$", RegexOptions.Compiled);

    public async Task<PanVerificationResult> VerifyAsync(string panNumber, CancellationToken cancellationToken)
    {
        var pan = new string((panNumber ?? string.Empty).Where(char.IsDigit).ToArray());
        if (!PanPattern.IsMatch(pan)) return new(false, "INVALID", null, "Enter a valid 9-digit PAN number.", "local-validation");

        var pageUrl = configuration["IRD:PanSearchUrl"] ?? "https://ird.gov.np/pan-search/";
        var apiUrl = configuration["IRD:PanSearchApiUrl"] ?? "https://ird.gov.np/api/getPanSearch/";
        try
        {
            using var pageResponse = await httpClient.GetAsync(pageUrl, cancellationToken);
            if (!pageResponse.IsSuccessStatusCode) return Manual("IRD lookup is temporarily unavailable. You can continue with the manual registered-name field.");
            var html = await pageResponse.Content.ReadAsStringAsync(cancellationToken);
            var csrf = Regex.Match(html, "name=\\\"csrfmiddlewaretoken\\\" value=\\\"([^\\\"]+)\\\"", RegexOptions.IgnoreCase).Groups[1].Value;
            if (string.IsNullOrWhiteSpace(csrf)) return Manual("IRD lookup did not provide a verification token. Continue with manual entry.");

            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(pan), "pan");
            form.Add(new StringContent(csrf), "csrfmiddlewaretoken");
            // The official page requires a reCAPTCHA token. An empty value lets
            // IRD reject the automated call cleanly rather than bypassing it.
            form.Add(new StringContent(string.Empty), "g-recaptcha-response");
            using var request = new HttpRequestMessage(HttpMethod.Post, apiUrl) { Content = form };
            request.Headers.TryAddWithoutValidation("X-CSRFToken", csrf);
            request.Headers.TryAddWithoutValidation("Referer", pageUrl);
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return Manual("IRD could not complete this lookup. Continue with manual entry.");
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (!json.RootElement.TryGetProperty("data", out var data) || !data.TryGetProperty("panDetails", out var details) || details.ValueKind != JsonValueKind.Array || details.GetArrayLength() == 0)
                return new(false, "NOT_FOUND", null, "No public IRD record was found for this PAN.", "ird.gov.np");
            var detail = details[0];
            var registeredName = ReadString(detail, "trade_Name_Eng") ?? ReadString(detail, "trade_Name_Nep");
            return string.IsNullOrWhiteSpace(registeredName)
                ? Manual("IRD returned the PAN but no registered name. Continue with manual entry.")
                : new(true, "VERIFIED", registeredName, "PAN verified with IRD.", "ird.gov.np");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "IRD PAN lookup failed for a masked PAN ending in {PanSuffix}", pan[^2..]);
            return Manual("IRD is unreachable right now. Continue with manual entry.");
        }
    }

    private static PanVerificationResult Manual(string message) => new(false, "MANUAL_FALLBACK", null, message, "manual-fallback");

    private static string? ReadString(JsonElement element, string property)
    {
        return element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString()?.Trim() : null;
    }
}
