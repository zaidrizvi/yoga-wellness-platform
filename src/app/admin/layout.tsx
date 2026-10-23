import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAccount("admin");
  return <section className="shell account-shell"><p className="eyebrow">Administration</p><nav className="account-links" aria-label="Administration"><Link href="/admin/bookings">Booking Requests & Appointments</Link><Link href="/admin/services/offerings">Service & Price Approvals</Link><Link href="/admin/history">Review History</Link><Link href="/admin/professionals">Professional reviews</Link><Link href="/admin/services">Service publication</Link><Link href="/account">My account</Link></nav>{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></section>;
}
