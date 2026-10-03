import { AdminDeliveryZonesPage } from "@/components/admin-delivery-zones-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminZoneEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/zones" title="Edit delivery zone"><AdminDeliveryZonesPage view="form" zoneId={id} /></AdminEditDialogShell>;
}
