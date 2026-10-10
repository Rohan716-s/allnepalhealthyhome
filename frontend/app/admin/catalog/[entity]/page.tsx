import { notFound } from "next/navigation";
import { AdminCatalogTaxonomy, type CatalogEntity } from "@/components/admin-catalog-taxonomy";
import { AdminShell } from "@/components/admin-shell";
const normalize: Record<string,CatalogEntity> = { category:"category", categories:"category", brand:"brand", brands:"brand", manufacturer:"manufacturer", manufacturers:"manufacturer", medicine:"medicine", medicines:"medicine" };
export default async function Page({params}:{params:Promise<{entity:string}>}) { const {entity:key}=await params;const entity=normalize[key];if(!entity)notFound();return <AdminShell superAdmin={false}><AdminCatalogTaxonomy superAdmin={false} entity={entity} view="list" /></AdminShell>; }
