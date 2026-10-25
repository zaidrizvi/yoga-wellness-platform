import { PanelNavigation } from "@/components/layout/panel-navigation";
import { requireAccount } from "@/lib/auth/session";
import { logout } from "@/app/auth/actions";
import { ActionForm } from "@/components/auth/action-form";

export default async function ApplicationLayout({children}:{children:React.ReactNode}){
  const {role}=await requireAccount();
  return <section className="shell account-shell applicant-workspace"><p className="eyebrow">Your professional application</p><PanelNavigation label="Application navigation" links={[
    { href: "/professional/apply", label: "Application details" },
    { href: "/professional/application-status", label: "Application Status" },
    { href: "/join-as-professional", label: "Working with Aara" },
    role === "professional" ? { href: "/professional", label: "Professional dashboard" } : { href: "/account", label: "My account" },
  ]} />{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out"/></div></section>;
}
