import { AdminFlashSalesPage } from "@/components/admin-flash-sales-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminFlashSaleEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/flash-sales" title="Edit flash sale"><AdminFlashSalesPage superAdmin view="form" saleId={id} /></AdminEditDialogShell>;
}
