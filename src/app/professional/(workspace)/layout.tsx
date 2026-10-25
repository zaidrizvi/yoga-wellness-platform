import { redirect } from "next/navigation";
import { PanelNavigation } from "@/components/layout/panel-navigation";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAccount();
  if (role !== "professional") redirect(role === "customer" ? "/professional/application-status" : "/admin");
  return <section className="shell account-shell"><p className="eyebrow">Your professional practice</p><PanelNavigation label="Professional panel" links={[
    { href: "/professional", label: "Dashboard Overview" },
    { href: "/account/professional", label: "My Profile" },
    { href: "/professional/services", label: "My Services" },
    { href: "/professional/services?kind=recurring_package", label: "Yoga Packages" },
    { href: "/professional/services#approval-status", label: "Approval Status" },
    { href: "/professional/availability", label: "Availability & areas" },
    { href: "/professional/appointments", label: "My Appointments" },
    { href: "/account", label: "Personal account" },
  ]} />{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></section>;
}
