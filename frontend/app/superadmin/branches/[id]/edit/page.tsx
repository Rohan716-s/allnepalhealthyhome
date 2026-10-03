import { AdminBranchesPage } from "@/components/admin-branches-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminBranchEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/branches" title="Edit branch"><AdminBranchesPage view="form" branchId={id} /></AdminEditDialogShell>;
}
