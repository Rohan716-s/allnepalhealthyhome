/** Choose one route, preferring a deeper path and matching query filters. */
export function activeSidebarLinkIndex(
  links: readonly { href: string }[],
  pathname: string,
  search: string,
  homePath: string,
) {
  const current = new URLSearchParams(search);
  let bestIndex = -1;
  let bestScore = -1;
  links.forEach(({ href }, index) => {
    const url = new URL(href, "http://sidebar.local");
    const path = url.pathname;
    if (pathname !== path && (path === homePath || !pathname.startsWith(`${path}/`))) return;
    const filters = [...url.searchParams.entries()];
    if (filters.some(([key, value]) => !current.getAll(key).includes(value))) return;
    const score = path.length * 1000 + filters.length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

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
