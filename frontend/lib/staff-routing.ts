const staffWorkspaceRoots = [
  "/admin",
  "/superadmin",
  "/staff",
  "/delivery",
  "/pharmacist",
  "/supervisor",
  "/sales-executive",
  "/sales-management",
  "/accounts",
  "/sales-purchase",
  "/portals",
  "/attendance",
  "/leave",
  "/messages",
  "/auth",
];

/** Read the role claim from the signed staff access token, not a URL or cached profile. */
export function getAuthenticatedStaffRole(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token) return null;
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload + "=".repeat((4 - (normalizedPayload.length % 4)) % 4);
    const payload = JSON.parse(atob(paddedPayload)) as { role?: unknown; exp?: unknown };
    if (typeof payload.role !== "string" || !payload.role.trim()) return null;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return null;
    return payload.role.trim().toUpperCase();
  } catch {
    return null;
  }
}

/** Routes reserved for staff workspaces, including standalone HRMS and messaging pages. */
export function isStaffWorkspacePath(pathname: string) {
  return staffWorkspaceRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

const customerWebsiteRoots = [
  "/",
  "/about",
  "/account",
  "/brands",
  "/cart",
  "/categories",
  "/checkout",
  "/contact",
  "/login",
  "/orders",
  "/prescription",
  "/product",
  "/products",
  "/register",
  "/shop",
  "/track-order",
  "/wishlist",
];

export function isCustomerWebsitePath(href: string) {
  const pathname = href.split(/[?#]/, 1)[0] || "/";
  return customerWebsiteRoots.some((root) => pathname === root || (root !== "/" && pathname.startsWith(`${root}/`)))
    || pathname === "/";
}

export function canReturnToStaffPath(path: string | null, role: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  const pathname = path.split(/[?#]/, 1)[0];
  if ((pathname === "/sales-management" || pathname.startsWith("/sales-management/")) && ["SUPERADMIN", "ADMIN", "SALES_MANAGER", "ACCOUNTANT"].includes(role.toUpperCase())) return true;
  if (path === "/sales-purchase" || path.startsWith("/sales-purchase/") || path.startsWith("/admin/sales-purchase")) return role.trim().toUpperCase() !== "SALES_EXECUTIVE";
  if (path === "/messages" || path.startsWith("/messages?account=staff")) return true;
  const roleKey = role.trim().toUpperCase();
  const commonStaffPaths = ["/attendance", "/leave"];
  const allowed = roleKey === "SUPERADMIN"
    ? ["/superadmin", "/accounts", ...commonStaffPaths]
    : ["ADMIN", "SALES_MANAGER", "PURCHASE_INVENTORY_MANAGER", "HR_MANAGER", "VIEWER_AUDITOR"].includes(roleKey)
      ? ["/admin", "/accounts", ...commonStaffPaths]
      : roleKey === "EMPLOYEE"
        ? commonStaffPaths
        : roleKey === "SUPERVISOR"
          ? ["/supervisor", ...commonStaffPaths]
          : roleKey === "DELIVERY"
            ? ["/delivery", ...commonStaffPaths]
            : roleKey === "SALES_EXECUTIVE"
              ? ["/sales-executive", ...commonStaffPaths]
              : roleKey === "ACCOUNTANT"
                ? ["/accounts", ...commonStaffPaths]
                : ["/pharmacist", ...commonStaffPaths];
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function staffDefaultPath(role: string) {
  role = role.trim().toUpperCase();
  return role === "SALES_MANAGER" ? "/sales-management" : role === "DELIVERY"
    ? "/delivery"
    : role === "SALES_EXECUTIVE"
      ? "/sales-executive"
    : role === "ACCOUNTANT"
      ? "/accounts"
      : role === "SUPERADMIN"
        ? "/superadmin"
      : ["ADMIN", "SALES_MANAGER", "PURCHASE_INVENTORY_MANAGER", "HR_MANAGER", "VIEWER_AUDITOR"].includes(role)
        ? "/admin"
      : role === "EMPLOYEE"
        ? "/attendance"
          : role === "SUPERVISOR"
            ? "/supervisor"
            : "/pharmacist";
}
