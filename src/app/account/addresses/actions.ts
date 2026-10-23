"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { addressSchema } from "@/lib/booking/validation";
import type { FormState } from "@/lib/auth/validation";

export async function saveAddress(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireAccount("customer");
  const parsed = addressSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the address fields." };
  const id = form.get("address_id");
  if (id && !z.uuid().safeParse(id).success) return { error: "Invalid address." };
  const result = id
    ? await supabase.from("customer_addresses").update(parsed.data).eq("id", String(id)).eq("customer_id", user.id).select("id").single()
    : await supabase.from("customer_addresses").insert(parsed.data).select("id").single();
  if (result.error || !result.data) return { error: "Address could not be saved. Check your details and try again." };
  revalidatePath("/account/addresses");
  const returnTo = form.get("return_to");
  if (!id && typeof returnTo === "string" && /^\/book\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(returnTo)) redirect(`${returnTo}?address=${result.data.id}`);
  return { success: "Address saved." };
}
export async function deleteAddress(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireAccount("customer");
  const id = z.uuid().safeParse(form.get("address_id"));
  if (!id.success || form.get("confirmed") !== "yes") return { error: "Confirm which address you want to delete." };
  const { data, error } = await supabase.from("customer_addresses").delete().eq("id", id.data).eq("customer_id", user.id).select("id").single();
  if (error || !data) return { error: "Address could not be deleted. It may have already been removed." };
  revalidatePath("/account/addresses");
  return { success: "Saved address deleted. Existing booking details are unchanged." };
}
