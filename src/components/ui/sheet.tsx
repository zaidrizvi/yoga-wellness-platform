"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

function SheetContent({ children, className, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const reducedMotion = useReducedMotion();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/35" />
      <DialogPrimitive.Content asChild {...props}>
        <motion.div initial={reducedMotion ? false : { x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .18, ease: "easeOut" }} className={cn("fixed inset-y-0 right-0 z-50 flex w-[min(88vw,25rem)] flex-col overflow-y-auto bg-background px-7 py-9 shadow-xl", className)}>
        {children}
        <DialogPrimitive.Close className="absolute top-6 right-5 flex size-12 items-center justify-center rounded-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <X size={22} aria-hidden="true" /><span className="sr-only">Close navigation</span>
        </DialogPrimitive.Close>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
