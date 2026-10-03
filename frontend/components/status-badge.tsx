import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  "Pending review": "border-amber-200 bg-amber-50 text-amber-800",
  "Under Review": "border-blue-200 bg-blue-50 text-blue-800",
  Confirmed: "border-teal-200 bg-teal-50 text-teal-800",
  Processing: "border-blue-200 bg-blue-50 text-blue-800",
  Shipped: "border-violet-200 bg-violet-50 text-violet-800",
  Delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Cancelled: "border-rose-200 bg-rose-50 text-rose-800",
  "Low stock": "border-amber-200 bg-amber-50 text-amber-800",
  "In stock": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Out of stock": "border-rose-200 bg-rose-50 text-rose-800",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={statusStyles[status] ?? "border-slate-200 bg-slate-50 text-slate-700"}>{status}</Badge>;
}
