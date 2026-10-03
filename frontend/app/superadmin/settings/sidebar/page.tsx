import { AdminShell } from "@/components/admin-shell";
import { RoleSidebarSettings } from "@/components/role-sidebar-settings";
import { SuperadminSidebarThemeSettings } from "@/components/superadmin-sidebar-theme-settings";

export default function SuperadminSidebarSettingsPage() {
  return (
    <AdminShell superAdmin>
      <div className="space-y-7">
        <RoleSidebarSettings />
        <SuperadminSidebarThemeSettings />
      </div>
    </AdminShell>
  );
}
