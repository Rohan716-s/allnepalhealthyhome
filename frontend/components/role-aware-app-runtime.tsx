"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ConfirmationModalHost } from "@/components/confirmation-modal";
import { NotificationRealtime } from "@/components/notification-realtime";
import { ShopProvider } from "@/components/shop-provider";
import { useSiteConfig } from "@/components/site-config-provider";
import { canReturnToStaffPath, isStaffWorkspacePath, staffDefaultPath } from "@/lib/staff-routing";

const SitePopup = dynamic(
  () => import("@/components/site-popup").then((module) => module.SitePopup),
  { ssr: false },
);
const AiPharmacyAssistant = dynamic(
  () => import("@/components/ai-pharmacy-assistant").then((module) => module.AiPharmacyAssistant),
  { ssr: false },
);

export function RoleAwareAppRuntime({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { authenticatedStaffRole, roleResolved } = useSiteConfig();
  const staffRoute = isStaffWorkspacePath(pathname);
  const customerMessagesRoute = pathname === "/messages"
    && !authenticatedStaffRole
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("account") === "customer";
  const staffWorkspaceRoute = staffRoute && !customerMessagesRoute;
  // Login owns its post-auth destination, including a permitted returnTo.
  // A second redirect here can race that navigation after auth-changed fires.
  const loginRoute = pathname === "/staff/login" || pathname === "/auth";
  const staffDestinationAllowed = Boolean(
    roleResolved
      && authenticatedStaffRole
      && canReturnToStaffPath(
        typeof window === "undefined" ? pathname : `${pathname}${window.location.search}`,
        authenticatedStaffRole,
      ),
  );
  const redirectStaffToWorkspace = Boolean(
    roleResolved && authenticatedStaffRole && !staffDestinationAllowed && !loginRoute,
  );
  const customerFeaturesEnabled = Boolean(
    roleResolved && !authenticatedStaffRole && !staffWorkspaceRoute,
  );
  const shopFeaturesEnabled = Boolean(
    roleResolved
      && !authenticatedStaffRole
      && (!staffWorkspaceRoute || customerMessagesRoute),
  );

  useEffect(() => {
    if (!redirectStaffToWorkspace || !authenticatedStaffRole) return;
    const destination = staffDefaultPath(authenticatedStaffRole);
    // A stalled Flight request must not leave the full-screen overlay forever.
    // A document navigation also recovers from an outdated client route cache.
    const recovery = window.setTimeout(() => {
      if (window.location.pathname !== destination) window.location.replace(destination);
    }, 8000);
    router.replace(destination);
    return () => window.clearTimeout(recovery);
  }, [authenticatedStaffRole, redirectStaffToWorkspace, pathname, router]);

  return (
    <ShopProvider enabled={shopFeaturesEnabled}>
      <NotificationRealtime />
      {children}
      {redirectStaffToWorkspace && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[100] grid min-h-screen place-items-center bg-slate-100 px-6 text-center text-sm font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <div className="space-y-3">
            <p>Opening your staff workspace…</p>
            <a href={staffDefaultPath(authenticatedStaffRole!)} className="inline-block underline underline-offset-4">
              Open workspace
            </a>
          </div>
        </div>
      )}
      {customerFeaturesEnabled && (
        <>
          <SitePopup />
          {modal}
          <AiPharmacyAssistant />
        </>
      )}
      <ConfirmationModalHost />
    </ShopProvider>
  );
}
