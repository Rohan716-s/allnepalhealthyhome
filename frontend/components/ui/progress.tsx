import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value?: number; className?: string }) {
  return <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}><div className={cn("h-full rounded-full bg-teal-600 transition-all", value === undefined && "w-1/2 animate-pulse")} style={value === undefined ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
