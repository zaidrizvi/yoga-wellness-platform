import Link from "next/link";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { Navigation } from "./navigation";
import { AuthNavigation } from "./auth-navigation";

export function Header() {
  return <header id="top" className="site-header shell">
    <Brand />
    <Navigation />
    <AuthNavigation />
    <Link href="/about#delhi-ncr" className="header-location"><span className="status-dot" /> Delhi NCR</Link>
    <MobileNav />
  </header>;
}
