export function isProfileOrLogoutSidebarItem(item: {
  label?: string;
  href?: string;
}) {
  const value = `${item.label ?? ""} ${item.href ?? ""}`.toLowerCase();
  return (
    value.includes("profile") ||
    value.includes("logout") ||
    value.includes("log-out") ||
    value.includes("sign-out") ||
    value.includes("sign out") ||
    value.includes("signout")
  );
}
