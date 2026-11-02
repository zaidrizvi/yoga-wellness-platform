"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { marketplacePending,marketplaceRpc } from "@/lib/marketplace/rpc";
import type { FormState } from "@/lib/auth/validation";
export async function requestLocations(_:FormState,form:FormData):Promise<FormState>{
  const {supabase}=await requireAccount("professional");
  const ids=z.array(z.uuid()).min(1).max(20).safeParse(form.getAll("locality_ids"));
  if(!ids.success||form.get("confirmed")!=="yes")return {error:"Choose at least one new Delhi locality and confirm your request."};
  const result=await marketplaceRpc(supabase,"request_locality_coverage",{p_locality_ids:[...new Set(ids.data)]});
  if(result.error)return {error:marketplacePending(result.error)?"Location requests require the pending locality-first migration.":["22023","23505","42501"].includes(result.error.code??"")?result.error.message:"The request could not be saved."};
  revalidatePath("/professional/locations");revalidatePath("/admin/coverage");return {success:"Locations submitted for review."};
}
