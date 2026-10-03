import { AdminNotificationTemplatesPage } from "@/components/admin-notification-templates-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function AdminNotificationTemplateEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/admin/notification-templates" title="Edit notification template"><AdminNotificationTemplatesPage view="form" templateId={id} /></AdminEditDialogShell>;
}
