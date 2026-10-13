import Link from "next/link";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { Navigation } from "./navigation";

export function Header() {
  return <header id="top" className="site-header shell">
    <Brand />
    <Navigation />
    <Link href="/about#delhi-ncr" className="header-location"><span className="status-dot" /> Delhi NCR</Link>
    <MobileNav />
  </header>;
}
