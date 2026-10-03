"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Keeps edit forms in a consistent modal while the list remains a separate
 * route. Direct visits to an edit URL still work because the route owns the
 * form; closing the modal returns to the supplied list route.
 */
export function AdminEditDialogShell({
  children,
  title = "Edit record",
  listHref,
}: {
  children: React.ReactNode;
  title?: string;
  listHref: string;
}) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) router.push(listHref); }}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-6xl border-slate-200 bg-slate-50 p-0 sm:max-h-[92vh] sm:w-[calc(100%-2rem)] sm:rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Edit the selected record and save the changes.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto p-3 sm:max-h-[84vh] sm:p-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
