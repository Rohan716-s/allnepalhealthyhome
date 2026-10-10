import { notFound } from "next/navigation";
import { AdminCatalogTaxonomy, type CatalogEntity } from "@/components/admin-catalog-taxonomy";
import { AdminShell } from "@/components/admin-shell";
const normalize: Record<string,CatalogEntity> = { category:"category", categories:"category", brand:"brand", brands:"brand", manufacturer:"manufacturer", manufacturers:"manufacturer", medicine:"medicine", medicines:"medicine" };
export default async function Page({params}:{params:Promise<{entity:string;id?:string}>}) { const {entity:key,id}=await params;const entity=normalize[key];if(!entity)notFound();return <AdminShell superAdmin={true}><AdminCatalogTaxonomy superAdmin={true} entity={entity} view="form" entityId={id} /></AdminShell>; }
