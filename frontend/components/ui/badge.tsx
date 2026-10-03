import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
      secondary: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      outline: "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300",
      destructive: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
