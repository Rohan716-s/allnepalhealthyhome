import { AdminCmsPages } from "@/components/admin-cms-pages";
import { AdminShell } from "@/components/admin-shell";

export default function CmsManagementPage() {
  return <AdminShell superAdmin><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Website control</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">CMS pages</h1><p className="mt-2 text-sm text-slate-500">Publish database-backed pages with SEO metadata to the public website.</p></div><AdminCmsPages /></AdminShell>;
}
