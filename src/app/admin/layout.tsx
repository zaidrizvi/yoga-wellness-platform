import { PanelNavigation } from "@/components/layout/panel-navigation";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";
import { Brand } from "@/components/layout/brand";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAccount("admin");
  return <section className="workspace-shell"><aside className="workspace-sidebar"><Brand/><div><p className="eyebrow">Admin workspace</p><PanelNavigation label="Administration" links={[
    { href: "/admin", label: "Overview" },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/professionals", label: "Trainers" },
    { href: "/admin/services/offerings", label: "Approvals" },
    { href: "/admin/services", label: "Services" },
    { href: "/admin/coverage", label: "Service Areas" },
    { href: "/admin/bundles", label: "Promotions" },
    { href: "/admin/team", label: "Team" },
    { href: "/admin/history", label: "Activity" },
    { href: "/account", label: "My account" },
  ]} /></div><div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></aside><div className="workspace-content">{children}</div></section>;
}
