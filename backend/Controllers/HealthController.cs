using backend.Data;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "healthy" });

    [HttpGet("database")]
    public async Task<IActionResult> GetDatabase(CancellationToken cancellationToken)
    {
        try
        {
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? Ok(new { status = "healthy" })
                : StatusCode(StatusCodes.Status503ServiceUnavailable, new { status = "unhealthy" });
        }
        catch (Exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { status = "unhealthy" });
        }
    }
}
