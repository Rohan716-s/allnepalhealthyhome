import { AdminProductFormPage } from "@/components/admin-products-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function AdminProductEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/admin/products" title="Edit product"><AdminProductFormPage superAdmin={false} productId={id} /></AdminEditDialogShell>;
}
