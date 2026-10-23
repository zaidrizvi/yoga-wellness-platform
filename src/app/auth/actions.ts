"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/auth/redirect";
import { email, password, type FormState } from "@/lib/auth/validation";
import { getSiteUrl } from "@/config/site";

export async function authenticate(_: FormState, form: FormData): Promise<FormState> {
  const mode = form.get("mode");
  const destination = safeRedirect(form.get("next"));
  const supabase = await createClient();
  if (mode === "recovery") {
    const parsed = email.safeParse(form.get("email"));
    if (!parsed.success) return { error: "Enter a valid email address." };
    const origin = getSiteUrl();
    if (!origin) return { error: "Email recovery is temporarily unavailable. Please try again later." };
    // Always return the same result, including for unknown users and rate limits.
    await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: new URL("/auth/confirm?next=/update-password", origin).href });
    return { success: "If this address can receive recovery email, instructions will arrive shortly. Check your spam folder too." };
  }
  if (mode === "update") {
    const { user } = await requireAccount();
    if (!user) return { error: "Please open a valid recovery link or sign in again." };
    const parsed = password.safeParse(form.get("password"));
    if (!parsed.success || parsed.data !== form.get("confirmation")) return { error: "Use matching passwords of 12 to 128 characters." };
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    return error ? { error: "Your password could not be updated. Open a fresh recovery link and try again." } : { success: "Password updated. You can return to your account." };
  }
  const parsed = z.object({ email, password: mode === "signup" ? password : z.string().min(1).max(128) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and password. New passwords must have 12 to 128 characters." };
  if (mode === "signup") {
    const name = z.string().trim().min(1).max(120).safeParse(form.get("full_name"));
    if (!name.success || parsed.data.password !== form.get("confirmation")) return { error: "Enter your name and matching passwords." };
    const origin = getSiteUrl();
    if (!origin) return { error: "Registration email is temporarily unavailable. Please try again later." };
    const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { data: { full_name: name.data }, emailRedirectTo: new URL("/auth/confirm", origin).href } });
    if (error) return { error: "Registration could not be completed. Try again later, or sign in if you already have an account." };
    if (data.session) {
      // The database trigger creates the role. Profile enrichment is retryable.
      await supabase.rpc("ensure_own_profile", { new_full_name: name.data });
      redirect("/account");
    }
    return { success: "Check your email for confirmation instructions. If you already have an account, use Login or Forgot password." };
  }
  if (mode !== "login") return { error: "Invalid request." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Unable to sign in. Check your details and confirm your email, or try again later." };
  revalidatePath("/", "layout");
  redirect(destination);
}

export async function logout(): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.auth.signOut();
  if (error) return { error: "Unable to sign out. Please try again." };
  revalidatePath("/", "layout");
  redirect("/login");
}
