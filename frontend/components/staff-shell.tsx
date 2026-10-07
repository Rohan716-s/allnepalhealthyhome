"use client";

/* eslint-disable react-hooks/set-state-in-effect -- hydrate the protected workspace from the browser session. */
import Link from "next/link";
import {
  Bell,
  BarChart3,
  MessageCircle,
  Boxes,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  getRoleSidebarConfig,
  Staff,
  type AdminRoleSidebarMenuItem,
} from "@/services/api";
import { resolveSidebarIcon } from "@/lib/sidebar-icons";
import { useManagementTheme } from "@/components/management-theme-provider";
import { useSiteConfig } from "@/components/site-config-provider";
import { AccountProfileMenu } from "@/components/account-profile-menu";
import { BackButton } from "@/components/back-button";
import { MessagingLink } from "@/components/messaging-link";
import { isProfileOrLogoutSidebarItem } from "@/lib/sidebar-navigation";
import { RiderAvailabilityControl } from "@/components/rider-availability-control";

type Panel = "pharmacist" | "delivery" | "sales-executive" | "accountant";

function staffRoleLabel(role?: string) {
  switch (role?.trim().toUpperCase()) {
    case "SUPERADMIN":
      return "SuperAdmin";
    case "ADMIN":
      return "Admin";
    case "SUPERVISOR":
      return "Supervisor";
    case "DELIVERY":
      return "Delivery staff";
    case "SALES_EXECUTIVE":
      return "Sales Executive";
    case "ACCOUNTANT":
      return "Accountant";
    case "PHARMACIST":
      return "Pharmacist";
    default:
      return role || "Staff";
  }
}
type StaffLink = {
  label: string;
  href: string;
  Icon: ComponentType<{
    size?: number;
    className?: string;
    style?: CSSProperties;
  }>;
};
const pharmacistLinks: StaffLink[] = [
  { label: "Dashboard", href: "/pharmacist", Icon: LayoutDashboard },
  { label: "My attendance", href: "/attendance", Icon: CalendarDays },
  { label: "Prescriptions", href: "/pharmacist/prescriptions", Icon: FileText },
  { label: "Orders", href: "/pharmacist/orders", Icon: ClipboardList },
  { label: "Medicines", href: "/pharmacist/inventory", Icon: Boxes },
  {
    label: "Low stock",
    href: "/pharmacist/inventory/low-stock",
    Icon: PackageCheck,
  },
  {
    label: "Expiry alerts",
    href: "/pharmacist/inventory/expiry",
    Icon: FileClock,
  },
  { label: "Customers", href: "/pharmacist/customers", Icon: Users },
  { label: "Notifications", href: "/pharmacist/notifications", Icon: Bell },
  { label: "Messages", href: "/messages?account=staff", Icon: MessageCircle },
  { label: "Activity", href: "/pharmacist/activity", Icon: History },
];
const deliveryLinks: StaffLink[] = [
  { label: "Dashboard", href: "/delivery", Icon: LayoutDashboard },
  { label: "My attendance", href: "/attendance", Icon: CalendarDays },
  { label: "My deliveries", href: "/delivery/orders", Icon: Truck },
  {
    label: "Pending pickup",
    href: "/delivery/orders?status=ASSIGNED_FOR_DELIVERY",
    Icon: PackageCheck,
  },
  {
    label: "Out for delivery",
    href: "/delivery/orders?status=OUT_FOR_DELIVERY",
    Icon: ClipboardCheck,
  },
  {
    label: "Completed",
    href: "/delivery/history?status=DELIVERED",
    Icon: ShieldCheck,
  },
  { label: "Failed", href: "/delivery/history?status=FAILED", Icon: FileText },
  { label: "Notifications", href: "/delivery/notifications", Icon: Bell },
  { label: "Messages", href: "/messages?account=staff", Icon: MessageCircle },
];
const salesExecutiveLinks: StaffLink[] = [
  { label: "Dashboard", href: "/sales-executive", Icon: LayoutDashboard },
  { label: "My attendance", href: "/attendance", Icon: CalendarDays },
  { label: "My leave", href: "/leave", Icon: CalendarPlus },
  { label: "Orders", href: "/sales-executive/orders", Icon: ClipboardList },
  { label: "Sales performance", href: "/sales-executive", Icon: BarChart3 },
  { label: "Messages", href: "/messages?account=staff", Icon: MessageCircle },
];
const accountantLinks: StaffLink[] = [
  { label: "Finance workspace", href: "/accounts", Icon: BarChart3 },
  { label: "Messages", href: "/messages?account=staff", Icon: MessageCircle },
];

export function staffToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("anhh-staff-access-token") ?? "";
}
export function staffUser(): Staff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("anhh-staff");
    return raw ? (JSON.parse(raw) as Staff) : null;
  } catch {
    return null;
  }
}

export function StaffShell({
  panel,
  children,
  title,
  action,
  backHref,
}: {
  panel: Panel;
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  backHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [configuredLinks, setConfiguredLinks] = useState<
    AdminRoleSidebarMenuItem[] | null
  >(null);
  const { theme } = useManagementTheme();
  const { design } = useSiteConfig();
  const rightNavigation = design.sideNavPosition === "RIGHT";
  const detailBackHref = pathname.startsWith("/delivery/orders/")
    ? "/delivery/orders"
    : pathname.startsWith("/pharmacist/orders/")
      ? "/pharmacist/orders"
      : pathname.startsWith("/pharmacist/prescriptions/")
        ? "/pharmacist/prescriptions"
        : undefined;
  const resolvedBackHref = backHref ?? detailBackHref;
  const links = panel === "pharmacist" ? pharmacistLinks : panel === "delivery" ? deliveryLinks : panel === "sales-executive" ? salesExecutiveLinks : accountantLinks;
  const homePath = panel === "pharmacist" ? "/pharmacist" : panel === "delivery" ? "/delivery" : panel === "sales-executive" ? "/sales-executive" : "/accounts";
  const collapsedStorageKey = `anhh-${panel}-sidebar-collapsed`;
  const scrollStorageKey = `anhh-${panel}-sidebar-scroll`;
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
    setCollapsed(window.localStorage.getItem(collapsedStorageKey) === "true");
    const token = staffToken();
    const user = staffUser();
    const role = user?.role?.toUpperCase();
    const allowed = panel === "pharmacist"
      ? ["PHARMACIST", "ADMIN", "SUPERVISOR", "SUPERADMIN"]
      : panel === "delivery"
        ? ["DELIVERY", "SUPERVISOR", "ADMIN", "SUPERADMIN"]
        : panel === "sales-executive"
          ? ["SALES_EXECUTIVE"]
          : ["ACCOUNTANT"];
    if (!token || !user || !allowed.includes(role ?? "")) {
      router.replace(`/staff/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setStaff(user);
    setReady(true);
  }, [collapsedStorageKey, panel, pathname, router]);

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    setConfiguredLinks(null);
    getRoleSidebarConfig(staff.role, staffToken())
      .then((items) => {
        if (!cancelled) setConfiguredLinks(items);
      })
      .catch(() => {
        if (!cancelled) setConfiguredLinks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [staff]);

  const configuredOrDefaultLinks =
    configuredLinks !== null
      ? configuredLinks
          .filter(
            (item) => item.isVisible && !isProfileOrLogoutSidebarItem(item),
          )
          .map((item) => ({
            ...item,
            Icon: resolveSidebarIcon(item.icon),
          }))
      : links;
  const selfHrmsLinks: StaffLink[] = [
    { label: "My attendance", href: "/attendance", Icon: CalendarDays },
    { label: "My leave", href: "/leave", Icon: CalendarPlus },
  ];
  const visibleLinks = [
    ...configuredOrDefaultLinks,
    ...selfHrmsLinks.filter((item) => !configuredOrDefaultLinks.some((configured) => configured.href === item.href)),
  ];

  useEffect(() => {
    const saved = Number(
      window.sessionStorage.getItem(scrollStorageKey) ?? "0",
    );
    const frame = window.requestAnimationFrame(() => {
      if (sidebarRef.current) sidebarRef.current.scrollTop = saved;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, scrollStorageKey]);

  function rememberSidebarPosition() {
    if (sidebarRef.current)
      window.sessionStorage.setItem(
        scrollStorageKey,
        String(sidebarRef.current.scrollTop),
      );
  }
  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(collapsedStorageKey, String(next));
      return next;
    });
  }

  if (!ready)
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-7xl animate-pulse rounded-3xl bg-white p-10">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="mt-5 h-10 w-72 rounded bg-slate-100" />
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100">
      {open && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        style={sidebarStyle}
        className={`${open ? "translate-x-0" : rightNavigation ? "translate-x-full" : "-translate-x-full"} fixed inset-y-0 ${rightNavigation ? "right-0 border-l border-r-0" : "left-0 border-r"} z-40 w-72 overflow-y-auto border-[var(--sidebar-border)] bg-[var(--sidebar-background)] px-5 py-6 text-[var(--sidebar-text)] transition-transform lg:translate-x-0 ${collapsed ? "lg:w-[84px] lg:px-3" : "lg:w-72"}`}
      >
        <div
          className={`rounded-2xl px-3 py-3 ${collapsed ? "flex justify-center" : "flex items-center justify-between"}`}
          style={{
            backgroundColor: "var(--sidebar-header-background)",
            color: "var(--sidebar-header-text)",
          }}
        >
          <Link
            href={homePath}
            onClick={rememberSidebarPosition}
            className="flex items-center gap-3"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: "var(--sidebar-active-background)",
                color: "var(--sidebar-active-icon)",
              }}
            >
              <ShieldCheck size={21} />
            </span>
            {!collapsed && (
              <span className="text-xs font-extrabold tracking-[0.13em]">
                ALL NEPAL
                <br />
                <span className="opacity-80">OPERATIONS</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 opacity-80 hover:bg-white/10 hover:opacity-100 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        {!collapsed && (
          <div
            className="mt-6 rounded-2xl p-4"
            style={{
              backgroundColor: "var(--sidebar-footer-background)",
              color: "var(--sidebar-footer-text)",
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--sidebar-active-icon)" }}
            >
              Signed in as
            </p>
            <p className="mt-2 text-sm font-extrabold">{staff?.fullName}</p>
            <p className="mt-1 text-xs opacity-75">
              {staffRoleLabel(staff?.role)}
            </p>
          </div>
        )}
        <div
          className={`${collapsed ? "mt-7" : "mt-5"} border-t border-[var(--sidebar-divider)] pt-3`}
        >
          <nav className="grid gap-1" aria-label={`${panel} navigation`}>
            {visibleLinks.map(({ label, href, Icon }, index) => {
              const active =
                pathname === href ||
                (href !== homePath && pathname.startsWith(href.split("?")[0]));
              return (
                <Link
                  key={`${href}-${index}`}
                  href={href}
                  onClick={rememberSidebarPosition}
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={`flex items-center gap-3 rounded-xl ${rightNavigation ? "border-r-2 border-l-0" : "border-l-2 border-r-0"} border-transparent px-3 py-3 text-sm font-bold transition-colors ${collapsed ? "justify-center" : ""} ${active ? "border-[var(--sidebar-active-icon)] bg-[var(--sidebar-active-background)] text-[var(--sidebar-active-text)]" : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-text)]"}`}
                >
                  <Icon
                    size={17}
                    style={{
                      color: active
                        ? "var(--sidebar-active-icon)"
                        : "var(--sidebar-icon)",
                    }}
                  />
                  {!collapsed && label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute right-[-14px] top-24 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-lg lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </aside>
      <div
        className={`${rightNavigation ? (collapsed ? "lg:pr-[84px]" : "lg:pr-72") : collapsed ? "lg:pl-[84px]" : "lg:pl-72"} transition-[padding]`}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-8">
            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="hidden items-center gap-2 text-xs font-bold text-slate-500 sm:flex">
              <Search size={16} className="text-teal-600" />{" "}
              {panel === "pharmacist" ? "Pharmacy control centre" : panel === "delivery" ? "Delivery workspace" : panel === "sales-executive" ? "Sales workspace" : "Finance workspace"}
            </div>
            <div className="ml-auto flex items-center gap-3">
              {panel !== "sales-executive" && panel !== "accountant" && <Link
                href={
                  panel === "pharmacist" ? "/pharmacist/notifications" : "/delivery/notifications"
                }
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:text-teal-700"
                aria-label="Open notifications"
              >
                <Bell size={18} />
              </Link>}
              {staff && (
                <>
                  <MessagingLink accountType="staff" compact />
                  <AccountProfileMenu
                  kind="staff"
                  name={staff.fullName}
                  email={staff.email}
                  accountTypeLabel={staff.role}
                  links={panel === "accountant" ? [
                    { label: "Finance workspace", href: "/accounts" },
                  ] : [
                    { label: "My Account", href: panel === "pharmacist" ? "/pharmacist/profile" : panel === "delivery" ? "/delivery/profile" : "/sales-executive" },
                    { label: "My Orders", href: panel === "pharmacist" ? "/pharmacist/orders" : panel === "delivery" ? "/delivery/orders" : "/sales-executive/orders" },
                    { label: "Wishlist", href: "/wishlist" },
                  ]}
                  />
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-7 sm:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              {resolvedBackHref && <BackButton fallbackHref={resolvedBackHref} />}
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">
                {panel === "pharmacist" ? "Pharmacist panel" : panel === "delivery" ? "Delivery panel" : panel === "sales-executive" ? "Sales Executive panel" : "Accountant panel"}
              </p>
              {title && (
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
                  {title}
                </h1>
              )}
            </div>
            {!resolvedBackHref && action}
          </div>
          {panel === "delivery" && <RiderAvailabilityControl />}
          {children}
        </main>
      </div>
    </div>
  );
}
