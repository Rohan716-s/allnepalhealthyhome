using backend.Contracts;
using backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/notifications")]
public sealed class NotificationsController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StaffNotificationItem>>> List(CancellationToken ct) { if (!User.TryGetCustomerId(out var customerId)) return Unauthorized(); return Ok(await db.Notifications.AsNoTracking().Where(x => x.CustomerId == customerId).OrderByDescending(x => x.CreatedAt).Take(100).Select(x => new StaffNotificationItem(x.Id, x.Type, x.Title, x.Body, x.ReadAt != null, x.CreatedAt)).ToListAsync(ct)); }
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id, CancellationToken ct) { if (!User.TryGetCustomerId(out var customerId)) return Unauthorized(); var notification = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId, ct); if (notification is null) return NotFound(); notification.ReadAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return NoContent(); }
}
