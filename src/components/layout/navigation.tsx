"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SheetClose } from "@/components/ui/sheet";

const explore = [{ href: "/services", label: "All Services" }, { href: "/services/personal-yoga", label: "Yoga" }];
const about = [{ href: "/how-it-works", label: "How It Works" }, { href: "/about", label: "About Aara" }, { href: "/join-as-professional", label: "Join as Professional" }];
const primary = [{ href: "/professionals", label: "Find Trainers" }, { href: "/yoga-programs", label: "Yoga Packages" }];

function activeRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function MenuGroup({ label, links, pathname, open, setOpen }: {
  label: string; links: typeof explore; pathname: string; open: boolean; setOpen: (value: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open, setOpen]);
  const active = links.some((link) => activeRoute(pathname, link.href));
  return <div className="nav-group" ref={ref}>
    <button type="button" className="nav-group-trigger" aria-expanded={open} aria-haspopup="menu" aria-current={active ? "page" : undefined} onClick={() => setOpen(!open)}>{label}<ChevronDown aria-hidden="true" /></button>
    {open && <div className="nav-dropdown" role="menu">{links.map((link) => <Link key={link.href} role="menuitem" href={link.href} aria-current={activeRoute(pathname, link.href) ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}</div>}
  </div>;
}

export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  if (mobile) return <nav aria-label="Mobile navigation" className="mobile-links">
    <details><summary>Explore <ChevronDown aria-hidden="true" /></summary>{explore.map((link) => <SheetClose asChild key={link.href}><Link href={link.href} aria-current={activeRoute(pathname, link.href) ? "page" : undefined}>{link.label}</Link></SheetClose>)}</details>
    {primary.map((link) => <SheetClose asChild key={link.href}><Link href={link.href} aria-current={activeRoute(pathname, link.href) ? "page" : undefined}>{link.label}</Link></SheetClose>)}
    <details><summary>About <ChevronDown aria-hidden="true" /></summary>{about.map((link) => <SheetClose asChild key={link.href}><Link href={link.href} aria-current={activeRoute(pathname, link.href) ? "page" : undefined}>{link.label}</Link></SheetClose>)}</details>
  </nav>;
  return <nav aria-label="Main navigation" className="desktop-navigation">
    <MenuGroup label="Explore" links={explore} pathname={pathname} open={open === "explore"} setOpen={(value) => setOpen(value ? "explore" : null)} />
    {primary.map((link) => <Link key={link.href} href={link.href} aria-current={activeRoute(pathname, link.href) ? "page" : undefined}>{link.label}</Link>)}
    <MenuGroup label="About" links={about} pathname={pathname} open={open === "about"} setOpen={(value) => setOpen(value ? "about" : null)} />
  </nav>;
}
