import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <section className="not-found shell"><p className="eyebrow">404 / A different path</p><h1>This page isn’t here.<br /><em>Let’s find your way.</em></h1><p>Explore the service collection or return home to discover the planned wellness experiences.</p><div className="hero-actions"><Button asChild><Link href="/services">Explore Services</Link></Button><Link href="/" className="text-link">Return home</Link></div></section>;
}
