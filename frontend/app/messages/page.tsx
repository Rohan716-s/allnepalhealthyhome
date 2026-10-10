"use client";

/* eslint-disable react-hooks/set-state-in-effect -- resolve which persisted account session owns this inbox after mount. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { SiteHeader } from "@/components/site-header";
import { StaffShell } from "@/components/staff-shell";
import { MessagingCenter } from "@/components/messaging-center";
import { getAuthenticatedStaffRole } from "@/lib/staff-routing";
import type { Staff } from "@/services/api";

type AccountType = "staff" | "customer";

function cachedStaff(): Staff | null {
  try {
    const raw = window.localStorage.getItem("anhh-staff");
    return raw ? (JSON.parse(raw) as Staff) : null;
  } catch {
    return null;
  }
}

export default function MessagesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("customer");
  const [staffRole, setStaffRole] = useState("");

  useEffect(() => {
    const staffToken = window.localStorage.getItem("anhh-staff-access-token");
    const customerToken = window.localStorage.getItem("anhh-access-token");
    const requested = new URLSearchParams(window.location.search).get("account");
    const authenticatedStaffRole = getAuthenticatedStaffRole();
    const account: AccountType = authenticatedStaffRole
      ? "staff"
      : requested === "staff"
      ? "staff"
      : requested === "customer"
        ? "customer"
        : staffToken && !customerToken ? "staff" : "customer";
    const token = account === "staff" ? staffToken : customerToken;
    const returnTo = `/messages?account=${account}`;

    setAccountType(account);
    if (!token) {
      router.replace(`${account === "staff" ? "/staff/login" : "/login"}?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (account === "staff") setStaffRole(authenticatedStaffRole ?? cachedStaff()?.role?.trim().toUpperCase() ?? "");
    setAuthorized(true);
  }, [router]);

  if (!authorized) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" aria-busy="true" />;

  const content = <main className="messages-page w-full bg-[#f6f8fc] px-3 py-6 sm:px-6 sm:py-10 dark:bg-[#080d17]">
    <div className="mx-auto max-w-7xl">
      <section className="messages-hero mb-6 flex flex-col gap-5 rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/70 px-5 py-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:shadow-[0_20px_55px_rgba(0,0,0,0.28)] sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#003893] dark:text-blue-300"><span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-100 dark:bg-blue-950/80"><MessageCircle size={16} aria-hidden="true" /></span>Secure communication</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Messages</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Message the right team member, share documents safely, or send your current location when support needs it.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200 sm:self-auto"><ShieldCheck size={15} aria-hidden="true" />Private &amp; secure</div>
      </section>
      <MessagingCenter accountType={accountType} returnTo={`/messages?account=${accountType}`} />
    </div>
  </main>;

  if (accountType === "customer") return <><SiteHeader />{content}</>;
  if (staffRole === "SUPERADMIN") return <AdminShell superAdmin>{content}</AdminShell>;
  if (staffRole === "SUPERVISOR") return <AdminShell supervisor>{content}</AdminShell>;
  if (staffRole === "ADMIN") return <AdminShell>{content}</AdminShell>;
  if (staffRole === "DELIVERY") return <StaffShell panel="delivery" title="Messages">{content}</StaffShell>;
  if (staffRole === "SALES_EXECUTIVE") return <StaffShell panel="sales-executive" title="Messages">{content}</StaffShell>;
  if (staffRole === "ACCOUNTANT") return <StaffShell panel="accountant" title="Messages">{content}</StaffShell>;
  if (staffRole === "PHARMACIST") return <StaffShell panel="pharmacist" title="Messages">{content}</StaffShell>;
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center dark:bg-slate-950"><div><h1 className="text-xl font-bold text-slate-950 dark:text-white">Messaging is unavailable for this role</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Ask your administrator to enable messaging access for your staff role.</p></div></main>;
}
