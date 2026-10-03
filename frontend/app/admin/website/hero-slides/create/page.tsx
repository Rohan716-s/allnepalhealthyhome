import { AdminHeroSlidesPage } from "@/components/admin-hero-slides-page";

export default function CreateAdminHeroSlideRoute() {
  return <AdminHeroSlidesPage view="form" mode="create" superAdmin={false} />;
}
