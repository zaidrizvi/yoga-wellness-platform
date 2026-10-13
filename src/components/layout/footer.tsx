import { navigation, site } from "@/config/site";
import { Brand } from "./brand";
import Link from "next/link";
import { offerings } from "@/content/services";

export function Footer() {
  return <footer className="site-footer">
    <div className="shell footer-main">
      <div><Brand /><p>Personal wellness.<br />The comfort of home.</p></div>
      <div><p className="eyebrow footer-nav-title">Explore Aara</p><nav aria-label="Footer navigation">{navigation.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav></div>
      <div><p className="eyebrow footer-nav-title">Your wellbeing</p><nav aria-label="Service navigation" className="footer-service-links">{offerings.map((offering) => <Link key={offering.href} href={offering.href}>{offering.title}</Link>)}</nav></div>
      <div className="footer-location"><span className="eyebrow">Our first chapter</span><p>Delhi NCR</p><span>Preparing to launch.<br />Coverage subject to availability.</span></div>
    </div>
    <div className="shell footer-bottom"><span>© {new Date().getFullYear()} {site.name}. All rights reserved.</span><span>A thoughtful beginning.</span><a href="#top">Back to top ↑</a></div>
  </footer>;
}
