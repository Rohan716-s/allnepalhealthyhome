using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace backend.Controllers;

[ApiController]
[Route("api/assistant")]
[EnableRateLimiting("assistant")]
public sealed class AssistantController(ApplicationDbContext db, IHttpClientFactory httpClientFactory, IntegrationSecretProtector secrets) : ControllerBase
{
    private static readonly string[] StopWords = [
        "a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "the", "to", "what", "where", "with", "you",
        "छ", "छु", "छन्", "हो", "हुन्छ", "गर्न", "गर्ने", "गर्नु", "म", "मेरो", "तपाईं", "तपाइँ", "के", "कसरी", "कहाँ", "मा", "को", "का", "कि", "र", "वा", "नै", "पनि"
    ];
    private static readonly AssistantSuggestedPrompt[] DefaultPrompts =
    [
        new("Find a product", "Do you have sunscreen?"),
        new("Prescription help", "How do I upload a prescription?"),
        new("Delivery & branches", "Where do you deliver?"),
        new("Payment options", "What payment options are available?")
    ];

    [HttpGet("config")]
    public async Task<ActionResult<object>> Config(CancellationToken ct)
    {
        var values = await Settings(ct);
        var enabled = !values.TryGetValue("assistant.enabled", out var raw) || !bool.TryParse(raw, out var parsed) || parsed;
        return Ok(new { enabled, name = values.GetValueOrDefault("assistant.name") ?? "ANHH Assistant" });
    }

    [HttpPost("chat")]
    public async Task<ActionResult<AssistantChatResponse>> Chat([FromBody] AssistantChatRequest? request, CancellationToken ct)
    {
        var message = request?.Message?.Trim() ?? string.Empty;
        if (message.Length is 0 or > 500)
            return BadRequest(new { message = "Please enter a question up to 500 characters." });

        var values = await Settings(ct);
        var enabled = !values.TryGetValue("assistant.enabled", out var enabledValue) || !bool.TryParse(enabledValue, out var parsedEnabled) || parsedEnabled;
        if (!enabled) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "The pharmacy assistant is currently unavailable. Please use Contact support." });

        var sessionKey = NormalizeSessionKey(request?.SessionId);
        var session = await db.AssistantChatSessions.SingleOrDefaultAsync(x => x.SessionKey == sessionKey, ct);
        if (session is null)
        {
            session = new AssistantChatSession { SessionKey = sessionKey };
            db.AssistantChatSessions.Add(session);
        }

        var previousMessages = await db.AssistantChatMessages.AsNoTracking()
            .Where(x => x.SessionId == session.Id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(12)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(ct);
        db.AssistantChatMessages.Add(new AssistantChatMessage { SessionId = session.Id, Role = "user", Content = message });

        var tokens = Tokens(message);
        var faqs = await db.Faqs.AsNoTracking().Where(x => x.Published).OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        var products = await db.Products.AsNoTracking()
            .Where(x => x.IsActive)
            .Include(x => x.Medicine).ThenInclude(x => x!.Category)
            .Include(x => x.Brand)
            .Include(x => x.Inventory)
            .Include(x => x.Images)
            .OrderBy(x => x.Name)
            .Take(400)
            .ToListAsync(ct);
        var matchingProducts = FindProducts(products, tokens);
        var pricesVisible = await OrderPolicyReader.PricesVisibleAsync(db, User, ct);
        var faq = faqs.Select(item => new { Item = item, Score = Overlap(tokens, Tokens(item.Question)) })
            .Where(x => x.Score >= 0.24).OrderByDescending(x => x.Score).Select(x => x.Item).FirstOrDefault();
        var context = await BuildKnowledgeContext(message, tokens, matchingProducts, faqs, values, pricesVisible, ct);
        var reply = await GenerateAiReply(message, previousMessages, context, values, pricesVisible, ct) ?? BuildReply(message, tokens, matchingProducts, faq, pricesVisible);

        db.AssistantChatMessages.Add(new AssistantChatMessage { SessionId = session.Id, Role = "assistant", Content = reply });
        session.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(new AssistantChatResponse(reply, PromptsFor(tokens), matchingProducts.Take(5).Select(product => ToProduct(product, pricesVisible)).ToList(), sessionKey, "/contact"));
    }

    private async Task<string?> GenerateAiReply(string message, IReadOnlyList<AssistantChatMessage> history, string context, IReadOnlyDictionary<string, string> values, bool pricesVisible, CancellationToken ct)
    {
        var apiKey = values.GetValueOrDefault(IntegrationSettingKeys.AssistantApiKey);
        if (string.IsNullOrWhiteSpace(apiKey)) return null;
        var baseUrl = values.GetValueOrDefault(IntegrationSettingKeys.AssistantBaseUrl) ?? "https://api.openai.com/v1";
        var model = values.GetValueOrDefault(IntegrationSettingKeys.AssistantModel) ?? "gpt-4o-mini";
        if (!Uri.TryCreate($"{baseUrl.TrimEnd('/')}/chat/completions", UriKind.Absolute, out var endpoint)) return null;

        var messages = new List<object>
        {
            new { role = "system", content = $"You are ANHH Assistant for All Nepal Healthy Home, a Nepal pharmacy and healthcare marketplace. Only answer questions about this platform, its products, orders, delivery, branches, registration, pharmacy PAN verification, prescriptions, returns, payments, and published health information. Use only the supplied knowledge context for platform facts. If the context is insufficient, say you are not sure and direct the customer to human support at /contact. Never diagnose, prescribe, recommend a prescription dosage, or claim an order/account action was completed. {(pricesVisible ? "Product prices may be stated only from supplied context." : "Product prices are hidden for this customer. Never reveal, repeat, estimate, or infer any product price, even if it appears in earlier conversation history; direct price questions to /contact.")} Be concise, friendly, and answer in the user's language when possible. Knowledge context:\n{context}" }
        };
        messages.AddRange(history.Select(item => new { role = item.Role, content = item.Content }));
        messages.Add(new { role = "user", content = message });
        var payload = new { model, temperature = 0.2, messages };
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = JsonContent.Create(payload);
            using var response = await httpClientFactory.CreateClient("Assistant").SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;
            using var document = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: ct);
            return document?.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString()?.Trim();
        }
        catch (HttpRequestException) { return null; }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested) { return null; }
        catch (JsonException) { return null; }
        catch (KeyNotFoundException) { return null; }
    }

    private async Task<string> BuildKnowledgeContext(string message, HashSet<string> tokens, IReadOnlyList<Product> matches, IReadOnlyList<Faq> faqs, IReadOnlyDictionary<string, string> values, bool pricesVisible, CancellationToken ct)
    {
        var lines = new List<string>();
        foreach (var key in new[] { "website.name", "website.tagline", "website.contactPhone", "website.contactEmail", "website.address", "assistant.policy" })
            if (values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)) lines.Add($"{key}: {value}");
        foreach (var product in matches.Take(8))
        {
            var available = product.Inventory.Sum(x => Math.Max(0, x.StockQuantity - x.ReservedQuantity));
            lines.Add($"Product: {product.Name}; brand: {product.Brand?.Name ?? "not listed"}; {(pricesVisible ? $"price: NPR {product.SellingPrice:N2}; " : "")}stock: {(available > 0 ? "available" : "currently unavailable")}; prescription review: {(product.Medicine?.PrescriptionRequired == true ? "required" : "not marked required")}");
        }
        foreach (var faq in faqs.Select(x => new { Item = x, Score = Overlap(tokens, Tokens($"{x.Question} {x.Answer}")) }).Where(x => x.Score > 0).OrderByDescending(x => x.Score).Take(6))
            lines.Add($"FAQ: {faq.Item.Question} — {faq.Item.Answer}");
        var branches = await db.Branches.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Take(20).ToListAsync(ct);
        foreach (var branch in branches) lines.Add($"Branch: {branch.Name}; address: {branch.Address}; phone: {branch.Phone ?? "not listed"}; delivery: {(branch.DeliveryEnabled ? "enabled" : "not enabled")}");
        var zones = await db.DeliveryZones.AsNoTracking().Where(x => x.Enabled).OrderBy(x => x.Name).Take(40).ToListAsync(ct);
        foreach (var zone in zones) lines.Add($"Delivery zone: {zone.Name}, {zone.District}, {zone.Province}; fee: NPR {zone.DeliveryFee:N2}");
        var articles = await db.HealthArticles.AsNoTracking().Where(x => x.Status == "PUBLISHED").OrderByDescending(x => x.PublishedAt).Take(8).ToListAsync(ct);
        foreach (var article in articles) lines.Add($"Published health article: {article.Title} — {article.Excerpt ?? article.Content[..Math.Min(300, article.Content.Length)]}");
        return string.Join('\n', lines.Take(100));
    }

    private async Task<Dictionary<string, string>> Settings(CancellationToken ct)
    {
        var rows = await db.SystemSettings.AsNoTracking().Where(x => x.IsPublic || x.Key.StartsWith(IntegrationSettingKeys.Prefix)).ToListAsync(ct);
        return rows.ToDictionary(x => x.Key, x => IntegrationSettingKeys.IsSecret(x.Key) ? secrets.Unprotect(x.Value) ?? string.Empty : x.Value, StringComparer.OrdinalIgnoreCase);
    }

    private static string NormalizeSessionKey(string? value) => string.IsNullOrWhiteSpace(value) || value.Trim().Length > 100 ? Guid.NewGuid().ToString("N") : value.Trim();

    private static string BuildReply(string message, HashSet<string> tokens, IReadOnlyList<Product> matches, Faq? faq, bool pricesVisible)
    {
        var nepali = HasNepaliScript(message);
        if (ContainsAny(tokens, "emergency", "chest", "breathing", "overdose", "poison", "bleeding", "आपतकाल", "छाती", "सास", "विष", "रक्तस्राव"))
            return nepali ? "यो chatbot ले आपतकालीन अवस्था सम्हाल्न सक्दैन। तुरुन्तै नजिकको अस्पताल वा स्थानीय emergency सेवा सम्पर्क गर्नुहोस्। औषधिको सुरक्षासम्बन्धी प्रश्नमा pharmacist सँग सल्लाह लिनुहोस्।" : "This assistant cannot handle emergencies. Please contact local emergency services or go to the nearest hospital immediately. For medicine safety questions, speak with a pharmacist.";
        if (nepali) return BuildNepaliReply(message, tokens, matches, faq, pricesVisible);
        if (faq is not null && Overlap(tokens, Tokens(faq.Question)) >= 0.35) return faq.Answer;
        if (ContainsAny(tokens, "hello", "hi", "hey", "namaste")) return "Hello. I can help you find products and answer questions about prescriptions, delivery, payments, and orders.";
        if (ContainsAny(tokens, "prescription", "doctor", "pharmacist", "upload")) return "You can upload a clear JPG, PNG, or PDF prescription from the Prescription page. Prescription medicines are reviewed by a pharmacist before dispensing.";
        if (ContainsAny(tokens, "delivery", "deliver", "branch", "location", "where")) return "We deliver across Nepal where service is available. Active branches and delivery zones are used during checkout.";
        if (ContainsAny(tokens, "payment", "pay", "cash", "bank", "wallet")) return "Available payment options are shown at checkout. Please contact support if you need help with a payment.";
        if (matches.Count > 0) return $"I found {string.Join(", ", matches.Take(3).Select(x => pricesVisible ? $"{x.Name} (NPR {x.SellingPrice:N2})" : x.Name))}. Open a product to see details and availability.";
        return "I can help with products, orders, prescriptions, delivery, branches, registration, and payments. I do not diagnose or prescribe medicines—please speak with a pharmacist for medical advice.";
    }

    private static string BuildNepaliReply(string message, HashSet<string> tokens, IReadOnlyList<Product> matches, Faq? faq, bool pricesVisible)
    {
        if (ContainsAnyText(message, "नमस्ते", "हेलो", "स्वागत")) return "नमस्ते। म तपाईंलाई product, prescription, delivery र checkout सम्बन्धी जानकारी दिन सहयोग गर्न सक्छु।";
        if (ContainsAnyText(message, "प्रिस्क्रिप्सन", "डाक्टर", "फार्मासिस्ट", "अपलोड")) return "Prescription पेजबाट स्पष्ट JPG, PNG वा PDF upload गर्न सकिन्छ। Prescription औषधि pharmacist ले review गरेपछि मात्र dispense हुन्छ।";
        if (ContainsAnyText(message, "डेलिभरी", "डेलिभर", "शाखा", "ठेगाना", "स्थान", "कहाँ")) return "सेवा उपलब्ध भएको ठाउँमा नेपालभर delivery हुन्छ। Checkout गर्दा active branch र delivery zone प्रयोग हुन्छ।";
        if (matches.Count > 0) return $"मैले यी product भेटाएँ: {string.Join(", ", matches.Take(3).Select(x => pricesVisible ? $"{x.Name} (NPR {x.SellingPrice:N2})" : x.Name))}।";
        if (faq is not null) return faq.Answer;
        return "म product, order, prescription, delivery र checkout सम्बन्धी मार्गदर्शन गर्न सक्छु। औषधि diagnose वा prescribe गर्न pharmacist सँग सल्लाह लिनुहोस्।";
    }

    private static IReadOnlyList<AssistantSuggestedPrompt> PromptsFor(HashSet<string> tokens) => ContainsAny(tokens, "prescription", "upload", "doctor") ? [DefaultPrompts[0], DefaultPrompts[2], DefaultPrompts[3]] : ContainsAny(tokens, "delivery", "branch", "location") ? [DefaultPrompts[0], DefaultPrompts[1], DefaultPrompts[3]] : DefaultPrompts;

    private static List<Product> FindProducts(IEnumerable<Product> products, HashSet<string> queryTokens) => products.Select(product => new { Product = product, Score = Overlap(queryTokens, Tokens(string.Join(' ', product.Name, product.Sku, product.SearchKeywords, product.Brand?.Name, product.Medicine?.Name, product.Medicine?.GenericName, product.Medicine?.Category?.Name))) }).Where(x => x.Score > 0).OrderByDescending(x => x.Score).ThenBy(x => x.Product.Name).Select(x => x.Product).ToList();

    private static AssistantProduct ToProduct(Product product, bool pricesVisible)
    {
        var images = product.Images.OrderBy(x => x.DisplayOrder).Select(x => x.Url).ToList();
        if (images.Count == 0 && !string.IsNullOrWhiteSpace(product.ImageUrl)) images.Add(product.ImageUrl);
        return new AssistantProduct(product.Id, product.Name, product.Slug, product.Brand?.Name ?? "All Nepal Healthy Home", pricesVisible ? product.SellingPrice : 0, product.ImageUrl, images, product.Inventory.Sum(x => x.StockQuantity - x.ReservedQuantity), product.Medicine?.PrescriptionRequired ?? false, pricesVisible);
    }

    private static HashSet<string> Tokens(string? value) => Regex.Matches(value?.ToLowerInvariant() ?? string.Empty, @"[\p{L}\p{M}\p{N}]+").Select(match => match.Value).Where(word => word.Length > 1 && !StopWords.Contains(word, StringComparer.Ordinal)).ToHashSet(StringComparer.Ordinal);
    private static double Overlap(HashSet<string> left, HashSet<string> right) => left.Count == 0 || right.Count == 0 ? 0 : left.Intersect(right).Count() / (double)Math.Min(left.Count, right.Count);
    private static bool ContainsAny(HashSet<string> tokens, params string[] values) => values.Any(tokens.Contains);
    private static bool ContainsAnyText(string value, params string[] values) => values.Any(item => value.Contains(item, StringComparison.OrdinalIgnoreCase));
    private static bool HasNepaliScript(string value) => value.Any(character => character is >= '\u0900' and <= '\u097F');
}
