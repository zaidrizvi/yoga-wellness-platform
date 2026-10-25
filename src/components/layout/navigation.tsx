"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/site";
import { SheetClose } from "@/components/ui/sheet";
import { useNavigationAccount } from "./navigation-account";

export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const status = useNavigationAccount();
  return <nav aria-label={mobile ? "Mobile navigation" : "Main navigation"} className={mobile ? "mobile-links" : "desktop-navigation"}>
    {navigation.filter(link => link.href !== "/join-as-professional" || status?.authenticated === false).map((link) => {
      const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
      const anchor = <Link href={link.href} aria-current={active ? "page" : undefined}>{link.label}</Link>;
      return mobile ? <SheetClose asChild key={link.href}>{anchor}</SheetClose> : <span key={link.href}>{anchor}</span>;
    })}
  </nav>;
}
