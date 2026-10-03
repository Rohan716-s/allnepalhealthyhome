using backend.Data;
using backend.Middleware;
using backend.Services;
using backend.Hubs;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Keep local and production startup diagnostics on stdout. The Windows EventLog
// provider can throw when the process does not have permission to register the
// default .NET Runtime source, which can hide the original database error.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddSignalR();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
    options.AddPolicy("assistant", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
});
builder.Services.AddDataProtection().SetApplicationName("AllNepalHealthyHome");
builder.Services.AddAuthentication("ManualBearer").AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, ManualAuthenticationHandler>("ManualBearer", _ => { });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    connectionString = "Server=127.0.0.1;Port=3306;Database=allnepalhealthy;User=appuser;Password=change_me;SslMode=None;AllowPublicKeyRetrieval=True;";
}
var serverVersion = ServerVersion.Parse(builder.Configuration["Database:ServerVersion"] ?? "8.0.36-mysql");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(connectionString, serverVersion, mySql => mySql.EnableRetryOnFailure()));
builder.Services.Configure<ImageUploadOptions>(builder.Configuration.GetSection("ImageUpload"));
builder.Services.Configure<HeroVideoUploadOptions>(builder.Configuration.GetSection("HeroVideoUpload"));

builder.Services.AddSingleton<IPasswordService, PasswordService>();
builder.Services.AddSingleton<IAuthTokenService, AuthTokenService>();
builder.Services.AddSingleton<IPrescriptionFileStorage, PrescriptionFileStorage>();
builder.Services.AddSingleton<IMediaFileStorage, MediaFileStorage>();
builder.Services.AddSingleton<IMessageAttachmentStorage, MessageAttachmentStorage>();
builder.Services.AddSingleton<IOrderDocumentStorage, OrderDocumentStorage>();
builder.Services.AddScoped<IMessagingConversationService, MessagingConversationService>();
builder.Services.AddSingleton<IPrescriptionOcrService, TesseractOcrService>();
builder.Services.AddScoped<IMedicineMatchingService, MedicineMatchingService>();
builder.Services.AddScoped<INotificationTemplateService, NotificationTemplateService>();
builder.Services.AddSingleton<IntegrationSecretProtector>();
builder.Services.AddSingleton<IDatabaseBackupService, MysqlDatabaseBackupService>();
builder.Services.AddSingleton<ISmsProvider, NotConfiguredSmsProvider>();
builder.Services.AddSingleton<IWhatsAppProvider, NotConfiguredWhatsAppProvider>();
builder.Services.AddHttpClient<IPanVerificationService, IrPanVerificationService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(12);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("AllNepalHealthyHome/1.0");
});
builder.Services.AddHttpClient("Assistant", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("AllNepalHealthyHome-Assistant/1.0");
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>("mysql");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:3000"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalFrontend", policy =>
        policy.SetIsOriginAllowed(origin =>
        {
            if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
            return uri.Scheme == Uri.UriSchemeHttp &&
                (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                 uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase));
        })
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:SeedOnStart"))
{
    using var scope = app.Services.CreateScope();
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStart")) await dbContext.Database.MigrateAsync();
        await PharmacySeeder.SeedAsync(dbContext);
    }
    catch (Exception exception)
    {
        scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseStartup").LogError(exception, "Database startup initialization failed.");
    }
}

// Load the persisted platform timezone even when startup seeding is disabled.
using (var timeScope = app.Services.CreateScope())
{
    try
    {
        var dbContext = timeScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var configuredTimeZone = await dbContext.SystemSettings.AsNoTracking().Where(x => x.Key == "system.timezone").Select(x => x.Value).SingleOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(configuredTimeZone)) ApplicationTime.ConfigureTimeZone(configuredTimeZone);
    }
    catch (Exception exception)
    {
        timeScope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("PlatformTime").LogWarning(exception, "The persisted platform timezone could not be loaded; using Asia/Kathmandu.");
    }
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<CustomerAuthenticationMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("LocalFrontend");
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.Use(async (context, next) =>
{
    var isMessagingNegotiate = context.Request.Method.Equals("POST", StringComparison.OrdinalIgnoreCase)
        && context.Request.Path.StartsWithSegments("/hubs/messaging")
        && context.Request.Path.Value?.EndsWith("/negotiate", StringComparison.OrdinalIgnoreCase) == true;
    if (isMessagingNegotiate)
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        var token = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authorization[7..].Trim()
            : context.Request.Query["access_token"].ToString();
        var authTokenService = context.RequestServices.GetRequiredService<IAuthTokenService>();
        if (string.IsNullOrWhiteSpace(token) || authTokenService.Validate(token) is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }
    }
    await next();
});
app.MapHub<backend.Hubs.MessagingHub>("/hubs/messaging");
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHealthChecks("/healthz");

app.Run();

public partial class Program { }
