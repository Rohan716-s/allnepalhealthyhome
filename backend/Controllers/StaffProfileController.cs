using backend.Data;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/staff-profile")]
public sealed class StaffProfileController(ApplicationDbContext db, IMediaFileStorage media) : ControllerBase
{
    [HttpGet("photo")]
    public async Task<IActionResult> Photo(CancellationToken ct)
    {
        if (!User.TryGetStaffId(out var staffId)) return Forbid();
        var staff = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == staffId, ct);
        if (staff?.ProfilePhotoStoredFileName is null || string.IsNullOrWhiteSpace(staff.ProfilePhotoContentType)) return NotFound();
        var stream = await media.OpenReadAsync(staff.ProfilePhotoStoredFileName, ct);
        return stream is null ? NotFound() : File(stream, staff.ProfilePhotoContentType, enableRangeProcessing: true);
    }

    [HttpPost("photo")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> UploadPhoto([FromForm] IFormFile file, CancellationToken ct)
    {
        if (!User.TryGetStaffId(out var staffId)) return Forbid();
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == staffId && x.IsActive, ct);
        if (staff is null) return NotFound();
        StoredMediaFile? stored = null;
        try
        {
            stored = await media.SaveAsync(file, ct);
            var previousFile = staff.ProfilePhotoStoredFileName;
            staff.ProfilePhotoStoredFileName = stored.StoredFileName;
            staff.ProfilePhotoContentType = stored.ContentType;
            staff.UpdatedAt = DateTime.UtcNow;
            db.ActivityLogs.Add(new Models.ActivityLog { ActorId = staffId, ActorRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value, Action = "STAFF_PROFILE_PHOTO_UPDATED", EntityType = "StaffUser", EntityId = staffId.ToString(), PreviousValue = previousFile, NewValue = stored.OriginalFileName, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
            await db.SaveChangesAsync(ct);
            if (!string.IsNullOrWhiteSpace(previousFile) && previousFile != stored.StoredFileName) await media.DeleteAsync(previousFile, ct);
            return Ok(new { url = "/api/staff-profile/photo", contentType = stored.ContentType, fileName = stored.OriginalFileName });
        }
        catch (InvalidDataException exception) { return BadRequest(new { message = exception.Message }); }
        catch
        {
            if (stored is not null) await media.DeleteAsync(stored.StoredFileName, CancellationToken.None);
            throw;
        }
    }
}
