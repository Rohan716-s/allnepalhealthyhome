"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = forwardRef<ElementRef<typeof DialogPrimitive.Overlay>, ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(({ className, ...props }, ref) => <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out", className)} {...props} />);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { overlayClassName?: string };
const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(({ className, children, overlayClassName, ...props }, ref) => <DialogPortal><DialogOverlay className={overlayClassName} /><DialogPrimitive.Content ref={ref} className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100", className)} {...props}>{children}<DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003893]/30" aria-label="Close dialog"><X size={18} /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPortal>);
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />; }
function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />; }
function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title className={cn("text-lg font-bold text-slate-950 dark:text-slate-50", className)} {...props} />; }
function DialogDescription({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description className={cn("text-sm text-slate-500 dark:text-slate-400", className)} {...props} />; }

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
