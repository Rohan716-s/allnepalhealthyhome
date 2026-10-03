import { notFound } from "next/navigation";
import { AdminCatalogTaxonomy, type CatalogEntity } from "@/components/admin-catalog-taxonomy";
import { AdminShell } from "@/components/admin-shell";

const entities: CatalogEntity[] = ["category", "brand", "manufacturer", "medicine"];

export default async function SuperAdminCatalogEntityRoute({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!entities.includes(entity as CatalogEntity)) notFound();
  return <AdminShell superAdmin><div className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><AdminCatalogTaxonomy superAdmin entity={entity as CatalogEntity} /></div></AdminShell>;
}
