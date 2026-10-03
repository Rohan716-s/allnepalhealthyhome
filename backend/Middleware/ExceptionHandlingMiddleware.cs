using System.Net;
using System.Text.Json;

namespace backend.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            var requestId = context.TraceIdentifier;
            logger.LogError(exception, "Unhandled exception while processing {Method} {Path}. RequestId: {RequestId}", context.Request.Method, context.Request.Path, requestId);
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/problem+json";
            context.Response.Headers["X-Request-Id"] = requestId;
            var problem = new { title = "The request could not be completed.", status = context.Response.StatusCode, requestId };
            await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
        }
    }
}
