import { PanelNavigation } from "@/components/layout/panel-navigation";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAccount("admin");
  return <section className="shell account-shell"><p className="eyebrow">Administration</p><PanelNavigation label="Administration" links={[
    { href: "/admin/bookings", label: "Booking Requests & Appointments" },
    { href: "/admin/services/offerings", label: "Service & Price Approvals" },
    { href: "/admin/coverage", label: "Coverage Management" },
    { href: "/admin/team", label: "Team Management" },
    { href: "/admin/history", label: "Review History" },
    { href: "/admin/professionals", label: "Professional reviews" },
    { href: "/admin/services", label: "Service publication" },
    { href: "/account", label: "My account" },
  ]} />{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></section>;
}
