import { AdminHealthArticlesPage } from "@/components/admin-health-articles-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function AdminArticleEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/admin/articles" title="Edit article"><AdminHealthArticlesPage view="form" articleId={id} /></AdminEditDialogShell>;
}
