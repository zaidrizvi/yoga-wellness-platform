import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAccount();
  return <section className="shell account-shell"><nav className="account-links" aria-label="Account navigation"><Link href="/account">Personal profile</Link>{role === "professional" && <Link href="/account/professional">Professional profile</Link>}{role === "admin" && <><Link href="/admin/professionals">Professional reviews</Link><Link href="/admin/services">Service publication</Link></>}</nav>{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out" /></div></section>;
}
