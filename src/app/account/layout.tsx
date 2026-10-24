import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAccount();
  return <section className="shell account-shell"><nav className="account-links" aria-label="Account navigation"><Link href="/account">Personal profile</Link>{role === "customer" && <><Link href="/professional/application-status">Professional application</Link><Link href="/account/addresses">Saved addresses</Link><Link href="/account/bookings">Booking requests</Link></>}{role === "professional" && <><Link href="/professional">Professional dashboard</Link><Link href="/account/professional">My Profile</Link><Link href="/professional/services">My Services</Link><Link href="/professional/services?kind=recurring_package">Yoga Packages</Link><Link href="/professional/services#approval-status">Approval Status</Link><Link href="/professional/availability">Availability & areas</Link><Link href="/professional/appointments">My Appointments</Link></>}{role === "admin" && <><Link href="/admin/bookings">Bookings & appointments</Link><Link href="/admin/services/offerings">Offering & price approvals</Link><Link href="/admin/history">Review history</Link><Link href="/admin/professionals">Professional reviews</Link><Link href="/admin/services">Service publication</Link></>}</nav>{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></section>;
}
