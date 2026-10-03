import { AdminHeroSlidesPage } from "@/components/admin-hero-slides-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default async function EditAdminHeroSlideRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEditDialogShell listHref="/admin/website/hero-slides" title="Edit hero slide"><AdminHeroSlidesPage view="form" mode="edit" slideId={id} superAdmin={false} /></AdminEditDialogShell>;
}
