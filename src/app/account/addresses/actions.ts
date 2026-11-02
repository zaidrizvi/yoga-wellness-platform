"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { addressSchema } from "@/lib/booking/validation";
import type { FormState } from "@/lib/auth/validation";
import { marketplaceRpc,marketplacePending } from "@/lib/marketplace/rpc";
import { directReturn } from "@/lib/marketplace/contracts";

export async function saveAddress(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireAccount("customer");
  if(form.get("locality_id")){
    const area=z.uuid().safeParse(form.get("locality_id"));
    const details=addressSchema.omit({locality:true,city:true,state:true,postal_code:true}).safeParse(Object.fromEntries(form));
    const id=form.get("address_id")||null;
    if(!area.success||!details.success||(id&&!z.uuid().safeParse(id).success))return {error:"Choose a Delhi locality and check your contact and address details."};
    const r=await marketplaceRpc(supabase,"save_locality_address",{p_id:id as string|null,p_locality:area.data,p_service_area:null,p_details:details.data});
    if(r.error)return {error:marketplacePending(r.error)?"Locality-based addresses require the pending database migration.":"The address could not be saved. Review its locality and contact details."};
    revalidatePath("/account/addresses");const back=directReturn(form.get("return_to"));if(back)redirect(back);return {success:"Address saved."};
  }
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
