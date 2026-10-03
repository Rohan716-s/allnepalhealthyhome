import { AdminCmsPages } from "@/components/admin-cms-pages";

export default function SuperAdminCmsCreateRoute() {
  return <AdminCmsPages view="form" embedded={false} />;
}
