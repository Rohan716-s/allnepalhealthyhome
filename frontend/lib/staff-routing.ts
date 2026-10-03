export function canReturnToStaffPath(path: string | null, role: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (path === "/messages" || path.startsWith("/messages?account=staff")) return true;
  const allowed =
    role === "SUPERADMIN"
      ? ["/superadmin", "/attendance", "/accounts"]
        : ["ADMIN", "SALES_MANAGER", "PURCHASE_INVENTORY_MANAGER", "HR_MANAGER", "VIEWER_AUDITOR"].includes(role)
          ? ["/admin", "/attendance", "/accounts"]
        : role === "EMPLOYEE"
          ? ["/attendance", "/leave"]
        : role === "SUPERVISOR"
          ? ["/supervisor"]
          : role === "DELIVERY"
          ? ["/delivery"]
            : role === "SALES_EXECUTIVE"
              ? ["/sales-executive"]
            : role === "ACCOUNTANT"
              ? ["/accounts"]
              : ["/pharmacist", "/attendance"];
  return allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function staffDefaultPath(role: string) {
  return role === "DELIVERY"
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
