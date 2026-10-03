import { AdminDeliveryZonesPage } from "@/components/admin-delivery-zones-page";

export default function AdminZoneCreateRoute() {
  return <AdminDeliveryZonesPage view="form" superAdmin={false} />;
}
