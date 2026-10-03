using System.Security.Claims;
using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/supervisor")]
public sealed class SupervisorProfileController(ApplicationDbContext db, IPasswordService passwords) : ControllerBase
{
    private Guid StaffId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private bool Authorized => User.IsStaffRole(StaffRoles.Supervisor, StaffRoles.SuperAdmin);

    [HttpGet("profile")]
    public async Task<ActionResult<StaffProfileResponse>> Profile(CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        var staff = await db.StaffUsers.AsNoTracking().Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == StaffId, ct);
        return staff is null ? NotFound() : Ok(ToResponse(staff));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<StaffProfileResponse>> UpdateProfile(UpdateStaffProfileRequest request, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Phone)) return BadRequest(new { message = "Name and phone are required." });
        if (request.EmployeeId?.Trim().Length > 80 || request.Address?.Trim().Length > 500) return BadRequest(new { message = "One or more profile fields are too long." });
        if (request.JoiningDate.HasValue && request.JoiningDate.Value.Date > DateTime.UtcNow.Date) return BadRequest(new { message = "Joining date cannot be in the future." });
        var staff = await db.StaffUsers.Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == StaffId && x.IsActive, ct);
        if (staff is null) return NotFound();
        var previous = System.Text.Json.JsonSerializer.Serialize(new { staff.FullName, staff.Phone, staff.EmployeeId, staff.Address, staff.JoiningDate });
        staff.FullName = request.FullName.Trim(); staff.Phone = request.Phone.Trim(); staff.EmployeeId = request.EmployeeId?.Trim(); staff.Address = request.Address?.Trim(); staff.JoiningDate = request.JoiningDate?.Date; staff.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = User.FindFirstValue(ClaimTypes.Role), Action = "SUPERVISOR_PROFILE_UPDATED", EntityType = "StaffUser", EntityId = StaffId.ToString(), PreviousValue = previous, NewValue = System.Text.Json.JsonSerializer.Serialize(new { staff.FullName, staff.Phone, staff.EmployeeId, staff.Address, staff.JoiningDate }), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct);
        return Ok(ToResponse(staff));
    }

    [HttpPut("profile/password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        if (!Authorized) return Forbid();
        if (request.NewPassword.Length < 8 || request.NewPassword != request.ConfirmPassword) return BadRequest(new { message = "New passwords must match and be at least 8 characters." });
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == StaffId && x.IsActive, ct);
        if (staff is null || !passwords.Verify(request.CurrentPassword, staff.PasswordHash)) return BadRequest(new { message = "The current password is incorrect." });
        staff.PasswordHash = passwords.Hash(request.NewPassword); staff.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = User.FindFirstValue(ClaimTypes.Role), Action = "SUPERVISOR_PASSWORD_CHANGED", EntityType = "StaffUser", EntityId = StaffId.ToString(), IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static StaffProfileResponse ToResponse(StaffUser staff) => new(staff.Id, staff.FullName, staff.Email, staff.Phone, staff.Role, staff.BranchId, staff.Branch?.Name, staff.LicenseReference, staff.IsActive, staff.EmployeeId, staff.Address, staff.JoiningDate, staff.ProfilePhotoStoredFileName is null ? null : "/api/staff-profile/photo");
}
