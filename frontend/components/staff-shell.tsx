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
  ChevronDown,
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
  ShoppingBasket,
  ShieldCheck,
  Truck,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
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
import { activeSidebarLinkIndex, isProfileOrLogoutSidebarItem } from "@/lib/sidebar-navigation";
import { isCustomerWebsitePath } from "@/lib/staff-routing";
import { RiderAvailabilityControl } from "@/components/rider-availability-control";

type Panel = "pharmacist" | "delivery" | "sales-executive" | "accountant" | "sales-management";

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
  { label: "Delivery retries", href: "/pharmacist/delivery-retries", Icon: History },
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
  { label: "My deliveries", href: "/delivery/orders", Icon: Truck },
  { label: "Take order", href: "/delivery/take-order", Icon: ShoppingBasket },
  { label: "Active delivery", href: "/delivery/orders?status=OUT_FOR_DELIVERY", Icon: ClipboardCheck },
  {
    label: "Pending pickup",
    href: "/delivery/orders?status=ASSIGNED_FOR_DELIVERY",
    Icon: PackageCheck,
  },
  { label: "My cash", href: "/delivery/cash", Icon: ClipboardCheck },
  { label: "Delivery history", href: "/delivery/history?status=DELIVERED", Icon: History },
  { label: "Notifications", href: "/delivery/notifications", Icon: Bell },
  { label: "Profile", href: "/delivery/profile", Icon: Users },
];
const salesExecutiveLinks: StaffLink[] = [
  { label: "Dashboard", href: "/sales-executive", Icon: LayoutDashboard },
  { label: "My attendance", href: "/attendance", Icon: CalendarDays },
  { label: "My leave", href: "/leave", Icon: CalendarPlus },
  { label: "Assigned customers", href: "/sales-executive/customers", Icon: Users },
  { label: "Visits & follow-ups", href: "/sales-executive/visits", Icon: CalendarDays },
  { label: "Take order", href: "/sales-executive/take-order", Icon: ShoppingBasket },
  { label: "My orders", href: "/sales-executive/orders", Icon: ClipboardList },
  { label: "Payment follow-up", href: "/sales-executive/payments", Icon: FileClock },
  { label: "Collections", href: "/sales-executive/collections", Icon: ClipboardCheck },
  { label: "Return requests", href: "/sales-executive/returns", Icon: History },
  { label: "Sales performance", href: "/sales-executive/performance", Icon: BarChart3 },
  { label: "Messages", href: "/messages?account=staff", Icon: MessageCircle },
];
const accountantLinks: StaffLink[] = [
  { label: "Delivery cash handovers", href: "/accounts/delivery", Icon: ClipboardCheck },
  { label: "Finance workspace", href: "/accounts", Icon: BarChart3 },
  { label: "Verify sales collections", href: "/sales-management", Icon: ClipboardCheck },
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

type StaffShellProps = {
  panel: Panel;
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  backHref?: string;
};

export function StaffShell(props: StaffShellProps) {
  return <Suspense fallback={null}><StaffShellContent {...props} /></Suspense>;
}

function StaffShellContent({
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
  const searchParams = useSearchParams();
  const sidebarRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [deliveryMenuOpen, setDeliveryMenuOpen] = useState(false);
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
  const links = panel === "pharmacist" ? pharmacistLinks : panel === "delivery" ? deliveryLinks : panel === "sales-executive" ? salesExecutiveLinks : panel === "sales-management" ? [{ label: "Sales management", href: "/sales-management", Icon: ClipboardCheck }, { label: "My workspace", href: staff?.role === "ACCOUNTANT" ? "/accounts" : staff?.role === "SUPERADMIN" ? "/superadmin" : staff?.role === "SALES_MANAGER" ? "/sales-management" : "/admin", Icon: LayoutDashboard }, { label: "Messages", href: "/messages?account=staff", Icon: MessageCircle }] : accountantLinks;
  const homePath = panel === "pharmacist" ? "/pharmacist" : panel === "delivery" ? "/delivery" : panel === "sales-executive" ? "/sales-executive" : panel === "sales-management" ? "/sales-management" : "/accounts";
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
          : panel === "sales-management" ? ["SUPERADMIN", "ADMIN", "SALES_MANAGER", "ACCOUNTANT"] : ["ACCOUNTANT"];
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

  useEffect(() => {
    if (panel === "delivery") {
      setDeliveryMenuOpen(pathname.startsWith("/delivery/orders"));
    }
  }, [panel, pathname]);

  const configuredOrDefaultLinks =
    configuredLinks !== null
      ? configuredLinks
          .filter(
            (item) => item.isVisible && !isProfileOrLogoutSidebarItem(item) && !isCustomerWebsitePath(item.href),
          )
          .map((item) => ({
            ...item,
            Icon: resolveSidebarIcon(item.icon),
          }))
      : links;
  const deliveryConfiguredLinks = panel === "delivery"
    ? configuredOrDefaultLinks.filter((item) => item.href === "/delivery" || item.href.startsWith("/delivery/"))
    : [];
  const selfHrmsLinks: StaffLink[] = [
    { label: "My attendance", href: "/attendance", Icon: CalendarDays },
    { label: "My leave", href: "/leave", Icon: CalendarPlus },
  ];
  const visibleLinks = panel === "delivery"
    ? [
        ...deliveryLinks,
        ...deliveryConfiguredLinks.filter((configured) => !deliveryLinks.some((item) => item.href === configured.href)),
      ]
    : panel === "sales-executive" || panel === "sales-management"
      ? [...links, ...selfHrmsLinks.filter(item => !links.some(link => link.href === item.href))]
    : [
        ...configuredOrDefaultLinks,
        ...accountantLinks.filter(item => panel === "accountant" && item.href === "/sales-management" && !configuredOrDefaultLinks.some(link => link.href === item.href)),
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

  const activeLinkIndex = activeSidebarLinkIndex(visibleLinks, pathname, searchParams.toString(), homePath);

  function renderNavLink(
    { label, href, Icon }: StaffLink,
    index: number,
    nested = false,
  ) {
    const active = index === activeLinkIndex;
    return (
      <Link
        key={`${href}-${index}`}
        href={href}
        onClick={() => {
          rememberSidebarPosition();
        }}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl ${rightNavigation ? "border-r-2 border-l-0" : "border-l-2 border-r-0"} border-transparent px-3 py-3 text-sm font-bold transition-colors ${collapsed ? "justify-center" : ""} ${nested && !collapsed ? rightNavigation ? "pr-5" : "pl-5" : ""} ${active ? "border-[var(--sidebar-active-icon)] bg-[var(--sidebar-active-background)] text-[var(--sidebar-active-text)]" : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-text)]"}`}
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
    <div data-staff-panel={panel} className="min-h-screen bg-slate-100 dark:bg-slate-950">
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
                <span className="opacity-80">{panel === "delivery" ? "HEALTHY HOME" : "OPERATIONS"}</span>
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
            {panel === "delivery" ? (
              <>
                {renderNavLink(deliveryLinks[0], 0)}
                <div className="grid gap-1">
                  <button
                    type="button"
                    aria-expanded={deliveryMenuOpen}
                    aria-controls="delivery-subnav"
                    title={collapsed ? "Deliveries" : undefined}
                    aria-label={collapsed ? "Deliveries" : undefined}
                    onClick={() => {
                      if (collapsed) toggleCollapsed();
                      setDeliveryMenuOpen((value) => !value);
                    }}
                    className={`flex items-center gap-3 rounded-xl ${rightNavigation ? "border-r-2 border-l-0" : "border-l-2 border-r-0"} border-transparent px-3 py-3 text-sm font-bold transition-colors ${collapsed ? "justify-center" : "justify-between"} text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-text)]`}
                  >
                    <span className="flex items-center gap-3">
                      <Truck
                        size={17}
                        style={{
                          color: "var(--sidebar-icon)",
                        }}
                      />
                      {!collapsed && "Deliveries"}
                    </span>
                    {!collapsed && (
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${deliveryMenuOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  <div
                    id="delivery-subnav"
                    hidden={!deliveryMenuOpen}
                    className={`${deliveryMenuOpen ? "grid" : "hidden"} gap-1 ${rightNavigation ? "mr-3 border-r" : "ml-3 border-l"} border-[var(--sidebar-divider)] py-1`}
                  >
                    {deliveryLinks.slice(1, 5).map((link, index) =>
                      renderNavLink(link, index + 1, true),
                    )}
                  </div>
                </div>
                {deliveryLinks.slice(5).map((link, index) =>
                  renderNavLink(link, index + 5),
                )}
                {deliveryConfiguredLinks
                  .filter((configured) => !deliveryLinks.some((item) => item.href === configured.href))
                  .map((link, index) => renderNavLink(link, index + deliveryLinks.length))}
              </>
            ) : (
              visibleLinks.map((link, index) => renderNavLink(link, index))
            )}
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
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-center justify-between px-4 py-4 sm:px-8">
            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            {panel === "delivery" ? (
              <Link href={homePath} className="ml-2 flex min-w-0 items-center gap-2.5 text-slate-900 dark:text-slate-100">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><ShieldCheck size={19} /></span>
                <span className="min-w-0"><span className="block truncate text-xs font-extrabold sm:text-sm">All Nepal Healthy Home</span><span className="hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 sm:block">Delivery workspace</span></span>
              </Link>
            ) : (
              <div className="hidden items-center gap-2 text-xs font-bold text-slate-500 sm:flex">
                <Search size={16} className="text-teal-600" />{" "}
                {panel === "pharmacist" ? "Pharmacy control centre" : (panel === "sales-executive" || panel === "sales-management") ? "Sales workspace" : "Finance workspace"}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
              {panel === "delivery" && staff && <>
                <span className="max-w-14 truncate text-[10px] font-bold text-slate-700 dark:text-slate-200 sm:max-w-36 sm:text-xs">{staff.fullName.split(" ")[0]}</span>
                <RiderAvailabilityControl variant="compact" />
              </>}
              {panel !== "sales-executive" && panel !== "sales-management" && panel !== "accountant" && <Link
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
                  {panel !== "delivery" && <MessagingLink accountType="staff" compact />}
                  <AccountProfileMenu
                  kind="staff"
                  name={staff.fullName}
                  email={staff.email}
                  accountTypeLabel={staff.role}
                  links={panel === "accountant" ? [
                    { label: "Finance workspace", href: "/accounts" },
                  ] : panel === "sales-management" ? [{ label: "Sales management", href: "/sales-management" }] : panel === "delivery" ? [
                    { label: "My profile", href: "/delivery/profile" },
                    { label: "My deliveries", href: "/delivery/orders" },
                  ] : panel === "pharmacist" ? [
                    { label: "My profile", href: "/pharmacist/profile" },
                    { label: "My prescriptions", href: "/pharmacist/prescriptions" },
                    { label: "My orders", href: "/pharmacist/orders" },
                  ] : [
                    { label: "My workspace", href: "/sales-executive" },
                    { label: "My orders", href: "/sales-executive/orders" },
                  ]}
                  />
                </>
              )}
            </div>
          </div>
        <div className="flex justify-end px-4 pb-1"></div>
      </header>
        <main className={`mx-auto ${panel === "delivery" ? "max-w-6xl px-3 py-4 sm:px-6 sm:py-6" : "max-w-7xl px-4 py-7 sm:px-8"}`}>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              {resolvedBackHref && <BackButton fallbackHref={resolvedBackHref} />}
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">
                {panel === "pharmacist" ? "Pharmacist panel" : panel === "delivery" ? "Delivery panel" : panel === "sales-executive" ? "Sales Executive panel" : panel === "sales-management" ? "Sales management" : "Accountant panel"}
              </p>
              {title && (
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
                  {title}
                </h1>
              )}
            </div>
            {!resolvedBackHref && action}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
