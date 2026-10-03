import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkProps = LinkProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & Pick<ButtonProps, "variant" | "size"> & { children?: ReactNode };

export function ButtonLink({ className, variant = "default", size = "default", ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
