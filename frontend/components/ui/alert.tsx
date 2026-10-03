import { cn } from "@/lib/utils";

export function Alert({ className, children }: { className?: string; children: React.ReactNode }) { return <div role="alert" className={cn("rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900", className)}>{children}</div>; }
