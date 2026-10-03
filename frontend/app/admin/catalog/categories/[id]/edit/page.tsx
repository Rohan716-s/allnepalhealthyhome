import { AdminCatalogTaxonomy } from "@/components/admin-catalog-taxonomy";
import { AdminShell } from "@/components/admin-shell";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function AdminCategoryEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/admin/catalog" title="Edit category"><AdminShell><div className="mx-auto max-w-4xl px-5 pb-16 lg:px-8"><AdminCatalogTaxonomy view="form" entity="category" entityId={id} /></div></AdminShell></AdminEditDialogShell>;
}
