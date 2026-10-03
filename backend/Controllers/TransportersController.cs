using System.Security.Claims;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/superadmin/transporters")]
[Route("api/admin/transporters")]
public sealed class TransportersController(ApplicationDbContext db) : ControllerBase
{
    private bool CanManage => User.IsStaffRole(StaffRoles.SuperAdmin) ||
        User.IsStaffRole(StaffRoles.Admin) && User.HasStaffPermission(AppPermissions.CatalogManage);
    private Guid ActorId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private string ActorRole => User.FindFirstValue(ClaimTypes.Role) ?? "STAFF";

    [HttpGet]
    public async Task<IActionResult> List(string? search, bool includeInactive = true, CancellationToken ct = default)
    {
        if (!CanManage) return Forbid();
        var query = db.Transporters.AsNoTracking().AsQueryable();
        if (!includeInactive) query = query.Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.Name.Contains(term) || (x.ContactPerson != null && x.ContactPerson.Contains(term)) || (x.Phone != null && x.Phone.Contains(term)) || (x.VehicleNumber != null && x.VehicleNumber.Contains(term)) || (x.ServiceArea != null && x.ServiceArea.Contains(term)));
        }
        return Ok(await query.OrderBy(x => x.Name).Take(500).Select(x => ToResponse(x)).ToListAsync(ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create(TransporterInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var error = await Validate(input, null, ct);
        if (error is not null) return BadRequest(new { message = error });
        var item = new Transporter { Name = input.Name.Trim(), ContactPerson = Clean(input.ContactPerson), Phone = Clean(input.Phone), Email = Clean(input.Email), VehicleNumber = Clean(input.VehicleNumber), LicenseNumber = Clean(input.LicenseNumber), ServiceArea = Clean(input.ServiceArea), Notes = Clean(input.Notes), IsActive = input.IsActive };
        db.Transporters.Add(item);
        Audit("TRANSPORTER_CREATED", item, item.Name);
        await db.SaveChangesAsync(ct);
        return Ok(ToResponse(item));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, TransporterInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var item = await db.Transporters.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound(new { message = "The transporter was not found." });
        var error = await Validate(input, id, ct);
        if (error is not null) return BadRequest(new { message = error });
        var before = item.Name;
        item.Name = input.Name.Trim(); item.ContactPerson = Clean(input.ContactPerson); item.Phone = Clean(input.Phone); item.Email = Clean(input.Email); item.VehicleNumber = Clean(input.VehicleNumber); item.LicenseNumber = Clean(input.LicenseNumber); item.ServiceArea = Clean(input.ServiceArea); item.Notes = Clean(input.Notes); item.IsActive = input.IsActive; item.UpdatedAt = ApplicationTime.NepalNow;
        Audit("TRANSPORTER_UPDATED", item, $"{before} → {item.Name}");
        await db.SaveChangesAsync(ct);
        return Ok(ToResponse(item));
    }

    private async Task<string?> Validate(TransporterInput input, Guid? currentId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 200) return "A transporter name of up to 200 characters is required.";
        if (input.ContactPerson?.Length > 160 || input.Phone?.Length > 30 || input.Email?.Length > 240 || input.VehicleNumber?.Length > 40 || input.LicenseNumber?.Length > 80 || input.ServiceArea?.Length > 300 || input.Notes?.Length > 1000) return "One or more transporter details exceed their allowed length.";
        if (!string.IsNullOrWhiteSpace(input.Email) && !System.Net.Mail.MailAddress.TryCreate(input.Email.Trim(), out _)) return "Enter a valid transporter email address.";
        var name = input.Name.Trim().ToLower();
        if (await db.Transporters.AnyAsync(x => x.Id != currentId && x.Name.ToLower() == name, ct)) return "A transporter with this name already exists.";
        if (!string.IsNullOrWhiteSpace(input.VehicleNumber) && await db.Transporters.AnyAsync(x => x.Id != currentId && x.VehicleNumber != null && x.VehicleNumber.ToLower() == input.VehicleNumber.Trim().ToLower(), ct)) return "That vehicle number is already assigned to a transporter.";
        return null;
    }

    private void Audit(string action, Transporter item, string value) => db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = action, EntityType = nameof(Transporter), EntityId = item.Id.ToString(), NewValue = value, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static object ToResponse(Transporter x) => new { x.Id, x.Name, x.ContactPerson, x.Phone, x.Email, x.VehicleNumber, x.LicenseNumber, x.ServiceArea, x.Notes, x.IsActive, x.CreatedAt, x.UpdatedAt };
    public sealed record TransporterInput(string Name, string? ContactPerson, string? Phone, string? Email, string? VehicleNumber, string? LicenseNumber, string? ServiceArea, string? Notes, bool IsActive);
}
