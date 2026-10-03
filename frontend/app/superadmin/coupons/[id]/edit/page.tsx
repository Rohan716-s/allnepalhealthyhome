import { AdminCouponsPage } from "@/components/admin-coupons-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function SuperAdminCouponEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/superadmin/coupons" title="Edit coupon"><AdminCouponsPage view="form" couponId={id} /></AdminEditDialogShell>;
}
