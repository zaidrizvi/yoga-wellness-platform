import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { Navigation } from "./navigation";
import { AuthNavigation } from "./auth-navigation";
import { NavigationAccount } from "./navigation-account";

export function Header() {
  return <NavigationAccount><header id="top" className="site-header shell">
    <Brand />
    <Navigation />
    <AuthNavigation />
    <MobileNav />
  </header></NavigationAccount>;
}
