"use client";

/* eslint-disable react-hooks/set-state-in-effect -- validate the saved staff session before exposing a department workspace. */
import { usePathname, useRouter } from "next/navigation";
import { Pill } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountProfileMenu } from "@/components/account-profile-menu";
import { MessagingLink } from "@/components/messaging-link";
import { SalesPurchaseManagement } from "@/components/sales-purchase-management";
import { useSiteConfig } from "@/components/site-config-provider";
import { staffToken, staffUser } from "@/components/staff-shell";
import { formatPlatformDate } from "@/lib/date-time";
import { parseWorkspaceLabels, workspaceLabel } from "@/lib/workspace-labels";
import { canOpenCommerceDepartment } from "@/lib/sales-purchase-permissions";
import { getStaffMe, type Staff } from "@/services/api";

type Department = "home" | "sales" | "purchase";

const roleKey = (role?: string) => role?.trim().toUpperCase() ?? "";


export function SalesPurchaseDepartmentWorkspace({ department, superAdmin = false }: { department: Department; superAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const site = useSiteConfig();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const workspaceLabels = parseWorkspaceLabels(site.settings["workspace.labels"]);
  const labelFor = (value: string) => workspaceLabel(value, workspaceLabels);
  const title = labelFor(department === "home" ? "Operations Home" : department === "sales" ? "Sales-Department" : "Purchase-Department");
  const companyName = site.settings["website.name"] || "All Nepal Healthy Home";
  const tagline = site.settings["website.tagline"] || "Trusted pharmacy care, delivered home";
  const headerRight = site.settings["workspace.header.right"] || "ALL NEPAL";
  const bannerMessage = site.settings["workspace.banner.message"] || "Trusted healthcare operations · Accurate stock, sales and reports";

  useEffect(() => {
    let active = true;
    const token = staffToken();
    const cachedStaff = staffUser();
    const cachedRole = roleKey(cachedStaff?.role);
    const login = () => router.replace(`/staff/login?returnTo=${encodeURIComponent(pathname)}`);

    if (!token || !cachedStaff || !canOpenCommerceDepartment(cachedStaff, department) || (superAdmin && cachedRole !== "SUPERADMIN")) {
      login();
      return () => { active = false; };
    }

    setStaff(cachedStaff);
    getStaffMe(token)
      .then((serverStaff) => {
        if (!active) return;
        const serverRole = roleKey(serverStaff.role);
        if (!canOpenCommerceDepartment(serverStaff, department) || (superAdmin && serverRole !== "SUPERADMIN")) {
          login();
          return;
        }
        setStaff(serverStaff);
        window.localStorage.setItem("anhh-staff", JSON.stringify(serverStaff));
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && "status" in error && (error as { status?: number }).status === 401) {
          window.localStorage.removeItem("anhh-staff-access-token");
          window.localStorage.removeItem("anhh-staff");
          window.dispatchEvent(new Event("anhh-auth-changed"));
          login();
          return;
        }
        // Keep access available during a temporary API outage; every data operation remains API-authorized.
        setReady(true);
      });

    return () => { active = false; };
  }, [department, pathname, router, superAdmin]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = `${companyName} · ${title}`;
  }, [companyName, title]);

  if (!ready || !staff) return <div className="grid min-h-screen place-items-center bg-slate-100 px-5 text-sm font-medium text-slate-500">Checking secure department access…</div>;

  const activeRole = roleKey(staff.role);
  const profileLinks = [
    { label: "My Account", href: activeRole === "SUPERADMIN" ? "/superadmin" : "/admin" },
    { label: "My Orders", href: activeRole === "SUPERADMIN" ? "/superadmin/orders" : "/admin/orders" },
  ];

  const clock = now ? new Intl.DateTimeFormat("en-NP", { timeZone: site.timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: site.timeFormat === "12" }).format(now) : "—";
  const primaryDate = now ? formatPlatformDate(now, site.dateFormat) : "—";
  const alternateDate = now ? formatPlatformDate(now, site.dateFormat === "AD" ? "BS" : "AD") : "—";
  const dark = site.colorMode === "dark";
  const footerDeveloper = (site.settings["workspace.footer.developer"] || "Developed for {company_name}")
    .replaceAll("{company_name}", companyName)
    .replaceAll("All Nepal Healthy Home", companyName);

  return <div className={`flex min-h-screen flex-col font-serif ${dark ? "bg-slate-950 text-slate-100" : "bg-[#f1f4f8] text-slate-900"}`}>
    <header className={`border-b ${dark ? "border-slate-700 bg-slate-900" : "border-[#d6dcc9] bg-[#edf2df]"}`}>
      <div className="flex min-h-6 items-center gap-2 px-1.5 text-[11px] font-semibold">
        <span className="truncate">{companyName}</span>
      </div>
    </header>
    <main className="flex w-full flex-1 flex-col px-0 py-0">
      <SalesPurchaseManagement superAdmin={superAdmin} departmentView={department === "home" ? undefined : department} workspaceBanner={
        <section className={`relative overflow-hidden ${department === "home" ? "flex min-h-0 flex-1 flex-col" : ""} ${dark ? "bg-slate-950" : "bg-white"}`} aria-label={`${title} dashboard header`}>
          <div className={`relative z-20 flex min-h-7 items-center justify-between gap-3 border-y px-2 text-xs font-bold ${dark ? "border-slate-700 bg-slate-800 text-slate-100" : "border-[#d7ddcc] bg-[#edf1df] text-[#283126]"}`}>
            <span className="truncate">{staff.fullName}</span>
            <div className="flex shrink-0 items-center gap-3"><span className="hidden sm:inline">{headerRight}</span><MessagingLink accountType="staff" compact href={superAdmin ? "/superadmin/messaging?tab=inbox" : "/messages?account=staff"} /><AccountProfileMenu kind="staff" name={staff.fullName} email={staff.email} accountTypeLabel={staff.role} links={profileLinks} /></div>
          </div>
          <div className={`relative isolate flex overflow-hidden ${department === "home" ? "min-h-[26rem] flex-1" : "min-h-[17rem] sm:min-h-[19rem]"} ${dark ? "bg-slate-950" : "bg-[#fbfbfa]"}`}>
            <svg aria-hidden="true" viewBox="0 0 1600 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs><linearGradient id="anhh-workspace-blue" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#385989" /><stop offset="100%" stopColor="#294a7b" /></linearGradient></defs>
              <path d="M0 0H1600V160C1300 148 1055 125 800 95C530 63 260 43 0 50Z" fill="url(#anhh-workspace-blue)" />
            </svg>
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-[23%] -left-[12%] h-[100%] w-[43%] rounded-[50%] opacity-40" style={{ backgroundImage: "repeating-linear-gradient(0deg, #d5dbe2 0 1px, transparent 1px 4px)" }} />
            <div className="relative z-10 ml-auto max-w-5xl px-4 pt-2 text-right text-white sm:px-8 sm:pt-1">
              <h2 className="text-2xl font-bold uppercase leading-tight sm:text-4xl">{companyName}</h2>
              <p className="mt-5 text-2xl font-bold uppercase leading-tight sm:text-4xl">{headerRight}</p>
            </div>
            <p className="absolute bottom-32 left-1/2 z-10 w-[min(48rem,calc(100%-2rem))] -translate-x-1/2 text-center text-xs font-bold text-[#43628c] sm:bottom-8 sm:text-base">{bannerMessage}</p>
            <div className="absolute bottom-7 right-5 z-10 flex items-center gap-3 sm:bottom-9 sm:right-8">
              <div className="grid h-20 w-20 place-items-center rounded-full border-[7px] border-emerald-300/70 bg-white text-[#07509a] shadow-lg sm:h-28 sm:w-28"><Pill size={48} strokeWidth={1.6} className="text-[#07509a] sm:hidden" /><Pill size={64} strokeWidth={1.6} className="hidden text-[#07509a] sm:block" /></div>
              <div className="hidden text-right text-[#17477e] sm:block"><p className="max-w-52 text-sm font-extrabold uppercase leading-tight">{companyName}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">{tagline}</p></div>
            </div>
          </div>
        </section>
      } />
    </main>
    <footer className="mt-auto w-full overflow-hidden border-t border-[#244a7c] bg-[#315889] text-white">
      <div className="grid items-center gap-1 px-2 py-1.5 text-center text-xs font-bold sm:grid-cols-3 sm:text-sm">
        <span className="sm:text-left">{now ? new Intl.DateTimeFormat("en-US", { timeZone: site.timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now) : primaryDate}</span>
        <span className="font-extrabold tabular-nums">{clock}</span>
        <span className="sm:text-right">{alternateDate}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/20 bg-white/10 px-2 py-1 text-[10px] font-medium text-blue-50 sm:text-xs">
        <span>{footerDeveloper}</span>
        <span className="hidden md:inline">{site.settings["workspace.footer.contact"] || "Pharmacy Management Workspace"}</span>
        <span>{headerRight} · {site.settings["workspace.footer.version"] || "PMC Workspace"}</span>
      </div>
    </footer>
  </div>;
}
