using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VersionController(IConfiguration configuration, IHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        application = configuration["Application:Name"] ?? "All Nepal Healthy Home",
        version = configuration["Application:Version"] ?? "0.1.0",
        environment = environment.EnvironmentName,
        runtime = Environment.Version.ToString()
    });
}

