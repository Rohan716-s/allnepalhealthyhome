namespace backend.Services;

public static class ManagementSidebarThemeDefaults
{
    public const string Group = "management-sidebar-theme";

    public static IReadOnlyDictionary<string, string> Values { get; } = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["sidebarBackground"] = "#003893",
        ["sidebarText"] = "#FFFFFF",
        ["sidebarIcon"] = "#BFDBFE",
        ["sidebarHoverBackground"] = "#1D4ED8",
        ["sidebarHoverText"] = "#FFFFFF",
        ["sidebarActiveBackground"] = "#DBEAFE",
        ["sidebarActiveText"] = "#003893",
        ["sidebarActiveIcon"] = "#003893",
        ["sidebarBorder"] = "#1E40AF",
        ["sidebarDivider"] = "#2563EB",
        ["sidebarHeaderBackground"] = "#002B6F",
        ["sidebarHeaderText"] = "#FFFFFF",
        ["sidebarFooterBackground"] = "#00275F",
        ["sidebarFooterText"] = "#DBEAFE",
        ["sidebarBadgeBackground"] = "#DBEAFE",
        ["sidebarBadgeText"] = "#003893",
    };
}
