import { AdminNotificationTemplatesPage } from "@/components/admin-notification-templates-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminNotificationTemplateEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/notification-templates" title="Edit notification template"><AdminNotificationTemplatesPage superAdmin view="form" templateId={id} /></AdminEditDialogShell>;
}
