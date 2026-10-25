import { redirect } from "next/navigation";
import { PanelNavigation } from "@/components/layout/panel-navigation";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";
import { Brand } from "@/components/layout/brand";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAccount();
  if (role !== "professional") redirect(role === "customer" ? "/professional/application-status" : "/admin");
  return <section className="workspace-shell"><aside className="workspace-sidebar"><Brand/><div><p className="eyebrow">Professional workspace</p><PanelNavigation label="Professional panel" links={[
    { href: "/professional", label: "Overview" },
    { href: "/professional/appointments", label: "Appointments" },
    { href: "/professional/services", label: "My Services" },
    { href: "/professional/services?kind=recurring_package", label: "Packages" },
    { href: "/professional/availability", label: "Availability" },
    { href: "/professional/availability#coverage", label: "Service Areas" },
    { href: "/account/professional", label: "Profile" },
    { href: "/account", label: "Personal account" },
  ]} /></div><div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></aside><div className="workspace-content">{children}</div></section>;
}
