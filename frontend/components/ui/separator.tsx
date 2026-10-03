import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return <div role="separator" aria-orientation={orientation} className={cn("shrink-0 bg-slate-200", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)} />;
}
