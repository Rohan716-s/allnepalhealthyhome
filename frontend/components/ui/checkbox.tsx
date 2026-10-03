import * as React from "react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => <input ref={ref} type="checkbox" className={cn("h-4 w-4 rounded border-slate-300 accent-teal-700 focus:ring-2 focus:ring-teal-200", className)} {...props} />);
Checkbox.displayName = "Checkbox";

export { Checkbox };
