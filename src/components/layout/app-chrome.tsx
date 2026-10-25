"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";
import { Header } from "./header";

const publicProfessionalRoutes = ["/professional/login", "/professional/register", "/professional/apply", "/professional/application-status"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = pathname.startsWith("/admin") ||
    (pathname.startsWith("/professional") && !publicProfessionalRoutes.some((route) => pathname.startsWith(route)));
  if (workspace) return <main id="main" className="workspace-main" tabIndex={-1}>{children}</main>;
  return <><Header /><main id="main" tabIndex={-1}>{children}</main><Footer /></>;
}
