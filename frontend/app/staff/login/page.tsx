"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, loginStaff } from "@/services/api";
import { canReturnToStaffPath, staffDefaultPath } from "@/lib/staff-routing";
import { useSiteValue } from "@/components/site-config-provider";
import { ModernLoginShell } from "@/components/modern-login-shell";

export default function StaffLoginPage() {
  const router = useRouter();
  const signedInToast = useSiteValue("notification.toast.staffSignedIn", "Secure staff sign-in complete");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(credentials: { emailOrPhone: string; password: string }) {
    setError("");
    setLoading(true);
    try {
      const response = await loginStaff(credentials);
      window.localStorage.setItem("anhh-staff-access-token", response.accessToken);
      window.localStorage.setItem("anhh-staff", JSON.stringify(response.staff));
      window.dispatchEvent(new Event("anhh-auth-changed"));
      toast.success(signedInToast);
      const role = response.staff.role;
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.replace(canReturnToStaffPath(returnTo, role) ? returnTo! : staffDefaultPath(role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We could not sign you in.");
    } finally {
      setLoading(false);
    }
  }

  return <ModernLoginShell
    mode="staff"
    title="Welcome to your workspace"
    description="Sign in securely to access the pharmacy, delivery, admin, and superadmin workspaces assigned to your role."
    error={error}
    loading={loading}
    onSubmit={submit}
    onBack={() => router.push("/")}
    registerHref="/login"
  />;
}
