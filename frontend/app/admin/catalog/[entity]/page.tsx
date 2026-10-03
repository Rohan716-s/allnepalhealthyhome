import { notFound } from "next/navigation";
import { AdminCatalogTaxonomy, type CatalogEntity } from "@/components/admin-catalog-taxonomy";
import { AdminShell } from "@/components/admin-shell";

const entities: CatalogEntity[] = ["category", "brand", "manufacturer", "medicine"];

export default async function AdminCatalogEntityRoute({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!entities.includes(entity as CatalogEntity)) notFound();
  return <AdminShell><div className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><AdminCatalogTaxonomy entity={entity as CatalogEntity} /></div></AdminShell>;
}
