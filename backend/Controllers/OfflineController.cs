using backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/offline")]
public sealed class OfflineController(ApplicationDbContext db, ILogger<OfflineController> logger) : ControllerBase
{
    [HttpGet("capabilities")]
    public async Task<IActionResult> Capabilities(CancellationToken ct)
    {
        try
        {
            await db.Database.OpenConnectionAsync(ct);
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'offline_sync_receipts'";
            var ready = Convert.ToInt32(await command.ExecuteScalarAsync(ct)) == 1;
            return Ok(new { offlineWritesEnabled = ready, protocolVersion = 1, maxOfflineUploadBytes = 5 * 1024 * 1024 });
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Offline synchronization capability check failed.");
            return StatusCode(503, new { message = "The database is unavailable. Saved changes will be retained locally." });
        }
        finally { await db.Database.CloseConnectionAsync(); }
    }
}
