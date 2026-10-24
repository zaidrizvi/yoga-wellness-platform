import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { logout } from "@/app/auth/actions";
import { ActionForm } from "@/components/auth/action-form";

export default async function ApplicationLayout({children}:{children:React.ReactNode}){
  const {role}=await requireAccount();
  return <section className="shell account-shell applicant-workspace"><p className="eyebrow">Your professional application</p><nav className="account-links panel-navigation" aria-label="Application navigation"><Link href="/professional/apply">Application details</Link><Link href="/professional/application-status">Application Status</Link><Link href="/join-as-professional">Working with Aara</Link>{role==="professional"?<Link href="/professional">Professional dashboard</Link>:<Link href="/account">My account</Link>}</nav>{children}<div className="logout-area"><ActionForm action={logout} submit="Sign out"/></div></section>;
}
