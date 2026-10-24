"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export function AuthNavigation() {
  const pathname = usePathname();
  const [status, setStatus] = useState<{ authenticated?: boolean; role?: string; unavailable?: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/auth/status", { cache: "no-store", signal: controller.signal }).then(r => r.json()).then(setStatus).catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  return <nav className="auth-navigation" aria-label="Your account">
    {status?.authenticated ? <><Link href="/account">{status.role === "professional" ? "Account Settings" : "Account"}</Link>{status.role === "customer" && <Link href="/professional/application-status">Professional application</Link>}{status.role === "professional" && <Link href="/professional">Professional dashboard</Link>}{status.role === "admin" && <Link href="/admin">Admin</Link>}<ActionForm action={logout} submit="Logout" /></> : <><Link href="/login">Login</Link><Link href="/signup">Sign up</Link></>}
    {status?.unavailable && <span role="status">Account unavailable</span>}
  </nav>;
}
