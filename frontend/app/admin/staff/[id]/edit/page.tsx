import { AdminStaffPage } from "@/components/admin-staff-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function AdminStaffEditRoute({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AdminEditDialogShell listHref="/admin/staff" title="Edit staff account"><AdminStaffPage superAdmin={false} view="form" staffId={id} /></AdminEditDialogShell>; }
