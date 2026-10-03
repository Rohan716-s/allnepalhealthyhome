import { AdminCmsPages } from "@/components/admin-cms-pages";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminCmsEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/cms" title="Edit CMS page"><AdminCmsPages view="form" pageId={id} embedded /></AdminEditDialogShell>;
}
