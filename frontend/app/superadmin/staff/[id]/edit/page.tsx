import { AdminStaffPage } from "@/components/admin-staff-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminStaffEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/staff" title="Edit staff account"><AdminStaffPage view="form" staffId={id} /></AdminEditDialogShell>;
}
