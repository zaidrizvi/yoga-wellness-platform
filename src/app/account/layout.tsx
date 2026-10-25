import { PanelNavigation } from "@/components/layout/panel-navigation";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAccount();
  const links = [{ href: "/account", label: "Personal profile" }, ...(role === "customer" ? [
    { href: "/professional/application-status", label: "Professional application" },
    { href: "/account/addresses", label: "Saved addresses" },
    { href: "/account/bookings", label: "Booking requests" },
  ] : role === "professional" ? [
    { href: "/professional", label: "Professional dashboard" },
    { href: "/account/professional", label: "My Profile" },
    { href: "/professional/services", label: "My Services" },
    { href: "/professional/services?kind=recurring_package", label: "Yoga Packages" },
    { href: "/professional/services#approval-status", label: "Approval Status" },
    { href: "/professional/availability", label: "Availability & areas" },
    { href: "/professional/appointments", label: "My Appointments" },
  ] : role === "admin" ? [
    { href: "/admin/bookings", label: "Bookings & appointments" },
    { href: "/admin/services/offerings", label: "Offering & price approvals" },
    { href: "/admin/coverage", label: "Coverage Management" },
    { href: "/admin/team", label: "Team Management" },
    { href: "/admin/history", label: "Review history" },
    { href: "/admin/professionals", label: "Professional reviews" },
    { href: "/admin/services", label: "Service publication" },
  ] : [])];
  return <section className="shell account-shell"><PanelNavigation label="Account navigation" links={links} />{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></section>;
}
