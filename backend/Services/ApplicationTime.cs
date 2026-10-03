namespace backend.Services;

public static class ApplicationTime
{
    public const string NepalTimeZoneId = "Asia/Kathmandu";

    private static TimeZoneInfo platformTimeZone = ResolveTimeZone(NepalTimeZoneId);

    public static DateTime UtcNow => DateTime.UtcNow;
    public static string TimeZoneId => platformTimeZone.Id;

    /// <summary>Business/platform time in the currently selected system timezone.</summary>
    public static DateTime NepalNow => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, platformTimeZone);

    public static bool ConfigureTimeZone(string timeZoneId)
    {
        try
        {
            platformTimeZone = ResolveTimeZone(timeZoneId);
            return true;
        }
        catch (TimeZoneNotFoundException) { return false; }
        catch (InvalidTimeZoneException) { return false; }
    }

    /// <summary>Converts browser datetime-local values (which arrive as Unspecified) from Nepal time to UTC.</summary>
    public static DateTime ToUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc) return value;
        if (value.Kind == DateTimeKind.Local) return value.ToUniversalTime();
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), platformTimeZone);
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); }
        catch (TimeZoneNotFoundException) when (timeZoneId == NepalTimeZoneId) { return TimeZoneInfo.FindSystemTimeZoneById("Nepal Standard Time"); }
        catch (InvalidTimeZoneException) when (timeZoneId == NepalTimeZoneId) { return TimeZoneInfo.Utc; }
    }
}
