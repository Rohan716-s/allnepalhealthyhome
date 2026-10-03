import { AdminBranchesPage } from "@/components/admin-branches-page";

export default function AdminBranchCreateRoute() {
  return <AdminBranchesPage view="form" superAdmin={false} />;
}
