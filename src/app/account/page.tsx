import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { saveProfile } from "./actions";

export const metadata = { title: "Your account | Aara" };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { supabase, user, role } = await requireAccount();
  const { data: profile, error } = await supabase.rpc("ensure_own_profile", { new_full_name: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.slice(0, 120) : "" });
  const { notice } = await searchParams;
  return <><p className="eyebrow">Your personal space</p><h1>Your account.</h1>{notice === "restricted" && <p role="alert">This area is restricted to the appropriate account role.</p>}<p>{user.email}</p><p>Account role: {role}</p>{error && <p role="alert">Your profile could not be loaded. Saving below will retry profile initialization.</p>}<ActionForm action={saveProfile}><label>Full name<input name="full_name" defaultValue={profile?.full_name ?? ""} autoComplete="name" required maxLength={120} /></label><label>Phone number (optional)<input type="tel" name="phone" defaultValue={profile?.phone ?? ""} autoComplete="tel" maxLength={20} /></label></ActionForm></>;
}
