import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => <select ref={ref} className={cn("flex h-10 min-w-0 max-w-full w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#003893] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20", className)} {...props} />);
Select.displayName = "Select";

export { Select };
