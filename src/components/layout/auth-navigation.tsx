"use client";
import Link from "next/link";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";
import { SheetClose } from "@/components/ui/sheet";
import { useNavigationAccount } from "./navigation-account";

export function AuthNavigation({ mobile = false }: { mobile?: boolean }) {
  const status = useNavigationAccount();
  const links = !status?.authenticated
    ? [{ href: "/login", label: "Login" }, { href: "/signup", label: "Signup" }]
    : status.role === "admin" ? [{ href: "/admin", label: "Admin Dashboard" }]
    : status.role === "professional" ? [{ href: "/professional", label: "Professional Dashboard" }, { href: "/professional/appointments", label: "Appointments" }]
    : [{ href: "/account", label: "My Account" }, status.applicationPendingOrRejected
      ? { href: "/professional/application-status", label: "Application Status" }
      : { href: "/account/bookings", label: "My Bookings" }];
  return <nav className={mobile ? "mobile-account-navigation" : "auth-navigation"} aria-label={mobile ? "Mobile account" : "Your account"}>
    {!status ? <span role="status">Loading account…</span> : status.unavailable ? <span role="status">Account unavailable</span> : <>
      {links.map(link => { const anchor = <Link href={link.href}>{link.label}</Link>; return mobile ? <SheetClose asChild key={link.href}>{anchor}</SheetClose> : <span key={link.href}>{anchor}</span>; })}
      {status.authenticated && <ActionForm action={logout} submit="Logout" />}
    </>}
  </nav>;
}
