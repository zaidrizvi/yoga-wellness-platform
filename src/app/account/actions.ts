"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { profileSchema, professionalSchema, type FormState } from "@/lib/auth/validation";

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireAccount();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check your name (up to 120 characters) and phone number." };
  const initialized = await supabase.rpc("ensure_own_profile", { new_full_name: parsed.data.full_name });
  if (initialized.error) return { error: "Your profile is temporarily unavailable. Please retry." };
  const { data, error } = await supabase.from("profiles").update({ ...parsed.data, phone: parsed.data.phone || null }).eq("id", user.id).select("id").single();
  if (error || !data) return { error: "Unable to save your profile. Please try again." };
  revalidatePath("/account");
  return { success: "Your profile has been saved." };
}

export async function saveProfessional(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireAccount("professional");
  const parsed = professionalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the field lengths and include your display name." };
  const { data, error } = await supabase.from("professional_profiles").update(parsed.data).eq("user_id", user.id).select("user_id").single();
  if (error || !data) return { error: "Changes could not be saved. Verified or suspended profiles must be reopened by an administrator." };
  revalidatePath("/account/professional");
  revalidatePath("/professionals");
  return { success: "Your professional information has been saved." };
}
