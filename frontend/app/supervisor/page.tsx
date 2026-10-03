import { AdminDashboardView } from "@/components/admin-dashboard";
import { AdminShell } from "@/components/admin-shell";

export default function SupervisorDashboardRoute() {
  return (
    <AdminShell supervisor>
      <AdminDashboardView />
    </AdminShell>
  );
}
