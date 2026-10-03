import { AdminRolesPage } from "@/components/admin-roles-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminRoleEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/roles" title="Edit role"><AdminRolesPage view="form" roleId={id} /></AdminEditDialogShell>;
}
