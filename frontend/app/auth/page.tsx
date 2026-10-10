"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, Building2, Calculator, KeyRound, Pill, ShieldCheck, Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { ApiError, loginCustomer, loginStaff } from "@/services/api";
import { canReturnToStaffPath, staffDefaultPath } from "@/lib/staff-routing";
import { useSiteValue } from "@/components/site-config-provider";
import { ModernLoginShell, type LoginRoleOption } from "@/components/modern-login-shell";
import { resumePendingGuestAction } from "@/lib/pending-guest-action";

const roles = [
  { key: "customer", label: "Customer", email: "customer@example.com", password: "Customer!123", path: "/account", Icon: Users },
  { key: "pharmacy", label: "Pharmacy", email: "pharmacy@example.com", password: "Pharmacy!123", path: "/account", Icon: Building2 },
  { key: "pharmacist", label: "Pharmacist", email: "pharmacist@example.com", password: "Pharmacist!123", path: "/pharmacist", Icon: Pill },
  { key: "delivery", label: "Delivery", email: "delivery@example.com", password: "Delivery!123", path: "/delivery", Icon: Truck },
  { key: "sales-executive", label: "Sales Executive", email: "sales@example.com", password: "Sales!123", path: "/sales-executive", Icon: BriefcaseBusiness },
  { key: "accountant", label: "Accountant", email: "accountant@example.com", password: "Accountant!123", path: "/accounts", Icon: Calculator },
  { key: "supervisor", label: "Supervisor", email: "supervisor@example.com", password: "Supervisor!123", path: "/admin", Icon: ShieldCheck },
  { key: "admin", label: "Admin", email: "admin@example.com", password: "Admin!123", path: "/admin", Icon: KeyRound },
  { key: "superadmin", label: "SuperAdmin", email: "superadmin@example.com", password: "SuperAdmin!123", path: "/superadmin", Icon: ShieldCheck },
] as const;

function AuthPageContent() {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<(typeof roles)[number]["key"]>("customer");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const staffSignedInToast = useSiteValue("notification.toast.staffSignedIn", "Secure staff sign-in complete");
  const customerSignedInToast = useSiteValue("notification.toast.signedIn", "Signed in successfully");
  const role = roles.find((item) => item.key === activeKey) ?? roles[0];
  const roleOptions: LoginRoleOption[] = roles.map(({ key, label, email, password, Icon }) => ({ key, label, email, password, Icon }));

  async function submit(credentials: { emailOrPhone: string; password: string }) {
    setMessage("");
    setLoading(true);
    try {
      let signedInStaffRole = "";
      let resumedReturnTo: string | null = null;
      if (role.key === "customer" || role.key === "pharmacy") {
        const response = await loginCustomer(credentials);
        localStorage.setItem("anhh-access-token", response.accessToken);
        localStorage.setItem("anhh-customer", JSON.stringify(response.customer));
        resumedReturnTo = (await resumePendingGuestAction(response.accessToken))?.returnTo ?? null;
        toast.success(customerSignedInToast);
      } else {
        const response = await loginStaff(credentials);
        signedInStaffRole = response.staff.role;
        localStorage.setItem("anhh-staff-access-token", response.accessToken);
        localStorage.setItem("anhh-staff", JSON.stringify(response.staff));
        toast.success(staffSignedInToast);
      }
      window.dispatchEvent(new Event("anhh-auth-changed"));
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      const canReturn = role.key === "customer" || role.key === "pharmacy"
        ? Boolean(returnTo?.startsWith("/") && !returnTo.startsWith("//"))
        : canReturnToStaffPath(returnTo, signedInStaffRole);
      const destination = signedInStaffRole ? staffDefaultPath(signedInStaffRole) : role.path;
      router.replace(resumedReturnTo ?? (canReturn ? returnTo! : destination));
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The API is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const returnTo = searchParams.get("returnTo");
  const registerParams = new URLSearchParams();
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    registerParams.set("returnTo", returnTo);
  }
  registerParams.set("cancelTo", `/auth${searchParams.size ? `?${searchParams.toString()}` : ""}`);
  const registerHref = `/register?${registerParams.toString()}`;

  return <ModernLoginShell
    key={activeKey}
    mode="customer"
    title="Sign in to continue"
    description="Access your orders, prescriptions, saved products, and the workspace for your role."
    error={message}
    loading={loading}
    onSubmit={submit}
    onBack={() => router.push("/")}
    registerHref={registerHref}
    roleOptions={roleOptions}
    activeRoleKey={activeKey}
    onRoleChange={(next) => { setActiveKey(next.key as (typeof roles)[number]["key"]); setMessage(""); }}
    demoCredentials={{ email: role.email, password: role.password }}
  />;
}

export default function AuthPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--color-background)]" />}><AuthPageContent /></Suspense>;
}
