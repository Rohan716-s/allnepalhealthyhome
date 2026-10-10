"use client";
import { useContext } from "react";
import { EmbeddedListContext } from "@/components/entity-list-panel";


/* eslint-disable react-hooks/set-state-in-effect -- restore secure session and persisted sidebar preferences after mount. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  FileSpreadsheet,
  Headphones,
  Images,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Palette,
  Sparkles,
  Shield,
  Store,
  Tags,
  TimerReset,
  Users,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useManagementTheme } from "@/components/management-theme-provider";
import { useSiteConfig } from "@/components/site-config-provider";
import {
  searchAdmin,
  getStaffMe,
  getRoleSidebarConfig,
  type AdminGlobalSearchResult,
  type AdminRoleSidebarMenuItem,
  type Staff,
} from "@/services/api";
import { resolveSidebarIcon } from "@/lib/sidebar-icons";
import { AccountProfileMenu } from "@/components/account-profile-menu";
import { MessagingLink } from "@/components/messaging-link";
import { isProfileOrLogoutSidebarItem } from "@/lib/sidebar-navigation";
import { isCustomerWebsitePath } from "@/lib/staff-routing";

const adminNav = [
  { label: "Sales team workspace", href: "/sales-management", Icon: ClipboardList },
  { label: "Dashboard", href: "/admin", Icon: LayoutDashboard },
  { label: "HRMS", href: "/admin/hrms", Icon: Users },
  { label: "Attendance", href: "/admin/hrms?tab=attendance", Icon: CalendarDays },
  { label: "Leave", href: "/admin/hrms?tab=leave", Icon: CalendarPlus },
  { label: "HR setup", href: "/admin/hrms?tab=setup", Icon: Settings },
  { label: "Office operations", href: "/admin/hrms?tab=office", Icon: ClipboardList },
  { label: "Sales & Purchase", href: "/admin/sales-purchase", Icon: CreditCard, permission: "sales_purchase.view" },
  { label: "Orders", href: "/admin/orders", Icon: Store },
  { label: "Live deliveries", href: "/admin/delivery-live", Icon: MapPin, permission: "orders.view" },
  { label: "Prescriptions", href: "/admin/prescriptions", Icon: FileText },
  { label: "Products", href: "/admin/products", Icon: Tags },
  { label: "Catalog foundations", href: "/admin/catalog", Icon: Tags },
  {
    label: "Bulk product import",
    href: "/admin/catalog/import",
    Icon: FileSpreadsheet,
  },
  { label: "Branches", href: "/admin/branches", Icon: Store },
  { label: "Delivery zones", href: "/admin/zones", Icon: MapPin },
  { label: "Customers", href: "/admin/customers", Icon: Users },
  { label: "Payments", href: "/admin/payments", Icon: CreditCard },
  { label: "Branch activity", href: "/admin/branch-operations", Icon: BarChart3, permission: "reports.view" },
  { label: "Customer statements", href: "/admin/customer-statements", Icon: FileSpreadsheet, permission: "reports.view" },
  { label: "Reviews", href: "/admin/reviews", Icon: MessageSquare },
  { label: "Support", href: "/admin/support-tickets", Icon: Headphones },
  { label: "Messages", href: "/messages?account=staff", Icon: MessageSquare },
  { label: "Templates", href: "/admin/notification-templates", Icon: Bell },
  { label: "Articles", href: "/admin/articles", Icon: FileText },
  { label: "Design settings", href: "/admin/website/design", Icon: Palette, permission: "website.manage" },
  { label: "Hero slides", href: "/admin/website/hero-slides", Icon: Images, permission: "website.manage" },
  { label: "Flash sales", href: "/admin/flash-sales", Icon: TimerReset },
  { label: "Sales assignments", href: "/admin/sales-executives", Icon: Tags, permission: "sales_assignments.manage" },
  { label: "Notifications", href: "/admin/notifications", Icon: Bell },
  { label: "Reports", href: "/admin/reports", Icon: BarChart3 },
];
const superNav = [
  { label: "Sales team workspace", href: "/sales-management", Icon: ClipboardList },
  { label: "Dashboard", href: "/superadmin", Icon: LayoutDashboard },
  { label: "HRMS", href: "/superadmin/hrms", Icon: Users },
  { label: "Attendance", href: "/superadmin/hrms?tab=attendance", Icon: CalendarDays },
  { label: "Leave", href: "/superadmin/hrms?tab=leave", Icon: CalendarPlus },
  { label: "HR setup", href: "/superadmin/hrms?tab=setup", Icon: Settings },
  { label: "Office operations", href: "/superadmin/hrms?tab=office", Icon: ClipboardList },
  { label: "Sales & Purchase", href: "/superadmin/sales-purchase", Icon: CreditCard },
  { label: "Orders", href: "/superadmin/orders", Icon: Store },
  { label: "Live deliveries", href: "/superadmin/delivery-live", Icon: MapPin },
  { label: "Ordering controls", href: "/superadmin/ordering", Icon: Settings },
  { label: "Prescriptions", href: "/superadmin/prescriptions", Icon: FileText },
  { label: "Customers", href: "/superadmin/customers", Icon: Users },
  { label: "Payments", href: "/superadmin/payments", Icon: CreditCard },
  { label: "Branch activity", href: "/superadmin/branch-operations", Icon: BarChart3 },
  { label: "Customer statements", href: "/superadmin/customer-statements", Icon: FileSpreadsheet },
  {
    label: "Payment methods",
    href: "/superadmin/payment-methods",
    Icon: CreditCard,
  },
  { label: "Reviews", href: "/superadmin/reviews", Icon: MessageSquare },
  { label: "Support", href: "/superadmin/support-tickets", Icon: Headphones },
  { label: "Messages", href: "/superadmin/messaging?tab=inbox", Icon: MessageSquare },
  {
    label: "Templates",
    href: "/superadmin/notification-templates",
    Icon: Bell,
  },
  { label: "Articles", href: "/superadmin/articles", Icon: FileText },
  { label: "Notifications", href: "/superadmin/notifications", Icon: Bell },
  { label: "Website settings", href: "/superadmin/settings", Icon: Settings },
  {
    label: "AI chatbot",
    href: "/superadmin/settings/chatbot",
    Icon: MessageSquare,
  },
  {
    label: "Sidebar menu settings",
    href: "/superadmin/settings/sidebar",
    Icon: Menu,
  },
  {
    label: "Design settings",
    href: "/superadmin/website/design",
    Icon: Palette,
  },
  {
    label: "Animation settings",
    href: "/superadmin/website/animations",
    Icon: Sparkles,
  },
  { label: "Homepage builder", href: "/superadmin/website", Icon: Store },
  {
    label: "Hero slides",
    href: "/superadmin/website/hero-slides",
    Icon: Images,
  },
  {
    label: "Branch sales report",
    href: "/superadmin/reports/branch-sales",
    Icon: BarChart3,
  },
  { label: "Navigation", href: "/superadmin/navigation", Icon: Menu },
  { label: "Popups", href: "/superadmin/popups", Icon: Bell },
  { label: "SEO", href: "/superadmin/seo", Icon: Tags },
  { label: "Media library", href: "/superadmin/media", Icon: Store },
  { label: "CMS pages", href: "/superadmin/cms", Icon: FileText },
  { label: "Catalog", href: "/superadmin/catalog", Icon: Tags },
  {
    label: "Bulk product import",
    href: "/superadmin/catalog/import",
    Icon: FileSpreadsheet,
  },
  { label: "Branches", href: "/superadmin/branches", Icon: Store },
  { label: "Delivery zones", href: "/superadmin/zones", Icon: MapPin },
  { label: "Coupons", href: "/superadmin/coupons", Icon: BarChart3 },
  { label: "Flash sales", href: "/superadmin/flash-sales", Icon: TimerReset },
  { label: "Staff accounts", href: "/superadmin/staff", Icon: Users },
  { label: "Sales assignments", href: "/superadmin/sales-executives", Icon: Tags },
  { label: "Roles & permissions", href: "/superadmin/roles", Icon: KeyRound },
  { label: "Audit logs", href: "/superadmin/audit-logs", Icon: Shield },
  { label: "System health", href: "/superadmin/system-health", Icon: Shield },
  { label: "Reports", href: "/superadmin/reports", Icon: BarChart3 },
];
const supervisorNav = [
  {
    label: "Dashboard",
    href: "/supervisor",
    Icon: LayoutDashboard,
    permission: "reports.view",
  },
  { label: "My attendance", href: "/attendance", Icon: CalendarDays },
  { label: "My leave", href: "/leave", Icon: CalendarPlus },
  {
    label: "Orders",
    href: "/supervisor/orders",
    Icon: Store,
    permission: "orders.view",
  },
  {
    label: "Live deliveries",
    href: "/supervisor/delivery-live",
    Icon: MapPin,
    permission: "orders.view",
  },
  {
    label: "Prescriptions",
    href: "/supervisor/prescriptions",
    Icon: FileText,
    permission: "prescriptions.view",
  },
  {
    label: "Customers",
    href: "/supervisor/customers",
    Icon: Users,
    permission: "customers.view",
  },
  {
    label: "Inventory",
    href: "/supervisor/inventory",
    Icon: Boxes,
    permission: "inventory.view",
  },
  {
    label: "Reports",
    href: "/supervisor/reports",
    Icon: BarChart3,
    permission: "reports.view",
  },
  {
    label: "Notifications",
    href: "/supervisor/notifications",
    Icon: Bell,
    permission: "notifications.view",
  },
];

function tokenStaffRole(token: string): string | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedPayload =
      normalizedPayload + "=".repeat((4 - (normalizedPayload.length % 4)) % 4);
    const payload = JSON.parse(atob(paddedPayload)) as { role?: unknown };
    return typeof payload.role === "string"
      ? payload.role.trim().toUpperCase()
      : null;
  } catch {
    return null;
  }
}

export function AdminShell({
  children,
  superAdmin = false,
  supervisor = false,
}: {
  children: React.ReactNode;
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const embeddedList = useContext(EmbeddedListContext);
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminGlobalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [configuredNav, setConfiguredNav] = useState<
    AdminRoleSidebarMenuItem[] | null
  >(null);
  const { theme } = useManagementTheme();
  const { design, settings } = useSiteConfig();
  const companyName = settings["website.name"] || "All Nepal Healthy Home";
  const rightNavigation = design.sideNavPosition === "RIGHT";
  const sidebarRef = useRef<HTMLElement>(null);
  const panelName = superAdmin
    ? "superadmin"
    : supervisor
      ? "supervisor"
      : "admin";
  const sidebarStorageKey = `anhh-admin-sidebar-scroll-${panelName}`;
  const sidebarStyle = {
    "--sidebar-background": theme.sidebarBackground,
    "--sidebar-text": theme.sidebarText,
    "--sidebar-icon": theme.sidebarIcon,
    "--sidebar-hover-background": theme.sidebarHoverBackground,
    "--sidebar-hover-text": theme.sidebarHoverText,
    "--sidebar-active-background": theme.sidebarActiveBackground,
    "--sidebar-active-text": theme.sidebarActiveText,
    "--sidebar-active-icon": theme.sidebarActiveIcon,
    "--sidebar-border": theme.sidebarBorder,
    "--sidebar-divider": theme.sidebarDivider,
    "--sidebar-header-background": theme.sidebarHeaderBackground,
    "--sidebar-header-text": theme.sidebarHeaderText,
    "--sidebar-footer-background": theme.sidebarFooterBackground,
    "--sidebar-footer-text": theme.sidebarFooterText,
  } as CSSProperties;

  useEffect(() => {
    const raw = window.localStorage.getItem("anhh-staff");
    const token = window.localStorage.getItem("anhh-staff-access-token");
    let value: Staff | null = null;
    try {
      value = raw ? (JSON.parse(raw) as Staff) : null;
    } catch {
      value = null;
    }
    const tokenRole = token ? tokenStaffRole(token) : null;
    if (
      !token ||
      !value ||
      tokenRole !== value.role.trim().toUpperCase() ||
      (superAdmin
        ? value.role.trim().toUpperCase() !== "SUPERADMIN"
        : supervisor
          ? !["SUPERVISOR", "SUPERADMIN"].includes(
              value.role.trim().toUpperCase(),
            )
          : !["ADMIN", "SUPERVISOR", "SUPERADMIN", "SALES_MANAGER", "PURCHASE_INVENTORY_MANAGER", "HR_MANAGER", "VIEWER_AUDITOR", "EMPLOYEE"].includes(
              value.role.trim().toUpperCase(),
            ))
    ) {
      window.localStorage.removeItem("anhh-staff-access-token");
      window.localStorage.removeItem("anhh-staff");
      window.dispatchEvent(new Event("anhh-auth-changed"));
      router.replace(`/staff/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setStaff(value);
    getStaffMe(token)
      .then((serverStaff) => {
        if (
          serverStaff.role.trim().toUpperCase() !==
          value.role.trim().toUpperCase()
        ) {
          window.localStorage.removeItem("anhh-staff-access-token");
          window.localStorage.removeItem("anhh-staff");
          window.dispatchEvent(new Event("anhh-auth-changed"));
          router.replace(
            `/staff/login?returnTo=${encodeURIComponent(pathname)}`,
          );
          return;
        }
        setStaff(serverStaff);
        window.localStorage.setItem("anhh-staff", JSON.stringify(serverStaff));
      })
      .catch((cause) => {
        // Keep the workspace visible during a temporary API outage. Invalid or
        // expired credentials are handled immediately so they cannot surface
        // as misleading permission errors on every page.
        if (
          cause instanceof Error &&
          "status" in cause &&
          (cause as { status?: number }).status === 401
        ) {
          window.localStorage.removeItem("anhh-staff-access-token");
          window.localStorage.removeItem("anhh-staff");
          window.dispatchEvent(new Event("anhh-auth-changed"));
          router.replace(
            `/staff/login?returnTo=${encodeURIComponent(pathname)}`,
          );
        }
      });
    setCollapsed(
      window.localStorage.getItem("anhh-admin-sidebar-collapsed") === "true",
    );
  }, [pathname, router, superAdmin, supervisor]);

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    setConfiguredNav(null);
    getRoleSidebarConfig(
      staff.role,
      window.localStorage.getItem("anhh-staff-access-token") ?? "",
      superAdmin,
    )
      .then((items) => {
        if (!cancelled) setConfiguredNav(items);
      })
      .catch(() => {
        if (!cancelled) setConfiguredNav(null);
      });
    return () => {
      cancelled = true;
    };
  }, [staff, superAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sidebarRef.current)
        sidebarRef.current.scrollTop = Number(
          window.sessionStorage.getItem(sidebarStorageKey) ?? 0,
        );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, sidebarStorageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (superAdmin === false || supervisor || query.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      searchAdmin(
        window.localStorage.getItem("anhh-staff-access-token") ?? "",
        query,
        true,
      )
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, superAdmin, supervisor]);

  const fallbackNav = supervisor
    ? supervisorNav.filter(
        (item) =>
          !item.permission ||
          staff?.role === "SUPERADMIN" ||
          staff?.permissions?.includes(item.permission),
      )
    : superAdmin
      ? [
          { label: "Products", href: "/superadmin/products", Icon: Tags },
          ...superNav,
        ]
      : adminNav.filter(
          (item) =>
            !item.permission ||
            staff?.role === "SUPERADMIN" ||
            staff?.permissions?.includes(item.permission),
        );
  const nav =
    configuredNav !== null
      ? [
          ...configuredNav
            .filter(
              (item) => item.isVisible && !isProfileOrLogoutSidebarItem(item) && !isCustomerWebsitePath(item.href),
            )
            .map((item) => ({
              ...item,
              Icon: resolveSidebarIcon(item.icon),
            })),
          // Keep newly released Superadmin tools reachable even when an older
          // saved sidebar configuration predates the route.
          ...fallbackNav
            .filter(
              (item) => {
                const saved = configuredNav.find(
                  (entry) => entry.href === item.href,
                );
                if (!saved) return true;

                // A stale sidebar preference must not lock Superadmins out of
                // the Sales & Purchase workspace or role/permission controls.
                // Keep their visibility configurable for every other item.
                const requiredSuperAdminRoutes = [
                  "/superadmin/sales-purchase",
                  "/superadmin/sales-purchase/sales",
                  "/superadmin/sales-purchase/purchase",
                  "/superadmin/roles",
                  "/superadmin/ordering",
                  "/superadmin/delivery-live",
                ];
                const requiredHrmsRoutes = [
                  "/admin/hrms?tab=attendance",
                  "/admin/hrms?tab=leave",
                  "/superadmin/hrms?tab=attendance",
                  "/superadmin/hrms?tab=leave",
                ];
                const requiredSelfHrmsRoutes = ["/attendance", "/leave"];
                return Boolean(
                  superAdmin &&
                    requiredSuperAdminRoutes.includes(item.href) &&
                    !saved.isVisible,
                ) || Boolean(
                  !supervisor && requiredHrmsRoutes.includes(item.href) && !saved.isVisible,
                ) || Boolean(
                  supervisor && requiredSelfHrmsRoutes.includes(item.href) && !saved.isVisible,
                );
              },
            )
            .map((item) => ({ ...item, Icon: item.Icon })),
        ]
      : fallbackNav;
  const navSignature = nav.map((item) => item.href).join("\u001f");
  const activeRoutePathLength = nav.reduce((longest, item) => {
    const itemPath = item.href.split("?")[0];
    const rootPath = superAdmin ? "/superadmin" : "/admin";
    const matches = itemPath === rootPath
      ? pathname === itemPath
      : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
    return matches ? Math.max(longest, itemPath.length) : longest;
  }, 0);
  function rememberSidebarPosition() {
    if (sidebarRef.current)
      window.sessionStorage.setItem(
        sidebarStorageKey,
        String(sidebarRef.current.scrollTop),
      );
  }
  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const savedPosition = Number(
      window.sessionStorage.getItem(sidebarStorageKey) ?? 0,
    );
    if (Number.isFinite(savedPosition))
      sidebar.scrollTop = Math.max(0, savedPosition);

    const activeLink = sidebar.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (activeLink) {
      activeLink.scrollIntoView({ block: "nearest", inline: "nearest" });
      window.sessionStorage.setItem(
        sidebarStorageKey,
        String(sidebar.scrollTop),
      );
    }
  }, [pathname, sidebarStorageKey, navSignature, open]);
  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("anhh-admin-sidebar-collapsed", String(next));
      return next;
    });
  }
  if (!staff)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Checking secure access…
      </div>
    );

  // Edit routes are rendered inside AdminEditDialogShell. Keep the secure
  // session check, but do not duplicate the full sidebar/header inside it.
  if (embeddedList || pathname.includes("/edit")) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <Link
              href={
                superAdmin
                  ? "/superadmin"
                  : supervisor
                    ? "/supervisor"
                    : "/admin"
              }
              className="flex items-center gap-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DC143C] text-white">
                <Shield size={18} />
              </span>
              <span className="hidden text-xs font-extrabold uppercase tracking-[0.15em] text-slate-900 sm:block">
                {superAdmin
                  ? "SuperAdmin control"
                  : supervisor
                    ? "Supervisor operations"
                    : "Admin operations"}
              </span>
            </Link>
          </div>
          {superAdmin && (
            <div className="relative order-3 w-full max-w-xl lg:order-none lg:flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customers, products, orders, staff…"
                aria-label="Search all administration records"
                className="pl-9 pr-16"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                  }}
                  className="absolute right-3 top-2 text-xs font-bold text-slate-400 hover:text-slate-700"
                  aria-label="Clear global search"
                >
                  Clear
                </button>
              )}
              {(searching || query.trim().length >= 2) && (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {searching ? (
                    <p className="px-3 py-4 text-xs text-slate-500">
                      Searching live records…
                    </p>
                  ) : (
                    results.map((result) => (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.href}
                        onClick={() => {
                          setQuery("");
                          setResults([]);
                        }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
                      >
                        <Badge variant="secondary">{result.type}</Badge>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-800">
                            {result.label}
                          </span>
                          {result.secondary && (
                            <span className="block truncate text-xs text-slate-500">
                              {result.secondary}
                            </span>
                          )}
                        </span>
                      </Link>
                    ))
                  )}
                  {!results.length && !searching && (
                    <p className="px-3 py-4 text-xs text-slate-500">
                      No matching records found.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-slate-800">
                {staff.fullName}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {staff.role}
              </p>
            </div>
            <MessagingLink accountType="staff" compact href={superAdmin ? "/superadmin/messaging?tab=inbox" : "/messages?account=staff"} />
            <AccountProfileMenu
              kind="staff"
              name={staff.fullName}
              email={staff.email}
              accountTypeLabel={staff.role}
              links={[
                {
                  label: "My Account",
                  href: supervisor
                    ? "/supervisor/profile"
                    : superAdmin
                      ? "/superadmin"
                      : "/admin",
                },
                {
                  label: "Manage orders",
                  href: superAdmin
                    ? "/superadmin/orders"
                    : supervisor
                      ? "/supervisor/orders"
                      : "/admin/orders",
                },
              ]}
            />
          </div>
        </div>
      <div className="flex justify-end px-4 pb-1"></div>
      </header>
      <div
        className={
          collapsed
            ? rightNavigation
              ? "mx-auto grid max-w-[1600px] lg:grid-cols-[1fr_76px]"
              : "mx-auto grid max-w-[1600px] lg:grid-cols-[76px_1fr]"
            : rightNavigation
              ? "mx-auto grid max-w-[1600px] lg:grid-cols-[1fr_240px]"
              : "mx-auto grid max-w-[1600px] lg:grid-cols-[240px_1fr]"
        }
      >
        {open && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}
        <aside
          ref={sidebarRef}
          onScroll={rememberSidebarPosition}
          style={sidebarStyle}
          className={`${open ? `fixed inset-y-0 ${rightNavigation ? "right-0" : "left-0"} z-40 block w-[min(86vw,280px)] shadow-2xl` : "hidden"} ${collapsed ? "lg:relative lg:w-[76px]" : "lg:relative lg:w-[240px]"} ${rightNavigation ? "lg:col-start-2 lg:col-end-3 lg:border-l lg:border-r-0" : "lg:col-start-1 lg:col-end-2"} max-h-screen overflow-y-auto border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)] p-3 text-[var(--sidebar-text)] lg:sticky lg:top-16 lg:row-start-1 lg:block lg:h-[calc(100vh-4rem)] lg:shadow-none`}
        >
          <div
            className={`mb-4 flex items-center rounded-xl px-2 py-2 ${collapsed ? "justify-center" : "justify-between"}`}
            style={{
              backgroundColor: "var(--sidebar-header-background)",
              color: "var(--sidebar-header-text)",
            }}
          >
            <span
              className={`${collapsed ? "sr-only" : ""} text-[10px] font-extrabold uppercase tracking-[0.18em]`}
            >
              {companyName} · Management
            </span>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden rounded-lg p-2 opacity-80 hover:bg-white/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:block"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 opacity-80 hover:bg-white/10 hover:opacity-100 lg:hidden"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mb-3 border-t border-[var(--sidebar-divider)]" />
          <nav className="grid gap-1">
            {nav.map(({ label, href, Icon }, index) => {
              const salesPurchaseMatch = href.match(/^\/(admin|superadmin)\/sales-purchase(?:\/.*)?$/);
              const destination = salesPurchaseMatch
                ? `/${salesPurchaseMatch[1]}/sales-purchase`
                : href;
              const opensSalesPurchaseWorkspace = Boolean(salesPurchaseMatch);
              const destinationPath = destination.split("?")[0];
              const expectedTab = new URLSearchParams(destination.split("?")[1] ?? "").get("tab");
              const actualTab = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab");
              const pathIsActive = destinationPath === (superAdmin ? "/superadmin" : "/admin")
                ? pathname === destinationPath
                : pathname === destinationPath || pathname.startsWith(`${destinationPath}/`);
              const active = pathIsActive && destinationPath.length === activeRoutePathLength && (expectedTab ? expectedTab === actualTab : !destination.includes("/hrms") || !actualTab || actualTab === "dashboard");
              return (
                <Link
                  key={`${destination}-${index}`}
                  href={destination}
                  aria-current={active ? "page" : undefined}
                  target={opensSalesPurchaseWorkspace ? "_blank" : undefined}
                  rel={opensSalesPurchaseWorkspace ? "noopener noreferrer" : undefined}
                  onClick={() => {
                    rememberSidebarPosition();
                    setOpen(false);
                    if (expectedTab) window.dispatchEvent(new CustomEvent("hrms-tab", { detail: expectedTab }));
                  }}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 rounded-xl ${rightNavigation ? "border-r-2 border-l-0" : "border-l-2 border-r-0"} border-transparent px-3 py-2.5 text-xs font-bold transition-colors ${active ? "border-[var(--sidebar-active-icon)] bg-[var(--sidebar-active-background)] text-[var(--sidebar-active-text)] shadow-sm" : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-text)]"} ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon
                    size={16}
                    style={{
                      color: active
                        ? "var(--sidebar-active-icon)"
                        : "var(--sidebar-icon)",
                    }}
                  />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main
          className={`min-w-0 p-4 sm:p-6 lg:row-start-1 lg:p-8 ${
            rightNavigation
              ? "lg:col-start-1 lg:col-end-2"
              : "lg:col-start-2 lg:col-end-3"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
