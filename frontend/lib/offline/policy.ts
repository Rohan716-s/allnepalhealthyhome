import { OfflineError } from "./db";

export type Session = { scope: string; id: string; type: "staff" | "customer"; role: string; permissions: string[]; token: string; expiresAt: number };
export type MutationPolicy = { entity: string; root: string; recordId?: string; kind: "record" | "cart" | "wishlist" | "document" };
export function sessionForToken(token?: string): Session | null {
  if (!token || typeof window === "undefined") return null;
  try {
    const segment = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(segment + "=".repeat((4 - segment.length % 4) % 4))) as Record<string, unknown>;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number" || !["staff", "customer"].includes(String(claims.type))) return null;
    const type = claims.type as Session["type"];
    const role = String(claims.role ?? "CUSTOMER").toUpperCase();
    const permissions = Array.isArray(claims.permissions) ? claims.permissions.map(String).sort() : [];
    // Permissions and branch are part of the partition, so a changed role cannot
    // inherit cached data from an earlier, more privileged session.
    const partition = JSON.stringify([role, claims.branchId ?? null, permissions, claims.customerAccountType ?? null]);
    return { scope: `${type}:${claims.sub}:${partition}`, id: claims.sub, type, role, permissions, token, expiresAt: claims.exp * 1000 };
  } catch { return null; }
}
export function currentSession() {
  if (typeof window === "undefined") return null;
  return sessionForToken(localStorage.getItem("anhh-staff-access-token") ?? undefined)
    ?? sessionForToken(localStorage.getItem("anhh-access-token") ?? undefined);
}
export function requireSession(session: Session | null): asserts session is Session {
  if (!session || session.expiresAt <= Date.now()) throw new OfflineError("Your session has expired. Reconnect and sign in again to synchronize saved changes.", 401);
}
export function cacheableRead(path: string) {
  const route = path.split("?")[0];
  // Never persist passwords, auth responses, integration secrets, payroll,
  // audit logs, messaging content, live positions, or payment credentials.
  return /^\/api\/(products(?:\/[^/]+)?|catalog\/(?:categories|brands|trending|hot-deals)|site\/(?:config|summary|articles(?:\/[^/]+)?|featured-reviews|pages\/[^/]+)|cart|wishlist)$/.test(route)
    || /^\/api\/hrms\/(?:leave|setup\/[A-Z_]+|office\/[A-Z_]+|settings|shifts|attendance\/(?:today|history|team|records|corrections)|dashboard(?:\/overview)?)$/.test(route)
    || /^\/api\/(?:delivery\/)?orders(?:\/[0-9a-f-]{36})?(?:\/(?:documents|requirements))?$/.test(route)
    || /^\/api\/(?:admin|superadmin|pharmacist)\/(?:sidebar-config|staff|products|medicines|categories|brands|inventory(?:\/(?:low-stock|expiry))?|branches|suppliers|role-sidebar\/[^/]+)(?:\/[0-9a-f-]{36})?$/.test(route);
}
export function mutationPolicy(path: string, method: string): MutationPolicy | null {
  if (method === "POST" && path === "/api/cart/items" || method === "DELETE" && path === "/api/cart" || ["PUT", "DELETE"].includes(method) && /^\/api\/cart\/items\/[^/]+$/.test(path))
    return { entity: "cart", root: "/api/cart", kind: "cart", recordId: "cart" };
  const wishlist = path.match(/^\/api\/wishlist\/([^/]+)$/);
  if (wishlist && ["PUT", "DELETE"].includes(method)) return { entity: "wishlist", root: "/api/wishlist", kind: "wishlist", recordId: decodeURIComponent(wishlist[1]) };
  const hr = path.match(/^\/api\/hrms\/(setup|office)\/([A-Z_]+)(?:\/([0-9a-f-]{36}))?$/i);
  if (hr && (method === "POST" && !hr[3] || method === "PUT" && hr[3])) return { entity: `hrms-${hr[1]}`, root: `/api/hrms/${hr[1]}/${hr[2]}`, kind: "record", recordId: hr[3] };
  const leave = path.match(/^\/api\/hrms\/leave(?:\/(admin|[0-9a-f-]{36}))?$/i);
  if (leave && (method === "POST" && (!leave[1] || leave[1] === "admin") || ["PUT", "DELETE"].includes(method) && leave[1] && leave[1] !== "admin"))
    return { entity: "leave", root: "/api/hrms/leave", kind: "record", recordId: leave[1] === "admin" ? undefined : leave[1] };
  if (method === "POST" && /^\/api\/(?:delivery\/)?orders\/[0-9a-f-]{36}\/documents$/i.test(path)) return { entity: "document", root: path, kind: "document" };
  return null;
}
export function authorizeLocal(policy: MutationPolicy, session: Session) {
  const manager = ["ADMIN", "SUPERADMIN"].includes(session.role);
  if (policy.kind === "cart" || policy.kind === "wishlist" || policy.kind === "document" && !policy.root.includes("/delivery/")) {
    if (session.type !== "customer") throw new OfflineError("This operation requires a customer session.", 403);
  } else {
    if (session.type !== "staff") throw new OfflineError("This operation requires a staff session.", 403);
    if (policy.kind === "document" && session.role !== "DELIVERY") throw new OfflineError("Only the assigned rider can save delivery documents.", 403);
    if (policy.entity.startsWith("hrms-") && !manager && !session.permissions.includes(policy.entity === "hrms-setup" ? "hr_settings.manage" : "hrms.manage")) throw new OfflineError("You do not have permission to edit HR records.", 403);
    if (policy.entity === "leave" && policy.recordId && !manager) throw new OfflineError("Only a manager can edit or delete leave records.", 403);
  }
}
