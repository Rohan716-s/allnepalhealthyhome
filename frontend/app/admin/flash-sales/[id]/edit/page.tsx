import { AdminFlashSalesPage } from "@/components/admin-flash-sales-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function AdminFlashSaleEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/admin/flash-sales" title="Edit flash sale"><AdminFlashSalesPage view="form" saleId={id} /></AdminEditDialogShell>;
}
