import { AdminProductFormPage } from "@/components/admin-products-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function EditSuperAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/products" title="Edit product"><AdminProductFormPage productId={id} /></AdminEditDialogShell>;
}
