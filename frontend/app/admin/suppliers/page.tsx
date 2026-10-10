import { AdminShell } from "@/components/admin-shell";
import { AdminLogisticsManagement } from "@/components/admin-logistics-management";
export default function Page(){return <AdminShell superAdmin={false}><AdminLogisticsManagement superAdmin={false} supplierOnly /></AdminShell>;}
