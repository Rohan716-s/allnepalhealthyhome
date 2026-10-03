import { AdminCatalogTaxonomy } from "@/components/admin-catalog-taxonomy";
import { AdminShell } from "@/components/admin-shell";

export default function AdminCatalogRoute() {
  return (
    <AdminShell>
      <div className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <AdminCatalogTaxonomy view="list" />
      </div>
    </AdminShell>
  );
}
