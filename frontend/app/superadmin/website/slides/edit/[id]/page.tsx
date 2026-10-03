"use client";

import { use } from "react";
import { AdminHeroSlidesPage } from "@/components/admin-hero-slides-page";
import { AdminEditDialogShell } from "@/components/admin-edit-dialog-shell";

export default function EditSlideshowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminEditDialogShell listHref="/superadmin/website/slides" title="Edit slide"><AdminHeroSlidesPage view="form" mode="edit" slideId={id} /></AdminEditDialogShell>;
}
