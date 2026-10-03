using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public static class RiderAvailabilityOperations
{
    public static async Task SetUnavailableAsync(ApplicationDbContext db, Guid staffUserId, DateTime updatedAt, CancellationToken ct)
    {
        var availability = await db.RiderAvailabilities.SingleOrDefaultAsync(x => x.StaffUserId == staffUserId, ct);
        if (availability is null) return;

        availability.IsAvailable = false;
        availability.Latitude = null;
        availability.Longitude = null;
        availability.AccuracyMeters = null;
        availability.LocationUpdatedAt = null;
        availability.UpdatedAt = updatedAt;
    }
}
