using System.Security.Claims;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/sales-purchase/setup")]
[Route("api/superadmin/sales-purchase/setup")]
public sealed class ProductRacksController(ApplicationDbContext db) : ControllerBase
{
    private bool IsSuperAdmin => User.IsStaffRole(StaffRoles.SuperAdmin);
    private bool SuperAdminPath => Request.Path.StartsWithSegments("/api/superadmin", StringComparison.OrdinalIgnoreCase);
    private bool CanManage => SuperAdminPath ? IsSuperAdmin : IsSuperAdmin || User.IsStaffRole(StaffRoles.Admin, StaffRoles.Supervisor) && User.HasStaffPermission(AppPermissions.CatalogManage);
    private Guid ActorId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private string ActorRole => User.FindFirstValue(ClaimTypes.Role) ?? "STAFF";

    [HttpGet("rack-groups")]
    public async Task<IActionResult> Groups(CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        return Ok(await db.ProductRackGroups.AsNoTracking().OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Code, x.IsActive, rackCount = x.Racks.Count }).ToListAsync(ct));
    }

    [HttpPost("rack-groups")]
    public async Task<IActionResult> CreateGroup(RackGroupInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var error = await ValidateGroup(input, null, ct); if (error is not null) return BadRequest(new { message = error });
        var row = new ProductRackGroup { Name = input.Name.Trim(), Code = Clean(input.Code), IsActive = input.IsActive };
        db.ProductRackGroups.Add(row); Audit("PRODUCT_RACK_GROUP_CREATED", row, row.Name); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpPut("rack-groups/{id:guid}")]
    public async Task<IActionResult> UpdateGroup(Guid id, RackGroupInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid(); var row = await db.ProductRackGroups.SingleOrDefaultAsync(x => x.Id == id, ct); if (row is null) return NotFound();
        var error = await ValidateGroup(input, id, ct); if (error is not null) return BadRequest(new { message = error });
        if (!input.IsActive && await db.Products.AnyAsync(x => x.Rack != null && x.Rack.RackGroupId == id, ct)) return Conflict(new { message = "This group is assigned to products. Move those products before deactivating the group." });
        if (!input.IsActive && await db.ProductRacks.AnyAsync(x => x.RackGroupId == id && x.IsActive, ct)) return Conflict(new { message = "Deactivate or move this group's active racks before deactivating the rack group." });
        var groupProducts = await db.Products.Include(x => x.Rack).Where(x => x.Rack != null && x.Rack.RackGroupId == id).ToListAsync(ct);
        row.Name = input.Name.Trim(); row.Code = Clean(input.Code); row.IsActive = input.IsActive; row.UpdatedAt = ApplicationTime.NepalNow;
        foreach (var product in groupProducts) if (product.Rack is not null) product.StorageLocation = Location(row.Name, product.Rack.Name);
        Audit("PRODUCT_RACK_GROUP_UPDATED", row, row.Name); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpGet("racks")]
    public async Task<IActionResult> Racks(Guid? groupId, CancellationToken ct)
    {
        if (!CanManage) return Forbid(); var query = db.ProductRacks.AsNoTracking().Include(x => x.RackGroup).AsQueryable();
        if (groupId.HasValue) query = query.Where(x => x.RackGroupId == groupId.Value);
        return Ok(await query.OrderBy(x => x.RackGroup!.Name).ThenBy(x => x.Name).Select(x => new { x.Id, x.RackGroupId, rackGroup = x.RackGroup!.Name, x.Name, x.Code, x.IsActive, productCount = x.Products.Count }).ToListAsync(ct));
    }

    [HttpPost("racks")]
    public async Task<IActionResult> CreateRack(RackInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid(); var error = await ValidateRack(input, null, ct); if (error is not null) return BadRequest(new { message = error });
        var row = new ProductRack { RackGroupId = input.RackGroupId, Name = input.Name.Trim(), Code = Clean(input.Code), IsActive = input.IsActive };
        db.ProductRacks.Add(row); Audit("PRODUCT_RACK_CREATED", row, $"{input.RackGroupId} · {row.Name}"); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    [HttpPut("racks/{id:guid}")]
    public async Task<IActionResult> UpdateRack(Guid id, RackInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid(); var row = await db.ProductRacks.SingleOrDefaultAsync(x => x.Id == id, ct); if (row is null) return NotFound();
        var error = await ValidateRack(input, id, ct); if (error is not null) return BadRequest(new { message = error });
        if (!input.IsActive && await db.Products.AnyAsync(x => x.RackId == id, ct)) return Conflict(new { message = "This rack is assigned to products. Reassign those products before deactivating it." });
        var rackProducts = await db.Products.Where(x => x.RackId == id).ToListAsync(ct);
        row.RackGroupId = input.RackGroupId; row.Name = input.Name.Trim(); row.Code = Clean(input.Code); row.IsActive = input.IsActive; row.UpdatedAt = ApplicationTime.NepalNow;
        var groupName = await db.ProductRackGroups.Where(x => x.Id == input.RackGroupId).Select(x => x.Name).SingleAsync(ct);
        foreach (var product in rackProducts) product.StorageLocation = Location(groupName, row.Name);
        Audit("PRODUCT_RACK_UPDATED", row, $"{input.RackGroupId} · {row.Name}"); await db.SaveChangesAsync(ct); return Ok(new { row.Id });
    }

    private async Task<string?> ValidateGroup(RackGroupInput input, Guid? currentId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 120 || input.Code?.Trim().Length > 40) return "Enter a rack-group name up to 120 characters and code up to 40 characters.";
        if (await db.ProductRackGroups.AnyAsync(x => x.Id != currentId && x.Name.ToLower() == input.Name.Trim().ToLower(), ct)) return "A rack group with that name already exists.";
        return null;
    }

    private async Task<string?> ValidateRack(RackInput input, Guid? currentId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 120 || input.Code?.Trim().Length > 40) return "Enter a rack name up to 120 characters and code up to 40 characters.";
        if (!await db.ProductRackGroups.AnyAsync(x => x.Id == input.RackGroupId && x.IsActive, ct)) return "Select an active rack group.";
        if (await db.ProductRacks.AnyAsync(x => x.Id != currentId && x.RackGroupId == input.RackGroupId && x.Name.ToLower() == input.Name.Trim().ToLower(), ct)) return "A rack with that name already exists in this group.";
        return null;
    }

    private void Audit(string action, AuditedEntity row, string value) => db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = action, EntityType = row.GetType().Name, EntityId = row.Id.ToString(), NewValue = value, IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() });
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Location(string group, string rack) => $"{group} / {rack}".Length <= 160 ? $"{group} / {rack}" : $"{group[..Math.Min(80, group.Length)]} / {rack[..Math.Min(70, rack.Length)]}";
    public sealed record RackGroupInput(string Name, string? Code, bool IsActive);
    public sealed record RackInput(Guid RackGroupId, string Name, string? Code, bool IsActive);
}
