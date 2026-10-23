import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  await requireAccount("professional");
  return <section className="shell account-shell"><p className="eyebrow">Your professional practice</p><nav className="account-links panel-navigation" aria-label="Professional panel"><Link href="/account/professional">My Profile</Link><Link href="/professional/services">My Services</Link><Link href="/professional/services?kind=recurring_package">Yoga Packages</Link><Link href="/professional/services#approval-status">Approval Status</Link><Link href="/professional/availability">Availability & areas</Link><Link href="/professional/appointments">My Appointments</Link><Link href="/account">Personal account</Link></nav>{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></section>;
}
