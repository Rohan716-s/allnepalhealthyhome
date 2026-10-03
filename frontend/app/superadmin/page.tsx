import { AdminDashboardView } from "@/components/admin-dashboard";
import { AdminShell } from "@/components/admin-shell";

export default function SuperAdminPage() { return <AdminShell superAdmin><AdminDashboardView superAdmin /></AdminShell>; }
