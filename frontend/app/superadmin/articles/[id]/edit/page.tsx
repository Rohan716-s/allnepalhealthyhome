import { AdminHealthArticlesPage } from "@/components/admin-health-articles-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminArticleEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/articles" title="Edit article"><AdminHealthArticlesPage superAdmin view="form" articleId={id} /></AdminEditDialogShell>;
}
