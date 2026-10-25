"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PanelLink = { href: string; label: string };
type Props = { label: string; links: PanelLink[] };

function Links({ label, links, activeHref }: Props & { activeHref?: string }) {
  return <nav className="account-links panel-navigation" aria-label={label}>{links.map(link =>
    <Link key={link.href} href={link.href} aria-current={link.href === activeHref ? "page" : undefined}>{link.label}</Link>
  )}</nav>;
}

function CurrentNavigation(props: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const active = props.links.filter(link => {
    if (link.href.includes("#")) return false;
    const [route, query] = link.href.split("?");
    return (pathname === route || pathname.startsWith(`${route}/`)) &&
      (!query || [...new URLSearchParams(query)].every(([key, value]) => search.get(key) === value));
  }).sort((a, b) => b.href.length - a.href.length)[0];
  return <Links {...props} activeHref={active?.href} />;
}

export function PanelNavigation(props: Props) {
  return <Suspense fallback={<Links {...props} />}><CurrentNavigation {...props} /></Suspense>;
}
