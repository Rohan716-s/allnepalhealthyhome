using System.Security.Claims;
using backend.Controllers;
using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Middleware;

/// <summary>Use current staff permissions for financial operations, including previously issued tokens.</summary>
public sealed class CommerceAuthorizationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ApplicationDbContext db)
    {
        var commercial = context.Request.Path.Value?.Contains("/sales-purchase", StringComparison.OrdinalIgnoreCase) == true || context.Request.Path.StartsWithSegments("/api/accountant");
        if ((commercial || context.Request.Path.StartsWithSegments("/api/sales-executive"))
            && context.User.TryGetStaffId(out var staffId))
        {
            var staff = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == staffId, context.RequestAborted);
            var role = staff is null ? null : await db.AccessRoles.AsNoTracking().SingleOrDefaultAsync(x => x.Name == staff.Role, context.RequestAborted);
            if (staff is null || !staff.IsActive || commercial && staff.Role == StaffRoles.SalesExecutive || role is { IsActive: false })
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new { message = "This account does not have access to this workspace. Sales executives use the field sales modules." });
                return;
            }
            var claims = context.User.Claims.Where(x => x.Type is not "permission" and not "branch_id" && x.Type != ClaimTypes.Role).ToList();
            claims.Add(new Claim(ClaimTypes.Role, staff.Role));
            if (staff.BranchId.HasValue) claims.Add(new Claim("branch_id", staff.BranchId.Value.ToString()));
            IEnumerable<string> permissions = string.IsNullOrWhiteSpace(staff.PermissionsCsv)
                ? AppPermissions.DefaultsFor(staff.Role) : staff.PermissionsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var current = permissions.ToArray();
            // An explicit empty role must never fall back to role defaults.
            claims.AddRange((current.Length == 0 ? ["__none__"] : current).Select(x => new Claim("permission", x)));
            context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "CurrentStaff"));
        }
        await next(context);
    }
}
