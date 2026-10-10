import type { Staff } from "@/services/api";
import type { PharmacyMenuAction } from "@/components/pharmacy-module-menu";

const prefix = "sales_purchase.";
const defaults: Record<string, string[]> = {
  ADMIN: ["view", "sales.view", "sales.manage", "purchase.view", "purchase.manage", "accounts.view", "receipts.manage", "notes.manage", "journal.view", "journal.manage", "vouchers.post", "vouchers.unpost", "vouchers.narration", "vouchers.print"],
  ACCOUNTANT: ["view", "sales.view", "sales.manage", "purchase.view", "purchase.manage", "accounts.view", "receipts.manage", "notes.manage", "journal.view", "journal.manage", "vouchers.post", "vouchers.unpost", "vouchers.narration", "vouchers.print"],
  SUPERVISOR: ["view", "sales.view", "sales.manage", "purchase.view", "purchase.manage", "accounts.view", "journal.view", "vouchers.print"],
  SALES_EXECUTIVE: [],
  SALES_MANAGER: ["view", "sales.view", "sales.manage"],
  PURCHASE_INVENTORY_MANAGER: ["view", "purchase.view", "purchase.manage"],
};

export function hasCommercePermission(staff: Staff | null, key: string): boolean {
  if (!staff) return false;
  if (staff.role.toUpperCase() === "SALES_EXECUTIVE") return false;
  if (staff.role.toUpperCase() === "SUPERADMIN") return true;
  const permissions = staff.permissions ?? (defaults[staff.role.toUpperCase()] ?? []).map(value => prefix + value);
  return permissions.includes(key.startsWith(prefix) ? key : prefix + key);
}

export function canOpenCommerceDepartment(staff: Staff | null, department: "home" | "sales" | "purchase") {
  return hasCommercePermission(staff, "view") && (department === "home" || hasCommercePermission(staff, `${department}.view`));
}

export function canUseCommerceAction(staff: Staff | null, action: PharmacyMenuAction) {
  if (!hasCommercePermission(staff, "view")) return false;
  const mode = action.mode;
  if (action.section === "account" || action.section === "journal") {
    if (!hasCommercePermission(staff, action.section === "account" ? "accounts.view" : "journal.view")) return false;
    if (mode.endsWith("-print") || mode === "cheque-print") return hasCommercePermission(staff, "vouchers.print");
    if (mode === "post") return hasCommercePermission(staff, "vouchers.post");
    if (mode === "unpost") return hasCommercePermission(staff, "vouchers.unpost");
    if (mode === "narration") return hasCommercePermission(staff, "vouchers.narration");
    if (mode === "voucher-edit" || mode.endsWith("-entry")) return hasCommercePermission(staff, "journal.manage");
    if (mode.includes("note") && mode.endsWith("-edit") || mode.startsWith("supplier-") && !mode.endsWith("-book")) return hasCommercePermission(staff, "notes.manage");
    if (mode.endsWith("-edit") || mode === "cash-collection") return hasCommercePermission(staff, "receipts.manage");
    return true;
  }
  if (action.section === "sales") return hasCommercePermission(staff, "sales.view") && (!/(entry|return-cash|return-credit|reverse|cancel)/.test(mode) || hasCommercePermission(staff, "sales.manage"));
  if (action.section === "purchases") return hasCommercePermission(staff, "purchase.view") && (!/(entry|return$|cancel|modify|edit)/.test(mode) || hasCommercePermission(staff, "purchase.manage"));
  if (action.section === "credit") return hasCommercePermission(staff, "accounts.view");
  if (action.section === "inventory") return staff?.role === "SUPERADMIN" || !!staff?.permissions?.includes(/cancel|adjust|opening-stock$/.test(mode) ? "inventory.adjust" : "inventory.view");
  if (action.section === "catalogue") return staff?.role === "SUPERADMIN" || !!staff?.permissions?.includes("catalog.manage");
  return false;
}
