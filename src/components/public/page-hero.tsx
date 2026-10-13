import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EditorialImage } from "@/components/home/editorial-image";
import type { EditorialAsset } from "@/content/services";

export function PageHero({ eyebrow, title, emphasis, description, image, action, parent }: {
  eyebrow: string; title: string; emphasis: string; description: string;
  image?: EditorialAsset; action?: { href: string; label: string }; parent?: { href: string; label: string };
}) {
  return <section className={`page-hero shell${image ? " page-hero-split" : ""}`} aria-labelledby="page-title">
    <div className="page-hero-copy">
      <nav aria-label="Breadcrumb" className="breadcrumbs"><Link href="/">Home</Link><span aria-hidden="true">/</span>{parent && <><Link href={parent.href}>{parent.label}</Link><span aria-hidden="true">/</span></>}<span>{eyebrow}</span></nav>
      <p className="eyebrow">{eyebrow} · At home in Delhi NCR</p>
      <h1 id="page-title">{title}<br /><em>{emphasis}</em></h1>
      <p className="page-introduction">{description}</p>
      {action && <Link href={action.href} className="text-link">{action.label}<ArrowUpRight size={17} aria-hidden="true" /></Link>}
    </div>
    {image && <EditorialImage {...image} priority />}
  </section>;
}
