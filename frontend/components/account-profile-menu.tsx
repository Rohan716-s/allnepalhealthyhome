"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutSession } from "@/services/api";
import { requestSiteConfirmation } from "@/lib/confirmation-events";

export type AccountProfileLink = { label: string; href: string };

type AccountProfileMenuProps = {
  kind: "customer" | "staff";
  name: string;
  email: string;
  accountTypeLabel?: string;
  links: AccountProfileLink[];
  compact?: boolean;
};

export function AccountProfileMenu({
  kind,
  name,
  email,
  accountTypeLabel,
  links,
  compact = false,
}: AccountProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function requestLogout() {
    setOpen(false);
    requestSiteConfirmation({
      title: "Log out?",
      message: "Are you sure you want to logout?",
      description: "Your session will be cleared from this device.",
      cancelLabel: "Cancel",
      confirmLabel: "Logout",
      tone: "danger",
      onConfirm: async () => {
        const tokenKey =
          kind === "customer" ? "anhh-access-token" : "anhh-staff-access-token";
        const profileKey = kind === "customer" ? "anhh-customer" : "anhh-staff";
        const token = window.localStorage.getItem(tokenKey);
        try {
          if (token) await logoutSession(token);
        } catch {
          // Local cleanup still completes if the API is temporarily unavailable.
        } finally {
          window.localStorage.removeItem(tokenKey);
          window.localStorage.removeItem(profileKey);
          window.dispatchEvent(new Event("anhh-auth-changed"));
          router.replace(kind === "customer" ? "/" : "/staff/login");
        }
      },
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          compact
            ? "flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-[#003893] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4937d7]/30"
            : "header-icon-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4937d7]/30"
        }
        aria-label="Open account menu"
        title="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserRound size={compact ? 15 : 20} />
        {compact && <span>Account</span>}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className="account-profile-menu absolute right-0 top-[calc(100%+0.65rem)] z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-2xl"
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-extrabold text-slate-900">
              {name}
            </p>
            <p className="truncate text-xs text-slate-500">{email}</p>
            {accountTypeLabel && (
              <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#003893]">
                {accountTypeLabel}
              </p>
            )}
          </div>
          <div className="grid gap-0.5 py-1">
            {links.map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={link.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-50 hover:text-[#003893]"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={requestLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-extrabold text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
