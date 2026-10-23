import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "professional" | "admin";

export async function currentAccount() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: entry, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleError || !entry || !["customer", "professional", "admin"].includes(entry.role)) {
    throw new Error("Your account permissions are temporarily unavailable. Please try again.");
  }
  return { supabase, user, role: entry.role as Role };
}

export async function requireAccount(role?: Role) {
  const account = await currentAccount();
  if (!account) redirect("/login");
  if (role && account.role !== role) redirect("/account?notice=restricted");
  return account;
}
