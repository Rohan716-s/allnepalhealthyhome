import { AdminBranchesPage } from "@/components/admin-branches-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function AdminBranchEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/admin/branches" title="Edit branch"><AdminBranchesPage view="form" branchId={id} superAdmin={false} /></AdminEditDialogShell>;
}
