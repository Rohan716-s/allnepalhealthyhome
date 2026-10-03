using Microsoft.AspNetCore.DataProtection;
using System.Security.Cryptography;

namespace backend.Services;

public static class IntegrationSettingKeys
{
    public const string Prefix = "integration.";
    public const string EmailHost = Prefix + "email.host";
    public const string EmailPort = Prefix + "email.port";
    public const string EmailUsername = Prefix + "email.username";
    public const string EmailPassword = Prefix + "email.password";
    public const string EmailSenderName = Prefix + "email.senderName";
    public const string EmailSenderEmail = Prefix + "email.senderEmail";
    public const string EmailEncryption = Prefix + "email.encryption";
    public const string SmsProvider = Prefix + "sms.provider";
    public const string SmsApiUrl = Prefix + "sms.apiUrl";
    public const string SmsApiKey = Prefix + "sms.apiKey";
    public const string SmsSenderId = Prefix + "sms.senderId";
    public const string SmsOtpExpiryMinutes = Prefix + "sms.otpExpiryMinutes";
    public const string SmsOtpLength = Prefix + "sms.otpLength";
    public const string SmsRateLimit = Prefix + "sms.rateLimit";
    public const string SmsRetryLimit = Prefix + "sms.retryLimit";
    public const string WhatsAppProvider = Prefix + "whatsapp.provider";
    public const string WhatsAppApiUrl = Prefix + "whatsapp.apiUrl";
    public const string WhatsAppApiKey = Prefix + "whatsapp.apiKey";
    public const string WhatsAppBusinessNumber = Prefix + "whatsapp.businessNumber";
    public const string WhatsAppTemplates = Prefix + "whatsapp.templates";
    public const string AssistantApiKey = Prefix + "assistant.apiKey";
    public const string AssistantProvider = Prefix + "assistant.provider";
    public const string AssistantModel = Prefix + "assistant.model";
    public const string AssistantBaseUrl = Prefix + "assistant.baseUrl";

    public static bool IsSecret(string key) => key is EmailPassword or SmsApiKey or WhatsAppApiKey or AssistantApiKey;
}

public sealed class IntegrationSecretProtector(IDataProtectionProvider provider)
{
    private readonly IDataProtector protector = provider.CreateProtector("AllNepalHealthyHome.IntegrationSecrets.v1");

    public string Protect(string value) => protector.Protect(value);

    public string? Unprotect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try { return protector.Unprotect(value); }
        catch (CryptographicException) { return null; }
    }
}

public interface ISmsProvider
{
    Task SendAsync(string phone, string message, CancellationToken cancellationToken);
}

public interface IWhatsAppProvider
{
    Task SendAsync(string phone, string message, CancellationToken cancellationToken);
}

public sealed class NotConfiguredSmsProvider : ISmsProvider
{
    public Task SendAsync(string phone, string message, CancellationToken cancellationToken) => throw new InvalidOperationException("SMS provider is not configured.");
}

public sealed class NotConfiguredWhatsAppProvider : IWhatsAppProvider
{
    public Task SendAsync(string phone, string message, CancellationToken cancellationToken) => throw new InvalidOperationException("WhatsApp provider is not configured.");
}
