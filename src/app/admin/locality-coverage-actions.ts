"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { marketplaceRpc,marketplacePending } from "@/lib/marketplace/rpc";
import type { FormState } from "@/lib/auth/validation";
export async function approveLocalityCoverage(_:FormState,form:FormData):Promise<FormState>{
 const {supabase}=await requireAccount("admin");
 const ids=z.array(z.uuid()).min(1).max(20).safeParse(form.getAll("locality_ids"));
 const professional=z.uuid().nullable().safeParse(form.get("professional_id")||null);
 const reason=z.string().trim().min(1).max(1000).safeParse(form.get("reason"));
 if(!ids.success||!professional.success||!reason.success||form.get("confirmed")!=="yes")return {error:"Select up to 20 Delhi localities, give a reason and explicitly confirm the coverage decision."};
 const r=await marketplaceRpc(supabase,"admin_approve_locality_coverage",{p_localities:[...new Set(ids.data)],p_professional:professional.data,p_reason:reason.data});
 if(r.error)return {error:marketplacePending(r.error)?"Locality-based coverage requires the reviewed database migration before it can be saved.":["22023","42501","23505"].includes(r.error.code??"")?r.error.message:"Coverage could not be saved. Reload before retrying."};
 for(const path of ["/admin/coverage","/admin/professionals","/admin/services/offerings","/admin/history","/professional/availability","/account/addresses","/professionals","/"])revalidatePath(path);
 return {success:professional.data?"Selected localities activated and coverage explicitly approved for this trainer. Approved offerings and saved availability are still required for bookings.":"Selected localities activated. Trainer coverage still requires separate explicit approval."};
}
