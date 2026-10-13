"use client";

import { Menu } from "lucide-react";
import { site } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Navigation } from "./navigation";

export function MobileNav() {
  return <div className="mobile-navigation">
    <Sheet>
      <SheetTrigger asChild><Button variant="ghost" aria-label="Open navigation"><Menu aria-hidden="true" /></Button></SheetTrigger>
      <SheetContent>
        <SheetTitle className="font-heading text-4xl text-primary">{site.name.toLowerCase()}.</SheetTitle>
        <SheetDescription className="mt-3 max-w-56 text-sm text-muted-foreground">A little more space for your wellbeing.</SheetDescription>
        <Navigation mobile />
        <p className="mt-auto pt-10 text-xs tracking-widest uppercase text-muted-foreground">Preparing to launch · Delhi NCR</p>
      </SheetContent>
    </Sheet>
  </div>;
}
